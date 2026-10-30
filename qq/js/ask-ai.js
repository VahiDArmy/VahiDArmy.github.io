// =============================================================
// بخش «پرسش از هوش مصنوعی» — composer، استریم، ذخیره، تاریخچه، فیدبک، پیگیری
// =============================================================
(async function () {
  const section = document.getElementById('askAiSection');
  if (!section) return;

  const session = await Auth.getSession().catch(() => null);
  if (!session) { section.hidden = true; return; }
  section.hidden = false;

  const composerModel  = document.getElementById('askAiCurrentModel');
  const modelLabel     = document.getElementById('askAiModelLabel');
  const formatToggle   = document.getElementById('askAiFormatToggle');
  const formatLabel    = document.getElementById('askAiFormatLabel');
  const followUpChip   = document.getElementById('askAiFollowUpChip');
  const followUpLabel  = document.getElementById('askAiFollowUpLabel');
  const followUpExcerpt= document.getElementById('askAiFollowUpExcerpt');
  const followUpClear  = document.getElementById('askAiFollowUpClear');
  const inputEl        = document.getElementById('askAiInput');
  const submitBtn      = document.getElementById('askAiSubmit');
  const statusEl       = document.getElementById('aiStatus');
  const answerEl       = document.getElementById('askAiAnswer');
  const historyEl      = document.getElementById('askAiHistory');

  const modelsModal    = document.getElementById('aiModelsModal');
  const modelsListEl   = document.getElementById('aiModelsList');
  const closeModelsBtn = document.getElementById('closeModelsBtn');
  const saveModelBtn   = document.getElementById('saveModelBtn');

  const index = await QuranData.getIndex();

  let currentAyah = readCurrentAyah();
  let streamAbort = null;
  let pendingModelId = getStoredModelId();
  let renderedModelId = pendingModelId;
  let modelScoresCache = new Map();
  let formatMode = getStoredFormatMode();
  let followUpCtx = null;

  function readCurrentAyah() {
    const s = Number(document.getElementById('formSurahSelect')?.value) || 1;
    const a = Number(document.getElementById('formAyahSelect')?.value) || 1;
    return { surah: s, ayah: a };
  }

  let refreshTimer = null;
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      const next = readCurrentAyah();
      if (next.surah === currentAyah.surah && next.ayah === currentAyah.ayah) return;
      currentAyah = next;
      onAyahChanged();
    }, 140);
  }

  const frameEl = document.getElementById('workAyahFrame');
  if (frameEl) {
    new MutationObserver(scheduleRefresh).observe(frameEl, { childList: true, subtree: true });
  }

  async function onAyahChanged() {
    if (streamAbort) { streamAbort.abort(); streamAbort = null; }
    setStatus('idle');
    answerEl.innerHTML = '';
    inputEl.value = '';
    submitBtn.disabled = false; // ★ رفع باگ B2 (اطمینان از فعال بودن دکمه هنگام تغییر آیه)
    clearFollowUp();
    await renderHistory();
  }

  function clearFollowUp() {
    followUpCtx = null;
    if (followUpChip) followUpChip.hidden = true;
    if (followUpLabel) followUpLabel.textContent = '—';
    if (followUpExcerpt) followUpExcerpt.textContent = '';
    updatePlaceholder();
  }

  function updatePlaceholder() {
    if (!inputEl) return;
    inputEl.placeholder = followUpCtx ? 'پرسش پیگیری خود را بنویسید… (Ctrl+Enter برای ارسال)' : 'دربارهٔ این آیه بپرس… (Ctrl+Enter برای ارسال)';
  }

  function handleFollowUp(ctx) {
    if (!ctx || !ctx.sectionText) return;
    followUpCtx = { sectionKey: ctx.sectionKey || 'answer', sectionLabel: ctx.sectionLabel || 'پاسخ', sectionText: ctx.sectionText || '', fromQuestion: ctx.fromQuestion || '' };
    if (followUpLabel) followUpLabel.textContent = followUpCtx.sectionLabel;
    if (followUpExcerpt) {
      const t = followUpCtx.sectionText.replace(/\s+/g, ' ').trim();
      const snippet = t.length > 60 ? t.slice(0, 60) + '…' : t;
      followUpExcerpt.textContent = '— «' + snippet + '»';
    }
    if (followUpChip) followUpChip.hidden = false;
    updatePlaceholder();
    if (inputEl) { inputEl.focus(); inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    if (window.UI && UI.toast) UI.toast('حالت پیگیری فعال شد — پرسش خود را بنویسید');
  }

  if (followUpClear) followUpClear.addEventListener('click', () => { clearFollowUp(); if (window.UI && UI.toast) UI.toast('پیگیری لغو شد'); });

  function buildChainedQuestion(newQuestion) {
    if (!followUpCtx) return newQuestion;
    const raw = (followUpCtx.sectionText || '').trim();
    const excerpt = raw.length > 1200 ? raw.slice(0, 1200) + '…' : raw;
    return '[پیگیری از پاسخ پیشین]\n\n' +
      'پرسش نخستین من:\n' + '«' + (followUpCtx.fromQuestion || '—') + '»\n\n' +
      'گزیده‌ای که از پاسخ پیشین انتخاب کردم — از بخش «' + followUpCtx.sectionLabel + '»:\n' + '«' + excerpt + '»\n\n' +
      'پرسش پیگیری من:\n' + newQuestion + '\n\n' +
      'لطفاً پاسخت را با توجه به گزیدهٔ بالا و در ادامهٔ گفت‌وگوی پیشین بده. همان قالب و لحن قبلی را نگه دار.';
  }

  function getStoredFormatMode() {
    try { const v = localStorage.getItem('askAiMode'); if (v === 'natural' || v === 'strict') return v; } catch (e) {}
    return 'strict';
  }
  function setStoredFormatMode(v) { try { localStorage.setItem('askAiMode', v); } catch (e) {} }
  function paintFormatToggle() {
    if (!formatToggle) return;
    const isOn = formatMode === 'strict';
    formatToggle.classList.toggle('is-on', isOn);
    formatToggle.setAttribute('aria-pressed', String(isOn));
    formatToggle.setAttribute('title', isOn ? 'قالب اجباری' : 'قالب آزاد');
    if (formatLabel) formatLabel.textContent = isOn ? 'قالب اجباری' : 'قالب آزاد';
  }
  if (formatToggle) {
    formatToggle.addEventListener('click', () => {
      formatMode = (formatMode === 'strict') ? 'natural' : 'strict';
      setStoredFormatMode(formatMode); paintFormatToggle();
      UI.toast(formatMode === 'natural' ? 'قالب آزاد' : 'قالب اجباری');
    });
    paintFormatToggle();
  }

  function getStoredModelId() {
    try {
      const v = localStorage.getItem('askAiModel');
      if (v && CONFIG.OPENROUTER_MODELS.some((m) => m.id === v)) return v;
    } catch (e) {}
    return CONFIG.OPENROUTER_DEFAULT_MODEL;
  }
  function setStoredModelId(id) { try { localStorage.setItem('askAiModel', id); } catch (e) {} }
  function modelById(id) { return CONFIG.OPENROUTER_MODELS.find((m) => m.id === id) || CONFIG.OPENROUTER_MODELS[0]; }
  function paintComposerModel() { const m = modelById(renderedModelId); if (modelLabel) modelLabel.textContent = m.provider + ' · ' + m.name; }

  async function loadModelScores() { try { modelScoresCache = await Store.getModelScores(); } catch (e) { modelScoresCache = new Map(); } }

  function scoreChipHtml(modelId) {
    const s = modelScoresCache.get(modelId); if (!s || (!s.voters && !s.score)) return '';
    const sign = s.score > 0 ? 'pos' : s.score < 0 ? 'neg' : 'zero';
    const txt = (s.score > 0 ? '+' : '') + UI.toPersianDigits(s.score);
    return `<span class="ai-model-card__score" data-sign="${sign}">⭐ ${txt}</span>`;
  }

  function paintModelsList() {
    modelsListEl.innerHTML = CONFIG.OPENROUTER_MODELS.map((m) => {
      const selected = m.id === pendingModelId ? 'true' : 'false';
      const isAuto = !!m.auto;
      const badge = m.default ? '<span class="ai-model-card__badge">پیش‌فرض</span>' : (m.star ? '<span class="ai-model-card__badge" style="background:var(--surface-2);color:var(--text-faint);">★</span>' : '');
      const scoreHtml = isAuto ? '' : scoreChipHtml(m.id);
      const statsHtml = isAuto ? '' : `<div class="ai-model-card__stats"><span><b>${m.tps}</b> t/s</span><span><b>${AiFormat.escapeHtml(m.ctx)}</b> ctx</span><span><b>${AiFormat.escapeHtml(m.size)}</b></span></div>`;
      const idHtml = isAuto ? '' : `<code class="ai-model-card__id">${AiFormat.escapeHtml(m.id)}</code>`;
      return `
        <button type="button" class="ai-model-card" data-id="${m.id}" data-selected="${selected}">
          <div class="ai-model-card__head">
            <span class="ai-model-card__provider">${AiFormat.escapeHtml(m.provider)}</span>
            <span class="ai-model-card__name">${AiFormat.escapeHtml(m.name)}</span>
            ${scoreHtml}${badge}
          </div>
          <p class="ai-model-card__desc">${AiFormat.escapeHtml(m.desc)}</p>
          ${statsHtml}${idHtml}
        </button>`;
    }).join('');
    modelsListEl.querySelectorAll('.ai-model-card').forEach((btn) => {
      btn.addEventListener('click', () => { pendingModelId = btn.getAttribute('data-id'); paintModelsList(); });
    });
  }

  async function openModels() { pendingModelId = renderedModelId; await loadModelScores(); paintModelsList(); modelsModal.hidden = false; }
  function closeModels() { modelsModal.hidden = true; }

  if (composerModel) composerModel.addEventListener('click', openModels);
  if (closeModelsBtn) closeModelsBtn.addEventListener('click', closeModels);
  modelsModal.addEventListener('click', (e) => { if (e.target === modelsModal) closeModels(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modelsModal.hidden) closeModels(); });
  if (saveModelBtn) saveModelBtn.addEventListener('click', () => { renderedModelId = pendingModelId; setStoredModelId(renderedModelId); paintComposerModel(); closeModels(); UI.toast('مدل ذخیره شد'); });

  paintComposerModel();
  updatePlaceholder();

  function setStatus(state) { statusEl.setAttribute('data-state', state); }
  async function generationScore(modelId) { if (!modelScoresCache.has(modelId)) await loadModelScores(); const s = modelScoresCache.get(modelId); return s ? s.score : 0; }

  async function askAi(question) {
    const modelId = renderedModelId;
    const model = modelById(modelId);
    const surahMeta = index.find((s) => s.number === currentAyah.surah);
    const surahName = surahMeta ? surahMeta.name_fa : String(currentAyah.surah);

    let ayahText = '', ayahTranslation = '';
    try {
      const surahData = await QuranData.getSurah(currentAyah.surah);
      const ay = surahData.ayahs.find((x) => x.v === currentAyah.ayah);
      if (ay) { ayahText = ay.ar; ayahTranslation = ay.fa; }
    } catch (e) {}

    const isFollowUp = !!followUpCtx;
    const apiQuestion = buildChainedQuestion(question);
    const displayQuestion = isFollowUp ? ('↩ ' + question) : question;

    streamAbort = new AbortController();
    submitBtn.disabled = true;
    setStatus('streaming');
    let acc = '';
    let realModel = '';
    AiFormat.renderStreaming(answerEl, displayQuestion, '', model.name);

    const fnName = (formatMode === 'natural') ? 'bright-api-natural' : 'bright-api';
    const url = CONFIG.SUPABASE_URL + '/functions/v1/' + fnName;

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
        body: JSON.stringify({ surah: currentAyah.surah, ayah: currentAyah.ayah, surahName, ayahText, ayahTranslation, question: apiQuestion, model: modelId }),
        signal: streamAbort.signal,
      });
    } catch (err) {
      if (err.name === 'AbortError') { submitBtn.disabled = false; return; } // ★ رفع باگ B2
      finishWithError(err);
      return;
    }

    clearFollowUp();

    if (!res.ok || !res.body) {
      const errTxt = await res.text().catch(() => '');
      finishWithError(new Error(errTxt || ('HTTP ' + res.status)));
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() || '';
        for (const part of parts) {
          const lines = part.split('\n');
          let event = 'message';
          let data = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) event = line.slice(7).trim();
            else if (line.startsWith('data: ')) data += line.slice(6);
          }
          if (!data && event !== 'done') continue;
          if (event === 'done') continue;
          if (event === 'error') {
            let msg = 'خطای استریم';
            try { msg = JSON.parse(data).error || msg; } catch (e) {}
            finishWithError(new Error(msg));
            return;
          }
          try {
            const j = JSON.parse(data);
            if (j.model) realModel = j.model;
            if (j.delta) {
              acc += j.delta;
              AiFormat.renderStreaming(answerEl, displayQuestion, acc, realModel || model.name);
            }
            if (j.error) { finishWithError(new Error(j.error)); return; }
          } catch (e) {}
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') { submitBtn.disabled = false; return; } // ★ رفع باگ B2
      finishWithError(err);
      return;
    }

    if (!realModel) realModel = modelId;

    const parsed = AiFormat.parse(acc);

    let askRow = null;
    try {
      askRow = await Store.saveAskAi({ surah: currentAyah.surah, ayah: currentAyah.ayah, model: realModel, question: displayQuestion, answerRaw: acc });
    } catch (e) { UI.toast('ذخیرهٔ پاسخ ناموفق بود'); }

    let generationId = null;
    if (askRow) {
      try {
        const gen = await Store.createGeneration({ source: 'ask_ai', refId: askRow.id, model: realModel });
        generationId = gen.id;
      } catch (e) {}
    }

    const sc = await generationScore(realModel);

    AiFormat.render(answerEl, parsed, { model: realModel, question: displayQuestion, surahIndex: index, generationId, refId: askRow ? askRow.id : null, myVote: 0, modelScore: sc });
    AiFormat.wireCard(answerEl, parsed, {
      generationId, refId: askRow ? askRow.id : null, model: realModel, question: displayQuestion, surahIndex: index, modelScore: sc,
      modelScoreAfter: async () => await generationScore(realModel),
      onAfterVote: async () => { await loadModelScores(); },
      onAfterSectionChange: async () => { await renderHistory(); },
      onAfterDelete: async () => { answerEl.innerHTML = ''; await renderHistory(); },
      onFollowUp: handleFollowUp,
    });

    setStatus('done');
    submitBtn.disabled = false;
    streamAbort = null;
    await renderHistory();
  }

  function finishWithError(err) {
    setStatus('error');
    submitBtn.disabled = false;
    streamAbort = null;
    UI.toast('خطا: ' + (err.message || 'نامشخص'));
  }

  // ★ رفع باگ E5 / N+1 Query: استفاده از getLatestGenerations به جای حلقه
  async function renderHistory() {
    let rows = [];
    try { rows = await Store.getAskAiHistory(currentAyah.surah, currentAyah.ayah, 20); } catch (e) { console.error('[ask-ai] history failed:', e); }
    if (!rows || !rows.length) { historyEl.innerHTML = ''; return; }

    const refIds = rows.map(r => r.id);
    const gens = await Store.getLatestGenerations(refIds).catch(() => []);
    const genMap = new Map(gens.map(g => [g.ref_id, g]));
    
    const enriched = rows.map(r => ({ ...r, gen: genMap.get(r.id) || null }));

    historyEl.innerHTML = `
      <div class="ai-history">
        <div class="ai-history__head">پرسش‌های پیشین برای این آیه</div>
        ${enriched.map((r, i) => {
          const date = new Date(r.created_at).toLocaleDateString('fa-IR');
          return `
            <div class="ai-history-item" data-open="${i === 0 ? 'true' : 'false'}" data-id="${r.id}">
              <div class="ai-history-item__head">
                <span class="ai-history-item__q">${AiFormat.escapeHtml(r.question)}</span>
                <span class="ai-history-item__date">${date}</span>
                <button type="button" class="ai-delete-question" data-ai-delete-history="${r.id}" aria-label="حذف">✕</button>
              </div>
              <div class="ai-history-item__body"></div>
            </div>`;
        }).join('')}
      </div>`;

    historyEl.querySelectorAll('[data-ai-delete-history]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-ai-delete-history');
        const ok = await AiFormat.confirm({ title: 'حذف پرسش', message: 'کل این پرسش و پاسخش حذف می‌شود.', confirmText: 'حذف' });
        if (!ok) return;
        try {
          btn.disabled = true;
          await Store.deleteAskAi(id);
          UI.toast('پرسش حذف شد');
          await renderHistory();
        } catch (err) {
          UI.toast('خطا در حذف پرسش: ' + (err?.message || 'نامشخص'));
          btn.disabled = false;
        }
      });
    });

    historyEl.querySelectorAll('.ai-history-item').forEach((item) => {
      const id = item.getAttribute('data-id');
      const row = enriched.find((r) => r.id === id);
      const bodyEl = item.querySelector('.ai-history-item__body');
      const head = item.querySelector('.ai-history-item__head');
      let rendered = false;

      const openIt = async () => {
        if (rendered) return;
        const parsed = AiFormat.parse(row.answer_raw || '');
        const genId = row.gen ? row.gen.id : null;
        const sc = row.model ? await generationScore(row.model) : 0;
        AiFormat.render(bodyEl, parsed, { model: row.model, question: row.question, surahIndex: index, generationId: genId, refId: row.id, myVote: 0, modelScore: sc });
        AiFormat.wireCard(bodyEl, parsed, {
          generationId: genId, refId: row.id, model: row.model, question: row.question, surahIndex: index, modelScore: sc,
          modelScoreAfter: async () => row.model ? await generationScore(row.model) : 0,
          onAfterVote: async () => { await loadModelScores(); },
          onAfterSectionChange: async () => { await renderHistory(); },
          onAfterDelete: async () => { await renderHistory(); },
          onFollowUp: handleFollowUp,
        });
        rendered = true;
      };
      
      if (item.getAttribute('data-open') === 'true') openIt();

      head.addEventListener('click', async () => {
        const isOpen = item.getAttribute('data-open') === 'true';
        item.setAttribute('data-open', isOpen ? 'false' : 'true');
        if (!isOpen) await openIt();
      });
    });
  }

  function submit() {
    const q = inputEl.value.trim();
    if (!q) { UI.toast('پرسشی بنویسید'); return; }
    inputEl.value = '';
    askAi(q);
  }
  submitBtn.addEventListener('click', submit);
  inputEl.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submit(); } });

  setStatus('idle');
  await loadModelScores();
  await renderHistory();
})();