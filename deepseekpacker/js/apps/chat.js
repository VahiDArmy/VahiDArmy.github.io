// AURORA OS — Chat

import { h, $, $$, clear, relTime, uid, fmtTime } from '../core/dom.js';
import { store } from '../core/store.js';
import { bus } from '../core/bus.js';
import { CHANNELS, MESSAGES, USERS } from '../data/seed.js';
import { avatar, button, input, emptyState } from '../ui/components.js';
import toast from '../ui/toasts.js';

export const meta = {
  id: 'chat',
  title: 'Chat',
  icon: '✉',
  defaultSize: { width: 900, height: 600 },
};

let _activeChannel = 'general';
let _messagesByChannel = null;
let _root = null;
let _msgList = null;
let _msgInput = null;

function getMessages() {
  if (!_messagesByChannel) {
    const stored = store.get('chat.messages');
    if (stored && typeof stored === 'object') {
      _messagesByChannel = stored;
    } else {
      _messagesByChannel = {};
      for (const c of CHANNELS) {
        _messagesByChannel[c.id] = MESSAGES.map((m) => ({ ...m, channelId: c.id }));
      }
    }
  }
  return _messagesByChannel;
}

function saveMessages() { store.set('chat.messages', _messagesByChannel); }

function getUser(id) { return USERS.find((u) => u.id === id); }

function channelsList() {
  const list = h('div', { class: 'chat-channels' });
  list.append(h('div', { class: 'chat-channels__head', text: 'Channels' }));
  for (const c of CHANNELS) {
    const item = h('div', { class: 'chat-channel' + (c.id === _activeChannel ? ' is-active' : '') });
    item.append(h('span', { class: 'chat-channel__hash', text: '#' }));
    item.append(h('span', { class: 'chat-channel__name', text: c.name }));
    if (c.unread > 0) item.append(h('span', { class: 'chat-channel__badge', text: c.unread }));
    item.addEventListener('click', () => { _activeChannel = c.id; render(); });
    list.append(item);
  }
  return list;
}

function messagesView() {
  const msgs = getMessages()[_activeChannel] || [];
  const wrap = h('div', { class: 'chat-messages' });
  if (!msgs.length) {
    wrap.append(emptyState({ icon: '💬', title: 'No messages yet', text: 'Be the first to say hi' }));
    return wrap;
  }
  let lastAuthor = null;
  let lastTime = 0;
  for (const m of msgs) {
    const user = getUser(m.authorId) || { name: 'Unknown', initials: '?', status: 'offline' };
    const grouped = m.authorId === lastAuthor && (m.ts - lastTime) < 5 * 60000;
    const row = h('div', { class: 'chat-msg' + (grouped ? ' is-grouped' : '') });
    if (!grouped) {
      row.append(avatar(user.initials));
    } else {
      row.append(h('div', { class: 'chat-msg__avatar-space' }));
    }
    const body = h('div', { class: 'chat-msg__body' });
    if (!grouped) {
      const head = h('div', { class: 'chat-msg__head' });
      head.append(h('span', { class: 'chat-msg__author', text: user.name }));
      head.append(h('span', { class: 'chat-msg__time', text: fmtTime(m.ts, false) }));
      body.append(head);
    }
    body.append(h('div', { class: 'chat-msg__text', text: m.text }));
    row.append(body);
    wrap.append(row);
    lastAuthor = m.authorId;
    lastTime = m.ts;
  }
  return wrap;
}

function sendMessage() {
  const text = _msgInput.value.trim();
  if (!text) return;
  const msg = {
    id: 'msg-' + uid(),
    authorId: 'u-0',
    text,
    ts: Date.now(),
    channelId: _activeChannel,
  };
  if (!_messagesByChannel[_activeChannel]) _messagesByChannel[_activeChannel] = [];
  _messagesByChannel[_activeChannel].push(msg);
  saveMessages();
  _msgInput.value = '';
  renderMessages();
  _msgList.scrollTop = _msgList.scrollHeight;
}

function renderMessages() {
  if (!_msgList) return;
  clear(_msgList);
  _msgList.append(messagesView());
  _msgList.scrollTop = _msgList.scrollHeight;
}

function render() {
  if (!_root) return;
  clear(_root);

  const sidebar = h('div', { class: 'chat-sidebar' });
  const header = h('div', { class: 'chat-sidebar__header' });
  header.append(h('div', { class: 'chat-sidebar__brand', text: 'Chat' }));
  sidebar.append(header, channelsList());
  _root.append(sidebar);

  const main = h('div', { class: 'chat-main' });
  const channel = CHANNELS.find((c) => c.id === _activeChannel);
  const head = h('div', { class: 'chat-head' });
  head.append(h('span', { class: 'chat-head__hash', text: '#' }));
  head.append(h('span', { class: 'chat-head__name', text: channel?.name || _activeChannel }));
  head.append(h('span', { class: 'chat-head__topic', text: '— ' + (channel?.topic || '') }));
  main.append(head);

  _msgList = h('div', { class: 'chat-msg-list' });
  _msgList.append(messagesView());
  main.append(_msgList);

  const composer = h('div', { class: 'chat-composer' });
  _msgInput = h('textarea', { class: 'chat-input', placeholder: 'Message #' + (channel?.name || _activeChannel), rows: '1' });
  _msgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  _msgInput.addEventListener('input', () => {
    _msgInput.style.height = 'auto';
    _msgInput.style.height = Math.min(120, _msgInput.scrollHeight) + 'px';
  });
  const sendBtn = button('Send', { variant: 'primary', size: 'sm', onClick: sendMessage });
  composer.append(_msgInput, sendBtn);
  main.append(composer);
  _root.append(main);

  requestAnimationFrame(() => {
    if (_msgList) _msgList.scrollTop = _msgList.scrollHeight;
    if (_msgInput) _msgInput.focus();
  });
}

export function mount(container) {
  clear(container);
  getMessages();
  _root = h('div', { class: 'chat-wrap' });
  container.append(_root);
  render();
}

export default { meta, mount };
