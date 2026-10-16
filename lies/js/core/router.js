/* ============================================================
   js/core/router.js
   Hash-based SPA router with params, guards, and hooks.
   Pattern: "/lie/:id"  →  { id: "..." }
   ============================================================ */

import { bus } from './event-bus.js';
import { EVENTS } from '../config/constants.js';
import { DEFAULT_ROUTE } from '../config/app.config.js';

/**
 * @typedef {Object} Route
 * @property {string} pattern
 * @property {RegExp} regex
 * @property {string[]} keys
 * @property {(container:HTMLElement, params:Record<string,string>, query:URLSearchParams) => any} render
 * @property {(container:HTMLElement, params:Record<string,string>) => void} [unmount]
 * @property {string} [title]
 * @property {boolean} [public]  if true, no auth required
 * @property {(params:Record<string,string>) => string|false} [canActivate]
 */

/**
 * @typedef {Object} Guard
 * @property {(to:{path:string,route:Route|null,params:object}) => boolean|string|Promise<boolean|string>} fn
 */

class Router {
  constructor() {
    /** @type {Route[]} */
    this.routes = [];
    /** @type {Guard[]} */
    this.guards = [];
    /** @type {Route|null} */
    this.current = null;
    /** @type {string} */
    this.currentPath = '';
    /** @type {HTMLElement|null} */
    this.container = null;
    /** @type {any} */
    this._activeUnmount = null;
    this._started = false;
    this._navToken = 0;

    this._onHashChange = this._onHashChange.bind(this);
  }

  /* ── Registration ───────────────────────────────────────── */

  /**
   * Register a route.
   * @param {string} pattern
   * @param {Partial<Route>} def
   * @returns {Router}
   */
  register(pattern, def) {
    const { regex, keys } = compilePattern(pattern);
    this.routes.push({
      pattern,
      regex,
      keys,
      render: def.render || (() => {}),
      unmount: def.unmount,
      title: def.title || '',
      public: !!def.public,
      canActivate: def.canActivate,
    });
    // Longest patterns first (so /lie/:id beats /lie)
    this.routes.sort((a, b) => b.pattern.length - a.pattern.length);
    return this;
  }

  /**
   * Register a navigation guard.
   * @param {Guard['fn']} fn
   */
  beforeEach(fn) {
    this.guards.push({ fn });
    return this;
  }

  /* ── Start ──────────────────────────────────────────────── */

  /**
   * Start listening to hash changes.
   * @param {HTMLElement} container
   */
  start(container) {
    if (this._started) return;
    this.container = container;
    this._started = true;
    window.addEventListener('hashchange', this._onHashChange);
    // Handle initial route
    this._onHashChange();
  }

  /**
   * Stop listening.
   */
  stop() {
    if (!this._started) return;
    window.removeEventListener('hashchange', this._onHashChange);
    this._started = false;
  }

  /* ── Navigation ─────────────────────────────────────────── */

  /**
   * Navigate to a path. Uses hash so history/back work naturally.
   * @param {string} path
   * @param {{replace?:boolean}} [opts]
   */
  navigate(path, opts = {}) {
    const clean = normalizePath(path);
    const current = currentHash();
    if (clean === current) {
      this._onHashChange();
      return;
    }
    if (opts.replace) {
      const url = `${location.pathname}${location.search}#${clean}`;
      history.replaceState(null, '', url);
      this._onHashChange();
    } else {
      location.hash = clean;
    }
  }

  /**
   * Reload the current route (re-run render).
   */
  refresh() {
    this._onHashChange();
  }

  /**
   * Go back in history.
   */
  back() {
    history.back();
  }

  /* ── Internals ──────────────────────────────────────────── */

