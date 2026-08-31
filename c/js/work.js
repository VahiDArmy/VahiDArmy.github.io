// =============================================================
// صفحهٔ کار — یک «آیهٔ در حال کار» واحد که هم می‌شود بهش تفسیر جدید
// اضافه کرد، هم تفسیرهای قبلی‌اش را دید/ویرایش/حذف کرد، هم با دکمهٔ
// بعدی/قبلی جابه‌جا شد. پیش‌فرض: آخرین آیه‌ای که رویش تفسیر ثبت شده.
// =============================================================
(async function () {
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

  // ---- Link tool elements ----
  const linkToolModal = document.getElementById('linkToolModal');
  const openLinkToolBtn = document.getElementById('openLinkToolBtn');
  const cancelLinkBtn = document.getElementById('cancelLinkBtn');
  const insertLinkBtn = document.getElementById('insertLinkBtn');
  const linkSurahSelect = document.getElementById('linkSurahSelect');
  const linkAyahSelect = document.getElementById('linkAyahSelect');
  const linkAyahPreview = document.getElementById('linkAyahPreview');

  function parseTags(str) {
    return Array.from(
      new Set(
        str
          .split(/[,،]/)
          .map((t) => t.trim())
          .filter(Boolean)
      )
    );
  }

  let editingId = null;
  let current = { surah: 1, ayah: 1 };
  let index = null; // will be populated

  ayahSkeleton(stickyFrame);
  index = await QuranData.getIndex();
  UI.populateSurahSelect(selectRow.surah, index, 1);

  // --- تعیین آیهٔ شروع: از URL، وگرنه نشانک خواندن ---
  const params = new URLSearchParams(location.search);
  if (params.has('surah') && params.has('ayah')) {
    current = { surah: Number(params.get('surah')), ayah: Number(params.get('ayah')) };
  } else {
    const meta = await Store.getSiteMeta();
    current = { surah: meta.bookmark_surah, ayah: meta.bookmark_ayah };
  }

  async function refreshProgress() {
    const p = await Store.getProgress();
    const surahMeta = (await QuranData.getIndex()).find((s) => s.number === p.bookmarkSurah);
    document.getElementById('roundNumber').textContent = UI.toPersianDigits(p.round);
    document.getElementById('bookmarkLabel').textContent =
      `تا سورهٔ ${surahMeta.name_fa}، آیهٔ ${UI.toPersianDigits(p.bookmarkAyah)}`;
    document.getElementById('tafsirCountLabel').textContent =
      `${UI.toPersianDigits(p.tafsirCount)} تفسیر در این دور`;
    UI.setProgressRing(document.getElementById('progressRing'), p.percent, document.getElementById('progressLabel'));
    return p;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function exitEditMode() {
    editingId = null;
    editBanner.hidden = true;
    tafsirContent.value = '';
    tafsirTags.value = '';
    submitBtn.textContent = 'ثبت تفسیر';
  }

  function enterEditMode(t) {
    editingId = t.id;
    editBanner.hidden = false;
    tafsirContent.value = t.content;
    tafsirTags.value = (t.tags || []).join(', ');
    submitBtn.textContent = 'به‌روزرسانی تفسیر';
    tafsirContent.scrollIntoView({ behavior: 'smooth', block: 'center' });
    tafsirContent.focus();
  }

  async function renderCurrentAyah() {
    ayahSkeleton(stickyFrame);
    exitEditMode();

    const surahData = await QuranData.getSurah(current.surah);
    const ayahData = surahData.ayahs.find((a) => a.v === current.ayah) || surahData.ayahs[0];
    current.ayah = ayahData.v;

    selectRow.surah.value = current.surah;
    UI.populateAyahSelect(selectRow.ayah, surahData.ayah_count, current.ayah);

    renderAyahFrame(stickyFrame, ayahData, surahData, {
      marked: await Store.isMarked(current.surah, current.ayah),
      onToggleMark: async (btn) => {
        const nowMarked = !btn.classList.contains('is-marked');
        await Store.toggleMark(current.surah, current.ayah, nowMarked);
        btn.classList.toggle('is-marked', nowMarked);
        btn.setAttribute('aria-pressed', String(nowMarked));
      },
    });

    prevBtn.disabled = current.surah === 1 && current.ayah === 1;
    nextBtn.disabled = current.surah === 114 && current.ayah === surahData.ayah_count;

    await Store.advanceBookmarkIfAhead(current.surah, current.ayah);
    await refreshProgress();
    await renderTafsirsList();
  }

  async function renderTafsirsList() {
    const tafsirs = await Store.getTafsirsForAyah(current.surah, current.ayah);
    if (!tafsirs.length) {
      tafsirsListEl.innerHTML = `<p style="color:var(--text-faint); font-size:0.85rem; text-align:center; padding:16px 0;">هنوز تفسیری برای این آیه ثبت نشده — اولین نفر باشید.</p>`;
      return;
    }
    tafsirsListEl.innerHTML = tafsirs
      .map((t) => {
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
          ${
            t.tags && t.tags.length
              ? `<div class="tag-pills">${t.tags
                  .map((tg) => UI.tagPill(tg, { href: `tags.html?tag=${encodeURIComponent(tg)}` }))
                  .join('')}</div>`
              : ''
          }
          <div class="tafsir-card__actions">
            <button class="btn btn--sm" data-edit="${t.id}">ویرایش</button>
            <button class="btn btn--sm" data-delete="${t.id}">حذف</button>
          </div>
        </div>`;
      })
      .join('');

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
        if (!confirm('همین یک تفسیر حذف شود؟ (تفسیرهای دیگر این آیه دست‌نخورده می‌مانند)')) return;
        await Store.deleteTafsir(id);
        if (editingId === id) exitEditMode();
        UI.toast('تفسیر حذف شد');
        await renderTafsirsList();
        await refreshProgress();
      });
    });
  }

  editBanner.querySelector('[data-cancel-edit]').addEventListener('click', exitEditMode);

  // =============================================================
  //  LINK TOOL – improved: detect token at cursor position
  // =============================================================

  function openLinkModal() {
    linkToolModal.classList.add('is-open');
  }

  function closeLinkModal() {
    linkToolModal.classList.remove('is-open');
  }

  // Find a token that surrounds the given position (cursor)
  function findTokenAtPosition(text, pos) {
    // Look for '[[', then the token, then ']]'
    // We'll search backwards for '[[', and forwards for ']]'
    // But we need to ensure the brackets are properly matched.
    // Simpler: scan left from pos until we find '[[' or start; scan right for ']]' or end.
    let start = pos;
    let end = pos;
    // Move left to find '[[' 
    let foundOpen = false;
    while (start > 0) {
      if (text.substring(start-2, start) === '[[') {
        foundOpen = true;
        start -= 2;
        break;
      }
      start--;
    }
    if (!foundOpen) return null;
    // Move right to find ']]'
    let foundClose = false;
    while (end < text.length) {
      if (text.substring(end, end+2) === ']]') {
        foundClose = true;
        end += 2;
        break;
      }
      end++;
    }
    if (!foundClose) return null;
    // Extract the token between start and end
    const token = text.substring(start, end);
    const parsed = AyahLinks.parseToken(token);
    if (parsed) {
      return { ...parsed, start, end };
    }
    return null;
  }

  // Detect if the user has a token at cursor, or a selection
  function getTokenAtCaretOrSelection() {
    const textarea = tafsirContent;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    // If there's a selection, try to parse it as a token first
    if (start !== end) {
      const selected = textarea.value.substring(start, end);
      const parsed = AyahLinks.parseToken(selected);
      if (parsed) return { ...parsed, start, end };
    }
    // Otherwise, find token at cursor position (use start)
    return findTokenAtPosition(textarea.value, start);
  }

  // Pre-fill the modal with given surah/ayah/excerpt
  async function prefillLinkModal(surah, ayah, excerpt) {
    UI.populateSurahSelect(linkSurahSelect, index, surah);
    const surahData = await QuranData.getSurah(surah);
    UI.populateAyahSelect(linkAyahSelect, surahData.ayah_count, ayah);
    await updateLinkPreview();
    // Store the excerpt for later use
    linkToolModal.dataset.prefilledExcerpt = excerpt || '';
  }

  // Update preview when dropdowns change
  async function updateLinkPreview() {
    const s = Number(linkSurahSelect.value);
    const a = Number(linkAyahSelect.value);
    const surahData = await QuranData.getSurah(s);
    const ayahObj = surahData.ayahs.find((x) => x.v === a) || surahData.ayahs[0];
    linkAyahPreview.innerHTML = `
      <p style="margin:0 0 8px; font-family:var(--font-quran); font-size:1.15rem; line-height:2.2;">${ayahObj.ar}</p>
      <p style="margin:0; color:var(--text-dim);">${ayahObj.fa}</p>`;
  }

  // Insert or replace token in textarea
  function insertOrReplaceToken(surah, ayah, excerpt) {
    const textarea = tafsirContent;
    let start = textarea.selectionStart;
    let end = textarea.selectionEnd;
    const token = AyahLinks.makeToken(surah, ayah, excerpt);

    // If there's no selection, we might have a token at cursor (but we already set selection when we found it)
    // However, if selection length is 0, we just insert at cursor.
    if (start === end) {
      // Insert at cursor
      textarea.setRangeText(token, start, end, 'end');
    } else {
      // Replace selection
      textarea.setRangeText(token, start, end, 'end');
    }
    textarea.focus();
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ---- Link tool event handlers ----

  openLinkToolBtn.addEventListener('click', async () => {
    tafsirContent.blur();

    // Try to get token at cursor or from selection
    const tokenData = getTokenAtCaretOrSelection();
    if (tokenData) {
      // Auto-select the token in the textarea so user sees what's being replaced
      tafsirContent.setSelectionRange(tokenData.start, tokenData.end);
      await prefillLinkModal(tokenData.surah, tokenData.ayah, tokenData.excerpt);
    } else {
      // Default to current ayah
      await prefillLinkModal(current.surah, current.ayah, '');
    }
    openLinkModal();
  });

  cancelLinkBtn.addEventListener('click', closeLinkModal);

  linkToolModal.addEventListener('click', (e) => {
    if (e.target === linkToolModal && linkToolModal.classList.contains('is-open')) {
      closeLinkModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && linkToolModal.classList.contains('is-open')) closeLinkModal();
  });

  linkSurahSelect.addEventListener('change', async () => {
    const surahData = await QuranData.getSurah(Number(linkSurahSelect.value));
    UI.populateAyahSelect(linkAyahSelect, surahData.ayah_count, 1);
    await updateLinkPreview();
  });

  linkAyahSelect.addEventListener('change', updateLinkPreview);

  insertLinkBtn.addEventListener('click', () => {
    const s = Number(linkSurahSelect.value);
    const a = Number(linkAyahSelect.value);

    // Get excerpt from user selection inside the preview, if any
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : '';
    const withinPreview = selection && selection.anchorNode && linkAyahPreview.contains(selection.anchorNode);
    const excerpt = withinPreview && selectedText ? selectedText : null;

    // If the modal was pre-filled with an excerpt and user didn't select new text, keep the old excerpt
    let finalExcerpt = excerpt;
    if (!finalExcerpt && linkToolModal.dataset.prefilledExcerpt) {
      finalExcerpt = linkToolModal.dataset.prefilledExcerpt;
    }

    insertOrReplaceToken(s, a, finalExcerpt);
    closeLinkModal();
  });

  // ---- Done with link tool ----

  // --- جابه‌جایی با دراپ‌داون ---
  selectRow.surah.addEventListener('change', async () => {
    current = { surah: Number(selectRow.surah.value), ayah: 1 };
    await renderCurrentAyah();
  });
  selectRow.ayah.addEventListener('change', async () => {
    current.ayah = Number(selectRow.ayah.value);
    await renderCurrentAyah();
  });

  // --- بعدی/قبلی ---
  prevBtn.addEventListener('click', async () => {
    if (current.ayah > 1) {
      current.ayah -= 1;
    } else if (current.surah > 1) {
      const prevSurah = await QuranData.getSurah(current.surah - 1);
      current = { surah: current.surah - 1, ayah: prevSurah.ayah_count };
    } else return;
    await renderCurrentAyah();
  });
  nextBtn.addEventListener('click', async () => {
    const surahData = await QuranData.getSurah(current.surah);
    if (current.ayah < surahData.ayah_count) {
      current.ayah += 1;
    } else if (current.surah < 114) {
      current = { surah: current.surah + 1, ayah: 1 };
    } else return;
    await renderCurrentAyah();
  });

  // --- ثبت / به‌روزرسانی تفسیر ---
  tafsirForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = tafsirContent.value.trim();
    if (!content) return;
    const tags = parseTags(tafsirTags.value);

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
  });

  // ---- end round ----
  document.getElementById('endRoundBtn').addEventListener('click', async () => {
    const p = await Store.getProgress();
    const ok = confirm(
      `دور ${UI.toPersianDigits(p.round)} با پیشرفت ${UI.toPersianDigits(p.percent.toFixed(2))}٪ خواندن (${UI.toPersianDigits(p.tafsirCount)} تفسیر نوشته‌شده) بسته می‌شود و دور ${UI.toPersianDigits(p.round + 1)} از آیهٔ اول شروع می‌شود. ادامه می‌دهید؟`
    );
    if (!ok) return;
    const newRound = await Store.endRound();
    UI.toast(`دور ${UI.toPersianDigits(newRound)} آغاز شد ✦`);
    current = { surah: 1, ayah: 1 };
    await renderCurrentAyah();
  });

  // ---- initial render ----
  await renderCurrentAyah();
})();