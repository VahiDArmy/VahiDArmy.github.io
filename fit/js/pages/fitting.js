/* ==========================================================================
   Page — Fitting
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
  let previewChartId = 'fit-preview-canvas';
  let currentPreview = null;
  let collapsedSections = new Set();

  /* ---------- Mount ---------- */

  function mount() {
    if (mounted) return;
    mounted = true;
    layoutEl = document.getElementById('fitting-layout');
    if (!layoutEl) return;

    render();

    Events.on(C.EVENTS.FIT_CONFIG_CHANGED, () => {
      render();
    });
    Events.on(C.EVENTS.DATA_CHANGED, () => {
      render();
    });
    Events.on(C.EVENTS.DATA_LOADED, () => {
      render();
    });
  }

  /* ---------- Render shell ---------- */

  function render() {
    if (!layoutEl) return;
    const prevScroll = layoutEl.parentElement ? layoutEl.parentElement.scrollTop : 0;
    DOM.empty(layoutEl);

    const config = buildConfigSidebar();
    const preview = buildPreviewPanel();

    layoutEl.appendChild(config);
    layoutEl.appendChild(preview);

    if (layoutEl.parentElement) layoutEl.parentElement.scrollTop = prevScroll;

    // Refresh preview chart after DOM ready
    setTimeout(() => refreshPreviewChart(), 20);
  }

  /* ---------- Config sidebar ---------- */

  function buildConfigSidebar() {
    const cfg = State.getFitConfig();
    const def = App.getFitDefinition(cfg.type) || App.FitTypeDefinitions[0];
    const container = DOM.el('aside', { class: 'fit-config' });

    container.appendChild(buildFitTypeSection(def));
    container.appendChild(buildColumnsSection());
    container.appendChild(buildParamsSection(def, cfg));

    return container;
  }

  function buildFitTypeSection(def) {
    const section = DOM.el('section', { class: 'fit-config__section' });
    const header = DOM.el('div', { class: 'fit-config__section-header' });
    header.innerHTML = '<span class="fit-config__step-num">۱</span><span>نوع برازش</span>';
    section.appendChild(header);

    const body = DOM.el('div', { class: 'fit-config__section-body' });
    const grid = DOM.el('div', { class: 'fit-type-grid' });

    App.FitTypeDefinitions.forEach((fd) => {
      const card = DOM.el('button', {
        type: 'button',
        class: 'fit-type-card' + (fd.id === def.id ? ' is-active' : '')
      });
      const iconWrap = DOM.el('div', { class: 'fit-type-card__icon' });
      iconWrap.innerHTML = fd.icon;
      card.appendChild(iconWrap);
      card.appendChild(DOM.el('div', { class: 'fit-type-card__name', text: fd.name }));
      card.appendChild(DOM.el('div', { class: 'fit-type-card__eq', text: fd.equationLabel }));
      card.addEventListener('click', () => {
        if (State.getFitConfig().type === fd.id) return;
        State.setFitType(fd.id);
      });
      grid.appendChild(card);
    });

    body.appendChild(grid);
    section.appendChild(body);
    return section;
  }

  function buildColumnsSection() {
    const section = DOM.el('section', { class: 'fit-config__section' });
    const header = DOM.el('div', { class: 'fit-config__section-header' });
    header.innerHTML = '<span class="fit-config__step-num">۲</span><span>ستون‌های داده</span>';
    section.appendChild(header);

    const body = DOM.el('div', { class: 'fit-config__section-body' });

    const cfg = State.getFitConfig();
    const cols = State.getColumns();
    const numericCols = cols.filter((c) => c.type === 'number' || c.type === 'mixed');

    body.appendChild(
      buildColumnPicker('ستون x (مستقل)', numericCols, cfg.xColId, (id) => {
        State.setFitXColumn(id);
      })
    );
    body.appendChild(
      buildColumnPicker('ستون y (وابسته)', numericCols, cfg.yColId, (id) => {
        State.setFitYColumn(id);
      })
    );

    if (numericCols.length === 0) {
      body.appendChild(
        DOM.el('div', {
          class: 'info-block info-block--warning',
          html: '<div class="info-block__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><div>هیچ ستون عددی وجود ندارد. ابتدا در تب «داده‌ها» مقادیر عددی وارد کنید.</div>'
        })
      );
    }

    section.appendChild(body);
    return section;
  }

  function buildColumnPicker(label, cols, selectedId, onChange) {
    const wrap = DOM.el('div', { class: 'column-selector' });
    wrap.appendChild(DOM.el('div', { class: 'column-selector__label', text: label }));

    const pills = DOM.el('div', { class: 'column-selector__pills' });
    cols.forEach((col) => {
      const pill = DOM.el('button', {
        type: 'button',
        class: 'col-pill' + (col.id === selectedId ? ' is-active' : '')
      });
      pill.appendChild(document.createTextNode(col.name));
      pill.appendChild(
        DOM.el('span', {
          class: 'col-pill__index',
          text: ` (${Format.toPersian(String(State.getColumns().indexOf(col) + 1))})`
        })
      );
      pill.addEventListener('click', () => {
        if (col.id === selectedId) return;
        onChange(col.id);
      });
      pills.appendChild(pill);
    });

    if (cols.length === 0) {
      pills.appendChild(
        DOM.el('span', { class: 'text-muted text-xs', text: '—' })
      );
    }

    wrap.appendChild(pills);
    return wrap;
  }

  function buildParamsSection(def, cfg) {
    const section = DOM.el('section', { class: 'fit-config__section' });
    const header = DOM.el('div', { class: 'fit-config__section-header' });
    header.innerHTML = '<span class="fit-config__step-num">۳</span><span>پارامترها</span>';
    section.appendChild(header);

    const body = DOM.el('div', { class: 'fit-config__section-body' });

    // Dynamic params
    const paramRows = DOM.el('div', { class: 'fit-params' });
    let hasVisibleParams = false;

    def.params.forEach((p) => {
      if (p.interceptCandidate) return;
      hasVisibleParams = true;

      if (p.key === 'order') {
        paramRows.appendChild(buildOrderSlider(p, cfg));
      } else if (p.key === 'window') {
        paramRows.appendChild(buildNumberParam(p, cfg));
      } else {
        // Other numeric params are auto-computed — no UI needed
      }
    });

    if (hasVisibleParams) body.appendChild(paramRows);

    // Intercept toggle
    if (def.supportsInterceptToggle) {
      body.appendChild(buildInterceptToggle(def, cfg));
    }

    // Description
    if (def.description) {
      body.appendChild(
        DOM.el('div', { class: 'info-block', html: `<div class="info-block__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></div><div>${DOM.escapeHTML(def.description)}</div>` })
      );
    }

    section.appendChild(body);
    return section;
  }

  function buildOrderSlider(p, cfg) {
    const wrap = DOM.el('div', { class: 'field' });
    wrap.appendChild(
      DOM.el('label', {
        class: 'field__label',
        text: `${p.label} (${Format.toPersian(String(p.min))} تا ${Format.toPersian(String(p.max))})`
      })
    );
    const ctrl = DOM.el('div', { class: 'poly-order-control' });
    const valEl = DOM.el('div', {
      class: 'poly-order-control__value',
      text: Format.toPersian(String(cfg.params[p.key] || p.default))
    });
    const range = DOM.el('input', {
      type: 'range',
      class: 'range',
      min: String(p.min),
      max: String(p.max),
      step: String(p.step || 1),
      value: String(cfg.params[p.key] || p.default)
    });
    range.addEventListener('input', (e) => {
      valEl.textContent = Format.toPersian(e.target.value);
    });
    range.addEventListener('change', (e) => {
      State.setFitParam(p.key, parseInt(e.target.value, 10));
    });
    ctrl.appendChild(valEl);
    ctrl.appendChild(range);
    wrap.appendChild(ctrl);
    wrap.appendChild(DOM.el('div', { class: 'field__help', text: p.description }));
    return wrap;
  }

  function buildNumberParam(p, cfg) {
    const wrap = DOM.el('div', { class: 'field' });
    wrap.appendChild(DOM.el('label', { class: 'field__label', text: p.label }));
    const input = DOM.el('input', {
      type: 'number',
      class: 'input',
      min: String(p.min || 1),
      max: String(p.max || 999),
      step: String(p.step || 1),
      value: String(cfg.params[p.key] || p.default || '')
    });
    input.addEventListener('change', (e) => {
      const v = parseInt(e.target.value, 10);
      if (Number.isFinite(v)) State.setFitParam(p.key, v);
    });
    wrap.appendChild(input);
    wrap.appendChild(DOM.el('div', { class: 'field__help', text: p.description }));
    return wrap;
  }

  function buildInterceptToggle(def, cfg) {
    const wrap = DOM.el('div', { class: 'field' });
    const lbl = DOM.el('label', { class: 'switch' });
    const cb = DOM.el('input', { type: 'checkbox' });
    cb.checked = !!cfg.interceptFixed;
    const track = DOM.el('span', { class: 'switch__track' });
    track.appendChild(DOM.el('span', { class: 'switch__thumb' }));
    lbl.appendChild(cb);
    lbl.appendChild(track);
    lbl.appendChild(DOM.el('span', { text: 'تعیین دستی عرض از مبدأ' }));
    wrap.appendChild(lbl);

    const inputWrap = DOM.el('div', {
      class: 'field',
      style: { marginTop: '8px', display: cfg.interceptFixed ? 'flex' : 'none' }
    });
    inputWrap.appendChild(
      DOM.el('label', { class: 'field__label', text: 'مقدار عرض از مبدأ' })
    );
    const numInput = DOM.el('input', {
      type: 'number',
      class: 'input',
      step: 'any',
      value: String(cfg.interceptValue || 0)
    });
    numInput.addEventListener('change', (e) => {
      const v = parseFloat(e.target.value);
      if (Number.isFinite(v)) {
        State.setInterceptFixed(true, v);
      }
    });
    inputWrap.appendChild(numInput);
    wrap.appendChild(inputWrap);

    cb.addEventListener('change', () => {
      State.setInterceptFixed(cb.checked, cfg.interceptValue || 0);
    });

    return wrap;
  }

  /* ---------- Preview panel ---------- */

  function buildPreviewPanel() {
    const container = DOM.el('div', { class: 'fit-preview' });

    // Validation warnings
    const validation = App.FitService.validateConfig();
    if (!validation.ok && validation.issues.length) {
      const banner = DOM.el('div', { class: 'fit-warning' });
      banner.innerHTML =
        '<div class="fit-warning__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><div class="fit-warning__content"></div>';
      const content = banner.querySelector('.fit-warning__content');
      content.appendChild(DOM.el('strong', { text: 'قبل از اجرای برازش، موارد زیر را برطرف کنید:' }));
      const ul = DOM.el('ul', { class: 'fit-warning__list' });
      validation.issues.forEach((iss) => ul.appendChild(DOM.el('li', { text: iss })));
      content.appendChild(ul);
      container.appendChild(banner);
    }

    // Sticky actions bar
    const actions = DOM.el('div', { class: 'fit-preview__actions' });
    const summary = DOM.el('div', { class: 'fit-preview__summary' });
    const def = App.getFitDefinition(State.getFitConfig().type);
    summary.innerHTML = `نوع: <strong>${DOM.escapeHTML(def ? def.name : '—')}</strong>`;
    actions.appendChild(summary);

    const runBtn = DOM.el('button', {
      type: 'button',
      class: 'btn btn--primary'
    });
    runBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> اجرای برازش';
    runBtn.addEventListener('click', runFit);
    if (!validation.ok) runBtn.disabled = true;
    actions.appendChild(runBtn);
    container.appendChild(actions);

    // Chart card
    const card = DOM.el('div', { class: 'chart-card' });
    const cardHeader = DOM.el('div', { class: 'chart-card__header' });
    cardHeader.appendChild(
      DOM.el('div', { class: 'chart-card__title', text: 'پیش‌نمایش نمودار' })
    );
    const toolbar = DOM.el('div', { class: 'chart-card__toolbar' });
    const dlBtn = DOM.el('button', {
      type: 'button',
      class: 'chart-toolbar-btn',
      'data-tooltip': 'دانلود تصویر'
    });
    dlBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    dlBtn.addEventListener('click', () => {
      App.PlotService.exportChartPNG(previewChartId, 'fit-preview.png');
    });
    toolbar.appendChild(dlBtn);
    cardHeader.appendChild(toolbar);
    card.appendChild(cardHeader);

    const body = DOM.el('div', { class: 'chart-card__body' });
    const wrapper = DOM.el('div', { class: 'chart-canvas-wrapper' });
    const canvas = DOM.el('canvas', { id: previewChartId });
    wrapper.appendChild(canvas);
    body.appendChild(wrapper);
    card.appendChild(body);

    container.appendChild(card);
    return container;
  }

  /* ---------- Preview chart ---------- */

  function refreshPreviewChart() {
    const cfg = State.getFitConfig();
    const validation = App.FitService.validateConfig();
    if (!validation.ok) {
      currentPreview = null;
      const canvas = document.getElementById(previewChartId);
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    const extracted = App.FitService.extractData();
    if (!extracted.valid || extracted.xs.length < 2) {
      currentPreview = null;
      return;
    }

    const def = validation.def;
    const options = buildLocalOptions(cfg, def);

    try {
      const raw = App.Math.runFit(cfg.type, extracted.xs, extracted.ys, options);
      const enriched = App.FitService.enrich(raw, cfg, validation, extracted);
      currentPreview = enriched;
      App.PlotService.renderFitPreview(previewChartId, enriched);
    } catch (err) {
      currentPreview = null;
    }
  }

  function buildLocalOptions(cfg, def) {
    const p = cfg.params || {};
    const opts = {};
    switch (cfg.type) {
      case 'linear':
      case 'logarithmic':
        opts.fixedIntercept = cfg.interceptFixed ? cfg.interceptValue : undefined;
        break;
      case 'polynomial':
        opts.order = Math.round(p.order || C.DEFAULTS.DEFAULT_POLY_ORDER);
        opts.fixedIntercept = cfg.interceptFixed ? cfg.interceptValue : undefined;
        break;
      case 'moving-average':
        opts.window = Math.round(p.window || C.DEFAULTS.DEFAULT_MA_WINDOW);
        break;
    }
    return opts;
  }

  /* ---------- Run fit ---------- */

  function runFit() {
    const res = App.FitService.run();
    if (res.ok) {
      App.Toast.success('برازش انجام شد', 'در حال نمایش نتایج…');
      if (typeof App.switchTab === 'function') App.switchTab('results');
    } else {
      App.Toast.error('خطا در برازش', res.error || '');
    }
  }

  App.PageFitting = {
    mount,
    refreshPreviewChart,
    runFit
  };
})(window);