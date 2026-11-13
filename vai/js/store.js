// ============================================================================
// store.js — global reactive-ish app state + localStorage fallback storage
// ============================================================================

import { LS, DEFAULTS, AUTO_FREE_MODEL } from "./config.js";
import { Emitter, uuid, tryJson, clone } from "./utils.js";
import { sb } from "./supabase.js";

// ---------------------------------------------------------------------------
// local storage helpers
// ---------------------------------------------------------------------------
const safeLS = {
  get(k, fallback) {
    try {
      const raw = localStorage.getItem(k);
      return raw == null ? fallback : tryJson(raw);
    } catch {
      return fallback;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      console.warn("[storage] set failed", k, e);
    }
  },
  raw(k, fallback) {
    try {
      return localStorage.getItem(k) ?? fallback;
    } catch {
      return fallback;
    }
  },
  rawSet(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
  remove(k) {
    try {
      localStorage.removeItem(k);
    } catch {}
  },
};

// ---------------------------------------------------------------------------
// Settings (user preferences)
// ---------------------------------------------------------------------------
export function getSettings() {
  const stored = safeLS.get(LS.settings, {});
  return { ...DEFAULTS, ...stored };
}

export function updateSettings(patch) {
  const cur = getSettings();
  const next = { ...cur, ...patch };
  safeLS.set(LS.settings, next);
  store.emit("settings:change", next);
  // Persist a subset to supabase settings for cross-device (best-effort)
  sb.setSetting("chat.settings", next).catch(() => {});
  return next;
}

export function getApiKey() {
  return safeLS.raw(LS.apiKey, "") || "";
}

export function setApiKey(key) {
  safeLS.rawSet(LS.apiKey, key || "");
  store.emit("apikey:change", key);
}

export function getTheme() {
  const t = safeLS.raw(LS.theme, "");
  if (t === "dark" || t === "light") return t;
  return DEFAULTS.theme;
}

export function setTheme(t) {
  safeLS.rawSet(LS.theme, t);
}

export function getModelFavs() {
  return safeLS.get(LS.modelFavs, {}) || {};
}

export function toggleModelFav(id) {
  const favs = getModelFavs();
  if (favs[id]) delete favs[id];
  else favs[id] = true;
  safeLS.set(LS.modelFavs, favs);
  store.emit("models:favs", favs);
  return favs;
}

// ---------------------------------------------------------------------------
// Local fallback conversations/messages (used when Supabase is unreachable)
// ---------------------------------------------------------------------------
export const localDB = {
  conversations() {
    return safeLS.get(LS.localConvs, []) || [];
  },
  saveConversations(list) {
    safeLS.set(LS.localConvs, list.slice(0, 500));
  },
  messages() {
    return safeLS.get(LS.localMsgs, {}) || {};
  },
  saveMessages(map) {
    // keep at most ~30 conversations' worth of messages
    safeLS.set(LS.localMsgs, map);
  },
  upsertConversation(conv) {
    const list = this.conversations();
    const idx = list.findIndex((c) => c.id === conv.id);
    if (idx >= 0) list[idx] = { ...list[idx], ...conv };
    else list.unshift(conv);
    list.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
    this.saveConversations(list);
    return conv;
  },
  removeConversation(id) {
    const list = this.conversations().filter((c) => c.id !== id);
    this.saveConversations(list);
    const msgs = this.messages();
    delete msgs[id];
    this.saveMessages(msgs);
  },
  getMessages(convId) {
    const msgs = this.messages();
    return (msgs[convId] || []).slice();
  },
  setMessages(convId, list) {
    const msgs = this.messages();
    msgs[convId] = list;
    this.saveMessages(msgs);
  },
  upsertMessage(convId, msg) {
    const msgs = this.messages();
    const arr = msgs[convId] || [];
    const i = arr.findIndex((m) => m.id === msg.id);
    if (i >= 0) arr[i] = { ...arr[i], ...msg };
    else arr.push(msg);
    arr.sort((a, b) => (a.seq || 0) - (b.seq || 0));
    msgs[convId] = arr;
    this.saveMessages(msgs);
    return msg;
  },
  deleteMessage(convId, id) {
    const msgs = this.messages();
    const arr = (msgs[convId] || []).filter((m) => m.id !== id);
    msgs[convId] = arr;
    this.saveMessages(msgs);
  },
  truncateAfter(convId, seq) {
    const msgs = this.messages();
    msgs[convId] = (msgs[convId] || []).filter((m) => (m.seq || 0) <= seq);
    this.saveMessages(msgs);
  },
};

// ---------------------------------------------------------------------------
// Global store
// ---------------------------------------------------------------------------
class Store extends Emitter {
  constructor() {
    super();
    this.state = {
      theme: getTheme(),
      settings: getSettings(),
      model: safeLS.raw(LS.lastModel, AUTO_FREE_MODEL),
      models: [],
      modelsLoaded: false,
      modelsLoading: false,
      modelsError: null,
      conversations: [],
      convsLoading: false,
      convsError: null,
      activeConvId: safeLS.raw(LS.lastConv, "") || null,
      messages: [],
      msgsLoading: false,
      backendOnline: null, // null|true|false
      streaming: false,
      editingMessageId: null,
      inspectorOpen: false,
      sidebarOpen: false,
      apiKey: getApiKey(),
    };
  }

  get() {
    return this.state;
  }

  set(patch, ev = null) {
    Object.assign(this.state, patch);
    if (ev) this.emit(ev, this.state);
    this.emit("change", this.state);
  }

  setTheme(t) {
    this.state.theme = t;
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
    this.emit("theme:change", t);
  }

  setModel(id) {
    this.state.model = id;
    safeLS.rawSet(LS.lastModel, id);
    this.emit("model:change", id);
    this.emit("change", this.state);
  }

  setActiveConv(id) {
    this.state.activeConvId = id || null;
    if (id) safeLS.rawSet(LS.lastConv, id);
    else safeLS.remove(LS.lastConv);
    this.emit("conv:active", id);
    this.emit("change", this.state);
  }

  setEditing(messageId) {
    this.state.editingMessageId = messageId;
    this.emit("edit:change", messageId);
  }

  setStreaming(v) {
    this.state.streaming = !!v;
    this.emit("streaming:change", !!v);
    this.emit("change", this.state);
  }
}

export const store = new Store();

// ---------------------------------------------------------------------------
// API abstraction — chooses Supabase or localDB at runtime
// ---------------------------------------------------------------------------
export const api = {
  async listConversations() {
    try {
      const rows = await sb.listConversations();
      store.set({ backendOnline: true });
      return rows || [];
    } catch (e) {
      console.warn("[api] fallback to local conversations:", e.message);
      store.set({ backendOnline: false });
      return localDB.conversations();
    }
  },

  async getOrCreateConversation(prefill = {}) {
    const nowIso = new Date().toISOString();
    const draft = {
      id: uuid(),
      title: prefill.title || "گفتگوی تازه",
      model: prefill.model || store.get().model,
      system_prompt: prefill.system_prompt || "",
      settings: prefill.settings || {},
      pinned: false,
      archived: false,
      message_count: 0,
      last_message_at: nowIso,
      created_at: nowIso,
      updated_at: nowIso,
    };
    try {
      const created = await sb.createConversation(draft);
      if (created) {
        store.set({ backendOnline: true });
        return created;
      }
    } catch (e) {
      console.warn("[api] createConversation fallback:", e.message);
      store.set({ backendOnline: false });
    }
    localDB.upsertConversation(draft);
    return draft;
  },

  async updateConversation(id, patch) {
    try {
      return await sb.updateConversation(id, patch);
    } catch {
      const conv = localDB.conversations().find((c) => c.id === id) || { id };
      localDB.upsertConversation({ ...conv, ...patch });
      return { ...conv, ...patch };
    }
  },

  async deleteConversation(id) {
    try {
      await sb.deleteConversation(id);
      return true;
    } catch {
      localDB.removeConversation(id);
      return true;
    }
  },

  async listMessages(convId) {
    try {
      const rows = await sb.listMessages(convId);
      store.set({ backendOnline: true });
      return rows || [];
    } catch (e) {
      console.warn("[api] fallback to local messages:", e.message);
      store.set({ backendOnline: false });
      return localDB.getMessages(convId);
    }
  },

  async insertMessage(convId, msg) {
    const payload = {
      id: msg.id || uuid(),
      conversation_id: convId,
      user_id: null,
      seq: msg.seq ?? 0,
      role: msg.role,
      content: msg.content ?? "",
      reasoning: msg.reasoning ?? null,
      status: msg.status || "complete",
      requested_model: msg.requested_model || null,
      resolved_model: msg.resolved_model || null,
      provider: msg.provider || null,
      usage: msg.usage || null,
      error: msg.error || null,
      request_payload: msg.request_payload || null,
      request_body: msg.request_body || null,
      request_headers: msg.request_headers || null,
      response_raw: msg.response_raw || null,
      edited: !!msg.edited,
      edit_history: msg.edit_history || [],
      attachments: msg.attachments || [],
      created_at: msg.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    try {
      const saved = await sb.insertMessage(payload);
      if (saved) return { ...payload, ...saved };
    } catch (e) {
      console.warn("[api] insertMessage fallback:", e.message);
    }
    localDB.upsertMessage(convId, payload);
    return payload;
  },

  async updateMessage(id, convId, patch) {
    try {
      const res = await sb.updateMessage(id, patch);
      if (res) return res;
    } catch (e) {
      console.warn("[api] updateMessage fallback:", e.message);
    }
    const msgs = localDB.getMessages(convId);
    const cur = msgs.find((m) => m.id === id);
    if (cur) localDB.upsertMessage(convId, { ...cur, ...patch, updated_at: new Date().toISOString() });
    return { ...(cur || { id }), ...patch };
  },

  async deleteMessage(id, convId) {
    try {
      await sb.deleteMessage(id);
    } catch {}
    localDB.deleteMessage(convId, id);
  },

  async truncateMessagesAfter(convId, seq) {
    try {
      await sb.deleteMessagesAfter(convId, seq);
    } catch {}
    localDB.truncateAfter(convId, seq);
  },
};
