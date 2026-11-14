/**
 * OpenRouter client.
 *
 * Non-negotiable rules implemented here:
 *  - the exact serialised request body produced by requestBuilder.js is what is sent;
 *  - provider HTTP bodies, status codes and request IDs are never rewritten;
 *  - stream failures carry the exact SSE payload that caused them;
 *  - the Authorization header never enters an archived request or an error.
 */
import { CONFIG } from '../config.js';
import { providerFromSlug, prettyModelName, toIso } from '../utils.js';

export class OpenRouterError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'OpenRouterError';
    this.details = details;
    this.kind = details.kind || 'provider';
    this.status = details.status ?? null;
    this.statusText = details.statusText ?? null;
    this.bodyText = details.bodyText ?? '';
    this.parsed = details.parsed ?? null;
    this.url = details.url ?? null;
    this.requestId = details.requestId ?? null;
    this.provider = details.provider ?? null;
    this.headers = details.headers ?? {};
    this.latencyMs = details.latencyMs ?? null;
    this.rawEvent = details.rawEvent ?? null;
  }

  toRecord() {
    return {
      kind: this.kind,
      name: this.name,
      message: this.message,
      status: this.status,
      statusText: this.statusText,
      bodyText: this.bodyText,
      parsed: this.parsed,
      url: this.url,
      requestId: this.requestId,
      provider: this.provider,
      headers: this.headers,
      latencyMs: this.latencyMs,
      rawEvent: this.rawEvent,
      at: new Date().toISOString(),
    };
  }
}

function apiUrl(path) {
  return `${CONFIG.openrouter.apiBase}${path}`;
}

function commonHeaders(apiKey) {
  const headers = {
    'Content-Type': 'application/json',
    'HTTP-Referer': CONFIG.openrouter.referer,
    'X-Title': CONFIG.openrouter.title,
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

function pickHeaders(headers) {
  const names = [
    'request-id',
    'x-request-id',
    'x-openrouter-error-origin',
    'x-openrouter-error-tool',
    'x-provider-name',
    'x-generation-id',
    'cf-ray',
    'www-authenticate',
    'retry-after',
    'x-ratelimit-limit',
    'x-ratelimit-remaining',
    'x-ratelimit-reset',
    'content-type',
  ];
  const picked = {};
  for (const name of names) {
    const value = headers?.get?.(name);
    if (value) picked[name] = value;
  }
  return picked;
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function readBody(response) {
  try {
    return await response.text();
  } catch (error) {
    return `[The browser could not read the response body: ${error?.name || 'Error'}: ${error?.message || String(error)}]`;
  }
}

function providerMessage(parsed) {
  if (!parsed) return null;
  if (typeof parsed.error === 'string') return parsed.error;
  if (parsed.error?.message) return parsed.error.message;
  if (parsed.message) return parsed.message;
  if (parsed.msg) return parsed.msg;
  return null;
}

function normaliseUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  return {
    prompt_tokens: usage.prompt_tokens ?? usage.native_tokens_prompt ?? null,
    completion_tokens: usage.completion_tokens ?? usage.native_tokens_completion ?? null,
    total_tokens: usage.total_tokens ?? usage.native_tokens_total ?? null,
    cost: usage.cost ?? null,
    cost_details: usage.cost_details ?? null,
    is_byok: usage.is_byok ?? null,
    ...usage,
  };
}

function textFromContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part?.type === 'text') return part.text || '';
        return part?.text || '';
      })
      .join('');
  }
  return '';
}

function reasoningFromDelta(delta) {
  if (!delta) return '';
  if (typeof delta.reasoning === 'string') return delta.reasoning;
  if (Array.isArray(delta.reasoning_details)) {
    return delta.reasoning_details
      .map((detail) => detail?.text || detail?.summary || detail?.content || '')
      .filter(Boolean)
      .join('');
  }
  if (Array.isArray(delta.reasoning)) {
    return delta.reasoning.map((item) => item?.text || '').join('');
  }
  return '';
}

/* ───────────────────────── model catalogue ───────────────────────── */

