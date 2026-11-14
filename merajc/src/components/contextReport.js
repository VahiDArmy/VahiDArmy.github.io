/** Detailed context budget report with an explicit estimate disclaimer. */
import { escapeHtml, formatNumber, formatTokens, formatContext, formatDuration, formatDateTime } from '../utils.js';
import { buildContextReport, contextTone, usageFromProvider } from '../services/tokens.js';
import { openModal } from '../ui/modal.js';
import { icon } from '../ui/icons.js';
import { contextGaugeSvg } from '../services/tokens.js';

const ROLE_LABEL = { user: 'You', assistant: 'Assistant', system: 'System', draft: 'Draft' };

export function openContextReport({ conversation, path = [], draft = '', model, settings, onInspectRequest = null }) {
  const report = buildContextReport({
    model,
    conversation,
    path,
    draft,
    params: { ...(settings?.params || {}), ...(conversation?.params || {}) },
    actualUsage: null,
  });
  const pct = report.percent === null ? null : Math.min(100, report.percent);
  const tone = contextTone(pct);
  const items = report.items;

  const rows = items
    .map(
      (item) => `<tr>
        <td><span class="role-chip role-chip--${escapeHtml(item.role)}">${escapeHtml(ROLE_LABEL[item.role] || item.role)}</span></td>
        <td class="context-preview">${item.preview ? escapeHtml(item.preview) : '<span class="muted">Empty</span>'}${item.draft ? ' <span class="tag tag--accent">draft</span>' : ''}</td>
        <td class="num mono">${formatNumber(item.chars)}</td>
        <td class="num mono">~${formatNumber(item.tokens)}</td>
        <td class="num mono">${report.contextLength ? `${((item.tokens / report.contextLength) * 100).toFixed(1)}%` : '—'}</td>
      </tr>`,
    )
    .join('');

  const usageRows = report.actualUsage
    ? `<div class="context-actual">
        <span>${icon('activity', { size: 16 })} Last provider usage</span>
        <dl>
          <div><dt>Prompt</dt><dd>${formatNumber(report.actualUsage.promptTokens)}</dd></div>
          <div><dt>Completion</dt><dd>${formatNumber(report.actualUsage.completionTokens)}</dd></div>
          <div><dt>Total</dt><dd>${formatNumber(report.actualUsage.totalTokens)}</dd></div>
        </dl>
        <p>Provider-reported usage is authoritative over the estimate below when it is present.</p>
      </div>`
    : '';

  const modal = openModal({
    title: 'Context report',
    subtitle: `Estimate for the next request to ${model?.name || conversation?.model_slug || 'this model'}.`,
    size: 'lg',
    className: 'context-modal',
    body: `
      <div class="context-hero context-hero--${tone}">
        <div class="context-hero__gauge">
          ${contextGaugeSvg(pct ?? 0, { size: 126, stroke: 9, label: 'Projected context use' })}
          <div class="context-hero__gauge-label">
            <strong>${pct === null ? '—' : `${pct.toFixed(1)}%`}</strong>
            <span>projected</span>
          </div>
        </div>
        <div class="context-hero__copy">
          <p class="eyebrow">Projected request</p>
          <h3>${formatTokens(report.totalInput)} input + ${report.maxOut ? `${formatTokens(report.maxOut)} reply reserve` : 'provider-chosen reply'}</h3>
          <p>${report.contextLength ? `Against a ${formatContext(report.contextLength)} token context window.` : 'This model does not publish a context window.'} ${report.remainingAfterReserve === null ? '' : report.remainingAfterReserve >= 0 ? `${formatTokens(report.remainingAfterReserve)} tokens remain after the reserve.` : `${formatTokens(Math.abs(report.remainingAfterReserve))} tokens over budget.`}${report.maxOutUnknown ? ' This model does not publish a completion maximum, so the request omits max_tokens and lets the provider choose.' : ''}</p>
          <div class="context-hero__badges">
            <span class="tag">${formatTokens(report.totalInput)} input</span>
            <span class="tag">${formatNumber(report.messageCount)} messages</span>
            <span class="tag">${report.maxOut ? `${formatTokens(report.maxOut)} ${report.maxOutAuto ? 'auto max reply' : 'max reply'}` : 'no output cap requested'}</span>
            ${report.systemTokens ? `<span class="tag tag--accent">system prompt ${formatTokens(report.systemTokens)}</span>` : ''}
          </div>
        </div>
      </div>
      ${usageRows}
      ${report.warnings.length ? `<div class="context-warnings">${report.warnings.map((warning) => `<p class="notice notice--${warning.level}">${icon(warning.level === 'danger' ? 'alert' : 'info', { size: 16 })}${escapeHtml(warning.text)}</p>`).join('')}</div>` : ''}
      <div class="context-table-wrap">
        <table class="data-table context-table">
          <thead><tr><th>Role</th><th>Content</th><th class="num">Chars</th><th class="num">Est. tokens</th><th class="num">Window</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="muted">This request has no conversational messages yet.</td></tr>'}</tbody>
        </table>
      </div>
      <div class="context-footnote">
        <p>${icon('info', { size: 15 })} Token counts are conservative estimates (≈ characters/4 adjusted for code, CJK, punctuation and whitespace), not a model-specific tokenizer. The exact <em>text</em> is available in the request inspector. Provider <code>usage</code> values replace estimates in analytics and message metadata.</p>
        <div class="context-formula">
          <span>system ${formatNumber(report.systemTokens)}</span><span>+</span><span>history ${formatNumber(report.historyTokens)}</span><span>+</span><span>draft ${formatNumber(report.draftTokens)}</span><span>=</span><strong>${formatNumber(report.totalInput)}</strong>
        </div>
      </div>
    `,
    actions: [
      ...(onInspectRequest
        ? [
            {
              label: 'Inspect exact request',
              variant: 'ghost',
              icon: 'code',
              close: false,
              onClick: () => {
                modal.close();
                window.setTimeout(onInspectRequest, 180);
              },
            },
          ]
        : []),
      { label: 'Close', variant: 'primary', icon: 'check' },
    ],
    footerNote: 'No content is trimmed automatically. If a request exceeds the window, the provider decides and returns its exact error.',
  });
  return modal;
}

