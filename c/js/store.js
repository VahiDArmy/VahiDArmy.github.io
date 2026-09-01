  // ---- دریافت کامنت‌ها با صفحه‌بندی (همراه اطلاعات سوره و آیه) ----
  async function getCommentsPaginated(limit = 10, offset = 0) {
    const { data, error } = await sb
      .from('comments')
      .select(`
        *,
        tafsirs (
          surah,
          ayah
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return data.map((c) => ({
      id: c.id,
      tafsir_id: c.tafsir_id,
      guest_name: c.guest_name,
      content: c.content,
      created_at: c.created_at,
      surah: c.tafsirs ? c.tafsirs.surah : null,
      ayah: c.tafsirs ? c.tafsirs.ayah : null,
    }));
  }

  // ---- دریافت تعداد کل کامنت‌ها (برای صفحه‌بندی) ----
  async function getCommentsCount() {
    const { count, error } = await sb
      .from('comments')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    return count;
  }