// =============================================================
// تجزیه و رندر قالب پاسخ هوش مصنوعی + نوار فیدبک
// =============================================================
const AiFormat = (function () {
  const OPEN = '[[AI]]';
  const CLOSE = '[[/AI]]';

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str == null ? '' : str);
    return div.innerHTML;
  }

  // ============================================================
  // مودال تأیید سفارشی (بدون confirm مرورگر)
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
  // تجزیه
  // ============================================================
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

  function sectionHtml({ hue, label, body, extra = '', sectionKey = '', canClose = false }) {
    const closeBtn = (sectionKey && canClose)
      ? `<button type="button" class="ai-section__close" data-ai-section-close="${sectionKey}" aria-label="حذف این بخش" title="حذف این بخش">✕</button>`
      : '';
    return `
      <div class="ai-section" style="--hue:${hue}" data-section="${sectionKey}">
        <div class="ai-section__label">
          <span class="ai-section__dot"></span>${escapeHtml(label)}
          ${closeBtn}
        </div>
        <div class="ai-section__body">${body}</div>
        ${extra}
      </div>`;
  }

  // ---- کارت پرسش جمع‌وجور ----
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
    const canClose = !!(opts && opts.refId);
    const canDelete = !!(opts && opts.refId);

    const qHtml = questionBarHtml({ question, canDelete });

    if (!parsed.ok) {
      container.innerHTML = `
        <div class="ai-answer-card card">
          ${qHtml}
          ${sectionHtml({
            hue: 20,
            label: 'پاسخ خام (قالب مورد انتظار رعایت نشد)',
            body: renderRich(parsed.raw, surahIndex),
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
        hue: 340, label: 'پاسخ', sectionKey: 'answer', canClose,
        body: renderRich(parsed.answer, surahIndex, inlineTags),
      }));
    }
    if (parsed.insight) {
      blocks.push(sectionHtml({
        hue: 210, label: 'نکته', sectionKey: 'insight', canClose,
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
        hue: 270, label: 'ارجاع‌ها', sectionKey: 'refs', canClose,
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
        hue: 150, label: 'برچسب‌های پیشنهادی', sectionKey: 'tags', canClose,
        body: `<div class="ai-tags">${tagPills}</div>`,
      }));
    }
    if (parsed.draft) {
      blocks.push(sectionHtml({
        hue: 40, label: 'پیش‌نویس تفسیر', sectionKey: 'draft', canClose,
        body: `<div class="ai-draft-body">${renderRich(parsed.draft, surahIndex, inlineTags)}</div>`,
        extra: `<div class="ai-draft-actions">
          <button type="button" class="btn btn--sm" data-ai-insert-draft>درج در فرم تفسیر</button>
        </div>`,
      }));
    }
    if (parsed.caution) {
      blocks.push(sectionHtml({
        hue: 0, label: 'احتیاط', sectionKey: 'caution', canClose,
        body: renderRich(parsed.caution, surahIndex, inlineTags),
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
  //        onAfterVote, onAfterDelete, onAfterSectionChange }
  function wireCard(rootEl, parsed, opts) {
    const { generationId, refId, onAfterVote, onAfterDelete, onAfterSectionChange } = opts || {};

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

    if (refId && parsed && parsed.ok) {
      rootEl.querySelectorAll('[data-ai-section-close]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const key = btn.getAttribute('data-ai-section-close');
          if (!key) return;
          const ok = await confirmDialog({
            title: 'حذف بخش',
            message: 'این بخش از پاسخ حذف شود؟',
            confirmText: 'حذف',
          });
          if (!ok) return;

          const next = { ...parsed };
          if (key === 'refs') next.refs = [];
          else if (key === 'tags') next.tags = [];
          else next[key] = null;

          const newRaw = serialize(next);
          try {
            await Store.updateAskAiRaw(refId, newRaw);
            const reparsed = parse(newRaw);
            const sc = typeof opts.modelScoreAfter === 'function'
              ? await opts.modelScoreAfter()
              : (opts.modelScore || 0);
            render(rootEl, reparsed, {
              model: opts.model,
              question: opts.question,
              surahIndex: opts.surahIndex,
              generationId,
              refId,
              myVote: opts.myVote || 0,
              modelScore: sc,
            });
            wireCard(rootEl, reparsed, { ...opts, modelScore: sc });
            if (typeof onAfterSectionChange === 'function') onAfterSectionChange();
            UI.toast('بخش حذف شد');
          } catch (e) {
            console.error('[ai-format] updateAskAiRaw failed:', e);
            UI.toast('خطا در حذف بخش: ' + (e?.message || 'نامشخص'));
          }
        });
      });
    }

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