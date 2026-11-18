// ---------------------------------------------------------------------------
// Model registry.
//
// The catalog (names, prices, context, capabilities) is synced from OpenRouter
// into fb_models. Personal preferences live in a different table entirely, so
// a sync can never re-enable a model the user turned off.
// ---------------------------------------------------------------------------

import { repo } from './repo.js';
import { db, auth } from './db.js';
import { TABLES, OPENROUTER } from '../config.js';
import { SEED_MODELS } from '../data/seed-models.js';

let cache = null;
let lastSyncAt = 0;

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function mapRemoteModel(raw) {
  const id = String(raw.id || '');
  const pricing = raw.pricing || {};
  const promptPrice = num(pricing.prompt, 0);
  const completionPrice = num(pricing.completion, 0);
  const parameters = Array.isArray(raw.supported_parameters) ? raw.supported_parameters : [];
  const inputs = raw.architecture?.input_modalities || [];
  return {
    id,
    name: raw.name || id,
    provider: id.split('/')[0] || 'unknown',
    description: String(raw.description || '').slice(0, 700),
    context_length: num(raw.context_length, 0),
    max_output: num(raw.top_provider?.max_completion_tokens, 0),
    price_in: Math.round(promptPrice * 1_000_000 * 10_000) / 10_000,
    price_out: Math.round(completionPrice * 1_000_000 * 10_000) / 10_000,
    is_free: id.endsWith(':free') || (promptPrice === 0 && completionPrice === 0),
    supports_tools: parameters.includes('tools'),
    supports_images: inputs.includes('image'),
    modality: raw.architecture?.modality || '',
    created_at_remote: num(raw.created, 0),
    raw: {
      canonical_slug: raw.canonical_slug || null,
      supported_parameters: parameters,
      input_modalities: inputs,
      per_request_limits: raw.per_request_limits || null,
    },
  };
}

/** Seed the registry the first time, so the app is usable before any sync. */
async function ensureSeeded() {
  const existing = await db.from(TABLES.models).select('id').limit(1);
  if (existing.length) return;
  const now = new Date().toISOString();
  const rows = SEED_MODELS.map((model) => ({
    ...model,
    first_seen_at: now,
    last_seen_at: now,
    unavailable_since: null,
  }));
  for (let i = 0; i < rows.length; i += 80) {
    await db.from(TABLES.models).upsert(rows.slice(i, i + 80), { onConflict: 'id' });
  }
}

/**
 * Pull the catalog from OpenRouter.
 * On any failure the previous registry is left untouched.
 */
export async function syncRegistry({ force = false } = {}) {
  if (!auth.isSignedIn) throw new Error('Sign in to sync the model registry.');
  if (!force && Date.now() - lastSyncAt < 60_000) {
    return { skipped: true, models: await loadRegistry() };
  }

  await ensureSeeded();
  const startedAt = new Date().toISOString();

  let payload;
  try {
    const res = await fetch(OPENROUTER.modelsUrl, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`OpenRouter returned ${res.status}`);
    payload = await res.json();
  } catch (err) {
    throw new Error(`Could not reach OpenRouter (${err.message}). The existing registry was kept.`);
  }

  const remote = (payload?.data || []).map(mapRemoteModel).filter((m) => m.id);
  if (!remote.length) throw new Error('OpenRouter returned an empty catalog; registry left unchanged.');

  const now = new Date().toISOString();
  const rows = remote.map((model) => ({ ...model, last_seen_at: now, unavailable_since: null }));

  let written = 0;
  for (let i = 0; i < rows.length; i += 80) {
    const chunk = rows.slice(i, i + 80);
    await db.from(TABLES.models).upsert(chunk, { onConflict: 'id' });
    written += chunk.length;
  }

  // Anything not seen this round disappears from selection but is kept, so
  // preferences and history survive a delisting.
  try {
    await db.from(TABLES.models)
      .update({ unavailable_since: now })
      .lt('last_seen_at', startedAt)
      .is('unavailable_since', null);
  } catch (err) {
    console.warn('could not flag delisted models', err);
  }

  try {
    await repo.saveSettings({ modelsSyncedAt: now });
  } catch { /* settings are best-effort */ }

  lastSyncAt = Date.now();
  cache = null;
  return { count: written, total: remote.length, syncedAt: now, models: await loadRegistry() };
}

