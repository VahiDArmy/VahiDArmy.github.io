import { OPENROUTER_MODELS_URL, OPENROUTER_CHAT_URL } from './config.js';

const SYSTEM_LEVEL_1 = `You are a meticulous proofreader.
Fix ONLY spelling, grammar, punctuation, typos, and obvious word-choice errors in the user's prompt.
Do NOT change meaning, tone, structure, formatting, or content.
Preserve the original language exactly. Preserve line breaks and markdown.
Return ONLY the corrected text. No explanations, no quotes, no code fences.`;

const SYSTEM_LEVEL_2 = `You are a senior prompt engineer and rigorous logician.
Review the user's prompt for: logical contradictions, paradoxes, ambiguous instructions,
impossible or conflicting constraints, internal inconsistencies, circular requirements,
and unclear goals.
Fix issues CONSERVATIVELY. Preserve the author's intent, voice, essence, language, and formatting.
Never rewrite wholesale. Never remove requirements unless they are genuinely contradictory
(in that case resolve gracefully and minimally).
Return ONLY the improved prompt text. No explanations, no commentary, no code fences.`;

/** Fetch the list of free models from OpenRouter and normalise them. */
export async function fetchFreeModels(apiKey) {
  const headers = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(OPENROUTER_MODELS_URL, { headers });
  if (!res.ok) throw new Error(`OpenRouter models ${res.status}`);
  const json = await res.json();

  const free = (json.data || []).filter((m) => {
    const p = m.pricing || {};
    const zeroPrompt = Number(p.prompt) === 0;
    const zeroCompletion = Number(p.completion) === 0;
    return m.id.endsWith(':free') || (zeroPrompt && zeroCompletion);
  });

  return free.map((m) => ({
    model_id: m.id,
    label: m.name || m.id,
    provider: (m.id.split('/')[0] || '').replace(/[-_]/g, ' '),
    context_length: Number(m.context_length) || 0,
    sort: 0
  }));
}

/** Send the prompt to OpenRouter and return the refined text. */
export async function refine({ apiKey, model, text, level }) {
  const system = level === 2 ? SYSTEM_LEVEL_2 : SYSTEM_LEVEL_1;

  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': location.origin,
      'X-Title': 'PromptForge'
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: text }
      ]
    })
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${msg.slice(0, 280)}`);
  }

  const data = await res.json();
  let out = data?.choices?.[0]?.message?.content?.trim() || '';

  // Strip accidental code fences the model may have added.
  out = out.replace(/^```[a-zA-Z]*\s*\n?/, '').replace(/\n?```\s*$/, '').trim();

  if (!out) throw new Error('The model returned an empty response.');
  return out;
}
