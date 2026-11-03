/* =========================================================
   Settings — account, defaults, data, about
   ========================================================= */
(function (UI) {
  'use strict';

  function download(filename, content) {
    Utils.download(filename, content, 'application/json');
  }

  function exportData() {
    var payload = {
      app: 'cinema',
      version: CONFIG.APP_VERSION,
      exported_at: new Date().toISOString(),
      titles: DB.getAllTitles(),
      conversations: DB.getAllConversations(),
      meta: {}
    };
    download(Utils.timestampName('cinema-archive'), JSON.stringify(payload, null, 2));
    Toast.success('خروجی گرفته شد');
  }

  function importData(onDone) {
    var input = UI.el('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
    document.body.appendChild(input);
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var parsed = Utils.safeParse(reader.result, null);
        var titles = parsed && (parsed.titles || (Array.isArray(parsed) ? parsed : null));
        if (!Array.isArray(titles) || !titles.length) {
          Toast.error('فایل معتبر نیست یا عنوانی ندارد');
          return;
        }
        Modal.confirm({
          title: 'ورود ' + UI.fa(titles.length) + ' عنوان',
          message: 'این عنوان‌ها به آرشیو فعلی اضافه می‌شوند. ادامه؟',
          confirmText: 'افزودن',
          onConfirm: function () {
            titles.forEach(function (t) {
              if (!t || !t.title) return;
              State.addTitle({
                title: String(t.title).slice(0, 200),
                original_title: t.original_title || '',
                type: CONFIG.TYPES[t.type] ? t.type : 'series',
                genre: t.genre || '',
                year: Number(t.year) || null,
                rating: Number(t.rating) || 0,
                favorite: !!t.favorite,
                notes: t.notes || '',
                reason: t.reason || '',
                summary: t.summary || '',
                seasons: Number(t.seasons) || null,
                episodes: Number(t.episodes) || null,
                country: t.country || '',
                language: t.language || '',
                status: t.status || '',
                watched_date: t.watched_date || null,
                category: 'good'
              });
            });
            Toast.success(UI.fa(titles.length) + ' عنوان اضافه شد');
            if (onDone) onDone();
            setTimeout(function () { App.refresh(); }, 900);
          }
        });
      };
      reader.readAsText(file);
    });
    input.click();
  }

  function section(title, inner) {
    return '<section class="sec"><h3 class="sec__title">' + UI.esc(title) + '</h3>' + inner + '</section>';
  }

  function open() {
    var user = DB.getUser();
    var models = DB.getActiveAiModels();
    var currentModel = AI.getModel();
    var currentMeta = AI.modelMetaById(currentModel) || {};

    var body = UI.el('div', { class: 'settings' });

    body.innerHTML = [
      section('حساب', [
        '<div class="account">',
        '  <span class="avatar avatar--lg">' + UI.esc(UI.initials(user && user.email)) + '</span>',
        '  <div class="account__text">',
        '    <strong>' + UI.esc(user && user.email ? user.email : 'کاربر مهمان') + '</strong>',
        '    <span class="muted">اتصال امن به Supabase · داده‌ها فقط برای تو</span>',
        '  </div>',
        '</div>',
        '<div class="row row--end"><button class="btn is-quiet" type="button" data-act="signout">' + UI.icon('logout') + 'خروج از حساب</button></div>'
      ].join('')),

      section('مدل پیش‌فرض', [
        '<p class="muted">همهٔ ابزارهای AI با این مدل اجرا می‌شوند. ' + UI.fa(models.length) + ' مدل فعال در استخر.</p>',
        '<label class="field"><span class="field__label">مدل</span><select class="select" data-act="model">' +
          models.map(function (m) {
            return '<option value="' + UI.esc(m.id) + '"' + (m.id === currentModel ? ' selected' : '') + '>' +
              UI.esc(m.label || m.id) + (m.vendor ? ' — ' + UI.esc(m.vendor) : '') + '</option>';
          }).join('') + '</select></label>',
        '<p class="muted">' + UI.esc(currentMeta.provider === 'google' ? 'Gemini (مستقیم)' : 'OpenRouter') + '</p>'
      ].join('')),

      section('داده‌ها', [
        '<div class="row">',
        '  <button class="btn is-quiet" type="button" data-act="export">' + UI.icon('download') + 'خروجی JSON</button>',
        '  <button class="btn is-quiet" type="button" data-act="import">' + UI.icon('upload') + 'ورود از JSON</button>',
        '</div>',
        '<p class="muted">' + UI.fa(DB.getAllTitles().length) + ' عنوان · ' + UI.fa(DB.getAllConversations().length) + ' گفتگوی ذخیره‌شده</p>'
      ].join('')),

      section('درباره', [
        '<p class="muted">سینما من — نسخهٔ ' + UI.esc(Utils.toFa(CONFIG.APP_VERSION)) + '</p>',
        '<p class="muted">آرشیو شخصی فیلم و سریال با تحلیل داستانی. ساخته‌شده برای یک نفر.</p>'
      ].join(''))
    ].join('');

    var dlg = Modal.open({
      title: 'تنظیمات',
      icon: 'gear',
      size: 'lg',
      body: body,
      footer: (function () {
        var foot = UI.el('div', { class: 'dlg__actions' });
        var close = UI.el('button', { class: 'btn is-primary', type: 'button', text: 'بستن' });
        close.addEventListener('click', function () { dlg.close(); });
        foot.appendChild(close);
        return foot;
      })()
    });

    body.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-act]');
      if (!btn) return;
      var act = btn.dataset.act;
      if (act === 'export') exportData();
      if (act === 'import') importData(function () { dlg.close(); });
      if (act === 'signout') {
        Modal.confirm({
          title: 'خروج از حساب',
          message: 'برای دیدن آرشیو باید دوباره وارد شوی.',
          confirmText: 'خروج',
          danger: true,
          onConfirm: function () { DB.signOut().finally(function () { location.reload(); }); }
        });
      }
    });

    body.addEventListener('change', function (ev) {
      if (ev.target.matches('[data-act="model"]')) {
        AI.setModel(ev.target.value);
        Toast.success('مدل پیش‌فرض عوض شد');
        App.refreshModelChips();
      }
    });
  }

  UI.Settings = { open: open, exportData: exportData, importData: importData };
})(window.UI);
