export const SUPABASE_URL = "https://ummhohozmpwltbgeczsf.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_WcK2pmYMMu61z0KUub5jLA_KSxGpQD6";

export const APP_NAME = "نظریه";
export const APP_TAGLINE = "فضایی برای پرورش ایده‌ها";
export const APP_VERSION = "1.0.0";

export const STORAGE_BUCKET = "theory-images";
export const PAGE_SIZE = 12;

export const THEORY_STATUSES = {
  published: { label: "منتشرشده", className: "badge--published" },
  draft: { label: "پیش‌نویس", className: "badge--draft" },
  private: { label: "خصوصی", className: "badge--private" },
};

export const OBJECT_KINDS = [
  { value: "concept", label: "مفهوم" },
  { value: "image", label: "تصویر" },
  { value: "quote", label: "نقل‌قول" },
  { value: "reference", label: "منبع" },
  { value: "note", label: "یادداشت" },
  { value: "artifact", label: "شیء" },
];

export const SORT_OPTIONS = [
  { value: "newest", label: "تازه‌ترین" },
  { value: "oldest", label: "قدیمی‌ترین" },
  { value: "popular", label: "پربازدیدترین" },
  { value: "liked", label: "محبوب‌ترین" },
  { value: "title", label: "بر اساس عنوان" },
];

export const LINE_COLORS = [
  "#8b5cf6",
  "#22d3ee",
  "#fb7185",
  "#fbbf24",
  "#34d399",
  "#f4f2ff",
];

export const QUOTES = [
  {
    text: "هیچ نظریه‌ای کامل نیست؛ اما هر نظریه‌ای راهی برای دیدن است.",
    author: "دفتر نظریه",
  },
  {
    text: "ایده‌ها زمانی زنده می‌مانند که به اشیا، تصاویر و خطوط گره بخورند.",
    author: "دفتر نظریه",
  },
  {
    text: "نظریه یعنی نگاه کردن به جهان از دریچه‌ای که خودت ساخته‌ای.",
    author: "دفتر نظریه",
  },
];
