/**
 * Direct provider transport. No edge function, no proxy.
 *
 * Rules:
 *  - the archived `bodyText` is what is sent, byte for byte;
 *  - provider status, request id, headers and raw bodies are never rewritten;
 *  - reasoning deltas are captured separately from visible content;
 *  - the Authorization header never enters an error or an archive.
 */

import type {
  AiError,
  ModelInfo,
  RequestSnapshot,
  StreamCallbacks,
  StreamEvent,
  StreamResult,
  TokenUsage,
} from '../types';
import { nowIso, safeJsonParse } from '../lib/utils';

export class AiTransportError extends Error {
  details: AiError;

  constructor(message: string, details: Partial<AiError>) {
    super(message);
    this.name = 'AiTransportError';
    this.details = {
      kind: details.kind || 'provider',
      message,
      at: nowIso(),
      ...details,
    };
  }
}

export function errorRecord(error: unknown): AiError {
  if (error instanceof AiTransportError) return error.details;
  const candidate = error as { name?: string; message?: string };
  return {
    kind: candidate?.name === 'AbortError' ? 'client' : 'network',
    name: candidate?.name || 'Error',
    message: candidate?.message || String(error),
    at: nowIso(),
  };
}

export function isAbort(error: unknown): boolean {
  return (error as { name?: string })?.name === 'AbortError';
}

const PICK_HEADERS = [
  'request-id',
  'x-request-id',
  'x-openrouter-error-origin',
  'x-openrouter-error-tool',
  'x-provider-name',
  'x-generation-id',
  'cf-ray',
  'retry-after',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'x-ratelimit-reset',
  'content-type',
];

function pickHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of PICK_HEADERS) {
    const value = headers.get(name);
    if (value) out[name] = value;
  }
  return out;
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        const record = part as { type?: string; text?: string };
        return record?.text || '';
      })
      .join('');
  }
  return '';
}

function reasoningFromDelta(delta: Record<string, unknown> | null | undefined): string {
  if (!delta) return '';
  if (typeof delta.reasoning === 'string') return delta.reasoning;
  if (Array.isArray(delta.reasoning_details)) {
    return (delta.reasoning_details as Array<Record<string, string>>)
      .map((detail) => detail?.text || detail?.summary || detail?.content || '')
      .filter(Boolean)
      .join('');
  }
  if (Array.isArray(delta.reasoning)) {
    return (delta.reasoning as Array<Record<string, string>>).map((item) => item?.text || '').join('');
  }
  if (typeof delta.reasoning_content === 'string') return delta.reasoning_content;
  return '';
}

function normaliseUsage(usage: unknown): TokenUsage | null {
  if (!usage || typeof usage !== 'object') return null;
  const record = usage as Record<string, number | undefined>;
  return {
    prompt_tokens: Number(record.prompt_tokens ?? record.native_tokens_prompt ?? 0),
    completion_tokens: Number(record.completion_tokens ?? record.native_tokens_completion ?? 0),
    total_tokens: Number(record.total_tokens ?? record.native_tokens_total ?? 0),
    cost: (record.cost as number | undefined) ?? null,
  };
}

function providerMessage(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const record = parsed as Record<string, unknown>;
  if (typeof record.error === 'string') return record.error;
  if (record.error && typeof record.error === 'object') {
    const inner = record.error as Record<string, unknown>;
    if (typeof inner.message === 'string') return inner.message;
  }
  if (typeof record.message === 'string') return record.message;
  if (typeof record.msg === 'string') return record.msg;
  return null;
}

async function readBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    return `[The browser could not read the response body: ${(error as Error)?.message || error}]`;
  }
}

function headersFor(apiKey: string, baseUrl: string): Record<string, string> {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://full-metal-cinema.local';
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'HTTP-Referer': origin,
    'X-Title': 'Full Metal Cinema',
  };
}

export interface StreamArgs {
  snapshot: RequestSnapshot;
  apiKey: string;
  baseUrl: string;
  signal?: AbortSignal;
  callbacks?: StreamCallbacks;
}

