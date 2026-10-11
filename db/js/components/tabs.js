/**
 * کامپوننت تب‌ها
 * مدیریت تب‌های چندگانه با قابلیت بستن و درگ
 */
class Tabs {
  constructor(options = {}) {
    this.options = {
      closable: true,
      reorderable: true,
      addable: true,
      scrollable: true,
      maxTabs: 20,
      activeIndex: 0,
      onChange: null,
      onClose: null,
      onAdd: null,
      ...options
    };

    this.element = null;
    this.elements = {};
    this.tabs = [];
    this.activeId = null;
    this.listeners = new Map();
    this._draggedTab = null;
  }

  /**
   * رندر
   */
  render() {
    this.element = DomUtils.create('div', {
      className: 'tabs-component',
      attrs: { role: 'tablist' }
    });

    this.element.innerHTML = `
      <div class="tabs-header">
        <div class="tabs-scroll-left" hidden>
          <button class="tabs-scroll-btn" data-scroll="left" aria-label="اسکرول چپ">‹</button>
        </div>
        <div class="tabs-list" role="tablist"></div>
        <div class="tabs-scroll-right" hidden>
          <button class="tabs-scroll-btn" data-scroll="right" aria-label="اسکرول راست">›</button>
        </div>
        ${this.options.addable ? `
          <button class="tabs-add-btn" title="تب جدید">
            <span class="icon">+</span>
          </button>
        ` : ''}
      </div>
      <div class="tabs-content"></div>
    `;

    this._cacheElements();
    this._bindEvents();

    this._renderTabs();

    return this.element;
  }

  /**
   * ذخیره عناصر
   */
  _cacheElements() {
    this.elements = {
      list: this.element.querySelector('.tabs-list'),
      content: this.element.querySelector('.tabs-content'),
      addBtn: this.element.querySelector('.tabs-add-btn'),
      scrollLeft: this.element.querySelector('.tabs-scroll-left'),
      scrollRight: this.element.querySelector('.tabs-scroll-right')
    };
  }

