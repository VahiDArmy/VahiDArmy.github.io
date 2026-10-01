/* =========================================================
   کلاینت OpenRouter با پشتیبانی از Streaming
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

  /* ---- استریم چت ---- */
  async function chatStream({ messages, model, temperature, onToken, onDone, signal }) {
    if (!isConfigured()) throw new Error('کلید OpenRouter تنظیم نشده است.');
    abortController = new AbortController();
    const combinedSignal = signal || abortController.signal;

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        model: model || MODEL,
        messages,
        stream: true,
        temperature: temperature ?? 0.5
      }),
      signal: combinedSignal
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`خطای OpenRouter (${res.status}): ${txt.slice(0, 400)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';

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
            onToken && onToken(delta, full);
          }
        } catch {}
      }
    }

    onDone && onDone(full);
    return full;
  }

  /* ---- چت بدون استریم (برای JSON) ---- */
  async function chatJSON({ messages, model, temperature, signal }) {
    if (!isConfigured()) throw new Error('کلید OpenRouter تنظیم نشده است.');
    abortController = new AbortController();
    const combinedSignal = signal || abortController.signal;

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        model: model || MODEL,
        messages,
        stream: false,
        temperature: temperature ?? 0.3,
        response_format: { type: 'json_object' }
      }),
      signal: combinedSignal
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`خطای OpenRouter (${res.status}): ${txt.slice(0, 400)}`);
    }

    const json = await res.json();
    return json.choices?.[0]?.message?.content || '';
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
    // حذف ```json ... ```
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    // پیدا کردن اولین { یا [
    const firstBrace = s.search(/[\{\[]/);
    if (firstBrace > 0) s = s.slice(firstBrace);
    // پیدا کردن آخرین } یا ]
    const lastBrace = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
    if (lastBrace > 0) s = s.slice(0, lastBrace + 1);
    try { return JSON.parse(s); } catch { return null; }
  }

  return { getKey, setKey, isConfigured, chatStream, chatJSON, abort, parseJSONResponse };
})();