  async _onHashChange() {
    const path = currentHash();
    const token = ++this._navToken;

    const resolved = this._match(path);
    if (!resolved) {
      // Unknown route → fall back to default (unless already there)
      if (path !== DEFAULT_ROUTE) {
        this.navigate(`/${DEFAULT_ROUTE}`, { replace: true });
      }
      return;
    }

    const { route, params } = resolved;
    const query = new URLSearchParams(location.hash.split('?')[1] || '');

    // Guards
    for (const { fn } of this.guards) {
      let outcome;
      try {
        outcome = await fn({ path, route, params });
      } catch (err) {
        console.error('[router] guard error', err);
        outcome = false;
      }
      if (outcome === false) return;
      if (typeof outcome === 'string') {
        this.navigate(outcome, { replace: true });
        return;
      }
    }

    // Route-level guard
    if (route.canActivate) {
      const ok = route.canActivate(params);
      if (typeof ok === 'string') {
        this.navigate(ok, { replace: true });
        return;
      }
      if (ok === false) return;
    }

    if (token !== this._navToken) return; // superseded

    // Unmount previous
    try { this._activeUnmount?.(); } catch (e) { console.error(e); }
    this._activeUnmount = null;

    // Swap container content
    const container = this.container;
    if (!container) return;

    // Add leaving class briefly
    container.classList.add('page-container--swapping');

    // Clear and render
    container.innerHTML = '';

    bus.emit(EVENTS.ROUTE_BEFORE_CHANGE, { from: this.currentPath, to: path });

    try {
      await route.render(container, params, query);
      this._activeUnmount = route.unmount || null;
    } catch (err) {
      console.error('[router] render error', err);
      container.innerHTML = '';
      const errBox = document.createElement('div');
      errBox.className = 'page-error';
      errBox.innerHTML = `
        <div class="page-error__icon">⚠️</div>
        <h2 class="page-error__title">خطا در بارگذاری صفحه</h2>
        <p class="page-error__message"></p>
        <button class="btn btn--primary" data-reload>تلاش دوباره</button>
      `;
      errBox.querySelector('.page-error__message').textContent = err?.message || 'خطای نامشخص';
      errBox.querySelector('[data-reload]').addEventListener('click', () => this.refresh());
      container.appendChild(errBox);
    }

    requestAnimationFrame(() => {
      container.classList.remove('page-container--swapping');
    });

    this.current = route;
    this.currentPath = path;

    // Update document title
    if (route.title) {
      document.title = `${route.title} · آینهٔ درون`;
    } else {
      document.title = 'دروغ‌هایی که به خودمان می‌گوییم';
    }

    // Scroll to top
    try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch { /* noop */ }

    bus.emit(EVENTS.ROUTE_CHANGED, { path, route, params });
  }

  /**
   * @param {string} path
   * @returns {{route:Route, params:Record<string,string>}|null}
   */
  _match(path) {
    const [pathname] = path.split('?');
    for (const route of this.routes) {
      const m = route.regex.exec(pathname);
      if (!m) continue;
      const params = {};
      for (let i = 0; i < route.keys.length; i++) {
        params[route.keys[i]] = decodeURIComponent(m[i + 1] || '');
      }
      return { route, params };
    }
    return null;
  }
}

/* ── Helpers ─────────────────────────────────────────────── */

/**
 * Compile "/lie/:id" into a regex + keys.
 * @param {string} pattern
 * @returns {{regex:RegExp, keys:string[]}}
 */
function compilePattern(pattern) {
  const keys = [];
  const re = pattern
    .replace(/\/+$/, '')
    .replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, k) => { keys.push(k); return '([^/]+)'; })
    .replace(/\*/g, '(.*)');
  return { regex: new RegExp(`^${re}/?$`), keys };
}

/**
 * Normalize a path to always start with "/".
 * @param {string} p
 * @returns {string}
 */
function normalizePath(p) {
  let s = String(p || '').trim();
  if (!s) return `/${DEFAULT_ROUTE}`;
  if (!s.startsWith('/')) s = '/' + s;
  return s;
}

/**
 * Read the current hash path (without "#").
 * @returns {string}
 */
function currentHash() {
  const h = location.hash.replace(/^#/, '');
  return h ? normalizePath(h) : `/${DEFAULT_ROUTE}`;
}

/** Singleton router. */
export const router = new Router();
export { Router };