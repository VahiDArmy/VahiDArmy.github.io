/* =========================================================
   پیکربندی برنامه — نسخه آنلاین Supabase
   ========================================================= */
window.CONFIG = {
  APP_NAME: 'سینما من',
  APP_VERSION: '3.0.0-online',

  SUPABASE: {
    URL: 'https://ummhohozmpwltbgeczsf.supabase.co',
    ANON_KEY: 'sb_publishable_WcK2pmYMMu61z0KUub5jLA_KSxGpQD6'
  },

  AI: {
    // Use edge function for AI
    EDGE_URL: 'https://ummhohozmpwltbgeczsf.supabase.co/functions/v1/movies-quran',
    // Fallback / alternative: Google Gemini (key provided as GEM_MALI — replace with real key if needed)
    GEMINI_KEY: 'GEM_MALI',
    GEMINI_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    DEFAULT_MODEL: 'gemini-2.0-flash',
    STORAGE_KEY: 'cinema_ai_key'
  },

  RATING: {
    0: { value: 0, label: 'بدون امتیاز', description: 'هنوز امتیاز نداده‌ام', color: '#5a5a72', emoji: '○', glow: null },
    1: { value: 1, label: 'متنفرم', description: 'از دیدنش پشیمانم', color: '#ff4d5e', emoji: '⭐', glow: 'rgba(255, 77, 94, 0.7)' },
    2: { value: 2, label: 'ضعیف', description: 'کاش ندیده بودم', color: '#ff9f43', emoji: '⭐⭐', glow: 'rgba(255, 159, 67, 0.7)' },
    3: { value: 3, label: 'خنثی', description: 'بد نبود، خوب نبود', color: '#9a9ab0', emoji: '⭐⭐⭐', glow: 'rgba(154, 154, 176, 0.5)' },
    4: { value: 4, label: 'خوب', description: 'از دیدنش راضی‌ام', color: '#3ddc97', emoji: '⭐⭐⭐⭐', glow: 'rgba(61, 220, 151, 0.7)' },
    5: { value: 5, label: 'شاهکار', description: 'بی‌همتا — دوباره خواهم دید', color: '#ffd700', emoji: '⭐⭐⭐⭐⭐', glow: 'rgba(255, 215, 0, 0.8)' }
  },

  CATEGORIES: {
    love: { label: 'عاشقشم', color: '#ff4d6d', emoji: '❤️' },
    good: { label: 'خوبه', color: '#3ddc97', emoji: '👍' },
    hate: { label: 'متنفرم', color: '#9a9ab0', emoji: '👎' }
  },

  TASTE_PROFILE: {
    manifesto: 'داستان باید جهان خودش را بسازد، به قوانین خودش وفادار بماند، نتیجه را به دست بیاورد و به شعور مخاطب برای استنتاج آن اعتماد کند.',
    loves: [
      'انسجام روایی — جهان داستان به قواعد خودش وفادار می‌ماند',
      'علّیت طبیعی — هر اتفاق از رویدادهای قبلی بیرون می‌آید',
      'نتیجه به‌دست‌آمده — نه طلبیده‌شده',
      'اعتماد به هوش بیننده — نشان دادن، نه توضیح دادن',
      'شخصیت‌هایی که حتی وقتی اشتباه می‌کنند از خودشان بیرون می‌آیند',
      'پایان‌بندی معنادار — پاسخ به پرسش‌های اصلی',
      'لایه‌مندی — تماشای دوباره چیزهای تازه نشان می‌دهد',
      'جهان‌سازی منسجم — فانتزی یا رئال'
    ],
    hates: [
      'داستانی که همه‌چیز فدای ادامه‌یافتن می‌شود',
      'نقض قوانین خودِ داستان برای کش دادن',
      'احمق فرض کردن بیننده — توضیح مستقیم چیزی که باید نشان داده شود',
      'نخ‌های روایی رهاشده یا پاسخ‌های ساختگی',
      'تصمیم‌های بی‌دلیل شخصیت‌ها فقط برای حرکت پیرنگ',
      'فصل‌های پرکننده و فلش‌بک‌های بی‌هدف',
      'شخصیت‌هایی که شخصیتشان بر اساس نیاز لحظه عوض می‌شود',
      'نتایجی که از راه احساسی طلب می‌شوند',
      'دیکته کردن احساس از طرف نویسنده'
    ]
  }
};
