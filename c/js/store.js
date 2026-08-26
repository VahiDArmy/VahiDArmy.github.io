// =============================================================
// لایهٔ ذخیره‌سازی تفسیرها و نظرات — نسخهٔ متصل به Supabase
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

  // پیشرفت بر اساس «نشانک خواندن» محاسبه می‌شود، نه تعداد تفسیرها —
  // چون طبیعی است خیلی از آیات هیچ‌وقت تفسیری از شما نگیرند.
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

  // اگر آیهٔ داده‌شده جلوتر از نشانک فعلی باشد، نشانک را جلو می‌برد.
  // اگر عقب‌تر باشد (مثلاً برگشتید عقب برای مرور)، نشانک دست‌نخورده می‌ماند.
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

  // پایان دور فعلی به‌صورت دستی + بازنشانی نشانک برای دور جدید
  async function endRound() {
    const round = await getCurrentRound();
    const { error } = await sb
      .from('site_meta')
      .update({ current_round: round + 1, bookmark_surah: 1, bookmark_ayah: 1 })
      .eq('id', 1);
    if (error) throw error;
    return round + 1;
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
    getCurrentRound,
    getSiteMeta,
    getProgress,
    advanceBookmarkIfAhead,
    endRound,
  };
})();
