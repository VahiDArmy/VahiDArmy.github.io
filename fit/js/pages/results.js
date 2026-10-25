/* ==========================================================================
   Page — Results
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
  let comparisonCache = null;

  const CHART_IDS = {
    fit: 'results-fit-canvas',
    residuals: 'results-residual-canvas',
    comparison: 'results-comparison-canvas'
  };

  /* ---------- Mount ---------- */

  function mount() {
    if (mounted) return;
    mounted = true;
    layoutEl = document.getElementById('results-layout');
    if (!layoutEl) return;

    // Header export button
    const exportBtn = document.querySelector('[data-action="export-results"]');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const res = App.ExportService.exportReport();
        if (res.ok) App.Toast.success('خروجی گرفته شد', res.filename);
        else App.Toast.error('خطا', res.error || '');
      });
    }

    Events.on(C.EVENTS.FIT_COMPLETE, () => {
      comparisonCache = null;
      render();
    });
    Events.on(C.EVENTS.DATA_CHANGED, () => {
      comparisonCache = null;
    });
    Events.on(C.EVENTS.SETTINGS_CHANGED, () => {
      // Re-render numbers
      render();
    });

    render();
  }

  /* ---------- Render ---------- */

  function render() {
    if (!layoutEl) return;
    DOM.empty(layoutEl);

    const result = State.getFitResult();
    if (!result) {
      layoutEl.appendChild(buildEmptyState());
      return;
    }

    layoutEl.appendChild(buildSummaryStrip(result));
    layoutEl.appendChild(buildEquationCard(result));
    layoutEl.appendChild(buildFitChartCard(result));
    if (State.getSettings().includeResidualPlot) {
      layoutEl.appendChild(buildResidualCard(result));
    }
    layoutEl.appendChild(buildComparisonCard());
    layoutEl.appendChild(buildPredictCard(result));
    layoutEl.appendChild(buildExportCard());

    // Render charts after DOM is painted
    setTimeout(() => renderCharts(result), 40);
  }

  function buildEmptyState() {
    const wrap = DOM.el('div', { class: 'results-empty' });
    const state = DOM.el('div', { class: 'empty-state' });
    state.innerHTML = `
      <div class="empty-state__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 3v18h18"/>
          <path d="M7 14l4-4 3 3 5-6"/>
        </svg>
      </div>
      <div class="empty-state__title">هنوز برازشی اجرا نشده است</div>
      <div class="empty-state__description">برای مشاهدهٔ نتایج، به تب «برازش» بروید، تنظیمات را انجام دهید و دکمهٔ «اجرای برازش» را بزنید.</div>
    `;
    const actions = DOM.el('div', { class: 'empty-state__actions' });
    const goBtn = DOM.el('button', {
      type: 'button',
      class: 'btn btn--primary',
      text: 'رفتن به برازش'
    });
    goBtn.addEventListener('click', () => {
      if (typeof App.switchTab === 'function') App.switchTab('fitting');
    });
    actions.appendChild(goBtn);
    state.appendChild(actions);
    wrap.appendChild(state);
    return wrap;
  }

  /* ---------- Summary strip ---------- */

  function buildSummaryStrip(result) {
    const grid = DOM.el('div', { class: 'results-summary' });
    const m = result.metrics;
    const quality = App.FitService.classifyR2(m.r2);

    grid.appendChild(summaryCard('نوع برازش', result.fitTypeName, true));
    grid.appendChild(summaryCard('R²', Format.formatFixed(m.r2, 4), true, quality.cls));
    grid.appendChild(summaryCard('RMSE', Format.formatFixed(m.rmse, 4)));
    grid.appendChild(summaryCard('MAE', Format.formatFixed(m.mae, 4)));
    grid.appendChild(summaryCard('تعداد نقاط', Format.toPersian(String(m.n))));

    return grid;
  }

  function summaryCard(label, value, accent, cls) {
    const card = DOM.el('div', {
      class: 'stat-card' + (accent ? ' stat-card--accent' : '')
    });
    card.appendChild(DOM.el('div', { class: 'stat-card__label', text: label }));
    const valWrap = DOM.el('div', { class: 'stat-card__value' });
    if (cls) {
      const pill = DOM.el('span', {
        class: 'quality-pill ' + cls,
        text: value
      });
      valWrap.appendChild(pill);
    } else {
      valWrap.textContent = value;
    }
    card.appendChild(valWrap);
    return card;
  }

  /* ---------- Equation ---------- */

  function buildEquationCard(result) {
    const card = DOM.el('div', { class: 'equation-card' });

    const label = DOM.el('div', { class: 'equation-card__label' });
    label.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h6l4 16h6"/></svg>';
    label.appendChild(document.createTextNode(' معادلهٔ برازش'));
    card.appendChild(label);

    const formula = DOM.el('div', { class: 'equation-card__formula' });
    formula.innerHTML = highlightEquation(result.equation || '—');
    card.appendChild(formula);

    const copyBtn = DOM.el('button', {
      type: 'button',
      class: 'btn btn--ghost btn--sm equation-card__copy',
      text: 'کپی معادله'
    });
    copyBtn.addEventListener('click', () => {
      const text = result.equation || '';
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          App.Toast.success('کپی شد', '');
        }).catch(() => {});
      }
    });
    card.appendChild(copyBtn);

    return card;
  }

  function highlightEquation(eq) {
    // Simple highlight: numbers -> warning color, operators -> muted, rest -> default
    return DOM.escapeHTML(eq)
      .replace(/([0-9]+(?:\.[0-9]+)?(?:e[-+]?[0-9]+)?)/gi, '<span class="eq-num">$1</span>')
      .replace(/([+\-−·×*/^()])/g, '<span class="eq-op">$1</span>')
      .replace(/\b([xy])\b/g, '<span class="eq-var">$1</span>');
  }

  /* ---------- Charts ---------- */

  function buildFitChartCard(result) {
    const card = DOM.el('div', { class: 'chart-card' });
    const header = DOM.el('div', { class: 'chart-card__header' });
    header.appendChild(
      DOM.el('div', { class: 'chart-card__title', text: 'نمودار برازش' })
    );
    const toolbar = DOM.el('div', { class: 'chart-card__toolbar' });
    const dlBtn = DOM.el('button', { type: 'button', class: 'chart-toolbar-btn', 'data-tooltip': 'دانلود' });
    dlBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    dlBtn.addEventListener('click', () =>
      App.PlotService.exportChartPNG(CHART_IDS.fit, 'fit.png')
    );
    toolbar.appendChild(dlBtn);
    header.appendChild(toolbar);
    card.appendChild(header);

    const body = DOM.el('div', { class: 'chart-card__body' });
    const wrapper = DOM.el('div', { class: 'chart-canvas-wrapper' });
    const canvas = DOM.el('canvas', { id: CHART_IDS.fit });
    wrapper.appendChild(canvas);
    body.appendChild(wrapper);
    card.appendChild(body);
    return card;
  }

  function buildResidualCard(result) {
    const card = DOM.el('div', { class: 'chart-card' });
    const header = DOM.el('div', { class: 'chart-card__header' });
    header.appendChild(
      DOM.el('div', { class: 'chart-card__title', text: 'نمودار باقی‌مانده‌ها' })
    );
    card.appendChild(header);

    const body = DOM.el('div', { class: 'chart-card__body' });
    const wrapper = DOM.el('div', { class: 'chart-canvas-wrapper' });
    const canvas = DOM.el('canvas', { id: CHART_IDS.residuals });
    wrapper.appendChild(canvas);
    body.appendChild(wrapper);
    card.appendChild(body);

    const note = DOM.el('div', {
      class: 'residual-note',
      text: 'باقی‌مانده = مقدار واقعی − مقدار پیش‌بینی‌شده. پراکندگی تصادفی حول صفر نشانهٔ برازش خوب است.'
    });
    card.appendChild(note);
    return card;
  }

  function buildComparisonCard() {
    const card = DOM.el('div', { class: 'card comparison-card' });
    const header = DOM.el('div', { class: 'card__header' });
    const headerText = DOM.el('div', { class: 'card__header-content' });
    headerText.appendChild(
      DOM.el('div', { class: 'card__title', text: 'مقایسهٔ انواع برازش' })
    );
    headerText.appendChild(
      DOM.el('div', {
        class: 'card__subtitle',
        text: 'همهٔ انواع برازش روی همین داده‌ها اجرا و بر اساس R² مقایسه شده‌اند'
      })
    );
    header.appendChild(headerText);
    card.appendChild(header);

    const body = DOM.el('div', { class: 'card__body' });
    const comparison = getComparison();

    // Chart
    const chartCard = DOM.el('div', { class: 'chart-card' });
    const chartBody = DOM.el('div', { class: 'chart-card__body' });
    const wrapper = DOM.el('div', { class: 'chart-canvas-wrapper', style: { minHeight: '220px' } });
    const canvas = DOM.el('canvas', { id: CHART_IDS.comparison });
    wrapper.appendChild(canvas);
    chartBody.appendChild(wrapper);
    chartCard.appendChild(chartBody);
    body.appendChild(chartCard);

    // Table
    const tableWrap = DOM.el('div', { class: 'comparison-table-wrap' });
    const table = DOM.el('table', { class: 'comparison-table' });
    const thead = DOM.el('thead');
    const headRow = DOM.el('tr');
    ['نوع', 'R²', 'R² تعدیل‌شده', 'RMSE', 'MAE', 'وضعیت'].forEach((h) => {
      headRow.appendChild(DOM.el('th', { text: h }));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = DOM.el('tbody');
    const currentType = State.getFitConfig().type;
    const bestType = comparison.length && comparison[0].ok ? comparison[0].type : null;

    comparison.forEach((c) => {
      const tr = DOM.el('tr');
      if (c.type === currentType) tr.classList.add('is-active');
      if (c.type === bestType) tr.classList.add('is-best');

      const td1 = DOM.el('td');
      const typeWrap = DOM.el('div', { class: 'comparison-table__type' });
      const badge = DOM.el('span', {
        class: 'badge badge--sm ' + App.getFitBadgeClass(c.type),
        text: c.name
      });
      typeWrap.appendChild(badge);
      if (c.type === bestType) {
        const star = DOM.el('span', { class: 'badge badge--sm badge--success', text: 'بهترین' });
        typeWrap.appendChild(star);
      }
      td1.appendChild(typeWrap);
      tr.appendChild(td1);

      if (c.ok) {
        tr.appendChild(DOM.el('td', { class: 'num', text: Format.formatFixed(c.r2, 4) }));
        tr.appendChild(DOM.el('td', { class: 'num', text: Format.formatFixed(c.adjR2, 4) }));
        tr.appendChild(DOM.el('td', { class: 'num', text: Format.formatFixed(c.rmse, 4) }));
        tr.appendChild(DOM.el('td', { class: 'num', text: Format.formatFixed(c.mae, 4) }));
        tr.appendChild(DOM.el('td', { text: 'موفق' }));
      } else {
        tr.appendChild(DOM.el('td', { text: '—' }));
        tr.appendChild(DOM.el('td', { text: '—' }));
        tr.appendChild(DOM.el('td', { text: '—' }));
        tr.appendChild(DOM.el('td', { text: '—' }));
        tr.appendChild(DOM.el('td', { class: 'text-danger', text: c.error || 'خطا' }));
      }

      tr.addEventListener('click', () => {
        // Switch current fit to this type
        if (c.type !== currentType && c.ok) {
          State.setFitType(c.type);
          App.Toast.info('نوع برازش تغییر کرد', `به «${c.name}» تغییر یافت.`);
          if (typeof App.switchTab === 'function') App.switchTab('fitting');
        }
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    body.appendChild(tableWrap);
    card.appendChild(body);

    return card;
  }

  function getComparison() {
    if (comparisonCache) return comparisonCache;
    comparisonCache = App.FitService.compareAll();
    return comparisonCache;
  }

  function renderCharts(result) {
    try {
      App.PlotService.renderFitPreview(CHART_IDS.fit, result);
      if (State.getSettings().includeResidualPlot) {
        App.PlotService.renderResiduals(CHART_IDS.residuals, result);
      }
      const comparison = getComparison();
      if (comparison.length) {
        App.PlotService.renderComparison(CHART_IDS.comparison, comparison);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[Results] chart render failed:', err);
    }
  }

  /* ---------- Predict ---------- */

  function buildPredictCard(result) {
    const card = DOM.el('div', { class: 'card predict-card' });
    const header = DOM.el('div', { class: 'card__header' });
    const headerText = DOM.el('div', { class: 'card__header-content' });
    headerText.appendChild(
      DOM.el('div', { class: 'card__title', text: 'پیش‌بینی مقدار' })
    );
    headerText.appendChild(
      DOM.el('div', {
        class: 'card__subtitle',
        text: `با استفاده از معادلهٔ برازش، y را برای هر x دلخواه حساب کنید`
      })
    );
    header.appendChild(headerText);
    card.appendChild(header);

    const body = DOM.el('div', { class: 'card__body' });
    const inputRow = DOM.el('div', { class: 'predict-input-row' });
    const input = DOM.el('input', {
      type: 'number',
      class: 'input',
      placeholder: 'مقدار x را وارد کنید…',
      step: 'any'
    });
    const btn = DOM.el('button', {
      type: 'button',
      class: 'btn btn--primary',
      text: 'محاسبه'
    });

    const resultBox = DOM.el('div', { class: 'predict-result is-empty' });
    resultBox.appendChild(
      DOM.el('div', {
        class: 'predict-result__label',
        text: 'مقدار پیش‌بینی‌شده y:'
      })
    );
    resultBox.appendChild(
      DOM.el('div', {
        class: 'predict-result__value',
        text: '—'
      })
    );

    const doPredict = () => {
      const x = parseFloat(input.value);
      if (!isFinite(x)) {
        App.Toast.warning('ورودی نامعتبر', 'لطفاً یک عدد وارد کنید.');
        return;
      }
      const y = App.DataService.predict(x);
      const valEl = resultBox.querySelector('.predict-result__value');
      if (y == null) {
        resultBox.classList.add('is-empty');
        valEl.textContent = '—';
        App.Toast.warning('پیش‌بینی ناممکن', 'این نوع برازش از پیش‌بینی پشتیبانی نمی‌کند.');
      } else {
        resultBox.classList.remove('is-empty');
        valEl.textContent = Format.formatNumber(y, { decimals: 6 });
      }
    };

    btn.addEventListener('click', doPredict);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doPredict();
    });

    inputRow.appendChild(input);
    inputRow.appendChild(btn);
    body.appendChild(inputRow);
    body.appendChild(resultBox);
    card.appendChild(body);
    return card;
  }

  /* ---------- Export card ---------- */

  function buildExportCard() {
    const card = DOM.el('div', { class: 'card' });
    const header = DOM.el('div', { class: 'card__header' });
    const headerText = DOM.el('div', { class: 'card__header-content' });
    headerText.appendChild(
      DOM.el('div', { class: 'card__title', text: 'خروجی گرفتن' })
    );
    headerText.appendChild(
      DOM.el('div', {
        class: 'card__subtitle',
        text: 'نتایج را در قالب‌های مختلف ذخیره کنید'
      })
    );
    header.appendChild(headerText);
    card.appendChild(header);

    const body = DOM.el('div', { class: 'card__body' });
    const grid = DOM.el('div', { class: 'export-grid' });

    grid.appendChild(
      exportOption(
        'گزارش کامل (Excel)',
        'شامل داده‌ها، نتیجهٔ برازش، پارامترها و مقایسه',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
        () => {
          const res = App.ExportService.exportReport();
          if (res.ok) App.Toast.success('گزارش ساخته شد', res.filename);
          else App.Toast.error('خطا', res.error || '');
        }
      )
    );

    grid.appendChild(
      exportOption(
        'فقط نتیجهٔ برازش (Excel)',
        'داده + برگهٔ نتیجهٔ برازش',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>',
        () => {
          const res = App.ExportService.exportFit();
          if (res.ok) App.Toast.success('ساخته شد', res.filename);
          else App.Toast.error('خطا', res.error || '');
        }
      )
    );

    grid.appendChild(
      exportOption(
        'داده‌های خام (CSV)',
        'داده‌های جدول فعلی با ستون x و y',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
        () => {
          const res = App.ExportService.exportFitCSV();
          if (res.ok) App.Toast.success('CSV ساخته شد', res.filename);
          else App.Toast.error('خطا', res.error || '');
        }
      )
    );

    body.appendChild(grid);
    card.appendChild(body);
    return card;
  }

  function exportOption(title, desc, iconSvg, onClick) {
    const btn = DOM.el('button', { type: 'button', class: 'export-option' });
    const iconWrap = DOM.el('div', { class: 'export-option__icon' });
    iconWrap.innerHTML = iconSvg;
    btn.appendChild(iconWrap);
    const textWrap = DOM.el('div', { class: 'export-option__text' });
    textWrap.appendChild(DOM.el('div', { class: 'export-option__title', text: title }));
    textWrap.appendChild(DOM.el('div', { class: 'export-option__desc', text: desc }));
    btn.appendChild(textWrap);
    btn.addEventListener('click', onClick);
    return btn;
  }

  App.PageResults = { mount };
})(window);