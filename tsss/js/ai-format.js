// =============================================================
// تجزیه و رندر قالب پاسخ هوش مصنوعی + نوار فیدبک
// =============================================================
const AiFormat = (function () {
  const OPEN = '[[AI]]';
  const CLOSE = '[[/AI]]';
  const SECTION_NAMES = ['title', 'answer', 'insight', 'draft', 'caution', 'refs', 'tags'];

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str == null ? '' : str);
    return div.innerHTML;
  }

  // ============================================================
  // مودال تأیید سفارشی
  // ============================================================
  let confirmEl = null;
  let confirmResolve = null;

  function ensureConfirmEl() {
    if (confirmEl) return confirmEl;
    const el = document.createElement('div');
    el.className = 'modal-overlay ai-confirm-overlay';
    el.hidden = true;
    el.innerHTML = `
      <div class="modal-card card ai-confirm-modal" role="dialog" aria-modal="true">
        <div class="ai-confirm-modal__title" data-confirm-title>تأیید</div>
        <p class="ai-confirm-modal__message" data-confirm-message></p>
        <div class="ai-confirm-modal__actions">
          <button type="button" class="btn btn--sm" data-confirm-cancel>انصراف</button>
          <button type="button" class="btn btn--sm ai-confirm-modal__danger" data-confirm-ok>حذف</button>
        </div>
      </div>`;
    document.body.appendChild(el);

    el.addEventListener('click', (e) => { if (e.target === el) closeConfirm(false); });
    el.querySelector('[data-confirm-cancel]').addEventListener('click', () => closeConfirm(false));
    el.querySelector('[data-confirm-ok]').addEventListener('click', () => closeConfirm(true));

    document.addEventListener('keydown', (e) => {
      if (!el.hidden && e.key === 'Escape') closeConfirm(false);
    });

    confirmEl = el;
    return el;
  }

  function closeConfirm(result) {
    if (!confirmEl || confirmEl.hidden) return;
    confirmEl.hidden = true;
    if (confirmResolve) { const r = confirmResolve; confirmResolve = null; r(result); }
  }

  function confirmDialog(opts) {
    const o = typeof opts === 'string' ? { message: opts } : (opts || {});
    const el = ensureConfirmEl();
    el.querySelector('[data-confirm-title]').textContent = o.title || 'تأیید';
    el.querySelector('[data-confirm-message]').textContent = o.message || '';
    el.querySelector('[data-confirm-ok]').textContent = o.confirmText || 'حذف';
    el.querySelector('[data-confirm-cancel]').textContent = o.cancelText || 'انصراف';
    el.hidden = false;
    setTimeout(() => {
      const c = el.querySelector('[data-confirm-cancel]');
      if (c) c.focus();
    }, 30);
    return new Promise((resolve) => { confirmResolve = resolve; });
  }

  // ============================================================
  // تجزیه — هیچ متنی دور ریخته نمی‌شود
  // ============================================================
  function parse(raw) {
    if (raw == null) return { ok: false, raw: '' };
    const trimmed = String(raw).trim();
    if (!trimmed) return { ok: false, raw: '' };

    // پاک کردن نشانه‌های بیرونی
    let inner = trimmed;
    const openIdx = inner.indexOf(OPEN);
    if (openIdx !== -1) inner = inner.slice(openIdx + OPEN.length);
    const closeIdx = inner.lastIndexOf(CLOSE);
    if (closeIdx !== -1) inner = inner.slice(0, closeIdx);
    inner = inner.trim();

    // --- استخراج هر بخش ---
    const pick = (name) => {
      // ۱) تگ کامل
      let re = new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, 'i');
      let m = inner.match(re);
      if (m) return m[1].trim();
      // ۲) تگ باز تا تگ شناخته‌شدهٔ بعدی
      const known = SECTION_NAMES.filter((n) => n !== name).join('|');
      re = new RegExp(`<${name}>([\\s\\S]*?)(?=<(?:${known})>|$)`, 'i');
      m = inner.match(re);
      return m ? m[1].trim() : null;
    };

    const title   = pick('title');
    const answer  = pick('answer');
    const insight = pick('insight');
    const draft   = pick('draft');
    const caution = pick('caution');

    // --- refs ---
    const refsRaw = pick('refs') || '';
    const refs = [];
    const refRe = /<ref\b([^>]*?)(?:\/>|>([\s\S]*?)<\/ref>)/gi;
    let mm;
    while ((mm = refRe.exec(refsRaw))) {
      const attrs = mm[1] || '';
      const label = (mm[2] || '').trim();
      const s = (attrs.match(/\bs\s*=\s*"(\d{1,3})"/i) || [])[1];
      const a = (attrs.match(/\ba\s*=\s*"(\d{1,3})"/i) || [])[1];
      if (s && a) refs.push({ surah: Number(s), ayah: Number(a), label });
    }

    // --- tags ---
    const tagsRaw = pick('tags') || '';
    const tags = [];
    const tagRe = /<tag>([\s\S]*?)<\/tag>/gi;
    while ((mm = tagRe.exec(tagsRaw))) {
      const t = mm[1].trim();
      if (t) tags.push(t);
    }
    // اگر هیچ <tag> نبود ولی متن داخل <tags> بود، با کاما/خط جدید جدا کن
    if (!tags.length && tagsRaw.trim()) {
      tagsRaw
        .split(/[,،\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((t) => tags.push(t));
    }

    // --- محاسبهٔ leftover: حذف فقط بخش‌هایی که واقعاً استخراج شدند ---
    let leftover = inner;
    const removeIf = (name, parsedOk) => {
      if (!parsedOk) return;
      const reFull = new RegExp(`<${name}>[\\s\\S]*?<\\/${name}>`, 'gi');
      leftover = leftover.replace(reFull, '');
      const known = SECTION_NAMES.filter((n) => n !== name).join('|');
      const reOpen = new RegExp(`<${name}>[\\s\\S]*?(?=<(?:${known})>|$)`, 'gi');
      leftover = leftover.replace(reOpen, '');
    };
    removeIf('title',   !!title);
    removeIf('answer',  !!answer);
    removeIf('insight', !!insight);
    removeIf('draft',   !!draft);
    removeIf('caution', !!caution);
    removeIf('refs',    refs.length > 0);
    removeIf('tags',    tags.length > 0);

    // پاک کردن تگ‌های سرگردان (فقط شکل تگ، نه متن)
    leftover = leftover.replace(/<\/?[a-zA-Z][^>]*>/g, '');
    leftover = leftover.replace(/\n{3,}/g, '\n\n').trim();

    const hasAny =
      !!(title || answer || insight || draft || caution) ||
      refs.length > 0 || tags.length > 0;

    // اگر هیچ بخش شناخته‌شده‌ای نبود → کل متن به‌عنوان پاسخ خام
    if (!hasAny) {
      const cleaned = inner.replace(/<\/?[a-zA-Z][^>]*>/g, '').trim();
      return { ok: false, raw: cleaned || inner || trimmed };
    }

    // --- تصمیم دربارهٔ پاسخ و leftover ---
    let finalAnswer = answer;
    let extra = leftover || null;

    // اگر تگ <answer> نبود ولی متن آزاد داشتیم، آن متن پاسخ است
    if (!finalAnswer && extra) {
      finalAnswer = extra;
      extra = null;
    }

    return {
      ok: true,
      title,
      answer: finalAnswer,
      insight,
      refs,
      tags,
      draft,
      caution,
      extra,
    };
  }

  function serialize(p) {
    if (!p || !p.ok) return p.raw || '';
    const cleanAttr = (s) => String(s || '').replace(/[<>&]/g, '');
    const lines = ['[[AI]]'];
    if (p.title) lines.push(`<title>${p.title}</title>`);
    if (p.answer) lines.push(`<answer>\n${p.answer}\n</answer>`);
    if (p.insight) lines.push(`<insight>\n${p.insight}\n</insight>`);
    if (p.refs && p.refs.length) {
      lines.push('<refs>');
      for (const r of p.refs) {
        lines.push(`<ref s="${r.surah}" a="${r.ayah}">${cleanAttr(r.label)}</ref>`);
      }
      lines.push('</refs>');
    }
    if (p.tags && p.tags.length) {
      lines.push('<tags>');
      for (const t of p.tags) lines.push(`<tag>${t}</tag>`);
      lines.push('</tags>');
    }
    if (p.draft) lines.push(`<draft>\n${p.draft}\n</draft>`);
    if (p.caution) lines.push(`<caution>\n${p.caution}\n</caution>`);
    if (p.extra) lines.push(`<extra>\n${p.extra}\n</extra>`);
    lines.push('[[/AI]]');
    return lines.join('\n');
  }

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
    if (inlineTags && inlineTags.length) html = UI.highlightTags(html, inlineTags);
    return html;
  }

  function sectionHtml({ hue, label, body, extra = '', variant = '' }) {
    const styleAttr = (typeof hue === 'number') ? ` style="--hue:${hue}"` : '';
    const cls = 'ai-section' + (variant ? ` ai-section--${variant}` : '');
    return `
      <div class="${cls}"${styleAttr}>
        <div class="ai-section__label">
          <span class="ai-section__dot"></span>${escapeHtml(label)}
        </div>
        <div class="ai-section__body">${body}</div>
        ${extra}
      </div>`;
  }

  function questionBarHtml({ question, canDelete }) {
    const del = canDelete
      ? `<button type="button" class="ai-delete-question" data-ai-delete-question aria-label="حذف این پرسش" title="حذف این پرسش">✕</button>`
      : '';
    return `
      <div class="ai-answer-card__question">
        <span class="ai-answer-card__q-label">پرسش</span>
        <span class="ai-answer-card__q-text">${escapeHtml(question || '')}</span>
        ${del}
      </div>`;
  }

  function feedbackBarHtml({ model, score, myVote }) {
    const sign = score > 0 ? 'pos' : score < 0 ? 'neg' : 'zero';
    const scoreText = (score > 0 ? '+' : '') + UI.toPersianDigits(score);
    const upActive = myVote === 1 ? ' is-active' : '';
    const downActive = myVote === -1 ? ' is-active' : '';
    return `
      <div class="ai-feedback-bar">
        <span class="ai-feedback-bar__model">
          پاسخ از: <code>${escapeHtml(model || '—')}</code>
        </span>
        <span class="ai-feedback-bar__score" data-sign="${sign}">
          ⭐ ${scoreText}
        </span>
        <div class="ai-vote-group">
          <button type="button" class="ai-vote${upActive}" data-vote="1" aria-label="پسندیدم">👍</button>
          <button type="button" class="ai-vote${downActive}" data-vote="-1" aria-label="نپسندیدم">👎</button>
        </div>
      </div>`;
  }

  // opts: { model, question, surahIndex, generationId, refId, myVote, modelScore }
  function render(container, parsed, opts) {
    const { model, question, surahIndex } = opts || {};
    const showFeedback = opts && opts.generationId != null;
    const canDelete = !!(opts && opts.refId);

    const qHtml = questionBarHtml({ question, canDelete });

    // ---- بدون قالب: کل متن یکجا به‌عنوان پاسخ ----
    if (!parsed.ok) {
      container.innerHTML = `
        <div class="ai-answer-card card">
          ${qHtml}
          ${sectionHtml({
            hue: 200,
            label: 'پاسخ',
            body: renderRich(parsed.raw || '', surahIndex),
          })}
          ${showFeedback ? feedbackBarHtml({
            model,
            score: opts.modelScore || 0,
            myVote: opts.myVote || 0,
          }) : `<div class="ai-answer-card__footer">پاسخ از: <code>${escapeHtml(model || '—')}</code></div>`}
        </div>`;
      return;
    }

    const inlineTags = parsed.tags || [];
    const blocks = [];

    if (parsed.answer) {
      blocks.push(sectionHtml({
        hue: 340, label: 'پاسخ',
        body: renderRich(parsed.answer, surahIndex, inlineTags),
      }));
    }
    if (parsed.insight) {
      blocks.push(sectionHtml({
        hue: 210, label: 'نکته',
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
        hue: 270, label: 'ارجاع‌ها',
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
        hue: 150, label: 'برچسب‌های پیشنهادی',
        body: `<div class="ai-tags">${tagPills}</div>`,
      }));
    }
    if (parsed.draft) {
      blocks.push(sectionHtml({
        hue: 40, label: 'پیش‌نویس تفسیر',
        body: `<div class="ai-draft-body">${renderRich(parsed.draft, surahIndex, inlineTags)}</div>`,
        extra: `<div class="ai-draft-actions">
          <button type="button" class="btn btn--sm" data-ai-insert-draft>درج در فرم تفسیر</button>
        </div>`,
      }));
    }
    if (parsed.caution) {
      blocks.push(sectionHtml({
        hue: 0, label: 'احتیاط',
        body: renderRich(parsed.caution, surahIndex, inlineTags),
      }));
    }

    // ★ بخشهای دیگر: هر متنی که در قالب نگنجیده. هرگز حذف نمی‌شود.
    if (parsed.extra) {
      blocks.push(sectionHtml({
        label: 'بخش‌های دیگر',
        variant: 'muted',
        body: renderRich(parsed.extra, surahIndex, inlineTags),
      }));
    }

    const footerHtml = showFeedback
      ? feedbackBarHtml({
          model,
          score: opts.modelScore || 0,
          myVote: opts.myVote || 0,
        })
      : `<div class="ai-answer-card__footer">پاسخ از: <code>${escapeHtml(model || '—')}</code></div>`;

    container.innerHTML = `
      <div class="ai-answer-card card">
        ${qHtml}
        ${parsed.title ? `<h3 class="ai-answer-card__title">${escapeHtml(parsed.title)}</h3>` : ''}
        ${blocks.join('')}
        ${footerHtml}
      </div>`;
  }

  function renderStreaming(container, question, text, model) {
    container.innerHTML = `
      <div class="ai-answer-card card">
        ${questionBarHtml({ question, canDelete: false })}
        <div class="ai-answer-card__stream" id="aiStreamBox">${escapeHtml(text || '')}</div>
        <div class="ai-answer-card__footer">
          پاسخ از: <code>${escapeHtml(model || '—')}</code>
        </div>
      </div>`;
    const box = container.querySelector('#aiStreamBox');
    if (box) box.scrollTop = box.scrollHeight;
  }

  // opts: { generationId, refId, model, question, surahIndex, modelScore,
  //        onAfterVote, onAfterDelete }
  function wireCard(rootEl, parsed, opts) {
    const { generationId, refId, onAfterVote, onAfterDelete } = opts || {};

    const insertBtn = rootEl.querySelector('[data-ai-insert-draft]');
    if (insertBtn && parsed && parsed.draft) {
      insertBtn.addEventListener('click', () => {
        const ta = document.getElementById('tafsirContent');
        if (!ta) return;
        const cur = ta.value.trim();
        const draft = parsed.draft.trim();
        ta.value = cur ? (cur + '\n\n' + draft) : draft;
        ta.focus();
        ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
        UI.toast('پیش‌نویس در فرم درج شد');
      });
    }

    rootEl.querySelectorAll('[data-ai-tag]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tag = btn.getAttribute('data-ai-tag');
        const inp = document.getElementById('tafsirTags');
        if (!inp) return;
        const parts = Array.from(new Set(
          (inp.value || '').split(/[,،]/).map((x) => x.trim()).filter(Boolean).concat([tag])
        ));
        inp.value = parts.join('، ');
        UI.toast('برچسب «' + tag + '» افزوده شد');
      });
    });

    // فقط حذف کل پرسش
    if (refId) {
      const delBtn = rootEl.querySelector('[data-ai-delete-question]');
      if (delBtn) {
        delBtn.addEventListener('click', async () => {
          const ok = await confirmDialog({
            title: 'حذف پرسش',
            message: 'کل این پرسش و پاسخش برای همیشه حذف می‌شود.',
            confirmText: 'حذف',
          });
          if (!ok) return;
          try {
            delBtn.disabled = true;
            await Store.deleteAskAi(refId);
            if (typeof onAfterDelete === 'function') onAfterDelete();
            UI.toast('پرسش حذف شد');
          } catch (e) {
            console.error('[ai-format] deleteAskAi failed:', e);
            UI.toast('خطا در حذف پرسش: ' + (e?.message || 'نامشخص'));
            delBtn.disabled = false;
          }
        });
      }
    }

    if (generationId != null) wireVotes(rootEl, generationId, onAfterVote);
  }

  function wireVotes(rootEl, generationId, onAfterVote) {
    const bar = rootEl.querySelector('.ai-feedback-bar');
    if (!bar) return;
    const scoreEl = bar.querySelector('.ai-feedback-bar__score');
    const buttons = bar.querySelectorAll('.ai-vote');

    async function refresh() {
      const [agg, mine] = await Promise.all([
        Store.getGenerationFeedback(generationId).catch(() => ({ score: 0 })),
        Store.getMyFeedback(generationId).catch(() => 0),
      ]);
      const sign = agg.score > 0 ? 'pos' : agg.score < 0 ? 'neg' : 'zero';
      const txt = (agg.score > 0 ? '+' : '') + UI.toPersianDigits(agg.score);
      if (scoreEl) {
        scoreEl.setAttribute('data-sign', sign);
        scoreEl.textContent = '⭐ ' + txt;
      }
      buttons.forEach((b) => {
        const v = Number(b.getAttribute('data-vote'));
        b.classList.toggle('is-active', v === mine);
      });
      if (typeof onAfterVote === 'function') onAfterVote(mine, agg.score);
      return agg.score;
    }

    buttons.forEach((btn) => {
      btn.addEventListener('click', async () => {
        const want = Number(btn.getAttribute('data-vote'));
        const mine = await Store.getMyFeedback(generationId).catch(() => 0);
        const next = (mine === want) ? 0 : want;
        try {
          buttons.forEach((b) => (b.disabled = true));
          await Store.setFeedback(generationId, next);
          await refresh();
        } catch (e) {
          console.error('[ai-format] setFeedback failed:', e);
          UI.toast('خطا در ثبت رأی');
        } finally {
          buttons.forEach((b) => (b.disabled = false));
        }
      });
    });

    refresh();
  }

  return {
    parse, serialize, render, renderStreaming, wireCard, confirm: confirmDialog,
    renderMarkdown, renderRich, escapeHtml,
  };
})();