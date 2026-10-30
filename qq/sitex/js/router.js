// =============================================================
// Client-side SPA Router — no full page refresh
// Uses hash routing for maximum compatibility with static GitHub Pages
// =============================================================
const Router = (function () {
  const routes = new Map();
  let current = null;
  let appEl = null;
  let onBeforeNavigate = null;
  let onAfterNavigate = null;

  function init(containerSelector = '#app') {
    appEl = document.querySelector(containerSelector);
    if (!appEl) {
      console.error('Router: #app container not found');
      return;
    }

    window.addEventListener('hashchange', handleRoute);
    window.addEventListener('popstate', handleRoute);

    // Initial route
    handleRoute();
  }

  function register(path, handler) {
    // path examples: '/', '/work', '/browse', '/browse/:surah/:ayah', '/login'
    routes.set(path, handler);
  }

  function navigate(path, { replace = false, state = null } = {}) {
    const hash = path.startsWith('#') ? path : '#' + (path.startsWith('/') ? path : '/' + path);
    if (replace) {
      location.replace(hash);
    } else {
      location.hash = hash;
    }
  }

  function getPath() {
    let h = location.hash.slice(1) || '/';
    if (!h.startsWith('/')) h = '/' + h;
    // remove trailing slash except root
    if (h.length > 1 && h.endsWith('/')) h = h.slice(0, -1);
    return h;
  }

  function matchRoute(path) {
    // exact match first
    if (routes.has(path)) {
      return { handler: routes.get(path), params: {} };
    }

    // simple param matching: /browse/:surah/:ayah
    for (const [pattern, handler] of routes) {
      const patternParts = pattern.split('/');
      const pathParts = path.split('/');
      if (patternParts.length !== pathParts.length) continue;

      const params = {};
      let ok = true;
      for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i].startsWith(':')) {
          params[patternParts[i].slice(1)] = pathParts[i];
        } else if (patternParts[i] !== pathParts[i]) {
          ok = false;
          break;
        }
      }
      if (ok) return { handler, params };
    }

    // fallback
    if (routes.has('/')) return { handler: routes.get('/'), params: {} };
    return null;
  }

  async function handleRoute() {
    const path = getPath();
    const match = matchRoute(path);

    if (!match) {
      console.warn('No route for', path);
      navigate('/', { replace: true });
      return;
    }

    // Loading indicator
    document.documentElement.classList.add('is-navigating');
    if (typeof onBeforeNavigate === 'function') {
      try { await onBeforeNavigate(path, current); } catch (e) {}
    }

    // Update active nav
    document.querySelectorAll('[data-route]').forEach((el) => {
      const r = el.getAttribute('data-route');
      const isActive = path === r || (r !== '/' && path.startsWith(r));
      el.classList.toggle('active', isActive);
      if (el.tagName === 'A') el.setAttribute('aria-current', isActive ? 'page' : null);
    });

    try {
      await match.handler({ path, params: match.params, container: appEl });
      current = path;
    } catch (err) {
      console.error('Route handler error:', err);
      UI?.toast?.('خطا در بارگذاری صفحه');
    } finally {
      document.documentElement.classList.remove('is-navigating');
      if (typeof onAfterNavigate === 'function') {
        try { await onAfterNavigate(path); } catch (e) {}
      }
      // Smooth scroll to top on view change
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function setHooks({ before, after } = {}) {
    onBeforeNavigate = before || null;
    onAfterNavigate = after || null;
  }

  // Helper for links: <a href="#/browse" data-route="/browse">
  function interceptLinks() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#/"]');
      if (!a) return;
      // allow middle-click / ctrl etc
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      const href = a.getAttribute('href');
      navigate(href.slice(1)); // remove #
    });
  }

  return {
    init,
    register,
    navigate,
    getPath,
    setHooks,
    interceptLinks,
  };
})();
