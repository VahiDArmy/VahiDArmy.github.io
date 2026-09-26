/**
 * stats-utils.js
 * Descriptive statistics, adaptive histogram binning, and a simple
 * goodness-of-fit score (used to rank candidate distributions against
 * an empirical histogram for the "best fit" suggestion).
 *
 * Exposed on window.StatsUtils.
 */
(function (global) {
  'use strict';

  function sorted(arr) {
    return [...arr].sort((a, b) => a - b);
  }

  function mean(arr) {
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }

  function percentile(sortedArr, p) {
    const n = sortedArr.length;
    if (n === 0) return NaN;
    if (n === 1) return sortedArr[0];
    const idx = (p / 100) * (n - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    if (lo === hi) return sortedArr[lo];
    const frac = idx - lo;
    return sortedArr[lo] * (1 - frac) + sortedArr[hi] * frac;
  }

  function describe(data) {
    const n = data.length;
    if (n === 0) {
      return { n: 0 };
    }
    const s = sorted(data);
    const m = mean(data);
    const variance = n > 1 ? data.reduce((acc, v) => acc + (v - m) ** 2, 0) / (n - 1) : 0;
    const std = Math.sqrt(variance);
    let skewness = 0, kurtosis = 0;
    if (n > 2 && std > 0) {
      const m3 = data.reduce((acc, v) => acc + Math.pow(v - m, 3), 0) / n;
      const popStd = Math.sqrt(data.reduce((acc, v) => acc + (v - m) ** 2, 0) / n);
      skewness = m3 / Math.pow(popStd, 3);
    }
    if (n > 3 && std > 0) {
      const m4 = data.reduce((acc, v) => acc + Math.pow(v - m, 4), 0) / n;
      const popStd = Math.sqrt(data.reduce((acc, v) => acc + (v - m) ** 2, 0) / n);
      kurtosis = m4 / Math.pow(popStd, 4) - 3; // excess kurtosis
    }
    const q1 = percentile(s, 25), q3 = percentile(s, 75);
    return {
      n, mean: m, variance, std,
      min: s[0], max: s[n - 1],
      median: percentile(s, 50),
      q1, q3, iqr: q3 - q1,
      skewness, kurtosis
    };
  }

  // Freedman–Diaconis bin width, falling back to Sturges' rule when
  // the IQR collapses (e.g. many repeated values).
  function suggestBinCount(data) {
    const n = data.length;
    if (n < 2) return 1;
    const s = sorted(data);
    const q1 = percentile(s, 25), q3 = percentile(s, 75);
    const iqr = q3 - q1;
    const range = s[n - 1] - s[0];
    if (range === 0) return 1;
    let width = iqr > 0 ? 2 * iqr * Math.pow(n, -1 / 3) : 0;
    let bins;
    if (width > 0) {
      bins = Math.ceil(range / width);
    } else {
      bins = Math.ceil(Math.log2(n) + 1); // Sturges
    }
    return Math.max(4, Math.min(bins, 80));
  }

  // Builds a normalized-density histogram (bars integrate to 1, so it
  // overlays directly against a continuous PDF).
  function histogram(data, binCount) {
    const n = data.length;
    const lo = Math.min(...data), hi = Math.max(...data);
    const count = binCount || suggestBinCount(data);
    if (hi === lo) {
      return { bins: [{ x0: lo - 0.5, x1: lo + 0.5, count: n, density: n }], binWidth: 1 };
    }
    const width = (hi - lo) / count;
    const counts = new Array(count).fill(0);
    data.forEach(v => {
      let idx = Math.floor((v - lo) / width);
      if (idx >= count) idx = count - 1;
      if (idx < 0) idx = 0;
      counts[idx]++;
    });
    const bins = counts.map((c, i) => ({
      x0: lo + i * width,
      x1: lo + (i + 1) * width,
      count: c,
      density: c / (n * width)
    }));
    return { bins, binWidth: width };
  }

  // Root-mean-square deviation between the empirical density histogram
  // and a candidate PDF sampled at each bin's midpoint. Lower is better.
  // Used only to rank distributions relative to one another, not as a
  // formal statistical test.
  function fitScore(bins, pdfFn) {
    if (!bins.length) return Infinity;
    let sse = 0;
    bins.forEach(b => {
      const mid = (b.x0 + b.x1) / 2;
      const modelDensity = pdfFn(mid);
      const diff = (Number.isFinite(modelDensity) ? modelDensity : 0) - b.density;
      sse += diff * diff;
    });
    return Math.sqrt(sse / bins.length);
  }

  global.StatsUtils = {
    describe,
    histogram,
    suggestBinCount,
    fitScore,
    percentile,
    sorted
  };
})(window);
