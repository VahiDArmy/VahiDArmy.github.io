/* ==========================================================================
   Utils — Math
   Numeric helpers + curve fitting algorithms + matrix solvers.
   Every fitter returns a normalized result object:
     { type, params, predict(x), yHat[], residuals[], metrics }
   or throws an Error with a user-friendly Persian message.
   ========================================================================== */

(function (window) {
  'use strict';

  const App = (window.App = window.App || {});

  /* ---------- Basic helpers ---------- */

  function isFiniteNumber(v) {
    return typeof v === 'number' && isFinite(v);
  }

  function sum(arr) {
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += arr[i];
    return s;
  }

  function mean(arr) {
    if (!arr.length) return 0;
    return sum(arr) / arr.length;
  }

  function median(arr) {
    if (!arr.length) return 0;
    const sorted = arr.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function min(arr) {
    if (!arr.length) return 0;
    let m = arr[0];
    for (let i = 1; i < arr.length; i++) if (arr[i] < m) m = arr[i];
    return m;
  }

  function max(arr) {
    if (!arr.length) return 0;
    let m = arr[0];
    for (let i = 1; i < arr.length; i++) if (arr[i] > m) m = arr[i];
    return m;
  }

  function variance(arr) {
    if (arr.length < 2) return 0;
    const mu = mean(arr);
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += (arr[i] - mu) ** 2;
    return s / (arr.length - 1);
  }

  function stdDev(arr) {
    return Math.sqrt(variance(arr));
  }

  function range(arr) {
    if (!arr.length) return 0;
    return max(arr) - min(arr);
  }

  /* ---------- Metrics ---------- */

  /**
   * Compute fit-quality metrics.
   * @param {number[]} ys     actual
   * @param {number[]} yHat   predicted
   * @param {number} [paramCount] — number of fitted parameters (for adjusted R²)
   */
  function computeMetrics(ys, yHat, paramCount) {
    const n = ys.length;
    if (n === 0) {
      return {
        n: 0,
        sse: 0,
        sst: 0,
        mse: 0,
        rmse: 0,
        mae: 0,
        mape: 0,
        r2: 0,
        adjR2: 0,
        dof: 0
      };
    }
    const meanY = mean(ys);
    let sst = 0,
      sse = 0,
      sae = 0,
      mapeSum = 0,
      mapeCount = 0;
    for (let i = 0; i < n; i++) {
      const diff = ys[i] - yHat[i];
      sst += (ys[i] - meanY) ** 2;
      sse += diff * diff;
      sae += Math.abs(diff);
      if (ys[i] !== 0) {
        mapeSum += Math.abs(diff / ys[i]);
        mapeCount++;
      }
    }
    const mse = sse / n;
    const rmse = Math.sqrt(mse);
    const mae = sae / n;
    const mape = mapeCount ? (mapeSum / mapeCount) * 100 : 0;
    const r2 = sst === 0 ? 0 : 1 - sse / sst;
    const p = paramCount == null ? 1 : paramCount;
    const dof = n - p;
    const adjR2 = dof > 0 ? 1 - ((1 - r2) * (n - 1)) / dof : r2;
    return { n, sse, sst, mse, rmse, mae, mape, r2, adjR2, dof };
  }

  /* ---------- Matrix helpers ---------- */

  /**
   * Solve A·x = b for x using Gaussian elimination with partial pivoting.
   * @param {number[][]} A  n×n
   * @param {number[]} b    n
   * @returns {number[]|null}
   */
  function solveLinearSystem(A, b) {
    const n = A.length;
    if (n === 0) return [];
    // Build augmented matrix
    const M = A.map((row, i) => row.slice().concat([b[i]]));

    for (let i = 0; i < n; i++) {
      // Partial pivot
      let pivot = i;
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(M[j][i]) > Math.abs(M[pivot][i])) pivot = j;
      }
      if (Math.abs(M[pivot][i]) < 1e-12) return null; // singular
      if (pivot !== i) [M[i], M[pivot]] = [M[pivot], M[i]];

      const pivotVal = M[i][i];
      for (let j = i; j <= n; j++) M[i][j] /= pivotVal;

      for (let k = 0; k < n; k++) {
        if (k === i) continue;
        const factor = M[k][i];
        if (factor === 0) continue;
        for (let j = i; j <= n; j++) M[k][j] -= factor * M[i][j];
      }
    }
    return M.map((row) => row[n]);
  }

  /* ---------- Residual builder ---------- */

  function buildResiduals(ys, yHat) {
    const out = new Array(ys.length);
    for (let i = 0; i < ys.length; i++) out[i] = ys[i] - yHat[i];
    return out;
  }

  /* ---------- Fit: Linear ---------- */

  function fitLinear(xs, ys, options) {
    const fixedB = options && typeof options.fixedIntercept === 'number'
      ? options.fixedIntercept
      : null;
    const n = xs.length;
    if (n < 2) throw new Error('برای برازش خطی حداقل ۲ نقطه لازم است.');

    let a, b;
    if (fixedB !== null) {
      let num = 0,
        den = 0;
      for (let i = 0; i < n; i++) {
        num += (ys[i] - fixedB) * xs[i];
        den += xs[i] * xs[i];
      }
      a = den === 0 ? 0 : num / den;
      b = fixedB;
    } else {
      const mx = mean(xs);
      const my = mean(ys);
      let num = 0,
        den = 0;
      for (let i = 0; i < n; i++) {
        num += (xs[i] - mx) * (ys[i] - my);
        den += (xs[i] - mx) ** 2;
      }
      a = den === 0 ? 0 : num / den;
      b = my - a * mx;
    }

    const predict = (x) => a * x + b;
    const yHat = xs.map(predict);
    const residuals = buildResiduals(ys, yHat);
    const paramCount = fixedB !== null ? 1 : 2;
    const metrics = computeMetrics(ys, yHat, paramCount);

    return {
      type: 'linear',
      params: { a, b },
      predict,
      yHat,
      residuals,
      metrics,
      equation: `y = ${fmt(a)}·x ${b >= 0 ? '+' : '−'} ${fmt(Math.abs(b))}`
    };
  }

  /* ---------- Fit: Exponential ---------- */

  function fitExponential(xs, ys, options) {
    const n = xs.length;
    if (n < 2) throw new Error('برای برازش نمایی حداقل ۲ نقطه لازم است.');
    for (let i = 0; i < n; i++) {
      if (ys[i] <= 0) throw new Error('در برازش نمایی همهٔ مقادیر y باید مثبت باشند.');
    }

    // ln(y) = ln(a) + b·x
    const logY = ys.map((y) => Math.log(y));
    const fixedA =
      options && typeof options.fixedA === 'number' && options.fixedA > 0
        ? options.fixedA
        : null;

    let lnA, b;
    if (fixedA !== null) {
      lnA = Math.log(fixedA);
      // b = Σ((lnY - lnA) · x) / Σ(x²)
      let num = 0,
        den = 0;
      for (let i = 0; i < n; i++) {
        num += (logY[i] - lnA) * xs[i];
        den += xs[i] * xs[i];
      }
      b = den === 0 ? 0 : num / den;
    } else {
      const mx = mean(xs);
      const my = mean(logY);
      let num = 0,
        den = 0;
      for (let i = 0; i < n; i++) {
        num += (xs[i] - mx) * (logY[i] - my);
        den += (xs[i] - mx) ** 2;
      }
      b = den === 0 ? 0 : num / den;
      lnA = my - b * mx;
    }

    const a = Math.exp(lnA);
    const predict = (x) => a * Math.exp(b * x);
    const yHat = xs.map(predict);
    const residuals = buildResiduals(ys, yHat);
    const paramCount = fixedA !== null ? 1 : 2;
    const metrics = computeMetrics(ys, yHat, paramCount);

    return {
      type: 'exponential',
      params: { a, b },
      predict,
      yHat,
      residuals,
      metrics,
      equation: `y = ${fmt(a)} · e^(${fmt(b)}·x)`
    };
  }

  /* ---------- Fit: Logarithmic ---------- */

  function fitLogarithmic(xs, ys, options) {
    const n = xs.length;
    if (n < 2) throw new Error('برای برازش لگاریتمی حداقل ۲ نقطه لازم است.');
    for (let i = 0; i < n; i++) {
      if (xs[i] <= 0) throw new Error('در برازش لگاریتمی همهٔ مقادیر x باید مثبت باشند.');
    }

    // y = a·ln(x) + b — linear on (ln(x), y)
    const lnX = xs.map((x) => Math.log(x));
    const fixedB =
      options && typeof options.fixedIntercept === 'number'
        ? options.fixedIntercept
        : null;

    let a, b;
    if (fixedB !== null) {
      let num = 0,
        den = 0;
      for (let i = 0; i < n; i++) {
        num += (ys[i] - fixedB) * lnX[i];
        den += lnX[i] * lnX[i];
      }
      a = den === 0 ? 0 : num / den;
      b = fixedB;
    } else {
      const mx = mean(lnX);
      const my = mean(ys);
      let num = 0,
        den = 0;
      for (let i = 0; i < n; i++) {
        num += (lnX[i] - mx) * (ys[i] - my);
        den += (lnX[i] - mx) ** 2;
      }
      a = den === 0 ? 0 : num / den;
      b = my - a * mx;
    }

    const predict = (x) => {
      if (x <= 0) return NaN;
      return a * Math.log(x) + b;
    };
    const yHat = xs.map(predict);
    const residuals = buildResiduals(ys, yHat);
    const paramCount = fixedB !== null ? 1 : 2;
    const metrics = computeMetrics(ys, yHat, paramCount);

    return {
      type: 'logarithmic',
      params: { a, b },
      predict,
      yHat,
      residuals,
      metrics,
      equation: `y = ${fmt(a)} · ln(x) ${b >= 0 ? '+' : '−'} ${fmt(Math.abs(b))}`
    };
  }

  /* ---------- Fit: Polynomial ---------- */

  function fitPolynomial(xs, ys, options) {
    const order = (options && options.order) || 2;
    const n = xs.length;
    if (n < order + 1)
      throw new Error(
        `برای برازش چندجمله‌ای درجهٔ ${order} حداقل ${order + 1} نقطه لازم است.`
      );

    const fixedIntercept =
      options && typeof options.fixedIntercept === 'number'
        ? options.fixedIntercept
        : null;

    // Build normal equations X^T X · a = X^T y
    // Degree k terms: 1, x, x², ... x^k
    // If fixedIntercept is set, we subtract it from y and fit degrees 1..k
    const startDeg = fixedIntercept !== null ? 1 : 0;
    const terms = order - startDeg + 1;
    const shifted = fixedIntercept !== null ? ys.map((y) => y - fixedIntercept) : ys;

    const A = Array.from({ length: terms }, () => new Array(terms).fill(0));
    const rhs = new Array(terms).fill(0);

    for (let i = 0; i < n; i++) {
      const x = xs[i];
      const powersI = [];
      for (let p = startDeg; p <= order; p++) powersI.push(Math.pow(x, p));
      for (let r = 0; r < terms; r++) {
        rhs[r] += shifted[i] * powersI[r];
        for (let c = 0; c < terms; c++) {
          A[r][c] += powersI[r] * powersI[c];
        }
      }
    }

    const solution = solveLinearSystem(A, rhs);
    if (!solution)
      throw new Error('داده‌ها برای برازش چندجمله‌ای مناسب نیستند (ماتریس تکین).');

    // Build coefficient array indexed by power: coef[p] for x^p
    const coef = new Array(order + 1).fill(0);
    if (fixedIntercept !== null) coef[0] = fixedIntercept;
    for (let i = 0; i < terms; i++) coef[startDeg + i] = solution[i];

    const predict = (x) => {
      let s = 0;
      for (let p = 0; p <= order; p++) s += coef[p] * Math.pow(x, p);
      return s;
    };
    const yHat = xs.map(predict);
    const residuals = buildResiduals(ys, yHat);
    const paramCount = terms;
    const metrics = computeMetrics(ys, yHat, paramCount);

    // Build human-readable equation: a0 + a1·x + a2·x² ...
    const termsStr = [];
    for (let p = 0; p <= order; p++) {
      const c = coef[p];
      if (p === 0) {
        if (c !== 0 || order === 0) termsStr.push(fmt(c));
        continue;
      }
      if (c === 0 && !(fixedIntercept !== null && p === 0)) continue;
      const sign = c >= 0 ? '+' : '−';
      const abs = Math.abs(c);
      const xPart = p === 1 ? 'x' : `x^${p}`;
      termsStr.push(`${sign} ${fmt(abs)}·${xPart}`);
    }
    const equation = 'y = ' + (termsStr.length ? termsStr.join(' ') : '0');

    return {
      type: 'polynomial',
      params: { coefficients: coef, order },
      predict,
      yHat,
      residuals,
      metrics,
      equation
    };
  }

  /* ---------- Fit: Power ---------- */

  function fitPower(xs, ys, options) {
    const n = xs.length;
    if (n < 2) throw new Error('برای برازش توانی حداقل ۲ نقطه لازم است.');
    for (let i = 0; i < n; i++) {
      if (xs[i] <= 0 || ys[i] <= 0)
        throw new Error('در برازش توانی همهٔ مقادیر x و y باید مثبت باشند.');
    }

    // ln(y) = ln(a) + b·ln(x)
    const lnX = xs.map((x) => Math.log(x));
    const lnY = ys.map((y) => Math.log(y));
    const fixedA =
      options && typeof options.fixedA === 'number' && options.fixedA > 0
        ? options.fixedA
        : null;

    let lnA, b;
    if (fixedA !== null) {
      lnA = Math.log(fixedA);
      let num = 0,
        den = 0;
      for (let i = 0; i < n; i++) {
        num += (lnY[i] - lnA) * lnX[i];
        den += lnX[i] * lnX[i];
      }
      b = den === 0 ? 0 : num / den;
    } else {
      const mx = mean(lnX);
      const my = mean(lnY);
      let num = 0,
        den = 0;
      for (let i = 0; i < n; i++) {
        num += (lnX[i] - mx) * (lnY[i] - my);
        den += (lnX[i] - mx) ** 2;
      }
      b = den === 0 ? 0 : num / den;
      lnA = my - b * mx;
    }

    const a = Math.exp(lnA);
    const predict = (x) => {
      if (x <= 0) return NaN;
      return a * Math.pow(x, b);
    };
    const yHat = xs.map(predict);
    const residuals = buildResiduals(ys, yHat);
    const paramCount = fixedA !== null ? 1 : 2;
    const metrics = computeMetrics(ys, yHat, paramCount);

    return {
      type: 'power',
      params: { a, b },
      predict,
      yHat,
      residuals,
      metrics,
      equation: `y = ${fmt(a)} · x^${fmt(b)}`
    };
  }

  /* ---------- Fit: Moving Average ---------- */

  function fitMovingAverage(xs, ys, options) {
    const window = (options && options.window) || 3;
    const n = xs.length;
    if (n < 2) throw new Error('برای میانگین متحرک حداقل ۲ نقطه لازم است.');
    if (window < 2)
      throw new Error('اندازهٔ پنجرهٔ میانگین متحرک باید حداقل ۲ باشد.');

    // Sort by x first (moving average needs ordered data)
    const order = xs.map((x, i) => i).sort((a, b) => xs[a] - xs[b]);
    const sortedX = order.map((i) => xs[i]);
    const sortedY = order.map((i) => ys[i]);
    const w = Math.min(window, Math.max(2, Math.floor(n)));

    const sortedYHat = new Array(n);
    for (let i = 0; i < n; i++) {
      const start = Math.max(0, i - w + 1);
      let s = 0;
      let cnt = 0;
      for (let j = start; j <= i; j++) {
        s += sortedY[j];
        cnt++;
      }
      sortedYHat[i] = s / cnt;
    }

    // Unsort back to original order
    const yHat = new Array(n);
    order.forEach((origIdx, sortedIdx) => {
      yHat[origIdx] = sortedYHat[sortedIdx];
    });

    const residuals = buildResiduals(ys, yHat);
    const metrics = computeMetrics(ys, yHat, 1);

    return {
      type: 'moving-average',
      params: { window: w },
      predict: () => NaN,
      yHat,
      residuals,
      metrics,
      equation: `میانگین متحرک با پنجرهٔ ${w}`
    };
  }

  /* ---------- Number formatter used in equations ---------- */

  function fmt(n) {
    if (!isFinite(n)) return 'NaN';
    if (n === 0) return '0';
    const abs = Math.abs(n);
    if (abs >= 1e6 || abs < 1e-4) return n.toExponential(3);
    return parseFloat(n.toPrecision(5)).toString();
  }

  /* ---------- Dispatcher ---------- */

  function runFit(type, xs, ys, options) {
    switch (type) {
      case 'linear':
        return fitLinear(xs, ys, options);
      case 'exponential':
        return fitExponential(xs, ys, options);
      case 'logarithmic':
        return fitLogarithmic(xs, ys, options);
      case 'polynomial':
        return fitPolynomial(xs, ys, options);
      case 'power':
        return fitPower(xs, ys, options);
      case 'moving-average':
        return fitMovingAverage(xs, ys, options);
      default:
        throw new Error('نوع برازش نامعتبر است.');
    }
  }

  /* ---------- Range helpers for plotting ---------- */

  function niceStep(range, targetTicks) {
    const raw = range / Math.max(1, targetTicks);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    let nice;
    if (norm <= 1) nice = 1;
    else if (norm <= 2) nice = 2;
    else if (norm <= 5) nice = 5;
    else nice = 10;
    return nice * mag;
  }

  function linspace(from, to, count) {
    if (count < 2) return [from];
    const step = (to - from) / (count - 1);
    const out = [];
    for (let i = 0; i < count; i++) out.push(from + step * i);
    return out;
  }

  /* ---------- Export ---------- */

  App.Math = {
    isFiniteNumber,
    sum,
    mean,
    median,
    min,
    max,
    variance,
    stdDev,
    range,
    computeMetrics,
    solveLinearSystem,
    runFit,
    fmt,
    niceStep,
    linspace,
    // Individual fitters — for direct testing
    fitLinear,
    fitExponential,
    fitLogarithmic,
    fitPolynomial,
    fitPower,
    fitMovingAverage
  };
})(window);