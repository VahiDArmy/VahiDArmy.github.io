/**
 * کامپوننت راهنما (Tooltip)
 */
class Tooltip {
  constructor() {
    this.element = null;
    this.currentTarget = null;
    this.listeners = new Map();
    this.showDelay = 300;
    this.hideDelay = 100;
    this._showTimer = null;
    this._hideTimer = null;
    this._boundMouseOver = this._handleMouseOver.bind(this);
    this._boundMouseOut = this._handleMouseOut.bind(this);
    this._boundScroll = this._handleScroll.bind(this);
  }

  /**
   * راه‌اندازی
   */
  init() {
    document.addEventListener('mouseover', this._boundMouseOver);
    document.addEventListener('mouseout', this._boundMouseOut);
    document.addEventListener('focusin', this._handleFocusIn.bind(this));
    document.addEventListener('focusout', this._handleFocusOut.bind(this));
    window.addEventListener('scroll', this._boundScroll, true);

    return this;
  }

  /**
   * نمایش
   */
  show(target, content, options = {}) {
    this.hide(true);

    const opts = {
      placement: 'top',
      offset: 8,
      html: false,
      theme: 'dark',
      interactive: false,
      ...options
    };

    this.currentTarget = target;

    this.element = DomUtils.create('div', {
      className: `tooltip tooltip-${opts.theme}`,
      attrs: { role: 'tooltip' }
    });

    this.element.setAttribute('data-placement', opts.placement);

    if (opts.html) {
      this.element.innerHTML = `
        <div class="tooltip-content">${content}</div>
        ${opts.interactive ? '' : '<div class="tooltip-arrow"></div>'}
      `;
    } else {
      this.element.innerHTML = `
        <div class="tooltip-content">${StringUtils.escapeHtml(content)}</div>
        <div class="tooltip-arrow"></div>
      `;
    }

    document.body.appendChild(this.element);

    requestAnimationFrame(() => {
      this.element.classList.add('visible');
      this._position(target, opts.placement, opts.offset);
    });

    if (opts.interactive) {
      this.element.addEventListener('mouseenter', () => {
        clearTimeout(this._hideTimer);
      });

      this.element.addEventListener('mouseleave', () => {
        this.scheduleHide();
      });
    }

    this.emit('show', { target, content });
  }

  /**
   * مخفی کردن
   */
  hide(immediate = false) {
    clearTimeout(this._showTimer);
    clearTimeout(this._hideTimer);

    if (!this.element) return;

    if (immediate) {
      this.element.remove();
      this.element = null;
      this.currentTarget = null;
      return;
    }

    this.element.classList.remove('visible');

    const el = this.element;

    setTimeout(() => {
      el.remove();
    }, 200);

    this.element = null;
    this.currentTarget = null;
    this.emit('hide');
  }

  /**
   * زمان‌بندی مخفی کردن
   */
  scheduleHide() {
    clearTimeout(this._hideTimer);
    this._hideTimer = setTimeout(() => {
      this.hide();
    }, this.hideDelay);
  }

  /**
   * موقعیت‌دهی
   */
  _position(target, placement, offset) {
    if (!this.element) return;

    const targetRect = target.getBoundingClientRect();
    const tooltipRect = this.element.getBoundingClientRect();

    let top, left;

    switch (placement) {
      case 'top':
        top = targetRect.top - tooltipRect.height - offset;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + offset;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.left - tooltipRect.width - offset;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.right + offset;
        break;
      default:
        top = targetRect.top - tooltipRect.height - offset;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
    }

    // مرزها
    if (left < 8) left = 8;
    if (left + tooltipRect.width > window.innerWidth - 8) {
      left = window.innerWidth - tooltipRect.width - 8;
    }

    if (top < 8) {
      // زیر عنصر قرار بگیرد
      top = targetRect.bottom + offset;
      this.element.setAttribute('data-placement', 'bottom');
    }

    if (top + tooltipRect.height > window.innerHeight - 8) {
      top = targetRect.top - tooltipRect.height - offset;
      this.element.setAttribute('data-placement', 'top');
    }

    this.element.style.top = top + 'px';
    this.element.style.left = left + 'px';
  }

  /**
   * هندلر mouseover
   */
  _handleMouseOver(e) {
    const target = e.target.closest('[data-tooltip], [title]');
    if (!target) return;

    // اگر already نمایش داده شده، نادیده بگیر
    if (this.currentTarget === target) return;

    let content = target.dataset.tooltip;
    let options = {};

    if (!content && target.hasAttribute('title')) {
      content = target.getAttribute('title');
      target.setAttribute('data-original-title', content);
      target.removeAttribute('title');
    }

    if (!content) return;

    // گزینه‌ها
    if (target.dataset.tooltipPlacement) {
      options.placement = target.dataset.tooltipPlacement;
    }
    if (target.dataset.tooltipHtml === 'true') {
      options.html = true;
    }
    if (target.dataset.tooltipTheme) {
      options.theme = target.dataset.tooltipTheme;
    }

    clearTimeout(this._showTimer);

    const delay = parseInt(target.dataset.tooltipDelay) || this.showDelay;

    this._showTimer = setTimeout(() => {
      this.show(target, content, options);
    }, delay);
  }

  /**
   * هندلر mouseout
   */
  _handleMouseOut(e) {
    const target = e.target.closest('[data-tooltip], [data-original-title]');
    if (!target) return;

    // برگرداندن title
    if (target.hasAttribute('data-original-title')) {
      const title = target.getAttribute('data-original-title');
      target.setAttribute('title', title);
      target.removeAttribute('data-original-title');
    }

    clearTimeout(this._showTimer);
    this.scheduleHide();
  }

  /**
   * فوکوس
   */
  _handleFocusIn(e) {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;

    const content = target.dataset.tooltip;
    if (!content) return;

    clearTimeout(this._showTimer);
    this._showTimer = setTimeout(() => {
      this.show(target, content);
    }, this.showDelay);
  }

  /**
   * از دست دادن فوکوس
   */
  _handleFocusOut(e) {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;

    clearTimeout(this._showTimer);
    this.hide();
  }

  /**
   * هندلر اسکرول
   */
  _handleScroll() {
    if (this.element && this.currentTarget) {
      const rect = this.currentTarget.getBoundingClientRect();
      // اگر خارج از دید شد، مخفی کن
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        this.hide(true);
      } else {
        this._position(this.currentTarget, this.element.dataset.placement || 'top', 8);
      }
    }
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

  /**
   * نابودی
   */
  destroy() {
    document.removeEventListener('mouseover', this._boundMouseOver);
    document.removeEventListener('mouseout', this._boundMouseOut);
    window.removeEventListener('scroll', this._boundScroll, true);
    this.hide(true);
    this.listeners.clear();
  }
}

const tooltip = new Tooltip();

window.Tooltip = Tooltip;
window.tooltip = tooltip;