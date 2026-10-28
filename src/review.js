(function () {
  var script = document.currentScript;
  var api = (script && script.dataset.api) || '';
  var googleScript = (script && script.dataset.googleScript) || '';
  var version = (script && script.dataset.version) || '';
  var page = location.pathname.split('/').pop() || 'index.html';
  var storageKey = 'discovery-review-drafts-v1';
  var codeKey = 'discovery-review-code-v1';
  var code = api ? sessionStorage.getItem(codeKey) || '' : '';
  var drafts = JSON.parse(localStorage.getItem(storageKey) || '[]');
  var sentKey = 'discovery-review-sent-v1';
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

  var ui = document.createElement('div');
  ui.id = 'review-ui';
  ui.innerHTML =
    '<button type="button" class="review-launch" aria-controls="review-panel" aria-expanded="false">Leave feedback <span class="review-count"></span></button>' +
    '<aside class="review-panel" id="review-panel" aria-label="Website feedback" hidden>' +
      '<div class="review-head"><div><small>Discovery School</small><h2>Website feedback</h2></div><button type="button" class="review-close" aria-label="Close feedback panel">&times;</button></div>' +
      '<p class="review-intro">Choose a page element or select text to tell us what should change.</p>' +
      '<div class="review-connect"><label for="review-code">Review access code</label><div class="review-code-row"><input id="review-code" type="password" autocomplete="off" placeholder="Enter code"><button type="button" class="review-load">Connect</button></div></div>' +
      '<button type="button" class="review-pick">Choose a spot on the page</button>' +
      '<form class="review-form" hidden>' +
        '<div class="review-target"></div>' +
        '<label for="review-comment">Your feedback</label><textarea id="review-comment" required rows="5" maxlength="4000" placeholder="What should change? Suggested wording is welcome."></textarea>' +
        '<fieldset><legend>Where does this apply?</legend><label><input type="radio" name="review-scope" value="spot" checked> This spot</label><label><input type="radio" name="review-scope" value="related"> Related mentions across the site</label></fieldset>' +
        '<div class="review-search" hidden><label for="review-terms">Search terms, separated by commas</label><div class="review-code-row"><input id="review-terms" type="text" placeholder="English, French, Kirundi"><button type="button" class="review-find">Find</button></div><div class="review-matches"></div></div>' +
        '<div class="review-form-actions"><button type="button" class="review-cancel">Cancel</button><button type="submit" class="review-submit">Submit feedback</button></div>' +
      '</form>' +
      '<p class="review-status" role="status" aria-live="polite"></p>' +
      '<div class="review-list-head"><h3>Feedback</h3><div class="review-list-actions"><button type="button" class="review-import">Import drafts</button><button type="button" class="review-export">Export drafts</button><input type="file" class="review-import-file" accept=".json,application/json" hidden></div></div>' +
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
  var submit = ui.querySelector('.review-submit');
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
          !host.endsWith('.script.googleusercontent.com')) return;
      var data = event.data;
      if (!data || data.source !== 'discovery-review-bridge') return;
      if (data.type === 'ready') {
        bridgeWindow = event.source;
        bridgeOrigin = event.origin;
        bridgeWaiters.splice(0).forEach(function (resolve) { resolve(); });
        if (code) setStatus('Connected to Google Sheets. Your feedback can be sent.');
        return;
      }
      if (event.source !== bridgeWindow || event.origin !== bridgeOrigin || data.type !== 'result') return;
      var pending = pendingSends.get(data.requestId);
      if (!pending) return;
      pendingSends.delete(data.requestId);
      clearTimeout(pending.timer);
      if (data.ok) pending.resolve(data.review);
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

  async function sendToGoogle(feedback) {
    await waitForBridge();
    var requestId = crypto.randomUUID();
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        pendingSends.delete(requestId);
        reject(new Error('No save confirmation arrived from Google Sheets. Your draft was kept.'));
      }, 20000);
      pendingSends.set(requestId, { resolve: resolve, reject: reject, timer: timer });
      bridgeWindow.postMessage({ source: 'discovery-review-page', type: 'submit', requestId: requestId,
        feedback: feedback }, bridgeOrigin);
    });
  }

  function keepSent(review) {
    if (!notes.some(function (note) { return note.id === review.id; })) notes.push(review);
    try { localStorage.setItem(sentKey, JSON.stringify(notes)); } catch (error) { /* Sheet already saved it. */ }
    renderNotes();
  }

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
    document.querySelectorAll('main h1, main h2, main h3, main h4, main p, main li, main figure, main img, main article, main section').forEach(function (el) {
      var tabindex = el.getAttribute('tabindex');
      if (tabindex === null) {
        focusTargets.push({ el: el, tabindex: tabindex });
        el.setAttribute('tabindex', '0');
      }
    });
  }

  function pageTarget(event) {
    if (event.target.closest('#review-ui, .review-pin')) return null;
    var el = event.target.closest('figure, img, h1, h2, h3, h4, p, li, article, section');
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
    ui.querySelector('#review-terms').value = language ? 'English, French, Kirundi, trilingual, 3 languages' : (quote || selected.label).slice(0, 70);
    setPanel(true);
    ui.querySelector('#review-comment').focus();
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
      empty.textContent = 'No feedback yet.';
      noteList.appendChild(empty);
    }
    allNotes().forEach(function (note) {
      var item = document.createElement('article');
      item.className = 'review-note';
      var where = document.createElement('small');
      where.textContent = note.anchors.map(function (a) { return a.page; }).filter(function (v, i, arr) { return arr.indexOf(v) === i; }).join(', ');
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
              drafts.splice(drafts.indexOf(note), 1);
              saveDrafts();
              setStatus('Draft sent.');
            } catch (error) { retry.disabled = false; setStatus(error.message, true); }
          });
          actions.appendChild(retry);
        }
        var remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = 'Delete draft';
        remove.addEventListener('click', function () {
          drafts.splice(drafts.indexOf(note), 1);
          saveDrafts();
          setStatus('Draft deleted.');
        });
        actions.appendChild(remove);
        item.appendChild(actions);
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
  pick.addEventListener('click', function () {
    choosing = !choosing;
    document.body.classList.toggle('review-choosing', choosing);
    pick.textContent = choosing ? 'Selecting: click text, a section, or an image' : 'Choose a spot on the page';
    if (choosing) {
      enableKeyboardTargets();
      panel.hidden = true;
      launch.setAttribute('aria-expanded', 'false');
    } else stopChoosing();
  });
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
    var target = pageTarget(event);
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    var quote = String(window.getSelection()).trim().slice(0, 300);
    beginForm(target, quote);
  }, true);
  document.addEventListener('keydown', function (event) {
    if (choosing && (event.key === 'Enter' || event.key === ' ') && event.target.closest('main')) {
      var target = pageTarget(event);
      if (target) {
        event.preventDefault();
        event.stopPropagation();
        beginForm(target, String(window.getSelection()).trim().slice(0, 300));
        return;
      }
    }
    if (event.key === 'Escape') { stopChoosing(); setPanel(false); }
  });
  ui.querySelectorAll('input[name="review-scope"]').forEach(function (radio) {
    radio.addEventListener('change', function () { search.hidden = radio.value !== 'related' || !radio.checked; });
  });
  ui.querySelector('.review-cancel').addEventListener('click', function () { form.hidden = true; selected = null; });

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
          if (text && terms.some(function (term) { return text.toLowerCase().includes(term); })) {
            matches.push(anchorFor(el, file, ''));
          }
        });
      });
      matches = matches.slice(0, 100);
      matches.forEach(function (anchor, index) {
        var label = document.createElement('label');
        var check = document.createElement('input');
        check.type = 'checkbox';
        check.value = String(index);
        check.checked = true;
        var span = document.createElement('span');
        span.textContent = anchor.page + ' · ' + anchor.label;
        label.append(check, span);
        matchList.appendChild(label);
      });
      setStatus(matches.length + ' matching passages found. Uncheck any that do not apply.');
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
      setStatus('Draft saved in this browser. Export it to share.');
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

  ui.querySelector('.review-export').addEventListener('click', function () {
    if (!drafts.length) return setStatus('There are no drafts to export.');
    var blob = new Blob([JSON.stringify(drafts, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'discovery-feedback-drafts.json';
    link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });
  var importFile = ui.querySelector('.review-import-file');
  ui.querySelector('.review-import').addEventListener('click', function () { importFile.click(); });
  importFile.addEventListener('change', async function () {
    var file = importFile.files[0];
    importFile.value = '';
    if (!file) return;
    if (file.size > 1000000) return setStatus('Draft file is too large.', true);
    try {
      var imported = JSON.parse(await file.text());
      if (!Array.isArray(imported) || !imported.length || imported.length > 100) throw new Error('Expected 1 to 100 drafts.');
      imported = imported.map(function (draft) {
        if (!draft || typeof draft.message !== 'string' || !draft.message.trim() || draft.message.length > 4000 ||
            !Array.isArray(draft.anchors) || !draft.anchors.length || draft.anchors.length > 100) throw new Error('Invalid feedback draft.');
        var anchors = draft.anchors.map(function (anchor) {
          if (!anchor || !/^[a-z0-9-]+\.html$/.test(anchor.page) || typeof anchor.selector !== 'string' ||
              !anchor.selector || anchor.selector.length > 500) throw new Error('Invalid draft location.');
          return { page: anchor.page, selector: anchor.selector, quote: String(anchor.quote || '').slice(0, 300), label: String(anchor.label || '').slice(0, 150) };
        });
        return { pending: true, id: /^[0-9a-f-]{36}$/.test(draft.id || '') ? draft.id : crypto.randomUUID(),
          message: draft.message.trim(), anchors: anchors,
          createdAt: typeof draft.createdAt === 'string' ? draft.createdAt : '',
          version: /^[0-9a-f]{40}$/.test(draft.version || '') ? draft.version : '' };
      });
      var known = new Set(drafts.map(function (draft) { return draft.message + JSON.stringify(draft.anchors); }));
      var added = 0;
      imported.forEach(function (draft) {
        var key = draft.message + JSON.stringify(draft.anchors);
        if (!known.has(key)) { drafts.push(draft); known.add(key); added++; }
      });
      if (added) saveDrafts();
      setStatus(added ? added + ' draft' + (added === 1 ? '' : 's') + ' imported. Send each draft when ready.' : 'All drafts are already here.');
    } catch (error) { setStatus('Could not import drafts: ' + error.message, true); }
  });
  window.addEventListener('resize', renderNotes);
  window.addEventListener('load', renderNotes);
  renderNotes();
  if (code && !googleScript) loadNotes();
})();
