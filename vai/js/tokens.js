export function estimateTokens(text) {
  if (!text) return 0;
  let latin = 0;
  let other = 0;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 128) latin++;
    else other++;
  }
  // Latin ≈ 4 chars/token; non-Latin (CJK, Arabic, Persian, etc.) ≈ 1.5 chars/token
  return Math.ceil(latin / 4 + other / 1.5);
}

export function estimateMessagesTokens(messages) {
  if (!Array.isArray(messages)) return 0;
  let total = 0;
  for (const m of messages) {
    if (!m) continue;
    total += 4; // role/format overhead
    if (typeof m.content === 'string') {
      total += estimateTokens(m.content);
    } else if (Array.isArray(m.content)) {
      for (const part of m.content) {
        if (part?.type === 'text') total += estimateTokens(part.text || '');
      }
    }
  }
  total += 2;
  return total;
}

export function contextReport(messages, contextLimit) {
  const used = estimateMessagesTokens(messages);
  const limit = Number(contextLimit) || 0;
  if (!limit) {
    return { used, limit: 0, pct: 0, remaining: 0, over: false };
  }
  const pct = Math.min(100, (used / limit) * 100);
  const remaining = Math.max(0, limit - used);
  return {
    used,
    limit,
    pct,
    remaining,
    over: used > limit
  };
}
