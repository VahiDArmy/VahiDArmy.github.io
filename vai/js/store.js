import { uid, storage, debounce } from './utils.js';

const KEY = 'nebula_chat_state_v1';

const defaultSettings = {
  apiKey: '',
  theme: 'dark',
  defaultModel: 'openrouter/free',
  temperature: 0.7,
  maxTokens: 2048
};

class Store {
  constructor() {
    this.state = this.load();
    this.listeners = new Set();
    this._persist = debounce(() => this.persist(), 250);
  }

  load() {
    const saved = storage.get(KEY, null);
    if (saved && typeof saved === 'object') {
      const chats = Array.isArray(saved.chats) ? saved.chats : [];
      return {
        chats,
        activeChatId: saved.activeChatId && chats.some(c => c.id === saved.activeChatId)
          ? saved.activeChatId
          : (chats[0]?.id || null),
        settings: { ...defaultSettings, ...(saved.settings || {}) }
      };
    }
    return {
      chats: [],
      activeChatId: null,
      settings: { ...defaultSettings }
    };
  }

  persist() {
    storage.set(KEY, this.state);
  }

  flush() {
    this.persist();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    this._persist();
    for (const fn of this.listeners) {
      try { fn(this.state); }
      catch (e) { console.error('[store listener]', e); }
    }
  }

  getSettings() {
    return this.state.settings;
  }

  updateSettings(patch) {
    Object.assign(this.state.settings, patch);
    if (patch.theme) {
      document.documentElement.setAttribute('data-theme', patch.theme);
    }
    this.emit();
  }

  getChats() {
    return [...this.state.chats].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  getChat(id) {
    return this.state.chats.find(c => c.id === id) || null;
  }

  getActiveChat() {
    return this.getChat(this.state.activeChatId);
  }

  setActiveChat(id) {
    if (this.state.activeChatId === id) return;
    this.state.activeChatId = id;
    this.emit();
  }

  createChat(model) {
    const chat = {
      id: uid(),
      title: 'New chat',
      model: model || this.state.settings.defaultModel || 'openrouter/free',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      temperature: this.state.settings.temperature,
      maxTokens: this.state.settings.maxTokens,
      usedModel: null
    };
    this.state.chats.unshift(chat);
    this.state.activeChatId = chat.id;
    this.emit();
    return chat;
  }

  deleteChat(id) {
    this.state.chats = this.state.chats.filter(c => c.id !== id);
    if (this.state.activeChatId === id) {
      this.state.activeChatId = this.state.chats[0]?.id || null;
    }
    this.emit();
  }

  renameChat(id, title) {
    const chat = this.getChat(id);
    if (!chat) return;
    chat.title = title || 'Untitled';
    chat.updatedAt = Date.now();
    this.emit();
  }

  updateChat(id, patch) {
    const chat = this.getChat(id);
    if (!chat) return;
    Object.assign(chat, patch, { updatedAt: Date.now() });
    this.emit();
  }

  addMessage(chatId, msg) {
    const chat = this.getChat(chatId);
    if (!chat) return null;
    const message = {
      id: uid(),
      createdAt: Date.now(),
      role: msg.role,
      content: msg.content ?? '',
      model: msg.model || null,
      error: msg.error || null,
      errorDetail: msg.errorDetail || null,
      warning: msg.warning || null,
      pending: !!msg.pending,
      payload: msg.payload || null
    };
    chat.messages.push(message);
    chat.updatedAt = Date.now();
    if (chat.messages.length === 1 && message.role === 'user') {
      const t = String(message.content || '').replace(/\s+/g, ' ').trim();
      chat.title = t ? (t.length > 60 ? t.slice(0, 57) + '…' : t) : 'New chat';
    }
    this.emit();
    return message;
  }

  updateMessage(chatId, msgId, patch) {
    const chat = this.getChat(chatId);
    if (!chat) return;
    const m = chat.messages.find(x => x.id === msgId);
    if (!m) return;
    Object.assign(m, patch);

    // Update title dynamically if the first message is edited
    if (chat.messages.length > 0 && chat.messages[0].id === msgId && m.role === 'user') {
      const t = String(m.content || '').replace(/\s+/g, ' ').trim();
      chat.title = t ? (t.length > 60 ? t.slice(0, 57) + '…' : t) : 'New chat';
    }

    chat.updatedAt = Date.now();
    this.emit();
  }

  deleteMessage(chatId, msgId) {
    const chat = this.getChat(chatId);
    if (!chat) return;
    chat.messages = chat.messages.filter(m => m.id !== msgId);
    chat.updatedAt = Date.now();
    this.emit();
  }

  truncateAfter(chatId, msgId) {
    const chat = this.getChat(chatId);
    if (!chat) return;
    const idx = chat.messages.findIndex(m => m.id === msgId);
    if (idx < 0) return;
    chat.messages = chat.messages.slice(0, idx + 1);
    chat.updatedAt = Date.now();
    this.emit();
  }

  clearAllChats() {
    this.state.chats = [];
    this.state.activeChatId = null;
    this.emit();
  }
}

export const store = new Store();
