/**
 * distributions.js
 * Registry of statistical distributions. Each entry defines how to
 * evaluate its density/mass function and CDF, its parameter set,
 * a sensible plotting domain, and how to fit its parameters from a
 * raw data array (method of moments - fast, closed-form, robust to
 * the messy, fail-safe-parsed data this app ingests).
 *
 * Exposed on window.Distributions (an object keyed by id) and
 * window.DISTRIBUTION_ORDER (display order).
 */
(function (global) {
  'use strict';
  const M = global.MathUtils;
  const SQRT2PI = Math.sqrt(2 * Math.PI);

  function mean(arr) {
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }
  function variance(arr, m) {
    const mu = m === undefined ? mean(arr) : m;
    if (arr.length < 2) return 0;
    return arr.reduce((s, v) => s + (v - mu) * (v - mu), 0) / (arr.length - 1);
  }

  const D = {};

  // ---------------------------------------------------------------- Normal
  D.normal = {
    id: 'normal', label: 'نرمال (گاوسی)', shortLabel: 'Normal', type: 'continuous',
    formula: 'f(x) = 1 / (σ√2π) · e^(−(x−μ)²/2σ²)',
    params: [
      { key: 'mu', label: 'میانگین μ', symbol: 'μ', def: 0, min: -20, max: 20, step: 0.1 },
      { key: 'sigma', label: 'انحراف‌معیار σ', symbol: 'σ', def: 1, min: 0.01, max: 20, step: 0.01 }
    ],
    pdf: (x, p) => Math.exp(-((x - p.mu) ** 2) / (2 * p.sigma * p.sigma)) / (p.sigma * SQRT2PI),
    cdf: (x, p) => 0.5 * (1 + M.erf((x - p.mu) / (p.sigma * Math.SQRT2))),
    mean: p => p.mu,
    variance: p => p.sigma * p.sigma,
    domain: p => [p.mu - 4.5 * p.sigma, p.mu + 4.5 * p.sigma],
    fit: data => {
      const m = mean(data), s = Math.sqrt(variance(data, m));
      return { mu: m, sigma: Math.max(s, 1e-6) };
    }
  };

  // ------------------------------------------------------------ Log-normal
  D.lognormal = {
    id: 'lognormal', label: 'لوگ‌نرمال', shortLabel: 'Log-normal', type: 'continuous',
    formula: 'f(x) = 1 / (xσ√2π) · e^(−(ln x−μ)²/2σ²) ,  x > 0',
    params: [
      { key: 'mu', label: 'میانگین لگاریتم μ', symbol: 'μ', def: 0, min: -5, max: 5, step: 0.05 },
      { key: 'sigma', label: 'انحراف‌معیار لگاریتم σ', symbol: 'σ', def: 0.5, min: 0.01, max: 3, step: 0.01 }
    ],
    pdf: (x, p) => {
      if (x <= 0) return 0;
      return Math.exp(-((Math.log(x) - p.mu) ** 2) / (2 * p.sigma * p.sigma)) / (x * p.sigma * SQRT2PI);
    },
    cdf: (x, p) => x <= 0 ? 0 : 0.5 * (1 + M.erf((Math.log(x) - p.mu) / (p.sigma * Math.SQRT2))),
    mean: p => Math.exp(p.mu + p.sigma * p.sigma / 2),
    variance: p => (Math.exp(p.sigma * p.sigma) - 1) * Math.exp(2 * p.mu + p.sigma * p.sigma),
    domain: p => [0, Math.exp(p.mu + 4 * p.sigma)],
    fit: data => {
      const pos = data.filter(v => v > 0);
      if (!pos.length) return { mu: 0, sigma: 0.5 };
      const logs = pos.map(Math.log);
      const m = mean(logs), s = Math.sqrt(variance(logs, m));
      return { mu: m, sigma: Math.max(s, 1e-6) };
    }
  };

  // --------------------------------------------------------- Student's t
  D.studentT = {
    id: 'studentT', label: 'استیودنت t', shortLabel: "Student's t", type: 'continuous',
    formula: 'f(x) = Γ((ν+1)/2) / (√νπ · Γ(ν/2)) · (1+x²/ν)^−(ν+1)/2',
    params: [{ key: 'nu', label: 'درجه آزادی ν', symbol: 'ν', def: 5, min: 1, max: 200, step: 1 }],
    pdf: (x, p) => {
      const nu = p.nu;
      const num = M.gammaFn((nu + 1) / 2);
      const den = Math.sqrt(nu * Math.PI) * M.gammaFn(nu / 2);
      return (num / den) * Math.pow(1 + (x * x) / nu, -(nu + 1) / 2);
    },
    cdf: (x, p) => {
      const nu = p.nu;
      const xb = nu / (nu + x * x);
      const ib = M.incompleteBetaRegularized(xb, nu / 2, 0.5);
      return x > 0 ? 1 - 0.5 * ib : 0.5 * ib;
    },
    mean: () => 0,
    variance: p => p.nu > 2 ? p.nu / (p.nu - 2) : NaN,
    domain: p => {
      const spread = p.nu > 2 ? Math.sqrt(p.nu / (p.nu - 2)) : 3;
      const r = Math.max(4.5 * spread, 4.5);
      return [-r, r];
    },
    fit: data => {
      // Method of moments on the variance; nu chosen so Var = nu/(nu-2)
      const v = variance(data);
      if (!(v > 1)) return { nu: 30 };
      const nu = M.clamp(2 * v / (v - 1), 2.01, 200);
      return { nu: Math.round(nu) };
    }
  };

  // ------------------------------------------------------------ Chi-square
  D.chiSquare = {
    id: 'chiSquare', label: 'کای‌دو', shortLabel: 'Chi-square', type: 'continuous',
    formula: 'f(x) = 1 / (2^(k/2) Γ(k/2)) · x^(k/2−1) e^(−x/2) ,  x ≥ 0',
    params: [{ key: 'k', label: 'درجه آزادی k', symbol: 'k', def: 4, min: 1, max: 200, step: 1 }],
    pdf: (x, p) => {
      if (x < 0) return 0;
      if (x === 0) return p.k < 2 ? Infinity : (p.k === 2 ? 0.5 : 0);
      const k = p.k;
      return Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - (k / 2) * Math.log(2) - M.gammaLn(k / 2));
    },
    cdf: (x, p) => x <= 0 ? 0 : M.lowerGammaRegularized(p.k / 2, x / 2),
    mean: p => p.k,
    variance: p => 2 * p.k,
    domain: p => [0, p.k + 5 * Math.sqrt(2 * p.k) + 3],
    fit: data => {
      const m = Math.max(mean(data), 0.5);
      return { k: Math.max(1, Math.round(m)) };
    }
  };

  // ------------------------------------------------------------- F distribution
  D.fDist = {
    id: 'fDist', label: 'F (فیشر)', shortLabel: 'F-distribution', type: 'continuous',
    formula: 'f(x) = √[(d1x)^d1 d2^d2 / (d1x+d2)^(d1+d2)] / (x·B(d1/2,d2/2))',
    params: [
      { key: 'd1', label: 'درجه آزادی d1', symbol: 'd1', def: 5, min: 1, max: 200, step: 1 },
      { key: 'd2', label: 'درجه آزادی d2', symbol: 'd2', def: 10, min: 1, max: 200, step: 1 }
    ],
    pdf: (x, p) => {
      if (x <= 0) return 0;
      const { d1, d2 } = p;
      const logNum = (d1 / 2) * Math.log(d1) + (d2 / 2) * Math.log(d2) + (d1 / 2 - 1) * Math.log(x);
      const logDen = ((d1 + d2) / 2) * Math.log(d2 + d1 * x) + M.gammaLn(d1 / 2) + M.gammaLn(d2 / 2) - M.gammaLn((d1 + d2) / 2);
      return Math.exp(logNum - logDen);
    },
    cdf: (x, p) => {
      if (x <= 0) return 0;
      const xb = (p.d1 * x) / (p.d1 * x + p.d2);
      return M.incompleteBetaRegularized(xb, p.d1 / 2, p.d2 / 2);
    },
    mean: p => p.d2 > 2 ? p.d2 / (p.d2 - 2) : NaN,
    variance: p => p.d2 > 4 ? (2 * p.d2 * p.d2 * (p.d1 + p.d2 - 2)) / (p.d1 * (p.d2 - 2) ** 2 * (p.d2 - 4)) : NaN,
    domain: p => {
      const mu = p.d2 > 2 ? p.d2 / (p.d2 - 2) : 3;
      return [0, Math.max(mu * 4, 5)];
    },
    fit: data => ({ d1: 6, d2: 10 }) // moment-fitting F params from arbitrary data is ill-posed; sensible default
  };

  // ---------------------------------------------------------- Exponential
  D.exponential = {
    id: 'exponential', label: 'نمایی', shortLabel: 'Exponential', type: 'continuous',
    formula: 'f(x) = λ e^(−λx) ,  x ≥ 0',
    params: [{ key: 'lambda', label: 'نرخ λ', symbol: 'λ', def: 1, min: 0.01, max: 10, step: 0.01 }],
    pdf: (x, p) => x < 0 ? 0 : p.lambda * Math.exp(-p.lambda * x),
    cdf: (x, p) => x < 0 ? 0 : 1 - Math.exp(-p.lambda * x),
    mean: p => 1 / p.lambda,
    variance: p => 1 / (p.lambda * p.lambda),
    domain: p => [0, 6 / p.lambda],
    fit: data => {
      const m = mean(data);
      return { lambda: m > 0 ? 1 / m : 1 };
    }
  };

  // -------------------------------------------------------------- Uniform
  D.uniform = {
    id: 'uniform', label: 'یکنواخت', shortLabel: 'Uniform', type: 'continuous',
    formula: 'f(x) = 1 / (b−a) ,  a ≤ x ≤ b',
    params: [
      { key: 'a', label: 'کران پایین a', symbol: 'a', def: 0, min: -50, max: 50, step: 0.1 },
      { key: 'b', label: 'کران بالا b', symbol: 'b', def: 1, min: -50, max: 50, step: 0.1 }
    ],
    pdf: (x, p) => (x >= p.a && x <= p.b) ? 1 / (p.b - p.a) : 0,
    cdf: (x, p) => M.clamp((x - p.a) / (p.b - p.a), 0, 1),
    mean: p => (p.a + p.b) / 2,
    variance: p => (p.b - p.a) ** 2 / 12,
    domain: p => {
      const pad = (p.b - p.a) * 0.15 || 1;
      return [p.a - pad, p.b + pad];
    },
    fit: data => {
      const lo = Math.min(...data), hi = Math.max(...data);
      return { a: lo, b: hi > lo ? hi : lo + 1 };
    }
  };

  // ---------------------------------------------------------------- Gamma
  D.gamma = {
    id: 'gamma', label: 'گاما', shortLabel: 'Gamma', type: 'continuous',
    formula: 'f(x) = 1 / (Γ(k)·θ^k) · x^(k−1) e^(−x/θ) ,  x ≥ 0',
    params: [
      { key: 'k', label: 'شکل k', symbol: 'k', def: 2, min: 0.1, max: 50, step: 0.1 },
      { key: 'theta', label: 'مقیاس θ', symbol: 'θ', def: 2, min: 0.05, max: 20, step: 0.05 }
    ],
    pdf: (x, p) => {
      if (x < 0) return 0;
      if (x === 0) return p.k < 1 ? Infinity : (p.k === 1 ? 1 / p.theta : 0);
      const { k, theta } = p;
      return Math.exp((k - 1) * Math.log(x) - x / theta - k * Math.log(theta) - M.gammaLn(k));
    },
    cdf: (x, p) => x <= 0 ? 0 : M.lowerGammaRegularized(p.k, x / p.theta),
    mean: p => p.k * p.theta,
    variance: p => p.k * p.theta * p.theta,
    domain: p => [0, p.k * p.theta + 5 * Math.sqrt(p.k) * p.theta + 1],
    fit: data => {
      const m = mean(data), v = variance(data);
      if (m <= 0 || v <= 0) return { k: 2, theta: 1 };
      const theta = v / m, k = m / theta;
      return { k: Math.max(k, 0.1), theta: Math.max(theta, 0.01) };
    }
  };

  // ----------------------------------------------------------------- Beta
  D.beta = {
    id: 'beta', label: 'بتا', shortLabel: 'Beta', type: 'continuous',
    formula: 'f(x) = x^(α−1)(1−x)^(β−1) / B(α,β) ,  0 ≤ x ≤ 1',
    params: [
      { key: 'alpha', label: 'پارامتر α', symbol: 'α', def: 2, min: 0.1, max: 50, step: 0.1 },
      { key: 'beta', label: 'پارامتر β', symbol: 'β', def: 2, min: 0.1, max: 50, step: 0.1 }
    ],
    pdf: (x, p) => {
      if (x < 0 || x > 1) return 0;
      const { alpha, beta } = p;
      if ((x === 0 && alpha < 1) || (x === 1 && beta < 1)) return Infinity;
      if (x === 0 || x === 1) {
        if ((x === 0 && alpha === 1) || (x === 1 && beta === 1)) {
          // finite boundary value
        } else if (x === 0 && alpha > 1) return 0;
        else if (x === 1 && beta > 1) return 0;
      }
      const logPdf = (alpha - 1) * Math.log(x || 1e-300) + (beta - 1) * Math.log(1 - x || 1e-300) - Math.log(M.betaFn(alpha, beta));
      return Math.exp(logPdf);
    },
    cdf: (x, p) => M.incompleteBetaRegularized(M.clamp(x, 0, 1), p.alpha, p.beta),
    mean: p => p.alpha / (p.alpha + p.beta),
    variance: p => (p.alpha * p.beta) / ((p.alpha + p.beta) ** 2 * (p.alpha + p.beta + 1)),
    domain: () => [0, 1],
    fit: data => {
      const inRange = data.filter(v => v >= 0 && v <= 1);
      if (inRange.length < 2) return { alpha: 2, beta: 2 };
      const m = mean(inRange), v = variance(inRange, m);
      if (v <= 0 || v >= m * (1 - m)) return { alpha: 2, beta: 2 };
      const common = m * (1 - m) / v - 1;
      return { alpha: Math.max(m * common, 0.1), beta: Math.max((1 - m) * common, 0.1) };
    }
  };

  // -------------------------------------------------------------- Weibull
  D.weibull = {
    id: 'weibull', label: 'وایبول', shortLabel: 'Weibull', type: 'continuous',
    formula: 'f(x) = (k/λ)(x/λ)^(k−1) e^(−(x/λ)^k) ,  x ≥ 0',
    params: [
      { key: 'k', label: 'شکل k', symbol: 'k', def: 1.5, min: 0.1, max: 20, step: 0.1 },
      { key: 'lambda', label: 'مقیاس λ', symbol: 'λ', def: 1, min: 0.05, max: 20, step: 0.05 }
    ],
    pdf: (x, p) => {
      if (x < 0) return 0;
      const { k, lambda } = p;
      return (k / lambda) * Math.pow(x / lambda, k - 1) * Math.exp(-Math.pow(x / lambda, k));
    },
    cdf: (x, p) => x < 0 ? 0 : 1 - Math.exp(-Math.pow(x / p.lambda, p.k)),
    mean: p => p.lambda * M.gammaFn(1 + 1 / p.k),
    variance: p => p.lambda * p.lambda * (M.gammaFn(1 + 2 / p.k) - M.gammaFn(1 + 1 / p.k) ** 2),
    domain: p => [0, p.lambda * Math.pow(3.5, 1 / p.k) + p.lambda],
    fit: data => {
      // quick moment-based fit via bisection on the shape parameter k
      const m = mean(data), v = variance(data);
      if (m <= 0) return { k: 1.5, lambda: 1 };
      const cv2 = v / (m * m);
      let lo = 0.15, hi = 20;
      const g = k => {
        const G1 = M.gammaFn(1 + 1 / k), G2 = M.gammaFn(1 + 2 / k);
        return G2 / (G1 * G1) - 1 - cv2;
      };
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        if (g(mid) > 0) lo = mid; else hi = mid;
      }
      const k = (lo + hi) / 2;
      const lambda = m / M.gammaFn(1 + 1 / k);
      return { k: Math.max(k, 0.1), lambda: Math.max(lambda, 0.01) };
    }
  };

  // ------------------------------------------------------------- Poisson (discrete)
  D.poisson = {
    id: 'poisson', label: 'پواسون', shortLabel: 'Poisson', type: 'discrete',
    formula: 'P(k) = e^(−λ) λ^k / k!',
    params: [{ key: 'lambda', label: 'نرخ λ', symbol: 'λ', def: 4, min: 0.1, max: 200, step: 0.1 }],
    pmf: (k, p) => {
      if (k < 0 || !Number.isInteger(k)) return 0;
      return Math.exp(-p.lambda + k * Math.log(p.lambda) - M.logFactorial(k));
    },
    cdf: (k, p) => {
      k = Math.floor(k);
      if (k < 0) return 0;
      let s = 0;
      for (let i = 0; i <= k; i++) s += D.poisson.pmf(i, p);
      return M.clamp(s, 0, 1);
    },
    mean: p => p.lambda,
    variance: p => p.lambda,
    domain: p => [0, Math.ceil(p.lambda + 5 * Math.sqrt(p.lambda) + 3)],
    fit: data => ({ lambda: Math.max(mean(data), 0.05) })
  };

  // ------------------------------------------------------------ Binomial (discrete)
  D.binomial = {
    id: 'binomial', label: 'دوجمله‌ای', shortLabel: 'Binomial', type: 'discrete',
    formula: 'P(k) = C(n,k) p^k (1−p)^(n−k)',
    params: [
      { key: 'n', label: 'تعداد آزمایش n', symbol: 'n', def: 20, min: 1, max: 500, step: 1 },
      { key: 'p', label: 'احتمال موفقیت p', symbol: 'p', def: 0.5, min: 0.001, max: 0.999, step: 0.001 }
    ],
    pmf: (k, prm) => {
      if (k < 0 || k > prm.n || !Number.isInteger(k)) return 0;
      return Math.exp(M.logChoose(prm.n, k) + k * Math.log(prm.p) + (prm.n - k) * Math.log(1 - prm.p));
    },
    cdf: (k, prm) => {
      k = Math.floor(k);
      if (k < 0) return 0;
      if (k >= prm.n) return 1;
      let s = 0;
      for (let i = 0; i <= k; i++) s += D.binomial.pmf(i, prm);
      return M.clamp(s, 0, 1);
    },
    mean: p => p.n * p.p,
    variance: p => p.n * p.p * (1 - p.p),
    domain: p => [0, p.n],
    fit: data => {
      const m = mean(data), v = variance(data);
      let n = Math.max(Math.round(m + v > 0 ? m * m / Math.max(m - v, 1e-6) : m * 2), Math.ceil(Math.max(...data, 1)));
      n = Math.max(n, Math.ceil(Math.max(...data, 1)));
      const p = M.clamp(m / n, 0.001, 0.999);
      return { n, p };
    }
  };

  const DISTRIBUTION_ORDER = [
    'normal', 'studentT', 'chiSquare', 'fDist', 'exponential', 'uniform',
    'gamma', 'beta', 'lognormal', 'weibull', 'poisson', 'binomial'
  ];

  // Unified evaluator: works for both continuous (pdf) and discrete (pmf)
  DISTRIBUTION_ORDER.forEach(id => {
    const d = D[id];
    if (d.type === 'discrete' && !d.pdf) d.pdf = d.pmf;
  });

  global.Distributions = D;
  global.DISTRIBUTION_ORDER = DISTRIBUTION_ORDER;
})(window);
