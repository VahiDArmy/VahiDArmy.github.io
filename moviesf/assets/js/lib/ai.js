/* ============================================================================
   FULL METAL CINEMA — AI engine
   Bring-your-own-key. Streaming. Real reasoning traces.
   Runs entirely in the browser: no edge function, no proxy, no server.
   Optional Supabase edge fallback exists but is never required.
   ========================================================================== */

import { PROVIDERS, DEFAULT_AI, APP } from '../config.js';
import { localStorageSafe as ls } from './client.js';
import { state } from './store.js';

const VAULT_KEY = `${APP.storagePrefix}vault`;
const KEYS_KEY = `${APP.storagePrefix}aikeys`;
const META_KEY = `${APP.storagePrefix}vaultmeta`;

/* ========================================================================== */
/*  VAULT — keys on this device only                                         */
/* ========================================================================== */
export function listKeys() {
  return ls.get(KEYS_KEY, {});
}

export function getKeyRecord(providerId) {
  const all = listKeys();
  return all[providerId] || { key: '', baseUrl: '', model: '', savedAt: null };
}

export function saveKeyRecord(providerId, patch) {
  const all = listKeys();
  all[providerId] = { ...(all[providerId] || {}), ...patch, savedAt: new Date().toISOString() };
  ls.set(KEYS_KEY, all);
  return all[providerId];
}

export function clearKey(providerId) {
  const all = listKeys();
  delete all[providerId];
  ls.set(KEYS_KEY, all);
}

export function keyStatus() {
  const all = listKeys();
  return Object.fromEntries(Object.entries(all).map(([k, v]) => [k, !!(v.key && v.key.length > 6)]));
}

export function activeKey() {
  const ai = state.ai || DEFAULT_AI;
  const rec = getKeyRecord(ai.provider);
  return rec.key || '';
}

export function maskKey(key) {
  if (!key) return '';
  if (key.length <= 10) return '•'.repeat(key.length);
  return `${key.slice(0, 5)}${'•'.repeat(Math.min(18, key.length - 9))}${key.slice(-4)}`;
}

/* ---- optional passphrase encryption (AES-GCM, PBKDF2) ------------------- */
const enc = new TextEncoder();
const dec = new TextDecoder();

async function deriveKey(passphrase, salt, usage) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  );
}

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function vaultIsLocked() {
  const meta = ls.get(META_KEY, null);
  return !!meta?.locked;
}

export async function lockVault(passphrase) {
  const keys = listKeys();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, 'encrypt');
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(keys)));
  ls.set(VAULT_KEY, { salt: b64(salt), iv: b64(iv), data: b64(cipher) });
  ls.set(KEYS_KEY, {});
  ls.set(META_KEY, { locked: true, at: new Date().toISOString() });
  return true;
}

export async function unlockVault(passphrase) {
  const blob = ls.get(VAULT_KEY, null);
  if (!blob) throw new Error('No sealed vault on this device');
  const salt = unb64(blob.salt), iv = unb64(blob.iv);
  const key = await deriveKey(passphrase, salt, 'decrypt');
  let plain;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, unb64(blob.data));
  } catch {
    throw new Error('Passphrase rejected');
  }
  const keys = JSON.parse(dec.decode(plain));
  ls.set(KEYS_KEY, keys);
  ls.set(META_KEY, { locked: false, at: new Date().toISOString() });
  return keys;
}

export function destroyVault() {
  ls.del(VAULT_KEY);
  ls.del(KEYS_KEY);
  ls.del(META_KEY);
}

/* ========================================================================== */
/*  PROVIDER RESOLUTION                                                      */
/* ========================================================================== */
export function providerById(id) {
  return PROVIDERS.find((p) => p.id === id) || PROVIDERS[0];
}

export function resolveAiConfig(overrides = {}) {
  const ai = { ...DEFAULT_AI, ...(state.ai || {}), ...overrides };
  const provider = providerById(ai.provider);
  const rec = getKeyRecord(ai.provider);
  const baseUrl = (ai.baseUrl || rec.baseUrl || provider.baseUrl || '').replace(/\/+$/, '');
  const model = ai.model || rec.model || provider.defaultModel;
  const apiKey = ai.apiKey || rec.key || '';
  return {
    ...ai,
    providerMeta: provider,
    baseUrl,
    model,
    apiKey,
    ready: !!baseUrl && !!model,
    keyless: provider.id === 'ollama',
  };
}

