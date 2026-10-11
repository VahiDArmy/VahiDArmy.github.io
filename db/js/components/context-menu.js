/**
 * کامپوننت منوی زمینه
 * منوی راست‌کلیک با گزینه‌های پویا
 */
class ContextMenu {
  constructor() {
    this.element = null;
    this.visible = false;
    this.currentItems = [];
    this.position = { x: 0, y: 0 };
    this.listeners = new Map();
    this._boundClick = this._handleGlobalClick.bind(this);
    this._boundScroll = this._handleScroll.bind(this);
    this._boundKeydown = this._handleKeydown.bind(this);
    this._boundContextMenu = this._handleContextMenu.bind(this);
  }

  /**
   * راه‌اندازی
   */
  init() {
    document.addEventListener('click', this._boundClick, true);
    document.addEventListener('scroll', this._boundScroll, true);
    document.addEventListener('keydown', this._boundKeydown);
    document.addEventListener('contextmenu', this._boundContextMenu);

    return this;
  }

  /**
   * نمایش منو
   */
  show(x, y, items, options = {}) {
    if (!items || items.length === 0) return;

    this.currentItems = this._normalizeItems(items);
    this.position = { x, y };

    this._render(options);
    this._position(x, y);

    this.visible = true;
    this.emit('opened', { x, y, items: this.currentItems });
  }

  /**
   * مخفی کردن منو
   */
  hide() {
    if (!this.visible) return;

    if (this.element) {
      this.element.classList.add('closing');
      setTimeout(() => {
        this.element?.remove();
        this.element = null;
      }, 150);
    }

    this.visible = false;
    this.emit('closed');
  }

  /**
   * نرمال‌سازی آیتم‌ها
   */
  _normalizeItems(items) {
    return items.map(item => {
      if (item === 'separator' || item === '-') {
        return { type: 'separator' };
      }

      return {
        type: 'item',
        id: item.id || StringUtils.randomId(),
        label: item.label || '',
        icon: item.icon || null,
        shortcut: item.shortcut || null,
        disabled: Boolean(item.disabled),
        danger: Boolean(item.danger),
        checked: item.checked,
        submenu: item.submenu ? this._normalizeItems(item.submenu) : null,
        onClick: item.onClick || null,
        ...item
      };
    });
  }

  /**
   * رندر
   */
  _render(options = {}) {
    if (this.element) {
      this.element.remove();
    }

    this.element = DomUtils.create('div', {
      className: 'context-menu',
      attrs: { role: 'menu', 'aria-label': options.label || 'منوی زمینه' }
    });

    this.element.innerHTML = this._renderItems(this.currentItems, 0);
    document.body.appendChild(this.element);

    this._bindItemEvents();
    this._handleSubmenus();

    requestAnimationFrame(() => {
      this.element?.classList.add('visible');
    });
  }

  /**
   * رندر آیتم‌ها
   */
  _renderItems(items, level) {
    return items.map(item => this._renderItem(item, level)).join('');
  }

  /**
   * رندر یک آیتم
   */
  _renderItem(item, level) {
    if (item.type === 'separator') {
      return `<div class="context-menu-separator" role="separator"></div>`;
    }

    const classes = [
      'context-menu-item',
      item.disabled ? 'disabled' : '',
      item.danger ? 'danger' : ''
    ].filter(Boolean).join(' ');

    let checkHtml = '';
    if (item.checked !== undefined) {
      checkHtml = `<span class="context-menu-check">${item.checked ? '✓' : ''}</span>`;
    }

    let iconHtml = '';
    if (item.icon) {
      iconHtml = `<span class="context-menu-icon">${item.icon}</span>`;
    }

    let shortcutHtml = '';
    if (item.shortcut) {
      shortcutHtml = `<span class="context-menu-shortcut">${item.shortcut}</span>`;
    }

    let submenuArrow = '';
    if (item.submenu) {
      submenuArrow = `<span class="context-menu-arrow">◀</span>`;
    }

    let submenuHtml = '';
    if (item.submenu) {
      submenuHtml = `
        <div class="context-menu-submenu" data-submenu-for="${item.id}">
          ${this._renderItems(item.submenu, level + 1)}
        </div>
      `;
    }

    return `
      <div
        class="${classes}"
        data-item-id="${item.id}"
        role="menuitem"
        ${item.disabled ? 'aria-disabled="true"' : ''}
        ${item.submenu ? 'aria-haspopup="true" aria-expanded="false"' : ''}
      >
        ${checkHtml}
        ${iconHtml}
        <span class="context-menu-label">${StringUtils.escapeHtml(item.label)}</span>
        ${shortcutHtml}
        ${submenuArrow}
      </div>
      ${submenuHtml}
    `;
  }

