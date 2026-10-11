/**
 * کامپوننت آپلود فایل
 */
class FileUploader {
  constructor(options = {}) {
    this.options = {
      multiple: false,
      accept: '*',
      maxSize: 100 * 1024 * 1024,
      maxFiles: 10,
      autoUpload: false,
      showPreview: true,
      dragAndDrop: true,
      onSelect: null,
      onUpload: null,
      onRemove: null,
      onError: null,
      ...options
    };

    this.element = null;
    this.elements = {};
    this.files = [];
    this.listeners = new Map();
    this.uploading = false;
  }

  /**
   * رندر
   */
  render() {
    this.element = DomUtils.create('div', {
      className: 'file-uploader-component'
    });

    this.element.innerHTML = `
      <div class="file-uploader-dropzone" tabindex="0" role="button" aria-label="منطقه رها کردن فایل">
        <div class="file-uploader-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <div class="file-uploader-text">
          <div class="file-uploader-title">فایل را اینجا رها کنید</div>
          <div class="file-uploader-subtitle">یا کلیک کنید تا انتخاب کنید</div>
        </div>
        <div class="file-uploader-info">
          ${this.options.accept !== '*' ? `<span>فرمت‌های مجاز: ${this.options.accept}</span>` : ''}
          ${this.options.maxSize ? `<span>حداکثر حجم: ${FileUtils.formatSize(this.options.maxSize)}</span>` : ''}
        </div>
        <input
          type="file"
          class="file-uploader-input"
          ${this.options.multiple ? 'multiple' : ''}
          accept="${this.options.accept}"
          hidden
        />
      </div>

      <div class="file-uploader-list" hidden>
        <div class="file-uploader-list-header">
          <span class="file-uploader-count"></span>
          <button class="file-uploader-clear" title="پاک کردن همه">✕ پاک کردن همه</button>
        </div>
        <div class="file-uploader-list-body"></div>
      </div>

      <div class="file-uploader-actions" hidden>
        <button class="btn btn-primary file-uploader-upload-btn">آپلود</button>
      </div>
    `;

    this._cacheElements();
    this._bindEvents();

    if (this.options.dragAndDrop) {
      this._setupDragDrop();
    }

    return this.element;
  }

  /**
   * ذخیره عناصر
   */
  _cacheElements() {
    this.elements = {
      dropzone: this.element.querySelector('.file-uploader-dropzone'),
      input: this.element.querySelector('.file-uploader-input'),
      list: this.element.querySelector('.file-uploader-list'),
      listBody: this.element.querySelector('.file-uploader-list-body'),
      count: this.element.querySelector('.file-uploader-count'),
      clearBtn: this.element.querySelector('.file-uploader-clear'),
      actions: this.element.querySelector('.file-uploader-actions'),
      uploadBtn: this.element.querySelector('.file-uploader-upload-btn')
    };
  }

