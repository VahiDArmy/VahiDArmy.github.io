// OpenRouter client: free model catalog, request construction, SSE streaming.
import { AUTO_MODEL, CHAT_ENDPOINT, MODELS_ENDPOINT } from './config.js';

export class OpenRouterError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'OpenRouterError';
    this.status = status;
    this.details = details;
  }
}

function headers(key) {
  const h = {
    'Content-Type': 'application/json',
    'HTTP-Referer': typeof location !== 'undefined' ? location.origin : 'https://localhost',
    'X-Title': 'Nebula AI Studio',
  };
  if (key) h.Authorization = `Bearer ${key}`;
  return h;
}

export function redactKey(key) {
  if (!key) return '';
  const tail = key.slice(-4);
  return `sk-or-v1-••••••••••••${tail}`;
}

export function redactedHeaders(key) {
  const h = headers(key ? 'REDACTED' : '');
  if (h.Authorization) h.Authorization = `Bearer ${redactKey(key)}`;
  return h;
}

const isZeroPrice = (v) => {
  const n = Number.parseFloat(v ?? '0');
  return !Number.isFinite(n) || n === 0;
};

export function normalizeFreeModel(raw) {
  if (!raw || !raw.id) return null;
  const pricing = raw.pricing || {};
  const free = isZeroPrice(pricing.prompt) && isZeroPrice(pricing.completion);
  if (!free) return null;
  return {
    model_id: raw.id,
    name: raw.name || raw.id,
    description: raw.description || '',
    context_length: raw.context_length || raw.top_provider?.context_length || 0,
    pricing,
    architecture: raw.architecture || null,
    supported_parameters: raw.supported_parameters || [],
  };
}

/** Fetch the public OpenRouter catalog and keep only zero-cost models. */
export async function fetchFreeModels(key) {
  const res = await fetch(MODELS_ENDPOINT, {
    headers: headers(key),
    method: 'GET',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new OpenRouterError(`Could not load the model catalog (HTTP ${res.status})`, res.status, text);
  }
  const json = await res.json();
  const list = Array.isArray(json.data) ? json.data : [];
  const free = [];
  for (const raw of list) {
    const norm = normalizeFreeModel(raw);
    if (norm) free.push(norm);
  }
  free.sort((a, b) => a.name.localeCompare(b.name));
  return { all: list.length, free };
}

/**
 * Build the exact payload that will be POSTed to OpenRouter.
 * Stored on each assistant message so the inspector can show it verbatim.
 */
export function buildRequestBody({ model, messages, settings, conversationParams }) {
  const s = { ...settings, ...(conversationParams || {}) };
  const body = {
    model: model || AUTO_MODEL,
    messages,
    stream: s.stream !== false,
    usage: { include: true },
  };

  if (s.temperature !== undefined && s.temperature !== null) {
    body.temperature = Number(s.temperature);
  }
  if (s.topP !== undefined && s.topP !== null) body.top_p = Number(s.topP);
  if (s.maxTokens) body.max_tokens = Math.round(Number(s.maxTokens));
  if (!body.stream) delete body.usage;

  const effort = s.reasoningEffort;
  if (effort && effort !== 'auto' && effort !== 'off') {
    body.reasoning = { effort };
  } else if (effort === 'off') {
    body.reasoning = { enabled: false };
  }

  return body;
}

export async function streamChat({ key, body, signal, onContent, onReasoning, onMeta, onUsage, onRaw }) {
  if (!key) throw new OpenRouterError('Add your OpenRouter API key in Settings → API key.', 401);

  const res = await fetch(CHAT_ENDPOINT, {
    method: 'POST',
    headers: headers(key),
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = `OpenRouter returned HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(text);
      message = parsed?.error?.message || parsed?.message || message;
    } catch {
      if (text) message = `${message} — ${text.slice(0, 400)}`;
    }
    throw new OpenRouterError(message, res.status, text);
  }

  if (!body.stream) {
    const json = await res.json();
    const choice = json?.choices?.[0];
    const message = choice?.message || {};
    onMeta?.({ model: json?.model || body.model, id: json?.id, finishReason: choice?.finish_reason });
    if (message.reasoning) onReasoning?.(message.reasoning);
    if (message.content) onContent?.(message.content);
    if (json?.usage) onUsage?.(json.usage);
    onRaw?.(JSON.stringify(json));
    return;
  }

  if (!res.body) throw new OpenRouterError('Streaming is not available in this browser.', 0);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let done = false;

  while (!done) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex;
    while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line || line.startsWith(':')) continue;
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') {
        done = true;
        break;
      }
      onRaw?.(data);
      let json;
      try {
        json = JSON.parse(data);
      } catch {
        continue;
      }
      if (json.error) {
        throw new OpenRouterError(json.error.message || 'The model failed to respond', 0, json.error);
      }
      if (json.model) onMeta?.({ model: json.model, id: json.id });
      if (json.usage) onUsage?.(json.usage);

      const choice = json.choices && json.choices[0];
      if (!choice) continue;
      if (choice.finish_reason) onMeta?.({ finishReason: choice.finish_reason });
      const delta = choice.delta || {};
      if (delta.content) onContent?.(delta.content);
      const reasoning =
        (typeof delta.reasoning === 'string' && delta.reasoning) ||
        (typeof delta.reasoning_content === 'string' && delta.reasoning_content) ||
        '';
      if (reasoning) {
        onReasoning?.(reasoning);
      } else if (Array.isArray(delta.reasoning_details)) {
        let text = '';
        for (const item of delta.reasoning_details) {
          if (item && typeof item.text === 'string') text += item.text;
        }
        if (text) onReasoning?.(text);
      }
    }
    if (done) break;
  }
}

/** One-shot completion used for auto titles. */
export async function completeOnce({ key, body, signal }) {
  const res = await fetch(CHAT_ENDPOINT, {
    method: 'POST',
    headers: headers(key),
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new OpenRouterError(`Title request failed (HTTP ${res.status})`, res.status, text);
  }
  const json = await res.json();
  return {
    text: json?.choices?.[0]?.message?.content || '',
    model: json?.model || body.model,
    usage: json?.usage || null,
  };
}

export function asOpenRouterError(error) {
  if (error instanceof OpenRouterError) return error;
  if (error?.name === 'AbortError') return error;
  return new OpenRouterError(error?.message || 'Network request failed', 0, error);
}
