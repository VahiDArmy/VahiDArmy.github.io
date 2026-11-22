const FALLBACK_MODELS = [
  { slug: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', description: 'Meta · free' },
  { slug: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash', description: 'Google · free' },
  { slug: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1', description: 'Reasoning · free' },
  { slug: 'qwen/qwen-2.5-72b-instruct:free', name: 'Qwen 2.5 72B', description: 'Alibaba · free' },
  { slug: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B', description: 'Fast · free' },
  { slug: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B', description: 'Lightweight · free' }
];

export function getApiKey() { return localStorage.getItem('or_key') || ''; }
export function setApiKey(k) {
  if (k) localStorage.setItem('or_key', k);
  else localStorage.removeItem('or_key');
}
export function getModel() { return localStorage.getItem('or_model') || FALLBACK_MODELS[0].slug; }
export function setModel(m) { localStorage.setItem('or_model', m); }

export async function listModels(supabase) {
  try {
    const { data, error } = await supabase
      .from('meraj_models')
      .select('slug,name,description,context_length,is_free')
      .eq('is_active', true).eq('is_free', true)
      .order('sort_order', { ascending: true }).limit(60);
    if (error || !data || !data.length) return FALLBACK_MODELS;
    return data.map(d => ({ slug: d.slug, name: d.name || d.slug, description: d.description || 'free' }));
  } catch { return FALLBACK_MODELS; }
}

export async function chatAI({ messages, model, onToken, signal }) {
  const key = getApiKey();
  if (!key) throw new Error('Missing OpenRouter API key — add it in Settings.');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': location.origin,
      'X-Title': 'MATRIX·3D'
    },
    body: JSON.stringify({
      model: model || getModel(),
      messages,
      stream: !!onToken
    }),
    signal
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 400)}`);
  }
  if (!onToken) {
    const j = await res.json();
    return j.choices?.[0]?.message?.content || '';
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return full;
      try {
        const j = JSON.parse(payload);
        const tok = j.choices?.[0]?.delta?.content || '';
        if (tok) { full += tok; onToken(tok); }
      } catch {}
    }
  }
  return full;
}
