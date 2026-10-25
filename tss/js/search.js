(async function () {
  const input = document.getElementById('searchInput');
  const resultsEl = document.getElementById('searchResults');

  let index = [];
  try {
    index = await QuranData.getIndex();
  } catch (e) {
    console.error('[search] index', e);   // بدون فهرست هم جستجو کار می‌کند؛ فقط نام سوره عدد می‌ماند
  }
  const nameOf = (n) => (index.find((s) => s.number === n) || {}).name_fa || n;

  const escapeHtml = (s) => UI.escapeHtml(s);

  function buildSnippet(rawContent, query, maxLen = 180) {
    const content = rawContent;
    // ilike بدون حساسیت به حروف بزرگ/کوچک است؛ برش و برجسته‌سازی هم باید همین‌طور باشد
    const idx = content.toLowerCase().indexOf(query.toLowerCase());
    let snippet;
    if (idx === -1) {
      snippet = content.slice(0, maxLen) + (content.length > maxLen ? '…' : '');
    } else {
      const start = Math.max(0, idx - 60);
      const end = Math.min(content.length, idx + query.length + 90);
      snippet = (start > 0 ? '…' : '') + content.slice(start, end) + (end < content.length ? '…' : '');
    }
    return highlightPlain(snippet, query);
  }

  // برجسته‌سازی روی «متن خام»؛ هر تکه جداگانه escape می‌شود، پس هیچ‌وقت وسط
  // یک entity (مثل &amp;) برش نمی‌خورد و جستجوی «R&D» هم درست کار می‌کند.
  function highlightPlain(text, query) {
    const lower = text.toLowerCase();
    const q = query.toLowerCase();
    let out = '';
    let pos = 0;
    let i;
    while (q && (i = lower.indexOf(q, pos)) !== -1) {
      out += escapeHtml(text.slice(pos, i)) + '<mark class="search-hit">' + escapeHtml(text.slice(i, i + q.length)) + '</mark>';
      pos = i + q.length;
    }
    return out + escapeHtml(text.slice(pos));
  }

  function renderEmpty(message) {
    resultsEl.innerHTML = `<div class="empty-state card"><p>${message}</p></div>`;
  }

  let debounceTimer = null;
  let requestSeq = 0;

  async function runSearch(query) {
    const seq = ++requestSeq;
    resultsEl.innerHTML = `<div class="skeleton" style="height:70px; margin-bottom:12px;"></div><div class="skeleton" style="height:70px;"></div>`;
    let results;
    try {
      results = await Store.searchTafsirs(query);
    } catch (e) {
      if (seq !== requestSeq) return;
      console.error('[search]', e);
      renderEmpty('جستجو انجام نشد؛ اتصال را بررسی کنید و دوباره تلاش کنید.');
      return;
    }
    if (seq !== requestSeq) return; // یک جستجوی جدیدتر شروع شده، این نتیجه دیگر مهم نیست

    if (!results.length) {
      renderEmpty(`چیزی برای «${escapeHtml(query)}» پیدا نشد.`);
      return;
    }

    resultsEl.innerHTML = results
      .map((t) => {
        const date = new Date(t.created_at).toLocaleDateString('fa-IR');
        const tagsHtml =
          t.tags && t.tags.length
            ? `<div class="tag-pills">${t.tags.map((tg) => UI.tagPill(tg, { href: `tags.html?tag=${encodeURIComponent(tg)}` })).join('')}</div>`
            : '';
        return `
        <div class="tafsir-card">
          <div class="tafsir-card__meta">
            <span class="tafsir-card__round">دور ${UI.toPersianDigits(t.round_number)}</span>
            <a href="browse.html?surah=${t.surah}&ayah=${t.ayah}" style="color:var(--neon); font-weight:600;">
              سورهٔ ${escapeHtml(nameOf(t.surah))}، آیهٔ ${UI.toPersianDigits(t.ayah)}
            </a>
            <span>${date}</span>
          </div>
          <p class="tafsir-card__body">${buildSnippet(t.content, query)}</p>
          ${tagsHtml}
        </div>`;
      })
      .join('');
  }

  input.addEventListener('input', () => {
    const query = input.value.trim();
    clearTimeout(debounceTimer);
    if (query.length < 2) {
      requestSeq++; // نتایج در حال بارگذاری را باطل کن
      renderEmpty(query.length === 0 ? 'عبارتی برای جستجو در متن تفسیرها بنویسید.' : 'حداقل ۲ حرف بنویسید.');
      return;
    }
    debounceTimer = setTimeout(() => runSearch(query), 350);
  });

  renderEmpty('عبارتی برای جستجو در متن تفسیرها بنویسید.');
  input.focus();
})();
