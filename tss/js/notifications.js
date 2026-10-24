// =============================================================
// نوتیفیکیشن‌های کامنت‌های جدید (با Supabase Realtime)
// =============================================================
(function () {
  let subscription = null;
  let isListening = false;

  async function startListening() {
    if (isListening) return;
    try {
      const session = await Auth.getSession();
      if (!session) return; // فقط کاربر لاگین‌شده
      isListening = true;

      subscription = sb
        .channel('comments-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'comments',
          },
          async (payload) => {
            try {
              const newComment = payload.new;
              // دریافت اطلاعات تفسیر
              const { data: tafsir, error } = await sb
                .from('tafsirs')
                .select('surah, ayah')
                .eq('id', newComment.tafsir_id)
                .single();
              if (error || !tafsir) return;

              // دریافت نام سوره
              const index = await QuranData.getIndex();
              const surahMeta = index.find((s) => s.number === tafsir.surah);
              const surahName = surahMeta ? surahMeta.name_fa : tafsir.surah;

              const message = `💬 نظر جدید از \"${newComment.guest_name}\" روی تفسیر سورهٔ ${surahName} آیهٔ ${UI.toPersianDigits(tafsir.ayah)}`;
              const link = `browse.html?surah=${tafsir.surah}&ayah=${tafsir.ayah}`;

              UI.toast(message, link);
            } catch (e) {
              console.warn('[notifications] could not show comment toast:', e);
            }
          }
        )
        .subscribe();
    } catch (e) {
      // اعلان‌ها یک امکان کمکی‌اند؛ خرابی‌شان نباید جای دیگری را بشکند
      isListening = false;
      console.warn('[notifications] unavailable:', e);
    }
  }

  function stopListening() {
    if (subscription) {
      subscription.unsubscribe();
      subscription = null;
      isListening = false;
    }
  }

  // اگر اسکریپت بعد از DOMContentLoaded هم لود شد، منتظر رویدادی نمی‌ماند که دیگر نمی‌آید
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startListening);
  else startListening();
  window.addEventListener('pagehide', stopListening);
})();
