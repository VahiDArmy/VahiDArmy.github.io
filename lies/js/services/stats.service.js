/* ============================================================
   js/services/stats.service.js
   Analytics: overview, distributions, timeline, heatmap, top tags
   ============================================================ */

import { getSupabase } from '../core/supabase.client.js';
import { TABLES } from '../config/constants.js';

/**
 * Overview stats via RPC.
 * @returns {Promise<{
 *   active:number, archived:number, trashed:number, pinned:number,
 *   reflections:number, tags:number, categories:number,
 *   avg_intensity:number, avg_belief:number,
 *   this_week:number, this_month:number, last_created:string|null
 * }>}
 */
export async function overview() {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('stats_overview');
  if (error) throw error;
  return data || {
    active: 0, archived: 0, trashed: 0, pinned: 0,
    reflections: 0, tags: 0, categories: 0,
    avg_intensity: 0, avg_belief: 0,
    this_week: 0, this_month: 0, last_created: null,
  };
}

/**
 * Distribution by type.
 * @returns {Promise<Array<{type:string, count:number, avg_intensity:number, avg_belief:number}>>}
 */
export async function byType() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLES.LIES)
    .select('type, intensity, belief')
    .eq('status', 'active');
  if (error) throw error;

  const map = {};
  for (const r of data || []) {
    const k = r.type || 'other';
    if (!map[k]) map[k] = { type: k, count: 0, intensity: 0, belief: 0 };
    map[k].count++;
    map[k].intensity += r.intensity || 0;
    map[k].belief += r.belief || 0;
  }
  return Object.values(map).map((m) => ({
    type: m.type,
    count: m.count,
    avg_intensity: m.count ? +(m.intensity / m.count).toFixed(2) : 0,
    avg_belief: m.count ? +(m.belief / m.count).toFixed(2) : 0,
  })).sort((a, b) => b.count - a.count);
}

/**
 * Distribution by mood.
 * @returns {Promise<Array<{mood:string, count:number}>>}
 */
export async function byMood() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLES.LIES)
    .select('mood')
    .eq('status', 'active')
    .not('mood', 'is', null);
  if (error) throw error;

  const map = {};
  for (const r of data || []) map[r.mood] = (map[r.mood] || 0) + 1;
  return Object.entries(map).map(([mood, count]) => ({ mood, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Intensity histogram (0-10).
 * @returns {Promise<number[]>} length 11
 */
export async function intensityHistogram() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLES.LIES)
    .select('intensity')
    .eq('status', 'active');
  if (error) throw error;
  const buckets = new Array(11).fill(0);
  for (const r of data || []) {
    const i = Math.max(0, Math.min(10, r.intensity || 0));
    buckets[i]++;
  }
  return buckets;
}

/**
 * Belief histogram (0-10).
 * @returns {Promise<number[]>} length 11
 */
export async function beliefHistogram() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLES.LIES)
    .select('belief')
    .eq('status', 'active');
  if (error) throw error;
  const buckets = new Array(11).fill(0);
  for (const r of data || []) {
    const i = Math.max(0, Math.min(10, r.belief || 0));
    buckets[i]++;
  }
  return buckets;
}

/**
 * Daily counts for a date range (ISO strings).
 * @param {string} from
 * @param {string} to
 * @returns {Promise<Array<{date:string, count:number}>>}
 */
export async function dailyCounts(from, to) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLES.LIES)
    .select('created_at')
    .eq('status', 'active')
    .gte('created_at', from)
    .lte('created_at', to);
  if (error) throw error;

  const map = {};
  for (const r of data || []) {
    const day = String(r.created_at).slice(0, 10);
    map[day] = (map[day] || 0) + 1;
  }
  return Object.entries(map).map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Heatmap data: one entry per day of the requested Gregorian year,
 * suitable for building a Jalali heatmap client-side.
 * @param {number} year Gregorian year
 * @returns {Promise<Record<string, number>>} { 'YYYY-MM-DD': count }
 */
export async function heatmapByYear(year) {
  const supabase = getSupabase();
  const from = new Date(Date.UTC(year, 0, 1)).toISOString();
  const to   = new Date(Date.UTC(year, 11, 31, 23, 59, 59)).toISOString();

  const { data, error } = await supabase
    .from(TABLES.LIES)
    .select('created_at')
    .eq('status', 'active')
    .gte('created_at', from)
    .lte('created_at', to);
  if (error) throw error;

  const map = {};
  for (const r of data || []) {
    const day = String(r.created_at).slice(0, 10);
    map[day] = (map[day] || 0) + 1;
  }
  return map;
}

/**
 * Monthly counts for the last N months (Gregorian boundaries).
 * @param {number} [months=12]
 * @returns {Promise<Array<{month:string, count:number}>>}
 */
export async function monthlyCounts(months = 12) {
  const supabase = getSupabase();
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - (months - 1));
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from(TABLES.LIES)
    .select('created_at')
    .eq('status', 'active')
    .gte('created_at', since.toISOString());
  if (error) throw error;

  const map = {};
  for (const r of data || []) {
    const m = String(r.created_at).slice(0, 7);
    map[m] = (map[m] || 0) + 1;
  }
  return Object.entries(map).map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Top tags by usage on active lies.
 * @param {number} [limit=10]
 */
export async function topTags(limit = 10) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLES.LIE_TAGS)
    .select('tag_id, tags(name, color), lies!inner(status)')
    .eq('lies.status', 'active');
  if (error) throw error;

  const map = {};
  for (const r of data || []) {
    const id = r.tag_id;
    if (!map[id]) map[id] = { id, name: r.tags?.name || '—', color: r.tags?.color || '#7c5cff', count: 0 };
    map[id].count++;
  }
  return Object.values(map).sort((a, b) => b.count - a.count).slice(0, limit);
}

/**
 * Category breakdown for active lies.
 */
export async function categoryBreakdown() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLES.LIES)
    .select('category_id, categories(name, color, icon)')
    .eq('status', 'active')
    .not('category_id', 'is', null);
  if (error) throw error;

  const map = {};
  for (const r of data || []) {
    const id = r.category_id;
    if (!map[id]) {
      map[id] = {
        id,
        name: r.categories?.name || '—',
        color: r.categories?.color || '#7c5cff',
        icon: r.categories?.icon || '📁',
        count: 0,
      };
    }
    map[id].count++;
  }
  return Object.values(map).sort((a, b) => b.count - a.count);
}

/**
 * Aggregate everything the dashboard needs in one shot.
 * @param {number} [year]
 */
export async function dashboardBundle(year = new Date().getFullYear()) {
  const [ov, types, moods, hist, daily, heat, topT, cats] = await Promise.all([
    overview(),
    byType(),
    byMood(),
    intensityHistogram(),
    monthlyCounts(12),
    heatmapByYear(year),
    topTags(8),
    categoryBreakdown(),
  ]);
  return { overview: ov, byType: types, byMood: moods, intensityHistogram: hist, monthly: daily, heatmap: heat, topTags: topT, categories: cats };
}

export default {
  overview, byType, byMood, intensityHistogram, beliefHistogram,
  dailyCounts, heatmapByYear, monthlyCounts, topTags, categoryBreakdown,
  dashboardBundle,
};