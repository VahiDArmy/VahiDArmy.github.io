import { CHAT_ENDPOINT } from '../lib/config.js';
import { redactedHeaders, redactKey } from '../lib/openrouter.js';
import { icon } from '../lib/icons.js';
import { t } from '../lib/i18n.js';
import {
  escapeHtml,
  jsonHighlight,
  formatNum,
  copyText,
  formatDateTime,
  prettyModel,
} from '../lib/utils.js';
import { openModal, closeModal } from './overlay.js';
import { toast } from './toast.js';
import { state } from '../lib/state.js';

function tabButton(id, label, active) {
  return `<button type="button" class="chip ${active ? 'is-accent' : ''}" data-inspect-tab="${id}">${label}</button>`;
}

function endpointLine(model) {
  return `<div class="inspector-note">
    <b>POST</b> <span class="mono">${escapeHtml(CHAT_ENDPOINT)}</span>
    ${model ? `<br/>${t('Requested model')}: <span class="mono">${escapeHtml(model)}</span>` : ''}
  </div>`;
}

function contextPanel(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (!messages.length) return `<div class="conv-empty">${t('No messages in this request.')}</div>`;
  return `<div class="ctx-msg-list">${messages
    .map(
      (msg, index) => `<div class="ctx-msg">
        <span class="role">${escapeHtml(msg.role)} · ${index + 1}</span>
        <div class="body" dir="auto">${escapeHtml(msg.content || '')}</div>
      </div>`,
    )
    .join('')}</div>`;
}

function requestPanel({ body, headers, key, note }) {
  const headerEntries = headers || redactedHeaders(key);
  return `
    ${note ? `<div class="inspector-note">${escapeHtml(note)}</div>` : ''}
    ${endpointLine(body?.model)}
    <div class="inspector-meta">
      <span class="badge accent">stream: ${body?.stream ? 'true' : 'false'}</span>
      ${body?.temperature !== undefined ? `<span class="badge">temperature ${body.temperature}</span>` : ''}
      ${body?.max_tokens ? `<span class="badge">max_tokens ${body.max_tokens}</span>` : ''}
      ${body?.top_p !== undefined ? `<span class="badge">top_p ${body.top_p}</span>` : ''}
      ${body?.reasoning ? `<span class="badge">reasoning ${escapeHtml(JSON.stringify(body.reasoning))}</span>` : ''}
      <span class="badge">${formatNum((body?.messages || []).length)} messages</span>
    </div>
    <div class="inspector-note">
      ${t('This is the exact JSON body sent to OpenRouter — system prompt, full context and every parameter.')}
    </div>
    <pre class="raw-json" id="inspect-request-json">${jsonHighlight(body || {})}</pre>
    <div class="inspector-note" style="margin-top:10px">
      <b>${t('Headers')}</b><br/>
      <span class="mono" dir="ltr">Authorization: Bearer ${escapeHtml(redactKey(key || ''))}</span><br/>
      <span class="mono" dir="ltr">HTTP-Referer: ${escapeHtml(headerEntries['HTTP-Referer'] || '')}</span><br/>
      <span class="mono" dir="ltr">X-Title: Nebula AI Studio</span>
    </div>`;
}

function responsePanel(raw) {
  if (!raw) {
    return `<div class="conv-empty">${t('No response was captured for this message.')}</div>`;
  }
  const usage = raw.usage || {};
  const rawText = raw.raw || '';
  return `
    <div class="inspector-meta">
      ${raw.model ? `<span class="badge accent" dir="ltr">${escapeHtml(raw.model)}</span>` : ''}
      ${raw.finish_reason ? `<span class="badge">finish: ${escapeHtml(raw.finish_reason)}</span>` : ''}
      ${usage.prompt_tokens ? `<span class="badge">prompt ${formatNum(usage.prompt_tokens)}</span>` : ''}
      ${usage.completion_tokens ? `<span class="badge">completion ${formatNum(usage.completion_tokens)}</span>` : ''}
      ${usage.total_tokens ? `<span class="badge">total ${formatNum(usage.total_tokens)}</span>` : ''}
    </div>
    <div class="inspector-note">${t(
      'Raw server-sent events exactly as they arrived. Reasoning deltas and usage chunks included.',
    )}</div>
    ${
      rawText
        ? `<pre class="raw-json" id="inspect-response-raw" dir="ltr">${escapeHtml(rawText)}</pre>`
        : `<pre class="raw-json">${jsonHighlight(raw)}</pre>`
    }`;
}

