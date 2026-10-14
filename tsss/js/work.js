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

  const mizanEmpty   = document.getElementById('mizanEmpty');
  const mizanContent = document.getElementById('mizanContent');
  const mizanLoading = document.getElementById('mizanLoading');
  const mizanError   = document.getElementById('mizanError');
  const mizanRange   = document.getElementById('mizanRange');
  const mizanSection = document.getElementById('mizanTafsirSection');

  const mizanPager    = document.getElementById('mizanPager');
  const mizanPrevBtn  = document.getElementById('mizanPrevBtn');
  const mizanNextBtn  = document.getElementById('mizanNextBtn');
  const mizanPageInfo = document.getElementById('mizanPageInfo');
  const mizanTocBtn   = document.getElementById('mizanTocBtn');
  const mizanTocModal = document.getElementById('mizanTocModal');
  const mizanTocClose = document.getElementById('mizanTocClose');
  const mizanTocList  = document.getElementById('mizanTocList');
  const mizanNoteBtn  = document.getElementById('mizanNoteAddBtn');

  const mizanNoteModal   = document.getElementById('mizanNoteModal');
  const mizanNoteClose   = document.getElementById('mizanNoteClose');
  const mizanNoteInput   = document.getElementById('mizanNoteInput');
  const mizanNoteSaveBtn = document.getElementById('mizanNoteSaveBtn');
  const mizanNoteDeleteBtn = document.getElementById('mizanNoteDeleteBtn');
  const mizanNoteQuote   = document.getElementById('mizanNoteQuote');
  const mizanNoteTitle   = document.getElementById('mizanNoteTitle');

  const mizanNotePopup   = document.getElementById('mizanNotePopup');
  const mizanNotePopupText = document.getElementById('mizanNotePopupText');
  const mizanNotePopupEdit = document.getElementById('mizanNotePopupEdit');
  const mizanNotePopupDel  = document.getElementById('mizanNotePopupDel');
  const mizanNotePopupClose = document.getElementById('mizanNotePopupClose');

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

  // Mizan state
  let mizanPages = [];
  let mizanCurrentPage = 0;
  let mizanContentKeys = [];   // content_id های فعلی
  let mizanSaveTimer = null;
  let mizanNotes = [];         // یادداشت‌های فعلی برای content_id ها
  let pendingNoteSelection = null; // { contentId, before, selected, after }
  let editingNoteId = null;
  let activePopupNoteId = null;

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

  const LINK_TOKEN_RE = /\[\[(\d{1,3}):(\d{1,3})(?:\|([^\]]{1,120}))?\]\]/g;
  const LINK_BTN_DEFAULT = '﹢ لینک به آیهٔ دیگر';
  let detectedLink = null;
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
    if (!savedExcerpt) { bar.style.display = 'none'; bar.innerHTML = ''; return; }
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
    clr.addEventListener('click', () => { savedExcerpt = null; paintExcerptBar(); });
    bar.appendChild(span); bar.appendChild(b); bar.appendChild(span2); bar.appendChild(clr);
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
    const clean = DOMPurify.sanitize(raw, {
      ADD_ATTR: ['target', 'rel', 'id'],
      ADD_TAGS: ['span'],
    });
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

  // =============================================================
  // ---- Mizan ----
  // =============================================================

  function showMizanState(state, payload) {
    mizanEmpty.classList.add('hidden');
    mizanLoading.classList.add('hidden');
    mizanContent.classList.add('hidden');
    mizanError.classList.add('hidden');
    if (mizanPager) mizanPager.classList.add('hidden');
    if (mizanRange) mizanRange.textContent = '';

    if (state === 'empty') mizanEmpty.classList.remove('hidden');
    else if (state === 'loading') mizanLoading.classList.remove('hidden');
    else if (state === 'content') {
      mizanContent.classList.remove('hidden');
      mizanContent.innerHTML = payload.html || '';
      if (mizanRange && payload.range) {
        const { from, to } = payload.range;
        mizanRange.textContent = (from === to)
          ? `آیهٔ ${UI.toPersianDigits(from)}`
          : `آیات ${UI.toPersianDigits(from)} تا ${UI.toPersianDigits(to)}`;
      }
    } else if (state === 'error') {
      mizanError.classList.remove('hidden');
      mizanError.textContent = payload.message || 'خطا در بارگذاری تفسیر المیزان';
    }
  }

  function cleanMizanText(text) {
    if (!text) return '';
    return String(text)
      .replace(/^\s*\*{4,}\s*\n+/, '')
      .replace(/\n+\s*\*{4,}\s*$/, '')
      .trim();
  }

  function normalizeMizanChars(rootEl) {
    if (!rootEl) return;
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        let p = node.parentElement;
        while (p && p !== rootEl) {
          if (p.matches && (p.matches('code.language-arabic') || p.matches('.mizan-arabic-raw'))) {
            return NodeFilter.FILTER_REJECT;
          }
          p = p.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach((textNode) => {
      textNode.nodeValue = textNode.nodeValue
        .replace(/\u0649/g, '\u06CC')
        .replace(/\u064A/g, '\u06CC')
        .replace(/\u0643/g, '\u06A9')
        .replace(/\u200B/g, '\u200C');
    });
  }

  function styleMizanAyahs(rootEl) {
    if (!rootEl) return;
    const spans = rootEl.querySelectorAll('span[id^="surah-"]');
    spans.forEach((span) => {
      const m = span.id.match(/^surah-(\d+)-ayah-(\d+)$/);
      if (!m) return;
      const ayahNum = Number(m[2]);

      let target = null;

      const parentP = (span.parentElement && span.parentElement.tagName === 'P')
        ? span.parentElement
        : null;
      if (parentP) {
        const others = Array.from(parentP.childNodes)
          .filter((n) => n !== span)
          .map((n) => n.textContent || '')
          .join('')
          .trim();
        if (others.length > 0) {
          parentP.classList.add('mizan-arabic-raw');
          target = parentP;
        }
      }

      if (!target) {
        let node = span;
        let guard = 0;
        outer: while (node && node !== rootEl && guard < 3000) {
          guard++;
          let sib = node.nextSibling;
          while (sib) {
            if (sib.nodeType === 1) {
              if (sib.tagName === 'PRE') {
                if (sib.querySelector('code.language-arabic')) { target = sib; break outer; }
              } else if (sib.tagName === 'P') {
                if (sib.contains(span)) { sib = sib.nextSibling; continue; }
                if (sib.textContent.trim() === '') { sib = sib.nextSibling; continue; }
                sib.classList.add('mizan-arabic-raw');
                target = sib; break outer;
              } else if (/^(H[1-6]|HR)$/.test(sib.tagName)) {
                break outer;
              } else if (/^(BLOCKQUOTE|UL|OL|DIV|TABLE)$/.test(sib.tagName)) {
                target = sib; break outer;
              }
            }
            sib = sib.nextSibling;
          }
          node = node.parentNode;
          if (!node) break;
        }
      }

      if (target) target.dataset.ayah = String(ayahNum);
    });
  }

  // -------------- Note injection --------------

  function findNoteAnchorInBlocks(rootEl, note) {
    // جستجو در همهٔ بلوک‌های متنی
    const blocks = rootEl.querySelectorAll('p, li, blockquote, h2, h3, h4, td, th');
    const anchorFull = (note.anchor_before || '') + note.anchor_selected + (note.anchor_after || '');
    let best = null;

    for (const block of blocks) {
      const txt = block.textContent || '';
      if (!txt) continue;

      // تلاش اول: کل قالب
      let idx = txt.indexOf(anchorFull);
      let start, end;
      if (idx !== -1) {
        start = idx + (note.anchor_before || '').length;
        end = start + note.anchor_selected.length;
      } else {
        // تلاش دوم: فقط متن انتخاب‌شده
        idx = txt.indexOf(note.anchor_selected);
        if (idx === -1) continue;
        start = idx;
        end = start + note.anchor_selected.length;
      }

      best = { block, start, end };
      break;
    }
    return best;
  }

  function wrapTextRange(block, start, end, note) {
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let n;
    while ((n = walker.nextNode())) textNodes.push(n);

    let pos = 0;
    let startNode = null, startOffset = 0;
    let endNode = null, endOffset = 0;

    for (const t of textNodes) {
      const len = t.nodeValue.length;
      if (!startNode && pos + len > start) {
        startNode = t;
        startOffset = start - pos;
      }
      if (!endNode && pos + len >= end) {
        endNode = t;
        endOffset = end - pos;
        break;
      }
      pos += len;
    }

    if (!startNode || !endNode) return false;

    const range = document.createRange();
    try {
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
    } catch (e) {
      return false;
    }

    const wrap = document.createElement('span');
    wrap.className = 'mizan-note-anchor';
    wrap.dataset.noteId = note.id;

    try {
      range.surroundContents(wrap);
    } catch (e) {
      try {
        const frag = range.extractContents();
        wrap.appendChild(frag);
        range.insertNode(wrap);
      } catch (e2) {
        return false;
      }
    }

    // شماره و نشانگر
    const sup = document.createElement('sup');
    sup.className = 'mizan-note-marker';
    sup.dataset.noteId = note.id;
    sup.textContent = String(note._num);
    sup.setAttribute('role', 'button');
    sup.setAttribute('tabindex', '0');
    sup.setAttribute('title', 'نمایش یادداشت');
    wrap.parentNode.insertBefore(sup, wrap.nextSibling);

    return true;
  }

  function injectMizanNotes(rootEl) {
    if (!rootEl || !mizanNotes.length) return;
    // شماره‌دهی بر اساس ترتیب
    mizanNotes.forEach((note, i) => { note._num = i + 1; });
    const orphans = [];
    for (const note of mizanNotes) {
      const found = findNoteAnchorInBlocks(rootEl, note);
      if (found) {
        const ok = wrapTextRange(found.block, found.start, found.end, note);
        if (!ok) orphans.push(note);
      } else {
        orphans.push(note);
      }
    }
    // یادداشت‌های بی‌قرار را در پایان لیست کن
    if (orphans.length) {
      const box = document.createElement('div');
      box.className = 'mizan-orphans';
      box.innerHTML = `
        <div class="mizan-orphans__title">یادداشت‌های بدون جای مشخص</div>
        ${orphans.map((n) => `
          <div class="mizan-orphan" data-note-id="${n.id}">
            <span class="mizan-note-marker" style="position:static; margin-inline-end:6px;">${n._num}</span>
            <span>${escapeHtml(n.anchor_selected).slice(0, 80)}</span>
          </div>
        `).join('')}
      `;
      rootEl.appendChild(box);
    }

    // اتصال به popup
    rootEl.querySelectorAll('.mizan-note-marker').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.noteId;
        const note = mizanNotes.find((n) => n.id === id);
        if (note) showNotePopup(note, el);
      });
    });
  }

  // -------------- Note popup --------------

  let popupOpenedFor = null;

  function showNotePopup(note, anchorEl) {
    if (!mizanNotePopup) return;
    activePopupNoteId = note.id;
    popupOpenedFor = anchorEl;

    mizanNotePopupText.textContent = note.note_text;

    mizanNotePopup.hidden = false;

    // موقعیت: نزدیک نشانگر، با احتیاط از لبه‌ها
    const rect = anchorEl.getBoundingClientRect();
    const popup = mizanNotePopup;
    // نمایش اولیه برای اندازه‌گیری
    popup.style.left = '-9999px';
    popup.style.top = '-9999px';
    requestAnimationFrame(() => {
      const pw = popup.offsetWidth;
      const ph = popup.offsetHeight;
      let x = rect.left + rect.width / 2 - pw / 2;
      let y = rect.bottom + 8;
      if (x < 8) x = 8;
      if (x + pw > window.innerWidth - 8) x = window.innerWidth - pw - 8;
      if (y + ph > window.innerHeight - 8) y = rect.top - ph - 8;
      if (y < 8) y = 8;
      popup.style.left = x + 'px';
      popup.style.top = y + 'px';
    });
  }

  function hideNotePopup() {
    if (!mizanNotePopup) return;
    mizanNotePopup.hidden = true;
    activePopupNoteId = null;
    popupOpenedFor = null;
  }

  if (mizanNotePopupClose) mizanNotePopupClose.addEventListener('click', hideNotePopup);
  if (mizanNotePopupEdit) mizanNotePopupEdit.addEventListener('click', () => {
    const note = mizanNotes.find((n) => n.id === activePopupNoteId);
    if (!note) return;
    hideNotePopup();
    openNoteModal({ editing: note });
  });
  if (mizanNotePopupDel) mizanNotePopupDel.addEventListener('click', async () => {
    const note = mizanNotes.find((n) => n.id === activePopupNoteId);
    if (!note) return;
    if (!confirm('این یادداشت حذف شود؟')) return;
    try {
      await Store.deleteMizanNote(note.id);
      hideNotePopup();
      UI.toast('یادداشت حذف شد');
      await reloadMizanNotesAndRerender();
    } catch (e) {
      console.error(e);
      UI.toast('خطا در حذف یادداشت');
    }
  });

  document.addEventListener('click', (e) => {
    if (!mizanNotePopup || mizanNotePopup.hidden) return;
    if (mizanNotePopup.contains(e.target)) return;
    if (e.target.classList && e.target.classList.contains('mizan-note-marker')) return;
    hideNotePopup();
  });

  // -------------- Note modal --------------

  function openNoteModal(opts = {}) {
    if (!mizanNoteModal) return;
    editingNoteId = opts.editing ? opts.editing.id : null;

    if (opts.editing) {
      mizanNoteTitle.textContent = 'ویرایش یادداشت';
      mizanNoteInput.value = opts.editing.note_text || '';
      mizanNoteQuote.textContent = opts.editing.anchor_selected || '';
      mizanNoteDeleteBtn.classList.remove('hidden');
      mizanNoteSaveBtn.textContent = 'به‌روزرسانی';
    } else {
      mizanNoteTitle.textContent = 'افزودن یادداشت';
      mizanNoteInput.value = '';
      mizanNoteQuote.textContent = pendingNoteSelection ? pendingNoteSelection.selected : '';
      mizanNoteDeleteBtn.classList.add('hidden');
      mizanNoteSaveBtn.textContent = 'ثبت یادداشت';
    }

    mizanNoteModal.hidden = false;
    setTimeout(() => mizanNoteInput.focus(), 50);
  }

  function closeNoteModal() {
    if (!mizanNoteModal) return;
    mizanNoteModal.hidden = true;
    mizanNoteInput.value = '';
    editingNoteId = null;
    pendingNoteSelection = null;
  }

  if (mizanNoteClose) mizanNoteClose.addEventListener('click', closeNoteModal);
  if (mizanNoteModal) {
    mizanNoteModal.addEventListener('click', (e) => {
      if (e.target === mizanNoteModal) closeNoteModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !mizanNoteModal.hidden) closeNoteModal();
    });
  }

  if (mizanNoteSaveBtn) mizanNoteSaveBtn.addEventListener('click', async () => {
    const text = mizanNoteInput.value.trim();
    if (!text) { UI.toast('متن یادداشت خالی است'); return; }

    try {
      if (editingNoteId) {
        await Store.updateMizanNote(editingNoteId, text);
        UI.toast('یادداشت به‌روزرسانی شد');
      } else {
        if (!pendingNoteSelection) {
          UI.toast('متن انتخاب‌شده معتبر نیست');
          return;
        }
        await Store.addMizanNote({
          contentId: pendingNoteSelection.contentId,
          anchorBefore: pendingNoteSelection.before,
          anchorSelected: pendingNoteSelection.selected,
          anchorAfter: pendingNoteSelection.after,
          noteText: text,
        });
        UI.toast('یادداشت ثبت شد');
      }
      closeNoteModal();
      await reloadMizanNotesAndRerender();
    } catch (e) {
      console.error(e);
      UI.toast('خطا: ' + (e.message || 'نامشخص'));
    }
  });

  if (mizanNoteDeleteBtn) mizanNoteDeleteBtn.addEventListener('click', async () => {
    if (!editingNoteId) return;
    if (!confirm('این یادداشت حذف شود؟')) return;
    try {
      await Store.deleteMizanNote(editingNoteId);
      closeNoteModal();
      UI.toast('یادداشت حذف شد');
      await reloadMizanNotesAndRerender();
    } catch (e) {
      console.error(e);
      UI.toast('خطا در حذف');
    }
  });

  // -------------- Selection -> add note --------------

  function getSelectionInfo() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    const selectedText = sel.toString().trim();
    if (!selectedText || selectedText.length < 2) return null;

    let block = range.commonAncestorContainer;
    if (block.nodeType === 3) block = block.parentElement;
    while (block && block !== mizanContent && !/^(P|LI|BLOCKQUOTE|H[1-6]|TD|TH)$/.test(block.tagName)) {
      block = block.parentElement;
    }
    if (!block || block === mizanContent || !/^(P|LI|BLOCKQUOTE|H[1-6]|TD|TH)$/.test(block.tagName)) return null;

    // پیدا کردن موقعیت انتخاب در متن بلوک
    const blockText = block.textContent || '';
    // از آخر انتخاب به قبل یک بازه جستجو تا نزدیک‌ترین را بیابیم
    let idx = blockText.indexOf(selectedText);
    if (idx === -1) return null;

    const before = blockText.slice(Math.max(0, idx - 40), idx);
    const after = blockText.slice(idx + selectedText.length, idx + selectedText.length + 40);

    return { block, before, selected: selectedText, after };
  }

  function showNoteAddBtn() {
    if (!mizanNoteBtn) return;
    mizanNoteBtn.hidden = false;
  }
  function hideNoteAddBtn() {
    if (!mizanNoteBtn) return;
    mizanNoteBtn.hidden = true;
  }

  document.addEventListener('selectionchange', () => {
    if (!mizanContent || mizanContent.classList.contains('hidden')) return;
    const info = getSelectionInfo();
    if (info) showNoteAddBtn();
    else hideNoteAddBtn();
  });

  if (mizanNoteBtn) mizanNoteBtn.addEventListener('click', () => {
    const info = getSelectionInfo();
    if (!info) { UI.toast('اول متن را انتخاب کنید'); return; }
    // بررسی لاگین
    sb.auth.getSession().then(({ data }) => {
      if (!data?.session) {
        UI.toast('برای افزودن یادداشت باید وارد حساب شوید');
        return;
      }
      // تعیین content_id متناسب با این بلوک
      const page = info.block.closest('.mizan-page');
      let contentId = mizanContentKeys[0] || null;
      if (page && mizanContentKeys.length > 1) {
        const idx = Array.from(mizanContent.querySelectorAll('.mizan-page')).indexOf(page);
        contentId = mizanContentKeys[idx] || mizanContentKeys[0];
      }
      if (!contentId) {
        UI.toast('خطا در تشخیص محتوا');
        return;
      }
      pendingNoteSelection = {
        contentId,
        before: info.before,
        selected: info.selected,
        after: info.after,
      };
      // پاک کردن انتخاب تا کاربر ببیندش
      window.getSelection().removeAllRanges();
      hideNoteAddBtn();
      openNoteModal({});
    });
  });

  async function reloadMizanNotesAndRerender() {
    if (!mizanContentKeys.length) return;
    try {
      const all = await Promise.all(mizanContentKeys.map((cid) => Store.getMizanNotes(cid)));
      mizanNotes = all.flat();
      // فقط بخش‌های یادداشت را دوباره تزریق کن — ساده‌تر: دوباره رندر
      // اما برای حفظ صفحهٔ فعلی، از نو رندر می‌کنیم و به همان صفحه می‌رویم
      const prevPage = mizanCurrentPage;
      await renderMizan(current.surah, current.ayah, { keepPage: prevPage });
    } catch (e) {
      console.warn('[mizan] reload notes failed:', e);
    }
  }

  // -------------- Pager / TOC --------------

  function paginateMizan(rootEl) {
    const children = Array.from(rootEl.children).filter((c) => !c.classList.contains('mizan-orphans'));
    const orphansBox = rootEl.querySelector('.mizan-orphans');
    const pageGroups = [];
    let current = null;

    children.forEach((child) => {
      const isHeading = child.tagName === 'H3' || child.tagName === 'H4';
      if (isHeading || !current) {
        if (current) pageGroups.push(current);
        current = { heading: isHeading ? child.textContent.trim() : 'شروع', nodes: [child] };
      } else {
        current.nodes.push(child);
      }
    });
    if (current) pageGroups.push(current);

    if (pageGroups.length <= 1) {
      mizanPages = [];
      if (mizanPager) mizanPager.classList.add('hidden');
      rootEl.querySelectorAll('.mizan-page').forEach((el) => {
        while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
        el.parentNode.removeChild(el);
      });
      if (orphansBox) rootEl.appendChild(orphansBox);
      return;
    }

    rootEl.innerHTML = '';
    mizanPages = [];
    pageGroups.forEach((group, i) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'mizan-page';
      wrapper.dataset.pageNum = String(i + 1);
      wrapper.hidden = i !== 0;
      group.nodes.forEach((node) => wrapper.appendChild(node));
      rootEl.appendChild(wrapper);
      mizanPages.push({ heading: group.heading, pageNum: i + 1 });
    });
    if (orphansBox) rootEl.appendChild(orphansBox);
  }

  function updateMizanPagerUI() {
    if (!mizanPager) return;
    if (mizanPages.length <= 1) {
      mizanPager.classList.add('hidden');
      return;
    }
    mizanPager.classList.remove('hidden');
    const total = mizanPages.length;
    const cur = mizanCurrentPage + 1;
    if (mizanPageInfo) {
      mizanPageInfo.textContent = `صفحهٔ ${UI.toPersianDigits(cur)} از ${UI.toPersianDigits(total)}`;
    }
    if (mizanPrevBtn) mizanPrevBtn.disabled = mizanCurrentPage === 0;
    if (mizanNextBtn) mizanNextBtn.disabled = mizanCurrentPage >= total - 1;
  }

  function showMizanPage(n) {
    if (!mizanContent) return;
    const pages = mizanContent.querySelectorAll('.mizan-page');
    if (!pages.length) return;
    const total = pages.length;
    if (n < 0) n = 0;
    if (n >= total) n = total - 1;
    pages.forEach((p, i) => { p.hidden = i !== n; });
    mizanCurrentPage = n;
    updateMizanPagerUI();
    scheduleMizanSave(n);
  }

  function scheduleMizanSave(pageIndex) {
    if (!mizanContentKeys.length) return;
    clearTimeout(mizanSaveTimer);
    mizanSaveTimer = setTimeout(async () => {
      try {
        await Store.saveMizanProgress(mizanContentKeys.join('-'), pageIndex);
      } catch (e) {
        console.warn('[mizan] save progress failed:', e);
      }
    }, 400);
  }

  function buildMizanToc() {
    if (!mizanTocList) return;
    if (!mizanPages.length) {
      mizanTocList.innerHTML = '<p style="color:var(--text-faint); text-align:center; padding:20px 0;">فهرستی موجود نیست.</p>';
      return;
    }
    mizanTocList.innerHTML = mizanPages.map((p, i) => `
      <button type="button" class="mizan-toc-item" data-page="${i}">
        <span class="mizan-toc-item__num">${UI.toPersianDigits(i + 1)}</span>
        <span class="mizan-toc-item__title">${escapeHtml(p.heading)}</span>
      </button>
    `).join('');

    mizanTocList.querySelectorAll('.mizan-toc-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const n = Number(btn.getAttribute('data-page'));
        showMizanPage(n);
        closeMizanToc();
        if (mizanSection) mizanSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str == null ? '' : str);
    return div.innerHTML;
  }

  function openMizanToc() {
    if (!mizanTocModal) return;
    buildMizanToc();
    mizanTocModal.hidden = false;
  }
  function closeMizanToc() {
    if (mizanTocModal) mizanTocModal.hidden = true;
  }

  if (mizanPrevBtn) mizanPrevBtn.addEventListener('click', () => showMizanPage(mizanCurrentPage - 1));
  if (mizanNextBtn) mizanNextBtn.addEventListener('click', () => showMizanPage(mizanCurrentPage + 1));
  if (mizanTocBtn) mizanTocBtn.addEventListener('click', openMizanToc);
  if (mizanTocClose) mizanTocClose.addEventListener('click', closeMizanToc);
  if (mizanTocModal) {
    mizanTocModal.addEventListener('click', (e) => { if (e.target === mizanTocModal) closeMizanToc(); });
  }

  function jumpToAyahPage() {
    if (!mizanContent) return false;
    const anchor = mizanContent.querySelector(`#surah-${current.surah}-ayah-${current.ayah}`);
    if (!anchor) return false;
    const page = anchor.closest('.mizan-page');
    if (!page) return false;
    const pageNum = Number(page.dataset.pageNum) - 1;
    if (!Number.isNaN(pageNum) && pageNum !== mizanCurrentPage) {
      showMizanPage(pageNum);
    }
    return true;
  }

  async function renderMizan(surah, ayah, opts = {}) {
    showMizanState('loading');
    hideNoteAddBtn();
    hideNotePopup();
    mizanContentKeys = [];
    mizanNotes = [];
    try {
      const contents = await Mizan.getForAyah(surah, ayah);
      if (!contents || !contents.length) {
        showMizanState('empty');
        return;
      }

      mizanContentKeys = contents.map((c) => c.content_id);

      // یادداشت‌ها
      try {
        const all = await Promise.all(mizanContentKeys.map((cid) => Store.getMizanNotes(cid)));
        mizanNotes = all.flat();
      } catch (e) {
        console.warn('[mizan] load notes failed:', e);
        mizanNotes = [];
      }

      const combinedText = contents
        .map((c) => cleanMizanText(c.text))
        .filter(Boolean)
        .join('\n\n<hr>\n\n');

      const html = renderMarkdown(combinedText);

      let range = null;
      const firstContent = contents[0]?.text || '';
      const m = firstContent.match(/\[سوره\s+.+?:\s*آیات?\s*([\d\u06F0-\u06F9]+)\s*تا\s*([\d\u06F0-\u06F9]+)\]/);
      if (m) {
        const faToEn = (s) => s.replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
        range = { from: Number(faToEn(m[1])), to: Number(faToEn(m[2])) };
      }

      showMizanState('content', { html, range });
      normalizeMizanChars(mizanContent);
      styleMizanAyahs(mizanContent);
      injectMizanNotes(mizanContent);
      paginateMizan(mizanContent);

      if (mizanPages.length > 1) {
        // اگر keepPage داده شده، به همان برگرد
        if (typeof opts.keepPage === 'number' && opts.keepPage < mizanPages.length) {
          showMizanPage(opts.keepPage);
        } else {
          let saved = null;
          try {
            saved = await Store.getMizanProgress(mizanContentKeys.join('-'));
          } catch (e) {}
          if (typeof saved === 'number' && saved >= 0 && saved < mizanPages.length) {
            showMizanPage(saved);
          } else {
            showMizanPage(0);
            jumpToAyahPage();
          }
        }
      }
    } catch (e) {
      console.warn('[mizan] load failed:', e);
      showMizanState('error', { message: 'تفسیر المیزان برای این آیه در دسترس نیست.' });
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
      await renderMizan(current.surah, current.ayah);
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