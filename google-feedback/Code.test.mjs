import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
const id = '12345678-1234-1234-1234-123456789abc';

function fixture() {
  const rows = [];
  const settings = new Map();
  const sheet = {
    getLastRow: () => rows.length,
    appendRow: row => rows.push(row),
    setFrozenRows: () => {},
    getRange: (row, col, count) => count === 1 && row === 1 ? { setFontWeight: () => {} } : {
      createTextFinder: value => ({ matchEntireCell: () => ({
        findNext: () => rows.slice(1).find(entry => entry[0] === value) || null
      }) })
    }
  };
  const spreadsheet = {
    getId: () => 'sheet-id',
    getSheetByName: () => rows.length ? sheet : null,
    insertSheet: () => sheet
  };
  const context = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => spreadsheet,
      openById: value => value === 'sheet-id' ? spreadsheet : null
    },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => settings.get(key) || '',
      setProperty: (key, value) => settings.set(key, value)
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
  return { context, rows, settings };
}

function review(overrides = {}) {
  return {
    id, message: 'Change this wording', version: 'a'.repeat(40),
    anchors: [{ page: 'index.html', selector: '#welcome', quote: 'Hello', label: 'Welcome' }],
    ...overrides
  };
}

test('sets up a private Sheet and stores one row per feedback ID', () => {
  const { context, rows, settings } = fixture();
  assert.equal(rows.length, 1);
  assert.equal(settings.get('SPREADSHEET_ID'), 'sheet-id');
  assert.equal(settings.get('ALLOWED_ORIGINS'), 'https://timmybirds.github.io');
  context.submitFeedback(review(), settings.get('ACCESS_CODE'));
  context.submitFeedback(review(), settings.get('ACCESS_CODE'));
  assert.equal(rows.length, 2);
  assert.equal(rows[1][2], 'New');
  assert.equal(rows[1][4], 'https://timmybirds.github.io/discovery-school/index.html');
  assert.equal(rows[1][7], 'Change this wording');
});

test('rejects invalid access, invalid locations, and spreadsheet formulas', () => {
  const { context, rows, settings } = fixture();
  assert.throws(() => context.submitFeedback(review(), 'wrong'), /Incorrect review access code/);
  assert.throws(() => context.submitFeedback(review({ anchors: [{ page: '../bad', selector: 'x' }] }),
    settings.get('ACCESS_CODE')), /Invalid page location/);
  assert.equal(rows.length, 1);
  context.submitFeedback(review({ message: '=IMPORTDATA("bad")' }), settings.get('ACCESS_CODE'));
  assert.equal(rows[1][7], "'=IMPORTDATA(\"bad\")");
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
    submitFeedback: (feedback, code) => {
      assert.equal(feedback.id, id);
      assert.equal(code, 'review-code');
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
      feedback: review(), code: 'review-code' } };
  listener(event);
  assert.equal(messages.length, 1);
  listener({ ...event, origin: 'https://timmybirds.github.io' });
  assert.equal(messages[1].data.type, 'result');
  assert.equal(messages[1].data.ok, true);
  assert.equal(messages[1].origin, 'https://timmybirds.github.io');
});
