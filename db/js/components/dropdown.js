/**
 * کامپوننت منوی بازشو
 */
class Dropdown {
  constructor(options = {}) {
    this.options = {
      trigger: 'click',
      placement: 'bottom-start',
      closeOnSelect: true,
      closeOnOutsideClick: true,
      offset: 4,
      maxHeight: 400,
      searchable: false,
      searchPlaceholder: 'جستجو...',
      ...options
    };

    this.element = null;
    this.elements = {};
    this.items = options.items || [];
    this.selectedValue = options.value;
    this.open = false;
    this.listeners = new Map();
    this._boundOutsideClick = this._handleOutsideClick.bind(this);
  }

  /**
   * رندر
   */
  render() {
    this.element = DomUtils.create('div', {
      className: `dropdown-component ${this.options.className || ''}`
    });

    this.element.innerHTML = `
      <button class="dropdown-trigger" aria-haspopup="listbox" aria-expanded="false">
        <span class="dropdown-trigger-content"></span>
        <span class="dropdown-trigger-arrow">▼</span>
      </button>
      <div class="dropdown-menu" hidden role="listbox">
        ${this.options.searchable ? `
          <div class="dropdown-search">
            <input type="search" class="dropdown-search-input" placeholder="${this.options.searchPlaceholder}" />
          </div>
        ` : ''}
        <div class="dropdown-items" role="listbox"></div>
        <div class="dropdown-empty" hidden>موردی یافت نشد</div>
      </div>
    `;

    this._cacheElements();
    this._bindEvents();
    this._renderTriggerContent();
    this._renderItems();

    return this.element;
  }

  /**
   * ذخیره عناصر
   */
  _cacheElements() {
    this.elements = {
      trigger: this.element.querySelector('.dropdown-trigger'),
      triggerContent: this.element.querySelector('.dropdown-trigger-content'),
      menu: this.element.querySelector('.dropdown-menu'),
      items: this.element.querySelector('.dropdown-items'),
      search: this.element.querySelector('.dropdown-search-input'),
      empty: this.element.querySelector('.dropdown-empty')
    };
  }

