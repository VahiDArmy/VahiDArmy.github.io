/* ==========================================================================
   App — Bootstrap
   Wires every module together. Must be the LAST script loaded.
   ========================================================================== */

(function (window, document) {
  'use strict';

  const App = (window.App = window.App || {});
  const C = App.Constants;
  const DOM = App.DOM;
  const Events = App.Events;
  const State = App.State;
  const Format = App.Format;

  /* ---------- Tab switching ---------- */

  function switchTab(tabName) {
    if (C.TABS.indexOf(tabName) === -1) return;

    // Tab buttons
    const tabs = document.querySelectorAll('.app-tab');
    tabs.forEach((t) => {
      const isActive = t.dataset.tab === tabName;
      t.classList.toggle('is-active', isActive);
      t.setAttribute('aria-selected', String(isActive));
    });

    // Panels
    const panels = document.querySelectorAll('[data-tab-panel]');
    panels.forEach((p) => {
      const isActive = p.dataset.tabPanel === tabName;
      p.classList.toggle('is-active', isActive);
      p.hidden = !isActive;
    });

    // Scroll main to top
    const main = document.getElementById('app-main');
    if (main) main.scrollTop = 0;

    Events.emit(C.EVENTS.TAB_CHANGED, { tab: tabName });

    // Lazy refresh charts when entering fitting/results
    if (tabName === 'fitting' && App.PageFitting) {
      setTimeout(() => App.PageFitting.refreshPreviewChart(), 40);
    }
  }

  App.switchTab = switchTab;

  /* ---------- Wire tabs ---------- */

  function wireTabs() {
    document.querySelectorAll('.app-tab').forEach((tab) => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
  }

  /* ---------- Header ---------- */

  function wireHeader() {
    const helpBtn = document.getElementById('btn-help');
    if (helpBtn) helpBtn.addEventListener('click', openHelp);
    const settingsBtn = document.getElementById('btn-settings');
    if (settingsBtn) settingsBtn.addEventListener('click', () => switchTab('settings'));
  }

  function openHelp() {
    const body = DOM.el('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } });
    body.innerHTML = `
      <p>این برنامه برای تحلیل داده‌های جدولی و برازش منحنی طراحی شده است. همهٔ محاسبات در مرورگر شما انجام می‌شود.</p>
      <h4 style="font-size:14px;margin-top:6px;">شروع سریع:</h4>
      <ol style="padding-inline-start:20px;list-style:decimal;color:var(--fg-2);font-size:13px;line-height:1.8;">
        <li>در تب «داده‌ها» داده‌ها را وارد کنید یا از فایل اکسل بارگذاری کنید.</li>
        <li>در تب «برازش» ستون‌های x و y را انتخاب و نوع برازش را تعیین کنید.</li>
        <li>دکمهٔ «اجرای برازش» را بزنید.</li>
        <li>در تب «نتایج» معادله، شاخص‌ها، نمودارها و خروجی اکسل را مشاهده کنید.</li>
      </ol>
      <h4 style="font-size:14px;margin-top:6px;">کلیدهای میان‌بر:</h4>
    `;
    const grid = DOM.el('div', { class: 'shortcut-list', style: { marginTop: '4px' } });
    C.SHORTCUTS.forEach((s) => {
      const item = DOM.el('div', { class: 'shortcut-item' });
      item.appendChild(DOM.el('span', { text: s.label }));
      const keysWrap = DOM.el('div', { class: 'shortcut-item__keys' });
      s.keys.forEach((k) => keysWrap.appendChild(DOM.el('kbd', { text: k })));
      item.appendChild(keysWrap);
      grid.appendChild(item);
    });
    body.appendChild(grid);

    App.Modal.custom({
      title: 'راهنمای برنامه',
      subtitle: 'آشنایی سریع با امکانات',
      icon: 'info',
      size: 'lg',
      body,
      footer: [{ label: 'متوجه شدم', variant: 'primary' }]
    });
  }

  /* ---------- Footer ---------- */

  function wireFooter() {
    const dot = document.getElementById('save-status-dot');
    const text = document.getElementById('save-status-text');
    const cellInfo = document.getElementById('footer-cell-info');

    function updateStatus() {
      const meta = State.getMeta();
      if (dot) {
        dot.classList.remove('is-saving', 'is-error');
        if (meta.isSaving) dot.classList.add('is-saving');
        else if (meta.saveError) dot.classList.add('is-error');
      }
      if (text) {
        if (meta.isSaving) text.textContent = 'در حال ذخیره…';
        else if (meta.saveError) text.textContent = 'خطا در ذخیره';
        else if (meta.lastSavedAt) text.textContent = 'ذخیره شد — ' + Format.formatRelativeTime(meta.lastSavedAt);
        else text.textContent = 'آماده';
      }
    }

    function updateCellInfo() {
      if (!cellInfo) return;
      const rows = State.getRows().length;
      const cols = State.getColumns().length;
      cellInfo.textContent = `${Format.toPersian(String(rows))} سطر × ${Format.toPersian(String(cols))} ستون`;
    }

    Events.on(C.EVENTS.SETTINGS_CHANGED, () => {
      updateStatus();
    });
    Events.on(C.EVENTS.DATA_CHANGED, updateCellInfo);
    Events.on(C.EVENTS.DATA_LOADED, updateCellInfo);

    updateStatus();
    updateCellInfo();

    // Periodic refresh of relative time
    setInterval(updateStatus, 15000);
  }

  /* ---------- Keyboard shortcuts ---------- */

  function wireShortcuts() {
    document.addEventListener('keydown', (ev) => {
      // Ignore if inside editable inputs for most shortcuts
      const isEditable = DOM.isEditableTarget(ev.target) &&
        !(ev.target.classList && ev.target.classList.contains('cell-input'));

      const ctrl = ev.ctrlKey || ev.metaKey;

      // Global — always available
      if (ctrl && ev.key.toLowerCase() === 's') {
        ev.preventDefault();
        State.saveNow();
        App.Toast.success('ذخیره شد', 'داده‌ها در حافظهٔ مرورگر ذخیره شدند.');
        return;
      }

      if (ctrl && ev.key.toLowerCase() === 'z' && !ev.shiftKey && !isEditable) {
        if (State.canUndo()) {
          ev.preventDefault();
          State.undo();
          App.Toast.info('واگرد', 'آخرین تغییر بازگردانده شد.', 1800);
        }
        return;
      }

      if (
        ((ctrl && ev.key.toLowerCase() === 'y') ||
          (ctrl && ev.shiftKey && ev.key.toLowerCase() === 'z')) &&
        !isEditable
      ) {
        if (State.canRedo()) {
          ev.preventDefault();
          State.redo();
          App.Toast.info('ازنو', '', 1800);
        }
        return;
      }

      if (ctrl && ev.key.toLowerCase() === 'o' && !isEditable) {
        ev.preventDefault();
        const input = document.getElementById('excel-file-input');
        if (input) input.click();
        return;
      }

      if (ctrl && ev.key.toLowerCase() === 'e' && !isEditable) {
        ev.preventDefault();
        const res = App.ExportService.exportReport();
        if (res.ok) App.Toast.success('خروجی گرفته شد', res.filename);
        else App.Toast.error('خطا', res.error || '');
        return;
      }

      if (ctrl && ev.key.toLowerCase() === 'k') {
        ev.preventDefault();
        switchTab('data');
        const search = document.getElementById('data-search');
        if (search) {
          setTimeout(() => {
            search.focus();
            search.select();
          }, 80);
        }
        return;
      }

      if (ctrl && ev.key === 'Enter' && !isEditable) {
        ev.preventDefault();
        switchTab('fitting');
        if (App.PageFitting) App.PageFitting.runFit();
        return;
      }

      if (ev.key === '?' && !isEditable) {
        ev.preventDefault();
        openHelp();
        return;
      }
    });
  }

  /* ---------- Boot ---------- */

  function boot() {
    // 1. Load persisted state
    try {
      State.loadFromStorage();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[App] state load failed', err);
    }

    // 2. Apply chart defaults
    try {
      App.PlotService.applyDefaults();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[App] plot defaults failed', err);
    }

    // 3. Mount pages
    try {
      if (App.PageDataInput) App.PageDataInput.mount();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[App] PageDataInput.mount failed', err);
    }
    try {
      if (App.PageFitting) App.PageFitting.mount();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[App] PageFitting.mount failed', err);
    }
    try {
      if (App.PageResults) App.PageResults.mount();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[App] PageResults.mount failed', err);
    }
    try {
      if (App.PageSettings) App.PageSettings.mount();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[App] PageSettings.mount failed', err);
    }

    // 4. Wire chrome (tabs, header, footer, shortcuts)
    wireTabs();
    wireHeader();
    wireFooter();
    wireShortcuts();

    // 5. Default tab
    switchTab('data');

    // 6. Welcome / ready indicator
    setTimeout(() => {
      App.Toast.info(
        'آماده',
        `${C.APP_NAME} بارگذاری شد. برای شروع از تب «داده‌ها» شروع کنید.`,
        3000
      );
    }, 400);
  }

  /* ---------- Lifecycle guard ---------- */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    // Script ran after DOMContentLoaded — boot on next tick
    setTimeout(boot, 0);
  }

  /* ---------- Save on unload ---------- */

  window.addEventListener('beforeunload', () => {
    try {
      State.saveNow();
    } catch (err) {
      // ignore
    }
  });

  /* ---------- Global error reporting ---------- */

  window.addEventListener('error', (ev) => {
    // eslint-disable-next-line no-console
    console.error('[Global error]', ev.error || ev.message);
  });

  window.addEventListener('unhandledrejection', (ev) => {
    // eslint-disable-next-line no-console
    console.error('[Unhandled rejection]', ev.reason);
  });
})(window, document);