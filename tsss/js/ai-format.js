// =============================================================
// تجزیه، رندر، ویرایش و سریال‌سازی قالب پاسخ هوش مصنوعی
// =============================================================
const AiFormat = (function () {
  const OPEN = '[[AI]]';
  const CLOSE = '[[/AI]]';

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str == null ? '' : str);
    return div.innerHTML;
  }

  function attrEsc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ---------- پارسر ----------
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

    const tagsRaw = pick('tags') || '';
    const tags = [];
    const tagRe = /<tag>([\s\S]*?)<\/tag>/gi;
    while ((m = tagRe.exec(tagsRaw))) {
      const t = m[1].trim();
      if (t) tags.push(t);
    }

    if (!answer) return { ok: false, raw: trimmed };
    return { ok: true, title, answer, insight, refs, tags, draft, caution };
  }

  // ---------- رندر مارک‌داون امن ----------
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

  // ---------- رندر غنی ----------
  // فقط مارک‌داون + ارجاع‌های [[سوره:آیه]].
  // تشخیص برچسب در متن انجام نمی‌شود.
  function renderRich(text, surahIndex) {
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
    return html;
  }

  // ---------- ساخت یک بخش ----------
  function sectionHtml({ hue, label, body, extra = '', type, raw = '', editable = true }) {
    const editBtn = editable
      ? `<button type="button" class="ai-section__btn" data-section-action="edit" title="ویرایش">✎</button>`
      : '';
    return `
      <div class="ai-section" style="--hue:${hue}" data-section-type="${type}" data-raw="${attrEsc(raw)}">
        <div class="ai-section__header">
          <div class="ai-section__label">
            <span class="ai-section__dot"></span>${escapeHtml(label)}
          </div>
          <div class="ai-section__actions">
            ${editBtn}
            <button type="button" class="ai-section__btn" data-section-action="delete" title="حذف">✕</button>
          </div>
        </div>
        <div class="ai-section__body">${body}</div>
        ${extra}
      </div>`;
  }

  // ---------- سریال‌سازی از DOM ----------
  function serializeFromDom(card) {
    const titleEl = card.querySelector('.ai-answer-card__title');
    const title = titleEl ? titleEl.textContent.trim() : null;

    const getRaw = (type) => {
      const el = card.querySelector(`[data-section-type="${type}"]`);
      return el ? (el.getAttribute('data-raw') || '') : null;
    };
    const answer  = getRaw('answer');
    const insight = getRaw('insight');
    const draft   = getRaw('draft');
    const caution = getRaw('caution');

    const refs = Array.from(card.querySelectorAll('[data-section-type="refs"] .ai-ref')).map((el) => ({
      s: el.dataset.s,
      a: el.dataset.a,
      label: el.dataset.label || '',
    }));

    const tags = Array.from(card.querySelectorAll('[data-section-type="tags"] .ai-tag-pill')).map(
      (el) => el.dataset.aiTag
    );

    let out = '[[AI]]\n';
    if (title) out += `<title>${title}</title>\n`;
    if (answer  && answer.trim())  out += `<answer>\n${answer}\n</answer>\n`;
    if (insight && insight.trim()) out += `<insight>\n${insight}\n</insight>\n`;
    if (refs.length) {
      out += '<refs>\n';
      refs.forEach((r) => {
        if (r.label) out += `<ref s="${r.s}" a="${r.a}">${r.label}</ref>\n`;
        else out += `<ref s="${r.s}" a="${r.a}" />\n`;
      });
      out += '</refs>\n';
    }
    if (tags.length) {
      out += '<tags>\n' + tags.map((t) => `<tag>${t}</tag>`).join('\n') + '\n</tags>\n';
    }
    if (draft   && draft.trim())   out += `<draft>\n${draft}\n</draft>\n`;
    if (caution && caution.trim()) out += `<caution>\n${caution}\n</caution>\n`;
    out += '[[/AI]]';
    return out;
  }

  // ---------- رندر کل کارت ----------
  function render(container, parsed, opts) {
    opts = opts || {};
    const { model, question, surahIndex } = opts;

    const deleteBtn = typeof opts.onDelete === 'function'
      ? `<button type="button" class="ai-answer-card__delete" data-delete-response>✕ حذف پاسخ</button>`
      : '';

    const qHtml = `
      <div class="ai-answer-card__question">
        <span class="ai-answer-card__q-label">پرسش شما</span>${escapeHtml(question || '')}
      </div>`;

    const footerHtml = `
      <div class="ai-answer-card__footer">
        <span>پاسخ از: <code>${escapeHtml(model || '—')}</code></span>
        ${deleteBtn}
      </div>`;

    if (!parsed.ok) {
      container.innerHTML = `
        <div class="ai-answer-card card">
          ${qHtml}
          ${sectionHtml({
            hue: 20,
            type: 'raw',
            label: 'پاسخ خام (قالب مورد انتظار رعایت نشد)',
            body: renderRich(parsed.raw, surahIndex),
            raw: parsed.raw,
            editable: false,
          })}
          ${footerHtml}
        </div>`;
      wireCard(container.querySelector('.ai-answer-card'), opts);
      return;
    }

    const inlineTags = parsed.tags || [];
    const blocks = [];

    if (parsed.answer) {
      blocks.push(sectionHtml({
        hue: 340, type: 'answer', label: 'پاسخ',
        body: renderRich(parsed.answer, surahIndex),
        raw: parsed.answer,
      }));
    }
    if (parsed.insight) {
      blocks.push(sectionHtml({
        hue: 210, type: 'insight', label: 'نکته',
        body: renderRich(parsed.insight, surahIndex),
        raw: parsed.insight,
      }));
    }
    if (parsed.refs && parsed.refs.length) {
      const pills = parsed.refs.map((r) => {
        const nameFa = (surahIndex || []).find((x) => x.number === r.surah)?.name_fa || r.surah;
        const lbl = r.label
          ? escapeHtml(r.label)
          : `سورهٔ ${nameFa}، آیهٔ ${UI.toPersianDigits(r.ayah)}`;
        return `<span class="ai-ref" data-s="${r.surah}" data-a="${r.ayah}" data-label="${attrEsc(r.label || '')}">
          <a href="browse.html?surah=${r.surah}&ayah=${r.ayah}">↗ ${lbl}</a>
          <button type="button" class="ai-ref__remove" data-remove-ref title="حذف این ارجاع" aria-label="حذف">✕</button>
        </span>`;
      }).join('');
      blocks.push(sectionHtml({
        hue: 270, type: 'refs', label: 'ارجاع‌ها',
        body: `<div class="ai-refs">${pills}</div>`,
        editable: false,
      }));
    }
    if (inlineTags.length) {
      const tagPills = inlineTags.map((t) => {
        const c = UI.tagColor(t);
        return `<span class="ai-tag-pill"
          data-ai-tag="${attrEsc(t)}"
          style="color:${c.color};border-color:${c.border};">
          <button type="button" class="ai-tag-pill__add" data-ai-add-tag="${attrEsc(t)}" title="افزودن به فرم">
            <span class="ai-tag-pill__plus">＋</span>${escapeHtml(t)}
          </button>
          <button type="button" class="ai-tag-pill__remove" data-remove-tag title="حذف این برچسب" aria-label="حذف">✕</button>
        </span>`;
      }).join('');
      blocks.push(sectionHtml({
        hue: 150, type: 'tags', label: 'برچسب‌های پیشنهادی',
        body: `<div class="ai-tags">${tagPills}</div>`,
        editable: false,
      }));
    }
    if (parsed.draft) {
      blocks.push(sectionHtml({
        hue: 40, type: 'draft', label: 'پیش‌نویس تفسیر',
        body: renderRich(parsed.draft, surahIndex),
        raw: parsed.draft,
        extra: `<div class="ai-draft-actions">
          <button type="button" class="btn btn--sm" data-ai-insert-draft>درج در فرم تفسیر</button>
        </div>`,
      }));
    }
    if (parsed.caution) {
      blocks.push(sectionHtml({
        hue: 0, type: 'caution', label: 'احتیاط',
        body: renderRich(parsed.caution, surahIndex),
        raw: parsed.caution,
      }));
    }

    container.innerHTML = `
      <div class="ai-answer-card card">
        ${qHtml}
        ${parsed.title ? `<h3 class="ai-answer-card__title">${escapeHtml(parsed.title)}</h3>` : ''}
        ${blocks.join('')}
        ${footerHtml}
      </div>`;

    wireCard(container.querySelector('.ai-answer-card'), opts);
  }

  // ---------- سیم‌کشی ویرایش/حذف ----------
  function wireCard(card, opts) {
    if (!card) return;

    async function persist() {
      if (typeof opts.onChange !== 'function') return;
      try {
        await opts.onChange(serializeFromDom(card));
      } catch (e) {
        console.error('[AiFormat] persist failed', e);
        UI.toast('ذخیره تغییرات ناموفق بود');
      }
    }

    // دکمه‌های هدر هر بخش
    card.querySelectorAll('[data-section-action]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const action = btn.getAttribute('data-section-action');
        const section = btn.closest('.ai-section');
        if (!section) return;

        if (action === 'delete') {
          section.remove();
          await persist();
        } else if (action === 'edit') {
          enterEdit(section, card, opts, persist);
        }
      });
    });

    // حذف تک‌ارجاع‌ها
    card.querySelectorAll('[data-remove-ref]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const refEl = btn.closest('.ai-ref');
        const section = btn.closest('.ai-section');
        if (!refEl) return;
        refEl.remove();
        if (section && !section.querySelector('.ai-ref')) section.remove();
        await persist();
      });
    });

    // حذف تک‌برچسب‌ها
    card.querySelectorAll('[data-remove-tag]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const pill = btn.closest('.ai-tag-pill');
        const section = btn.closest('.ai-section');
        if (!pill) return;
        pill.remove();
        if (section && !section.querySelector('.ai-tag-pill')) section.remove();
        await persist();
      });
    });

    // حذف کل پاسخ
    const delBtn = card.querySelector('[data-delete-response]');
    if (delBtn && typeof opts.onDelete === 'function') {
      delBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!confirm('کل این پاسخ حذف شود؟')) return;
        try {
          await opts.onDelete();
        } catch (err) {
          console.error(err);
          UI.toast('حذف ناموفق بود');
        }
      });
    }
  }

  function enterEdit(section, card, opts, persist) {
    const raw = section.getAttribute('data-raw') || '';
    const bodyEl = section.querySelector('.ai-section__body');
    if (!bodyEl) return;

    const originalHTML = bodyEl.innerHTML;

    bodyEl.innerHTML = `
      <textarea class="ai-section__edit" rows="6">${escapeHtml(raw)}</textarea>
      <div class="ai-section__edit-actions">
        <button type="button" class="btn btn--sm btn--primary" data-edit-action="save">ذخیره</button>
        <button type="button" class="btn btn--sm" data-edit-action="cancel">انصراف</button>
      </div>`;

    section.setAttribute('data-editing', 'true');
    const ta = bodyEl.querySelector('.ai-section__edit');
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);

    const saveBtn = bodyEl.querySelector('[data-edit-action="save"]');
    const cancelBtn = bodyEl.querySelector('[data-edit-action="cancel"]');

    saveBtn.addEventListener('click', async () => {
      const newRaw = ta.value;
      section.setAttribute('data-raw', newRaw);
      bodyEl.innerHTML = renderRich(newRaw, opts.surahIndex);
      section.removeAttribute('data-editing');
      await persist();
    });

    cancelBtn.addEventListener('click', () => {
      bodyEl.innerHTML = originalHTML;
      section.removeAttribute('data-editing');
    });

    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); cancelBtn.click(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); saveBtn.click(); }
    });
  }

  // ---------- نمایش خام حین استریم ----------
  function renderStreaming(container, question, text, model) {
    container.innerHTML = `
      <div class="ai-answer-card card">
        <div class="ai-answer-card__question">
          <span class="ai-answer-card__q-label">پرسش شما</span>${escapeHtml(question || '')}
        </div>
        <div class="ai-answer-card__stream" id="aiStreamBox">${escapeHtml(text || '')}</div>
        <div class="ai-answer-card__footer">
          <span>پاسخ از: <code>${escapeHtml(model || '—')}</code></span>
        </div>
      </div>`;
    const box = container.querySelector('#aiStreamBox');
    if (box) box.scrollTop = box.scrollHeight;
  }

  return {
    parse, render, renderStreaming,
    renderMarkdown, renderRich, escapeHtml,
    serializeFromDom,
  };
})();