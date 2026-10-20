/**
 * Debounce / throttle utilities.
 */

export function debounce(fn, wait = 250, { immediate = false } = {}) {
  let timer = null;
  let lastArgs = null;
  let lastThis = null;

  function invoke() {
    timer = null;
    if (lastArgs) {
      fn.apply(lastThis, lastArgs);
      lastArgs = null;
      lastThis = null;
    }
  }

  function debounced(...args) {
    lastArgs = args;
    lastThis = this;
    if (immediate && timer === null) {
      invoke();
      return;
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(invoke, wait);
  }

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
    lastThis = null;
  };

  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer);
      invoke();
    }
  };

  return debounced;
}

export function throttle(fn, wait = 200) {
  let last = 0;
  let timer = null;
  let lastArgs = null;

  return function throttled(...args) {
    const now = Date.now();
    const remaining = wait - (now - last);
    lastArgs = args;
    if (remaining <= 0) {
      last = now;
      fn.apply(this, lastArgs);
      lastArgs = null;
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        last = Date.now();
        if (lastArgs) {
          fn.apply(this, lastArgs);
          lastArgs = null;
        }
      }, remaining);
    }
  };
}

/** requestAnimationFrame-based throttle — ideal for scroll/resize. */
export function rafThrottle(fn) {
  let scheduled = false;
  let lastArgs = null;
  return function throttled(...args) {
    lastArgs = args;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      fn.apply(this, lastArgs);
    });
  };
}

/** Run a function only once. */
export function once(fn) {
  let called = false;
  let result;
  return function wrapped(...args) {
    if (called) return result;
    called = true;
    result = fn.apply(this, args);
    return result;
  };
}