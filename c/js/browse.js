(async function () {
  const surahSelect = document.getElementById('browseSurahSelect');
  const ayahSelect = document.getElementById('browseAyahSelect');
  const frameEl = document.getElementById('browseAyahFrame');
  const tafsirsListEl = document.getElementById('tafsirsList');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  const index = await QuranData.getIndex();
  UI.populateSurahSelect(surahSelect, index, 1);

  // آیا کاربر لاگین کرده (برای نمایش دکمهٔ حذف نظر)
  const session = await Auth.getSession();

  // آخرین آیه‌ای که رویش کار شده — هم برای لینک بالای صفحه، هم برای تعیین نمایش پیش‌فرض
  const latest = await Store.getLatestTafsir();

  // --- نمایش لینک «آخرین آیهٔ کار شده» بالای صفحه ---
  const lastWorkedLink = document.getElementById('lastWorkedLink');
  const lastWorkedText = document.getElementById('lastWorkedText');
  if (latest) {
    QuranData.getSurah(latest.surah).then((surahData) => {
      lastWorkedText.textContent = `${surahData.name_fa} ${UI.toPersianDigits(latest.ayah)}`;
      lastWorkedLink.href = `#/${latest.surah}/${latest.ayah}`;
      lastWorkedLink.hidden = false;
    });
  }

  function parseHash() {
    const m = location.hash.match(/^#\/(\d+)\/(\d+)$/);
    if (!m) return { surah: 1, ayah: 1 };
    return { surah: Number(m[1]), ayah: Number(m[2]) };
  }

  function setHash(surah, ayah, replace) {
    const h = `#/${surah}/${ayah}`;
    if (replace) history.replaceState(null, '', h);
    else location.hash = h;
  }

  async function render() {
    const { surah, ayah } = parseHash();
    ayahSkeleton(frameEl);
    tafsirsListEl.innerHTML = '';

    const surahData = await QuranData.getSurah(surah);
    const ayahData = surahData.ayahs.find((a) => a.v === ayah) || surahData.ayahs[0];
    const actualAyah = ayahData.v;

    surahSelect.value = surah;
    UI.populateAyahSelect(ayahSelect, surahData.ayah_count, actualAyah);

    renderAyahFrame(frameEl, ayahData, surahData);

    prevBtn.disabled = surah === 1 && actualAyah === 1;
    nextBtn.disabled = surah === 114 && actualAyah === surahData.ayah_count;

    await renderTafsirs(surah, actualAyah, surahData);
  }

  async function renderTafsirs(surah, ayah, surahData) {
    const tafsirs = await Store.getTafsirsForAyah(surah, ayah);
    if (!tafsirs.length) {
      tafsirsListEl.innerHTML = `
        <div class="empty-state card">
          <div class="empty-state__icon">✎</div>
          <p>هنوز تفسیری برای این آیه نوشته نشده.</p>
          <a class="btn btn--primary" href="index.html?surah=${surah}&ayah=${ayah}">افزودن تفسیر</a>
        </div>`;
      return;
    }
    tafsirsListEl.innerHTML = tafsirs
      .map((t) => {
        const date = new Date(t.created_at).toLocaleDateString('fa-IR');
        return `
        <div class="tafsir-card">
          <div class="tafsir-card__meta">
            <span class="tafsir-card__round">دور ${UI.toPersianDigits(t.round_number)}</span>
            <span>${date}</span>
          </div>
          <p class="tafsir-card__body">${escapeHtml(t.content)}</p>
          <div class="comment-list" data-comments="${t.id}"></div>
          <form class="comment-form" data-comment-form="${t.id}">
            <input type="text" name="guestName" placeholder="نام شما" required maxlength="60"
              spellcheck="false" autocorrect="off" autocapitalize="off"
              style="background:var(--surface-2); border:1px solid var(--border); color:var(--text); padding:9px 12px; border-radius:10px; font-family:inherit; font-size:0.85rem;">
            <div style="display:flex; gap:6px;">
              <input type="text" name="content" placeholder="نظر شما…" required
                spellcheck="false" autocorrect="off" autocapitalize="off"
                style="flex:1; background:var(--surface-2); border:1px solid var(--border); color:var(--text); padding:9px 12px; border-radius:10px; font-family:inherit; font-size:0.85rem;">
              <button type="submit" class="btn btn--sm btn--primary">ارسال</button>
            </div>
          </form>
        </div>`;
      })
      .join('');

    tafsirs.forEach((t) => loadComments(t.id));

    tafsirsListEl.querySelectorAll('[data-comment-form]').forEach((form) => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = form.querySelector('input[name="guestName"]');
        const contentInput = form.querySelector('input[name="content"]');
        const guestName = nameInput.value.trim();
        const content = contentInput.value.trim();
        if (!guestName || !content) return;
        const tafsirId = form.getAttribute('data-comment-form');
        await Store.addComment({ tafsirId, guestName, content });
        contentInput.value = '';
        loadComments(tafsirId);
        UI.toast('نظر شما ثبت شد');
      });
    });
  }

  async function loadComments(tafsirId) {
    const wrap = tafsirsListEl.querySelector(`[data-comments="${tafsirId}"]`);
    if (!wrap) return;
    const comments = await Store.getComments(tafsirId);
    wrap.innerHTML = comments
      .map(
        (c) => `
      <div class="comment">
        <div class="comment__head">
          <span class="comment__name">${escapeHtml(c.guest_name)}</span>
          <span style="display:flex; align-items:center; gap:8px;">
            <span class="comment__date">${new Date(c.created_at).toLocaleDateString('fa-IR')}</span>
            ${session ? `<button type="button" class="comment__delete" data-delete-comment="${c.id}" aria-label="حذف نظر">حذف</button>` : ''}
          </span>
        </div>
        <div class="comment__body">${escapeHtml(c.content)}</div>
      </div>`
      )
      .join('');

    if (session) {
      wrap.querySelectorAll('[data-delete-comment]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('این نظر حذف شود؟')) return;
          await Store.deleteComment(btn.getAttribute('data-delete-comment'));
          loadComments(tafsirId);
        });
      });
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- ناوبری با دراپ‌داون ---
  surahSelect.addEventListener('change', async () => {
    setHash(Number(surahSelect.value), 1);
  });
  ayahSelect.addEventListener('change', () => {
    setHash(Number(surahSelect.value), Number(ayahSelect.value));
  });

  // --- دکمه بعدی/قبلی ---
  prevBtn.addEventListener('click', async () => {
    const { surah, ayah } = parseHash();
    if (ayah > 1) return setHash(surah, ayah - 1);
    if (surah > 1) {
      const prevSurah = await QuranData.getSurah(surah - 1);
      setHash(surah - 1, prevSurah.ayah_count);
    }
  });
  nextBtn.addEventListener('click', async () => {
    const { surah, ayah } = parseHash();
    const surahData = await QuranData.getSurah(surah);
    if (ayah < surahData.ayah_count) return setHash(surah, ayah + 1);
    if (surah < 114) setHash(surah + 1, 1);
  });

  window.addEventListener('hashchange', render);

  // --- ورود از پارامتر URL (لینک از صفحه مرور به کار و برعکس) ---
  const params = new URLSearchParams(location.search);
  if (params.has('surah') && params.has('ayah')) {
    setHash(Number(params.get('surah')), Number(params.get('ayah')), true);
  } else if (!location.hash) {
    // پیش‌فرض: آخرین آیه‌ای که رویش کار شده (نه همیشه سورهٔ ۱ آیهٔ ۱)
    if (latest) setHash(latest.surah, latest.ayah, true);
    else setHash(1, 1, true);
  }

  render();
})();