export async function fetchModelCatalogue({ signal } = {}) {
  const started = performance.now();
  let response;
  try {
    response = await fetch(apiUrl(CONFIG.openrouter.modelsPath), {
      method: 'GET',
      headers: commonHeaders(''),
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new OpenRouterError(error?.message || 'The browser could not reach OpenRouter.', {
      kind: 'network',
      url: apiUrl(CONFIG.openrouter.modelsPath),
      bodyText: '',
      latencyMs: Math.round(performance.now() - started),
      parsed: null,
    });
  }

  const text = await readBody(response);
  const parsed = parseJsonSafe(text);
  if (!response.ok) {
    throw new OpenRouterError(providerMessage(parsed) || `HTTP ${response.status} ${response.statusText}`, {
      kind: 'http',
      status: response.status,
      statusText: response.statusText,
      bodyText: text,
      parsed,
      url: apiUrl(CONFIG.openrouter.modelsPath),
      requestId: response.headers.get('request-id') || response.headers.get('x-request-id'),
      headers: pickHeaders(response.headers),
      latencyMs: Math.round(performance.now() - started),
    });
  }
  if (!parsed || !Array.isArray(parsed.data)) {
    throw new OpenRouterError('The models endpoint returned a response without a `data` array.', {
      kind: 'shape',
      status: response.status,
      statusText: response.statusText,
      bodyText: text,
      parsed,
      url: apiUrl(CONFIG.openrouter.modelsPath),
      headers: pickHeaders(response.headers),
      latencyMs: Math.round(performance.now() - started),
    });
  }

  const all = parsed.data;
  const free = all.filter((model) => {
    const prompt = Number(model?.pricing?.prompt);
    const completion = Number(model?.pricing?.completion);
    const isFree = prompt === 0 && completion === 0;
    const outputs = model?.architecture?.output_modalities || [];
    const inputs = model?.architecture?.input_modalities || [];
    const isChatOutput = outputs.includes('text') && !outputs.includes('audio') && !outputs.includes('image');
    const acceptsText = inputs.includes('text') || inputs.length === 0;
    return isFree && isChatOutput && acceptsText;
  });

  const models = free.map((model) => {
    const provider = model.name?.split(':')?.[0]?.trim() || providerFromSlug(model.id);
    return {
      slug: model.id,
      canonical_slug: model.canonical_slug || model.id,
      name: model.name || prettyModelName(model.id),
      provider,
      description: model.description || '',
      context_length: model.context_length ?? model.top_provider?.context_length ?? null,
      max_completion_tokens: model.top_provider?.max_completion_tokens ?? null,
      architecture: model.architecture || {},
      pricing: model.pricing || {},
      supported_parameters: model.supported_parameters || [],
      is_free: true,
      metadata: {
        created: model.created ?? null,
        hugging_face_id: model.hugging_face_id ?? null,
        endpoints: model.endpoints ?? [],
        per_request_limits: model.per_request_limits ?? null,
        default_parameters: model.default_parameters ?? null,
        expiration_date: model.expiration_date ?? null,
        reasoning: model.reasoning ?? null,
        knowledge_cutoff: model.knowledge_cutoff ?? null,
        links: model.links ?? null,
        raw_name: model.name ?? null,
      },
    };
  });

  models.sort((a, b) => {
    if (a.slug === 'openrouter/free') return -1;
    if (b.slug === 'openrouter/free') return 1;
    return a.name.localeCompare(b.name);
  });

  return {
    models,
    totalCatalogue: all.length,
    freeCount: models.length,
    fetchedAt: toIso(),
    latencyMs: Math.round(performance.now() - started),
    catalogueFingerprintIds: all.map((model) => model.id),
  };
}

/* ─────────────────────────── API key test ────────────────────────── */

export async function testApiKey(apiKey) {
  const started = performance.now();
  const url = apiUrl(CONFIG.openrouter.keyPath);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': CONFIG.openrouter.referer,
        'X-Title': CONFIG.openrouter.title,
      },
    });
    const bodyText = await readBody(response);
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      bodyText,
      parsed: parseJsonSafe(bodyText),
      latencyMs: Math.round(performance.now() - started),
      requestId: response.headers.get('request-id') || response.headers.get('x-request-id'),
      headers: pickHeaders(response.headers),
      url,
      at: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      statusText: null,
      bodyText: '',
      parsed: null,
      error: {
        name: error?.name || 'Error',
        message: error?.message || String(error),
      },
      latencyMs: Math.round(performance.now() - started),
      requestId: null,
      headers: {},
      url,
      at: new Date().toISOString(),
    };
  }
}

