// ============================================================================
// openrouter.js — SSE streaming chat completions client
// ============================================================================

import { OPENROUTER_CHAT, APP_NAME, APP_URL, AUTO_FREE_MODEL } from "./config.js";
import { getApiKey } from "./store.js";

// ---------------------------------------------------------------------------
// Public: build exact request body
// ---------------------------------------------------------------------------
export function buildPayload({ model, messages, temperature, top_p, max_tokens,
                              frequency_penalty, presence_penalty, stream,
                              include_reasoning, extra = {} }) {
  const body = {
    model,
    messages,
    stream: !!stream,
  };
  if (temperature != null) body.temperature = Number(temperature);
  if (top_p != null) body.top_p = Number(top_p);
  if (max_tokens != null) body.max_tokens = Number(max_tokens);
  if (frequency_penalty) body.frequency_penalty = Number(frequency_penalty);
  if (presence_penalty) body.presence_penalty = Number(presence_penalty);
  if (include_reasoning) body.reasoning = { effort: "medium" };
  Object.assign(body, extra || {});
  return body;
}

export function serialiseBody(body) {
  // Deliberately deterministic — this exact string is what gets sent and
  // also what gets shown to the user in the "Payload" viewer.
  return JSON.stringify(body);
}

export function buildHeaders({ requestId, apiKey }) {
  const key = apiKey || getApiKey() || "";
  const h = {
    "Content-Type": "application/json",
    "Accept": "text/event-stream",
    "HTTP-Referer": APP_URL,
    "X-Title": APP_NAME,
  };
  if (key) h["Authorization"] = `Bearer ${key}`;
  if (requestId) h["X-Request-Id"] = requestId;
  return h;
}

// ---------------------------------------------------------------------------
// SSE parser (OpenAI-compatible)
// ---------------------------------------------------------------------------
function parseSSEChunk(buffer) {
  const events = [];
  let idx = buffer.indexOf("\n\n");
  while (idx !== -1) {
    const raw = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 2);
    idx = buffer.indexOf("\n\n");
    const lines = raw.split("\n");
    let data = "";
    let eventName = "message";
    for (const line of lines) {
      if (line.startsWith(":")) continue;
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      else if (line.startsWith("data:")) data += (data ? "\n" : "") + line.slice(5).trimStart();
    }
    events.push({ event: eventName, data });
  }
  return { buffer, events };
}

// ---------------------------------------------------------------------------
// Error normalisation — we DO NOT swallow or rewrite provider errors.
// ---------------------------------------------------------------------------
function makeApiError(res, rawText, extra) {
  let parsed = null;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = null;
  }
  const err = new Error(
    (parsed && (parsed.error?.message || parsed.message)) ||
      `HTTP ${res ? res.status : "?"}`
  );
  err.httpStatus = res ? res.status : null;
  err.statusText = res ? res.statusText : "";
  err.detail = parsed;
  err.rawText = rawText;
  err.headers = res ? Object.fromEntries(res.headers.entries()) : {};
  Object.assign(err, extra || {});
  return err;
}

// ---------------------------------------------------------------------------
// The main streaming call.
//   onDelta({ content, reasoning, resolvedModel, provider, usage })
//   returns Promise<{ fullText, reasoning, resolvedModel, provider, usage, raw }>
// ---------------------------------------------------------------------------
export async function streamChat({
  payload,
  headers,
  signal,
  onMeta,
  onDelta,
  onUsage,
  onError,
}) {
  const body = serialiseBody(payload);
  const res = await fetch(OPENROUTER_CHAT, {
    method: "POST",
    headers,
    body,
    signal,
  });

  // Non-streaming error response
  if (!res.ok) {
    let raw = "";
    try {
      raw = await res.text();
    } catch {}
    const err = makeApiError(res, raw, { requestBody: body });
    if (onError) onError(err);
    throw err;
  }

  // OpenRouter sometimes responds with JSON (non-SSE) even when stream:true
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("event-stream")) {
    const raw = await res.text();
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {}
    // Try to interpret as a single completion
    const choice = parsed?.choices?.[0];
    if (choice) {
      const content = choice.message?.content || choice.delta?.content || "";
      const reasoning = choice.message?.reasoning || choice.delta?.reasoning || "";
      const resolvedModel = parsed.model || payload.model;
      const provider = parsed.provider || null;
      const usage = parsed.usage || null;
      if (onMeta) onMeta({ resolvedModel, provider, model: parsed.model });
      if (content && onDelta) onDelta({ content });
      if (reasoning && onDelta) onDelta({ reasoning });
      if (usage && onUsage) onUsage(usage);
      return { fullText: content, reasoning, resolvedModel, provider, usage, raw, nonStreaming: true };
    }
    const err = makeApiError(res, raw, { requestBody: body });
    if (onError) onError(err);
    throw err;
  }

  // ---------- SSE path ----------
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let fullText = "";
  let reasoning = "";
  let resolvedModel = payload.model;
  let provider = null;
  let usage = null;
  let rawAll = "";

  const metaEmitted = { v: false };
  const emitMeta = () => {
    if (!metaEmitted.v && onMeta) {
      onMeta({ resolvedModel, provider, model: payload.model });
      metaEmitted.v = true;
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      rawAll += text;
      buffer += text;
      const parsed = parseSSEChunk(buffer);
      buffer = parsed.buffer;

      for (const evt of parsed.events) {
        if (!evt.data) continue;
        if (evt.data === "[DONE]") continue;
        let json = null;
        try {
          json = JSON.parse(evt.data);
        } catch {
          continue;
        }
        // OpenRouter emits model/provider metadata in some chunks
        if (json.model) resolvedModel = json.model;
        if (json.provider) provider = json.provider;
        if (json.usage) {
          usage = json.usage;
          if (onUsage) onUsage(usage);
        }
        // Provider-level error
        if (json.error) {
          const err = makeApiError(res, evt.data, {
            detail: json.error,
            providerError: json.error,
            requestBody: body,
          });
          emitMeta();
          if (onError) onError(err);
          throw err;
        }
        const choice = json.choices && json.choices[0];
        if (!choice) continue;
        const delta = choice.delta || {};
        const msg = choice.message || {};
        const c = delta.content ?? msg.content ?? "";
        const r = delta.reasoning ?? msg.reasoning ?? "";
        if (c || r) {
          emitMeta();
          if (c) fullText += c;
          if (r) reasoning += r;
          if (onDelta) onDelta({ content: c, reasoning: r });
        }
        if (choice.finish_reason) {
          emitMeta();
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {}
  }

  emitMeta();

  return {
    fullText,
    reasoning,
    resolvedModel,
    provider,
    usage,
    raw: rawAll,
  };
}

// ---------------------------------------------------------------------------
// Optional: resolve openrouter/free to a concrete model name.
// When the model is openrouter/free, the actual model used by OpenRouter is
// reported back in the response body/stream; we surface it in the UI.
// ---------------------------------------------------------------------------
export { AUTO_FREE_MODEL };
