const OR_BASE = 'https://openrouter.ai/api/v1';

export class OpenRouterError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'OpenRouterError';
    Object.assign(this, details);
  }
  toDisplay() {
    const parts = [this.message];
    if (this.provider) parts.push(`provider: ${this.provider}`);
    if (this.status) parts.push(`status: ${this.status}`);
    return parts.join(' · ');
  }
}

export async function fetchModels() {
  let res;
  try {
    res = await fetch(`${OR_BASE}/models`, {
      headers: { 'Accept': 'application/json' }
    });
  } catch (e) {
    throw new OpenRouterError('Network error fetching OpenRouter models', {
      stage: 'fetch-models', cause: e
    });
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let json = null;
    try { json = JSON.parse(text); } catch {}
    throw new OpenRouterError(json?.error?.message || `Models endpoint HTTP ${res.status}`, {
      stage: 'fetch-models',
      status: res.status,
      body: text,
      parsed: json,
      provider: json?.error?.metadata?.provider_name || null
    });
  }
  let json;
  try { json = await res.json(); }
  catch (e) {
    throw new OpenRouterError('Failed to parse models response', {
      stage: 'parse-models', cause: e
    });
  }
  return Array.isArray(json?.data) ? json.data : [];
}

export function isFreeModel(m) {
  if (!m) return false;
  const id = String(m.id || '');
  if (id.endsWith(':free')) return true;
  const p = m.pricing;
  if (!p) return false;
  const toNum = v => v == null ? 0 : parseFloat(v);
  const promptZero = toNum(p.prompt) === 0;
  const completionZero = toNum(p.completion) === 0;
  const requestZero = p.request == null || toNum(p.request) === 0;
  return promptZero && completionZero && requestZero;
}

export function normalizeModel(m) {
  const id = String(m.id || '');
  const vendor = id.split('/')[0] || 'unknown';
  const ctx = m.context_length || m.top_provider?.context_length || 0;
  const modalities = [];
  if (m.architecture?.input_modalities) modalities.push(...m.architecture.input_modalities);
  if (m.architecture?.output_modalities) modalities.push(...m.architecture.output_modalities);
  if (m.architecture?.modality) modalities.push(...String(m.architecture.modality).split('->').join(' ').split('+'));
  const tags = [...new Set(modalities.map(s => String(s).trim().toLowerCase()).filter(Boolean))];
  return {
    id,
    label: m.name || id,
    vendor,
    size: '',
    context: String(ctx),
    speed: '',
    note: m.description || '',
    tags: tags.join(','),
    recommended: false,
    best_for: '',
    is_free: isFreeModel(m),
    source: 'openrouter-api',
    fetched_at: new Date().toISOString(),
    active: true
  };
}

export function filterFreeModels(rawModels) {
  return rawModels.filter(isFreeModel).map(normalizeModel);
}

export async function* streamChat({
  apiKey,
  model,
  messages,
  temperature,
  maxTokens,
  signal,
  onModelResolved
}) {
  if (!apiKey) {
    throw new OpenRouterError('OpenRouter API key is missing. Open Settings to add one.', {
      stage: 'auth'
    });
  }

  const body = {
    model,
    messages: messages.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : String(m.content || '')
    })),
    stream: true
  };
  if (typeof temperature === 'number' && !isNaN(temperature)) {
    body.temperature = Math.max(0, Math.min(2, temperature));
  }
  if (typeof maxTokens === 'number' && maxTokens > 0) {
    body.max_tokens = maxTokens;
  }

  let res;
  try {
    res = await fetch(`${OR_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'HTTP-Referer': (typeof location !== 'undefined' ? location.origin : '') + '/',
        'X-Title': 'Nebula Chat'
      },
      body: JSON.stringify(body),
      signal
    });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw new OpenRouterError('Network error contacting OpenRouter', {
      stage: 'fetch-chat', cause: e
    });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let json = null;
    try { json = JSON.parse(text); } catch {}
    const provider = json?.error?.metadata?.provider_name
      || json?.provider
      || null;
    const code = json?.error?.code ?? null;
    throw new OpenRouterError(
      json?.error?.message || `HTTP ${res.status} ${res.statusText}`,
      {
        stage: 'chat-completion',
        status: res.status,
        body: text,
        parsed: json,
        provider,
        code
      }
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let finished = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      let idx;
      while ((idx = buf.indexOf('\n')) !== -1) {
        let line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        line = line.replace(/\r$/, '');
        if (!line) continue;
        if (line.startsWith(':')) continue;
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') {
          finished = true;
          return;
        }
        let data;
        try { data = JSON.parse(payload); }
        catch { continue; }

        if (data.error) {
          throw new OpenRouterError(
            data.error.message || 'Provider stream error',
            {
              stage: 'stream-error',
              provider: data.error?.metadata?.provider_name || data.provider || null,
              raw: data
            }
          );
        }

        const choice = data.choices?.[0];
        const usedModel = data.model;
        if (usedModel && typeof onModelResolved === 'function') {
          try { onModelResolved(usedModel); } catch {}
        }
        if (!choice) continue;
        const delta = choice.delta?.content || choice.message?.content || '';
        if (delta) yield { delta, model: usedModel || null };
        if (choice.finish_reason && choice.finish_reason !== 'stop') {
          yield { delta: '', model: usedModel || null, finishReason: choice.finish_reason };
        }
      }
    }
  } finally {
    if (!finished) {
      try { await reader.cancel(); } catch {}
    }
    try { reader.releaseLock(); } catch {}
  }
}

export async function validateKey(apiKey) {
  if (!apiKey) {
    throw new OpenRouterError('No API key provided', { stage: 'auth' });
  }
  let res;
  try {
    res = await fetch(`${OR_BASE}/key`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (e) {
    throw new OpenRouterError('Network error validating key', {
      stage: 'validate-key', cause: e
    });
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  if (!res.ok) {
    throw new OpenRouterError(
      json?.error?.message || `HTTP ${res.status}`,
      {
        stage: 'validate-key',
        status: res.status,
        body: text,
        parsed: json
      }
    );
  }
  return json?.data || json || { valid: true };
}

export async function fetchModelById(id) {
  const all = await fetchModels();
  return all.find(m => m.id === id) || null;
}
