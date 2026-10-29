// Bind this script to the feedback spreadsheet, then run setupFeedback once.
const FEEDBACK_SHEET = 'Feedback';
const CONTENT_SHEET = 'Published Content';
const HEADERS = [
  'ID', 'Submitted (UTC)', 'Status', 'Assigned to', 'Page URL',
  'Selected text', 'Element', 'Feedback', 'Related locations',
  'Location data', 'Site version', 'Approved', 'Notes'
];

function setupFeedback() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Open this script from the feedback spreadsheet.');
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('SPREADSHEET_ID', spreadsheet.getId());
  properties.deleteProperty('ACCESS_CODE');
  if (!properties.getProperty('ALLOWED_ORIGINS')) {
    properties.setProperty('ALLOWED_ORIGINS', 'https://timmybirds.github.io');
  }
  feedbackSheet_(spreadsheet);
}

function doGet(request) {
  const origin = String((request.parameter || {}).parentOrigin || '');
  const allowed = (PropertiesService.getScriptProperties().getProperty('ALLOWED_ORIGINS') || '')
    .split(',').map(value => value.trim());
  if (!allowed.includes(origin)) return HtmlService.createHtmlOutput('Review origin is not allowed.');
  const template = HtmlService.createTemplateFromFile('Bridge');
  template.allowedOrigin = origin;
  return template.evaluate()
    .setTitle('Discovery School feedback connection')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function submitFeedback(raw) {
  const properties = PropertiesService.getScriptProperties();
  const review = normalizeFeedback_(raw);
  const spreadsheetId = properties.getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) throw new Error('The feedback spreadsheet has not been set up.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = feedbackSheet_(SpreadsheetApp.openById(spreadsheetId));
    if (sheet.getLastRow() > 1) {
      const existing = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
        .createTextFinder(review.id).matchEntireCell(true).findNext();
      if (existing) return review; // A retry after a lost receipt must not create a second row.
    }
    const first = review.anchors[0];
    const related = review.anchors.slice(1).map(anchor =>
      anchor.page + ' — ' + anchor.label + (anchor.quote ? ' ["' + anchor.quote + '"]' : '')
    ).join('\n');
    sheet.appendRow([
      review.id, new Date().toISOString(), 'New', '',
      'https://timmybirds.github.io/discovery-school/' + first.page,
      safeCell_(first.quote), safeCell_(first.label), safeCell_(review.message),
      safeCell_(related), safeCell_(JSON.stringify(review.anchors)), review.version, '', ''
    ]);
    return review;
  } finally {
    lock.releaseLock();
  }
}

function publishedContent() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('The spreadsheet has not been set up.');
  const sheet = SpreadsheetApp.openById(id).getSheetByName(CONTENT_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues()
    .map(row => ({ page: row[0], selector: row[1], kind: row[2],
      value: String(row[3]).replace(/^'(?=[=+\-@])/, '') }));
}

function publishContent(raw) {
  const properties = PropertiesService.getScriptProperties();
  if (!raw) throw new Error('Invalid content edit.');
  const page = String(raw.page || '');
  const selector = String(raw.selector || '');
  const kind = String(raw.kind || '');
  const value = String(raw.value || '').trim();
  if (!/^[a-z0-9-]+\.html$/.test(page) || !selector || selector.length > 500 ||
      !['text', 'image'].includes(kind) || !value || value.length > 5000) {
    throw new Error('Invalid content edit.');
  }
  if (kind === 'image' && !/^https:\/\/[^\s]+$/.test(value)) {
    throw new Error('Image URL must start with https://');
  }
  const id = properties.getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('The spreadsheet has not been set up.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.openById(id).getSheetByName(CONTENT_SHEET) ||
      SpreadsheetApp.openById(id).insertSheet(CONTENT_SHEET);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Page', 'Selector', 'Kind', 'Published content', 'Updated (UTC)']);
      sheet.setFrozenRows(1);
    }
    const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues() : [];
    const index = rows.findIndex(row => row[0] === page && row[1] === selector && row[2] === kind);
    const data = [page, selector, kind, safeCell_(value), new Date().toISOString()];
    if (index >= 0) sheet.getRange(index + 2, 1, 1, 5).setValues([data]);
    else sheet.appendRow(data);
    return { page, selector, kind, value };
  } finally {
    lock.releaseLock();
  }
}

function feedbackSheet_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(FEEDBACK_SHEET) || spreadsheet.insertSheet(FEEDBACK_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    const statuses = ['New', 'In progress', 'Ready for review', 'Approved'];
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(statuses, true).build();
    sheet.getRange(2, 3, sheet.getMaxRows() - 1, 1).setDataValidation(rule);
  }
  return sheet;
}

function normalizeFeedback_(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid feedback.');
  const id = String(raw.id || '');
  const message = String(raw.message || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
      !message || message.length > 4000) throw new Error('Invalid feedback ID or message.');
  if (!Array.isArray(raw.anchors) || raw.anchors.length < 1 || raw.anchors.length > 100) {
    throw new Error('Choose 1 to 100 page locations.');
  }
  const anchors = raw.anchors.map(anchor => {
    const page = String((anchor || {}).page || '');
    const selector = String((anchor || {}).selector || '');
    if (!/^[a-z0-9-]+\.html$/.test(page) || !selector || selector.length > 500) {
      throw new Error('Invalid page location.');
    }
    return {
      page: page, selector: selector,
      quote: String(anchor.quote || '').slice(0, 300),
      label: String(anchor.label || '').slice(0, 150)
    };
  });
  if (JSON.stringify(anchors).length > 40000) {
    throw new Error('Too many related locations; select fewer and try again.');
  }
  return {
    id: id, message: message, anchors: anchors,
    createdAt: new Date().toISOString(),
    version: /^[0-9a-f]{40}$/.test(raw.version || '') ? raw.version : ''
  };
}

function safeCell_(value) {
  const text = String(value || '');
  return /^\s*[=+\-@]/.test(text) ? "'" + text : text;
}
