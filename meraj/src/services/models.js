/** Model catalogue synchronisation and presentation helpers. */
import { CONFIG } from '../config.js';
import { fetchModelCatalogue, errorRecordFrom } from './openrouter.js';
import * as db from './db.js';
import { toIso, modelBadges, providerFromSlug, prettyModelName, formatContext } from '../utils.js';

function toDbRow(userId, model) {
  return {
    user_id: userId,
    slug: model.slug,
    canonical_slug: model.canonical_slug || model.slug,
    name: model.name,
    provider: model.provider || providerFromSlug(model.slug),
    description: model.description || '',
    context_length: model.context_length ?? null,
    max_completion_tokens: model.max_completion_tokens ?? null,
    architecture: model.architecture || {},
    pricing: model.pricing || {},
    supported_parameters: model.supported_parameters || [],
    is_free: true,
    metadata: model.metadata || {},
    last_synced_at: toIso(),
  };
}

export function latestModelSync(models = []) {
  let newest = 0;
  for (const model of models) {
    const time = new Date(model.last_synced_at || 0).getTime();
    if (time > newest) newest = time;
  }
  return newest ? new Date(newest) : null;
}

export function modelsAreStale(models = []) {
  if (!models.length) return true;
  const latest = latestModelSync(models);
  if (!latest) return true;
  return Date.now() - latest.getTime() > CONFIG.limits.modelSyncHours * 3600000;
}

/**
 * Fetch free models and upsert them for this user.
 * Flags (`is_active`, `is_favorite`) are deliberately not in the payload, so a
 * re-sync can never silently reactivate models the user turned off.
 */
export async function syncFreeModels(userId, { currentModels = [], force = false } = {}) {
  if (!userId) {
    return { skipped: true, reason: 'No authenticated user.', models: currentModels, error: null };
  }
  if (!force && !modelsAreStale(currentModels)) {
    return {
      skipped: true,
      reason: `Catalogue is fresh (synced ${latestModelSync(currentModels)?.toISOString() || 'recently'}).`,
      models: currentModels,
      error: null,
    };
  }

  let catalogue;
  try {
    catalogue = await fetchModelCatalogue();
  } catch (error) {
    return {
      skipped: false,
      models: currentModels,
      error: errorRecordFrom(error),
      errorObject: error,
      catalogue: null,
    };
  }

  if (!catalogue.models.length) {
    return {
      skipped: false,
      models: currentModels,
      error: {
        kind: 'empty-catalogue',
        message: 'OpenRouter returned no free text models on this sync.',
        at: new Date().toISOString(),
        bodyText: '',
        parsed: null,
        status: 200,
        statusText: 'OK',
      },
      catalogue,
    };
  }

  const rows = catalogue.models.map((model) => toDbRow(userId, model));
  const { data, error } = await db.upsertModels(rows);
  if (error) {
    return {
      skipped: false,
      models: currentModels,
      error: { kind: 'database', ...error, at: new Date().toISOString() },
      catalogue,
    };
  }

  return {
    skipped: false,
    models: data || currentModels,
    error: null,
    catalogue,
    insertedOrUpdated: rows.length,
    totalCatalogue: catalogue.totalCatalogue,
    fetchedAt: catalogue.fetchedAt,
  };
}

export function getModelOrFallback(models, slug) {
  if (!slug) return null;
  const found = models.find((model) => model.slug === slug);
  if (found) return found;
  return {
    slug,
    name: prettyModelName(slug),
    provider: providerFromSlug(slug),
    description: 'This model answered but is not in the stored free-model catalogue. Its capabilities are unknown here; the request is still sent to exactly this slug.',
    context_length: null,
    supported_parameters: [],
    architecture: {},
    is_free: true,
    is_active: true,
    is_favorite: false,
    discovered: true,
  };
}

export function activeModels(models, currentSlug = null) {
  return models.filter((model) => model.is_active || model.slug === currentSlug || model.slug === 'openrouter/free');
}

export function sortModels(models, mode = 'name') {
  const list = [...models];
  switch (mode) {
    case 'context':
      return list.sort((a, b) => (b.context_length || 0) - (a.context_length || 0));
    case 'recent':
      return list.sort((a, b) => new Date(b.last_synced_at || 0) - new Date(a.last_synced_at || 0));
    case 'favorite':
      return list.sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || a.name.localeCompare(b.name));
    case 'active':
      return list.sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name));
    case 'name':
    default:
      return list.sort((a, b) => a.name.localeCompare(b.name));
  }
}

export function filterModels(models, { query = '', status = 'all', capability = 'all' } = {}) {
  const needle = query.trim().toLowerCase();
  return models.filter((model) => {
    if (status === 'active' && !model.is_active) return false;
    if (status === 'inactive' && model.is_active) return false;
    if (status === 'favorite' && !model.is_favorite) return false;
    if (status === 'router' && model.slug !== 'openrouter/free') return false;
    if (capability !== 'all') {
      const badges = modelBadges(model).map((badge) => badge.key);
      if (!badges.includes(capability)) return false;
    }
    if (!needle) return true;
    const haystack = `${model.name} ${model.slug} ${model.provider} ${model.description}`.toLowerCase();
    return haystack.includes(needle);
  });
}

export function modelMetaLine(model) {
  if (!model) return 'Unknown model';
  return `${model.provider || providerFromSlug(model.slug)} · ${formatContext(model.context_length)} context`;
}

export function routerNameFor(slug) {
  return slug === 'openrouter/free' ? 'Free Models Router' : prettyModelName(slug);
}

export function modelSortLabel(mode) {
  return (
    {
      name: 'Name',
      context: 'Context window',
      recent: 'Newest sync',
      favorite: 'Favourites first',
      active: 'Active first',
    }[mode] || 'Name'
  );
}

export function usageStatsForModel(events, slug) {
  const relevant = events.filter((event) => event.model_slug === slug || event.requested_model === slug);
  const ok = relevant.filter((event) => event.status === 'ok');
  const errors = relevant.filter((event) => event.status === 'error');
  const tokens = relevant.reduce((sum, event) => sum + (event.total_tokens || 0), 0);
  const latencyTotal = ok.reduce((sum, event) => sum + (event.latency_ms || 0), 0);
  return {
    requests: relevant.length,
    ok: ok.length,
    errors: errors.length,
    tokens,
    avgLatency: ok.length ? Math.round(latencyTotal / ok.length) : null,
    successRate: relevant.length ? (ok.length / relevant.length) * 100 : null,
    lastUsed: relevant[0]?.created_at || null,
  };
}