  /**
   * ثبت رویدادها
   */
  _bindEvents() {
    this.elements.list.addEventListener('click', (e) => {
      const tab = e.target.closest('.tabs-tab');
      if (!tab) return;

      if (e.target.closest('.tabs-tab-close')) {
        e.stopPropagation();
        this.removeTab(tab.dataset.tabId);
        return;
      }

      this.setActiveTab(tab.dataset.tabId);
    });

    // دابل کلیک
    this.elements.list.addEventListener('dblclick', (e) => {
      const tab = e.target.closest('.tabs-tab');
      if (tab) {
        this.emit('tabDoubleClick', { tabId: tab.dataset.tabId });
      }
    });

    // راست‌کلیک
    this.elements.list.addEventListener('contextmenu', (e) => {
      const tab = e.target.closest('.tabs-tab');
      if (!tab) return;

      e.preventDefault();
      this._showTabContextMenu(e.clientX, e.clientY, tab.dataset.tabId);
    });

    // دکمه افزودن
    this.elements.addBtn?.addEventListener('click', () => {
      if (this.options.onAdd) {
        this.options.onAdd();
      }
      this.emit('add');
    });

    // اسکرول
    this.elements.scrollLeft?.addEventListener('click', () => {
      this.elements.list.scrollBy({ left: -200, behavior: 'smooth' });
    });

    this.elements.scrollRight?.addEventListener('click', () => {
      this.elements.list.scrollBy({ left: 200, behavior: 'smooth' });
    });

    // Drag & Drop برای ترتیب
    if (this.options.reorderable) {
      this._bindDragAndDrop();
    }

    // اسکرول wheel
    this.elements.list.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0 && this.options.scrollable) {
        e.preventDefault();
        this.elements.list.scrollLeft += e.deltaY;
      }
    });
  }

  /**
   * Drag & Drop
   */
  _bindDragAndDrop() {
    this.elements.list.addEventListener('dragstart', (e) => {
      const tab = e.target.closest('.tabs-tab');
      if (!tab) return;

      this._draggedTab = tab.dataset.tabId;
      tab.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    this.elements.list.addEventListener('dragover', (e) => {
      e.preventDefault();
      const tab = e.target.closest('.tabs-tab');
      if (!tab || tab.dataset.tabId === this._draggedTab) return;

      const rect = tab.getBoundingClientRect();
      const before = e.clientX < rect.left + rect.width / 2;

      this.elements.list.querySelectorAll('.tabs-tab').forEach(t => t.classList.remove('drag-over-left', 'drag-over-right'));
      tab.classList.add(before ? 'drag-over-left' : 'drag-over-right');
    });

    this.elements.list.addEventListener('drop', (e) => {
      e.preventDefault();
      const targetTab = e.target.closest('.tabs-tab');
      if (!targetTab) return;

      this.elements.list.querySelectorAll('.tabs-tab').forEach(t => t.classList.remove('drag-over-left', 'drag-over-right', 'dragging'));

      const targetId = targetTab.dataset.tabId;
      if (targetId === this._draggedTab) return;

      const fromIndex = this.tabs.findIndex(t => t.id === this._draggedTab);
      const toIndex = this.tabs.findIndex(t => t.id === targetId);

      if (fromIndex >= 0 && toIndex >= 0) {
        const [moved] = this.tabs.splice(fromIndex, 1);
        this.tabs.splice(toIndex, 0, moved);
        this._renderTabs();
        this.emit('reorder', { tabs: [...this.tabs] });
      }

      this._draggedTab = null;
    });

    this.elements.list.addEventListener('dragend', () => {
      this.elements.list.querySelectorAll('.tabs-tab').forEach(t => t.classList.remove('dragging', 'drag-over-left', 'drag-over-right'));
      this._draggedTab = null;
    });
  }

  /**
   * رندر تب‌ها
   */
  _renderTabs() {
    if (!this.elements.list) return;

    if (this.tabs.length === 0) {
      this.elements.list.innerHTML = '<div class="tabs-empty">تبی باز نیست</div>';
      this.elements.content.innerHTML = '';
      return;
    }

    this.elements.list.innerHTML = this.tabs.map(tab => {
      const isActive = tab.id === this.activeId;

      let icon = '';
      if (tab.icon) {
        icon = `<span class="tabs-tab-icon">${tab.icon}</span>`;
      }

      let badge = '';
      if (tab.badge !== undefined) {
        badge = `<span class="tabs-tab-badge">${tab.badge}</span>`;
      }

      let dirty = '';
      if (tab.dirty) {
        dirty = '<span class="tabs-tab-dirty">●</span>';
      }

      return `
        <div
          class="tabs-tab ${isActive ? 'active' : ''} ${tab.dirty ? 'dirty' : ''}"
          data-tab-id="${tab.id}"
          role="tab"
          aria-selected="${isActive}"
          tabindex="${isActive ? 0 : -1}"
          draggable="${this.options.reorderable}"
          title="${StringUtils.escapeHtml(tab.title || tab.label)}"
        >
          ${icon}
          <span class="tabs-tab-label">${StringUtils.escapeHtml(tab.label)}</span>
          ${badge}
          ${dirty}
          ${this.options.closable && tab.closable !== false ? `
            <button class="tabs-tab-close" aria-label="بستن تب">✕</button>
          ` : ''}
        </div>
      `;
    }).join('');

    this._updateContent();
    this._updateScrollButtons();
  }

  /**
   * به‌روزرسانی محتوا
   */
  _updateContent() {
    if (!this.elements.content) return;

    const activeTab = this.tabs.find(t => t.id === this.activeId);

    if (!activeTab) {
      this.elements.content.innerHTML = '';
      return;
    }

    if (activeTab.content instanceof HTMLElement) {
      this.elements.content.innerHTML = '';
      this.elements.content.appendChild(activeTab.content);
    } else if (typeof activeTab.content === 'string') {
      this.elements.content.innerHTML = activeTab.content;
    }
  }

  /**
   * به‌روزرسانی دکمه‌های اسکرول
   */
  _updateScrollButtons() {
    if (!this.elements.list) return;

    const hasScroll = this.elements.list.scrollWidth > this.elements.list.clientWidth;
    const atStart = this.elements.list.scrollLeft <= 0;
    const atEnd = this.elements.list.scrollLeft >= this.elements.list.scrollWidth - this.elements.list.clientWidth - 5;

    if (this.elements.scrollLeft) {
      this.elements.scrollLeft.hidden = !hasScroll || atStart;
    }
    if (this.elements.scrollRight) {
      this.elements.scrollRight.hidden = !hasScroll || atEnd;
    }
  }

  /**
   * افزودن تب
   */
  addTab(tab) {
    if (this.tabs.length >= this.options.maxTabs) {
      notificationService.warning(`حداکثر ${this.options.maxTabs} تب مجاز است`);
      return null;
    }

    const id = tab.id || StringUtils.randomId();

    const newTab = {
      id,
      label: tab.label || 'تب جدید',
      title: tab.title || tab.label,
      icon: tab.icon || null,
      content: tab.content || '',
      badge: tab.badge,
      dirty: Boolean(tab.dirty),
      closable: tab.closable !== false,
      data: tab.data || null
    };

    this.tabs.push(newTab);
    this.activeId = id;
    this._renderTabs();

    this.emit('tabAdded', newTab);

    return id;
  }

  /**
   * حذف تب
   */
  removeTab(id) {
    const index = this.tabs.findIndex(t => t.id === id);
    if (index < 0) return false;

    const tab = this.tabs[index];

    // بررسی dirty
    if (tab.dirty) {
      modalService.confirm(`تب "${tab.label}" تغییرات ذخیره نشده دارد. آیا بسته شود؟`, {
        title: 'تغییرات ذخیره نشده',
        danger: true
      }).then(confirmed => {
        if (confirmed) this._doRemoveTab(index);
      });
      return true;
    }

    this._doRemoveTab(index);
    return true;
  }

  /**
   * حذف واقعی
   */
  _doRemoveTab(index) {
    const tab = this.tabs[index];
    this.tabs.splice(index, 1);

    if (tab.id === this.activeId) {
      const newIndex = Math.min(index, this.tabs.length - 1);
      this.activeId = newIndex >= 0 ? this.tabs[newIndex].id : null;
    }

    this._renderTabs();
    this.emit('tabRemoved', tab);

    if (this.options.onClose) {
      this.options.onClose(tab);
    }
  }

  /**
   * تنظیم تب فعال
   */
  setActiveTab(id) {
    if (this.activeId === id) return;

    const tab = this.tabs.find(t => t.id === id);
    if (!tab) return;

    this.activeId = id;
    this._renderTabs();

    this.emit('tabChange', tab);

    if (this.options.onChange) {
      this.options.onChange(tab);
    }
  }

  /**
   * به‌روزرسانی تب
   */
  updateTab(id, updates) {
    const tab = this.tabs.find(t => t.id === id);
    if (!tab) return;

    Object.assign(tab, updates);

    const el = this.elements.list.querySelector(`[data-tab-id="${id}"]`);
    if (el) {
      if (updates.label) {
        el.querySelector('.tabs-tab-label').textContent = updates.label;
      }
      if (updates.dirty !== undefined) {
        el.classList.toggle('dirty', updates.dirty);
        const dirty = el.querySelector('.tabs-tab-dirty');
        if (updates.dirty && !dirty) {
          el.querySelector('.tabs-tab-label').insertAdjacentHTML('afterend', '<span class="tabs-tab-dirty">●</span>');
        } else if (!updates.dirty && dirty) {
          dirty.remove();
        }
      }
      if (updates.badge !== undefined) {
        let badge = el.querySelector('.tabs-tab-badge');
        if (!badge && updates.badge) {
          el.querySelector('.tabs-tab-label').insertAdjacentHTML('afterend', `<span class="tabs-tab-badge">${updates.badge}</span>`);
        } else if (badge) {
          badge.textContent = updates.badge;
          badge.hidden = !updates.badge;
        }
      }
    }

    if (tab.id === this.activeId) {
      this._updateContent();
    }
  }

  /**
   * دریافت تب فعال
   */
  getActiveTab() {
    return this.tabs.find(t => t.id === this.activeId) || null;
  }

  /**
   * دریافت تب
   */
  getTab(id) {
    return this.tabs.find(t => t.id === id) || null;
  }

  /**
   * دریافت همه تب‌ها
   */
  getAllTabs() {
    return [...this.tabs];
  }

  /**
   * بستن همه
   */
  closeAll() {
    const toClose = this.tabs.filter(t => t.closable !== false);
    if (toClose.length === 0) return;

    this.tabs = this.tabs.filter(t => t.closable === false);
    this.activeId = this.tabs.length > 0 ? this.tabs[0].id : null;
    this._renderTabs();
    this.emit('allClosed');
  }

  /**
   * بستن سایر تب‌ها
   */
  closeOthers(keepId) {
    this.tabs = this.tabs.filter(t => t.id === keepId || t.closable === false);
    this.activeId = keepId;
    this._renderTabs();
  }

  /**
   * بستن تب‌های راست
   */
  closeToRight(tabId) {
    const index = this.tabs.findIndex(t => t.id === tabId);
    if (index < 0) return;

    this.tabs = this.tabs.filter((t, i) => i <= index || t.closable === false);

    if (!this.tabs.find(t => t.id === this.activeId)) {
      this.activeId = tabId;
    }

    this._renderTabs();
  }

  /**
   * منوی زمینه تب
   */
  _showTabContextMenu(x, y, tabId) {
    const tab = this.getTab(tabId);
    if (!tab) return;

    const items = [
      {
        label: 'بستن',
        icon: '✕',
        disabled: tab.closable === false,
        onClick: () => this.removeTab(tabId)
      },
      {
        label: 'بستن سایر تب‌ها',
        icon: '⊠',
        onClick: () => this.closeOthers(tabId)
      },
      {
        label: 'بستن تب‌های راست',
        icon: '⇥',
        onClick: () => this.closeToRight(tabId)
      },
      {
        label: 'بستن همه',
        icon: '🗑️',
        onClick: () => this.closeAll()
      },
      'separator',
      {
        label: 'کپی عنوان',
        icon: '📋',
        onClick: () => {
          DomUtils.copyToClipboard(tab.label);
          notificationService.success('کپی شد', { duration: 1500 });
        }
      }
    ];

    contextMenu.show(x, y, items);
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
    this.listeners.clear();
    this.element?.remove();
  }
}

window.Tabs = Tabs;