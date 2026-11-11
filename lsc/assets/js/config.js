/* ============================================================
   THEORIES STUDIO — Config
   ============================================================ */
export const SUPABASE_URL = 'https://ummhohozmpwltbgeczsf.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_WcK2pmYMMu61z0KUub5jLA_KSxGpQD6';

export const APP = {
  name: 'نظریه‌ها',
  tagline: 'استودیوی ایده‌ها',
  version: '3.0.0',
  storage: {
    bucket: 'theory-images',
    maxFileSize: 10 * 1024 * 1024,
    acceptedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']
  },
  limits: {
    titleMax: 200,
    summaryMax: 500,
    objectTitleMax: 200,
    objectDescMax: 2000,
    tagsMax: 24,
    tagLenMax: 32,
    contentMax: 100000,
    objectPositionMin: 0,
    objectPositionMax: 100
  },
  pagination: {
    theoriesPerPage: 12,
    objectsPerPage: 24,
    galleryPerPage: 30,
    timelinePerPage: 20,
    searchPerPage: 20
  },
  categories: [
    { id: 'philosophy', label: 'فلسفه', icon: 'ri-brain-line', color: '#7c3aed' },
    { id: 'science', label: 'علم', icon: 'ri-flask-line', color: '#06b6d4' },
    { id: 'social', label: 'اجتماعی', icon: 'ri-group-line', color: '#10b981' },
    { id: 'art', label: 'هنر', icon: 'ri-palette-line', color: '#ec4899' },
    { id: 'history', label: 'تاریخ', icon: 'ri-history-line', color: '#f59e0b' },
    { id: 'technology', label: 'فناوری', icon: 'ri-cpu-line', color: '#3b82f6' },
    { id: 'psychology', label: 'روان‌شناسی', icon: 'ri-heart-pulse-line', color: '#ef4444' },
    { id: 'other', label: 'دیگر', icon: 'ri-more-line', color: '#6366f1' }
  ],
  linkTypes: [
    { id: 'related', label: 'مرتبط', icon: 'ri-link', color: '#6366f1' },
    { id: 'inspired', label: 'الهام‌بخش', icon: 'ri-sparkling-line', color: '#f59e0b' },
    { id: 'contradicts', label: 'متناقض', icon: 'ri-forbid-line', color: '#ef4444' },
    { id: 'extends', label: 'گسترش', icon: 'ri-expand-horizontal-line', color: '#10b981' },
    { id: 'references', label: 'ارجاع', icon: 'ri-book-mark-line', color: '#06b6d4' }
  ],
  objectTypes: [
    { id: 'image', label: 'تصویر', icon: 'ri-image-line', color: '#06b6d4' },
    { id: 'document', label: 'سند', icon: 'ri-file-text-line', color: '#3b82f6' },
    { id: 'audio', label: 'صدا', icon: 'ri-mic-line', color: '#ec4899' },
    { id: 'video', label: 'ویدئو', icon: 'ri-video-line', color: '#8b5cf6' },
    { id: 'link', label: 'پیوند', icon: 'ri-external-link-line', color: '#10b981' },
    { id: 'note', label: 'یادداشت', icon: 'ri-sticky-note-line', color: '#f59e0b' },
    { id: 'concept', label: 'مفهوم', icon: 'ri-lightbulb-line', color: '#6366f1' }
  ],
  accents: [
    { id: 'violet', label: 'بنفش', swatch: 'swatch--violet' },
    { id: 'rose', label: 'سرخ', swatch: 'swatch--rose' },
    { id: 'emerald', label: 'سبز', swatch: 'swatch--emerald' },
    { id: 'amber', label: 'کهربایی', swatch: 'swatch--amber' },
    { id: 'ocean', label: 'اقیانوسی', swatch: 'swatch--ocean' }
  ],
  fonts: [
    { id: 'sm', label: 'کوچک' },
    { id: 'md', label: 'متوسط' },
    { id: 'lg', label: 'بزرگ' },
    { id: 'xl', label: 'خیلی بزرگ' }
  ],
  radii: [
    { id: 'sharp', label: 'تیز' },
    { id: 'normal', label: 'معمولی' },
    { id: 'soft', label: 'نرم' },
    { id: 'round', label: 'گرد' }
  ],
  shortcuts: [
    { keys: ['⌘', 'K'], label: 'پالت دستورات' },
    { keys: ['N'], label: 'نظریه جدید' },
    { keys: ['U'], label: 'بارگذاری تصویر' },
    { keys: ['/'], label: 'جستجو' },
    { keys: ['Esc'], label: 'بستن' },
    { keys: ['?'], label: 'راهنمای کلیدها' }
  ]
};

export const CATEGORY_MAP = Object.fromEntries(APP.categories.map(c => [c.id, c]));
export const LINK_TYPE_MAP = Object.fromEntries(APP.linkTypes.map(l => [l.id, l]));
export const OBJECT_TYPE_MAP = Object.fromEntries(APP.objectTypes.map(o => [o.id, o]));
