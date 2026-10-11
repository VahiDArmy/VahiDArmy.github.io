/**
 * کامپوننت ویرایشگر SQL
 * ویرایشگر با syntax highlighting و autocomplete
 */
class SqlEditor {
  constructor(options = {}) {
    this.options = {
      value: '',
      placeholder: 'کوئری SQL خود را اینجا بنویسید...',
      readOnly: false,
      lineNumbers: true,
      autoComplete: true,
      highlightActiveLine: true,
      tabSize: 2,
      fontSize: 14,
      onExecute: null,
      onChange: null,
      onSelectionChange: null,
      ...options
    };

    this.element = null;
    this.elements = {};
    this.value = this.options.value;
    this.selection = { start: 0, end: 0 };
    this.history = [];
    this.historyIndex = -1;
    this.maxHistory = 100;
    this.autoCompleteVisible = false;
    this.autoCompleteIndex = 0;
    this.autoCompleteItems = [];
    this.currentToken = null;
    this.tables = [];
    this.columns = {};
    this.listeners = new Map();

    this._boundKeydown = this._handleKeydown.bind(this);
  }

  /**
   * تنظیم جداول و ستون‌ها
   */
  setSchema(tables, columns) {
    this.tables = tables || [];
    this.columns = columns || {};
  }

  /**
   * رندر
   */
  render() {
    this.element = DomUtils.create('div', {
      className: 'sql-editor-component',
      attrs: { role: 'region', 'aria-label': 'ویرایشگر SQL' }
    });

    this.element.innerHTML = `
      <div class="sql-editor-toolbar">
        <div class="sql-editor-toolbar-left">
          <button class="btn btn-sm btn-primary sql-editor-run" title="اجرای کوئری (Ctrl+Enter)">
            <span class="icon">▶</span>
            <span>اجرا</span>
          </button>
          <button class="btn btn-sm btn-secondary sql-editor-run-selected" title="اجرای انتخاب شده (Ctrl+Shift+Enter)" disabled>
            <span class="icon">▶</span>
            <span>اجرای انتخاب</span>
          </button>
          <button class="btn btn-sm btn-ghost sql-editor-stop" title="توقف" hidden>
            <span class="icon">■</span>
          </button>
        </div>

        <div class="sql-editor-toolbar-center">
          <div class="sql-editor-status">
            <span class="sql-editor-status-info sql-editor-lines">خط: ۱</span>
            <span class="sql-editor-status-info sql-editor-cols">ستون: ۱</span>
          </div>
        </div>

        <div class="sql-editor-toolbar-right">
          <button class="btn btn-sm btn-ghost sql-editor-format" title="قالب‌بندی">
            <span class="icon">✨</span>
          </button>
          <button class="btn btn-sm btn-ghost sql-editor-clear" title="پاک کردن">
            <span class="icon">🗑️</span>
          </button>
          <button class="btn btn-sm btn-ghost sql-editor-copy" title="کپی">
            <span class="icon">📋</span>
          </button>
          <button class="btn btn-sm btn-ghost sql-editor-undo" title="واگرد (Ctrl+Z)">
            <span class="icon">↶</span>
          </button>
          <button class="btn btn-sm btn-ghost sql-editor-redo" title="ازنو (Ctrl+Y)">
            <span class="icon">↷</span>
          </button>
          <button class="btn btn-sm btn-ghost sql-editor-history" title="تاریخچه">
            <span class="icon">🕐</span>
          </button>
          <button class="btn btn-sm btn-ghost sql-editor-templates" title="قالب‌ها">
            <span class="icon">📝</span>
          </button>
        </div>
      </div>

      <div class="sql-editor-wrapper">
        ${this.options.lineNumbers ? '<div class="sql-editor-line-numbers"></div>' : ''}
        <div class="sql-editor-container">
          <pre class="sql-editor-highlight" aria-hidden="true"></pre>
          <textarea
            class="sql-editor-textarea"
            spellcheck="false"
            autocorrect="off"
            autocapitalize="off"
            autocomplete="off"
            placeholder="${this.options.placeholder}"
            ${this.options.readOnly ? 'readonly' : ''}
          ></textarea>
        </div>
        <div class="sql-editor-autocomplete" hidden></div>
      </div>

      <div class="sql-editor-footer">
        <div class="sql-editor-footer-left">
          <span class="sql-editor-info sql-editor-char-count">۰ کاراکتر</span>
          <span class="sql-editor-info sql-editor-selection-info"></span>
        </div>
        <div class="sql-editor-footer-right">
          <span class="sql-editor-info sql-editor-result-info"></span>
        </div>
      </div>
    `;

    this._cacheElements();
    this._bindEvents();
    this._setValue(this.value);
    this._updateLineNumbers();

    return this.element;
  }

