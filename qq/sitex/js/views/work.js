// =============================================================
// Work view — آیه در حال کار + تفسیرها + نظرات (بدون رفرش)
// =============================================================
const Views = window.Views || {};

Views.Work = async function ({ container, params }) {
  // Require auth for full work features
  const session = await Auth.requireAuth();
  if (!session) return;

  // Show logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.hidden = false;

  // Inject the work UI (cleaned structure)
  container.innerHTML = `
    <div class="view view-work">
      <section class="section" aria-label="پیشرفت">
        <div class="progress-hero">
          <div class="progress-ring" id="progressRing">
            <svg viewBox="0 0 62 62">
              <circle class="ring-bg" cx="31" cy="31" r="26"></circle>
              <circle class="ring-fg" cx="31" cy="31" r="26"></circle>
            </svg>
            <div class="progress-ring__label" id="progressLabel">۰٪</div>
          </div>
          <div class="progress-hero__text">
            <div class="progress-hero__title-row">
              <p class="progress-hero__title">دور <span id="roundNumber">۱</span></p>
              <div class="progress-hero__actions">
                <button class="btn btn--sm go-to-btn" id="goToCurrentBtn" title="رفتن به آیهٔ نشانگر">⌖</button>
                <button class="btn btn--sm bookmark-btn" id="setBookmarkBtn" title="ثبت آیهٔ جاری">🔖</button>
                <button class="btn btn--sm" id="endRoundBtn" title="پایان دور فعلی">پایان دور</button>
              </div>
            </div>
            <p class="progress-hero__count" id="bookmarkLabel">—</p>
            <p class="progress-hero__count" id="tafsirCountLabel" style="color:var(--text-faint); font-size:0.78rem; font-weight:400;">۰ تفسیر در این دور</p>
          </div>
        </div>
      </section>

      <section class="section" aria-label="آیهٔ در حال کار">
        <div class="section__label">آیهٔ در حال کار</div>
        <div class="select-row" style="margin-bottom:10px">
          <div class="select-wrap"><select id="formSurahSelect" aria-label="انتخاب سوره"></select></div>
          <div class="select-wrap"><select id="formAyahSelect" aria-label="انتخاب آیه"></select></div>
        </div>
        <div class="sticky-ayah">
          <div id="workAyahFrame"></div>
          <div class="ayah-nav">
            <button class="btn" id="workPrevBtn">آیه قبلی ‹</button>
            <button class="btn" id="workNextBtn">› آیه بعدی</button>
          </div>
        </div>
      </section>

      <section class="section" aria-label="تفسیرهای این آیه">
        <div class="section__label">تفسیرهای ثبت‌شده برای این آیه</div>
        <div id="workTafsirsList"></div>
      </section>

      <section class="section" aria-label="افزودن تفسیر">
        <div class="section__label">تفسیر تازه</div>
        <div class="card">
          <div class="edit-banner" id="editBanner" hidden>
            <span>در حال ویرایش یک تفسیر موجود</span>
            <button type="button" data-cancel-edit>انصراف</button>
          </div>
          <form id="tafsirForm">
            <div class="field">
              <label for="tafsirContent">نظر و برداشت شما</label>
              <textarea id="tafsirContent" rows="4" spellcheck="false" placeholder="نظر خود را دربارهٔ این آیه بنویسید…" required></textarea>
            </div>
            <div class="field">
              <label for="tafsirTags">برچسب‌ها (اختیاری، با ، یا , جدا کنید)</label>
              <input type="text" id="tafsirTags" placeholder="مثلاً: عدالت، اخلاق فردی" />
            </div>
            <button type="submit" class="btn btn--primary" id="submitBtn" style="width:100%">ثبت تفسیر</button>
          </form>
        </div>
      </section>
    </div>
  `;

  // --- State ---
  let current = { surah: 1, ayah: 1 };
  let editingId = null;
  let index = [];

  // --- Helpers ---
  async function loadIndex() {
    index = await QuranData.getIndex();
  }

  async function renderAyah() {
    const frame = document.getElementById('workAyahFrame');
    frame.innerHTML = '<div class="skeleton" style="height:90px"></div>';
    try {
      const ayah = await QuranData.getAyah(current.surah, current.ayah);
      // Use existing ayah-render if available
      if (window.AyahRender) {
        frame.innerHTML = AyahRender.render(ayah);
      } else {
        frame.innerHTML = `
          <div class="ayah-card">
            <div class="ayah-ar" style="font-family:'Amiri Quran',serif; font-size:1.35rem; line-height:2.1; text-align:center;">${ayah.t || ayah.text || ''}</div>
            <div class="ayah-fa" style="margin-top:10px; color:var(--text-dim); text-align:center;">${ayah.tr || ayah.translation || ''}</div>
            <div style="text-align:center; margin-top:8px; font-size:0.8rem; color:var(--text-faint);">${index.find(s => s.number === current.surah)?.name_fa || ''} · آیه ${UI.toPersianDigits(current.ayah)}</div>
          </div>
        `;
      }
    } catch (e) {
      frame.innerHTML = `<p style="color:var(--danger); text-align:center;">آیه بارگذاری نشد (دادهٔ سوره در پوشه data موجود نیست)</p>`;
    }
  }

  async function loadTafsirs() {
    const list = document.getElementById('workTafsirsList');
    list.innerHTML = '<div class="skeleton" style="height:60px; margin-bottom:8px"></div><div class="skeleton" style="height:60px"></div>';
    try {
      const tafsirs = await Store.getTafsirsForAyah(current.surah, current.ayah);
      if (!tafsirs.length) {
        list.innerHTML = `<p style="color:var(--text-faint); text-align:center; padding:12px 0;">هنوز تفسیری برای این آیه ثبت نشده است.</p>`;
        return;
      }
      list.innerHTML = tafsirs.map(t => renderTafsirCard(t)).join('');
      // Attach comment handlers (no refresh)
      list.querySelectorAll('[data-add-comment]').forEach(btn => {
        btn.addEventListener('click', () => openCommentForm(btn.dataset.tafsirId));
      });
      list.querySelectorAll('[data-edit-tafsir]').forEach(btn => {
        btn.addEventListener('click', () => startEdit(btn.dataset.id, btn.dataset.content, btn.dataset.tags));
      });
      list.querySelectorAll('[data-delete-tafsir]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('حذف این تفسیر؟')) return;
          await Store.deleteTafsir(btn.dataset.id);
          UI.toast('حذف شد');
          loadTafsirs();
        });
      });
    } catch (e) {
      list.innerHTML = `<p style="color:var(--danger)">خطا در بارگذاری تفسیرها</p>`;
    }
  }

  function renderTafsirCard(t) {
    const tags = (t.tags || []).map(tag => `<span class="tag-pill">${UI.escapeHtml(tag)}</span>`).join(' ');
    return `
      <div class="card tafsir-card" style="margin-bottom:12px" data-tafsir-id="${t.id}">
        <div class="tafsir-content" style="white-space:pre-wrap; line-height:1.7;">${UI.escapeHtml(t.content)}</div>
        ${tags ? `<div style="margin-top:8px">${tags}</div>` : ''}
        <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
          <button class="btn btn--sm" data-add-comment data-tafsir-id="${t.id}">نظر</button>
          <button class="btn btn--sm" data-edit-tafsir data-id="${t.id}" data-content="${UI.escapeHtml(t.content)}" data-tags="${(t.tags||[]).join('، ')}">ویرایش</button>
          <button class="btn btn--sm" data-delete-tafsir data-id="${t.id}" style="color:var(--danger)">حذف</button>
        </div>
        <div class="comments-box" id="comments-${t.id}" style="margin-top:10px;"></div>
      </div>
    `;
  }

  async function openCommentForm(tafsirId) {
    const box = document.getElementById(`comments-${tafsirId}`);
    if (!box) return;
    // Load existing comments
    try {
      const comments = await Store.getComments(tafsirId);
      let html = comments.map(c => `
        <div style="padding:8px 0; border-bottom:1px solid var(--border-soft); font-size:0.9rem;">
          <strong>${UI.escapeHtml(c.guest_name || 'ناشناس')}</strong>
          <span style="color:var(--text-faint); font-size:0.75rem; margin-right:6px;">${new Date(c.created_at).toLocaleDateString('fa-IR')}</span>
          <div style="margin-top:4px;">${UI.escapeHtml(c.content)}</div>
        </div>
      `).join('');
      html += `
        <form class="comment-form" data-tafsir="${tafsirId}" style="margin-top:10px;">
          <input type="text" name="name" placeholder="نام (اختیاری)" style="width:100%; margin-bottom:6px;" maxlength="60" />
          <textarea name="content" rows="2" placeholder="نظر شما…" required style="width:100%;"></textarea>
          <button type="submit" class="btn btn--sm btn--primary" style="margin-top:6px;">ارسال نظر</button>
        </form>
      `;
      box.innerHTML = html;
      box.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const guestName = (fd.get('name') || 'ناشناس').trim() || 'ناشناس';
        const content = (fd.get('content') || '').trim();
        if (!content) return;
        try {
          await Store.addComment({ tafsirId, guestName, content });
          UI.toast('نظر ثبت شد');
          openCommentForm(tafsirId); // re-render without page refresh
        } catch (err) {
          UI.toast('خطا در ثبت نظر');
        }
      });
    } catch (e) {
      box.innerHTML = '<p style="color:var(--danger)">خطا</p>';
    }
  }

  function startEdit(id, content, tags) {
    editingId = id;
    document.getElementById('tafsirContent').value = content;
    document.getElementById('tafsirTags').value = tags || '';
    document.getElementById('editBanner').hidden = false;
    document.getElementById('submitBtn').textContent = 'ذخیره تغییرات';
    document.getElementById('tafsirContent').focus();
  }

  function cancelEdit() {
    editingId = null;
    document.getElementById('tafsirForm').reset();
    document.getElementById('editBanner').hidden = true;
    document.getElementById('submitBtn').textContent = 'ثبت تفسیر';
  }

  // --- Selectors ---
  async function populateSelects() {
    UI.populateSurahSelect(document.getElementById('formSurahSelect'), index, current.surah);
    const surah = index.find(s => s.number === current.surah);
    UI.populateAyahSelect(document.getElementById('formAyahSelect'), surah?.ayah_count || 7, current.ayah);
  }

  // --- Events ---
  document.getElementById('formSurahSelect').addEventListener('change', async (e) => {
    current.surah = +e.target.value;
    current.ayah = 1;
    await populateSelects();
    await renderAyah();
    await loadTafsirs();
  });
  document.getElementById('formAyahSelect').addEventListener('change', async (e) => {
    current.ayah = +e.target.value;
    await renderAyah();
    await loadTafsirs();
  });
  document.getElementById('workPrevBtn').addEventListener('click', async () => {
    if (current.ayah > 1) current.ayah--;
    else if (current.surah > 1) {
      current.surah--;
      const s = index.find(x => x.number === current.surah);
      current.ayah = s?.ayah_count || 1;
    }
    await populateSelects();
    await renderAyah();
    await loadTafsirs();
  });
  document.getElementById('workNextBtn').addEventListener('click', async () => {
    const s = index.find(x => x.number === current.surah);
    if (current.ayah < (s?.ayah_count || 1)) current.ayah++;
    else if (current.surah < 114) {
      current.surah++;
      current.ayah = 1;
    }
    await populateSelects();
    await renderAyah();
    await loadTafsirs();
  });

  document.getElementById('tafsirForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = document.getElementById('tafsirContent').value.trim();
    const tagsRaw = document.getElementById('tafsirTags').value.trim();
    const tags = tagsRaw ? tagsRaw.split(/[,،]/).map(t => t.trim()).filter(Boolean) : [];
    if (!content) return;
    try {
      if (editingId) {
        await Store.updateTafsir(editingId, content, tags);
        UI.toast('ویرایش شد');
      } else {
        await Store.addTafsir({ surah: current.surah, ayah: current.ayah, content, tags });
        UI.toast('تفسیر ثبت شد');
      }
      cancelEdit();
      await loadTafsirs();
      // update progress count etc without refresh
    } catch (err) {
      UI.toast('خطا در ذخیره');
      console.error(err);
    }
  });

  document.querySelector('[data-cancel-edit]')?.addEventListener('click', cancelEdit);

  // Progress (simplified)
  async function updateProgress() {
    try {
      const meta = await Store.getSiteMeta?.() || { current_round: 1, bookmark_surah: 1, bookmark_ayah: 1 };
      document.getElementById('roundNumber').textContent = UI.toPersianDigits(meta.current_round || 1);
      const name = index.find(s => s.number === (meta.bookmark_surah || 1))?.name_fa || '';
      document.getElementById('bookmarkLabel').textContent = `نشانگر: سورهٔ ${name}، آیهٔ ${UI.toPersianDigits(meta.bookmark_ayah || 1)}`;
      const cum = await QuranData.cumulativeIndex(meta.bookmark_surah || 1, meta.bookmark_ayah || 1);
      const pct = ((cum / QuranData.TOTAL_AYAHS) * 100);
      UI.setProgressRing(document.getElementById('progressRing'), pct, document.getElementById('progressLabel'));
    } catch (e) {}
  }

  // Init
  await loadIndex();
  // Try to restore from URL params or bookmark
  const hashParams = new URLSearchParams(location.hash.split('?')[1] || '');
  if (hashParams.get('surah')) current.surah = +hashParams.get('surah');
  if (hashParams.get('ayah')) current.ayah = +hashParams.get('ayah');

  await populateSelects();
  await renderAyah();
  await loadTafsirs();
  await updateProgress();
};

window.Views = Views;
