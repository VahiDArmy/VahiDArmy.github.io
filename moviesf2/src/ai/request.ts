/** Exact request construction, token estimation and context budgeting. */

import type {
  GenerationParams,
  ModelInfo,
  RequestMessage,
  RequestSnapshot,
  TokenUsage,
} from '../types';
import { clamp, fingerprint, uid } from '../lib/utils';

/**
 * Conservative token estimate: ~4 characters per token for prose, adjusted for
 * punctuation, digits, code and non-Latin scripts. We cannot ship a BPE
 * tokenizer for every model, so the UI labels every number as an estimate.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const chars = text.length;
  const cjk = (text.match(/[\u3000-\u9fff\uac00-\ud7af]/g) || []).length;
  const cyrillic = (text.match(/[\u0400-\u04ff]/g) || []).length;
  const arabic = (text.match(/[\u0600-\u06ff]/g) || []).length;
  const digits = (text.match(/\d/g) || []).length;
  const punctuation = (text.match(/[^\w\s]/g) || []).length;
  const base = chars / 4;
  const scriptPenalty = cjk / 1.6 + cyrillic / 2.2 + arabic / 2.0;
  const digitPenalty = digits / 3;
  const punctuationPenalty = punctuation / 12;
  return Math.max(1, Math.ceil(base + scriptPenalty + digitPenalty + punctuationPenalty));
}

export function estimateMessages(messages: RequestMessage[]): number {
  return messages.reduce((total, message) => total + estimateTokens(message.content) + 4, 0);
}

export function usageFromProvider(
  usage: unknown,
  estimatedPrompt: number,
  estimatedCompletion: number,
): TokenUsage {
  const record = (usage || {}) as Record<string, number | undefined>;
  const prompt = Number(record.prompt_tokens ?? record.native_tokens_prompt ?? 0);
  const completion = Number(record.completion_tokens ?? record.native_tokens_completion ?? 0);
  const total = Number(record.total_tokens ?? record.native_tokens_total ?? 0);
  if (!prompt && !completion && !total) {
    return {
      prompt_tokens: estimatedPrompt,
      completion_tokens: estimatedCompletion,
      total_tokens: estimatedPrompt + estimatedCompletion,
      estimated: true,
      cost: null,
    };
  }
  return {
    prompt_tokens: prompt || estimatedPrompt,
    completion_tokens: completion || estimatedCompletion,
    total_tokens: total || prompt + completion,
    estimated: false,
    cost: (record.cost as number | undefined) ?? null,
  };
}

export interface BudgetReport {
  inputTokens: number;
  autoMax: number;
  autoMaxApplied: boolean;
  contextLength: number | null;
  remaining: number | null;
  pct: number | null;
  overBudget: boolean;
  systemTokens: number;
  historyTokens: number;
  draftTokens: number;
  note: string;
}

export function budgetReport(
  model: ModelInfo | undefined,
  messages: RequestMessage[],
  params: GenerationParams,
): BudgetReport {
  const inputTokens = estimateMessages(messages);
  const systemTokens = estimateTokens(messages.find((message) => message.role === 'system')?.content || '');
  const draft = messages.filter((message) => message.role === 'user').slice(-1)[0]?.content || '';
  const draftTokens = estimateTokens(draft);
  const contextLength = model?.contextLength ?? null;
  const reserve = 96;
  const remaining = contextLength ? contextLength - inputTokens - reserve : null;
  const ceiling = model?.maxCompletionTokens ?? 16_384;
  const autoMax = remaining === null ? ceiling : clamp(remaining, 256, ceiling);
  const explicit = params.max_tokens === 'auto' ? null : Number(params.max_tokens);
  const effective = explicit ?? autoMax;
  const pct = contextLength ? clamp((inputTokens / contextLength) * 100, 0, 100) : null;
  return {
    inputTokens,
    autoMax: effective,
    autoMaxApplied: explicit === null,
    contextLength,
    remaining,
    pct,
    overBudget: remaining !== null ? remaining < 256 : false,
    systemTokens,
    historyTokens: inputTokens - systemTokens - draftTokens,
    draftTokens,
    note:
      explicit !== null
        ? `Explicit cap of ${explicit} completion tokens.`
        : remaining === null
          ? 'No published context window: the request asks for a reasoned default completion budget.'
          : `Automatic budget: ${effective} completion tokens (window ${contextLength} − input ${inputTokens} − ${reserve} reserve).`,
  };
}

export interface BuildRequestOptions {
  model: ModelInfo | undefined;
  modelId: string;
  messages: RequestMessage[];
  params: GenerationParams;
  systemPrompt?: string;
  responseFormat?: 'text' | 'json';
  baseUrl: string;
  stream?: boolean;
}

export interface BuiltRequest {
  snapshot: RequestSnapshot;
  budget: BudgetReport;
}

/** Serialise the body once, archive it, and send exactly this string. */
export function buildRequest(options: BuildRequestOptions): BuiltRequest {
  const { model, modelId, params, baseUrl } = options;
  const stream = options.stream ?? params.stream;
  const messages: RequestMessage[] = [];
  if (options.systemPrompt?.trim()) {
    messages.push({ role: 'system', content: options.systemPrompt.trim() });
  }
  for (const message of options.messages) {
    if (!message.content.trim()) continue;
    if (message.role === 'system') continue;
    messages.push({ role: message.role, content: message.content });
  }

  const budget = budgetReport(model, messages, params);
  const body: Record<string, unknown> = {
    model: modelId,
    messages,
    temperature: Number(params.temperature.toFixed(2)),
    top_p: Number(params.top_p.toFixed(3)),
    max_tokens: budget.autoMax,
    stream,
  };
  if (stream) body.stream_options = { include_usage: true };
  if (params.frequency_penalty) body.frequency_penalty = params.frequency_penalty;
  if (params.presence_penalty) body.presence_penalty = params.presence_penalty;
  if (params.reasoning) body.reasoning = { enabled: true };
  if (params.seed !== null) body.seed = params.seed;
  if (options.responseFormat === 'json') body.response_format = { type: 'json_object' };

  const bodyText = JSON.stringify(body, null, options.responseFormat === 'json' ? 0 : 0);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer [REDACTED]',
    'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://full-metal-cinema.local',
    'X-Title': 'Full Metal Cinema',
  };

  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const snapshot: RequestSnapshot = {
    id: uid('req'),
    url,
    model: modelId,
    body,
    bodyText,
    headers,
    createdAt: new Date().toISOString(),
    messageCount: messages.length,
    estimatedInputTokens: budget.inputTokens,
    autoMaxTokens: budget.autoMaxApplied,
    maxTokens: budget.autoMax,
    truncatedHistory: 0,
    fingerprint: fingerprint(`${url}|${bodyText}`),
  };
  return { snapshot, budget };
}