export function estimateTokens(text) {
  return Math.max(1, Math.ceil(String(text || '').length / 3.9));
}

/* ========================================================================== */
/*  MODEL CATALOGUE                                                          */
/* ========================================================================== */
export async function fetchModels(cfg = resolveAiConfig()) {
  const { providerMeta, baseUrl, apiKey } = cfg;
  const url = `${baseUrl}${providerMeta.modelsPath || '/models'}`;
  const headers = { ...authHeaders(providerMeta, apiKey) };
  const res = await fetch(url, { headers });
  if (!res.ok) throw await httpError(res);
  const data = await res.json();
  const list = data.data || data.models || (Array.isArray(data) ? data : []);
  return list.map((m) => ({
    id: m.id || m.name || m.model,
    label: m.name || m.id || m.model,
    context: m.context_length || m.context_window || m.context || null,
    pricing: m.pricing || null,
  })).filter((m) => m.id).sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function authHeaders(provider, apiKey) {
  const h = { 'Content-Type': 'application/json' };
  if (provider.kind === 'anthropic') {
    h['x-api-key'] = apiKey;
    h['anthropic-version'] = '2023-06-01';
    h['anthropic-dangerous-direct-browser-access'] = 'true';
  } else {
    if (apiKey) h.Authorization = `Bearer ${apiKey}`;
  }
  if (provider.id === 'openrouter') {
    h['HTTP-Referer'] = location.origin;
    h['X-Title'] = APP.name;
  }
  return h;
}

async function httpError(res) {
  let body = '';
  try { body = await res.text(); } catch { /* ignore */ }
  let msg = `HTTP ${res.status}`;
  try {
    const j = JSON.parse(body);
    msg = j.error?.message || j.message || j.error || msg;
    if (typeof msg === 'object') msg = JSON.stringify(msg);
  } catch { if (body) msg = body.slice(0, 260); }
  const hint = res.status === 401
    ? 'The key was rejected. Check Settings › AI Studio.'
    : res.status === 402
      ? 'The provider wants credit on this key.'
      : res.status === 429
        ? 'Rate limited. Wait a moment or switch model.'
        : res.status === 404
          ? 'That model or base URL does not exist at this provider.'
          : '';
  const err = new Error(msg);
  err.status = res.status;
  err.hint = hint;
  return err;
}

/* ========================================================================== */
/*  CHAT — streaming with reasoning                                          */
/* ========================================================================== */
/**
 * Send a chat completion and stream it.
 * @returns {Promise<{text, reasoning, usage, latency, model, stopped}>}
 */
export async function chat({
  messages,
  config = {},
  signal,
  onDelta = () => {},
  onReasoning = () => {},
  onMeta = () => {},
} = {}) {
  const cfg = resolveAiConfig(config);
  if (!cfg.ready) throw new Error('No model configured. Open Settings › AI Studio.');
  if (!cfg.apiKey && !cfg.keyless) throw new Error('No API key stored on this device for this provider.');

  const started = performance.now();
  if (cfg.providerMeta.kind === 'anthropic') {
    return anthropicChat(cfg, messages, { signal, onDelta, onReasoning, onMeta, started });
  }
  return openaiChat(cfg, messages, { signal, onDelta, onReasoning, onMeta, started });
}

function buildSystem(cfg, extraContext) {
  const parts = [cfg.systemPrompt].filter(Boolean);
  if (extraContext) parts.push(`\n--- DOSSIER CONTEXT ---\n${extraContext}`);
  return parts.join('\n');
}

/* ---- OpenAI-compatible (OpenRouter, OpenAI, Groq, Ollama, custom) ------- */
async function openaiChat(cfg, messages, { signal, onDelta, onReasoning, onMeta, started }) {
  const provider = cfg.providerMeta;
  const body = {
    model: cfg.model,
    messages: [
      ...(cfg.systemPrompt ? [{ role: 'system', content: buildSystem(cfg, cfg.context) }] : []),
      ...messages,
    ],
    temperature: Number(cfg.temperature ?? 0.7),
    max_tokens: Number(cfg.maxTokens || 1800),
    stream: !!cfg.streaming,
  };

  // reasoning plumbing differs by provider
  if (cfg.reasoning) {
    if (provider.id === 'openrouter' || provider.id === 'custom') {
      body.reasoning = { effort: cfg.reasoningEffort || 'medium' };
      if (cfg.reasoningEffort === 'custom') body.reasoning = { max_tokens: Number(cfg.reasoningBudget || 2048) };
    } else if (provider.id === 'openai') {
      body.reasoning_effort = cfg.reasoningEffort === 'low' ? 'low' : cfg.reasoningEffort === 'high' ? 'high' : 'medium';
      // reasoning models reject temperature
      if (/^(o\d|gpt-5)/i.test(cfg.model)) { delete body.temperature; delete body.max_tokens; body.max_completion_tokens = Number(cfg.maxTokens || 1800); }
    }
  }
  if (provider.id === 'openrouter') {
    body.provider = { allow_fallbacks: true };
  }

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: authHeaders(provider, cfg.apiKey),
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await httpError(res);

  if (!cfg.streaming) {
    const data = await res.json();
    const choice = data.choices?.[0];
    const text = choice?.message?.content || '';
    const reasoning = choice?.message?.reasoning || choice?.message?.reasoning_content || '';
    const usage = data.usage || {};
    onMeta({ model: data.model || cfg.model, usage });
    if (reasoning) onReasoning(reasoning, reasoning);
    if (text) onDelta(text, text);
    const latency = Math.round(performance.now() - started);
    logUsage({ provider: provider.id, model: cfg.model, usage, latency, ok: true, reasoning: cfg.reasoning });
    return { text, reasoning, usage, latency, model: data.model || cfg.model, stopped: false };
  }

  let text = '', reasoning = '';
  let usage = {};
  let model = cfg.model;
  let stopped = false;

  await readSse(res, (evt, data) => {
    if (data === '[DONE]') return;
    let json;
    try { json = JSON.parse(data); } catch { return; }
    if (json.error) throw new Error(json.error.message || 'Provider error');
    if (json.model) model = json.model;
    if (json.usage) usage = json.usage;
    const delta = json.choices?.[0]?.delta || {};
    const rChunk = delta.reasoning || delta.reasoning_content
      || (Array.isArray(delta.reasoning_details) ? delta.reasoning_details.map((d) => d.text || '').join('') : '');
    if (rChunk) { reasoning += rChunk; onReasoning(rChunk, reasoning); }
    const chunk = delta.content || '';
    if (chunk) { text += chunk; onDelta(chunk, text); }
  }, () => { stopped = true; });

  const latency = Math.round(performance.now() - started);
  if (!usage || !usage.total_tokens) {
    usage = { prompt_tokens: estimateTokens(JSON.stringify(messages)), completion_tokens: estimateTokens(text), total_tokens: estimateTokens(JSON.stringify(messages)) + estimateTokens(text) };
  }
  onMeta({ model, usage, latency });
  logUsage({ provider: provider.id, model, usage, latency, ok: true, reasoning: cfg.reasoning });
  return { text, reasoning, usage, latency, model, stopped };
}

/* ---- Anthropic Messages API -------------------------------------------- */
async function anthropicChat(cfg, messages, { signal, onDelta, onReasoning, onMeta, started }) {
  const provider = cfg.providerMeta;
  const budget = Math.max(1024, Math.min(Number(cfg.reasoningBudget || 2048), Number(cfg.maxTokens || 1800) - 512));
  const body = {
    model: cfg.model,
    max_tokens: cfg.reasoning ? Math.max(Number(cfg.maxTokens || 1800), budget + 1024) : Number(cfg.maxTokens || 1800),
    messages: messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    stream: !!cfg.streaming,
  };
  if (cfg.systemPrompt) body.system = buildSystem(cfg, cfg.context);
  if (cfg.reasoning) {
    body.thinking = { type: 'enabled', budget_tokens: budget };
    // Anthropic requires temperature = 1 while thinking
  } else {
    body.temperature = Number(cfg.temperature ?? 0.7);
  }

  const res = await fetch(`${cfg.baseUrl}/messages`, {
    method: 'POST',
    headers: authHeaders(provider, cfg.apiKey),
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await httpError(res);

  if (!cfg.streaming) {
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    const reasoning = (data.content || []).filter((b) => b.type === 'thinking').map((b) => b.thinking).join('');
    const usage = {
      prompt_tokens: data.usage?.input_tokens,
      completion_tokens: data.usage?.output_tokens,
      total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    };
    if (reasoning) onReasoning(reasoning, reasoning);
    if (text) onDelta(text, text);
    const latency = Math.round(performance.now() - started);
    onMeta({ model: data.model, usage, latency });
    logUsage({ provider: provider.id, model: data.model, usage, latency, ok: true, reasoning: cfg.reasoning });
    return { text, reasoning, usage, latency, model: data.model || cfg.model, stopped: false };
  }

  let text = '', reasoning = '';
  let usage = {};
  let model = cfg.model;
  let stopped = false;

  await readSse(res, (evt, data) => {
    let json;
    try { json = JSON.parse(data); } catch { return; }
    if (!json) return;
    if (json.type === 'message_start') {
      model = json.message?.model || model;
      usage = {
        prompt_tokens: json.message?.usage?.input_tokens || 0,
        completion_tokens: json.message?.usage?.output_tokens || 0,
        total_tokens: (json.message?.usage?.input_tokens || 0) + (json.message?.usage?.output_tokens || 0),
      };
    }
    if (json.type === 'content_block_delta') {
      const d = json.delta || {};
      if (d.type === 'thinking_delta' && d.thinking) { reasoning += d.thinking; onReasoning(d.thinking, reasoning); }
      if (d.type === 'text_delta' && d.text) { text += d.text; onDelta(d.text, text); }
    }
    if (json.type === 'message_delta' && json.usage) {
      usage.completion_tokens = json.usage.output_tokens ?? usage.completion_tokens;
      usage.total_tokens = (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
    }
    if (json.type === 'error') throw new Error(json.error?.message || 'Anthropic stream error');
  }, () => { stopped = true; });

  const latency = Math.round(performance.now() - started);
  onMeta({ model, usage, latency });
  logUsage({ provider: provider.id, model, usage, latency, ok: true, reasoning: cfg.reasoning });
  return { text, reasoning, usage, latency, model, stopped };
}

/* ---- SSE reader --------------------------------------------------------- */
async function readSse(res, onEvent, onEnd) {
  if (!res.body) throw new Error('Streaming is not supported by this browser or proxy');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        let evt = 'message';
        const dataLines = [];
        for (const line of raw.split('\n')) {
          if (line.startsWith('event:')) evt = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
        }
        if (dataLines.length) onEvent(evt, dataLines.join('\n'));
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* ignore */ }
    onEnd && onEnd();
  }
}

/* ---- usage ledger ------------------------------------------------------- */
async function logUsage({ provider, model, usage = {}, latency = 0, ok = true, reasoning = false, error = '' }) {
  const c = state.client;
  if (!c?.user) return;
  const row = {
    provider,
    model,
    prompt_tokens: usage.prompt_tokens || usage.input_tokens || 0,
    completion_tokens: usage.completion_tokens || usage.output_tokens || 0,
    total_tokens: usage.total_tokens || 0,
    latency_ms: latency,
    ok,
    reasoning,
    error: String(error || '').slice(0, 400),
    user_id: c.user.id,
  };
  state.tables.usage = [{ ...row, id: `u-${Date.now()}`, created_at: new Date().toISOString() }, ...(state.tables.usage || [])].slice(0, 300);
  try { await c.from('cinema_ai_usage').insert([row]); } catch { c.queue({ table: 'cinema_ai_usage', op: 'insert', rows: [row] }); }
}

/* ---- edge fallback (optional, only if operator configured it) ---------- */
export async function chatViaEdge(messages, { onDelta = () => {} } = {}) {
  const c = state.client;
  if (!c?.edgeAiFunction) throw new Error('No edge function configured in config.js');
  const data = await c.callEdge({ messages, model: resolveAiConfig().model });
  const text = data?.text || data?.content || '';
  if (text) onDelta(text, text);
  return { text, reasoning: data?.reasoning || '', usage: data?.usage || {}, latency: 0, model: data?.model || 'edge' };
}

/* ========================================================================== */
/*  PROMPT / CONTEXT BUILDING                                                */
/* ========================================================================== */
export function dossierContext(title, extras = {}) {
  if (!title) return '';
  const lines = [
    `TITLE: ${title.title}`,
    title.original_title ? `ORIGINAL: ${title.original_title}` : '',
    `TYPE: ${title.type} · CATEGORY: ${title.category}`,
    title.year ? `YEAR: ${title.year}` : '',
    title.genre ? `GENRE: ${title.genre}` : '',
    title.country ? `COUNTRY: ${title.country}` : '',
    title.language ? `LANGUAGE: ${title.language}` : '',
    title.status ? `STATUS: ${title.status}` : '',
    Number(title.rating) ? `MY SCORE: ${title.rating}/10` : '',
    title.seasons ? `SEASONS: ${title.seasons}` : '',
    title.episodes ? `EPISODES: ${title.episodes}` : '',
    title.tags ? `TAGS: ${title.tags}` : '',
    title.summary ? `SUMMARY: ${title.summary}` : '',
    title.story_analysis ? `MY ANALYSIS: ${title.story_analysis}` : '',
    title.notes ? `MY NOTES: ${title.notes}` : '',
    title.reason ? `WHY: ${title.reason}` : '',
    extras.rating ? `CRITERIA: ${JSON.stringify(extras.rating)}` : '',
    extras.quotes?.length ? `QUOTES: ${extras.quotes.map((q) => `"${q.text}"`).join(' | ')}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

export function fillTemplate(body, vars = {}) {
  return String(body || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars[k] != null ? vars[k] : `{{${k}}}`));
}

export function historySlice(messages, depth = 8) {
  if (!depth || depth <= 0) return messages.slice(-2);
  return messages.slice(-depth * 2);
}

/* ---- extract a JSON object from a model reply -------------------------- */
export function extractJson(text) {
  const s = String(text || '');
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : s;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  const slice = candidate.slice(start, end + 1);
  try { return JSON.parse(slice); } catch { /* try a light repair */ }
  try {
    return JSON.parse(slice.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']').replace(/[\u201c\u201d]/g, '"'));
  } catch { return null; }
}

/* ---- one-shot helpers used across the app ------------------------------ */
export async function askOnce(prompt, { title = null, config = {}, signal } = {}) {
  const messages = [{ role: 'user', content: prompt }];
  return chat({ messages, config: { ...config, context: title ? dossierContext(title) : '' }, signal });
}

export const AI_PRESETS = [
  {
    id: 'review', label: 'Write the review',
    build: (t) => `Write a review of "${t?.title}" in 220 words. Open with the strongest image, state the thesis in one sentence, then name the one scene that proves it. No plot summary beyond what is needed.`,
  },
  {
    id: 'standardise', label: 'Standardise dossier',
    build: (t) => `Return ONLY a JSON object for "${t?.title}" with keys: genre (comma separated, lowercase), country, language, year (number), seasons (number or null), episodes (number or null), status ("watched"|"watching"|"planned"|"dropped"), summary (max 45 words), story_analysis (max 120 words), tags (comma separated). If unsure of a fact use empty string.`,
  },
  {
    id: 'similar', label: 'Six neighbours',
    build: (t) => `List six titles a person who loves "${t?.title}" would also keep. One line each: title (year, country) — the exact thing they share, not genre labels.`,
  },
  {
    id: 'critique', label: 'Audit my score',
    build: (t) => `I rated "${t?.title}" ${t?.rating}/10 and put it in "${t?.category}". Argue against my placement using only evidence from the work. Be specific and brief.`,
  },
  {
    id: 'analysis', label: 'Theme autopsy',
    build: (t) => `State the thesis of "${t?.title}" in one sentence. Then give three scenes that prove it and one that contradicts it, with approximate timestamps or episode numbers.`,
  },
  {
    id: 'pitch', label: 'Sequel pitch',
    build: (t) => `Pitch a sequel to "${t?.title}" set twelve years later. Three loglines and one poster tagline. Keep the original's moral cost.`,
  },
];

export function providerKindLabel(p) {
  return { openai: 'OpenAI-compatible', anthropic: 'Anthropic', ollama: 'Local runtime' }[p.kind] || p.kind;
}
