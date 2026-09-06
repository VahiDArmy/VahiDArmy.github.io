(async function () {
  const surahSelect = document.getElementById('browseSurahSelect');
  const ayahSelect = document.getElementById('browseAyahSelect');
  const frameEl = document.getElementById('browseAyahFrame');
  const tafsirsListEl = document.getElementById('tafsirsList');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  const index = await QuranData.getIndex();
  UI.populateSurahSelect(surahSelect, index, 1);

  // آیا بازدیدکنندهٔ فعلی خود شما (مالک) هستید؟ برای نمایش دکمهٔ حذف نظرات/تفسیرها
  let isOwner = false;
  try {
    const session = await Auth.getSession();
    isOwner = !!session;
  } catch (e) {
    isOwner = false;
  }

  function parseHash() {
    const m = location.hash.match(/^#\/(\d+)\/(\d+)$/);
    if (!m) return null;
    return { surah: Number(m[1]), ayah: Number(m[2]) };
  }

  function setHash(surah, ayah, replace) {
    const h = `#/${surah}/${ayah}`;
    if (replace) history.replaceState(null, '', h);
    else location.hash = h;
  }

  async function render() {
    const parsed = parseHash();
    const { surah, ayah } = parsed || { surah: 1, ayah: 1 };
    ayahSkeleton(frameEl);
    tafsirsListEl.innerHTML = '';

    const surahData = await QuranData.getSurah(surah);
    const ayahData = surahData.ayahs.find((a) => a.v === ayah) || surahData.ayahs[0];
    const actualAyah = ayahData.v;

    surahSelect.value = surah;
    UI.populateAyahSelect(ayahSelect, surahData.ayah_count, actualAyah);

    const markOptions = isOwner
      ? {
          marked: await Store.isMarked(surah, actualAyah),
          onToggleMark: async (btn) => {
            const nowMarked = !btn.classList.contains('is-marked');
            await Store.toggleMark(surah, actualAyah, nowMarked);
            btn.classList.toggle('is-marked', nowMarked);
            btn.setAttribute('aria-pressed', String(nowMarked));
          },
        }
      : { marked: await Store.isMarked(surah, actualAyah) };

    renderAyahFrame(frameEl, ayahData, surahData, markOptions);

    prevBtn.disabled = surah === 1 && actualAyah === 1;
    nextBtn.disabled = surah === 114 && actualAyah === surahData.ayah_count;

    await renderTafsirs(surah, actualAyah);
  }

  async function renderTafsirs(surah, ayah) {
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
          <p class="tafsir-card__body">${AyahLinks.renderContent(t.content, index, (seg) => UI.highlightTags(seg, t.tags))}</p>
          ${
            t.tags && t.tags.length
              ? `<div class="tag-pills">${t.tags
                  .map((tg) => UI.tagPill(tg, { href: `tags.html?tag=${encodeURIComponent(tg)}` }))
                  .join('')}</div>`
              : ''
          }
          <div class="comment-list" data-comments="${t.id}"></div>
          <form class="comment-form" data-comment-form="${t.id}" style="margin-top:12px;">
            <div class="name-row">
              <input type="text" name="guestName" placeholder="نام شما (الزامی)" required maxlength="60" />
            </div>
            <div style="display:flex; gap:6px;">
              <input type="text" name="content" placeholder="نظر شما…" required style="flex:1;" />
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
      <div class="comment" data-comment-id="${c.id}">
        <div class="comment__head">
          <span class="comment__name">${escapeHtml(c.guest_name)}</span>
          <span class="comment__date">${new Date(c.created_at).toLocaleDateString('fa-IR')}</span>
        </div>
        <div class="comment__body">${escapeHtml(c.content)}</div>
        ${isOwner ? `<button class="tafsir-card__more" data-delete-comment="${c.id}">حذف</button>` : ''}
      </div>`
      )
      .join('');

    if (isOwner) {
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
    const { surah, ayah } = parseHash() || { surah: 1, ayah: 1 };
    if (ayah > 1) return setHash(surah, ayah - 1);
    if (surah > 1) {
      const prevSurah = await QuranData.getSurah(surah - 1);
      setHash(surah - 1, prevSurah.ayah_count);
    }
  });
  nextBtn.addEventListener('click', async () => {
    const { surah, ayah } = parseHash() || { surah: 1, ayah: 1 };
    const surahData = await QuranData.getSurah(surah);
    if (ayah < surahData.ayah_count) return setHash(surah, ayah + 1);
    if (surah < 114) setHash(surah + 1, 1);
  });

  window.addEventListener('hashchange', render);

  // --- تعیین آیهٔ شروع ---
  const params = new URLSearchParams(location.search);
  if (params.has('surah') && params.has('ayah')) {
    setHash(Number(params.get('surah')), Number(params.get('ayah')), true);
  } else if (!location.hash) {
    // پیش‌فرض: آخرین آیه‌ای که تفسیر داشته (نه همیشه آیهٔ ۱)
    const latest = await Store.getLatestTafsir();
    if (latest) setHash(latest.surah, latest.ayah, true);
    else setHash(1, 1, true);
  }

  render();
})();