/** Trim the oldest turns so a request fits the window. The newest turn always survives. */
export function trimToWindow(
  model: ModelInfo | undefined,
  messages: RequestMessage[],
  params: GenerationParams,
  reservedForReply = 1200,
): { messages: RequestMessage[]; dropped: number } {
  const context = model?.contextLength;
  if (!context) return { messages, dropped: 0 };
  let working = [...messages];
  let dropped = 0;
  while (working.length > 1 && estimateMessages(working) + reservedForReply > context) {
    const firstNonSystem = working.findIndex((message) => message.role !== 'system');
    if (firstNonSystem < 0) break;
    working.splice(firstNonSystem, 1);
    dropped += 1;
  }
  return { messages: working, dropped };
}

export function curlFor(snapshot: RequestSnapshot): string {
  const escaped = snapshot.bodyText.replace(/'/g, `'\\''`);
  return [
    `curl -X POST '${snapshot.url}' \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -H 'Authorization: Bearer $OPENROUTER_API_KEY' \\`,
    `  -H 'HTTP-Referer: ${snapshot.headers['HTTP-Referer']}' \\`,
    `  -H 'X-Title: Full Metal Cinema' \\`,
    `  -d '${escaped}'`,
  ].join('\n');
}

export function parseJsonFromText(text: string): { data: unknown; error: string | null } {
  const trimmed = text.trim();
  if (!trimmed) return { data: null, error: 'Empty response.' };
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return { data: JSON.parse(candidate), error: null };
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return { data: JSON.parse(candidate.slice(start, end + 1)), error: null };
      } catch {
        /* fall through */
      }
    }
    return { data: null, error: 'The reply did not contain parseable JSON.' };
  }
}
