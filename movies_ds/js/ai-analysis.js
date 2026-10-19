/* =========================================================
   تحلیل سلیقه و پیشنهاد تک‌اثر — از طریق Supabase Edge Function
   ========================================================= */
window.AIAnalysis = (function () {

  /**
   * جمع‌آوری داده‌های لازم برای تحلیل:
   * فقط آثاری که امتیاز داده شده‌اند به همراه یادداشت‌ها و دلایل.
   */
  function collectUserData() {
    const all = DB.getAllTitles();
    const rated = all.filter(function (t) { return (t.rating || 0) > 0; });
    
    // ساخت آرایه‌ی ارسالی به Edge Function
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

  /**
   * ارسال درخواست به Supabase Edge Function
   * @param {Object} options 
   * @returns {Promise<string>} متن پاسخ
   */
  async function suggest(options) {
    options = options || {};
    const data = collectUserData();

    if (data.rated.length < 3) {
      throw new Error('حداقل ۳ عنوان امتیازداده‌شده برای تحلیل لازم است.');
    }

    const payload = {
      titles: data.rated,
      tasteCriteria: AIPrompts.tasteCriteria
    };

    const url = CONFIG.SUPABASE.URL + '/functions/v1/' + CONFIG.SUPABASE.EDGE_FUNCTION;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + CONFIG.SUPABASE.ANON_KEY
      },
      body: JSON.stringify(payload),
      signal: options.signal
    });

    if (!res.ok) {
      const txt = await res.text().catch(function () { return ''; });
      throw new Error('خطای سرور (' + res.status + '): ' + txt);
    }

    const json = await res.json();
    
    if (json.error) {
      throw new Error(json.error);
    }

    return json.text || '';
  }

  return {
    suggest: suggest,
    collectUserData: collectUserData
  };
})();