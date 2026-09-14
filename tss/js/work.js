// =============================================================
// صفحهٔ کار — یک «آیهٔ در حال کار» واحد
// =============================================================
(async function () {
  // Safe Logout Button Logic
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn && typeof Auth !== 'undefined') {
    logoutBtn.addEventListener('click', async () => {
      await Auth.signOut();
      location.href = 'login.html';
    });
  }

  // Elements
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

  // Ravan Tafsir Elements
  const ravanTafsirEmpty = document.getElementById('ravanTafsirEmpty');
  const ravanTafsirContent = document.getElementById('ravanTafsirContent');
  const ravanTafsirLoading = document.getElementById('ravanTafsirLoading');
  const ravanTafsirError = document.getElementById('ravanTafsirError');
  const ravanTafsirLoadBtn = document.getElementById('ravanTafsirLoadBtn');
  const ravanTafsirDeleteBtn = document.getElementById('ravanTafsirDeleteBtn');
  const ravanTafsirManualBtn = document.getElementById('ravanTafsirManualBtn');
  const ravanTafsirManualInput = document.getElementById('ravanTafsirManualInput');

  // AI Review Elements
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

  // State variables
  let editingId = null;
  let current = { surah: 1, ayah: 1 };
  let currentAiTafsirId = null;
  let currentAiTafsirContent = '';
  let currentAiContent = '';
  let currentAiModel = '';

  // Link tool elements
  const openLinkToolBtn = document.getElementById('openLinkToolBtn');
  const linkToolModal = document.getElementById('linkToolModal');
  const cancelLinkBtn = document.getElementById('cancelLinkBtn');
  const linkSurahSelect = document.getElementById('linkSurahSelect');
  const linkAyahSelect = document.getElementById('linkAyahSelect');
  const linkAyahPreview = document.getElementById('linkAyahPreview');
  const insertLinkBtn = document.getElementById('insertLinkBtn');

  // Initialize Data
  let index = [];
  try {
    index = await QuranData.getIndex();
    UI.populateSurahSelect(selectRow.surah, index, 1);
  } catch (e) {
    console.error("Failed to load Quran index", e);
  }

  // Determine initial surah/ayah
  const params = new URLSearchParams(location.search);
  if (params.has('surah') && params.has('ayah')) {
    current = { surah: Number(params.get('surah')), ayah: Number(params.get('ayah')) };
  } else {
    try {
      const meta = await Store.getSiteMeta();
      if (meta && meta.bookmark_surah) {
        current = { surah: meta.bookmark_surah, ayah: meta.bookmark_ayah };
      }
    } catch (e) {
      console.warn("Could not load site meta, defaulting to 1:1");
    }
  }

  // ============================================================
  // Helper Functions
  // ============================================================
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

  // ============================================================
  // Link Tool — افزودن لینک [[سوره:آیه]] یا [[سوره:آیه|گزیده]]
  // ============================================================
  async function updateLinkPreview() {
    if (!linkAyahPreview || !linkSurahSelect || !linkAyahSelect) return;
    const surah = Number(linkSurahSelect.value);
    const ayah = Number(linkAyahSelect.value);
    if (!surah || !ayah) {
      linkAyahPreview.textContent = '';
      return;
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
    } catch (e) {
      console.error(e);
      linkAyahPreview.textContent = 'خطا در بارگذاری آیه.';
    }
  }

  async function openLinkTool() {
    if (!linkToolModal || !linkSurahSelect || !linkAyahSelect) return;
    UI.populateSurahSelect(linkSurahSelect, index, current.surah);
    const surahData = await QuranData.getSurah(current.surah);
    UI.populateAyahSelect(linkAyahSelect, surahData.ayah_count, current.ayah);
    linkToolModal.hidden = false;
    await updateLinkPreview();
  }

  function closeLinkTool() {
    if (linkToolModal) linkToolModal.hidden = true;
  }

  function insertLinkFromTool() {
    if (!linkSurahSelect || !linkAyahSelect || !tafsirContent) return;
    const surah = Number(linkSurahSelect.value);
    const ayah = Number(linkAyahSelect.value);
    if (!surah || !ayah) return;

    // اگر کاربر بخشی از پیش‌نمایش را انتخاب کرده باشد، همان را به عنوان excerpt بگیر
    let excerpt = null;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && linkAyahPreview && linkAyahPreview.contains(sel.anchorNode)) {
      const selected = sel.toString().trim();
      if (selected.length > 0 && selected.length <= 120) {
        excerpt = selected;
      }
    }

    const token = AyahLinks.makeToken(surah, ayah, excerpt);
    insertAtCursor(tafsirContent, token);
    closeLinkTool();
    UI.toast(excerpt ? 'لینک با گزیده درج شد' : 'لینک آیه درج شد');
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

  // --- Markdown Rendering ---
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

  // -------------------------------------------------------------
  // External AI providers
  // -------------------------------------------------------------
  const EXTERNAL_PROVIDERS = {
    deepseek: { url: (prompt) => 'https://chat.deepseek.com/?q=' + encodeURIComponent(prompt) + '&r=true' },
    glm: { url: (prompt) => 'https://chatglm.cn/main/alltoolsdetail?q=' + encodeURIComponent(prompt) },
    kimi: { url: (prompt) => 'https://www.kimi.ai/?q=' + encodeURIComponent(prompt) },
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
    if (!currentAiTafsirContent) {
      aiReviewExternalLinks.classList.add('hidden');
      return;
    }
    aiReviewExternalLinks.classList.remove('hidden');
  }

  async function openExternalProvider(provider) {
    const cfg = EXTERNAL_PROVIDERS[provider];
    if (!cfg) return;

    const prompt = buildExternalPrompt();

    try {
      await navigator.clipboard.writeText(prompt);
      UI.toast('پرامپت کپی شد — در سایت باز شده Paste کنید');
    } catch (err) {
      console.warn('Clipboard failed', err);
    }
    window.open(cfg.url(prompt), '_blank', 'noopener');
  }

  if (aiReviewExternalLinks) {
    aiReviewExternalLinks.querySelectorAll('.ai-ext-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        openExternalProvider(btn.getAttribute('data-provider'));
      });
    });
  }

  // ============================================================
  // Main Render Functions
  // ============================================================
  async function refreshProgress() {
    try {
      const p = await Store.getProgress();
      const surahMeta = index.find((s) => s.number === p.bookmarkSurah) || { name_fa: p.bookmarkSurah };
      document.getElementById('roundNumber').textContent = UI.toPersianDigits(p.round);
      document.getElementById('bookmarkLabel').textContent = `تا سورهٔ ${surahMeta.name_fa}، آیهٔ ${UI.toPersianDigits(p.bookmarkAyah)}`;
      document.getElementById('tafsirCountLabel').textContent = `${UI.toPersianDigits(p.tafsirCount)} تفسیر در این دور`;
      UI.setProgressRing(document.getElementById('progressRing'), p.percent, document.getElementById('progressLabel'));
    } catch (e) {
      console.warn("Could not refresh progress", e);
    }
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
      if (dbData?.content) {
        showRavanTafsirState('content', dbData.content);
      } else {
        showRavanTafsirState('empty');
      }
    } catch (error) {
      console.error("Error rendering ayah:", error);
      stickyFrame.innerHTML = `<p style="color:var(--danger); text-align:center;">خطا در بارگذاری آیه. لطفاً اتصال اینترنت خود را بررسی کنید.</p>`;
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
      console.error("Error rendering tafsirs:", e);
      tafsirsListEl.innerHTML = `<p style="color:var(--danger); text-align:center;">خطا در بارگذاری تفسیرها.</p>`;
    }
  }

  // ============================================================
  // Ravan Tafsir Logic
  // ============================================================
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
      if (dbData?.content) {
        showRavanTafsirState('content', dbData.content);
        return;
      }
      showRavanTafsirState('error', `<p>تفسیر روان جاوید برای این آیه در دیتابیس نیست.</p><p style="font-size:0.8rem; color:var(--text-faint);">می‌توانید متن را مستقیماً پیست کنید.</p>`);
    } catch (error) {
      console.error(error);
      showRavanTafsirState('error', `<p>خطا در بارگذاری</p><p style="font-size:0.8rem; color:var(--text-faint);">${error.message || 'خطای ناشناخته'}</p>`);
    }
  }

  // ============================================================
  // AI Review Logic
  // ============================================================
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

  function openAiModal() {
    aiReviewModal.hidden = false;
  }

  function closeAiModal() {
    aiReviewModal.hidden = true;
    currentAiTafsirId = null;
    currentAiTafsirContent = '';
    currentAiContent = '';
    currentAiModel = '';
    if (aiReviewModelBadge) aiReviewModelBadge.classList.add('hidden');
    if (aiReviewExternalLinks) aiReviewExternalLinks.classList.add('hidden');
  }

  function openAiReview(tafsir) {
    currentAiTafsirId = tafsir.id;
    currentAiTafsirContent = tafsir.content;
    currentAiContent = '';
    currentAiModel = '';
    openAiModal();
    updateExternalLinks();
    showAiState('loading');

    Store.getAiReview(tafsir.id).then(existing => {
      if (existing && existing.content) {
        currentAiContent = existing.content;
        currentAiModel = existing.model || '';
        aiReviewText.innerHTML = renderMarkdown(existing.content);
        updateAiModelBadge();
        showAiState('content');
      } else {
        updateAiModelBadge();
        showAiState('empty');
      }
    }).catch(err => {
      console.error(err);
      updateAiModelBadge();
      showAiState('empty');
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

      await Store.saveAiReview(currentAiTafsirId, result.content, result.model);
      currentAiContent = result.content;
      currentAiModel = result.model || '';
      aiReviewText.innerHTML = renderMarkdown(result.content);
      updateAiModelBadge();
      showAiState('content');
    } catch (err) {
      console.error(err);
      UI.toast('خطا در بررسی هوشمند: ' + (err.message || 'نامشخص'));
      if (currentAiContent) {
        aiReviewText.innerHTML = renderMarkdown(currentAiContent);
        updateAiModelBadge();
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

  function cancelAiEdit() {
    showAiState('content');
  }

  async function saveAiEdit() {
    const newContent = aiReviewEditArea.value.trim();
    if (!newContent) {
      UI.toast('متن خالی است');
      return;
    }
    try {
      await Store.saveAiReview(currentAiTafsirId, newContent, currentAiModel);
      currentAiContent = newContent;
      aiReviewText.innerHTML = renderMarkdown(newContent);
      showAiState('content');
      UI.toast('ذخیره شد');
    } catch (err) {
      console.error(err);
      UI.toast('خطا در ذخیره');
    }
  }

  async function deleteAiReview() {
    if (!currentAiTafsirId) return;
    if (!confirm('پاسخ بررسی هوشمند حذف شود؟')) return;
    try {
      await Store.deleteAiReview(currentAiTafsirId);
      currentAiContent = '';
      currentAiModel = '';
      updateAiModelBadge();
      showAiState('empty');
      UI.toast('حذف شد — می‌توانید پاسخ جدید تولید کنید');
    } catch (err) {
      console.error(err);
      UI.toast('خطا در حذف');
    }
  }

  // ============================================================
  // Event Listeners Initialization
  // ============================================================

  // Navigation
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

  // Form Submission
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
    } catch (err) {
      console.error(err);
      UI.toast('خطا در ذخیره تفسیر');
    }
  });

  // Cancel edit button
  editBanner.querySelector('[data-cancel-edit]')?.addEventListener('click', exitEditMode);

  // ---- Link Tool listeners ----
  if (openLinkToolBtn) {
    openLinkToolBtn.addEventListener('click', openLinkTool);
  }
  if (cancelLinkBtn) {
    cancelLinkBtn.addEventListener('click', closeLinkTool);
  }
  if (linkToolModal) {
    linkToolModal.addEventListener('click', (e) => {
      if (e.target === linkToolModal) closeLinkTool();
    });
  }
  if (linkSurahSelect) {
    linkSurahSelect.addEventListener('change', async () => {
      const surah = Number(linkSurahSelect.value);
      try {
        const surahData = await QuranData.getSurah(surah);
        UI.populateAyahSelect(linkAyahSelect, surahData.ayah_count, 1);
        await updateLinkPreview();
      } catch (e) {
        console.error(e);
      }
    });
  }
  if (linkAyahSelect) {
    linkAyahSelect.addEventListener('change', updateLinkPreview);
  }
  if (insertLinkBtn) {
    insertLinkBtn.addEventListener('click', insertLinkFromTool);
  }
  // Escape closes link modal too
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && linkToolModal && !linkToolModal.hidden) {
      closeLinkTool();
    }
  });

  // Ravan Tafsir Listeners
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

  // --- AI Review Listeners ---
  aiReviewCloseBtn.addEventListener('click', closeAiModal);

  // Click outside the modal card to close
  aiReviewModal.addEventListener('click', (e) => {
    if (e.target === aiReviewModal) closeAiModal();
  });

  // Escape key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !aiReviewModal.hidden) closeAiModal();
  });

  if (aiReviewStartBtn) aiReviewStartBtn.addEventListener('click', generateAiReview);
  aiReviewRefreshBtn.addEventListener('click', generateAiReview);
  aiReviewEditBtn.addEventListener('click', enterAiEditMode);
  aiReviewCancelEditBtn.addEventListener('click', cancelAiEdit);
  aiReviewSaveBtn.addEventListener('click', saveAiEdit);
  aiReviewDeleteBtn.addEventListener('click', deleteAiReview);   // 👈 این خط قبلاً نبود

  // Initialize UI
  initAiFunctionSelect();
  await renderCurrentAyah();
})();