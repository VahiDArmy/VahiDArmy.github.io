/**
 * Builds the one and only request body used for an OpenRouter call.
 * The returned `bodyText` is the exact string passed to fetch(), and it is
 * archived with the assistant message so it can be inspected verbatim later.
 */
import { CONFIG } from '../config.js';
import { byteLength, sha256, normalizeText } from '../utils.js';
import { estimateRequestInput, estimateTokens } from './tokens.js';

const PARAM_MAP = [
  ['temperature', 'temperature'],
  ['top_p', 'top_p'],
  ['top_k', 'top_k'],
  ['frequency_penalty', 'frequency_penalty'],
  ['presence_penalty', 'presence_penalty'],
  ['seed', 'seed'],
  ['stop', 'stop'],
  ['min_p', 'min_p'],
  ['repetition_penalty', 'repetition_penalty'],
];

function supports(supported, name) {
  if (!Array.isArray(supported) || supported.length === 0) return true;
  return supported.includes(name);
}

export function effectiveParams(conversation, settings) {
  const defaults = { ...CONFIG.defaults.params, ...(settings?.params || {}) };
  const params = { ...defaults, ...(conversation?.params || {}) };
  return {
    temperature: clampNumber(params.temperature, 0, 2, 0.7),
    top_p: clampNumber(params.top_p, 0.01, 1, 1),
    max_tokens: Math.round(clampNumber(params.max_tokens, 16, 262144, 2048)),
    reasoning: ['off', 'low', 'medium', 'high'].includes(params.reasoning) ? params.reasoning : 'off',
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function selectableHistory(path = []) {
  return (path || []).filter((message) => {
    if (!message) return false;
    if (message.role !== 'user' && message.role !== 'assistant') return false;
    if (message.status === 'error') return false;
    return String(message.content || '').trim().length > 0;
  });
}

/**
 * @param {object} options
 * @param {object} options.conversation
 * @param {object} options.model
 * @param {Array} options.path       Messages that form this branch, ending at the new user turn.
 * @param {string} options.draft     Optional unsent draft for a preview.
 * @param {object} options.settings
 * @param {boolean} options.stream
 */
export function buildChatRequest({ conversation, model, path = [], draft = '', settings, stream = true }) {
  const modelSlug = model?.slug || conversation?.model_slug || CONFIG.defaults.model;
  const supported = model?.supported_parameters || [];
  const params = effectiveParams(conversation, settings);
  const messages = [];

  const system = normalizeText(conversation?.system_prompt || '').trim();
  if (system) messages.push({ role: 'system', content: conversation.system_prompt });

  for (const message of selectableHistory(path)) {
    messages.push({ role: message.role, content: message.content });
  }

  const draftText = normalizeText(draft || '');
  if (draftText.trim()) messages.push({ role: 'user', content: draftText });

  const body = {
    model: modelSlug,
    messages,
  };

  if (stream) body.stream = true;

  if (supports(supported, 'temperature')) body.temperature = params.temperature;
  if (supports(supported, 'top_p')) body.top_p = params.top_p;
  if (supports(supported, 'max_tokens')) {
    body.max_tokens = params.max_tokens;
  } else if (supports(supported, 'max_completion_tokens')) {
    body.max_completion_tokens = params.max_tokens;
  } else {
    body.max_tokens = params.max_tokens;
  }
  if (supports(supported, 'top_k')) body.top_k = 40;
  if (supports(supported, 'frequency_penalty')) body.frequency_penalty = 0;
  if (supports(supported, 'presence_penalty')) body.presence_penalty = 0;
  if (supports(supported, 'stop')) body.stop = null;

  if (params.reasoning !== 'off') {
    if (supports(supported, 'reasoning')) body.reasoning = { effort: params.reasoning };
    if (supports(supported, 'include_reasoning')) body.include_reasoning = true;
  }

  // Ask OpenRouter to attach token accounting to the final stream chunk.
  body.usage = { include: true };

  return {
    payload: body,
    bodyText: JSON.stringify(body),
    modelSlug,
    params,
    messages,
  };
}

export async function createRequestSnapshot({ conversation, model, path, draft = '', settings, stream = true }) {
  const built = buildChatRequest({ conversation, model, path, draft, settings, stream });
  const createdAt = new Date().toISOString();
  const estimatedInput = estimateRequestInput(
    built.messages.filter((message) => message.role !== 'system'),
    conversation?.system_prompt || '',
  );
  const snapshot = {
    version: 1,
    created_at: createdAt,
    url: `${CONFIG.openrouter.apiBase}${CONFIG.openrouter.chatPath}`,
    method: 'POST',
    stream: Boolean(stream),
    model_slug: built.modelSlug,
    requested_model: built.modelSlug,
    headers: [
      { name: 'Authorization', value: 'Bearer [REDACTED — never archived]' },
      { name: 'Content-Type', value: 'application/json' },
      { name: 'HTTP-Referer', value: CONFIG.openrouter.referer },
      { name: 'X-Title', value: CONFIG.openrouter.title },
    ],
    authorization_redacted: true,
    payload: built.payload,
    bodyText: built.bodyText,
    char_count: built.bodyText.length,
    byte_count: byteLength(built.bodyText),
    message_count: built.messages.length,
    estimated_input_tokens: estimatedInput,
    char_count_input: built.messages.reduce((sum, message) => sum + String(message.content || '').length, 0),
    fingerprint: await sha256(built.bodyText),
    params: built.params,
  };
  return snapshot;
}

export function snapshotBodyText(snapshot) {
  if (!snapshot) return '';
  if (typeof snapshot.bodyText === 'string') return snapshot.bodyText;
  if (snapshot.payload) return JSON.stringify(snapshot.payload);
  return '';
}

export function snapshotPayload(snapshot) {
  if (!snapshot) return null;
  if (snapshot.payload) return snapshot.payload;
  try {
    return JSON.parse(snapshot.bodyText || '{}');
  } catch {
    return null;
  }
}

export function snapshotMessages(snapshot) {
  const payload = snapshotPayload(snapshot);
  return Array.isArray(payload?.messages) ? payload.messages : [];
}

export function requestToCurl(snapshot) {
  if (!snapshot) return '';
  const body = snapshotBodyText(snapshot).replace(/'/g, `'\\''`);
  return `curl -sS '${snapshot.url || `${CONFIG.openrouter.apiBase}${CONFIG.openrouter.chatPath}`}' \\
  -H 'Authorization: Bearer $OPENROUTER_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -H 'HTTP-Referer: ${CONFIG.openrouter.referer}' \\
  -H 'X-Title: ${CONFIG.openrouter.title.replace(/'/g, '')}' \\
  --data-raw '${body}'`;
}

export function describeMessageForInspector(message, index) {
  const content = String(message?.content ?? '');
  return {
    index,
    role: message?.role || 'unknown',
    chars: content.length,
    tokens: estimateTokens(content),
    content,
  };
}
