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

async function postChat(apiKey, body) {
  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': location.origin,
      'X-Title': 'PromptForge'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const msg = await res.text();
    const err = new Error(`OpenRouter error ${res.status}: ${msg.slice(0, 280)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** Pull reasoning text from any known field shape. */
function extractReasoning(message) {
  if (!message) return '';

  if (typeof message.reasoning === 'string' && message.reasoning.trim()) {
    return message.reasoning.trim();
  }

  if (Array.isArray(message.reasoning_details)) {
    const pieces = message.reasoning_details
      .map((d) => d?.text || d?.summary || d?.content || '')
      .filter(Boolean);
    if (pieces.length) return pieces.join('\n\n').trim();
  }

  return '';
}

/** Send the prompt to OpenRouter and return refined text + reasoning + usage. */
export async function refine({ apiKey, model, text, level }) {
  const system = level === 2 ? SYSTEM_LEVEL_2 : SYSTEM_LEVEL_1;

  const body = {
    model,
    temperature: 0.2,
    // Ask reasoning-capable models to expose their chain of thought.
    // Non-reasoning models ignore this, and it is dropped if a 400 comes back.
    reasoning: { enabled: true },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: text }
    ]
  };

  let data;
  try {
    data = await postChat(apiKey, body);
  } catch (err) {
    if (err.status === 400) {
      delete body.reasoning;
      data = await postChat(apiKey, body);
    } else {
      throw err;
    }
  }

  const message = data?.choices?.[0]?.message || {};
  const usage = data?.usage || null;
  const reasoning = extractReasoning(message);

  let out = (message.content || '').trim();
  // Strip accidental code fences the model may have added.
  out = out.replace(/^```[a-zA-Z]*\s*\n?/, '').replace(/\n?```\s*$/, '').trim();

  if (!out) throw new Error('The model returned an empty response.');
  return { text: out, reasoning, usage };
}
