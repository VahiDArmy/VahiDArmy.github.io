// =============================================================
// بخش «پرسش از هوش مصنوعی» — composer، استریم، ذخیره، تاریخچه، فیدبک، پیگیری
// =============================================================
(async function () {
  const section = document.getElementById('askAiSection');
  if (!section) return;

  // بدون ورود، کل بخش (نه فقط محتوایش) از آکاردئون حذف می‌شود
  const session = await Auth.getSession().catch(() => null);
  if (!session) { UI.setPanelHidden('ai', true); return; }
  UI.setPanelHidden('ai', false);

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

  let index = [];
  try {
    index = await QuranData.getIndex();
  } catch (e) {
    console.error('[ask-ai] index load failed:', e);
  }

  let currentAyah = readCurrentAyah();
  let askRun = 0;           // هر پرسش یک شماره می‌گیرد؛ تغییر آیه شمارهٔ فعلی را باطل می‌کند
  let historySeq = 0;
  let lastQuestion = '';
  let streamAbort = null;
  let pendingModelId = getStoredModelId();
  let renderedModelId = pendingModelId;
  let modelScoresCache = new Map();
  let formatMode = getStoredFormatMode();
  // وضعیت پیگیری: null یا { sectionKey, sectionLabel, sectionText, fromQuestion }
  let followUpCtx = null;

  function readCurrentAyah() {
    if (window.RMCurrent) return { surah: window.RMCurrent.surah, ayah: window.RMCurrent.ayah };
    const s = Number(document.getElementById('formSurahSelect')?.value) || 1;
    const a = Number(document.getElementById('formAyahSelect')?.value) || 1;
    return { surah: s, ayah: a };
  }

  // work.js هر بار که آیه عوض می‌شود این رویداد را می‌فرستد
  document.addEventListener('rm:ayahchange', (e) => {
    const next = e.detail;
    if (!next) return;
    if (next.surah === currentAyah.surah && next.ayah === currentAyah.ayah) return;
    currentAyah = { surah: next.surah, ayah: next.ayah };
    onAyahChanged();
  });

  async function onAyahChanged() {
    askRun++;                                   // پرسش در حال اجرا (اگر باشد) دیگر چیزی نمی‌نویسد
    if (streamAbort) { streamAbort.abort(); streamAbort = null; }
    submitBtn.disabled = false;                 // قبلاً بعد از قطع استریم برای همیشه غیرفعال می‌ماند
    setStatus('idle');
    answerEl.innerHTML = '';
    inputEl.value = '';
    lastQuestion = '';
    clearFollowUp(); // پیگیری متعلق به آیهٔ قبلی است
    await renderHistory();
  }

  // ---------- Follow-up (chain) ----------
  function clearFollowUp() {
    followUpCtx = null;
    if (followUpChip) followUpChip.hidden = true;
    if (followUpLabel) followUpLabel.textContent = '—';
    if (followUpExcerpt) followUpExcerpt.textContent = '';
    updatePlaceholder();
  }

  function updatePlaceholder() {
    if (!inputEl) return;
    inputEl.placeholder = followUpCtx
      ? 'پرسش پیگیری خود را بنویسید… (Ctrl+Enter برای ارسال)'
      : 'دربارهٔ این آیه بپرس… (Ctrl+Enter برای ارسال)';
  }

  function handleFollowUp(ctx) {
    if (!ctx || !ctx.sectionText) return;
    followUpCtx = {
      sectionKey: ctx.sectionKey || 'answer',
      sectionLabel: ctx.sectionLabel || 'پاسخ',
      sectionText: ctx.sectionText || '',
      fromQuestion: ctx.fromQuestion || '',
    };
    if (followUpLabel) followUpLabel.textContent = followUpCtx.sectionLabel;
    if (followUpExcerpt) {
      const t = followUpCtx.sectionText.replace(/\s+/g, ' ').trim();
      const snippet = t.length > 60 ? t.slice(0, 60) + '…' : t;
      followUpExcerpt.textContent = '— «' + snippet + '»';
    }
    if (followUpChip) followUpChip.hidden = false;
    updatePlaceholder();
    if (inputEl) {
      inputEl.focus({ preventScroll: true });
      inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (window.UI && UI.toast) UI.toast('حالت پیگیری فعال شد — پرسش خود را بنویسید');
  }

  if (followUpClear) followUpClear.addEventListener('click', () => {
    clearFollowUp();
    if (window.UI && UI.toast) UI.toast('پیگیری لغو شد');
  });

  // ساخت متن نهایی پرسش که به API می‌رود
  function buildChainedQuestion(newQuestion) {
    if (!followUpCtx) return newQuestion;
    const raw = (followUpCtx.sectionText || '').trim();
    const excerpt = raw.length > 1200 ? raw.slice(0, 1200) + '…' : raw;
    return (
      '[پیگیری از پاسخ پیشین]\n\n' +
      'پرسش نخستین من:\n' +
      '«' + (followUpCtx.fromQuestion || '—') + '»\n\n' +
      'گزیده‌ای که از پاسخ پیشین انتخاب کردم — از بخش «' + followUpCtx.sectionLabel + '»:\n' +
      '«' + excerpt + '»\n\n' +
      'پرسش پیگیری من:\n' +
      newQuestion + '\n\n' +
      'لطفاً پاسخت را با توجه به گزیدهٔ بالا و در ادامهٔ گفت‌وگوی پیشین بده. همان قالب و لحن قبلی را نگه دار.'
    );
  }

  // ---------- Format mode toggle ----------
  function getStoredFormatMode() {
    try {
      const v = localStorage.getItem('askAiMode');
      if (v === 'natural' || v === 'strict') return v;
    } catch (e) {}
    return 'strict';
  }
  function setStoredFormatMode(v) {
    try { localStorage.setItem('askAiMode', v); } catch (e) {}
  }
  function paintFormatToggle() {
    if (!formatToggle) return;
    const isOn = formatMode === 'strict';
    formatToggle.classList.toggle('is-on', isOn);
    formatToggle.setAttribute('aria-pressed', String(isOn));
    formatToggle.setAttribute(
      'title',
      isOn ? 'قالب اجباری — برای آزادسازی قالب کلیک کنید'
           : 'قالب آزاد — برای بازگرداندن قالب اجباری کلیک کنید'
    );
    if (formatLabel) formatLabel.textContent = isOn ? 'قالب اجباری' : 'قالب آزاد';
  }
  if (formatToggle) {
    formatToggle.addEventListener('click', () => {
      formatMode = (formatMode === 'strict') ? 'natural' : 'strict';
      setStoredFormatMode(formatMode);
      paintFormatToggle();
      UI.toast(formatMode === 'natural'
        ? 'قالب آزاد — مدل خودش تصمیم می‌گیرد'
        : 'قالب اجباری — پاسخ در قالب ثابت');
    });
    paintFormatToggle();
  }

  // ---------- Model picker ----------
  function getStoredModelId() {
    try {
      const v = localStorage.getItem('askAiModel');
      if (v && CONFIG.OPENROUTER_MODELS.some((m) => m.id === v)) return v;
    } catch (e) {}
    return CONFIG.OPENROUTER_DEFAULT_MODEL;
  }
  function setStoredModelId(id) {
    try { localStorage.setItem('askAiModel', id); } catch (e) {}
  }
  function modelById(id) {
    return CONFIG.OPENROUTER_MODELS.find((m) => m.id === id) || CONFIG.OPENROUTER_MODELS[0];
  }

  function paintComposerModel() {
    const m = modelById(renderedModelId);
    if (modelLabel) modelLabel.textContent = m.provider + ' · ' + m.name;
  }

  async function loadModelScores() {
    try {
      modelScoresCache = await Store.getModelScores();
    } catch (e) {
      modelScoresCache = new Map();
    }
  }

  function scoreChipHtml(modelId) {
    const s = modelScoresCache.get(modelId);
    if (!s || (!s.voters && !s.score)) return '';
    const sign = s.score > 0 ? 'pos' : s.score < 0 ? 'neg' : 'zero';
    const txt = (s.score > 0 ? '+' : '') + UI.toPersianDigits(s.score);
    return `<span class="ai-model-card__score" data-sign="${sign}">⭐ ${txt}</span>`;
  }

  function paintModelsList() {
    modelsListEl.innerHTML = CONFIG.OPENROUTER_MODELS.map((m) => {
      const selected = m.id === pendingModelId ? 'true' : 'false';
      const isAuto = !!m.auto;

      const badge = m.default
        ? '<span class="ai-model-card__badge">پیش‌فرض</span>'
        : (m.star ? '<span class="ai-model-card__badge" style="background:var(--surface-2);color:var(--text-faint);">★</span>' : '');

      const scoreHtml = isAuto ? '' : scoreChipHtml(m.id);

      const statsHtml = isAuto ? '' : `
        <div class="ai-model-card__stats">
          <span><b>${m.tps}</b> t/s</span>
          <span><b>${AiFormat.escapeHtml(m.ctx)}</b> ctx</span>
          <span><b>${AiFormat.escapeHtml(m.size)}</b></span>
        </div>`;

      const idHtml = isAuto ? '' : `<code class="ai-model-card__id">${AiFormat.escapeHtml(m.id)}</code>`;

      return `
        <button type="button" class="ai-model-card" data-id="${m.id}" data-selected="${selected}">
          <div class="ai-model-card__head">
            <span class="ai-model-card__provider">${AiFormat.escapeHtml(m.provider)}</span>
            <span class="ai-model-card__name">${AiFormat.escapeHtml(m.name)}</span>
            ${scoreHtml}
            ${badge}
          </div>
          <p class="ai-model-card__desc">${AiFormat.escapeHtml(m.desc)}</p>
          ${statsHtml}
          ${idHtml}
        </button>`;
    }).join('');

    modelsListEl.querySelectorAll('.ai-model-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        pendingModelId = btn.getAttribute('data-id');
        paintModelsList();
      });
    });
  }

  async function openModels() {
    pendingModelId = renderedModelId;
    await loadModelScores();
    paintModelsList();
    modelsModal.hidden = false;
  }
  function closeModels() { modelsModal.hidden = true; }

  if (composerModel) composerModel.addEventListener('click', openModels);
  if (closeModelsBtn) closeModelsBtn.addEventListener('click', closeModels);
  modelsModal.addEventListener('click', (e) => { if (e.target === modelsModal) closeModels(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modelsModal.hidden) closeModels();
  });
  if (saveModelBtn) saveModelBtn.addEventListener('click', () => {
    renderedModelId = pendingModelId;
    setStoredModelId(renderedModelId);
    paintComposerModel();
    closeModels();
    UI.toast('مدل ذخیره شد');
  });

  paintComposerModel();
  updatePlaceholder();

  function setStatus(state) { statusEl.setAttribute('data-state', state); }

  async function generationScore(modelId) {
    if (!modelScoresCache.has(modelId)) await loadModelScores();
    const s = modelScoresCache.get(modelId);
    return s ? s.score : 0;
  }

  // ---------- Ask ----------
  async function askAi(question) {
    const myRun = ++askRun;
    const cancelled = () => myRun !== askRun;
    const target = { surah: currentAyah.surah, ayah: currentAyah.ayah };   // آیه‌ای که پرسش برایش است
    const modelId = renderedModelId;
    const model = modelById(modelId);
    const surahMeta = index.find((s) => s.number === target.surah);
    const surahName = surahMeta ? surahMeta.name_fa : String(target.surah);

    let ayahText = '', ayahTranslation = '';
    try {
      const surahData = await QuranData.getSurah(target.surah);
      const ay = surahData.ayahs.find((x) => x.v === target.ayah);
      if (ay) { ayahText = ay.ar; ayahTranslation = ay.fa; }
    } catch (e) {}
    if (cancelled()) return;

    // ★ ساخت پرسش نهایی (اگر در حالت پیگیری هستیم)
    const isFollowUp = !!followUpCtx;
    const apiQuestion = buildChainedQuestion(question);
    const displayQuestion = isFollowUp ? ('↩ ' + question) : question;

    // توکن همیشه تازه خوانده می‌شود: توکن اولِ بارگذاری بعد از حدود یک ساعت منقضی می‌شود
    const fresh = await Auth.getSession().catch(() => null);
    if (!fresh || !fresh.access_token) {
      finishWithError(new Error('نشست شما به پایان رسیده؛ دوباره وارد شوید'));
      return;
    }

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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + fresh.access_token,
        },
        body: JSON.stringify({
          surah: target.surah,
          ayah: target.ayah,
          surahName, ayahText, ayahTranslation,
          question: apiQuestion,
          model: modelId,
        }),
        signal: streamAbort.signal,
      });
    } catch (err) {
      if (err.name === 'AbortError') return;
      finishWithError(err);
      return;
    }

    // ★ پیگیری بعد از ارسال پاک می‌شود (حتی اگر پاسخ شکست بخورد)
    clearFollowUp();

    if (!res.ok || !res.body) {
      // بدنهٔ خطا ممکن است JSON ({error}) یا یک صفحهٔ HTML از gateway باشد؛ HTML خام نباید به کاربر نشان داده شود
      const errTxt = await res.text().catch(() => '');
      let msg = '';
      try { msg = (JSON.parse(errTxt) || {}).error || ''; } catch (e) { /* JSON نیست */ }
      if (!msg && errTxt && !/^\s*</.test(errTxt)) msg = errTxt.slice(0, 200);
      finishWithError(new Error(msg || ('خطای سرور (' + res.status + ')')));
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
      if (err.name === 'AbortError') return;
      finishWithError(err);
      return;
    }

    if (cancelled()) return;
    if (!realModel) realModel = modelId;

    // پاسخ کاملاً خالی نباید به‌عنوان یک پرسش «موفق» ذخیره شود
    if (!acc.trim()) {
      finishWithError(new Error('پاسخ خالی از مدل'));
      return;
    }

    const parsed = AiFormat.parse(acc);

    let askRow = null;
    try {
      askRow = await Store.saveAskAi({
        surah: target.surah,
        ayah: target.ayah,
        model: realModel,
        question: displayQuestion,
        answerRaw: acc,
      });
    } catch (e) {
      console.error('[ask-ai] saveAskAi FAILED:', e);
      UI.toast('ذخیرهٔ پاسخ ناموفق بود: ' + (e?.message || e?.details || e?.hint || 'خطای نامشخص'));
    }

    let generationId = null;
    if (askRow) {
      try {
        const gen = await Store.createGeneration({
          source: 'ask_ai',
          refId: askRow.id,
          model: realModel,
        });
        generationId = gen.id;
      } catch (e) {
        console.error('[ask-ai] createGeneration FAILED:', e);
      }
    }

    const sc = await generationScore(realModel);
    if (cancelled()) { submitBtn.disabled = false; return; }   // کاربر وسط ذخیره به آیهٔ دیگری رفت

    AiFormat.render(answerEl, parsed, {
      model: realModel,
      question: displayQuestion,
      surahIndex: index,
      generationId,
      refId: askRow ? askRow.id : null,
      myVote: 0,
      modelScore: sc,
    });
    AiFormat.wireCard(answerEl, parsed, {
      generationId,
      refId: askRow ? askRow.id : null,
      model: realModel,
      question: displayQuestion,
      surahIndex: index,
      modelScore: sc,
      modelScoreAfter: async () => await generationScore(realModel),
      onAfterVote: async () => { await loadModelScores(); },
      onAfterSectionChange: async () => { await renderHistory(); },
      onAfterDelete: async () => {
        answerEl.innerHTML = '';
        await renderHistory();
      },
      onFollowUp: handleFollowUp,
    });

    setStatus('done');
    submitBtn.disabled = false;
    streamAbort = null;
    lastQuestion = '';

    await renderHistory();
  }

  function finishWithError(err) {
    console.error('[ask-ai]', err);
    setStatus('error');
    submitBtn.disabled = false;
    streamAbort = null;
    // متن پرسش را برگردان تا کاربر مجبور نشود دوباره تایپ کند
    if (lastQuestion && !inputEl.value.trim()) inputEl.value = lastQuestion;
    UI.toast('خطا: ' + (err.message || 'نامشخص'));
  }

  // ---------- History ----------
  async function renderHistory() {
    // رندرهای هم‌زمان (تغییر آیه، حذف، پایان پاسخ) نباید نتیجهٔ آیهٔ دیگر را روی این آیه بنویسند
    const seq = ++historySeq;
    const at = { surah: currentAyah.surah, ayah: currentAyah.ayah };
    let rows = [];
    try {
      rows = await Store.getAskAiHistory(at.surah, at.ayah, 20);
    } catch (e) {
      console.error('[ask-ai] getAskAiHistory failed:', e);
    }
    if (seq !== historySeq) return;

    if (!rows || !rows.length) { historyEl.innerHTML = ''; return; }

    const enriched = await Promise.all(rows.map(async (r) => {
      let gen = null;
      try { gen = await Store.getLatestGeneration('ask_ai', r.id); }
      catch (e) { console.error('[ask-ai] getLatestGeneration failed:', e, r.id); }
      return { ...r, gen };
    }));
    if (seq !== historySeq) return;

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
                <button type="button" class="ai-delete-question" data-ai-delete-history="${r.id}" aria-label="حذف این پرسش" title="حذف این پرسش">✕</button>
              </div>
              <div class="ai-history-item__body"></div>
            </div>`;
        }).join('')}
      </div>`;

    historyEl.querySelectorAll('[data-ai-delete-history]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-ai-delete-history');
        const ok = await AiFormat.confirm({
          title: 'حذف پرسش',
          message: 'کل این پرسش و پاسخش برای همیشه حذف می‌شود.',
          confirmText: 'حذف',
        });
        if (!ok) return;
        try {
          btn.disabled = true;
          await Store.deleteAskAi(id);
          UI.toast('پرسش حذف شد');
          await renderHistory();
        } catch (err) {
          console.error('[ask-ai] deleteAskAi failed:', err);
          UI.toast('خطا در حذف پرسش: ' + (err?.message || 'نامشخص'));
          btn.disabled = false;
        }
      });
    });

    historyEl.querySelectorAll('.ai-history-item').forEach((item) => {
      const id = item.getAttribute('data-id');
      const row = enriched.find((r) => String(r.id) === id);
      if (!row) return;
      const bodyEl = item.querySelector('.ai-history-item__body');
      const head = item.querySelector('.ai-history-item__head');
      let rendered = false;

      const openIt = async () => {
        if (rendered) return;
        const parsed = AiFormat.parse(row.answer_raw || '');
        const genId = row.gen ? row.gen.id : null;
        const sc = row.model ? await generationScore(row.model) : 0;
        AiFormat.render(bodyEl, parsed, {
          model: row.model,
          question: row.question,
          surahIndex: index,
          generationId: genId,
          refId: row.id,
          myVote: 0,
          modelScore: sc,
        });
        AiFormat.wireCard(bodyEl, parsed, {
          generationId: genId,
          refId: row.id,
          model: row.model,
          question: row.question,
          surahIndex: index,
          modelScore: sc,
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
    if (submitBtn.disabled || streamAbort) return;   // Ctrl+Enter هم نباید استریم دوم شروع کند
    const q = inputEl.value.trim();
    if (!q) { UI.toast('پرسشی بنویسید'); return; }
    lastQuestion = q;
    inputEl.value = '';
    submitBtn.disabled = true;     // همین لحظه قفل شود (askAi چند await دارد قبل از شروع استریم)
    askAi(q);
  }
  submitBtn.addEventListener('click', submit);
  inputEl.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submit(); }
  });

  setStatus('idle');
  await loadModelScores();
  await renderHistory();
})();