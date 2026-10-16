// =============================================================
// پنل تفسیر المیزان — بازنویسی کامل از صفر بر اساس ساختار واقعی
// فایل content: عنوان‌ها، anchors، code block های arabic/farsi،
// و آیه‌های لخت (بدون fence) — همه تشخیص داده می‌شوند.
// تنها نقطهٔ ورود: MizanPanel.render(surah, ayah, opts)
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
  // ★ محافظت از layout-shift هنگام کلیک روی دکمه‌های مودال یادداشت
  //
  // قاعدهٔ CSS `.field textarea:focus { min-height: 280px; }` باعث
  // می‌شود وقتی textarea فوکوس دارد، ارتفاعش زیاد شود. هنگام
  // mousedown روی دکمه، مرورگر می‌خواهد فوکوس را به دکمه بدهد؛
  // blur روی textarea ارتفاعش را برمی‌گرداند و دکمه جابه‌جا می‌شود.
  // نتیجه: click اصلاً fire نمی‌شود.
  //
  // با preventDefault روی mousedown، فوکوس از textarea جدا نمی‌شود
  // و layout ثابت می‌ماند؛ پس click به‌طور عادی fire می‌شود.
  // ============================================================
  document.addEventListener('mousedown', (e) => {
    if (!e.target || !e.target.closest) return;
    const btn = e.target.closest('#mizanNoteSaveBtn')
             || e.target.closest('#mizanNoteDeleteBtn');
    if (btn) e.preventDefault();
  }, true);

  // ============================================================
  // 1) STATE
  // ============================================================
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
    return String(s)
      .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
      .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  }

  const INVISIBLE_SEPARATORS =
    '\u200B' +
    '\u200D' +
    '\u200E' +
    '\u200F' +
    '\u061C' +
    '\u202A-\u202E' +
    '\u2066-\u2069' +
    '\uFEFF';

  const YEH_PRESENTATION = '[\uFBFC-\uFBFF\uFEEF\uFEF0\uFEF1-\uFEF4]';
  const KAF_PRESENTATION = '[\uFED9-\uFEDC]';

  function canonizeLetters(s) {
    return String(s == null ? '' : s)
      .replace(new RegExp(YEH_PRESENTATION, 'g'), '\u06CC')
      .replace(new RegExp(KAF_PRESENTATION, 'g'), '\u06A9')
      .replace(/\u064A/g, '\u06CC')
      .replace(/\u0649/g, '\u06CC')
      .replace(/\u06D2/g, '\u06CC')
      .replace(/\u06D0/g, '\u06CC')
      .replace(/\u06CD/g, '\u06CC')
      .replace(/\u0643/g, '\u06A9');
  }

  function canonizeInvisibles(s) {
    const between = new RegExp(
      `([\\u0600-\\u06FF])[${INVISIBLE_SEPARATORS}]+(?=[\\u0600-\\u06FF])`,
      'g'
    );
    s = s.replace(between, '$1\u200C');
    const remain = new RegExp(`[${INVISIBLE_SEPARATORS}]`, 'g');
    s = s.replace(remain, '');
    s = s.replace(/\u200C{2,}/g, '\u200C');
    return s;
  }

  function normalizePersianChars(text) {
    return canonizeInvisibles(canonizeLetters(text));
  }

  function normalizeChars(text) {
    return canonizeInvisibles(canonizeLetters(text))
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
  }

  function stripDiacritics(s) {
    return String(s == null ? '' : s)
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
  }

  function looksLikeQuran(text) {
    const t = String(text || '');
    if (t.length < 20) return false;
    const diacritics = (t.match(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g) || []).length;
    const letters    = (t.match(/[\u0621-\u064A\u0671\u06CC\u06A9]/g) || []).length;
    if (letters < 10) return false;
    return diacritics / letters > 0.10;
  }

  function dedupeById(arr) {
    if (!Array.isArray(arr)) return [];
    const seen = new Set();
    const out = [];
    for (const item of arr) {
      if (!item) continue;
      const key = item.id != null ? String(item.id) : null;
      if (key == null) { out.push(item); continue; }
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }

  function normalizePersianString(text) {
    const s = String(text == null ? '' : text);
    if (!s) return s;
    const re = /﴿[^﴾]*﴾/g;
    let out = '';
    let lastIdx = 0;
    let m;
    while ((m = re.exec(s))) {
      out += normalizePersianChars(s.slice(lastIdx, m.index));
      out += m[0];
      lastIdx = re.lastIndex;
    }
    out += normalizePersianChars(s.slice(lastIdx));
    return out;
  }

  // ============================================================
  // 2b) لایهٔ تبدیل «نمایش چاپی» → «نمایش وب»
  // ============================================================
  function shouldNormalizeBlock(block) {
    if (!block) return false;
    if (block.type === 'anchor' || block.type === 'hr' || block.type === 'range-title') return false;
    if (block.type === 'code' && block.lang === 'arabic') return false;
    if (block.type === 'arabic-raw') return false;
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

  function escapeRe(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function hasUnclosedBracket(text) {
    const s = String(text || '');
    const pairs = [
      ['«', '»'],
      ['(', ')'],
      ['[', ']'],
      ['{', '}'],
      ['﴿', '﴾'],
    ];
    for (const [open, close] of pairs) {
      const o = (s.match(new RegExp(escapeRe(open), 'g')) || []).length;
      const c = (s.match(new RegExp(escapeRe(close), 'g')) || []).length;
      if (o > c) return true;
    }
    return false;
  }

  function endsWithTerminator(text) {
    return /[.؟!:؛»\)\]\u06D4\u061F…]\s*$/.test(String(text || ''));
  }

  function startsWithNewBlockMarker(text) {
    const t = String(text || '').trimStart();
    if (!t) return true;
    return /^[﴿#>\-*•\u06F0-\u06F9\d]/.test(t);
  }

  function shouldRejoinParagraphs(prevText, nextText) {
    if (!prevText || !nextText) return false;
    if (hasUnclosedBracket(prevText)) return true;
    if (endsWithTerminator(prevText)) return false;
    if (startsWithNewBlockMarker(nextText)) return false;
    return true;
  }

  function rejoinPrintBreaks(blocks) {
    const out = [];
    let i = 0;
    while (i < blocks.length) {
      const cur = blocks[i];
      if (cur.type !== 'paragraph') { out.push(cur); i++; continue; }
      let text = cur.text;
      let j = i + 1;
      while (j < blocks.length
          && blocks[j].type === 'paragraph'
          && shouldRejoinParagraphs(text, blocks[j].text)) {
        text = text.replace(/\s+$/, '') + ' ' + blocks[j].text.replace(/^\s+/, '');
        j++;
      }
      out.push(j > i + 1 ? { ...cur, text } : cur);
      i = j;
    }
    return out;
  }

  function processPrintArtifacts(blocks) {
    const normalized = blocks.map(normalizeBlock);
    return rejoinPrintBreaks(normalized);
  }

  // ============================================================
  // 3) CONTENT PIPELINE
  // ============================================================
  function parseContent(rawText) {
    let text = String(rawText || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');

    text = text
      .replace(/^\s*\*{4,}\s*\n+/, '')
      .replace(/\n+\s*\*{4,}\s*$/, '');

    const lines = text.split('\n');
    const blocks = [];

    let paraBuf = [];
    let listBuf = null;

    const flushPara = () => {
      if (!paraBuf.length) return;
      const t = paraBuf.join('\n').trim();
      if (t) blocks.push({ type: 'paragraph', text: t });
      paraBuf = [];
    };
    const flushList = () => {
      if (listBuf) { blocks.push(listBuf); listBuf = null; }
    };

    let i = 0;
    while (i < lines.length) {
      const raw = lines[i];
      const line = raw.trim();

      if (!line) { flushPara(); flushList(); i++; continue; }

      const fm = line.match(/^```([a-zA-Z0-9_-]*)\s*$/);
      if (fm) {
        flushPara(); flushList();
        const lang = (fm[1] || '').toLowerCase();
        const body = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) {
          body.push(lines[i]);
          i++;
        }
        i++;
        blocks.push({ type: 'code', lang, body: body.join('\n') });
        continue;
      }

      const hm = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (hm) {
        flushPara(); flushList();
        const level = hm[1].length;
        const headingText = hm[2].trim();

        const rm = headingText.match(
          /^\[\s*سوره\s+(.+?)\s*[(（]\s*([\d\u06F0-\u06F9]+)\s*[)）]\s*[:：]\s*.+?\s*([\d\u06F0-\u06F9]+)\s*تا\s*([\d\u06F0-\u06F9]+)\s*\]$/
        );
        if (rm) {
          blocks.push({
            type: 'range-title',
            surahName: rm[1].trim(),
            surahNum: Number(faToEnDigits(rm[2])),
            from: Number(faToEnDigits(rm[3])),
            to:   Number(faToEnDigits(rm[4])),
          });
        } else {
          blocks.push({ type: 'heading', level, text: headingText });
        }
        i++;
        continue;
      }

      const am = line.match(/^<span\s+id=["']surah-(\d+)-ayah-(\d+)["']\s*>\s*<\/span>\s*$/i);
      if (am) {
        flushPara(); flushList();
        blocks.push({
          type: 'anchor',
          surah: Number(am[1]),
          ayah: Number(am[2]),
        });
        i++;
        continue;
      }

      const ulm = line.match(/^[-*•·]\s+(.+)$/);
      if (ulm) {
        flushPara();
        if (!listBuf || listBuf.type !== 'ul') {
          flushList();
          listBuf = { type: 'ul', items: [] };
        }
        listBuf.items.push(ulm[1]);
        i++;
        continue;
      }

      const olm = line.match(/^(\d+)[.)]\s+(.+)$/);
      if (olm) {
        flushPara();
        if (!listBuf || listBuf.type !== 'ol') {
          flushList();
          listBuf = { type: 'ol', items: [] };
        }
        listBuf.items.push(olm[2]);
        i++;
        continue;
      }

      if (line.startsWith('>')) {
        flushPara(); flushList();
        const q = [line.replace(/^>\s?/, '')];
        i++;
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          q.push(lines[i].trim().replace(/^>\s?/, ''));
          i++;
        }
        blocks.push({ type: 'quote', text: q.join('\n') });
        continue;
      }

      if (/^[-*_]{3,}$/.test(line)) {
        flushPara(); flushList();
        blocks.push({ type: 'hr' });
        i++;
        continue;
      }

      flushList();
      paraBuf.push(line);
      i++;
    }
    flushPara();
    flushList();

    for (let j = 0; j < blocks.length; j++) {
      if (blocks[j].type !== 'anchor') continue;
      let k = j + 1;
      while (k < blocks.length && blocks[k].type === 'anchor') k++;
      if (k >= blocks.length) continue;
      const nx = blocks[k];
      if (nx.type === 'paragraph' && looksLikeQuran(nx.text)) {
        nx.type = 'arabic-raw';
        nx.ayah = blocks[j].ayah;
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
    s = s.replace(/[ \t]*\n+[ \t]*/g, ' ');

    return s;
  }

  function renderAyahBlock(rawText, fallbackNum) {
    const trimmed = String(rawText || '').trim();
    if (!trimmed) return '';

    const numMatch = trimmed.match(/\s*[(（]\s*([\d\u0660-\u0669\u06F0-\u06F9]+)\s*[)）]\s*$/);
    let display = trimmed;
    let num = null;
    if (numMatch) {
      display = trimmed.slice(0, numMatch.index).trim();
      num = Number(faToEnDigits(numMatch[1]));
    }
    const ayahNum = num || fallbackNum || null;

    const badge = ayahNum
      ? `<span class="mizan-ayah__badge" aria-label="آیهٔ ${ayahNum}">آیهٔ ${UI.toPersianDigits(ayahNum)}</span>`
      : '';

    return `<div class="mizan-ayah" data-ayah="${ayahNum || ''}">
  <p class="mizan-ayah__text">${escapeHtml(display)}</p>
  ${badge}
</div>`;
  }

  function renderBlock(block, ctx) {
    switch (block.type) {

      case 'range-title':
        return `<div class="mizan-title">
  <span class="mizan-title__ornament" aria-hidden="true"></span>
  <span class="mizan-title__text">سورهٔ ${escapeHtml(block.surahName)} · آیات ${UI.toPersianDigits(block.from)} تا ${UI.toPersianDigits(block.to)}</span>
  <span class="mizan-title__ornament" aria-hidden="true"></span>
</div>`;

      case 'heading': {
        const lvl = Math.min(Math.max(block.level, 2), 4);
        if (lvl === 2) return `<h2 class="mizan-h2">${renderInline(block.text)}</h2>`;
        if (lvl === 3) return `<h3 class="mizan-h3">${renderInline(block.text)}</h3>`;
        return `<h4 class="mizan-h4">${renderInline(block.text)}</h4>`;
      }

      case 'anchor':
        return `<span class="mizan-anchor" id="surah-${block.surah}-ayah-${block.ayah}" data-ayah="${block.ayah}" aria-hidden="true"></span>`;

      case 'code':
        if (block.lang === 'arabic') return renderAyahBlock(block.body, ctx.lastAyah);
        if (block.lang === 'farsi') {
          return `<div class="mizan-translation">
  <div class="mizan-translation__label">ترجمهٔ آیات</div>
  <p class="mizan-translation__text">${renderInline(block.body.trim())}</p>
</div>`;
        }
        return `<pre class="mizan-code"><code>${escapeHtml(block.body)}</code></pre>`;

      case 'arabic-raw':
        return renderAyahBlock(block.text, block.ayah || ctx.lastAyah);

      case 'paragraph':
        return `<p class="mizan-p">${renderInline(block.text)}</p>`;

      case 'quote':
        return `<blockquote class="mizan-quote">${renderInline(block.text)}</blockquote>`;

      case 'ul':
        return `<ul class="mizan-list">${block.items.map((it) => `<li>${renderInline(it)}</li>`).join('')}</ul>`;

      case 'ol':
        return `<ol class="mizan-list mizan-list--ol">${block.items.map((it) => `<li>${renderInline(it)}</li>`).join('')}</ol>`;

      case 'hr':
        return `<hr class="mizan-hr">`;

      default:
        return '';
    }
  }

  function renderBlocks(blocks) {
    const out = [];
    const ctx = { lastAyah: null };
    for (const b of blocks) {
      if (b.type === 'anchor') ctx.lastAyah = b.ayah;
      out.push(renderBlock(b, ctx));
    }
    return out.filter(Boolean).join('\n');
  }

  // ============================================================
  // 4) STATE MACHINE
  // ============================================================
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

  // ============================================================
  // 5) CARET / ANCHOR
  // ============================================================
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
      },
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
        } catch (e) { return null; }
      }
    }
    const last = map[map.length - 1];
    const r = document.createRange();
    try {
      r.setStart(last.node, last.len);
      r.setEnd(last.node, last.len);
      return r;
    } catch (e) { return null; }
  }

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

  function resolveContentIdForBlock(blockEl) {
    if (!mizanContentKeys.length) return null;
    if (mizanContentKeys.length === 1) return mizanContentKeys[0];
    const page = blockEl && blockEl.closest && blockEl.closest('.mizan-page');
    if (!page) return mizanContentKeys[0];
    const idx = Array.from(mizanContent.querySelectorAll('.mizan-page')).indexOf(page);
    return mizanContentKeys[idx] || mizanContentKeys[0];
  }

  // ============================================================
  // 6) NOTES
  // ============================================================
  function insertInlineNoteAt(rootEl, note) {
    const blocks = rootEl.querySelectorAll(NOTE_BLOCK_SELECTOR);
    const beforeN = normalizeChars(note.anchor_before || '');
    const afterN  = normalizeChars(note.anchor_after  || '');
    const fullN   = beforeN + afterN;

    for (const block of blocks) {
      if (block.querySelector(`.mizan-note-inline[data-note-id="${note.id}"]`)) {
        return true;
      }

      const { text, map } = collectBlockText(block);
      if (!text) continue;
      const normText = normalizeChars(text);

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
      } catch (e) { continue; }
    }
    return false;
  }

  function injectMizanNotes(rootEl) {
    if (!rootEl || !mizanNotes.length) return;

    rootEl.querySelectorAll('.mizan-note-inline').forEach((el) => {
      const parent = el.parentNode;
      if (!parent) return;
      const txt = document.createTextNode(el.textContent || '');
      parent.replaceChild(txt, el);
      parent.normalize();
    });

    const orphans = [];
    for (const note of mizanNotes) {
      const ok = insertInlineNoteAt(rootEl, note);
      if (!ok) orphans.push(note);
    }

    const oldOrphans = rootEl.querySelector('.mizan-orphans');
    if (oldOrphans) oldOrphans.remove();

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
    if (e.target.classList && e.target.classList.contains('mizan-note-inline')) return;
    hideNotePopup();
  });

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
    noteSaving = false;
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
    noteSaving = false;
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

  // ذخیرهٔ یادداشت — با delegation روی document
  document.addEventListener('click', async (e) => {
    const btn = e.target && e.target.closest && e.target.closest('#mizanNoteSaveBtn');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    if (noteSaving) return;
    noteSaving = true;

    try {
      const text = (mizanNoteInput && mizanNoteInput.value || '').trim();
      if (!text) { UI.toast('متن یادداشت خالی است'); return; }

      if (!pendingNoteAnchor) {
        const anchor = getCursorAnchor();
        if (anchor) {
          const contentId = resolveContentIdForBlock(anchor.block);
          if (contentId) {
            pendingNoteAnchor = {
              contentId,
              before: anchor.before,
              after: anchor.after,
            };
          }
        }
      }
      if (!pendingNoteAnchor) {
        const fallbackId = mizanContentKeys[0] || null;
        if (!fallbackId) {
          UI.toast('موقعیت یادداشت معتبر نیست');
          return;
        }
        pendingNoteAnchor = { contentId: fallbackId, before: '', after: '' };
      }

      if (editingNoteId) {
        await Store.updateMizanNote(editingNoteId, text);
        UI.toast('یادداشت به‌روزرسانی شد');
      } else {
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
    } catch (err) {
      console.error('[mizan note] save failed:', err);
      UI.toast('خطا: ' + (err && err.message ? err.message : 'نامشخص'));
    } finally {
      noteSaving = false;
    }
  }, true);

  // حذف یادداشت — با delegation مشابه
  document.addEventListener('click', async (e) => {
    const btn = e.target && e.target.closest && e.target.closest('#mizanNoteDeleteBtn');
    if (!btn) return;
    if (btn.style.display === 'none') return;
    e.preventDefault();
    e.stopPropagation();

    if (!editingNoteId) return;
    if (!confirm('این یادداشت حذف شود؟')) return;
    try {
      await Store.deleteMizanNote(editingNoteId);
      closeNoteModal();
      UI.toast('یادداشت حذف شد');
      await reloadMizanNotesAndRerender();
    } catch (err) {
      console.error('[mizan note] delete failed:', err);
      UI.toast('خطا در حذف');
    }
  }, true);

  function showNoteAddBtn() { if (mizanNoteBtn) mizanNoteBtn.hidden = false; }
  function hideNoteAddBtn() { if (mizanNoteBtn) mizanNoteBtn.hidden = true; }

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
    if (!anchor) { UI.toast('موقعیت یادداشت پیدا نشد'); return; }
    const { data } = await sb.auth.getSession();
    if (!data?.session) {
      UI.toast('برای افزودن یادداشت باید وارد حساب شوید');
      return;
    }
    const contentId = resolveContentIdForBlock(anchor.block);
    if (!contentId) { UI.toast('خطا در تشخیص محتوا'); return; }

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
      mizanNotes = dedupeById(all.flat());
      const prevPage = mizanCurrentPage;
      await renderMizan(lastSurah, lastAyah, { keepPage: prevPage });
    } catch (e) {
      console.warn('[mizan] reload notes failed:', e);
    }
  }

  // ============================================================
  // 7) TAGS
  // ============================================================
  function parseMizanTaggerResponse(text) {
    if (!text) return [];
    const tags = [];
    const lines = String(text).split(/\r?\n/);

    const ARROW = '[←⟵⟸⇐➔➜➝➞→►▶▸]';
    const DOTS  = '(?:…+|\\.{3,}|⋯|•••)';
    const PIPE  = '[|¦│┃｜]';
    const NUM   = '[\\u06F0-\\u06F9\\d]+';

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

      line = line.replace(/^[-*•·●◆◇]\s+/, '');
      line = line.replace(/^[`«"'(\[]+/, '');
      line = line.replace(/[`»"')\]]+$/, '').trim();
      if (!line) continue;

      const m = line.match(lineRe);
      if (!m) continue;

      const aStart = m[1] ? Number(faToEnDigits(m[1])) : 0;
      const aEnd   = m[4] ? Number(faToEnDigits(m[4])) : 0;
      const ayah = aStart || aEnd;
      if (!ayah) continue;

      const startExcerpt = (m[2] || '').trim();
      const endExcerpt   = (m[3] || '').trim();
      if (!startExcerpt || !endExcerpt) continue;
      if ((startExcerpt.length + endExcerpt.length) < 8) continue;

      tags.push({ ayah, startExcerpt, endExcerpt });
    }
    return tags;
  }

  async function filterTrivialTags(tags, surah, ayah) {
    if (!tags || !tags.length) return tags;
    let ayahObj = null;
    try { ayahObj = await QuranData.getAyah(surah, ayah); } catch (e) { return tags; }
    if (!ayahObj) return tags;

    const translation = stripDiacritics(normalizeChars(ayahObj.fa || ''));
    const arabic      = stripDiacritics(normalizeChars(ayahObj.ar || ''));

    const out = [];
    for (const tag of tags) {
      const sN = stripDiacritics(normalizeChars(tag.startExcerpt || ''));
      const eN = stripDiacritics(normalizeChars(tag.endExcerpt   || ''));
      if (sN.length < 3 || eN.length < 3) { out.push(tag); continue; }
      const inTrans = translation.length > 0 && translation.includes(sN) && translation.includes(eN);
      const inAr    = arabic.length > 0 && arabic.includes(sN) && arabic.includes(eN);
      if (inTrans || inAr) {
        console.info('[mizan tagger] dropped trivial tag:', tag);
        continue;
      }
      out.push(tag);
    }
    return out;
  }

  function findExcerptRange(rootEl, excerpt) {
    const raw = String(excerpt || '').trim();
    if (!raw) return null;
    const needle = normalizeChars(raw);
    if (!needle) return null;

    const blocks = rootEl.querySelectorAll(NOTE_BLOCK_SELECTOR);
    for (const block of blocks) {
      const { text, map } = collectBlockText(block);
      if (!text) continue;
      const normText = normalizeChars(text);
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

    rootEl.querySelectorAll('.mizan-tag-marker').forEach((m) => m.remove());

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

  function openTaggerRawModal(results) {
    if (!mizanTaggerRawModal) return;
    pendingTaggerResults = results;

    const hasError = results.some((r) => r.error);
    const totalTags = results.reduce((acc, r) => acc + (r.tags ? r.tags.length : 0), 0);
    const totalDropped = results.reduce((acc, r) => acc + (r.dropped || 0), 0);
    const model = results.find((r) => r.model)?.model || '—';

    mizanTaggerRawMeta.setAttribute('data-error', hasError ? 'true' : 'false');
    mizanTaggerRawMeta.innerHTML = `
      <span>محتواها: <b>${UI.toPersianDigits(results.length)}</b></span>
      <span>تگ‌های معتبر: <b>${UI.toPersianDigits(totalTags)}</b></span>
      ${totalDropped > 0 ? `<span>حذف‌شده (ترجمه/عین آیه): <b>${UI.toPersianDigits(totalDropped)}</b></span>` : ''}
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
    if (!valid.length) { UI.toast('چیزی برای ذخیره نیست'); return; }
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
    } catch (e) { UI.toast('کپی ناموفق بود'); }
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
        const parsedRaw = parseMizanTaggerResponse(result.content);
        const parsed = await filterTrivialTags(parsedRaw, lastSurah, lastAyah);
        const dropped = Math.max(0, parsedRaw.length - parsed.length);

        results.push({
          contentId: cid,
          raw: result.content,
          model: result.model || null,
          tags: parsed,
          dropped,
          error: false,
          status: result.status,
        });
      } catch (err) {
        results.push({
          contentId: cid,
          raw: (err && err.raw) ? err.raw : (err && err.message) ? err.message : String(err),
          model: null,
          tags: [],
          dropped: 0,
          error: true,
          status: err && err.status ? err.status : null,
        });
      }
    }

    setTaggerState('idle');
    openTaggerRawModal(results);
  }

  if (mizanTaggerBtn) mizanTaggerBtn.addEventListener('click', runMizanTagger);

  // ============================================================
  // 8) PAGINATION
  // ============================================================
  function paginateMizan(rootEl) {
    const children = Array.from(rootEl.children)
      .filter((c) => !c.classList.contains('mizan-orphans'));
    const orphansBox = rootEl.querySelector('.mizan-orphans');

    const rawGroups = [];
    let current = null;

    children.forEach((child) => {
      const isHeading = child.tagName === 'H3' || child.tagName === 'H4';
      if (isHeading || !current) {
        if (current) rawGroups.push(current);
        current = {
          heading: isHeading ? child.textContent.trim() : 'شروع',
          nodes: [child],
        };
      } else {
        current.nodes.push(child);
      }
    });
    if (current) rawGroups.push(current);

    const pageGroups = [];
    let pendingHeadings = [];
    let pendingHeadingText = null;

    for (const g of rawGroups) {
      const onlyHeading = g.nodes.length === 1 && /^H[34]$/.test(g.nodes[0].tagName || '');

      if (onlyHeading) {
        pendingHeadings.push(g.nodes[0]);
        if (!pendingHeadingText) pendingHeadingText = g.heading;
        continue;
      }

      if (pendingHeadings.length) {
        g.nodes = [...pendingHeadings, ...g.nodes];
        if (pendingHeadingText) g.heading = pendingHeadingText;
        pendingHeadings = [];
        pendingHeadingText = null;
      }
      pageGroups.push(g);
    }

    if (pendingHeadings.length) {
      if (pageGroups.length) {
        const last = pageGroups[pageGroups.length - 1];
        last.nodes.push(...pendingHeadings);
      } else {
        pageGroups.push({
          heading: pendingHeadingText || 'شروع',
          nodes: pendingHeadings,
        });
      }
    }

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
    if (mizanPages.length <= 1) { mizanPager.classList.add('hidden'); return; }
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
      try { await Store.saveMizanProgress(mizanContentKeys.join('-'), pageIndex); } catch (e) {}
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

  function openMizanToc() { if (!mizanTocModal) return; buildMizanToc(); mizanTocModal.hidden = false; }
  function closeMizanToc() { if (mizanTocModal) mizanTocModal.hidden = true; }

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

  // ============================================================
  // 9) MAIN RENDER
  // ============================================================
  async function renderMizan(surah, ayah, opts = {}) {
    const mySeq = ++renderSeq;

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
      if (mySeq !== renderSeq) return;

      if (!contents || !contents.length) {
        showMizanState('empty');
        if (mizanTaggerBtn) mizanTaggerBtn.classList.add('hidden');
        return;
      }

      mizanContentKeys = Array.from(new Set(contents.map((c) => c.content_id)));

      try {
        const allNotes = await Promise.all(mizanContentKeys.map((cid) => Store.getMizanNotes(cid)));
        if (mySeq !== renderSeq) return;
        mizanNotes = dedupeById(allNotes.flat());
      } catch (e) { mizanNotes = []; }

      try {
        const allTags = await Promise.all(mizanContentKeys.map((cid) => Store.getMizanTags(cid)));
        if (mySeq !== renderSeq) return;
        const filtered = await filterTrivialTags(allTags.flat(), surah, ayah);
        if (mySeq !== renderSeq) return;
        mizanTags = dedupeById(filtered);
      } catch (e) { mizanTags = []; }

      if (mySeq !== renderSeq) return;

      let range = null;
      const allBlocks = [];
      for (const c of contents) {
        const blocks = parseContent(c.text);
        if (!range) {
          const rt = blocks.find((b) => b.type === 'range-title');
          if (rt) range = { from: rt.from, to: rt.to };
        }
        allBlocks.push(...blocks);
      }

      const processed = processPrintArtifacts(allBlocks);
      const html = renderBlocks(processed);

      if (mySeq !== renderSeq) return;

      showMizanState('content', { html, range });

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
          try { saved = await Store.getMizanProgress(mizanContentKeys.join('-')); } catch (e) {}
          if (mySeq !== renderSeq) return;
          if (typeof saved === 'number' && saved >= 0 && saved < mizanPages.length) {
            showMizanPage(saved);
          } else {
            showMizanPage(0);
            jumpToAyahPage();
          }
        }
      }
    } catch (e) {
      if (mySeq !== renderSeq) return;
      console.warn('[mizan] load failed:', e);
      showMizanState('error', { message: 'تفسیر المیزان برای این آیه در دسترس نیست.' });
      if (mizanTaggerBtn) mizanTaggerBtn.classList.add('hidden');
    }
  }

  return { render: renderMizan };
})();