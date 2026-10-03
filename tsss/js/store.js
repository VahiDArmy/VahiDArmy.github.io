// =============================================================
// لایهٔ ذخیره‌سازی تفسیرها، نظرات، نسل‌های AI و فیدبک
// =============================================================
const Store = (function () {
  async function getLatestTafsir() {
    const { data, error } = await sb
      .from('tafsirs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function getTafsirsForAyah(surah, ayah) {
    const { data, error } = await sb
      .from('tafsirs')
      .select('*')
      .eq('surah', surah)
      .eq('ayah', ayah)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async function addTafsir({ surah, ayah, content, tags }) {
    const round = await getCurrentRound();
    const { data, error } = await sb
      .from('tafsirs')
      .insert({ surah, ayah, round_number: round, content, tags: tags || [] })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function updateTafsir(id, content, tags) {
    const { data, error } = await sb
      .from('tafsirs')
      .update({ content, tags: tags || [] })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function deleteTafsir(id) {
    const { error } = await sb.from('tafsirs').delete().eq('id', id);
    if (error) throw error;
  }

  async function getComments(tafsirId) {
    const { data, error } = await sb
      .from('comments')
      .select('*')
      .eq('tafsir_id', tafsirId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  }

  async function addComment({ tafsirId, guestName, content }) {
    const { data, error } = await sb
      .from('comments')
      .insert({ tafsir_id: tafsirId, guest_name: guestName, content })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function deleteComment(id) {
    const { error } = await sb.from('comments').delete().eq('id', id);
    if (error) throw error;
  }

  async function getAllTags() {
    const { data, error } = await sb.from('tafsirs').select('tags');
    if (error) throw error;
    const freq = new Map();
    for (const row of data) {
      for (const tag of row.tags || []) {
        freq.set(tag, (freq.get(tag) || 0) + 1);
      }
    }
    return Array.from(freq.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }

  async function getTafsirsByTag(tag) {
    const { data, error } = await sb
      .from('tafsirs')
      .select('*')
      .contains('tags', [tag])
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async function syncAyahLinks(tafsirId, fromSurah, fromAyah, links) {
    const { error: delErr } = await sb.from('ayah_links').delete().eq('tafsir_id', tafsirId);
    if (delErr) throw delErr;
    if (!links.length) return;
    const rows = links.map((l) => ({
      tafsir_id: tafsirId,
      from_surah: fromSurah,
      from_ayah: fromAyah,
      to_surah: l.surah,
      to_ayah: l.ayah,
      excerpt: l.excerpt,
    }));
    const { error } = await sb.from('ayah_links').insert(rows);
    if (error) throw error;
  }

  async function getAllLinks() {
    const { data, error } = await sb.from('ayah_links').select('*');
    if (error) throw error;
    return data;
  }

  async function isMarked(surah, ayah) {
    const { data, error } = await sb
      .from('marked_ayahs')
      .select('surah')
      .eq('surah', surah)
      .eq('ayah', ayah)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  }

  async function toggleMark(surah, ayah, mark) {
    if (mark) {
      const { error } = await sb.from('marked_ayahs').insert({ surah, ayah });
      if (error) throw error;
    } else {
      const { error } = await sb.from('marked_ayahs').delete().eq('surah', surah).eq('ayah', ayah);
      if (error) throw error;
    }
  }

  async function searchTafsirs(query) {
    const { data, error } = await sb
      .from('tafsirs')
      .select('*')
      .ilike('content', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  }

  async function getCurrentRound() {
    const { data, error } = await sb.from('site_meta').select('current_round').eq('id', 1).single();
    if (error) throw error;
    return data.current_round;
  }

  async function getSiteMeta() {
    const { data, error } = await sb
      .from('site_meta')
      .select('current_round, bookmark_surah, bookmark_ayah')
      .eq('id', 1)
      .single();
    if (error) throw error;
    return data;
  }

  async function getProgress() {
    const meta = await getSiteMeta();
    const readIndex = await QuranData.cumulativeIndex(meta.bookmark_surah, meta.bookmark_ayah);

    const { count, error } = await sb
      .from('tafsirs')
      .select('*', { count: 'exact', head: true })
      .eq('round_number', meta.current_round);
    if (error) throw error;

    return {
      round: meta.current_round,
      bookmarkSurah: meta.bookmark_surah,
      bookmarkAyah: meta.bookmark_ayah,
      readIndex,
      tafsirCount: count || 0,
      total: QuranData.TOTAL_AYAHS,
      percent: (readIndex / QuranData.TOTAL_AYAHS) * 100,
    };
  }

  async function advanceBookmarkIfAhead(surah, ayah) {
    const meta = await getSiteMeta();
    const newIndex = await QuranData.cumulativeIndex(surah, ayah);
    const currentIndex = await QuranData.cumulativeIndex(meta.bookmark_surah, meta.bookmark_ayah);
    if (newIndex <= currentIndex) return false;
    const { error } = await sb
      .from('site_meta')
      .update({ bookmark_surah: surah, bookmark_ayah: ayah })
      .eq('id', 1);
    if (error) throw error;
    return true;
  }

  async function endRound() {
    const round = await getCurrentRound();
    const { error } = await sb
      .from('site_meta')
      .update({ current_round: round + 1, bookmark_surah: 1, bookmark_ayah: 1 })
      .eq('id', 1);
    if (error) throw error;
    return round + 1;
  }

  // ---------- AI Review (بدون تغییر منطق قبلی) ----------
  async function getAiReview(tafsirId) {
    const { data, error } = await sb
      .from('ai_reviews')
      .select('*')
      .eq('tafsir_id', tafsirId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function saveAiReview(tafsirId, content) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user?.id) {
      throw new Error('برای ثبت بررسی هوشمند باید وارد حساب شوید');
    }

    const existing = await getAiReview(tafsirId);
    if (existing) {
      const { data, error } = await sb
        .from('ai_reviews')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await sb
      .from('ai_reviews')
      .insert({
        tafsir_id: tafsirId,
        content,
        user_id: session.user.id,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function deleteAiReview(tafsirId) {
    const { error } = await sb.from('ai_reviews').delete().eq('tafsir_id', tafsirId);
    if (error) throw error;
  }

  async function callAiReview({ surah, ayah, ayahText, userOpinion }) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.access_token) {
      throw new Error('برای بررسی هوشمند باید وارد حساب شوید');
    }

    const fn = localStorage.getItem('ai_fn')
      || CONFIG.AI_FUNCTION_DEFAULT
      || 'ai-review';

    const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ surah, ayah, ayahText, userOpinion }),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'خطا در دریافت پاسخ هوشمند');

    return {
      content: json.content,
      model: json.model || null,
    };
  }

  // ---------- Ask AI ----------
  async function saveAskAi({ surah, ayah, model, question, answerRaw }) {
    const { data, error } = await sb
      .from('ask_ai')
      .insert({ surah, ayah, model, question, answer_raw: answerRaw })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function getAskAiHistory(surah, ayah, limit = 20) {
    const { data, error } = await sb
      .from('ask_ai')
      .select('*')
      .eq('surah', surah)
      .eq('ayah', ayah)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  async function deleteAskAi(id) {
    // حذف نسل‌ها و فیدبک‌های مربوط به این پاسخ
    const { data: gens, error: gErr } = await sb
      .from('ai_generations')
      .select('id')
      .eq('source', 'ask_ai')
      .eq('ref_id', id);
    if (gErr) throw gErr;
    const ids = (gens || []).map((g) => g.id);
    if (ids.length) {
      await sb.from('ai_feedback').delete().in('generation_id', ids);
      await sb.from('ai_generations').delete().in('id', ids);
    }
    const { error } = await sb.from('ask_ai').delete().eq('id', id);
    if (error) throw error;
  }

  async function updateAskAiRaw(id, answerRaw) {
    const { error } = await sb
      .from('ask_ai')
      .update({ answer_raw: answerRaw })
      .eq('id', id);
    if (error) throw error;
  }

  // ---------- AI generations & feedback ----------
  async function createGeneration({ source, refId, model }) {
    const { data, error } = await sb
      .from('ai_generations')
      .insert({ source, ref_id: refId, model })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function getLatestGeneration(source, refId) {
    const { data, error } = await sb
      .from('ai_generations')
      .select('id, model, created_at')
      .eq('source', source)
      .eq('ref_id', refId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function getGenerationFeedback(generationId) {
    const { data, error } = await sb
      .from('ai_feedback')
      .select('vote')
      .eq('generation_id', generationId);
    if (error) throw error;
    const votes = data || [];
    const up = votes.filter((v) => v.vote === 1).length;
    const down = votes.filter((v) => v.vote === -1).length;
    return { up, down, score: up - down, total: up + down };
  }

  async function getMyFeedback(generationId) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user?.id) return 0;
    const { data, error } = await sb
      .from('ai_feedback')
      .select('vote')
      .eq('generation_id', generationId)
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (error) throw error;
    return data ? data.vote : 0;
  }

  async function setFeedback(generationId, vote) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user?.id) throw new Error('برای ثبت رأی باید وارد حساب شوید');
    const userId = session.user.id;

    if (vote === 0) {
      const { error } = await sb
        .from('ai_feedback')
        .delete()
        .eq('generation_id', generationId)
        .eq('user_id', userId);
      if (error) throw error;
      return;
    }

    const { error } = await sb
      .from('ai_feedback')
      .upsert(
        {
          generation_id: generationId,
          user_id: userId,
          vote,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,generation_id' }
      );
    if (error) throw error;
  }

  async function getModelScores() {
    const { data, error } = await sb.from('model_scores').select('*');
    if (error) throw error;
    const map = new Map();
    for (const row of data || []) map.set(row.model, row);
    return map;
  }

  return {
    getLatestTafsir,
    getTafsirsForAyah,
    addTafsir,
    updateTafsir,
    deleteTafsir,
    getComments,
    addComment,
    deleteComment,
    getAllTags,
    getTafsirsByTag,
    isMarked,
    toggleMark,
    syncAyahLinks,
    getAllLinks,
    searchTafsirs,
    getCurrentRound,
    getSiteMeta,
    getProgress,
    advanceBookmarkIfAhead,
    endRound,
    getAiReview,
    saveAiReview,
    deleteAiReview,
    callAiReview,
    saveAskAi,
    getAskAiHistory,
    deleteAskAi,
    updateAskAiRaw,
    createGeneration,
    getLatestGeneration,
    getGenerationFeedback,
    getMyFeedback,
    setFeedback,
    getModelScores,
  };
})();