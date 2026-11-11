/* ============================================================
   THEORIES STUDIO — Hash router
   ============================================================ */
import { emit, setState } from './state.js';
import { parseQuery } from './utils.js';

const routes = new Map();
let current = null;
let beforeLeave = null;

const ROUTE_DEFS = [
  { name: 'home', pattern: /^\/home\/?$/, default: true },
  { name: 'theories', pattern: /^\/theories\/?$/ },
  { name: 'theory-new', pattern: /^\/theories\/new\/?$/ },
  { name: 'theory-edit', pattern: /^\/theories\/([^/]+)\/edit\/?$/ },
  { name: 'theory', pattern: /^\/theories\/([^/]+)\/?$/, params: ['id'] },
  { name: 'objects', pattern: /^\/objects\/?$/ },
  { name: 'object', pattern: /^\/objects\/([^/]+)\/?$/, params: ['id'] },
  { name: 'gallery', pattern: /^\/gallery\/?$/ },
  { name: 'timeline', pattern: /^\/timeline\/?$/ },
  { name: 'bookmarks', pattern: /^\/bookmarks\/?$/ },
  { name: 'search', pattern: /^\/search\/?$/ },
  { name: 'settings', pattern: /^\/settings\/?$/ },
  { name: 'auth', pattern: /^\/auth\/?$/ },
  { name: 'not-found', pattern: /^.*$/, last: true }
];

export const registerRoute = (name, handler) => {
  routes.set(name, handler);
};

export const setBeforeLeave = (fn) => { beforeLeave = fn; };

const parseHash = () => {
  const raw = window.location.hash.replace(/^#/, '') || '/home';
  const [path, query = ''] = raw.split('?');
  return { path: path || '/home', query: parseQuery(query), full: raw };
};

export const matchRoute = (path) => {
  for (const def of ROUTE_DEFS) {
    const m = def.pattern.exec(path);
    if (m) {
      const params = {};
      (def.params || []).forEach((key, i) => { params[key] = decodeURIComponent(m[i + 1] || ''); });
      return { name: def.name, params };
    }
  }
  return { name: 'not-found', params: {} };
};

const renderRoute = async ({ name, params, query, full }) => {
  const handler = routes.get(name);
  if (!handler) return;
  if (current && typeof beforeLeave === 'function') {
    try {
      const proceed = await beforeLeave(current);
      if (proceed === false) return;
    } catch (e) { console.warn('beforeLeave failed', e); }
  }
  current = { name, params, query, full };
  setState({ route: current }, 'route');
  emit('route:before', current);
  try {
    await handler({ name, params, query });
    emit('route:after', current);
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  } catch (err) {
    console.error('route error', err);
    emit('route:error', { route: current, error: err });
  }
};

export const navigate = (hash, { replace = false } = {}) => {
  const target = hash.startsWith('#') ? hash : `#${hash.startsWith('/') ? '' : '/'}${hash}`;
  if (replace) {
    const url = window.location.pathname + window.location.search + target;
    window.history.replaceState(null, '', url);
    handleRouteChange();
  } else {
    window.location.hash = target;
  }
};

const handleRouteChange = () => {
  const { path, query, full } = parseHash();
  const match = matchRoute(path);
  renderRoute({ ...match, query, full: `/${full.replace(/^\//, '')}` });
};

export const currentRoute = () => current;

export const startRouter = () => {
  window.addEventListener('hashchange', handleRouteChange);
  if (!window.location.hash) {
    window.history.replaceState(null, '', window.location.pathname + '#/home');
  }
  handleRouteChange();
};

/* ---------- Link interceptor ---------- */
export const installLinkInterceptor = () => {
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.('a[data-link]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href) return;
    if (href.startsWith('http')) return;
    e.preventDefault();
    navigate(href, { replace: a.dataset.replace === 'true' });
  });
};

/* ---------- Breadcrumb helpers ---------- */
export const setBreadcrumbs = (items) => {
  emit('breadcrumbs', items || []);
};

export const goBack = () => {
  if (window.history.length > 1) window.history.back();
  else navigate('/home');
};
