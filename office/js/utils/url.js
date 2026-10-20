/**
 * URL query helpers — used to persist filter/sort/page state in the hash
 * so that refresh, back/forward, and share links all behave correctly.
 */

export function getQuery() {
  const raw = window.location.hash || '#/';
  const idx = raw.indexOf('?');
  if (idx === -1) return new URLSearchParams();
  return new URLSearchParams(raw.slice(idx + 1));
}

export function getQueryParam(key, fallback = null) {
  const v = getQuery().get(key);
  return v == null ? fallback : v;
}

/**
 * Update the current hash's query string without navigating.
 * (Keeps the path portion intact, no hashchange event fired.)
 */
export function setQuery(patch, { replace = true } = {}) {
  const raw = window.location.hash || '#/';
  const qIdx = raw.indexOf('?');
  const path = qIdx === -1 ? raw : raw.slice(0, qIdx);
  const params = new URLSearchParams(qIdx === -1 ? '' : raw.slice(qIdx + 1));

  for (const [k, v] of Object.entries(patch || {})) {
    if (v == null || v === '' || v === 'all') params.delete(k);
    else params.set(k, String(v));
  }

  const qs = params.toString();
  const next = path + (qs ? '?' + qs : '');
  if (replace) {
    window.history.replaceState(null, '', next);
  } else {
    window.location.hash = next;
  }
}

/** Build a full hash href from path + params. */
export function buildHref(path, params = {}) {
  const p = String(path || '/');
  const normalized = p.startsWith('/') ? p : `/${p}`;
  const entries = Object.entries(params || {})
    .filter(([, v]) => v != null && v !== '' && v !== 'all')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return `#${normalized}${entries.length ? '?' + entries.join('&') : ''}`;
}

/** Read a numeric query param with sane defaults. */
export function getQueryInt(key, fallback = 0) {
  const v = getQueryParam(key);
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}