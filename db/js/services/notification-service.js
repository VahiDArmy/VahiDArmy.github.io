/**
 * سرویس اعلان‌ها
 * مدیریت نوتیفیکیشن‌های درون‌برنامه‌ای
 */
class NotificationService {
  constructor() {
    this.container = null;
    this.notifications = [];
    this.maxVisible = 5;
    this.defaultDuration = 5000;
    this.queue = [];
    this.listeners = new Map();
    this._counter = 0;
    this._init();
  }

  /**
   * راه‌اندازی ظرف اعلان‌ها
   */
  _init() {
    if (typeof document === 'undefined') return;

    document.addEventListener('DOMContentLoaded', () => {
      this._createContainer();
    });

    if (document.readyState !== 'loading') {
      this._createContainer();
    }
  }

  /**
   * ایجاد ظرف
   */
  _createContainer() {
    if (this.container && document.body.contains(this.container)) return;

    this.container = document.createElement('div');
    this.container.id = 'notification-container';
    this.container.className = 'notification-container';
    this.container.setAttribute('aria-live', 'polite');
    this.container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(this.container);
  }

  /**
   * نمایش اعلان
   */
  show(message, options = {}) {
    const notification = {
      id: ++this._counter,
      message: String(message),
      title: options.title || null,
      type: options.type || 'info',
      duration: options.duration !== undefined ? options.duration : this.defaultDuration,
      dismissible: options.dismissible !== false,
      actions: options.actions || [],
      icon: options.icon || null,
      timestamp: Date.now(),
      progress: options.showProgress !== false && options.duration > 0
    };

    if (this.notifications.length >= this.maxVisible) {
      // حذف قدیمی‌ترین
      const oldest = this.notifications[0];
      this.dismiss(oldest.id);
    }

    this.notifications.push(notification);
    this._render(notification);
    this.emit('shown', notification);

    if (notification.duration > 0) {
      setTimeout(() => {
        this.dismiss(notification.id);
      }, notification.duration);
    }

    return notification.id;
  }

  /**
   * نمایش پیام موفقیت
   */
  success(message, options = {}) {
    return this.show(message, { ...options, type: 'success' });
  }

  /**
   * نمایش پیام خطا
   */
  error(message, options = {}) {
    return this.show(message, { ...options, type: 'error', duration: options.duration || 7000 });
  }

  /**
   * نمایش هشدار
   */
  warning(message, options = {}) {
    return this.show(message, { ...options, type: 'warning' });
  }

  /**
   * نمایش اطلاعات
   */
  info(message, options = {}) {
    return this.show(message, { ...options, type: 'info' });
  }

  /**
   * رندر اعلان
   */
  _render(notification) {
    if (!this.container) this._createContainer();

    const el = document.createElement('div');
    el.className = `notification notification-${notification.type}`;
    el.dataset.id = notification.id;
    el.setAttribute('role', 'alert');

    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    const icon = notification.icon || icons[notification.type] || 'ℹ';

    let actionsHtml = '';
    if (notification.actions && notification.actions.length > 0) {
      actionsHtml = `<div class="notification-actions">${notification.actions.map((action, i) => `
        <button class="notification-action" data-action-index="${i}">${action.label}</button>
      `).join('')}</div>`;
    }

    let progressHtml = '';
    if (notification.progress) {
      progressHtml = `<div class="notification-progress" style="animation-duration: ${notification.duration}ms"></div>`;
    }

    el.innerHTML = `
      <div class="notification-icon">${icon}</div>
      <div class="notification-content">
        ${notification.title ? `<div class="notification-title">${notification.title}</div>` : ''}
        <div class="notification-message">${notification.message}</div>
        ${actionsHtml}
      </div>
      ${notification.dismissible ? '<button class="notification-close" aria-label="بستن">✕</button>' : ''}
      ${progressHtml}
    `;

    // رویدادهای تعاملی
    const closeBtn = el.querySelector('.notification-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.dismiss(notification.id));
    }

    el.querySelectorAll('.notification-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.actionIndex);
        const action = notification.actions[idx];
        if (action && action.onClick) {
          action.onClick(notification);
        }
        if (action && action.dismiss !== false) {
          this.dismiss(notification.id);
        }
      });
    });

    // انیمیشن ورود
    el.classList.add('notification-enter');

    this.container.appendChild(el);

    requestAnimationFrame(() => {
      el.classList.remove('notification-enter');
      el.classList.add('notification-visible');
    });

    // پیگیری برای حذف انیمیشن
    el.addEventListener('animationend', () => {
      el.classList.remove('notification-visible');
      el.classList.add('notification-visible');
    }, { once: true });
  }

  /**
   * حذف اعلان
   */
  dismiss(id) {
    const index = this.notifications.findIndex(n => n.id === id);
    if (index < 0) return false;

    const [notification] = this.notifications.splice(index, 1);

    const el = this.container?.querySelector(`[data-id="${id}"]`);
    if (el) {
      el.classList.add('notification-exit');
      setTimeout(() => el.remove(), 300);
    }

    this.emit('dismissed', notification);
    return true;
  }

  /**
   * حذف همه اعلان‌ها
   */
  dismissAll() {
    const ids = this.notifications.map(n => n.id);
    ids.forEach(id => this.dismiss(id));
  }

  /**
   * دریافت اعلان‌های فعال
   */
  getActive() {
    return [...this.notifications];
  }

  /**
   * پاک‌سازی
   */
  clear() {
    this.notifications = [];
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  /**
   * اعلان پیشرفت
   */
  progress(message, options = {}) {
    const id = this.show(message, {
      ...options,
      type: 'info',
      duration: 0,
      dismissible: false,
      showProgress: false,
      actions: [
        {
          label: 'انصراف',
          onClick: () => options.onCancel && options.onCancel()
        }
      ]
    });

    const el = this.container?.querySelector(`[data-id="${id}"]`);

    return {
      id,
      update: (percent, newMessage = null) => {
        const progressBar = el?.querySelector('.notification-progress-bar');
        if (progressBar) {
          progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
        }
        if (newMessage) {
          const msgEl = el?.querySelector('.notification-message');
          if (msgEl) msgEl.textContent = newMessage;
        }
      },
      complete: (finalMessage = null) => {
        if (finalMessage) {
          const msgEl = el?.querySelector('.notification-message');
          if (msgEl) msgEl.textContent = finalMessage;
        }
        setTimeout(() => this.dismiss(id), 1000);
      },
      dismiss: () => this.dismiss(id)
    };
  }

  /**
   * تأییدیه
   */
  confirm(message, options = {}) {
    return new Promise((resolve) => {
      this.show(message, {
        title: options.title || 'تأیید',
        type: 'warning',
        duration: 0,
        dismissible: false,
        actions: [
          {
            label: options.confirmText || 'تأیید',
            onClick: () => resolve(true)
          },
          {
            label: options.cancelText || 'انصراف',
            onClick: () => resolve(false)
          }
        ]
      });
    });
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

const notificationService = new NotificationService();