/* =========================================================
   تسک استانداردسازی با AI
   ========================================================= */
window.AIStandardize = (function () {

  /* ---- استانداردسازی یک عنوان ---- */
  async function standardizeOne(title, { onToken, signal } = {}) {
    const messages = [
      { role: 'system', content: AIPrompts.standardizeSystem },
      { role: 'user', content: AIPrompts.standardizeUser(title) }
    ];

    // استریم برای نمایش زنده
    let full = '';
    await AI.chatStream({
      messages,
      temperature: 0.2,
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
        if (found) {
          found._id = t.id;
          results.push(found);
        } else {
          results.push({ original: t.title, _id: t.id, _error: 'بدون نتیجه' });
        }
      });

      onProgress && onProgress({ done: Math.min(i + batch.length, total), total, results });
    }

    return results;
  }

  /* ---- اعمال نتیجه روی دیتابیس ---- */
  function applyToDb(id, ai) {
    if (!id || !ai) return;
    const current = DB.getTitle(id);
    if (!current) return;

    const patch = {
      title: current.title, // پیش‌فرض
      category: current.category,
      type: normalizeType(ai.type) || current.type,
      genre: ai.genre || current.genre,
      year: ai.year_start || current.year,
      rating: current.rating,
      favorite: current.favorite,
      notes: current.notes,
      watched_date: current.watched_date,
      // فیلدهای جدید AI:
      summary: ai.summary || '',
      original_title: ai.standard_title || '',
      seasons: ai.seasons || null,
      episodes: ai.episodes || null,
      episodes_per_season: ai.episodes_per_season || null,
      country: ai.country || '',
      language: ai.language || '',
      status: ai.status || '',
      ai_standardized_at: new Date().toISOString()
    };

    DB.updateTitle(id, patch, false);
    DB.logActivity('ai_standardize', 'title', id, current.title);
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

  return { standardizeOne, standardizeBatch, applyToDb };
})();