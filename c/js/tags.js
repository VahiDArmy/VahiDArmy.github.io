(async function () {
  const cloudSection = document.getElementById('cloudSection');
  const filteredSection = document.getElementById('filteredSection');
  const tagCloudEl = document.getElementById('tagCloud');
  const activeTagLabel = document.getElementById('activeTagLabel');
  const taggedTafsirsListEl = document.getElementById('taggedTafsirsList');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function renderCloud() {
    const tags = await Store.getAllTags();
    if (!tags.length) {
      tagCloudEl.innerHTML = `<p style="color:var(--text-faint); font-size:0.85rem;">هنوز هیچ تفسیری برچسب نگرفته.</p>`;
      return;
    }
    tagCloudEl.innerHTML = tags
      .map(({ tag, count }) => UI.tagPill(tag, { href: `tags.html?tag=${encodeURIComponent(tag)}`, count }))
      .join('');
  }

  async function renderFiltered(tag) {
    cloudSection.hidden = true;
    filteredSection.hidden = false;
    activeTagLabel.textContent = `برچسب: ${tag}`;
    taggedTafsirsListEl.innerHTML = `<div class="skeleton" style="height:80px;"></div>`;

    const tafsirs = await Store.getTafsirsByTag(tag);
    if (!tafsirs.length) {
      taggedTafsirsListEl.innerHTML = `<div class="empty-state card"><p>تفسیری با این برچسب پیدا نشد.</p></div>`;
      return;
    }

    const index = await QuranData.getIndex();
    const nameOf = (n) => index.find((s) => s.number === n)?.name_fa || n;

    taggedTafsirsListEl.innerHTML = tafsirs
      .map((t) => {
        const date = new Date(t.created_at).toLocaleDateString('fa-IR');
        return `
        <div class="tafsir-card">
          <div class="tafsir-card__meta">
            <span class="tafsir-card__round">دور ${UI.toPersianDigits(t.round_number)}</span>
            <a href="browse.html?surah=${t.surah}&ayah=${t.ayah}" style="color:var(--neon); font-weight:600;">
              سورهٔ ${nameOf(t.surah)}، آیهٔ ${UI.toPersianDigits(t.ayah)}
            </a>
            <span>${date}</span>
          </div>
          <p class="tafsir-card__body">${escapeHtml(t.content)}</p>
          ${
            t.tags && t.tags.length
              ? `<div class="tag-pills">${t.tags
                  .map((tg) => UI.tagPill(tg, { href: `tags.html?tag=${encodeURIComponent(tg)}`, active: tg === tag }))
                  .join('')}</div>`
              : ''
          }
        </div>`;
      })
      .join('');
  }

  const params = new URLSearchParams(location.search);
  const tag = params.get('tag');
  if (tag) {
    await renderFiltered(tag);
  } else {
    await renderCloud();
  }
})();