export function openInspector(message) {
  const body = message.raw_request || null;
  const raw = message.raw_response || null;
  const hasResponse = Boolean(raw);

  openModal({
    title: t('Request inspector'),
    subtitle: `${prettyModel(message.model || message.requested_model)} · ${formatDateTime(message.created_at)}`,
    iconName: 'terminal',
    className: 'wide tall',
    body: `
      <div class="pill-row" style="margin-bottom:12px">
        ${tabButton('request', t('Request'), true)}
        ${tabButton('context', t('Context'), false)}
        ${hasResponse ? tabButton('response', t('Response'), false) : ''}
      </div>
      <div data-inspect-panel="request">${
        body
          ? requestPanel({ body, note: null })
          : `<div class="banner"><span>${icon('info')}</span><div class="banner-body">${t(
              'Raw request logging was off when this message was sent. Enable it in Settings → Chat to capture every future request.',
            )}</div></div>`
      }</div>
      <div data-inspect-panel="context" hidden>${contextPanel(body)}</div>
      ${
        hasResponse
          ? `<div data-inspect-panel="response" hidden>${responsePanel(raw)}</div>`
          : ''
      }`,
    footer: `
      <button class="btn btn-sm" id="inspect-copy" ${body ? '' : 'disabled'}>${icon('copy')} ${t('Copy JSON')}</button>
      <button class="btn btn-sm" id="inspect-copy-raw" ${hasResponse ? '' : 'disabled'}>${icon('terminal')} ${t(
        'Copy raw stream',
      )}</button>
      <div class="spacer"></div>
      <button class="btn btn-primary btn-sm" data-action="close-modal">${t('Close')}</button>`,
  });

  const scrim = document.querySelector('.modal-scrim:last-child');
  if (!scrim) return;
  const panels = scrim.querySelectorAll('[data-inspect-panel]');
  const tabs = scrim.querySelectorAll('[data-inspect-tab]');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((other) => other.classList.toggle('is-accent', other === tab));
      panels.forEach((panel) => {
        panel.hidden = panel.dataset.inspectPanel !== tab.dataset.inspectTab;
      });
    });
  });

  scrim.querySelector('#inspect-copy')?.addEventListener('click', async () => {
    const ok = await copyText(JSON.stringify(body || {}, null, 2));
    toast(ok ? t('Request JSON copied.') : t('Copy failed.'), { type: ok ? 'ok' : 'err' });
  });
  scrim.querySelector('#inspect-copy-raw')?.addEventListener('click', async () => {
    const ok = await copyText(raw?.raw || JSON.stringify(raw || {}, null, 2));
    toast(ok ? t('Raw stream copied.') : t('Copy failed.'), { type: ok ? 'ok' : 'err' });
  });
}

export function openRequestPreview({ body, note = '' }) {
  const key = state.profile?.openrouter_key || '';
  openModal({
    title: t('Request preview'),
    subtitle: t('Nothing has been sent yet'),
    iconName: 'eye',
    className: 'wide tall',
    body: `
      <div class="pill-row" style="margin-bottom:12px">
        ${tabButton('request', t('Request'), true)}
        ${tabButton('context', t('Context'), false)}
      </div>
      <div data-inspect-panel="request">${requestPanel({ body, key, note })}</div>
      <div data-inspect-panel="context" hidden>${contextPanel(body)}</div>`,
    footer: `
      <button class="btn btn-sm" id="preview-copy">${icon('copy')} ${t('Copy JSON')}</button>
      <div class="spacer"></div>
      <button class="btn btn-primary btn-sm" data-action="close-modal">${t('Close')}</button>`,
  });

  const scrim = document.querySelector('.modal-scrim:last-child');
  if (!scrim) return;
  const panels = scrim.querySelectorAll('[data-inspect-panel]');
  const tabs = scrim.querySelectorAll('[data-inspect-tab]');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((other) => other.classList.toggle('is-accent', other === tab));
      panels.forEach((panel) => {
        panel.hidden = panel.dataset.inspectPanel !== tab.dataset.inspectTab;
      });
    });
  });
  scrim.querySelector('#preview-copy')?.addEventListener('click', async () => {
    const ok = await copyText(JSON.stringify(body || {}, null, 2));
    toast(ok ? t('Request JSON copied.') : t('Copy failed.'), { type: ok ? 'ok' : 'err' });
  });
}

export function closeInspector() {
  closeModal();
}
