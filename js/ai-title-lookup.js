/* =========================================================
   جستجوی هوشمند عنوان با AI
   ========================================================= */
window.AITitleLookup = (function () {

  async function lookup(rawTitle, options) {
    options = options || {};
    if (!AI.isConfigured()) {
      throw new Error('کلید OpenRouter تنظیم نشده است.');
    }
    if (!rawTitle || !rawTitle.trim()) {
      throw new Error('عنوان را وارد کن.');
    }

    const messages = [
      { role: 'system', content: AIPrompts.lookupSystem },
      { role: 'user', content: AIPrompts.lookupUser(rawTitle.trim()) }
    ];

    let full = '';
    full = await AI.chatJSON({
      messages: messages,
      temperature: 0.2,
      signal: options.signal
    });

    const parsed = AI.parseJSONResponse(full);
    if (!parsed) throw new Error('پاسخ AI قابل تفسیر نبود.');

    const candidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];
    return {
      query: rawTitle,
      corrected_query: parsed.corrected_query || rawTitle,
      candidates: candidates
    };
  }

  function fillForm(form, candidate) {
    if (!form || !candidate) return;

    const setVal = function (name, value) {
      const el = form.querySelector('[name="' + name + '"]');
      if (!el) return;
      if (el.type === 'checkbox') {
        el.checked = !!value;
      } else {
        el.value = value == null ? '' : value;
      }
    };

    /* عنوان */
    if (candidate.standard_title) setVal('title', candidate.standard_title);

    /* نوع */
    if (candidate.type) {
      const typeEl = form.querySelector('[name="type"]');
      if (typeEl) {
        const opt = typeEl.querySelector('option[value="' + candidate.type + '"]');
        if (opt) typeEl.value = candidate.type;
      }
    }

    /* سال */
    if (candidate.year_start) setVal('year', candidate.year_start);

    /* ژانر */
    if (candidate.genre) setVal('genre', candidate.genre);

    /* ستاره — پیش‌فرض ۳ اگر خالی */
    const ratingEl = form.querySelector('[name="rating"]');
    if (ratingEl && !Number(ratingEl.value)) {
      ratingEl.value = '3';
      const picker = form.querySelector('.star-picker-wrap');
      if (picker && picker.__setValue) picker.__setValue(3);
    }

    /* فیلدهای پنهان — برای ذخیره */
    const setHidden = function (name, value) {
      let el = form.querySelector('[name="' + name + '"]');
      if (!el) {
        el = document.createElement('input');
        el.type = 'hidden';
        el.name = name;
        form.appendChild(el);
      }
      el.value = value == null ? '' : value;
    };

    setHidden('_ai_standard_title', candidate.standard_title || '');
    setHidden('_ai_title_fa', candidate.title_fa || '');
    setHidden('_ai_seasons', candidate.seasons || '');
    setHidden('_ai_episodes', candidate.episodes || '');
    setHidden('_ai_episodes_per_season', candidate.episodes_per_season || '');
    setHidden('_ai_country', candidate.country || '');
    setHidden('_ai_language', candidate.language || '');
    setHidden('_ai_status', candidate.status || '');
    setHidden('_ai_summary', candidate.summary || '');
    setHidden('_ai_creators', candidate.creators || '');
    setHidden('_ai_main_cast', candidate.main_cast || '');
    setHidden('_ai_year_end', candidate.year_end || '');
  }

  return {
    lookup: lookup,
    fillForm: fillForm
  };
})();