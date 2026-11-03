/* =========================================================
   AI log dock — engine-compatible (log/show/scheduleAutoHide)
   ========================================================= */
window.AILog = (function () {
  'use strict';

  var dock = null;
  var list = null;
  var hideTimer = null;
  var entries = [];
  var MAX = 120;

  function build() {
    if (dock && document.body.contains(dock)) return;
    dock = UI.nodeFromHTML(
      '<aside class="logdock" id="logdock" aria-live="polite">' +
        '<header class="logdock__head">' +
          '<span class="logdock__dot"></span>' +
          '<span class="logdock__title">گزارش مدل</span>' +
          '<button class="logdock__btn" data-act="clear" type="button" title="پاک کردن">' + UI.icon('trash') + '</button>' +
          '<button class="logdock__btn" data-act="hide" type="button" title="بستن">' + UI.icon('close') + '</button>' +
        '</header>' +
        '<div class="logdock__body"></div>' +
      '</aside>'
    );
    document.body.appendChild(dock);
    list = dock.querySelector('.logdock__body');
    dock.querySelector('[data-act="clear"]').addEventListener('click', clear);
    dock.querySelector('[data-act="hide"]').addEventListener('click', hide);
    entries.forEach(function (entry) { list.appendChild(line(entry)); });
  }

  function line(entry) {
    return UI.nodeFromHTML(
      '<div class="logline" data-level="' + entry.level + '">' +
        '<time>' + UI.esc(entry.at) + '</time>' +
        '<span>' + UI.esc(entry.message) + '</span>' +
      '</div>'
    );
  }

  function stamp() {
    var d = new Date();
    function p(n) { return String(n).padStart(2, '0'); }
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  function log(message, level) {
    var entry = { message: String(message == null ? '' : message), level: level || 'info', at: stamp() };
    entries.push(entry);
    if (entries.length > MAX) entries.shift();
    if (list) {
      list.appendChild(line(entry));
      while (list.children.length > MAX) list.removeChild(list.firstChild);
      list.scrollTop = list.scrollHeight;
    }
    if (dock) dock.dataset.open = 'true';
  }

  function show() {
    build();
    dock.dataset.open = 'true';
    clearTimeout(hideTimer);
  }

  function hide() {
    if (dock) dock.dataset.open = 'false';
  }

  function scheduleAutoHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, 6000);
  }

  function clear() {
    entries = [];
    if (list) UI.clear(list);
  }

  function toggleCollapse() { hide(); }

  return {
    log: log,
    push: function (level, message) { log(message, level); },
    show: show,
    hide: hide,
    clear: clear,
    scheduleAutoHide: scheduleAutoHide,
    toggleCollapse: toggleCollapse,
    entries: function () { return entries.slice(); }
  };
})();
