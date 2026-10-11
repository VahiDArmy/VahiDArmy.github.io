/**
 * اتوبوس رویداد (Event Bus)
 * سیستم انتشار/اشتراک رویدادها برای ارتباط بین کامپوننت‌ها
 */
class EventBus {
  constructor() {
    this.events = new Map();
    this.middlewares = [];
    this.debug = false;
    this.eventHistory = [];
    this.maxHistory = 100;
  }

  /**
   * فعال‌سازی حالت اشکال‌زدایی
   */
  enableDebug() {
    this.debug = true;
    return this;
  }

  /**
   * غیرفعال‌سازی حالت اشکال‌زدایی
   */
  disableDebug() {
    this.debug = false;
    return this;
  }

  /**
   * افزودن میان‌افزار
   * @param {Function} middleware - تابع میان‌افزار
   */
  use(middleware) {
    if (typeof middleware === 'function') {
      this.middlewares.push(middleware);
    }
    return this;
  }

  /**
   * ثبت شنونده برای یک رویداد
   * @param {string} event - نام رویداد
   * @param {Function} handler - تابع شنونده
   * @param {Object} options - تنظیمات
   * @returns {Function} تابع لغو اشتراک
   */
  on(event, handler, options = {}) {
    if (typeof event !== 'string' || typeof handler !== 'function') {
      throw new Error('پارامترهای نامعتبر برای on');
    }

    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }

    const wrappedHandler = (...args) => {
      if (options.once) {
        this.off(event, wrappedHandler);
      }
      try {
        handler(...args);
      } catch (error) {
        console.error(`خطا در اجرای شنونده رویداد "${event}":`, error);
      }
    };

    wrappedHandler._original = handler;
    wrappedHandler._options = options;

    this.events.get(event).add(wrappedHandler);

    // ثبت در تاریخچه
    this._addToHistory('on', event);

    if (this.debug) {
      console.log(`[EventBus] ثبت شنونده برای "${event}"`);
    }

    return () => this.off(event, wrappedHandler);
  }

  /**
   * ثبت شنونده یکبار مصرف
   */
  once(event, handler) {
    return this.on(event, handler, { once: true });
  }

  /**
   * حذف شنونده
   */
  off(event, handler) {
    if (!this.events.has(event)) return this;

    const handlers = this.events.get(event);

    if (!handler) {
      // حذف همه شنونده‌های رویداد
      handlers.clear();
      this.events.delete(event);
      return this;
    }

    // جستجوی شنونده اصلی
    for (const h of handlers) {
      if (h === handler || h._original === handler) {
        handlers.delete(h);
        break;
      }
    }

    if (handlers.size === 0) {
      this.events.delete(event);
    }

    return this;
  }

  /**
   * انتشار رویداد
   * @param {string} event - نام رویداد
   * @param {*} data - داده‌های رویداد
   */
  emit(event, data) {
    if (typeof event !== 'string') {
      throw new Error('نام رویداد باید رشته باشد');
    }

    // اجرای میان‌افزارها
    for (const middleware of this.middlewares) {
      try {
        data = middleware(event, data) || data;
      } catch (error) {
        console.error('خطا در میان‌افزار:', error);
      }
    }

    this._addToHistory('emit', event, data);

    if (this.debug) {
      console.log(`[EventBus] انتشار "${event}"`, data);
    }

    if (!this.events.has(event)) {
      return this;
    }

    const handlers = Array.from(this.events.get(event));

    for (const handler of handlers) {
      try {
        handler(data);
      } catch (error) {
        console.error(`خطا در شنونده رویداد "${event}":`, error);
      }
    }

    return this;
  }

  /**
   * انتشار رویداد به صورت async
   */
  async emitAsync(event, data) {
    const handlers = this.events.has(event)
      ? Array.from(this.events.get(event))
      : [];

    const promises = handlers.map(handler =>
      Promise.resolve().then(() => handler(data))
    );

    return Promise.allSettled(promises);
  }

  /**
   * انتظار برای یک رویداد
   */
  waitFor(event, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(event, handler);
        reject(new Error(`تایم‌اوت در انتظار رویداد "${event}"`));
      }, timeout);

      const handler = (data) => {
        clearTimeout(timer);
        resolve(data);
      };

      this.once(event, handler);
    });
  }

  /**
   * حذف همه شنونده‌ها
   */
  clear() {
    this.events.clear();
    this.eventHistory = [];
    return this;
  }

  /**
   * حذف شنونده‌های یک رویداد
   */
  clearEvent(event) {
    this.events.delete(event);
    return this;
  }

  /**
   * دریافت لیست رویدادها
   */
  getEventNames() {
    return Array.from(this.events.keys());
  }

  /**
   * دریافت تعداد شنونده‌های یک رویداد
   */
  listenerCount(event) {
    return this.events.has(event) ? this.events.get(event).size : 0;
  }

  /**
   * افزودن به تاریخچه
   */
  _addToHistory(type, event, data = null) {
    this.eventHistory.push({
      type,
      event,
      data,
      timestamp: Date.now()
    });

    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }
  }

  /**
   * دریافت تاریخچه رویدادها
   */
  getHistory() {
    return [...this.eventHistory];
  }

  /**
   * پاک کردن تاریخچه
   */
  clearHistory() {
    this.eventHistory = [];
    return this;
  }
}

// ایجاد نمونه Singleton
const eventBus = new EventBus();

// فریز کردن
Object.freeze(eventBus);