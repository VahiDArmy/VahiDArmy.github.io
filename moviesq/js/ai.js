/* =========================================================
   کلاینت AI — دو مسیر موازی (edge + direct)
   ---------------------------------------------------------
   edge   (پیش‌فرض): Edge Function «movies-quran»
          Secrets سرور: GEM_MALI + OPENROUTER_API_KEY
   direct: OpenRouter مستقیم از مرورگر با کلید محلی
          (cinema_openrouter_key) — streaming SSE، temperature،
          max_tokens، abort، thinking callback، error handling

   هیچ مسیر موجودی حذف نشده. انتخاب با getMode()/setMode().
   مدل‌های provider=google همچنان از edge می‌روند.
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

  const KEY_STORAGE = (CONFIG.AI && CONFIG.AI.STORAGE_KEY) || 'cinema_openrouter_key';
  const MODE_STORAGE = 'cinema_ai_mode'; /* 'edge' | 'direct' */

  function getKey() {
    try {
      const k = localStorage.getItem(KEY_STORAGE);
      return k && String(k).trim() ? String(k).trim() : '';
    } catch (e) { return ''; }
  }
  function setKey(key) {
    try {
      if (key && String(key).trim()) localStorage.setItem(KEY_STORAGE, String(key).trim());
      else localStorage.removeItem(KEY_STORAGE);
    } catch (e) {}
  }
  function getMode() {
    try {
      const m = localStorage.getItem(MODE_STORAGE);
      if (m === 'direct' || m === 'edge') return m;
    } catch (e) {}
    return getKey() ? 'direct' : 'edge';
  }
  function setMode(mode) {
    try {
      localStorage.setItem(MODE_STORAGE, mode === 'direct' ? 'direct' : 'edge');
    } catch (e) {}
  }
  function isConfigured() {
    if (getMode() === 'edge') return true;
    return !!getKey();
  }
  function maskKey(k) {
    k = k || getKey();
    if (!k || k.length < 12) return '••••';
    return k.slice(0, 6) + '…' + k.slice(-4);
  }

  function getModels() {
    try { return DB.getAiModels(); } catch (e) { return []; }
  }

  function getModel() {
    try {
      var stored = localStorage.getItem(MODEL_KEY);
      var id = stored && String(stored).trim() ? String(stored).trim() : DEFAULT_MODEL;
      /* مدل غیرفعال را برای درخواست استفاده نکن */
      try {
        var models = getModels();
        var found = models.filter(function (m) { return m.id === id; })[0];
        if (found && found.active === false) {
          var alt = models.filter(function (m) { return m.active !== false; })[0];
          if (alt && alt.id) {
            id = alt.id;
            try { localStorage.setItem(MODEL_KEY, id); } catch (e2) {}
          } else if (DEFAULT_MODEL) {
            id = DEFAULT_MODEL;
          }
        }
      } catch (e3) {}
      return id;
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
    if (status === 401 || status === 403) return 'دسترسی به هوش مصنوعی مجاز نیست.';
    if (status === 429) return 'محدودیت نرخ — کمی بعد دوباره تلاش کن.';
    if (status === 502 || /Provider returned error/i.test(msg)) {
      return 'سرویس هوش مصنوعی خطا داد؛ دوباره تلاش کن یا مدل دیگری را انتخاب کن.';
    }
    /* Supabase Edge: 546 = worker killed (often WallClockTime) */
    if (status === 546 || status === 504 || /504|546|timeout|timed out|WallClock|Gateway/i.test(msg)) {
      return 'پاسخ‌دهی هوش مصنوعی بیش از حد طول کشید؛ دوباره تلاش کن یا مدل دیگری را انتخاب کن.';
    }
    if (msg) return msg;
    return 'خطای سرور؛ کمی بعد دوباره تلاش کن.';
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


  function applyResolvedModel(resolvedId, requestedId) {
    if (!resolvedId || typeof resolvedId !== 'string') return;
    const id = String(resolvedId).trim();
    if (!id) return;
    const requested = requestedId ? String(requestedId).trim() : '';
    const meta = modelMetaById(id) || {};
    const reqMeta = requested ? (modelMetaById(requested) || {}) : {};
    var pretty = meta.label || id;
    if (!meta.label && id && id.indexOf('/') >= 0) {
      /* openrouter/free → keep; vendor/model:free → readable */
      pretty = id.replace(/:free$/i, ' (free)');
    }
    lastUsedModel = {
      id: id,
      label: pretty,
      vendor: meta.vendor || (id.indexOf('/') >= 0 ? id.split('/')[0] : ''),
      provider: meta.provider || resolveProvider(id),
      meta: { size: meta.size, context: meta.context, speed: meta.speed },
      requested_id: requested || (lastUsedModel && lastUsedModel.id) || '',
      requested_label: reqMeta.label || requested || '',
      auto_routed: !!(requested && id && requested !== id),
      at: new Date().toISOString()
    };
    if (requested && id !== requested) {
      aiLog('info', '↳ مدل واقعی: ' + id + (reqMeta.label || requested ? ' (درخواست: ' + (reqMeta.label || requested) + ')' : ''));
    }
    try {
      document.dispatchEvent(new CustomEvent('cinema:model-resolved', { detail: lastUsedModel }));
    } catch (e) {}
  }


  /* ── Direct OpenRouter helpers (aligned with meraj request shape) ────── */
  /**
   * Browser fetch rejects header values outside ISO-8859-1.
   * Never put Persian / emoji / non-Latin-1 text in headers.
   */
  function asciiHeader(value, fallback) {
    var s = value == null ? '' : String(value);
    if (!s) return fallback || '';
    /* strip anything outside Latin-1 */
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c <= 0xff) out += s.charAt(i);
    }
    out = out.replace(/[\r\n]/g, ' ').trim();
    return out || (fallback || '');
  }

  function directHeaders(apiKey) {
    var referer = 'https://localhost';
    try {
      if (typeof location !== 'undefined' && location.origin) referer = location.origin;
    } catch (e) {}
    /* OpenRouter expects these two identity headers; keep them ASCII like meraj. */
    var title = 'Cinema';
    try {
      if (CONFIG.AI && CONFIG.AI.OPENROUTER_TITLE) title = CONFIG.AI.OPENROUTER_TITLE;
    } catch (e2) {}
    var headers = {
      'Content-Type': 'application/json',
      'HTTP-Referer': asciiHeader(referer, 'https://localhost'),
      'X-Title': asciiHeader(title, 'Cinema')
    };
    if (apiKey) headers['Authorization'] = 'Bearer ' + asciiHeader(apiKey, '');
    return headers;
  }

  function shouldUseDirect(provider, opts) {
    if (opts && opts.forceEdge) return false;
    if (opts && opts.forceDirect) return true;
    if (getMode() !== 'direct') return false;
    if (provider === 'google') return false;
    return !!getKey();
  }

  /**
   * Extract reasoning text from an OpenRouter/OpenAI delta (meraj-compatible).
   * Models may send: string, reasoning_details[], or reasoning[].
   */
  function reasoningFromDelta(delta) {
    if (!delta) return '';
    if (typeof delta.reasoning === 'string' && delta.reasoning) return delta.reasoning;
    if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) return delta.reasoning_content;
    if (Array.isArray(delta.reasoning_details)) {
      return delta.reasoning_details
        .map(function (d) { return (d && (d.text || d.summary || d.content)) || ''; })
        .filter(Boolean)
        .join('');
    }
    if (Array.isArray(delta.reasoning)) {
      return delta.reasoning
        .map(function (item) { return (item && (item.text || item.content)) || ''; })
        .filter(Boolean)
        .join('');
    }
    return '';
  }

  function textFromContent(content) {
    if (content == null) return '';
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content.map(function (part) {
        if (typeof part === 'string') return part;
        if (part && typeof part.text === 'string') return part.text;
        if (part && part.type === 'text' && typeof part.text === 'string') return part.text;
        return '';
      }).join('');
    }
    return '';
  }

  /**
   * reader.read() can hang forever when the phone sleeps / tab backgrounds /
   * network drops without closing the socket. Race each read against a stall timer.
   */
  function readChunkWithStall(reader, stallMs, signal) {
    stallMs = stallMs || 120000;
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        var err = new Error('اتصال استریم قطع شد یا خیلی طول کشید (بدون دادهٔ جدید).');
        err.code = 'STREAM_STALL';
        try { reader.cancel(); } catch (e) {}
        reject(err);
      }, stallMs);

      function finish(fn, arg) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(arg);
      }

      reader.read().then(
        function (v) { finish(resolve, v); },
        function (e) { finish(reject, e); }
      );

      if (signal) {
        var onAbort = function () {
          var err = new Error('لغو شد');
          err.name = 'AbortError';
          err.code = 'ABORTED';
          try { reader.cancel(); } catch (e2) {}
          finish(reject, err);
        };
        if (signal.aborted) onAbort();
        else signal.addEventListener('abort', onAbort, { once: true });
      }
    });
  }

  function installDisconnectGuards(abortCtrl) {
    if (!abortCtrl || typeof document === 'undefined') return function () {};
    var hiddenTimer = null;
    var cleaned = false;

    function abortWith(code, message) {
      if (cleaned || abortCtrl.signal.aborted) return;
      try {
        aiLog('warn', '⚠ ' + message);
      } catch (e) {}
      try {
        abortCtrl.abort();
      } catch (e2) {}
    }

    function onVisibility() {
      if (document.hidden) {
        /* Mobile Chrome often freezes the network after ~30–60s in background */
        hiddenTimer = setTimeout(function () {
          abortWith('BACKGROUND', 'صفحه در پس‌زمینه ماند؛ استریم قطع شد. دوباره اجرا یا «ادامه» بزن.');
        }, 45000);
      } else if (hiddenTimer) {
        clearTimeout(hiddenTimer);
        hiddenTimer = null;
      }
    }
    function onOffline() {
      abortWith('OFFLINE', 'اتصال اینترنت قطع شد.');
    }
    function onPageHide() {
      abortWith('PAGEHIDE', 'صفحه بسته یا معلق شد؛ استریم قطع شد.');
    }

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('offline', onOffline);
    window.addEventListener('pagehide', onPageHide);

    return function cleanupGuards() {
      if (cleaned) return;
      cleaned = true;
      if (hiddenTimer) clearTimeout(hiddenTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('pagehide', onPageHide);
    };
  }

  /**
   * OpenAI-compatible SSE stream against OpenRouter.
   * Supports onToken, onThinking, temperature, max_tokens, abort.
   * Reasoning: meraj-style extraction + optional include_reasoning.
   * Disconnect / background / stall recovery built-in.
   */
  async function streamOpenRouter(opts) {
    const apiKey = getKey();
    if (!apiKey) {
      const err = new Error('کلید OpenRouter روی این دستگاه ذخیره نشده است.');
      err.code = 'NO_API_KEY';
      throw err;
    }

    const requestedModel = resolveModel(opts.model);
    let model = requestedModel;
    applyResolvedModel(requestedModel, requestedModel);
    const temperature = opts.temperature != null ? opts.temperature : 0.5;
    const max_tokens = opts.max_tokens != null ? opts.max_tokens : undefined;
    const messages = opts.messages || [];
    const onToken = opts.onToken || function () {};
    const onDone = opts.onDone || function () {};
    const combined = opts.signal || (abortController && abortController.signal);

    const body = {
      model: model,
      messages: messages,
      temperature: temperature,
      stream: true
    };
    if (max_tokens != null && max_tokens > 0) body.max_tokens = max_tokens;
    /* Ask providers that support it to return reasoning (OpenRouter / o-series style). */
    if (opts.reasoning != null) body.reasoning = opts.reasoning;
    if (opts.include_reasoning !== false) body.include_reasoning = true;

    aiLog('info', '▸ Direct · ' + model +
      (temperature != null ? ' · T=' + temperature : '') +
      (max_tokens ? ' · max=' + max_tokens : ''));

    let res;
    try {
      res = await fetch((CONFIG.AI && CONFIG.AI.API_URL) || 'https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: directHeaders(apiKey),
        body: JSON.stringify(body),
        signal: combined
      });
    } catch (netErr) {
      if (netErr.name === 'AbortError') aiLog('warn', '⊘ لغو شد (direct)');
      else aiLog('error', '✗ شبکه (direct): ' + netErr.message);
      throw netErr;
    }

    if (!res.ok) {
      let detail = '';
      try {
        const j = await res.json();
        detail = (j.error && (j.error.message || j.error)) || j.message || '';
      } catch (e) {}
      const msg = friendlyHttpError(res.status, detail);
      aiLog('error', '✗ ' + msg);
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }

    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    if (!ctype.includes('text/event-stream') && !ctype.includes('stream')) {
      const json = await res.json().catch(function () { return {}; });
      const msg = (json.choices && json.choices[0] && json.choices[0].message) || {};
      const text = textFromContent(msg.content) || json.content || json.text || '';
      const think = reasoningFromDelta(msg) || (typeof msg.reasoning === 'string' ? msg.reasoning : '');
      if (json.model) {
        model = String(json.model).trim();
        applyResolvedModel(model, requestedModel);
      }
      if (think && opts.onThinking) opts.onThinking(think, think);
      if (text) onToken(text);
      onDone(text, { reasoning: think || null, finishReason: 'stop', model: model });
      aiLog('success', '✓ پاسخ یک‌جا (direct) · ' + text.length + ' کاراکتر' +
        (think ? ' · reasoning ' + think.length : '') +
        (model && model !== requestedModel ? ' · ' + model : ''));
      return text;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    let reasoning = '';
    let finishReason = null;
    const stallMs = (opts.stallMs != null) ? opts.stallMs : 150000;
    /* Ensure we own an AbortController so background guards can stop the stream */
    if (!abortController || abortController.signal.aborted) {
      abortController = new AbortController();
    }
    const guardSignal = combined || abortController.signal;
    const cleanupGuards = installDisconnectGuards(abortController);

    try {
    while (true) {
      const { value, done } = await readChunkWithStall(reader, stallMs, guardSignal);
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith(':')) continue;
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === '[DONE]') {
          if (raw === '[DONE]') finishReason = finishReason || 'stop';
          continue;
        }
        try {
          const obj = JSON.parse(raw);
          if (obj.error) {
            const msg = obj.error.message || String(obj.error);
            aiLog('error', '✗ ' + msg);
            throw new Error(msg);
          }
          if (obj.model && String(obj.model).trim()) {
            model = String(obj.model).trim();
            applyResolvedModel(model, requestedModel);
          }
          if (obj.provider) {
            /* keep provider note on lastUsedModel via applyResolvedModel meta if needed */
          }
          const choice = obj.choices && obj.choices[0];
          if (!choice) continue;
          if (choice.finish_reason) finishReason = choice.finish_reason;
          const delta = choice.delta || choice.message || {};
          const piece = textFromContent(delta.content);
          if (piece) {
            full += piece;
            onToken(piece);
          }
          const think = reasoningFromDelta(delta);
          if (think) {
            reasoning += think;
            if (opts.onThinking) opts.onThinking(think, reasoning);
          }
          /* Some providers put final reasoning on the message, not only deltas */
          if (choice.message) {
            const endThink = reasoningFromDelta(choice.message);
            if (endThink && endThink.length > reasoning.length) {
              const extra = endThink.slice(reasoning.length);
              reasoning = endThink;
              if (extra && opts.onThinking) opts.onThinking(extra, reasoning);
            }
          }
        } catch (parseErr) {
          if (parseErr.message && !/JSON|Unexpected/.test(parseErr.message)) throw parseErr;
        }
      }
    }

    if (model && model !== requestedModel) {
      applyResolvedModel(model, requestedModel);
      aiLog('info', '↳ مدل واقعی: ' + model + ' (درخواست: ' + requestedModel + ')');
    } else if (model) {
      applyResolvedModel(model, requestedModel);
    }
    aiLog('success', '✓ استریم direct · ' + full.length + ' کاراکتر' +
      (finishReason ? ' · ' + finishReason : '') +
      (model ? ' · ' + model : ''));
    onDone(full, { reasoning: reasoning || null, finishReason: finishReason, model: model });
    return full;
    } catch (streamErr) {
      if (streamErr && streamErr.name === 'AbortError') throw streamErr;
      if (streamErr && (streamErr.code === 'STREAM_STALL' || streamErr.code === 'BACKGROUND' || streamErr.code === 'OFFLINE' || streamErr.code === 'PAGEHIDE')) {
        streamErr.partial = full;
        streamErr.partialReasoning = reasoning;
        aiLog('warn', '⚠ قطع استریم · متن جزئی: ' + (full ? full.length + ' کاراکتر' : 'خالی'));
      }
      throw streamErr;
    } finally {
      try { cleanupGuards(); } catch (e) {}
    }
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

    /* Route: direct OpenRouter (when mode=direct + key) or existing edge */
    if (shouldUseDirect(provider, opts)) {
      try {
        const full = await streamOpenRouter({
          messages: messages,
          model: model,
          temperature: temperature,
          max_tokens: opts.max_tokens,
          signal: combined,
          onToken: onToken,
          onDone: onDone,
          onThinking: opts.onThinking,
          reasoning: opts.reasoning,
          include_reasoning: opts.include_reasoning
        });
        aiAutoHide();
        return full;
      } catch (e) {
        aiAutoHide();
        throw e;
      }
    }

    aiLog('info', '▸ Edge · ' + (provider === 'openrouter' ? 'OpenRouter' : 'Gemini') + ' · ' + model);

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
      if (json.model) applyResolvedModel(json.model, json.requested_model);
      aiLog('warn', '⚠ پاسخ به‌صورت یک‌جا دریافت شد');
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
    const stallMs = (opts.stallMs != null) ? opts.stallMs : 150000;
    if (!abortController || abortController.signal.aborted) {
      abortController = new AbortController();
    }
    const cleanupGuards = installDisconnectGuards(abortController);

    try {
    while (true) {
      const { value, done } = await readChunkWithStall(reader, stallMs, combined);
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
          if (obj.model) applyResolvedModel(obj.model, obj.requested_model);
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
    } catch (streamErr) {
      if (streamErr && streamErr.name === 'AbortError') throw streamErr;
      if (streamErr && streamErr.code === 'STREAM_STALL') {
        streamErr.partial = full;
        aiLog('warn', '⚠ قطع استریم edge · جزئی: ' + (full ? full.length + ' کاراکتر' : 'خالی'));
      }
      throw streamErr;
    } finally {
      try { cleanupGuards(); } catch (e) {}
    }
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
    getMode: getMode,
    setMode: setMode,
    maskKey: maskKey,
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