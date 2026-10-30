const Views = window.Views || {};
Views.Relations = async function ({ container }) {
  container.innerHTML = `
    <div class="view view-relations">
      <section class="section">
        <div class="section__label">رابطه‌های آیه‌ها</div>
        <div id="relationsList">
          <div class="skeleton" style="height:40px; margin-bottom:8px"></div>
          <div class="skeleton" style="height:40px; margin-bottom:8px"></div>
          <div class="skeleton" style="height:40px"></div>
        </div>
      </section>
    </div>
  `;

  try {
    const links = await Store.getAllLinks();
    const el = document.getElementById('relationsList');
    if (!links.length) {
      el.innerHTML = '<p style="color:var(--text-faint); text-align:center;">هنوز رابطه‌ای ثبت نشده است.</p>';
      return;
    }
    const index = await QuranData.getIndex();
    const nameOf = (n) => index.find(s => s.number === n)?.name_fa || n;
    el.innerHTML = links.map(l => `
      <div class="card" style="margin-bottom:10px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <a href="#/browse/${l.from_surah}/${l.from_ayah}" class="ayah-link">سورهٔ ${nameOf(l.from_surah)}، آیهٔ ${UI.toPersianDigits(l.from_ayah)}</a>
        <span style="color:var(--text-faint)">→</span>
        <a href="#/browse/${l.to_surah}/${l.to_ayah}" class="ayah-link">سورهٔ ${nameOf(l.to_surah)}، آیهٔ ${UI.toPersianDigits(l.to_ayah)}</a>
        ${l.excerpt ? `<span style="font-size:0.85rem; color:var(--text-dim);">«${UI.escapeHtml(l.excerpt)}»</span>` : ''}
      </div>
    `).join('');
  } catch (e) {
    document.getElementById('relationsList').innerHTML = '<p style="color:var(--danger)">خطا در بارگذاری رابطه‌ها</p>';
  }
};
window.Views = Views;
