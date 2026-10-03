// =============================================================
// بخش «بپرس از هوش مصنوعی» — composer، استریم، ذخیره، تاریخچه
// =============================================================

// مدل ثابت — بدون انتخابگر.
const ASK_AI_MODEL = {
  id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
  name: 'Nemotron 3 Ultra',
};

(async function () {
  const section = document.getElementById('askAiSection');
  if (!section) return;

  const session = await Auth.getSession().catch(() => null);
  if (!session) { section.hidden = true; return; }
  section.hidden = false;

  const inputEl   = document.getElementById('askAiInput');
  const submitBtn = document.getElementById('askAiSubmit');
  const statusEl  = document.getElementById('aiStatus');
  const answerEl  = document.getElementById('askAiAnswer');
  const historyEl = document.getElementById('askAiHistory');

  const index = await QuranData.getIndex();

  let currentAyah = readCurrentAyah();
  let streamAbort = null;

  // ---------- Current ayah ----------
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
    await renderHistory();
  }

  // ---------- Status light ----------
  function setStatus(state) { statusEl.setAttribute('data-state', state); }

  // ---------- Streaming ----------
  async function askAi(question) {
    const surahMeta = index.find((s) => s.number === currentAyah.surah);
    const surahName = surahMeta ? surahMeta.name_fa : String(currentAyah.surah);

    let ayahText = '', ayahTranslation = '';
    try {
      const surahData = await QuranData.getSurah(currentAyah.surah);
      const ay = surahData.ayahs.find((x) => x.v === currentAyah.ayah);
      if (ay) { ayahText = ay.ar; ayahTranslation = ay.fa; }
    } catch (e) { /* keep empty */ }

    streamAbort = new AbortController();
    submitBtn.disabled = true;
    setStatus('streaming');
    let acc = '';
    AiFormat.renderStreaming(answerEl, question, '', ASK_AI_MODEL.name);

    const url = `${CONFIG.SUPABASE_URL}/functions/v1/bright-api`;
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          surah: currentAyah.surah,
          ayah: currentAyah.ayah,
          surahName,
          ayahText,
          ayahTranslation,
          question,
          model: ASK_AI_MODEL.id,
        }),
        signal: streamAbort.signal,
      });
    } catch (err) {
      if (err.name === 'AbortError') return;
      finishWithError(err);
      return;
    }

    if (!res.ok || !res.body) {
      const errTxt = await res.text().catch(() => '');
      finishWithError(new Error(errTxt || `HTTP ${res.status}`));
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
            if (j.delta) {
              acc += j.delta;
              AiFormat.renderStreaming(answerEl, question, acc, ASK_AI_MODEL.name);
            }
            if (j.error) { finishWithError(new Error(j.error)); return; }
          } catch (e) { /* ignore */ }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      finishWithError(err);
      return;
    }

    // ذخیرهٔ اولیه
    let savedRow = null;
    try {
      savedRow = await Store.saveAskAi({
        surah: currentAyah.surah,
        ayah: currentAyah.ayah,
        model: ASK_AI_MODEL.id,
        question,
        answerRaw: acc,
      });
    } catch (e) { console.warn('ask_ai save failed', e); }

    const parsed = AiFormat.parse(acc);
    AiFormat.render(answerEl, parsed, {
      model: ASK_AI_MODEL.id,
      question,
      surahIndex: index,
      onChange: savedRow
        ? async (newRaw) => { await Store.updateAskAi(savedRow.id, newRaw); }
        : null,
      onDelete: savedRow
        ? async () => {
            await Store.deleteAskAi(savedRow.id);
            answerEl.innerHTML = '';
            await renderHistory();
            UI.toast('پاسخ حذف شد');
          }
        : null,
    });
    wireAnswerActions(answerEl, parsed);
    setStatus('done');
    submitBtn.disabled = false;
    streamAbort = null;

    await renderHistory();
  }

  function finishWithError(err) {
    console.error('[ask-ai]', err);
    setStatus('error');
    submitBtn.disabled = false;
    streamAbort = null;
    UI.toast('خطا: ' + (err.message || 'نامشخص'));
  }

  // ---------- Draft / tag actions ----------
  function wireAnswerActions(rootEl, parsed) {
    const insertBtn = rootEl.querySelector('[data-ai-insert-draft]');
    if (insertBtn && parsed.draft) {
      insertBtn.addEventListener('click', () => {
        const ta = document.getElementById('tafsirContent');
        if (!ta) return;
        const cur = ta.value.trim();
        const draft = parsed.draft.trim();
        ta.value = cur ? `${cur}\n\n${draft}` : draft;
        ta.focus();
        ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
        UI.toast('پیش‌نویس در فرم درج شد');
      });
    }
    rootEl.querySelectorAll('[data-ai-add-tag]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tag = btn.getAttribute('data-ai-add-tag');
        const inp = document.getElementById('tafsirTags');
        if (!inp) return;
        const parts = Array.from(new Set(
          (inp.value || '').split(/[,،]/).map((x) => x.trim()).filter(Boolean).concat([tag])
        ));
        inp.value = parts.join('، ');
        UI.toast(`برچسب «${tag}» افزوده شد`);
      });
    });
  }

  // ---------- History ----------
  async function renderHistory() {
    let rows = [];
    try {
      rows = await Store.getAskAiHistory(currentAyah.surah, currentAyah.ayah, 20);
    } catch (e) { console.warn('history fetch failed', e); }

    if (!rows || !rows.length) { historyEl.innerHTML = ''; return; }

    historyEl.innerHTML = `
      <div class="ai-history">
        <div class="ai-history__head">پرسش‌های پیشین برای این آیه</div>
        ${rows.map((r, i) => {
          const date = new Date(r.created_at).toLocaleDateString('fa-IR');
          return `
            <div class="ai-history-item" data-open="${i === 0 ? 'true' : 'false'}" data-id="${r.id}">
              <div class="ai-history-item__head">
                <span class="ai-history-item__q">${AiFormat.escapeHtml(r.question)}</span>
                <span class="ai-history-item__date">${date}</span>
              </div>
              <div class="ai-history-item__body"></div>
            </div>`;
        }).join('')}
      </div>`;

    historyEl.querySelectorAll('.ai-history-item').forEach((item) => {
      const id = item.getAttribute('data-id');
      const row = rows.find((r) => r.id === id);
      const bodyEl = item.querySelector('.ai-history-item__body');
      const head = item.querySelector('.ai-history-item__head');
      let rendered = false;

      const openIt = () => {
        if (rendered) return;
        const parsed = AiFormat.parse(row.answer_raw || '');
        AiFormat.render(bodyEl, parsed, {
          model: row.model,
          question: row.question,
          surahIndex: index,
          onChange: async (newRaw) => { await Store.updateAskAi(row.id, newRaw); },
          onDelete: async () => {
            await Store.deleteAskAi(row.id);
            item.remove();
            UI.toast('پاسخ حذف شد');
          },
        });
        wireAnswerActions(bodyEl, parsed);
        rendered = true;
      };
      if (item.getAttribute('data-open') === 'true') openIt();

      head.addEventListener('click', () => {
        const isOpen = item.getAttribute('data-open') === 'true';
        item.setAttribute('data-open', isOpen ? 'false' : 'true');
        if (!isOpen) openIt();
      });
    });
  }

  // ---------- Submit ----------
  function submit() {
    const q = inputEl.value.trim();
    if (!q) { UI.toast('پرسشی بنویسید'); return; }
    inputEl.value = '';
    askAi(q);
  }
  submitBtn.addEventListener('click', submit);
  inputEl.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submit(); }
  });

  setStatus('idle');
  await renderHistory();
})();