/* ───────────────────────────── streaming ────────────────────────── */

/**
 * Execute the exact archived request. Returns content, reasoning and metadata,
 * or throws OpenRouterError with untouched provider text.
 */
export async function streamCompletion({
  requestSnapshot,
  apiKey,
  signal,
  onDelta,
  onReasoning,
  onMeta,
}) {
  if (!apiKey) {
    throw new OpenRouterError('No OpenRouter API key is stored on this device.', {
      kind: 'configuration',
      bodyText: '',
      url: requestSnapshot?.url,
    });
  }
  if (!requestSnapshot?.bodyText) {
    throw new OpenRouterError('The request snapshot is empty, so nothing was sent.', {
      kind: 'client',
      url: requestSnapshot?.url || apiUrl(CONFIG.openrouter.chatPath),
    });
  }

  const url = requestSnapshot.url || apiUrl(CONFIG.openrouter.chatPath);
  const started = performance.now();
  let response;
  let sentBody = requestSnapshot.bodyText;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: commonHeaders(apiKey),
      body: sentBody,
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new OpenRouterError(error?.message || 'The browser could not reach OpenRouter.', {
      kind: 'network',
      bodyText: '',
      url,
      latencyMs: Math.round(performance.now() - started),
      parsed: null,
    });
  }

  if (!response.ok) {
    const bodyText = await readBody(response);
    const parsed = parseJsonSafe(bodyText);
    throw new OpenRouterError(providerMessage(parsed) || `HTTP ${response.status} ${response.statusText}`, {
      kind: 'http',
      status: response.status,
      statusText: response.statusText,
      bodyText,
      parsed,
      url,
      requestId: response.headers.get('request-id') || response.headers.get('x-request-id'),
      provider: response.headers.get('x-provider-name'),
      headers: pickHeaders(response.headers),
      latencyMs: Math.round(performance.now() - started),
    });
  }

  const contentType = response.headers.get('content-type') || '';
  const responseHeaders = pickHeaders(response.headers);
  const isJson = contentType.includes('application/json') && !contentType.includes('event-stream');

  if (isJson) {
    const bodyText = await readBody(response);
    const parsed = parseJsonSafe(bodyText);
    if (!parsed) {
      throw new OpenRouterError('OpenRouter returned a JSON content type with an unparseable body.', {
        kind: 'shape',
        status: response.status,
        statusText: response.statusText,
        bodyText,
        parsed: null,
        url,
        headers: responseHeaders,
        latencyMs: Math.round(performance.now() - started),
      });
    }
    if (parsed.error) {
      throw new OpenRouterError(providerMessage(parsed) || 'The provider returned an error object.', {
        kind: 'provider',
        status: response.status,
        statusText: response.statusText,
        bodyText,
        parsed,
        url,
        requestId: response.headers.get('request-id') || parsed.id || null,
        provider: response.headers.get('x-provider-name') || parsed.provider || null,
        headers: responseHeaders,
        latencyMs: Math.round(performance.now() - started),
      });
    }
    const choice = parsed.choices?.[0];
    const content = textFromContent(choice?.message?.content);
    const reasoning = reasoningFromDelta(choice?.message);
    onMeta?.({
      model: parsed.model || null,
      provider: parsed.provider || response.headers.get('x-provider-name') || null,
      id: parsed.id || null,
      usage: normaliseUsage(parsed.usage),
      finishReason: choice?.finish_reason || null,
    });
    if (content) onDelta?.(content, content);
    if (reasoning) onReasoning?.(reasoning, reasoning);
    return {
      content,
      reasoning,
      model: parsed.model || null,
      provider: parsed.provider || response.headers.get('x-provider-name') || null,
      generationId: parsed.id || null,
      usage: normaliseUsage(parsed.usage),
      finishReason: choice?.finish_reason || null,
      latencyMs: Math.round(performance.now() - started),
      headers: responseHeaders,
      empty: !content && !reasoning,
      mode: 'json',
    };
  }

  if (!response.body) {
    throw new OpenRouterError('The browser received no readable response body for this stream.', {
      kind: 'stream',
      status: response.status,
      statusText: response.statusText,
      bodyText: '',
      url,
      headers: responseHeaders,
      latencyMs: Math.round(performance.now() - started),
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let content = '';
  let reasoning = '';
  let model = null;
  let provider = response.headers.get('x-provider-name') || null;
  let generationId = null;
  let usage = null;
  let finishReason = null;
  let eventCount = 0;
  let done = false;

  const consumeBlock = (block) => {
    const raw = block.trim();
    if (!raw) return;
    if (raw.startsWith(':')) return;
    const dataLines = raw
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart());
    if (!dataLines.length) return;
    const dataText = dataLines.join('\n');
    if (!dataText) return;
    if (dataText === '[DONE]') {
      done = true;
      return;
    }
    const parsed = parseJsonSafe(dataText);
    if (!parsed) {
      throw new OpenRouterError('An SSE event from OpenRouter could not be parsed as JSON.', {
        kind: 'stream',
        status: response.status,
        statusText: response.statusText,
        bodyText: dataText,
        parsed: null,
        rawEvent: raw,
        url,
        requestId: generationId,
        provider,
        headers: responseHeaders,
        latencyMs: Math.round(performance.now() - started),
      });
    }
    eventCount += 1;
    if (parsed.error) {
      throw new OpenRouterError(providerMessage(parsed) || 'The provider sent an error event.', {
        kind: 'provider',
        status: response.status,
        statusText: response.statusText,
        bodyText: dataText,
        parsed,
        rawEvent: raw,
        url,
        requestId: parsed.id || generationId,
        provider: parsed.provider || provider,
        headers: responseHeaders,
        latencyMs: Math.round(performance.now() - started),
      });
    }

    if (parsed.model) model = parsed.model;
    if (parsed.provider) provider = parsed.provider;
    if (parsed.id) generationId = parsed.id;
    if (parsed.usage) usage = normaliseUsage(parsed.usage);

    const choice = parsed.choices?.[0];
    if (!choice) return;
    const delta = choice.delta || choice.message || {};
    const piece = textFromContent(delta.content);
    const think = reasoningFromDelta(delta);
    if (piece) {
      content += piece;
      onDelta?.(piece, content);
    }
    if (think) {
      reasoning += think;
      onReasoning?.(think, reasoning);
    }
    if (choice.finish_reason) finishReason = choice.finish_reason;
    onMeta?.({
      model,
      provider,
      id: generationId,
      usage,
      finishReason,
    });
  };

  try {
    while (!done) {
      const { value, done: streamDone } = await reader.read();
      if (streamDone) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        consumeBlock(block);
        if (done) break;
        boundary = buffer.indexOf('\n\n');
      }
    }
    buffer += decoder.decode();
    buffer = buffer.replace(/\r\n/g, '\n');
    if (!done && buffer.trim()) consumeBlock(buffer);
  } catch (error) {
    if (error instanceof OpenRouterError) throw error;
    if (error?.name === 'AbortError') throw error;
    throw new OpenRouterError(error?.message || 'The stream was interrupted by a network error.', {
      kind: 'stream',
      status: response.status,
      statusText: response.statusText,
      bodyText: content ? `[Partial assistant content retained: ${content.length} chars]\n${error?.message || ''}` : '',
      parsed: null,
      rawEvent: buffer.slice(-4000),
      url,
      requestId: generationId,
      provider,
      headers: responseHeaders,
      latencyMs: Math.round(performance.now() - started),
    });
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* already released */
    }
  }

  return {
    content,
    reasoning,
    model,
    provider,
    generationId,
    usage,
    finishReason,
    latencyMs: Math.round(performance.now() - started),
    headers: responseHeaders,
    empty: !content && !reasoning,
    eventCount,
    mode: 'stream',
    modeNote: 'Streaming (SSE)',
    sentBytes: new Blob([sentBody]).size,
  };
}

export function errorRecordFrom(error) {
  if (error instanceof OpenRouterError) return error.toRecord();
  return {
    kind: error?.name === 'AbortError' ? 'aborted' : 'client',
    name: error?.name || 'Error',
    message: error?.message || String(error),
    status: null,
    statusText: null,
    bodyText: '',
    parsed: null,
    url: null,
    requestId: null,
    headers: {},
    latencyMs: null,
    at: new Date().toISOString(),
  };
}
