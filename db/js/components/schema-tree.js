/**
 * کامپوننت درخت ساختار
 * نمایش درختوار ساختار پایگاه داده
 */
class SchemaTree {
  constructor(options = {}) {
    this.options = {
      expandable: true,
      selectable: true,
      multiSelect: false,
      showIcons: true,
      showCounts: true,
      showTypes: true,
      draggable: false,
      contextMenu: true,
      searchable: true,
      onSelect: null,
      onDoubleClick: null,
      ...options
    };

    this.element = null;
    this.elements = {};
    this.tree = [];
    this.expandedNodes = new Set();
    this.selectedNodes = new Set();
    this.listeners = new Map();
    this.searchTerm = '';

    this._boundClick = this._handleClick.bind(this);
  }

  /**
   * رندر
   */
  render() {
    this.element = DomUtils.create('div', {
      className: 'schema-tree-component',
      attrs: { role: 'tree', 'aria-label': 'ساختار پایگاه داده' }
    });

    this.element.innerHTML = `
      ${this.options.searchable ? this._renderSearch() : ''}
      <div class="schema-tree-toolbar">
        <button class="schema-tree-toolbar-btn" data-action="expand-all" title="باز کردن همه">
          <span class="icon">⊞</span>
        </button>
        <button class="schema-tree-toolbar-btn" data-action="collapse-all" title="بستن همه">
          <span class="icon">⊟</span>
        </button>
        <button class="schema-tree-toolbar-btn" data-action="refresh" title="بازنشانی">
          <span class="icon">🔄</span>
        </button>
      </div>
      <div class="schema-tree-body" role="tree">
        <div class="schema-tree-loading" hidden>
          <div class="loading-spinner"></div>
        </div>
        <div class="schema-tree-empty" hidden>
          <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <div class="empty-state-title">ساختاری برای نمایش وجود ندارد</div>
          </div>
        </div>
        <ul class="schema-tree-list" role="group"></ul>
      </div>
    `;

    this._cacheElements();
    this._bindEvents();

    return this.element;
  }

  /**
   * بخش جستجو
   */
  _renderSearch() {
    return `
      <div class="schema-tree-search">
        <span class="schema-tree-search-icon">🔍</span>
        <input
          type="search"
          class="schema-tree-search-input"
          placeholder="جستجو در ساختار..."
          aria-label="جستجو"
        />
      </div>
    `;
  }

  /**
   * ذخیره عناصر
   */
  _cacheElements() {
    const q = (sel) => this.element.querySelector(sel);

    this.elements = {
      searchInput: q('.schema-tree-search-input'),
      body: q('.schema-tree-body'),
      list: q('.schema-tree-list'),
      loading: q('.schema-tree-loading'),
      empty: q('.schema-tree-empty')
    };
  }

