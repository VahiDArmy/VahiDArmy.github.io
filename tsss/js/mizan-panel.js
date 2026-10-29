// =============================================================
// پنل تفسیر المیزان
// =============================================================
const MizanPanel = (function () {

  // ============================================================
  // 0) DOM
  // ============================================================
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

  const mizanTaggerBtn   = document.getElementById('mizanTaggerBtn');
  const mizanTaggerLabel = document.getElementById('mizanTaggerLabel');

  const mizanTaggerRawModal  = document.getElementById('mizanTaggerRawModal');
  const mizanTaggerRawClose  = document.getElementById('mizanTaggerRawClose');
  const mizanTaggerRawMeta   = document.getElementById('mizanTaggerRawMeta');
  const mizanTaggerRawText   = document.getElementById('mizanTaggerRawText');
  const mizanTaggerRawApply  = document.getElementById('mizanTaggerRawApply');
  const mizanTaggerRawCopy   = document.getElementById('mizanTaggerRawCopy');
  const mizanTaggerRawCancel = document.getElementById('mizanTaggerRawCancel');

  const mizanNoteModal     = document.getElementById('mizanNoteModal');
  const mizanNoteClose     = document.getElementById('mizanNoteClose');
  const mizanNoteInput     = document.getElementById('mizanNoteInput');
  const mizanNoteSaveBtn   = document.getElementById('mizanNoteSaveBtn');
  const mizanNoteDeleteBtn = document.getElementById('mizanNoteDeleteBtn');
  const mizanNoteQuote     = document.getElementById('mizanNoteQuote');
  const mizanNoteTitle     = document.getElementById('mizanNoteTitle');

  const mizanNotePopup      = document.getElementById('mizanNotePopup');
  const mizanNotePopupText  = document.getElementById('mizanNotePopupText');
  const mizanNotePopupEdit  = document.getElementById('mizanNotePopupEdit');
  const mizanNotePopupDel   = document.getElementById('mizanNotePopupDel');
  const mizanNotePopupClose = document.getElementById('mizanNotePopupClose');

  // ============================================================
  // 0b) DYNAMIC UI (Read Page Button)
  // ============================================================
  const readPageBtn = document.createElement('button');
  readPageBtn.type = 'button';
  readPageBtn.className = 'mizan-read-page-btn';
  readPageBtn.style.display = 'none'; // initially hidden
  readPageBtn.innerHTML = 'علامت‌گذاری به عنوان خوانده‌شده';
  
  // Append below the Pager (Bottom of the container)
  const mizanContainer = document.getElementById('mizanTafsirContainer');
  if (mizanContainer) {
    mizanContainer.appendChild(readPageBtn);
  }

  // ============================================================
  // 1) STATE
  // ============================================================
  let mizanPages = [];
  let mizanCurrentPage = 0;
  let mizanContentKeys = [];
  let mizanSaveTimer = null;
  let mizanNotes = [];
  let mizanTags = [];
  let mizanReadPages = new Set(); // Stores string numbers of read pages
  
  let pendingNoteAnchor = null;
  let editingNoteId = null;
  let activePopupNoteId = null;
  let capturedAnchor = null;

  let lastAnchorKey = null;
  let lastAnchorTime = 0;
  const ANCHOR_CONFIRM_WINDOW_MS = 6000;

  let mizanCaretEl = null;
  let pendingTaggerResults = null;
  let lastSurah = 1;
  let lastAyah = 1;
  let renderSeq = 0;
  let noteSaving = false;

  // ============================================================
  // 2) UTILITIES
  // ============================================================
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str == null ? '' : str);
    return div.innerHTML;
  }

  function faToEnDigits(s) {
    return String(s).replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0)).replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  }

  const INVISIBLE_SEPARATORS = '\u200B\u200D\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069\uFEFF';
  const YEH_PRESENTATION = '[\uFBFC-\uFBFF\uFEEF\uFEF0\uFEF1-\uFEF4]';
  const KAF_PRESENTATION = '[\uFED9-\uFEDC]';

  function canonizeLetters(s) {
    return String(s == null ? '' : s)
      .replace(new RegExp(YEH_PRESENTATION, 'g'), '\u06CC')
      .replace(new RegExp(KAF_PRESENTATION, 'g'), '\u06A9')
      .replace(/\u064A/g, '\u06CC').replace(/\u0649/g, '\u06CC')
      .replace(/\u06D2/g, '\u06CC').replace(/\u06D0/g, '\u06CC')
      .replace(/\u06CD/g, '\u06CC').replace(/\u0643/g, '\u06A9');
  }

  function canonizeInvisibles(s) {
    const between = new RegExp(`([\\u0600-\\u06FF])[${INVISIBLE_SEPARATORS}]+(?=[\\u0600-\\u06FF])`, 'g');
    s = s.replace(between, '$1\u200C');
    s = s.replace(new RegExp(`[${INVISIBLE_SEPARATORS}]`, 'g'), '');
    return s.replace(/\u200C{2,}/g, '\u200C');
  }

  function normalizePersianChars(text) { return canonizeInvisibles(canonizeLetters(text)); }
  function normalizeChars(text) { return canonizeInvisibles(canonizeLetters(text)).replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, ''); }
  function stripDiacritics(s) { return String(s == null ? '' : s).replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, ''); }
  function dedupeById(arr) {
    if (!Array.isArray(arr)) return [];
    const seen = new Set(); const out = [];
    for (const item of arr) {
      if (!item) continue;
      const key = item.id != null ? String(item.id) : null;
      if (key == null) { out.push(item); continue; }
      if (seen.has(key)) continue;
      seen.add(key); out.push(item);
    }
    return out;
  }

  function normalizePersianString(text) {
    const s = String(text == null ? '' : text);
    if (!s) return s;
    const re = /﴿[^﴾]*﴾/g; let out = ''; let lastIdx = 0; let m;
    while ((m = re.exec(s))) {
      out += normalizePersianChars(s.slice(lastIdx, m.index)) + m[0];
      lastIdx = re.lastIndex;
    }
    return out + normalizePersianChars(s.slice(lastIdx));
  }

  function looksLikeQuran(text) {
    const t = String(text || '');
    if (t.length < 20) return false;
    const diacritics = (t.match(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g) || []).length;
    const letters = (t.match(/[\u0621-\u064A\u0671\u06CC\u06A9]/g) || []).length;
    return letters >= 10 && (diacritics / letters > 0.10);
  }

  // ============================================================
  // 2b) Parsing & Artifacts
  // ============================================================
  function shouldNormalizeBlock(block) {
    if (!block) return false;
    if (['anchor', 'hr', 'range-title', 'arabic-raw'].includes(block.type)) return false;
    if (block.type === 'code' && block.lang === 'arabic') return false;
    return true;
  }
  function normalizeBlock(block) {
    if (!shouldNormalizeBlock(block)) return block;
    const copy = { ...block };
    if (typeof copy.text === 'string') copy.text = normalizePersianString(copy.text);
    if (typeof copy.body === 'string') copy.body = normalizePersianString(copy.body);
    if (Array.isArray(copy.items)) copy.items = copy.items.map(normalizePersianString);
    return copy;
  }
  function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function hasUnclosedBracket(text) {
    const s = String(text || ''); const pairs = [['«', '»'], ['(', ')'], ['[', ']'], ['{', '}'], ['﴿', '﴾']];
    for (const [open, close] of pairs) {
      const o = (s.match(new RegExp(escapeRe(open), 'g')) || []).length;
      const c = (s.match(new RegExp(escapeRe(close), 'g')) || []).length;
      if (o > c) return true;
    }
    return false;
  }
  function endsWithTerminator(text) { return /[.؟!:؛»\)\]\u06D4\u061F…]\s*$/.test(String(text || '')); }
  function startsWithNewBlockMarker(text) {
    const t = String(text || '').trimStart();
    return !t || /^[﴿#>\-*•\u06F0-\u06F9\d]/.test(t);
  }
  function shouldRejoinParagraphs(prevText, nextText) {
    if (!prevText || !nextText) return false;
    if (hasUnclosedBracket(prevText)) return true;
    return !endsWithTerminator(prevText) && !startsWithNewBlockMarker(nextText);
  }
  function rejoinPrintBreaks(blocks) {
    const out = []; let i = 0;
    while (i < blocks.length) {
      const cur = blocks[i];
      if (cur.type !== 'paragraph') { out.push(cur); i++; continue; }
      let text = cur.text; let j = i + 1;
      while (j < blocks.length && blocks[j].type === 'paragraph' && shouldRejoinParagraphs(text, blocks[j].text)) {
        text = text.replace(/\s+$/, '') + ' ' + blocks[j].text.replace(/^\s+/, ''); j++;
      }
      out.push(j > i + 1 ? { ...cur, text } : cur); i = j;
    }
    return out;
  }
  function processPrintArtifacts(blocks) { return rejoinPrintBreaks(blocks.map(normalizeBlock)); }

  // ============================================================
  // 3) Content Pipeline
  // ============================================================
  function parseContent(rawText) {
    let text = String(rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/^\s*\*{4,}\s*\n+/, '').replace(/\n+\s*\*{4,}\s*$/, '');
    const lines = text.split('\n'); const blocks = [];
    let paraBuf = []; let listBuf = null;

    const flushPara = () => {
      if (!paraBuf.length) return;
      const t = paraBuf.join('\n').trim();
      if (t) blocks.push({ type: 'paragraph', text: t });
      paraBuf = [];
    };
    const flushList = () => { if (listBuf) { blocks.push(listBuf); listBuf = null; } };

    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      if (!line) { flushPara(); flushList(); i++; continue; }

      const fm = line.match(/^```([a-zA-Z0-9_-]*)\s*$/);
      if (fm) {
        flushPara(); flushList(); const lang = (fm[1] || '').toLowerCase(); const body = []; i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) { body.push(lines[i]); i++; }
        i++; blocks.push({ type: 'code', lang, body: body.join('\n') }); continue;
      }

      const hm = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (hm) {
        flushPara(); flushList(); const level = hm[1].length; const headingText = hm[2].trim();
        const rm = headingText.match(/^\[\s*سوره\s+(.+?)\s*[(（]\s*([\d\u06F0-\u06F9]+)\s*[)）]\s*[:：]\s*.+?\s*([\d\u06F0-\u06F9]+)\s*تا\s*([\d\u06F0-\u06F9]+)\s*\]$/);
        if (rm) blocks.push({ type: 'range-title', surahName: rm[1].trim(), surahNum: Number(faToEnDigits(rm[2])), from: Number(faToEnDigits(rm[3])), to: Number(faToEnDigits(rm[4])) });
        else blocks.push({ type: 'heading', level, text: headingText });
        i++; continue;
      }

      const am = line.match(/^<span\s+id=["']surah-(\d+)-ayah-(\d+)["']\s*>\s*<\/span>\s*$/i);
      if (am) { flushPara(); flushList(); blocks.push({ type: 'anchor', surah: Number(am[1]), ayah: Number(am[2]) }); i++; continue; }

      const ulm = line.match(/^[-*•·]\s+(.+)$/);
      if (ulm) {
        flushPara();
        if (!listBuf || listBuf.type !== 'ul') { flushList(); listBuf = { type: 'ul', items: [] }; }
        listBuf.items.push(ulm[1]); i++; continue;
      }
      const olm = line.match(/^(\d+)[.)]\s+(.+)$/);
      if (olm) {
        flushPara();
        if (!listBuf || listBuf.type !== 'ol') { flushList(); listBuf = { type: 'ol', items: [] }; }
        listBuf.items.push(olm[2]); i++; continue;
      }

      if (line.startsWith('>')) {
        flushPara(); flushList(); const q = [line.replace(/^>\s?/, '')]; i++;
        while (i < lines.length && lines[i].trim().startsWith('>')) { q.push(lines[i].trim().replace(/^>\s?/, '')); i++; }
        blocks.push({ type: 'quote', text: q.join('\n') }); continue;
      }
      if (/^[-*_]{3,}$/.test(line)) { flushPara(); flushList(); blocks.push({ type: 'hr' }); i++; continue; }

      flushList(); paraBuf.push(line); i++;
    }
    flushPara(); flushList();

    for (let j = 0; j < blocks.length; j++) {
      if (blocks[j].type !== 'anchor') continue;
      let k = j + 1; while (k < blocks.length && blocks[k].type === 'anchor') k++;
      if (k < blocks.length && blocks[k].type === 'paragraph' && looksLikeQuran(blocks[k].text)) {
        blocks[k].type = 'arabic-raw'; blocks[k].ayah = blocks[j].ayah;
      }
    }
    return blocks;
  }

  function renderInline(text) {
    let s = escapeHtml(text);
    s = s.replace(/﴿([^﴾]+)﴾/g, '<span class="mizan-quran-inline">﴿$1﴾</span>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    return s.replace(/[ \t]*\n+[ \t]*/g, ' ');
  }

  function renderAyahBlock(rawText, fallbackNum) {
    const trimmed = String(rawText || '').trim();
    if (!trimmed) return '';
    const numMatch = trimmed.match(/\s*[(（]\s*([\d\u0660-\u0669\u06F0-\u06F9]+)\s*[)）]\s*$/);
    let display = trimmed; let num = null;
    if (numMatch) { display = trimmed.slice(0, numMatch.index).trim(); num = Number(faToEnDigits(numMatch[1])); }
    const ayahNum = num || fallbackNum || null;
    const badge = ayahNum ? `<span class="mizan-ayah__badge">آیهٔ ${UI.toPersianDigits(ayahNum)}</span>` : '';
    return `<div class="mizan-ayah" data-ayah="${ayahNum || ''}"><p class="mizan-ayah__text">${escapeHtml(display)}</p>${badge}</div>`;
  }

  function renderBlock(block, ctx) {
    switch (block.type) {
      case 'range-title':
        return `<div class="mizan-title"><span class="mizan-title__ornament"></span><span class="mizan-title__text">سورهٔ ${escapeHtml(block.surahName)} · آیات ${UI.toPersianDigits(block.from)} تا ${UI.toPersianDigits(block.to)}</span><span class="mizan-title__ornament"></span></div>`;
      case 'heading': {
        const lvl = Math.min(Math.max(block.level, 2), 4);
        return `<h${lvl} class="mizan-h${lvl}">${renderInline(block.text)}</h${lvl}>`;
      }
      case 'anchor': return `<span class="mizan-anchor" id="surah-${block.surah}-ayah-${block.ayah}" data-ayah="${block.ayah}"></span>`;
      case 'code':
        if (block.lang === 'arabic') return renderAyahBlock(block.body, ctx.lastAyah);
        if (block.lang === 'farsi') return `<div class="mizan-translation"><div class="mizan-translation__label">ترجمهٔ آیات</div><p class="mizan-translation__text">${renderInline(block.body.trim())}</p></div>`;
        return `<pre class="mizan-code"><code>${escapeHtml(block.body)}</code></pre>`;
      case 'arabic-raw': return renderAyahBlock(block.text, block.ayah || ctx.lastAyah);
      case 'paragraph': return `<p class="mizan-p">${renderInline(block.text)}</p>`;
      case 'quote': return `<blockquote class="mizan-quote">${renderInline(block.text)}</blockquote>`;
      case 'ul': return `<ul class="mizan-list">${block.items.map((it) => `<li>${renderInline(it)}</li>`).join('')}</ul>`;
      case 'ol': return `<ol class="mizan-list mizan-list--ol">${block.items.map((it) => `<li>${renderInline(it)}</li>`).join('')}</ol>`;
      case 'hr': return `<hr class="mizan-hr">`;
      default: return '';
    }
  }

  function renderBlocks(blocks) {
    const out = []; const ctx = { lastAyah: null };
    for (const b of blocks) {
      if (b.type === 'anchor') ctx.lastAyah = b.ayah;
      out.push(renderBlock(b, ctx));
    }
    return out.filter(Boolean).join('\n');
  }

  // ============================================================
  // 4) State Machine
  // ============================================================
  function showMizanState(state, payload) {
    mizanEmpty.classList.add('hidden'); mizanLoading.classList.add('hidden');
    mizanContent.classList.add('hidden'); mizanError.classList.add('hidden');
    if (mizanPager) mizanPager.classList.add('hidden');
    if (readPageBtn) readPageBtn.style.display = 'none';
    if (mizanRange) mizanRange.textContent = '';

    if (state === 'empty') mizanEmpty.classList.remove('hidden');
    else if (state === 'loading') mizanLoading.classList.remove('hidden');
    else if (state === 'content') {
      mizanContent.classList.remove('hidden');
      mizanContent.innerHTML = payload.html || '';
      if (mizanRange && payload.range) {
        const c = payload.range.to - payload.range.from + 1;
        mizanRange.textContent = (c === 1 ? 'یک' : c === 2 ? 'دو' : c === 3 ? 'سه' : c === 4 ? 'چهار' : c === 5 ? 'پنج' : UI.toPersianDigits(c)) + ' آیه';
      }
    } else if (state === 'error') {
      mizanError.classList.remove('hidden');
      mizanError.textContent = payload.message || 'خطا';
    }
  }

  // ============================================================
  // 5) Caret / Anchor
  // ============================================================
  function removeCaret() { if (mizanCaretEl) mizanCaretEl.remove(); mizanCaretEl = null; }
  function insertCaretAtRange(range) {
    removeCaret(); if (!range) return;
    try { const c = document.createElement('span'); c.className = 'mizan-caret'; range.cloneRange().collapse(true).insertNode(c); mizanCaretEl = c; } catch (e) {}
  }

  const NOTE_BLOCK_SELECTOR = 'p, li, blockquote, h2, h3, h4, td, th, pre';
  const NOTE_CONTEXT_CHARS = 30;
  const SKIP_CLASSES = ['mizan-note-inline', 'mizan-tag-marker', 'mizan-caret', 'mizan-read-marker'];

  function collectBlockText(block) {
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        let p = node.parentElement;
        while (p && p !== block) {
          if (p.classList && SKIP_CLASSES.some(c => p.classList.contains(c))) return NodeFilter.FILTER_REJECT;
          p = p.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let text = ''; const map = []; let n;
    while ((n = walker.nextNode())) {
      const v = n.nodeValue || ''; if (!v) continue;
      map.push({ node: n, start: text.length, len: v.length }); text += v;
    }
    return { text, map };
  }

  function rangeAtOffsetInBlock(map, offset) {
    if (!map.length) return null;
    if (offset <= 0) offset = 0;
    const total = map[map.length - 1].start + map[map.length - 1].len;
    if (offset > total) offset = total;
    for (const item of map) {
      if (offset <= item.start + item.len) {
        const r = document.createRange();
        try { r.setStart(item.node, offset - item.start); r.setEnd(item.node, offset - item.start); return r; } catch (e) { return null; }
      }
    }
    return null;
  }

  function getTextOffsetInBlock(block, container, offset) {
    let pos = 0; const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT); let n;
    while ((n = walker.nextNode())) { if (n === container) return pos + offset; pos += (n.nodeValue || '').length; }
    return pos;
  }

  function getCursorAnchor() {
    if (!mizanContent) return null;
    const sel = window.getSelection(); if (!sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0); if (!mizanContent.contains(range.startContainer)) return null;
    let block = range.startContainer; if (block.nodeType === 3) block = block.parentElement;
    while (block && block !== mizanContent && !block.matches(NOTE_BLOCK_SELECTOR)) block = block.parentElement;
    if (!block || block === mizanContent || !block.matches(NOTE_BLOCK_SELECTOR)) return null;
    const blockText = block.textContent || ''; if (!blockText.trim()) return null;
    const pos = getTextOffsetInBlock(block, range.startContainer, range.startOffset);
    const safePos = Math.max(0, Math.min(pos, blockText.length));
    return { block, before: blockText.slice(Math.max(0, safePos - NOTE_CONTEXT_CHARS), safePos), after: blockText.slice(safePos, safePos + NOTE_CONTEXT_CHARS) };
  }

  function resolveContentIdForBlock(blockEl) {
    if (!mizanContentKeys.length) return null;
    if (mizanContentKeys.length === 1) return mizanContentKeys[0];
    const page = blockEl && blockEl.closest && blockEl.closest('.mizan-page');
    if (!page) return mizanContentKeys[0];
    return mizanContentKeys[Array.from(mizanContent.querySelectorAll('.mizan-page')).indexOf(page)] || mizanContentKeys[0];
  }

  // ============================================================
  // 6) Notes & Markers
  // ============================================================
  function insertInlineNoteAt(rootEl, note) {
    const isReadMarker = note.note_text === '[[READ_MARKER]]';
    if (isReadMarker && note.anchor_before) return false; // Don't render inside text
    
    const blocks = rootEl.querySelectorAll(NOTE_BLOCK_SELECTOR);
    const beforeN = normalizeChars(note.anchor_before || ''); const afterN = normalizeChars(note.anchor_after || '');
    const fullN = beforeN + afterN;

    for (const block of blocks) {
      if (!isReadMarker && block.querySelector(`.mizan-note-inline[data-note-id="${note.id}"]`)) return true;
      const { text, map } = collectBlockText(block); if (!text) continue;
      const normText = normalizeChars(text);

      let posInBlock = -1;
      if (fullN && normText.indexOf(fullN) !== -1) posInBlock = normText.indexOf(fullN) + beforeN.length;
      else if (afterN && normText.indexOf(afterN) !== -1) posInBlock = normText.indexOf(afterN);
      else if (beforeN && normText.indexOf(beforeN) !== -1) posInBlock = normText.indexOf(beforeN) + beforeN.length;
      if (posInBlock < 0) continue;

      const range = rangeAtOffsetInBlock(map, posInBlock); if (!range) continue;
      const el = document.createElement('span');
      if (isReadMarker) {
        el.className = 'mizan-read-marker';
        el.dataset.noteId = note.id;
        el.innerHTML = '<span class="mizan-read-marker__label">تا اینجا خوانده شد <span class="mizan-read-marker__del" title="حذف">✕</span></span>';
      } else {
        el.className = 'mizan-note-inline';
        el.dataset.noteId = note.id; el.textContent = note.note_text;
        el.setAttribute('role', 'button'); el.setAttribute('title', 'کلیک برای ویرایش');
      }
      try { range.insertNode(el); return true; } catch (e) { continue; }
    }
    return false;
  }

  function injectMizanNotes(rootEl) {
    if (!rootEl) return;
    rootEl.querySelectorAll('.mizan-note-inline').forEach((el) => {
      const p = el.parentNode; if (!p) return;
      p.replaceChild(document.createTextNode(el.textContent || ''), el); p.normalize();
    });
    rootEl.querySelectorAll('.mizan-read-marker').forEach(el => el.remove());

    const orphans = [];
    for (const note of mizanNotes) {
      if (note.note_text === '[[PAGE_READ]]') continue; // Skip DB records for read pages
      const ok = insertInlineNoteAt(rootEl, note);
      if (!ok && note.note_text !== '[[READ_MARKER]]') orphans.push(note);
    }

    const oldOrphans = rootEl.querySelector('.mizan-orphans');
    if (oldOrphans) oldOrphans.remove();
    if (orphans.length) {
      const box = document.createElement('div'); box.className = 'mizan-orphans';
      box.innerHTML = `<div class="mizan-orphans__title">یادداشت‌های بدون جای مشخص</div>${orphans.map((n) => `<div class="mizan-orphan" data-note-id="${n.id}"><span class="mizan-note-inline" style="cursor:pointer;">${escapeHtml(n.note_text)}</span></div>`).join('')}`;
      rootEl.appendChild(box);
    }

    rootEl.querySelectorAll('.mizan-note-inline').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const note = mizanNotes.find((n) => n.id === el.dataset.noteId);
        if (note) showNotePopup(note, el);
      });
    });

    rootEl.querySelectorAll('.mizan-read-marker').forEach((el) => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!el.dataset.noteId) return;
        if (!confirm('آیا نشانگر خواندن حذف شود؟')) return;
        try {
          await Store.deleteMizanNote(el.dataset.noteId);
          UI.toast('نشانگر حذف شد');
          await reloadMizanNotesAndRerender();
        } catch (err) { UI.toast('خطا در حذف'); }
      });
    });
  }

  function showNotePopup(note, anchorEl) {
    if (!mizanNotePopup) return;
    activePopupNoteId = note.id; mizanNotePopupText.textContent = note.note_text; mizanNotePopup.hidden = false;
    const rect = anchorEl.getBoundingClientRect(); const popup = mizanNotePopup;
    popup.style.left = '-9999px'; popup.style.top = '-9999px';
    requestAnimationFrame(() => {
      const pw = popup.offsetWidth; const ph = popup.offsetHeight;
      let x = rect.left + rect.width / 2 - pw / 2; let y = rect.bottom + 8;
      if (x < 8) x = 8; if (x + pw > window.innerWidth - 8) x = window.innerWidth - pw - 8;
      if (y + ph > window.innerHeight - 8) y = rect.top - ph - 8; if (y < 8) y = 8;
      popup.style.left = x + 'px'; popup.style.top = y + 'px';
    });
  }

  function hideNotePopup() { if (mizanNotePopup) mizanNotePopup.hidden = true; activePopupNoteId = null; }

  if (mizanNotePopupClose) mizanNotePopupClose.addEventListener('click', hideNotePopup);
  if (mizanNotePopupEdit) mizanNotePopupEdit.addEventListener('click', () => {
    const note = mizanNotes.find((n) => n.id === activePopupNoteId);
    if (note) { hideNotePopup(); openNoteModal({ editing: note }); }
  });
  if (mizanNotePopupDel) mizanNotePopupDel.addEventListener('click', async () => {
    const note = mizanNotes.find((n) => n.id === activePopupNoteId);
    if (note && confirm('حذف شود؟')) {
      try { await Store.deleteMizanNote(note.id); hideNotePopup(); UI.toast('حذف شد'); await reloadMizanNotesAndRerender(); } catch (e) { UI.toast('خطا'); }
    }
  });

  document.addEventListener('click', (e) => {
    if (mizanNotePopup && !mizanNotePopup.hidden && !mizanNotePopup.contains(e.target) && !e.target.classList.contains('mizan-note-inline')) hideNotePopup();
  });

  function renderNoteQuoteFromAnchor(anchor) {
    if (!mizanNoteQuote) return;
    if (!anchor) { mizanNoteQuote.textContent = '—'; return; }
    mizanNoteQuote.innerHTML = `${escapeHtml((anchor.before || '').slice(-40))}<span class="mizan-note-modal__caret">|</span>${escapeHtml((anchor.after || '').slice(0, 40))}`;
  }

  function openNoteModal(opts = {}) {
    if (!mizanNoteModal) return;
    noteSaving = false; editingNoteId = opts.editing ? opts.editing.id : null; removeCaret();
    if (opts.editing) {
      mizanNoteTitle.textContent = 'ویرایش یادداشت'; mizanNoteInput.value = opts.editing.note_text || '';
      mizanNoteQuote.textContent = (opts.editing.anchor_before || '').slice(-40) + ' | ' + (opts.editing.anchor_after || '').slice(0, 40);
      mizanNoteDeleteBtn.style.display = ''; mizanNoteSaveBtn.textContent = 'به‌روزرسانی';
    } else {
      mizanNoteTitle.textContent = 'افزودن یادداشت'; mizanNoteInput.value = '';
      renderNoteQuoteFromAnchor(pendingNoteAnchor);
      mizanNoteDeleteBtn.style.display = 'none'; mizanNoteSaveBtn.textContent = 'ثبت یادداشت';
    }
    mizanNoteModal.hidden = false; setTimeout(() => mizanNoteInput.focus(), 50);
  }

  function closeNoteModal() {
    if (!mizanNoteModal) return;
    mizanNoteModal.hidden = true; mizanNoteInput.value = ''; editingNoteId = null; pendingNoteAnchor = null; noteSaving = false; removeCaret();
  }

  if (mizanNoteClose) mizanNoteClose.addEventListener('click', closeNoteModal);
  if (mizanNoteModal) {
    mizanNoteModal.addEventListener('click', (e) => { if (e.target === mizanNoteModal) closeNoteModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !mizanNoteModal.hidden) closeNoteModal(); });
  }

  document.addEventListener('mousedown', (e) => {
    if (e.target.closest('#mizanNoteSaveBtn') || e.target.closest('#mizanNoteDeleteBtn')) e.preventDefault();
  }, true);

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('#mizanNoteSaveBtn'); if (!btn || noteSaving) return;
    e.preventDefault(); e.stopPropagation(); noteSaving = true;
    try {
      const text = (mizanNoteInput && mizanNoteInput.value || '').trim(); if (!text) { UI.toast('متن خالی است'); return; }
      if (!pendingNoteAnchor) {
        const anchor = getCursorAnchor();
        if (anchor) pendingNoteAnchor = { contentId: resolveContentIdForBlock(anchor.block), before: anchor.before, after: anchor.after };
      }
      if (!pendingNoteAnchor) pendingNoteAnchor = { contentId: mizanContentKeys[0] || null, before: '', after: '' };
      if (!pendingNoteAnchor.contentId) { UI.toast('موقعیت نامعتبر'); return; }

      if (editingNoteId) await Store.updateMizanNote(editingNoteId, text);
      else await Store.addMizanNote({ contentId: pendingNoteAnchor.contentId, anchorBefore: pendingNoteAnchor.before, anchorSelected: '', anchorAfter: pendingNoteAnchor.after, noteText: text });
      
      UI.toast('ثبت شد'); closeNoteModal(); await reloadMizanNotesAndRerender();
    } catch (err) { UI.toast('خطا'); } finally { noteSaving = false; }
  }, true);

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('#mizanNoteDeleteBtn'); if (!btn || btn.style.display === 'none') return;
    e.preventDefault(); e.stopPropagation();
    if (!editingNoteId || !confirm('حذف شود؟')) return;
    try { await Store.deleteMizanNote(editingNoteId); closeNoteModal(); UI.toast('حذف شد'); await reloadMizanNotesAndRerender(); } catch (err) { UI.toast('خطا'); }
  }, true);

  function showNoteAddBtn() { if (mizanNoteBtn) mizanNoteBtn.hidden = false; }
  function hideNoteAddBtn() { if (mizanNoteBtn) mizanNoteBtn.hidden = true; }

  document.addEventListener('selectionchange', () => {
    if (!mizanContent || mizanContent.classList.contains('hidden')) return;
    const sel = window.getSelection();
    if (sel.rangeCount && mizanContent.contains(sel.getRangeAt(0).startContainer)) showNoteAddBtn();
    else hideNoteAddBtn();
  });

  function resetAnchorConfirm() { lastAnchorKey = null; lastAnchorTime = 0; }
  async function openNoteAtAnchor(anchor) {
    if (!anchor) return;
    const { data } = await sb.auth.getSession();
    if (!data?.session) { UI.toast('ابتدا وارد شوید'); return; }
    pendingNoteAnchor = { contentId: resolveContentIdForBlock(anchor.block), before: anchor.before, after: anchor.after };
    if (!pendingNoteAnchor.contentId) return;
    resetAnchorConfirm(); hideNoteAddBtn(); openNoteModal({});
  }

  if (mizanContent) {
    mizanContent.addEventListener('click', (e) => {
      if (e.target.closest('.mizan-note-inline') || e.target.closest('.mizan-tag-marker') || e.target.closest('.mizan-read-marker') || e.target.closest('a') || e.target.classList.contains('mizan-caret')) return;
      const sel = window.getSelection(); if (!sel || !sel.rangeCount || !sel.isCollapsed) { removeCaret(); resetAnchorConfirm(); return; }
      const clickRange = sel.getRangeAt(0).cloneRange();
      setTimeout(async () => {
        const anchor = getCursorAnchor(); if (!anchor) { removeCaret(); return; }
        insertCaretAtRange(clickRange);
        if (lastAnchorKey === (anchor.before || '') + '\u0000' + (anchor.after || '') && (Date.now() - lastAnchorTime) < ANCHOR_CONFIRM_WINDOW_MS) {
          removeCaret(); showFloatMenu(clickRange, anchor);
        } else { lastAnchorKey = (anchor.before || '') + '\u0000' + (anchor.after || ''); lastAnchorTime = Date.now(); }
      }, 0);
    });
  }

  if (mizanNoteBtn) {
    mizanNoteBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); capturedAnchor = getCursorAnchor(); });
    mizanNoteBtn.addEventListener('click', async (e) => { e.preventDefault(); const a = capturedAnchor || getCursorAnchor(); capturedAnchor = null; await openNoteAtAnchor(a); });
  }

  async function reloadMizanNotesAndRerender() {
    if (!mizanContentKeys.length) return;
    try {
      const all = await Promise.all(mizanContentKeys.map(cid => Store.getMizanNotes(cid)));
      mizanNotes = dedupeById(all.flat());
      const prevPage = mizanCurrentPage;
      await renderMizan(lastSurah, lastAyah, { keepPage: prevPage });
    } catch (e) {}
  }

  // ============================================================
  // 7) Floating Menu & Read Page Button Logic
  // ============================================================
  const floatMenu = document.createElement('div');
  floatMenu.className = 'mizan-float-menu'; floatMenu.hidden = true;
  floatMenu.innerHTML = `<button class="mizan-float-btn mizan-float-btn--top"><span class="mizan-float-icon">⚑</span><span>نشانگر خواندن</span></button><div class="mizan-float-divider"></div><button class="mizan-float-btn mizan-float-btn--bottom"><span class="mizan-float-icon">✎</span><span>افزودن یادداشت</span></button>`;
  document.body.appendChild(floatMenu);
  let currentFloatAnchor = null;

  floatMenu.addEventListener('mousedown', e => e.preventDefault());
  floatMenu.querySelector('.mizan-float-btn--top').addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (currentFloatAnchor) saveReadMarker(currentFloatAnchor);
  });
  floatMenu.querySelector('.mizan-float-btn--bottom').addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (currentFloatAnchor) { const a = currentFloatAnchor; closeFloatMenu(); openNoteAtAnchor(a); }
  });

  function showFloatMenu(range, anchor) {
    currentFloatAnchor = anchor; floatMenu.hidden = false;
    floatMenu.style.left = '-9999px'; floatMenu.style.top = '-9999px';
    requestAnimationFrame(() => {
      const rect = range.getBoundingClientRect(); const mw = floatMenu.offsetWidth; const mh = floatMenu.offsetHeight;
      let x = rect.left + rect.width / 2 - mw / 2; let y = rect.top - mh - 10;
      if (y < 10) y = rect.bottom + 10;
      if (x < 10) x = 10; if (x + mw > window.innerWidth - 10) x = window.innerWidth - mw - 10;
      floatMenu.style.left = x + 'px'; floatMenu.style.top = y + 'px';
    });
  }
  function closeFloatMenu() { floatMenu.hidden = true; currentFloatAnchor = null; }
  document.addEventListener('click', (e) => { if (!floatMenu.hidden && !floatMenu.contains(e.target) && !mizanContent.contains(e.target)) closeFloatMenu(); });
  window.addEventListener('scroll', () => { if (!floatMenu.hidden) closeFloatMenu(); }, { passive: true });

  async function saveReadMarker(anchor) {
    const contentId = resolveContentIdForBlock(anchor.block); if (!contentId) return;
    closeFloatMenu(); removeCaret();
    try {
      const existing = mizanNotes.filter(n => String(n.content_id) === String(contentId) && n.note_text === '[[READ_MARKER]]');
      for (const n of existing) await Store.deleteMizanNote(n.id);
      await Store.addMizanNote({ contentId, anchorBefore: anchor.before, anchorSelected: '', anchorAfter: anchor.after, noteText: '[[READ_MARKER]]' });
      UI.toast('نشانگر ثبت شد'); await reloadMizanNotesAndRerender();
    } catch (err) { UI.toast('خطا'); }
  }

  // Toggle Read Page logic
  async function toggleCurrentPageRead() {
    const pageIdx = String(mizanCurrentPage);
    const contentId = mizanContentKeys[0]; if (!contentId) return;

    readPageBtn.disabled = true;
    try {
      if (mizanReadPages.has(pageIdx)) {
        // Unmark
        const toDel = mizanNotes.filter(n => n.note_text === '[[PAGE_READ]]' && n.anchor_before === pageIdx);
        for (const n of toDel) await Store.deleteMizanNote(n.id);
        mizanReadPages.delete(pageIdx);
        UI.toast('علامت خوانده‌شده برداشته شد');
      } else {
        // Mark
        await Store.addMizanNote({ contentId, anchorBefore: pageIdx, anchorSelected: '', anchorAfter: '', noteText: '[[PAGE_READ]]' });
        mizanReadPages.add(pageIdx);
        UI.toast('صفحه خوانده‌شده علامت‌گذاری شد');
      }
      await reloadMizanNotesAndRerender();
    } catch (e) { UI.toast('خطا'); } finally { readPageBtn.disabled = false; }
  }

  readPageBtn.addEventListener('click', toggleCurrentPageRead);

  // ============================================================
  // 8) Pagination
  // ============================================================
  function paginateMizan(rootEl) {
    const children = Array.from(rootEl.children).filter(c => !c.classList.contains('mizan-orphans'));
    const orphansBox = rootEl.querySelector('.mizan-orphans');
    const rawGroups = []; let current = null;

    children.forEach((child) => {
      const isHeading = ['H3', 'H4'].includes(child.tagName);
      if (isHeading || !current) {
        if (current) rawGroups.push(current);
        current = { heading: isHeading ? child.textContent.trim() : 'شروع', nodes: [child] };
      } else current.nodes.push(child);
    });
    if (current) rawGroups.push(current);

    const pageGroups = []; let pendingHeadings = []; let pendingHeadingText = null;
    for (const g of rawGroups) {
      const onlyHeading = g.nodes.length === 1 && /^H[34]$/.test(g.nodes[0].tagName || '');
      if (onlyHeading) { pendingHeadings.push(g.nodes[0]); if (!pendingHeadingText) pendingHeadingText = g.heading; continue; }
      if (pendingHeadings.length) { g.nodes = [...pendingHeadings, ...g.nodes]; if (pendingHeadingText) g.heading = pendingHeadingText; pendingHeadings = []; pendingHeadingText = null; }
      pageGroups.push(g);
    }
    if (pendingHeadings.length) {
      if (pageGroups.length) pageGroups[pageGroups.length - 1].nodes.push(...pendingHeadings);
      else pageGroups.push({ heading: pendingHeadingText || 'شروع', nodes: pendingHeadings });
    }

    if (pageGroups.length <= 1) {
      mizanPages = []; if (mizanPager) mizanPager.classList.add('hidden');
      rootEl.querySelectorAll('.mizan-page').forEach(el => { while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el); el.remove(); });
      if (orphansBox) rootEl.appendChild(orphansBox);
      return;
    }

    rootEl.innerHTML = ''; mizanPages = [];
    pageGroups.forEach((group, i) => {
      const wrapper = document.createElement('div'); wrapper.className = 'mizan-page'; wrapper.dataset.pageNum = String(i + 1); wrapper.hidden = i !== 0;
      group.nodes.forEach(node => wrapper.appendChild(node));
      rootEl.appendChild(wrapper);
      mizanPages.push({ heading: group.heading, pageNum: i + 1 });
    });
    if (orphansBox) rootEl.appendChild(orphansBox);
  }

  function updateMizanPagerUI() {
    if (!mizanPager) return;
    if (mizanPages.length <= 1) { mizanPager.classList.add('hidden'); readPageBtn.style.display = 'none'; return; }
    mizanPager.classList.remove('hidden');
    
    const total = mizanPages.length; const cur = mizanCurrentPage;
    const isRead = mizanReadPages.has(String(cur));
    
    // Page Info Glow logic
    const curStr = UI.toPersianDigits(cur + 1);
    if (mizanPageInfo) {
      mizanPageInfo.innerHTML = `صفحهٔ <span class="${isRead ? 'mizan-page-num--read' : ''}">${curStr}</span> از ${UI.toPersianDigits(total)}`;
    }
    
    // Button update
    readPageBtn.style.display = 'block';
    if (isRead) {
      readPageBtn.innerHTML = '✓ این صفحه خوانده شده است';
      readPageBtn.classList.add('is-read');
    } else {
      readPageBtn.innerHTML = 'علامت‌گذاری به عنوان خوانده‌شده';
      readPageBtn.classList.remove('is-read');
    }

    if (mizanPrevBtn) mizanPrevBtn.disabled = cur === 0;
    if (mizanNextBtn) mizanNextBtn.disabled = cur >= total - 1;
  }

  function showMizanPage(n, skipSave = false) {
    if (!mizanContent) return;
    const pages = mizanContent.querySelectorAll('.mizan-page'); if (!pages.length) return;
    if (n < 0) n = 0; if (n >= pages.length) n = pages.length - 1;
    pages.forEach((p, i) => { p.hidden = i !== n; });
    mizanCurrentPage = n;
    updateMizanPagerUI();
    if (!skipSave) scheduleMizanSave(n);
    resetAnchorConfirm(); removeCaret();
  }

  function scheduleMizanSave(pageIndex) {
    if (!mizanContentKeys.length) return;
    clearTimeout(mizanSaveTimer);
    mizanSaveTimer = setTimeout(async () => { try { await Store.saveMizanProgress(mizanContentKeys.join('-'), pageIndex); } catch (e) {} }, 400);
  }

  function buildMizanToc() {
    if (!mizanTocList) return;
    if (!mizanPages.length) { mizanTocList.innerHTML = '<p style="text-align:center; padding:20px;">فهرست موجود نیست.</p>'; return; }
    mizanTocList.innerHTML = mizanPages.map((p, i) => {
      const isRead = mizanReadPages.has(String(i));
      return `<button class="mizan-toc-item" data-page="${i}"><span class="mizan-toc-item__num">${isRead ? '✓' : UI.toPersianDigits(i + 1)}</span><span class="mizan-toc-item__title">${escapeHtml(p.heading)}</span></button>`;
    }).join('');

    mizanTocList.querySelectorAll('.mizan-toc-item').forEach(btn => {
      btn.addEventListener('click', () => { showMizanPage(Number(btn.getAttribute('data-page'))); closeMizanToc(); if (mizanSection) mizanSection.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    });
  }

  function openMizanToc() { if (!mizanTocModal) return; buildMizanToc(); mizanTocModal.hidden = false; }
  function closeMizanToc() { if (mizanTocModal) mizanTocModal.hidden = true; }

  if (mizanPrevBtn) mizanPrevBtn.addEventListener('click', () => showMizanPage(mizanCurrentPage - 1));
  if (mizanNextBtn) mizanNextBtn.addEventListener('click', () => showMizanPage(mizanCurrentPage + 1));
  if (mizanTocBtn) mizanTocBtn.addEventListener('click', openMizanToc);
  if (mizanTocClose) mizanTocClose.addEventListener('click', closeMizanToc);
  if (mizanTocModal) mizanTocModal.addEventListener('click', e => { if (e.target === mizanTocModal) closeMizanToc(); });

  function jumpToAyahPage() {
    if (!mizanContent) return false;
    const anchor = mizanContent.querySelector(`#surah-${lastSurah}-ayah-${lastAyah}`);
    if (!anchor) return false;
    const page = anchor.closest('.mizan-page'); if (!page) return false;
    const pageNum = Number(page.dataset.pageNum) - 1;
    if (pageNum !== mizanCurrentPage) showMizanPage(pageNum, true);
    return true;
  }

  // ============================================================
  // 9) Main Render
  // ============================================================
  async function renderMizan(surah, ayah, opts = {}) {
    const mySeq = ++renderSeq;
    lastSurah = surah; lastAyah = ayah;

    showMizanState('loading'); hideNoteAddBtn(); hideNotePopup(); closeFloatMenu(); removeCaret(); resetAnchorConfirm();
    mizanContentKeys = []; mizanNotes = []; mizanTags = []; mizanReadPages.clear();
    if (window.CSS && CSS.highlights) { try { CSS.highlights.delete('mizan-tag'); } catch (e) {} }

    try {
      const contents = await Mizan.getForAyah(surah, ayah);
      if (mySeq !== renderSeq) return;
      if (!contents || !contents.length) { showMizanState('empty'); if (mizanTaggerBtn) mizanTaggerBtn.classList.add('hidden'); return; }

      mizanContentKeys = Array.from(new Set(contents.map(c => c.content_id)));

      try {
        const allNotes = await Promise.all(mizanContentKeys.map(cid => Store.getMizanNotes(cid)));
        if (mySeq !== renderSeq) return;
        mizanNotes = dedupeById(allNotes.flat());
        mizanReadPages.clear();
        mizanNotes.forEach(n => { if (n.note_text === '[[PAGE_READ]]' && n.anchor_before) mizanReadPages.add(n.anchor_before); });
      } catch (e) {}

      try {
        const allTags = await Promise.all(mizanContentKeys.map(cid => Store.getMizanTags(cid)));
        if (mySeq !== renderSeq) return;
        mizanTags = dedupeById(await filterTrivialTags(allTags.flat(), surah, ayah));
      } catch (e) { mizanTags = []; }

      if (mySeq !== renderSeq) return;

      let range = null; const ayahSet = new Set(); const allBlocks = [];
      for (const c of contents) {
        const blocks = parseContent(c.text);
        for (const b of blocks) {
          if (b.type === 'anchor') ayahSet.add(b.ayah);
          if (b.type === 'range-title') { for (let n = b.from; n <= b.to; n++) ayahSet.add(n); if (!range) range = { from: b.from, to: b.to }; }
        }
        allBlocks.push(...blocks);
      }

      const html = renderBlocks(processPrintArtifacts(allBlocks));
      if (mySeq !== renderSeq) return;

      showMizanState('content', { html, range });
      applyMizanTags(mizanContent, mizanTags);
      injectMizanNotes(mizanContent);
      paginateMizan(mizanContent);

      if (mizanTaggerBtn) { mizanTaggerBtn.classList.remove('hidden'); setTaggerState('idle', mizanTags.length > 0 ? 'تفکیک مجدد' : 'تفکیک آیه‌ای'); }

      if (mizanPages.length > 1) {
        let startPage = 0;
        if (typeof opts.keepPage === 'number' && opts.keepPage < mizanPages.length) startPage = opts.keepPage;
        else {
          let saved = null;
          try { saved = await Store.getMizanProgress(mizanContentKeys.join('-')); } catch (e) {}
          if (typeof saved === 'number' && saved >= 0 && saved < mizanPages.length) startPage = saved;
        }
        showMizanPage(startPage, true);
        if (startPage === 0 && !opts.keepPage) jumpToAyahPage();
      } else {
        updateMizanPagerUI();
      }
    } catch (e) {
      if (mySeq !== renderSeq) return;
      showMizanState('error', { message: 'خطا در بارگذاری.' });
      if (mizanTaggerBtn) mizanTaggerBtn.classList.add('hidden');
    }
  }

  // Stubs for tags
  function parseMizanTaggerResponse(text) { return []; }
  async function filterTrivialTags(tags) { return tags; }
  function findExcerptRange() { return null; }
  function applyMizanTags() {}
  function openTaggerRawModal() {}
  function closeTaggerRawModal() {}
  async function applyTaggerResults() {}
  function setTaggerState() {}

  return { render: renderMizan };
})();