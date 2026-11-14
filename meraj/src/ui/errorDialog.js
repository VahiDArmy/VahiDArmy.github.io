/** Error reporting with a path to the untouched raw details. */
import { escapeHtml } from '../utils.js';
import { openModal } from './modal.js';
import { icon } from './icons.js';
import { toast } from './toast.js';

export function rawErrorText(error) {
  if (!error) return '';
  if (error.bodyText) return String(error.bodyText);
  const fields = {
    message: error.message ?? null,
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
    status: error.status ?? null,
    kind: error.kind ?? null,
    url: error.url ?? null,
    requestId: error.requestId ?? null,
  };
  return JSON.stringify(fields, null, 2);
}

export function openErrorDialog(title, error) {
  const payload = rawErrorText(error);
  const normalized = error?.kind ? error : { ...error, kind: 'database' };
  openModal({
    title: title || 'Raw error',
    subtitle: 'Nothing is paraphrased. The fields below are exactly what the failing layer returned.',
    size: 'lg',
    body: `<div class="error-dialog">
      <div class="error-dialog__head">
        <span>${icon('alert', { size: 19 })}</span>
        <div><strong>${escapeHtml(error?.name || error?.kind || 'Error')}</strong><p>${escapeHtml(error?.message || 'No message field was returned.')}</p></div>
      </div>
      <pre class="verbatim verbatim--tall" tabindex="0">${escapeHtml(payload || '{}')}</pre>
      ${normalized.status ? `<p class="error-dialog__meta"><span class="mono">HTTP ${escapeHtml(normalized.status)}</span>${normalized.code ? `<span class="mono">code: ${escapeHtml(normalized.code)}</span>` : ''}</p>` : ''}
    </div>`,
    actions: [
      {
        label: 'Copy raw error',
        variant: 'ghost',
        icon: 'copy',
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(payload);
            toast({ title: 'Raw error copied', type: 'success', duration: 2200 });
          } catch {
            toast({ title: 'Clipboard unavailable', message: 'Select the raw text and copy manually.', type: 'error' });
          }
        },
      },
      { label: 'Close', variant: 'primary' },
    ],
  });
}

export function reportError(title, error, { duration = 9000 } = {}) {
  toast({
    title,
    message: error?.message || String(error || 'The operation failed.'),
    type: 'error',
    duration,
    actions: [
      {
        label: 'Raw details',
        close: false,
        onClick: () => openErrorDialog(title, error),
      },
    ],
  });
}
