/**
 * Food catalog service.
 *
 * The catalog (data/foods.json) ships with the site and is loaded once at
 * startup, indexed in memory, and exposed via `foods` service. We do NOT
 * hit Supabase for the catalog itself — only user-entered logs go to the
 * database.
 *
 * Search supports Persian text with:
 *  - diacritic-insensitive matching (ي → ی، ك → ک)
 *  - ZWNJ ("نیم‌فاصله") normalization
 *  - numeric normalization (Persian digits)
 *  - substring on Persian name, English name, and calories as fallback
 */

import { bus } from "../core/event-bus.js";
import { toLatinDigits } from "../utils/format.js";
import { normalizeText } from "../utils/validation.js";

const FOODS_URL = "data/foods.json";
const CACHE_VERSION = "v1";
const CACHE_KEY = "activity-tracker:foods:" + CACHE_VERSION;

let catalog = [];
let index = null;
let loadingPromise = null;
let loaded = false;

/* ---------- Normalization --------------------------------------------- */
function normalizePersian(str) {
  return String(str || "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u064B-\u0652]/g, "") // harakat
    .replace(/\u200c/g, " ")         // ZWNJ → space
    .replace(/[أإآ]/g, "ا")
    .replace(/[ۀهٔ]/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/* ---------- Indexing -------------------------------------------------- */
function buildIndex(rows) {
  const byId = new Map();
  const tokens = new Map(); // token -> Set<rowIdx>

  rows.forEach((row, i) => {
    const persian = normalizePersian(row.Persian_Name);
    const english = String(row.Name_En || "").toLowerCase();
    const id = `${persian}__${english}__${i}`;
    byId.set(id, { ...row, _id: id, _persian: persian, _english: english });

    // Tokenize: every prefix of every word so "آب آل" finds "آب آلبالو"
    const words = (persian + " " + english).split(/[\s\-_/]+/);
    for (const w of words) {
      if (!w) continue;
      for (let len = 2; len <= w.length; len++) {
        const t = w.slice(0, len);
        if (!tokens.has(t)) tokens.set(t, new Set());
        tokens.get(t).add(id);
      }
    }
  });

  return { byId, tokens };
}

/* ---------- Loading --------------------------------------------------- */
async function fetchCatalog() {
  // 1. Try localStorage cache first for instant boot
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch { /* ignore */ }

  const res = await fetch(FOODS_URL, { cache: "force-cache" });
  if (!res.ok) throw new Error("Failed to load food catalog");
  const data = await res.json();
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch { /* quota — skip caching */ }
  return data;
}

/* ---------- Public service -------------------------------------------- */
export const foods = {
  async load() {
    if (loaded) return catalog;
    if (loadingPromise) return loadingPromise;
    loadingPromise = (async () => {
      const rows = await fetchCatalog();
      catalog = rows;
      index = buildIndex(rows);
      loaded = true;
      bus.emit("foods:loaded", { count: rows.length });
      return catalog;
    })().catch((err) => {
      loadingPromise = null;
      bus.emit("foods:error", err);
      throw err;
    });
    return loadingPromise;
  },

  isLoaded() {
    return loaded;
  },

  /** Full list (copy). Use with caution — can be large. */
  all() {
    return catalog.slice();
  },

  count() {
    return catalog.length;
  },

  getById(id) {
    return index?.byId.get(id) || null;
  },

  /**
   * Search the catalog.
   *   foods.search("آب آلبالو", { limit: 20 })
   * Returns rows sorted by relevance (exact prefix > prefix > substring).
   */
  search(query, { limit = 40 } = {}) {
    if (!index) return [];
    const q = normalizePersian(toLatinDigits(String(query || "")));
    if (!q) return catalog.slice(0, limit);

    const matches = index.tokens.get(q);
    const results = [];

    if (matches) {
      for (const id of matches) {
        const row = index.byId.get(id);
        if (!row) continue;
        const score =
          row._persian.startsWith(q) ? 3 :
          row._english.startsWith(q) ? 2 :
          1;
        results.push({ row, score });
      }
    } else {
      // Fallback: brute-force substring (handles partial mid-word matches)
      for (const [id, row] of index.byId) {
        if (row._persian.includes(q) || row._english.includes(q)) {
          results.push({ row, score: 0 });
        }
      }
    }

    results.sort((a, b) => b.score - a.score || a.row._persian.localeCompare(b.row._persian, "fa"));
    return results.slice(0, limit).map((r) => r.row);
  },

  /**
   * Compute macros for a given food row + grams.
   * All stored values are per 100g.
   */
  macrosFor(row, grams = 100) {
    const factor = grams / 100;
    const n = (v) => (v == null ? null : Number((v * factor).toFixed(2)));
    return {
      grams,
      calories: n(row.Calories) ?? 0,
      fat: n(row.Fat) ?? 0,
      protein: n(row.Protein) ?? 0,
      carbs: n(row.Carbs) ?? 0,
      fiber: n(row.Fiber) ?? 0,
      sugar: n(row.Sugar),
    };
  },

  /** Sum macros for a list of { food, grams } items. */
  sumMacros(items) {
    const totals = {
      calories: 0, fat: 0, protein: 0, carbs: 0, fiber: 0, sugar: 0,
    };
    for (const it of items) {
      const m = this.macrosFor(it.food, it.grams);
      totals.calories += m.calories;
      totals.fat += m.fat;
      totals.protein += m.protein;
      totals.carbs += m.carbs;
      totals.fiber += m.fiber;
      if (m.sugar != null) totals.sugar += m.sugar;
    }
    Object.keys(totals).forEach((k) => {
      totals[k] = Number(totals[k].toFixed(2));
    });
    return totals;
  },

  /** Export the loaded catalog (used by backup feature). */
  export() {
    return { version: CACHE_VERSION, rows: catalog };
  },
};