// =============================================================
// پنل تفسیر المیزان — رندر، صفحه‌بندی، یادداشت‌ها، تگ‌گذاری آیه‌ای
// این ماژول از work.js جدا شده و از طریق window.MizanPanel
// در دسترس است. تنها نقطهٔ ورود: MizanPanel.render(surah, ayah, opts)
// =============================================================
const MizanPanel = (function () {

  // ---------- DOM ----------
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

  // ---------- State ----------
  let mizanPages = [];
  let mizanCurrentPage = 0;
  let mizanContentKeys = [];
  let mizanSaveTimer = null;
  let mizanNotes = [];
  let mizanTags = [];
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

  // ---------- Helpers ----------
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str == null ? '' : str);
    return div.innerHTML;
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

  function faToEnDigits(s) {
    return String(s).replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
  }

  // تنها نرمال‌سازی ۱:۱ (طول متن تغییر نمی‌کند → آفست‌ها معتبر می‌مانند)
  function normalizeExcerptChars(s) {
    return String(s == null ? '' : s)
      .replace(/\u0649/g, '\u06CC')  // ى → ی
      .replace(/\u064A/g, '\u06CC')  // ي → ی
      .replace(/\u0643/g, '\u06A9')  // ك → ک
      .replace(/\u200B/g, '\u200C'); // ZWSP → ZWNJ
  }

  // ============================================================
  // پیمایشگر text-node — متن «تمیز» را می‌سازد و نگاشت آفست → گره را می‌دهد.
  // اسپن‌های تزریق‌شده (یادداشت و مارکر تگ) نادیده گرفته می‌شوند تا
  // جست‌وجوی گزیده‌ها با محتوای واقعی المیزان انجام شود.
  // ============================================================
  const SKIP_CLASSES = ['mizan-note-inline', 'mizan-tag-marker', 'mizan-caret'];

  function collectBlockText(block) {
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        let p = node.parentElement;
        while (p && p !== block) {
          if (p.classList) {
            for (const c of SKIP_CLASSES) {
              if (p.classList.contains(c)) return NodeFilter.FILTER_REJECT;
            }
          }
          p = p.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let text = '';
    const map = [];
    let n;
    while ((n = walker.nextNode())) {
      const v = n.nodeValue || '';
      if (!v) continue;
      map.push({ node: n, start: text.length, len: v.length });
      text += v;
    }
    return { text, map };
  }

  function rangeAtOffsetInBlock(map, offset) {
    if (!map.length) return null;
    if (offset < 0) offset = 0;
    const total = map[map.length - 1].start + map[map.length - 1].len;
    if (offset > total) offset = total;

    for (const item of map) {
      if (offset <= item.start + item.len) {
        const local = offset - item.start;
        const r = document.createRange();
        try {
          r.setStart(item.node, local);
          r.setEnd(item.node, local);
          return r;
        } catch (e) {
          return null;
        }
      }
    }
    const last = map[map.length - 1];
    const r = document.createRange();
    try {
      r.setStart(last.node, last.len);
      r.setEnd(last.node, last.len);
      return r;
    } catch (e) {
      return null;
    }
  }

  // ---------- State machine ----------
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

  // ---------- Caret / anchor ----------
  function insertCaretAtRange(range) {
    removeCaret();
    if (!range) return;
    try {
      const caret = document.createElement('span');
      caret.className = 'mizan-caret';
      caret.setAttribute('aria-hidden', 'true');
      const r = range.cloneRange();
      r.collapse(true);
      r.insertNode(caret);
      mizanCaretEl = caret;
    } catch (e) {}
  }

  function removeCaret() {
    if (mizanCaretEl && mizanCaretEl.parentNode) {
      mizanCaretEl.parentNode.removeChild(mizanCaretEl);
    }
    mizanCaretEl = null;
  }

  const NOTE_BLOCK_SELECTOR = 'p, li, blockquote, h2, h3, h4, td, th, pre';
  const NOTE_CONTEXT_CHARS = 30;

  function getTextOffsetInBlock(block, container, offset) {
    let pos = 0;
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (n === container) return pos + offset;
      pos += (n.nodeValue || '').length;
    }
    if (container === block || block.contains(container)) {
      let acc = 0;
      const kids = container.childNodes;
      for (let i = 0; i < offset && i < kids.length; i++) {
        acc += (kids[i].textContent || '').length;
      }
      const preRange = document.createRange();
      try {
        preRange.setStart(block, 0);
        preRange.setEnd(container, offset);
        return preRange.toString().length;
      } catch (e) {
        return pos + acc;
      }
    }
    return pos;
  }

  function getCursorAnchor() {
    if (!mizanContent) return null;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);

    if (!mizanContent.contains(range.startContainer)) return null;

    let block = range.startContainer;
    if (block.nodeType === 3) block = block.parentElement;
    while (block && block !== mizanContent && !block.matches(NOTE_BLOCK_SELECTOR)) {
      block = block.parentElement;
    }
    if (!block || block === mizanContent || !block.matches(NOTE_BLOCK_SELECTOR)) return null;

    const blockText = block.textContent || '';
    if (!blockText.trim()) return null;

    const pos = getTextOffsetInBlock(block, range.startContainer, range.startOffset);
    const safePos = Math.max(0, Math.min(pos, blockText.length));

    const before = blockText.slice(Math.max(0, safePos - NOTE_CONTEXT_CHARS), safePos);
    const after = blockText.slice(safePos, safePos + NOTE_CONTEXT_CHARS);

    if (!before && !after) return null;

    return { block, before, after };
  }

  // ---------- Notes ----------
  function insertInlineNoteAt(rootEl, note) {
    const blocks = rootEl.querySelectorAll(NOTE_BLOCK_SELECTOR);
    const beforeN = normalizeExcerptChars(note.anchor_before || '');
    const afterN  = normalizeExcerptChars(note.anchor_after  || '');
    const fullN   = beforeN + afterN;

    for (const block of blocks) {
      const { text, map } = collectBlockText(block);
      if (!text) continue;
      const normText = normalizeExcerptChars(text);

      let posInBlock = -1;
      if (fullN && normText.indexOf(fullN) !== -1) {
        posInBlock = normText.indexOf(fullN) + beforeN.length;
      } else if (afterN && normText.indexOf(afterN) !== -1) {
        posInBlock = normText.indexOf(afterN);
      } else if (beforeN && normText.indexOf(beforeN) !== -1) {
        posInBlock = normText.indexOf(beforeN) + beforeN.length;
      }
      if (posInBlock < 0) continue;

      const range = rangeAtOffsetInBlock(map, posInBlock);
      if (!range) continue;

      const el = document.createElement('span');
      el.className = 'mizan-note-inline';
      el.dataset.noteId = note.id;
      el.textContent = note.note_text;
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('title', 'کلیک برای ویرایش');

      try {
        range.insertNode(el);
        return true;
      } catch (e) {
        continue;
      }
    }
    return false;
  }

  function injectMizanNotes(rootEl) {
    if (!rootEl || !mizanNotes.length) return;
    const orphans = [];
    for (const note of mizanNotes) {
      const ok = insertInlineNoteAt(rootEl, note);
      if (!ok) orphans.push(note);
    }
    if (orphans.length) {
      const box = document.createElement('div');
      box.className = 'mizan-orphans';
      box.innerHTML = `
        <div class="mizan-orphans__title">یادداشت‌های بدون جای مشخص</div>
        ${orphans.map((n) => `
          <div class="mizan-orphan" data-note-id="${n.id}">
            <span class="mizan-note-inline" style="cursor:pointer;">${escapeHtml(n.note_text)}</span>
          </div>
        `).join('')}
      `;
      rootEl.appendChild(box);
    }

    rootEl.querySelectorAll('.mizan-note-inline').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.noteId;
        const note = mizanNotes.find((n) => n.id === id);
        if (note) showNotePopup(note, el);
      });
    });
  }

  // ============================================================
  // Tag parsing — ورودی AI به این شکل است:
  //   <شمارهٔ آیه> ← <گزیدهٔ شروع> … <گزیدهٔ پایان> |<شمارهٔ آیه>
  // شماره‌ها داینامیک‌اند (هر عدد ۱ تا ۲۸۶). مثال ۲۵۸ فقط نمونه است.
  // خروجی: آرایه‌ای از { ayah, startExcerpt, endExcerpt }
  //   — دقیقاً همان کلیدهایی که store.js و اسکیمای mizan_tags انتظار دارند.
  // ============================================================
  function parseMizanTaggerResponse(text) {
    if (!text) return [];
    const tags = [];
    const lines = String(text).split(/\r?\n/);

    // فلش‌های پذیرفته‌شده، جداکننده‌های سه‌نقطه، جداکننده‌های پایپ
    const ARROW  = '[←⟵⟸⇐➔➜➝➞→►▶▸]';
    const DOTS   = '(?:…+|\\.{3,}|⋯|•••)';
    const PIPE   = '[|¦│┃｜]';
    const NUM    = '[\\u06F0-\\u06F9\\d]+';

    const lineRe = new RegExp(
      '^(' + NUM + ')\\s*' + ARROW + '\\s*' +
      '(.+?)\\s*' + DOTS + '\\s*' +
      '(.+?)\\s*' +
      '(?:' + PIPE + '\\s*(' + NUM + '))?' +
      '\\s*$'
    );

    for (const raw of lines) {
      let line = raw.trim();
      if (!line) continue;

      // حذف پیشوندهای لیست مارک‌داون و کاراکترهای بسته‌بندی
      line = line.replace(/^[-*•·●◆◇]\s+/, '');
      line = line.replace(/^[`«"'(\[]+/, '');
      line = line.replace(/[`»"')\]]+$/, '').trim();
      if (!line) continue;

      const m = line.match(lineRe);
      if (!m) continue;

      const aStart = m[1] ? Number(faToEnDigits(m[1])) : 0;
      const aEnd   = m[4] ? Number(faToEnDigits(m[4])) : 0;

      // اگر مدل شمارهٔ ابتدا و انتها را متفاوت داد، هشدار می‌دهیم ولی
      // از شمارهٔ ابتدایی استفاده می‌کنیم (بهترین حدس).
      if (aStart && aEnd && aStart !== aEnd) {
        console.warn('[mizan tagger] mismatched ayah numbers in line:', line);
      }
      const ayah = aStart || aEnd;
      if (!ayah) continue;

      const startExcerpt = (m[2] || '').trim();
      const endExcerpt   = (m[3] || '').trim();
      if (!startExcerpt || !endExcerpt) continue;

      tags.push({ ayah, startExcerpt, endExcerpt });
    }

    return tags;
  }

  // گزیده را در متنِ تمیز پیدا می‌کند (بدون دخالت یادداشت‌ها و مارکرها)
  function findExcerptRange(rootEl, excerpt) {
    const raw = String(excerpt || '').trim();
    if (!raw) return null;
    const needle = normalizeExcerptChars(raw);
    if (!needle) return null;

    const blocks = rootEl.querySelectorAll(NOTE_BLOCK_SELECTOR);
    for (const block of blocks) {
      const { text, map } = collectBlockText(block);
      if (!text) continue;
      const normText = normalizeExcerptChars(text);
      const idx = normText.indexOf(needle);
      if (idx < 0) continue;

      const startRange = rangeAtOffsetInBlock(map, idx);
      const endRange   = rangeAtOffsetInBlock(map, idx + needle.length);
      if (startRange && endRange) return { startRange, endRange };
    }
    return null;
  }

  function applyMizanTags(rootEl, tags) {
    if (!rootEl || !tags || !tags.length) return;

    const items = [];
    for (const tag of tags) {
      const start = findExcerptRange(rootEl, tag.start_excerpt);
      const end   = findExcerptRange(rootEl, tag.end_excerpt);
      if (!start || !end) continue;
      items.push({ tag, startRange: start.startRange, endRange: end.endRange });
    }
    if (!items.length) return;

    const highlightRanges = [];

    for (const item of items) {
      // ترتیب مهم است: ابتدا مارکر پایانی، سپس مارکر شروع — تا با درجِ
      // مارکر شروع، جای مارکر پایانی به‌هم نریزد.
      const endMarker = document.createElement('span');
      endMarker.className = 'mizan-tag-marker';
      endMarker.dataset.tagId = item.tag.id;
      endMarker.textContent = `|${UI.toPersianDigits(item.tag.ayah)}`;
      item.endRange.insertNode(endMarker);

      const startMarker = document.createElement('span');
      startMarker.className = 'mizan-tag-marker';
      startMarker.dataset.tagId = item.tag.id;
      startMarker.textContent = `${UI.toPersianDigits(item.tag.ayah)} ←`;
      item.startRange.insertNode(startMarker);

      try {
        const hl = document.createRange();
        hl.setStartAfter(startMarker);
        hl.setEndBefore(endMarker);
        highlightRanges.push(hl);
      } catch (e) {}
    }

    if (window.CSS && CSS.highlights && highlightRanges.length) {
      try {
        CSS.highlights.set('mizan-tag', new Highlight(...highlightRanges));
      } catch (e) {
        console.warn('[mizan] highlight failed:', e);
      }
    }
  }

  // ---------- Note popup ----------
  function showNotePopup(note, anchorEl) {
    if (!mizanNotePopup) return;
    activePopupNoteId = note.id;
    mizanNotePopupText.textContent = note.note_text;
    mizanNotePopup.hidden = false;

    const rect = anchorEl.getBoundingClientRect();
    const popup = mizanNotePopup;
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
  }

  if (mizanNotePopupClose) mizanNotePopupClose.addEventListener('click', hideNotePopup);
  if (mizanNotePopupEdit) mizanNotePopupEdit.addEventListener('click', () => {
    const note = mizanNotes.find((n) => n.id === activePopupNoteId);
    if (!note) return;
    hideNotePopup();
    openNoteModal({ editing: note });
  });
  if (mizanNotePopupDel) mizanNotePopupDel.addEventListener('click', async () => {
    const note = mizanNotes.find((n) => n.id === activeNoteId(activePopupNoteId));
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

  function activeNoteId(id) { return id; }

  document.addEventListener('click', (e) => {
    if (!mizanNotePopup || mizanNotePopup.hidden) return;
    if (mizanNotePopup.contains(e.target)) return;
    if (e.target.classList && e.target.classList.contains('mizan-note-inline')) return;
    hideNotePopup();
  });

  // ---------- Note modal ----------
  function renderNoteQuoteFromAnchor(anchor) {
    if (!mizanNoteQuote) return;
    if (!anchor) { mizanNoteQuote.textContent = '—'; return; }
    const b = (anchor.before || '').slice(-40);
    const a = (anchor.after || '').slice(0, 40);
    mizanNoteQuote.innerHTML =
      `${escapeHtml(b)}<span class="mizan-note-modal__caret">|</span>${escapeHtml(a)}`;
  }

  function openNoteModal(opts = {}) {
    if (!mizanNoteModal) return;
    editingNoteId = opts.editing ? opts.editing.id : null;
    removeCaret();

    if (opts.editing) {
      mizanNoteTitle.textContent = 'ویرایش یادداشت';
      mizanNoteInput.value = opts.editing.note_text || '';
      mizanNoteQuote.textContent = (opts.editing.anchor_before || '').slice(-40) +
        ' | ' + (opts.editing.anchor_after || '').slice(0, 40);
      mizanNoteDeleteBtn.style.display = '';
      mizanNoteSaveBtn.textContent = 'به‌روزرسانی';
    } else {
      mizanNoteTitle.textContent = 'افزودن یادداشت';
      mizanNoteInput.value = '';
      renderNoteQuoteFromAnchor(pendingNoteAnchor);
      mizanNoteDeleteBtn.style.display = 'none';
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
    pendingNoteAnchor = null;
    removeCaret();
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
        if (!pendingNoteAnchor) {
          UI.toast('موقعیت یادداشت معتبر نیست');
          return;
        }
        await Store.addMizanNote({
          contentId: pendingNoteAnchor.contentId,
          anchorBefore: pendingNoteAnchor.before,
          anchorSelected: '',
          anchorAfter: pendingNoteAnchor.after,
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

  // ---------- Floating note button ----------
  function showNoteAddBtn() {
    if (!mizanNoteBtn) return;
    mizanNoteBtn.hidden = false;
  }
  function hideNoteAddBtn() {
    if (!mizanNoteBtn) return;
    mizanNoteBtn.hidden = true;
  }

  function selectionIsInsideMizan() {
    if (!mizanContent || mizanContent.classList.contains('hidden')) return false;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    const r = sel.getRangeAt(0);
    return mizanContent.contains(r.startContainer);
  }

  document.addEventListener('selectionchange', () => {
    if (selectionIsInsideMizan()) showNoteAddBtn();
    else hideNoteAddBtn();
  });

  function anchorKeyOf(anchor) {
    if (!anchor) return null;
    return (anchor.before || '') + '\u0000' + (anchor.after || '');
  }

  function resetAnchorConfirm() {
    lastAnchorKey = null;
    lastAnchorTime = 0;
  }

  async function openNoteAtAnchor(anchor) {
    if (!anchor) {
      UI.toast('موقعیت یادداشت پیدا نشد');
      return;
    }

    const { data } = await sb.auth.getSession();
    if (!data?.session) {
      UI.toast('برای افزودن یادداشت باید وارد حساب شوید');
      return;
    }

    const page = anchor.block.closest('.mizan-page');
    let contentId = mizanContentKeys[0] || null;
    if (page && mizanContentKeys.length > 1) {
      const idx = Array.from(mizanContent.querySelectorAll('.mizan-page')).indexOf(page);
      contentId = mizanContentKeys[idx] || mizanContentKeys[0];
    }
    if (!contentId) {
      UI.toast('خطا در تشخیص محتوا');
      return;
    }

    pendingNoteAnchor = {
      contentId,
      before: anchor.before,
      after: anchor.after,
    };

    resetAnchorConfirm();
    hideNoteAddBtn();
    openNoteModal({});
  }

  if (mizanContent) {
    mizanContent.addEventListener('click', (e) => {
      if (e.target.closest && e.target.closest('.mizan-note-inline')) return;
      if (e.target.closest && e.target.closest('.mizan-tag-marker')) return;
      if (e.target.closest && e.target.closest('a')) { removeCaret(); resetAnchorConfirm(); return; }
      if (e.target.classList && e.target.classList.contains('mizan-caret')) return;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) {
        removeCaret();
        resetAnchorConfirm();
        return;
      }

      const clickRange = sel.getRangeAt(0).cloneRange();

      setTimeout(async () => {
        const anchor = getCursorAnchor();
        if (!anchor) { removeCaret(); resetAnchorConfirm(); return; }

        insertCaretAtRange(clickRange);

        const key = anchorKeyOf(anchor);
        const now = Date.now();

        if (lastAnchorKey === key && (now - lastAnchorTime) < ANCHOR_CONFIRM_WINDOW_MS) {
          removeCaret();
          await openNoteAtAnchor(anchor);
        } else {
          lastAnchorKey = key;
          lastAnchorTime = now;
        }
      }, 0);
    });
  }

  if (mizanNoteBtn) {
    mizanNoteBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      capturedAnchor = getCursorAnchor();
    });
  }

  if (mizanNoteBtn) {
    mizanNoteBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const anchor = capturedAnchor || getCursorAnchor();
      capturedAnchor = null;
      await openNoteAtAnchor(anchor);
    });
  }

  async function reloadMizanNotesAndRerender() {
    if (!mizanContentKeys.length) return;
    try {
      const all = await Promise.all(mizanContentKeys.map((cid) => Store.getMizanNotes(cid)));
      mizanNotes = all.flat();
      const prevPage = mizanCurrentPage;
      await renderMizan(lastSurah, lastAyah, { keepPage: prevPage });
    } catch (e) {
      console.warn('[mizan] reload notes failed:', e);
    }
  }

  // --------------------------------------------------------
  // Tagger — مودال پاسخ خام
  // --------------------------------------------------------
  function openTaggerRawModal(results) {
    if (!mizanTaggerRawModal) return;
    pendingTaggerResults = results;

    const hasError = results.some((r) => r.error);
    const totalTags = results.reduce((acc, r) => acc + (r.tags ? r.tags.length : 0), 0);
    const model = results.find((r) => r.model)?.model || '—';

    mizanTaggerRawMeta.setAttribute('data-error', hasError ? 'true' : 'false');
    mizanTaggerRawMeta.innerHTML = `
      <span>محتواها: <b>${UI.toPersianDigits(results.length)}</b></span>
      <span>تگ‌های شناسایی‌شده: <b>${UI.toPersianDigits(totalTags)}</b></span>
      <span>مدل: <b>${escapeHtml(model)}</b></span>
      ${hasError ? '<span><b>خطا در برخی محتواها</b></span>' : ''}
    `;

    const rawCombined = results.map((r) => {
      const header = r.error
        ? `[خطا${r.status ? ' — HTTP ' + r.status : ''}] content_id: ${r.contentId}`
        : `[موفق] content_id: ${r.contentId}`;
      return `${header}\n──────────\n${r.raw}`;
    }).join('\n\n\n');

    mizanTaggerRawText.textContent = rawCombined;
    mizanTaggerRawModal.hidden = false;
  }

  function closeTaggerRawModal() {
    if (mizanTaggerRawModal) mizanTaggerRawModal.hidden = true;
    pendingTaggerResults = null;
  }

  async function applyTaggerResults() {
    if (!pendingTaggerResults) return;
    const valid = pendingTaggerResults.filter((r) => !r.error && r.tags && r.tags.length);
    if (!valid.length) {
      UI.toast('چیزی برای ذخیره نیست');
      return;
    }
    try {
      for (const r of valid) {
        await Store.replaceMizanTags(r.contentId, r.tags, r.model);
      }
      UI.toast('تفکیک ذخیره شد');
      closeTaggerRawModal();
      await renderMizan(lastSurah, lastAyah, { keepPage: mizanCurrentPage });
    } catch (e) {
      console.error('[mizan tagger] apply failed:', e);
      UI.toast('خطا در ذخیره: ' + (e.message || 'نامشخص'));
    }
  }

  if (mizanTaggerRawClose) mizanTaggerRawClose.addEventListener('click', closeTaggerRawModal);
  if (mizanTaggerRawCancel) mizanTaggerRawCancel.addEventListener('click', closeTaggerRawModal);
  if (mizanTaggerRawApply) mizanTaggerRawApply.addEventListener('click', applyTaggerResults);
  if (mizanTaggerRawCopy) mizanTaggerRawCopy.addEventListener('click', async () => {
    const text = mizanTaggerRawText.textContent || '';
    try {
      await navigator.clipboard.writeText(text);
      UI.toast('کپی شد');
    } catch (e) {
      UI.toast('کپی ناموفق بود');
    }
  });
  if (mizanTaggerRawModal) {
    mizanTaggerRawModal.addEventListener('click', (e) => {
      if (e.target === mizanTaggerRawModal) closeTaggerRawModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mizanTaggerRawModal && !mizanTaggerRawModal.hidden) closeTaggerRawModal();
  });

  function setTaggerState(state, label) {
    if (!mizanTaggerBtn || !mizanTaggerLabel) return;
    if (state === 'idle') {
      mizanTaggerBtn.disabled = false;
      mizanTaggerBtn.classList.remove('is-busy');
      mizanTaggerLabel.textContent = label || 'تفکیک آیه‌ای';
    } else if (state === 'busy') {
      mizanTaggerBtn.disabled = true;
      mizanTaggerBtn.classList.add('is-busy');
      mizanTaggerLabel.textContent = 'AI در حال تحلیل…';
    }
  }

  async function runMizanTagger() {
    if (!mizanContentKeys.length) { UI.toast('محتوایی موجود نیست'); return; }
    const { data } = await sb.auth.getSession();
    if (!data?.session) { UI.toast('برای تگ‌گذاری باید وارد حساب شوید'); return; }

    const model = localStorage.getItem('askAiModel') || CONFIG.OPENROUTER_DEFAULT_MODEL;
    const index = await QuranData.getIndex();
    const surahMeta = index.find((s) => s.number === lastSurah);
    const surahName = surahMeta ? surahMeta.name_fa : String(lastSurah);

    setTaggerState('busy');
    const results = [];

    for (const cid of mizanContentKeys) {
      try {
        const content = await Mizan.loadContent(cid);
        const ayahs = await Mizan.getAyahsForContent(lastSurah, cid);

        const result = await Store.callMizanTagger({
          surahName,
          ayahs,
          content: content.text,
          model,
        });

        const parsed = parseMizanTaggerResponse(result.content);
        results.push({
          contentId: cid,
          raw: result.content,
          model: result.model || null,
          tags: parsed,
          error: false,
          status: result.status,
        });
      } catch (err) {
        results.push({
          contentId: cid,
          raw: (err && err.raw) ? err.raw : (err && err.message) ? err.message : String(err),
          model: null,
          tags: [],
          error: true,
          status: err && err.status ? err.status : null,
        });
      }
    }

    setTaggerState('idle');
    openTaggerRawModal(results);
  }

  if (mizanTaggerBtn) {
    mizanTaggerBtn.addEventListener('click', runMizanTagger);
  }

  // ---------- Pagination ----------
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
    resetAnchorConfirm();
    removeCaret();
  }

  function scheduleMizanSave(pageIndex) {
    if (!mizanContentKeys.length) return;
    clearTimeout(mizanSaveTimer);
    mizanSaveTimer = setTimeout(async () => {
      try {
        await Store.saveMizanProgress(mizanContentKeys.join('-'), pageIndex);
      } catch (e) {}
    }, 400);
  }

  // ---------- TOC ----------
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
    const anchor = mizanContent.querySelector(`#surah-${lastSurah}-ayah-${lastAyah}`);
    if (!anchor) return false;
    const page = anchor.closest('.mizan-page');
    if (!page) return false;
    const pageNum = Number(page.dataset.pageNum) - 1;
    if (!Number.isNaN(pageNum) && pageNum !== mizanCurrentPage) {
      showMizanPage(pageNum);
    }
    return true;
  }

  // ---------- Main render ----------
  async function renderMizan(surah, ayah, opts = {}) {
    lastSurah = surah;
    lastAyah = ayah;

    showMizanState('loading');
    hideNoteAddBtn();
    hideNotePopup();
    removeCaret();
    resetAnchorConfirm();
    mizanContentKeys = [];
    mizanNotes = [];
    mizanTags = [];

    if (window.CSS && CSS.highlights) {
      try { CSS.highlights.delete('mizan-tag'); } catch (e) {}
    }

    try {
      const contents = await Mizan.getForAyah(surah, ayah);
      if (!contents || !contents.length) {
        showMizanState('empty');
        if (mizanTaggerBtn) mizanTaggerBtn.classList.add('hidden');
        return;
      }

      mizanContentKeys = contents.map((c) => c.content_id);

      try {
        const allNotes = await Promise.all(mizanContentKeys.map((cid) => Store.getMizanNotes(cid)));
        mizanNotes = allNotes.flat();
      } catch (e) {
        mizanNotes = [];
      }

      try {
        const allTags = await Promise.all(mizanContentKeys.map((cid) => Store.getMizanTags(cid)));
        mizanTags = allTags.flat();
      } catch (e) {
        mizanTags = [];
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
      // ترتیب مهم: ابتدا مارکرهای تگ، سپس یادداشت‌ها.
      // چون پیمایشگر text-node هر دو نوع را skip می‌کند، ترتیب اثری
      // بر صحت جست‌وجو ندارد؛ ولی این ترتیب از نظر بصری طبیعی‌تر است.
      applyMizanTags(mizanContent, mizanTags);
      injectMizanNotes(mizanContent);
      paginateMizan(mizanContent);

      if (mizanTaggerBtn) {
        mizanTaggerBtn.classList.remove('hidden');
        setTaggerState('idle', mizanTags.length > 0 ? 'تفکیک مجدد' : 'تفکیک آیه‌ای');
      }

      if (mizanPages.length > 1) {
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
      if (mizanTaggerBtn) mizanTaggerBtn.classList.add('hidden');
    }
  }

  return { render: renderMizan };
})();