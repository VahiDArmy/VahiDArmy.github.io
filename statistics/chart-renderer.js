/**
 * chart-renderer.js
 * Self-contained canvas 2D chart used to plot distribution curves,
 * histograms and discrete PMFs on a dark, instrument-panel-styled
 * background. No external charting library — full control over the
 * "signal on a scope" look and over hit-testing for the crosshair.
 *
 * Exposed on window.createChart(canvas, options) -> chart instance.
 */
(function (global) {
  'use strict';

  const COLORS = {
    grid: 'rgba(160, 184, 210, 0.10)',
    gridStrong: 'rgba(160, 184, 210, 0.20)',
    axisText: '#7C8AA0',
    axisTextStrong: '#B9C4D4',
    crosshair: 'rgba(233, 240, 248, 0.45)',
    histFill: 'rgba(90, 140, 255, 0.16)',
    histStroke: 'rgba(120, 160, 255, 0.55)'
  };

  // "Nice numbers" tick spacing (Heckbert). Returns an array of tick
  // values plus a suggested [min,max] that comfortably contains them.
  function niceNumber(range, round) {
    const exponent = Math.floor(Math.log10(range));
    const fraction = range / Math.pow(10, exponent);
    let niceFraction;
    if (round) {
      if (fraction < 1.5) niceFraction = 1;
      else if (fraction < 3) niceFraction = 2;
      else if (fraction < 7) niceFraction = 5;
      else niceFraction = 10;
    } else {
      if (fraction <= 1) niceFraction = 1;
      else if (fraction <= 2) niceFraction = 2;
      else if (fraction <= 5) niceFraction = 5;
      else niceFraction = 10;
    }
    return niceFraction * Math.pow(10, exponent);
  }

  function niceTicks(min, max, targetCount) {
    if (min === max) { min -= 1; max += 1; }
    const range = niceNumber(max - min, false);
    const step = niceNumber(range / (targetCount - 1), true);
    const niceMin = Math.floor(min / step) * step;
    const niceMax = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = niceMin; v <= niceMax + step * 0.5; v += step) {
      ticks.push(Math.round(v / step) * step);
    }
    return { min: niceMin, max: niceMax, step, ticks };
  }

  function formatNumber(v) {
    if (Math.abs(v) < 1e-9) return '0';
    const abs = Math.abs(v);
    if (abs >= 1000 || (abs < 0.001 && abs > 0)) return v.toExponential(1);
    if (Number.isInteger(v)) return String(v);
    const decimals = abs < 1 ? 3 : abs < 10 ? 2 : 1;
    return v.toFixed(decimals);
  }

  function createChart(canvas, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d');
    let cssW = 0, cssH = 0, dpr = Math.max(1, global.devicePixelRatio || 1);
    let config = null; // last render() config
    let padding = { top: 26, right: 22, bottom: 40, left: 60 };
    let plot = { x: 0, y: 0, w: 0, h: 0 };
    let xTicks = { min: 0, max: 1, ticks: [0, 1] };
    let yTicks = { min: 0, max: 1, ticks: [0, 1] };
    let hoverX = null;
    const tooltipEl = opts.tooltipEl || null;

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      cssW = Math.max(240, rect.width);
      cssH = Math.max(220, canvas.getAttribute('data-min-height') ? Number(canvas.getAttribute('data-min-height')) : rect.height || 360);
      dpr = Math.max(1, global.devicePixelRatio || 1);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (config) draw();
    }

    function xToPx(x) { return plot.x + ((x - xTicks.min) / (xTicks.max - xTicks.min)) * plot.w; }
    function yToPx(y) { return plot.y + plot.h - ((y - yTicks.min) / (yTicks.max - yTicks.min)) * plot.h; }
    function pxToX(px) { return xTicks.min + ((px - plot.x) / plot.w) * (xTicks.max - xTicks.min); }

    function computeYDomain(cfg) {
      let maxY = 0;
      if (cfg.histogram) cfg.histogram.bins.forEach(b => { if (b.density > maxY) maxY = b.density; });
      cfg.curves.forEach(curve => {
        if (curve.kind === 'stems') {
          curve.points.forEach(p => { if (p.y > maxY) maxY = p.y; });
        } else {
          const steps = 160;
          for (let i = 0; i <= steps; i++) {
            const x = xTicks.min + (i / steps) * (xTicks.max - xTicks.min);
            const y = curve.fn(x);
            if (Number.isFinite(y) && y > maxY) maxY = y;
          }
        }
      });
      if (maxY <= 0) maxY = 1;
      return [0, maxY * 1.12];
    }

    function draw() {
      const cfg = config;
      ctx.clearRect(0, 0, cssW, cssH);
      if (!cfg) return;

      plot = {
        x: padding.left,
        y: padding.top,
        w: cssW - padding.left - padding.right,
        h: cssH - padding.top - padding.bottom
      };

      const [xmin, xmax] = cfg.xDomain;
      xTicks = niceTicks(xmin, xmax, Math.max(4, Math.floor(plot.w / 90)));
      xTicks.min = xmin; xTicks.max = xmax; // keep requested domain, ticks stay "nice"

      const [ymin, ymax] = computeYDomain(cfg);
      yTicks = niceTicks(ymin, ymax, Math.max(4, Math.floor(plot.h / 56)));
      yTicks.min = ymin; yTicks.max = ymax;

      // grid
      ctx.save();
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillStyle = COLORS.axisText;

      yTicks.ticks.forEach(t => {
        if (t < yTicks.min || t > yTicks.max) return;
        const py = yToPx(t);
        ctx.beginPath();
        ctx.moveTo(plot.x, py);
        ctx.lineTo(plot.x + plot.w, py);
        ctx.strokeStyle = COLORS.grid;
        ctx.stroke();
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(formatNumber(t), plot.x - 10, py);
      });
      xTicks.ticks.forEach(t => {
        if (t < xTicks.min || t > xTicks.max) return;
        const px = xToPx(t);
        ctx.beginPath();
        ctx.moveTo(px, plot.y);
        ctx.lineTo(px, plot.y + plot.h);
        ctx.strokeStyle = COLORS.grid;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(formatNumber(t), px, plot.y + plot.h + 10);
      });

      // axes (strong baseline)
      ctx.strokeStyle = COLORS.gridStrong;
      ctx.lineWidth = 1.25;
      ctx.strokeRect(plot.x, plot.y, plot.w, plot.h);
      ctx.restore();

      // histogram
      if (cfg.histogram) {
        ctx.save();
        cfg.histogram.bins.forEach(b => {
          const x0 = xToPx(Math.max(b.x0, xTicks.min));
          const x1 = xToPx(Math.min(b.x1, xTicks.max));
          const y0 = yToPx(0);
          const y1 = yToPx(b.density);
          if (x1 <= plot.x || x0 >= plot.x + plot.w) return;
          ctx.fillStyle = COLORS.histFill;
          ctx.fillRect(x0, y1, Math.max(1, x1 - x0 - 1), y0 - y1);
          ctx.strokeStyle = COLORS.histStroke;
          ctx.lineWidth = 1;
          ctx.strokeRect(x0, y1, Math.max(1, x1 - x0 - 1), y0 - y1);
        });
        ctx.restore();
      }

      // curves
      cfg.curves.forEach(curve => {
        ctx.save();
        if (curve.kind === 'stems') {
          curve.points.forEach(p => {
            const px = xToPx(p.x), py = yToPx(p.y), pyBase = yToPx(0);
            if (px < plot.x - 1 || px > plot.x + plot.w + 1) return;
            ctx.strokeStyle = curve.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px, pyBase);
            ctx.lineTo(px, py);
            ctx.stroke();
            ctx.fillStyle = curve.color;
            ctx.beginPath();
            ctx.arc(px, py, 3.5, 0, Math.PI * 2);
            ctx.fill();
          });
        } else {
          const steps = Math.max(160, Math.floor(plot.w));
          ctx.beginPath();
          let started = false;
          for (let i = 0; i <= steps; i++) {
            const x = xTicks.min + (i / steps) * (xTicks.max - xTicks.min);
            const y = curve.fn(x);
            if (!Number.isFinite(y)) { started = false; continue; }
            const px = xToPx(x), py = yToPx(Math.min(y, yTicks.max));
            if (!started) { ctx.moveTo(px, py); started = true; }
            else ctx.lineTo(px, py);
          }
          ctx.lineWidth = curve.emphasis ? 2.4 : 1.8;
          ctx.strokeStyle = curve.color;
          if (curve.emphasis) {
            ctx.shadowColor = curve.color;
            ctx.shadowBlur = 10;
          }
          ctx.stroke();
        }
        ctx.restore();
      });

      // legend
      if (cfg.curves.length) {
        ctx.save();
        ctx.font = '12px Vazirmatn, sans-serif';
        let lx = plot.x + plot.w - 12;
        const ly = plot.y + 16;
        ctx.textBaseline = 'middle';
        // measure & draw right-to-left, entries stacked left from the right edge
        let cursorY = ly;
        [...cfg.curves].reverse().forEach(curve => {
          const label = curve.label;
          ctx.font = '12px Vazirmatn, sans-serif';
          const textW = ctx.measureText(label).width;
          const boxW = textW + 26;
          const bx = plot.x + plot.w - boxW - 8;
          ctx.fillStyle = 'rgba(10, 14, 20, 0.55)';
          ctx.fillRect(bx, cursorY - 10, boxW, 20);
          ctx.fillStyle = curve.color;
          ctx.beginPath();
          ctx.arc(bx + 10, cursorY, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = COLORS.axisTextStrong;
          ctx.textAlign = 'left';
          ctx.fillText(label, bx + 18, cursorY);
          cursorY += 24;
        });
        ctx.restore();
      }

      // crosshair
      if (hoverX !== null && hoverX >= xTicks.min && hoverX <= xTicks.max) {
        ctx.save();
        const px = xToPx(hoverX);
        ctx.strokeStyle = COLORS.crosshair;
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, plot.y);
        ctx.lineTo(px, plot.y + plot.h);
        ctx.stroke();
        ctx.restore();
        if (tooltipEl) renderTooltip(hoverX);
      } else if (tooltipEl) {
        tooltipEl.style.display = 'none';
      }
    }

    function renderTooltip(x) {
      const cfg = config;
      let html = `<div class="tt-x">x = ${formatNumber(x)}</div>`;
      cfg.curves.forEach(curve => {
        let y;
        if (curve.kind === 'stems') {
          let nearest = null, best = Infinity;
          curve.points.forEach(p => { const d = Math.abs(p.x - x); if (d < best) { best = d; nearest = p; } });
          y = nearest ? nearest.y : NaN;
        } else {
          y = curve.fn(x);
        }
        html += `<div class="tt-row"><span class="tt-dot" style="background:${curve.color}"></span>${curve.label}: <b>${Number.isFinite(y) ? formatNumber(y) : '—'}</b></div>`;
      });
      tooltipEl.innerHTML = html;
      tooltipEl.style.display = 'block';
      const px = xToPx(x);
      const rect = canvas.getBoundingClientRect();
      let left = px + 14;
      if (left + 170 > cssW) left = px - 170 - 14;
      tooltipEl.style.left = left + 'px';
      tooltipEl.style.top = (plot.y + 6) + 'px';
    }

    function onMove(evt) {
      const rect = canvas.getBoundingClientRect();
      const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
      const px = clientX - rect.left;
      if (px < plot.x || px > plot.x + plot.w) {
        hoverX = null;
      } else {
        hoverX = pxToX(px);
      }
      draw();
    }
    function onLeave() {
      hoverX = null;
      draw();
    }

    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    canvas.addEventListener('touchmove', onMove, { passive: true });
    canvas.addEventListener('touchend', onLeave);

    global.addEventListener('resize', resize);
    resize();

    return {
      render(cfg) { config = cfg; draw(); },
      resize,
      exportPNG(filename) {
        const link = document.createElement('a');
        link.download = filename || 'chart.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      },
      destroy() {
        canvas.removeEventListener('mousemove', onMove);
        canvas.removeEventListener('mouseleave', onLeave);
        canvas.removeEventListener('touchmove', onMove);
        canvas.removeEventListener('touchend', onLeave);
        global.removeEventListener('resize', resize);
      }
    };
  }

  global.createChart = createChart;
})(window);
