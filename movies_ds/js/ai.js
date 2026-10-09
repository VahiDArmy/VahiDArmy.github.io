/* =========================================================
   کلاینت OpenRouter — با انتخاب مدل + Streaming + لاگ
   ========================================================= */
window.AI = (function () {
  const STORAGE_KEY = CONFIG.AI.STORAGE_KEY;
  const MODEL_KEY = CONFIG.AI.MODEL_STORAGE_KEY;
  const API_URL = CONFIG.AI.API_URL;

  let abortController = null;
  let lastUsedModel = null;

  /* ---------- توکن ---------- */
  function getKey() {
    return localStorage.getItem(STORAGE_KEY) || '';
  }
  function setKey(k) {
    if (k && k.trim()) localStorage.setItem(STORAGE_KEY, k.trim());
    else localStorage.removeItem(STORAGE_KEY);
  }
  function isConfigured() {
    return !!getKey();
  }

  /* ---------- مدل — از دیتابیس ---------- */
  function getModels() {
    try { return DB.getAiModels(); }
    catch (e) { return []; }
  }

  function getModel() {
    try {
      const stored = localStorage.getItem(MODEL_KEY);
      const models = getModels();
      if (stored && models.some(function (m) { return m.id === stored; })) return stored;
      const rec = models.filter(function (m) { return m.recommended; })[0];
      if (rec) return rec.id;
      if (models.length) return models[0].id;
      return '';
    } catch (e) {
      return '';
    }
  }

  function setModel(id) {
    try {
      const models = getModels();
      if (id && models.some(function (m) { return m.id === id; })) {
        localStorage.setItem(MODEL_KEY, id);
      } else {
        localStorage.removeItem(MODEL_KEY);
      }
    } catch (e) {
      localStorage.removeItem(MODEL_KEY);
    }
  }

  function getModelMeta() {
    const id = getModel();
    if (!id) return { id: '', label: '—', note: '', tags: [] };
    const models = getModels();
    return models.filter(function (m) { return m.id === id; })[0] || { id: id, label: id, note: '', tags: [] };
  }

  function isDefaultModel() {
    const models = getModels();
    const rec = models.filter(function (m) { return m.recommended; })[0];
    return rec ? getModel() === rec.id : false;
  }

  function resetModel() {
    localStorage.removeItem(MODEL_KEY);
  }

  /* ---------- آخرین مدلِ استفاده‌شده ---------- */
  function getLastUsedModel() {
    return lastUsedModel;
  }
  function clearLastUsedModel() {
    lastUsedModel = null;
  }

  /* ---------- هدرها ---------- */
  function headers() {
    return {
      'Authorization': `Bearer ${getKey()}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': location.origin,
      'X-Title': 'Cinema App'
    };
  }

  /* ---------- لاگ ایمن ---------- */
  function aiLog(level, msg) {
    if (window.AILog && typeof AILog[level] === 'function') {
      try { AILog[level](msg); } catch {}
    }
  }
  function aiShow() { if (window.AILog) try { AILog.show(); } catch {} }
  function aiAutoHide() { if (window.AILog) try { AILog.scheduleAutoHide(); } catch {} }

  /* ---------- بررسی مدل خالی ---------- */
  function assertModel(modelName) {
    if (!modelName) {
      aiLog('error', '✗ هیچ مدلی در دیتابیس تعریف نشده');
      aiLog('meta', 'از تنظیمات (⚙) → هوش مصنوعی → 🔍 OpenRouter یک مدل اضافه کن');
      aiAutoHide();
      throw new Error('هیچ مدل AI تعریف نشده. از تنظیمات یک مدل اضافه کن.');
    }
  }

  /* ---------- استریم ---------- */
  async function chatStream({ messages, model, temperature, onToken, onDone, signal }) {
    aiShow();
    aiLog('info', '▸ شروع درخواست استریم');

    if (!isConfigured()) {
      aiLog('error', '✗ کلید OpenRouter تنظیم نشده است');
      aiLog('meta', 'کلید را از تنظیمات (⚙) → «هوش مصنوعی» وارد کنید');
      aiAutoHide();
      throw new Error('کلید OpenRouter تنظیم نشده است.');
    }

    const modelName = model || getModel();
    assertModel(modelName);

    abortController = new AbortController();
    const combinedSignal = signal || abortController.signal;

    const models = getModels();
    const meta = models.filter(function (m) { return m.id === modelName; })[0];
    const modelLabel = meta ? meta.label : modelName;
    const vendor = meta ? (meta.vendor || '') : '';

    const t0 = performance.now();

    aiLog('request', '▸ ارسال درخواست به OpenRouter');
    aiLog('meta', `مدل: ${modelLabel}`);
    aiLog('meta', `پیام‌ها: ${messages.length} · دما: ${temperature ?? 0.5}`);

    let res;
    try {
      res = await fetch(API_URL, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          model: modelName,
          messages,
          stream: true,
          temperature: temperature ?? 0.5
        }),
        signal: combinedSignal
      });
    } catch (netErr) {
      if (netErr.name === 'AbortError') {
        aiLog('warn', '⊘ درخواست توسط کاربر لغو شد');
      } else {
        aiLog('error', `✗ خطای شبکه: ${netErr.message}`);
      }
      aiAutoHide();
      throw netErr;
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      aiLog('error', `✗ پاسخ ناموفق: HTTP ${res.status}`);
      let userMsg = `خطای OpenRouter (${res.status}): ${txt.slice(0, 400)}`;
      try {
        const j = JSON.parse(txt);
        if (/not a valid model/i.test(j?.error?.message || '')) {
          userMsg = `مدل «${modelName}» معتبر نیست. مدل دیگری از تنظیمات انتخاب کن.`;
        }
      } catch {}
      aiLog('meta', txt.slice(0, 180));
      aiAutoHide();
      throw new Error(userMsg);
    }

    aiLog('success', `✓ اتصال برقرار شد (HTTP ${res.status})`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    let firstChunk = true;
    let chunkCount = 0;
    let lastLogLen = 0;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content || '';
          if (delta) {
            full += delta;
            chunkCount++;
            if (firstChunk) {
              firstChunk = false;
              aiLog('stream', '◐ شروع دریافت پاسخ…');
            }
            if (full.length - lastLogLen >= 400) {
              lastLogLen = full.length;
              aiLog('stream', `↓ ${full.length} کاراکتر دریافت شد`);
            }
            onToken && onToken(delta, full);
          }
        } catch {}
      }
    }

    const dt = ((performance.now() - t0) / 1000).toFixed(1);
    aiLog('success', `✓ پاسخ کامل شد · ${full.length} کاراکتر · ${chunkCount} chunk · ${dt}s`);
    aiAutoHide();

    lastUsedModel = {
      id: modelName,
      label: modelLabel,
      vendor: vendor,
      meta: meta || null,
      at: new Date().toISOString()
    };

    onDone && onDone(full);
    return full;
  }

  /* ---------- JSON (بدون استریم) ---------- */
  async function chatJSON({ messages, model, temperature, signal }) {
    aiShow();
    aiLog('info', '▸ شروع درخواست JSON');

    if (!isConfigured()) {
      aiLog('error', '✗ کلید OpenRouter تنظیم نشده است');
      aiAutoHide();
      throw new Error('کلید OpenRouter تنظیم نشده است.');
    }

    const modelName = model || getModel();
    assertModel(modelName);

    abortController = new AbortController();
    const combinedSignal = signal || abortController.signal;

    const models = getModels();
    const meta = models.filter(function (m) { return m.id === modelName; })[0];
    const modelLabel = meta ? meta.label : modelName;
    const vendor = meta ? (meta.vendor || '') : '';

    const t0 = performance.now();

    aiLog('request', '▸ ارسال درخواست به OpenRouter');
    aiLog('meta', `مدل: ${modelLabel}`);
    aiLog('meta', `پیام‌ها: ${messages.length}`);

    let res;
    try {
      res = await fetch(API_URL, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          model: modelName,
          messages,
          stream: false,
          temperature: temperature ?? 0.3,
          response_format: { type: 'json_object' }
        }),
        signal: combinedSignal
      });
    } catch (netErr) {
      if (netErr.name === 'AbortError') {
        aiLog('warn', '⊘ درخواست لغو شد');
      } else {
        aiLog('error', `✗ خطای شبکه: ${netErr.message}`);
      }
      aiAutoHide();
      throw netErr;
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      aiLog('error', `✗ پاسخ ناموفق: HTTP ${res.status}`);
      let userMsg = `خطای OpenRouter (${res.status}): ${txt.slice(0, 400)}`;
      try {
        const j = JSON.parse(txt);
        if (/not a valid model/i.test(j?.error?.message || '')) {
          userMsg = `مدل «${modelName}» معتبر نیست.`;
        }
      } catch {}
      aiAutoHide();
      throw new Error(userMsg);
    }

    aiLog('success', '✓ اتصال برقرار شد');

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content || '';
    const dt = ((performance.now() - t0) / 1000).toFixed(1);
    const usage = json.usage || {};

    aiLog('success', `✓ پاسخ دریافت شد · ${content.length} کاراکتر · ${dt}s`);
    if (usage.prompt_tokens || usage.completion_tokens) {
      aiLog('meta', `tokens: ${usage.prompt_tokens || 0} → ${usage.completion_tokens || 0}`);
    }
    aiAutoHide();

    lastUsedModel = {
      id: modelName,
      label: modelLabel,
      vendor: vendor,
      meta: meta || null,
      at: new Date().toISOString()
    };

    return content;
  }

  function abort() {
    if (abortController) {
      try { abortController.abort(); } catch {}
      abortController = null;
    }
  }

  function parseJSONResponse(raw) {
    if (!raw) return null;
    let s = String(raw).trim();
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const firstBrace = s.search(/[\{\[]/);
    if (firstBrace > 0) s = s.slice(firstBrace);
    const lastBrace = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
    if (lastBrace > 0) s = s.slice(0, lastBrace + 1);
    try { return JSON.parse(s); } catch { return null; }
  }

  return {
    getKey, setKey, isConfigured,
    getModel, setModel, getModelMeta, isDefaultModel, resetModel,
    getModels,
    getLastUsedModel, clearLastUsedModel,
    chatStream, chatJSON, abort, parseJSONResponse
  };
})();