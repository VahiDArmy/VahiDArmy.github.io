/* =========================================================
   Prompt gate — show exactly what is sent to the model
   ========================================================= */
window.PromptGate = (function () {
  'use strict';

  function serialize(messages) {
    return (messages || []).map(function (m) {
      return '===== ' + String(m.role || 'user').toUpperCase() + ' =====\n' + String(m.content || '');
    }).join('\n\n');
  }

  function parse(text) {
    var raw = String(text || '').trim();
    if (!raw) return null;
    var parts = raw.split(/===== (SYSTEM|USER|ASSISTANT) =====/i);
    if (parts.length >= 3) {
      var messages = [];
      for (var i = 1; i + 1 < parts.length; i += 2) {
        var role = String(parts[i] || '').toLowerCase();
        var content = String(parts[i + 1] || '').replace(/^\n+/, '').replace(/\n+$/, '');
        messages.push({ role: role, content: content });
      }
      if (messages.length) return messages;
    }
    return [{ role: 'user', content: raw }];
  }

  function open(messages, meta) {
    messages = messages || [];
    meta = meta || {};

    return new Promise(function (resolve) {
      var settled = false;
      function finish(value) {
        if (settled) return;
        settled = true;
        resolve(value);
      }

      var textarea = UI.el('textarea', {
        class: 'textarea textarea--mono',
        rows: '18',
        spellcheck: 'false',
        dir: 'rtl'
      });
      textarea.value = serialize(messages);

      var body = UI.el('div', { class: 'gate' }, [
        UI.el('p', { class: 'gate__hint' }, [
          UI.el('strong', { text: (meta.title ? meta.title + ' — ' : '') + 'این پرامپت بی‌کم‌وکاست ارسال می‌شود.' }),
          UI.el('span', { text: 'در صورت نیاز ویرایش کن، بعد تأیید.' })
        ]),
        textarea
      ]);

      var foot = UI.el('div', { class: 'dlg__actions' });
      var cancel = UI.el('button', { class: 'btn is-quiet', type: 'button', text: 'انصراف' });
      var send = UI.el('button', { class: 'btn is-primary', type: 'button' }, [UI.nodeFromHTML(UI.icon('arrowRight')), UI.el('span', { text: 'تأیید و ارسال' })]);
      cancel.addEventListener('click', function () { finish(null); Modal.close(); });
      send.addEventListener('click', function () { finish(parse(textarea.value)); Modal.close(); });
      foot.appendChild(cancel);
      foot.appendChild(send);

      Modal.open({
        title: 'پرامپت قبل از ارسال',
        icon: 'terminal',
        size: 'lg',
        body: body,
        footer: foot,
        onClose: function () { finish(null); }
      });

      setTimeout(function () { textarea.focus(); textarea.setSelectionRange(0, 0); }, 60);
    });
  }

  return { open: open, serialize: serialize, parse: parse };
})();
