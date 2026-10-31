/* =========================================================
   تحلیل سلیقه + پیشنهاد تک‌اثر
   پرامپت در فرانت — اجرا روی Edge/Gemini (استریم)
   ========================================================= */
window.AIAnalysis = (function () {

  /** معنی رسمی ستاره‌ها برای ارسال به AI */
  var STAR_MEANINGS = {
    5: 'عالی بود به قدری که بیش از یک بار خواهم دید',
    4: 'خوب بود و راضی‌ام که تماشا کردم',
    3: 'عادی',
    2: 'افتضاح؛ کاش تماشا نمی‌کردم، اگر به گذشته برگردم وقتم رو تلف نمیکنم',
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
    /* فقط امتیازدار؛ خواهم‌دید بدون امتیاز وارد تحلیل نمی‌شود */
    var rated = all.filter(function (t) {
      if ((Number(t.rating) || 0) <= 0) return false;
      if (String(t.status || '') === 'will_watch') return false;
      return true;
    });
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
      '۴⭐ = خوب بود و راضی‌ام که تماشا کردم',
      '۳⭐ = عادی',
      '۲⭐ = افتضاح؛ کاش تماشا نمی‌کردم، اگر به گذشته برگردم وقتم رو تلف نمیکنم',
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

  /**
   * پرامپت تحلیل سلیقه/شخصیت
   * kind: 'movie' | 'series' — قبل از ارسال مشخص می‌شود
   */
  function buildTasteAnalysisMessages(kind) {
    kind = kind === 'series' ? 'series' : 'movie';
    var kindFa = kind === 'series' ? 'سریال' : 'فیلم';

    var data = collectUserData();
    if (data.rated.length < 3) {
      throw new Error('حداقل ۳ عنوان امتیازداده‌شده برای تحلیل سلیقه لازم است.');
    }

    var lines = data.rated.map(function (t) {
      var name = (t.title || '').trim();
      if (t.original_title && String(t.original_title).trim()
          && String(t.original_title).trim() !== name) {
        name = name + ' / ' + String(t.original_title).trim();
      }
      return '- ' + name
        + (t.year ? ' | سال ' + t.year : '')
        + ' | امتیاز ' + t.rating;
    });

    var system = [
      'تو تحلیل‌گر ارشد سلیقه، شخصیت و روان‌شناسی تماشای سینمایی هستی.',
      'فقط از دادهٔ داده‌شده استفاده کن؛ حدس بی‌پایه نزن.',
      'پاسخ را فارسی با Markdown بنویس.',
      'تحلیل باید همه‌جانبه، طولانی، مفصل و عمیق باشد — از خلاصه‌نویسی و کوتاه‌کردن خودداری کن.'
    ].join('\n');

    var user = [
      'منطق امتیازبندی کاربر:',
      '۵ = عالی بود؛ بیش از یک بار خواهم دید',
      '۴ = خوب بود و راضی‌ام که تماشا کردم',
      '۳ = عادی',
      '۲ = افتضاح؛ کاش تماشا نمی‌کردم، اگر به گذشته برگردم وقتم رو تلف نمیکنم',
      '۱ = افتضاح؛ از تماشا عصبانی‌ام',
      '',
      'فهرست آثار امتیازداده‌شده (عنوان صحیح | سال ساخت | امتیاز):',
      lines.join('\n'),
      '',
      'درخواست:',
      'بر اساس منطق امتیازها و فهرست بالا، سلیقه و شخصیت این بیننده را به‌صورت همه‌جانبه، طولانی، مفصل و عمیق تحلیل کن.',
      'نوع شخصیت MBTI احتمالی را هم با دلیل (بر اساس الگوی امتیازها و انتخاب آثار) مشخص کن.',
      'در پایان دقیقاً یک ' + kindFa + ' پیشنهاد بده که با این سلیقه هم‌خوان باشد و در فهرست بالا نباشد.',
      'دلیل پیشنهاد را مفصل بنویس.',
      '',
      'در انتهای پاسخ فقط این JSON را بگذار:',
      '```json',
      '{"title":"...","original_title":"...","year":2020,"type":"' + kind + '","reason":"...","mbti":"XXXX"}',
      '```'
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
    var kind = options.kind === 'series' ? 'series' : 'movie';
    var messages = options.messages || buildTasteAnalysisMessages(kind);
    var full = '';
    await AI.chatStream({
      messages: messages,
      temperature: 0.55,
      max_tokens: options.max_tokens != null ? options.max_tokens : 8192,
      signal: options.signal,
      onToken: function (t) {
        full += t;
        if (options.onToken) options.onToken(t, full);
      },
      onDone: function () {}
    });
    return full;
  }

  function parsePreviewToMessages(text) {
    text = String(text || '').trim();
    if (!text) return null;
    var parts = text.split(/===== (SYSTEM|USER|ASSISTANT) =====/i);
    if (parts.length >= 3) {
      var messages = [];
      for (var i = 1; i + 1 < parts.length; i += 2) {
        var role = String(parts[i] || '').toLowerCase();
        var content = String(parts[i + 1] || '').replace(/^\n+/, '').replace(/\n+$/, '');
        if (role === 'system' || role === 'user' || role === 'assistant') {
          messages.push({ role: role, content: content });
        }
      }
      if (messages.length) return messages;
    }
    /* fallback: whole text as user */
    return [{ role: 'user', content: text }];
  }

  function formatMessagesForPreview(messages) {
    return (messages || []).map(function (m) {
      return '===== ' + (m.role || '').toUpperCase() + ' =====\n' + (m.content || '');
    }).join('\n\n');
  }

  function parseSuggestion(text, kind) {
    kind = kind === 'series' ? 'series' : 'movie';
    text = String(text || '');
    var m = text.match(/\{[\s\S]*?"title"\s*:\s*"[^"]+"[\s\S]*?\}/);
    if (m) {
      try {
        var j = JSON.parse(m[0]);
        return {
          title: j.title || '',
          original_title: j.original_title || j.originalTitle || '',
          year: j.year || null,
          type: j.type === 'series' || j.type === 'movie' ? j.type : kind,
          reason: j.reason || j.why || ''
        };
      } catch (e) {}
    }
    var title = '';
    var ym = text.match(/\*\*([^*]{2,80})\*\*/);
    if (ym) title = ym[1].trim();
    if (!title) {
      var hm = text.match(/^#+\s+(.+)$/m);
      if (hm) title = hm[1].trim();
    }
    var year = null;
    var ymatch = text.match(/\b(19|20)\d{2}\b/);
    if (ymatch) year = Number(ymatch[0]);
    return { title: title, original_title: '', year: year, type: kind, reason: '' };
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

  function isTasteAnalysis(c) {
    var tags = String(c && c.tags || '');
    return tags.indexOf('taste_analysis') >= 0 || tags.indexOf('personality') >= 0;
  }

  function isPinnedAnalysis(c) {
    return String(c && c.tags || '').indexOf('pinned') >= 0;
  }

  function tagList(tags) {
    return String(tags || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean);
  }

  function withTag(tags, tag) {
    var arr = tagList(tags);
    if (arr.indexOf(tag) < 0) arr.push(tag);
    return arr.join(',');
  }

  function withoutTag(tags, tag) {
    return tagList(tags).filter(function (t) { return t !== tag; }).join(',');
  }

  /**
   * سنجاق‌شده‌ها همیشه + تا limit تا از غیرسنجاق‌شده‌های اخیر
   */
  function getLatestTasteAnalyses(limit) {
    limit = limit || 5;
    try {
      var all = (DB.getAllConversations() || [])
        .filter(isTasteAnalysis)
        .sort(function (a, b) {
          return String(b.created_at || '').localeCompare(String(a.created_at || ''));
        });
      var pinned = all.filter(isPinnedAnalysis);
      var pinnedIds = {};
      pinned.forEach(function (c) { pinnedIds[c.id] = true; });
      var recent = all.filter(function (c) { return !pinnedIds[c.id]; }).slice(0, limit);
      /* pinned first (oldest pin order by date desc), then recent */
      return pinned.concat(recent);
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

  function pinTasteAnalysis(id) {
    var c = DB.getConversation(id);
    if (!c) return false;
    var tags = withTag(c.tags, 'pinned');
    DB.updateConversation(id, { tags: tags, prompt: c.prompt, response: c.response, ai_model: c.ai_model, title_context: c.title_context, title_id: c.title_id });
    return true;
  }

  function unpinTasteAnalysis(id) {
    var c = DB.getConversation(id);
    if (!c) return false;
    var tags = withoutTag(c.tags, 'pinned');
    DB.updateConversation(id, { tags: tags, prompt: c.prompt, response: c.response, ai_model: c.ai_model, title_context: c.title_context, title_id: c.title_id });
    return true;
  }

  function togglePinTasteAnalysis(id) {
    var c = DB.getConversation(id);
    if (!c) return false;
    if (isPinnedAnalysis(c)) return unpinTasteAnalysis(id);
    return pinTasteAnalysis(id);
  }

  return {
    STAR_MEANINGS: STAR_MEANINGS,
    starMeaning: starMeaning,
    collectUserData: collectUserData,
    buildSuggestMessages: buildSuggestMessages,
    legendBlock: legendBlock,
    analyzeTaste: analyzeTaste,
    suggest: suggest,
    parseSuggestion: parseSuggestion,
    formatMessagesForPreview: formatMessagesForPreview,
    parsePreviewToMessages: parsePreviewToMessages,
    buildTasteAnalysisMessages: buildTasteAnalysisMessages,
    getLatestTasteAnalyses: getLatestTasteAnalyses,
    saveTasteAnalysis: saveTasteAnalysis,
    isPinnedAnalysis: isPinnedAnalysis,
    pinTasteAnalysis: pinTasteAnalysis,
    unpinTasteAnalysis: unpinTasteAnalysis,
    togglePinTasteAnalysis: togglePinTasteAnalysis
  };
})();
