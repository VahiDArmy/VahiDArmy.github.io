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

  async function addTafsir({ surah, ayah, content }) {
    const round = await getCurrentRound();

    const { data, error } = await sb
      .from('tafsirs')
      .insert({ surah, ayah, round_number: round, content })
      .select()
      .single();
    if (error) throw error;

    await maybeAdvanceRound(round);
    return data;
  }

  async function updateTafsir(id, content) {
    const { data, error } = await sb
      .from('tafsirs')
      .update({ content })
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

  async function getCurrentRound() {
    const { data, error } = await sb.from('site_meta').select('current_round').eq('id', 1).single();
    if (error) throw error;
    return data.current_round;
  }

  async function getProgress() {
    const { data, error } = await sb.rpc('get_progress').single();
    if (error) throw error;
    return {
      round: data.round,
      completed: Number(data.completed),
      total: data.total,
      percent: (Number(data.completed) / data.total) * 100,
    };
  }

  // اگر دور فعلی کامل شده باشد (۶۲۳۶ آیهٔ یکتا)، دور بعدی را شروع می‌کند
  async function maybeAdvanceRound(round) {
    const progress = await getProgress();
    if (progress.round === round && progress.completed >= progress.total) {
      await sb.from('site_meta').update({ current_round: round + 1 }).eq('id', 1);
    }
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
    getCurrentRound,
    getProgress,
  };
})();
