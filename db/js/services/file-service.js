/**
 * سرویس مدیریت فایل
 * خواندن، نوشتن، دانلود و آپلود فایل‌ها
 */
class FileService {
  constructor() {
    this.readers = new Map();
    this.activeDownloads = new Map();
    this.maxConcurrent = 5;
    this.listeners = new Map();
  }

  /**
   * خواندن فایل به صورت متن
   */
  readAsText(file, encoding = 'UTF-8') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('خطا در خواندن فایل'));
      reader.readAsText(file, encoding);
    });
  }

  /**
   * خواندن فایل به صورت ArrayBuffer
   */
  readAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('خطا در خواندن فایل'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * خواندن فایل به صورت DataURL
   */
  readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('خطا در خواندن فایل'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * خواندن فایل به صورت Uint8Array
   */
  async readAsUint8Array(file) {
    const buffer = await this.readAsArrayBuffer(file);
    return new Uint8Array(buffer);
  }

  /**
   * دانلود Blob با نام مشخص
   */
  downloadBlob(blob, filename) {
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);

      this.emit('downloaded', { filename, size: blob.size });
      return true;
    } catch (error) {
      console.error('خطا در دانلود:', error);
      this.emit('downloadError', { filename, error });
      return false;
    }
  }

  /**
   * دانلود متن به عنوان فایل
   */
  downloadText(text, filename, mimeType = 'text/plain;charset=utf-8') {
    const blob = new Blob([text], { type: mimeType });
    return this.downloadBlob(blob, filename);
  }

  /**
   * دانلود JSON
   */
  downloadJSON(data, filename) {
    const json = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    return this.downloadText(json, filename, 'application/json;charset=utf-8');
  }

  /**
   * دانلود CSV
   */
  downloadCSV(csv, filename) {
    const bom = '\uFEFF'; // BOM برای UTF-8
    return this.downloadText(bom + csv, filename, 'text/csv;charset=utf-8');
  }

  /**
   * دانلود Uint8Array
   */
  downloadUint8Array(data, filename, mimeType = 'application/octet-stream') {
    const blob = new Blob([data], { type: mimeType });
    return this.downloadBlob(blob, filename);
  }

  /**
   * دانلود از URL
   */
  async downloadFromUrl(url, filename) {
    try {
      this.emit('downloadStarted', { url, filename });

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      return this.downloadBlob(blob, filename || this._extractFilename(url));
    } catch (error) {
      console.error('خطا در دانلود از URL:', error);
      this.emit('downloadError', { url, error });
      throw error;
    }
  }

  /**
   * باز کردن دیالوگ انتخاب فایل
   */
  openFileDialog(options = {}) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = options.accept || '*';
      input.multiple = options.multiple || false;
      input.style.display = 'none';

      input.addEventListener('change', () => {
        const files = Array.from(input.files || []);
        resolve(options.multiple ? files : files[0] || null);
        input.remove();
      });

      input.addEventListener('cancel', () => {
        resolve(null);
        input.remove();
      });

      document.body.appendChild(input);
      input.click();
    });
  }

  /**
   * انتخاب چندین فایل
   */
  openMultipleFileDialog(accept = '*') {
    return this.openFileDialog({ accept, multiple: true });
  }

  /**
   * خواندن فایل متنی خط به خط
   */
  async readLines(file, callback) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      let buffer = '';

      reader.onload = (e) => {
        buffer += e.target.result;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        lines.forEach(line => callback(line.replace(/\r$/, '')));

        if (reader.readyState === FileReader.DONE) {
          if (buffer) callback(buffer);
          resolve();
        }
      };

      reader.onerror = () => reject(new Error('خطا در خواندن فایل'));
      reader.readAsText(file);
    });
  }

  /**
   * خواندن فایل به صورت تکه‌تکه
   */
  async readChunks(file, chunkSize = 1024 * 1024, onChunk) {
    const totalChunks = Math.ceil(file.size / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);

      const buffer = await this.readAsArrayBuffer(chunk);
      const data = new Uint8Array(buffer);

      if (onChunk) {
        onChunk(data, i, totalChunks);
      }

      this.emit('chunkRead', {
        chunkIndex: i,
        totalChunks,
        progress: ((i + 1) / totalChunks) * 100
      });
    }
  }

  /**
   * بارگذاری فایل از طریق fetch
   */
  async fetchFile(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    return {
      data,
      name: this._extractFilename(url),
      size: data.length,
      type: response.headers.get('content-type') || 'application/octet-stream'
    };
  }

  /**
   * استخراج نام فایل از URL
   */
  _extractFilename(url) {
    try {
      const urlObj = new URL(url, window.location.href);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();
      return decodeURIComponent(filename) || 'download';
    } catch (e) {
      return url.split('/').pop().split('?')[0] || 'download';
    }
  }

  /**
   * بررسی نوع فایل
   */
  isFileType(file, types) {
    if (!file) return false;
    const ext = this.getExtension(file.name);
    return types.some(t => ext === t.toLowerCase() || file.type === t);
  }

  /**
   * دریافت پسوند فایل
   */
  getExtension(filename) {
    if (!filename) return '';
    const parts = filename.split('.');
    return parts.length > 1 ? '.' + parts.pop().toLowerCase() : '';
  }

  /**
   * دریافت نام فایل بدون پسوند
   */
  getBaseName(filename) {
    if (!filename) return '';
    return filename.replace(/\.[^.]+$/, '');
  }

  /**
   * فرمت‌دهی حجم فایل
   */
  formatSize(bytes, decimals = 2) {
    if (bytes === 0) return '0 بایت';
    if (!bytes) return '-';

    const k = 1024;
    const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت', 'ترابایت'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  }

  /**
   * بررسی اعتبار فایل
   */
  validateFile(file, options = {}) {
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
      const acceptList = Array.isArray(options.accept)
        ? options.accept
        : options.accept.split(',').map(s => s.trim());

      const ext = this.getExtension(file.name);
      const isValid = acceptList.some(pattern => {
        if (pattern.startsWith('.')) {
          return ext === pattern.toLowerCase();
        }
        if (pattern.endsWith('/*')) {
          const prefix = pattern.slice(0, -2);
          return file.type.startsWith(prefix + '/');
        }
        return file.type === pattern;
      });

      if (!isValid) {
        errors.push(`نوع فایل نامعتبر. انواع مجاز: ${acceptList.join(', ')}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * ایجاد فایل متنی
   */
  createTextFile(content, filename = 'file.txt', mimeType = 'text/plain') {
    return new File([content], filename, { type: mimeType });
  }

  /**
   * ادغام فایل‌ها
   */
  async mergeFiles(files, options = {}) {
    const blobs = files.map(f => f instanceof Blob ? f : new Blob([f]));
    const merged = new Blob(blobs, { type: options.mimeType || 'application/octet-stream' });

    if (options.filename) {
      this.downloadBlob(merged, options.filename);
    }

    return merged;
  }

  /**
   * خواندن فایل JSON
   */
  async readJSON(file) {
    const text = await this.readAsText(file);
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(`خطا در تجزیه JSON: ${error.message}`);
    }
  }

  /**
   * خواندن فایل CSV
   */
  async readCSV(file, options = {}) {
    const text = await this.readAsText(file);
    return this._parseCSV(text, options);
  }

  /**
   * تجزیه CSV
   */
  _parseCSV(text, options = {}) {
    const delimiter = options.delimiter || ',';
    const quote = options.quote || '"';
    const hasHeader = options.hasHeader !== false;

    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (inQuotes) {
        if (char === quote && nextChar === quote) {
          currentField += quote;
          i++;
        } else if (char === quote) {
          inQuotes = false;
        } else {
          currentField += char;
        }
      } else {
        if (char === quote) {
          inQuotes = true;
        } else if (char === delimiter) {
          currentRow.push(currentField);
          currentField = '';
        } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
          currentRow.push(currentField);
          rows.push(currentRow);
          currentRow = [];
          currentField = '';
          if (char === '\r') i++;
        } else if (char !== '\r') {
          currentField += char;
        }
      }
    }

    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField);
      rows.push(currentRow);
    }

    if (hasHeader && rows.length > 0) {
      const headers = rows[0];
      const data = rows.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = row[i] !== undefined ? row[i] : '';
        });
        return obj;
      });

      return { headers, data };
    }

    return { headers: null, data: rows };
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

const fileService = new FileService();