window.Views = window.Views || {};
window.Views.Search = async function ({ container }) {
  container.innerHTML = `
    <div class="view view-search">
      <section class="section">
        <div class="section__label">جستجو در تفسیرها</div>
        <div class="card">
          <form id="searchForm" style="display:flex; gap:8px;">
            <input type="search" id="searchInput" placeholder="عبارت مورد نظر…" style="flex:1;" autocomplete="off" />
            <button type="submit" class="btn btn--primary">جستجو</button>
          </form>
        </div>
        <div id="searchResults" style="margin-top:20px;"></div>
      </section>
    </div>
  `;

  document.getElementById('searchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = document.getElementById('searchInput').value.trim();
    const results = document.getElementById('searchResults');
    if (!q) return;
    results.innerHTML = '<div class="skeleton" style="height:50px"></div>';
    try {
      // Simple client-side search over recent tafsirs (for full text search Supabase full-text would be better, but no schema change)
      const { data, error } = await sb.from('tafsirs').select('*').ilike('content', `%${q}%`).order('created_at', { ascending: false }).limit(40);
      if (error) throw error;
      if (!data.length) {
        results.innerHTML = '<p style="color:var(--text-faint); text-align:center;">نتیجه‌ای یافت نشد.</p>';
        return;
      }
      const index = await QuranData.getIndex();
      const nameOf = (n) => index.find(s => s.number === n)?.name_fa || n;
      results.innerHTML = data.map(t => `
        <div class="card" style="margin-bottom:12px;">
          <a href="#/browse/${t.surah}/${t.ayah}" style="color:var(--neon); font-weight:600;">
            سورهٔ ${nameOf(t.surah)}، آیهٔ ${UI.toPersianDigits(t.ayah)}
          </a>
          <div style="margin-top:6px; white-space:pre-wrap; font-size:0.95rem;">${UI.escapeHtml(t.content)}</div>
        </div>
      `).join('');
    } catch (err) {
      results.innerHTML = '<p style="color:var(--danger)">خطا در جستجو</p>';
      console.error(err);
    }
  });
};
