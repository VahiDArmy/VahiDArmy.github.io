/**
 * Token accounting.
 *
 * We cannot ship a real BPE tokenizer for every OpenRouter model, so estimates
 * are conservative and always labelled as estimates. Whenever the provider
 * returns a `usage` object, real numbers override these everywhere in the UI.
 */
import { formatNumber, formatContext, formatTokens, normalizeText } from '../utils.js';

const CJK = /[\u2e80-\u2fff\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/g;

export function estimateTokens(text) {
  const source = normalizeText(text);
  if (!source) return 0;

  const cjkMatches = source.match(CJK) || [];
  const cjkCount = cjkMatches.length;
  let latin = source.length - cjkCount;

  // Whitespace and punctuation tokenize differently; a small surcharge is safer
  // than pretending an estimate is exact.
  const punctuation = (source.match(/[^\w\s\u2e80-\u9fff\uac00-\ud7af]/g) || []).length;
  const words = (source.match(/[\w\u2e80-\u9fff\uac00-\ud7af]+/g) || []).length;
  const codeLike = /[{};=<>]|```/.test(source);
  const divisor = codeLike ? 3.35 : 4;

  const charEstimate = latin / divisor + cjkCount * 1.15;
  const wordEstimate = words * (codeLike ? 1.5 : 1.32);
  const punctuationSurcharge = punctuation * 0.14;
  return Math.max(source.trim() ? 1 : 0, Math.ceil(Math.max(charEstimate, wordEstimate) + punctuationSurcharge));
}

export function estimateRange(text) {
  const base = estimateTokens(text);
  return { low: Math.max(1, Math.floor(base * 0.86)), base, high: Math.ceil(base * 1.18) };
}

export function estimateMessageTokens(message) {
  const content = estimateTokens(message?.content || '');
  const role = estimateTokens(message?.role || 'user');
  return content + role + 4; // per-message framing overhead
}

export function estimateRequestInput(messages, systemPrompt = '') {
  let total = estimateTokens(systemPrompt);
  if (systemPrompt) total += 4;
  for (const message of messages || []) total += estimateMessageTokens(message);
  return total;
}

function modelWindow(model) {
  const value = Number(model?.context_length || model?.top_provider?.context_length || 0);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function buildContextReport({
  model,
  conversation,
  path = [],
  draft = '',
  params = {},
  actualUsage = null,
}) {
  const contextLength = modelWindow(model);
  const systemPrompt = conversation?.system_prompt || '';
  const systemTokens = systemPrompt ? estimateTokens(systemPrompt) + 4 : 0;

  const items = [];
  let historyTokens = 0;
  for (const message of path || []) {
    if (!message || message.role === 'system') continue;
    if (message.status === 'error') continue;
    if (!String(message.content || '').trim()) continue;
    const tokens = estimateMessageTokens(message);
    historyTokens += tokens;
    items.push({
      id: message.id,
      role: message.role,
      label: message.role === 'assistant' ? 'Assistant reply' : 'Your message',
      model: message.model_slug || null,
      chars: String(message.content || '').length,
      tokens,
      preview: String(message.content || '').replace(/\s+/g, ' ').slice(0, 140),
      createdAt: message.created_at,
    });
  }

  const draftText = String(draft || '');
  const draftTokens = draftText.trim() ? estimateMessageTokens({ role: 'user', content: draftText }) : 0;
  if (draftTokens) {
    items.push({
      id: 'draft',
      role: 'user',
      label: 'Draft (not sent yet)',
      model: null,
      chars: draftText.length,
      tokens: draftTokens,
      preview: draftText.replace(/\s+/g, ' ').slice(0, 140),
      draft: true,
    });
  }

  const totalInput = systemTokens + historyTokens + draftTokens;
  const explicitMax = Math.max(0, Number(params?.max_tokens) || 0);
  const modelMax = Math.max(0, Number(model?.max_completion_tokens) || 0);
  const contextRoom = contextLength ? Math.max(0, contextLength - totalInput) : modelMax;
  const maxOut = explicitMax || (modelMax ? Math.min(modelMax, contextRoom || modelMax) : 0);
  const projected = totalInput + maxOut;
  const percentRaw = contextLength ? (projected / contextLength) * 100 : null;
  const percent = percentRaw === null ? null : Math.min(999, Math.max(0, percentRaw));
  const inputPercent = contextLength ? Math.min(100, (totalInput / contextLength) * 100) : null;
  const remaining = contextLength ? contextLength - totalInput : null;
  const remainingAfterReserve = contextLength ? contextLength - projected : null;

  const warnings = [];
  if (!contextLength) {
    warnings.push({
      level: 'info',
      text: 'This model does not publish a context window. The request will still be sent; the provider decides whether it fits.',
    });
  } else if (remainingAfterReserve < 0) {
    warnings.push({
      level: 'danger',
      text: `Projected request (${formatNumber(projected)} tokens including a ${formatNumber(maxOut)}-token reply reserve) is ${formatNumber(Math.abs(remainingAfterReserve))} tokens over this model's ${formatContext(contextLength)} window.`,
    });
  } else if (percent >= 85) {
    warnings.push({
      level: 'warn',
      text: `Projected request uses ${percent.toFixed(1)}% of the ${formatContext(contextLength)} context window.`,
    });
  }

  return {
    model: model || null,
    contextLength,
    systemPrompt,
    systemTokens,
    historyTokens,
    draftTokens,
    totalInput,
    maxOut,
    maxOutAuto: !explicitMax && Boolean(modelMax),
    maxOutUnknown: !explicitMax && !modelMax,
    projected,
    percent,
    inputPercent,
    remaining,
    remainingAfterReserve,
    items,
    messageCount: items.filter((item) => !item.draft && item.id !== 'draft').length,
    charCount: (systemPrompt?.length || 0) + (path || []).reduce((sum, m) => sum + String(m.content || '').length, 0) + draftText.length,
    estimate: true,
    actualUsage: actualUsage
      ? {
          promptTokens: actualUsage.prompt_tokens ?? actualUsage.native_tokens_prompt ?? null,
          completionTokens: actualUsage.completion_tokens ?? actualUsage.native_tokens_completion ?? null,
          totalTokens: actualUsage.total_tokens ?? null,
        }
      : null,
    warnings,
  };
}

