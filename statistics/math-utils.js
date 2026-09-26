/**
 * math-utils.js
 * Special functions needed to evaluate statistical distributions:
 * log-gamma, gamma, error function, and the regularized incomplete
 * gamma / beta functions (used for CDFs of chi-square, t, F, gamma,
 * beta, binomial, poisson, ...).
 *
 * Implementations follow the standard Lanczos / continued-fraction
 * algorithms used throughout numerical computing. No external deps.
 *
 * Exposed on window.MathUtils.
 */
(function (global) {
  'use strict';

  const LANCZOS_G = 5.5;
  const LANCZOS_COF = [
    1.000000000190015,
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.1208650973866179e-2,
    -0.5395239384953e-5
  ];

  // ln(Gamma(x)) for x > 0
  function gammaLn(x) {
    let y = x;
    let tmp = x + LANCZOS_G;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = LANCZOS_COF[0];
    for (let j = 1; j <= 6; j++) {
      y += 1;
      ser += LANCZOS_COF[j] / y;
    }
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }

  function gammaFn(x) {
    if (x <= 0 && Number.isInteger(x)) return NaN; // poles at 0, -1, -2, ...
    if (x > 0) return Math.exp(gammaLn(x));
    // reflection formula for x < 0, non-integer
    return Math.PI / (Math.sin(Math.PI * x) * Math.exp(gammaLn(1 - x)));
  }

  function logFactorial(n) {
    return gammaLn(n + 1);
  }

  // log( n choose k ), numerically stable for large n
  function logChoose(n, k) {
    if (k < 0 || k > n) return -Infinity;
    return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
  }

  // erf via Abramowitz & Stegun 7.1.26 (max error ~1.5e-7)
  function erf(x) {
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741,
      a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
  }

  // Regularized lower incomplete gamma P(a,x), series form (x < a+1)
  function gammaSeries(a, x) {
    if (x <= 0) return 0;
    const gln = gammaLn(a);
    let ap = a, sum = 1 / a, del = sum;
    for (let n = 1; n <= 300; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-15) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - gln);
  }

  // Regularized upper incomplete gamma Q(a,x) via continued fraction (x >= a+1)
  function gammaCF(a, x) {
    const gln = gammaLn(a);
    const FPMIN = 1e-300;
    let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
    for (let i = 1; i <= 300; i++) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-15) break;
    }
    return Math.exp(-x + a * Math.log(x) - gln) * h;
  }

  function lowerGammaRegularized(a, x) {
    if (x < 0 || a <= 0) return NaN;
    if (x === 0) return 0;
    if (x < a + 1) return gammaSeries(a, x);
    return 1 - gammaCF(a, x);
  }

  function upperGammaRegularized(a, x) {
    if (x < 0 || a <= 0) return NaN;
    if (x === 0) return 1;
    if (x < a + 1) return 1 - gammaSeries(a, x);
    return gammaCF(a, x);
  }

  // Continued fraction for the regularized incomplete beta function
  function betaCF(a, b, x) {
    const MAXIT = 300, EPS = 1e-15, FPMIN = 1e-300;
    const qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= MAXIT; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }

  // Regularized incomplete beta I_x(a,b)
  function incompleteBetaRegularized(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(
      gammaLn(a + b) - gammaLn(a) - gammaLn(b) + a * Math.log(x) + b * Math.log(1 - x)
    );
    if (x < (a + 1) / (a + b + 2)) {
      return bt * betaCF(a, b, x) / a;
    }
    return 1 - bt * betaCF(b, a, 1 - x) / b;
  }

  function betaFn(a, b) {
    return Math.exp(gammaLn(a) + gammaLn(b) - gammaLn(a + b));
  }

  // clamp helper used across the app
  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  global.MathUtils = {
    gammaLn,
    gammaFn,
    logFactorial,
    logChoose,
    erf,
    lowerGammaRegularized,
    upperGammaRegularized,
    incompleteBetaRegularized,
    betaFn,
    clamp
  };
})(window);