export async function streamCompletion({
  snapshot,
  apiKey,
  baseUrl,
  signal,
  callbacks = {},
}: StreamArgs): Promise<StreamResult> {
  if (!apiKey) {
    throw new AiTransportError('No API key is stored on this device.', {
      kind: 'configuration',
      bodyText: '',
      url: snapshot.url,
    });
  }
  if (!snapshot?.bodyText) {
    throw new AiTransportError('The request snapshot is empty, so nothing was sent.', {
      kind: 'client',
      url: `${baseUrl}/chat/completions`,
    });
  }

  const emit = (event: Omit<StreamEvent, 'at'>) => {
    callbacks.onEvent?.({ ...event, at: nowIso() });
  };

  const started = performance.now();
  let response: Response;
  emit({ kind: 'open', label: 'Sending request', detail: `${snapshot.model} · ${snapshot.estimatedInputTokens} est. input tokens` });

  try {
    response = await fetch(snapshot.url, {
      method: 'POST',
      headers: headersFor(apiKey, baseUrl),
      body: snapshot.bodyText,
      signal,
    });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new AiTransportError((error as Error)?.message || 'The browser could not reach the provider.', {
      kind: 'network',
      url: snapshot.url,
      latencyMs: Math.round(performance.now() - started),
      bodyText: '',
    });
  }

  const responseHeaders = pickHeaders(response.headers);

  if (!response.ok) {
    const bodyText = await readBody(response);
    const parsed = safeJsonParse<Record<string, unknown>>(bodyText);
    const latencyMs = Math.round(performance.now() - started);
    const error = new AiTransportError(
      providerMessage(parsed) || `HTTP ${response.status} ${response.statusText}`,
      {
        kind: 'http',
        status: response.status,
        statusText: response.statusText,
        bodyText,
        parsed,
        url: snapshot.url,
        requestId: response.headers.get('request-id') || response.headers.get('x-request-id'),
        provider: response.headers.get('x-provider-name'),
        headers: responseHeaders,
        latencyMs,
      },
    );
    emit({ kind: 'error', label: `HTTP ${response.status}`, detail: error.message });
    throw error;
  }

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json') && !contentType.includes('event-stream');

  if (isJson) {
    const bodyText = await readBody(response);
    const parsed = safeJsonParse<Record<string, any>>(bodyText);
    if (!parsed) {
      throw new AiTransportError('The provider returned JSON that could not be parsed.', {
        kind: 'shape',
        status: response.status,
        bodyText,
        url: snapshot.url,
        headers: responseHeaders,
      });
    }
    if (parsed.error) {
      throw new AiTransportError(providerMessage(parsed) || 'The provider returned an error object.', {
        kind: 'provider',
        status: response.status,
        bodyText,
        parsed,
        url: snapshot.url,
        requestId: parsed.id || null,
        provider: parsed.provider || response.headers.get('x-provider-name'),
        headers: responseHeaders,
      });
    }
    const choice = parsed.choices?.[0];
    const content = textFromContent(choice?.message?.content);
    const reasoning = reasoningFromDelta(choice?.message);
    const usage = normaliseUsage(parsed.usage);
    callbacks.onMeta?.({
      model: parsed.model || null,
      provider: parsed.provider || response.headers.get('x-provider-name') || null,
      generation_id: parsed.id || null,
      usage,
      finish_reason: choice?.finish_reason || null,
    });
    if (content) callbacks.onDelta?.(content, content);
    if (reasoning) callbacks.onReasoning?.(reasoning, reasoning);
    emit({ kind: 'done', label: 'Complete (non-stream response)' });
    return {
      content,
      reasoning,
      model: parsed.model || null,
      provider: parsed.provider || response.headers.get('x-provider-name') || null,
      generationId: parsed.id || null,
      usage,
      finishReason: choice?.finish_reason || null,
      latencyMs: Math.round(performance.now() - started),
      headers: responseHeaders,
      empty: !content && !reasoning,
      mode: 'json',
      eventCount: 1,
    };
  }

  if (!response.body) {
    throw new AiTransportError('The response had no readable body.', {
      kind: 'stream',
      status: response.status,
      url: snapshot.url,
      headers: responseHeaders,
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let content = '';
  let reasoning = '';
  let model: string | null = null;
  let provider: string | null = response.headers.get('x-provider-name') || null;
  let generationId: string | null = null;
  let usage: TokenUsage | null = null;
  let finishReason: string | null = null;
  let eventCount = 0;
  let done = false;

  const consume = (block: string): void => {
    const raw = block.trim();
    if (!raw) return;
    if (raw.startsWith(':')) return;
    const dataLines = raw
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart());
    if (!dataLines.length) return;
    const dataText = dataLines.join('\n').trim();
    if (!dataText) return;
    if (dataText === '[DONE]') {
      done = true;
      return;
    }
    const parsed = safeJsonParse<Record<string, any>>(dataText);
    if (!parsed) {
      throw new AiTransportError('An SSE frame from the provider could not be parsed as JSON.', {
        kind: 'stream',
        status: response.status,
        bodyText: dataText,
        rawEvent: raw,
        url: snapshot.url,
        headers: responseHeaders,
        provider,
      });
    }
    eventCount += 1;
    if (parsed.error) {
      throw new AiTransportError(providerMessage(parsed) || 'The provider sent an error event.', {
        kind: 'provider',
        status: response.status,
        bodyText: dataText,
        parsed,
        rawEvent: raw,
        url: snapshot.url,
        requestId: parsed.id || generationId || undefined,
        provider: parsed.provider || provider,
        headers: responseHeaders,
      });
    }
    if (parsed.id) generationId = String(parsed.id);
    if (parsed.model) model = String(parsed.model);
    if (parsed.provider) provider = String(parsed.provider);
    if (parsed.usage) usage = normaliseUsage(parsed.usage);
    const choice = parsed.choices?.[0];
    if (choice) {
      if (choice.finish_reason) finishReason = choice.finish_reason;
      const delta = choice.delta || {};
      const contentDelta = textFromContent(delta.content);
      if (contentDelta) {
        content += contentDelta;
        callbacks.onDelta?.(contentDelta, content);
      }
      const reasoningDelta = reasoningFromDelta(delta);
      if (reasoningDelta) {
        reasoning += reasoningDelta;
        callbacks.onReasoning?.(reasoningDelta, reasoning);
      }
    }
    callbacks.onMeta?.({
      model: model ?? undefined,
      provider,
      generation_id: generationId ?? undefined,
      usage,
      finish_reason: finishReason,
    });
  };

  try {
    while (!done) {
      const { value, done: finished } = await reader.read();
      if (finished) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';
      for (const block of blocks) consume(block);
    }
    buffer += decoder.decode();
    if (buffer.trim()) consume(buffer);
  } catch (error) {
    if (isAbort(error)) {
      emit({ kind: 'abort', label: 'Stream stopped by the operator' });
      throw error;
    }
    if (error instanceof AiTransportError) {
      emit({ kind: 'error', label: error.details.kind, detail: error.message });
      throw error;
    }
    throw new AiTransportError((error as Error)?.message || 'The stream ended unexpectedly.', {
      kind: 'stream',
      status: response.status,
      url: snapshot.url,
      headers: responseHeaders,
      bodyText: content,
      provider,
      latencyMs: Math.round(performance.now() - started),
    });
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* already closed */
    }
  }

  emit({
    kind: 'done',
    label: `Stream complete · ${eventCount} events`,
    detail: finishReason ? `finish_reason: ${finishReason}` : undefined,
  });

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
    empty: !content.trim() && !reasoning.trim(),
    mode: 'stream',
    eventCount,
  };
}

