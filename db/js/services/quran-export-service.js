/**
 * سرویس صادرات تفسیر قرآن
 * از دو جدول content و ayah_mapping یک ZIP با ساختار پوشه‌ای می‌سازد:
 *   - surah/[surah_number].json   → { surah, ayah_to_content: { "ayah": [content_ids] } }
 *   - content/[content_id].json   → { content_id, text }
 *
 * نکته DB Layer:
 *   از `databaseService.executeQuery(sql)` استفاده می‌کند که این ساختار را برمی‌گرداند:
 *     { success: boolean, data: Array<Object>, columns: Array<string>, error?: string }
 *   اگر API شما متفاوت است، فقط متد `_runQuery` را تغییر دهید.
 */
class QuranExportService {
  constructor() {
    this.listeners = new Map();

    // پیکربندی پیش‌فرض — همه از طریق options قابل بازنویسی هستند
    this.defaults = {
      // جدول‌ها
      contentTable: 'content',
      mappingTable: 'ayah_mapping',

      // ستون‌های content
      contentIdColumn: 'content_id',
      contentTextColumn: 'content',

      // ستون‌های ayah_mapping
      mappingSurahColumn: 'surah_number',
      mappingAyahColumn: 'ayah_number',
      mappingContentIdColumn: 'content_id',

      // خروجی
      zipFileName: 'quran_tafsir_json.zip',
      surahFolder: 'surah',
      contentFolder: 'content',

      // فشرده‌سازی
      compressionLevel: 6,
      minifyJSON: true   // اگر true، JSON.stringify(data) بدون فاصله
    };
  }

  /**
   * اجرای کوئری در لایه DB
   * (نقطه اتصال به لایه DB موجود)
   */
  _runQuery(sql) {
    if (typeof databaseService === 'undefined' || typeof databaseService.executeQuery !== 'function') {
      throw new Error('databaseService در دسترس نیست');
    }
    return databaseService.executeQuery(sql);
  }

  /**
   * بررسی وجود JSZip
   */
  isZipAvailable() {
    return typeof JSZip !== 'undefined';
  }

