/* ============================================================
   js/utils/performance.js
   Measurement, lazy loading, and preload helpers
   ============================================================ */

import { onIdle } from './debounce.js';

/* ── Marks & measures ────────────────────────────────────── */

const marks = new Map();

/**
 * Start a named performance mark.
 * @param {string} name
 */
export function mark(name) {
  marks.set(name, performance.now());
  try { performance.mark(`app:${name}:start`); } catch { /* noop */ }
}

/**
 * End a named mark and record a measure.
 * @param {string} name
 * @returns {number} elapsed ms
 */
export function measure(name) {
  const start = marks.get(name);
  if (start === undefined) return 0;
  const elapsed = performance.now() - start;
  marks.delete(name);
  try {
    performance.measure(`app:${name}`, `app:${name}:start`);
  } catch { /* noop */ }
  return elapsed;
}

/**
 * Wrap an async function to measure its duration.
 * @template T
 * @param {string} name
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function timed(name, fn) {
  mark(name);
  try {
    return await fn();
  } finally {
    const elapsed = measure(name);
    if (elapsed > 500) {
      console.info(`[perf] ${name}: ${elapsed.toFixed(1)}ms`);
    }
  }
}

/* ── Lazy import with retry ──────────────────────────────── */

const importCache = new Map();

/**
 * Import a module with caching + one retry on network failure.
 * @param {string} path
 * @returns {Promise<any>}
 */
export async function importModule(path) {
  if (importCache.has(path)) return importCache.get(path);
  const promise = (async () => {
    try {
      return await import(/* @vite-ignore */ path);
    } catch (err) {
      // Retry once after a short backoff
      await new Promise((r) => setTimeout(r, 400));
      return import(/* @vite-ignore */ path);
    }
  })();
  importCache.set(path, promise);
  return promise;
}

/**
 * Preload a module during idle time.
 * @param {string} path
 */
export function preloadModule(path) {
  onIdle(() => {
    importModule(path).catch(() => { /* ignore */ });
  });
}

/* ── Lazy rendering with IntersectionObserver ───────────── */

/**
 * Lazily call `render` when an element enters the viewport.
 * @param {HTMLElement} host
 * @param {() => Node|Promise<Node>} render
 * @param {{ rootMargin?:string, threshold?:number }} [opts]
 * @returns {() => void} disconnect
 */
export function lazyRender(host, render, opts = {}) {
  const { rootMargin = '300px', threshold = 0 } = opts;
  if (!('IntersectionObserver' in window)) {
    Promise.resolve(render()).then((node) => node && host.appendChild(node));
    return () => {};
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        io.disconnect();
        Promise.resolve(render()).then((node) => node && host.appendChild(node));
      }
    }
  }, { rootMargin, threshold });
  io.observe(host);
  return () => io.disconnect();
}

/* ── Interaction measurement ────────────────────────────── */

/**
 * Report slow interactions (>200ms) to console.
 */
export function observeInteractions() {
  if (!('PerformanceObserver' in window)) return () => {};
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 200) {
          console.info(`[perf] slow interaction: ${entry.name} ${entry.duration.toFixed(1)}ms`);
        }
      }
    });
    po.observe({ type: 'event', buffered: true, durationThreshold: 100 });
    return () => po.disconnect();
  } catch {
    return () => {};
  }
}

/**
 * Report long tasks to console (dev only).
 */
export function observeLongTasks() {
  if (!('PerformanceObserver' in window)) return () => {};
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 100) {
          console.info(`[perf] long task: ${entry.duration.toFixed(1)}ms`);
        }
      }
    });
    po.observe({ type: 'longtask', buffered: true });
    return () => po.disconnect();
  } catch {
    return () => {};
  }
}

/* ── Snapshot ────────────────────────────────────────────── */

/**
 * Get a performance snapshot for logging/debugging.
 * @returns {object}
 */
export function getSnapshot() {
  const nav = performance.getEntriesByType('navigation')[0];
  const paint = performance.getEntriesByType('paint');
  const fcp = paint.find((p) => p.name === 'first-contentful-paint');
  return {
    domContentLoaded: nav ? nav.domContentLoadedEventEnd - nav.startTime : null,
    loadComplete: nav ? nav.loadEventEnd - nav.startTime : null,
    firstPaint: paint[0]?.startTime ?? null,
    firstContentfulPaint: fcp?.startTime ?? null,
    memory: performance.memory
      ? {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit,
        }
      : null,
    connection: navigator.connection
      ? {
          effectiveType: navigator.connection.effectiveType,
          downlink: navigator.connection.downlink,
          rtt: navigator.connection.rtt,
        }
      : null,
  };
}

export default {
  mark, measure, timed, importModule, preloadModule,
  lazyRender, observeInteractions, observeLongTasks, getSnapshot,
};