  /**
   * ثبت رویدادها
   */
  _bindEvents() {
    // جستجو
    if (this.elements.searchInput) {
      const debounced = debounce((value) => {
        this.searchTerm = value.toLowerCase();
        this._renderTree();
      }, 200);

      this.elements.searchInput.addEventListener('input', (e) => {
        debounced(e.target.value);
      });
    }

    // دکمه‌های ابزار
    this.element.querySelectorAll('.schema-tree-toolbar-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._handleToolbarAction(btn.dataset.action);
      });
    });

    // کلیک‌ها
    this.element.addEventListener('click', this._boundClick);

    // دابل کلیک
    this.element.addEventListener('dblclick', (e) => {
      const node = e.target.closest('.schema-tree-node');
      if (!node) return;

      const nodeId = node.dataset.nodeId;
      const item = this._findNode(nodeId);

      if (item && this.options.onDoubleClick) {
        this.options.onDoubleClick(item);
      }
    });

    // راست‌کلیک
    if (this.options.contextMenu) {
      this.element.addEventListener('contextmenu', (e) => {
        const node = e.target.closest('.schema-tree-node');
        if (!node) return;

        e.preventDefault();
        const nodeId = node.dataset.nodeId;
        const item = this._findNode(nodeId);

        if (item) {
          this._showContextMenu(e.clientX, e.clientY, item);
        }
      });
    }
  }

  /**
   * هندلر کلیک
   */
  _handleClick(e) {
    const toggleBtn = e.target.closest('.schema-tree-toggle');
    if (toggleBtn) {
      e.stopPropagation();
      const node = toggleBtn.closest('.schema-tree-node');
      this._toggleNode(node.dataset.nodeId);
      return;
    }

    const node = e.target.closest('.schema-tree-node');
    if (!node) return;

    const nodeId = node.dataset.nodeId;
    const item = this._findNode(nodeId);

    if (!item) return;

    // انتخاب
    if (this.options.selectable) {
      if (e.ctrlKey || e.metaKey) {
        if (this.selectedNodes.has(nodeId)) {
          this.selectedNodes.delete(nodeId);
        } else {
          this.selectedNodes.add(nodeId);
        }
      } else if (!this.options.multiSelect) {
        this.selectedNodes.clear();
        this.selectedNodes.add(nodeId);
      } else {
        this.selectedNodes.clear();
        this.selectedNodes.add(nodeId);
      }

      this._updateSelection();

      if (this.options.onSelect) {
        const selectedItems = Array.from(this.selectedNodes).map(id => this._findNode(id)).filter(Boolean);
        this.options.onSelect(selectedItems, item);
      }

      this.emit('select', { items: selectedItemsFromIds(), item });
    }

    // toggle اگر expandable باشد
    if (this.options.expandable && item.children && item.children.length > 0) {
      this._toggleNode(nodeId);
    }
  }

  /**
   * هندلر ابزار
   */
  _handleToolbarAction(action) {
    switch (action) {
      case 'expand-all':
        this.expandAll();
        break;
      case 'collapse-all':
        this.collapseAll();
        break;
      case 'refresh':
        this.emit('refresh');
        if (this.options.onRefresh) this.options.onRefresh();
        break;
    }
  }

  /**
   * تنظیم درخت
   */
  setTree(tree) {
    this.tree = tree || [];
    this._renderTree();
  }

  /**
   * رندر درخت
   */
  _renderTree() {
    if (!this.elements.list) return;

    if (!this.tree.length) {
      this.elements.list.innerHTML = '';
      this.elements.empty.hidden = false;
      return;
    }

    this.elements.empty.hidden = true;

    const filteredTree = this.searchTerm ? this._filterTree(this.tree) : this.tree;
    this.elements.list.innerHTML = filteredTree.map(node => this._renderNode(node, 0)).join('');
    this._updateSelection();
  }

  /**
   * فیلتر درخت
   */
  _filterTree(nodes) {
    const filtered = [];

    nodes.forEach(node => {
      const matchesSelf = node.label.toLowerCase().includes(this.searchTerm);

      if (node.children) {
        const filteredChildren = this._filterTree(node.children);

        if (matchesSelf || filteredChildren.length > 0) {
          filtered.push({
            ...node,
            children: filteredChildren,
            _autoExpand: true
          });
        }
      } else if (matchesSelf) {
        filtered.push(node);
      }
    });

    return filtered;
  }

  /**
   * رندر گره
   */
  _renderNode(node, level) {
    const nodeId = node.id || node.label;
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = this.expandedNodes.has(nodeId) || node._autoExpand;
    const isSelected = this.selectedNodes.has(nodeId);

    const indent = level * 16;

    let toggleIcon = '';
    if (hasChildren) {
      toggleIcon = isExpanded ? '▼' : '◀';
    } else {
      toggleIcon = '•';
    }

    let icon = '';
    if (this.options.showIcons && node.icon) {
      icon = `<span class="schema-tree-node-icon">${node.icon}</span>`;
    }

    let badge = '';
    if (this.options.showCounts && node.count !== undefined) {
      badge = `<span class="schema-tree-node-badge">${StringUtils.englishToPersianDigits(node.count)}</span>`;
    } else if (node.badge) {
      badge = `<span class="schema-tree-node-badge">${node.badge}</span>`;
    }

    let type = '';
    if (this.options.showTypes && node.type) {
      type = `<span class="schema-tree-node-type">${node.type}</span>`;
    }

    let childrenHtml = '';
    if (hasChildren && isExpanded) {
      childrenHtml = `
        <ul class="schema-tree-children" role="group">
          ${node.children.map(child => this._renderNode(child, level + 1)).join('')}
        </ul>
      `;
    }

    return `
      <li class="schema-tree-item" role="treeitem" aria-expanded="${isExpanded}">
        <div
          class="schema-tree-node ${isSelected ? 'selected' : ''} ${hasChildren ? 'has-children' : ''} ${isExpanded ? 'expanded' : ''}"
          data-node-id="${StringUtils.escapeHtml(nodeId)}"
          data-node-type="${node.type || ''}"
          style="padding-right: ${indent + 4}px"
        >
          <span class="schema-tree-toggle">${toggleIcon}</span>
          ${icon}
          <span class="schema-tree-node-label" title="${StringUtils.escapeHtml(node.label)}">${StringUtils.escapeHtml(node.label)}</span>
          ${type}
          ${badge}
        </div>
        ${childrenHtml}
      </li>
    `;
  }

  /**
   * تغییر وضعیت گره
   */
  _toggleNode(nodeId) {
    if (this.expandedNodes.has(nodeId)) {
      this.expandedNodes.delete(nodeId);
    } else {
      this.expandedNodes.add(nodeId);
    }

    this._renderTree();
    this.emit('toggle', { nodeId, expanded: this.expandedNodes.has(nodeId) });
  }

  /**
   * باز کردن همه
   */
  expandAll() {
    const addAll = (nodes) => {
      nodes.forEach(node => {
        const nodeId = node.id || node.label;
        if (node.children && node.children.length > 0) {
          this.expandedNodes.add(nodeId);
          addAll(node.children);
        }
      });
    };

    addAll(this.tree);
    this._renderTree();
  }

  /**
   * بستن همه
   */
  collapseAll() {
    this.expandedNodes.clear();
    this._renderTree();
  }

  /**
   * یافتن گره
   */
  _findNode(nodeId, nodes = null) {
    const list = nodes || this.tree;

    for (const node of list) {
      const id = node.id || node.label;
      if (id === nodeId) return node;

      if (node.children) {
        const found = this._findNode(nodeId, node.children);
        if (found) return found;
      }
    }

    return null;
  }

  /**
   * انتخاب گره
   */
  selectNode(nodeId) {
    this.selectedNodes.clear();
    this.selectedNodes.add(nodeId);
    this._updateSelection();
  }

  /**
   * انتخاب چندگانه
   */
  selectNodes(nodeIds) {
    this.selectedNodes.clear();
    nodeIds.forEach(id => this.selectedNodes.add(id));
    this._updateSelection();
  }

  /**
   * پاک کردن انتخاب
   */
  clearSelection() {
    this.selectedNodes.clear();
    this._updateSelection();
  }

  /**
   * به‌روزرسانی انتخاب
   */
  _updateSelection() {
    this.element.querySelectorAll('.schema-tree-node').forEach(node => {
      const nodeId = node.dataset.nodeId;
      node.classList.toggle('selected', this.selectedNodes.has(nodeId));
    });
  }

  /**
   * منوی زمینه
   */
  _showContextMenu(x, y, item) {
    const items = [];

    if (item.type === 'table' || item.type === 'view') {
      items.push({
        label: 'مشاهده داده‌ها',
        icon: '👁️',
        onClick: () => this.emit('viewData', item)
      });
      items.push({
        label: 'مشاهده ساختار',
        icon: '📐',
        onClick: () => this.emit('viewSchema', item)
      });
      items.push('separator');
      items.push({
        label: 'صادرات',
        icon: '📤',
        submenu: [
          { label: 'JSON', onClick: () => this.emit('export', { item, format: 'json' }) },
          { label: 'CSV', onClick: () => this.emit('export', { item, format: 'csv' }) },
          { label: 'SQL', onClick: () => this.emit('export', { item, format: 'sql' }) }
        ]
      });
      items.push('separator');
      items.push({
        label: 'حذف',
        icon: '🗑️',
        danger: true,
        onClick: () => this.emit('drop', item)
      });
    } else if (item.type === 'index') {
      items.push({
        label: 'حذف ایندکس',
        icon: '🗑️',
        danger: true,
        onClick: () => this.emit('dropIndex', item)
      });
    } else if (item.type === 'trigger') {
      items.push({
        label: 'حذف تریگر',
        icon: '🗑️',
        danger: true,
        onClick: () => this.emit('dropTrigger', item)
      });
    }

    if (items.length > 0) {
      contextMenu.show(x, y, items);
    }
  }

  /**
   * بارگذاری
   */
  setLoading(loading) {
    if (this.elements.loading) {
      this.elements.loading.hidden = !loading;
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
    this.listeners.clear();
    this.element?.remove();
  }
}

window.SchemaTree = SchemaTree;