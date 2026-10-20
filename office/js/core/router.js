/**
 * Hash-based router — works on any static host, no server config needed.
 *
 *   const router = createRouter();
 *   router.add('/',           () => homePage.render(outlet));
 *   router.add('/people',     () => peopleListPage.render(outlet));
 *   router.add('/people/:id', ({ params }) => personPage.render(outlet, params.id));
 *   router.start();
 *
 * Routes are written without the leading '#'; the URL is:
 *   https://site.com/#/people/123
 */

import { bus } from '../utils/events.js';

function parsePath(raw) {
  let path = String(raw || '').trim();
  if (path.startsWith('#')) path = path.slice(1);
  if (!path.startsWith('/')) path = '/' + path;
  // Split path + query
  const [p, q] = path.split('?');
  const query = new URLSearchParams(q || '');
  return { path: p || '/', query };
}

function patternToRegex(pattern) {
  const keys = [];
  const normalized = pattern.replace(/\/+$/, '') || '/';
  const reStr = normalized
    .split('/')
    .map((seg) => {
      if (seg.startsWith(':')) {
        keys.push(seg.slice(1));
        return '([^/]+)';
      }
      if (seg.startsWith('*')) {
        keys.push(seg.slice(1));
        return '(.*)';
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { regex: new RegExp(`^${reStr}/?$`), keys };
}

export function createRouter({ outlet = null, base = '' } = {}) {
  const routes = [];
  let currentCleanup = null;
  let active = null;

  function resolve() {
    const raw = window.location.hash || '#/';
    const { path, query } = parsePath(raw);
    for (const route of routes) {
      const m = route.regex.exec(path);
      if (!m) continue;
      const params = {};
      route.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { route, path, params, query };
    }
    return { route: null, path, params: {}, query };
  }

  async function render() {
    const matched = resolve();
    const info = {
      path: matched.path,
      params: matched.params,
      query: matched.query,
      route: matched.route,
      ts: Date.now(),
    };
    active = info;

    // Teardown previous
    if (typeof currentCleanup === 'function') {
      try { await currentCleanup(); } catch (e) { console.error(e); }
      currentCleanup = null;
    }

    bus.emit('route:before', info);

    const handler = matched.route?.handler;
    if (!handler) {
      bus.emit('route:notfound', info);
      return;
    }

    try {
      const result = await handler(info, outlet);
      if (typeof result === 'function') currentCleanup = result;
    } catch (err) {
      console.error('[router]', err);
      bus.emit('route:error', { info, error: err });
    }

    // Scroll to top by default; respect back/forward via replaceState flag
    if (!history.state || !history.state.scroll) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }

    bus.emit('route:after', info);
  }

  function add(pattern, handler) {
    const { regex, keys } = patternToRegex(pattern);
    routes.push({ pattern, regex, keys, handler });
    return api;
  }

  function navigate(path, { replace = false } = {}) {
    const clean = path.startsWith('#') ? path.slice(1) : path;
    const hash = `#${clean.startsWith('/') ? '' : '/'}${clean}`;
    if (replace) {
      window.history.replaceState(null, '', hash);
      render();
    } else if (window.location.hash === hash) {
      render();
    } else {
      window.location.hash = hash;
    }
  }

  function start() {
    if (!outlet) {
      outlet = document.getElementById('app-main');
    }
    if (!window.location.hash) {
      window.history.replaceState(null, '', '#/');
    }
    window.addEventListener('hashchange', render);
    return render();
  }

  function stop() {
    window.removeEventListener('hashchange', render);
  }

  function getCurrent() {
    return active;
  }

  /** Build URL for an app path, ready for use in <a href>. */
  function href(path) {
    const p = String(path || '/');
    return `#${p.startsWith('/') ? '' : '/'}${p}`;
  }

  const api = { add, navigate, start, stop, href, getCurrent, resolve };
  return api;
}

export const router = createRouter();
export default router;