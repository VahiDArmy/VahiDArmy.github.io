/* =========================================================
   کلاینت AI — پرامپت در فرانت، اجرا روی Edge (Gemini)
   کلید API فقط روی سرور (Secret: GEM_MALI)
   ========================================================= */
window.AI = (function () {
  const MODEL_KEY = CONFIG.AI.MODEL_STORAGE_KEY;
  const EDGE_NAME = (CONFIG.SUPABASE && CONFIG.SUPABASE.EDGE_FUNCTION) || 'gemini-proxy';

  let abortController = null;
  let lastUsedModel = null;

  function edgeUrl() {
    return CONFIG.SUPABASE.URL + '/functions/v1/' + EDGE_NAME;
  }

  function authHeaders() {
    const h = {
      'Content-Type': 'application/json',
      'apikey': CONFIG.SUPABASE.ANON_KEY,
      'Authorization': 'Bearer ' + CONFIG.SUPABASE.ANON_KEY
    };
    // If logged in, prefer user JWT so edge can identify user later
    try {
      const client = DB.getClient && DB.getClient();
      // session may be async; use stored if available
      const raw = localStorage.getItem('sb-' + new URL(CONFIG.SUPABASE.URL).hostname.split('.')[0] + '-auth-token');
      // simpler: always anon is enough for secret-backed proxy
    } catch (e) {}
    return h;
  }

  /* ---------- سازگاری با UI قدیمی (کلید دیگر لازم نیست) ---------- */
  function getKey() { return 'server'; }
  function setKey() { /* no-op — key is on Edge */ }
  function isConfigured() { return true; }

  /* ---------- مدل (برچسب نمایشی؛ اجرای واقعی روی Edge با Gemini) ---------- */
  function getModels() {
    try { return DB.getAiModels(); }
    catch (e) { return []; }
  }

  function getModel() {
    try {
      const stored = localStorage.getItem(MODEL_KEY);
      const models = getModels();
      if (stored && models.some(function (m) { return m.id === stored; })) return stored;
      // default Gemini flash
      return 'gemini-2.0-flash';
    } catch (e) {
      return 'gemini-2.0-flash';
    }
  }

  function setModel(id) {
    if (id) localStorage.setItem(MODEL_KEY, id);
    else localStorage.removeItem(MODEL_KEY);
  }

  function getModelMeta() {
    const id = getModel();
    const models = getModels();
    const found = models.filter(function (m) { return m.id === id; })[0];
    return found || { id: id, label: id, note: 'Gemini via Edge', tags: ['gemini'] };
  }

  function isDefaultModel() { return getModel() === 'gemini-2.0-flash'; }
  function resetModel() { localStorage.removeItem(MODEL_KEY); }
  function getLastUsedModel() { return lastUsedModel; }
  function clearLastUsedModel() { lastUsedModel = null; }

  function aiShow() {
    try { if (window.AILog && AILog.show) AILog.show(); } catch (e) {}
  }
  function aiLog(type, msg) {
    try { if (window.AILog && AILog.push) AILog.push(type, msg); } catch (e) {}
  }
  function aiAutoHide() {
    try { if (window.AILog && AILog.autoHide) AILog.autoHide(); } catch (e) {}
  }

  function abort() {
    if (abortController) {
      try { abortController.abort(); } catch (e) {}
      abortController = null;
    }
  }

  /**
   * ارسال messages آماده‌شده از فرانت به Edge → Gemini
   * Stream واقعی نداریم؛ کل متن یکجا برمی‌گردد و به onToken داده می‌شود.
   */
  async function chatStream(opts) {
    opts = opts || {};
    const messages = opts.messages || [];
    const temperature = opts.temperature != null ? opts.temperature : 0.5;
    const onToken = opts.onToken || function () {};
    const onDone = opts.onDone || function () {};
    const signal = opts.signal;

    aiShow();
    aiLog('info', '▸ ارسال به Gemini (Edge)');
    aiLog('meta', 'پیام‌ها: ' + messages.length + ' · دما: ' + temperature);

    abortController = new AbortController();
    const combined = signal || abortController.signal;

    // map display model id to a gemini model if user picked openrouter-style id
    let model = opts.model || getModel() || 'gemini-2.0-flash';
    if (model.indexOf('gemini') === -1) {
      model = 'gemini-2.0-flash';
    }
    lastUsedModel = model;
    aiLog('meta', 'مدل: ' + model);

    let res;
    try {
      res = await fetch(edgeUrl(), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ messages: messages, temperature: temperature, model: model }),
        signal: combined
      });
    } catch (netErr) {
      if (netErr.name === 'AbortError') {
        aiLog('warn', '⊘ لغو شد');
      } else {
        aiLog('error', '✗ شبکه: ' + netErr.message);
      }
      aiAutoHide();
      throw netErr;
    }

    const json = await res.json().catch(function () { return {}; });
    if (!res.ok || json.error) {
      const msg = json.error || ('HTTP ' + res.status);
      aiLog('error', '✗ ' + msg);
      aiAutoHide();
      throw new Error(msg);
    }

    const text = json.text || '';
    aiLog('success', '✓ پاسخ دریافت شد (' + text.length + ' کاراکتر)');
    // deliver as one chunk so existing UI still works
    if (text) onToken(text);
    onDone(text);
    aiAutoHide();
    return text;
  }

  async function chat(opts) {
    opts = opts || {};
    let full = '';
    await chatStream({
      messages: opts.messages,
      model: opts.model,
      temperature: opts.temperature,
      signal: opts.signal,
      onToken: function (t) { full += t; },
      onDone: function () {}
    });
    return full;
  }

  async function testConnection() {
    const text = await chat({
      messages: [
        { role: 'user', content: 'فقط بگو: ok' }
      ],
      temperature: 0
    });
    return text;
  }

  return {
    getKey: getKey,
    setKey: setKey,
    isConfigured: isConfigured,
    getModels: getModels,
    getModel: getModel,
    setModel: setModel,
    getModelMeta: getModelMeta,
    isDefaultModel: isDefaultModel,
    resetModel: resetModel,
    getLastUsedModel: getLastUsedModel,
    clearLastUsedModel: clearLastUsedModel,
    chatStream: chatStream,
    chat: chat,
    abort: abort,
    testConnection: testConnection
  };
})();
