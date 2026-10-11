/**
 * روتر برنامه
 * مدیریت ناوبری بین نماها
 */
class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.previousRoute = null;
    this.params = {};
    this.query = {};
    this.listeners = new Map();
    this.middlewares = [];
    this.useHash = true;
    this.basePath = '';
    this.notFoundHandler = null;
    this._boundHashChange = this._handleHashChange.bind(this);
  }

  /**
   * راه‌اندازی روتر
   */
  start() {
    if (this.useHash) {
      window.addEventListener('hashchange', this._boundHashChange);
      this._handleHashChange();
    } else {
      window.addEventListener('popstate', this._boundHashChange);
      this._handleHashChange();
    }

    return this;
  }

  /**
   * توقف روتر
   */
  stop() {
    window.removeEventListener('hashchange', this._boundHashChange);
    window.removeEventListener('popstate', this._boundHashChange);
    return this;
  }

  /**
   * ثبت مسیر
   */
  register(path, handler, options = {}) {
    const keys = [];
    const regex = this._pathToRegex(path, keys);

    this.routes.set(path, {
      path,
      regex,
      keys,
      handler,
      options,
      title: options.title || null,
      middleware: options.middleware || []
    });

    return this;
  }

  /**
   * حذف مسیر
   */
  unregister(path) {
    return this.routes.delete(path);
  }

  /**
   * افزودن میان‌افزار
   */
  use(middleware) {
    if (typeof middleware === 'function') {
      this.middlewares.push(middleware);
    }
    return this;
  }

  /**
   * ناوبری به مسیر
   */
  navigate(path, options = {}) {
    const {
      replace = false,
      query = {},
      state = {}
    } = options;

    let target = path;

    const queryString = this._buildQuery(query);
    if (queryString) {
      target += (target.includes('?') ? '&' : '?') + queryString;
    }

    if (this.useHash) {
      const newHash = '#' + target;
      if (replace) {
        window.location.replace(newHash);
      } else {
        window.location.hash = target;
      }
    } else {
      const newUrl = this.basePath + target;
      if (replace) {
        window.history.replaceState(state, '', newUrl);
      } else {
        window.history.pushState(state, '', newUrl);
      }
      this._handleHashChange();
    }

    return this;
  }

  /**
   * بازگشت
   */
  back() {
    window.history.back();
  }

  /**
   * جلو
   */
  forward() {
    window.history.forward();
  }

  /**
   * دریافت پارامتر
   */
  getParam(key, defaultValue = null) {
    return this.params[key] !== undefined ? this.params[key] : defaultValue;
  }

  /**
   * دریافت پارامترهای کوئری
   */
  getQuery(key, defaultValue = null) {
    if (!key) return { ...this.query };
    return this.query[key] !== undefined ? this.query[key] : defaultValue;
  }

  /**
   * تنظیم پارامتر کوئری
   */
  setQuery(key, value, options = {}) {
    const newQuery = { ...this.query, [key]: value };
    this.navigate(this.currentRoute || '/', {
      ...options,
      replace: options.replace !== false,
      query: newQuery
    });
  }

  /**
   * حذف پارامتر کوئری
   */
  removeQuery(key, options = {}) {
    const newQuery = { ...this.query };
    delete newQuery[key];
    this.navigate(this.currentRoute || '/', {
      ...options,
      replace: true,
      query: newQuery
    });
  }

  /**
   * دریافت مسیر فعلی
   */
  getCurrent() {
    return {
      path: this.currentRoute,
      params: { ...this.params },
      query: { ...this.query }
    };
  }

  /**
   * بررسی مسیر فعال
   */
  isActive(path) {
    return this.currentRoute === path;
  }

  /**
   * بررسی شروع مسیر
   */
  isActivePrefix(prefix) {
    return this.currentRoute && this.currentRoute.startsWith(prefix);
  }

  /**
   * هندلر تغییر مسیر
   */
  async _handleHashChange() {
    const path = this._getCurrentPath();
    const parsed = this._parseUrl(path);

    let matchedRoute = null;
    let matchedParams = {};

    for (const [routePath, route] of this.routes) {
      const match = route.regex.exec(parsed.pathname);

      if (match) {
        matchedRoute = route;
        matchedParams = this._extractParams(match, route.keys);
        break;
      }
    }

    if (!matchedRoute) {
      if (this.notFoundHandler) {
        matchedRoute = { handler: this.notFoundHandler, middleware: [] };
      } else {
        console.warn('مسیر یافت نشد:', parsed.pathname);
        return;
      }
    }

    this.previousRoute = this.currentRoute;
    this.currentRoute = parsed.pathname;
    this.params = matchedParams;
    this.query = parsed.query;

    const context = {
      path: parsed.pathname,
      params: matchedParams,
      query: parsed.query,
      previous: this.previousRoute,
      router: this
    };

    // اجرای میان‌افزارها
    const allMiddleware = [...this.middlewares, ...(matchedRoute.middleware || [])];

    for (const mw of allMiddleware) {
      try {
        const result = await mw(context);
        if (result === false) {
          return;
        }
      } catch (error) {
        console.error('خطا در میان‌افزار روتر:', error);
      }
    }

    // به‌روزرسانی عنوان
    if (matchedRoute.title) {
      document.title = matchedRoute.title + ' - مدیریت پایگاه داده';
    }

    // اجرای هندلر
    try {
      await matchedRoute.handler(context);
      this.emit('navigated', context);
    } catch (error) {
      console.error('خطا در هندلر مسیر:', error);
      this.emit('error', { context, error });
    }
  }

  /**
   * دریافت مسیر فعلی
   */
  _getCurrentPath() {
    if (this.useHash) {
      return window.location.hash.slice(1) || '/';
    }
    return window.location.pathname.replace(this.basePath, '') || '/';
  }

  /**
   * تجزیه URL
   */
  _parseUrl(url) {
    const [pathname, queryString = ''] = url.split('?');
    const query = {};

    if (queryString) {
      const params = new URLSearchParams(queryString);
      for (const [key, value] of params.entries()) {
        query[key] = value;
      }
    }

    return {
      pathname: pathname || '/',
      query
    };
  }

  /**
   * تبدیل مسیر به regex
   */
  _pathToRegex(path, keys) {
    const pattern = path
      .replace(/\/$/, '')
      .replace(/\/:([^\/]+)/g, (_, key) => {
        keys.push(key);
        return '/([^/]+)';
      })
      .replace(/\*/g, '.*');

    return new RegExp('^' + (pattern || '') + '/?$');
  }

  /**
   * استخراج پارامترها
   */
  _extractParams(match, keys) {
    const params = {};

    keys.forEach((key, i) => {
      params[key] = decodeURIComponent(match[i + 1] || '');
    });

    return params;
  }

  /**
   * ساخت query string
   */
  _buildQuery(query) {
    const params = new URLSearchParams();

    Object.entries(query).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') return;

      if (Array.isArray(value)) {
        value.forEach(v => params.append(key, v));
      } else {
        params.append(key, value);
      }
    });

    return params.toString();
  }

  /**
   * ثبت شنونده
   */
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  /**
   * انتشار رویداد
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`خطا در شنونده "${event}":`, error);
        }
      });
    }
  }
}

const router = new Router();