/**
 * ابزارهای DOM
 * توابع کمکی برای کار با DOM
 */
const DomUtils = {
  /**
   * انتخاب یک عنصر
   */
  $(selector, context = document) {
    return context.querySelector(selector);
  },

  /**
   * انتخاب چندین عنصر
   */
  $$(selector, context = document) {
    return Array.from(context.querySelectorAll(selector));
  },

  /**
   * ایجاد عنصر
   */
  create(tag, options = {}) {
    const el = document.createElement(tag);

    if (options.className) el.className = options.className;
    if (options.id) el.id = options.id;
    if (options.text) el.textContent = options.text;
    if (options.html) el.innerHTML = options.html;
    if (options.style) {
      if (typeof options.style === 'string') {
        el.style.cssText = options.style;
      } else {
        Object.assign(el.style, options.style);
      }
    }
    if (options.attrs) {
      Object.entries(options.attrs).forEach(([key, value]) => {
        el.setAttribute(key, value);
      });
    }
    if (options.dataset) {
      Object.entries(options.dataset).forEach(([key, value]) => {
        el.dataset[key] = value;
      });
    }
    if (options.children) {
      options.children.forEach(child => {
        if (typeof child === 'string') {
          el.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
          el.appendChild(child);
        }
      });
    }
    if (options.events) {
      Object.entries(options.events).forEach(([event, handler]) => {
        el.addEventListener(event, handler);
      });
    }

    return el;
  },

  /**
   * افزودن کلاس
   */
  addClass(el, ...classes) {
    if (!el) return;
    el.classList.add(...classes);
  },

  /**
   * حذف کلاس
   */
  removeClass(el, ...classes) {
    if (!el) return;
    el.classList.remove(...classes);
  },

  /**
   * تغییر وضعیت کلاس
   */
  toggleClass(el, className, force) {
    if (!el) return;
    return el.classList.toggle(className, force);
  },

  /**
   * بررسی وجود کلاس
   */
  hasClass(el, className) {
    return el?.classList.contains(className) || false;
  },

  /**
   * تنظیم متن
   */
  setText(el, text) {
    if (!el) return;
    el.textContent = String(text);
  },

  /**
   * تنظیم HTML
   */
  setHtml(el, html) {
    if (!el) return;
    el.innerHTML = html;
  },

  /**
   * تنظیم ویژگی
   */
  setAttr(el, attrs) {
    if (!el) return;
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        el.removeAttribute(key);
      } else {
        el.setAttribute(key, value);
      }
    });
  },

  /**
   * نمایش عنصر
   */
  show(el, display = 'block') {
    if (!el) return;
    el.style.display = display;
  },

  /**
   * مخفی کردن عنصر
   */
  hide(el) {
    if (!el) return;
    el.style.display = 'none';
  },

  /**
   * تغییر وضعیت نمایش
   */
  toggle(el, force) {
    if (!el) return;
    if (force !== undefined) {
      el.style.display = force ? '' : 'none';
    } else {
      el.style.display = el.style.display === 'none' ? '' : 'none';
    }
  },

  /**
   * خالی کردن عنصر
   */
  empty(el) {
    if (!el) return;
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  },

  /**
   * حذف عنصر
   */
  remove(el) {
    if (!el || !el.parentNode) return;
    el.parentNode.removeChild(el);
  },

  /**
   * درج HTML قبل از عنصر
   */
  before(el, html) {
    if (!el) return;
    el.insertAdjacentHTML('beforebegin', html);
  },

  /**
   * درج HTML بعد از عنصر
   */
  after(el, html) {
    if (!el) return;
    el.insertAdjacentHTML('afterend', html);
  },

  /**
   * درج HTML در ابتدای عنصر
   */
  prepend(el, html) {
    if (!el) return;
    el.insertAdjacentHTML('afterbegin', html);
  },

  /**
   * درج HTML در انتهای عنصر
   */
  append(el, html) {
    if (!el) return;
    el.insertAdjacentHTML('beforeend', html);
  },

  /**
   * ثبت رویداد
   */
  on(el, event, handler, options = {}) {
    if (!el) return () => {};
    el.addEventListener(event, handler, options);
    return () => el.removeEventListener(event, handler, options);
  },

  /**
   * ثبت رویداد یکبار
   */
  once(el, event, handler) {
    return this.on(el, event, handler, { once: true });
  },

  /**
   * واگذاری رویداد
   */
  delegate(parent, selector, event, handler) {
    if (!parent) return () => {};

    const delegatedHandler = (e) => {
      const target = e.target.closest(selector);
      if (target && parent.contains(target)) {
        handler.call(target, e, target);
      }
    };

    parent.addEventListener(event, delegatedHandler);
    return () => parent.removeEventListener(event, delegatedHandler);
  },

  /**
   * توقف انتشار
   */
  stopPropagation(e) {
    e.stopPropagation();
  },

  /**
   * جلوگیری از پیش‌فرض
   */
  preventDefault(e) {
    e.preventDefault();
  },

  /**
   * دریافت موقعیت عنصر
   */
  getPosition(el) {
    if (!el) return { top: 0, left: 0, width: 0, height: 0 };
    const rect = el.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height,
      right: rect.right,
      bottom: rect.bottom
    };
  },

  /**
   * بررسی قابل مشاهده بودن
   */
  isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && el.offsetParent !== null;
  },

  /**
   * اسکرول به عنصر
   */
  scrollTo(el, options = {}) {
    if (!el) return;
    el.scrollIntoView({
      behavior: options.behavior || 'smooth',
      block: options.block || 'start',
      inline: options.inline || 'nearest'
    });
  },

  /**
   * دریافت مقدار ورودی
   */
  getValue(el) {
    if (!el) return null;
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'radio') return el.checked ? el.value : null;
    if (el.tagName === 'SELECT' && el.multiple) {
      return Array.from(el.selectedOptions).map(o => o.value);
    }
    return el.value;
  },

  /**
   * تنظیم مقدار ورودی
   */
  setValue(el, value) {
    if (!el) return;
    if (el.type === 'checkbox') {
      el.checked = Boolean(value);
    } else if (el.type === 'radio') {
      el.checked = el.value === value;
    } else {
      el.value = value;
    }
  },

  /**
   * serialize فرم
   */
  serializeForm(form) {
    const data = {};
    const formData = new FormData(form);

    for (const [key, value] of formData.entries()) {
      if (data[key] !== undefined) {
        if (Array.isArray(data[key])) {
          data[key].push(value);
        } else {
          data[key] = [data[key], value];
        }
      } else {
        data[key] = value;
      }
    }

    return data;
  },

  /**
   * دریافت داده‌های dataset
   */
  dataset(el, key) {
    return el?.dataset?.[key];
  },

  /**
   * تنظیم CSS variable
   */
  setCssVar(name, value, target = document.documentElement) {
    target.style.setProperty(name, value);
  },

  /**
   * دریافت CSS variable
   */
  getCssVar(name, target = document.documentElement) {
    return getComputedStyle(target).getPropertyValue(name).trim();
  },

  /**
   * کپی متن در کلیپ‌بورد
   */
  async copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }

      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch (error) {
      console.error('خطا در کپی:', error);
      return false;
    }
  },

  /**
   * خواندن از کلیپ‌بورد
   */
  async readFromClipboard() {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        return await navigator.clipboard.readText();
      }
      return null;
    } catch (error) {
      return null;
    }
  },

  /**
   * انیمیشن fade in
   */
  fadeIn(el, duration = 300) {
    if (!el) return Promise.resolve();
    el.style.opacity = '0';
    el.style.display = '';
    el.style.transition = `opacity ${duration}ms ease`;

    return new Promise(resolve => {
      requestAnimationFrame(() => {
        el.style.opacity = '1';
        setTimeout(resolve, duration);
      });
    });
  },

  /**
   * انیمیشن fade out
   */
  fadeOut(el, duration = 300) {
    if (!el) return Promise.resolve();
    el.style.transition = `opacity ${duration}ms ease`;
    el.style.opacity = '0';

    return new Promise(resolve => {
      setTimeout(() => {
        el.style.display = 'none';
        resolve();
      }, duration);
    });
  },

  /**
   * انیمیشن slide
   */
  slideDown(el, duration = 300) {
    if (!el) return Promise.resolve();
    el.style.overflow = 'hidden';
    el.style.height = '0';
    el.style.display = '';

    const targetHeight = el.scrollHeight;

    return new Promise(resolve => {
      requestAnimationFrame(() => {
        el.style.transition = `height ${duration}ms ease`;
        el.style.height = targetHeight + 'px';

        setTimeout(() => {
          el.style.height = '';
          el.style.overflow = '';
          el.style.transition = '';
          resolve();
        }, duration);
      });
    });
  },

  /**
   * انیمیشن slide up
   */
  slideUp(el, duration = 300) {
    if (!el) return Promise.resolve();
    el.style.overflow = 'hidden';
    el.style.height = el.scrollHeight + 'px';

    return new Promise(resolve => {
      requestAnimationFrame(() => {
        el.style.transition = `height ${duration}ms ease`;
        el.style.height = '0';

        setTimeout(() => {
          el.style.display = 'none';
          el.style.height = '';
          el.style.overflow = '';
          el.style.transition = '';
          resolve();
        }, duration);
      });
    });
  },

  /**
   * Debounce
   */
  debounce(func, wait = 250) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func.apply(this, args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Throttle
   */
  throttle(func, limit = 250) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => { inThrottle = false; }, limit);
      }
    };
  },

  /**
   * rAF Throttle
   */
  rafThrottle(func) {
    let rafId = null;
    return function executedFunction(...args) {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        func.apply(this, args);
        rafId = null;
      });
    };
  },

  /**
   * دریافت نام تگ
   */
  tagName(el) {
    return el?.tagName?.toLowerCase() || '';
  },

  /**
   * بررسی والد بودن
   */
  contains(parent, child) {
    return parent?.contains(child) || false;
  },

  /**
   * یافتن نزدیک‌ترین
   */
  closest(el, selector) {
    return el?.closest(selector) || null;
  }
};

window.DomUtils = DomUtils;