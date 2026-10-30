/* =========================================================
   کلاینت AI — پرامپت در فرانت، اجرا روی Edge (Gemini STREAM)
   Secret سرور: GEM_MALI
   Function: movies-quran
   ========================================================= */
window.AI = (function () {
  const MODEL_KEY = CONFIG.AI.MODEL_STORAGE_KEY;
  const EDGE_NAME = (CONFIG.SUPABASE && CONFIG.SUPABASE.EDGE_FUNCTION) || 'movies-quran';

  let abortController = null;
  let lastUsedModel = null;

  function edgeUrl() {
    return CONFIG.SUPABASE.URL + '/functions/v1/' + EDGE_NAME;
  }

  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      'apikey': CONFIG.SUPABASE.ANON_KEY,
      'Authorization': 'Bearer ' + CONFIG.SUPABASE.ANON_KEY
    };
  }

  function getKey() { return 'server'; }
  function setKey() {}
  function isConfigured() { return true; }

  function getModels() {
    try { return DB.getAiModels(); } catch (e) { return []; }
  }

  function getModel() {
    try {
      const stored = localStorage.getItem(MODEL_KEY);
      const models = getModels();
      if (stored && models.some(function (m) { return m.id === stored; })) return stored;
      return 'gemini-3.8-flash';
    } catch (e) {
      return 'gemini-3.8-flash';
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

  function isDefaultModel() { return getModel() === 'gemini-3.8-flash'; }
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

  function resolveModel(requested) {
    let model = requested || getModel() || 'gemini-3.8-flash';
    if (String(model).indexOf('gemini') === -1) model = 'gemini-3.8-flash';
    return model;
  }

  function friendlyHttpError(status, msg) {
    msg = msg || '';
    if (status === 504 || /504|timeout|timed out|Gateway/i.test(msg)) {
      return 'زمان پاسخ تمام شد (504). با استریم معمولاً بهتر است؛ دوباره تلاش کن.';
    }
    if (status === 502) return 'خطای واسط (502): ' + (msg || 'Gemini یا Edge پاسخ معتبر نداد.');
    if (status === 401 || status === 403) return 'دسترسی رد شد (' + status + ').';
    if (status === 500 && /GEM_MALI|secret|misconfigured/i.test(msg)) {
      return 'کلید Gemini روی سرور تنظیم نشده (secret: GEM_MALI).';
    }
    return msg || ('خطای سرور (HTTP ' + status + ')');
  }

  /**
   * استریم واقعی از Edge → Gemini SSE
   */
  async function chatStream(opts) {
    opts = opts || {};
    const messages = opts.messages || [];
    const temperature = opts.temperature != null ? opts.temperature : 0.5;
    const onToken = opts.onToken || function () {};
    const onDone = opts.onDone || function () {};
    const signal = opts.signal;

    aiShow();
    aiLog('info', '▸ استریم Gemini (Edge)');
    aiLog('meta', 'پیام‌ها: ' + messages.length + ' · دما: ' + temperature);

    abortController = new AbortController();
    const combined = signal || abortController.signal;

    const model = resolveModel(opts.model);
    lastUsedModel = model;
    aiLog('meta', 'مدل: ' + model);

    let res;
    try {
      res = await fetch(edgeUrl(), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          messages: messages,
          temperature: temperature,
          model: model,
          stream: true
        }),
        signal: combined
      });
    } catch (netErr) {
      if (netErr.name === 'AbortError') aiLog('warn', '⊘ لغو شد');
      else aiLog('error', '✗ شبکه: ' + netErr.message);
      aiAutoHide();
      throw netErr;
    }

    const ctype = (res.headers.get('content-type') || '').toLowerCase();

    // Non-SSE fallback (error JSON or old non-stream response)
    if (!ctype.includes('text/event-stream')) {
      const json = await res.json().catch(function () { return {}; });
      if (!res.ok || json.error) {
        const msg = friendlyHttpError(res.status, json.error || '');
        aiLog('error', '✗ ' + msg);
        aiAutoHide();
        throw new Error(msg);
      }
      const text = json.text || '';
      if (text) onToken(text);
      onDone(text);
      aiLog('success', '✓ پاسخ کامل (' + text.length + ' کاراکتر)');
      aiAutoHide();
      return text;
    }

    if (!res.ok) {
      const msg = friendlyHttpError(res.status, '');
      aiLog('error', '✗ ' + msg);
      aiAutoHide();
      throw new Error(msg);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    let streamError = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n');
      buffer = parts.pop() || '';

      for (let i = 0; i < parts.length; i++) {
        const line = parts[i].trim();
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (!raw) continue;
        try {
          const obj = JSON.parse(raw);
          if (obj.error) {
            streamError = obj.error;
            continue;
          }
          if (typeof obj.text === 'string' && obj.text && !obj.done) {
            full += obj.text;
            onToken(obj.text);
          }
          if (obj.done && typeof obj.text === 'string' && obj.text.length > full.length) {
            // final full text if edge sent complete
            const extra = obj.text.slice(full.length);
            if (extra) {
              full = obj.text;
              onToken(extra);
            } else if (!full && obj.text) {
              full = obj.text;
              onToken(obj.text);
            }
          }
        } catch (e) { /* skip */ }
      }
    }

    if (streamError) {
      aiLog('error', '✗ ' + streamError);
      aiAutoHide();
      throw new Error(streamError);
    }

    aiLog('success', '✓ استریم تمام شد (' + full.length + ' کاراکتر)');
    onDone(full);
    aiAutoHide();
    return full;
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

  async function chatJSON(opts) {
    opts = opts || {};
    const messages = (opts.messages || []).slice();
    var hasJsonHint = messages.some(function (m) {
      return /json/i.test(m.content || '');
    });
    if (!hasJsonHint && messages.length) {
      var last = messages[messages.length - 1];
      if (last.role === 'user') {
        messages[messages.length - 1] = {
          role: last.role,
          content: (last.content || '') + '\n\nپاسخ را فقط به‌صورت JSON معتبر برگردان.'
        };
      }
    }
    return await chat({
      messages: messages,
      model: opts.model,
      temperature: opts.temperature != null ? opts.temperature : 0.3,
      signal: opts.signal
    });
  }

  function extractJsonAndText(raw) {
    if (!raw) return { parsed: null, before: '', after: '', raw: '' };
    const original = String(raw);
    const s = original;

    const fenced = s.match(/```(?:json|JSON)?\s*\n?([\s\S]*?)```/);
    if (fenced && /[\{\[]/.test(fenced[1])) {
      const inner = fenced[1].trim();
      const before = s.slice(0, fenced.index).trim();
      const after = s.slice(fenced.index + fenced[0].length).trim();
      let parsed = null;
      try { parsed = JSON.parse(inner); } catch (e) {}
      if (!parsed) {
        const fb = inner.search(/[\{\[]/);
        const lb = Math.max(inner.lastIndexOf('}'), inner.lastIndexOf(']'));
        if (fb >= 0 && lb > fb) {
          try { parsed = JSON.parse(inner.slice(fb, lb + 1)); } catch (e) {}
        }
      }
      return { parsed: parsed, before: before, after: after, raw: original };
    }

    const trimmed = s.trim();
    const fb = trimmed.search(/[\{\[]/);
    if (fb < 0) return { parsed: null, before: original, after: '', raw: original };
    const lb = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'));
    if (lb < 0 || lb < fb) return { parsed: null, before: original, after: '', raw: original };
    const before = trimmed.slice(0, fb).trim();
    const after = trimmed.slice(lb + 1).trim();
    let parsed = null;
    try { parsed = JSON.parse(trimmed.slice(fb, lb + 1)); } catch (e) {}
    return { parsed: parsed, before: before, after: after, raw: original };
  }

  function parseJSONResponse(raw) {
    return extractJsonAndText(raw).parsed;
  }

  async function testConnection() {
    return await chat({
      messages: [{ role: 'user', content: 'فقط بگو: ok' }],
      temperature: 0
    });
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
    chatJSON: chatJSON,
    abort: abort,
    testConnection: testConnection,
    extractJsonAndText: extractJsonAndText,
    parseJSONResponse: parseJSONResponse
  };
})();