export async function loadRegistry({ refresh = false } = {}) {
  if (cache && !refresh) return cache;
  cache = await repo.listModels();
  return cache;
}

export function invalidateRegistry() {
  cache = null;
}

export function applyPreferences(registry, prefs) {
  return registry.map((model) => ({
    ...model,
    enabled: prefs[model.id] ? prefs[model.id].enabled !== false : true,
    available: !model.unavailable_since,
  }));
}

const ROLE_WEIGHTS = {
  chat: { tools: 10, context: 10, free: 8 },
  plan: { tools: 14, context: 14, free: 8 },
  code: { tools: 24, context: 10, free: 8 },
  review: { tools: 8, context: 16, free: 8 },
};

function scoreModel(model, role, { preferFree }) {
  const weights = ROLE_WEIGHTS[role] || ROLE_WEIGHTS.chat;
  let score = 0;
  if (model.supports_tools) score += weights.tools;
  if (model.is_free && preferFree) score += weights.free;
  score += Math.min(weights.context, Math.log2((num(model.context_length, 0) / 1000) + 1) * 3);
  if (num(model.context_length, 0) < 16000) score -= 12;
  if (model.supports_images) score += 1;
  if (/preview|experimental|alpha|beta/i.test(model.id)) score -= 3;
  if (model.price_in > 5) score -= 4;
  return score;
}

/**
 * Choose a model for a role, plus a couple of fallbacks on other providers.
 * An explicit project/user choice always wins over auto-selection.
 */
export function pickModel(registry, prefs, settings, { role = 'code', preferred = '' } = {}) {
  const models = applyPreferences(registry, prefs).filter((m) => m.enabled && m.available);
  if (!models.length) {
    const any = applyPreferences(registry, prefs)[0];
    return { primary: any?.id || SEED_MODELS[0]?.id || '', fallbacks: [], model: any || null, auto: true };
  }

  const explicit = preferred
    || settings?.roleModels?.[role]
    || (role === 'code' ? settings?.defaultModel : '')
    || '';
  if (explicit) {
    const chosen = models.find((m) => m.id === explicit);
    if (chosen) {
      return {
        primary: chosen.id,
        fallbacks: rankModels(models, role, settings, chosen).slice(0, 2).map((m) => m.id),
        model: chosen,
        auto: false,
      };
    }
  }

  const ranked = rankModels(models, role, settings, null);
  const primary = ranked[0];
  const fallbacks = [];
  for (const candidate of ranked.slice(1)) {
    if (fallbacks.length >= 2) break;
    if (fallbacks.some((id) => id.split('/')[0] === candidate.provider)) continue;
    fallbacks.push(candidate.id);
  }
  return { primary: primary.id, fallbacks, model: primary, auto: true };
}

function rankModels(models, role, settings, exclude) {
  return [...models]
    .filter((m) => m.id !== exclude?.id)
    .sort((a, b) => scoreModel(b, role, settings || {}) - scoreModel(a, role, settings || {}));
}

export function describeModel(model) {
  if (!model) return 'unknown model';
  const bits = [];
  if (model.is_free) bits.push('free');
  else if (model.price_in != null) bits.push(`$${Number(model.price_in).toFixed(2)}/M in`);
  if (model.context_length) bits.push(`${Math.round(model.context_length / 1000)}K ctx`);
  if (model.supports_tools) bits.push('tools');
  return bits.join(' · ');
}

export async function loadModelState() {
  const [registry, prefs] = await Promise.all([loadRegistry(), repo.listPrefs()]);
  return { registry, prefs, models: applyPreferences(registry, prefs) };
}
