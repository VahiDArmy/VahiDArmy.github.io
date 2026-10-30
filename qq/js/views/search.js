window.Views = window.Views || {};
window.Views.Search = async function ({ container }) {
  container.innerHTML = `
    <div class="view view-search">
      <section class="section">
        <div class="section__label">جستجو در تفسیرها</div>
        <div class="card" style="padding:14px;">
          <form id="searchForm" style="display:flex; gap:10px; align-items:stretch;">
            <input type="search" id="searchInput" placeholder="عبارت مورد نظر…" autocomplete="off"
              style="flex:1; min-width:0; background:var(--surface); color:var(--text); border:1px solid var(--border); border-radius:999px; padding:10px 16px; font-family:inherit; font-size:0.92rem;" />
            <button type="submit" class="btn btn--primary" style="flex-shrink:0;">جستجو</button>
          </form>
        </div>
        <div id="searchResults" style="margin-top:20px;"></div>
      </section>
    </div>
  `;

  // Ensure input follows theme on focus too
  const input = document.getElementById('searchInput');
  input.addEventListener('focus', () => {
    input.style.borderColor = 'var(--neon)';
    input.style.boxShadow = '0 0 0 3px var(--neon-glow)';
  });
  input.addEventListener('blur', () => {
    input.style.borderColor = 'var(--border)';
    input.style.boxShadow = 'none';
  });

  document.getElementById('searchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = input.value.trim();
    const results = document.getElementById('searchResults');
    if (!q) return;
    results.innerHTML = '<div class="skeleton" style="height:50px"></div>';
    try {
      const { data, error } = await sb
        .from('tafsirs')
        .select('*')
        .ilike('content', `%${q}%`)
        .order('created_at', { ascending: false })
        .limit(40);
      if (error) throw error;
      if (!data.length) {
        results.innerHTML =
          '<p style="color:var(--text-faint); text-align:center;">نتیجه‌ای یافت نشد.</p>';
        return;
      }
      const index = await QuranData.getIndex();
      const nameOf = (n) => index.find((s) => s.number === n)?.name_fa || n;
      results.innerHTML = data
        .map(
          (t) => `
        <div class="card" style="margin-bottom:12px;">
          <a href="#/browse/${t.surah}/${t.ayah}" style="color:var(--neon); font-weight:600;">
            سورهٔ ${nameOf(t.surah)}، آیهٔ ${UI.toPersianDigits(t.ayah)}
          </a>
          <div style="margin-top:6px; white-space:pre-wrap; font-size:0.95rem; line-height:1.8;">${UI.escapeHtml(t.content)}</div>
        </div>
      `
        )
        .join('');
    } catch (err) {
      results.innerHTML = '<p style="color:var(--danger)">خطا در جستجو</p>';
      console.error(err);
    }
  });
};
