/* =========================================================
   هستهٔ AI
   ---------------------------------------------------------
   ۱. مدل سایت: یک مدل برای کل سایت (روی هر دو صفحه)، ذخیره در cinema_meta
   ۲. استخر مدل‌ها: Google (یکی) + OpenRouter (رایگان‌ها، با همگام‌سازی)
   ۳. کلاینت: پرامپت در فرانت، اجرا روی Edge Function (movies-quran)
   ۴. بازخورد: هر مدل wins / losses / fails دارد (DB.recordAiOutcome)
   ========================================================= */
window.AI = (function () {
  const EDGE_URL = CONFIG.SUPABASE.URL + '/functions/v1/' + CONFIG.SUPABASE.EDGE_FUNCTION;
  const META_KEY = 'ai_model';
  const listeners = [];

  /* ======================= مدل سایت ======================= */
  function getModelId() {
    const stored = DB.getMeta(META_KEY) || localStorage.getItem(CONFIG.STORAGE.AI_MODEL);
    if (stored && DB.getAiModel(stored)) return stored;
    return CONFIG.AI.DEFAULT_MODEL;
  }

  function setModel(id) {
    if (!id) return;
    localStorage.setItem(CONFIG.STORAGE.AI_MODEL, id);
    DB.setMeta(META_KEY, id);
    listeners.forEach(function (cb) { try { cb(id); } catch (e) { console.error(e); } });
  }

  function onModelChange(cb) { listeners.push(cb); }

  /* اطلاعات مدل؛ اگر در دیتابیس نبود یک توصیف حداقلی */
  function modelInfo(id) {
    const m = DB.getAiModel(id);
    if (m) return m;
    return { id: id, label: id, vendor: '', provider: String(id).toLowerCase().indexOf('gemini') === 0 ? 'google' : 'openrouter', context: '' };
  }

  function getModel() { return modelInfo(getModelId()); }

  /* یک مدل تصادفی از مدل‌های فعال، به‌جز آن‌هایی که قبلاً امتحان شده‌اند */
  function pickRandom(excludeIds) {
    const skip = excludeIds instanceof Set ? excludeIds : new Set(excludeIds || []);
    const pool = DB.getActiveAiModels().filter(function (m) { return !skip.has(m.id); });
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /* ثبت بازخورد مدل؛ رویداد ai:stats برای به‌روزرسانی جدول‌ها */
  function record(id, outcome) {
    try { DB.recordAiOutcome(id, outcome); } catch (e) { console.error(e); }
    window.dispatchEvent(new CustomEvent('ai:stats', { detail: { id: id, outcome: outcome } }));
  }

  /* ======================= OpenRouter ======================= */
  function fmtContext(n) {
    n = Number(n) || 0;
    if (!n) return '';
    if (n >= 1e6) { const v = n / 1e6; return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + 'M'; }
    if (n >= 1e3) return Math.round(n / 1e3) + 'K';
    return String(n);
  }

  function isFree(m) {
    const p = m.pricing || {};
    return String(m.id || '').endsWith(':free') || (Number(p.prompt || 0) === 0 && Number(p.completion || 0) === 0);
  }

  function outputsText(m) {
    const out = m.architecture && m.architecture.output_modalities;
    return !Array.isArray(out) || out.indexOf('text') > -1;
  }

  /* همگام‌سازی: مدل‌های رایگان تازه به استخر اضافه می‌شوند؛
     مدل‌هایی که دیگر در فهرست رایگان OpenRouter نیستند غیرفعال می‌شوند (حذف نمی‌شوند). */
  async function syncOpenRouter() {
    const res = await fetch(CONFIG.AI.OPENROUTER_MODELS_URL, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('OpenRouter HTTP ' + res.status);
    const json = await res.json();
    const free = (Array.isArray(json.data) ? json.data : []).filter(isFree);
    const freeIds = new Set(free.map(function (m) { return m.id; }));

    const usable = free.filter(function (m) {
      return outputsText(m) &&
        (Number(m.context_length) || 0) >= CONFIG.AI.MIN_CONTEXT &&
        !CONFIG.AI.EXCLUDE_ID.test(m.id);
    }).map(function (m) {
      return {
        id: m.id,
        label: String(m.name || m.id).replace(/\s*\(free\)\s*$/i, ''),
        vendor: String(m.id).split('/')[0] || '',
        provider: 'openrouter',
        context: fmtContext(m.context_length)
      };
    });

    const added = await DB.addAiModels(usable);

    const gone = DB.getAiModels().filter(function (m) {
      return m.provider === 'openrouter' && m.active && !freeIds.has(m.id);
    });
    gone.forEach(function (m) { DB.setAiModelActive(m.id, false); });

    return { listed: usable.length, added: added, deactivated: gone.length };
  }

  /* ======================= کلاینت ======================= */
  function friendlyError(status, msg) {
    msg = msg || '';
    if (status === 504 || /504|timeout|timed out|Gateway/i.test(msg)) return 'زمان پاسخ تمام شد (۵۰۴)';
    if (status === 429 || /rate.?limit|quota|too many/i.test(msg)) return 'محدودیت نرخ درخواست (۴۲۹)';
    if (status === 502) return 'خطای واسط (۵۰۲)' + (msg ? ': ' + msg : '');
    if (status === 401 || status === 403) return 'دسترسی رد شد (' + status + ')';
    if (status === 404) return 'مدل پیدا نشد (۴۰۴)';
    if (status === 500 && /GEM_MALI|OPENROUTER_API_KEY|secret|misconfigured/i.test(msg)) return 'کلید روی سرور تنظیم نشده — ' + msg;
    return msg || ('خطای سرور (HTTP ' + status + ')');
  }

  /* اجرای استریم روی یک مدل مشخص. متن کامل را برمی‌گرداند.
     پاسخ خالی هم خطا حساب می‌شود. لغو (abort) خطای AbortError می‌دهد. */
  async function stream(opts) {
    const model = modelInfo(opts.model || getModelId());
    const onToken = opts.onToken || function () {};

    let res;
    try {
      res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: CONFIG.SUPABASE.ANON_KEY,
          Authorization: 'Bearer ' + CONFIG.SUPABASE.ANON_KEY
        },
        body: JSON.stringify({
          provider: model.provider,
          model: model.id,
          messages: opts.messages || [],
          temperature: opts.temperature != null ? opts.temperature : 0.5,
          stream: true
        }),
        signal: opts.signal
      });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      throw new Error('خطای شبکه: ' + e.message);
    }

    const ctype = (res.headers.get('content-type') || '').toLowerCase();

    /* پاسخ غیر SSE: یا خطا یا متن کامل */
    if (ctype.indexOf('text/event-stream') < 0) {
      const json = await res.json().catch(function () { return {}; });
      if (!res.ok || json.error) throw new Error(friendlyError(res.status, json.error || ''));
      const text = json.text || '';
      if (!text.trim()) throw new Error('پاسخ خالی');
      onToken(text, text);
      return text;
    }
    if (!res.ok) throw new Error(friendlyError(res.status, ''));

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', full = '', streamError = null;

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.indexOf('data:') !== 0) continue;
        const raw = line.slice(5).trim();
        if (!raw) continue;
        try {
          const obj = JSON.parse(raw);
          if (obj.error) { streamError = obj.error; continue; }
          if (typeof obj.text === 'string' && obj.text && !obj.done) {
            full += obj.text;
            onToken(obj.text, full);
          }
          if (obj.done && typeof obj.text === 'string' && obj.text.length > full.length) {
            full = obj.text;
            onToken('', full);
          }
        } catch (e) { /* خط ناقص */ }
      }
    }

    if (streamError) throw new Error(friendlyError(0, String(streamError)));
    if (!full.trim()) throw new Error('پاسخ خالی');
    return full;
  }

  /* بدون استریم به بیرون — فقط متن */
  function chat(opts) {
    return stream(Object.assign({}, opts, { onToken: function () {} }));
  }

  /* افزودن یادآوری JSON به آخرین پیام کاربر اگر خودش ذکر نکرده باشد */
  function withJsonHint(messages) {
    const ms = (messages || []).slice();
    if (ms.some(function (m) { return /json/i.test(m.content || ''); }) || !ms.length) return ms;
    const last = ms[ms.length - 1];
    if (last.role === 'user') ms[ms.length - 1] = { role: 'user', content: last.content + '\n\nپاسخ را فقط به‌صورت JSON معتبر برگردان.' };
    return ms;
  }

  /* ---------- استخراج JSON از پاسخ ---------- */
  function extractJsonAndText(raw) {
    if (!raw) return { parsed: null, before: '', after: '', raw: '' };
    const s = String(raw);

    function tryParse(txt) {
      try { return JSON.parse(txt); } catch (e) { /* ادامه */ }
      const fb = txt.search(/[\{\[]/);
      const lb = Math.max(txt.lastIndexOf('}'), txt.lastIndexOf(']'));
      if (fb >= 0 && lb > fb) { try { return JSON.parse(txt.slice(fb, lb + 1)); } catch (e) { /* ادامه */ } }
      return null;
    }

    const fenced = s.match(/```(?:json|JSON)?\s*\n?([\s\S]*?)```/);
    if (fenced && /[\{\[]/.test(fenced[1])) {
      return {
        parsed: tryParse(fenced[1].trim()),
        before: s.slice(0, fenced.index).trim(),
        after: s.slice(fenced.index + fenced[0].length).trim(),
        raw: s
      };
    }

    const t = s.trim();
    const fb = t.search(/[\{\[]/);
    const lb = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
    if (fb < 0 || lb < fb) return { parsed: null, before: s, after: '', raw: s };
    return { parsed: tryParse(t.slice(fb, lb + 1)), before: t.slice(0, fb).trim(), after: t.slice(lb + 1).trim(), raw: s };
  }

  function parseJSON(raw) { return extractJsonAndText(raw).parsed; }

  return {
    getModelId: getModelId, getModel: getModel, setModel: setModel, onModelChange: onModelChange,
    modelInfo: modelInfo, pickRandom: pickRandom, record: record,
    syncOpenRouter: syncOpenRouter,
    stream: stream, chat: chat, withJsonHint: withJsonHint,
    extractJsonAndText: extractJsonAndText, parseJSON: parseJSON
  };
})();
