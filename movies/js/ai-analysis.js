/* =========================================================
   تحلیل سلیقه و پیشنهاد تک‌اثر
   پرامپت در فرانت (AIPrompts) — اجرا روی Edge/Gemini
   ========================================================= */
window.AIAnalysis = (function () {

  function collectUserData() {
    const all = DB.getAllTitles();
    const rated = all.filter(function (t) { return (t.rating || 0) > 0; });
    const titlesForAI = rated.map(function (t) {
      return {
        title: t.title,
        type: t.type,
        year: t.year,
        rating: t.rating,
        reason: (t.reason || '').trim(),
        notes: (t.notes || '').trim()
      };
    });
    return { all: all, rated: titlesForAI };
  }

  function buildSuggestMessages(kind) {
    const data = collectUserData();
    if (data.rated.length < 3) {
      throw new Error('حداقل ۳ عنوان امتیازداده‌شده برای تحلیل لازم است.');
    }

    // Prefer existing prompt builders from AIPrompts if present
    var system = 'تو متخصص پیشنهاد فیلم و سریال هستی. بر اساس سلیقه کاربر فقط یک اثر پیشنهاد بده. پاسخ را فارسی و با Markdown بنویس.';
    var userParts = [];

    if (window.AIPrompts) {
      if (typeof AIPrompts.tasteCriteria === 'string') {
        system += '\n\nمعیار سلیقه:\n' + AIPrompts.tasteCriteria;
      } else if (typeof AIPrompts.tasteSystem === 'function') {
        system = AIPrompts.tasteSystem();
      }
      if (typeof AIPrompts.buildSuggestUser === 'function') {
        userParts.push(AIPrompts.buildSuggestUser(data.rated, kind));
      }
    }

    if (!userParts.length) {
      var lines = data.rated.map(function (t) {
        return '- ' + t.title +
          (t.year ? ' (' + t.year + ')' : '') +
          ' [' + (t.type || '') + '] ★' + t.rating +
          (t.reason ? ' | دلیل: ' + t.reason : '') +
          (t.notes ? ' | یادداشت: ' + t.notes : '');
      });
      var kindFa = kind === 'movie' ? 'فیلم' : kind === 'series' ? 'سریال' : 'فیلم یا سریال';
      userParts.push(
        'آثاری که دیده‌ام و امتیاز داده‌ام:\n' + lines.join('\n') +
        '\n\nفقط یک ' + kindFa + ' پیشنهاد بده که در لیست بالا نباشد.\n' +
        'در انتهای پاسخ یک بلوک JSON با این شکل بگذار:\n' +
        '```json\n{"title":"...","original_title":"...","year":2020,"type":"movie|series","reason":"..."}\n```'
      );
    }

    return [
      { role: 'system', content: system },
      { role: 'user', content: userParts.join('\n\n') }
    ];
  }

  async function suggest(options) {
    options = options || {};
    const kind = options.kind || 'both';
    const messages = buildSuggestMessages(kind);
    const text = await AI.chat({
      messages: messages,
      temperature: 0.6,
      signal: options.signal
    });
    return text || '';
  }

  return {
    suggest: suggest,
    collectUserData: collectUserData
  };
})();
