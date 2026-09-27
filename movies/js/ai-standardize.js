/* =========================================================
   تسک استانداردسازی + تحلیل داستانی
   ========================================================= */
window.AIStandardize = (function () {

  /* ---- استانداردسازی + تحلیل یک عنوان ---- */
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

  /* ---- استانداردسازی دسته‌ای (سریع، بدون تحلیل) ---- */
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

    // تحلیل داستان را به‌صورت JSON ذخیره کن
    let storyJson = '';
    if (ai.story_analysis && typeof ai.story_analysis === 'object') {
      storyJson = JSON.stringify({
        ...ai.story_analysis,
        consistency_score: ai.consistency_score ?? null,
        respects_intelligence: ai.respects_intelligence ?? null
      });
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
      story_analysis: storyJson || current.story_analysis ? (storyJson || JSON.stringify(current.story_analysis)) : '',
      ai_standardized_at: new Date().toISOString()
    };

    // اگر story_analysis قبلی داشتیم و AI جدید نداده، قبلی را نگه‌دار
    if (!storyJson && current.story_analysis) {
      patch.story_analysis = JSON.stringify(current.story_analysis);
    }

    DB.updateTitle(id, patch, false);
    DB.logActivity('ai_analyze', 'title', id, current.title);
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

  return { analyzeOne, standardizeBatch, applyToDb };
})();