  /**
   * ثبت رویدادهای آیتم‌ها
   */
  _bindItemEvents() {
    if (!this.element) return;

    this.element.querySelectorAll('.context-menu-item:not(.disabled)').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();

        // اگر زیرمنو دارد، فقط باز/بسته کن
        if (el.getAttribute('aria-haspopup') === 'true') {
          this._toggleSubmenu(el);
          return;
        }

        const itemId = el.dataset.itemId;
        const item = this._findItem(itemId);

        if (item && item.onClick) {
          try {
            item.onClick();
          } catch (error) {
            console.error('خطا در اجرای آیتم منو:', error);
          }
        }

        if (item && item.keepOpen !== true) {
          this.hide();
        }

        this.emit('itemClick', { item });
      });

      el.addEventListener('mouseenter', () => {
        // بستن سایر زیرمنوها
        this.element.querySelectorAll('.context-menu-submenu.open').forEach(sm => {
          if (sm.dataset.submenuFor !== el.dataset.itemId) {
            sm.classList.remove('open');
            const other = this.element.querySelector(`[data-item-id="${sm.dataset.submenuFor}"]`);
            other?.setAttribute('aria-expanded', 'false');
          }
        });

        if (el.getAttribute('aria-haspopup') === 'true') {
          this._toggleSubmenu(el, true);
        }
      });
    });
  }

  /**
   * مدیریت زیرمنوها
   */
  _handleSubmenus() {
    if (!this.element) return;

    this.element.querySelectorAll('.context-menu-item[aria-haspopup="true"]').forEach(el => {
      el.addEventListener('mouseenter', () => {
        const submenu = this.element.querySelector(`[data-submenu-for="${el.dataset.itemId}"]`);
        if (submenu && !submenu.classList.contains('open')) {
          this._toggleSubmenu(el);
        }
      });
    });
  }

  /**
   * تغییر وضعیت زیرمنو
   */
  _toggleSubmenu(parentEl, force = false) {
    const itemId = parentEl.dataset.itemId;
    const submenu = this.element.querySelector(`[data-submenu-for="${itemId}"]`);

    if (!submenu) return;

    const isOpen = submenu.classList.contains('open');

    if (force || !isOpen) {
      // بستن سایر زیرمنوها
      this.element.querySelectorAll('.context-menu-submenu.open').forEach(sm => {
        if (sm !== submenu) sm.classList.remove('open');
      });

      submenu.classList.add('open');
      parentEl.setAttribute('aria-expanded', 'true');

      // موقعیت‌دهی
      this._positionSubmenu(parentEl, submenu);
    } else {
      submenu.classList.remove('open');
      parentEl.setAttribute('aria-expanded', 'false');
    }
  }

  /**
   * موقعیت زیرمنو
   */
  _positionSubmenu(parentEl, submenu) {
    const parentRect = parentEl.getBoundingClientRect();
    const submenuRect = submenu.getBoundingClientRect();

    let left = parentRect.right + 4;
    let top = parentRect.top;

    // بررسی فضای سمت راست (در RTL، چپ)
    if (left + submenuRect.width > window.innerWidth) {
      left = parentRect.left - submenuRect.width - 4;
    }

    // بررسی فضای پایین
    if (top + submenuRect.height > window.innerHeight) {
      top = window.innerHeight - submenuRect.height - 8;
    }

    if (top < 0) top = 8;

    submenu.style.left = left + 'px';
    submenu.style.top = top + 'px';
  }

  /**
   * یافتن آیتم با id
   */
  _findItem(id, items = null) {
    const list = items || this.currentItems;

    for (const item of list) {
      if (item.id === id) return item;
      if (item.submenu) {
        const found = this._findItem(id, item.submenu);
        if (found) return found;
      }
    }

    return null;
  }

  /**
   * موقعیت‌دهی منو
   */
  _position(x, y) {
    if (!this.element) return;

    const rect = this.element.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    let left = x;
    let top = y;

    // بررسی فضای سمت راست (RTL، چپ)
    if (left + width > window.innerWidth) {
      left = window.innerWidth - width - 8;
    }

    if (left < 0) left = 8;

    // بررسی فضای پایین
    if (top + height > window.innerHeight) {
      top = y - height;
    }

    if (top < 0) top = 8;

    this.element.style.left = left + 'px';
    this.element.style.top = top + 'px';
  }

  /**
   * هندلر کلیک سراسری
   */
  _handleGlobalClick(e) {
    if (!this.visible || !this.element) return;

    if (!this.element.contains(e.target)) {
      this.hide();
    }
  }

  /**
   * هندلر اسکرول
   */
  _handleScroll(e) {
    if (!this.visible) return;
    if (this.element && this.element.contains(e.target)) return;
    this.hide();
  }

  /**
   * هندلر کیبورد
   */
  _handleKeydown(e) {
    if (!this.visible) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      this.hide();
    }
  }

  /**
   * هندلر contextmenu
   */
  _handleContextMenu(e) {
    // جلوگیری از منوی پیش‌فرض در عناصر خاص
    if (!e.target.closest('[data-context-menu]')) return;
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
    document.removeEventListener('click', this._boundClick, true);
    document.removeEventListener('scroll', this._boundScroll, true);
    document.removeEventListener('keydown', this._boundKeydown);
    document.removeEventListener('contextmenu', this._boundContextMenu);
    this.hide();
    this.listeners.clear();
  }
}

