/* ============================================================
   App config — Supabase endpoint + public anon key
   ============================================================ */
export const CONFIG = Object.freeze({
  supabaseUrl: 'https://ummhohozmpwltbgeczsf.supabase.co',
  supabaseKey: 'sb_publishable_WcK2pmYMMu61z0KUub5jLA_KSxGpQD6',

  appName: 'سوپرمارکت‌یار',
  appTagline: 'دفترچهٔ خرید و امتیاز فروشگاه‌ها',

  // table names (dedicated, prefixed)
  tables: {
    platforms: 'sm_platforms',
    shops: 'sm_shops',
    products: 'sm_products',
    purchases: 'sm_purchases',
    comments: 'sm_comments',
  },

  // Seed platforms (inserted on first login if user has none)
  seedPlatforms: [
    { name: 'دیجی‌کالا',    color: '#ef4056', icon: '🛒' },
    { name: 'اسنپ‌فود',     color: '#ff5722', icon: '🛵' },
    { name: 'اسنپ‌مارکت',   color: '#22c55e', icon: '🛍️' },
    { name: 'اکالا',        color: '#8b5cf6', icon: '🥑' },
    { name: 'باسلام',       color: '#f59e0b', icon: '🤝' },
    { name: 'دیجی‌استایل',  color: '#ec4899', icon: '👗' },
    { name: 'تپسی',         color: '#22d3ee', icon: '🚕' },
    { name: 'رفاه',         color: '#0ea5e9', icon: '🏪' },
    { name: 'افق کوروش',    color: '#10b981', icon: '🌿' },
    { name: 'هایپراستار',   color: '#f97316', icon: '⭐' },
  ],

  ratings: Object.freeze({
    good: { key: 'good', label: 'خوب',    labelLong: 'خرید خوب',     color: 'var(--good)',  soft: 'var(--good-soft)',  icon: '✓' },
    bad:  { key: 'bad',  label: 'بد',     labelLong: 'نچندان خوب',   color: 'var(--bad)',   soft: 'var(--bad-soft)',   icon: '~' },
    shit: { key: 'shit', label: 'افتضاح', labelLong: 'افتضاح / پشیمانی', color: 'var(--shit)', soft: 'var(--shit-soft)', icon: '✕' },
  }),

  ratingOrder: ['good', 'bad', 'shit'],
});
