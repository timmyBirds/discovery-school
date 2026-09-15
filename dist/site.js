// Mobile navigation toggle. Everything else on the site works without JavaScript.
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;

  function setOpen(open) {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.lastChild.textContent = open ? ' Close' : ' Menu';
  }

  toggle.addEventListener('click', function () {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setOpen(false);
  });
  document.addEventListener('click', function (e) {
    if (nav.classList.contains('is-open') && !nav.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
  });
})();

// Values tree: hovering, focusing or tapping a value on the tree, in the values list or on a
// values card highlights every element with the same data-value and dims the others.
(function () {
  var items = document.querySelectorAll('[data-value]');
  if (!items.length) return;
  var groups = document.querySelectorAll('.tree, .values-group');
  var pinned = null;

  var caption = document.querySelector('.tree-caption');
  var captionHint = caption ? caption.innerHTML : '';

  function setActive(key) {
    items.forEach(function (el) { el.classList.toggle('is-active', !!key && el.dataset.value === key); });
    groups.forEach(function (g) { g.classList.toggle('has-active', !!key); });
    if (!caption) return;
    // mirror the active card's heading and text under the tree
    var card = key && document.querySelector('.value-card[data-value="' + key + '"]');
    if (card) {
      var label = document.querySelector('.tree__value[data-value="' + key + '"] .tree__label');
      caption.style.setProperty('--value-colour', label ? label.getAttribute('fill') : '');
      caption.innerHTML = '<b></b><span></span>';
      caption.querySelector('b').textContent = card.querySelector('h3').textContent;
      caption.querySelector('span').textContent = card.querySelector('p').textContent;
    } else {
      caption.innerHTML = captionHint;
    }
  }

  items.forEach(function (el) {
    var key = el.dataset.value;
    el.addEventListener('mouseenter', function () { if (!pinned) setActive(key); });
    el.addEventListener('mouseleave', function () { if (!pinned) setActive(null); });
    el.addEventListener('focus', function () { if (!pinned) setActive(key); });
    el.addEventListener('blur', function () { if (!pinned) setActive(null); });
    // tap/click pins the highlight (needed on touch screens, handy on desktop); tap again to release
    el.addEventListener('click', function () {
      pinned = pinned === key ? null : key;
      setActive(pinned);
    });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
    });
  });
  document.addEventListener('click', function (e) {
    if (pinned && !e.target.closest('[data-value]')) { pinned = null; setActive(null); }
  });
})();
