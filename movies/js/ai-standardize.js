/* =========================================================
   تسک استانداردسازی + تحلیل داستانی + تحلیل عمیق فصل‌به‌فصل
   ========================================================= */
window.AIStandardize = (function () {

  /* ---- تحلیل کامل یک عنوان ---- */
  async function analyzeOne(title, category, { onToken, signal } = {}) {
    const messages = [
      { role: 'system', content: AIPrompts.analyzeSystem },
      { role: 'user', content: AIPrompts.analyzeUser(title, category) }
    ];

    let full = '';
    await AI.chatStream({
      messages,
      temperature: 0.3,
      signal,
      onToken: (delta, acc) => {
        full = acc;
        onToken && onToken(delta, acc);
      }
    });

    const parsed = AI.parseJSONResponse(full);
    if (!parsed) throw new Error('پاسخ AI قابل تفسیر نبود.');
    return parsed;
  }

  /* ---- تحلیل عمیق یک بازه‌ی فصلی ---- */
  async function analyzeSeasonRange(title, fromSeason, toSeason, { onToken, signal } = {}) {
    const messages = [
      { role: 'system', content: AIPrompts.analyzeSystem },
      { role: 'user', content: AIPrompts.analyzeDeepUser(title, fromSeason, toSeason) }
    ];

    let full = '';
    await AI.chatStream({
      messages,
      temperature: 0.3,
      signal,
      onToken: (delta, acc) => {
        full = acc;
        onToken && onToken(delta, acc);
      }
    });

    const parsed = AI.parseJSONResponse(full);
    if (!parsed) throw new Error('پاسخ AI قابل تفسیر نبود.');
    return parsed;
  }

  /* ---- تحلیل عمیق فصل‌به‌فصل ---- */
  async function analyzeSeasonalDeep(title, seasonsCount, { onProgress, signal } = {}) {
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
      if (signal?.aborted) break;
      const c = chunks[i];

      onProgress && onProgress({
        current: i + 1,
        total: chunks.length,
        fromSeason: c.from,
        toSeason: c.to,
        phase: 'start'
      });

      try {
        const res = await analyzeSeasonRange(title, c.from, c.to, { signal });

        if (Array.isArray(res.plot_holes)) {
          allPlotHoles.push(...res.plot_holes.map(x => ({ ...x, _seasons: `${c.from}-${c.to}` })));
        }
        if (Array.isArray(res.assumed_stupidity)) {
          allAssumedStupidity.push(...res.assumed_stupidity.map(x => ({ ...x, _seasons: `${c.from}-${c.to}` })));
        }

        onProgress && onProgress({
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
        onProgress && onProgress({
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
    const sortBySeverity = (arr) => arr.slice().sort((a, b) =>
      (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99)
    );

    return {
      plot_holes: sortBySeverity(allPlotHoles),
      assumed_stupidity: sortBySeverity(allAssumedStupidity),
      totalChunks: chunks.length
    };
  }

  /* ---- استانداردسازی دسته‌ای ---- */
  async function standardizeBatch(titles, { onProgress, signal } = {}) {
    const BATCH_SIZE = 5;
    const results = [];
    const total = titles.length;

    for (let i = 0; i < total; i += BATCH_SIZE) {
      if (signal?.aborted) break;
      const batch = titles.slice(i, i + BATCH_SIZE);
      const messages = [
        { role: 'system', content: AIPrompts.standardizeBatchSystem },
        { role: 'user', content: AIPrompts.standardizeBatchUser(batch.map(t => t.title)) }
      ];

      let raw = '';
      try {
        raw = await AI.chatJSON({ messages, temperature: 0.2, signal });
      } catch (e) {
        batch.forEach(t => results.push({ original: t.title, _error: e.message }));
        onProgress && onProgress({ done: Math.min(i + batch.length, total), total, results });
        continue;
      }

      const parsed = AI.parseJSONResponse(raw);
      const arr = Array.isArray(parsed) ? parsed : (parsed?.items || []);
      batch.forEach((t, idx) => {
        const found = arr.find(a => a.original === t.title) || arr[idx];
        if (found) { found._id = t.id; results.push(found); }
        else results.push({ original: t.title, _id: t.id, _error: 'بدون نتیجه' });
      });

      onProgress && onProgress({ done: Math.min(i + batch.length, total), total, results });
    }

    return results;
  }

  /* ---- اعمال روی دیتابیس ---- */
  function applyToDb(id, ai) {
    if (!id || !ai) return;
    const current = DB.getTitle(id);
    if (!current) return;

    let existing = current.story_analysis || null;

    const newStoryData = {
      strengths: ai.strengths || existing?.strengths || [],
      weaknesses: ai.weaknesses || existing?.weaknesses || [],
      plot_holes: ai.plot_holes || existing?.plot_holes || [],
      assumed_stupidity: ai.assumed_stupidity || existing?.assumed_stupidity || [],
      earned_outcomes: ai.earned_outcomes || existing?.earned_outcomes || [],
      forced_outcomes: ai.forced_outcomes || existing?.forced_outcomes || []
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
      year: ai.year_start || current.year,
      rating: current.rating,
      favorite: current.favorite,
      notes: current.notes,
      watched_date: current.watched_date,
      summary: ai.summary || current.summary || '',
      original_title: ai.standard_title || current.original_title || '',
      seasons: ai.seasons ?? current.seasons,
      episodes: ai.episodes ?? current.episodes,
      episodes_per_season: ai.episodes_per_season ?? current.episodes_per_season,
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
    const merged = {
      ...existing,
      plot_holes: deepResult.plot_holes || existing.plot_holes || [],
      assumed_stupidity: deepResult.assumed_stupidity || existing.assumed_stupidity || [],
      deep_analyzed_at: new Date().toISOString()
    };

    DB.updateTitle(id, {
      ...current,
      story_analysis: JSON.stringify(merged)
    }, false);
    DB.logActivity('ai_deep_analyze', 'title', id, current.title);
  }

  function normalizeType(t) {
    if (!t) return null;
    const s = String(t).toLowerCase();
    if (s.includes('seri') || s === 'tv') return 'series';
    if (s.includes('movie') || s.includes('film')) return 'movie';
    if (s.includes('anime')) return 'anime';
    if (s.includes('doc')) return 'documentary';
    return 'series';
  }

  return {
    analyzeOne,
    analyzeSeasonRange,
    analyzeSeasonalDeep,
    standardizeBatch,
    applyToDb,
    applyDeepToDb
  };
})();