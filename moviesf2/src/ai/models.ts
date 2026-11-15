/** Model catalogue: curated offline set, live OpenRouter sync, stable lookup. */

import { useSyncExternalStore } from 'react';
import type { AiModelRow, ModelInfo } from '../types';
import { fetchModelCatalogue } from './client';
import { getSettings, updateSettings } from '../data/settings';
import { getDb, upsertRow } from '../data/store';
import { nowIso, safeJsonParse } from '../lib/utils';

const CACHE_KEY = 'fmc.v2.models';

function model(
  id: string,
  name: string,
  vendor: string,
  contextLength: number | null,
  maxCompletionTokens: number | null,
  isFree: boolean,
  reasoning: boolean,
  description: string,
): ModelInfo {
  return {
    id,
    name,
    vendor,
    contextLength,
    maxCompletionTokens,
    description,
    isFree,
    supportsReasoning: reasoning,
    supportsParams: ['temperature', 'top_p', 'max_tokens', 'stop', 'seed'],
    pricingPrompt: isFree ? 0 : null,
    pricingCompletion: isFree ? 0 : null,
    modality: 'text',
  };
}

/** Offline catalogue: real models with conservative, published limits. */
export const CURATED_MODELS: ModelInfo[] = [
  model(
    'deepseek/deepseek-r1:free',
    'DeepSeek R1',
    'DeepSeek',
    163_840,
    16_384,
    true,
    true,
    'Open reasoning model. Streams its thinking before the answer — the default projectionist for analysis.',
  ),
  model(
    'deepseek/deepseek-chat-v3-0324:free',
    'DeepSeek V3',
    'DeepSeek',
    163_840,
    8192,
    true,
    false,
    'Fast general-purpose model; strong at structured JSON and copy.',
  ),
  model(
    'meta-llama/llama-3.3-70b-instruct:free',
    'Llama 3.3 70B',
    'Meta',
    131_072,
    4096,
    true,
    false,
    'Dependable long-form writer. Good default for reviews and essays.',
  ),
  model(
    'google/gemini-2.0-flash-exp:free',
    'Gemini 2.0 Flash',
    'Google',
    1_048_576,
    8192,
    true,
    false,
    'Very large context with fast responses. Useful for whole-shelf analysis.',
  ),
  model(
    'qwen/qwen-2.5-72b-instruct:free',
    'Qwen 2.5 72B',
    'Alibaba',
    32_768,
    4096,
    true,
    false,
    'Multilingual; unusually good at Persian copy and transliteration.',
  ),
  model(
    'mistralai/mistral-small-3.1-24b-instruct:free',
    'Mistral Small 3.1',
    'Mistral',
    128_000,
    8192,
    true,
    false,
    'Balanced, terse, rarely pads. A good arena opponent.',
  ),
  model(
    'google/gemma-3-27b-it:free',
    'Gemma 3 27B',
    'Google',
    96_000,
    4096,
    true,
    false,
    'Warm, readable prose. Strong at curation blurbs.',
  ),
  model(
    'microsoft/phi-4-reasoning:free',
    'Phi-4 Reasoning',
    'Microsoft',
    32_768,
    8192,
    true,
    true,
    'Small reasoning model; quick and surprisingly sharp on structure.',
  ),
  model(
    'openrouter/free',
    'Free Models Router',
    'OpenRouter',
    null,
    null,
    true,
    false,
    'Lets OpenRouter choose any free model at request time. The concrete answerer is recorded on the reply.',
  ),
  model(
    'anthropic/claude-sonnet-4',
    'Claude Sonnet 4',
    'Anthropic',
    200_000,
    64_000,
    false,
    true,
    'Excellent long-form critic. Requires credits on the provider account.',
  ),
  model(
    'openai/gpt-4o-mini',
    'GPT-4o mini',
    'OpenAI',
    128_000,
    16_384,
    false,
    false,
    'Balanced paid option for structured metadata extraction.',
  ),
  model(
    'google/gemini-2.5-pro',
    'Gemini 2.5 Pro',
    'Google',
    1_048_576,
    65_536,
    false,
    true,
    'Huge window, strong reasoning, slower. For whole-shelf work.',
  ),
  model(
    'deepseek/deepseek-r1',
    'DeepSeek R1 (paid)',
    'DeepSeek',
    163_840,
    32_768,
    false,
    true,
    'Same reasoning model on the paid pool — usually faster and less rate-limited.',
  ),
  model(
    'meta-llama/llama-3.1-405b-instruct',
    'Llama 3.1 405B',
    'Meta',
    131_072,
    4096,
    false,
    false,
    'The heavy Meta model. Expensive, occasionally the best writer in the room.',
  ),
];

let catalogue: ModelInfo[] = loadCache();
const listeners = new Set<() => void>();
let syncing = false;
let lastSyncError: string | null = null;
let lastSyncAt: string | null = null;

function loadCache(): ModelInfo[] {
  if (typeof window === 'undefined') return CURATED_MODELS;
  const raw = window.localStorage.getItem(CACHE_KEY);
  const parsed = raw ? safeJsonParse<ModelInfo[]>(raw) : null;
  if (!parsed?.length) return CURATED_MODELS;
  const known = new Set(parsed.map((item) => item.id));
  const extra = CURATED_MODELS.filter((item) => !known.has(item.id));
  return [...parsed, ...extra];
}

function persist(): void {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(catalogue.slice(0, 400)));
  } catch {
    /* cache is optional */
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function useModelCatalogue(): ModelInfo[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => catalogue,
    () => catalogue,
  );
}

