import { $, autoResize } from '../utils/dom.js';

const messagesEl = () => $('#chat-messages');
const inputEl = () => $('#chat-input');
const statusEl = () => $('#agent-status');
const statusText = () => $('#agent-status-text');

let streamEl = null;

export function clearChat() {
  const el = messagesEl();
  if (el) el.innerHTML = '';
  streamEl = null;
}

export function addMessage(role, content, extra = {}) {
  const el = messagesEl();
  if (!el) return;
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = content;
  if (extra.toolHtml) {
    const t = document.createElement('div');
    t.className = 'tool-call';
    t.innerHTML = extra.toolHtml;
    div.appendChild(t);
  }
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  return div;
}

export function addSystemNote(text) {
  addMessage('system', text);
}

/** Begin a streaming assistant bubble (or reuse one). */
export function beginStream() {
  if (streamEl && streamEl.isConnected) {
    streamEl.textContent = '';
    return streamEl;
  }
  const el = messagesEl();
  if (!el) return null;
  streamEl = document.createElement('div');
  streamEl.className = 'msg assistant streaming';
  streamEl.textContent = '';
  el.appendChild(streamEl);
  el.scrollTop = el.scrollHeight;
  return streamEl;
}

export function appendStream(text) {
  if (!streamEl || !streamEl.isConnected) beginStream();
  if (!streamEl) return;
  streamEl.textContent += text;
  const el = messagesEl();
  if (el) el.scrollTop = el.scrollHeight;
}

export function endStream(finalText) {
  if (streamEl && streamEl.isConnected) {
    if (finalText != null) streamEl.textContent = finalText;
    streamEl.classList.remove('streaming');
  }
  streamEl = null;
}

export function setAgentStatus(visible, text = 'Working…') {
  const s = statusEl();
  const t = statusText();
  if (!s) return;
  if (visible) {
    s.classList.remove('hidden');
    if (t) t.textContent = text;
  } else {
    s.classList.add('hidden');
  }
}

export function bindComposer(onSubmit) {
  const form = $('#chat-form');
  const input = inputEl();
  if (!form || !input) return;

  input.addEventListener('input', () => autoResize(input));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    autoResize(input);
    onSubmit(text);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
}
