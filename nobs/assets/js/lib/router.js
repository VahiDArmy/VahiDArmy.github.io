/* ==========================================================================
   router.js — مسیریاب هش‌محور سبک با کوئری‌استرینگ
   ========================================================================== */

export function parseRoute(hash = window.location.hash) {
  const raw = String(hash || '').replace(/^#/, '') || '/';
  const [pathPart, queryPart = ''] = raw.split('?');
  let path = pathPart || '/';
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  const query = new URLSearchParams(queryPart);
  return { path, query, raw, full: `#${raw}` };
}

export function currentRoute() {
  return parseRoute();
}

export function buildHash(path, query) {
  const params = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === null || value === undefined || value === '') continue;
      if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
      else params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return `#${path}${qs ? `?${qs}` : ''}`;
}

export function navigate(path, { query, replace = false } = {}) {
  const hash = buildHash(path, query);
  if (window.location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  if (replace) {
    const url = `${window.location.pathname}${window.location.search}${hash}`;
    window.history.replaceState(null, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = hash;
  }
}

export function updateQuery(patch, { replace = true } = {}) {
  const route = currentRoute();
  const params = new URLSearchParams(route.query);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === '' || value === false) params.delete(key);
    else params.set(key, String(value));
  }
  const qs = params.toString();
  const hash = `#${route.path}${qs ? `?${qs}` : ''}`;
  const url = `${window.location.pathname}${window.location.search}${hash}`;
  if (replace) window.history.replaceState(null, '', url);
  else window.location.hash = hash;
}

export function startRouter(handler) {
  let disposed = false;
  const handle = () => {
    if (disposed) return;
    handler(parseRoute());
  };
  window.addEventListener('hashchange', handle);
  if (!window.location.hash) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/`);
  }
  handle();
  return () => {
    disposed = true;
    window.removeEventListener('hashchange', handle);
  };
}

/** لینک داخلی با کلیک */
export function onInternalLinks(root, callback) {
  root.addEventListener('click', (event) => {
    const anchor = event.target.closest?.('a[href^="#/"]');
    if (!anchor) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    const path = anchor.getAttribute('href').replace(/^#/, '');
    callback?.(path);
    window.location.hash = anchor.getAttribute('href').slice(1);
  });
}