export function contextTone(percent) {
  if (percent === null || percent === undefined) return 'unknown';
  if (percent >= 90) return 'danger';
  if (percent >= 70) return 'warn';
  if (percent >= 40) return 'ok';
  return 'low';
}

export function contextSummary(report) {
  if (!report) return 'Context unavailable';
  if (!report.contextLength) return `${formatTokens(report.totalInput)} input · window unknown`;
  return `${formatTokens(report.totalInput)} / ${formatContext(report.contextLength)} · ${report.percent.toFixed(1)}%`;
}

export function usageFromProvider(usage, fallbackPrompt = 0, fallbackCompletion = 0) {
  if (!usage || typeof usage !== 'object') {
    const total = fallbackPrompt + fallbackCompletion;
    return {
      prompt_tokens: fallbackPrompt,
      completion_tokens: fallbackCompletion,
      total_tokens: total,
      estimated: true,
    };
  }
  const prompt = Number(usage.prompt_tokens ?? usage.native_tokens_prompt ?? 0) || 0;
  const completion = Number(usage.completion_tokens ?? usage.native_tokens_completion ?? 0) || 0;
  const total = Number(usage.total_tokens ?? usage.native_tokens_total ?? prompt + completion) || 0;
  return {
    ...usage,
    prompt_tokens: prompt || fallbackPrompt,
    completion_tokens: completion || fallbackCompletion,
    total_tokens: total || prompt + completion,
    estimated: !usage.total_tokens && !usage.prompt_tokens && !usage.completion_tokens,
  };
}

export function contextGaugeSvg(percent, { size = 64, stroke = 5, label = '' } = {}) {
  const safe = Math.max(0, Math.min(100, Number(percent) || 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (safe / 100) * circumference;
  const tone = contextTone(safe);
  return `<svg class="gauge gauge--${tone}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${label || `${safe.toFixed(1)} percent of context used`}">
    <circle class="gauge__track" cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke-width="${stroke}"></circle>
    <circle class="gauge__value" cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke-width="${stroke}"
      stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}"
      stroke-linecap="round" transform="rotate(-90 ${size / 2} ${size / 2})"></circle>
  </svg>`;
}
