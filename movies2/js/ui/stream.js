/* =========================================================
   Stream card — one place where model output is shown
   ========================================================= */
(function (UI) {
  'use strict';

  function create(titleText, options) {
    options = options || {};

    var content = UI.el('div', { class: 'stream__content prose' });
    var statusText = UI.el('span', { class: 'stream__statustext', text: options.status || 'آماده' });
    var status = UI.el('div', { class: 'stream__status', dataset: { state: 'idle' } }, [
      UI.el('span', { class: 'stream__dot' }),
      statusText
    ]);

    var body = UI.el('div', { class: 'stream__body' }, [content]);
    var foot = UI.el('div', { class: 'stream__foot', hidden: true });

    var card = UI.el('section', { class: 'stream' }, [
      UI.el('header', { class: 'stream__head' }, [
        UI.el('div', { class: 'stream__title' }, [
          UI.nodeFromHTML(UI.icon('sparkle')),
          UI.el('span', { text: titleText || 'پاسخ مدل' })
        ]),
        status
      ]),
      body,
      foot
    ]);

    var buffer = '';
    var lastRendered = '';
    var stick = true;
    var raf = false;

    body.addEventListener('scroll', function () {
      stick = body.scrollHeight - body.scrollTop - body.clientHeight < 90;
    }, { passive: true });

    function paint() {
      raf = false;
      if (buffer === lastRendered) return;
      var keep = stick;
      content.innerHTML = UI.md(buffer);
      lastRendered = buffer;
      if (keep) body.scrollTop = body.scrollHeight;
    }

    function append(full) {
      buffer = String(full == null ? '' : full);
      if (raf) return;
      raf = true;
      requestAnimationFrame(paint);
    }

    function setHTML(html) {
      buffer = '';
      lastRendered = '';
      content.innerHTML = html;
      stick = true;
      body.scrollTop = 0;
    }

    function setStatus(text, state) {
      statusText.textContent = text;
      status.dataset.state = state || 'idle';
    }

    function modelBadge() {
      var info = (typeof AI !== 'undefined' && AI.getLastUsedModel) ? AI.getLastUsedModel() : null;
      if (!info) return;
      foot.hidden = false;
      UI.clear(foot);
      var chips = [UI.el('span', { class: 'modelbadge__label', text: 'مدل' }),
        UI.el('strong', { text: info.label || info.id })];
      if (info.vendor) chips.push(UI.el('span', { class: 'modelbadge__sub', text: info.vendor }));
      if (info.provider) chips.push(UI.el('span', { class: 'modelbadge__sub', text: info.provider === 'google' ? 'Gemini' : 'OpenRouter' }));
      if (info.requested_id && info.requested_id !== info.id) {
        chips.push(UI.el('span', { class: 'modelbadge__sub', text: 'via ' + (info.requested_label || info.requested_id) }));
      }
      foot.appendChild(UI.el('div', { class: 'modelbadge' }, chips));
    }

    function error(err) {
      var msg = (err && err.message) ? err.message : String(err || 'خطا');
      var raw = (err && err.rawResponse) ||
        (typeof AI !== 'undefined' && AI.getLastRawResponse ? AI.getLastRawResponse() : '');
      var html = '<div class="notice notice--bad"><strong>' + UI.esc(msg) + '</strong></div>';
      if (raw && String(raw).trim()) {
        html += '<details class="rawbox" open><summary>پاسخ خام مدل</summary><pre>' + UI.esc(String(raw)) + '</pre></details>';
      }
      setStatus('خطا', 'error');
      setHTML(html);
    }

    function hideStream() { card.hidden = true; }
    function showStream() { card.hidden = false; }

    return {
      el: card,
      body: body,
      content: content,
      append: append,
      setHTML: setHTML,
      setStatus: setStatus,
      modelBadge: modelBadge,
      error: error,
      hide: hideStream,
      show: showStream,
      text: function () { return buffer; }
    };
  }

  UI.stream = create;
})(window.UI);