  /**
   * پاک‌سازی و اعتبارسنجی نام شناسه SQL
   */
  _safeIdent(name) {
    return String(name).replace(/"/g, '""');
  }

  /**
   * دریافت همه ردیف‌های content و ساخت lookup map
   * @returns {Map<number|string, string>}
   */
  _fetchContentMap(cfg) {
    const sql = `SELECT "${this._safeIdent(cfg.contentIdColumn)}", "${this._safeIdent(cfg.contentTextColumn)}" FROM "${this._safeIdent(cfg.contentTable)}"`;

    const result = this._runQuery(sql);

    if (!result || !result.success) {
      throw new Error(`خطا در خواندن جدول "${cfg.contentTable}": ${result?.error || 'خطای نامشخص'}`);
    }

    const map = new Map();

    (result.data || []).forEach(row => {
      const id = row[cfg.contentIdColumn];
      const text = row[cfg.contentTextColumn];

      if (id === null || id === undefined) return;

      map.set(id, text === null || text === undefined ? '' : String(text));
    });

    return map;
  }

  /**
   * دریافت همه ردیف‌های ayah_mapping و ساخت ساختار surah → ayah → Set<content_id>
   * @returns {Map<number, Map<number, Set<number>>>}
   */
  _fetchAndStructureMapping(cfg) {
    const sql = `SELECT "${this._safeIdent(cfg.mappingSurahColumn)}", "${this._safeIdent(cfg.mappingAyahColumn)}", "${this._safeIdent(cfg.mappingContentIdColumn)}" FROM "${this._safeIdent(cfg.mappingTable)}" ORDER BY "${this._safeIdent(cfg.mappingSurahColumn)}", "${this._safeIdent(cfg.mappingAyahColumn)}"`;

    const result = this._runQuery(sql);

    if (!result || !result.success) {
      throw new Error(`خطا در خواندن جدول "${cfg.mappingTable}": ${result?.error || 'خطای نامشخص'}`);
    }

    const surahMap = new Map();

    (result.data || []).forEach(row => {
      const surah = row[cfg.mappingSurahColumn];
      const ayah = row[cfg.mappingAyahColumn];
      const contentId = row[cfg.mappingContentIdColumn];

      if (surah === null || surah === undefined) return;
      if (ayah === null || ayah === undefined) return;
      if (contentId === null || contentId === undefined) return;

      if (!surahMap.has(surah)) {
        surahMap.set(surah, new Map());
      }

      const ayahMap = surahMap.get(surah);
      if (!ayahMap.has(ayah)) {
        ayahMap.set(ayah, new Set());
      }

      // Set از duplicate content_id برای همان ayah جلوگیری می‌کند
      ayahMap.get(ayah).add(contentId);
    });

    return surahMap;
  }

  /**
   * ساخت آماره‌ها (برای پیش‌نمایش)
   */
  async estimate(options = {}) {
    const cfg = { ...this.defaults, ...options };

    const contentResult = this._runQuery(`SELECT COUNT(*) AS c FROM "${this._safeIdent(cfg.contentTable)}"`);
    const mappingResult = this._runQuery(`SELECT COUNT(DISTINCT "${this._safeIdent(cfg.mappingSurahColumn)}") AS s FROM "${this._safeIdent(cfg.mappingTable)}"`);
    const mappingCountResult = this._runQuery(`SELECT COUNT(*) AS c FROM "${this._safeIdent(cfg.mappingTable)}"`);

    return {
      contentCount: contentResult?.data?.[0]?.c || 0,
      surahCount: mappingResult?.data?.[0]?.s || 0,
      mappingCount: mappingCountResult?.data?.[0]?.c || 0
    };
  }

  /**
   * اجرای صادرات
   * @param {Object} options - بازنویسی پیکربندی پیش‌فرض
   * @param {Function} onProgress - callback(percent, message)
   */
  async export(options = {}, onProgress = null) {
    const cfg = { ...this.defaults, ...options };
    const report = (p, m) => { if (typeof onProgress === 'function') onProgress(p, m); };

    if (!this.isZipAvailable()) {
      throw new Error('کتابخانه JSZip بارگذاری نشده است');
    }

    report(5, 'در حال خواندن محتوا...');
    const contentMap = this._fetchContentMap(cfg);

    report(25, 'در حال خواندن نگاشت آیات...');
    const surahMap = this._fetchAndStructureMapping(cfg);

    report(45, 'در حال ساخت فایل‌های ZIP...');

    const zip = new JSZip();
    const surahFolder = zip.folder(cfg.surahFolder);
    const contentFolder = zip.folder(cfg.contentFolder);

    // مرتب‌سازی عددی سوره‌ها و آیات
    const sortedSurahs = Array.from(surahMap.keys()).sort((a, b) => Number(a) - Number(b));

    let surahFilesCount = 0;

    for (const surah of sortedSurahs) {
      const ayahMap = surahMap.get(surah);
      const ayahToContent = {};

      const sortedAyahs = Array.from(ayahMap.keys()).sort((a, b) => Number(a) - Number(b));

      for (const ayah of sortedAyahs) {
        const contentIds = Array.from(ayahMap.get(ayah))
          .sort((a, b) => Number(a) - Number(b));

        // کلید به صورت string (طبق فرمت درخواستی)
        ayahToContent[String(ayah)] = contentIds;
      }

      const payload = {
        surah: Number(surah),
        ayah_to_content: ayahToContent
      };

      const json = cfg.minifyJSON
        ? JSON.stringify(payload)
        : JSON.stringify(payload, null, 2);

      surahFolder.file(`${surah}.json`, json);
      surahFilesCount++;
    }

    const sortedContentIds = Array.from(contentMap.keys()).sort((a, b) => Number(a) - Number(b));

    let contentFilesCount = 0;

    for (const contentId of sortedContentIds) {
      const payload = {
        content_id: Number(contentId),
        text: contentMap.get(contentId) ?? ''
      };

      const json = cfg.minifyJSON
        ? JSON.stringify(payload)
        : JSON.stringify(payload, null, 2);

      contentFolder.file(`${contentId}.json`, json);
      contentFilesCount++;
    }

    report(70, 'در حال فشرده‌سازی...');

    const blob = await zip.generateAsync(
      {
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: cfg.compressionLevel }
      },
      (metadata) => {
        // پیشرفت خود JSZip از 0 تا 100
        const p = 70 + Math.round((metadata.percent || 0) * 0.25);
        report(p, `فشرده‌سازی: ${Math.round(metadata.percent || 0)}%`);
      }
    );

    report(98, 'آماده‌سازی دانلود...');

    FileUtils.downloadBlob(blob, cfg.zipFileName);

    report(100, 'انجام شد');

    return {
      success: true,
      surahFiles: surahFilesCount,
      contentFiles: contentFilesCount,
      totalFiles: surahFilesCount + contentFilesCount,
      zipSize: blob.size,
      zipFileName: cfg.zipFileName,
      orphanContent: this._countOrphanContent(surahMap, contentMap),
      orphanMapping: this._countOrphanMapping(surahMap, contentMap)
    };
  }

  /**
   * تعداد content_id های موجود در content که در mapping استفاده نشده‌اند
   */
  _countOrphanContent(surahMap, contentMap) {
    const used = new Set();
    surahMap.forEach(ayahMap => {
      ayahMap.forEach(set => set.forEach(id => used.add(id)));
    });

    let count = 0;
    contentMap.forEach((_, id) => {
      if (!used.has(id)) count++;
    });
    return count;
  }

  /**
   * تعداد content_id های موجود در mapping که در content وجود ندارند
   */
  _countOrphanMapping(surahMap, contentMap) {
    let count = 0;
    surahMap.forEach(ayahMap => {
      ayahMap.forEach(set => {
        set.forEach(id => {
          if (!contentMap.has(id)) count++;
        });
      });
    });
    return count;
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

const quranExportService = new QuranExportService();