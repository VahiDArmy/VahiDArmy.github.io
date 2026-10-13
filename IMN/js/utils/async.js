/**
 * Async + timing utilities: debounce, throttle, sleep, retry, timeout,
 * and a small promise pool so we can limit concurrent Supabase calls.
 */

export function debounce(fn, wait = 250, { leading = false, trailing = true } = {}) {
  let timer = null;
  let calledLeading = false;
  return function debounced(...args) {
    const invoke = () => {
      timer = null;
      calledLeading = false;
      if (trailing) fn.apply(this, args);
    };
    const callNow = leading && !calledLeading;
    if (timer) clearTimeout(timer);
    if (callNow) {
      calledLeading = true;
      fn.apply(this, args);
    }
    timer = setTimeout(invoke, wait);
  };
}

export function throttle(fn, wait = 250, { leading = true, trailing = true } = {}) {
  let last = 0;
  let timer = null;
  let lastArgs = null;
  return function throttled(...args) {
    const now = Date.now();
    if (!last && !leading) last = now;
    const remaining = wait - (now - last);
    lastArgs = args;
    if (remaining <= 0 || remaining > wait) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      last = now;
      fn.apply(this, args);
    } else if (!timer && trailing) {
      timer = setTimeout(() => {
        last = leading ? Date.now() : 0;
        timer = null;
        fn.apply(this, lastArgs);
      }, remaining);
    }
  };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Retry an async fn with exponential backoff.
 * Won't retry on 4xx (except 429) since those are permanent.
 */
export async function retry(fn, {
  attempts = 3,
  base = 300,
  factor = 2,
  jitter = 120,
  onRetry,
  shouldRetry = (err) => {
    const status = err?.status ?? err?.statusCode;
    if (status && status >= 400 && status < 500 && status !== 429) return false;
    return true;
  },
} = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1 || !shouldRetry(err)) break;
      const delay = base * Math.pow(factor, i) + Math.random() * jitter;
      onRetry?.(err, i + 1, delay);
      await sleep(delay);
    }
  }
  throw lastErr;
}

/**
 * Run an array of async thunks with a concurrency limit.
 * Returns results in original order.
 */
export async function pool(tasks, limit = 4) {
  const results = new Array(tasks.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= tasks.length) return;
      results[i] = await tasks[i]();
    }
  });
  await Promise.all(workers);
  return results;
}

/** Wrap a promise so it resolves to { data, error } like Supabase does. */
export async function settle(promise) {
  try {
    const data = await promise;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Race a promise against a timeout. Rejects with a recognizable error
 * so callers can branch on it (e.g. `err.message === "AUTH_INIT_TIMEOUT"`).
 *
 * The underlying promise is NOT cancelled — it keeps running and its
 * eventual result/rejection is swallowed to avoid "unhandled rejection"
 * noise in the console.
 */
export function withTimeout(promise, ms, message = "TIMEOUT") {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => {
      const err = new Error(message);
      err.code = message;
      reject(err);
    }, ms);
  });
  return Promise.race([
    promise.then(
      (v) => {
        clearTimeout(t);
        return v;
      },
      (e) => {
        clearTimeout(t);
        throw e;
      }
    ),
    timeout,
  ]);
}