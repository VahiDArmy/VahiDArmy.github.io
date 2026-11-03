/* =========================================================
   Command palette — search titles and run commands
   ========================================================= */
(function (UI) {
  'use strict';

  var active = null;

  function commands() {
    return [
      { label: 'افزودن عنوان جدید', hint: 'n', run: function () { UI.Item.openForm(null); } },
      { label: 'همهٔ عنوان‌ها', run: function () { App.resetLibraryFilters(); App.go('library'); } },
      { label: 'تحلیل و آمار', run: function () { App.go('insights'); } },
      { label: 'استودیوی هوش مصنوعی', run: function () { App.go('ai'); } },
      { label: 'تحلیل سلیقه', run: function () { App.go('ai', 'personality'); } },
      { label: 'پرامپت آزاد', run: function () { App.go('ai', 'prompt'); } },
      { label: 'مدل‌ها', run: function () { App.go('ai', 'models'); } },
      { label: 'تنظیمات', run: function () { UI.Settings.open(); } },
      { label: 'خروجی JSON', run: function () { UI.Settings.exportData(); } },
      { label: 'ورود از JSON', run: function () { UI.Settings.importData(); } },
      { label: 'فقط علاقه‌مندی‌ها', run: function () { App.quickFilter({ onlyFav: true }); } }
    ];
  }

  function open() {
    if (active) return;
    var input = UI.el('input', { class: 'palette__input', type: 'text', placeholder: 'جستجوی عنوان یا اجرای دستور…', autocomplete: 'off', spellcheck: 'false' });
    var list = UI.el('div', { class: 'palette__list' });
    var body = UI.el('div', { class: 'palette' }, [input, list]);

    var dlg = Modal.open({ title: '', body: body, size: 'md', className: 'dlg--palette' });
    active = dlg;
    var index = 0;
    var rows = [];

    function render(query) {
      var q = Utils.normalizeFa(query || '').trim();
      rows = [];
      list.innerHTML = '';

      var titles = (State.get().titles || []).filter(function (t) {
        if (!q) return false;
        return Utils.normalizeFa(t.title + ' ' + (t.original_title || '') + ' ' + (t.genre || '')).indexOf(q) > -1;
      }).slice(0, 6);

      titles.forEach(function (t) {
        var row = UI.el('button', { class: 'pitem', type: 'button' }, [
          UI.el('span', { class: 'pitem__kind', text: UI.typeLabel(t.type) }),
          UI.el('span', { class: 'pitem__label', text: t.title }),
          UI.el('span', { class: 'pitem__hint', text: UI.fa(Math.floor(Number(t.rating) || 0)) + ' ستاره' })
        ]);
        row.addEventListener('click', function () { close(); UI.Item.openDetail(t.id); });
        rows.push(row);
        list.appendChild(row);
      });

      commands().filter(function (c) {
        if (!q) return true;
        return Utils.normalizeFa(c.label).indexOf(q) > -1;
      }).forEach(function (cmd) {
        var row = UI.el('button', { class: 'pitem pitem--cmd', type: 'button' }, [
          UI.el('span', { class: 'pitem__kind', text: 'دستور' }),
          UI.el('span', { class: 'pitem__label', text: cmd.label }),
          cmd.hint ? UI.el('span', { class: 'pitem__hint', text: cmd.hint }) : null
        ]);
        row.addEventListener('click', function () { close(); cmd.run(); });
        rows.push(row);
        list.appendChild(row);
      });

      if (!rows.length) list.appendChild(UI.el('p', { class: 'muted palette__empty', text: 'چیزی پیدا نشد' }));
      index = 0;
      paintSelection();
    }

    function paintSelection() {
      rows.forEach(function (r, i) { r.classList.toggle('is-on', i === index); });
    }

    function move(delta) {
      if (!rows.length) return;
      index = (index + delta + rows.length) % rows.length;
      paintSelection();
      rows[index].scrollIntoView({ block: 'nearest' });
    }

    function close() {
      active = null;
      dlg.close();
      document.removeEventListener('keydown', onKey, true);
    }

    function onKey(ev) {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); move(1); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); move(-1); }
      else if (ev.key === 'Enter') {
        ev.preventDefault();
        if (rows[index]) rows[index].click();
      }
    }

    document.addEventListener('keydown', onKey, true);
    input.addEventListener('input', Utils.debounce(function () { render(input.value); }, 120));
    dlg.modal.addEventListener('click', function (ev) {
      if (ev.target === dlg.modal) { /* noop */ }
    });
    render('');
    setTimeout(function () { input.focus(); }, 40);
  }

  UI.Palette = { open: open };
})(window.UI);
