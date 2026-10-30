import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
const id = '12345678-1234-1234-1234-123456789abc';

function fixture() {
  const rows = [];
  const settings = new Map();
  let statusChoices = [];
  const sheet = {
    getLastRow: () => rows.length,
    getMaxRows: () => 1000,
    appendRow: row => rows.push(row),
    setFrozenRows: () => {},
    setColumnWidth: () => {},
    hideColumns: () => {},
    deleteRow: row => rows.splice(row - 1, 1),
    getDataRange: () => ({ getValues: () => rows.map(row => row.slice()) }),
    getRange: (row, col) => ({
      getValue: () => rows[row - 1]?.[col - 1],
      setValue: value => { rows[row - 1][col - 1] = value; },
      setValues: values => values.forEach((value, index) => { rows[row - 1 + index] = value; }),
      setFontWeight: () => {}, setWrap: () => {}, clearDataValidations: () => {},
      setDataValidation: rule => { if (col === 2) statusChoices = rule; },
      createTextFinder: value => ({ matchEntireCell: () => ({
        findNext: () => {
          const index = rows.findIndex((entry, index) => index > 0 && entry[col - 1] === value);
          return index < 0 ? null : { getRow: () => index + 1 };
        }
      }) })
    })
  };
  const spreadsheet = {
    getId: () => 'sheet-id',
    getSheetByName: () => rows.length ? sheet : null,
    insertSheet: () => sheet
  };
  const context = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => spreadsheet,
      openById: value => value === 'sheet-id' ? spreadsheet : null,
      newDataValidation: () => ({ requireValueInList(values) { this.values = values; return this; },
        build() { return this.values; } })
    },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => settings.get(key) || '',
      setProperty: (key, value) => settings.set(key, value),
      deleteProperty: key => settings.delete(key)
    }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    Utilities: { getUuid: () => id },
    HtmlService: {
      XFrameOptionsMode: { ALLOWALL: 'allow-all' },
      createHtmlOutput: text => ({ text }),
      createTemplateFromFile: name => ({ name, evaluate() { return {
        setTitle() { return this; }, setXFrameOptionsMode() { return this; }
      }; } })
    },
    console: { log: () => {} }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  context.setupFeedback();
  return { context, rows, settings, getStatusChoices: () => statusChoices };
}

function review(overrides = {}) {
  return {
    id, message: 'Change this wording', version: 'a'.repeat(40),
    anchors: [{ page: 'index.html', selector: '#welcome', quote: 'Hello', label: 'Welcome' }],
    ...overrides
  };
}

test('sets up a private Sheet and stores one row per feedback ID', () => {
  const { context, rows, settings, getStatusChoices } = fixture();
  assert.equal(rows.length, 1);
  assert.equal(settings.get('SPREADSHEET_ID'), 'sheet-id');
  assert.equal(settings.get('ALLOWED_ORIGINS'), 'https://timmybirds.github.io');
  assert.deepEqual(Array.from(getStatusChoices()), ['New', 'In progress', 'Ready for review', 'Approved']);
  context.submitFeedback(review());
  context.submitFeedback(review());
  assert.equal(rows.length, 2);
  assert.equal(rows[1][1], 'New');
  assert.equal(rows[1][2], 'https://timmybirds.github.io/discovery-school/index.html');
  assert.equal(rows[1][0], 'Change this wording');
});

test('rejects invalid locations and safely stores formula-like feedback', () => {
  const { context, rows } = fixture();
  assert.throws(() => context.submitFeedback(review({ anchors: [{ page: '../bad', selector: 'x' }] })),
    /Invalid page location/);
  assert.equal(rows.length, 1);
  context.submitFeedback(review({ message: '=IMPORTDATA("bad")' }));
  assert.equal(rows[1][0], "'=IMPORTDATA(\"bad\")");
});

test('edits and deletes the feedback row identified by its private ID', () => {
  const { context, rows } = fixture();
  context.submitFeedback(review());
  context.changeFeedback({ id, action: 'edit', message: 'Better wording' });
  assert.equal(rows[1][0], 'Better wording');
  context.changeFeedback({ id, action: 'delete' });
  assert.equal(rows.length, 1);
  assert.equal(context.changeFeedback({ id, action: 'delete' }).alreadyDeleted, true);
  assert.throws(() => context.changeFeedback({ id, action: 'edit', message: 'Again' }),
    /Feedback was not found/);
});

test('moves existing feedback to the first column without losing its row', () => {
  const { context, rows } = fixture();
  rows[0] = ['ID', 'Submitted (UTC)', 'Status', 'Assigned to', 'Page URL',
    'Selected text', 'Element', 'Feedback', 'Related locations', 'Location data',
    'Site version', 'Approved', 'Notes'];
  rows.push([id, '2026-10-29', 'New', '', 'https://example.test', 'Hello', 'Welcome',
    'Existing comment', '', '[]', '', '', '']);
  context.setupFeedback();
  assert.equal(rows[0][0], 'Feedback');
  assert.equal(rows[1][0], 'Existing comment');
  assert.equal(rows[1][10], id);
});

test('serves the bridge only to an allowed parent origin', () => {
  const { context } = fixture();
  assert.equal(context.doGet({ parameter: { parentOrigin: 'https://evil.example' } }).text,
    'Review origin is not allowed.');
  assert.equal(typeof context.doGet({ parameter: { parentOrigin: 'https://timmybirds.github.io' } }),
    'object');
});

test('bridge accepts only messages from the review site and confirms a save', () => {
  const html = readFileSync(new URL('./Bridge.html', import.meta.url), 'utf8');
  const javascript = html.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace('<?!= JSON.stringify(allowedOrigin) ?>', JSON.stringify('https://timmybirds.github.io'));
  const messages = [];
  const top = { postMessage: (data, origin) => messages.push({ data, origin }) };
  let listener;
  let success;
  const scriptRun = {
    withSuccessHandler(fn) { success = fn; return this; },
    withFailureHandler() { return this; },
    submitFeedback: feedback => {
      assert.equal(feedback.id, id);
      success(feedback);
    }
  };
  vm.runInNewContext(javascript, {
    window: { top, addEventListener: (type, fn) => { listener = fn; } },
    google: { script: { run: scriptRun } }
  });
  assert.equal(messages[0].data.type, 'ready');
  const event = { origin: 'https://evil.example', source: top,
    data: { source: 'discovery-review-page', type: 'submit', requestId: id,
      feedback: review() } };
  listener(event);
  assert.equal(messages.length, 1);
  listener({ ...event, origin: 'https://timmybirds.github.io' });
  assert.equal(messages[1].data.type, 'result');
  assert.equal(messages[1].data.ok, true);
  assert.equal(messages[1].origin, 'https://timmybirds.github.io');
});
