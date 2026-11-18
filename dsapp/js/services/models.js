import { supabase } from '../lib/supabase.js';
import { OPENROUTER_BASE, STORAGE, AGENT_LIMITS } from '../config.js';

const OPENROUTER_KEY_LABEL = 'devspace.openrouter_key';

export function getOpenRouterKey() {
  return localStorage.getItem(OPENROUTER_KEY_LABEL) || '';
}

export function setOpenRouterKey(key) {
  if (key) localStorage.setItem(OPENROUTER_KEY_LABEL, key.trim());
  else localStorage.removeItem(OPENROUTER_KEY_LABEL);
}

export async function syncModels() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); 

  try {
    const res = await fetch(`${OPENROUTER_BASE}/models`, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`OpenRouter returned ${res.status}: ${text.slice(0, 100)}`);
    }

    const json = await res.json();
    const models = json.data || [];
    if (models.length === 0) throw new Error('OpenRouter returned an empty model list.');

    const rows = models.map((m) => {
      const params = m.supported_parameters || [];
      const prompt = Number(m.pricing?.prompt ?? 0);
      const completion = Number(m.pricing?.completion ?? 0);
      return {
        id: m.id,
        name: m.name || m.id,
        provider: m.id.split('/')[0],
        description: m.description || '',
        context_length: m.context_length ?? null,
        max_output: m.top_provider?.max_completion_tokens ?? null,
        pricing_prompt: Number.isFinite(prompt) ? prompt : 0,
        pricing_completion: Number.isFinite(completion) ? completion : 0,
        supports_tools: params.includes('tools') || params.includes('tool_choice'),
        supports_vision: (m.architecture?.input_modalities || []).includes('image'),
        is_free: prompt === 0 && completion === 0,
        is_available: true,
        raw: m,
        last_synced_at: new Date().toISOString(),
      };
    });

    const { error } = await supabase.from('ds_models').upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(`Database sync failed: ${error.message}`);

    localStorage.setItem(STORAGE.lastModelSync, String(Date.now()));
    return { synced: rows.length };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Model sync timed out. Please check your internet connection or VPN.');
    }
    throw err;
  }
}

export function shouldSyncModels() {
  const last = Number(localStorage.getItem(STORAGE.lastModelSync) || 0);
  return Date.now() - last > 6 * 60 * 60 * 1000;
}

export async function loadModelsAndPrefs() {
  const { data: models, error } = await supabase
    .from('ds_models')
    .select('*')
    .eq('is_available', true)
    .order('name');
  if (error) throw error;

  const { data: prefs, error: prefErr } = await supabase
    .from('ds_user_model_prefs')
    .select('*');
  if (prefErr) throw prefErr;

  const prefMap = new Map((prefs || []).map((p) => [p.model_id, p]));
  return { models: models || [], prefs: prefMap };
}

export async function setModelPref(modelId, { enabled, role = 'any' }) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');
  const { error } = await supabase.from('ds_user_model_prefs').upsert({
    user_id: userData.user.id,
    model_id: modelId,
    enabled,
    preferred_role: role,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,model_id' });
  if (error) throw error;
}

export function activeModels(models, prefs) {
  return models.filter((m) => {
    const p = prefs.get(m.id);
    return p ? p.enabled !== false : true;
  });
}

export function pickDefaultModel(models, prefs) {
  const active = activeModels(models, prefs);
  // Prioritize free models that support tools and have a decent context window.
  const preferred = active
    .filter((m) => m.is_free && m.supports_tools && (m.context_length || 0) >= 32000)
    .sort((a, b) => {
      const aIsTop = a.id.startsWith('openrouter/') || a.id.includes(':free');
      const bIsTop = b.id.startsWith('openrouter/') || b.id.includes(':free');
      if (aIsTop && !bIsTop) return -1;
      if (!aIsTop && bIsTop) return 1;
      return 0;
    });
  
  return preferred[0] || active.find((m) => m.is_free) || active.find((m) => m.supports_tools) || active[0] || null;
}

export function modelSupportsTools(modelId, models) {
  const m = models.find((x) => x.id === modelId);
  return !!m?.supports_tools;
}

export async function callChatCompletion({
  model, messages, tools = null, signal, useJsonProtocol = false,
}) {
  const key = getOpenRouterKey();
  if (!key) throw new Error('OpenRouter API key is missing. Add it in Settings.');

  const body = {
    model,
    messages,
    temperature: 0.2,
    max_tokens: 8192,
  };
  if (tools && !useJsonProtocol) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'DevSpace',
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`OpenRouter HTTP ${res.status}: ${text.slice(0, 400)}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  const msg = json.choices?.[0]?.message;
  if (!msg) throw new Error('OpenRouter returned no message');

  const toolCalls = (msg.tool_calls || []).map((tc) => {
    let args = {};
    try { args = JSON.parse(tc.function?.arguments || '{}'); } catch { args = {}; }
    return { id: tc.id, name: tc.function?.name, arguments: args };
  });

  return { message: msg, content: msg.content || '', toolCalls, raw: json };
}

export async function callModelWithReliability({
  modelId, messages, tools, signal, models, prefs, useJsonProtocol = false,
}) {
  const candidates = [];
  const primary = models.find((m) => m.id === modelId);
  if (primary) candidates.push(primary);
  const fallbacks = activeModels(models, prefs)
    .filter((m) => m.id !== modelId && m.supports_tools)
    .sort((a, b) => {
      const af = a.is_free ? 1 : 0;
      const bf = b.is_free ? 1 : 0;
      return bf - af || (b.context_length || 0) - (a.context_length || 0);
    })
    .slice(0, 2);
  candidates.push(...fallbacks);

  let lastErr;
  for (const model of candidates) {
    for (let attempt = 0; attempt < AGENT_LIMITS.maxRetries; attempt++) {
      try {
        const timeout = new AbortController();
        const timer = setTimeout(() => timeout.abort(), AGENT_LIMITS.modelTimeoutMs);
        const onAbort = () => timeout.abort();
        signal?.addEventListener('abort', onAbort);
        try {
          return await callChatCompletion({
            model: model.id, messages, tools, signal: timeout.signal, useJsonProtocol,
          });
        } finally {
          clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
        }
      } catch (err) {
        lastErr = err;
        if (err.name === 'AbortError') throw err;
        const status = err.status;
        if (status && status >= 400 && status < 500 && status !== 429) break;
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }
  throw lastErr || new Error('All model attempts failed');
}
