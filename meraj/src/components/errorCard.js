/**
 * The raw error surface. Provider text is displayed exactly as received.
 * Local interpretation is always visually separated and labelled.
 */
import { escapeHtml, formatDateTime } from '../utils.js';
import { icon } from '../ui/icons.js';

const STATUS_GUIDANCE = {
  400: 'The provider rejected the request shape or a parameter. Compare the exact request body with this response.',
  401: 'OpenRouter rejected the credential. Check Settings → OpenRouter; the raw body above is authoritative.',
  402: 'The request needs credits or a different account limit. The provider body above is authoritative.',
  403: 'The request was forbidden — often a privacy/data-policy setting on the OpenRouter account.',
  404: 'The model endpoint was not found. It may have been removed or renamed.',
  408: 'The provider timed out. The request may be retried when you choose.',
  413: 'The request exceeded a provider payload limit. Reduce the context or input size.',
  422: 'The provider could not process the request parameters.',
  429: 'Rate limit or free-tier policy reached. Read the provider’s exact message; limits are enforced upstream.',
  500: 'The provider had an internal error. The raw body is unchanged; retry manually if appropriate.',
  502: 'Bad gateway from the provider.',
  503: 'The provider is temporarily unavailable.',
  504: 'The provider gateway timed out.',
};

function rawBodyFor(error) {
  if (error?.bodyText !== undefined && error?.bodyText !== null && String(error.bodyText).length) {
    return { label: 'Exact response body', text: String(error.bodyText) };
  }
  if (error?.kind === 'database' || error?.code || error?.details || error?.hint) {
    return {
      label: 'Exact Supabase error fields',
      text: JSON.stringify(
        {
          message: error.message ?? null,
          code: error.code ?? null,
          details: error.details ?? null,
          hint: error.hint ?? null,
          status: error.status ?? null,
        },
        null,
        2,
      ),
    };
  }
  if (error?.raw && typeof error.raw === 'object') {
    return { label: 'Raw error object', text: JSON.stringify(error.raw, null, 2) };
  }
  return null;
}

export function errorTitle(error) {
  if (!error) return 'Unknown error';
  if (error.kind === 'http' && error.status) return `HTTP ${error.status}${error.statusText ? ` ${error.statusText}` : ''}`;
  if (error.kind === 'network') return 'No HTTP response received';
  if (error.kind === 'configuration') return 'OpenRouter key required';
  if (error.kind === 'database') return 'Supabase rejected the operation';
  if (error.kind === 'empty') return 'Empty completion';
  if (error.kind === 'stream') return 'Stream failed';
  if (error.kind === 'shape') return 'Unexpected provider response shape';
  if (error.kind === 'client') return error.name || 'Client error';
  if (error.status) return `HTTP ${error.status}${error.statusText ? ` ${error.statusText}` : ''}`;
  return error.name || 'Request failed';
}

function kindClass(error) {
  if (error?.kind === 'http' || error?.kind === 'provider') return 'provider';
  if (error?.kind === 'database') return 'database';
  if (error?.kind === 'configuration') return 'configuration';
  return 'transport';
}

export function renderErrorCard(error, { messageId = null, canRetry = true } = {}) {
  if (!error) return '';
  const body = rawBodyFor(error);
  const guidance =
    STATUS_GUIDANCE[error.status] ||
    (error.kind === 'network'
      ? 'The browser did not reach OpenRouter. This is not an OpenRouter response body.'
      : error.kind === 'configuration'
        ? 'Add an OpenRouter key under Settings. The key is stored only on this device.'
        : error.kind === 'database'
          ? 'The Supabase operation returned these fields. Fix the database or policy and retry.'
          : error.kind === 'empty'
            ? 'The HTTP call succeeded, but the assistant produced no visible content. The request snapshot is still archived.'
            : '');
  const ts = error.at || new Date().toISOString();
  const facts = [
    ['Status', error.status ? `${error.status}${error.statusText ? ` ${error.statusText}` : ''}` : null],
    ['Provider', error.provider || error.parsed?.provider || null],
    ['Request ID', error.requestId || null],
    ['Endpoint', error.url || null],
    ['Time', formatDateTime(ts)],
    ['Kind', error.kind || null],
  ].filter(([, value]) => value);

  return `<section class="error-card error-card--${kindClass(error)}" data-error-card>
    <header class="error-card__head">
      <span class="error-card__icon">${icon('alert', { size: 19 })}</span>
      <div>
        <p class="error-card__eyebrow">${error.kind === 'http' || error.kind === 'provider' ? 'API provider response — unmodified' : 'Request did not complete'}</p>
        <h4 class="error-card__title">${escapeHtml(errorTitle(error))}</h4>
      </div>
    </header>
    ${error.message ? `<p class="error-card__message">${escapeHtml(error.message)}</p>` : ''}
    <dl class="error-card__facts">
      ${facts.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}
    </dl>
    ${body ? `<div class="error-card__raw-wrap">
      <div class="error-card__raw-head"><span>${escapeHtml(body.label)}</span><span class="mono">${body.text.length.toLocaleString()} chars</span></div>
      <pre class="error-card__raw" tabindex="0">${escapeHtml(body.text)}</pre>
    </div>` : `<p class="error-card__empty-body">The provider returned no response body. Nothing has been substituted.</p>`}
    ${guidance ? `<p class="error-card__guidance"><strong>Local guidance — not part of the provider response.</strong> ${escapeHtml(guidance)}</p>` : ''}
    <div class="error-card__actions">
      <button type="button" class="btn btn--small btn--ghost" data-action="copy-error" ${messageId ? `data-id="${messageId}"` : ''}>${icon('copy', { size: 14 })}<span>Copy raw</span></button>
      ${messageId ? `<button type="button" class="btn btn--small btn--ghost" data-action="message-request" data-id="${messageId}">${icon('code', { size: 14 })}<span>Exact request</span></button>` : ''}
      ${messageId && canRetry ? `<button type="button" class="btn btn--small btn--ghost" data-action="retry-message" data-id="${messageId}">${icon('refresh', { size: 14 })}<span>Retry</span></button>` : ''}
    </div>
  </section>`;
}

/** Standalone rendering for surfaces outside the chat stream (catalogue sync, etc.). */
export function renderRawErrorPanel(error, { title = 'Operation failed', extra = '' } = {}) {
  const body = rawBodyFor(error);
  return `<section class="error-panel">
    <div class="error-panel__head">
      <span>${icon('alert', { size: 19 })}</span>
      <div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(errorTitle(error))}</p></div>
    </div>
    ${error?.message ? `<p class="error-panel__message">${escapeHtml(error.message)}</p>` : ''}
    ${body ? `<pre class="error-panel__raw">${escapeHtml(body.text)}</pre>` : '<p class="error-panel__message">No response body was received.</p>'}
    ${extra}
  </section>`;
}
