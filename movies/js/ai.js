/* =========================================================
   کلاینت AI — پرامپت در فرانت، اجرا روی Edge
   ---------------------------------------------------------
   Edge: movies-quran
   Secrets: GEM_MALI (provider=google), OPENROUTER_API_KEY (provider=openrouter)

   هر مدلی که از بیرون (picker) پاس داده می‌شود،
   همان اجرا می‌شود. هیچ fallback خودکاری در کار نیست.
   ========================================================= */
window.AI = (function () {
  const MODEL_KEY = CONFIG.AI.MODEL_STORAGE_KEY;
  const EDGE_NAME = (CONFIG.SUPABASE && CONFIG.SUPABASE.EDGE_FUNCTION) || 'movies-quran';
  const DEFAULT_MODEL = 'gemini-3.8-flash';

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
      if (stored && String(stored).trim()) return String(stored).trim();
      return DEFAULT_MODEL;
    } catch (e) {
      return DEFAULT_MODEL;
    }
  }

  function setModel(id) {
    if (id) localStorage.setItem(MODEL_KEY, String(id).trim());
    else localStorage.removeItem(MODEL_KEY);
    try {
      document.dispatchEvent(new CustomEvent('cinema:model-changed', {
        detail: { id: id || DEFAULT_MODEL }
      }));
    } catch (e) {}
  }

  function modelMetaById(id) {
    if (!id) return null;
    try {
      const models = getModels();
      const found = models.filter(function (m) { return m.id === id; })[0];
      if (found) return found;
    } catch (e) {}
    return {
      id: id,
      label: id,
      provider: String(id).toLowerCase().indexOf('gemini') === 0 ? 'google' : 'openrouter'
    };
  }

  function getModelMeta() {
    return modelMetaById(getModel()) || { id: DEFAULT_MODEL, label: DEFAULT_MODEL, provider: 'google' };
  }

  function resolveProvider(modelId) {
    const meta = modelMetaById(modelId);
    if (meta && meta.provider) return meta.provider;
    return String(modelId || '').toLowerCase().indexOf('gemini') === 0 ? 'google' : 'openrouter';
  }

  function isDefaultModel() { return getModel() === DEFAULT_MODEL; }
  function resetModel() { localStorage.removeItem(MODEL_KEY); }
  function getLastUsedModel() { return lastUsedModel; }
  function clearLastUsedModel() { lastUsedModel = null; }

  function aiShow() {
    try { if (window.AILog && AILog.show) AILog.show(); } catch (e) {}
  }
  function aiLog(type, msg) {
    try {
      if (window.AILog && AILog.log) AILog.log(msg, type);
      else if (window.AILog && AILog.push) AILog.push(type, msg);
    } catch (e) {}
  }
  function aiAutoHide() {
    try { if (window.AILog && AILog.scheduleAutoHide) AILog.scheduleAutoHide(); } catch (e) {}
  }

  function abort() {
    if (abortController) {
      try { abortController.abort(); } catch (e) {}
      abortController = null;
    }
  }

  function resolveModel(requested) {
    return String(requested || getModel() || DEFAULT_MODEL).trim();
  }

  function friendlyHttpError(status, msg) {
    msg = String(msg || '');
    if (status === 401 || status === 403) return 'دسترسی مجاز نیست (کلید یا تنظیمات سرور).';
    if (status === 429) return 'محدودیت نرخ — کمی بعد دوباره تلاش کن.';
    if (status === 502 || /Provider returned error/i.test(msg)) {
      return 'خطای واسط (502): ' + (msg || 'Provider returned error');
    }
    /* Supabase Edge: 546 = worker killed (often WallClockTime) */
    if (status === 546 || status === 504 || /504|546|timeout|timed out|WallClock|Gateway/i.test(msg)) {
      return 'Edge تایم‌اوت شد (HTTP ' + status + '). معمولاً استریم Gemini از Edge نمی‌آید و تا سقف زمانی (~۱۵۰ث) معطل می‌ماند — مشکل مدل Google نیست، مشکل مسیر Edge است.';
    }
    if (msg) return msg;
    return 'خطای سرور (HTTP ' + status + ')';
  }


  function formatMessagesPreview(messages) {
    return (messages || []).map(function (m) {
      return '===== ' + String(m.role || 'user').toUpperCase() + ' =====\n' + String(m.content || '');
    }).join('\n\n');
  }

  function parseMessagesPreview(text) {
    text = String(text || '').trim();
    if (!text) return null;
    var parts = text.split(/===== (SYSTEM|USER|ASSISTANT) =====/i);
    if (parts.length >= 3) {
      var messages = [];
      for (var i = 1; i + 1 < parts.length; i += 2) {
        var role = String(parts[i] || '').toLowerCase();
        var content = String(parts[i + 1] || '').replace(/^\n+/, '').replace(/\n+$/, '');
        if (role === 'system' || role === 'user' || role === 'assistant') {
          messages.push({ role: role, content: content });
        }
      }
      if (messages.length) return messages;
    }
    return [{ role: 'user', content: text }];
  }

  /**
   * قبل از هر ارسال به Edge: نمایش و ویرایش پرامپت.
   * resolve: messages ویرایش‌شده | null اگر انصراف
   */
  function confirmPrompt(messages, meta) {
    meta = meta || {};
    return new Promise(function (resolve) {
      if (typeof Modal === 'undefined' || !Modal.open) {
        resolve(messages);
        return;
      }
      var previewText = formatMessagesPreview(messages);
      var ta = document.createElement('textarea');
      ta.className = 'field-input ai-prompt-gate-editor';
      ta.rows = 20;
      ta.value = previewText;
      ta.setAttribute('style',
        'width:100%;max-height:55vh;min-height:260px;font-family:var(--font-mono,monospace);' +
        'font-size:12px;direction:rtl;text-align:right;white-space:pre-wrap;line-height:1.5;' +
        'padding:12px;box-sizing:border-box');

      var hint = document.createElement('p');
      hint.setAttribute('style', 'margin:0 0 10px;color:var(--text-2);font-size:13px');
      hint.textContent = (meta.title ? meta.title + ' — ' : '') +
        'این پرامپت دقیقاً ارسال می‌شود. در صورت نیاز ویرایش کن، بعد تأیید.';

      var wrap = document.createElement('div');
      wrap.appendChild(hint);
      wrap.appendChild(ta);

      var resolved = false;
      function finish(val) {
        if (resolved) return;
        resolved = true;
        resolve(val);
      }

      var footer = document.createElement('div');
      footer.className = 'flex gap-3 w-full justify-end';
      var btnCancel = document.createElement('button');
      btnCancel.type = 'button';
      btnCancel.className = 'btn btn-ghost';
      btnCancel.textContent = 'انصراف';
      btnCancel.onclick = function () { Modal.close(); finish(null); };
      var btnOk = document.createElement('button');
      btnOk.type = 'button';
      btnOk.className = 'btn btn-primary';
      btnOk.textContent = 'تأیید و ارسال';
      btnOk.onclick = function () {
        var edited = parseMessagesPreview(ta.value);
        Modal.close();
        finish(edited);
      };
      footer.appendChild(btnCancel);
      footer.appendChild(btnOk);

      Modal.open({
        title: 'پرامپت قبل از ارسال',
        icon: '📝',
        size: 'lg',
        body: wrap,
        footer: footer,
        onClose: function () { finish(null); }
      });
    });
  }

  async function chatStream(opts) {
    opts = opts || {};
    let messages = opts.messages || [];
    const temperature = opts.temperature != null ? opts.temperature : 0.5;
    const onToken = opts.onToken || function () {};
    const onDone = opts.onDone || function () {};
    const signal = opts.signal;

    /* همهٔ فراخوانی‌های AI: پرامپت را قبل از ارسال ببین / ویرایش کن */
    if (!opts.skipPreview) {
      const confirmed = await confirmPrompt(messages, {
        title: opts.previewTitle || (opts.model || getModel())
      });
      if (!confirmed) {
        const err = new Error('ارسال لغو شد');
        err.code = 'PROMPT_CANCELLED';
        throw err;
      }
      messages = confirmed;
    }

    aiShow();

    abortController = new AbortController();
    const combined = signal || abortController.signal;

    const model = resolveModel(opts.model);
    const provider = opts.provider || resolveProvider(model);
    const meta = modelMetaById(model) || {};

    lastUsedModel = {
      id: model,
      label: meta.label || model,
      vendor: meta.vendor || '',
      provider: provider,
      meta: { size: meta.size, context: meta.context, speed: meta.speed },
      at: new Date().toISOString()
    };

    aiLog('info', '▸ ' + (provider === 'openrouter' ? 'OpenRouter' : 'Gemini') + ' · ' + model);

    let res;
    try {
      const headers = authHeaders();
      headers['Accept'] = 'text/event-stream';
      res = await fetch(edgeUrl(), {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          provider: provider,
          model: model,
          messages: messages,
          temperature: temperature,
          max_tokens: opts.max_tokens != null ? opts.max_tokens : undefined,
          stream: true,
          stream_options: { include_usage: false }
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

    /* Non-SSE: edge did not stream — often means timeout or buffered full response */
    if (!ctype.includes('text/event-stream')) {
      const json = await res.json().catch(function () { return {}; });
      if (!res.ok || json.error) {
        const msg = friendlyHttpError(res.status, json.error || json.message || '');
        aiLog('error', '✗ ' + msg);
        aiAutoHide();
        throw new Error(msg);
      }
      /* still deliver text if present, but log that stream failed */
      const text = json.text || json.content || '';
      aiLog('warn', '⚠ پاسخ غیر‌استریمی از Edge (ممکن است نزدیک timeout باشد)');
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
    const ret = await chatStream({
      messages: opts.messages,
      model: opts.model,
      provider: opts.provider,
      temperature: opts.temperature,
      max_tokens: opts.max_tokens,
      signal: opts.signal,
      onToken: function (t) { full += t || ''; },
      onDone: function () {}
    });
    return ret || full;
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
      provider: opts.provider,
      temperature: opts.temperature != null ? opts.temperature : 0.3,
      max_tokens: opts.max_tokens != null ? opts.max_tokens : 1200,
      signal: opts.signal
    });
  }

  function sanitizeJsonCandidate(str) {
    if (!str) return str;
    var s = String(str);
    /* quotes رایج مدل‌ها */
    s = s.replace(/[\u201c\u201d\u00ab\u00bb]/g, '"').replace(/[\u2018\u2019]/g, "'");
    /* trailing commas قبل } یا ] */
    s = s.replace(/,\s*([}\]])/g, '$1');
    /* حذف BOM و کاراکترهای کنترل به‌جز newline/tab */
    s = s.replace(/^\uFEFF/, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    return s.trim();
  }

  function tryParseJson(str) {
    var candidates = [str, sanitizeJsonCandidate(str)];
    for (var i = 0; i < candidates.length; i++) {
      try { return JSON.parse(candidates[i]); } catch (e) {}
    }
    return null;
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
      var parsed = tryParseJson(inner);
      if (!parsed) {
        const fb = inner.search(/[\{\[]/);
        const lb = Math.max(inner.lastIndexOf('}'), inner.lastIndexOf(']'));
        if (fb >= 0 && lb > fb) parsed = tryParseJson(inner.slice(fb, lb + 1));
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
    var parsed2 = tryParseJson(trimmed.slice(fb, lb + 1));
    return { parsed: parsed2, before: before, after: after, raw: original };
  }

  var lastRawResponse = '';

  function parseJSONResponse(raw) {
    lastRawResponse = raw == null ? '' : String(raw);
    return extractJsonAndText(raw).parsed;
  }

  function getLastRawResponse() {
    return lastRawResponse;
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
    modelMetaById: modelMetaById,
    resolveProvider: resolveProvider,
    isDefaultModel: isDefaultModel,
    resetModel: resetModel,
    getLastUsedModel: getLastUsedModel,
    clearLastUsedModel: clearLastUsedModel,
    chatStream: chatStream,
    chat: chat,
    chatJSON: chatJSON,
    confirmPrompt: confirmPrompt,
    formatMessagesPreview: formatMessagesPreview,
    abort: abort,
    testConnection: testConnection,
    extractJsonAndText: extractJsonAndText,
    parseJSONResponse: parseJSONResponse,
    getLastRawResponse: getLastRawResponse
  };
})();