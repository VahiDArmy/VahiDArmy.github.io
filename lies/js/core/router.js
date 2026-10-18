/* ============================================================
   js/core/router.js
   FIXED: Added unmount execution on route change.
          Added 404 fallback route handling.
   ============================================================ */

import { bus } from './event-bus.js';
import { EVENTS } from '../config/constants.js';

class Router {
  constructor() {
    this.routes = [];
    this.guards = [];
    this.current = null;
    this.currentPath = '';
    this.container = null;
    this._activeUnmount = null;
    this._started = false;
    this._navToken = 0;
    this._onHashChange = this._onHashChange.bind(this);
  }

  register(pattern, def) {
    const { regex, keys } = compilePattern(pattern);
    this.routes.push({
      pattern, regex, keys,
      render: def.render || (() => {}),
      unmount: def.unmount || null,
      title: def.title || '',
      public: !!def.public,
      canActivate: def.canActivate,
    });
    this.routes.sort((a, b) => b.pattern.length - a.pattern.length);
    return this;
  }

  beforeEach(fn) { this.guards.push({ fn }); return this; }

  start(container) {
    if (this._started) return;
    this.container = container;
    this._started = true;
    window.addEventListener('hashchange', this._onHashChange);
    this._onHashChange();
  }

  stop() {
    if (!this._started) return;
    window.removeEventListener('hashchange', this._onHashChange);
    this._started = false;
  }

  navigate(path, opts = {}) {
    const clean = normalizePath(path);
    if (clean === currentHash()) { this._onHashChange(); return; }
    if (opts.replace) {
      history.replaceState(null, '', `${location.pathname}${location.search}#${clean}`);
      this._onHashChange();
    } else {
      location.hash = clean;
    }
  }

  refresh() { this._onHashChange(); }
  back() { history.back(); }

  async _onHashChange() {
    const path = currentHash();
    const token = ++this._navToken;
    const resolved = this._match(path);
    
    // 404 Fallback
    if (!resolved) {
      if (this.container) {
        this.container.innerHTML = `<div class="empty-state" style="padding: 40px; text-align: center;"><h2>صفحه پیدا نشد (404)</h2><p>آدرس وارد شده معتبر نیست.</p><a href="#/dashboard" class="btn btn--primary">بازگشت به داشبورد</a></div>`;
      }
      return;
    }

    const { route, params } = resolved;
    const query = new URLSearchParams(location.hash.split('?')[1] || '');

    for (const { fn } of this.guards) {
      const outcome = await fn({ path, route, params });
      if (outcome === false) return;
      if (typeof outcome === 'string') { this.navigate(outcome, { replace: true }); return; }
    }

    if (route.canActivate) {
      const ok = route.canActivate(params);
      if (typeof ok === 'string') { this.navigate(ok, { replace: true }); return; }
      if (ok === false) return;
    }

    if (token !== this._navToken) return;

    // Execute unmount for the previous route
    if (this.current && this.current.unmount) {
      try { await this.current.unmount(); } catch(e) { console.error(e); }
    }
    if (this._activeUnmount) {
      try { await this._activeUnmount(); } catch(e) { console.error(e); }
    }
    this._activeUnmount = null;

    const container = this.container;
    if (!container) return;

    container.classList.add('page-container--swapping');
    container.innerHTML = '';
    bus.emit(EVENTS.ROUTE_BEFORE_CHANGE, { from: this.currentPath, to: path });

    try {
      await route.render(container, params, query);
      this._activeUnmount = route.unmount || null;
    } catch (err) {
      console.error('[router] render error', err);
      container.innerHTML = `<div class="page-error"><h2>خطا در بارگذاری صفحه</h2><p>${err.message}</p></div>`;
    }

    requestAnimationFrame(() => container.classList.remove('page-container--swapping'));

    this.current = route;
    this.currentPath = path;
    document.title = route.title ? `${route.title} · آینهٔ درون` : 'آینهٔ درون';
    window.scrollTo({ top: 0, behavior: 'instant' });
    bus.emit(EVENTS.ROUTE_CHANGED, { path, route, params });
  }

  _match(path) {
    const [pathname] = path.split('?');
    for (const route of this.routes) {
      const m = route.regex.exec(pathname);
      if (!m) continue;
      const params = {};
      for (let i = 0; i < route.keys.length; i++) params[route.keys[i]] = decodeURIComponent(m[i + 1] || '');
      return { route, params };
    }
    return null;
  }
}

function compilePattern(pattern) {
  const keys = [];
  const re = pattern.replace(/\/+$/, '').replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, k) => { keys.push(k); return '([^/]+)'; }).replace(/\*/g, '(.*)');
  return { regex: new RegExp(`^${re}/?$`), keys };
}

function normalizePath(p) {
  let s = String(p || '').trim();
  if (!s) return '/dashboard';
  if (!s.startsWith('/')) s = '/' + s;
  return s;
}

function currentHash() {
  const h = location.hash.replace(/^#/, '');
  return h ? normalizePath(h) : '/dashboard';
}

export const router = new Router();
export { Router };