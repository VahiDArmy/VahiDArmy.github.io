// ============================================================================
// errors.js — normalise errors WITHOUT rewriting provider information
// ============================================================================

export function normaliseError(err, ctx = {}) {
  if (!err) {
    return {
      httpStatus: null,
      statusText: "",
      message: "خطای نامشخص",
      detail: null,
      rawText: "",
      headers: {},
      provider: null,
      ...ctx,
    };
  }

  const detail = err.detail ?? null;
  const provider =
    detail?.error?.metadata?.provider_name ||
    detail?.provider_name ||
    detail?.provider ||
    err.providerError?.metadata?.provider_name ||
    null;

  // Some OpenRouter errors place the real message inside detail.error.message
  const providerMsg =
    detail?.error?.message ||
    detail?.message ||
    err.providerError?.message ||
    null;

  return {
    httpStatus: err.httpStatus ?? err.status ?? null,
    statusText: err.statusText || "",
    message: providerMsg || err.message || String(err),
    detail: detail ?? err.providerError ?? null,
    rawText: err.rawText || "",
    headers: err.headers || {},
    provider,
    requestId: err.requestId || ctx.requestId || null,
    at: new Date().toISOString(),
  };
}

export function errorHeadline(e) {
  if (!e) return "خطا";
  if (e.httpStatus) return `HTTP ${e.httpStatus}${e.statusText ? " · " + e.statusText : ""}`;
  if (e.message) return String(e.message).slice(0, 80);
  return "خطا";
}
