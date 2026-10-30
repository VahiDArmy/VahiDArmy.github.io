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

  function formatTitleLine(t, compact) {
    var line = '• «' + t.title + '»'
      + (t.year ? ' (' + t.year + ')' : '')
      + ' [' + (t.type || '?') + ']'
      + ' ★' + t.rating
      + (t.genre ? ' · ' + t.genre : '');
    if (!compact) {
      if (t.reason) line += '\n  دلیل: ' + String(t.reason).slice(0, 180);
      if (t.notes) line += '\n  یادداشت: ' + String(t.notes).slice(0, 120);
    } else if (t.reason) {
      line += ' — ' + String(t.reason).slice(0, 80);
    }
    return line;
  }

  function takeTop(arr, n) {
    return arr.slice(0, n);
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

    /* همهٔ امتیازدارها — عنوان صحیح + سال + نوع + امتیاز */
    var lines = data.rated.map(function (t) {
      var name = t.original_title
        ? (t.title + ' / ' + t.original_title)
        : t.title;
      return '• ' + name
        + (t.year ? ' (' + t.year + ')' : '')
        + ' — ' + (t.type === 'movie' ? 'فیلم' : t.type === 'series' ? 'سریال' : (t.type || 'عنوان'))
        + ' — امتیاز ' + t.rating + '/5';
    });

    var system = [
      'تو تحلیل‌گر سلیقه و شخصیت سینمایی هستی.',
      'فقط بر اساس دادهٔ کاربر حرف بزن؛ حدس بی‌پایه نزن.',
      'پاسخ را فارسی و با Markdown بنویس.',
      '',
      'منطق امتیازبندی کاربر (حتماً رعایت کن):',
      '۵ = عالی بود؛ به قدری که بیش از یک بار خواهم دید',
      '۴ = خوب بود و از تماشایش راضی‌ام',
      '۳ = خوب / قابل قبول',
      '۲ = افتضاح؛ اگر به گذشته برگردم هرگز تماشا نمی‌کنم',
      '۱ = افتضاح؛ از تماشایش عصبانی‌ام'
    ].join('\n');

    var user = [
      tasteProfileBlock(),
      '',
      '## فهرست آثار امتیازداده‌شده (عنوان صحیح + سال ساخت + نوع + امتیاز)',
      lines.join('\n'),
      '',
      '## درخواست',
      '۱) بر اساس همین فهرست و منطق امتیازها، سلیقه و شخصیت این بیننده را عمیق تحلیل کن.',
      '۲) در پایان، دقیقاً یک فیلم یا یک سریال پیشنهاد بده که با این سلیقه هم‌خوان باشد و در فهرست بالا نباشد.',
      '۳) دلیل پیشنهاد را کوتاه و با ارجاع به الگوهای امتیازهای بالا بنویس.'
    ].filter(Boolean).join('\n');

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

  function getLatestTasteAnalyses(limit) {
    limit = limit || 5;
    try {
      return (DB.getAllConversations() || [])
        .filter(function (c) {
          var tags = String(c.tags || '');
          return tags.indexOf('taste_analysis') >= 0 || tags.indexOf('personality') >= 0;
        })
        .sort(function (a, b) {
          return String(b.created_at || '').localeCompare(String(a.created_at || ''));
        })
        .slice(0, limit);
    } catch (e) {
      return [];
    }
  }

  function saveTasteAnalysis(prompt, response, model) {
    try {
      return DB.saveConversation({
        title_id: null,
        title_context: 'تحلیل عمیق شخصیت',
        prompt: prompt || '',
        response: response || '',
        ai_model: model || (typeof AI !== 'undefined' && AI.getModel ? AI.getModel() : ''),
        tags: 'taste_analysis,personality'
      });
    } catch (e) {
      console.error('saveTasteAnalysis', e);
      return null;
    }
  }

  return {
    STAR_MEANINGS: STAR_MEANINGS,
    starMeaning: starMeaning,
    collectUserData: collectUserData,
    buildTasteAnalysisMessages: buildTasteAnalysisMessages,
    buildSuggestMessages: buildSuggestMessages,
    legendBlock: legendBlock,
    analyzeTaste: analyzeTaste,
    suggest: suggest,
    getLatestTasteAnalyses: getLatestTasteAnalyses,
    saveTasteAnalysis: saveTasteAnalysis
  };
})();