  /**
   * ثبت رویدادها
   */
  _bindEvents() {
    this.elements.dropzone.addEventListener('click', () => {
      this.elements.input.click();
    });

    this.elements.dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.elements.input.click();
      }
    });

    this.elements.input.addEventListener('change', (e) => {
      this._handleFiles(Array.from(e.target.files));
      this.elements.input.value = '';
    });

    this.elements.clearBtn?.addEventListener('click', () => {
      this.clear();
    });

    this.elements.uploadBtn?.addEventListener('click', () => {
      this.upload();
    });
  }

  /**
   * راه‌اندازی drag & drop
   */
  _setupDragDrop() {
    FileUtils.setupDropZone(this.elements.dropzone, {
      onDrop: (files) => this._handleFiles(files),
      accept: this.options.accept !== '*' ? this.options.accept : null
    });
  }

  /**
   * پردازش فایل‌ها
   */
  _handleFiles(newFiles) {
    if (!newFiles || newFiles.length === 0) return;

    const validFiles = [];

    for (const file of newFiles) {
      // بررسی تعداد
      if (this.files.length >= this.options.maxFiles) {
        notificationService.warning(`حداکثر ${this.options.maxFiles} فایل مجاز است`);
        break;
      }

      // اعتبارسنجی
      const validation = FileUtils.validate(file, {
        accept: this.options.accept,
        maxSize: this.options.maxSize
      });

      if (!validation.valid) {
        notificationService.error(`${file.name}: ${validation.errors[0]}`);
        if (this.options.onError) {
          this.options.onError(file, validation.errors);
        }
        continue;
      }

      validFiles.push(file);
    }

    if (this.options.multiple) {
      this.files.push(...validFiles);
    } else {
      this.files = validFiles.slice(0, 1);
    }

    this._renderList();
    this.emit('select', this.files);

    if (this.options.onSelect) {
      this.options.onSelect(this.files);
    }

    if (this.options.autoUpload) {
      this.upload();
    }
  }

  /**
   * رندر لیست
   */
  _renderList() {
    if (!this.elements.list || !this.elements.listBody) return;

    if (this.files.length === 0) {
      this.elements.list.hidden = true;
      if (this.elements.actions) this.elements.actions.hidden = true;
      return;
    }

    this.elements.list.hidden = false;
    if (this.elements.actions) this.elements.actions.hidden = false;

    if (this.elements.count) {
      this.elements.count.textContent = `${StringUtils.englishToPersianDigits(this.files.length)} فایل`;
    }

    this.elements.listBody.innerHTML = this.files.map((file, index) => {
      const ext = FileUtils.getExtension(file.name);
      const size = FileUtils.formatSize(file.size);
      const icon = this._getFileIcon(ext);

      return `
        <div class="file-uploader-item" data-index="${index}">
          <div class="file-uploader-item-icon">${icon}</div>
          <div class="file-uploader-item-info">
            <div class="file-uploader-item-name" title="${StringUtils.escapeHtml(file.name)}">
              ${StringUtils.escapeHtml(StringUtils.truncate(file.name, 50))}
            </div>
            <div class="file-uploader-item-meta">
              <span class="file-uploader-item-size">${size}</span>
              <span class="file-uploader-item-type">${ext || 'نامشخص'}</span>
            </div>
            <div class="file-uploader-item-progress" hidden>
              <div class="file-uploader-item-progress-bar"></div>
            </div>
          </div>
          <button class="file-uploader-item-remove" data-index="${index}" title="حذف" aria-label="حذف">✕</button>
        </div>
      `;
    }).join('');

    // رویداد حذف
    this.elements.listBody.querySelectorAll('.file-uploader-item-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        this.removeFile(index);
      });
    });
  }

  /**
   * آیکون فایل
   */
  _getFileIcon(ext) {
    const icons = {
      '.db': '🗄️',
      '.sqlite': '🗄️',
      '.sqlite3': '🗄️',
      '.sql': '💾',
      '.json': '{ }',
      '.csv': '📊',
      '.xml': '📋',
      '.txt': '📄',
      '.xlsx': '📗',
      '.xls': '📗',
      '.zip': '📦',
      '.gz': '📦'
    };
    return icons[ext.toLowerCase()] || '📄';
  }

  /**
   * حذف فایل
   */
  removeFile(index) {
    const file = this.files[index];
    if (!file) return;

    this.files.splice(index, 1);
    this._renderList();

    this.emit('remove', file);
    if (this.options.onRemove) {
      this.options.onRemove(file);
    }
  }

  /**
   * پاک کردن همه
   */
  clear() {
    this.files = [];
    this._renderList();
    this.emit('clear');
  }

  /**
   * آپلود
   */
  async upload() {
    if (this.files.length === 0) {
      notificationService.warning('فایلی انتخاب نشده است');
      return;
    }

    if (this.uploading) return;

    this.uploading = true;

    try {
      const onUpload = this.options.onUpload;

      for (let i = 0; i < this.files.length; i++) {
        const file = this.files[i];
        const itemEl = this.elements.listBody.querySelector(`[data-index="${i}"]`);
        const progress = itemEl?.querySelector('.file-uploader-item-progress');
        const progressBar = itemEl?.querySelector('.file-uploader-item-progress-bar');

        if (progress) progress.hidden = false;
        if (progressBar) progressBar.style.width = '0%';

        try {
          if (onUpload) {
            await onUpload(file, (percent) => {
              if (progressBar) progressBar.style.width = percent + '%';
            });
          } else {
            // شبیه‌سازی
            await this._simulateUpload(progressBar);
          }

          itemEl?.classList.add('uploaded');
        } catch (error) {
          itemEl?.classList.add('error');
          notificationService.error(`خطا در آپلود ${file.name}: ${error.message}`);
          if (this.options.onError) this.options.onError(file, [error.message]);
        }
      }

      this.emit('uploadComplete', this.files);
    } finally {
      this.uploading = false;
    }
  }

  /**
   * شبیه‌سازی آپلود
   */
  _simulateUpload(progressBar) {
    return new Promise(resolve => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 100) progress = 100;
        if (progressBar) progressBar.style.width = progress + '%';

        if (progress >= 100) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * دریافت فایل‌ها
   */
  getFiles() {
    return [...this.files];
  }

  /**
   * تنظیم فایل‌ها
   */
  setFiles(files) {
    this.files = files || [];
    this._renderList();
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

window.FileUploader = FileUploader;