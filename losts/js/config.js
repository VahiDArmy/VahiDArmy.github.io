export const SUPABASE_URL = 'https://nvmevqkaovazhmoznusf.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_AuneSCRLhrKKDeK8q7kJtw_Bg4VNHgE';

export const APP = {
  name: 'شادی‌یار',
  tagline: 'هر روز، یک شادی کوچک برای خودت',
  version: '1.1.0',
};

export const TABLES = {
  entries: 'joy_entries',
  goals: 'joy_goals',
  wishes: 'joy_wishlist',
  reflections: 'joy_reflections',
  settings: 'joy_settings',
};

export const CATEGORIES = [
  { id: 'food',      label: 'خوراک',        emoji: '🍰', color: '#f59e0b' },
  { id: 'travel',    label: 'سفر',          emoji: '✈️', color: '#0ea5e9' },
  { id: 'shopping',  label: 'خرید',         emoji: '🛍️', color: '#f43f5e' },
  { id: 'fun',       label: 'تفریح',        emoji: '🎡', color: '#8b5cf6' },
  { id: 'calm',      label: 'آرامش',        emoji: '🧘', color: '#14b8a6' },
  { id: 'sport',     label: 'ورزش',         emoji: '🏃', color: '#10b981' },
  { id: 'art',       label: 'هنر',          emoji: '🎨', color: '#ec4899' },
  { id: 'book',      label: 'کتاب',         emoji: '📚', color: '#6366f1' },
  { id: 'friends',   label: 'دوستان',       emoji: '👥', color: '#f97316' },
  { id: 'family',    label: 'خانواده',      emoji: '🏡', color: '#eab308' },
  { id: 'nature',    label: 'طبیعت',        emoji: '🌿', color: '#22c55e' },
  { id: 'music',     label: 'موسیقی',       emoji: '🎵', color: '#a855f7' },
  { id: 'game',      label: 'بازی',         emoji: '🎮', color: '#06b6d4' },
  { id: 'learning',  label: 'یادگیری',      emoji: '🧠', color: '#3b82f6' },
  { id: 'selfcare',  label: 'خودمراقبتی',   emoji: '💆', color: '#f472b6' },
  { id: 'silence',   label: 'سکوت',         emoji: '🤫', color: '#64748b' },
  { id: 'other',     label: 'دیگر',         emoji: '✨', color: '#94a3b8' },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

export function getCategory(id) {
  return CATEGORY_MAP[id] || CATEGORY_MAP.other;
}

export const KARMA_LEVELS = [
  {
    score: -2,
    label: 'آسیب‌زننده',
    shortLabel: 'منفی',
    desc: 'شاید بهتر بود این کار را نمی‌کردم.',
    icon: '🌑',
    color: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.4)'
  },
  {
    score: -1,
    label: 'کمی منفی',
    shortLabel: 'کمی منفی',
    desc: 'کمی ناخودآگاهانه بود.',
    icon: '🌘',
    color: '#f97316',
    glow: 'rgba(249, 115, 22, 0.4)'
  },
  {
    score: 0,
    label: 'خنثی',
    shortLabel: 'خنثی',
    desc: 'نه خوب، نه بد. فقط یک لحظه بود.',
    icon: '⚖️',
    color: '#94a3b8',
    glow: 'rgba(148, 163, 184, 0.3)'
  },
  {
    score: 1,
    label: 'آگاهانه',
    shortLabel: 'مثبت',
    desc: 'حالم را خوب کرد و به کسی آسیب نزد.',
    icon: '🌓',
    color: '#10b981',
    glow: 'rgba(16, 185, 129, 0.4)'
  },
  {
    score: 2,
    label: 'مهربانانه',
    shortLabel: 'کارمای مثبت',
    desc: 'شادی عمیق، پاک و پر از انرژی خوب.',
    icon: '🌟',
    color: '#8b5cf6',
    glow: 'rgba(139, 92, 246, 0.5)'
  },
];

export const KARMA_MAP = Object.fromEntries(KARMA_LEVELS.map(k => [k.score, k]));

export function getKarma(score) {
  const s = Number(score);
  if (s >= 2) return KARMA_MAP[2];
  if (s <= -2) return KARMA_MAP[-2];
  return KARMA_MAP[s] || KARMA_MAP[0];
}

