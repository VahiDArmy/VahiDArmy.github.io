/* ==========================================================================
   Service — Fit
   Orchestrates data extraction → math → state update.
   Handles all validation and produces a "prepared" result that pages
   and charts can consume.
   ========================================================================== */

(function (window) {
  'use strict';

  const App = (window.App = window.App || {});
  const C = App.Constants;
  const Events = App.Events;

  /**
   * Return validation info about current fit config, before running.
   * { ok, issues[], def, xCol, yCol }
   */
  function validateConfig() {
    const cfg = App.State.getFitConfig();
    const def = App.getFitDefinition(cfg.type);
    const issues = [];

    if (!def) {
      return { ok: false, issues: ['نوع برازش نامعتبر است.'], def: null };
    }

    const cols = App.State.getColumns();
    const xCol = cols.find((c) => c.id === cfg.xColId) || null;
    const yCol = cols.find((c) => c.id === cfg.yColId) || null;

    if (!xCol) issues.push('ستون x انتخاب نشده است.');
    if (!yCol) issues.push('ستون y انتخاب نشده است.');
    if (xCol && yCol && xCol.id === yCol.id)
      issues.push('ستون x و y نباید یکسان باشند.');

    if (xCol && App.DataService.validateColumnForFit(xCol.id).ok === false) {
      issues.push(`ستون x: ${App.DataService.validateColumnForFit(xCol.id).reason}`);
    }
    if (yCol && App.DataService.validateColumnForFit(yCol.id).ok === false) {
      issues.push(`ستون y: ${App.DataService.validateColumnForFit(yCol.id).reason}`);
    }

    // Param validation
    if (def.params) {
      for (const p of def.params) {
        const val = cfg.params ? cfg.params[p.key] : undefined;
        if (val === undefined || val === null) {
          if (p.key === 'order' || p.key === 'window') {
            issues.push(`مقدار «${p.label}» تعیین نشده است.`);
          }
          continue;
        }
        const v = App.Validators.validateFitParam(p, val);
        if (!v.valid) issues.push(v.message);
      }
    }

    return { ok: issues.length === 0, issues, def, xCol, yCol };
  }

  /**
   * Extract usable xs/ys for the current config. Returns
   * { xs, ys, skipped, issues, minPoints }
   */
  function extractData() {
    const cfg = App.State.getFitConfig();
    const def = App.getFitDefinition(cfg.type);
    const minPoints = (def && def.constraints && def.constraints.minPoints) || 2;
    const result = App.Validators.extractFitData(
      App.State.getRows(),
      cfg.xColId,
      cfg.yColId,
      minPoints
    );
    return { ...result, minPoints };
  }

  /**
   * Run fit, store result in State, and emit events.
   * Returns { ok, result?, error?, issues? }
   */
  function run() {
    Events.emit(C.EVENTS.FIT_RUN, {});
    const cfg = App.State.getFitConfig();
    const validation = validateConfig();
    if (!validation.ok) {
      const error = validation.issues.join(' ');
      Events.emit(C.EVENTS.FIT_ERROR, { error, issues: validation.issues });
      return { ok: false, error, issues: validation.issues };
    }

    const extracted = extractData();
    if (!extracted.valid || extracted.xs.length < extracted.minPoints) {
      const error = extracted.issues.join(' ') || 'دادهٔ کافی برای برازش وجود ندارد.';
      Events.emit(C.EVENTS.FIT_ERROR, { error, issues: extracted.issues });
      return { ok: false, error, issues: extracted.issues };
    }

    // Domain-specific extra checks
    const def = validation.def;
    if (def.constraints) {
      if (def.constraints.xPositive) {
        for (let i = 0; i < extracted.xs.length; i++) {
          if (extracted.xs[i] <= 0) {
            const err = 'در این نوع برازش همهٔ مقادیر x باید مثبت باشند.';
            Events.emit(C.EVENTS.FIT_ERROR, { error: err, issues: [err] });
            return { ok: false, error: err, issues: [err] };
          }
        }
      }
      if (def.constraints.yPositive) {
        for (let i = 0; i < extracted.ys.length; i++) {
          if (extracted.ys[i] <= 0) {
            const err = 'در این نوع برازش همهٔ مقادیر y باید مثبت باشند.';
            Events.emit(C.EVENTS.FIT_ERROR, { error: err, issues: [err] });
            return { ok: false, error: err, issues: [err] };
          }
        }
      }
    }

    // Build fit options from config
    const options = buildOptions(cfg, def);

    try {
      const raw = App.Math.runFit(cfg.type, extracted.xs, extracted.ys, options);
      const result = enrich(raw, cfg, validation, extracted);

      App.State.setFitResult(result);
      return { ok: true, result, skipped: extracted.skipped, issues: extracted.issues };
    } catch (err) {
      const error = err.message || 'خطا در محاسبهٔ برازش.';
      Events.emit(C.EVENTS.FIT_ERROR, { error, issues: [error] });
      return { ok: false, error, issues: [error] };
    }
  }

  /**
   * Transform State.fitConfig into per-fit options for Math.runFit.
   */
  function buildOptions(cfg, def) {
    const p = cfg.params || {};
    const opts = {};

    switch (cfg.type) {
      case 'linear':
        opts.fixedIntercept = cfg.interceptFixed ? cfg.interceptValue : undefined;
        break;

      case 'logarithmic':
        opts.fixedIntercept = cfg.interceptFixed ? cfg.interceptValue : undefined;
        break;

      case 'polynomial':
        opts.order = Math.round(p.order || C.DEFAULTS.DEFAULT_POLY_ORDER);
        opts.fixedIntercept = cfg.interceptFixed ? cfg.interceptValue : undefined;
        break;

      case 'exponential':
        // No intercept toggle in current design
        break;

      case 'power':
        break;

      case 'moving-average':
        opts.window = Math.round(p.window || C.DEFAULTS.DEFAULT_MA_WINDOW);
        break;
    }
    return opts;
  }

  /**
   * Add derived fields to the math result so charts & results page can
   * work without knowing about Math module.
   */
  function enrich(raw, cfg, validation, extracted) {
    const xs = extracted.xs;
    const ys = extracted.ys;

    // Generate smooth curve points for plotting (sorted by x)
    const sortedPairs = xs
      .map((x, i) => ({ x, y: ys[i] }))
      .sort((a, b) => a.x - b.x);
    const sortedX = sortedPairs.map((p) => p.x);

    let curvePoints = [];
    if (raw.type === 'moving-average') {
      // No continuous curve; plot the yHat as line
      curvePoints = sortedPairs.map((p, i) => ({ x: p.x, y: raw.yHat[i] }));
    } else {
      const bounds = App.DataService.computeBounds(sortedX);
      // Include 5% padding on each side so the curve extends a bit
      const pad = (bounds.max - bounds.min) * 0.05;
      const from = bounds.min - pad;
      const to = bounds.max + pad;
      const n = Math.min(200, Math.max(50, xs.length * 4));
      const linspaced = App.Math.linspace(from, to, n);
      curvePoints = linspaced
        .map((x) => ({ x, y: raw.predict(x) }))
        .filter((p) => isFinite(p.y));
    }

    // Residuals paired with x
    const residualPoints = xs.map((x, i) => ({
      x,
      y: raw.residuals[i]
    })).sort((a, b) => a.x - b.x);

    return {
      ...raw,
      xs,
      ys,
      xColId: cfg.xColId,
      yColId: cfg.yColId,
      xColName: validation.xCol ? validation.xCol.name : '',
      yColName: validation.yCol ? validation.yCol.name : '',
      fitTypeName: App.getFitName(cfg.type),
      curvePoints,
      residualPoints,
      options: buildOptions(cfg, validation.def),
      interceptFixed: cfg.interceptFixed,
      interceptValue: cfg.interceptValue,
      computedAt: Date.now(),
      skippedCount: extracted.skipped
    };
  }

  /**
   * Format a coefficient for display in results page.
   */
  function formatCoefficient(value, decimals) {
    const d = typeof decimals === 'number' ? decimals : App.State.getSettings().decimals;
    return App.Format.formatFixed(value, d);
  }

  /**
   * Produce a list of coefficient rows for the results table.
   * [{ label, value, description }]
   */
  function getCoefficientRows(result) {
    if (!result || !result.params) return [];
    const out = [];
    const p = result.params;

    if (result.type === 'linear' || result.type === 'logarithmic') {
      out.push({
        label: 'a',
        value: p.a,
        description: result.type === 'linear' ? 'شیب خط' : 'ضریب جملهٔ لگاریتمی'
      });
      out.push({
        label: 'b',
        value: p.b,
        description: result.type === 'linear' ? 'عرض از مبدأ' : 'عرض از مبدأ (y در x=1)'
      });
    } else if (result.type === 'exponential' || result.type === 'power') {
      out.push({ label: 'a', value: p.a, description: 'ضریب مقیاس' });
      out.push({ label: 'b', value: p.b, description: 'نرخ / نما' });
    } else if (result.type === 'polynomial') {
      (p.coefficients || []).forEach((c, i) => {
        out.push({
          label: `a${toSub(i)}`,
          value: c,
          description: i === 0 ? 'عرض از مبدأ' : i === 1 ? 'ضریب x' : `ضریب x^${i}`
        });
      });
    } else if (result.type === 'moving-average') {
      out.push({ label: 'window', value: p.window, description: 'اندازهٔ پنجره' });
    }
    return out;
  }

  function toSub(n) {
    const subs = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
    return String(n)
      .split('')
      .map((d) => subs[+d] || d)
      .join('');
  }

  /**
   * Compare all fit types on the current data — best fit by R².
   * Returns [{ type, name, r2, adjR2, rmse, mae, params, ok, error? }]
   */
  function compareAll() {
    const cfg = App.State.getFitConfig();
    const extracted = extractData();
    if (!extracted.valid || extracted.xs.length < 2) return [];

    const types = [
      'linear',
      'exponential',
      'logarithmic',
      'polynomial',
      'power',
      'moving-average'
    ];

    const results = [];
    for (const type of types) {
      const def = App.getFitDefinition(type);
      try {
        const options = { order: 2, window: 3 };
        const raw = App.Math.runFit(type, extracted.xs, extracted.ys, options);
        results.push({
          type,
          name: def.name,
          ok: true,
          r2: raw.metrics.r2,
          adjR2: raw.metrics.adjR2,
          rmse: raw.metrics.rmse,
          mae: raw.metrics.mae,
          params: raw.params,
          metrics: raw.metrics
        });
      } catch (err) {
        results.push({
          type,
          name: def.name,
          ok: false,
          error: err.message || 'خطا'
        });
      }
    }

    // Sort best R² first among successful fits
    results.sort((a, b) => {
      if (a.ok && b.ok) return b.r2 - a.r2;
      if (a.ok) return -1;
      if (b.ok) return 1;
      return 0;
    });

    return results;
  }

  /**
   * Classify R² into a quality level used by the results page.
   */
  function classifyR2(r2) {
    if (!isFinite(r2)) return { label: 'نامشخص', cls: '' };
    if (r2 >= 0.95) return { label: 'عالی', cls: 'quality-pill--excellent' };
    if (r2 >= 0.85) return { label: 'خوب', cls: 'quality-pill--good' };
    if (r2 >= 0.7) return { label: 'متوسط', cls: 'quality-pill--fair' };
    return { label: 'ضعیف', cls: 'quality-pill--poor' };
  }

  App.FitService = {
    validateConfig,
    extractData,
    run,
    enrich,
    formatCoefficient,
    getCoefficientRows,
    compareAll,
    classifyR2
  };
})(window);