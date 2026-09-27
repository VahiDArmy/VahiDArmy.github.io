/* =========================================================
   کلاینت OpenRouter با پشتیبانی از Streaming + لاگ زنده
   ========================================================= */
window.AI = (function () {
  const STORAGE_KEY = 'cinema_openrouter_key';
  const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
  const MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';

  let abortController = null;

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

  function headers() {
    return {
      'Authorization': `Bearer ${getKey()}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': location.origin,
      'X-Title': 'Cinema App'
    };
  }

  /* ---- لاگ ایمن ---- */
  function aiLog(level, msg) {
    if (window.AILog && typeof AILog[level] === 'function') {
      try { AILog[level](msg); } catch {}
    }
  }
  function aiShow() { if (window.AILog) try { AILog.show(); } catch {} }
  function aiAutoHide() { if (window.AILog) try { AILog.scheduleAutoHide(); } catch {} }

  /* ---- استریم چت ---- */
  async function chatStream({ messages, model, temperature, onToken, onDone, signal }) {
    if (!isConfigured()) throw new Error('کلید OpenRouter تنظیم نشده است.');
    abortController = new AbortController();
    const combinedSignal = signal || abortController.signal;

    const modelName = model || MODEL;
    const t0 = performance.now();

    aiShow();
    aiLog('request', `▸ درخواست استریم به OpenRouter ارسال شد`);
    aiLog('meta', `مدل: ${modelName}`);
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
        aiLog('warn', `⊘ درخواست توسط کاربر لغو شد`);
      } else {
        aiLog('error', `✗ خطای شبکه: ${netErr.message}`);
      }
      aiAutoHide();
      throw netErr;
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      aiLog('error', `✗ پاسخ ناموفق: HTTP ${res.status}`);
      aiLog('meta', txt.slice(0, 180));
      aiAutoHide();
      throw new Error(`خطای OpenRouter (${res.status}): ${txt.slice(0, 400)}`);
    }

    aiLog('success', `✓ اتصال برقرار شد (HTTP ${res.status})`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    let firstChunk = true;
    let chunkCount = 0;
    let lastLogLen = 0;
    let lastLogTime = performance.now();

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
            const now = performance.now();
            if (full.length - lastLogLen >= 400) {
              lastLogLen = full.length;
              lastLogTime = now;
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

    onDone && onDone(full);
    return full;
  }

  /* ---- چت بدون استریم (JSON) ---- */
  async function chatJSON({ messages, model, temperature, signal }) {
    if (!isConfigured()) throw new Error('کلید OpenRouter تنظیم نشده است.');
    abortController = new AbortController();
    const combinedSignal = signal || abortController.signal;

    const modelName = model || MODEL;
    const t0 = performance.now();

    aiShow();
    aiLog('request', `▸ درخواست JSON به OpenRouter ارسال شد`);
    aiLog('meta', `مدل: ${modelName} · پیام‌ها: ${messages.length}`);

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
        aiLog('warn', `⊘ درخواست لغو شد`);
      } else {
        aiLog('error', `✗ خطای شبکه: ${netErr.message}`);
      }
      aiAutoHide();
      throw netErr;
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      aiLog('error', `✗ پاسخ ناموفق: HTTP ${res.status}`);
      aiLog('meta', txt.slice(0, 180));
      aiAutoHide();
      throw new Error(`خطای OpenRouter (${res.status}): ${txt.slice(0, 400)}`);
    }

    aiLog('success', `✓ اتصال برقرار شد`);

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content || '';
    const dt = ((performance.now() - t0) / 1000).toFixed(1);
    const usage = json.usage || {};

    aiLog('success', `✓ پاسخ دریافت شد · ${content.length} کاراکتر · ${dt}s`);
    if (usage.prompt_tokens || usage.completion_tokens) {
      aiLog('meta', `tokens: ${usage.prompt_tokens || 0} → ${usage.completion_tokens || 0}`);
    }
    aiAutoHide();

    return content;
  }

  function abort() {
    if (abortController) {
      try { abortController.abort(); } catch {}
      abortController = null;
    }
  }

  /* ---- پارس امن JSON از پاسخ مدل ---- */
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

  return { getKey, setKey, isConfigured, chatStream, chatJSON, abort, parseJSONResponse };
})();