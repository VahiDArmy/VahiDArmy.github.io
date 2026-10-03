// =============================================================
// تجزیه و رندر قالب پاسخ هوش مصنوعی
// قالب:
//   [[AI]]
//   <title>…</title>
//   <answer>…</answer>
//   <insight>…</insight>
//   <refs><ref s="2" a="255">…</ref></refs>
//   <tags><tag>…</tag></tags>
//   <draft>…</draft>
//   <caution>…</caution>
//   [[/AI]]
// =============================================================
const AiFormat = (function () {
  const OPEN = '[[AI]]';
  const CLOSE = '[[/AI]]';

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str == null ? '' : str);
    return div.innerHTML;
  }

  // --- پارسر اصلی ---
  function parse(raw) {
    if (!raw) return { ok: false, raw: '' };
    const trimmed = raw.trim();
    if (!trimmed.startsWith(OPEN)) return { ok: false, raw: trimmed };

    let inner = trimmed.slice(OPEN.length);
    const closeIdx = inner.lastIndexOf(CLOSE);
    if (closeIdx >= 0) inner = inner.slice(0, closeIdx);
    inner = inner.trim();

    const pick = (name) => {
      const re = new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, 'i');
      const m = inner.match(re);
      return m ? m[1].trim() : null;
    };

    const title   = pick('title');
    const answer  = pick('answer');
    const insight = pick('insight');
    const draft   = pick('draft');
    const caution = pick('caution');

    // refs
    const refsRaw = pick('refs') || '';
    const refs = [];
    const refRe = /<ref\b([^>]*?)(?:\/>|>([\s\S]*?)<\/ref>)/gi;
    let m;
    while ((m = refRe.exec(refsRaw))) {
      const attrs = m[1] || '';
      const label = (m[2] || '').trim();
      const s = (attrs.match(/\bs\s*=\s*"(\d{1,3})"/i) || [])[1];
      const a = (attrs.match(/\ba\s*=\s*"(\d{1,3})"/i) || [])[1];
      if (s && a) refs.push({ surah: Number(s), ayah: Number(a), label });
    }

    // tags
    const tagsRaw = pick('tags') || '';
    const tags = [];
    const tagRe = /<tag>([\s\S]*?)<\/tag>/gi;
    while ((m = tagRe.exec(tagsRaw))) {
      const t = m[1].trim();
      if (t) tags.push(t);
    }

    if (!answer) {
      return { ok: false, raw: trimmed };
    }
    return { ok: true, title, answer, insight, refs, tags, draft, caution };
  }

  // --- رندر مارک‌داون امن ---
  function renderMarkdown(md) {
    if (!md) return '';
    if (!window.marked || !window.DOMPurify) {
      return escapeHtml(md).replace(/\n/g, '<br>');
    }
    const raw = window.marked.parse(md);
    const clean = window.DOMPurify.sanitize(raw, { ADD_ATTR: ['target', 'rel'] });
    const tmp = document.createElement('div');
    tmp.innerHTML = clean;
    tmp.querySelectorAll('table').forEach((tbl) => {
      if (tbl.parentElement && tbl.parentElement.classList.contains('table-scroll')) return;
      const wrap = document.createElement('div');
      wrap.className = 'table-scroll';
      tbl.parentNode.insertBefore(wrap, tbl);
      wrap.appendChild(tbl);
    });
    return tmp.innerHTML;
  }

  // --- رندر غنی: مارک‌داون + توکن‌های [[سوره:آیه]] + برچسب‌های درون‌متنی ---
  function renderRich(text, surahIndex, inlineTags) {
    let html = renderMarkdown(text);
    html = html.replace(
      /\[\[(\d{1,3}):(\d{1,3})(?:\|([^\]]{1,120}))?\]\]/g,
      (_, s, a, label) => {
        const sN = Number(s);
        const nameFa = (surahIndex || []).find((x) => x.number === sN)?.name_fa || sN;
        const lbl = label
          ? escapeHtml(label.trim())
          : `سورهٔ ${nameFa}، آیهٔ ${UI.toPersianDigits(a)}`;
        return `<a class="ayah-link" href="browse.html?surah=${s}&ayah=${a}" title="سورهٔ ${nameFa}، آیهٔ ${UI.toPersianDigits(a)}">${lbl}</a>`;
      }
    );
    if (inlineTags && inlineTags.length) {
      html = UI.highlightTags(html, inlineTags);
    }
    return html;
  }

  // --- بلوک یک بخش رنگی ---
  function sectionHtml({ hue, label, body, extra = '' }) {
    return `
      <div class="ai-section" style="--hue:${hue}">
        <div class="ai-section__label">
          <span class="ai-section__dot"></span>${escapeHtml(label)}
        </div>
        <div class="ai-section__body">${body}</div>
        ${extra}
      </div>`;
  }

  // --- رندر کل کارت پاسخ ---
  function render(container, parsed, opts) {
    const { model, question, surahIndex } = opts || {};

    const qHtml = `
      <div class="ai-answer-card__question">
        <span class="ai-answer-card__q-label">پرسش شما</span>${escapeHtml(question || '')}
      </div>`;

    const footerHtml = `
      <div class="ai-answer-card__footer">
        پاسخ از: <code>${escapeHtml(model || '—')}</code>
      </div>`;

    if (!parsed.ok) {
      container.innerHTML = `
        <div class="ai-answer-card card">
          ${qHtml}
          ${sectionHtml({
            hue: 20,
            label: 'پاسخ خام (قالب مورد انتظار رعایت نشد)',
            body: renderRich(parsed.raw, surahIndex),
          })}
          ${footerHtml}
        </div>`;
      return;
    }

    const inlineTags = parsed.tags || [];
    const blocks = [];

    if (parsed.answer) {
      blocks.push(sectionHtml({
        hue: 340,
        label: 'پاسخ',
        body: renderRich(parsed.answer, surahIndex, inlineTags),
      }));
    }
    if (parsed.insight) {
      blocks.push(sectionHtml({
        hue: 210,
        label: 'نکته',
        body: renderRich(parsed.insight, surahIndex, inlineTags),
      }));
    }
    if (parsed.refs && parsed.refs.length) {
      const pills = parsed.refs.map((r) => {
        const nameFa = (surahIndex || []).find((x) => x.number === r.surah)?.name_fa || r.surah;
        const lbl = r.label
          ? escapeHtml(r.label)
          : `سورهٔ ${nameFa}، آیهٔ ${UI.toPersianDigits(r.ayah)}`;
        return `<a class="ai-ref" href="browse.html?surah=${r.surah}&ayah=${r.ayah}">↗ ${lbl}</a>`;
      }).join('');
      blocks.push(sectionHtml({
        hue: 270,
        label: 'ارجاع‌ها',
        body: `<div class="ai-refs">${pills}</div>`,
      }));
    }
    if (inlineTags.length) {
      const tagPills = inlineTags.map((t) => {
        const c = UI.tagColor(t);
        return `<button type="button" class="ai-tag-pill"
          data-ai-tag="${escapeHtml(t)}"
          style="color:${c.color};border-color:${c.border};text-shadow:0 0 6px ${c.glow};">
          <span class="ai-tag-pill__add">＋</span>${escapeHtml(t)}
        </button>`;
      }).join('');
      blocks.push(sectionHtml({
        hue: 150,
        label: 'برچسب‌های پیشنهادی',
        body: `<div class="ai-tags">${tagPills}</div>`,
      }));
    }
    if (parsed.draft) {
      blocks.push(sectionHtml({
        hue: 40,
        label: 'پیش‌نویس تفسیر',
        body: `<div class="ai-draft-body">${renderRich(parsed.draft, surahIndex, inlineTags)}</div>`,
        extra: `<div class="ai-draft-actions">
          <button type="button" class="btn btn--sm" data-ai-insert-draft>درج در فرم تفسیر</button>
        </div>`,
      }));
    }
    if (parsed.caution) {
      blocks.push(sectionHtml({
        hue: 0,
        label: 'احتیاط',
        body: renderRich(parsed.caution, surahIndex, inlineTags),
      }));
    }

    container.innerHTML = `
      <div class="ai-answer-card card">
        ${qHtml}
        ${parsed.title ? `<h3 class="ai-answer-card__title">${escapeHtml(parsed.title)}</h3>` : ''}
        ${blocks.join('')}
        ${footerHtml}
      </div>`;
  }

  // --- نمایش خام حین استریم ---
  function renderStreaming(container, question, text, model) {
    container.innerHTML = `
      <div class="ai-answer-card card">
        <div class="ai-answer-card__question">
          <span class="ai-answer-card__q-label">پرسش شما</span>${escapeHtml(question || '')}
        </div>
        <div class="ai-answer-card__stream" id="aiStreamBox">${escapeHtml(text || '')}</div>
        <div class="ai-answer-card__footer">
          پاسخ از: <code>${escapeHtml(model || '—')}</code>
        </div>
      </div>`;
    const box = container.querySelector('#aiStreamBox');
    if (box) box.scrollTop = box.scrollHeight;
  }

  return { parse, render, renderStreaming, renderMarkdown, renderRich, escapeHtml };
})();