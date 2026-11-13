// ============================================================================
// models.js — fetch, normalize and cache OpenRouter catalogue
// ============================================================================

import { OPENROUTER_MODELS, LS, DEFAULTS, AUTO_FREE_MODEL, APP_URL, APP_NAME } from "./config.js";
import { store, api as _ignore } from "./store.js";
import { sb } from "./supabase.js";
import { tryJson, debounce } from "./utils.js";

const LS_CACHE = LS.modelsCache;

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------
function isFreePricing(pricing) {
  if (!pricing) return true;
  const keys = ["prompt", "completion", "request", "image"];
  for (const k of keys) {
    const v = pricing[k];
    if (v == null) continue;
    const n = Number(v);
    if (isFinite(n) && n > 0) return false;
  }
  return true;
}

export function normalizeModel(raw) {
  if (!raw) return null;
  const id = raw.id || "";
  const pricing = raw.pricing || {};
  const free = isFreePricing(pricing);
  const arch = raw.architecture || {};
  const ctx =
    Number(raw.context_length) ||
    Number(arch.context_length) ||
    Number(raw.top_provider?.context_length) ||
    0;
  const maxOut = Number(raw.top_provider?.max_completion_tokens) || null;
  return {
    id,
    name: raw.name || id,
    description: raw.description || "",
    context_length: ctx,
    max_completion_tokens: maxOut,
    pricing,
    architecture: arch,
    supported_parameters: Array.isArray(raw.supported_parameters) ? raw.supported_parameters : [],
    modality: arch.modality || "",
    is_free: free,
    raw,
    enabled: true,
    favorite: false,
    hidden: false,
    sort_index: 0,
    fetched_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Fetch from OpenRouter (no auth needed for /models)
// ---------------------------------------------------------------------------
export async function fetchOpenRouterModels({ force = false } = {}) {
  // If a fresh cache exists and not forced, use it
  if (!force) {
    const cached = tryJson(localStorage.getItem(LS_CACHE) || "null");
    if (cached && cached.ts && Date.now() - cached.ts < DEFAULTS.model_refresh_ms) {
      return cached.list || [];
    }
  }
  const res = await fetch(OPENROUTER_MODELS, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`OpenRouter /models → HTTP ${res.status}`);
  }
  const json = await res.json();
  const list = Array.isArray(json?.data) ? json.data : [];
  const normalized = list.map(normalizeModel).filter(Boolean);
  // Only keep free models + the special openrouter/free pseudo model
  const freeModels = normalized.filter((m) => m.is_free);
  // Persist cache
  try {
    localStorage.setItem(LS_CACHE, JSON.stringify({ ts: Date.now(), list: freeModels }));
  } catch {}
  return freeModels;
}

// ---------------------------------------------------------------------------
// Try to upsert into Supabase (best-effort, may fail if table missing)
// ---------------------------------------------------------------------------
async function persistToSupabase(list) {
  if (!list.length) return;
  // Don't upsert the whole raw blob twice — keep it small
  const slim = list.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    context_length: m.context_length,
    max_completion_tokens: m.max_completion_tokens,
    pricing: m.pricing,
    architecture: m.architecture,
    supported_parameters: m.supported_parameters,
    modality: m.modality,
    is_free: m.is_free,
    enabled: true,
    sort_index: m.sort_index || 0,
    fetched_at: m.fetched_at,
    raw: { id: m.id, name: m.name }, // keep raw tiny for now
  }));
  try {
    await sb.upsertModels(slim);
  } catch (e) {
    console.warn("[models] supabase upsert failed (fallback to cache):", e.message);
  }
}

// ---------------------------------------------------------------------------
// Load the catalogue
// ---------------------------------------------------------------------------
export async function loadModels({ force = false } = {}) {
  const s = store.get();
  if (s.modelsLoading) return s.models;
  store.set({ modelsLoading: true, modelsError: null }, "models:loading");

  let list = [];
  let err = null;

  // Try Supabase first (fast, already normalised)
  try {
    const rows = await sb.listModels({ onlyFree: false });
    if (Array.isArray(rows) && rows.length > 0) {
      list = rows
        .map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description || "",
          context_length: r.context_length || 0,
          max_completion_tokens: r.max_completion_tokens || null,
          pricing: r.pricing || {},
          architecture: r.architecture || {},
          supported_parameters: Array.isArray(r.supported_parameters) ? r.supported_parameters : [],
          modality: r.modality || "",
          is_free: !!r.is_free,
          enabled: r.enabled !== false,
          favorite: !!r.favorite,
          hidden: !!r.hidden,
          sort_index: r.sort_index || 0,
          fetched_at: r.fetched_at || new Date().toISOString(),
        }))
        .filter((m) => m.is_free);
    }
  } catch (e) {
    // ignore, fall back to remote fetch
  }

  if (!list.length) {
    try {
      list = await fetchOpenRouterModels({ force });
      persistToSupabase(list).catch(() => {});
    } catch (e) {
      err = e;
      // Last resort — try cached
      const cached = tryJson(localStorage.getItem(LS_CACHE) || "null");
      if (cached && Array.isArray(cached.list)) list = cached.list;
    }
  }

  // Merge favourites from localStorage
  const favs = tryJson(localStorage.getItem(LS.modelFavs) || "{}") || {};
  list = list.map((m) => ({ ...m, favorite: !!favs[m.id] }));
  // Pinned auto model at top
  list = list.filter((m) => m.id !== AUTO_FREE_MODEL);
  list.sort((a, b) => {
    if (!!b.favorite !== !!a.favorite) return b.favorite ? 1 : -1;
    // Prefer bigger context
    return (b.context_length || 0) - (a.context_length || 0);
  });

  store.set(
    {
      models: list,
      modelsLoading: false,
      modelsLoaded: true,
      modelsError: err ? String(err.message || err) : null,
    },
    "models:change"
  );
  return list;
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------
export function findModel(id) {
  if (!id) return null;
  if (id === AUTO_FREE_MODEL) {
    return {
      id: AUTO_FREE_MODEL,
      name: "Auto · Free",
      description:
        "انتخاب خودکار مدل‌های رایگان توسط OpenRouter. مدل واقعیِ انتخاب‌شده در سربرگ پاسخ گزارش می‌شود.",
      context_length: 0,
      max_completion_tokens: null,
      is_free: true,
      favorite: true,
    };
  }
  return store.get().models.find((m) => m.id === id) || null;
}

export function modelDisplayName(id) {
  if (id === AUTO_FREE_MODEL) return "Auto · Free";
  const m = findModel(id);
  if (m && m.name) {
    // OpenRouter model names look like "Provider: Model Name"
    return m.name.replace(/^[^:]+:\s*/, "");
  }
  return id || "—";
}

export function modelContextLength(id) {
  if (id === AUTO_FREE_MODEL) return 0;
  const m = findModel(id);
  return m ? m.context_length || 0 : 0;
}
