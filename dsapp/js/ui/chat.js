// js/ui/chat.js
import { state } from '../state.js';
import { el, clear, qs } from './dom.js';
import { renderMarkdown } from '../lib/markdown.js';

let listEl, scrollEl, statusEl, inputEl, sendBtn, stopBtn, modelSel;

let onSend = () => {};
let onStop = () => {};
let onModelChange = () => {};
let onAnswer = () => {};

let pendingQuestion = null;
let liveEntries = [];

export function initChat(handlers = {}) {
  onSend = handlers.onSend || onSend;
  onStop = handlers.onStop || onStop;
  onModelChange = handlers.onModelChange || onModelChange;
  onAnswer = handlers.onAnswer || onAnswer;

  listEl = qs('#chat-messages');
  scrollEl = qs('#chat-scroll');
  statusEl = qs('#chat-status');
  inputEl = qs('#chat-input');
  sendBtn = qs('#chat-send');
  stopBtn = qs('#chat-stop');
  modelSel = qs('#chat-model');

  sendBtn.addEventListener('click', submit);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  });
  stopBtn.addEventListener('click', () => onStop());
  modelSel.addEventListener('change', () => onModelChange(modelSel.value));

  renderChat();
}

function submit() {
  const text = inputEl.value.trim();
  if (!text || inputEl.disabled) return;
  inputEl.value = '';
  onSend(text);
}

/* --------------------------------------------------------------------------
   Composer state
   -------------------------------------------------------------------------- */
export function setComposerEnabled(enabled) {
  inputEl.disabled = !enabled;
  sendBtn.disabled = !enabled;
}

export function setBusy(running) {
  stopBtn.classList.toggle('hidden', !running);
  sendBtn.disabled = running;
  inputEl.disabled = running;
  if (running) setStatus('Starting…', 'busy');
}

export function setStatus(text, kind = '') {
  statusEl.textContent = text || '';
  statusEl.className = `status ${kind}`.trim();
}

/* --------------------------------------------------------------------------
   Rendering
   -------------------------------------------------------------------------- */
export function renderModelOptions(models, prefs, selectedId) {
  clear(modelSel);

  const active = (models || []).filter((m) => {
    const p = prefs && typeof prefs.get === 'function' ? prefs.get(m.id) : null;
    return p ? p.enabled !== false : true;
  });

  if (!active.length) {
    modelSel.appendChild(el('option', { value: '' }, 'No models — open Settings to sync'));
    modelSel.value = '';
    return;
  }

  for (const m of active) {
    const label = `${m.name}${m.is_free ? ' · free' : ''}${m.supports_tools ? '' : ' · json protocol'}`;
    const opt = el('option', { value: m.id }, label);
    if (m.id === selectedId) opt.selected = true;
    modelSel.appendChild(opt);
  }

  if (!selectedId || !active.some((m) => m.id === selectedId)) {
    modelSel.value = active[0].id;
  }

  const current = active.find((m) => m.id === modelSel.value);
  modelSel.title = current?.supports_tools
    ? 'This model supports native tool calling.'
    : 'This model uses the JSON tool protocol.';
}

function messageNode(m) {
  const role = m.role || 'assistant';

  if (role === 'system') {
    return el('div', { class: 'msg system' }, m.content || '');
  }

  if (role === 'tool') {
    return el('div', { class: 'msg tool' },
      el('span', { class: 'tool-name' }, 'tool'),
      el('span', {}, String(m.content || ''))
    );
  }

  const bubble = el('div', { class: `msg ${role === 'user' ? 'user' : 'assistant'}` });
  const md = el('div', { class: 'md' });

  if (role === 'assistant') {
    md.innerHTML = renderMarkdown(m.content || '');
  } else {
    md.textContent = m.content || '';
  }

  bubble.appendChild(md);
  return bubble;
}

function emptyState() {
  const chip = (text) => el('button', {
    class: 'chip',
    onclick: () => {
      inputEl.value = text;
      inputEl.focus();
    },
  }, text);

  return el('div', { class: 'empty' },
    el('h3', {}, 'Ready when you are'),
    el('p', { class: 'muted small' }, 'Describe a task and the agent will read, write, and verify files.'),
    el('div', { class: 'chips' },
      chip('Scaffold a todo app with vanilla JS and localStorage'),
      chip('Add a dark mode toggle to the existing pages'),
      chip('Review the code and list bugs with file and line numbers')
    )
  );
}

function questionNode(question) {
  const answer = el('textarea', { class: 'input', rows: 3, placeholder: 'Your answer…' });
  return el('div', { class: 'question' },
    el('h4', {}, 'The agent needs your input'),
    el('div', { class: 'small' }, question),
    answer,
    el('div', { class: 'row' },
      el('button', {
        class: 'btn primary small',
        onclick: () => {
          const text = answer.value.trim();
          if (!text) return;
          setPendingQuestion(null);
          onAnswer(text);
        },
      }, 'Answer & continue')
    )
  );
}

function toolNode(call, result) {
  const name = call?.name || 'tool';
  let detail = '';
  if (result) {
    if (result.ok === false) {
      detail = result.error || 'error';
    } else {
      const raw = JSON.stringify(result);
      detail = raw.length > 180 ? `${raw.slice(0, 180)}…` : raw;
    }
  } else {
    detail = 'running…';
  }
  return el('div', { class: `msg tool ${result && result.ok === false ? 'err' : ''}` },
    el('span', { class: 'tool-name' }, name),
    el('span', {}, detail)
  );
}

export function renderChat() {
  if (!listEl) return;
  clear(listEl);

  const messages = state.messages || [];

  if (!messages.length && !liveEntries.length && !pendingQuestion) {
    listEl.appendChild(emptyState());
    return;
  }

  for (const m of messages) listEl.appendChild(messageNode(m));
  for (const entry of liveEntries) listEl.appendChild(toolNode(entry.call, entry.result));
  if (pendingQuestion) listEl.appendChild(questionNode(pendingQuestion));

  scrollToBottom();
}

export function appendChatMessage(message) {
  if (!listEl) return;
  if (listEl.querySelector('.empty')) clear(listEl);
  listEl.appendChild(messageNode(message));
  scrollToBottom();
}

export function logTool(entry) {
  if (!listEl) return;
  if (listEl.querySelector('.empty')) clear(listEl);

  if (entry.kind === 'start') {
    const node = toolNode(entry.call, null);
    liveEntries.push({ call: entry.call, result: null, node });
    listEl.appendChild(node);
  } else if (entry.kind === 'end') {
    const record = liveEntries.find(
      (e) => e.call && e.call.id === entry.call?.id && e.result === null
    );
    const replacement = toolNode(entry.call, entry.result);
    if (record && record.node && record.node.parentNode) {
      record.node.replaceWith(replacement);
      record.result = entry.result;
      record.node = replacement;
    } else {
      liveEntries.push({ call: entry.call, result: entry.result, node: replacement });
      listEl.appendChild(replacement);
    }
  }

  scrollToBottom();
}

export function clearActivity() {
  liveEntries = [];
}

export function setPendingQuestion(question) {
  pendingQuestion = question || null;
  renderChat();
}

function scrollToBottom() {
  if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
}