/* ── catalogue ─────────────────────────────────────────────────────────── */

function modelFromApi(model: Record<string, any>, freeOnly: boolean): ModelInfo | null {
  const pricing = model.pricing || {};
  const promptPrice = pricing.prompt === undefined ? null : Number(pricing.prompt);
  const completionPrice = pricing.completion === undefined ? null : Number(pricing.completion);
  const isFree = promptPrice === 0 && completionPrice === 0;
  if (freeOnly && !isFree) return null;
  const supported: string[] = Array.isArray(model.supported_parameters) ? model.supported_parameters : [];
  const id = String(model.id || '');
  return {
    id,
    name: String(model.name || id),
    vendor: String(model.name || '').split(':')[0]?.trim() || id.split('/')[0] || 'Unknown',
    contextLength: Number(model.context_length || model.top_provider?.context_length) || null,
    maxCompletionTokens: Number(model.top_provider?.max_completion_tokens) || null,
    description: String(model.description || ''),
    isFree,
    supportsReasoning:
      Boolean(model.reasoning) || supported.includes('reasoning') || /r1|reason|think|qwq|o1|o3/i.test(id),
    supportsParams: supported,
    pricingPrompt: promptPrice,
    pricingCompletion: completionPrice,
    modality: Array.isArray(model.architecture?.output_modalities)
      ? model.architecture.output_modalities.join('+')
      : 'text',
  };
}

export async function fetchModelCatalogue(
  baseUrl: string,
  options: { apiKey?: string; signal?: AbortSignal; freeOnly?: boolean } = {},
): Promise<{ models: ModelInfo[]; total: number; fetchedAt: string }> {
  const url = `${baseUrl.replace(/\/$/, '')}/models`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.apiKey) headers.Authorization = `Bearer ${options.apiKey}`;
  const response = await fetch(url, { headers, signal: options.signal });
  const text = await readBody(response);
  const parsed = safeJsonParse<{ data?: Array<Record<string, any>> }>(text);
  if (!response.ok) {
    throw new AiTransportError(providerMessage(parsed) || `HTTP ${response.status}`, {
      kind: 'http',
      status: response.status,
      bodyText: text,
      parsed,
      url,
      headers: pickHeaders(response.headers),
    });
  }
  if (!parsed?.data?.length) {
    throw new AiTransportError('The models endpoint returned no catalogue.', {
      kind: 'shape',
      status: response.status,
      bodyText: text,
      url,
    });
  }
  const models = parsed.data
    .map((model) => modelFromApi(model, Boolean(options.freeOnly)))
    .filter((model): model is ModelInfo => Boolean(model))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { models, total: parsed.data.length, fetchedAt: nowIso() };
}

export async function testKey(
  baseUrl: string,
  apiKey: string,
): Promise<{ ok: boolean; status: number | null; bodyText: string; latencyMs: number; url: string }> {
  const started = performance.now();
  const url = `${baseUrl.replace(/\/$/, '')}/key`;
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const bodyText = await readBody(response);
    return {
      ok: response.ok,
      status: response.status,
      bodyText,
      latencyMs: Math.round(performance.now() - started),
      url,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      bodyText: (error as Error)?.message || 'Network error',
      latencyMs: Math.round(performance.now() - started),
      url,
    };
  }
}
