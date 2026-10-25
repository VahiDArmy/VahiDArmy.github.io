/* ==========================================================================
   Page — Settings
   ========================================================================== */

(function (window) {
  'use strict';

  const App = (window.App = window.App || {});
  const C = App.Constants;
  const DOM = App.DOM;
  const State = App.State;
  const Events = App.Events;
  const Format = App.Format;

  let layoutEl = null;
  let mounted = false;

  function mount() {
    if (mounted) return;
    mounted = true;
    layoutEl = document.getElementById('settings-layout');
    if (!layoutEl) return;

    render();

    Events.on(C.EVENTS.SETTINGS_CHANGED, () => {
      // Only re-render toggles if not from settings page itself
      // (we re-render fully for simplicity)
      // Debounced to avoid rapid re-renders
      scheduleRerender();
    });
  }

  let rerenderTimer = null;
  function scheduleRerender() {
    if (rerenderTimer) clearTimeout(rerenderTimer);
    rerenderTimer = setTimeout(() => {
      rerenderTimer = null;
      render();
    }, 80);
  }

  /* ---------- Render ---------- */

  function render() {
    if (!layoutEl) return;
    // Preserve focus by not wiping if a toggle is focused
    const active = document.activeElement;
    const wasInLayout = active && layoutEl.contains(active);
    const activeId = wasInLayout ? active.id : null;

    DOM.empty(layoutEl);

    layoutEl.appendChild(buildDisplaySection());
    layoutEl.appendChild(buildBehaviorSection());
    layoutEl.appendChild(buildChartSection());
    layoutEl.appendChild(buildShortcutsSection());
    layoutEl.appendChild(buildAboutSection());
    layoutEl.appendChild(buildDangerSection());

    if (activeId) {
      const el = document.getElementById(activeId);
      if (el) el.focus();
    }
  }

  /* ---------- Sections ---------- */

  function buildDisplaySection() {
    const section = buildSection(
      'نمایش و قالب',
      'نحوهٔ نمایش اعداد و داده‌ها',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
    );

    const body = section.body;

    // Decimals
    body.appendChild(
      buildRow({
        title: 'تعداد رقم اعشار',
        hint: 'اعداد در نتایج و آمار با این تعداد رقم اعشار نمایش داده می‌شوند.',
        control: buildDecimalsControl()
      })
    );

    // Persian digits
    body.appendChild(
      buildRow({
        title: 'ارقام فارسی',
        hint: 'نمایش اعداد با ارقام فارسی (۰۱۲۳…) به‌جای لاتین.',
        control: buildSwitch('digits', State.getSettings().digits === 'fa',
          (v) => State.setSetting('digits', v ? 'fa' : 'en'))
      })
    );

    return section.el;
  }

  function buildDecimalsControl() {
    const wrap = DOM.el('div', { class: 'row', style: { gap: '8px' } });
    const input = DOM.el('input', {
      type: 'number',
      class: 'input input--sm',
      min: '0',
      max: '10',
      step: '1',
      value: String(State.getSettings().decimals),
      style: { width: '70px' }
    });
    input.addEventListener('change', (e) => {
      const v = parseInt(e.target.value, 10);
      if (Number.isFinite(v) && v >= 0 && v <= 10) {
        State.setSetting('decimals', v);
      } else {
        e.target.value = String(State.getSettings().decimals);
      }
    });
    wrap.appendChild(input);
    wrap.appendChild(DOM.el('span', { class: 'text-muted text-xs', text: 'رقم' }));
    return wrap;
  }

  function buildBehaviorSection() {
    const section = buildSection(
      'رفتار برنامه',
      'ذخیره‌سازی خودکار و رفتارهای جانبی',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>'
    );

    section.body.appendChild(
      buildRow({
        title: 'ذخیره‌سازی خودکار',
        hint: 'تغییرات به‌طور خودکار در حافظهٔ مرورگر ذخیره می‌شوند.',
        control: buildSwitch('autoSave', State.getSettings().autoSave, (v) =>
          State.setSetting('autoSave', v)
        )
      })
    );

    section.body.appendChild(
      buildRow({
        title: 'انیمیشن رابط کاربری',
        hint: 'افکت‌های حرکتی و انتقال‌ها. اگر کندی حس می‌کنید خاموش کنید.',
        control: buildSwitch('animateUi', State.getSettings().animateUi, (v) =>
          State.setSetting('animateUi', v)
        )
      })
    );

    return section.el;
  }

  function buildChartSection() {
    const section = buildSection(
      'نمودارها',
      'تنظیمات مربوط به نمودار نتایج',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>'
    );

    section.body.appendChild(
      buildRow({
        title: 'نمایش نمودار باقی‌مانده‌ها',
        hint: 'در صفحهٔ نتایج، نمودار باقی‌مانده‌ها هم نشان داده شود.',
        control: buildSwitch(
          'includeResidualPlot',
          State.getSettings().includeResidualPlot,
          (v) => State.setSetting('includeResidualPlot', v)
        )
      })
    );

    return section.el;
  }

  function buildShortcutsSection() {
    const section = buildSection(
      'کلیدهای میان‌بر',
      'با این کلیدها سریع‌تر کار کنید',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M10 14h.01M14 14h.01M18 14h.01"/></svg>'
    );

    const grid = DOM.el('div', { class: 'shortcut-list' });
    C.SHORTCUTS.forEach((s) => {
      const item = DOM.el('div', { class: 'shortcut-item' });
      item.appendChild(DOM.el('span', { text: s.label }));
      const keysWrap = DOM.el('div', { class: 'shortcut-item__keys' });
      s.keys.forEach((k) => {
        keysWrap.appendChild(DOM.el('kbd', { text: k }));
      });
      item.appendChild(keysWrap);
      grid.appendChild(item);
    });
    section.body.appendChild(grid);
    return section.el;
  }

  function buildAboutSection() {
    const section = buildSection(
      'درباره',
      '',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    );

    const about = DOM.el('div', { class: 'settings-about' });
    const brand = DOM.el('div', { class: 'settings-about__brand' });
    const logo = DOM.el('div', { class: 'settings-about__logo' });
    logo.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/><circle cx="7" cy="14" r="1.5" fill="currentColor"/><circle cx="11" cy="10" r="1.5" fill="currentColor"/><circle cx="14" cy="13" r="1.5" fill="currentColor"/><circle cx="19" cy="7" r="1.5" fill="currentColor"/></svg>';
    brand.appendChild(logo);
    const brandText = DOM.el('div');
    brandText.appendChild(DOM.el('div', { class: 'settings-about__name', text: C.APP_NAME }));
    brandText.appendChild(
      DOM.el('div', {
        class: 'settings-about__version',
        text: 'نسخهٔ ' + C.APP_VERSION
      })
    );
    brand.appendChild(brandText);
    about.appendChild(brand);

    about.appendChild(
      DOM.el('p', {
        text: 'ابزاری حرفه‌ای، سبک و بدون نیاز به سرور برای تحلیل و برازش منحنی روی داده‌های جدولی. تمام محاسبات در مرورگر شما انجام می‌شود.'
      })
    );

    section.body.appendChild(about);
    return section.el;
  }

  function buildDangerSection() {
    const section = buildSection(
      'منطقهٔ خطر',
      'عملیات غیرقابل بازگشت',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      'danger'
    );

    section.body.appendChild(
      buildRow({
        title: 'پاک‌سازی داده‌ها',
        hint: 'مقادیر تمام سلول‌ها خالی می‌شوند. ساختار جدول باقی می‌ماند.',
        control: buildActionButton('پاک‌سازی', 'danger', async () => {
          const ok = await App.Modal.confirm({
            title: 'پاک‌سازی داده‌ها',
            message: 'تمام مقادیر جدول حذف می‌شوند. ادامه می‌دهید؟',
            danger: true,
            confirmLabel: 'پاک کن'
          });
          if (ok) {
            State.clearAll();
            App.Toast.success('پاک شد', '');
          }
        })
      })
    );

    section.body.appendChild(
      buildRow({
        title: 'بازنشانی کامل برنامه',
        hint: 'تمام داده‌ها، تنظیمات و تاریخچهٔ ذخیره‌شده در حافظهٔ مرورگر حذف می‌شود.',
        control: buildActionButton('بازنشانی', 'danger', async () => {
          const ok = await App.Modal.confirm({
            title: 'بازنشانی کامل',
            message:
              'تمام داده‌ها، تنظیمات و تاریخچه پاک می‌شوند و برنامه به حالت اولیه بازمی‌گردد. این عمل غیرقابل بازگشت است.',
            danger: true,
            confirmLabel: 'بازنشانی'
          });
          if (ok) {
            App.Storage.clearAll();
            State.resetData(C.DEFAULTS.TABLE_ROWS, C.DEFAULTS.TABLE_COLS);
            State.clearFitResult();
            App.Toast.success('بازنشانی شد', 'برنامه به حالت اولیه برگشت.');
            setTimeout(() => window.location.reload(), 700);
          }
        })
      })
    );

    return section.el;
  }

  /* ---------- Building blocks ---------- */

  function buildSection(title, desc, iconSvg, variant) {
    const section = DOM.el('div', {
      class: 'settings-section' + (variant === 'danger' ? ' settings-section--danger' : '')
    });
    const header = DOM.el('div', { class: 'settings-section__header' });
    const iconWrap = DOM.el('div', { class: 'settings-section__icon' });
    iconWrap.innerHTML = iconSvg;
    header.appendChild(iconWrap);
    const textWrap = DOM.el('div');
    textWrap.appendChild(DOM.el('div', { class: 'settings-section__title', text: title }));
    if (desc) {
      textWrap.appendChild(DOM.el('div', { class: 'settings-section__desc', text: desc }));
    }
    header.appendChild(textWrap);
    section.appendChild(header);
    const body = DOM.el('div', { class: 'settings-section__body' });
    section.appendChild(body);
    return { el: section, body };
  }

  function buildRow(opts) {
    const row = DOM.el('div', { class: 'settings-row' });
    const label = DOM.el('div', { class: 'settings-row__label' });
    label.appendChild(DOM.el('div', { class: 'settings-row__title', text: opts.title }));
    if (opts.hint) {
      label.appendChild(DOM.el('div', { class: 'settings-row__hint', text: opts.hint }));
    }
    row.appendChild(label);
    const ctrl = DOM.el('div', { class: 'settings-row__control' });
    if (opts.control) ctrl.appendChild(opts.control);
    row.appendChild(ctrl);
    return row;
  }

  function buildSwitch(id, checked, onChange) {
    const lbl = DOM.el('label', { class: 'switch' });
    const cb = DOM.el('input', { type: 'checkbox', id: id });
    cb.checked = !!checked;
    cb.addEventListener('change', () => onChange(cb.checked));
    const track = DOM.el('span', { class: 'switch__track' });
    track.appendChild(DOM.el('span', { class: 'switch__thumb' }));
    lbl.appendChild(cb);
    lbl.appendChild(track);
    return lbl;
  }

  function buildActionButton(label, variant, onClick) {
    const btn = DOM.el('button', {
      type: 'button',
      class: `btn btn--${variant} btn--sm`,
      text: label
    });
    btn.addEventListener('click', onClick);
    return btn;
  }

  App.PageSettings = { mount };
})(window);