/* ==========================================================================
   config.js — پیکربندی مرکزی سایت
   ========================================================================== */

export const CONFIG = Object.freeze({
  /* ---------- Supabase ---------- */
  supabaseUrl: 'https://ummhohozmpwltbgeczsf.supabase.co',
  supabaseKey: 'sb_publishable_WcK2pmYMMu61z0KUub5jLA_KSxGpQD6',

  /* ---------- نام جداول (اختصاصی این پروژه) ---------- */
  tables: Object.freeze({
    profiles: 'quran_profiles',
    reads: 'quran_read_events',
    bookmarks: 'quran_bookmarks',
    tafsirProgress: 'quran_tafsir_progress',
    countersView: 'quran_public_counters',
  }),

  /* ---------- محتوای سایت ---------- */
  surah: Object.freeze({
    number: 56,
    nameFa: 'واقعه',
    nameFullFa: 'سوره واقعه',
    nameAr: 'الواقعة',
    nameEn: 'The Inevitable',
    ayahCount: 96,
    juz: 27,
    revelation: 'مکی',
  }),

  /* ---------- تم‌ها ---------- */
  themes: Object.freeze({
    pink: {
      id: 'pink',
      label: 'صورتی',
      sub: 'دخترانه',
      emoji: '🌸',
      metaColor: '#f9a8d4',
      particle: 'heart',
    },
    boy: {
      id: 'boy',
      label: 'پسرانه',
      sub: 'شبانه',
      emoji: '🌊',
      metaColor: '#0ea5e9',
      particle: 'star',
    },
  }),
  defaultTheme: 'pink',

  /* ---------- تنظیمات UI ---------- */
  ui: Object.freeze({
    doubleTapWindow: 320,      // ms
    toastDuration: 3200,       // ms
    splashMinDuration: 900,    // ms
    particleCountDesktop: 26,
    particleCountMobile: 12,
    fontScaleMin: 0.85,
    fontScaleMax: 1.45,
    fontScaleStep: 0.05,
    defaultFontScale: 1,
  }),

  /* ---------- ذخیره‌سازی محلی ---------- */
  storageKeys: Object.freeze({
    theme: 'q56.theme',
    fontScale: 'q56.fontScale',
    lastView: 'q56.lastView',
    personSlot: 'q56.personSlot',
    tafsirPage: 'q56.tafsir.page',
    surahScroll: 'q56.surah.scroll',
    bookmarks: 'q56.bookmarks',
  }),

  /* ---------- روتینگ ---------- */
  routes: Object.freeze(['surah', 'tafsir', 'auth']),
  defaultRoute: 'surah',
});

export const PERSON_SLOTS = Object.freeze({
  1: { slot: 1, label: 'شخص ۱', emoji: '🌸', altEmoji: '🌷' },
  2: { slot: 2, label: 'شخص ۲', emoji: '🌊', altEmoji: '⭐' },
});

export default CONFIG;