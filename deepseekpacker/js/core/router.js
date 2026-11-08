// AURORA OS — Hash Router

import { bus } from './bus.js';

class Router {
  constructor() {
    this.routes = new Map();
    this.current = null;
    this._init = false;
  }

  register(path, fn) {
    this.routes.set(path, fn);
    return this;
  }

  init() {
    if (this._init) return;
    this._init = true;
    window.addEventListener('hashchange', () => this._resolve());
    this._resolve();
  }

  navigate(path) {
    if (window.location.hash === '#' + path) return;
    window.location.hash = path;
  }

  _resolve() {
    const path = (window.location.hash || '#').slice(1) || 'dashboard';
    this.current = path;
    const fn = this.routes.get(path);
    if (fn) {
      try { fn(path); } catch (e) { console.error('[router]', e); }
    }
    bus.emit('router:change', path);
  }
}

export const router = new Router();
export default router;
