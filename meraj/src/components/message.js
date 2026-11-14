/** Rendering for one message. Actions are delegated by the chat view. */
import {
  escapeHtml,
  formatDateTime,
  formatDuration,
  formatTime,
  formatTokens,
  modelBadges,
  modelHue,
  prettyModelName,
  providerFromSlug,
  relativeTime,
} from '../utils.js';
import { getModelOrFallback } from '../services/models.js';
import { branchInfo } from '../tree.js';
import { renderMarkdown } from '../ui/markdown.js';
import { icon } from '../ui/icons.js';
import { renderErrorCard } from './errorCard.js';

const STATUS_LABEL = {
  streaming: 'streaming',
  stopped: 'stopped',
  error: 'failed',
  interrupted: 'interrupted',
  complete: '',
};

function modelFor(message, models) {
  return getModelOrFallback(models, message.model_slug || message.requested_model || null);
}

function branchControl(message, messages, extraClass = '') {
  const info = branchInfo(messages, message.id);
  if (info.total < 2) return '';
  return `<div class="branch-nav ${extraClass}" aria-label="Message branches">
    <button type="button" class="branch-btn" data-action="branch" data-id="${message.id}" data-dir="-1" aria-label="Previous branch" title="Previous branch">${icon('chevronLeft', { size: 13 })}</button>
    <span class="branch-count">${info.index + 1}<span>/</span>${info.total}</span>
    <button type="button" class="branch-btn" data-action="branch" data-id="${message.id}" data-dir="1" aria-label="Next branch" title="Next branch">${icon('chevronRight', { size: 13 })}</button>
  </div>`;
}

function usageBits(message) {
  const usage = message.usage || {};
  const bits = [];
  const total = usage.total_tokens ?? (Number(usage.prompt_tokens || 0) + Number(usage.completion_tokens || 0));
  if (total) bits.push(`${formatTokens(total)} tokens${usage.estimated ? ' est.' : ''}`);
  const meta = message.response_meta || {};
  if (meta.latency_ms) bits.push(formatDuration(meta.latency_ms));
  if (meta.provider) bits.push(meta.provider);
  return bits;
}

function assistantActions(message, isStreaming) {
  if (isStreaming) return '';
  return `<div class="msg-actions">
    <button type="button" class="msg-action" data-action="copy-message" data-id="${message.id}" title="Copy message text" aria-label="Copy message text">${icon('copy', { size: 15 })}</button>
    <button type="button" class="msg-action" data-action="retry-message" data-id="${message.id}" title="Regenerate this reply" aria-label="Regenerate this reply">${icon('refresh', { size: 15 })}</button>
    <button type="button" class="msg-action msg-action--labelled" data-action="message-request" data-id="${message.id}" title="Show the exact request body">${icon('code', { size: 15 })}<span>Request</span></button>
    <button type="button" class="msg-action" data-action="message-menu" data-id="${message.id}" title="More actions" aria-label="More actions">${icon('more', { size: 16 })}</button>
  </div>`;
}

function userActions(message, isStreaming) {
  if (isStreaming) return '';
  return `<div class="msg-actions">
    <button type="button" class="msg-action" data-action="copy-message" data-id="${message.id}" title="Copy prompt" aria-label="Copy prompt">${icon('copy', { size: 15 })}</button>
    <button type="button" class="msg-action msg-action--labelled" data-action="edit-message" data-id="${message.id}" title="Edit this sent prompt as a new branch">${icon('edit', { size: 15 })}<span>Edit</span></button>
    <button type="button" class="msg-action" data-action="message-menu" data-id="${message.id}" title="More actions" aria-label="More actions">${icon('more', { size: 16 })}</button>
  </div>`;
}

function reasoningBlock(message) {
  if (!message.reasoning?.trim()) return '';
  return `<details class="reasoning">
    <summary>${icon('brain', { size: 15 })}<span>Reasoning returned by the model</span><em>${formatTokens(Math.ceil(message.reasoning.length / 4))} tokens</em></summary>
    <div class="reasoning__body" data-reasoning-body>${renderMarkdown(message.reasoning)}</div>
  </details>`;
}

