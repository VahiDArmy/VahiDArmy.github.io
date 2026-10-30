/* =========================================================
   تحلیل سلیقه + پیشنهاد تک‌اثر
   پرامپت در فرانت — اجرا روی Edge/Gemini (استریم)
   ========================================================= */
window.AIAnalysis = (function () {

  /** معنی رسمی ستاره‌ها برای ارسال به AI */
  var STAR_MEANINGS = {
    5: 'عالی بود به قدری که بیش از یک بار خواهم دید',
    4: 'خوب بود و خوشحالم که تماشا کردم',
    3: 'خوب بود',
    2: 'افتضاح بود و اگر به گذشته برگردم هرگز تماشا نخواهم کرد',
    1: 'افتضاح بود و از تماشایش عصبانی هستم',
    0: 'هنوز امتیاز نداده'
  };

  function starMeaning(rating) {
    var n = Math.round(Number(rating) || 0);
    if (n < 0) n = 0;
    if (n > 5) n = 5;
    return STAR_MEANINGS[n] || STAR_MEANINGS[0];
  }

  function collectUserData() {
    var all = DB.getAllTitles();
    var rated = all.filter(function (t) { return (t.rating || 0) > 0; });
    var titlesForAI = rated.map(function (t) {
      var r = Math.round(Number(t.rating) || 0);
      return {
        title: t.title,
        original_title: t.original_title || '',
        type: t.type,
        year: t.year,
        rating: r,
        rating_meaning: starMeaning(r),
        reason: (t.reason || '').trim(),
        notes: (t.notes || '').trim(),
        genre: t.genre || ''
      };
    });
    return { all: all, rated: titlesForAI };
  }

  function formatTitleLine(t) {
    var parts = [
      '• «' + t.title + '»',
      t.year ? '(' + t.year + ')' : '',
      '[' + (t.type || 'نامشخص') + ']',
      t.genre ? 'ژانر: ' + t.genre : '',
      'امتیاز: ' + t.rating + '/5 — ' + t.rating_meaning
    ];
    var line = parts.filter(Boolean).join(' ');
    if (t.reason) line += '\n  دلیل/نظر: ' + t.reason;
    if (t.notes) line += '\n  یادداشت: ' + t.notes;
    return line;
  }

  function legendBlock() {
    return [
      'معنی امتیازهای کاربر (حتماً رعایت کن):',
      '۵⭐ = عالی بود به قدری که بیش از یک بار خواهم دید',
      '۴⭐ = خوب بود و خوشحالم که تماشا کردم',
      '۳⭐ = خوب بود',
      '۲⭐ = افتضاح بود و اگر به گذشته برگردم هرگز تماشا نخواهم کرد',
      '۱⭐ = افتضاح بود و از تماشایش عصبانی هستم'
    ].join('\n');
  }

  function tasteProfileBlock() {
    if (!window.CONFIG || !CONFIG.TASTE_PROFILE) return '';
    var tp = CONFIG.TASTE_PROFILE;
    var lines = ['معیار کلی سلیقهٔ اعلام‌شده توسط کاربر:'];
    if (tp.manifesto) lines.push('مانیفست: ' + tp.manifesto);
    if (tp.loves && tp.loves.length) {
      lines.push('علاقه‌ها:');
      tp.loves.forEach(function (x) { lines.push('  + ' + x); });
    }
    if (tp.hates && tp.hates.length) {
      lines.push('بیزاری‌ها:');
      tp.hates.forEach(function (x) { lines.push('  - ' + x); });
    }
    return lines.join('\n');
  }

  /** تحلیل عمیق سلیقه */
  function buildTasteAnalysisMessages() {
    var data = collectUserData();
    if (data.rated.length < 3) {
      throw new Error('حداقل ۳ عنوان امتیازداده‌شده برای تحلیل سلیقه لازم است.');
    }

    var loves = data.rated.filter(function (t) { return t.rating >= 4; });
    var mid = data.rated.filter(function (t) { return t.rating === 3; });
    var hates = data.rated.filter(function (t) { return t.rating <= 2; });

    var system = [
      'تو منتقد و تحلیل‌گر عمیق سلیقهٔ سینمایی هستی.',
      'فقط بر اساس دادهٔ کاربر حرف بزن؛ حدس بی‌پایه نزن.',
      'پاسخ را فارسی، منسجم و با Markdown بنویس.',
      'از کلی‌گویی پرهیز کن؛ به آثار مشخص و امتیاز+معنی آن‌ها ارجاع بده.'
    ].join('\n');

    var user = [
      legendBlock(),
      '',
      tasteProfileBlock(),
      '',
      '## آثار با امتیاز ۴ و ۵ (خوشایند)',
      loves.length ? loves.map(formatTitleLine).join('\n') : '(هیچ)',
      '',
      '## آثار با امتیاز ۳ (متوسط/قابل قبول)',
      mid.length ? mid.map(formatTitleLine).join('\n') : '(هیچ)',
      '',
      '## آثار با امتیاز ۱ و ۲ (ناخوشایند / پشیمانی)',
      hates.length ? hates.map(formatTitleLine).join('\n') : '(هیچ)',
      '',
      '## خواسته',
      'یک تحلیل عمیق از سلیقهٔ این بیننده بنویس که حداقل این بخش‌ها را داشته باشد:',
      '1. خلاصهٔ شخصیت سلیقه‌ای (یک پاراگراف)',
      '2. از چه چیزهایی و به‌چه دلیل خوشش می‌آید (با ارجاع به آثار ۵⭐ و ۴⭐)',
      '3. از چه چیزهایی و به‌چه دلیل خوشش نمی‌آید (با ارجاع به آثار ۱⭐ و ۲⭐)',
      '4. الگوهای تکراری (ژانر، لحن، شخصیت‌پردازی، پایان‌بندی، ریتم، جهان‌سازی، ...)',
      '5. تناقض‌ها یا نقاط خاکستری (اگر هست)',
      '6. جمع‌بندی: چه نوع اثری احتمالاً برایش «۵ ستاره» می‌شود و چه نوعی را باید رد کند'
    ].join('\n');

    return [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ];
  }

  function buildSuggestMessages(kind) {
    var data = collectUserData();
    if (data.rated.length < 3) {
      throw new Error('حداقل ۳ عنوان امتیازداده‌شده برای پیشنهاد لازم است.');
    }

    var kindFa = kind === 'movie' ? 'فیلم' : kind === 'series' ? 'سریال' : 'فیلم یا سریال';
    var system = [
      'تو متخصص پیشنهاد ' + kindFa + ' بر اساس سلیقهٔ واقعی کاربر هستی.',
      'فقط یک اثر پیشنهاد بده که در لیست دیده‌شده‌ها نباشد.',
      'پاسخ فارسی با Markdown.',
      'در انتها یک بلوک JSON با این شکل بگذار:',
      '```json',
      '{"title":"...","original_title":"...","year":2020,"type":"movie|series","reason":"..."}',
      '```'
    ].join('\n');

    var user = [
      legendBlock(),
      '',
      tasteProfileBlock(),
      '',
      '## لیست دیده‌شده با امتیاز و معنی',
      data.rated.map(formatTitleLine).join('\n'),
      '',
      'فقط یک ' + kindFa + ' پیشنهاد بده که با الگوی امتیازهای بالا هم‌خوان باشد و شبیه آثار ۱–۲ ستاره نباشد.',
      'دلیل پیشنهاد را با ارجاع به سلیقهٔ کاربر بنویس.'
    ].join('\n');

    return [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ];
  }

  async function analyzeTaste(options) {
    options = options || {};
    var messages = buildTasteAnalysisMessages();
    var full = '';
    await AI.chatStream({
      messages: messages,
      temperature: 0.55,
      signal: options.signal,
      onToken: function (t) {
        full += t;
        if (options.onToken) options.onToken(t, full);
      },
      onDone: function () {}
    });
    return full;
  }

  async function suggest(options) {
    options = options || {};
    var kind = options.kind || 'both';
    var messages = buildSuggestMessages(kind);
    var full = '';
    await AI.chatStream({
      messages: messages,
      temperature: 0.6,
      signal: options.signal,
      onToken: function (t) {
        full += t;
        if (options.onToken) options.onToken(t, full);
      },
      onDone: function () {}
    });
    return full;
  }

  return {
    STAR_MEANINGS: STAR_MEANINGS,
    starMeaning: starMeaning,
    collectUserData: collectUserData,
    analyzeTaste: analyzeTaste,
    suggest: suggest
  };
})();
