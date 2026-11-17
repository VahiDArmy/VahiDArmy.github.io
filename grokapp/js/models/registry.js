/**
 * OpenRouter model registry with local Supabase cache + user preferences.
 * Sync never overwrites user-deactivated flags.
 */
import { getSupabase } from '../supabase-client.js';
import { loadConfig } from '../config.js';
import { getUser } from '../auth/auth.js';

const OR_MODELS = 'https://openrouter.ai/api/v1/models';

export async function listModels({ freeOnly = false, toolsOnly = false, includeInactive = false } = {}) {
  const sb = await getSupabase();
  let q = sb.from('model_registry').select('*').order('name');
  if (!includeInactive) q = q.eq('user_active', true);
  const { data, error } = await q;
  if (error) throw error;
  let rows = data || [];
  if (freeOnly) rows = rows.filter(m => m.is_free);
  if (toolsOnly) rows = rows.filter(m => m.supports_tools);
  return rows;
}

export async function setModelActive(modelId, active) {
  const sb = await getSupabase();
  const { error } = await sb
    .from('model_registry')
    .update({ user_active: active })
    .eq('id', modelId);
  if (error) throw error;
}

/**
 * Pull latest catalog from OpenRouter and upsert.
 * Preserves user_active preference.
 */
export async function syncModels() {
  const cfg = loadConfig();
  if (!cfg.openRouterKey) throw new Error('OpenRouter API key required for sync');

  const res = await fetch(OR_MODELS, {
    headers: {
      Authorization: `Bearer ${cfg.openRouterKey}`,
      'HTTP-Referer': location.origin,
      'X-Title': 'DevSpace',
    },
  });
  if (!res.ok) throw new Error(`OpenRouter models fetch failed: ${res.status}`);
  const json = await res.json();
  const models = json.data || [];

  const user = getUser();
  if (!user) throw new Error('Not signed in');

  const sb = await getSupabase();

  // Load existing preferences
  const { data: existing } = await sb.from('model_registry').select('id, user_active');
  const prefMap = new Map((existing || []).map(r => [r.id, r.user_active]));

  const rows = models.map(m => {
    const pricing = m.pricing || {};
    const isFree =
      (pricing.prompt === '0' || pricing.prompt === 0) &&
      (pricing.completion === '0' || pricing.completion === 0) ||
      (m.id || '').endsWith(':free');

    const supported = m.supported_parameters || [];
    const supportsTools = supported.includes('tools') || supported.includes('tool_choice');

    return {
      id: m.id,
      name: m.name || m.id,
      provider: (m.id || '').split('/')[0] || 'unknown',
      description: m.description || null,
      context_length: m.context_length || null,
      max_completion_tokens: m.top_provider?.max_completion_tokens || null,
      is_free: isFree,
      supports_tools: supportsTools,
      pricing_prompt: pricing.prompt != null ? Number(pricing.prompt) : null,
      pricing_completion: pricing.completion != null ? Number(pricing.completion) : null,
      architecture: m.architecture || null,
      user_active: prefMap.has(m.id) ? prefMap.get(m.id) : true,
      last_synced_at: new Date().toISOString(),
      raw: m,
    };
  });

  // Upsert in chunks
  const chunkSize = 50;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await sb.from('model_registry').upsert(chunk, { onConflict: 'id' });
    if (error) throw error;
  }

  return rows.length;
}

export function pickModelForTask(models, taskType = 'general') {
  // Simple heuristic — can be improved later
  const candidates = models.filter(m => m.user_active);
  if (!candidates.length) return null;

  if (taskType === 'code' || taskType === 'implement') {
    const withTools = candidates.filter(m => m.supports_tools);
    const pool = withTools.length ? withTools : candidates;
    // Prefer free if available
    const free = pool.filter(m => m.is_free);
    return (free[0] || pool[0])?.id;
  }
  // planning / review — prefer larger context free models
  const free = candidates.filter(m => m.is_free);
  return (free.sort((a, b) => (b.context_length || 0) - (a.context_length || 0))[0] || candidates[0])?.id;
}
