/* ============================================
   کامپوننت آپلود فایل
   ============================================ */

const Uploader = {
    container: null,
    file: null,
    onUpload: null,
    previewUrl: null,
    
    /**
     * رندر
     */
    render(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;
        
        this.onUpload = options.onUpload || null;
        
        this.container.innerHTML = `
            <div class="uploader-wrapper">
                <div class="uploader-tabs">
                    <button class="uploader-tab active" data-tab="image">
                        <i class="ri-image-line"></i>
                        <span>آپلود تصویر فیش</span>
                    </button>
                    <button class="uploader-tab" data-tab="text">
                        <i class="ri-file-text-line"></i>
                        <span>وارد کردن متن فیش</span>
                    </button>
                </div>
                
                <div class="uploader-panel" data-panel="image">
                    <div class="file-upload" id="file-drop-zone">
                        <input type="file" id="file-input" accept="image/*,application/pdf" hidden>
                        <div class="file-upload-icon">
                            <i class="ri-upload-cloud-2-line"></i>
                        </div>
                        <div class="file-upload-text">تصویر یا PDF فیش را اینجا رها کنید</div>
                        <div class="file-upload-hint">یا کلیک کنید برای انتخاب فایل</div>
                        <div class="file-upload-info">
                            <span><i class="ri-check-line"></i> حداکثر ۵ مگابایت</span>
                            <span><i class="ri-check-line"></i> فرمت‌های JPG، PNG، PDF</span>
                        </div>
                    </div>
                    
                    <div class="file-preview" id="file-preview" style="display: none;"></div>
                </div>
                
                <div class="uploader-panel" data-panel="text" style="display: none;">
                    <div class="form-group">
                        <label class="form-label">متن فیش واریزی</label>
                        <textarea class="form-input" id="receipt-text" rows="6" 
                                  placeholder="شماره پیگیری، مبلغ، تاریخ و سایر اطلاعات فیش را اینجا وارد کنید..."></textarea>
                        <div class="form-hint">اطلاعات کامل فیش را برای بررسی سریع‌تر وارد کنید</div>
                    </div>
                </div>
                
                <div class="uploader-progress" id="uploader-progress" style="display: none;">
                    <div class="progress-info">
                        <span>در حال آپلود...</span>
                        <span id="upload-percent">۰٪</span>
                    </div>
                    <div class="progress">
                        <div class="progress-bar" id="upload-bar" style="width: 0%;"></div>
                    </div>
                </div>
            </div>
        `;
        
        this.attachEvents();
    },
    
    /**
     * اتصال رویدادها
     */
    attachEvents() {
        // تب‌ها
        this.container.querySelectorAll('.uploader-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;
                
                this.container.querySelectorAll('.uploader-tab').forEach(t => {
                    t.classList.toggle('active', t === tab);
                });
                
                this.container.querySelectorAll('.uploader-panel').forEach(p => {
                    p.style.display = p.dataset.panel === target ? 'block' : 'none';
                });
            });
        });
        
        // Drop zone
        const dropZone = this.container.querySelector('#file-drop-zone');
        const fileInput = this.container.querySelector('#file-input');
        
        dropZone.addEventListener('click', () => fileInput.click());
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) this.handleFile(files[0]);
        });
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) this.handleFile(e.target.files[0]);
        });
    },
    
    /**
     * پردازش فایل
     */
    handleFile(file) {
        const check = Validate.file(file);
        if (!check.valid) {
            Toast.error('خطا در فایل', check.message);
            return;
        }
        
        this.file = file;
        
        // پاکسازی preview قدیمی
        if (this.previewUrl) {
            URL.revokeObjectURL(this.previewUrl);
            this.previewUrl = null;
        }
        
        // نمایش پیش‌نمایش
        const preview = this.container.querySelector('#file-preview');
        const dropZone = this.container.querySelector('#file-drop-zone');
        
        if (file.type.startsWith('image/')) {
            this.previewUrl = URL.createObjectURL(file);
            preview.innerHTML = `
                <div class="preview-image-wrap">
                    <img src="${this.previewUrl}" alt="پیش‌نمایش فیش">
                    <div class="preview-info">
                        <div class="preview-filename">
                            <i class="ri-file-image-line"></i>
                            <span>${Helpers.escapeHtml(file.name)}</span>
                        </div>
                        <div class="preview-filesize">${Helpers.formatFileSize(file.size)}</div>
                    </div>
                    <button class="preview-remove" id="remove-file" type="button">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </div>
            `;
        } else {
            preview.innerHTML = `
                <div class="preview-file-wrap">
                    <div class="preview-file-icon">
                        <i class="ri-file-pdf-2-line"></i>
                    </div>
                    <div class="preview-info">
                        <div class="preview-filename">
                            <span>${Helpers.escapeHtml(file.name)}</span>
                        </div>
                        <div class="preview-filesize">${Helpers.formatFileSize(file.size)}</div>
                    </div>
                    <button class="preview-remove" id="remove-file" type="button">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </div>
            `;
        }
        
        preview.style.display = 'block';
        dropZone.style.display = 'none';
        
        // دکمه حذف
        preview.querySelector('#remove-file').addEventListener('click', () => {
            this.clearFile();
        });
        
        if (this.onUpload) this.onUpload({ type: 'image', file });
    },
    
    /**
     * پاک کردن فایل
     */
    clearFile() {
        if (this.previewUrl) {
            URL.revokeObjectURL(this.previewUrl);
            this.previewUrl = null;
        }
        this.file = null;
        
        const preview = this.container.querySelector('#file-preview');
        const dropZone = this.container.querySelector('#file-drop-zone');
        const fileInput = this.container.querySelector('#file-input');
        
        preview.style.display = 'none';
        preview.innerHTML = '';
        dropZone.style.display = 'block';
        fileInput.value = '';
        
        if (this.onUpload) this.onUpload(null);
    },
    
    /**
     * دریافت مقدار
     */
    getValue() {
        const activeTab = this.container.querySelector('.uploader-tab.active').dataset.tab;
        
        if (activeTab === 'image') {
            return { type: 'image', file: this.file };
        } else {
            const text = this.container.querySelector('#receipt-text').value.trim();
            return { type: 'text', text };
        }
    },
    
    /**
     * اعتبارسنجی
     */
    validate() {
        const value = this.getValue();
        
        if (value.type === 'image') {
            if (!value.file) {
                Toast.error('خطا', 'لطفاً فایل فیش را انتخاب کنید');
                return false;
            }
        } else {
            const check = Validate.text(value.text, 10, 2000);
            if (!check.valid) {
                Toast.error('خطا', check.message);
                return false;
            }
        }
        return true;
    },
    
    /**
     * نمایش پیشرفت
     */
    showProgress(percent) {
        const progress = this.container.querySelector('#uploader-progress');
        const bar = this.container.querySelector('#upload-bar');
        const percentEl = this.container.querySelector('#upload-percent');
        
        progress.style.display = 'block';
        bar.style.width = percent + '%';
        percentEl.textContent = Format.number(percent) + '٪';
    },
    
    /**
     * مخفی کردن پیشرفت
     */
    hideProgress() {
        const progress = this.container.querySelector('#uploader-progress');
        progress.style.display = 'none';
    }
};