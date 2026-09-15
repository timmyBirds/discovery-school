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

// Photo strip: prev/next buttons and arrow keys scroll one card at a time (no auto-play).
(function () {
  var strip = document.querySelector('.strip');
  if (!strip) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function step(dir) {
    var card = strip.querySelector('figure');
    var by = card ? card.getBoundingClientRect().width + 16 : strip.clientWidth * 0.8;
    strip.scrollBy({ left: dir * by, behavior: reduce ? 'auto' : 'smooth' });
  }
  var prev = document.querySelector('[data-strip-prev]'), next = document.querySelector('[data-strip-next]');
  if (prev) prev.addEventListener('click', function () { step(-1); });
  if (next) next.addEventListener('click', function () { step(1); });
  strip.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });
})();

// Lightbox: any .gallery__link opens its photo in the <dialog>; arrows move between photos.
(function () {
  var box = document.getElementById('lightbox');
  var links = Array.prototype.slice.call(document.querySelectorAll('.gallery__link'));
  if (!box || !links.length || typeof box.showModal !== 'function') return;
  var img = box.querySelector('img'), cap = box.querySelector('figcaption'), current = 0;

  function show(i) {
    current = (i + links.length) % links.length;
    var link = links[current];
    var fig = link.closest('figure');
    img.src = link.dataset.full || link.href;
    img.alt = link.querySelector('img').alt;
    cap.textContent = fig && fig.querySelector('figcaption') ? fig.querySelector('figcaption').textContent : '';
  }
  links.forEach(function (link, i) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      show(i);
      box.showModal();
    });
  });
  box.querySelector('.lightbox__close').addEventListener('click', function () { box.close(); });
  box.querySelector('.lightbox__prev').addEventListener('click', function () { show(current - 1); });
  box.querySelector('.lightbox__next').addEventListener('click', function () { show(current + 1); });
  document.addEventListener('keydown', function (e) {
    if (!box.open) return;
    if (e.key === 'ArrowRight') show(current + 1);
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'Escape') box.close();
  });
  box.addEventListener('click', function (e) { if (e.target === box) box.close(); });  // backdrop click
  box.addEventListener('close', function () { img.removeAttribute('src'); links[current].focus(); });
})();
