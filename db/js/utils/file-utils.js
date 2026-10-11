/**
 * ابزارهای فایل
 * توابع کمکی برای کار با فایل‌ها و Blob
 */
const FileUtils = {
  /**
   * دریافت پسوند فایل
   */
  getExtension(filename) {
    if (!filename) return '';
    const parts = filename.split('.');
    return parts.length > 1 ? '.' + parts.pop().toLowerCase() : '';
  },

  /**
   * دریافت نام فایل بدون پسوند
   */
  getBaseName(filename) {
    if (!filename) return '';
    return filename.replace(/\.[^.]+$/, '');
  },

  /**
   * دریافت نام فایل از مسیر
   */
  getFileName(path) {
    if (!path) return '';
    return path.split(/[\\/]/).pop();
  },

  /**
   * تغییر پسوند فایل
   */
  changeExtension(filename, newExt) {
    const base = this.getBaseName(filename);
    const ext = newExt.startsWith('.') ? newExt : '.' + newExt;
    return base + ext;
  },

  /**
   * بررسی نوع فایل
   */
  isType(file, types) {
    if (!file) return false;
    const ext = this.getExtension(file.name);
    return types.some(t => ext === t.toLowerCase() || file.type === t);
  },

  /**
   * فرمت‌دهی حجم
   */
  formatSize(bytes, decimals = 2) {
    if (bytes === 0) return '0 بایت';
    if (!bytes) return '-';

    const k = 1024;
    const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت', 'ترابایت'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  },

  /**
   * تجزیه حجم به بایت
   */
  parseSize(sizeStr) {
    if (typeof sizeStr === 'number') return sizeStr;

    const match = String(sizeStr).match(/^([\d.]+)\s*([a-zA-Z]*)$/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    const multipliers = {
      '': 1,
      'b': 1,
      'بایت': 1,
      'kb': 1024,
      'k': 1024,
      'کیلوبایت': 1024,
      'mb': 1024 * 1024,
      'm': 1024 * 1024,
      'مگابایت': 1024 * 1024,
      'gb': 1024 * 1024 * 1024,
      'g': 1024 * 1024 * 1024,
      'گیگابایت': 1024 * 1024 * 1024,
      'tb': 1024 * 1024 * 1024 * 1024,
      'ترابایت': 1024 * 1024 * 1024 * 1024
    };

    return value * (multipliers[unit] || 1);
  },

  /**
   * خواندن فایل به صورت متن
   */
  readText(file, encoding = 'UTF-8') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('خطا در خواندن فایل'));
      reader.readAsText(file, encoding);
    });
  },

  /**
   * خواندن فایل به صورت ArrayBuffer
   */
  readBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('خطا در خواندن فایل'));
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * خواندن فایل به صورت DataURL
   */
  readDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('خطا در خواندن فایل'));
      reader.readAsDataURL(file);
    });
  },

  /**
   * خواندن به صورت Uint8Array
   */
  async readUint8Array(file) {
    const buffer = await this.readBuffer(file);
    return new Uint8Array(buffer);
  },

  /**
   * خواندن JSON
   */
  async readJSON(file) {
    const text = await this.readText(file);
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(`خطا در تجزیه JSON: ${error.message}`);
    }
  },

  /**
   * دانلود Blob
   */
  download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'download';
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  },

  /**
   * دانلود متن
   */
  downloadText(text, filename, mimeType = 'text/plain;charset=utf-8') {
    const blob = new Blob([text], { type: mimeType });
    this.download(blob, filename);
  },

  /**
   * دانلود JSON
   */
  downloadJSON(data, filename) {
    const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    this.downloadText(text, filename, 'application/json;charset=utf-8');
  },

  /**
   * دانلود CSV (با BOM)
   */
  downloadCSV(csv, filename) {
    const bom = '\uFEFF';
    this.downloadText(bom + csv, filename, 'text/csv;charset=utf-8');
  },

  /**
   * دانلود Uint8Array
   */
  downloadUint8Array(data, filename, mimeType = 'application/octet-stream') {
    const blob = new Blob([data], { type: mimeType });
    this.download(blob, filename);
  },

  /**
   * باز کردن دیالوگ انتخاب فایل
   */
  openDialog(options = {}) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = options.accept || '*';
      input.multiple = Boolean(options.multiple);
      input.style.display = 'none';

      input.addEventListener('change', () => {
        const files = Array.from(input.files || []);
        input.remove();
        resolve(options.multiple ? files : (files[0] || null));
      });

      input.addEventListener('cancel', () => {
        input.remove();
        resolve(null);
      });

      document.body.appendChild(input);
      input.click();
    });
  },

  /**
   * drag and drop setup
   */
  setupDropZone(element, options = {}) {
    const {
      onDrop = () => {},
      onDragEnter = () => {},
      onDragOver = () => {},
      onDragLeave = () => {},
      className = 'drag-over',
      accept = null
    } = options;

    let dragCounter = 0;

    const handleDragEnter = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter++;
      element.classList.add(className);
      onDragEnter(e);
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      onDragOver(e);
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        element.classList.remove(className);
        onDragLeave(e);
      }
    };

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter = 0;
      element.classList.remove(className);

      const files = Array.from(e.dataTransfer.files || []);

      if (accept) {
        const validFiles = files.filter(f => this.isType(f, accept));
        if (validFiles.length !== files.length) {
          // برخی فایل‌ها نامعتبر
        }
        onDrop(validFiles, e);
      } else {
        onDrop(files, e);
      }
    };

    element.addEventListener('dragenter', handleDragEnter);
    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('dragleave', handleDragLeave);
    element.addEventListener('drop', handleDrop);

    return () => {
      element.removeEventListener('dragenter', handleDragEnter);
      element.removeEventListener('dragover', handleDragOver);
      element.removeEventListener('dragleave', handleDragLeave);
      element.removeEventListener('drop', handleDrop);
    };
  },

  /**
   * ایجاد Blob از متن
   */
  createTextBlob(text, mimeType = 'text/plain') {
    return new Blob([text], { type: mimeType });
  },

  /**
   * ایجاد Blob از Uint8Array
   */
  createBinaryBlob(data, mimeType = 'application/octet-stream') {
    return new Blob([data], { type: mimeType });
  },

  /**
   * تبدیل Blob به Base64
   */
  async blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  /**
   * تبدیل Base64 به Blob
   */
  base64ToBlob(base64, mimeType = 'application/octet-stream') {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new Blob([bytes], { type: mimeType });
  },

  /**
   * خواندن فایل به صورت خطوط
   */
  async readLines(file, callback) {
    const text = await this.readText(file);
    const lines = text.split(/\r?\n/);

    if (callback) {
      lines.forEach((line, i) => callback(line, i));
    }

    return lines;
  },

  /**
   * خواندن تکه‌تکه
   */
  async readChunks(file, chunkSize, onChunk) {
    const totalChunks = Math.ceil(file.size / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);

      const buffer = await this.readBuffer(chunk);
      const data = new Uint8Array(buffer);

      if (onChunk) {
        await onChunk(data, i, totalChunks);
      }
    }
  },

  /**
   * اعتبارسنجی فایل
   */
  validate(file, options = {}) {
    const errors = [];

    if (!file) {
      errors.push('فایلی انتخاب نشده است');
      return { valid: false, errors };
    }

    if (options.maxSize && file.size > options.maxSize) {
      errors.push(`حجم فایل بیش از ${this.formatSize(options.maxSize)} است`);
    }

    if (options.minSize && file.size < options.minSize) {
      errors.push(`حجم فایل کمتر از ${this.formatSize(options.minSize)} است`);
    }

    if (options.accept) {
      const accepts = Array.isArray(options.accept)
        ? options.accept
        : options.accept.split(',').map(s => s.trim().toLowerCase());

      const ext = this.getExtension(file.name);
      const type = file.type;

      const isValid = accepts.some(pattern => {
        if (pattern.startsWith('.')) return ext === pattern;
        if (pattern.endsWith('/*')) return type.startsWith(pattern.slice(0, -1));
        return type === pattern;
      });

      if (!isValid) {
        errors.push(`نوع فایل نامعتبر. انواع مجاز: ${accepts.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      size: file.size,
      name: file.name,
      type: file.type,
      extension: this.getExtension(file.name)
    };
  },

  /**
   * Hash فایل (SHA-256)
   */
  async hashFile(file) {
    try {
      const buffer = await this.readBuffer(file);
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (error) {
      console.error('خطا در محاسبه hash:', error);
      return null;
    }
  },

  /**
   * تشخیص نوع محتوا
   */
  detectMimeType(file) {
    const ext = this.getExtension(file.name);

    const types = {
      '.json': 'application/json',
      '.csv': 'text/csv',
      '.sql': 'text/plain',
      '.xml': 'application/xml',
      '.html': 'text/html',
      '.txt': 'text/plain',
      '.db': 'application/x-sqlite3',
      '.sqlite': 'application/x-sqlite3',
      '.sqlite3': 'application/x-sqlite3',
      '.md': 'text/markdown',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.zip': 'application/zip',
      '.gz': 'application/gzip'
    };

    return types[ext] || file.type || 'application/octet-stream';
  },

  /**
   * مقایسه دو فایل
   */
  async compareFiles(file1, file2) {
    if (file1.size !== file2.size) return false;

    const hash1 = await this.hashFile(file1);
    const hash2 = await this.hashFile(file2);

    return hash1 === hash2;
  },

  /**
   * ترتیب فایل‌ها
   */
  sortFiles(files, sortBy = 'name', direction = 'asc') {
    const sorted = [...files].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'fa');
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'type':
          comparison = this.getExtension(a.name).localeCompare(this.getExtension(b.name));
          break;
        case 'modified':
          comparison = (a.lastModified || 0) - (b.lastModified || 0);
          break;
        default:
          comparison = 0;
      }

      return direction === 'desc' ? -comparison : comparison;
    });

    return sorted;
  },

  /**
   * فیلتر فایل‌ها
   */
  filterFiles(files, criteria = {}) {
    return files.filter(file => {
      if (criteria.name && !file.name.toLowerCase().includes(criteria.name.toLowerCase())) {
        return false;
      }

      if (criteria.types && !this.isType(file, criteria.types)) {
        return false;
      }

      if (criteria.minSize && file.size < criteria.minSize) {
        return false;
      }

      if (criteria.maxSize && file.size > criteria.maxSize) {
        return false;
      }

      return true;
    });
  },

  /**
   * گروه‌بندی فایل‌ها بر اساس نوع
   */
  groupByType(files) {
    const groups = {};

    files.forEach(file => {
      const ext = this.getExtension(file.name) || 'بدون پسوند';
      if (!groups[ext]) groups[ext] = [];
      groups[ext].push(file);
    });

    return groups;
  },

  /**
   * گروه‌بندی بر اساس حجم
   */
  groupBySize(files) {
    const groups = {
      small: [],
      medium: [],
      large: [],
      huge: []
    };

    const KB = 1024;
    const MB = KB * 1024;
    const GB = MB * 1024;

    files.forEach(file => {
      if (file.size < 100 * KB) groups.small.push(file);
      else if (file.size < 10 * MB) groups.medium.push(file);
      else if (file.size < 1 * GB) groups.large.push(file);
      else groups.huge.push(file);
    });

    return groups;
  }
};

window.FileUtils = FileUtils;