/* =========================================================
   تسک استانداردسازی + تحلیل داستانی + تحلیل عمیق فصل‌به‌فصل
   ========================================================= */
window.AIStandardize = (function () {

  /* ---- تحلیل کامل یک عنوان ---- */
  async function analyzeOne(title, category, options) {
    options = options || {};
    const type = options.type;
    const year = options.year;
    const onToken = options.onToken;
    const signal = options.signal;

    const messages = [
      { role: 'system', content: AIPrompts.analyzeSystem },
      { role: 'user', content: AIPrompts.analyzeUser(title, category, type, year) }
    ];

    let full = '';
    await AI.chatStream({
      messages: messages,
      temperature: 0.3,
      signal: signal,
      onToken: function (delta, acc) {
        full = acc;
        if (onToken) onToken(delta, acc);
      }
    });

    const parsed = AI.parseJSONResponse(full);
    if (!parsed) throw new Error('پاسخ AI قابل تفسیر نبود.');
    return parsed;
  }

  /* ---- تحلیل عمیق یک بازه‌ی فصلی ---- */
  async function analyzeSeasonRange(title, fromSeason, toSeason, options) {
    options = options || {};
    const type = options.type;
    const year = options.year;
    const onToken = options.onToken;
    const signal = options.signal;

    const messages = [
      { role: 'system', content: AIPrompts.analyzeSystem },
      { role: 'user', content: AIPrompts.analyzeDeepUser(title, fromSeason, toSeason, type, year) }
    ];

    let full = '';
    await AI.chatStream({
      messages: messages,
      temperature: 0.3,
      signal: signal,
      onToken: function (delta, acc) {
        full = acc;
        if (onToken) onToken(delta, acc);
      }
    });

    const parsed = AI.parseJSONResponse(full);
    if (!parsed) throw new Error('پاسخ AI قابل تفسیر نبود.');
    return parsed;
  }

  /* ---- تحلیل عمیق فصل‌به‌فصل ---- */
  async function analyzeSeasonalDeep(title, seasonsCount, options) {
    options = options || {};
    const type = options.type;
    const year = options.year;
    const onProgress = options.onProgress;
    const signal = options.signal;

    if (!seasonsCount || seasonsCount < 1) {
      throw new Error('تعداد فصل‌ها مشخص نیست.');
    }

    const CHUNK_SIZE = 3;
    const chunks = [];
    for (let start = 1; start <= seasonsCount; start += CHUNK_SIZE) {
      const end = Math.min(start + CHUNK_SIZE - 1, seasonsCount);
      chunks.push({ from: start, to: end });
    }

    const allPlotHoles = [];
    const allAssumedStupidity = [];

    for (let i = 0; i < chunks.length; i++) {
      if (signal && signal.aborted) break;
      const c = chunks[i];

      if (onProgress) onProgress({
        current: i + 1,
        total: chunks.length,
        fromSeason: c.from,
        toSeason: c.to,
        phase: 'start'
      });

      try {
        const res = await analyzeSeasonRange(title, c.from, c.to, {
          type: type,
          year: year,
          signal: signal
        });

        if (Array.isArray(res.plot_holes)) {
          res.plot_holes.forEach(function (x) {
            allPlotHoles.push(Object.assign({}, x, { _seasons: c.from + '-' + c.to }));
          });
        }
        if (Array.isArray(res.assumed_stupidity)) {
          res.assumed_stupidity.forEach(function (x) {
            allAssumedStupidity.push(Object.assign({}, x, { _seasons: c.from + '-' + c.to }));
          });
        }

        if (onProgress) onProgress({
          current: i + 1,
          total: chunks.length,
          fromSeason: c.from,
          toSeason: c.to,
          phase: 'done',
          partial: {
            plot_holes: res.plot_holes || [],
            assumed_stupidity: res.assumed_stupidity || []
          }
        });
      } catch (e) {
        if (onProgress) onProgress({
          current: i + 1,
          total: chunks.length,
          fromSeason: c.from,
          toSeason: c.to,
          phase: 'error',
          error: e.message
        });
      }
    }

    const severityOrder = { 'بحرانی': 0, 'جدی': 1, 'متوسط': 2, 'کم': 3 };
    const sortBySeverity = function (arr) {
      return arr.slice().sort(function (a, b) {
        const va = severityOrder[a.severity];
        const vb = severityOrder[b.severity];
        return (va == null ? 99 : va) - (vb == null ? 99 : vb);
      });
    };

    return {
      plot_holes: sortBySeverity(allPlotHoles),
      assumed_stupidity: sortBySeverity(allAssumedStupidity),
      totalChunks: chunks.length
    };
  }

  /* ---- استانداردسازی دسته‌ای ---- */
  async function standardizeBatch(titles, options) {
    options = options || {};
    const onProgress = options.onProgress;
    const signal = options.signal;

    const BATCH_SIZE = 5;
    const results = [];
    const total = titles.length;

    for (let i = 0; i < total; i += BATCH_SIZE) {
      if (signal && signal.aborted) break;
      const batch = titles.slice(i, i + BATCH_SIZE);
      const messages = [
        { role: 'system', content: AIPrompts.standardizeBatchSystem },
        { role: 'user', content: AIPrompts.standardizeBatchUser(batch.map(function (t) { return t.title; })) }
      ];

      let raw = '';
      try {
        raw = await AI.chatJSON({ messages: messages, temperature: 0.2, signal: signal });
      } catch (e) {
        batch.forEach(function (t) {
          results.push({ original: t.title, _error: e.message });
        });
        if (onProgress) onProgress({ done: Math.min(i + batch.length, total), total: total, results: results });
        continue;
      }

      const parsed = AI.parseJSONResponse(raw);
      const arr = Array.isArray(parsed) ? parsed : (parsed && parsed.items) || [];

      batch.forEach(function (t, idx) {
        const found = arr.find(function (a) { return a.original === t.title; }) || arr[idx];
        if (found) {
          found._id = t.id;
          results.push(found);
        } else {
          results.push({ original: t.title, _id: t.id, _error: 'بدون نتیجه' });
        }
      });

      if (onProgress) onProgress({ done: Math.min(i + batch.length, total), total: total, results: results });
    }

    return results;
  }

  /* ---- info مدل فعلی برای ذخیره ---- */
  function currentModelInfo() {
    try {
      if (typeof AI.getLastUsedModel !== 'function') return null;
      const info = AI.getLastUsedModel();
      if (!info) return null;
      return {
        id: info.id,
        label: info.label,
        vendor: info.vendor || '',
        meta: info.meta ? {
          size: info.meta.size || null,
          context: info.meta.context || null,
          speed: info.meta.speed || null
        } : null,
        at: info.at || new Date().toISOString()
      };
    } catch (e) {
      return null;
    }
  }

  /* ---- اعمال روی دیتابیس ----
     نکته‌ی مهم: فیلد year فقط از current.year (خود کاربر) گرفته می‌شود.
     اگر کاربر سالی وارد نکرده باشد، year همچنان null می‌ماند و
     ما year_start که AI برگردانده را نادیده می‌گیریم. */
  function applyToDb(id, ai) {
    if (!id || !ai) return;
    const current = DB.getTitle(id);
    if (!current) return;

    const existing = current.story_analysis || null;
    const modelInfo = currentModelInfo();

    const newStoryData = {
      strengths: ai.strengths || (existing && existing.strengths) || [],
      weaknesses: ai.weaknesses || (existing && existing.weaknesses) || [],
      plot_holes: ai.plot_holes || (existing && existing.plot_holes) || [],
      assumed_stupidity: ai.assumed_stupidity || (existing && existing.assumed_stupidity) || [],
      earned_outcomes: ai.earned_outcomes || (existing && existing.earned_outcomes) || [],
      forced_outcomes: ai.forced_outcomes || (existing && existing.forced_outcomes) || [],
      ai_model: modelInfo || (existing && existing.ai_model) || null,
      analyzed_at: new Date().toISOString()
    };

    let storyJson = '';
    try {
      storyJson = JSON.stringify(newStoryData);
    } catch (e) {
      console.warn('[applyToDb] story JSON error:', e);
    }

    const patch = {
      title: current.title,
      category: current.category,
      type: normalizeType(ai.type) || current.type,
      genre: ai.genre || current.genre,
      /* ---- year فقط از کاربر، نه از AI ---- */
      year: current.year,
      rating: current.rating,
      favorite: current.favorite,
      notes: current.notes,
      watched_date: current.watched_date,
      summary: ai.summary || current.summary || '',
      original_title: ai.standard_title || current.original_title || '',
      seasons: ai.seasons != null ? ai.seasons : current.seasons,
      episodes: ai.episodes != null ? ai.episodes : current.episodes,
      episodes_per_season: ai.episodes_per_season != null ? ai.episodes_per_season : current.episodes_per_season,
      country: ai.country || current.country || '',
      language: ai.language || current.language || '',
      status: ai.status || current.status || '',
      reason: ai.reason || current.reason || '',
      story_analysis: storyJson,
      ai_standardized_at: new Date().toISOString()
    };

    DB.updateTitle(id, patch, false);
    DB.logActivity('ai_analyze', 'title', id, current.title);
  }

  /* ---- اعمال نتایج deep روی دیتابیس ---- */
  function applyDeepToDb(id, deepResult) {
    if (!id || !deepResult) return;
    const current = DB.getTitle(id);
    if (!current) return;

    const existing = current.story_analysis || {};
    const modelInfo = currentModelInfo();

    const merged = Object.assign({}, existing, {
      plot_holes: deepResult.plot_holes || existing.plot_holes || [],
      assumed_stupidity: deepResult.assumed_stupidity || existing.assumed_stupidity || [],
      ai_model: modelInfo || existing.ai_model || null,
      deep_analyzed_at: new Date().toISOString()
    });

    DB.updateTitle(id, Object.assign({}, current, {
      story_analysis: JSON.stringify(merged)
    }), false);
    DB.logActivity('ai_deep_analyze', 'title', id, current.title);
  }

  function normalizeType(t) {
    if (!t) return null;
    const s = String(t).toLowerCase();
    if (s.indexOf('seri') > -1 || s === 'tv') return 'series';
    if (s.indexOf('movie') > -1 || s.indexOf('film') > -1) return 'movie';
    if (s.indexOf('anime') > -1) return 'anime';
    if (s.indexOf('doc') > -1) return 'documentary';
    return 'series';
  }

  return {
    analyzeOne: analyzeOne,
    analyzeSeasonRange: analyzeSeasonRange,
    analyzeSeasonalDeep: analyzeSeasonalDeep,
    standardizeBatch: standardizeBatch,
    applyToDb: applyToDb,
    applyDeepToDb: applyDeepToDb
  };
})();