const contextMenu = new ContextMenu();

/**
 * منوهای از پیش تعریف شده
 */
const ContextMenus = {
  /**
   * منوی جدول
   */
  table(options = {}) {
    return [
      {
        label: 'مشاهده داده‌ها',
        icon: '👁️',
        onClick: options.onView
      },
      {
        label: 'مشاهده ساختار',
        icon: '📐',
        onClick: options.onViewSchema
      },
      'separator',
      {
        label: 'صادرات جدول',
        icon: '📤',
        submenu: [
          { label: 'JSON', onClick: () => options.onExport && options.onExport('json') },
          { label: 'CSV', onClick: () => options.onExport && options.onExport('csv') },
          { label: 'SQL', onClick: () => options.onExport && options.onExport('sql') },
          { label: 'XML', onClick: () => options.onExport && options.onExport('xml') },
          { label: 'Excel', onClick: () => options.onExport && options.onExport('excel') }
        ]
      },
      {
        label: 'تولید کوئری',
        icon: '💻',
        submenu: [
          { label: 'SELECT', onClick: () => options.onGenerateQuery && options.onGenerateQuery('select') },
          { label: 'INSERT', onClick: () => options.onGenerateQuery && options.onGenerateQuery('insert') },
          { label: 'UPDATE', onClick: () => options.onGenerateQuery && options.onGenerateQuery('update') },
          { label: 'DELETE', onClick: () => options.onGenerateQuery && options.onGenerateQuery('delete') }
        ]
      },
      'separator',
      {
        label: 'تغییر نام',
        icon: '✏️',
        onClick: options.onRename
      },
      {
        label: 'کپی',
        icon: '📋',
        onClick: options.onDuplicate
      },
      'separator',
      {
        label: 'خالی کردن جدول',
        icon: '🗑️',
        danger: true,
        onClick: options.onTruncate
      },
      {
        label: 'حذف جدول',
        icon: '❌',
        danger: true,
        onClick: options.onDrop
      }
    ];
  },

  /**
   * منوی سلول جدول داده
   */
  tableCell(options = {}) {
    return [
      {
        label: 'کپی مقدار',
        icon: '📋',
        shortcut: 'Ctrl+C',
        onClick: options.onCopy
      },
      {
        label: 'کپی ردیف',
        icon: '📋',
        onClick: options.onCopyRow
      },
      {
        label: 'کپی به عنوان JSON',
        icon: '{}',
        onClick: () => options.onCopyAs && options.onCopyAs('json')
      },
      {
        label: 'کپی به عنوان CSV',
        icon: '📄',
        onClick: () => options.onCopyAs && options.onCopyAs('csv')
      },
      {
        label: 'کپی به عنوان SQL',
        icon: '💾',
        onClick: () => options.onCopyAs && options.onCopyAs('sql')
      },
      'separator',
      {
        label: 'ویرایش',
        icon: '✏️',
        onClick: options.onEdit
      },
      'separator',
      {
        label: 'درج ردیف بالا',
        icon: '⬆️',
        onClick: () => options.onInsert && options.onInsert('above')
      },
      {
        label: 'درج ردیف پایین',
        icon: '⬇️',
        onClick: () => options.onInsert && options.onInsert('below')
      },
      'separator',
      {
        label: 'حذف ردیف',
        icon: '🗑️',
        danger: true,
        onClick: options.onDelete
      }
    ];
  },

  /**
   * منوی هدر ستون
   */
  columnHeader(options = {}) {
    return [
      {
        label: 'مرتب‌سازی صعودی',
        icon: '⬆️',
        onClick: () => options.onSort && options.onSort('asc')
      },
      {
        label: 'مرتب‌سازی نزولی',
        icon: '⬇️',
        onClick: () => options.onSort && options.onSort('desc')
      },
      {
        label: 'لغو مرتب‌سازی',
        icon: '↔️',
        disabled: !options.sorted,
        onClick: options.onClearSort
      },
      'separator',
      {
        label: 'فیلتر',
        icon: '🔍',
        onClick: options.onFilter
      },
      {
        label: 'پاک کردن فیلتر',
        icon: '✕',
        disabled: !options.filtered,
        onClick: options.onClearFilter
      },
      'separator',
      {
        label: 'ثابت کردن ستون',
        icon: '📌',
        checked: options.frozen,
        onClick: options.onFreeze
      },
      {
        label: 'مخفی کردن ستون',
        icon: '👁️',
        onClick: options.onHide
      },
      {
        label: 'اندازه خودکار',
        icon: '↔️',
        onClick: options.onAutoFit
      },
      'separator',
      {
        label: 'کپی نام ستون',
        icon: '📋',
        onClick: options.onCopyName
      }
    ];
  },

  /**
   * منوی عمومی جدول داده
   */
  dataTable(options = {}) {
    return [
      {
        label: 'بازنشانی',
        icon: '🔄',
        shortcut: 'F5',
        onClick: options.onRefresh
      },
      {
        label: 'انتخاب همه',
        icon: '✓',
        shortcut: 'Ctrl+A',
        onClick: options.onSelectAll
      },
      {
        label: 'لغو انتخاب',
        icon: '✕',
        onClick: options.onDeselectAll
      },
      'separator',
      {
        label: 'صادرات',
        icon: '📤',
        submenu: [
          { label: 'JSON', onClick: () => options.onExport && options.onExport('json') },
          { label: 'CSV', onClick: () => options.onExport && options.onExport('csv') },
          { label: 'Excel', onClick: () => options.onExport && options.onExport('excel') }
        ]
      },
      {
        label: 'ستون‌ها',
        icon: '📊',
        submenu: options.columns ? options.columns.map(col => ({
          label: col.name,
          icon: col.visible ? '✓' : '',
          onClick: () => options.onToggleColumn && options.onToggleColumn(col.name)
        })) : []
      },
      'separator',
      {
        label: 'تنظیمات',
        icon: '⚙️',
        onClick: options.onSettings
      }
    ];
  },

  /**
   * منوی فایل‌های اخیر
   */
  recentFile(options = {}) {
    return [
      {
        label: 'باز کردن',
        icon: '📂',
        onClick: options.onOpen
      },
      {
        label: 'حذف از لیست',
        icon: '❌',
        danger: true,
        onClick: options.onRemove
      }
    ];
  }
};

window.ContextMenu = ContextMenu;
window.contextMenu = contextMenu;
window.ContextMenus = ContextMenus;