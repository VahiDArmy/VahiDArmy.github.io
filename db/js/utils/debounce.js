/**
 * توابع کمکی برای تأخیر و بهینه‌سازی اجرا
 */

/**
 * Debounce - اجرا بعد از توقف فراخوانی
 */
function debounce(fn, wait = 300, options = {}) {
  let timeoutId = null;
  let lastArgs = null;
  let lastThis = null;
  let lastCallTime = 0;
  let lastInvokeTime = 0;
  const maxWait = options.maxWait;
  const leading = Boolean(options.leading);
  const trailing = options.trailing !== false;

  function invokeFunc(time) {
    const args = lastArgs;
    const thisArg = lastThis;
    lastArgs = null;
    lastThis = null;
    lastInvokeTime = time;
    return fn.apply(thisArg, args);
  }

  function shouldInvoke(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;

    return (
      lastCallTime === 0 ||
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0 ||
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    );
  }

  function timerExpired() {
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;
    const timeWaiting = wait - timeSinceLastCall;
    const remainingWait = maxWait !== undefined
      ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
      : timeWaiting;

    timeoutId = setTimeout(timerExpired, remainingWait);
  }

  function trailingEdge(time) {
    timeoutId = null;
    if (trailing && lastArgs) {
      return invokeFunc(time);
    }
    lastArgs = null;
    lastThis = null;
    return undefined;
  }

  function cancel() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    lastInvokeTime = 0;
    lastArgs = null;
    lastCallTime = 0;
    lastThis = null;
    timeoutId = null;
  }

  function flush() {
    if (timeoutId === null) return undefined;
    return trailingEdge(Date.now());
  }

  function pending() {
    return timeoutId !== null;
  }

  function debounced(...args) {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (timeoutId === null) {
        return leadingEdge(time);
      }
      if (maxWait !== undefined) {
        timeoutId = setTimeout(timerExpired, wait);
        return invokeFunc(time);
      }
    }

    if (timeoutId === null) {
      timeoutId = setTimeout(timerExpired, wait);
    }

    return undefined;
  }

  function leadingEdge(time) {
    lastInvokeTime = time;
    timeoutId = setTimeout(timerExpired, wait);
    return leading ? invokeFunc(time) : undefined;
  }

  debounced.cancel = cancel;
  debounced.flush = flush;
  debounced.pending = pending;

  return debounced;
}

/**
 * Throttle - محدودسازی نرخ اجرا
 */
function throttle(fn, wait = 300, options = {}) {
  const leading = options.leading !== false;
  const trailing = options.trailing !== false;
  let timeoutId = null;
  let lastArgs = null;
  let lastThis = null;
  let lastInvokeTime = 0;

  function invokeFunc(time) {
    const args = lastArgs;
    const thisArg = lastThis;
    lastArgs = null;
    lastThis = null;
    lastInvokeTime = time;
    return fn.apply(thisArg, args);
  }

  function throttled(...args) {
    const time = Date.now();
    const isInvoking = !lastInvokeTime || time - lastInvokeTime >= wait;

    lastArgs = args;
    lastThis = this;

    if (isInvoking) {
      if (timeoutId === null && leading) {
        return invokeFunc(time);
      }
    }

    if (timeoutId === null) {
      timeoutId = setTimeout(() => {
        timeoutId = null;
        if (trailing && lastArgs) {
          invokeFunc(Date.now());
        }
      }, wait - (lastInvokeTime ? time - lastInvokeTime : 0));
    }

    return undefined;
  }

  throttled.cancel = () => {
    if (timeoutId !== null) clearTimeout(timeoutId);
    timeoutId = null;
    lastArgs = null;
    lastThis = null;
    lastInvokeTime = 0;
  };

  throttled.flush = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (lastArgs) {
      return invokeFunc(Date.now());
    }
    return undefined;
  };

  return throttled;
}

/**
 * rAF Throttle - هماهنگ با نرخ فریم
 */
function rafThrottle(fn) {
  let rafId = null;
  let lastArgs = null;

  function throttled(...args) {
    lastArgs = args;
    if (rafId !== null) return;

    rafId = requestAnimationFrame(() => {
      fn.apply(this, lastArgs);
      rafId = null;
      lastArgs = null;
    });
  }

  throttled.cancel = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
      lastArgs = null;
    }
  };

  return throttled;
}

/**
 * Deep Clone - کپی عمیق
 */
