const SUPABASE_URL = 'https://ummhohozmpwltbgeczsf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_WcK2pmYMMu61z0KUub5jLA_KSxGpQD6';

const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};

async function req(path, { method = 'GET', body, prefer, signal } = {}) {
  const headers = { ...HEADERS };
  if (prefer) headers['Prefer'] = prefer;

  let res;
  try {
    res = await fetch(`${SUPABASE_URL}${path}`, {
      method,
      headers,
      body: body != null ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
      signal
    });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    const err = new Error('Network request to Supabase failed');
    err.stage = 'supabase-network';
    err.cause = e;
    throw err;
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); }
    catch { data = { raw: text }; }
  }

  if (!res.ok) {
    const msg = data?.message
      || data?.error_description
      || data?.error
      || (typeof data === 'string' ? data : `HTTP ${res.status} ${res.statusText}`);
    const err = new Error(msg);
    err.stage = 'supabase-http';
    err.status = res.status;
    err.body = text;
    err.data = data;
    err.code = data?.code || null;
    err.details = data?.details || null;
    err.hint = data?.hint || null;
    throw err;
  }

  return data;
}

export async function loadModelsFromDB() {
  return await req(
    '/rest/v1/cinema_ai_models?select=*&provider=eq.openrouter&active=eq.true&order=label.asc'
  );
}

export async function loadAllModelsIncludingInactive() {
  return await req(
    '/rest/v1/cinema_ai_models?select=*&provider=eq.openrouter&order=label.asc'
  );
}

export async function saveModelsToDB(models) {
  if (!Array.isArray(models) || !models.length) return;
  const nowIso = new Date().toISOString();
  const rows = models.map(m => ({
    id: m.id,
    label: m.label || m.id,
    vendor: m.vendor || '',
    size: m.size || '',
    context: String(m.context || ''),
    speed: m.speed || '',
    note: m.note || '',
    tags: m.tags || '',
    recommended: !!m.recommended,
    best_for: m.best_for || '',
    is_free: m.is_free !== false,
    source: m.source || 'openrouter-api',
    fetched_at: m.fetched_at || nowIso,
    provider: 'openrouter',
    active: m.active !== false
  }));
  return await req('/rest/v1/cinema_ai_models?on_conflict=id', {
    method: 'POST',
    body: rows,
    prefer: 'resolution=merge-duplicates,return=minimal'
  });
}

export async function updateModel(id, patch) {
  return await req(`/rest/v1/cinema_ai_models?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: patch,
    prefer: 'return=minimal'
  });
}

export async function deactivateModel(id) {
  return await req(`/rest/v1/cinema_ai_models?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { active: false },
    prefer: 'return=minimal'
  });
}

export async function pingSupabase() {
  return await req('/rest/v1/cinema_ai_models?select=id&limit=1');
}
