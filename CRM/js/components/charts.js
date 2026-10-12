/* ============================================================================
   CHART HELPERS (Chart.js wrappers + sparklines)
   ============================================================================ */

(function (window) {
  "use strict";

  const ENV = window.ENV || {};
  const COLORS = ENV.CHART_COLORS || [
    "#598eff", "#06b6d4", "#8b5cf6", "#22c55e",
    "#f59e0b", "#ef4444", "#ec4899", "#14b8a6",
  ];

  const instances = new Map();

  const defaults = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: "index",
    },
    plugins: {
      legend: {
        display: false,
        labels: {
          color: "#a4aec2",
          font: { family: "Vazirmatn", size: 12 },
          padding: 12,
          usePointStyle: true,
          pointStyle: "circle",
          boxWidth: 8,
          boxHeight: 8,
        },
      },
      tooltip: {
        backgroundColor: "rgba(20,26,40,.96)",
        borderColor: "rgba(255,255,255,.10)",
        borderWidth: 1,
        padding: 12,
        titleColor: "#e9edf5",
        bodyColor: "#a4aec2",
        titleFont: { family: "Vazirmatn", size: 12, weight: "600" },
        bodyFont: { family: "Vazirmatn", size: 12 },
        displayColors: true,
        boxPadding: 4,
        cornerRadius: 8,
        caretSize: 5,
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(255,255,255,.05)", drawBorder: false },
        ticks: {
          color: "#6d7788",
          font: { family: "Vazirmatn", size: 11 },
          maxRotation: 0,
        },
      },
      y: {
        grid: { color: "rgba(255,255,255,.05)", drawBorder: false },
        ticks: {
          color: "#6d7788",
          font: { family: "Vazirmatn", size: 11 },
        },
      },
    },
  };

  const Charts = {
    /* ---------- Line / Area ---------- */
    line(canvas, { labels = [], datasets = [], options = {} } = {}) {
      if (!canvas || !window.Chart) return null;
      this.destroy(canvas);
      const ctx = canvas.getContext("2d");
      const cfg = {
        type: "line",
        data: {
          labels,
          datasets: datasets.map((d, i) => ({
            label: d.label,
            data: d.data || [],
            borderColor: d.color || COLORS[i % COLORS.length],
            backgroundColor: d.fill
              ? this.gradient(ctx, canvas, d.color || COLORS[i % COLORS.length])
              : "transparent",
            borderWidth: 2,
            tension: 0.36,
            fill: !!d.fill,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: d.color || COLORS[i % COLORS.length],
            pointHoverBorderColor: "#fff",
            pointHoverBorderWidth: 2,
          })),
        },
        options: this.merge(defaults, options, {
          plugins: { ...defaults.plugins, ...(options.plugins || {}) },
          scales: { ...defaults.scales, ...(options.scales || {}) },
        }),
      };
      const chart = new window.Chart(ctx, cfg);
      instances.set(canvas, chart);
      return chart;
    },

    /* ---------- Bar ---------- */
    bar(canvas, { labels = [], datasets = [], options = {} } = {}) {
      if (!canvas || !window.Chart) return null;
      this.destroy(canvas);
      const ctx = canvas.getContext("2d");
      const cfg = {
        type: "bar",
        data: {
          labels,
          datasets: datasets.map((d, i) => ({
            label: d.label,
            data: d.data || [],
            backgroundColor: d.color || COLORS[i % COLORS.length],
            borderRadius: 6,
            borderSkipped: false,
            barPercentage: 0.72,
            categoryPercentage: 0.68,
          })),
        },
        options: this.merge(defaults, options, {
          plugins: { ...defaults.plugins, ...(options.plugins || {}) },
          scales: { ...defaults.scales, ...(options.scales || {}) },
        }),
      };
      const chart = new window.Chart(ctx, cfg);
      instances.set(canvas, chart);
      return chart;
    },

    /* ---------- Donut / Pie ---------- */
    donut(canvas, { labels = [], values = [], colors = null, options = {} } = {}) {
      if (!canvas || !window.Chart) return null;
      this.destroy(canvas);
      const ctx = canvas.getContext("2d");
      const cfg = {
        type: "doughnut",
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: colors || COLORS.slice(0, values.length),
            borderColor: "rgba(15,20,32,.9)",
            borderWidth: 2,
            hoverOffset: 6,
          }],
        },
        options: this.merge(defaults, options, {
          cutout: "68%",
          plugins: { ...defaults.plugins, ...(options.plugins || {}) },
          scales: {},
        }),
      };
      const chart = new window.Chart(ctx, cfg);
      instances.set(canvas, chart);
      return chart;
    },

    /* ---------- Sparkline ---------- */
    sparkline(canvas, data = [], color = COLORS[0]) {
      if (!canvas || !window.Chart) return null;
      this.destroy(canvas);
      const ctx = canvas.getContext("2d");
      const cfg = {
        type: "line",
        data: {
          labels: data.map((_, i) => i),
          datasets: [{
            data,
            borderColor: color,
            borderWidth: 1.6,
            tension: 0.4,
            fill: true,
            backgroundColor: this.gradient(ctx, canvas, color),
            pointRadius: 0,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: { x: { display: false }, y: { display: false } },
          elements: { line: { capBezierPoints: true } },
        },
      };
      const chart = new window.Chart(ctx, cfg);
      instances.set(canvas, chart);
      return chart;
    },

    /* ---------- Gradient helper ---------- */
    gradient(ctx, canvas, color) {
      const g = ctx.createLinearGradient(0, 0, 0, canvas.clientHeight || 260);
      const c = color || COLORS[0];
      g.addColorStop(0, this.hexA(c, 0.32));
      g.addColorStop(1, this.hexA(c, 0.00));
      return g;
    },

    hexA(hex, alpha) {
      if (!hex || hex[0] !== "#") return `rgba(89,142,255,${alpha})`;
      let h = hex.slice(1);
      if (h.length === 3) h = h.split("").map((c) => c + c).join("");
      const num = parseInt(h, 16);
      const r = (num >> 16) & 255;
      const g = (num >> 8) & 255;
      const b = num & 255;
      return `rgba(${r},${g},${b},${alpha})`;
    },

    /* ---------- Destroy ---------- */
    destroy(canvas) {
      if (!canvas) return;
      const inst = instances.get(canvas);
      if (inst) {
        try { inst.destroy(); } catch (_) {}
        instances.delete(canvas);
      }
    },

    destroyAll() {
      instances.forEach((chart) => {
        try { chart.destroy(); } catch (_) {}
      });
      instances.clear();
    },

    /* ---------- Deep merge (simple) ---------- */
    merge(...objects) {
      const out = {};
      objects.forEach((obj) => {
        if (!obj) return;
        Object.keys(obj).forEach((k) => {
          const v = obj[k];
          if (v && typeof v === "object" && !Array.isArray(v) && typeof out[k] === "object" && !Array.isArray(out[k])) {
            out[k] = this.merge(out[k], v);
          } else {
            out[k] = v;
          }
        });
      });
      return out;
    },

    /* ---------- Re-render on theme change ---------- */
    refreshTheme() {
      const styles = getComputedStyle(document.documentElement);
      const text = styles.getPropertyValue("--text-tertiary").trim();
      const grid = styles.getPropertyValue("--chart-grid").trim();
      instances.forEach((chart) => {
        try {
          if (chart.options.scales?.x?.ticks) chart.options.scales.x.ticks.color = text;
          if (chart.options.scales?.y?.ticks) chart.options.scales.y.ticks.color = text;
          if (chart.options.scales?.x?.grid) chart.options.scales.x.grid.color = grid;
          if (chart.options.scales?.y?.grid) chart.options.scales.y.grid.color = grid;
          chart.update("none");
        } catch (_) {}
      });
    },
  };

  window.Charts = Charts;
})(window);