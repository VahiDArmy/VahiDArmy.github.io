// ============================================================================
// context.js — builds the exact message list sent to the model and computes
// the context-size report shown in the inspector.
// ============================================================================

import { estimateTokens, faInt } from "../utils.js";
import { DEFAULTS } from "../config.js";

export function trimHistory(messages, historyTurns) {
  // `historyTurns` = number of messages kept (user+assistant each count as 1)
  if (!historyTurns || historyTurns <= 0) return messages.slice();
  return messages.slice(-historyTurns);
}

/** Builds [{role,content}] exactly as it will be serialised into the payload. */
export function buildMessagesForRequest({ settings, messages, draftText = null }) {
  const sys = (settings.system_prompt || "").trim();
  const out = [];
  if (sys) out.push({ role: "system", content: sys });

  const usable = (messages || []).filter(
    (m) =>
      (m.role === "user" || m.role === "assistant") &&
      m.status !== "error" &&
      (m.content || "").trim().length > 0
  );
  const trimmed = trimHistory(usable, settings.history_turns ?? DEFAULTS.history_turns);
  for (const m of trimmed) out.push({ role: m.role, content: m.content });

  if (draftText != null && String(draftText).trim()) {
    out.push({ role: "user", content: String(draftText) });
  }
  return out;
}

export function computeContextReport({ model, modelCtx, settings, messages, draftText }) {
  const sys = (settings.system_prompt || "").trim();
  const usable = (messages || []).filter(
    (m) => (m.role === "user" || m.role === "assistant") && m.status !== "error" && (m.content || "").trim()
  );
  const trimmed = trimHistory(usable, settings.history_turns ?? DEFAULTS.history_turns);

  const rows = [];
  let total = 0;

  if (sys) {
    const t = estimateTokens(sys);
    total += t;
    rows.push({ role: "system", label: "دستور سیستم", tokens: t, chars: sys.length });
  }
  for (const m of trimmed) {
    const t = estimateTokens(m.content || "");
    total += t;
    rows.push({
      role: m.role,
      label: m.role === "user" ? "کاربر" : "دستیار",
      tokens: t,
      chars: (m.content || "").length,
      seq: m.seq,
    });
  }
  let draftTokens = 0;
  if (draftText != null && String(draftText).trim()) {
    draftTokens = estimateTokens(String(draftText));
    total += draftTokens;
    rows.push({ role: "user", label: "پیش‌نویس پیام", tokens: draftTokens, chars: String(draftText).length });
  }

  const limit = modelCtx || 0;
  const reserved = Number(settings.max_tokens || DEFAULTS.max_tokens) || 0;
  const usableLimit = limit ? Math.max(0, limit - reserved) : 0;
  const percent = limit ? Math.min(1, total / limit) : 0;
  const percentUsable = usableLimit ? Math.min(1, total / usableLimit) : 0;

  return {
    model,
    modelCtx: limit,
    reserved,
    usableLimit,
    total,
    draftTokens,
    percent,
    percentUsable,
    rows,
    dropped: (messages || []).length - trimmed.length,
    count: rows.length,
  };
}

export function ctxLevel(p) {
  if (p >= 0.95) return "danger";
  if (p >= 0.8) return "warn";
  return "ok";
}

export function ctxLabel(p) {
  if (p >= 0.95) return "اشباع";
  if (p >= 0.8) return "سنگین";
  if (p >= 0.6) return "متوسط";
  return "سالم";
}

export function ctxSummary(c) {
  if (!c.modelCtx) return "ظرفیت مدل نامشخص است (Auto/Free)";
  return `${faInt(c.total)} از ${faInt(c.modelCtx)} توکن`;
}
