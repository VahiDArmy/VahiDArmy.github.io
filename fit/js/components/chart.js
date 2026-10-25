/* ==========================================================================
   Component — Chart Card
   Builds a chart card shell around a canvas + toolbar, then delegates to
   App.PlotService for the actual chart.
   ========================================================================== */

(function (window) {
  'use strict';

  const App = (window.App = window.App || {});
  const DOM = App.DOM;

  const TOOLBAR_ICONS = {
    download:
      '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    refresh:
      '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>',
    maximize:
      '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>'
  };

  /**
   * Build the DOM shell of a chart card. Returns references so caller
   * can fill it in with data.
   */
  function createShell(opts) {
    const card = DOM.el('div', { class: 'chart-card' });

    const header = DOM.el('div', { class: 'chart-card__header' });
    header.appendChild(
      DOM.el('div', { class: 'chart-card__title', text: opts.title || '' })
    );

    const toolbar = DOM.el('div', { class: 'chart-card__toolbar' });
    if (opts.onDownload !== false) {
      const dl = DOM.el('button', {
        type: 'button',
        class: 'chart-toolbar-btn',
        'data-tooltip': 'دانلود تصویر',
        'data-tooltip-placement': 'bottom'
      });
      dl.innerHTML = TOOLBAR_ICONS.download;
      dl.addEventListener('click', () => {
        if (typeof opts.onDownload === 'function') opts.onDownload();
        else App.PlotService.exportChartPNG(opts.canvasId, (opts.filename || 'chart') + '.png');
      });
      toolbar.appendChild(dl);
    }
    if (opts.onRefresh) {
      const rf = DOM.el('button', {
        type: 'button',
        class: 'chart-toolbar-btn',
        'data-tooltip': 'به‌روزرسانی',
        'data-tooltip-placement': 'bottom'
      });
      rf.innerHTML = TOOLBAR_ICONS.refresh;
      rf.addEventListener('click', opts.onRefresh);
      toolbar.appendChild(rf);
    }
    header.appendChild(toolbar);
    card.appendChild(header);

    const body = DOM.el('div', { class: 'chart-card__body' });
    const wrapper = DOM.el('div', { class: 'chart-canvas-wrapper' });
    const canvas = DOM.el('canvas', { id: opts.canvasId });
    wrapper.appendChild(canvas);
    body.appendChild(wrapper);
    card.appendChild(body);

    return { card, header, toolbar, body, wrapper, canvas };
  }

  /**
   * Build a full chart card that renders immediately.
   * opts: { title, canvasId, renderer: 'fit'|'residual'|'comparison'|'data',
   *         data, filename, onDownload, onRefresh, legend: [{label, color}] }
   */
  function build(opts) {
    const shell = createShell(opts);

    // Legend
    if (Array.isArray(opts.legend) && opts.legend.length) {
      const legend = DOM.el('div', { class: 'chart-legend' });
      opts.legend.forEach((item) => {
        const row = DOM.el('div', { class: 'chart-legend__item' });
        const swatch = DOM.el('div', {
          class: 'chart-legend__swatch',
          style: { background: item.color }
        });
        row.appendChild(swatch);
        row.appendChild(DOM.el('span', { text: item.label }));
        legend.appendChild(row);
      });
      shell.card.appendChild(legend);
    }

    // Render on next frame so the canvas has dimensions
    setTimeout(() => {
      render(opts);
    }, 0);

    return {
      el: shell.card,
      canvas: shell.canvas,
      refresh: () => render(opts),
      update: (newOpts) => {
        Object.assign(opts, newOpts);
        render(opts);
      }
    };
  }

  function render(opts) {
    if (!opts || !opts.canvasId) return;
    switch (opts.renderer) {
      case 'fit':
        App.PlotService.renderFitPreview(opts.canvasId, opts.data);
        break;
      case 'residual':
        App.PlotService.renderResiduals(opts.canvasId, opts.data);
        break;
      case 'comparison':
        App.PlotService.renderComparison(opts.canvasId, opts.data);
        break;
      case 'data':
        App.PlotService.renderDataPreview(
          opts.canvasId,
          opts.data.xs,
          opts.data.ys,
          opts.data.xName,
          opts.data.yName
        );
        break;
    }
  }

  /**
   * Build an empty-state chart card.
   */
  function buildEmpty(opts) {
    opts = opts || {};
    const card = DOM.el('div', { class: 'chart-card' });
    const header = DOM.el('div', { class: 'chart-card__header' });
    header.appendChild(
      DOM.el('div', { class: 'chart-card__title', text: opts.title || '' })
    );
    card.appendChild(header);
    const body = DOM.el('div', { class: 'chart-card__body' });
    const placeholder = DOM.el('div', { class: 'chart-placeholder' });
    placeholder.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>';
    placeholder.appendChild(
      DOM.el('div', {
        class: 'text-sm text-muted',
        text: opts.message || 'داده‌ای برای نمایش وجود ندارد'
      })
    );
    body.appendChild(placeholder);
    card.appendChild(body);
    return card;
  }

  /**
   * Show a loading overlay on top of a chart body.
   */
  function showLoading(container) {
    if (!container) return null;
    const loader = DOM.el('div', { class: 'chart-loading' });
    loader.appendChild(DOM.el('div', { class: 'chart-loading__spinner' }));
    container.appendChild(loader);
    return () => DOM.remove(loader);
  }

  App.Chart = {
    createShell,
    build,
    buildEmpty,
    showLoading
  };
})(window);