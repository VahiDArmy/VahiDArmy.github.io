/**
 * app.js
 * Wires the DOM to the distribution engine, the data parser and the
 * chart renderer. No framework, no build step — just plain DOM APIs
 * so the file can be opened directly or hosted anywhere.
 */
(function () {
  'use strict';

  const Dist = window.Distributions;
  const ORDER = window.DISTRIBUTION_ORDER;
  const DP = window.DataParser;
  const SU = window.StatsUtils;

  const OVERLAY_COLORS = ['#FFB238', '#B98EFF', '#FF6B81', '#63D9FF', '#F4E04D'];
  const PRIMARY_COLOR = '#3ADDA8';
  const MAX_OVERLAYS = 5;

  // ---------------------------------------------------------------- state
  const state = {
    mode: 'param',        // 'param' | 'data'
    distId: 'normal',
    params: {},            // { [distId]: { key: value } }
    curveMode: 'pdf',       // 'pdf' | 'cdf'
    data: null,             // number[] | null
    dataSourceLabel: '',
    overlays: []            // [{ distId, params, color, label }]
  };

  // -------------------------------------------------------------- dom refs
  const el = id => document.getElementById(id);
  const distSelect = el('distSelect');
  const formulaText = el('formulaText');
  const theoryMean = el('theoryMean');
  const theoryVar = el('theoryVar');
  const paramSection = el('paramSection');
  const modeTabs = el('modeTabs');
  const dataSection = el('dataSection');
  const dataText = el('dataText');
  const dropzone = el('dropzone');
  const fileInput = el('fileInput');
  const dataStatus = el('dataStatus');
  const applyDataBtn = el('applyDataBtn');
  const clearDataBtn = el('clearDataBtn');
  const fitSection = el('fitSection');
  const fitBtn = el('fitBtn');
  const bestFitBox = el('bestFitBox');
  const bestFitList = el('bestFitList');
  const curveModeToggle = el('curveModeToggle');
  const pinCurveBtn = el('pinCurveBtn');
  const overlayListSection = el('overlayListSection');
  const overlayList = el('overlayList');
  const clearOverlayBtn = el('clearOverlayBtn');
  const chartTitle = el('chartTitle');
  const exportPngBtn = el('exportPngBtn');
  const chartCanvas = el('chartCanvas');
  const chartTooltip = el('chartTooltip');
  const statsCard = el('statsCard');
  const statsGrid = el('statsGrid');
  const copyStatsBtn = el('copyStatsBtn');

  const chart = window.createChart(chartCanvas, { tooltipEl: chartTooltip });

  // ----------------------------------------------------------- param state
  function defaultParams(dist) {
    const o = {};
    dist.params.forEach(p => { o[p.key] = p.def; });
    return o;
  }
  function getParams(distId) {
    if (!state.params[distId]) state.params[distId] = defaultParams(Dist[distId]);
    return state.params[distId];
  }
  function setParams(distId, params) {
    state.params[distId] = Object.assign({}, params);
  }

  function fmt(v) {
    if (!Number.isFinite(v)) return '—';
    const abs = Math.abs(v);
    if (abs !== 0 && (abs >= 100000 || abs < 0.0005)) return v.toExponential(2);
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(abs < 1 ? 4 : abs < 10 ? 3 : 2);
  }

  // ------------------------------------------------------- populate select
  ORDER.forEach(id => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = Dist[id].label;
    distSelect.appendChild(opt);
  });
  distSelect.value = state.distId;

  // --------------------------------------------------------- param sliders
  function renderParamInputs() {
    const dist = Dist[state.distId];
    const params = getParams(state.distId);
    paramSection.innerHTML = '';
    dist.params.forEach(p => {
      const row = document.createElement('div');
      row.className = 'param-row';

      const labelRow = document.createElement('div');
      labelRow.className = 'param-label-row';
      const label = document.createElement('label');
      label.textContent = p.label;
      const valueSpan = document.createElement('span');
      valueSpan.className = 'param-value';
      valueSpan.dir = 'ltr';
      valueSpan.textContent = fmt(params[p.key]);
      labelRow.appendChild(label);
      labelRow.appendChild(valueSpan);

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = p.min; slider.max = p.max; slider.step = p.step;
      slider.value = params[p.key];
      slider.className = 'slider';
      slider.dir = 'ltr';

      slider.addEventListener('input', () => {
        const v = Number(slider.value);
        params[p.key] = v;
        valueSpan.textContent = fmt(v);
        renderAll();
      });

      row.appendChild(labelRow);
      row.appendChild(slider);
      paramSection.appendChild(row);
    });
  }

  function updateFormulaBox() {
    const dist = Dist[state.distId];
    const params = getParams(state.distId);
    formulaText.textContent = dist.formula;
    theoryMean.textContent = fmt(dist.mean(params));
    theoryVar.textContent = fmt(dist.variance(params));
  }

  // -------------------------------------------------------------- domain
  function computeXDomain() {
    const dist = Dist[state.distId];
    let [lo, hi] = dist.domain(getParams(state.distId));
    if (state.data && state.data.length) {
      const dmin = Math.min(...state.data), dmax = Math.max(...state.data);
      const pad = (dmax - dmin) * 0.08 || Math.abs(dmax) * 0.1 || 1;
      lo = Math.min(lo, dmin - pad);
      hi = Math.max(hi, dmax + pad);
    }
    state.overlays.forEach(ov => {
      const [olo, ohi] = Dist[ov.distId].domain(ov.params);
      lo = Math.min(lo, olo);
      hi = Math.max(hi, ohi);
    });
    if (hi <= lo) hi = lo + 1;
    return [lo, hi];
  }

  function buildCurve(distId, params, color, label, emphasis) {
    const dist = Dist[distId];
    if (dist.type === 'discrete') {
      const [lo0, hi0] = dist.domain(params);
      const lo = Math.max(0, Math.floor(lo0));
      let hi = Math.ceil(hi0);
      const maxPoints = 400;
      let step = 1;
      if (hi - lo > maxPoints) step = Math.ceil((hi - lo) / maxPoints);
      const points = [];
      for (let x = lo; x <= hi; x += step) {
        const y = state.curveMode === 'pdf' ? dist.pmf(x, params) : dist.cdf(x, params);
        points.push({ x, y: Number.isFinite(y) ? y : 0 });
      }
      return { kind: 'stems', points, color, label, emphasis };
    }
    return {
      kind: 'line',
      fn: x => state.curveMode === 'pdf' ? dist.pdf(x, params) : dist.cdf(x, params),
      color, label, emphasis
    };
  }

  // ------------------------------------------------------------- rendering
  function renderAll() {
    updateFormulaBox();

    const dist = Dist[state.distId];
    const params = getParams(state.distId);
    const xDomain = computeXDomain();

    const curves = [];
    state.overlays.forEach(ov => {
      curves.push(buildCurve(ov.distId, ov.params, ov.color, ov.label, false));
    });
    curves.push(buildCurve(state.distId, params, PRIMARY_COLOR, dist.label, true));

    let histogram = null;
    if (state.data && state.data.length) {
      histogram = SU.histogram(state.data);
    }

    chart.render({ xDomain, curves, histogram });

    chartTitle.textContent = `${dist.label} (${dist.shortLabel})`;
    renderStats();
    renderOverlayList();
  }

  function renderStats() {
    if (!state.data || !state.data.length) {
      statsCard.hidden = true;
      return;
    }
    statsCard.hidden = false;
    const d = SU.describe(state.data);
    const rows = [
      ['تعداد (n)', d.n],
      ['میانگین', d.mean],
      ['انحراف‌معیار', d.std],
      ['واریانس', d.variance],
      ['میانه', d.median],
      ['چارک اول (Q1)', d.q1],
      ['چارک سوم (Q3)', d.q3],
      ['کمینه', d.min],
      ['بیشینه', d.max],
      ['چولگی', d.skewness],
      ['کشیدگی مازاد', d.kurtosis]
    ];
    statsGrid.innerHTML = rows.map(([label, value]) => `
      <div class="stat-card">
        <span class="stat-label">${label}</span>
        <span class="stat-value" dir="ltr">${fmt(value)}</span>
      </div>
    `).join('');
  }

  function renderOverlayList() {
    if (!state.overlays.length) {
      overlayListSection.hidden = true;
      return;
    }
    overlayListSection.hidden = false;
    overlayList.innerHTML = '';
    state.overlays.forEach((ov, idx) => {
      const li = document.createElement('li');
      li.className = 'overlay-item';
      const dot = document.createElement('span');
      dot.className = 'overlay-dot';
      dot.style.background = ov.color;
      const label = document.createElement('span');
      label.className = 'overlay-label';
      label.textContent = ov.label;
      const removeBtn = document.createElement('button');
      removeBtn.className = 'overlay-remove';
      removeBtn.setAttribute('aria-label', 'حذف');
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        state.overlays.splice(idx, 1);
        renderAll();
      });
      li.appendChild(dot);
      li.appendChild(label);
      li.appendChild(removeBtn);
      overlayList.appendChild(li);
    });
  }

  // ----------------------------------------------------------- interactions
  distSelect.addEventListener('change', () => {
    state.distId = distSelect.value;
    renderParamInputs();
    renderAll();
  });

  modeTabs.addEventListener('click', evt => {
    const btn = evt.target.closest('.tab');
    if (!btn) return;
    state.mode = btn.dataset.mode;
    [...modeTabs.querySelectorAll('.tab')].forEach(t => {
      const active = t === btn;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', String(active));
    });
    dataSection.hidden = state.mode !== 'data';
    fitSection.hidden = state.mode !== 'data';
    renderAll();
  });

  curveModeToggle.addEventListener('click', evt => {
    const btn = evt.target.closest('button');
    if (!btn) return;
    state.curveMode = btn.dataset.value;
    [...curveModeToggle.querySelectorAll('button')].forEach(b => b.classList.toggle('active', b === btn));
    renderAll();
  });

  // --------------------------------------------------------------- data in
  function setDataStatus(msg, isError) {
    dataStatus.textContent = msg;
    dataStatus.classList.toggle('error', !!isError);
  }

  applyDataBtn.addEventListener('click', () => {
    const numbers = DP.extractFromString(dataText.value);
    if (!numbers.length) {
      setDataStatus('هیچ عدد قابل‌استفاده‌ای در متن پیدا نشد.', true);
      return;
    }
    state.data = numbers;
    setDataStatus(`${numbers.length.toLocaleString('en-US')} عدد استخراج و تحلیل شد.`, false);
    clearDataBtn.hidden = false;
    renderAll();
    renderBestFits();
  });

  clearDataBtn.addEventListener('click', () => {
    state.data = null;
    dataText.value = '';
    setDataStatus('', false);
    clearDataBtn.hidden = true;
    bestFitBox.hidden = true;
    renderAll();
  });

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', evt => {
    if (evt.key === 'Enter' || evt.key === ' ') { evt.preventDefault(); fileInput.click(); }
  });
  ['dragover', 'dragenter'].forEach(ev => dropzone.addEventListener(ev, e => {
    e.preventDefault(); dropzone.classList.add('drag-active');
  }));
  ['dragleave', 'dragend'].forEach(ev => dropzone.addEventListener(ev, () => {
    dropzone.classList.remove('drag-active');
  }));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag-active');
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (file) handleFile(file);
    fileInput.value = '';
  });

  async function handleFile(file) {
    setDataStatus('در حال خواندن فایل...', false);
    try {
      const numbers = await DP.extractFromFile(file);
      if (!numbers.length) {
        setDataStatus(`هیچ عدد قابل‌استفاده‌ای در «${file.name}» پیدا نشد.`, true);
        return;
      }
      dataText.value = numbers.join(', ');
      setDataStatus(`${numbers.length.toLocaleString('en-US')} عدد از «${file.name}» استخراج شد — برای تحلیل دکمه زیر را بزنید.`, false);
    } catch (err) {
      setDataStatus(err && err.message ? err.message : 'خطا در پردازش فایل.', true);
    }
  }

  // ------------------------------------------------------------- fitting
  fitBtn.addEventListener('click', () => {
    if (!state.data || !state.data.length) return;
    const dist = Dist[state.distId];
    try {
      const fitted = dist.fit(state.data);
      const invalid = Object.values(fitted).some(v => !Number.isFinite(v));
      if (invalid) throw new Error('برازش ناموفق');
      setParams(state.distId, fitted);
      renderParamInputs();
      renderAll();
    } catch (e) {
      setDataStatus('برازش این توزیع روی داده فعلی ممکن نشد.', true);
    }
  });

  function renderBestFits() {
    if (!state.data || state.data.length < 3) { bestFitBox.hidden = true; return; }
    const hist = SU.histogram(state.data);
    const candidates = ORDER.filter(id => Dist[id].type === 'continuous');
    const scored = candidates.map(id => {
      const dist = Dist[id];
      let params;
      try { params = dist.fit(state.data); } catch (e) { return null; }
      if (Object.values(params).some(v => !Number.isFinite(v))) return null;
      const score = SU.fitScore(hist.bins, x => dist.pdf(x, params));
      if (!Number.isFinite(score)) return null;
      return { id, dist, params, score };
    }).filter(Boolean).sort((a, b) => a.score - b.score).slice(0, 3);

    if (!scored.length) { bestFitBox.hidden = true; return; }
    bestFitBox.hidden = false;
    bestFitList.innerHTML = '';
    scored.forEach(s => {
      const li = document.createElement('li');
      li.className = 'best-fit-item';
      const info = document.createElement('div');
      info.className = 'best-fit-info';
      info.innerHTML = `<span class="best-fit-name">${s.dist.label}</span><span class="best-fit-score" dir="ltr">RMSE ${s.score.toExponential(2)}</span>`;
      const useBtn = document.createElement('button');
      useBtn.className = 'btn btn-ghost btn-small';
      useBtn.textContent = 'استفاده';
      useBtn.addEventListener('click', () => {
        state.distId = s.id;
        distSelect.value = s.id;
        setParams(s.id, s.params);
        renderParamInputs();
        renderAll();
      });
      li.appendChild(info);
      li.appendChild(useBtn);
      bestFitList.appendChild(li);
    });
  }

  // ------------------------------------------------------------- overlays
  pinCurveBtn.addEventListener('click', () => {
    if (state.overlays.length >= MAX_OVERLAYS) return;
    const dist = Dist[state.distId];
    const usedColors = state.overlays.map(o => o.color);
    const color = OVERLAY_COLORS.find(c => !usedColors.includes(c)) || OVERLAY_COLORS[state.overlays.length % OVERLAY_COLORS.length];
    state.overlays.push({
      distId: state.distId,
      params: Object.assign({}, getParams(state.distId)),
      color,
      label: `${dist.label} (${dist.shortLabel})`
    });
    renderAll();
  });

  clearOverlayBtn.addEventListener('click', () => {
    state.overlays = [];
    renderAll();
  });

  // ------------------------------------------------------------- toolbar
  exportPngBtn.addEventListener('click', () => {
    chart.exportPNG(`${state.distId}-${state.curveMode}.png`);
  });

  copyStatsBtn.addEventListener('click', async () => {
    if (!state.data) return;
    const d = SU.describe(state.data);
    try {
      await navigator.clipboard.writeText(JSON.stringify(d, null, 2));
      const original = copyStatsBtn.title;
      copyStatsBtn.title = 'کپی شد';
      setTimeout(() => { copyStatsBtn.title = original; }, 1500);
    } catch (e) {
      /* clipboard API unavailable — silently ignore */
    }
  });

  // --------------------------------------------------------------- init
  renderParamInputs();
  renderAll();
})();