export function renderMessage(message, { messages = [], models = [], streaming = false, timestamps = true, showReasoning = true } = {}) {
  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming' || streaming;
  const model = modelFor(message, models);
  const hue = modelHue(message.model_slug || message.requested_model || 'meraj');
  const badges = modelBadges(model).slice(0, 2);
  const autoRouted = message.requested_model === 'openrouter/free' && message.model_slug && message.model_slug !== 'openrouter/free';
  const partial = message.status === 'stopped' || message.status === 'interrupted';
  const content = renderMarkdown(message.content || '', { streaming: isStreaming });
  const timeLabel = timestamps ? formatTime(message.created_at) : '';
  const fullTime = formatDateTime(message.created_at);
  const statusLabel = STATUS_LABEL[message.status] || '';
  const info = branchInfo(messages, message.id);
  const canBranch = info.total > 1;

  if (isUser) {
    return `<article class="msg msg--user" data-message-id="${message.id}">
      <div class="msg__user-wrap">
        <div class="user-bubble">
          <div class="markdown-wrap" data-stream-body>${content || '<span class="muted">Empty prompt</span>'}</div>
          ${message.status === 'error' && message.error ? renderErrorCard(message.error, { messageId: message.id, canRetry: false }) : ''}
        </div>
        <footer class="msg__foot msg__foot--user">
          <div class="msg__foot-left">
            ${timeLabel ? `<span class="msg-time" title="${escapeHtml(fullTime)}">${escapeHtml(timeLabel)}</span>` : ''}
            ${statusLabel ? `<span class="status-chip status-chip--${message.status}">${icon(message.status === 'error' ? 'xCircle' : 'info', { size: 12 })}${escapeHtml(statusLabel)}</span>` : ''}
            ${branchControl(message, messages)}
          </div>
          ${userActions(message, isStreaming)}
        </footer>
      </div>
    </article>`;
  }

  const statusChip =
    statusLabel && message.status !== 'complete'
      ? `<span class="status-chip status-chip--${message.status}">${isStreaming ? '<span class="stream-dot"></span>' : icon(message.status === 'error' ? 'xCircle' : message.status === 'stopped' ? 'stop' : 'info', { size: 12 })}${escapeHtml(statusLabel)}</span>`
      : '';
  const bits = usageBits(message);

  return `<article class="msg msg--assistant ${isStreaming ? 'is-streaming' : ''} ${message.status === 'error' ? 'has-error' : ''}" data-message-id="${message.id}">
    <div class="msg__rail" aria-hidden="true">
      <div class="model-orb" style="--hue:${hue}">${message.model_slug === 'openrouter/free' ? icon('spark', { size: 16 }) : `<span>${escapeHtml((model?.provider || 'M').slice(0, 1))}</span>`}</div>
      <span class="msg__rail-line"></span>
    </div>
    <div class="msg__main">
      <header class="msg__head">
        <div class="msg__identity">
          <span class="made-with">Made with</span>
          <strong class="msg-model-name" title="${escapeHtml(message.model_slug || '')}">${escapeHtml(model?.name || prettyModelName(message.model_slug || 'Unknown model'))}</strong>
          <span class="provider-pill">${escapeHtml(model?.provider || providerFromSlug(message.model_slug || ''))}</span>
          ${autoRouted ? `<span class="tag tag--auto" title="Requested via openrouter/free; OpenRouter selected this model">${icon('split', { size: 11 })} auto-routed</span>` : ''}
          ${badges.map((badge) => `<span class="tag tag--ghost">${escapeHtml(badge.label)}</span>`).join('')}
        </div>
        <div class="msg__head-right">
          ${statusChip}
          ${timeLabel ? `<span class="msg-time" title="${escapeHtml(fullTime)}">${escapeHtml(timeLabel)}</span>` : ''}
        </div>
      </header>
      ${showReasoning ? reasoningBlock(message) : ''}
      <div class="msg__body markdown-wrap" data-stream-body>
        ${content || (isStreaming ? `<div class="thinking"><span class="thinking__orb">${icon('spark', { size: 16 })}</span><span class="thinking__label">${escapeHtml(model?.name || 'Model')} is composing</span><span class="thinking__dots"><i></i><i></i><i></i></span></div>` : '<p class="muted">No content returned.</p>')}
        ${isStreaming ? '<span class="stream-cursor" aria-hidden="true"></span>' : ''}
      </div>
      ${partial ? `<p class="notice notice--warn notice--inline">${icon('info', { size: 14 })}${message.status === 'stopped' ? 'You stopped this reply. The partial text is saved.' : 'This reply was interrupted by a reload or connection loss. No provider error was recorded.'}</p>` : ''}
      ${message.status === 'error' && message.error ? renderErrorCard(message.error, { messageId: message.id, canRetry: !isUser }) : ''}
      ${!isStreaming ? `<footer class="msg__foot">
        <div class="msg__foot-left">
          <span class="msg-model-mono mono" title="Model identifier">${escapeHtml(message.model_slug || '—')}</span>
          ${bits.length ? `<span class="msg-usage">${bits.map((bit) => `<span>${escapeHtml(bit)}</span>`).join('<i></i>')}</span>` : ''}
          ${canBranch ? branchControl(message, messages) : ''}
        </div>
        ${assistantActions(message, isStreaming)}
      </footer>` : `<footer class="msg__foot">
        <div class="msg__foot-left">
          <span class="msg-model-mono mono">${escapeHtml(message.model_slug || '')}</span>
          <span class="msg-usage"><span data-stream-usage>waiting for tokens</span></span>
          ${canBranch ? branchControl(message, messages) : ''}
        </div>
        <div class="msg-actions"><span class="status-chip status-chip--streaming"><span class="stream-dot"></span>live</span></div>
      </footer>`}
    </div>
  </article>`;
}