export function buildCompactContext({ conversation, path, draft, model, settings }) {
  return buildContextReport({
    model,
    conversation,
    path,
    draft,
    params: { ...(settings?.params || {}), ...(conversation?.params || {}) },
  });
}

export function usageSummary(usage) {
  if (!usage) return '';
  const normalized = usageFromProvider(usage, 0, 0);
  const bits = [];
  if (normalized.prompt_tokens) bits.push(`${formatTokens(normalized.prompt_tokens)} in`);
  if (normalized.completion_tokens) bits.push(`${formatTokens(normalized.completion_tokens)} out`);
  if (normalized.estimated) bits.push('estimated');
  return bits.join(' · ');
}

export function usageDetailRows(usage, meta = {}) {
  const rows = [];
  if (usage?.prompt_tokens !== undefined) rows.push(['Prompt tokens', formatNumber(usage.prompt_tokens)]);
  if (usage?.completion_tokens !== undefined) rows.push(['Completion tokens', formatNumber(usage.completion_tokens)]);
  if (usage?.total_tokens !== undefined) rows.push(['Total tokens', formatNumber(usage.total_tokens)]);
  if (usage?.estimated) rows.push(['Source', 'Estimated locally (provider usage absent)']);
  if (usage?.cost !== undefined && usage.cost !== null) rows.push(['Cost', String(usage.cost)]);
  if (meta.latency_ms) rows.push(['Latency', formatDuration(meta.latency_ms)]);
  if (meta.provider) rows.push(['Provider', meta.provider]);
  if (meta.generation_id) rows.push(['Generation ID', meta.generation_id]);
  if (meta.finish_reason) rows.push(['Finish reason', meta.finish_reason]);
  if (meta.http_status) rows.push(['HTTP status', String(meta.http_status)]);
  if (meta.mode) rows.push(['Transport', meta.mode === 'stream' ? 'SSE stream' : 'JSON response']);
  if (meta.completed_at) rows.push(['Completed', formatDateTime(meta.completed_at)]);
  return rows;
}