export function getCatalogue(): ModelInfo[] {
  return catalogue;
}

export function getModelInfo(id: string): ModelInfo | undefined {
  return catalogue.find((item) => item.id === id);
}

export function resolveModel(id: string): ModelInfo {
  const found = getModelInfo(id);
  if (found) return found;
  if (id === 'openrouter/free') {
    return CURATED_MODELS.find((item) => item.id === 'openrouter/free') as ModelInfo;
  }
  return {
    id,
    name: id.split('/').pop() || id,
    vendor: id.split('/')[0] || 'Unknown',
    contextLength: null,
    maxCompletionTokens: null,
    description: 'Not in the catalogue. Limits are unknown to this client.',
    isFree: id.endsWith(':free'),
    supportsReasoning: /r1|reason|think|qwq|o1|o3/i.test(id),
    supportsParams: [],
    pricingPrompt: null,
    pricingCompletion: null,
    modality: 'text',
  };
}

export function isSyncing(): boolean {
  return syncing;
}

export function syncError(): string | null {
  return lastSyncError;
}

export function syncTimestamp(): string | null {
  return lastSyncAt;
}

export interface SyncOutcome {
  ok: boolean;
  added: number;
  total: number;
  message: string;
}

/**
 * Fetch the live catalogue, merge it without destroying arena history, and
 * respect local tombstones for models the operator removed.
 */
export async function syncCatalogue(options: { freeOnly?: boolean } = {}): Promise<SyncOutcome> {
  if (syncing) return { ok: false, added: 0, total: catalogue.length, message: 'A sync is already running.' };
  syncing = true;
  lastSyncError = null;
  emit();
  const settings = getSettings();
  try {
    const result = await fetchModelCatalogue(settings.baseUrl, {
      apiKey: undefined,
      freeOnly: options.freeOnly,
    });
    const db = getDb();
    const deleted = new Set(db.cinema_ai_models_deleted.map((row) => row.id));
    const usable = result.models.filter((item) => {
      if (deleted.has(item.id)) return false;
      const modality = item.modality.toLowerCase();
      return modality.includes('text') && !modality.includes('audio') && !modality.includes('image');
    });
    const curatedSupplement = CURATED_MODELS.filter((item) => !usable.some((live) => live.id === item.id));
    catalogue = [...usable, ...curatedSupplement];
    lastSyncAt = result.fetchedAt;
    persist();
    emit();

    let added = 0;
    for (const item of usable) {
      const existing = db.cinema_ai_models.find((row) => row.id === item.id);
      const patch: Partial<AiModelRow> & { id: string } = {
        id: item.id,
        label: item.name,
        vendor: item.vendor,
        context: item.contextLength ? String(item.contextLength) : '',
        tags: item.supportsReasoning ? 'reasoning' : 'chat',
        is_free: item.isFree,
        provider: 'openrouter',
        source: 'openrouter',
        fetched_at: result.fetchedAt,
        active: existing?.active ?? true,
        recommended:
          existing?.recommended ?? /deepseek-r1|llama-3\.3|gemini-2\.0-flash/.test(item.id),
        best_for: existing?.best_for || 'analysis',
        size: existing?.size || '',
        speed: existing?.speed || '',
        note: existing?.note || item.description.slice(0, 240),
        wins: existing?.wins ?? 0,
        losses: existing?.losses ?? 0,
        user_rating: existing?.user_rating ?? 0,
        last_tried_at: existing?.last_tried_at ?? null,
      };
      upsertRow('cinema_ai_models', patch);
      if (!existing) added += 1;
    }
    if (!getModelInfo(settings.defaultModel)) {
      updateSettings({ defaultModel: usable[0]?.id || CURATED_MODELS[0].id });
    }
    return {
      ok: true,
      added,
      total: usable.length,
      message: `Catalogue synced · ${usable.length} models (${result.total} in the provider catalogue).`,
    };
  } catch (error) {
    lastSyncError = (error as Error)?.message || 'Sync failed.';
    emit();
    return { ok: false, added: 0, total: catalogue.length, message: lastSyncError };
  } finally {
    syncing = false;
    emit();
  }
}

/** Mark a model as hidden forever, including across catalogue re-syncs. */
export function tombstoneModel(id: string): void {
  upsertRow('cinema_ai_models_deleted', { id, deleted_at: nowIso() });
  catalogue = catalogue.filter((item) => item.id !== id);
  persist();
  emit();
}

export const MODEL_GROUPS: Array<{ id: string; label: string; test: (model: ModelInfo) => boolean }> = [
  { id: 'free', label: 'Free', test: (item) => item.isFree },
  { id: 'reasoning', label: 'Reasoning', test: (item) => item.supportsReasoning },
  { id: 'long', label: 'Long context', test: (item) => (item.contextLength || 0) >= 100_000 },
  { id: 'paid', label: 'Paid', test: (item) => !item.isFree },
];

export function filterModels(
  models: ModelInfo[],
  options: { search?: string; group?: string | null } = {},
): ModelInfo[] {
  const needle = (options.search || '').trim().toLowerCase();
  return models.filter((item) => {
    if (options.group && options.group !== 'all') {
      const group = MODEL_GROUPS.find((entry) => entry.id === options.group);
      if (group && !group.test(item)) return false;
    }
    if (!needle) return true;
    return `${item.id} ${item.name} ${item.vendor} ${item.description}`.toLowerCase().includes(needle);
  });
}
