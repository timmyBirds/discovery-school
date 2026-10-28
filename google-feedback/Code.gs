// Bind this script to the feedback spreadsheet, then run setupFeedback once.
const FEEDBACK_SHEET = 'Feedback';
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
  if (!properties.getProperty('ALLOWED_ORIGINS')) {
    properties.setProperty('ALLOWED_ORIGINS', 'https://timmybirds.github.io');
  }
  if (!properties.getProperty('ACCESS_CODE')) {
    properties.setProperty('ACCESS_CODE', Utilities.getUuid() + Utilities.getUuid());
  }
  feedbackSheet_(spreadsheet);
  console.log('Review access code: ' + properties.getProperty('ACCESS_CODE'));
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

function submitFeedback(raw, accessCode) {
  const properties = PropertiesService.getScriptProperties();
  const expectedCode = properties.getProperty('ACCESS_CODE');
  if (!expectedCode || String(accessCode || '') !== expectedCode) {
    throw new Error('Incorrect review access code.');
  }
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

function feedbackSheet_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(FEEDBACK_SHEET) || spreadsheet.insertSheet(FEEDBACK_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
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
