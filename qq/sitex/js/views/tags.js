const Views = window.Views || {};
Views.Tags = async function ({ container, params }) {
  container.innerHTML = `
    <div class="view view-tags">
      <section class="section">
        <div class="section__label">برچسب‌ها</div>
        <div id="tagsList" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:24px;"></div>
        <div id="tagsTafsirs"></div>
      </section>
    </div>
  `;

  const listEl = document.getElementById('tagsList');
  const tafsirsEl = document.getElementById('tagsTafsirs');

  try {
    const tags = await Store.getAllTags();
    if (!tags.length) {
      listEl.innerHTML = '<p style="color:var(--text-faint)">هنوز برچسبی ثبت نشده است.</p>';
      return;
    }
    listEl.innerHTML = tags.map(({ tag, count }) => {
      const c = UI.tagColor(tag);
      return `<button class="tag-pill" data-tag="${UI.escapeHtml(tag)}" style="background:${c.bg};border-color:${c.border};color:${c.color}; cursor:pointer;">${UI.escapeHtml(tag)} <small>${UI.toPersianDigits(count)}</small></button>`;
    }).join('');

    listEl.querySelectorAll('[data-tag]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tag = btn.dataset.tag;
        tafsirsEl.innerHTML = '<div class="skeleton" style="height:60px"></div>';
        try {
          const items = await Store.getTafsirsByTag(tag);
          tafsirsEl.innerHTML = `<div class="section__label">تفسیرهای برچسب «${UI.escapeHtml(tag)}»</div>` +
            items.map(t => `
              <div class="card" style="margin-bottom:10px;">
                <a href="#/browse/${t.surah}/${t.ayah}" style="color:var(--neon); font-weight:600;">سوره ${t.surah} آیه ${UI.toPersianDigits(t.ayah)}</a>
                <div style="margin-top:6px; white-space:pre-wrap;">${UI.escapeHtml(t.content)}</div>
              </div>
            `).join('');
        } catch (e) {
          tafsirsEl.innerHTML = '<p style="color:var(--danger)">خطا</p>';
        }
      });
    });

    // If param tag provided
    if (params.tag) {
      const btn = listEl.querySelector(`[data-tag="${CSS.escape(params.tag)}"]`);
      if (btn) btn.click();
    }
  } catch (e) {
    listEl.innerHTML = '<p style="color:var(--danger)">خطا در بارگذاری برچسب‌ها</p>';
  }
};
window.Views = Views;