export function renderDayDivider(date) {
  const d = new Date(date);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const label = sameDay ? 'Today' : d.toDateString() === yesterday.toDateString() ? 'Yesterday' : formatDateTime(d).split(',')[0];
  return `<div class="day-divider"><span>${escapeHtml(label)}</span></div>`;
}

export function renderWelcome({ models = [], hasKey = false, online = true, activeCount = 0 } = {}) {
  const routers = models.find((model) => model.slug === 'openrouter/free');
  return `<section class="welcome">
    <div class="welcome__orbit" aria-hidden="true">
      <span class="welcome__ring welcome__ring--one"></span>
      <span class="welcome__ring welcome__ring--two"></span>
      <span class="welcome__ring welcome__ring--three"></span>
      <span class="welcome__star">✦</span>
    </div>
    <p class="eyebrow welcome__eyebrow">The ascent · ${online ? 'connected' : 'offline'}</p>
    <h1 class="welcome__title">معراج</h1>
    <p class="welcome__latin">MI'RAJ <span>·</span> an observatory for thought</p>
    <p class="welcome__lede">Think with ${activeCount || 'a constellation of'} free models. Every answer names the model that made it, every request is inspectable down to the byte, and every prompt can be forked without losing what came before.</p>
    <div class="welcome__stats">
      <div><strong>${activeCount || '—'}</strong><span>active free models</span></div>
      <div><strong>${routers?.context_length ? formatTokens(routers.context_length) : '200k'}</strong><span>router context</span></div>
      <div><strong>100%</strong><span>auditable requests</span></div>
    </div>
    ${!hasKey ? `<div class="welcome__key">${icon('key', { size: 17 })}<p>Add your OpenRouter key to begin. It stays on this device.</p><button type="button" class="btn btn--small btn--primary" data-action="configure-key">Add key</button></div>` : ''}
  </section>`;
}

export function messagePreview(message) {
  return String(message?.content || '').replace(/\s+/g, ' ').slice(0, 120);
}
