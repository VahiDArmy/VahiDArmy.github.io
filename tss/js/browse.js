(async function () {
  const surahSelect = document.getElementById('browseSurahSelect');
  const ayahSelect = document.getElementById('browseAyahSelect');
  const frameEl = document.getElementById('browseAyahFrame');
  const tafsirsListEl = document.getElementById('tafsirsList');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  const errorBox = (msg) => `<p style="color:var(--danger); text-align:center;">${msg}</p>`;

  // خطای یک دکمه باید toast بدهد، نه اینکه بی‌صدا در Promise گم شود
  const safe = (fn, msg) => async (...args) => {
    try {
      await fn(...args);
    } catch (e) {
      console.error('[browse]', e);
      UI.toast(msg || 'خطایی رخ داد');
    }
  };

  let index = [];
  try {
    index = await QuranData.getIndex();
  } catch (e) {
    console.error(e);
    frameEl.innerHTML = errorBox('فهرست سوره‌ها بارگذاری نشد.');
    return;
  }
  const maxSurah = index.length || 114;
  UI.populateSurahSelect(surahSelect, index, 1);

  let isOwner = false;
  try {
    const session = await Auth.getSession();
    isOwner = !!session;
  } catch (e) {
    isOwner = false;
  }

  // فقط آدرس‌های معتبر؛ #/200/1 یا #/0/5 به ۱:۱ برمی‌گردد
  function parseHash() {
    const m = location.hash.match(/^#\/(\d+)\/(\d+)$/);
    if (!m) return null;
    const surah = Number(m[1]);
    const ayah = Number(m[2]);
    if (surah < 1 || surah > maxSurah || ayah < 1) return null;
    return { surah, ayah };
  }

  function setHash(surah, ayah, replace) {
    const h = `#/${surah}/${ayah}`;
    if (replace) history.replaceState(null, '', location.pathname + h);
    else location.hash = h;
  }

  let renderSeq = 0;

  async function render() {
    // اگر کاربر وسط بارگذاری آیه را عوض کرد، نتیجهٔ قدیمی نباید روی جدید بنشیند
    const seq = ++renderSeq;
    const stale = () => seq !== renderSeq;

    const { surah, ayah } = parseHash() || { surah: 1, ayah: 1 };
    ayahSkeleton(frameEl);
    tafsirsListEl.innerHTML = '';

    try {
      const surahData = await QuranData.getSurah(surah);
      if (stale()) return;
      const ayahData = surahData.ayahs.find((a) => a.v === ayah) || surahData.ayahs[0];
      const actualAyah = ayahData.v;

      surahSelect.value = surah;
      UI.populateAyahSelect(ayahSelect, surahData.ayah_count, actualAyah);

      // خطای نشانک/نشان‌گذاری نباید کل صفحه را بشکند
      const [meta, marked] = await Promise.all([
        Store.getSiteMeta().catch(() => null),
        Store.isMarked(surah, actualAyah).catch(() => false),
      ]);
      if (stale()) return;
      const isBookmarked = !!meta && meta.bookmark_surah === surah && meta.bookmark_ayah === actualAyah;

      renderAyahFrame(frameEl, ayahData, surahData, {
        marked,
        isBookmarked,
        // دکمه‌های نوشتن فقط برای صاحب سایت؛ بازدیدکننده فقط نشانهٔ «آخرین آیه» را می‌بیند
        ...(isOwner
          ? {
              onToggleMark: async (btn) => {
                const nowMarked = !btn.classList.contains('is-marked');
                try {
                  await Store.toggleMark(surah, actualAyah, nowMarked);
                  btn.classList.toggle('is-marked', nowMarked);
                  btn.setAttribute('aria-pressed', String(nowMarked));
                } catch (e) {
                  console.error('[mark]', e);
                  UI.toast('ثبت نشان‌گذاری ناموفق بود');
                }
              },
              onBookmark: () => Store.setBookmark(surah, actualAyah),
            }
          : {}),
      });

      prevBtn.disabled = surah === 1 && actualAyah === 1;
      nextBtn.disabled = surah === maxSurah && actualAyah === surahData.ayah_count;

      await renderTafsirs(surah, actualAyah, stale);
    } catch (e) {
      if (stale()) return;
      console.error(e);
      frameEl.innerHTML = errorBox('خطا در بارگذاری آیه.');
    }
  }

  async function renderTafsirs(surah, ayah, stale) {
    let tafsirs;
    try {
      tafsirs = await Store.getTafsirsForAyah(surah, ayah);
    } catch (e) {
      if (stale()) return;
      console.error(e);
      tafsirsListEl.innerHTML = errorBox('خطا در بارگذاری تفسیرها.');
      return;
    }
    if (stale()) return;

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
        const id = UI.escapeHtml(t.id);
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
          <div class="comment-list" data-comments="${id}"></div>
          <form class="comment-form" data-comment-form="${id}" style="margin-top:12px;">
            <div class="name-row">
              <input type="text" name="guestName" placeholder="نام شما (الزامی)" required maxlength="60" />
            </div>
            <div style="display:flex; gap:6px;">
              <input type="text" name="content" placeholder="نظر شما…" required maxlength="1000" style="flex:1;" />
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
        if (form.dataset.busy) return;
        const nameInput = form.querySelector('input[name="guestName"]');
        const contentInput = form.querySelector('input[name="content"]');
        const submitBtn = form.querySelector('button[type="submit"]');
        const guestName = nameInput.value.trim();
        const content = contentInput.value.trim();
        if (!guestName || !content) return;
        const tafsirId = form.getAttribute('data-comment-form');

        form.dataset.busy = '1';
        submitBtn.disabled = true;
        try {
          await Store.addComment({ tafsirId, guestName, content });
          contentInput.value = '';
          await loadComments(tafsirId);
          UI.toast('نظر شما ثبت شد');
        } catch (err) {
          // متن نوشته‌شده پاک نمی‌شود تا کاربر بتواند دوباره بفرستد
          console.error('[comment]', err);
          UI.toast('ثبت نظر ناموفق بود — دوباره تلاش کنید');
        } finally {
          delete form.dataset.busy;
          submitBtn.disabled = false;
        }
      });
    });
  }

  async function loadComments(tafsirId) {
    const wrap = Array.from(tafsirsListEl.querySelectorAll('[data-comments]')).find(
      (el) => el.getAttribute('data-comments') === String(tafsirId)
    );
    if (!wrap) return;
    let comments;
    try {
      comments = await Store.getComments(tafsirId);
    } catch (e) {
      console.error('[comments]', e);
      return;
    }
    wrap.innerHTML = comments
      .map(
        (c) => `
      <div class="comment" data-comment-id="${UI.escapeHtml(c.id)}">
        <div class="comment__head">
          <span class="comment__name">${UI.escapeHtml(c.guest_name)}</span>
          <span class="comment__date">${new Date(c.created_at).toLocaleDateString('fa-IR')}</span>
        </div>
        <div class="comment__body">${UI.escapeHtml(c.content)}</div>
        ${isOwner ? `<button class="tafsir-card__more" data-delete-comment="${UI.escapeHtml(c.id)}">حذف</button>` : ''}
      </div>`
      )
      .join('');

    if (isOwner) {
      wrap.querySelectorAll('[data-delete-comment]').forEach((btn) => {
        btn.addEventListener('click', safe(async () => {
          if (!confirm('این نظر حذف شود؟')) return;
          await Store.deleteComment(btn.getAttribute('data-delete-comment'));
          await loadComments(tafsirId);
        }, 'حذف نظر ناموفق بود'));
      });
    }
  }

  surahSelect.addEventListener('change', safe(async () => {
    const surah = Number(surahSelect.value);
    const surahData = await QuranData.getSurah(surah);
    UI.populateAyahSelect(ayahSelect, surahData.ayah_count, 1);
    setHash(surah, 1);
  }, 'بارگذاری سوره ناموفق بود'));

  ayahSelect.addEventListener('change', () => {
    setHash(Number(surahSelect.value), Number(ayahSelect.value));
  });

  prevBtn.addEventListener('click', safe(async () => {
    const { surah, ayah } = parseHash() || { surah: 1, ayah: 1 };
    if (ayah > 1) return setHash(surah, ayah - 1);
    if (surah > 1) {
      const prevSurah = await QuranData.getSurah(surah - 1);
      setHash(surah - 1, prevSurah.ayah_count);
    }
  }, 'بارگذاری آیه ناموفق بود'));

  nextBtn.addEventListener('click', safe(async () => {
    const { surah, ayah } = parseHash() || { surah: 1, ayah: 1 };
    const surahData = await QuranData.getSurah(surah);
    if (ayah < surahData.ayah_count) return setHash(surah, ayah + 1);
    if (surah < maxSurah) setHash(surah + 1, 1);
  }, 'بارگذاری آیه ناموفق بود'));

  window.addEventListener('hashchange', render);

  // ورودی از لینک (browse.html?surah=2&ayah=255): یک‌بار مصرف می‌شود و از آدرس پاک می‌شود،
  // وگرنه بعد از چند بار «آیهٔ بعد» و رفرش، دوباره به همان آیهٔ اول برمی‌گشت.
  const params = new URLSearchParams(location.search);
  if (params.has('surah') && params.has('ayah')) {
    const qs = Number(params.get('surah'));
    const qa = Number(params.get('ayah'));
    if (Number.isInteger(qs) && Number.isInteger(qa) && qs >= 1 && qs <= maxSurah && qa >= 1) {
      history.replaceState(null, '', `${location.pathname}#/${qs}/${qa}`);
    } else {
      history.replaceState(null, '', location.pathname + location.hash);
    }
  }
  if (!parseHash()) {
    // نمایش آخرین نشانک خواندن
    try {
      const meta = await Store.getSiteMeta();
      setHash(meta.bookmark_surah, meta.bookmark_ayah, true);
    } catch (e) {
      setHash(1, 1, true);
    }
  }

  render();
})();
