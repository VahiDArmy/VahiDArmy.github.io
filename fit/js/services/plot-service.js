/* ==========================================================================
   Service — Plot
   Thin wrapper around Chart.js with theme-consistent defaults.
   Manages chart lifecycle so callers don't have to.
   ========================================================================== */

(function (window) {
  'use strict';

  const App = (window.App = window.App || {});

  /* ---------- Registry so we can destroy old charts ---------- */

  const instances = new Map();

  /* ---------- Read theme tokens ---------- */

  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function getTheme() {
    return {
      fg1: cssVar('--fg-1', '#eef2fa'),
      fg2: cssVar('--fg-2', '#b8c1d9'),
      fg3: cssVar('--fg-3', '#808ba8'),
      grid: cssVar('--chart-grid', 'rgba(255,255,255,0.06)'),
      axis: cssVar('--chart-axis', '#808ba8'),
      chart1: cssVar('--chart-1', '#6366f1'),
      chart2: cssVar('--chart-2', '#06b6d4'),
      chart3: cssVar('--chart-3', '#8b5cf6'),
      chart4: cssVar('--chart-4', '#10b981'),
      chart5: cssVar('--chart-5', '#f59e0b'),
      chart6: cssVar('--chart-6', '#ef4444')
    };
  }

  function fontFamily() {
    return cssVar('--font-sans', 'Vazirmatn, sans-serif');
  }

  /* ---------- Global defaults ---------- */

  function applyDefaults() {
    if (!window.Chart) return;
    const t = getTheme();
    window.Chart.defaults.font.family = fontFamily();
    window.Chart.defaults.font.size = 11;
    window.Chart.defaults.color = t.fg2;
    window.Chart.defaults.borderColor = t.grid;
    window.Chart.defaults.animation = App.State.getSettings().animateUi
      ? { duration: 400, easing: 'easeOutQuart' }
      : false;
    window.Chart.defaults.plugins.legend.display = false;
    window.Chart.defaults.plugins.tooltip.backgroundColor = '#1e2941';
    window.Chart.defaults.plugins.tooltip.titleColor = t.fg1;
    window.Chart.defaults.plugins.tooltip.bodyColor = t.fg2;
    window.Chart.defaults.plugins.tooltip.borderColor = '#2a3450';
    window.Chart.defaults.plugins.tooltip.borderWidth = 1;
    window.Chart.defaults.plugins.tooltip.padding = 10;
    window.Chart.defaults.plugins.tooltip.cornerRadius = 8;
    window.Chart.defaults.plugins.tooltip.displayColors = true;
    window.Chart.defaults.plugins.tooltip.rtl = true;
    window.Chart.defaults.plugins.tooltip.textDirection = 'rtl';
  }

  /* ---------- Destroy helper ---------- */

  function destroy(canvasId) {
    const existing = instances.get(canvasId);
    if (existing) {
      try {
        existing.destroy();
      } catch (e) {
        /* noop */
      }
      instances.delete(canvasId);
    }
  }

  function destroyAll() {
    instances.forEach((chart) => {
      try {
        chart.destroy();
      } catch (e) {
        /* noop */
      }
    });
    instances.clear();
  }

  /* ---------- Common axes config ---------- */

  function axisConfig(titleText) {
    const t = getTheme();
    return {
      grid: {
        color: t.grid,
        drawBorder: false,
        lineWidth: 1
      },
      ticks: {
        color: t.fg3,
        font: { size: 10 },
        callback: function (value) {
          return App.Format.toPersian(
            typeof value === 'number' ? String(parseFloat(value.toPrecision(6))) : String(value)
          );
        }
      },
      title: titleText
        ? {
            display: true,
            text: titleText,
            color: t.fg2,
            font: { size: 11, weight: '600' },
            padding: { top: 6, bottom: 0 }
          }
        : { display: false }
    };
  }

  /* ---------- Scatter dataset for raw points ---------- */

  function rawPointsDataset(xs, ys, label) {
    const t = getTheme();
    return {
      label: label || 'نقاط داده',
      data: xs.map((x, i) => ({ x, y: ys[i] })),
      backgroundColor: t.chart2,
      borderColor: t.chart2,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: t.chart2,
      pointBorderColor: '#0b0f19',
      pointBorderWidth: 1.5,
      showLine: false,
      order: 2
    };
  }

  function curveDataset(points, label, color) {
    const t = getTheme();
    return {
      label: label || 'منحنی برازش',
      data: points,
      borderColor: color || t.chart1,
      backgroundColor: 'transparent',
      borderWidth: 2.5,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.1,
      showLine: true,
      fill: false,
      order: 1
    };
  }

  /* ---------- Fit preview chart ---------- */

  function renderFitPreview(canvasId, result) {
    if (!window.Chart) return null;
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    applyDefaults();
    const t = getTheme();
    const datasets = [
      rawPointsDataset(result.xs, result.ys, 'داده‌های اصلی'),
      curveDataset(result.curvePoints, `برازش ${result.fitTypeName}`, t.chart1)
    ];

    const chart = new window.Chart(canvas, {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'nearest',
          intersect: false
        },
        scales: {
          x: axisConfig(result.xColName),
          y: axisConfig(result.yColName)
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: t.fg2,
              usePointStyle: true,
              boxWidth: 8,
              padding: 12,
              font: { size: 11 }
            }
          },
          tooltip: {
            rtl: true,
            callbacks: {
              label: (ctx) => {
                const x = App.Format.formatNumber(ctx.parsed.x, {
                  decimals: 4
                });
                const y = App.Format.formatNumber(ctx.parsed.y, {
                  decimals: 4
                });
                return `${ctx.dataset.label}: x = ${x}, y = ${y}`;
              }
            }
          }
        }
      }
    });

    instances.set(canvasId, chart);
    return chart;
  }

  /* ---------- Residual chart ---------- */

  function renderResiduals(canvasId, result) {
    if (!window.Chart) return null;
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    applyDefaults();
    const t = getTheme();

    const chart = new window.Chart(canvas, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'باقی‌مانده‌ها',
            data: result.residualPoints,
            backgroundColor: t.chart6,
            borderColor: t.chart6,
            pointRadius: 4,
            pointHoverRadius: 6,
            showLine: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: axisConfig(result.xColName),
          y: axisConfig('باقی‌مانده')
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `x = ${App.Format.formatNumber(ctx.parsed.x, { decimals: 3 })}, باقی‌مانده = ${App.Format.formatNumber(ctx.parsed.y, { decimals: 4 })}`
            }
          }
        }
      }
    });
    instances.set(canvasId, chart);
    return chart;
  }

  /* ---------- Comparison bar chart ---------- */

  function renderComparison(canvasId, comparison) {
    if (!window.Chart) return null;
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    applyDefaults();
    const t = getTheme();

    const ok = comparison.filter((c) => c.ok);
    const labels = ok.map((c) => c.name);
    const r2Values = ok.map((c) => Math.max(0, c.r2));

    const chart = new window.Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'R²',
            data: r2Values,
            backgroundColor: ok.map((c, i) => {
              if (c.type === 'moving-average') return t.chart6;
              const colors = [t.chart1, t.chart2, t.chart3, t.chart4, t.chart5];
              return colors[i % colors.length];
            }),
            borderRadius: 6,
            borderSkipped: false,
            maxBarThickness: 42
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            min: 0,
            max: 1,
            grid: { color: t.grid },
            ticks: {
              color: t.fg3,
              callback: (v) => App.Format.toPersian(v.toFixed(2))
            }
          },
          y: {
            grid: { display: false },
            ticks: { color: t.fg2, font: { size: 11 } }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `R² = ${App.Format.formatFixed(ctx.parsed.x, 4)}`
            }
          }
        }
      }
    });
    instances.set(canvasId, chart);
    return chart;
  }

  /* ---------- Data preview scatter ---------- */

  function renderDataPreview(canvasId, xs, ys, xName, yName) {
    if (!window.Chart) return null;
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    applyDefaults();
    const t = getTheme();

    const chart = new window.Chart(canvas, {
      type: 'scatter',
      data: {
        datasets: [rawPointsDataset(xs, ys, 'نقاط داده')]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: axisConfig(xName),
          y: axisConfig(yName)
        },
        plugins: { legend: { display: false } }
      }
    });
    instances.set(canvasId, chart);
    return chart;
  }

  /* ---------- Export chart to PNG ---------- */

  function exportChartPNG(canvasId, filename) {
    const chart = instances.get(canvasId);
    if (!chart) return false;
    const canvas = chart.canvas;
    // Draw a dark background before export
    const tmp = document.createElement('canvas');
    tmp.width = canvas.width;
    tmp.height = canvas.height;
    const ctx = tmp.getContext('2d');
    ctx.fillStyle = cssVar('--bg-3', '#172033');
    ctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.drawImage(canvas, 0, 0);
    tmp.toBlob((blob) => {
      if (blob) App.DOM.downloadBlob(blob, filename || 'chart.png');
    });
    return true;
  }

  App.PlotService = {
    applyDefaults,
    destroy,
    destroyAll,
    renderFitPreview,
    renderResiduals,
    renderComparison,
    renderDataPreview,
    exportChartPNG,
    getTheme
  };
})(window);