  /**
   * ثبت رویدادها
   */
  _bindEvents() {
    this.elements.trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    // جستجو
    if (this.elements.search) {
      this.elements.search.addEventListener('input', debounce((e) => {
        this._filterItems(e.target.value);
      }, 200));
    }

    // آیتم‌ها
    this.elements.items.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (!item || item.classList.contains('disabled')) return;

      const itemId = item.dataset.itemId;
      this._selectItem(itemId);
    });

    // Keydown
    this.elements.trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.openMenu();
      }
    });

    this.element.addEventListener('keydown', (e) => {
      if (!this.open) return;

      if (e.key === 'Escape') {
        this.closeMenu();
        this.elements.trigger.focus();
      }
    });
  }

  /**
   * تغییر وضعیت
   */
  toggle() {
    if (this.open) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  /**
   * باز کردن
   */
  openMenu() {
    if (this.open) return;

    this.open = true;
    this.elements.menu.hidden = false;
    this.elements.trigger.setAttribute('aria-expanded', 'true');

    requestAnimationFrame(() => {
      this.elements.menu.classList.add('open');
      this._position();
    });

    if (this.options.closeOnOutsideClick) {
      setTimeout(() => {
        document.addEventListener('click', this._boundOutsideClick);
      }, 0);
    }

    if (this.elements.search) {
      this.elements.search.value = '';
      this._filterItems('');
      setTimeout(() => this.elements.search.focus(), 50);
    }

    this.emit('open');
  }

  /**
   * بستن
   */
  closeMenu() {
    if (!this.open) return;

    this.open = false;
    this.elements.menu.classList.remove('open');
    this.elements.trigger.setAttribute('aria-expanded', 'false');

    setTimeout(() => {
      this.elements.menu.hidden = true;
    }, 200);

    document.removeEventListener('click', this._boundOutsideClick);
    this.emit('close');
  }

  /**
   * موقعیت
   */
  _position() {
    const trigger = this.elements.trigger.getBoundingClientRect();
    const menu = this.elements.menu;
    const menuRect = menu.getBoundingClientRect();

    const placement = this.options.placement;
    let top, left;

    if (placement.startsWith('bottom')) {
      top = trigger.bottom + this.options.offset;
    } else if (placement.startsWith('top')) {
      top = trigger.top - menuRect.height - this.options.offset;
    }

    if (placement.endsWith('start')) {
      left = trigger.left;
    } else if (placement.endsWith('end')) {
      left = trigger.right - menuRect.width;
    } else {
      left = trigger.left + (trigger.width - menuRect.width) / 2;
    }

    // مرزها
    if (left < 8) left = 8;
    if (left + menuRect.width > window.innerWidth - 8) {
      left = window.innerWidth - menuRect.width - 8;
    }

    if (top + menuRect.height > window.innerHeight - 8) {
      top = trigger.top - menuRect.height - this.options.offset;
    }

    if (top < 8) top = 8;

    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
    menu.style.minWidth = trigger.width + 'px';
  }

  /**
   * رندر محتوای تریگر
   */
  _renderTriggerContent() {
    if (!this.elements.triggerContent) return;

    if (this.selectedValue !== undefined) {
      const selected = this.items.find(i => i.value === this.selectedValue);
      if (selected) {
        this.elements.triggerContent.innerHTML = `
          ${selected.icon ? `<span class="dropdown-trigger-icon">${selected.icon}</span>` : ''}
          <span>${StringUtils.escapeHtml(selected.label)}</span>
        `;
        return;
      }
    }

    this.elements.triggerContent.innerHTML = this.options.placeholder || 'انتخاب کنید';
  }

  /**
   * رندر آیتم‌ها
   */
  _renderItems() {
    if (!this.elements.items) return;

    if (this.items.length === 0) {
      this.elements.items.innerHTML = '';
      this.elements.empty.hidden = false;
      return;
    }

    this.elements.empty.hidden = true;

    this.elements.items.innerHTML = this.items.map(item => {
      if (item.type === 'separator') {
        return '<div class="dropdown-separator"></div>';
      }

      if (item.type === 'header') {
        return `<div class="dropdown-header">${StringUtils.escapeHtml(item.label)}</div>`;
      }

      const selected = item.value === this.selectedValue;

      return `
        <div
          class="dropdown-item ${selected ? 'selected' : ''} ${item.disabled ? 'disabled' : ''}"
          data-item-id="${item.id || item.value}"
          data-value="${item.value}"
          role="option"
          aria-selected="${selected}"
        >
          ${item.icon ? `<span class="dropdown-item-icon">${item.icon}</span>` : ''}
          <div class="dropdown-item-content">
            <div class="dropdown-item-label">${StringUtils.escapeHtml(item.label)}</div>
            ${item.description ? `<div class="dropdown-item-desc">${StringUtils.escapeHtml(item.description)}</div>` : ''}
          </div>
          ${item.badge ? `<span class="dropdown-item-badge">${item.badge}</span>` : ''}
          ${selected ? '<span class="dropdown-item-check">✓</span>' : ''}
        </div>
      `;
    }).join('');
  }

  /**
   * فیلتر آیتم‌ها
   */
  _filterItems(term) {
    const lower = term.toLowerCase();

    this.elements.items.querySelectorAll('.dropdown-item').forEach(el => {
      const label = el.querySelector('.dropdown-item-label')?.textContent || '';
      const desc = el.querySelector('.dropdown-item-desc')?.textContent || '';
      const matches = !term || label.toLowerCase().includes(lower) || desc.toLowerCase().includes(lower);

      el.hidden = !matches;
    });

    const visible = Array.from(this.elements.items.querySelectorAll('.dropdown-item:not([hidden])'));
    this.elements.empty.hidden = visible.length > 0;
  }

  /**
   * انتخاب آیتم
   */
  _selectItem(itemId) {
    const item = this.items.find(i => (i.id || i.value) === itemId);
    if (!item || item.disabled) return;

    this.selectedValue = item.value;
    this._renderTriggerContent();

    this.elements.items.querySelectorAll('.dropdown-item').forEach(el => {
      const selected = el.dataset.value === String(item.value);
      el.classList.toggle('selected', selected);
      el.setAttribute('aria-selected', String(selected));

      const check = el.querySelector('.dropdown-item-check');
      if (selected && !check) {
        el.insertAdjacentHTML('beforeend', '<span class="dropdown-item-check">✓</span>');
      } else if (!selected && check) {
        check.remove();
      }
    });

    this.emit('select', item);
    if (this.options.onSelect) {
      this.options.onSelect(item);
    }

    if (this.options.closeOnSelect) {
      this.closeMenu();
    }
  }

  /**
   * هندلر کلیک خارج
   */
  _handleOutsideClick(e) {
    if (!this.element.contains(e.target)) {
      this.closeMenu();
    }
  }

  /**
   * تنظیم آیتم‌ها
   */
  setItems(items) {
    this.items = items;
    this._renderItems();
    this._renderTriggerContent();
  }

  /**
   * تنظیم مقدار
   */
  setValue(value) {
    this.selectedValue = value;
    this._renderTriggerContent();
    this._renderItems();
  }

  /**
   * دریافت مقدار
   */
  getValue() {
    return this.selectedValue;
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
    document.removeEventListener('click', this._boundOutsideClick);
    this.listeners.clear();
    this.element?.remove();
  }
}

window.Dropdown = Dropdown;