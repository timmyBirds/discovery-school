(function () {
  var script = document.currentScript;
  var api = (script && script.dataset.api) || '';
  var googleScript = (script && script.dataset.googleScript) || '';
  var localPreview = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var version = (script && script.dataset.version) || '';
  var page = location.pathname.split('/').pop() || 'index.html';
  var storageKey = 'discovery-review-drafts-v1';
  var codeKey = 'discovery-review-code-v1';
  var code = api ? sessionStorage.getItem(codeKey) || '' : '';
  var drafts = JSON.parse(localStorage.getItem(storageKey) || '[]');
  var sentKey = 'discovery-review-sent-v1';
  var localContentKey = 'discovery-review-local-content-v1';
  var notes = googleScript ? JSON.parse(localStorage.getItem(sentKey) || '[]') : [];
  var bridgeWindow = null;
  var bridgeOrigin = '';
  var bridgeWaiters = [];
  var pendingSends = new Map();
  var selected = null;
  var matches = [];
  var choosing = false;
  var hovered = null;
  var focusTargets = [];
  var lastQuote = '';
  var activeHighlights = [];
  var navigationKey = 'discovery-review-navigation-v1';
  var editorMode = false;
  var editTarget = null;
  var editableText = 'main h1 span, main h2 span, main h3 span, main p span, main p strong, main p em, main p b, main figcaption, main .proof b, main .proof span, main li b, main li strong, main li span';

  var ui = document.createElement('div');
  ui.id = 'review-ui';
  ui.innerHTML =
    '<button type="button" class="review-launch" aria-controls="review-panel" aria-expanded="false">Leave feedback <span class="review-count"></span></button>' +
    '<aside class="review-panel" id="review-panel" aria-label="Website feedback" hidden>' +
      '<div class="review-head"><div><small>Discovery School</small><h2>Website feedback</h2></div><button type="button" class="review-close" aria-label="Close feedback panel">&times;</button></div>' +
      '<p class="review-intro">Choose a page element or select text to tell us what should change.</p>' +
      '<div class="review-connect"><label for="review-code">Review access code</label><div class="review-code-row"><input id="review-code" type="password" autocomplete="off" placeholder="Enter code"><button type="button" class="review-load">Connect</button></div></div>' +
      '<button type="button" class="review-pick">Choose a spot on the page</button>' +
      '<button type="button" class="review-edit-pick">Edit page text</button>' +
      '<form class="review-edit-form" hidden><div class="review-target review-edit-target"></div><label for="review-edit-value">Replacement text</label><textarea id="review-edit-value" rows="5" maxlength="5000" required></textarea><p class="review-edit-help">Publishing changes this text on the review site for everyone. To request an image change, select the image and leave feedback.</p><div class="review-form-actions"><button type="button" class="review-edit-cancel">Cancel</button><button type="submit" class="review-submit">Publish change</button></div></form>' +
      '<form class="review-form" hidden>' +
        '<div class="review-target"></div>' +
        '<label for="review-comment">Your feedback</label><textarea id="review-comment" required rows="5" maxlength="4000" placeholder="What should change? Suggested wording is welcome."></textarea>' +
        '<fieldset><legend>Where does this apply?</legend><label><input type="radio" name="review-scope" value="spot" checked> This spot</label><label><input type="radio" name="review-scope" value="related"> Related mentions across the site</label></fieldset>' +
        '<div class="review-search" hidden><label for="review-terms">Search terms, separated by commas</label><div class="review-code-row"><input id="review-terms" type="text" placeholder="English, French, Kirundi"><button type="button" class="review-find">Find</button></div><div class="review-matches"></div></div>' +
        '<div class="review-form-actions"><button type="button" class="review-cancel">Cancel</button><button type="submit" class="review-submit">Submit feedback</button></div>' +
      '</form>' +
      '<p class="review-status" role="status" aria-live="polite"></p>' +
      '<div class="review-list-head"><h3>Your feedback in this browser</h3></div>' +
      '<div class="review-list"></div>' +
    '</aside>';
  document.body.appendChild(ui);

  var launch = ui.querySelector('.review-launch');
  var panel = ui.querySelector('.review-panel');
  var form = ui.querySelector('.review-form');
  var status = ui.querySelector('.review-status');
  var pick = ui.querySelector('.review-pick');
  var search = ui.querySelector('.review-search');
  var matchList = ui.querySelector('.review-matches');
  var noteList = ui.querySelector('.review-list');
  var codeInput = ui.querySelector('#review-code');
  var submit = form.querySelector('.review-submit');
  var editForm = ui.querySelector('.review-edit-form');
  if (localPreview) {
    editForm.querySelector('[type="submit"]').textContent = 'Save local preview';
    editForm.querySelector('.review-edit-help').textContent = 'This text change is visible only in this browser. GitHub Pages will stay unchanged.';
  }
  codeInput.value = code;
  if (googleScript) ui.querySelector('.review-connect').hidden = true;
  if (!api && !googleScript) {
    ui.querySelector('.review-connect').hidden = true;
    submit.textContent = 'Save draft';
    status.textContent = 'Feedback service is not connected yet. Drafts stay in this browser.';
  }

  function setStatus(message, error) {
    status.textContent = message;
    status.classList.toggle('is-error', !!error);
  }

  function missingFeedback(error) {
    return /(?:^|:\s*)Feedback was not found\.$/.test(String(error && error.message || ''));
  }

  if (googleScript) {
    var bridge = document.createElement('iframe');
    bridge.hidden = true;
    bridge.title = 'Feedback storage connection';
    bridge.src = googleScript + '?parentOrigin=' + encodeURIComponent(location.origin);
    document.body.appendChild(bridge);
    window.addEventListener('message', function (event) {
      var host;
      try { host = new URL(event.origin).hostname; } catch (error) { return; }
      if (host !== 'script.google.com' && host !== 'script.googleusercontent.com' &&
          !host.endsWith('.script.googleusercontent.com') && !host.endsWith('-script.googleusercontent.com')) return;
      var data = event.data;
      if (!data || data.source !== 'discovery-review-bridge') return;
      if (data.type === 'ready') {
        bridgeWindow = event.source;
        bridgeOrigin = event.origin;
        bridgeWaiters.splice(0).forEach(function (resolve) { resolve(); });
        setStatus('Feedback service ready.');
        loadPublishedContent();
        return;
      }
      if (event.source !== bridgeWindow || event.origin !== bridgeOrigin || data.type !== 'result') return;
      var pending = pendingSends.get(data.requestId);
      if (!pending) return;
      pendingSends.delete(data.requestId);
      clearTimeout(pending.timer);
      if (data.ok) pending.resolve(data.result || data.review);
      else pending.reject(new Error(data.error || 'Google Sheets did not save the feedback.'));
    });
  }

  function waitForBridge() {
    if (bridgeWindow) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        var index = bridgeWaiters.indexOf(ready);
        if (index !== -1) bridgeWaiters.splice(index, 1);
        reject(new Error('Could not connect to Google Sheets. Try again later.'));
      }, 15000);
      function ready() { clearTimeout(timer); resolve(); }
      bridgeWaiters.push(ready);
    });
  }

  async function callGoogle(type, payload) {
    await waitForBridge();
    var requestId = crypto.randomUUID();
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        pendingSends.delete(requestId);
        reject(new Error('No save confirmation arrived from Google Sheets. Your draft was kept.'));
      }, 20000);
      pendingSends.set(requestId, { resolve: resolve, reject: reject, timer: timer });
      bridgeWindow.postMessage(Object.assign({ source: 'discovery-review-page', type: type, requestId: requestId }, payload), bridgeOrigin);
    });
  }

  function sendToGoogle(feedback) { return callGoogle('submit', { feedback: feedback }); }

  function applyPublishedEdit(edit) {
    if (edit.page !== page) return;
    var target;
    try { target = document.querySelector(edit.selector); } catch (error) { return; }
    if (!target) return;
    if (edit.kind === 'text') target.textContent = edit.value;
  }

  async function loadPublishedContent() {
    try {
      var edits = await callGoogle('content-list', {});
      if (Array.isArray(edits)) edits.forEach(applyPublishedEdit);
    } catch (error) { /* Older bridge versions do not provide published content. */ }
  }

  function keepSent(review) {
    if (!notes.some(function (note) { return note.id === review.id; })) notes.push(review);
    try { localStorage.setItem(sentKey, JSON.stringify(notes)); } catch (error) { /* Sheet already saved it. */ }
    renderNotes();
  }

  function saveSentNotes() {
    localStorage.setItem(sentKey, JSON.stringify(notes));
    renderNotes();
  }

  window.addEventListener('storage', function (event) {
    if (event.key === sentKey && googleScript) {
      try { notes = JSON.parse(event.newValue || '[]'); } catch (error) { return; }
      renderNotes();
    }
    if (event.key === storageKey) {
      try { drafts = JSON.parse(event.newValue || '[]'); } catch (error) { return; }
      renderNotes();
    }
  });

  function setPanel(open) {
    panel.hidden = !open;
    launch.setAttribute('aria-expanded', String(open));
    if (!open) stopChoosing();
  }

  function stopChoosing() {
    choosing = false;
    pick.textContent = 'Choose a spot on the page';
    document.body.classList.remove('review-choosing');
    if (hovered) hovered.classList.remove('review-hovered');
    hovered = null;
    focusTargets.forEach(function (entry) {
      if (entry.tabindex === null) entry.el.removeAttribute('tabindex');
      else entry.el.setAttribute('tabindex', entry.tabindex);
    });
    focusTargets = [];
  }

  function enableKeyboardTargets() {
    document.querySelectorAll('main h1, main h2, main h3, main h4, main p, main li, main td, main th, main figure, main img, main article, main section').forEach(function (el) {
      var tabindex = el.getAttribute('tabindex');
      if (tabindex === null) {
        focusTargets.push({ el: el, tabindex: tabindex });
        el.setAttribute('tabindex', '0');
      }
    });
  }

  function pageTarget(event) {
    if (event.target.closest('#review-ui, .review-pin')) return null;
    var el = event.target.closest('figure, img, h1, h2, h3, h4, p, li, td, th, article, section');
    if (el && el.tagName === 'IMG' && el.closest('figure')) el = el.closest('figure');
    return el && el.closest('main') ? el : null;
  }

  function selectorFor(el) {
    var parts = [];
    while (el && el.tagName && el !== el.ownerDocument.body) {
      if (el.id) {
        parts.unshift('#' + CSS.escape(el.id));
        break;
      }
      var tag = el.tagName.toLowerCase();
      var siblings = el.parentElement ? Array.from(el.parentElement.children).filter(function (s) { return s.tagName === el.tagName; }) : [];
      parts.unshift(tag + ':nth-of-type(' + (siblings.indexOf(el) + 1) + ')');
      el = el.parentElement;
    }
    return parts.join(' > ');
  }

  function anchorFor(el, file, quote) {
    var img = el.matches('img') ? el : el.querySelector('img');
    var text = (el.innerText || el.textContent || img && img.alt || '').trim().replace(/\s+/g, ' ');
    return { page: file, selector: selectorFor(el), quote: quote || '', label: (text || img && img.alt || el.tagName.toLowerCase()).slice(0, 150) };
  }

  function clearSearchHighlights() {
    activeHighlights.forEach(function (mark) {
      var parent = mark.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    });
    activeHighlights = [];
  }

  function revealMatch(anchor) {
    if (anchor.page !== page) {
      sessionStorage.setItem(navigationKey, JSON.stringify({
        selected: selected,
        message: ui.querySelector('#review-comment').value,
        terms: ui.querySelector('#review-terms').value,
        matches: matches,
        checked: Array.from(matchList.querySelectorAll('input:checked')).map(function (input) { return Number(input.value); }),
        panelScroll: panel.scrollTop,
        listScroll: matchList.scrollTop
      }));
      location.href = anchor.page + '?reviewMatch=' + encodeURIComponent(anchor.selector) + '&reviewTerms=' + encodeURIComponent(ui.querySelector('#review-terms').value);
      return;
    }
    var target;
    try { target = document.querySelector(anchor.selector); } catch (error) { target = null; }
    if (!target) return setStatus('That passage could not be located on this page.', true);
    clearSearchHighlights();
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('review-search-target');
    window.setTimeout(function () { target.classList.remove('review-search-target'); }, 3500);
    var terms = ui.querySelector('#review-terms').value.split(',').map(function (term) { return term.trim(); }).filter(Boolean);
    var pattern = new RegExp(terms.slice().sort(function (a, b) { return b.length - a.length; }).map(function (term) { return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|'), 'gi');
    var walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, { acceptNode: function (node) { return node.parentElement && !node.parentElement.closest('#review-ui,script,style,mark') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; } });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var text = node.nodeValue;
      if (!pattern.test(text)) { pattern.lastIndex = 0; return; }
      pattern.lastIndex = 0;
      var fragment = document.createDocumentFragment();
      var last = 0;
      text.replace(pattern, function (match, offset) {
        fragment.appendChild(document.createTextNode(text.slice(last, offset)));
        var mark = document.createElement('mark');
        mark.className = 'review-search-highlight';
        mark.textContent = match;
        fragment.appendChild(mark);
        activeHighlights.push(mark);
        last = offset + match.length;
        return match;
      });
      fragment.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(fragment, node);
    });
    setStatus(activeHighlights.length ? 'Highlighted the matching text in this passage.' : 'Passage opened; none of the search terms appear in its visible text.');
  }

  function beginForm(el, quote) {
    stopChoosing();
    if (!quote && lastQuote && (el.textContent || '').includes(lastQuote)) quote = lastQuote;
    lastQuote = '';
    selected = anchorFor(el, page, quote);
    matches = [];
    form.reset();
    form.hidden = false;
    search.hidden = true;
    matchList.replaceChildren();
    ui.querySelector('.review-target').textContent = page + ' · ' + selected.label;
    var language = /english|french|kirundi|trilingual|3 languages/i.test(selected.label);
    ui.querySelector('#review-terms').value = language ? 'English, French, Kirundi' : (quote || selected.label).slice(0, 70);
    setPanel(true);
    setStatus('');
    ui.querySelector('#review-comment').focus();
  }

  function failEdit(message) {
    editForm.hidden = true;
    editTarget = null;
    return setStatus(message, true);
  }

  function beginEdit(el) {
    stopChoosing();
    if (!googleScript && !localPreview) return failEdit('Publishing requires the Google Sheets connection.');
    if (el.tagName === 'FIGURE') el = el.querySelector('figcaption, img');
    if (!el) return failEdit('Choose text inside the section.');
    if (el.tagName === 'IMG') {
      editForm.hidden = true;
      editTarget = null;
      beginForm(el.closest('figure') || el, '');
      return setStatus('Describe the image change you want in your feedback.');
    }
    if (!/^(H[1-6]|P|LI|TD|TH|FIGCAPTION|SPAN|STRONG|EM|B)$/.test(el.tagName)) {
      return failEdit('Click the exact line you want to change, not the whole section.');
    }
    if (el.querySelector('a,button,input')) {
      return failEdit('This text contains a link or control. Choose a smaller text element.');
    }
    editTarget = { page: page, selector: selectorFor(el), kind: 'text' };
    form.hidden = true;
    editForm.hidden = false;
    ui.querySelector('.review-edit-target').textContent = page + ' · ' + (el.alt || el.textContent || '').trim().slice(0, 150);
    ui.querySelector('#review-edit-value').value = el.textContent.trim();
    setPanel(true);
    setStatus(el.children.length
      ? 'Publishing replaces this line as plain text, so bold or italic inside it will be lost.'
      : '');
    ui.querySelector('#review-edit-value').focus();
  }

  function saveDrafts() {
    localStorage.setItem(storageKey, JSON.stringify(drafts));
    renderNotes();
  }

  function allNotes() { return notes.concat(drafts); }

  function renderNotes() {
    noteList.replaceChildren();
    document.querySelectorAll('.review-pin').forEach(function (pin) { pin.remove(); });
    var relevant = allNotes().filter(function (note) { return note.anchors.some(function (a) { return a.page === page; }); });
    ui.querySelector('.review-count').textContent = relevant.length ? '(' + relevant.length + ')' : '';
    if (!allNotes().length) {
      var empty = document.createElement('p');
      empty.className = 'review-empty';
      empty.textContent = 'No feedback saved in this browser yet.';
      noteList.appendChild(empty);
    }
    allNotes().forEach(function (note) {
      var item = document.createElement('article');
      item.className = 'review-note';
      var where = document.createElement('small');
      var pages = note.anchors.map(function (a) { return a.page; }).filter(function (v, i, arr) { return arr.indexOf(v) === i; }).join(', ');
      where.textContent = pages + ' · ' + (note.anchors[0].label || 'Selected location');
      var body = document.createElement('p');
      body.textContent = note.message;
      item.append(where, body);
      if (note.pending) {
        var flag = document.createElement('span');
        flag.className = 'review-pending';
        flag.textContent = 'Draft in this browser';
        item.appendChild(flag);
        var actions = document.createElement('div');
        actions.className = 'review-draft-actions';
        if (api || googleScript) {
          var retry = document.createElement('button');
          retry.type = 'button';
          retry.textContent = 'Send draft';
          retry.addEventListener('click', async function () {
            if (api && !code) return setStatus('Enter the review access code and connect first.', true);
            retry.disabled = true;
            try {
              var saved = googleScript ? await sendToGoogle(note) : (await request('POST', note)).review;
              if (googleScript) keepSent(saved);
              else notes.push(saved);
              var draftIndex = drafts.findIndex(function (entry) { return entry.id === note.id; });
              if (draftIndex !== -1) drafts.splice(draftIndex, 1);
              saveDrafts();
              setStatus('Draft sent.');
            } catch (error) { retry.disabled = false; setStatus(error.message, true); }
          });
          actions.appendChild(retry);
        }
        addChangeActions(note, actions, item);
        item.appendChild(actions);
      } else if (googleScript) {
        var sentActions = document.createElement('div');
        sentActions.className = 'review-draft-actions';
        addChangeActions(note, sentActions, item);
        item.appendChild(sentActions);
      }
      noteList.appendChild(item);
      note.anchors.filter(function (a) { return a.page === page; }).forEach(function (anchor) {
        var target;
        try { target = document.querySelector(anchor.selector); } catch (e) { return; }
        if (!target) return;
        var pin = document.createElement('button');
        pin.type = 'button';
        pin.className = 'review-pin';
        pin.textContent = String(relevant.indexOf(note) + 1);
        pin.setAttribute('aria-label', 'Show feedback: ' + note.message.slice(0, 80));
        pin.addEventListener('click', function () { setPanel(true); item.scrollIntoView({ block: 'nearest' }); });
        document.body.appendChild(pin);
        var rect = target.getBoundingClientRect();
        pin.style.top = Math.max(0, rect.top + scrollY + 4) + 'px';
        pin.style.left = Math.min(document.documentElement.scrollWidth - 36, rect.right + scrollX - 25) + 'px';
      });
    });
  }

  function addChangeActions(note, actions, item) {
    var edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', function () {
      var editor = document.createElement('div');
      editor.className = 'review-note-editor';
      var field = document.createElement('textarea');
      field.value = note.message;
      field.maxLength = 4000;
      field.rows = 4;
      var save = document.createElement('button');
      save.type = 'button';
      save.textContent = 'Save';
      var cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Cancel';
      cancel.addEventListener('click', function () { editor.remove(); });
      save.addEventListener('click', async function () {
        var message = field.value.trim();
        if (!message) return setStatus('Feedback cannot be empty.', true);
        save.disabled = true;
        try {
          if (!note.pending) await callGoogle('feedback-change', { change: { id: note.id, action: 'edit', message: message } });
          note.message = message;
          if (note.pending) saveDrafts();
          else saveSentNotes();
          setStatus('Feedback updated.');
        } catch (error) {
          save.disabled = false;
          setStatus(missingFeedback(error)
            ? 'This feedback is no longer in the Sheet. Delete its browser copy or submit a new comment.'
            : error.message, true);
        }
      });
      editor.append(field, save, cancel);
      item.appendChild(editor);
      field.focus();
      edit.disabled = true;
      cancel.addEventListener('click', function () { edit.disabled = false; });
    });
    var remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Delete';
    remove.addEventListener('click', async function () {
      if (!window.confirm('Delete this feedback?')) return;
      remove.disabled = true;
      try {
        var alreadyRemoved = false;
        if (!note.pending) {
          try { await callGoogle('feedback-change', { change: { id: note.id, action: 'delete' } }); }
          catch (error) {
            if (!missingFeedback(error)) throw error;
            alreadyRemoved = true;
          }
        }
        var list = note.pending ? drafts : notes;
        var index = list.findIndex(function (entry) { return entry.id === note.id; });
        if (index !== -1) list.splice(index, 1);
        if (note.pending) saveDrafts();
        else saveSentNotes();
        setStatus(alreadyRemoved ? 'This feedback was already gone from the Sheet. Its browser copy was removed.' : 'Feedback deleted.');
      } catch (error) { remove.disabled = false; setStatus(error.message, true); }
    });
    actions.append(edit, remove);
  }

  async function request(method, body) {
    var response = await fetch(api + '/reviews', {
      method: method,
      headers: { 'Authorization': 'Bearer ' + code, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Feedback service unavailable');
    return data;
  }

  async function loadNotes() {
    if (!api || !code) return;
    try {
      setStatus('Loading feedback…');
      notes = (await request('GET')).reviews || [];
      setStatus('Connected. Your feedback is shared with the site designer.');
      renderNotes();
    } catch (error) { setStatus(error.message, true); }
  }

  launch.addEventListener('click', function () { setPanel(panel.hidden); });
  ui.querySelector('.review-close').addEventListener('click', function () { setPanel(false); });
  ui.querySelector('.review-load').addEventListener('click', function () {
    code = codeInput.value.trim();
    if (!code) return setStatus('Enter the review access code.', true);
    sessionStorage.setItem(codeKey, code);
    loadNotes();
  });
  function chooseOnPage(editing) {
    editorMode = editing;
    choosing = !choosing;
    document.body.classList.toggle('review-choosing', choosing);
    pick.textContent = choosing && !editing ? 'Selecting: click text, a section, or an image' : 'Choose a spot on the page';
    if (choosing) {
      enableKeyboardTargets();
      panel.hidden = true;
      launch.setAttribute('aria-expanded', 'false');
    } else stopChoosing();
  }
  pick.addEventListener('click', function () { chooseOnPage(false); });
  ui.querySelector('.review-edit-pick').addEventListener('click', function () { chooseOnPage(true); });
  document.addEventListener('pointerover', function (event) {
    if (!choosing) return;
    var next = pageTarget(event);
    if (next === hovered) return;
    if (hovered) hovered.classList.remove('review-hovered');
    hovered = next;
    if (hovered) hovered.classList.add('review-hovered');
  });
  document.addEventListener('selectionchange', function () {
    if (choosing) {
      var quote = String(window.getSelection()).trim();
      if (quote) lastQuote = quote.slice(0, 300);
    }
  });
  document.addEventListener('click', function (event) {
    if (!choosing) return;
    var target = editorMode && event.target.closest(editableText) || pageTarget(event);
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    var quote = String(window.getSelection()).trim().slice(0, 300);
    if (editorMode) beginEdit(target);
    else beginForm(target, quote);
  }, true);
  document.addEventListener('keydown', function (event) {
    if (choosing && (event.key === 'Enter' || event.key === ' ') && event.target.closest('main')) {
      var target = editorMode && event.target.closest(editableText) || pageTarget(event);
      if (target) {
        event.preventDefault();
        event.stopPropagation();
        if (editorMode) beginEdit(target);
        else beginForm(target, String(window.getSelection()).trim().slice(0, 300));
        return;
      }
    }
    if (event.key === 'Escape') { stopChoosing(); setPanel(false); }
  });
  ui.querySelectorAll('input[name="review-scope"]').forEach(function (radio) {
    radio.addEventListener('change', function () { search.hidden = radio.value !== 'related' || !radio.checked; });
  });
  ui.querySelector('.review-cancel').addEventListener('click', function () { form.hidden = true; selected = null; });
  ui.querySelector('.review-edit-cancel').addEventListener('click', function () { editForm.hidden = true; editTarget = null; });
  editForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!editTarget) return;
    var value = ui.querySelector('#review-edit-value').value.trim();
    if (!value) return;
    var button = editForm.querySelector('[type="submit"]');
    button.disabled = true;
    setStatus(localPreview ? 'Saving local preview…' : 'Publishing change…');
    try {
      var published = Object.assign({ value: value }, editTarget);
      if (localPreview) {
        var localEdits = JSON.parse(localStorage.getItem(localContentKey) || '[]');
        localEdits = localEdits.filter(function (edit) { return edit.page !== published.page || edit.selector !== published.selector; });
        localEdits.push(published);
        localStorage.setItem(localContentKey, JSON.stringify(localEdits));
      } else published = await callGoogle('content-publish', { edit: published });
      applyPublishedEdit(published);
      editForm.hidden = true;
      editTarget = null;
      setStatus(localPreview ? 'Saved in this browser for preview.' : 'Published. Everyone viewing the review site will see this change.');
    } catch (error) { setStatus((localPreview ? 'Could not save preview: ' : 'Could not publish: ') + error.message, true); }
    finally { button.disabled = false; }
  });

  function renderMatches(checked) {
    matchList.replaceChildren();
    matches.forEach(function (anchor, index) {
      var label = document.createElement('label');
      var check = document.createElement('input');
      check.type = 'checkbox';
      check.value = String(index);
      check.checked = checked.includes(index);
      var link = document.createElement('button');
      link.type = 'button';
      link.className = 'review-match-open';
      link.textContent = anchor.page + ' · ' + anchor.label;
      link.addEventListener('click', function () { revealMatch(anchor); });
      label.append(check, link);
      matchList.appendChild(label);
    });
  }

  ui.querySelector('.review-find').addEventListener('click', async function () {
    var terms = ui.querySelector('#review-terms').value.split(',').map(function (t) { return t.trim().toLowerCase(); }).filter(function (t) { return t.length > 2; }).slice(0, 8);
    if (!terms.length) return setStatus('Enter at least one search term.', true);
    setStatus('Finding related mentions…');
    matchList.replaceChildren();
    matches = [];
    try {
      var pages = await (await fetch('review-pages.json')).json();
      var htmls = await Promise.all(pages.map(function (file) { return fetch(file).then(function (res) { return res.text(); }); }));
      pages.forEach(function (file, index) {
        var doc = new DOMParser().parseFromString(htmls[index], 'text/html');
        doc.querySelectorAll('main p, main h1, main h2, main h3, main li, main figcaption').forEach(function (el) {
          var text = (el.textContent || '').trim().replace(/\s+/g, ' ');
          var normalized = text.toLowerCase();
          if (text && terms.every(function (term) { return normalized.includes(term); })) {
            matches.push(anchorFor(el, file, ''));
          }
        });
      });
      matches = matches.slice(0, 100);
      renderMatches([]);
      setStatus(matches.length + ' matching passages found. Open each passage, then check those that apply.');
    } catch (error) { setStatus('Could not search the site. Try again.', true); }
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!selected) return;
    var message = ui.querySelector('#review-comment').value.trim();
    if (!message) return;
    var related = ui.querySelector('input[name="review-scope"]:checked').value === 'related';
    var anchors = [selected];
    if (related) {
      anchors = matches.filter(function (_, i) { return !!matchList.querySelector('input[value="' + i + '"]:checked'); });
      anchors.unshift(selected);
      anchors = anchors.filter(function (a, i, arr) { return arr.findIndex(function (b) { return b.page === a.page && b.selector === a.selector; }) === i; });
      if (anchors.length < 2) return setStatus('Find and select related mentions first.', true);
    }
    var feedback = { id: crypto.randomUUID(), message: message, anchors: anchors,
      createdAt: new Date().toISOString(), version: version };
    if (!api && !googleScript) {
      drafts.push(Object.assign({ pending: true }, feedback));
      saveDrafts();
      setStatus('Draft saved in this browser. Send it when the feedback service is connected.');
      form.hidden = true;
      return;
    }
            if (api && !code) return setStatus('Enter the review access code and connect first.', true);
    submit.disabled = true;
    try {
      var saved = googleScript ? await sendToGoogle(feedback) : (await request('POST', feedback)).review;
      if (googleScript) keepSent(saved);
      else { notes.push(saved); renderNotes(); }
      form.hidden = true;
      setStatus('Feedback sent. Thank you!');
    } catch (error) {
      drafts.push(Object.assign({ pending: true }, feedback));
      saveDrafts();
      form.hidden = true;
      setStatus('Could not send. A draft was saved in this browser: ' + error.message, true);
    } finally { submit.disabled = false; }
  });

  window.addEventListener('resize', renderNotes);
  window.addEventListener('load', renderNotes);
  if (localPreview) {
    try { JSON.parse(localStorage.getItem(localContentKey) || '[]').forEach(applyPublishedEdit); }
    catch (error) { /* Ignore invalid local preview data. */ }
  }
  renderNotes();
  var reviewParams = new URLSearchParams(location.search);
  var requestedSelector = reviewParams.get('reviewMatch');
  if (requestedSelector) {
    var savedNavigation = sessionStorage.getItem(navigationKey);
    sessionStorage.removeItem(navigationKey);
    if (savedNavigation) {
      try {
        var restored = JSON.parse(savedNavigation);
        selected = restored.selected;
        matches = restored.matches || [];
        form.hidden = false;
        search.hidden = false;
        ui.querySelector('input[name="review-scope"][value="related"]').checked = true;
        ui.querySelector('#review-comment').value = restored.message || '';
        ui.querySelector('#review-terms').value = restored.terms || '';
        ui.querySelector('.review-target').textContent = selected.page + ' · ' + selected.label;
        renderMatches(restored.checked || []);
        panel.scrollTop = restored.panelScroll || 0;
        matchList.scrollTop = restored.listScroll || 0;
      } catch (error) { setStatus('Could not restore the feedback form.', true); }
    } else {
      ui.querySelector('#review-terms').value = reviewParams.get('reviewTerms') || '';
    }
    setPanel(true);
    window.setTimeout(function () {
      try {
        var destination = document.querySelector(requestedSelector);
        if (destination) revealMatch(anchorFor(destination, page, ''));
        else setStatus('That passage could not be located on this page.', true);
      } catch (error) { setStatus('That passage could not be located on this page.', true); }
      history.replaceState(null, '', location.pathname + location.hash);
    }, 150);
  }
  if (code && !googleScript) loadNotes();
})();
