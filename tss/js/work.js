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
  let detectedLink = null;
  let currentAiTafsirId = null;
  let currentAiTafsirContent = '';
  let currentAiContent = '';
  let currentAiModel = '';

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

      // Attach event listeners for the dynamic content
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
  function openAiReview(tafsir) {
    currentAiTafsirId = tafsir.id;
    currentAiTafsirContent = tafsir.content;
    currentAiContent = '';
    currentAiModel = '';
    aiReviewModal.hidden = false;
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
        showAiState('empty');
      }
    }).catch(err => {
      console.error(err);
      showAiState('empty');
    });
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
        showAiState('content');
      } else {
        showAiState('empty');
      }
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

  // AI Review Listeners
  aiReviewCloseBtn.addEventListener('click', closeAiModal);
  if (aiReviewStartBtn) aiReviewStartBtn.addEventListener('click', generateAiReview);
  aiReviewRefreshBtn.addEventListener('click', generateAiReview);
  aiReviewEditBtn.addEventListener('click', () => { aiReviewEditArea.value = currentAiContent; showAiState('edit'); });
  aiReviewCancelEditBtn.addEventListener('click', () => showAiState('content'));
  aiReviewSaveBtn.addEventListener('click', async () => {
    const newContent = aiReviewEditArea.value.trim();
    if (!newContent) return;
    await Store.saveAiReview(currentAiTafsirId, newContent, currentAiModel);
    currentAiContent = newContent;
    aiReviewText.innerHTML = renderMarkdown(newContent);
    showAiState('content');
  });

  // Initialize UI
  await renderCurrentAyah();
})();
