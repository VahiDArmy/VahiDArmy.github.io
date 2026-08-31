(async function () {
  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');
  const tagSelect = document.getElementById('tagSelect');
  const resultsList = document.getElementById('resultsList');
  const resultCount = document.getElementById('resultCount');
  const clearBtn = document.getElementById('clearSearchBtn');

  const index = await QuranData.getIndex();
  const nameOf = (n) => (index.find((s) => s.number === n) || {}).name_fa || n;

  // پر کردن انتخابگر برچسب‌ها
  async function populateTagSelect() {
    const tags = await Store.getAllTags();
    tagSelect.innerHTML = '<option value="">همهٔ برچسب‌ها</option>';
    tags.forEach(({ tag, count }) => {
      const opt = document.createElement('option');
      opt.value = tag;
      opt.textContent = `${tag} (${count})`;
      tagSelect.appendChild(opt);
    });
  }
  await populateTagSelect();

  // خواندن پارامترهای URL
  const params = new URLSearchParams(location.search);
  const q = params.get('q') || '';
  const tag = params.get('tag') || '';
  if (q) searchInput.value = q;
  if (tag) tagSelect.value = tag;

  async function performSearch() {
    const query = searchInput.value.trim();
    const selectedTag = tagSelect.value;
    // به‌روزرسانی URL بدون ریلود
    const newParams = new URLSearchParams();
    if (query) newParams.set('q', query);
    if (selectedTag) newParams.set('tag', selectedTag);
    const newUrl = location.pathname + '?' + newParams.toString();
    history.replaceState(null, '', newUrl);

    if (!query && !selectedTag) {
      resultsList.innerHTML = `<div class="empty-state card"><p>عبارت جستجو یا برچسب را وارد کنید.</p></div>`;
      resultCount.textContent = '';
      return;
    }

    resultsList.innerHTML = `<div class="skeleton" style="height:80px;"></div>`;
    const results = await Store.searchTafsirs(query || undefined, selectedTag || undefined);
    resultCount.textContent = `${UI.toPersianDigits(results.length)} نتیجه`;

    if (!results.length) {
      resultsList.innerHTML = `<div class="empty-state card"><p>هیچ تفسیری یافت نشد.</p></div>`;
      return;
    }

    resultsList.innerHTML = results
      .map((t) => {
        const date = new Date(t.created_at).toLocaleDateString('fa-IR');
        const surahName = nameOf(t.surah);
        // هایلایت کردن کلمهٔ جستجو در متن
        let contentHtml = t.content;
        if (query) {
          const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
          contentHtml = contentHtml.replace(re, '<mark>$1</mark>');
        }
        return `
        <div class="tafsir-card">
          <div class="tafsir-card__meta">
            <span class="tafsir-card__round">دور ${UI.toPersianDigits(t.round_number)}</span>
            <a href="browse.html?surah=${t.surah}&ayah=${t.ayah}" style="color:var(--neon); font-weight:600;">
              سورهٔ ${surahName}، آیهٔ ${UI.toPersianDigits(t.ayah)}
            </a>
            <span>${date}</span>
          </div>
          <p class="tafsir-card__body">${AyahLinks.renderContent(contentHtml, index, (seg) => UI.highlightTags(seg, t.tags))}</p>
          ${
            t.tags && t.tags.length
              ? `<div class="tag-pills">${t.tags
                  .map((tg) => UI.tagPill(tg, { href: `tags.html?tag=${encodeURIComponent(tg)}` }))
                  .join('')}</div>`
              : ''
          }
          <div class="tafsir-card__actions">
            <button class="btn btn--sm" data-copy="${t.id}">📋 کپی</button>
          </div>
        </div>`;
      })
      .join('');

    // رویداد کپی
    resultsList.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-copy');
        const t = results.find((x) => x.id === id);
        if (!t) return;
        const surahName = nameOf(t.surah);
        const text = `سورهٔ ${surahName}، آیهٔ ${UI.toPersianDigits(t.ayah)}\n\n${t.content}`;
        await UI.copyToClipboard(text, 'تفسیر کپی شد');
      });
    });
  }

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    performSearch();
  });

  tagSelect.addEventListener('change', performSearch);

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    tagSelect.value = '';
    performSearch();
  });

  // اجرای جستجو اگر پارامتر وجود داشت
  if (q || tag) {
    await performSearch();
  }
})();