/**
 * config.js — تنظیمات عمومی سایت
 * کلید publishable برای استفادهٔ سمت مرورگر امن است؛ هرگز کلید secret نگذار.
 */

export const SUPABASE_URL = "https://ummhohozmpwltbgeczsf.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_WcK2pmYMMu61z0KUub5jLA_KSxGpQD6";

export const SITE = {
  title: "واقعه",
  surah: 56,
  surahNameFa: "واقعه",
  ayahCount: 96,
  defaultNames: { 1: "نفر اول", 2: "نفر دوم" },
  timeZone: "Asia/Tehran",
  tafsir: {
    dir: "data/tafsir/",
    manifest: "data/tafsir/manifest.json",
    defaults: ["499.json", "500.json", "501.json"],
    speaker: "ترجمهٔ تفسیر المیزان، علامه طباطبایی",
  },
  // هر تکه از تفسیر که از این عدد بلندتر شود، به صفحهٔ بعد می‌رود
  pageTarget: 1900,
  pageMin: 900,
  pageMax: 3300,
};