function deepClone(obj, options = {}) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof RegExp) return new RegExp(obj.source, obj.flags);
  if (obj instanceof Map) return new Map(Array.from(obj, ([k, v]) => [deepClone(k), deepClone(v)]));
  if (obj instanceof Set) return new Set(Array.from(obj, v => deepClone(v)));
  if (obj instanceof ArrayBuffer) return obj.slice(0);
  if (obj instanceof Uint8Array) return new Uint8Array(obj);

  const seen = new WeakMap();

  function clone(value) {
    if (value === null || typeof value !== 'object') return value;
    if (seen.has(value)) return seen.get(value);
    if (value instanceof Date) return new Date(value.getTime());
    if (value instanceof RegExp) return new RegExp(value.source, value.flags);
    if (value instanceof Map) return new Map(Array.from(value, ([k, v]) => [clone(k), clone(v)]));
    if (value instanceof Set) return new Set(Array.from(value, v => clone(v)));

    const cloned = Array.isArray(value)
      ? []
      : Object.create(Object.getPrototypeOf(value));

    seen.set(value, cloned);

    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        cloned[i] = clone(item);
      });
    } else {
      Object.keys(value).forEach(key => {
        cloned[key] = clone(value[key]);
      });

      if (options.includeSymbols) {
        Object.getOwnPropertySymbols(value).forEach(sym => {
          if (Object.getOwnPropertyDescriptor(value, sym).enumerable) {
            cloned[sym] = clone(value[sym]);
          }
        });
      }
    }

    return cloned;
  }

  return clone(obj);
}

/**
 * Deep Merge - ادغام عمیق
 */
function deepMerge(target, ...sources) {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isMergeableObject(target) && isMergeableObject(source)) {
    Object.keys(source).forEach(key => {
      if (isMergeableObject(source[key])) {
        if (!target[key]) target[key] = Array.isArray(source[key]) ? [] : {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    });
  }

  return deepMerge(target, ...sources);
}

function isMergeableObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Memoize - کش کردن نتیجه
 */
function memoize(fn, options = {}) {
  const cache = new Map();
  const keyResolver = options.keyResolver || ((...args) => JSON.stringify(args));
  const maxSize = options.maxSize || 1000;
  const ttl = options.ttl;

  function memoized(...args) {
    const key = keyResolver(...args);

    if (cache.has(key)) {
      const entry = cache.get(key);
      if (!ttl || Date.now() - entry.timestamp < ttl) {
        return entry.value;
      }
      cache.delete(key);
    }

    const value = fn.apply(this, args);
    cache.set(key, { value, timestamp: Date.now() });

    if (cache.size > maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    return value;
  }

  memoized.cache = cache;
  memoized.clear = () => cache.clear();
  memoized.delete = (key) => cache.delete(key);

  return memoized;
}

/**
 * Once - اجرای یک‌بار
 */
function once(fn) {
  let called = false;
  let result;

  return function (...args) {
    if (!called) {
      called = true;
      result = fn.apply(this, args);
    }
    return result;
  };
}

/**
 * After - اجرا بعد از n بار
 */
function after(n, fn) {
  let count = 0;
  return function (...args) {
    if (++count >= n) {
      return fn.apply(this, args);
    }
    return undefined;
  };
}

/**
 * Before - اجرا قبل از n بار
 */
function before(n, fn) {
  let count = 0;
  let result;
  return function (...args) {
    if (--n > 0) {
      result = fn.apply(this, args);
    }
    if (n <= 1) {
      fn = null;
    }
    return result;
  };
}

/**
 * Delay - اجرا با تأخیر
 */
function delay(fn, wait = 0, ...args) {
  return setTimeout(() => fn(...args), wait);
}

/**
 * Retry - تلاش مجدد
 */
async function retry(fn, options = {}) {
  const maxAttempts = options.maxAttempts || 3;
  const delay = options.delay || 1000;
  const backoff = options.backoff || 2;
  const onRetry = options.onRetry;

  let lastError;
  let wait = delay;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (onRetry) onRetry(error, i + 1);
      if (i < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, wait));
        wait *= backoff;
      }
    }
  }

  throw lastError;
}

/**
 * Timeout - محدودیت زمانی
 */
function withTimeout(promise, ms, message = 'عملیات به پایان نرسید') {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

/**
 * Promisify
 */
function promisify(fn) {
  return function (...args) {
    return new Promise((resolve, reject) => {
      fn(...args, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  };
}

// Export to global scope
window.debounce = debounce;
window.throttle = throttle;
window.rafThrottle = rafThrottle;
window.deepClone = deepClone;
window.deepMerge = deepMerge;
window.memoize = memoize;
window.once = once;
window.after = after;
window.before = before;
window.delay = delay;
window.retry = retry;
window.withTimeout = withTimeout;
window.promisify = promisify;