export const EMOJIS = [
  '✨','😊','🥰','😂','😌','🤩','😎','🥳','😇','🙃',
  '🍰','🍦','☕','🍕','🍫','🍉','🍓','🥐','🍜','🧋',
  '🌞','🌙','🌈','🌸','🌿','🍃','🌊','⛰️','🔥','❄️',
  '🎵','🎧','🎨','📚','✍️','🎬','🎮','🧩','🎲','🏆',
  '🛍️','🎁','💎','👟','💄','🕯️','🛁','💆','🧘','🏃',
  '✈️','🚗','🏖️','🏕️','🎡','🎢','🐾','🐱','🐶','🦋',
  '❤️','💛','💚','💙','💜','🤍','🫶','👏','🙏','💫',
];

export const JOY_SCORE_LABELS = {
  1: 'خیلی کم',
  2: 'کم',
  3: 'کمی',
  4: 'متوسط',
  5: 'خوب',
  6: 'خوب‌تر',
  7: 'زیاد',
  8: 'خیلی زیاد',
  9: 'فوق‌العاده',
  10: 'بی‌نظیر',
};

export const MOODS = [
  { id: 'great',   label: 'فوق‌العاده', emoji: '🤩' },
  { id: 'happy',   label: 'خوشحال',     emoji: '😊' },
  { id: 'calm',    label: 'آرام',       emoji: '😌' },
  { id: 'neutral', label: 'معمولی',     emoji: '😐' },
  { id: 'tired',   label: 'خسته',       emoji: '😴' },
  { id: 'sad',     label: 'غمگین',      emoji: '😔' },
  { id: 'anxious', label: 'مضطرب',      emoji: '😟' },
  { id: 'angry',   label: 'عصبانی',     emoji: '😤' },
];

export const MOOD_MAP = Object.fromEntries(MOODS.map(m => [m.id, m]));

export const PRIORITIES = [
  { id: 'high',   label: 'بالا',  color: '#ef4444' },
  { id: 'medium', label: 'متوسط', color: '#f59e0b' },
  { id: 'low',    label: 'پایین', color: '#10b981' },
];

export const GOAL_PERIODS = [
  { id: 'week',  label: 'هفتگی' },
  { id: 'month', label: 'ماهانه' },
  { id: 'year',  label: 'سالانه' },
  { id: 'all',   label: 'کلی' },
];

export const VIEW_TITLES = {
  dashboard: 'داشبورد',
  add: 'ثبت شادی',
  journal: 'دفتر شادی',
  calendar: 'تقویم',
  analytics: 'تحلیل',
  goals: 'هدف‌ها',
  wishlist: 'آرزوها',
  reflections: 'تأمل‌ها',
  settings: 'تنظیمات',
};

export const PROMPTS = [
  'امروز چه چیزی باعث لبخندت شد؟',
  'آخرین باری که برای خودت وقت گذاشتی کِی بود؟',
  'یک شادی کوچک که امروز تجربه کردی چیست؟',
  'چه چیزی امروز حالت را بهتر کرد؟',
  'اگر امروز یک هدیه به خودت می‌دادی، چه بود؟',
  'کدام لحظهٔ امروز را دوست داری برای همیشه نگه داری؟',
  'امروز از چه چیزی لذت بردی که پول نمی‌توانست بخرد؟',
  'چه کاری برای خودت کردی که به آن افتخار می‌کنی؟',
  'یک طعم، صدا یا بو که امروز خوشحالت کرد؟',
  'امروز چه چیز کوچکی را جشن گرفتی؟',
  'دلت می‌خواست امروز چه کاری می‌کردی؟',
  'آخرین شادی‌ای که خریدی چه بود؟',
  'امروز چه کسی لبخندت را دید؟',
  'چه زمانی امروز احساس راحتی کامل داشتی؟',
  'چه چیزی برای خودت آرزو می‌کنی؟',
  'امروز کدام لحظه را دوست داشتی تکرار کنی؟',
  'به خودت چه می‌گویی وقتی موفق می‌شوی؟',
  'یک عادت کوچک که حالت را خوب می‌کند چیست؟',
  'امروز چقدر برای خودت وقت گذاشتی؟',
  'چه چیزی در این هفته ارزش جشن گرفتن دارد؟',
];
