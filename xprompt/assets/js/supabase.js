import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TABLE = 'ai_models';

/** List all models ordered by sort then label. */
export async function listModels() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('sort', { ascending: true })
    .order('label', { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * Upsert models coming from OpenRouter. Existing rows keep their
 * is_default / active flags so management state is preserved.
 */
export async function upsertModels(incoming) {
  if (!incoming.length) return;

  const { data: existing, error: readErr } = await supabase
    .from(TABLE)
    .select('model_id, is_default, active');
  if (readErr) throw readErr;

  const byId = new Map((existing || []).map((r) => [r.model_id, r]));
  const now = new Date().toISOString();

  const rows = incoming.map((m) => {
    const prev = byId.get(m.model_id);
    return {
      model_id: m.model_id,
      label: m.label,
      provider: m.provider,
      context_length: m.context_length,
      active: prev ? prev.active : true,
      is_default: prev ? prev.is_default : false,
      sort: m.sort ?? 0,
      updated_at: now
    };
  });

  const { error } = await supabase
    .from(TABLE)
    .upsert(rows, { onConflict: 'model_id' });
  if (error) throw error;
}

export async function toggleActive(modelId, active) {
  const { error } = await supabase
    .from(TABLE)
    .update({ active, updated_at: new Date().toISOString() })
    .eq('model_id', modelId);
  if (error) throw error;
}

export async function deleteModel(modelId) {
  const { error } = await supabase.from(TABLE).delete().eq('model_id', modelId);
  if (error) throw error;
}

/** Set a single default (partial unique index requires unsetting first). */
export async function setDefaultModel(modelId) {
  const { error: e1 } = await supabase
    .from(TABLE)
    .update({ is_default: false })
    .eq('is_default', true);
  if (e1) throw e1;

  const { error: e2 } = await supabase
    .from(TABLE)
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('model_id', modelId);
  if (e2) throw e2;
}
