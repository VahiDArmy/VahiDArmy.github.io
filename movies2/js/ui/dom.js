/* =========================================================
   UI Kit — primitives shared by every view
   No old markup, no old classes. Built from scratch.
   ========================================================= */
window.UI = window.UI || {};

(function (UI) {
  'use strict';

  var ICONS = {
    film: '<rect x="2.7" y="4" width="18.6" height="16" rx="2.6"/><path d="M7.2 4v16M16.8 4v16M2.7 9.4h4.5M16.8 9.4h4.5M2.7 14.6h4.5M16.8 14.6h4.5"/>',
    search: '<circle cx="11" cy="11" r="6.6"/><path d="m20 20-3.7-3.7"/>',
    plus: '<path d="M12 5.2v13.6M5.2 12h13.6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6.2 6.2l11.6 11.6M17.8 6.2L6.2 17.8"/>',
    star: '<path d="M12 3.6l2.55 5.2 5.7.83-4.13 4.03.98 5.7L12 16.67 6.9 19.36l.98-5.7L3.75 9.63l5.7-.83z"/>',
    sparkle: '<path d="M12 3.2v3.4M12 17.4v3.4M4.8 7.6l2.4 2.4M16.8 14l2.4 2.4M3.2 12h3.4M17.4 12h3.4M4.8 16.4l2.4-2.4M16.8 10l2.4-2.4"/>',
    brain: '<path d="M12 3.4v17.2"/><path d="M9.4 3.4A2.4 2.4 0 0 0 7 5.8v.5a2.5 2.5 0 0 0-1.6 4.1A2.6 2.6 0 0 0 6 15a2.5 2.5 0 0 0 3.4 3.9"/><path d="M14.6 3.4A2.4 2.4 0 0 1 17 5.8v.5a2.5 2.5 0 0 1 1.6 4.1A2.6 2.6 0 0 1 18 15a2.5 2.5 0 0 1-3.4 3.9"/>',
    chart: '<path d="M4 20V10.6M9.4 20V4.4M14.8 20v-6.4M20.2 20V7.8M2.4 20h19.2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.6v3M12 18.4v3M2.6 12h3M18.4 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    edit: '<path d="M12 20h8.5M16.4 3.6a2.1 2.1 0 0 1 3 3L7.2 18.8 3 20l1.2-4.2z"/>',
    trash: '<path d="M3.4 6.4h17.2M8.6 6.4V3.8h6.8v2.6M6 6.4l1.1 13.8h9.8L18 6.4"/>',
    heart: '<path d="M12 20.4S3.6 15.4 3.6 9.6A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8.4 2.4c0 5.8-8.4 10.8-8.4 10.8z"/>',
    download: '<path d="M12 3.6v11.2M7.4 10.4 12 15l4.6-4.6M4.4 19.6h15.2"/>',
    upload: '<path d="M12 15.4V4.2M7.4 8.8 12 4.2l4.6 4.6M4.4 19.6h15.2"/>',
    logout: '<path d="M14.6 4.4H6.2a2 2 0 0 0-2 2v11.2a2 2 0 0 0 2 2h8.4"/><path d="M16.6 8.2 20.4 12l-3.8 3.8M20.4 12H9.6"/>',
    play: '<path d="M7.6 4.8 19 12 7.6 19.2z"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4.4V10h-5.6"/>',
    check: '<path d="M4.6 12.6 9.4 17.4 19.4 6.6"/>',
    chevL: '<path d="M14.4 5.6 8 12l6.4 6.4"/>',
    chevR: '<path d="M9.6 5.6 16 12l-6.4 6.4"/>',
    grid: '<rect x="3.4" y="3.4" width="7" height="7" rx="1.6"/><rect x="13.6" y="3.4" width="7" height="7" rx="1.6"/><rect x="3.4" y="13.6" width="7" height="7" rx="1.6"/><rect x="13.6" y="13.6" width="7" height="7" rx="1.6"/>',
    list: '<path d="M8.6 6.2h12M8.6 12h12M8.6 17.8h12M3.8 6.2h.02M3.8 12h.02M3.8 17.8h.02"/>',
    bolt: '<path d="M13.4 2.8 5 13.6h5.4L9.8 21.2 19 10.2h-5.8z"/>',
    user: '<circle cx="12" cy="8.2" r="3.9"/><path d="M4.4 20.4a7.6 7.6 0 0 1 15.2 0"/>',
    terminal: '<rect x="2.8" y="4" width="18.4" height="16" rx="2.4"/><path d="m7 10 2.6 2.4L7 15M12.6 15.4h4.6"/>',
    arrowRight: '<path d="M4.4 12h15.2M13.4 5.8 19.6 12l-6.2 6.2"/>',
    wand: '<path d="M15 4.2 19.8 9M4 20 15.6 8.4M17.4 3l.9 1.9 1.9.9-1.9.9-.9 1.9-.9-1.9-1.9-.9 1.9-.9zM6.6 3.6l.6 1.3 1.3.6-1.3.6-.6 1.3-.6-1.3L4.7 5.5l1.3-.6z"/>',
    layers: '<path d="M12 3.4 3.4 7.6 12 11.8l8.6-4.2z"/><path d="m3.4 12.2 8.6 4.2 8.6-4.2M3.4 16.6l8.6 4.2 8.6-4.2"/>',
    clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.4V12l3.4 2"/>',
    globe: '<circle cx="12" cy="12" r="8.4"/><path d="M3.6 12h16.8M12 3.6c2.4 2.4 3.6 5.2 3.6 8.4s-1.2 6-3.6 8.4c-2.4-2.4-3.6-5.2-3.6-8.4S9.6 6 12 3.6z"/>',
    book: '<path d="M4 4.6A1.6 1.6 0 0 1 5.6 3H19v18H5.6A1.6 1.6 0 0 1 4 19.4z"/><path d="M4 17.2h15"/>',
    filter: '<path d="M3.6 5.4h16.8l-6.6 7.6v6.4l-3.6-1.8v-4.6z"/>',
    info: '<circle cx="12" cy="12" r="8.4"/><path d="M12 10.6v6M12 7.6h.02"/>',
    alert: '<path d="M12 3.6 21 19.4H3z"/><path d="M12 9.4v4.4M12 16.6h.02"/>',
    terminalLine: '<path d="m5 7 4 4-4 4M11.4 15.4H19"/>'
  };

  function icon(name, cls) {
    var body = ICONS[name] || ICONS.info;
    return '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' + body + '</svg>';
  }

  function esc(value) { return Utils.esc(value); }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (key) {
      var v = attrs[key];
      if (v == null || v === false) return;
      if (key === 'class') node.className = v;
      else if (key === 'text') node.textContent = v;
      else if (key === 'html') node.innerHTML = v;
      else if (key === 'dataset') Object.assign(node.dataset, v);
      else if (key.indexOf('on') === 0 && typeof v === 'function') node.addEventListener(key.slice(2), v);
      else node.setAttribute(key, v === true ? '' : v);
    });
    var list = children == null ? [] : (Array.isArray(children) ? children : [children]);
    list.forEach(function (child) {
      if (child == null || child === false) return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function nodeFromHTML(str) {
    var box = document.createElement('div');
    box.innerHTML = str;
    return box.firstElementChild;
  }

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function on(root, eventName, selector, handler) {
    if (!root) return;
    root.addEventListener(eventName, function (ev) {
      var target = ev.target && ev.target.closest ? ev.target.closest(selector) : null;
      if (target && root.contains(target)) handler(ev, target);
    });
  }

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  function fa(n) { return Utils.toFa(n == null ? 0 : n); }

  function starMeta(level) {
    var n = Math.round(Number(level) || 0);
    return CONFIG.STARS[n] || CONFIG.STARS[0];
  }

  function meter(level, cls) {
    var n = Math.round(Number(level) || 0);
    var color = starMeta(n).color;
    var out = '<span class="meter' + (cls ? ' ' + cls : '') + '" style="--star:' + color + '">';
    for (var i = 1; i <= 5; i++) out += '<i class="' + (i <= n ? 'is-on' : '') + '"></i>';
    out += '</span>';
    return out;
  }

  function typeLabel(type) { return CONFIG.TYPES[type] || 'عنوان'; }

  function typeOptions(selected) {
    return Object.keys(CONFIG.TYPES).map(function (key) {
      return '<option value="' + key + '"' + (key === selected ? ' selected' : '') + '>' +
        esc(CONFIG.TYPES[key]) + '</option>';
    }).join('');
  }

  function highlight(text, query) {
    var safe = esc(text == null ? '' : text);
    var q = Utils.normalizeFa(query || '').trim();
    if (!q) return safe;
    q.split(' ').filter(Boolean).forEach(function (word) {
      var re = new RegExp('(' + Utils.escapeRegex(word) + ')', 'gi');
      safe = safe.replace(re, '<mark class="hl">$1</mark>');
    });
    return safe;
  }

  function plural(n, one, many) {
    return fa(n) + ' ' + (Number(n) === 1 ? one : many);
  }

  function timeAgo(iso) { return Utils.relativeTime(iso); }

  function initials(text) {
    var t = String(text || '').trim();
    return t ? t.slice(0, 1).toUpperCase() : '?';
  }

  function focusTrap(container) {
    function getFocusable() {
      return qsa('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),' +
        'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])', container)
        .filter(function (n) { return n.offsetParent !== null; });
    }
    container.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Tab') return;
      var items = getFocusable();
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    });
  }

  function toast(message, type, opts) {
    if (window.Toast) return window.Toast.show(message, type || 'info', opts || {});
    return null;
  }

  UI.icon = icon;
  UI.el = el;
  UI.nodeFromHTML = nodeFromHTML;
  UI.qs = qs;
  UI.qsa = qsa;
  UI.on = on;
  UI.clear = clear;
  UI.fa = fa;
  UI.esc = esc;
  UI.meter = meter;
  UI.starMeta = starMeta;
  UI.typeLabel = typeLabel;
  UI.typeOptions = typeOptions;
  UI.highlight = highlight;
  UI.plural = plural;
  UI.timeAgo = timeAgo;
  UI.initials = initials;
  UI.focusTrap = focusTrap;
  UI.toast = toast;
})(window.UI);
