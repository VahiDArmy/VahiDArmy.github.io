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

  // opts: { model, question, surahIndex, generationId, myVote, modelScore }
  function render(container, parsed, opts) {
    const { model, question, surahIndex } = opts || {};
    const showFeedback = opts && opts.generationId != null;

    const qHtml = `
      <div class="ai-answer-card__question">
        <span class="ai-answer-card__q-label">پرسش شما</span>${escapeHtml(question || '')}
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

    const footerHtml = showFeedback
      ? feedbackBarHtml({ model, score: opts.modelScore || 0, myVote: opts.myVote || 0 })
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

  // اتصال دکمه‌های رأی و برچسب/پیش‌نویس در یک کارت رندرشده.
  // opts: { generationId, onAfterVote }
  function wireCard(rootEl, parsed, opts) {
    const { generationId, onAfterVote } = opts || {};

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

    if (generationId != null) {
      wireVotes(rootEl, generationId, onAfterVote);
    }
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
        const next = (mine === want) ? 0 : want; // رأی مجدد = برداشتن رأی
        try {
          buttons.forEach((b) => (b.disabled = true));
          await Store.setFeedback(generationId, next);
          await refresh();
        } catch (e) {
          console.error(e);
          UI.toast('خطا در ثبت رأی');
        } finally {
          buttons.forEach((b) => (b.disabled = false));
        }
      });
    });

    refresh();
  }

  return {
    parse, render, renderStreaming, wireCard,
    renderMarkdown, renderRich, escapeHtml,
  };
})();