  /**
   * ذخیره عناصر
   */
  _cacheElements() {
    const q = (sel) => this.element.querySelector(sel);

    this.elements = {
      run: q('.sql-editor-run'),
      runSelected: q('.sql-editor-run-selected'),
      stop: q('.sql-editor-stop'),
      format: q('.sql-editor-format'),
      clear: q('.sql-editor-clear'),
      copy: q('.sql-editor-copy'),
      undo: q('.sql-editor-undo'),
      redo: q('.sql-editor-redo'),
      history: q('.sql-editor-history'),
      templates: q('.sql-editor-templates'),
      lineNumbers: q('.sql-editor-line-numbers'),
      container: q('.sql-editor-container'),
      highlight: q('.sql-editor-highlight'),
      textarea: q('.sql-editor-textarea'),
      autocomplete: q('.sql-editor-autocomplete'),
      lines: q('.sql-editor-lines'),
      cols: q('.sql-editor-cols'),
      charCount: q('.sql-editor-char-count'),
      selectionInfo: q('.sql-editor-selection-info'),
      resultInfo: q('.sql-editor-result-info')
    };

    this.elements.textarea.style.fontSize = this.options.fontSize + 'px';
    this.elements.highlight.style.fontSize = this.options.fontSize + 'px';
  }

  /**
   * ثبت رویدادها
   */
  _bindEvents() {
    const ta = this.elements.textarea;

    ta.addEventListener('input', () => {
      this._onInput();
    });

    ta.addEventListener('keydown', this._boundKeydown);

    ta.addEventListener('scroll', () => {
      this._syncScroll();
    });

    ta.addEventListener('click', () => {
      this._updateCursorPosition();
      this._updateSelectionInfo();
    });

    ta.addEventListener('keyup', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
        this._updateCursorPosition();
      }
    });

    ta.addEventListener('select', () => {
      this._updateSelectionInfo();
    });

    // دکمه‌ها
    this.elements.run.addEventListener('click', () => this._execute());
    this.elements.runSelected.addEventListener('click', () => this._executeSelected());
    this.elements.format.addEventListener('click', () => this._format());
    this.elements.clear.addEventListener('click', () => this.clear());
    this.elements.copy.addEventListener('click', () => this._copy());
    this.elements.undo.addEventListener('click', () => this._undo());
    this.elements.redo.addEventListener('click', () => this._redo());
    this.elements.history.addEventListener('click', () => this._showHistory());
    this.elements.templates.addEventListener('click', () => this._showTemplates());

    // کلیک خارج از autocomplete
    document.addEventListener('click', (e) => {
      if (!this.elements.autocomplete.contains(e.target) && e.target !== ta) {
        this._hideAutoComplete();
      }
    });

    // Tab
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && !e.shiftKey && !this.autoCompleteVisible) {
        e.preventDefault();
        this._insertText(' '.repeat(this.options.tabSize));
      }
    });
  }

  /**
   * هندلر کیبورد
   */
  _handleKeydown(e) {
    // Ctrl+Enter - اجرا
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        this._executeSelected();
      } else {
        this._execute();
      }
      return;
    }

    // Ctrl+Space - autocomplete اجباری
    if (e.ctrlKey && e.key === ' ') {
      e.preventDefault();
      this._showAutoComplete(true);
      return;
    }

    // Ctrl+Z - undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      this._undo();
      return;
    }

    // Ctrl+Y یا Ctrl+Shift+Z - redo
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      this._redo();
      return;
    }

    // Ctrl+/ - comment
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      this._toggleComment();
      return;
    }

    // Ctrl+A - انتخاب همه
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      this.elements.textarea.select();
      return;
    }

    // Escape - بستن autocomplete
    if (e.key === 'Escape') {
      if (this.autoCompleteVisible) {
        e.preventDefault();
        this._hideAutoComplete();
      }
      return;
    }

    // autocomplete navigation
    if (this.autoCompleteVisible) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._navigateAutoComplete(1);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._navigateAutoComplete(-1);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        this._selectAutoComplete();
        return;
      }
    }

    // Enter - auto indent
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      this._handleEnter();
      return;
    }

    // Bracket auto-close
    if (['(', '[', '{', "'", '"'].includes(e.key)) {
      e.preventDefault();
      const pairs = { '(': ')', '[': ']', '{': '}', "'": "'", '"': '"' };
      this._insertText(e.key + pairs[e.key], 1);
      return;
    }

    // Tab with selection
    if (e.key === 'Tab' && this._hasSelection()) {
      e.preventDefault();
      this._indentSelection(e.shiftKey ? -1 : 1);
      return;
    }
  }

  /**
   * هندلر Enter
   */
  _handleEnter() {
    const ta = this.elements.textarea;
    const pos = ta.selectionStart;
    const before = this.value.substring(0, pos);
    const after = this.value.substring(ta.selectionEnd);

    const currentLine = before.split('\n').pop();
    const indentMatch = currentLine.match(/^(\s*)/);
    let indent = indentMatch ? indentMatch[1] : '';

    // افزایش تورفتگی بعد از کلمات کلیدی
    const lastWord = currentLine.trim().split(/\s+/).pop()?.toUpperCase() || '';
    if (['BEGIN', 'THEN', 'ELSE', 'LOOP', '('].includes(lastWord)) {
      indent += ' '.repeat(this.options.tabSize);
    }

    this._insertText('\n' + indent);
  }

  /**
   * درج متن
   */
  _insertText(text, cursorOffset = null) {
    const ta = this.elements.textarea;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    const before = this.value.substring(0, start);
    const after = this.value.substring(end);

    this._saveHistory();
    this.value = before + text + after;

    ta.value = this.value;
    const newPos = start + text.length - (cursorOffset !== null ? cursorOffset : 0);
    ta.selectionStart = ta.selectionEnd = newPos;

    this._onInput();
    this._updateCursorPosition();
  }

  /**
   * بررسی انتخاب
   */
  _hasSelection() {
    const ta = this.elements.textarea;
    return ta.selectionStart !== ta.selectionEnd;
  }

  /**
   * تورفتگی انتخاب
   */
  _indentSelection(direction) {
    const ta = this.elements.textarea;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    const before = this.value.substring(0, start);
    const selection = this.value.substring(start, end);
    const after = this.value.substring(end);

    const indent = ' '.repeat(this.options.tabSize);
    const lines = selection.split('\n');

    const newLines = lines.map(line => {
      if (direction > 0) {
        return indent + line;
      } else {
        if (line.startsWith(indent)) return line.substring(indent.length);
        if (line.startsWith(' ')) return line.substring(1);
        return line;
      }
    });

    const newSelection = newLines.join('\n');

    this._saveHistory();
    this.value = before + newSelection + after;
    ta.value = this.value;
    ta.selectionStart = start;
    ta.selectionEnd = start + newSelection.length;

    this._onInput();
  }

  /**
   * تغییر comment
   */
  _toggleComment() {
    const ta = this.elements.textarea;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    const before = this.value.substring(0, start);
    const selection = this.value.substring(start, end) || this._getCurrentLine();
    const after = this.value.substring(end);

    const lines = selection.split('\n');
    const allCommented = lines.every(line => line.trim().startsWith('--'));

    const newLines = lines.map(line => {
      if (allCommented) {
        return line.replace(/^(\s*)--\s?/, '$1');
      } else {
        const indent = line.match(/^(\s*)/)[1];
        return indent + '-- ' + line.substring(indent.length);
      }
    });

    const newSelection = newLines.join('\n');

    this._saveHistory();
    this.value = before + newSelection + after;
    ta.value = this.value;

    this._onInput();
  }

  /**
   * دریافت خط فعلی
   */
  _getCurrentLine() {
    const ta = this.elements.textarea;
    const pos = ta.selectionStart;
    const before = this.value.substring(0, pos);
    const after = this.value.substring(pos);

    const lineStart = before.lastIndexOf('\n') + 1;
    const lineEnd = pos + (after.indexOf('\n') === -1 ? after.length : after.indexOf('\n'));

    return this.value.substring(lineStart, lineEnd);
  }

  /**
   * رویداد ورودی
   */
  _onInput() {
    this.value = this.elements.textarea.value;
    this._highlight();
    this._updateLineNumbers();
    this._updateCursorPosition();
    this._updateCharCount();

    if (this.options.autoComplete) {
      this._handleAutoComplete();
    }

    if (this.options.onChange) {
      this.options.onChange(this.value);
    }

    this.emit('change', this.value);
  }

  /**
   * هایلایت
   */
  _highlight() {
    if (!this.elements.highlight) return;

    const html = this._tokenize(this.value);
    this.elements.highlight.innerHTML = html + '\n';
  }

  /**
   * توکن‌سازی
   *
   * نکته مهم: ترتیب اجرای regexها باید حفظ شود
   * - escapeHtml ابتدا انجام می‌شود
   * - Operators بلافاصله بعد از escapeHtml انجام می‌شود
   *   (قبل از اینکه هرگونه HTML واقعی به result اضافه شود)
   * - سپس سایر توکن‌ها به ترتیب
   *
   * اگر Operators در انتها اجرا شود، regex آن کاراکترهای
   * < > = را داخل خود تگ‌های HTML که در مراحل قبل اضافه شده‌اند
   * پیدا می‌کند و HTML را تخریب می‌کند
   */
  _tokenize(sql) {
    const keywords = [
      'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN',
      'IS', 'NULL', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'JOIN',
      'INNER', 'LEFT', 'RIGHT', 'OUTER', 'CROSS', 'ON', 'AS', 'UNION', 'ALL',
      'DISTINCT', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
      'CREATE', 'TABLE', 'ALTER', 'DROP', 'INDEX', 'VIEW', 'TRIGGER', 'IF',
      'EXISTS', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'CHECK',
      'DEFAULT', 'AUTOINCREMENT', 'NOT NULL', 'CASCADE', 'RESTRICT', 'BEGIN',
      'COMMIT', 'ROLLBACK', 'TRANSACTION', 'VACUUM', 'ANALYZE', 'REINDEX',
      'PRAGMA', 'EXPLAIN', 'WITH', 'RECURSIVE', 'CASE', 'WHEN', 'THEN', 'ELSE',
      'END', 'CAST', 'COALESCE', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'GROUP_CONCAT',
      'ABS', 'ROUND', 'LENGTH', 'UPPER', 'LOWER', 'SUBSTR', 'REPLACE', 'TRIM',
      'DATE', 'TIME', 'DATETIME', 'STRFTIME', 'JULIANDAY', 'INTEGER', 'TEXT',
      'REAL', 'BLOB', 'NUMERIC', 'BOOLEAN', 'VARCHAR', 'CHAR'
    ];

    // مرحله 1: فرار دادن HTML در متن اصلی
    let result = StringUtils.escapeHtml(sql);

    // مرحله 2: ⭐ Operators بلافاصله بعد از escape
    // در این مرحله result هیچ HTML واقعی ندارد، فقط متن فرار داده شده است
    // پس regex فقط روی متن کاربر اعمال می‌شود، نه روی تگ‌های HTML
    result = result.replace(/([=<>!+\-*/%])/g, '<span class="sql-operator">$1</span>');

    // مرحله 3: Strings (تک‌کوت)
    // این regex فقط روی متن اعمال می‌شود چون operator spans از قبل ساخته شده‌اند
    // و این regex با ' شروع می‌شود که در HTML tag نیست
    result = result.replace(/('(?:[^'\\]|\\.)*')/g, '<span class="sql-string">$1</span>');

    // مرحله 4: Comments (line)
    result = result.replace(/(--[^\n]*)/g, '<span class="sql-comment">$1</span>');

    // مرحله 5: Comments (block)
    result = result.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="sql-comment">$1</span>');

    // مرحله 6: Numbers
    result = result.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="sql-number">$1</span>');

    // مرحله 7: Keywords (case insensitive)
    keywords.forEach(kw => {
      const regex = new RegExp(`\\b(${kw.replace(/\s+/g, '\\s+')})\\b`, 'gi');
      result = result.replace(regex, (match) => {
        if (match.includes('<span')) return match;
        return `<span class="sql-keyword">${match}</span>`;
      });
    });

    // مرحله 8: Functions
    result = result.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g, '<span class="sql-function">$1</span>(');

    return result;
  }

  /**
   * به‌روزرسانی شماره خطوط
   */
  _updateLineNumbers() {
    if (!this.elements.lineNumbers) return;

    const lines = this.value.split('\n').length;
    let html = '';

    for (let i = 1; i <= lines; i++) {
      html += `<div class="sql-editor-line-number">${StringUtils.englishToPersianDigits(i)}</div>`;
    }

    this.elements.lineNumbers.innerHTML = html;
    this._syncScroll();
  }

  /**
   * همگام‌سازی اسکرول
   */
  _syncScroll() {
    const ta = this.elements.textarea;

    if (this.elements.highlight) {
      this.elements.highlight.scrollTop = ta.scrollTop;
      this.elements.highlight.scrollLeft = ta.scrollLeft;
    }

    if (this.elements.lineNumbers) {
      this.elements.lineNumbers.scrollTop = ta.scrollTop;
    }
  }

  /**
   * به‌روزرسانی موقعیت نشانگر
   */
  _updateCursorPosition() {
    const ta = this.elements.textarea;
    const pos = ta.selectionStart;
    const before = this.value.substring(0, pos);

    const lines = before.split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;

    if (this.elements.lines) {
      this.elements.lines.textContent = `خط: ${StringUtils.englishToPersianDigits(line)}`;
    }

    if (this.elements.cols) {
      this.elements.cols.textContent = `ستون: ${StringUtils.englishToPersianDigits(col)}`;
    }

    // دکمه اجرای انتخاب
    if (this.elements.runSelected) {
      this.elements.runSelected.disabled = !this._hasSelection();
    }

    // خط فعال
    this._highlightActiveLine(line);
  }

  /**
   * هایلایت خط فعال
   */
  _highlightActiveLine(line) {
    if (!this.options.highlightActiveLine || !this.elements.lineNumbers) return;

    this.elements.lineNumbers.querySelectorAll('.sql-editor-line-number').forEach((el, i) => {
      el.classList.toggle('active', i + 1 === line);
    });
  }

  /**
   * به‌روزرسانی تعداد کاراکترها
   */
  _updateCharCount() {
    if (!this.elements.charCount) return;
    this.elements.charCount.textContent = `${StringUtils.englishToPersianDigits(this.value.length)} کاراکتر`;
  }

  /**
   * به‌روزرسانی اطلاعات انتخاب
   */
  _updateSelectionInfo() {
    if (!this.elements.selectionInfo) return;

    const ta = this.elements.textarea;
    const len = ta.selectionEnd - ta.selectionStart;

    if (len > 0) {
      this.elements.selectionInfo.textContent = `انتخاب: ${StringUtils.englishToPersianDigits(len)} کاراکتر`;
    } else {
      this.elements.selectionInfo.textContent = '';
    }
  }

  /**
   * مدیریت autocomplete
   */
  _handleAutoComplete() {
    const ta = this.elements.textarea;
    const pos = ta.selectionStart;
    const before = this.value.substring(0, pos);

    // آخرین کلمه
    const match = before.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
    if (!match || match[1].length < 1) {
      this._hideAutoComplete();
      return;
    }

    const prefix = match[1];
    this.currentToken = { value: prefix, start: pos - prefix.length, end: pos };

    const suggestions = this._getSuggestions(prefix);
    if (suggestions.length === 0) {
      this._hideAutoComplete();
      return;
    }

    this.autoCompleteItems = suggestions;
    this._renderAutoComplete(suggestions, prefix);
  }

  /**
   * دریافت پیشنهادها
   */
  _getSuggestions(prefix) {
    const upper = prefix.toUpperCase();
    const suggestions = [];
    const seen = new Set();

    // SQL keywords
    const keywords = [
      'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER',
      'DROP', 'TABLE', 'INDEX', 'VIEW', 'TRIGGER', 'PRIMARY KEY', 'FOREIGN KEY',
      'REFERENCES', 'NOT NULL', 'UNIQUE', 'CHECK', 'DEFAULT', 'AUTOINCREMENT',
      'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'JOIN', 'INNER JOIN',
      'LEFT JOIN', 'RIGHT JOIN', 'ON', 'AS', 'DISTINCT', 'UNION', 'CASE', 'WHEN',
      'THEN', 'ELSE', 'END', 'NULL', 'IS NULL', 'IS NOT NULL', 'LIKE', 'IN', 'BETWEEN',
      'AND', 'OR', 'NOT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'VACUUM', 'PRAGMA'
    ];

    keywords.forEach(kw => {
      if (kw.toUpperCase().startsWith(upper) && kw.toUpperCase() !== upper) {
        if (!seen.has(kw)) {
          seen.add(kw);
          suggestions.push({ type: 'keyword', value: kw, label: kw, description: 'کلیدواژه' });
        }
      }
    });

    // Tables
    this.tables.forEach(t => {
      const name = typeof t === 'string' ? t : t.name;
      if (name && name.toUpperCase().startsWith(upper)) {
        if (!seen.has(name)) {
          seen.add(name);
          suggestions.push({ type: 'table', value: name, label: name, description: 'جدول', icon: '📋' });
        }
      }
    });

    // Columns
    Object.entries(this.columns).forEach(([tableName, cols]) => {
      cols.forEach(col => {
        const colName = typeof col === 'string' ? col : col.name;
        if (colName && colName.toUpperCase().startsWith(upper)) {
          const key = colName + '_' + tableName;
          if (!seen.has(key)) {
            seen.add(key);
            suggestions.push({
              type: 'column',
              value: colName,
              label: colName,
              description: `ستون در ${tableName}`,
              icon: '📊'
            });
          }
        }
      });
    });

    return suggestions.slice(0, 10);
  }

  /**
   * رندر autocomplete
   */
  _renderAutoComplete(items, prefix) {
    if (!this.elements.autocomplete) return;

    this.autoCompleteIndex = 0;
    this.autoCompleteVisible = true;

    this.elements.autocomplete.innerHTML = items.map((item, i) => `
      <div class="sql-editor-autocomplete-item ${i === 0 ? 'active' : ''}"
           data-index="${i}"
           role="option">
        <span class="sql-editor-autocomplete-icon">${item.icon || '🔤'}</span>
        <span class="sql-editor-autocomplete-label">${StringUtils.highlight(item.label, prefix, 'search-highlight')}</span>
        <span class="sql-editor-autocomplete-desc">${item.description || ''}</span>
      </div>
    `).join('');

    this.elements.autocomplete.hidden = false;

    // موقعیت
    const coords = this._getCaretCoordinates();
    this.elements.autocomplete.style.left = coords.left + 'px';
    this.elements.autocomplete.style.top = (coords.top + coords.height) + 'px';

    // رویدادها
    this.elements.autocomplete.querySelectorAll('.sql-editor-autocomplete-item').forEach(el => {
      el.addEventListener('click', () => {
        const index = parseInt(el.dataset.index);
        this._applyAutoComplete(items[index]);
      });

      el.addEventListener('mouseenter', () => {
        this.autoCompleteIndex = parseInt(el.dataset.index);
        this._updateAutoCompleteActive();
      });
    });
  }

  /**
   * دریافت موقعیت مکان‌نما
   */
  _getCaretCoordinates() {
    const ta = this.elements.textarea;
    const pos = ta.selectionStart;
    const before = this.value.substring(0, pos);
    const lines = before.split('\n');
    const currentLine = lines[lines.length - 1];

    const fontSize = this.options.fontSize;
    const lineHeight = fontSize * 1.5;

    const top = (lines.length - 1) * lineHeight + 8 - ta.scrollTop;
    const left = currentLine.length * (fontSize * 0.6) + 60;

    return { top, left, height: lineHeight };
  }

  /**
   * ناوبری autocomplete
   */
  _navigateAutoComplete(direction) {
    if (!this.autoCompleteItems.length) return;

    this.autoCompleteIndex += direction;

    if (this.autoCompleteIndex < 0) {
      this.autoCompleteIndex = this.autoCompleteItems.length - 1;
    } else if (this.autoCompleteIndex >= this.autoCompleteItems.length) {
      this.autoCompleteIndex = 0;
    }

    this._updateAutoCompleteActive();
  }

  /**
   * به‌روزرسانی active
   */
  _updateAutoCompleteActive() {
    this.elements.autocomplete.querySelectorAll('.sql-editor-autocomplete-item').forEach((el, i) => {
      el.classList.toggle('active', i === this.autoCompleteIndex);
    });

    const active = this.elements.autocomplete.querySelector('.sql-editor-autocomplete-item.active');
    active?.scrollIntoView({ block: 'nearest' });
  }

  /**
   * انتخاب autocomplete
   */
  _selectAutoComplete() {
    if (this.autoCompleteItems.length === 0) return;
    this._applyAutoComplete(this.autoCompleteItems[this.autoCompleteIndex]);
  }

  /**
   * اعمال autocomplete
   */
  _applyAutoComplete(item) {
    if (!this.currentToken) return;

    const ta = this.elements.textarea;
    const before = this.value.substring(0, this.currentToken.start);
    const after = this.value.substring(this.currentToken.end);

    this._saveHistory();
    this.value = before + item.value + after;
    ta.value = this.value;

    const newPos = this.currentToken.start + item.value.length;
    ta.selectionStart = ta.selectionEnd = newPos;
    ta.focus();

    this._hideAutoComplete();
    this._onInput();
  }

  /**
   * مخفی کردن autocomplete
   */
  _hideAutoComplete() {
    if (this.elements.autocomplete) {
      this.elements.autocomplete.hidden = true;
    }
    this.autoCompleteVisible = false;
    this.autoCompleteItems = [];
    this.currentToken = null;
  }

  /**
   * ذخیره در تاریخچه
   */
  _saveHistory() {
    if (this.history[this.historyIndex] === this.value) return;

    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(this.value);

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.historyIndex = this.history.length - 1;
  }

  /**
   * Undo
   */
  _undo() {
    if (this.historyIndex <= 0) return;

    this.historyIndex--;
    this.value = this.history[this.historyIndex];
    this.elements.textarea.value = this.value;

    this._onInput();
  }

  /**
   * Redo
   */
  _redo() {
    if (this.historyIndex >= this.history.length - 1) return;

    this.historyIndex++;
    this.value = this.history[this.historyIndex];
    this.elements.textarea.value = this.value;

    this._onInput();
  }

  /**
   * تنظیم مقدار
   */
  _setValue(value) {
    this.value = value;
    this.elements.textarea.value = value;
    this._saveHistory();
    this._highlight();
    this._updateLineNumbers();
    this._updateCharCount();
  }

  /**
   * دریافت مقدار
   */
  getValue() {
    return this.value;
  }

  /**
   * تنظیم مقدار
   */
  setValue(value, silent = false) {
    this._setValue(value || '');
    if (!silent && this.options.onChange) {
      this.options.onChange(this.value);
    }
  }

  /**
   * پاک کردن
   */
  clear() {
    this._saveHistory();
    this._setValue('');
    this.elements.textarea.focus();
  }

  /**
   * فوکوس
   */
  focus() {
    this.elements.textarea.focus();
  }

  /**
   * قالب‌بندی
   */
  _format() {
    if (!this.value.trim()) return;

    const formatted = queryService.format(this.value);
    this._saveHistory();
    this._setValue(formatted);
    notificationService.success('قالب‌بندی انجام شد', { duration: 1500 });
  }

  /**
   * کپی
   */
  async _copy() {
    const ok = await DomUtils.copyToClipboard(this.value);
    if (ok) notificationService.success('کپی شد', { duration: 1500 });
  }

  /**
   * اجرا
   */
  _execute() {
    if (!this.value.trim()) {
      notificationService.warning('کوئری خالی است');
      return;
    }

    this.emit('execute', this.value);
    if (this.options.onExecute) {
      this.options.onExecute(this.value);
    }
  }

  /**
   * اجرای انتخاب
   */
  _executeSelected() {
    const ta = this.elements.textarea;
    const selected = this.value.substring(ta.selectionStart, ta.selectionEnd).trim();

    if (!selected) return;

    this.emit('execute', selected);
    if (this.options.onExecute) {
      this.options.onExecute(selected);
    }
  }

  /**
   * نمایش تاریخچه
   */
  _showHistory() {
    const history = queryService.getHistory(30);

    if (history.length === 0) {
      notificationService.info('تاریخچه‌ای وجود ندارد');
      return;
    }

    const items = history.map((h, i) => ({
      label: StringUtils.truncate(h.sql.replace(/\s+/g, ' '), 60),
      icon: h.success ? '✓' : '✕',
      onClick: () => {
        this.setValue(h.sql);
      }
    }));

    const rect = this.elements.history.getBoundingClientRect();
    contextMenu.show(rect.right, rect.bottom + 4, items);
  }

  /**
   * نمایش قالب‌ها
   */
  _showTemplates() {
    const templates = queryService.getTemplates();

    const items = templates.map(t => ({
      label: t.name,
      icon: '📝',
      onClick: () => {
        this.setValue(t.sql);
      }
    }));

    const rect = this.elements.templates.getBoundingClientRect();
    contextMenu.show(rect.right, rect.bottom + 4, items);
  }

  /**
   * تنظیم اطلاعات نتیجه
   */
  setResultInfo(info) {
    if (!this.elements.resultInfo) return;

    if (info) {
      const parts = [];
      if (info.executionTime !== undefined) {
        parts.push(DateUtils.formatExecutionTime(info.executionTime));
      }
      if (info.rowCount !== undefined) {
        parts.push(`${StringUtils.englishToPersianDigits(info.rowCount)} ردیف`);
      }
      this.elements.resultInfo.textContent = parts.join(' | ');
    } else {
      this.elements.resultInfo.textContent = '';
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
    document.removeEventListener('keydown', this._boundKeydown);
    this.listeners.clear();
    this.element?.remove();
  }
}

window.SqlEditor = SqlEditor;