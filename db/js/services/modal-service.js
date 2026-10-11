/**
 * سرویس مودال‌ها
 * مدیریت دیالوگ‌های مودال
 */
class ModalService {
  constructor() {
    this.modals = new Map();
    this.stack = [];
    this.listeners = new Map();
    this._counter = 0;
    this.defaultOptions = {
      closable: true,
      closeOnBackdrop: true,
      closeOnEscape: true,
      size: 'md',
      animation: true,
      scrollable: true
    };
    this._initEscapeHandler();
  }

  /**
   * راه‌اندازی ESC
   */
  _initEscapeHandler() {
    if (typeof document === 'undefined') return;

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.stack.length > 0) {
        const topModal = this.stack[this.stack.length - 1];
        if (topModal.options.closeOnEscape && topModal.options.closable) {
          e.preventDefault();
          this.close(topModal.id);
        }
      }
    });
  }

  /**
   * پاک‌سازی backdrop های یتیم (safety net)
   */
  _cleanupOrphans() {
    document.querySelectorAll('.modal-backdrop').forEach(el => {
      const rawId = el.id.replace(/-backdrop$/, '');
      if (!this.modals.has(rawId)) {
        el.remove();
      }
    });
  }

  /**
   * باز کردن مودال
   */
  open(content, options = {}) {
    // پاک‌سازی backdrop های باقی‌مانده از قبل
    this._cleanupOrphans();

    const opts = { ...this.defaultOptions, ...options };
    const id = options.id || `modal-${++this._counter}`;

    const modal = {
      id,
      content,
      options: opts,
      createdAt: Date.now(),
      resolve: null,
      reject: null
    };

    this.modals.set(id, modal);
    this._render(modal);
    this.stack.push(modal);

    if (this.stack.length === 1) {
      document.body.style.overflow = 'hidden';
    }

    this.emit('opened', modal);

    return new Promise((resolve, reject) => {
      modal.resolve = resolve;
      modal.reject = reject;
    });
  }

  /**
   * بستن مودال
   * نکته مهم: هم wrapper و هم backdrop باید حذف شوند
   */
  close(id, result = undefined) {
    const modal = this.modals.get(id);
    if (!modal) return false;

    const backdrop = document.getElementById(`${id}-backdrop`);
    const wrapper = document.getElementById(id);

    // اضافه کردن کلاس بستن به backdrop تا انیمیشن اجرا شود
    if (backdrop) {
      backdrop.classList.add('modal-closing');
      backdrop.classList.remove('modal-visible');
    }

    if (wrapper) {
      wrapper.classList.add('modal-closing');
    }

    // حذف هر دو عنصر بعد از انیمیشن
    setTimeout(() => {
      if (backdrop && backdrop.parentNode) {
        backdrop.remove();
      }
      if (wrapper && wrapper.parentNode) {
        wrapper.remove();
      }
    }, 250);

    // حذف از state
    this.modals.delete(id);

    const idx = this.stack.findIndex(m => m.id === id);
    if (idx >= 0) this.stack.splice(idx, 1);

    // بازگرداندن اسکرول بدنه
    if (this.stack.length === 0) {
      document.body.style.overflow = '';
    }

    // حل promise
    if (modal.resolve) {
      modal.resolve(result);
    }

    this.emit('closed', { id, result });
    return true;
  }

  /**
   * بستن همه مودال‌ها
   */
  closeAll() {
    const ids = Array.from(this.modals.keys());
    ids.forEach(id => this.close(id));

    // پاک‌سازی نهایی
    setTimeout(() => {
      document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
      document.body.style.overflow = '';
    }, 300);
  }

  /**
   * رندر مودال
   */
  _render(modal) {
    const { id, content, options } = modal;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.id = `${id}-backdrop`;

    const wrapper = document.createElement('div');
    wrapper.className = `modal modal-${options.size}`;
    wrapper.id = id;
    wrapper.setAttribute('role', 'dialog');
    wrapper.setAttribute('aria-modal', 'true');

    if (options.title) {
      wrapper.setAttribute('aria-labelledby', `${id}-title`);
    }

    let titleHtml = '';
    if (options.title) {
      titleHtml = `
        <div class="modal-header">
          <h2 class="modal-title" id="${id}-title">${options.title}</h2>
          ${options.closable ? '<button class="modal-close" aria-label="بستن">✕</button>' : ''}
        </div>
      `;
    } else if (options.closable) {
      titleHtml = `
        <div class="modal-header modal-header-no-title">
          <button class="modal-close" aria-label="بستن">✕</button>
        </div>
      `;
    }

    let footerHtml = '';
    if (options.footer) {
      footerHtml = `<div class="modal-footer">${options.footer}</div>`;
    }

    wrapper.innerHTML = `
      ${titleHtml}
      <div class="modal-body">${content}</div>
      ${footerHtml}
    `;

    backdrop.appendChild(wrapper);
    document.body.appendChild(backdrop);

    // انیمیشن ورود
    requestAnimationFrame(() => {
      backdrop.classList.add('modal-visible');
    });

    // دکمه بستن
    const closeBtn = wrapper.querySelector('.modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close(id));
    }

    // بستن با کلیک روی backdrop
    if (options.closeOnBackdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.close(id);
        }
      });
    }

    // به‌دام انداختن فوکوس
    this._trapFocus(wrapper);

    // فوکوس اولیه
    const focusable = wrapper.querySelector('input, textarea, select, button:not(.modal-close)');
    if (focusable) {
      setTimeout(() => focusable.focus(), 100);
    }

    // اجرای callback
    if (options.onOpen) {
      setTimeout(() => options.onOpen(wrapper, modal), 50);
    }
  }

  /**
   * به‌دام انداختن فوکوس
   */
  _trapFocus(container) {
    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    container.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;

      const focusables = Array.from(container.querySelectorAll(focusableSelector))
        .filter(el => el.offsetParent !== null);

      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  /**
   * دیالوگ تأیید
   */
  confirm(message, options = {}) {
    return this.open(
      `<p class="modal-message">${message}</p>`,
      {
        title: options.title || 'تأیید',
        size: 'sm',
        footer: `
          <button class="btn btn-secondary" data-action="cancel">${options.cancelText || 'انصراف'}</button>
          <button class="btn btn-${options.danger ? 'danger' : 'primary'}" data-action="confirm">${options.confirmText || 'تأیید'}</button>
        `,
        onOpen: (wrapper, modal) => {
          const confirmBtn = wrapper.querySelector('[data-action="confirm"]');
          const cancelBtn = wrapper.querySelector('[data-action="cancel"]');

          if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
              this.close(modal.id, true);
            });
          }

          if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
              this.close(modal.id, false);
            });
          }
        }
      }
    );
  }

  /**
   * دیالوگ هشدار
   */
  alert(message, options = {}) {
    return this.open(
      `<p class="modal-message">${message}</p>`,
      {
        title: options.title || 'اطلاع',
        size: 'sm',
        footer: `<button class="btn btn-primary" data-action="ok">تأیید</button>`,
        onOpen: (wrapper, modal) => {
          const okBtn = wrapper.querySelector('[data-action="ok"]');
          if (okBtn) {
            okBtn.addEventListener('click', () => {
              this.close(modal.id);
            });
          }
        }
      }
    );
  }

  /**
   * دیالوگ پرامپت
   */
  prompt(message, options = {}) {
    const inputId = `prompt-${Date.now()}`;

    return this.open(
      `
        <p class="modal-message">${message}</p>
        <div class="form-group">
          <input
            type="${options.type || 'text'}"
            id="${inputId}"
            class="form-control"
            placeholder="${options.placeholder || ''}"
            value="${options.defaultValue || ''}"
          />
        </div>
      `,
      {
        title: options.title || 'ورودی',
        size: 'sm',
        footer: `
          <button class="btn btn-secondary" data-action="cancel">انصراف</button>
          <button class="btn btn-primary" data-action="confirm">${options.confirmText || 'تأیید'}</button>
        `,
        onOpen: (wrapper, modal) => {
          const input = wrapper.querySelector(`#${inputId}`);

          const confirm = () => {
            const value = input.value;
            if (options.validate && !options.validate(value)) {
              input.classList.add('is-invalid');
              return;
            }
            this.close(modal.id, value);
          };

          const confirmBtn = wrapper.querySelector('[data-action="confirm"]');
          const cancelBtn = wrapper.querySelector('[data-action="cancel"]');

          if (confirmBtn) confirmBtn.addEventListener('click', confirm);
          if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
              this.close(modal.id, null);
            });
          }

          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirm();
          });

          setTimeout(() => input.focus(), 100);
        }
      }
    );
  }

  /**
   * دریافت مودال فعال
   */
  getActiveModal() {
    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
  }

  /**
   * بررسی باز بودن مودال
   */
  isOpen(id) {
    return this.modals.has(id);
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

const modalService = new ModalService();