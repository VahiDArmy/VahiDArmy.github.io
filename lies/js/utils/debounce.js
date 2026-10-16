/* ============================================================
   js/utils/debounce.js
   Timing helpers: debounce, throttle, raf, idle, sleep
   ============================================================ */

/**
 * Debounce a function: fires after `wait` ms of silence.
 * @template {(...a:any[])=>any} F
 * @param {F} fn
 * @param {number} [wait=250]
 * @param {{leading?:boolean, trailing?:boolean}} [opts]
 * @returns {F & {cancel:()=>void, flush:()=>void}}
 */
export function debounce(fn, wait = 250, opts = {}) {
  const { leading = false, trailing = true } = opts;
  let timer = null;
  let lastArgs = null;
  let lastThis = null;
  let invokedLeading = false;

  function invoke() {
    if (!lastArgs) return;
    const args = lastArgs;
    const self = lastThis;
    lastArgs = null;
    lastThis = null;
    fn.apply(self, args);
  }

  function debounced(...args) {
    lastArgs = args;
    lastThis = this;

    const callNow = leading && !timer;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (trailing && lastArgs) invoke();
      invokedLeading = false;
    }, wait);

    if (callNow && !invokedLeading) {
      invokedLeading = true;
      invoke();
    }
  }

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
    lastThis = null;
    invokedLeading = false;
  };
  debounced.flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    invoke();
    invokedLeading = false;
  };

  return debounced;
}

/**
 * Throttle: fires at most once per `wait` ms.
 * @template {(...a:any[])=>any} F
 * @param {F} fn
 * @param {number} [wait=200]
 * @param {{leading?:boolean, trailing?:boolean}} [opts]
 * @returns {F & {cancel:()=>void}}
 */
export function throttle(fn, wait = 200, opts = {}) {
  const { leading = true, trailing = true } = opts;
  let last = 0;
  let timer = null;
  let lastArgs = null;
  let lastThis = null;

  function invoke() {
    if (!lastArgs) return;
    const args = lastArgs;
    const self = lastThis;
    lastArgs = null;
    lastThis = null;
    last = Date.now();
    fn.apply(self, args);
  }

  function throttled(...args) {
    lastArgs = args;
    lastThis = this;
    const now = Date.now();
    const remaining = wait - (now - last);

    if (remaining <= 0) {
      if (timer) { clearTimeout(timer); timer = null; }
      if (leading) invoke();
    } else if (!timer && trailing) {
      timer = setTimeout(() => {
        timer = null;
        invoke();
      }, remaining);
    }
  }

  throttled.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
    lastThis = null;
    last = 0;
  };

  return throttled;
}

/**
 * requestAnimationFrame-based throttle (ideal for scroll/resize).
 * @template {(...a:any[])=>any} F
 * @param {F} fn
 * @returns {F & {cancel:()=>void}}
 */
export function rafThrottle(fn) {
  let frame = 0;
  let lastArgs = null;
  function raf(...args) {
    lastArgs = args;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      fn.apply(null, lastArgs);
    });
  }
  raf.cancel = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastArgs = null;
  };
  return raf;
}

/**
 * Sleep for N milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Run a callback when the browser is idle.
 * @param {() => void} fn
 * @param {{timeout?:number}} [opts]
 */
export function onIdle(fn, opts = {}) {
  const { timeout = 2000 } = opts;
  if (typeof requestIdleCallback === 'function') {
    return requestIdleCallback(fn, { timeout });
  }
  return setTimeout(fn, 1);
}

/**
 * Cancel a pending onIdle handle.
 * @param {any} handle
 */
export function cancelIdle(handle) {
  if (typeof cancelIdleCallback === 'function') cancelIdleCallback(handle);
  else clearTimeout(handle);
}

/**
 * Batch a series of calls into a single microtask invocation.
 * @template {(...a:any[])=>any} F
 * @param {F} fn
 * @returns {F}
 */
export function microtask(fn) {
  let queued = false;
  let lastArgs = null;
  return function batched(...args) {
    lastArgs = args;
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      fn.apply(null, lastArgs);
    });
  };
}

/**
 * Simple token-bucket rate limiter.
 * @param {number} maxTokens
 * @param {number} refillPerSec
 * @returns {{ tryRemove:(n?:number)=>boolean }}
 */
export function rateLimiter(maxTokens, refillPerSec) {
  let tokens = maxTokens;
  let last = performance.now();
  return {
    tryRemove(n = 1) {
      const now = performance.now();
      const elapsed = (now - last) / 1000;
      tokens = Math.min(maxTokens, tokens + elapsed * refillPerSec);
      last = now;
      if (tokens >= n) { tokens -= n; return true; }
      return false;
    },
  };
}