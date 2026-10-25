/* ==========================================================================
   Utils — Debounce / Throttle / RAF
   ========================================================================== */

(function (window) {
  'use strict';

  const App = (window.App = window.App || {});

  /**
   * Standard debounce — last call wins.
   * @param {Function} fn
   * @param {number} waitMs
   * @param {boolean} [immediate]
   */
  function debounce(fn, waitMs, immediate) {
    let timer = null;
    return function debounced() {
      const ctx = this;
      const args = arguments;
      const callNow = immediate && !timer;
      const later = function () {
        timer = null;
        if (!immediate) fn.apply(ctx, args);
      };
      if (timer) clearTimeout(timer);
      timer = setTimeout(later, waitMs);
      if (callNow) fn.apply(ctx, args);
    };
  }

  /**
   * Throttle — first call runs immediately, subsequent calls at most once per waitMs.
   */
  function throttle(fn, waitMs) {
    let last = 0;
    let timer = null;
    let pending = null;
    return function throttled() {
      const now = Date.now();
      const args = arguments;
      const ctx = this;
      const remaining = waitMs - (now - last);
      if (remaining <= 0) {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        last = now;
        fn.apply(ctx, args);
      } else {
        pending = args;
        if (!timer) {
          timer = setTimeout(() => {
            timer = null;
            last = Date.now();
            if (pending) {
              fn.apply(ctx, pending);
              pending = null;
            }
          }, remaining);
        }
      }
    };
  }

  /**
   * requestAnimationFrame debounced batch.
   */
  function rafBatch(fn) {
    let scheduled = false;
    let args = null;
    return function () {
      args = arguments;
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        fn.apply(this, args);
      });
    };
  }

  /**
   * Delay promise.
   */
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  App.Utils = App.Utils || {};
  App.Utils.debounce = debounce;
  App.Utils.throttle = throttle;
  App.Utils.rafBatch = rafBatch;
  App.Utils.delay = delay;
})(window);