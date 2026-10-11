/**
 * کامپوننت نوار پیشرفت
 * نمایش پیشرفت عملیات با انیمیشن
 */
class ProgressBar {
  constructor(options = {}) {
    this.options = {
      value: 0,
      max: 100,
      showLabel: true,
      showPercentage: true,
      animated: true,
      striped: false,
      variant: 'primary',
      size: 'md',
      indeterminate: false,
      ...options
    };

    this.element = null;
    this.value = this.options.value;
    this.listeners = new Map();
  }

  /**
   * رندر
   */
  render() {
    this.element = DomUtils.create('div', {
      className: `progress-bar progress-bar-${this.options.size} progress-bar-${this.options.variant}`,
      attrs: {
        role: 'progressbar',
        'aria-valuemin': '0',
        'aria-valuemax': String(this.options.max),
        'aria-valuenow': String(this.value)
      }
    });

    if (this.options.indeterminate) {
      this.element.classList.add('progress-bar-indeterminate');
    }

    if (this.options.striped) {
      this.element.classList.add('progress-bar-striped');
    }

    if (this.options.animated && this.options.striped) {
      this.element.classList.add('progress-bar-animated');
    }

    this._updateContent();
    return this.element;
  }

  /**
   * محتوا
   */
  _updateContent() {
    if (!this.element) return;

    const percent = Math.min(100, Math.max(0, (this.value / this.options.max) * 100));

    let labelHtml = '';
    if (this.options.showLabel || this.options.showPercentage) {
      const parts = [];

      if (this.options.showLabel && this.options.label) {
        parts.push(this.options.label);
      }

      if (this.options.showPercentage) {
        parts.push(`${StringUtils.englishToPersianDigits(Math.round(percent))}٪`);
      }

      if (parts.length > 0) {
        labelHtml = `<span class="progress-bar-label">${parts.join(' - ')}</span>`;
      }
    }

    this.element.innerHTML = `
      <div class="progress-bar-track">
        <div class="progress-bar-fill" style="width: ${percent}%">
          ${this.options.showInsideLabel ? labelHtml : ''}
        </div>
      </div>
      ${!this.options.showInsideLabel ? labelHtml : ''}
    `;

    this.element.setAttribute('aria-valuenow', String(this.value));
  }

  /**
   * تنظیم مقدار
   */
  setValue(value) {
    this.value = Math.min(this.options.max, Math.max(0, value));
    this._updateContent();
    this.emit('change', this.value);

    if (this.value >= this.options.max) {
      this.emit('complete');
    }
  }

  /**
   * افزایش
   */
  increment(amount = 1) {
    this.setValue(this.value + amount);
  }

  /**
   * بازنشانی
   */
  reset() {
    this.value = 0;
    this._updateContent();
    this.emit('change', 0);
    this.emit('reset');
  }

  /**
   * تنظیم متن
   */
  setLabel(label) {
    this.options.label = label;
    this._updateContent();
  }

  /**
   * نمایش
   */
  show() {
    if (this.element) {
      this.element.hidden = false;
    }
  }

  /**
   * مخفی کردن
   */
  hide() {
    if (this.element) {
      this.element.hidden = true;
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
    this.element?.remove();
    this.listeners.clear();
  }
}

/**
 * دایره پیشرفت
 */
class CircularProgress {
  constructor(options = {}) {
    this.options = {
      value: 0,
      max: 100,
      size: 120,
      strokeWidth: 8,
      showLabel: true,
      showPercentage: true,
      color: 'var(--color-primary)',
      trackColor: 'var(--bg-tertiary)',
      ...options
    };

    this.element = null;
    this.value = this.options.value;
    this.listeners = new Map();
  }

  /**
   * رندر
   */
  render() {
    const { size, strokeWidth } = this.options;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    this.element = DomUtils.create('div', {
      className: 'circular-progress',
      style: {
        width: size + 'px',
        height: size + 'px',
        position: 'relative'
      }
    });

    this.element.innerHTML = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle
          class="circular-progress-track"
          cx="${size / 2}"
          cy="${size / 2}"
          r="${radius}"
          fill="none"
          stroke="${this.options.trackColor}"
          stroke-width="${strokeWidth}"
        />
        <circle
          class="circular-progress-fill"
          cx="${size / 2}"
          cy="${size / 2}"
          r="${radius}"
          fill="none"
          stroke="${this.options.color}"
          stroke-width="${strokeWidth}"
          stroke-linecap="round"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${circumference}"
          transform="rotate(-90 ${size / 2} ${size / 2})"
        />
      </svg>
      ${this.options.showLabel ? `
        <div class="circular-progress-label" style="
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          font-size: ${size / 6}px;
          font-weight: 700;
        ">
          <span class="circular-progress-value">0٪</span>
        </div>
      ` : ''}
    `;

    this._circumference = circumference;
    this._updateContent();
    return this.element;
  }

  /**
   * به‌روزرسانی
   */
  _updateContent() {
    if (!this.element) return;

    const percent = Math.min(100, Math.max(0, (this.value / this.options.max) * 100));
    const fill = this.element.querySelector('.circular-progress-fill');
    const valueEl = this.element.querySelector('.circular-progress-value');

    if (fill) {
      const offset = this._circumference - (percent / 100) * this._circumference;
      fill.style.strokeDashoffset = offset;
      fill.style.transition = 'stroke-dashoffset 0.5s ease';
    }

    if (valueEl) {
      valueEl.textContent = `${StringUtils.englishToPersianDigits(Math.round(percent))}٪`;
    }
  }

  /**
   * تنظیم مقدار
   */
  setValue(value) {
    this.value = Math.min(this.options.max, Math.max(0, value));
    this._updateContent();
    this.emit('change', this.value);

    if (this.value >= this.options.max) {
      this.emit('complete');
    }
  }

  /**
   * بازنشانی
   */
  reset() {
    this.value = 0;
    this._updateContent();
    this.emit('reset');
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
    this.element?.remove();
    this.listeners.clear();
  }
}

window.ProgressBar = ProgressBar;
window.CircularProgress = CircularProgress;