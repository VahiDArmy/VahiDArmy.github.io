// =============================================================
// صفحهٔ کار — یک «آیهٔ در حال کار» واحد
// =============================================================
(async function () {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn && typeof Auth !== 'undefined') {
    logoutBtn.addEventListener('click', async () => {
      await Auth.signOut();
      location.href = 'login.html';
    });
  }

  const stickyFrame = document.getElementById('workAyahFrame');
  const selectRow = { surah: document.getElementById('formSurahSelect'), ayah: document.getElementById('formAyahSelect') };
  const prevBtn = document.getElementById('workPrevBtn');
  const nextBtn = document.getElementById('workNextBtn');
  const tafsirsListEl = document.getElementById('workTafsirsList');
  const tafsirForm = document.getElementById('tafsirForm');
  const tafsirContent = document.getElementById('tafsirContent');
  const tafsirTags = document.getElementById('tafsirTags');
  const editBanner = document.getElementById('editBanner');
  const submitBtn = document.getElementById('submitBtn');

  const ravanTafsirEmpty = document.getElementById('ravanTafsirEmpty');
  const ravanTafsirContent = document.getElementById('ravanTafsirContent');
  const ravanTafsirLoading = document.getElementById('ravanTafsirLoading');
  const ravanTafsirError = document.getElementById('ravanTafsirError');
  const ravanTafsirLoadBtn = document.getElementById('ravanTafsirLoadBtn');
  const ravanTafsirDeleteBtn = document.getElementById('ravanTafsirDeleteBtn');
  const ravanTafsirManualBtn = document.getElementById('ravanTafsirManualBtn');
  const ravanTafsirManualInput = document.getElementById('ravanTafsirManualInput');

  const aiReviewModal = document.getElementById('aiReviewModal');
  const aiReviewCloseBtn = document.getElementById('aiReviewCloseBtn');
  const aiReviewLoading = document.getElementById('aiReviewLoading');
  const aiReviewEmpty = document.getElementById('aiReviewEmpty');
  const aiReviewStartBtn = document.getElementById('aiReviewStartBtn');
  const aiReviewContent = document.getElementById('aiReviewContent');
  const aiReviewText = document.getElementById('aiReviewText');
  const aiReviewEdit = document.getElementById('aiReviewEdit');
  const aiReviewEditArea = document.getElementById('aiReviewEditArea');
  const aiReviewActions = document.getElementById('aiReviewActions');
  const aiReviewRefreshBtn = document.getElementById('aiReviewRefreshBtn');
  const aiReviewEditBtn = document.getElementById('aiReviewEditBtn');
  const aiReviewSaveBtn = document.getElementById('aiReviewSaveBtn');
  const aiReviewCancelEditBtn = document.getElementById('aiReviewCancelEditBtn');
  const aiReviewDeleteBtn = document.getElementById('aiReviewDeleteBtn');
  const aiFunctionSelect = document.getElementById('aiFunctionSelect');
  const aiReviewModelBadge = document.getElementById('aiReviewModelBadge');
  const aiReviewExternalLinks = document.getElementById('aiReviewExternalLinks');
  const aiReviewFeedback = document.getElementById('aiReviewFeedback');

  let editingId = null;
  let current = { surah: 1, ayah: 1 };
  let currentAiTafsirId = null;
  let currentAiTafsirContent = '';
  let currentAiContent = '';
  let currentAiModel = '';
  let currentAiGenerationId = null;

  const openLinkToolBtn = document.getElementById('openLinkToolBtn');
  const linkToolModal = document.getElementById('linkToolModal');
  const cancelLinkBtn = document.getElementById('cancelLinkBtn');
  const linkSurahSelect = document.getElementById('linkSurahSelect');
  const linkAyahSelect = document.getElementById('linkAyahSelect');
  const linkAyahPreview = document.getElementById('linkAyahPreview');
  const insertLinkBtn = document.getElementById('insertLinkBtn');

  let index = [];
  try {
    index = await QuranData.getIndex();
    UI.populateSurahSelect(selectRow.surah, index, 1);
  } catch (e) { console.error(e); }

  const params = new URLSearchParams(location.search);
  if (params.has('surah') && params.has('ayah')) {
    current = { surah: Number(params.get('surah')), ayah: Number(params.get('ayah')) };
  } else {
    try {
      const meta = await Store.getSiteMeta();
      if (meta && meta.bookmark_surah) current = { surah: meta.bookmark_surah, ayah: meta.bookmark_ayah };
    } catch (e) {}
  }

  function insertAtCursor(textarea, text) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(end);
    const newPos = start + text.length;
    textarea.setSelectionRange(newPos, newPos);
    textarea.focus();
  }

  function replaceAtCursor(textarea, start, end, text) {
    textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(end);
    const newPos = start + text.length;
    textarea.setSelectionRange(newPos, newPos);
    textarea.focus();
  }

  function parseTags(str) {
    return Array.from(new Set(str.split(/[,،]/).map(t => t.trim()).filter(Boolean)));
  }

  // ---- Link tool ----
  const LINK_TOKEN_RE = /\[\[(\d{1,3}):(\d{1,3})(?:\|([^\]]{1,120}))?\]\]/g;
  const LINK_BTN_DEFAULT = '﹢ لینک به آیهٔ دیگر';
  let detectedLink = null;

  // ★ وضعیت انتخاب متن در پیش‌نمایش (برای حفظ انتخاب قبل از کلیک روی دکمه)
  let savedExcerpt = null;
  let lastPreviewKey = null;

  function ensureExcerptBar() {
    let bar = document.getElementById('linkExcerptBar');
    if (bar) return bar;
    if (!linkAyahPreview || !linkAyahPreview.parentNode) return null;
    bar = document.createElement('div');
    bar.id = 'linkExcerptBar';
    bar.style.cssText =
      'display:none; font-size:0.78rem; padding:8px 12px; margin:0 0 10px; ' +
      'background:var(--violet-glow); color:var(--violet); border-radius:10px; line-height:1.8;';
    linkAyahPreview.parentNode.insertBefore(bar, linkAyahPreview.nextSibling);
    return bar;
  }

  function paintExcerptBar() {
    const bar = ensureExcerptBar();
    if (!bar) return;
    if (!savedExcerpt) {
      bar.style.display = 'none';
      bar.innerHTML = '';
      return;
    }
    bar.style.display = 'block';
    bar.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = 'گزیدهٔ انتخابی: «';
    const b = document.createElement('b');
    b.textContent = savedExcerpt;
    const span2 = document.createElement('span');
    span2.textContent = '»';
    const clr = document.createElement('button');
    clr.type = 'button';
    clr.textContent = 'پاک کردن';
    clr.style.cssText = 'all:unset; cursor:pointer; margin-inline-start:8px; text-decoration:underline; font-size:0.72rem;';
    clr.addEventListener('click', () => {
      savedExcerpt = null;
      paintExcerptBar();
    });
    bar.appendChild(span);
    bar.appendChild(b);
    bar.appendChild(span2);
    bar.appendChild(clr);
  }

  function captureSelection() {
    if (!linkAyahPreview) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const anchor = sel.anchorNode;
    if (!anchor) return;
    if (!linkAyahPreview.contains(anchor)) return;
    const text = sel.toString().replace(/\s+/g, ' ').trim();
    if (!text) return;
    savedExcerpt = text.length > 120 ? text.slice(0, 120) : text;
    paintExcerptBar();
  }

  // گوش دادن به تغییر انتخاب تا وقتی پاپ‌آپ باز است
  document.addEventListener('selectionchange', () => {
    if (linkToolModal && !linkToolModal.hidden) captureSelection();
  });
  if (linkAyahPreview) {
    linkAyahPreview.addEventListener('mouseup', captureSelection);
    linkAyahPreview.addEventListener('keyup', captureSelection);
  }

  function findLinkAtCursor(text, pos) {
    LINK_TOKEN_RE.lastIndex = 0;
    let m;
    while ((m = LINK_TOKEN_RE.exec(text))) {
      const start = m.index;
      const end = start + m[0].length;
      if (pos >= start && pos <= end) {
        return {
          start, end,
          surah: Number(m[1]), ayah: Number(m[2]),
          excerpt: m[3] ? m[3].trim() : null,
          raw: m[0],
        };
      }
    }
    return null;
  }

  function updateLinkButtonState(opts = {}) {
    if (!openLinkToolBtn || !tafsirContent) return;
    const pos = tafsirContent.selectionStart ?? 0;
    const found = findLinkAtCursor(tafsirContent.value, pos);

    if (found) {
      detectedLink = found;
      const nameFa = (index.find((s) => s.number === found.surah) || {}).name_fa || found.surah;
      openLinkToolBtn.textContent = `✎ ویرایش لینک · سورهٔ ${nameFa}، آیهٔ ${UI.toPersianDigits(found.ayah)}`;
      openLinkToolBtn.classList.add('is-editing-link');
      tafsirContent.classList.add('has-link-under-cursor');
      if (opts.selectToken && document.activeElement === tafsirContent) {
        const already = tafsirContent.selectionStart === found.start && tafsirContent.selectionEnd === found.end;
        if (!already) tafsirContent.setSelectionRange(found.start, found.end);
      }
    } else {
      detectedLink = null;
      openLinkToolBtn.textContent = LINK_BTN_DEFAULT;
      openLinkToolBtn.classList.remove('is-editing-link');
      tafsirContent.classList.remove('has-link-under-cursor');
    }
  }

  function selectDetectedLink() {
    if (!detectedLink || !tafsirContent) return;
    tafsirContent.focus();
    tafsirContent.setSelectionRange(detectedLink.start, detectedLink.end);
  }

  async function updateLinkPreview() {
    if (!linkAyahPreview || !linkSurahSelect || !linkAyahSelect) return;
    const surah = Number(linkSurahSelect.value);
    const ayah = Number(linkAyahSelect.value);
    if (!surah || !ayah) { linkAyahPreview.textContent = ''; return; }

    // اگر آیه عوض شد، گزیدهٔ قبلی معنی ندارد
    const key = surah + ':' + ayah;
    if (key !== lastPreviewKey) {
      savedExcerpt = null;
      lastPreviewKey = key;
      paintExcerptBar();
    }

    try {
      const surahData = await QuranData.getSurah(surah);
      const ayahObj = surahData.ayahs.find((a) => a.v === ayah);
      const nameFa = (index.find((s) => s.number === surah) || {}).name_fa || surah;
      if (ayahObj) {
        linkAyahPreview.innerHTML =
          `<div style="font-family:var(--font-quran); font-size:1.15rem; line-height:2; text-align:center; margin-bottom:8px;">${ayahObj.ar}</div>` +
          `<div style="font-size:0.82rem; color:var(--text-dim); line-height:1.7;">${ayahObj.fa || ''}</div>` +
          `<div style="font-size:0.72rem; color:var(--text-faint); margin-top:6px;">سورهٔ ${nameFa} · آیهٔ ${UI.toPersianDigits(ayah)}</div>`;
      } else {
        linkAyahPreview.textContent = 'آیه یافت نشد.';
      }
    } catch (e) { linkAyahPreview.textContent = 'خطا در بارگذاری آیه.'; }
  }

  async function openLinkTool() {
    if (!linkToolModal || !linkSurahSelect || !linkAyahSelect) return;
    const editing = detectedLink;
    const initSurah = editing ? editing.surah : current.surah;
    const initAyah = editing ? editing.ayah : current.ayah;
    if (editing) selectDetectedLink();

    // ریست وضعیت انتخاب
    savedExcerpt = null;
    lastPreviewKey = null;
    paintExcerptBar();

    UI.populateSurahSelect(linkSurahSelect, index, initSurah);
    const surahData = await QuranData.getSurah(initSurah);
    UI.populateAyahSelect(linkAyahSelect, surahData.ayah_count, initAyah);
    linkToolModal.hidden = false;
    await updateLinkPreview();
    if (insertLinkBtn) insertLinkBtn.textContent = editing ? 'به‌روزرسانی لینک' : 'درج لینک';
  }

  function closeLinkTool() {
    if (linkToolModal) linkToolModal.hidden = true;
    if (insertLinkBtn) insertLinkBtn.textContent = 'درج لینک';
    savedExcerpt = null;
    lastPreviewKey = null;
    paintExcerptBar();
  }

  function insertLinkFromTool() {
    if (!linkSurahSelect || !linkAyahSelect || !tafsirContent) return;
    const surah = Number(linkSurahSelect.value);
    const ayah = Number(linkAyahSelect.value);
    if (!surah || !ayah) return;

    // ★ از گزیدهٔ ذخیره‌شده استفاده کن (نه انتخاب لحظه‌ای که با کلیک از دست رفته)
    let excerpt = null;
    if (savedExcerpt && savedExcerpt.length > 0 && savedExcerpt.length <= 120) {
      excerpt = savedExcerpt;
    }

    const token = AyahLinks.makeToken(surah, ayah, excerpt);

    if (detectedLink) {
      replaceAtCursor(tafsirContent, detectedLink.start, detectedLink.end, token);
      UI.toast('لینک به‌روزرسانی شد');
    } else {
      insertAtCursor(tafsirContent, token);
      UI.toast(excerpt ? 'لینک با گزیده درج شد' : 'لینک آیه درج شد');
    }
    closeLinkTool();
    updateLinkButtonState();
  }

  function enterEditMode(t) {
    editingId = t.id;
    tafsirContent.value = t.content || '';
    tafsirTags.value = (t.tags || []).join('، ');
    editBanner.hidden = false;
    submitBtn.textContent = 'به‌روزرسانی تفسیر';
    tafsirContent.focus();
  }

  function exitEditMode() {
    editingId = null;
    tafsirContent.value = '';
    tafsirTags.value = '';
    editBanner.hidden = true;
    submitBtn.textContent = 'ثبت تفسیر';
  }

  function renderMarkdown(md) {
    if (!md) return '';
    if (!window.marked || !window.DOMPurify) {
      const div = document.createElement('div');
      div.textContent = md;
      return div.innerHTML.replace(/\n/g, '<br>');
    }
    const raw = marked.parse(md);
    const clean = DOMPurify.sanitize(raw, { ADD_ATTR: ['target', 'rel'] });
    const tmp = document.createElement('div');
    tmp.innerHTML = clean;
    tmp.querySelectorAll('table').forEach((table) => {
      if (table.parentElement?.classList.contains('table-scroll')) return;
      const wrap = document.createElement('div');
      wrap.className = 'table-scroll';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
    return tmp.innerHTML;
  }

  function initAiFunctionSelect() {
    if (!aiFunctionSelect || typeof CONFIG === 'undefined' || !CONFIG.AI_FUNCTIONS) return;
    const saved = localStorage.getItem('ai_fn') || CONFIG.AI_FUNCTION_DEFAULT;
    aiFunctionSelect.innerHTML = CONFIG.AI_FUNCTIONS
      .map(f => '<option value="' + f.id + '"' + (f.id === saved ? ' selected' : '') + '>' + f.label + '</option>')
      .join('');
    aiFunctionSelect.addEventListener('change', () => {
      localStorage.setItem('ai_fn', aiFunctionSelect.value);
      const label = aiFunctionSelect.options[aiFunctionSelect.selectedIndex].text;
      UI.toast('مدل به «' + label + '» تغییر کرد');
    });
  }

  function updateAiModelBadge() {
    if (!aiReviewModelBadge) return;
    if (currentAiModel) {
      aiReviewModelBadge.textContent = 'پاسخ از مدل: ' + currentAiModel;
      aiReviewModelBadge.classList.remove('hidden');
    } else {
      aiReviewModelBadge.textContent = '';
      aiReviewModelBadge.classList.add('hidden');
    }
  }

  const EXTERNAL_PROVIDERS = {
    deepseek: { url: (prompt) => 'https://chat.deepseek.com/?q=' + encodeURIComponent(prompt) + '&r=true' },
  };

  function buildExternalPrompt() {
    return "آیه " + current.ayah + "، سوره " + current.surah + "\n" +
      "در مورد این آیه:\n" +
      (currentAiTafsirContent || "") + "\n\n" +
      "اول منظور تفسیر ارائه‌شده را به زبان خودت بازگو کن، واضح و صریح، طوری که معلوم شود دقیقاً چه ادعایی مطرح شده.\n" +
      "بعد بررسی کن و تحلیل خودت را بگو. حاشیه نرو و موارد بی‌ربط را به هیچ عنوان مطرح نکن.";
  }

  function updateExternalLinks() {
    if (!aiReviewExternalLinks) return;
    if (!currentAiTafsirContent) aiReviewExternalLinks.classList.add('hidden');
    else aiReviewExternalLinks.classList.remove('hidden');
  }

  async function openExternalProvider(provider) {
    const cfg = EXTERNAL_PROVIDERS[provider];
    if (!cfg) return;
    const prompt = buildExternalPrompt();
    try {
      await navigator.clipboard.writeText(prompt);
      UI.toast('پرامپت کپی شد — در سایت باز شده Paste کنید');
    } catch (err) {}
    window.open(cfg.url(prompt), '_blank', 'noopener');
  }

  if (aiReviewExternalLinks) {
    aiReviewExternalLinks.querySelectorAll('.ai-ext-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        openExternalProvider(btn.getAttribute('data-provider'));
      });
    });
  }

  async function refreshProgress() {
    try {
      const p = await Store.getProgress();
      const surahMeta = index.find((s) => s.number === p.bookmarkSurah) || { name_fa: p.bookmarkSurah };
      document.getElementById('roundNumber').textContent = UI.toPersianDigits(p.round);
      document.getElementById('bookmarkLabel').textContent = `تا سورهٔ ${surahMeta.name_fa}، آیهٔ ${UI.toPersianDigits(p.bookmarkAyah)}`;
      document.getElementById('tafsirCountLabel').textContent = `${UI.toPersianDigits(p.tafsirCount)} تفسیر در این دور`;
      UI.setProgressRing(document.getElementById('progressRing'), p.percent, document.getElementById('progressLabel'));
    } catch (e) {}
  }

  async function renderCurrentAyah() {
    ayahSkeleton(stickyFrame);
    exitEditMode();
    try {
      const surahData = await QuranData.getSurah(current.surah);
      const ayahData = surahData.ayahs.find((a) => a.v === current.ayah) || surahData.ayahs[0];
      current.ayah = ayahData.v;
      selectRow.surah.value = current.surah;
      UI.populateAyahSelect(selectRow.ayah, surahData.ayah_count, current.ayah);

      renderAyahFrame(stickyFrame, ayahData, surahData, {
        marked: await Store.isMarked(current.surah, current.ayah).catch(() => false),
        onToggleMark: async (btn) => {
          const nowMarked = !btn.classList.contains('is-marked');
          await Store.toggleMark(current.surah, current.ayah, nowMarked);
          btn.classList.toggle('is-marked', nowMarked);
          btn.setAttribute('aria-pressed', String(nowMarked));
        },
      });

      prevBtn.disabled = current.surah === 1 && current.ayah === 1;
      nextBtn.disabled = current.surah === 114 && current.ayah === surahData.ayah_count;

      await refreshProgress();
      await renderTafsirsList();

      const dbData = await getRavanTafsirFromDB(current.surah, current.ayah);
      if (dbData?.content) showRavanTafsirState('content', dbData.content);
      else showRavanTafsirState('empty');
    } catch (error) {
      console.error(error);
      stickyFrame.innerHTML = `<p style="color:var(--danger); text-align:center;">خطا در بارگذاری آیه.</p>`;
    }
  }

  async function renderTafsirsList() {
    try {
      const tafsirs = await Store.getTafsirsForAyah(current.surah, current.ayah);
      if (!tafsirs.length) {
        tafsirsListEl.innerHTML = `<p style="color:var(--text-faint); font-size:0.85rem; text-align:center; padding:16px 0;">هنوز تفسیری برای این آیه ثبت نشده — اولین نفر باشید.</p>`;
        return;
      }
      tafsirsListEl.innerHTML = tafsirs.map((t) => {
        const date = new Date(t.created_at).toLocaleDateString('fa-IR');
        const needsClamp = t.content.length > 220 || (t.content.match(/\n/g) || []).length > 2;
        return `
        <div class="tafsir-card">
          <div class="tafsir-card__meta">
            <span class="tafsir-card__round">دور ${UI.toPersianDigits(t.round_number)}</span>
            <span>${date}</span>
          </div>
          <p class="tafsir-card__body${needsClamp ? ' is-clamped' : ''}" data-body="${t.id}">${AyahLinks.renderContent(t.content, index, (seg) => UI.highlightTags(seg, t.tags))}</p>
          ${needsClamp ? `<button class="tafsir-card__more" data-toggle="${t.id}">نمایش کامل</button>` : ''}
          ${t.tags && t.tags.length ? `<div class="tag-pills">${t.tags.map((tg) => UI.tagPill(tg, { href: `tags.html?tag=${encodeURIComponent(tg)}` })).join('')}</div>` : ''}
          <div class="tafsir-card__actions">
            <button class="ai-review-btn" data-ai="${t.id}" title="بررسی هوشمند" aria-label="بررسی هوشمند">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M18 9a6 6 0 0 1-12 0"/><path d="M12 15v4"/><path d="M8 19h8"/></svg>
            </button>
            <button class="btn btn--sm" data-edit="${t.id}">ویرایش</button>
            <button class="btn btn--sm" data-delete="${t.id}">حذف</button>
          </div>
        </div>`;
      }).join('');

      tafsirsListEl.querySelectorAll('[data-toggle]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-toggle');
          const body = tafsirsListEl.querySelector(`[data-body="${id}"]`);
          body.classList.toggle('is-clamped');
          btn.textContent = body.classList.contains('is-clamped') ? 'نمایش کامل' : 'بستن';
        });
      });

      tafsirsListEl.querySelectorAll('[data-edit]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const t = tafsirs.find((x) => x.id === btn.getAttribute('data-edit'));
          enterEditMode(t);
        });
      });

      tafsirsListEl.querySelectorAll('[data-delete]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-delete');
          if (!confirm('همین یک تفسیر حذف شود؟')) return;
          await Store.deleteTafsir(id);
          if (editingId === id) exitEditMode();
          UI.toast('تفسیر حذف شد');
          await renderTafsirsList();
          await refreshProgress();
        });
      });

      tafsirsListEl.querySelectorAll('[data-ai]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-ai');
          const t = tafsirs.find((x) => x.id === id);
          if (t) openAiReview(t);
        });
      });
    } catch (e) {
      console.error(e);
      tafsirsListEl.innerHTML = `<p style="color:var(--danger); text-align:center;">خطا در بارگذاری تفسیرها.</p>`;
    }
  }

  async function getRavanTafsirFromDB(surah, ayah) {
    const { data, error } = await sb.from('ravan_tafsirs').select('content').eq('surah', Number(surah)).eq('ayah', Number(ayah)).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function saveRavanTafsirToDB(surah, ayah, content) {
    const surahNum = Number(surah);
    const ayahNum = Number(ayah);
    const { data: existing } = await sb.from('ravan_tafsirs').select('surah').eq('surah', surahNum).eq('ayah', ayahNum).maybeSingle();
    let result;
    if (existing) {
      result = await sb.from('ravan_tafsirs').update({ content, updated_at: new Date().toISOString() }).eq('surah', surahNum).eq('ayah', ayahNum);
    } else {
      result = await sb.from('ravan_tafsirs').insert({ surah: surahNum, ayah: ayahNum, content, updated_at: new Date().toISOString() });
    }
    if (result.error) throw result.error;
  }

  function showRavanTafsirState(state, data) {
    ravanTafsirEmpty.classList.add('hidden');
    ravanTafsirLoading.classList.add('hidden');
    ravanTafsirContent.classList.add('hidden');
    ravanTafsirError.classList.add('hidden');
    ravanTafsirManualBtn.classList.add('hidden');
    ravanTafsirManualInput.classList.add('hidden');
    ravanTafsirDeleteBtn.classList.add('hidden');
    ravanTafsirLoadBtn.classList.remove('hidden');

    const pasteBox = document.getElementById('ravanTafsirManualPaste');
    if (pasteBox) pasteBox.classList.add('hidden');

    if (state === 'empty') ravanTafsirEmpty.classList.remove('hidden');
    else if (state === 'loading') ravanTafsirLoading.classList.remove('hidden');
    else if (state === 'content') {
      ravanTafsirContent.classList.remove('hidden');
      ravanTafsirContent.innerHTML = data;
      ravanTafsirDeleteBtn.classList.remove('hidden');
    }
    else if (state === 'error') {
      ravanTafsirError.classList.remove('hidden');
      ravanTafsirError.innerHTML = data;
      ravanTafsirManualBtn.classList.remove('hidden');
    }
  }

  async function loadRavanTafsir(surah, ayah) {
    showRavanTafsirState('loading');
    try {
      const dbData = await getRavanTafsirFromDB(surah, ayah);
      if (dbData?.content) { showRavanTafsirState('content', dbData.content); return; }
      showRavanTafsirState('error', `<p>تفسیر روان جاوید برای این آیه در دیتابیس نیست.</p><p style="font-size:0.8rem; color:var(--text-faint);">می‌توانید متن را مستقیماً پیست کنید.</p>`);
    } catch (error) {
      showRavanTafsirState('error', `<p>خطا در بارگذاری</p>`);
    }
  }

  function showAiState(state) {
    aiReviewLoading.classList.add('hidden');
    aiReviewEmpty.classList.add('hidden');
    aiReviewContent.classList.add('hidden');
    aiReviewEdit.classList.add('hidden');
    aiReviewActions.style.display = 'none';
    aiReviewEditBtn.style.display = '';
    aiReviewSaveBtn.style.display = 'none';
    aiReviewCancelEditBtn.style.display = 'none';
    aiReviewRefreshBtn.style.display = '';
    aiReviewDeleteBtn.style.display = '';

    if (state === 'loading') aiReviewLoading.classList.remove('hidden');
    else if (state === 'empty') aiReviewEmpty.classList.remove('hidden');
    else if (state === 'content') {
      aiReviewContent.classList.remove('hidden');
      aiReviewActions.style.display = 'flex';
    } else if (state === 'edit') {
      aiReviewEdit.classList.remove('hidden');
      aiReviewActions.style.display = 'flex';
      aiReviewEditBtn.style.display = 'none';
      aiReviewSaveBtn.style.display = '';
      aiReviewCancelEditBtn.style.display = '';
      aiReviewRefreshBtn.style.display = 'none';
      aiReviewDeleteBtn.style.display = 'none';
    }
  }

  function openAiModal() { aiReviewModal.hidden = false; }

  function closeAiModal() {
    aiReviewModal.hidden = true;
    currentAiTafsirId = null;
    currentAiTafsirContent = '';
    currentAiContent = '';
    currentAiModel = '';
    currentAiGenerationId = null;
    if (aiReviewModelBadge) aiReviewModelBadge.classList.add('hidden');
    if (aiReviewExternalLinks) aiReviewExternalLinks.classList.add('hidden');
    if (aiReviewFeedback) aiReviewFeedback.innerHTML = '';
  }

  async function openAiReview(tafsir) {
    currentAiTafsirId = tafsir.id;
    currentAiTafsirContent = tafsir.content;
    currentAiContent = '';
    currentAiModel = '';
    currentAiGenerationId = null;
    openAiModal();
    updateExternalLinks();
    showAiState('loading');

    try {
      const existing = await Store.getAiReview(tafsir.id);
      if (existing && existing.content) {
        currentAiContent = existing.content;
        aiReviewText.innerHTML = renderMarkdown(existing.content);
        const gen = await Store.getLatestGeneration('ai_review', tafsir.id);
        currentAiGenerationId = gen ? gen.id : null;
        currentAiModel = gen ? gen.model : '';
        updateAiModelBadge();
        renderAiReviewFeedback();
        showAiState('content');
      } else {
        updateAiModelBadge();
        showAiState('empty');
      }
    } catch (err) {
      console.error(err);
      updateAiModelBadge();
      showAiState('empty');
    }
  }

  async function renderAiReviewFeedback() {
    if (!aiReviewFeedback) return;
    if (!currentAiGenerationId) { aiReviewFeedback.innerHTML = ''; return; }
    const model = currentAiModel || '—';
    const scoreMap = await Store.getModelScores().catch(() => new Map());
    const sc = scoreMap.get(model)?.score || 0;
    const sign = sc > 0 ? 'pos' : sc < 0 ? 'neg' : 'zero';
    const scoreTxt = (sc > 0 ? '+' : '') + UI.toPersianDigits(sc);

    aiReviewFeedback.innerHTML = `
      <div class="ai-feedback-bar">
        <span class="ai-feedback-bar__model">
          پاسخ از: <code>${AiFormat.escapeHtml(model)}</code>
        </span>
        <span class="ai-feedback-bar__score" data-sign="${sign}">⭐ ${scoreTxt}</span>
        <div class="ai-vote-group">
          <button type="button" class="ai-vote" data-vote="1" aria-label="پسندیدم">👍</button>
          <button type="button" class="ai-vote" data-vote="-1" aria-label="نپسندیدم">👎</button>
        </div>
      </div>`;

    const genId = currentAiGenerationId;
    const mine = await Store.getMyFeedback(genId).catch(() => 0);
    aiReviewFeedback.querySelectorAll('.ai-vote').forEach((b) => {
      const v = Number(b.getAttribute('data-vote'));
      b.classList.toggle('is-active', v === mine);
    });

    aiReviewFeedback.querySelectorAll('.ai-vote').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const want = Number(btn.getAttribute('data-vote'));
        const mineNow = await Store.getMyFeedback(genId).catch(() => 0);
        const next = (mineNow === want) ? 0 : want;
        try {
          aiReviewFeedback.querySelectorAll('.ai-vote').forEach((b) => (b.disabled = true));
          await Store.setFeedback(genId, next);
          await renderAiReviewFeedback();
        } catch (e) {
          console.error(e);
          UI.toast('خطا در ثبت رأی');
        } finally {
          aiReviewFeedback.querySelectorAll('.ai-vote').forEach((b) => (b.disabled = false));
        }
      });
    });
  }

  async function generateAiReview() {
    if (!currentAiTafsirId || !currentAiTafsirContent) return;
    showAiState('loading');

    try {
      const surahData = await QuranData.getSurah(current.surah);
      const ayahObj = surahData.ayahs.find((a) => a.v === current.ayah);
      const ayahText = ayahObj ? ayahObj.ar : '';

      const result = await Store.callAiReview({
        surah: current.surah,
        ayah: current.ayah,
        ayahText,
        userOpinion: currentAiTafsirContent,
      });

      await Store.saveAiReview(currentAiTafsirId, result.content);
      currentAiContent = result.content;
      currentAiModel = result.model || '';
      aiReviewText.innerHTML = renderMarkdown(result.content);
      updateAiModelBadge();

      if (currentAiModel) {
        try {
          const gen = await Store.createGeneration({
            source: 'ai_review',
            refId: currentAiTafsirId,
            model: currentAiModel,
          });
          currentAiGenerationId = gen.id;
        } catch (e) { console.warn('generation save failed', e); }
      }

      await renderAiReviewFeedback();
      showAiState('content');
    } catch (err) {
      console.error(err);
      UI.toast('خطا در بررسی هوشمند: ' + (err.message || 'نامشخص'));
      if (currentAiContent) {
        aiReviewText.innerHTML = renderMarkdown(currentAiContent);
        updateAiModelBadge();
        await renderAiReviewFeedback();
        showAiState('content');
      } else {
        showAiState('empty');
      }
    }
  }

  function enterAiEditMode() {
    aiReviewEditArea.value = currentAiContent;
    showAiState('edit');
  }

  function cancelAiEdit() { showAiState('content'); }

  async function saveAiEdit() {
    const newContent = aiReviewEditArea.value.trim();
    if (!newContent) { UI.toast('متن خالی است'); return; }
    try {
      await Store.saveAiReview(currentAiTafsirId, newContent);
      currentAiContent = newContent;
      aiReviewText.innerHTML = renderMarkdown(newContent);
      showAiState('content');
      UI.toast('ذخیره شد');
    } catch (err) { UI.toast('خطا در ذخیره'); }
  }

  async function deleteAiReview() {
    if (!currentAiTafsirId) return;
    if (!confirm('پاسخ بررسی هوشمند حذف شود؟')) return;
    try {
      await Store.deleteAiReview(currentAiTafsirId);
      currentAiContent = '';
      currentAiModel = '';
      currentAiGenerationId = null;
      updateAiModelBadge();
      if (aiReviewFeedback) aiReviewFeedback.innerHTML = '';
      showAiState('empty');
      UI.toast('حذف شد — می‌توانید پاسخ جدید تولید کنید');
    } catch (err) { UI.toast('خطا در حذف'); }
  }

  document.getElementById('goToCurrentBtn').addEventListener('click', async () => {
    const meta = await Store.getSiteMeta();
    current = { surah: meta.bookmark_surah, ayah: meta.bookmark_ayah };
    await renderCurrentAyah();
  });

  document.getElementById('setBookmarkBtn').addEventListener('click', async () => {
    const surahName = index.find(s => s.number === current.surah)?.name_fa || current.surah;
    if (!confirm(`آیهٔ جاری (سورهٔ ${surahName}، آیهٔ ${UI.toPersianDigits(current.ayah)}) به عنوان آخرین آیهٔ بررسی‌شده ثبت شود؟`)) return;
    await sb.from('site_meta').update({ bookmark_surah: current.surah, bookmark_ayah: current.ayah }).eq('id', 1);
    UI.toast(`نشانک ثبت شد: سورهٔ ${surahName}، آیهٔ ${UI.toPersianDigits(current.ayah)} ✦`);
    await refreshProgress();
  });

  document.getElementById('endRoundBtn').addEventListener('click', async () => {
    const p = await Store.getProgress();
    if (!confirm(`دور ${UI.toPersianDigits(p.round)} بسته می‌شود و دور ${UI.toPersianDigits(p.round + 1)} شروع می‌شود. ادامه؟`)) return;
    await Store.endRound();
    UI.toast(`دور جدید آغاز شد ✦`);
    current = { surah: 1, ayah: 1 };
    await renderCurrentAyah();
  });

  selectRow.surah.addEventListener('change', async () => {
    current = { surah: Number(selectRow.surah.value), ayah: 1 };
    await renderCurrentAyah();
  });

  selectRow.ayah.addEventListener('change', async () => {
    current.ayah = Number(selectRow.ayah.value);
    await renderCurrentAyah();
  });

  prevBtn.addEventListener('click', async () => {
    if (current.ayah > 1) current.ayah -= 1;
    else if (current.surah > 1) {
      const prevSurah = await QuranData.getSurah(current.surah - 1);
      current = { surah: current.surah - 1, ayah: prevSurah.ayah_count };
    } else return;
    await renderCurrentAyah();
  });

  nextBtn.addEventListener('click', async () => {
    const surahData = await QuranData.getSurah(current.surah);
    if (current.ayah < surahData.ayah_count) current.ayah += 1;
    else if (current.surah < 114) current = { surah: current.surah + 1, ayah: 1 };
    else return;
    await renderCurrentAyah();
  });

  tafsirForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = tafsirContent.value.trim();
    if (!content) return;
    const tags = parseTags(tafsirTags.value);
    try {
      if (editingId) {
        await Store.updateTafsir(editingId, content, tags);
        await Store.syncAyahLinks(editingId, current.surah, current.ayah, AyahLinks.extract(content));
        UI.toast('تفسیر به‌روزرسانی شد');
        exitEditMode();
        await renderTafsirsList();
      } else {
        const newTafsir = await Store.addTafsir({ surah: current.surah, ayah: current.ayah, content, tags });
        await Store.syncAyahLinks(newTafsir.id, current.surah, current.ayah, AyahLinks.extract(content));
        tafsirContent.value = '';
        tafsirTags.value = '';
        await renderTafsirsList();
        await refreshProgress();
        UI.toast('تفسیر با موفقیت ثبت شد');
      }
    } catch (err) { UI.toast('خطا در ذخیره تفسیر'); }
  });

  editBanner.querySelector('[data-cancel-edit]')?.addEventListener('click', exitEditMode);

  if (openLinkToolBtn) openLinkToolBtn.addEventListener('click', openLinkTool);
  if (tafsirContent) {
    tafsirContent.addEventListener('keyup', () => updateLinkButtonState());
    tafsirContent.addEventListener('input', () => updateLinkButtonState());
    tafsirContent.addEventListener('focus', () => updateLinkButtonState());
    tafsirContent.addEventListener('click', () => {
      requestAnimationFrame(() => updateLinkButtonState({ selectToken: true }));
    });
  }
  if (cancelLinkBtn) cancelLinkBtn.addEventListener('click', closeLinkTool);
  if (linkToolModal) {
    linkToolModal.addEventListener('click', (e) => { if (e.target === linkToolModal) closeLinkTool(); });
  }
  if (linkSurahSelect) {
    linkSurahSelect.addEventListener('change', async () => {
      const surah = Number(linkSurahSelect.value);
      try {
        const surahData = await QuranData.getSurah(surah);
        UI.populateAyahSelect(linkAyahSelect, surahData.ayah_count, 1);
        await updateLinkPreview();
      } catch (e) {}
    });
  }
  if (linkAyahSelect) linkAyahSelect.addEventListener('change', updateLinkPreview);
  if (insertLinkBtn) insertLinkBtn.addEventListener('click', insertLinkFromTool);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && linkToolModal && !linkToolModal.hidden) closeLinkTool();
  });

  ravanTafsirLoadBtn.addEventListener('click', () => loadRavanTafsir(current.surah, current.ayah));
  ravanTafsirDeleteBtn.addEventListener('click', async () => {
    if (!confirm('تفسیر روان جاوید ذخیره‌شده حذف شود؟')) return;
    try {
      await sb.from('ravan_tafsirs').delete().eq('surah', current.surah).eq('ayah', current.ayah);
      showRavanTafsirState('empty');
      UI.toast('حذف شد');
    } catch (e) { UI.toast('خطا در حذف'); }
  });

  ravanTafsirManualBtn.addEventListener('click', () => {
    ravanTafsirError.classList.add('hidden');
    document.getElementById('ravanTafsirManualPaste').classList.remove('hidden');
  });

  document.getElementById('ravanTafsirPasteSave').addEventListener('click', async () => {
    const text = document.getElementById('ravanTafsirPasteArea')?.value.trim();
    if (!text) return;
    try {
      await saveRavanTafsirToDB(current.surah, current.ayah, text);
      showRavanTafsirState('content', text);
      document.getElementById('ravanTafsirManualPaste').classList.add('hidden');
      UI.toast('ذخیره شد');
    } catch (e) { UI.toast('خطا در ذخیره'); }
  });

  document.getElementById('ravanTafsirPasteCancel')?.addEventListener('click', () => {
    document.getElementById('ravanTafsirManualPaste')?.classList.add('hidden');
    document.getElementById('ravanTafsirPasteArea').value = '';
    showRavanTafsirState('empty');
  });

  aiReviewCloseBtn.addEventListener('click', closeAiModal);
  aiReviewModal.addEventListener('click', (e) => { if (e.target === aiReviewModal) closeAiModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !aiReviewModal.hidden) closeAiModal();
  });

  if (aiReviewStartBtn) aiReviewStartBtn.addEventListener('click', generateAiReview);
  aiReviewRefreshBtn.addEventListener('click', generateAiReview);
  aiReviewEditBtn.addEventListener('click', enterAiEditMode);
  aiReviewCancelEditBtn.addEventListener('click', cancelAiEdit);
  aiReviewSaveBtn.addEventListener('click', saveAiEdit);
  aiReviewDeleteBtn.addEventListener('click', deleteAiReview);

  initAiFunctionSelect();
  await renderCurrentAyah();
})();