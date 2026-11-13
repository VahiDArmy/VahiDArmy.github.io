/* ============================================================================
   Miraj — single-file application. All modules in one classic script.
   Loaded AFTER js/dev/watchdog.js from index.html.
   Uses window-scope `var` so modules can reference each other.
   ========================================================================== */
(function () {
  'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════════════
var Utils = (function() {
  var HTML_ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function escapeHtml(s) { if (s == null) return ""; return String(s).replace(/[&<>"']/g, function(c){ return HTML_ESC[c]; }); }
  function debounce(fn, ms) { ms = ms == null ? 250 : ms; var t; return function() { var self = this, args = arguments; clearTimeout(t); t = setTimeout(function(){ fn.apply(self, args); }, ms); }; }
  function uuid() { if (crypto && crypto.randomUUID) return crypto.randomUUID(); return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c){ var r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16); }); }
  function formatTime(ts) { var d = ts instanceof Date ? ts : new Date(ts); if (isNaN(d.getTime())) return "—"; try { return d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }); } catch(e){ return d.toISOString().slice(11, 16); } }
  function formatDate(ts) { var d = ts instanceof Date ? ts : new Date(ts); if (isNaN(d.getTime())) return "—"; try { return d.toLocaleDateString("fa-IR", { month: "short", day: "numeric" }); } catch(e){ return d.toISOString().slice(0, 10); } }
  function formatRelative(ts) { var d = ts instanceof Date ? ts : new Date(ts); var diff = (Date.now() - d.getTime()) / 1000; if (diff < 45) return "همین حالا"; if (diff < 3600) return Math.floor(diff / 60) + " دقیقه پیش"; if (diff < 86400) return Math.floor(diff / 3600) + " ساعت پیش"; if (diff < 604800) return Math.floor(diff / 86400) + " روز پیش"; return formatDate(d); }
  function fa(n) { if (n == null || n === "") return ""; var s = String(n); var map = "۰۱۲۳۴۵۶۷۸۹"; return s.replace(/[0-9]/g, function(d){ return map[+d]; }); }
  function faInt(n) { if (n == null || isNaN(n)) return "۰"; return fa(Math.round(n)); }
  function fmtTokens(n) { if (n == null || isNaN(n)) return "۰"; n = Number(n); if (n < 1000) return fa(Math.round(n)); if (n < 1e6) { var v = n / 1000; return fa(v.toFixed(v < 10 ? 1 : 0)) + "K"; } var v2 = n / 1e6; return fa(v2.toFixed(v2 < 10 ? 1 : 0)) + "M"; }
  function fmtBytes(b) { if (b == null || isNaN(b)) return "۰"; var units = ["B", "KB", "MB", "GB"]; var i = 0; var v = Number(b); while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; } return fa(v.toFixed(v < 10 ? 1 : 0)) + " " + units[i]; }
  function estimateTokens(text) { if (!text) return 0; var tokens = 0; for (var _i = 0, _arr = Array.from(text); _i < _arr.length; _i++) { var ch = _arr[_i]; var c = ch.codePointAt(0); if (c <= 127) tokens += 1 / 4; else if (c >= 0x0600 && c <= 0x06ff) tokens += 1 / 1.8; else if ((c >= 0x3040 && c <= 0x30ff) || (c >= 0x4e00 && c <= 0x9fff)) tokens += 1 / 1.5; else tokens += 1 / 2; } return Math.ceil(tokens); }
  function byteLength(str) { if (!str) return 0; try { return new TextEncoder().encode(str).length; } catch(e){ return unescape(encodeURIComponent(str)).length; } }
  async function copyText(text) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch(e){}
    try { var ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;opacity:0;pointer-events:none"; document.body.appendChild(ta); ta.focus(); ta.select(); var ok = document.execCommand("copy"); document.body.removeChild(ta); return ok; } catch(e){ return false; }
  }
  function autoScroll(c, opts) { opts = opts || {}; var threshold = opts.threshold || 90; var smooth = opts.smooth !== false; if (!c) return false; var gap = c.scrollHeight - c.scrollTop - c.clientHeight; if (gap <= threshold) { c.scrollTo({ top: c.scrollHeight, behavior: smooth ? "smooth" : "auto" }); return true; } return false; }
  function isNearBottom(c, threshold) { threshold = threshold || 120; if (!c) return true; return c.scrollHeight - c.scrollTop - c.clientHeight <= threshold; }
  function tryJson(s) { try { return JSON.parse(s); } catch(e){ return null; } }
  function clone(v) { try { return structuredClone ? structuredClone(v) : JSON.parse(JSON.stringify(v)); } catch(e){ return v; } }
  var _listeners = {};
  var emitter = {
    on: function(ev, cb) { if (!_listeners[ev]) _listeners[ev] = []; _listeners[ev].push(cb); return function(){ emitter.off(ev, cb); }; },
    off: function(ev, cb) { var arr = _listeners[ev]; if (!arr) return; var i = arr.indexOf(cb); if (i >= 0) arr.splice(i, 1); },
    emit: function(ev) { var arr = _listeners[ev]; if (!arr) return; var args = Array.prototype.slice.call(arguments, 1); for (var i = 0; i < arr.length; i++) { try { arr[i].apply(null, args); } catch(e){ console.error(e); } } }
  };
  return { escapeHtml: escapeHtml, debounce: debounce, uuid: uuid, formatTime: formatTime, formatDate: formatDate, formatRelative: formatRelative, fa: fa, faInt: faInt, fmtTokens: fmtTokens, fmtBytes: fmtBytes, estimateTokens: estimateTokens, byteLength: byteLength, copyText: copyText, autoScroll: autoScroll, isNearBottom: isNearBottom, tryJson: tryJson, clone: clone, emitter: emitter };
})();

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════
var Config = {
  SUPABASE_URL: "https://ummhohozmpwltbgeczsf.supabase.co",
  SUPABASE_KEY: "sb_publishable_WcK2pmYMMu61z0KUub5jLA_KSxGpQD6",
  OPENROUTER_BASE: "https://openrouter.ai/api/v1",
  OPENROUTER_CHAT: "https://openrouter.ai/api/v1/chat/completions",
  OPENROUTER_MODELS: "https://openrouter.ai/api/v1/models",
  APP_NAME: "معراج",
  APP_VERSION: "1.1.0",
  APP_URL: (typeof window !== "undefined" && window.location.origin) || "https://localhost",
  LS: {
    theme: "miraj.theme", lastModel: "miraj.lastModel", lastConv: "miraj.lastConv",
    apiKey: "miraj.apiKey", modelFavs: "miraj.modelFavs", localConvs: "miraj.localConvs",
    localMsgs: "miraj.localMsgs", modelsCache: "miraj.modelsCache", settings: "miraj.settings"
  },
  DEFAULTS: {
    theme: "dark", model: "openrouter/free", temperature: 0.7, top_p: 1, max_tokens: 4096,
    frequency_penalty: 0, presence_penalty: 0, system_prompt: "", stream: true,
    include_reasoning: true, history_turns: 40, model_refresh_ms: 1000 * 60 * 60 * 6
  },
  AUTO_FREE_MODEL: "openrouter/free",
  ROLES: { user: "کاربر", assistant: "دستیار", system: "سیستم" }
};

// ═══════════════════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════════════════
var Toast = (function() {
  var ICONS = {
    ok: '<svg width="16" height="16" viewBox="0 0 24 24"><path d="M4.5 12.5 9 17l10.5-10.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    err: '<svg width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.5v6M12 16.5v.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    warn: '<svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 3.5 21 20H3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v4M12 16.5v.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    info: '<svg width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v6M12 7.5v.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>'
  };
  function getRoot() { return document.getElementById("toasts"); }
  function showToast(opts) {
    var root = getRoot(); if (!root) return;
    opts = opts || {};
    var kind = opts.kind || "info";
    var timeout = opts.timeout == null ? 5000 : opts.timeout;
    var el = document.createElement("div");
    el.className = "toast toast--" + kind;
    el.setAttribute("role", kind === "err" ? "alert" : "status");
    var icon = ICONS[kind] || ICONS.info;
    el.innerHTML = '<span class="toast__ico">' + icon + '</span>' +
      '<div class="toast__body">' + (opts.title ? '<div class="toast__title">' + Utils.escapeHtml(opts.title) + '</div>' : '') + (opts.message ? '<div class="toast__msg">' + Utils.escapeHtml(String(opts.message)) + '</div>' : '') + '</div>' +
      '<button type="button" class="toast__close"><svg width="12" height="12" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>';
    var remove = function() { el.classList.add("is-out"); setTimeout(function(){ el.remove(); }, 180); };
    el.querySelector(".toast__close").addEventListener("click", remove);
    root.appendChild(el);
    if (timeout > 0) setTimeout(remove, timeout);
    return { remove: remove };
  }
  var toast = {
    ok: function(msg, title) { return showToast({ kind: "ok", message: msg, title: title }); },
    err: function(msg, title) { return showToast({ kind: "err", message: msg, title: title, timeout: 9000 }); },
    warn: function(msg, title) { return showToast({ kind: "warn", message: msg, title: title, timeout: 7000 }); },
    info: function(msg, title) { return showToast({ kind: "info", message: msg, title: title }); },
    custom: showToast
  };
  return { toast: toast, showToast: showToast };
})();

// ═══════════════════════════════════════════════════════════════════════════
// SUPABASE
// ═══════════════════════════════════════════════════════════════════════════
var Supa = (function() {
  var BASE = Config.SUPABASE_URL + "/rest/v1";
  var KEY = Config.SUPABASE_KEY;
  function headers(extra) { var h = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json", Accept: "application/json" }; if (extra) Object.assign(h, extra); return h; }
  async function request(path, opts) {
    opts = opts || {};
    var method = opts.method || "GET";
    var body = opts.body;
    var query = opts.query;
    var prefer = opts.prefer;
    var extraHeaders = opts.extraHeaders;
    var url = BASE + path;
    if (query) { var qs = new URLSearchParams(); for (var k in query) { if (query[k] != null) qs.append(k, String(query[k])); } var s = qs.toString(); if (s) url += "?" + s; }
    var h = headers(prefer ? { Prefer: prefer } : null);
    if (extraHeaders) Object.assign(h, extraHeaders);
    var res = await fetch(url, { method: method, headers: h, body: body != null ? JSON.stringify(body) : undefined });
    if (!res.ok) {
      var detail = null;
      try { detail = await res.json(); } catch(e) { try { detail = await res.text(); } catch(e2){ detail = null; } }
      var err = new Error("Supabase " + method + " " + path + " → HTTP " + res.status);
      err.status = res.status; err.detail = detail; throw err;
    }
    if (res.status === 204) return null;
    var ct = res.headers.get("content-type") || "";
    if (ct.indexOf("application/json") < 0) return res.text();
    return res.json();
  }
  var sb = {
    ping: async function() { try { var res = await fetch(BASE + "/chat_settings?select=k&limit=1", { headers: headers() }); return { ok: res.ok, status: res.status }; } catch(e){ return { ok: false, status: 0 }; } },
    listConversations: async function() { return request("/chat_conversations", { query: { select: "*", order: "last_message_at.desc", limit: 200, archived: "eq.false" } }); },
    getConversation: async function(id) { var rows = await request("/chat_conversations", { query: { select: "*", id: "eq." + id, limit: 1 } }); return rows && rows[0] || null; },
    createConversation: async function(p) { var rows = await request("/chat_conversations", { method: "POST", body: p, prefer: "return=representation" }); return rows && rows[0] || null; },
    updateConversation: async function(id, patch) { var b = Object.assign({}, patch, { updated_at: new Date().toISOString() }); var rows = await request("/chat_conversations", { method: "PATCH", query: { id: "eq." + id }, body: b, prefer: "return=representation" }); return rows && rows[0] || null; },
    deleteConversation: async function(id) { await request("/chat_conversations", { method: "DELETE", query: { id: "eq." + id } }); },
    listMessages: async function(cid) { return request("/chat_messages", { query: { select: "*", conversation_id: "eq." + cid, order: "seq.asc,created_at.asc" } }); },
    insertMessage: async function(p) { var rows = await request("/chat_messages", { method: "POST", body: p, prefer: "return=representation" }); return rows && rows[0] || null; },
    updateMessage: async function(id, patch) { var b = Object.assign({}, patch, { updated_at: new Date().toISOString() }); var rows = await request("/chat_messages", { method: "PATCH", query: { id: "eq." + id }, body: b, prefer: "return=representation" }); return rows && rows[0] || null; },
    deleteMessage: async function(id) { await request("/chat_messages", { method: "DELETE", query: { id: "eq." + id } }); },
    deleteMessagesAfter: async function(cid, seq) { await request("/chat_messages", { method: "DELETE", query: { conversation_id: "eq." + cid, seq: "gt." + seq } }); },
    listModels: async function() { return request("/chat_models", { query: { select: "*", order: "sort_index.asc, id.asc" } }); },
    upsertModels: async function(list) {
      if (!list || !list.length) return [];
      var all = [];
      for (var i = 0; i < list.length; i += 120) {
        var chunk = list.slice(i, i + 120);
        try { var rows = await request("/chat_models", { method: "POST", body: chunk, prefer: "resolution=merge-duplicates,return=representation", extraHeaders: { Prefer: "resolution=merge-duplicates,return=representation" } }); if (Array.isArray(rows)) all = all.concat(rows); } catch(e){ console.warn("[sb] upsertModels chunk failed", e); }
      }
      return all;
    }
  };
  return { sb: sb };
})();

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════
var StoreModule = (function() {
  var LS = Config.LS, DEFAULTS = Config.DEFAULTS, AUTO_FREE = Config.AUTO_FREE_MODEL;
  var safeLS = {
    get: function(k, fb) { try { var r = localStorage.getItem(k); return r == null ? fb : Utils.tryJson(r); } catch(e){ return fb; } },
    set: function(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){ console.warn("[storage]", e); } },
    raw: function(k, fb) { try { return localStorage.getItem(k) || fb; } catch(e){ return fb; } },
    rawSet: function(k, v) { try { localStorage.setItem(k, v); } catch(e){} },
    remove: function(k) { try { localStorage.removeItem(k); } catch(e){} }
  };
  function getSettings() { var s = safeLS.get(LS.settings, {}); return Object.assign({}, DEFAULTS, s); }
  function updateSettings(patch) { var next = Object.assign({}, getSettings(), patch); safeLS.set(LS.settings, next); Store.emit("settings:change", next); return next; }
  function getApiKey() { return safeLS.raw(LS.apiKey, ""); }
  function setApiKey(k) { safeLS.rawSet(LS.apiKey, k || ""); Store.emit("apikey:change", k); }
  function getTheme() { var t = safeLS.raw(LS.theme, ""); return (t === "dark" || t === "light") ? t : DEFAULTS.theme; }
  function setTheme(t) { safeLS.rawSet(LS.theme, t); }
  function getModelFavs() { return safeLS.get(LS.modelFavs, {}) || {}; }
  function toggleModelFav(id) { var f = getModelFavs(); if (f[id]) delete f[id]; else f[id] = true; safeLS.set(LS.modelFavs, f); Store.emit("models:favs", f); return f; }
  var localDB = {
    conversations: function() { return safeLS.get(LS.localConvs, []) || []; },
    saveConversations: function(l) { safeLS.set(LS.localConvs, l.slice(0, 200)); },
    messages: function() { return safeLS.get(LS.localMsgs, {}) || {}; },
    saveMessages: function(m) { safeLS.set(LS.localMsgs, m); },
    upsertConversation: function(c) { var l = this.conversations(); var i = l.findIndex(function(x){ return x.id === c.id; }); if (i >= 0) l[i] = Object.assign({}, l[i], c); else l.unshift(c); l.sort(function(a, b){ return new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0); }); this.saveConversations(l); return c; },
    removeConversation: function(id) { this.saveConversations(this.conversations().filter(function(c){ return c.id !== id; })); var m = this.messages(); delete m[id]; this.saveMessages(m); },
    getMessages: function(cid) { return (this.messages()[cid] || []).slice(); },
    setMessages: function(cid, l) { var m = this.messages(); m[cid] = l; this.saveMessages(m); },
    upsertMessage: function(cid, msg) { var m = this.messages(); var a = m[cid] || []; var i = a.findIndex(function(x){ return x.id === msg.id; }); if (i >= 0) a[i] = Object.assign({}, a[i], msg); else a.push(msg); a.sort(function(x, y){ return (x.seq || 0) - (y.seq || 0); }); m[cid] = a; this.saveMessages(m); return msg; },
    deleteMessage: function(cid, id) { var m = this.messages(); m[cid] = (m[cid] || []).filter(function(x){ return x.id !== id; }); this.saveMessages(m); },
    truncateAfter: function(cid, seq) { var m = this.messages(); m[cid] = (m[cid] || []).filter(function(x){ return (x.seq || 0) <= seq; }); this.saveMessages(m); }
  };
  function Store() {
    var self = this;
    this.state = {
      theme: getTheme(), settings: getSettings(), model: safeLS.raw(LS.lastModel, AUTO_FREE),
      models: [], modelsLoaded: false, modelsLoading: false, modelsError: null,
      conversations: [], convsLoading: false,
      activeConvId: safeLS.raw(LS.lastConv, "") || null,
      messages: [], msgsLoading: false,
      backendOnline: null, streaming: false, editingMessageId: null,
      inspectorOpen: false, apiKey: getApiKey()
    };
    this._ls = {};
    Utils.emitter.on = Utils.emitter.on.bind(Utils.emitter);
    this.on = Utils.emitter.on;
    this.off = Utils.emitter.off;
    this.emit = Utils.emitter.emit;
  }
  Store.prototype.get = function() { return this.state; };
  Store.prototype.set = function(patch, ev) { Object.assign(this.state, patch); if (ev) this.emit(ev, this.state); this.emit("change", this.state); };
  Store.prototype.setTheme = function(t) { this.state.theme = t; setTheme(t); document.documentElement.setAttribute("data-theme", t); this.emit("theme:change", t); };
  Store.prototype.setModel = function(id) { this.state.model = id; safeLS.rawSet(LS.lastModel, id); this.emit("model:change", id); this.emit("change", this.state); };
  Store.prototype.setActiveConv = function(id) { this.state.activeConvId = id || null; if (id) safeLS.rawSet(LS.lastConv, id); else safeLS.remove(LS.lastConv); this.emit("conv:active", id); this.emit("change", this.state); };
  Store.prototype.setEditing = function(id) { this.state.editingMessageId = id; this.emit("edit:change", id); };
  Store.prototype.setStreaming = function(v) { this.state.streaming = !!v; this.emit("streaming:change", !!v); this.emit("change", this.state); };
  var Store = new Store();
  var api = {
    listConversations: async function() { try { var rows = await Supa.sb.listConversations(); Store.set({ backendOnline: true }); return rows || []; } catch(e){ console.warn("[api] fallback to local:", e.message); Store.set({ backendOnline: false }); return localDB.conversations(); } },
    getOrCreateConversation: async function(prefill) {
      prefill = prefill || {};
      var now = new Date().toISOString();
      var draft = { id: Utils.uuid(), title: prefill.title || "گفتگوی تازه", model: prefill.model || Store.get().model, system_prompt: prefill.system_prompt || "", settings: prefill.settings || {}, pinned: false, archived: false, message_count: 0, last_message_at: now, created_at: now, updated_at: now };
      try { var created = await Supa.sb.createConversation(draft); if (created) { Store.set({ backendOnline: true }); return created; } } catch(e){ console.warn("[api] createConversation fallback:", e.message); Store.set({ backendOnline: false }); }
      localDB.upsertConversation(draft); return draft;
    },
    updateConversation: async function(id, patch) { try { return await Supa.sb.updateConversation(id, patch); } catch(e){ var c = localDB.conversations().find(function(x){ return x.id === id; }) || { id: id }; localDB.upsertConversation(Object.assign({}, c, patch)); return Object.assign({}, c, patch); } },
    deleteConversation: async function(id) { try { await Supa.sb.deleteConversation(id); } catch(e){} localDB.removeConversation(id); return true; },
    listMessages: async function(cid) { try { var rows = await Supa.sb.listMessages(cid); Store.set({ backendOnline: true }); return rows || []; } catch(e){ console.warn("[api] fallback to local messages:", e.message); Store.set({ backendOnline: false }); return localDB.getMessages(cid); } },
    insertMessage: async function(cid, msg) {
      var p = { id: msg.id || Utils.uuid(), conversation_id: cid, user_id: null, seq: msg.seq || 0, role: msg.role, content: msg.content || "", reasoning: msg.reasoning || null, status: msg.status || "complete", requested_model: msg.requested_model || null, resolved_model: msg.resolved_model || null, provider: msg.provider || null, usage: msg.usage || null, error: msg.error || null, request_payload: msg.request_payload || null, request_body: msg.request_body || null, request_headers: msg.request_headers || null, response_raw: msg.response_raw || null, edited: !!msg.edited, edit_history: msg.edit_history || [], attachments: msg.attachments || [], created_at: msg.created_at || new Date().toISOString(), updated_at: new Date().toISOString() };
      try { var s = await Supa.sb.insertMessage(p); if (s) return Object.assign({}, p, s); } catch(e){ console.warn("[api] insertMessage fallback:", e.message); }
      localDB.upsertMessage(cid, p); return p;
    },
    updateMessage: async function(id, cid, patch) { try { var res = await Supa.sb.updateMessage(id, patch); if (res) return res; } catch(e){ console.warn("[api] updateMessage fallback:", e.message); } var msgs = localDB.getMessages(cid); var cur = msgs.find(function(m){ return m.id === id; }); if (cur) localDB.upsertMessage(cid, Object.assign({}, cur, patch, { updated_at: new Date().toISOString() })); return Object.assign({}, cur || { id: id }, patch); },
    deleteMessage: async function(id, cid) { try { await Supa.sb.deleteMessage(id); } catch(e){} localDB.deleteMessage(cid, id); },
    truncateMessagesAfter: async function(cid, seq) { try { await Supa.sb.deleteMessagesAfter(cid, seq); } catch(e){} localDB.truncateAfter(cid, seq); }
  };
  return { store: Store, api: api, getSettings: getSettings, updateSettings: updateSettings, getApiKey: getApiKey, setApiKey: setApiKey, getTheme: getTheme, setTheme: setTheme, getModelFavs: getModelFavs, toggleModelFav: toggleModelFav, localDB: localDB };
})();
var Store = StoreModule.store;
var api = StoreModule.api;
var getSettings = StoreModule.getSettings;
var updateSettings = StoreModule.updateSettings;
var getApiKey = StoreModule.getApiKey;
var setApiKey = StoreModule.setApiKey;
var getTheme = StoreModule.getTheme;
var setTheme = StoreModule.setTheme;
var getModelFavs = StoreModule.getModelFavs;
var toggleModelFav = StoreModule.toggleModelFav;
var localDB = StoreModule.localDB;

// ═══════════════════════════════════════════════════════════════════════════
// MODELS
// ═══════════════════════════════════════════════════════════════════════════
var ModelsModule = (function() {
  var LS = Config.LS, DEFAULTS = Config.DEFAULTS, AUTO_FREE = Config.AUTO_FREE_MODEL;
  var LS_CACHE = LS.modelsCache;
  function isFreePricing(p) { if (!p) return true; var keys = ["prompt", "completion", "request", "image"]; for (var i = 0; i < keys.length; i++) { var v = p[keys[i]]; if (v == null) continue; var n = Number(v); if (isFinite(n) && n > 0) return false; } return true; }
  function normalizeModel(raw) {
    if (!raw) return null;
    var id = raw.id || "";
    var pricing = raw.pricing || {};
    var free = isFreePricing(pricing);
    var arch = raw.architecture || {};
    var ctx = Number(raw.context_length) || Number(arch.context_length) || Number(raw.top_provider && raw.top_provider.context_length) || 0;
    var maxOut = Number(raw.top_provider && raw.top_provider.max_completion_tokens) || null;
    return { id: id, name: raw.name || id, description: raw.description || "", context_length: ctx, max_completion_tokens: maxOut, pricing: pricing, architecture: arch, supported_parameters: Array.isArray(raw.supported_parameters) ? raw.supported_parameters : [], modality: arch.modality || "", is_free: free, raw: raw, enabled: true, favorite: false, hidden: false, sort_index: 0, fetched_at: new Date().toISOString() };
  }
  async function fetchOpenRouterModels(force) {
    if (!force) { var cached = Utils.tryJson(localStorage.getItem(LS_CACHE) || "null"); if (cached && cached.ts && (Date.now() - cached.ts < DEFAULTS.model_refresh_ms)) return cached.list || []; }
    var res = await fetch(Config.OPENROUTER_MODELS, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("OpenRouter /models → HTTP " + res.status);
    var json = await res.json();
    var list = Array.isArray(json && json.data) ? json.data : [];
    var normalized = list.map(normalizeModel).filter(Boolean);
    var freeModels = normalized.filter(function(m){ return m.is_free; });
    try { localStorage.setItem(LS_CACHE, JSON.stringify({ ts: Date.now(), list: freeModels })); } catch(e){}
    return freeModels;
  }
  async function persistToSupabase(list) { if (!list.length) return; var slim = list.map(function(m){ return { id: m.id, name: m.name, description: m.description, context_length: m.context_length, max_completion_tokens: m.max_completion_tokens, pricing: m.pricing, architecture: m.architecture, supported_parameters: m.supported_parameters, modality: m.modality, is_free: m.is_free, enabled: true, sort_index: m.sort_index || 0, fetched_at: m.fetched_at, raw: { id: m.id } }; }); try { await Supa.sb.upsertModels(slim); } catch(e){ console.warn("[models] supabase upsert failed:", e.message); } }
  async function loadModels(opts) {
    opts = opts || {};
    var s = Store.get();
    if (s.modelsLoading) return s.models;
    Store.set({ modelsLoading: true, modelsError: null }, "models:loading");
    var list = [];
    var err = null;
    try {
      var rows = await Supa.sb.listModels();
      if (Array.isArray(rows) && rows.length > 0) {
        list = rows.map(function(r){ return { id: r.id, name: r.name, description: r.description || "", context_length: r.context_length || 0, max_completion_tokens: r.max_completion_tokens || null, pricing: r.pricing || {}, architecture: r.architecture || {}, supported_parameters: Array.isArray(r.supported_parameters) ? r.supported_parameters : [], modality: r.modality || "", is_free: !!r.is_free, enabled: r.enabled !== false, favorite: !!r.favorite, hidden: !!r.hidden, sort_index: r.sort_index || 0, fetched_at: r.fetched_at || new Date().toISOString() }; }).filter(function(m){ return m.is_free; });
      }
    } catch(e){}
    if (!list.length) {
      try { list = await fetchOpenRouterModels(!!opts.force); persistToSupabase(list).catch(function(){}); } catch(e) { err = e; var cached = Utils.tryJson(localStorage.getItem(LS_CACHE) || "null"); if (cached && Array.isArray(cached.list)) list = cached.list; }
    }
    var favs = Utils.tryJson(localStorage.getItem(LS.modelFavs) || "{}") || {};
    list = list.map(function(m){ return Object.assign({}, m, { favorite: !!favs[m.id] }); });
    list = list.filter(function(m){ return m.id !== AUTO_FREE; });
    list.sort(function(a, b) { if (!!b.favorite !== !!a.favorite) return b.favorite ? 1 : -1; return (b.context_length || 0) - (a.context_length || 0); });
    Store.set({ models: list, modelsLoading: false, modelsLoaded: true, modelsError: err ? String(err.message || err) : null }, "models:change");
    return list;
  }
  function findModel(id) { if (!id) return null; if (id === AUTO_FREE) return { id: AUTO_FREE, name: "Auto · Free", description: "OpenRouter خودش یک مدل رایگان مناسب انتخاب می‌کند.", context_length: 0, is_free: true }; return Store.get().models.find(function(m){ return m.id === id; }) || null; }
  function modelDisplayName(id) { if (id === AUTO_FREE) return "Auto · Free"; var m = findModel(id); if (m && m.name) return m.name.replace(/^[^:]+:\s*/, ""); return id || "—"; }
  function modelContextLength(id) { if (id === AUTO_FREE) return 0; var m = findModel(id); return m ? m.context_length || 0 : 0; }
  return { loadModels: loadModels, findModel: findModel, modelDisplayName: modelDisplayName, modelContextLength: modelContextLength };
})();
var loadModels = ModelsModule.loadModels;
var findModel = ModelsModule.findModel;
var modelDisplayName = ModelsModule.modelDisplayName;
var modelContextLength = ModelsModule.modelContextLength;

// ═══════════════════════════════════════════════════════════════════════════
// OPENROUTER
// ═══════════════════════════════════════════════════════════════════════════
var OpenRouter = (function() {
  function buildPayload(o) {
    var body = { model: o.model, messages: o.messages, stream: !!o.stream };
    if (o.temperature != null) body.temperature = Number(o.temperature);
    if (o.top_p != null) body.top_p = Number(o.top_p);
    if (o.max_tokens != null) body.max_tokens = Number(o.max_tokens);
    if (o.frequency_penalty) body.frequency_penalty = Number(o.frequency_penalty);
    if (o.presence_penalty) body.presence_penalty = Number(o.presence_penalty);
    if (o.include_reasoning) body.reasoning = { effort: "medium" };
    if (o.extra) Object.assign(body, o.extra);
    return body;
  }
  function serialiseBody(b) { return JSON.stringify(b); }
  function buildHeaders(o) { var k = o.apiKey || getApiKey() || ""; var h = { "Content-Type": "application/json", Accept: "text/event-stream", "HTTP-Referer": Config.APP_URL, "X-Title": Config.APP_NAME }; if (k) h.Authorization = "Bearer " + k; if (o.requestId) h["X-Request-Id"] = o.requestId; return h; }
  function parseSSEChunk(buf) {
    var events = []; var idx = buf.indexOf("\n\n");
    while (idx !== -1) {
      var raw = buf.slice(0, idx); buf = buf.slice(idx + 2); idx = buf.indexOf("\n\n");
      var lines = raw.split("\n"); var data = ""; var eventName = "message";
      for (var i = 0; i < lines.length; i++) { var line = lines[i]; if (line.startsWith(":")) continue; if (line.startsWith("event:")) eventName = line.slice(6).trim(); else if (line.startsWith("data:")) data += (data ? "\n" : "") + line.slice(5).trimStart(); }
      events.push({ event: eventName, data: data });
    }
    return { buffer: buf, events: events };
  }
  function makeApiError(res, rawText, extra) {
    var parsed = null; try { parsed = JSON.parse(rawText); } catch(e){ parsed = null; }
    var err = new Error((parsed && (parsed.error && parsed.error.message || parsed.message)) || "HTTP " + (res ? res.status : "?"));
    err.httpStatus = res ? res.status : null;
    err.statusText = res ? res.statusText : "";
    err.detail = parsed;
    err.rawText = rawText;
    err.headers = res ? (function(){ var h = {}; res.headers.forEach(function(v, k){ h[k] = v; }); return h; })() : {};
    if (extra) Object.assign(err, extra);
    return err;
  }
  async function streamChat(o) {
    var body = serialiseBody(o.payload);
    var res = await fetch(Config.OPENROUTER_CHAT, { method: "POST", headers: o.headers, body: body, signal: o.signal });
    if (!res.ok) { var raw = ""; try { raw = await res.text(); } catch(e){} var err = makeApiError(res, raw, { requestBody: body }); if (o.onError) o.onError(err); throw err; }
    var ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.indexOf("event-stream") < 0) {
      var raw2 = await res.text(); var parsed = null; try { parsed = JSON.parse(raw2); } catch(e){}
      var choice = parsed && parsed.choices && parsed.choices[0];
      if (choice) { var content = (choice.message && choice.message.content) || (choice.delta && choice.delta.content) || ""; var reasoning = (choice.message && choice.message.reasoning) || (choice.delta && choice.delta.reasoning) || ""; var rm = parsed.model || o.payload.model; var prov = parsed.provider || null; var usage = parsed.usage || null; if (o.onMeta) o.onMeta({ resolvedModel: rm, provider: prov }); if (content && o.onDelta) o.onDelta({ content: content }); if (reasoning && o.onDelta) o.onDelta({ reasoning: reasoning }); if (usage && o.onUsage) o.onUsage(usage); return { fullText: content, reasoning: reasoning, resolvedModel: rm, provider: prov, usage: usage, raw: raw2 }; }
      var err2 = makeApiError(res, raw2, { requestBody: body }); if (o.onError) o.onError(err2); throw err2;
    }
    var reader = res.body.getReader(); var decoder = new TextDecoder("utf-8"); var buffer = ""; var fullText = ""; var reasoning = ""; var resolvedModel = o.payload.model; var provider = null; var usage = null; var rawAll = "";
    var metaEmitted = false;
    var emitMeta = function() { if (!metaEmitted && o.onMeta) { o.onMeta({ resolvedModel: resolvedModel, provider: provider }); metaEmitted = true; } };
    try {
      while (true) {
        var _a = await reader.read(); var value = _a.value; var done = _a.done;
        if (done) break;
        var text = decoder.decode(value, { stream: true }); rawAll += text; buffer += text;
        var parsed2 = parseSSEChunk(buffer); buffer = parsed2.buffer;
        for (var i = 0; i < parsed2.events.length; i++) {
          var evt = parsed2.events[i]; if (!evt.data || evt.data === "[DONE]") continue;
          var json = null; try { json = JSON.parse(evt.data); } catch(e){ continue; }
          if (json.model) resolvedModel = json.model; if (json.provider) provider = json.provider;
          if (json.usage) { usage = json.usage; if (o.onUsage) o.onUsage(usage); }
          if (json.error) { var err3 = makeApiError(res, evt.data, { detail: json.error, providerError: json.error, requestBody: body }); emitMeta(); if (o.onError) o.onError(err3); throw err3; }
          var choice2 = json.choices && json.choices[0]; if (!choice2) continue;
          var delta = choice2.delta || {}; var msg = choice2.message || {};
          var c = delta.content != null ? delta.content : (msg.content != null ? msg.content : "");
          var r = delta.reasoning != null ? delta.reasoning : (msg.reasoning != null ? msg.reasoning : "");
          if (c || r) { emitMeta(); if (c) fullText += c; if (r) reasoning += r; if (o.onDelta) o.onDelta({ content: c, reasoning: r }); }
          if (choice2.finish_reason) emitMeta();
        }
      }
    } finally { try { reader.releaseLock(); } catch(e){} }
    emitMeta();
    return { fullText: fullText, reasoning: reasoning, resolvedModel: resolvedModel, provider: provider, usage: usage, raw: rawAll };
  }
  return { buildPayload: buildPayload, serialiseBody: serialiseBody, buildHeaders: buildHeaders, streamChat: streamChat };
})();
var buildPayload = OpenRouter.buildPayload;
var serialiseBody = OpenRouter.serialiseBody;
var buildHeaders = OpenRouter.buildHeaders;
var streamChat = OpenRouter.streamChat;

// ═══════════════════════════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════════════════════════
var ErrorsModule = (function() {
  function normaliseError(err, ctx) {
    ctx = ctx || {};
    if (!err) return { httpStatus: null, statusText: "", message: "خطای نامشخص", detail: null, rawText: "", headers: {}, provider: null };
    var detail = err.detail != null ? err.detail : null;
    var provider = (detail && detail.error && detail.error.metadata && detail.error.metadata.provider_name) || (detail && detail.provider_name) || (detail && detail.provider) || (err.providerError && err.providerError.metadata && err.providerError.metadata.provider_name) || null;
    var providerMsg = (detail && detail.error && detail.error.message) || (detail && detail.message) || (err.providerError && err.providerError.message) || null;
    return { httpStatus: err.httpStatus != null ? err.httpStatus : (err.status != null ? err.status : null), statusText: err.statusText || "", message: providerMsg || err.message || String(err), detail: detail || err.providerError || null, rawText: err.rawText || "", headers: err.headers || {}, provider: provider, requestId: err.requestId || ctx.requestId || null, at: new Date().toISOString() };
  }
  return { normaliseError: normaliseError };
})();
var normaliseError = ErrorsModule.normaliseError;

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════
var ContextModule = (function() {
  var DEFAULTS = Config.DEFAULTS;
  function trimHistory(msgs, turns) { if (!turns || turns <= 0) return msgs.slice(); return msgs.slice(-turns); }
  function buildMessagesForRequest(o) {
    var sys = (o.settings.system_prompt || "").trim();
    var out = [];
    if (sys) out.push({ role: "system", content: sys });
    var usable = (o.messages || []).filter(function(m){ return (m.role === "user" || m.role === "assistant") && m.status !== "error" && (m.content || "").trim().length > 0; });
    var trimmed = trimHistory(usable, o.settings.history_turns != null ? o.settings.history_turns : DEFAULTS.history_turns);
    for (var i = 0; i < trimmed.length; i++) out.push({ role: trimmed[i].role, content: trimmed[i].content });
    if (o.draftText != null && String(o.draftText).trim()) out.push({ role: "user", content: String(o.draftText) });
    return out;
  }
  function computeContextReport(o) {
    var sys = (o.settings.system_prompt || "").trim();
    var usable = (o.messages || []).filter(function(m){ return (m.role === "user" || m.role === "assistant") && m.status !== "error" && (m.content || "").trim(); });
    var trimmed = trimHistory(usable, o.settings.history_turns != null ? o.settings.history_turns : DEFAULTS.history_turns);
    var rows = [];
    var total = 0;
    if (sys) { var t = Utils.estimateTokens(sys); total += t; rows.push({ role: "system", label: "دستور سیستم", tokens: t, chars: sys.length }); }
    for (var i = 0; i < trimmed.length; i++) { var m = trimmed[i]; var tt = Utils.estimateTokens(m.content || ""); total += tt; rows.push({ role: m.role, label: m.role === "user" ? "کاربر" : "دستیار", tokens: tt, chars: (m.content || "").length, seq: m.seq }); }
    var limit = o.modelCtx || 0;
    var reserved = Number(o.settings.max_tokens || DEFAULTS.max_tokens) || 0;
    var usableLimit = limit ? Math.max(0, limit - reserved) : 0;
    var percent = limit ? Math.min(1, total / limit) : 0;
    return { model: o.model, modelCtx: limit, reserved: reserved, usableLimit: usableLimit, total: total, percent: percent, rows: rows, dropped: (o.messages || []).length - trimmed.length, count: rows.length };
  }
  function ctxLevel(p) { if (p >= 0.95) return "danger"; if (p >= 0.8) return "warn"; return "ok"; }
  function ctxLabel(p) { if (p >= 0.95) return "اشباع"; if (p >= 0.8) return "سنگین"; if (p >= 0.6) return "متوسط"; return "سالم"; }
  return { buildMessagesForRequest: buildMessagesForRequest, computeContextReport: computeContextReport, ctxLevel: ctxLevel, ctxLabel: ctxLabel };
})();
var buildMessagesForRequest = ContextModule.buildMessagesForRequest;
var computeContextReport = ContextModule.computeContextReport;

// ═══════════════════════════════════════════════════════════════════════════
// MARKDOWN
// ═══════════════════════════════════════════════════════════════════════════
var MarkdownModule = (function() {
  var escapeHtml = Utils.escapeHtml;
  function extractFences(src) {
    var fences = [];
    var re = /^```([a-zA-Z0-9_+\-#.]*)[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/gm;
    var out = src.replace(re, function(_full, lang, body) { var id = "\u0000FENCE" + fences.length + "\u0000"; fences.push({ lang: (lang || "").trim(), body: body }); return id; });
    var reOpen = /^```([a-zA-Z0-9_+\-#.]*)[ \t]*\r?\n([\s\S]*)$/m;
    out = out.replace(reOpen, function(_full, lang, body) { var id = "\u0000FENCE" + fences.length + "\u0000"; fences.push({ lang: (lang || "").trim(), body: body, open: true }); return id; });
    return { out: out, fences: fences };
  }
  function restoreFences(html, fences) {
    return html.replace(/\u0000FENCE(\d+)\u0000/g, function(_m, i) { var f = fences[Number(i)]; if (!f) return ""; var lang = escapeHtml(f.lang || ""); var body = escapeHtml(f.body); var label = f.lang || "text"; return '<div class="codeblock" data-lang="' + lang + '"><div class="codeblock__head"><span class="codeblock__lang">' + escapeHtml(label) + '</span><span class="codeblock__spacer"></span><button type="button" class="codeblock__btn" data-act="copy-code">کپی</button></div><pre class="codeblock__pre"><code data-raw="' + body.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '">' + body + '</code></pre></div>'; });
  }
  function inlineHtml(src) {
    var s = escapeHtml(src);
    var codes = [];
    s = s.replace(/`([^`\n]+)`/g, function(_m, code) { var id = "\u0001ICODE" + codes.length + "\u0001"; codes.push(code); return id; });
    s = s.replace(/\*\*\*([^*\n]+)\*\*\*/g, "<strong><em>$1</em></strong>");
    s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^\*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
    s = s.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");
    s = s.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
    s = s.replace(/(^|[\s(])((?:https?:\/\/|www\.)[^\s<>"']+)/g, function(_m, pre, url) { var href = url.indexOf("www.") === 0 ? "https://" + url : url; return pre + '<a href="' + href + '" target="_blank" rel="noopener noreferrer nofollow">' + url + '</a>'; });
    s = s.replace(/\u0001ICODE(\d+)\u0001/g, function(_m, i) { return "<code>" + codes[Number(i)] + "</code>"; });
    s = s.replace(/ {2,}\n/g, "<br>\n");
    return s;
  }
  function renderBlocks(src) {
    var lines = src.replace(/\r\n?/g, "\n").split("\n");
    var out = [];
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      if (/^\s*$/.test(line)) { i++; continue; }
      var m = /^(#{1,6})\s+(.*)$/.exec(line);
      if (m) { var lvl = m[1].length; out.push("<h" + lvl + ">" + inlineHtml(m[2].trim()) + "</h" + lvl + ">"); i++; continue; }
      if (/^\s*(?:---|\*\*\*|___)\s*$/.test(line)) { out.push("<hr>"); i++; continue; }
      if (/^\s*>\s?/.test(line)) { var buf = []; while (i < lines.length && /^\s*>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, "")); i++; } out.push("<blockquote>" + renderBlocks(buf.join("\n")) + "</blockquote>"); continue; }
      if (/^\s*[-*+]\s+/.test(line)) { var items = []; while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*+]\s+/, "")); i++; } out.push("<ul>" + items.map(function(x){ return "<li>" + inlineHtml(x) + "</li>"; }).join("") + "</ul>"); continue; }
      if (/^\s*\d+[.)]\s+/.test(line)) { var items2 = []; while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items2.push(lines[i].replace(/^\s*\d+[.)]\s+/, "")); i++; } out.push("<ol>" + items2.map(function(x){ return "<li>" + inlineHtml(x) + "</li>"; }).join("") + "</ol>"); continue; }
      var pb = [line]; i++;
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,6})\s+/.test(lines[i]) && !/^\s*>\s?/.test(lines[i]) && !/^\s*[-*+]\s+/.test(lines[i]) && !/^\s*\d+[.)]\s+/.test(lines[i]) && !/^\s*(?:---|\*\*\*|___)\s*$/.test(lines[i])) { pb.push(lines[i]); i++; }
      out.push("<p>" + inlineHtml(pb.join("\n")) + "</p>");
    }
    return out.join("\n");
  }
  function renderMarkdown(src) {
    if (!src) return "";
    if (src.length > 80000) return "<pre style='white-space:pre-wrap;word-break:break-word;'>" + escapeHtml(src) + "</pre>";
    var ex = extractFences(String(src));
    var html = renderBlocks(ex.out);
    return restoreFences(html, ex.fences);
  }
  return { renderMarkdown: renderMarkdown };
})();
var renderMarkdown = MarkdownModule.renderMarkdown;

// ═══════════════════════════════════════════════════════════════════════════
// MODAL
// ═══════════════════════════════════════════════════════════════════════════
var ModalModule = (function() {
  var root = function() { return document.getElementById("modalRoot"); };
  var stack = [];
  function openModal(opts) {
    opts = opts || {};
    var title = opts.title || "", subtitle = opts.subtitle || "", body = opts.body || "", footer = opts.footer || "", className = opts.className || "", width = opts.width || "", closable = opts.closable !== false, onClose = opts.onClose, onMount = opts.onMount, hideHead = opts.hideHead;
    var id = Utils.uuid();
    var wrapper = document.createElement("div");
    var backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    if (closable) backdrop.addEventListener("click", function(){ closeModal(id); });
    var modal = document.createElement("div");
    modal.className = "modal " + className;
    if (width) modal.style.width = width;
    modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true");
    var headHtml = hideHead ? "" : '<div class="modal__head"><div class="modal__title"><div>' + Utils.escapeHtml(title) + '</div>' + (subtitle ? '<div class="modal__sub">' + Utils.escapeHtml(subtitle) + '</div>' : '') + '</div>' + (closable ? '<button type="button" class="icon-btn icon-btn--tiny" data-close><svg width="14" height="14" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>' : '') + '</div>';
    modal.innerHTML = headHtml + '<div class="modal__body"></div>' + (footer ? '<div class="modal__foot"></div>' : '');
    var bodyEl = modal.querySelector(".modal__body");
    if (typeof body === "string") bodyEl.innerHTML = body; else if (body instanceof Node) bodyEl.appendChild(body);
    if (footer) { var footEl = modal.querySelector(".modal__foot"); if (typeof footer === "string") footEl.innerHTML = footer; else if (footer instanceof Node) footEl.appendChild(footer); }
    if (closable) { var closeBtn = modal.querySelector("[data-close]"); if (closeBtn) closeBtn.addEventListener("click", function(){ closeModal(id); }); }
    wrapper.appendChild(backdrop); wrapper.appendChild(modal); root().appendChild(wrapper);
    var entry = { id: id, wrapper: wrapper, modal: modal, onClose: onClose };
    stack.push(entry);
    if (onMount) onMount(modal, id);
    var onKey = function(e) { if (e.key === "Escape" && closable && stack[stack.length - 1] && stack[stack.length - 1].id === id) { e.preventDefault(); closeModal(id); } };
    window.addEventListener("keydown", onKey);
    entry.cleanup = function() { window.removeEventListener("keydown", onKey); };
    return { id: id, modal: modal, wrapper: wrapper, close: function(){ closeModal(id); } };
  }
  function closeModal(id) {
    var idx = -1; for (var i = 0; i < stack.length; i++) if (stack[i].id === id) { idx = i; break; }
    if (idx === -1) return;
    var entry = stack.splice(idx, 1)[0];
    if (entry.cleanup) entry.cleanup();
    entry.wrapper.remove();
    try { if (entry.onClose) entry.onClose(); } catch(e){ console.error(e); }
  }
  function confirmDialog(o) {
    o = o || {};
    return new Promise(function(resolve) {
      var footer = document.createElement("div");
      footer.style.cssText = "display:flex;gap:8px;width:100%";
      var okBtn = document.createElement("button"); okBtn.type = "button"; okBtn.className = "btn " + (o.danger ? "btn--danger" : "btn--primary"); okBtn.textContent = o.okLabel || "تأیید";
      var cancelBtn = document.createElement("button"); cancelBtn.type = "button"; cancelBtn.className = "btn btn--ghost"; cancelBtn.textContent = o.cancelLabel || "انصراف";
      footer.appendChild(cancelBtn); footer.appendChild(okBtn);
      var m = openModal({ title: o.title || "تأیید", className: "modal--narrow", body: '<div class="confirm-msg">' + (o.message || "آیا مطمئن هستید؟") + '</div>', footer: footer, onClose: function(){ resolve(false); } });
      cancelBtn.addEventListener("click", function(){ resolve(false); m.close(); });
      okBtn.addEventListener("click", function(){ resolve(true); m.close(); });
    });
  }
  function promptDialog(o) {
    o = o || {};
    return new Promise(function(resolve) {
      var body = document.createElement("div");
      body.className = "stack";
      body.innerHTML = '<div class="field"><label class="field__label">' + Utils.escapeHtml(o.label || "مقدار") + '</label>' + (o.multiline ? '<textarea class="textarea" placeholder="' + Utils.escapeHtml(o.placeholder || "") + '"></textarea>' : '<input class="input" placeholder="' + Utils.escapeHtml(o.placeholder || "") + '" />') + '</div>';
      var input = body.querySelector("input, textarea");
      input.value = o.defaultValue || "";
      var footer = document.createElement("div");
      footer.style.cssText = "display:flex;gap:8px";
      var okBtn = document.createElement("button"); okBtn.type = "button"; okBtn.className = "btn btn--primary"; okBtn.textContent = o.okLabel || "ثبت";
      var cancelBtn = document.createElement("button"); cancelBtn.type = "button"; cancelBtn.className = "btn btn--ghost"; cancelBtn.textContent = o.cancelLabel || "انصراف";
      footer.appendChild(cancelBtn); footer.appendChild(okBtn);
      var m = openModal({ title: o.title || "ورودی", body: body, footer: footer, className: "modal--narrow", onMount: function(){ setTimeout(function(){ input.focus(); }, 40); }, onClose: function(){ resolve(null); } });
      var done = function() { resolve(input.value); m.close(); };
      okBtn.addEventListener("click", done);
      cancelBtn.addEventListener("click", function(){ resolve(null); m.close(); });
      input.addEventListener("keydown", function(e) { if (e.key === "Enter" && (!o.multiline || e.ctrlKey)) { e.preventDefault(); done(); } });
    });
  }
  return { openModal: openModal, closeModal: closeModal, confirmDialog: confirmDialog, promptDialog: promptDialog };
})();
var openModal = ModalModule.openModal;
var closeModal = ModalModule.closeModal;
var confirmDialog = ModalModule.confirmDialog;
var promptDialog = ModalModule.promptDialog;

// ═══════════════════════════════════════════════════════════════════════════
// PAYLOAD VIEWER
// ═══════════════════════════════════════════════════════════════════════════
var PayloadModule = (function() {
  function lineNumbered(text) {
    var lines = String(text == null ? "" : text).split("\n"); var frag = document.createDocumentFragment();
    lines.forEach(function(ln, i) { var row = document.createElement("span"); row.className = "l"; row.dataset.n = String(i + 1); row.textContent = ln.length ? ln : " "; frag.appendChild(row); if (i < lines.length - 1) frag.appendChild(document.createTextNode("\n")); });
    return frag;
  }
  function preText(text, o) {
    o = o || {};
    var pre = document.createElement("pre"); pre.className = "payload__pre";
    if (o.wrap) pre.classList.add("payload__pre--wrap");
    if (o.numbered) { pre.classList.add("payload__pre--numbered"); pre.appendChild(lineNumbered(text)); } else { pre.textContent = String(text == null ? "" : text); }
    return pre;
  }
  function toolbar(o) {
    var bar = document.createElement("div"); bar.className = "payload__toolbar";
    var size = document.createElement("span"); size.textContent = "طول: " + Utils.fa(String(o.text).length) + " کاراکتر · " + Utils.fmtBytes(Utils.byteLength(o.text)); bar.appendChild(size);
    var grow = document.createElement("span"); grow.className = "grow"; bar.appendChild(grow);
    var copyBtn = document.createElement("button"); copyBtn.type = "button"; copyBtn.className = "copy-btn"; copyBtn.textContent = "کپی دقیق";
    copyBtn.addEventListener("click", async function() { var ok = await Utils.copyText(String(o.text)); copyBtn.classList.toggle("is-done", ok); if (ok) Toast.toast.ok("عیناً کپی شد"); else Toast.toast.err("کپی ناموفق بود"); setTimeout(function(){ copyBtn.classList.remove("is-done"); }, 1200); });
    bar.appendChild(copyBtn);
    return bar;
  }
  function openPayloadModal(o) {
    o = o || {};
    var msg = o.message || null;
    var bodyString = o.body != null ? o.body : (msg && msg.request_body != null ? msg.request_body : "");
    var payloadObj = o.payload != null ? o.payload : (msg && msg.request_payload != null ? msg.request_payload : null);
    var headers = o.headers != null ? o.headers : (msg && msg.request_headers != null ? msg.request_headers : {});
    var rawResponse = o.rawResponse != null ? o.rawResponse : (msg && msg.response_raw != null ? msg.response_raw : "");
    var error = o.error != null ? o.error : (msg && msg.error != null ? msg.error : null);
    var holder = document.createElement("div"); holder.style.cssText = "display:flex;flex-direction:column;min-height:0;flex:1 1 auto;";
    var tabsBar = document.createElement("div"); tabsBar.className = "payload__tabs";
    var bodyPane = document.createElement("div"); bodyPane.className = "payload__body";
    var wrapState = false;
    var tabs = [
      { id: "body", label: "بدنهٔ دقیق درخواست", badge: o.preview ? "پیش‌نمایش" : "ارسال‌شده", render: function() { bodyPane.innerHTML = ""; var text = bodyString || "(خالی)"; bodyPane.appendChild(toolbar({ text: text })); bodyPane.appendChild(preText(text, { wrap: wrapState, numbered: !wrapState })); } },
      { id: "http", label: "درخواست HTTP", render: function() { bodyPane.innerHTML = ""; var httpText = "POST " + Config.OPENROUTER_CHAT + " HTTP/1.1\n" + Object.keys(headers || {}).map(function(k){ return k + ": " + headers[k]; }).join("\n") + "\n\n" + (bodyString || ""); bodyPane.appendChild(toolbar({ text: httpText })); bodyPane.appendChild(preText(httpText, { wrap: true })); } },
      { id: "messages", label: "پیام‌های ساختاریافته", render: function() { bodyPane.innerHTML = ""; var list = (payloadObj && payloadObj.messages) || []; var pretty = JSON.stringify(list, null, 2); bodyPane.appendChild(toolbar({ text: pretty })); bodyPane.appendChild(preText(pretty, { wrap: false })); } },
      { id: "response", label: "پاسخ خام", badge: rawResponse ? "موجود" : "—", render: function() { bodyPane.innerHTML = ""; var text = rawResponse || "(پاسخی ذخیره نشده است)"; bodyPane.appendChild(toolbar({ text: text })); bodyPane.appendChild(preText(text, { wrap: true })); } },
      { id: "error", label: "خطا", badge: error ? "خطا" : "—", render: function() { bodyPane.innerHTML = ""; if (!error) { var p = document.createElement("div"); p.className = "empty-note"; p.textContent = "برای این درخواست خطایی ثبت نشده است."; bodyPane.appendChild(p); return; } var text = JSON.stringify(error, null, 2); bodyPane.appendChild(toolbar({ text: text })); bodyPane.appendChild(preText(text, { wrap: false })); } }
    ];
    var active = "body";
    function renderActive(id) {
      active = id;
      for (var i = 0; i < tabsBar.children.length; i++) tabsBar.children[i].classList.toggle("is-active", tabsBar.children[i].dataset.tab === id);
      for (var j = 0; j < tabs.length; j++) if (tabs[j].id === id) { tabs[j].render(); break; }
    }
    for (var i = 0; i < tabs.length; i++) {
      (function(t) {
        var b = document.createElement("button"); b.type = "button"; b.className = "payload__tab"; b.dataset.tab = t.id;
        b.innerHTML = Utils.escapeHtml(t.label) + (t.badge ? ' <span class="badge">' + Utils.escapeHtml(t.badge) + '</span>' : "");
        b.addEventListener("click", function(){ renderActive(t.id); });
        tabsBar.appendChild(b);
      })(tabs[i]);
    }
    holder.appendChild(tabsBar); holder.appendChild(bodyPane);
    var sub = o.preview ? "این همان متنی است که با ارسال، عیناً به OpenRouter فرستاده می‌شود." : "این همان متنی است که عیناً به OpenRouter فرستاده شد.";
    var m = openModal({ title: "Payload دقیق", subtitle: sub, className: "modal--full payload", body: holder, footer: "" });
    m.modal.querySelector(".modal__body").style.padding = "0";
    m.modal.querySelector(".modal__body").style.display = "flex";
    m.modal.querySelector(".modal__body").style.flexDirection = "column";
    m.modal.querySelector(".modal__body").style.minHeight = "0";
    renderActive("body");
    return m;
  }
  return { openPayloadModal: openPayloadModal };
})();
var openPayloadModal = PayloadModule.openPayloadModal;

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE (renderer)
// ═══════════════════════════════════════════════════════════════════════════
var MessageModule = (function() {
  var ICONS = {
    copy: '<svg width="12" height="12" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    edit: '<svg width="12" height="12" viewBox="0 0 24 24"><path d="M4 20h4L20 8l-4-4L4 16v4Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    regen: '<svg width="12" height="12" viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    del: '<svg width="12" height="12" viewBox="0 0 24 24"><path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    payload: '<svg width="12" height="12" viewBox="0 0 24 24"><path d="m9 7-5 5 5 5M15 7l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chev: '<svg width="12" height="12" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    alert: '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M12 3.5 21 20H3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v4M12 16.5v.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    user: '<svg width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4.6 20c.9-3.6 3.9-5.6 7.4-5.6s6.5 2 7.4 5.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    bot: '<svg width="14" height="14" viewBox="0 0 24 24"><rect x="4" y="6.5" width="16" height="12" rx="3.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9.5" cy="12.5" r="1.3" fill="currentColor"/><circle cx="14.5" cy="12.5" r="1.3" fill="currentColor"/><path d="M12 3v3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    sys: '<svg width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.8v2M12 19.2v2M21.2 12h-2M4.8 12h-2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };
  function nl2br(s) { return Utils.escapeHtml(s).replace(/\n/g, "<br>"); }
  function tokensOf(m) { var u = m.usage || {}; return u.total_tokens || u.completion_tokens || u.prompt_tokens || 0; }
  function renderErrorBlock(err) {
    var e = err || {};
    var detailJson = e.detail ? JSON.stringify(e.detail, null, 2) : "";
    var raw = e.rawText || "";
    var parts = [];
    parts.push('<div class="err"><div class="err__head">' + ICONS.alert + '<span>خطای ارائه‌دهنده</span>' + (e.httpStatus ? '<span class="err__code">' + Utils.escapeHtml(String(e.httpStatus)) + '</span>' : '') + '</div><div class="err__body">');
    parts.push('<div style="font-weight:600;margin-bottom:4px;">' + Utils.escapeHtml(e.message || "خطای نامشخص") + '</div>');
    if (e.provider) parts.push('<div style="font-size:11px;color:var(--text-3)">ارائه‌دهنده: <span class="mono">' + Utils.escapeHtml(e.provider) + '</span></div>');
    if (detailJson) parts.push('<details class="err__detail" open><summary>' + ICONS.chev + ' پاسخ کامل خطا (دست‌نخورده)</summary><pre class="err__pre">' + Utils.escapeHtml(detailJson) + '</pre></details>');
    if (raw && raw !== detailJson) parts.push('<details class="err__detail"><summary>' + ICONS.chev + ' متن خام پاسخ</summary><pre class="err__pre">' + Utils.escapeHtml(raw) + '</pre></details>');
    parts.push('</div></div>');
    return parts.join("");
  }
  function avatarFor(role, isError) { if (isError) return { cls: "msg__avatar--error", ico: ICONS.alert }; if (role === "user") return { cls: "msg__avatar--user", ico: ICONS.user }; if (role === "system") return { cls: "msg__avatar--system", ico: ICONS.sys }; return { cls: "msg__avatar--assistant", ico: ICONS.bot }; }
  function renderMessage(msg) {
    var isError = msg.status === "error"; var role = msg.role || "assistant"; var av = avatarFor(role, isError && role === "assistant");
    var row = document.createElement("article");
    row.className = "msg msg--" + role + (isError ? " msg--error" : "") + (msg.status === "streaming" ? " is-streaming" : "");
    row.dataset.id = msg.id; row.dataset.role = role;
    var rail = document.createElement("div"); rail.className = "msg__rail"; rail.innerHTML = '<div class="msg__avatar ' + av.cls + '">' + av.ico + '</div>';
    var main = document.createElement("div"); main.className = "msg__main";
    var badges = [];
    if (msg.edited) badges.push('<span class="badge">ویرایش‌شده</span>');
    if (msg.resolved_model && msg.resolved_model !== msg.requested_model) badges.push('<span class="badge badge--accent" title="مدل واقعی">' + Utils.escapeHtml(msg.resolved_model) + '</span>');
    if (msg.provider) badges.push('<span class="badge badge--info">' + Utils.escapeHtml(msg.provider) + '</span>');
    var head = document.createElement("div"); head.className = "msg__head";
    head.innerHTML = '<span class="msg__name">' + Utils.escapeHtml(Config.ROLES[role] || role) + '</span><span class="msg__badges">' + badges.join("") + '</span><span class="msg__time">' + Utils.formatTime(msg.created_at || Date.now()) + '</span>';
    var body = document.createElement("div"); body.className = "msg__body";
    if (msg.reasoning) {
      var r = document.createElement("div"); r.className = "reasoning";
      r.innerHTML = '<div class="reasoning__head">' + ICONS.chev + '<span class="reasoning__label">استدلال مدل</span><span class="reasoning__time">' + Utils.faInt(msg.reasoning.length) + ' کاراکتر</span></div><div class="reasoning__body"></div>';
      r.querySelector(".reasoning__body").textContent = msg.reasoning;
      r.querySelector(".reasoning__head").addEventListener("click", function(){ r.classList.toggle("is-open"); });
      body.appendChild(r);
    }
    var md = document.createElement("div"); md.className = "md";
    if (isError) md.innerHTML = renderErrorBlock(msg.error);
    else if (!msg.content && msg.status === "streaming") md.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>';
    else if (role === "user") md.innerHTML = nl2br(msg.content || "");
    else md.innerHTML = renderMarkdown(msg.content || "");
    body.appendChild(md);
    if (msg.status === "streaming" && msg.content) { var st = document.createElement("div"); st.className = "msg__status"; st.innerHTML = '<span class="spinner"></span><span>در حال دریافت از مدل…</span>'; body.appendChild(st); }
    if (msg.status === "complete" && msg.usage) {
      var u = document.createElement("div"); u.className = "usage-row"; var bits = [];
      if (msg.usage.prompt_tokens != null) bits.push('<span>ورودی <b>' + Utils.fmtTokens(msg.usage.prompt_tokens) + '</b></span>');
      if (msg.usage.completion_tokens != null) bits.push('<span>خروجی <b>' + Utils.fmtTokens(msg.usage.completion_tokens) + '</b></span>');
      var t = tokensOf(msg); if (t) bits.push('<span>جمع <b>' + Utils.fmtTokens(t) + '</b></span>');
      u.innerHTML = bits.join(""); body.appendChild(u);
    }
    var actions = document.createElement("div"); actions.className = "msg__actions";
    var mkAction = function(act, label, ico, cls) { var b = document.createElement("button"); b.type = "button"; b.className = "msg__action " + (cls || ""); b.dataset.action = act; b.dataset.id = msg.id; b.innerHTML = ico + '<span>' + label + '</span>'; return b; };
    if (!isError || msg.content) actions.appendChild(mkAction("copy", "کپی", ICONS.copy));
    if (role === "user") actions.appendChild(mkAction("edit", "ویرایش", ICONS.edit));
    if (role === "assistant") actions.appendChild(mkAction("regen", "بازتولید", ICONS.regen));
    if (role === "assistant" && (msg.request_body || msg.status === "error")) actions.appendChild(mkAction("payload", "Payload", ICONS.payload));
    actions.appendChild(mkAction("delete", "حذف", ICONS.del, "msg__action--danger"));
    main.appendChild(head); main.appendChild(body); main.appendChild(actions);
    row.appendChild(rail); row.appendChild(main);
    return row;
  }
  return { renderMessage: renderMessage };
})();
var renderMessage = MessageModule.renderMessage;

// ═══════════════════════════════════════════════════════════════════════════
// RENDER (thread)
// ═══════════════════════════════════════════════════════════════════════════
var RenderModule = (function() {
  var els = {};
  var rows = {};
  function initRender() {
    els.thread = document.getElementById("thread");
    els.empty = document.getElementById("threadEmpty");
    els.scrollDown = document.getElementById("scrollDownBtn");
    if (els.scrollDown) els.scrollDown.addEventListener("click", function() { if (els.thread) els.thread.scrollTo({ top: els.thread.scrollHeight, behavior: "smooth" }); });
    if (els.thread) els.thread.addEventListener("scroll", function() { var near = Utils.isNearBottom(els.thread, 160); if (els.scrollDown) els.scrollDown.hidden = near; });
  }
  function renderThread(messages) {
    var thread = els.thread; if (!thread) return;
    rows = {}; thread.innerHTML = "";
    if (!messages || !messages.length) { if (els.empty) els.empty.removeAttribute("hidden"); if (els.scrollDown) els.scrollDown.hidden = true; return; }
    if (els.empty) els.empty.setAttribute("hidden", "");
    var frag = document.createDocumentFragment();
    for (var i = 0; i < messages.length; i++) { var row = renderMessage(messages[i]); rows[messages[i].id] = row; frag.appendChild(row); }
    thread.appendChild(frag);
    thread.scrollTo({ top: thread.scrollHeight, behavior: "auto" });
    if (els.scrollDown) els.scrollDown.hidden = true;
  }
  function patchStreamingMessage(msg) {
    var thread = els.thread; if (!thread) return;
    var row = rows[msg.id];
    var atBottom = Utils.isNearBottom(thread, 140);
    if (row) { var fresh = renderMessage(msg); row.replaceWith(fresh); rows[msg.id] = fresh; }
    else { var fresh2 = renderMessage(msg); rows[msg.id] = fresh2; thread.appendChild(fresh2); }
    if (atBottom) Utils.autoScroll(thread, { threshold: 400 });
    if (els.scrollDown) els.scrollDown.hidden = Utils.isNearBottom(thread, 160);
  }
  function scrollThreadToMessage(id) {
    var row = rows[id]; if (!row) return;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    row.classList.add("is-highlighted");
    setTimeout(function(){ row.classList.remove("is-highlighted"); }, 1500);
  }
  function showEmpty(onPick) {
    if (els.empty) els.empty.removeAttribute("hidden");
    var cards = document.getElementById("emptyCards"); if (!cards || cards.childElementCount) return;
    var suggestions = [
      { t: "توضیح ساده", s: "یک مفهوم پیچیده را ساده توضیح بده", p: "یادگیری ماشین را در سه سطح ساده، متوسط و پیشرفته توضیح بده." },
      { t: "کدنویسی", s: "یک تابع پایتون بنویس", p: "یک تابع پایتون بنویس که لیست اعداد را گرفته و میانه و انحراف معیار را برگرداند." },
      { t: "مقایسه", s: "دو رویکرد را مقایسه کن", p: "REST و GraphQL را با جدول مقایسه کن و برای یک اپ موبایل پیشنهاد بده." },
      { t: "نوشتن", s: "یک متن حرفه‌ای بنویس", p: "یک ایمیل حرفه‌ای برای درخواست تمدید ددلاین پروژه بنویس." }
    ];
    for (var i = 0; i < suggestions.length; i++) {
      (function(s) {
        var b = document.createElement("button"); b.type = "button"; b.className = "empty-card"; b.innerHTML = "<b>" + s.t + "</b><span>" + s.s + "</span>";
        b.addEventListener("click", function(){ if (onPick) onPick(s.p); });
        cards.appendChild(b);
      })(suggestions[i]);
    }
  }
  function hideEmpty() { if (els.empty) els.empty.setAttribute("hidden", ""); }
  return { initRender: initRender, renderThread: renderThread, patchStreamingMessage: patchStreamingMessage, scrollThreadToMessage: scrollThreadToMessage, showEmpty: showEmpty, hideEmpty: hideEmpty };
})();
var initRender = RenderModule.initRender;
var renderThread = RenderModule.renderThread;
var patchStreamingMessage = RenderModule.patchStreamingMessage;
var scrollThreadToMessage = RenderModule.scrollThreadToMessage;
var showEmpty = RenderModule.showEmpty;
var hideEmpty = RenderModule.hideEmpty;

// ═══════════════════════════════════════════════════════════════════════════
// SESSION (chat lifecycle + streaming)
// ═══════════════════════════════════════════════════════════════════════════
var SessionModule = (function() {
  var abortController = null;
  var streamingId = null;
  var lastEmitAt = 0;
  function isStreaming() { return !!streamingId; }
  function nextSeq(msgs) { var max = 0; for (var i = 0; i < msgs.length; i++) if ((msgs[i].seq || 0) > max) max = msgs[i].seq || 0; return max + 1; }
  async function ensureActiveConversation(seed) {
    seed = seed || {};
    var s = Store.get();
    if (s.activeConvId) { var existing = s.conversations.find(function(c){ return c.id === s.activeConvId; }); if (existing) return existing; }
    var conv = await api.getOrCreateConversation(Object.assign({ model: s.model }, seed));
    var list = [conv].concat(Store.get().conversations.filter(function(c){ return c.id !== conv.id; }));
    Store.set({ conversations: list, activeConvId: conv.id }, "convs:change");
    Store.setActiveConv(conv.id);
    return conv;
  }
  async function loadMessagesFor(convId) {
    Store.set({ msgsLoading: true });
    var msgs = await api.listMessages(convId);
    msgs.sort(function(a, b){ return (a.seq || 0) - (b.seq || 0); });
    Store.set({ messages: msgs, msgsLoading: false }, "thread:reload");
    return msgs;
  }
  async function clearActiveConversation() {
    Store.set({ activeConvId: null, messages: [], editingMessageId: null }, "thread:reload");
    Store.setActiveConv(null); Store.setEditing(null);
  }
  function setEditing(id) { Store.setEditing(id); }
  function cancelStream() { if (abortController) { try { abortController.abort(); } catch(e){} } }
  function buildPreviewPayload(draftText) {
    var s = Store.get();
    var settings = s.settings || getSettings();
    var messages = buildMessagesForRequest({ settings: settings, messages: s.messages, draftText: draftText || null });
    var payload = buildPayload({ model: s.model, messages: messages, temperature: settings.temperature, top_p: settings.top_p, max_tokens: settings.max_tokens, frequency_penalty: settings.frequency_penalty, presence_penalty: settings.presence_penalty, stream: settings.stream, include_reasoning: settings.include_reasoning });
    return { payload: payload, body: serialiseBody(payload), messages: messages };
  }
  async function sendMessage(text) {
    var content = String(text || "").trim();
    if (!content) return;
    if (isStreaming()) { Toast.toast.warn("یک پاسخ در حال تولید است."); return; }
    var s0 = Store.get();
    var settings = s0.settings || getSettings();
    var conv = await ensureActiveConversation();
    var messages = Utils.clone(Store.get().messages || []);
    var editingId = Store.get().editingMessageId;
    if (editingId) {
      var idx = -1;
      for (var i = 0; i < messages.length; i++) if (messages[i].id === editingId) { idx = i; break; }
      if (idx === -1) { Store.setEditing(null); return sendMessage(content); }
      var target = messages[idx];
      var edited = Object.assign({}, target, { content: content, edited: true, edit_history: (target.edit_history || []).concat([{ at: new Date().toISOString(), content: target.content }]) });
      messages = messages.slice(0, idx + 1);
      messages[idx] = edited;
      await api.updateMessage(edited.id, conv.id, { content: content, edited: true, edit_history: edited.edit_history });
      await api.truncateMessagesAfter(conv.id, edited.seq);
      Store.setEditing(null);
    } else {
      var seq = nextSeq(messages);
      var userMsg = { id: Utils.uuid(), conversation_id: conv.id, seq: seq, role: "user", content: content, status: "complete", created_at: new Date().toISOString() };
      var saved = await api.insertMessage(conv.id, userMsg);
      messages.push(saved || userMsg);
    }
    Store.set({ messages: messages.slice() }, "thread:reload");
    if ((!conv.title || conv.title === "گفتگوی تازه") && conv.id) {
      var title = content.slice(0, 46) + (content.length > 46 ? "…" : "");
      var updated = await api.updateConversation(conv.id, { title: title });
      var list = Store.get().conversations.map(function(c){ return c.id === conv.id ? Object.assign({}, c, updated || {}, { title: title }) : c; });
      Store.set({ conversations: list }, "convs:change");
    }
    return runCompletion(conv, messages, settings);
  }
  async function regenerateFrom(assistantMessageId) {
    if (isStreaming()) { Toast.toast.warn("یک پاسخ در حال تولید است."); return; }
    var s = Store.get();
    var conv = s.conversations.find(function(c){ return c.id === s.activeConvId; }) || (await ensureActiveConversation());
    var messages = Utils.clone(s.messages || []);
    var idx = -1;
    for (var i = 0; i < messages.length; i++) if (messages[i].id === assistantMessageId) { idx = i; break; }
    if (idx === -1) return;
    var cutSeq = messages[idx].seq;
    var kept = messages.filter(function(m){ return (m.seq || 0) < cutSeq; });
    await api.truncateMessagesAfter(conv.id, cutSeq - 1);
    Store.set({ messages: kept }, "thread:reload");
    return runCompletion(conv, kept, s.settings || getSettings());
  }
  async function deleteMessageById(id) {
    var s = Store.get();
    var conv = s.conversations.find(function(c){ return c.id === s.activeConvId; });
    if (!conv) return;
    await api.deleteMessage(id, conv.id);
    var messages = (s.messages || []).filter(function(m){ return m.id !== id; });
    Store.set({ messages: messages }, "thread:reload");
  }
  async function runCompletion(conv, messages, settings) {
    var s = Store.get();
    var model = s.model;
    var mCtx = modelContextLength(model);
    var requestMessages = buildMessagesForRequest({ settings: settings, messages: messages });
    var payload = buildPayload({ model: model, messages: requestMessages, temperature: settings.temperature, top_p: settings.top_p, max_tokens: settings.max_tokens, frequency_penalty: settings.frequency_penalty, presence_penalty: settings.presence_penalty, stream: settings.stream, include_reasoning: settings.include_reasoning });
    var bodyString = serialiseBody(payload);
    var requestId = Utils.uuid();
    var headers = buildHeaders({ requestId: requestId, apiKey: getApiKey() });
    var assistantId = Utils.uuid();
    var assistant = { id: assistantId, conversation_id: conv.id, seq: nextSeq(messages), role: "assistant", content: "", reasoning: "", status: "streaming", requested_model: model, resolved_model: null, provider: null, usage: null, error: null, request_payload: payload, request_body: bodyString, request_headers: headers, response_raw: "", created_at: new Date().toISOString() };
    var withAssistant = messages.concat([assistant]);
    Store.set({ messages: withAssistant, streaming: true }, "thread:reload");
    Store.setStreaming(true);
    streamingId = assistantId;
    abortController = new AbortController();
    var working = assistant;
    var flush = function(force) {
      var now = Date.now();
      if (!force && now - lastEmitAt < 55) return;
      lastEmitAt = now;
      var list = Store.get().messages.map(function(m){ return m.id === working.id ? Object.assign({}, working) : m; });
      Store.set({ messages: list });
      Utils.emitter.emit("message:patch", Object.assign({}, working));
    };
    var rawAcc = "";
    try {
      var result = await streamChat({
        payload: payload, headers: headers, signal: abortController.signal,
        onMeta: function(meta) { if (meta.resolvedModel) working.resolved_model = meta.resolvedModel; if (meta.provider) working.provider = meta.provider; flush(true); },
        onDelta: function(delta) { if (delta.content) working.content += delta.content; if (delta.reasoning) working.reasoning += delta.reasoning; flush(); },
        onUsage: function(usage) { working.usage = usage; flush(true); },
        onError: function() {}
      });
      rawAcc = result && result.raw || "";
      working.content = result.fullText || working.content;
      working.reasoning = result.reasoning || working.reasoning;
      working.resolved_model = result.resolvedModel || working.resolved_model;
      working.provider = result.provider || working.provider;
      working.usage = result.usage || working.usage;
      working.response_raw = rawAcc;
      working.status = "complete";
      flush(true);
      var saved2 = await api.insertMessage(conv.id, working);
      var list2 = Store.get().messages.map(function(m){ return m.id === working.id ? Object.assign({}, working, saved2 || {}) : m; });
      Store.set({ messages: list2 });
      var patch = { message_count: list2.filter(function(m){ return m.role !== "system"; }).length, last_message_at: new Date().toISOString(), model: model };
      var updated = await api.updateConversation(conv.id, patch);
      var convs = Store.get().conversations.map(function(c){ return c.id === conv.id ? Object.assign({}, c, updated || patch) : c; });
      Store.set({ conversations: convs }, "convs:change");
    } catch (err) {
      var aborted = err && err.name === "AbortError";
      var norm = aborted ? { httpStatus: null, statusText: "aborted", message: "تولید توسط کاربر متوقف شد.", detail: null, rawText: "", headers: {}, provider: null } : normaliseError(err, { requestId: requestId });
      working.status = aborted ? "cancelled" : "error";
      working.error = aborted ? null : norm;
      working.response_raw = rawAcc || (err && err.rawText) || "";
      flush(true);
      var saved3 = await api.insertMessage(conv.id, working).catch(function(){ return null; });
      var list3 = Store.get().messages.map(function(m){ return m.id === working.id ? Object.assign({}, working, saved3 || {}) : m; });
      Store.set({ messages: list3 });
      Utils.emitter.emit("message:patch", Object.assign({}, working));
      if (!aborted) Toast.toast.err(norm.message || "خطا در تماس با OpenRouter", "خطا");
    } finally {
      streamingId = null;
      abortController = null;
      Store.setStreaming(false);
      lastEmitAt = 0;
      var listF = Store.get().messages.map(function(m){ return m.id === working.id ? Object.assign({}, working, { status: working.status === "streaming" ? "cancelled" : working.status }) : m; });
      Store.set({ messages: listF });
      Utils.emitter.emit("thread:reload", listF);
    }
  }
  return { isStreaming: isStreaming, ensureActiveConversation: ensureActiveConversation, loadMessagesFor: loadMessagesFor, clearActiveConversation: clearActiveConversation, setEditing: setEditing, cancelStream: cancelStream, buildPreviewPayload: buildPreviewPayload, sendMessage: sendMessage, regenerateFrom: regenerateFrom, deleteMessageById: deleteMessageById };
})();
var isStreaming = SessionModule.isStreaming;
var ensureActiveConversation = SessionModule.ensureActiveConversation;
var loadMessagesFor = SessionModule.loadMessagesFor;
var clearActiveConversation = SessionModule.clearActiveConversation;
var setEditing = SessionModule.setEditing;
var cancelStream = SessionModule.cancelStream;
var buildPreviewPayload = SessionModule.buildPreviewPayload;
var sendMessage = SessionModule.sendMessage;
var regenerateFrom = SessionModule.regenerateFrom;
var deleteMessageById = SessionModule.deleteMessageById;

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSER
// ═══════════════════════════════════════════════════════════════════════════
var ComposerModule = (function() {
  var els = {};
  function autoResize() {
    var t = els.input; if (!t) return;
    t.style.height = "auto";
    void t.offsetHeight;
    var scrollH = t.scrollHeight;
    var maxH = Math.round(window.innerHeight * 0.46);
    if (scrollH > maxH) { t.style.height = maxH + "px"; t.style.overflowY = "auto"; }
    else { t.style.height = scrollH + "px"; t.style.overflowY = "hidden"; }
  }
  function updateCount() { var v = els.input && els.input.value || ""; if (els.count) els.count.textContent = v ? Utils.faInt(v.length) : ""; }
  function enterEditMode(id) {
    var msg = Store.get().messages.find(function(m){ return m.id === id; }); if (!msg) return;
    Store.setEditing(id);
    els.input.value = msg.content || "";
    if (els.banner) els.banner.hidden = false;
    if (els.bannerText) els.bannerText.textContent = "در حال ویرایش پیام ارسال‌شده…";
    if (els.box) els.box.classList.add("is-editing");
    autoResize(); updateCount(); els.input.focus();
    els.input.setSelectionRange(els.input.value.length, els.input.value.length);
  }
  function exitEditMode() {
    Store.setEditing(null);
    if (els.banner) els.banner.hidden = true;
    if (els.box) els.box.classList.remove("is-editing");
    els.input.value = "";
    autoResize(); updateCount();
  }
  async function submit() {
    var text = els.input.value;
    if (!text.trim() || isStreaming()) return;
    var editing = Store.get().editingMessageId;
    els.input.value = "";
    autoResize(); updateCount();
    if (els.banner) els.banner.hidden = true;
    if (els.box) els.box.classList.remove("is-editing");
    if (editing) Store.setEditing(null);
    try { await sendMessage(text); }
    catch (e) { console.error(e); Toast.toast.err(String(e.message || e)); }
  }
  function refreshSendState() {
    var streaming = isStreaming();
    if (els.send) els.send.hidden = streaming;
    if (els.stop) els.stop.hidden = !streaming;
  }
  function refreshFooter() {
    var s = Store.get();
    var name = modelDisplayName(s.model);
    if (els.hint) els.hint.textContent = "مدل: " + name;
    var ctx = modelContextLength(s.model);
    if (els.ctx) {
      if (ctx) { var settings = s.settings || getSettings(); els.ctx.textContent = "ظرفیت: " + Utils.faInt(ctx) + " · حداکثر خروجی: " + Utils.faInt(settings.max_tokens); }
      else els.ctx.textContent = "ظرفیت: نامشخص (Auto/Free)";
    }
  }
  function initComposer() {
    els.input = document.getElementById("composerInput");
    els.box = document.getElementById("composerBox");
    els.send = document.getElementById("sendBtn");
    els.stop = document.getElementById("stopBtn");
    els.clear = document.getElementById("clearInputBtn");
    els.count = document.getElementById("composerCount");
    els.banner = document.getElementById("editBanner");
    els.bannerText = document.getElementById("editBannerText");
    els.cancelEdit = document.getElementById("editCancelBtn");
    els.hint = document.getElementById("composerHint");
    els.ctx = document.getElementById("composerCtx");
    if (!els.input) { console.error("[composer] #composerInput missing"); return; }
    els.input.addEventListener("input", function(){ autoResize(); updateCount(); refreshFooter(); });
    els.input.addEventListener("keydown", function(e) { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.isComposing) { e.preventDefault(); submit(); } });
    if (els.send) els.send.addEventListener("click", submit);
    if (els.stop) els.stop.addEventListener("click", function() { cancelStream(); Toast.toast.info("توقف درخواست شد…"); });
    if (els.clear) els.clear.addEventListener("click", function() { els.input.value = ""; autoResize(); updateCount(); els.input.focus(); });
    if (els.cancelEdit) els.cancelEdit.addEventListener("click", exitEditMode);
    Store.on("edit:change", function(id) { if (id) enterEditMode(id); else { if (els.banner) els.banner.hidden = true; if (els.box) els.box.classList.remove("is-editing"); } });
    Store.on("streaming:change", refreshSendState);
    Store.on("model:change", refreshFooter);
    Store.on("thread:reload", refreshFooter);
    refreshSendState(); refreshFooter();
    requestAnimationFrame(autoResize);
    setTimeout(autoResize, 30);
  }
  function focusComposer(text) {
    if (text) { els.input.value = text; autoResize(); updateCount(); }
    els.input.focus();
  }
  return { initComposer: initComposer, focusComposer: focusComposer, refreshFooter: refreshFooter };
})();
var initComposer = ComposerModule.initComposer;
var focusComposer = ComposerModule.focusComposer;
var refreshFooter = ComposerModule.refreshFooter;

// ═══════════════════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════════════════
var SidebarModule = (function() {
  var els = {};
  var searchTerm = "";
  function convIcon() { return '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M4 5.5h16v10H9l-5 4v-14Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'; }
  function matches(c) { if (!searchTerm) return true; var t = searchTerm.toLowerCase(); return (c.title || "").toLowerCase().indexOf(t) >= 0 || (c.model || "").toLowerCase().indexOf(t) >= 0; }
  function shortModel(id) { if (!id) return "—"; if (id === "openrouter/free") return "auto"; var parts = id.split("/"); return parts.length > 1 ? parts[1].slice(0, 18) : id.slice(0, 18); }
  function renderSidebar() {
    var s = Store.get();
    var list = (s.conversations || []).filter(matches);
    if (els.convCount) els.convCount.textContent = Utils.faInt(list.length);
    if (!els.list) return;
    els.list.innerHTML = "";
    if (!list.length) { var d = document.createElement("div"); d.className = "sidebar__empty"; d.textContent = searchTerm ? "نتیجه‌ای پیدا نشد." : "هنوز گفتگویی ندارید."; els.list.appendChild(d); return; }
    var frag = document.createDocumentFragment();
    for (var i = 0; i < list.length; i++) {
      (function(c) {
        var row = document.createElement("div");
        row.className = "conv" + (c.id === s.activeConvId ? " is-active" : "");
        row.dataset.id = c.id; row.setAttribute("role", "listitem"); row.tabIndex = 0;
        row.innerHTML = '<span class="conv__ico">' + convIcon() + '</span><span class="conv__main"><span class="conv__title">' + Utils.escapeHtml(c.title || "بدون عنوان") + '</span><span class="conv__meta"><span>' + Utils.escapeHtml(Utils.formatRelative(c.last_message_at || c.created_at)) + '</span> · <span class="mono">' + Utils.escapeHtml(shortModel(c.model)) + '</span></span></span>';
        row.addEventListener("click", function(e) { openConversation(c.id); });
        row.addEventListener("keydown", function(e) { if (e.key === "Enter") openConversation(c.id); });
        frag.appendChild(row);
      })(list[i]);
    }
    els.list.appendChild(frag);
  }
  async function openConversation(id) {
    if (Store.get().activeConvId === id) { closeMobileSidebar(); return; }
    Store.setActiveConv(id);
    var conv = Store.get().conversations.find(function(c){ return c.id === id; });
    if (conv && conv.model) Store.setModel(conv.model);
    await loadMessagesFor(id);
    renderSidebar();
    closeMobileSidebar();
  }
  async function startNewChat() { await clearActiveConversation(); renderSidebar(); closeMobileSidebar(); }
  function openMobileSidebar() { if (els.sidebar) els.sidebar.classList.add("is-open"); if (els.scrim) els.scrim.hidden = false; }
  function closeMobileSidebar() { if (els.sidebar) els.sidebar.classList.remove("is-open"); if (els.scrim) els.scrim.hidden = true; }
  function initSidebar() {
    els.list = document.getElementById("convList");
    els.count = document.getElementById("convCount");
    els.search = document.getElementById("searchInput");
    els.searchClear = document.getElementById("searchClear");
    els.scrim = document.getElementById("scrim");
    els.sidebar = document.getElementById("sidebar");
    els.menuBtn = document.getElementById("menuBtn");
    els.newBtn = document.getElementById("newChatBtn");
    if (els.search) {
      els.search.addEventListener("input", Utils.debounce(function(){ searchTerm = els.search.value.trim(); if (els.searchClear) els.searchClear.hidden = !searchTerm; renderSidebar(); }, 140));
    }
    if (els.searchClear) els.searchClear.addEventListener("click", function() { if (els.search) els.search.value = ""; searchTerm = ""; els.searchClear.hidden = true; renderSidebar(); });
    if (els.newBtn) els.newBtn.addEventListener("click", startNewChat);
    if (els.menuBtn) els.menuBtn.addEventListener("click", openMobileSidebar);
    if (els.scrim) els.scrim.addEventListener("click", closeMobileSidebar);
    Store.on("convs:change", renderSidebar);
    Store.on("conv:active", renderSidebar);
    renderSidebar();
  }
  return { initSidebar: initSidebar, renderSidebar: renderSidebar, startNewChat: startNewChat, openConversation: openConversation, closeMobileSidebar: closeMobileSidebar };
})();
var initSidebar = SidebarModule.initSidebar;
var renderSidebar = SidebarModule.renderSidebar;
var startNewChat = SidebarModule.startNewChat;
var openConversation = SidebarModule.openConversation;
var closeMobileSidebar = SidebarModule.closeMobileSidebar;

// ═══════════════════════════════════════════════════════════════════════════
// INSPECTOR
// ═══════════════════════════════════════════════════════════════════════════
var InspectorModule = (function() {
  var open = false;
  function initInspector() {
    var closeBtn = document.getElementById("inspectorClose");
    if (closeBtn) closeBtn.addEventListener("click", closeInspector);
    Store.on("change", function(){ if (open) renderInspector(); });
    Store.on("thread:reload", function(){ if (open) renderInspector(); });
  }
  function openInspector() { var el = document.getElementById("inspector"); if (!el) return; open = true; el.classList.add("is-open"); renderInspector(); }
  function closeInspector() { var el = document.getElementById("inspector"); if (!el) return; open = false; el.classList.remove("is-open"); }
  function renderInspector() {
    var body = document.getElementById("inspectorBody"); if (!body) return;
    var s = Store.get();
    var settings = s.settings || getSettings();
    var ctx = modelContextLength(s.model);
    var rep = computeContextReport({ model: s.model, modelCtx: ctx, settings: settings, messages: s.messages });
    var R = 2 * Math.PI * 50;
    var pct = ctx ? Math.round(rep.percent * 100) : 0;
    body.innerHTML = '<div class="ctx-hero"><div class="ctx-hero__ring"><svg viewBox="0 0 120 120"><circle class="ctx-hero__bg" cx="60" cy="60" r="50"></circle><circle class="ctx-hero__fg" cx="60" cy="60" r="50" stroke-dasharray="' + R.toFixed(2) + '" stroke-dashoffset="' + (R * (1 - Math.min(1, rep.percent))).toFixed(2) + '"></circle></svg><div class="ctx-hero__center"><div class="ctx-hero__pct">' + (ctx ? Utils.faInt(pct) + "٪" : "—") + '</div><div class="ctx-hero__sub">' + Utils.fmtTokens(rep.total) + ' توکن</div></div></div></div><div class="ctx-cards"><div class="ctx-card"><div class="ctx-card__label">مدل</div><div class="ctx-card__value" style="font-size:12px">' + Utils.escapeHtml(modelDisplayName(s.model)) + '</div></div><div class="ctx-card"><div class="ctx-card__label">ظرفیت</div><div class="ctx-card__value">' + (ctx ? Utils.faInt(ctx) : "نامشخص") + '</div></div><div class="ctx-card"><div class="ctx-card__label">رزرو خروجی</div><div class="ctx-card__value">' + Utils.faInt(rep.reserved) + '</div></div><div class="ctx-card"><div class="ctx-card__label">پیام‌های ارسالی</div><div class="ctx-card__value is-accent">' + Utils.faInt(rep.count) + '</div></div></div>';
  }
  return { initInspector: initInspector, openInspector: openInspector, closeInspector: closeInspector };
})();
var initInspector = InspectorModule.initInspector;
var openInspector = InspectorModule.openInspector;

// ═══════════════════════════════════════════════════════════════════════════
// MODELS PANEL
// ═══════════════════════════════════════════════════════════════════════════
var ModelsPanelModule = (function() {
  var modalRef = null;
  var term = "";
  var favOnly = false;
  var sortMode = "ctx";
  function sortList(list) { var arr = list.slice(); if (sortMode === "ctx") arr.sort(function(a, b){ return (b.context_length || 0) - (a.context_length || 0); }); else arr.sort(function(a, b){ return (a.name || "").localeCompare(b.name || ""); }); return arr; }
  function matches(m) { if (!term) return true; var t = term.toLowerCase(); return (m.id || "").toLowerCase().indexOf(t) >= 0 || (m.name || "").toLowerCase().indexOf(t) >= 0; }
  function openModelsModal() {
    var holder = document.createElement("div"); holder.className = "models-panel";
    var filters = document.createElement("div"); filters.className = "models-panel__filters";
    filters.innerHTML = '<div class="models-panel__search"><input class="input" id="modelsSearch" placeholder="جستجو در مدل‌ها…" /></div><div class="models-panel__chips"><button type="button" class="chip-toggle" data-fav="1">ستاره‌دار</button><button type="button" class="chip-toggle is-on" data-sort="ctx">ظرفیت</button><button type="button" class="chip-toggle" data-refresh="1">بروزرسانی</button></div>';
    var list = document.createElement("div"); list.className = "models-panel__list"; list.id = "modelsList";
    holder.appendChild(filters); holder.appendChild(list);
    var footer = document.createElement("div"); footer.style.cssText = "display:flex;gap:8px;width:100%;align-items:center";
    var stat = document.createElement("span"); stat.style.cssText = "font-size:11px;color:var(--text-4);flex:1 1 auto"; footer.appendChild(stat);
    modalRef = openModal({ title: "انتخاب مدل", subtitle: "فقط مدل‌های رایگان OpenRouter", className: "modal--wide", body: holder, footer: footer,
      onMount: function() {
        var input = holder.querySelector("#modelsSearch");
        input.addEventListener("input", Utils.debounce(function(){ term = input.value.trim(); render(); }, 120));
        holder.querySelector("[data-fav]").addEventListener("click", function(e) { favOnly = !favOnly; e.currentTarget.classList.toggle("is-on", favOnly); render(); });
        holder.querySelectorAll("[data-sort]").forEach(function(b) { b.addEventListener("click", function() { sortMode = b.dataset.sort; holder.querySelectorAll("[data-sort]").forEach(function(x){ x.classList.remove("is-on"); }); b.classList.add("is-on"); render(); }); });
        holder.querySelector("[data-refresh]").addEventListener("click", async function(e) { e.currentTarget.classList.add("is-on"); try { await loadModels({ force: true }); Toast.toast.ok("فهرست بروز شد"); } catch(err){ Toast.toast.err(String(err.message || err)); } e.currentTarget.classList.remove("is-on"); render(); });
        render();
      }
    });
    return modalRef;
  }
  function render() {
    if (!modalRef) return;
    var list = modalRef.modal.querySelector("#modelsList"); if (!list) return;
    var s = Store.get();
    var models = s.models || [];
    if (s.modelsLoading) { list.innerHTML = '<div class="models-panel__empty"><span class="spinner" style="margin:0 auto 10px"></span>در حال بارگذاری…</div>'; return; }
    if (!models.length) { list.innerHTML = '<div class="models-panel__empty">فهرست خالی است. «بروزرسانی» را بزنید.' + (s.modelsError ? '<br><span class="mono" style="font-size:10px;color:var(--danger)">' + Utils.escapeHtml(s.modelsError) + '</span>' : '') + '</div>'; return; }
    var favs = getModelFavs();
    var filtered = models.filter(matches);
    if (favOnly) filtered = filtered.filter(function(m){ return favs[m.id]; });
    filtered = sortList(filtered);
    list.innerHTML = "";
    list.appendChild(autoRow(s.model === Config.AUTO_FREE_MODEL));
    for (var i = 0; i < filtered.length; i++) list.appendChild(modelRow(filtered[i], s.model === filtered[i].id, !!favs[filtered[i].id]));
  }
  function autoRow(sel) { var row = document.createElement("div"); row.className = "model-row" + (sel ? " is-selected" : ""); row.innerHTML = '<div class="model-row__main"><div class="model-row__title"><span class="model-row__name">Auto · Free</span><span class="badge badge--accent">پیشنهاد</span></div><div class="model-row__id mono">openrouter/free</div><div class="model-row__desc">OpenRouter خودش یک مدل رایگان مناسب انتخاب می‌کند؛ مدل واقعی در سربرگ پاسخ گزارش می‌شود.</div></div><div class="model-row__side"></div>'; row.addEventListener("click", function(){ select(Config.AUTO_FREE_MODEL); }); return row; }
  function modelRow(m, sel, fav) {
    var row = document.createElement("div"); row.className = "model-row" + (sel ? " is-selected" : "");
    var ctx = m.context_length || 0;
    row.innerHTML = '<div class="model-row__main"><div class="model-row__title"><span class="model-row__name">' + Utils.escapeHtml(m.name || m.id) + '</span>' + (m.max_completion_tokens ? '<span class="badge">حداکثر ' + Utils.fmtTokens(m.max_completion_tokens) + '</span>' : '') + '</div><div class="model-row__id mono" title="' + Utils.escapeHtml(m.id) + '">' + Utils.escapeHtml(m.id) + '</div>' + (m.description ? '<div class="model-row__desc">' + Utils.escapeHtml(m.description) + '</div>' : '') + '<div class="model-row__meta"><span>ctx: ' + (ctx ? Utils.faInt(ctx) : "?") + '</span>' + (m.modality ? '<span>' + Utils.escapeHtml(m.modality) + '</span>' : '') + '</div></div><div class="model-row__side"><button type="button" class="model-row__fav' + (fav ? " is-on" : "") + '" title="ستاره"><svg width="14" height="14" viewBox="0 0 24 24"><path d="m12 3.6 2.5 5.5 6 .7-4.5 4.2 1.2 6-5.2-3-5.2 3 1.2-6L3.5 9.8l6-.7 2.5-5.5Z" fill="' + (fav ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></button></div>';
    row.querySelector(".model-row__fav").addEventListener("click", function(e) { e.stopPropagation(); toggleModelFav(m.id); render(); });
    row.addEventListener("click", function(){ select(m.id); });
    return row;
  }
  function select(id) { Store.setModel(id); Toast.toast.ok("مدل: " + (id === Config.AUTO_FREE_MODEL ? "Auto · Free" : id)); if (modalRef) { modalRef.close(); modalRef = null; } }
  return { openModelsModal: openModelsModal };
})();
var openModelsModal = ModelsPanelModule.openModelsModal;

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS PANEL
// ═══════════════════════════════════════════════════════════════════════════
var SettingsPanelModule = (function() {
  function openSettingsModal() {
    var settings = getSettings();
    var body = document.createElement("div"); body.className = "settings";
    body.innerHTML = '<div class="settings-group"><div class="settings-group__head">کلید API</div><div class="settings-group__body"><div class="settings-field"><label class="settings-field__label" for="setApiKey">کلید OpenRouter</label><input class="input mono" id="setApiKey" type="password" placeholder="sk-or-v1-…" value="' + Utils.escapeHtml(getApiKey()) + '" autocomplete="off" /><div class="settings-field__hint">کلید فقط در همین مرورگر ذخیره می‌شود و مستقیماً به OpenRouter ارسال می‌گردد.</div></div></div></div>' +
      '<div class="settings-group"><div class="settings-group__head">پارامترهای درخواست</div><div class="settings-group__body"><div class="settings-field"><div class="settings-field__row"><span class="settings-field__label">Temperature</span><span class="range-val" id="vTemp">' + settings.temperature + '</span></div><input class="range" type="range" id="setTemp" min="0" max="2" step="0.05" value="' + settings.temperature + '" /></div><div class="settings-field"><div class="settings-field__row"><span class="settings-field__label">Top P</span><span class="range-val" id="vTopP">' + settings.top_p + '</span></div><input class="range" type="range" id="setTopP" min="0" max="1" step="0.01" value="' + settings.top_p + '" /></div><div class="settings-field"><label class="settings-field__label" for="setMaxTokens">حداکثر توکن خروجی</label><input class="input mono" id="setMaxTokens" type="number" min="64" max="32768" step="64" value="' + settings.max_tokens + '" /></div><div class="settings-field"><label class="settings-field__label" for="setHistory">تعداد پیام‌های تاریخچه</label><input class="input mono" id="setHistory" type="number" min="1" max="200" step="1" value="' + settings.history_turns + '" /><div class="settings-field__hint">پیام‌های قدیمی‌تر به مدل ارسال نمی‌شوند.</div></div><div class="settings-field"><label class="settings-field__label" for="setSystem">دستور سیستم</label><textarea class="textarea" id="setSystem" rows="4" placeholder="اختیاری…">' + Utils.escapeHtml(settings.system_prompt || "") + '</textarea></div><div class="settings-field__row"><label class="switch"><input type="checkbox" id="setReasoning" ' + (settings.include_reasoning ? "checked" : "") + ' /><span class="switch__track"></span><span>درخواست استدلال</span></label></div></div></div>' +
      '<div class="about-box"><div class="about-box__logo"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M5 19V6l7 8 7-8v13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h3>معراج · نسخه ' + Config.APP_VERSION + '</h3><p>چت هوش مصنوعی با مدل‌های رایگان OpenRouter. تمام متن ارسالی از دکمهٔ Payload قابل مشاهده و کپی است.</p></div>';
    var footer = document.createElement("div"); footer.style.cssText = "display:flex;gap:8px;width:100%";
    var save = document.createElement("button"); save.type = "button"; save.className = "btn btn--primary"; save.textContent = "ذخیره";
    var close = document.createElement("button"); close.type = "button"; close.className = "btn btn--ghost"; close.textContent = "بستن";
    footer.appendChild(save); footer.appendChild(close);
    var m = openModal({ title: "تنظیمات", className: "modal--wide", body: body, footer: footer });
    var $ = function(sel) { return body.querySelector(sel); };
    $("#setTemp").addEventListener("input", function(e){ $("#vTemp").textContent = e.target.value; });
    $("#setTopP").addEventListener("input", function(e){ $("#vTopP").textContent = e.target.value; });
    close.addEventListener("click", function(){ m.close(); });
    save.addEventListener("click", function() {
      var patch = { temperature: Number($("#setTemp").value), top_p: Number($("#setTopP").value), max_tokens: Number($("#setMaxTokens").value) || Config.DEFAULTS.max_tokens, history_turns: Math.max(1, Number($("#setHistory").value) || Config.DEFAULTS.history_turns), system_prompt: $("#setSystem").value, include_reasoning: $("#setReasoning").checked };
      updateSettings(patch); setApiKey($("#setApiKey").value.trim()); Toast.toast.ok("تنظیمات ذخیره شد"); m.close();
    });
  }
  return { openSettingsModal: openSettingsModal };
})();
var openSettingsModal = SettingsPanelModule.openSettingsModal;

// ═══════════════════════════════════════════════════════════════════════════
// TOPBAR
// ═══════════════════════════════════════════════════════════════════════════
var TopbarModule = (function() {
  var RING = 2 * Math.PI * 15;
  function initTopbar() {
    var chip = document.getElementById("modelChip");
    var ctxMeter = document.getElementById("ctxMeter");
    var rawBtn = document.getElementById("rawBtn");
    var themeBtn = document.getElementById("themeBtn");
    if (chip) chip.addEventListener("click", openModelsModal);
    if (ctxMeter) ctxMeter.addEventListener("click", openInspector);
    if (rawBtn) rawBtn.addEventListener("click", showPayload);
    if (themeBtn) themeBtn.addEventListener("click", function() { var cur = document.documentElement.getAttribute("data-theme") || "dark"; Store.setTheme(cur === "dark" ? "light" : "dark"); });
    Store.on("model:change", refresh);
    Store.on("thread:reload", refresh);
    Store.on("change", refresh);
    refresh();
  }
  function refresh() {
    var s = Store.get();
    var chipLabel = document.getElementById("modelChipLabel");
    var chipCtx = document.getElementById("modelChipCtx");
    if (chipLabel) chipLabel.textContent = modelDisplayName(s.model);
    var ctx = modelContextLength(s.model);
    if (chipCtx) chipCtx.textContent = ctx ? Utils.faInt(ctx) + " ctx" : "auto";
    var ring = document.getElementById("ctxRingFill");
    var text = document.getElementById("ctxMeterText");
    var rep = computeContextReport({ model: s.model, modelCtx: ctx, settings: s.settings, messages: s.messages });
    var p = rep.percent || 0;
    if (ring) {
      var off = RING * (1 - Math.min(1, p));
      ring.style.strokeDashoffset = String(off);
      ring.style.stroke = p >= 0.95 ? "var(--danger)" : p >= 0.8 ? "var(--warn)" : "var(--accent)";
    }
    if (text) text.textContent = ctx ? Utils.faInt(Math.round(p * 100)) + "٪" : "—";
  }
  function showPayload() {
    var s = Store.get();
    var lastAssistant = null;
    for (var i = (s.messages || []).length - 1; i >= 0; i--) { var m = s.messages[i]; if (m.role === "assistant" && m.request_body) { lastAssistant = m; break; } }
    if (lastAssistant) { openPayloadModal({ message: lastAssistant }); return; }
    var preview = buildPreviewPayload(null);
    openPayloadModal({ body: preview.body, payload: preview.payload, headers: { "Content-Type": "application/json", Accept: "text/event-stream", Authorization: "Bearer <کلید شما>" }, preview: true });
  }
  return { initTopbar: initTopbar };
})();
var initTopbar = TopbarModule.initTopbar;

// ═══════════════════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════════════════
function setBackendStatus(kind, label) {
  var dot = document.getElementById("connDot");
  var text = document.getElementById("connLabel");
  if (!dot || !text) return;
  dot.className = "dot";
  if (kind === "ok") dot.classList.add("is-ok"); else if (kind === "warn") dot.classList.add("is-warn"); else if (kind === "err") dot.classList.add("is-err"); else dot.classList.add("is-busy");
  text.textContent = label;
}
function wireGlobalButtons() {
  var mb = document.getElementById("modelsBtn"); if (mb) mb.addEventListener("click", openModelsModal);
  var sb = document.getElementById("settingsBtn"); if (sb) sb.addEventListener("click", openSettingsModal);
  var bb = document.getElementById("brandBtn"); if (bb) bb.addEventListener("click", function(){ startNewChat(); });
}
function wireStoreEvents() {
  Store.on("thread:reload", function() {
    var msgs = Store.get().messages || [];
    renderThread(msgs);
    if (msgs.length) hideEmpty(); else showEmpty(function(p){ focusComposer(p); });
    refreshFooter();
    var active = Store.get().conversations.find(function(c){ return c.id === Store.get().activeConvId; });
    if (active && active.title) document.title = active.title + " · معراج";
  });
  Store.on("convs:change", function(){ renderSidebar(); });
  Store.on("conv:active", function(){ renderSidebar(); });
  Utils.emitter.on("message:patch", function(msg){ patchStreamingMessage(msg); });
}
function wireMessageActions() {
  var thread = document.getElementById("thread"); if (!thread) return;
  thread.addEventListener("click", async function(e) {
    var btn = e.target.closest("[data-action]");
    if (btn) {
      var action = btn.dataset.action; var id = btn.dataset.id;
      var msg = (Store.get().messages || []).find(function(m){ return m.id === id; });
      if (!msg) return;
      if (action === "copy") { var ok = await Utils.copyText(msg.content || ""); btn.classList.toggle("is-done", ok); if (ok) Toast.toast.ok("کپی شد"); else Toast.toast.err("کپی ناموفق بود"); return; }
      if (action === "edit") { setEditing(id); scrollThreadToMessage(id); return; }
      if (action === "regen") { await regenerateFrom(id); return; }
      if (action === "delete") { var okd = await confirmDialog({ title: "حذف پیام", message: "این پیام حذف شود؟", okLabel: "حذف", danger: true }); if (okd) await deleteMessageById(id); return; }
      if (action === "payload") { openPayloadModal({ message: msg }); return; }
      return;
    }
    var copyCode = e.target.closest('[data-act="copy-code"]');
    if (copyCode) {
      var block = copyCode.closest(".codeblock"); var code = block && block.querySelector("pre code");
      if (code) { var raw = code.getAttribute("data-raw") || code.textContent; var okc = await Utils.copyText(raw); copyCode.classList.toggle("is-done", okc); var lbl = copyCode.querySelector("span"); if (lbl) lbl.textContent = okc ? "کپی شد" : "کپی"; setTimeout(function(){ copyCode.classList.remove("is-done"); if (lbl) lbl.textContent = "کپی"; }, 1400); }
    }
  });
}
function wireKeyboard() {
  window.addEventListener("keydown", function(e) {
    var meta = e.ctrlKey || e.metaKey;
    if (meta && e.key.toLowerCase() === "k") { e.preventDefault(); startNewChat(); }
    else if (meta && e.key.toLowerCase() === "b") { e.preventDefault(); var el = document.getElementById("sidebar"); if (el) el.classList.toggle("is-open"); var scrim = document.getElementById("scrim"); if (scrim) scrim.hidden = !(el && el.classList.contains("is-open")); }
    else if (e.key === "Escape") { var scrim2 = document.getElementById("scrim"); if (scrim2 && !scrim2.hidden) { var sb = document.getElementById("sidebar"); if (sb) sb.classList.remove("is-open"); scrim2.hidden = true; } }
  });
}
async function boot() {
  document.documentElement.setAttribute("data-theme", getTheme());
  var steps = [
    ["render", initRender],
    ["topbar", initTopbar],
    ["sidebar", initSidebar],
    ["composer", initComposer],
    ["inspector", initInspector],
    ["buttons", wireGlobalButtons],
    ["storeEvents", wireStoreEvents],
    ["msgActions", wireMessageActions],
    ["keyboard", wireKeyboard],
    ["emptyState", function(){ showEmpty(function(p){ focusComposer(p); }); }]
  ];
  for (var i = 0; i < steps.length; i++) {
    try { steps[i][1](); } catch(e) { console.error("[boot] " + steps[i][0] + " failed:", e); }
  }
  setBackendStatus("busy", "در حال اتصال…");
  Supa.sb.ping().then(function(r) {
    if (r.ok) setBackendStatus("ok", "متصل به Supabase");
    else setBackendStatus("warn", "Supabase: HTTP " + r.status);
  }).catch(function(){ setBackendStatus("warn", "حالت محلی (بدون Supabase)"); });
  loadModels().catch(function(e){ console.error("[boot] loadModels failed:", e); });
  Store.set({ convsLoading: true });
  try {
    var convs = await api.listConversations();
    Store.set({ conversations: convs, convsLoading: false }, "convs:change");
    var lastId = Store.get().activeConvId;
    var target = convs.find(function(c){ return c.id === lastId; }) || convs[0];
    if (target) { Store.setActiveConv(target.id); if (target.model) Store.setModel(target.model); await loadMessagesFor(target.id); }
    else { hideEmpty(); showEmpty(function(p){ focusComposer(p); }); renderThread([]); }
  } catch(e) {
    Store.set({ convsLoading: false }, "convs:change");
    console.error("[boot] conversation loading failed:", e);
  }
  refreshFooter();
  window.__MIRAJ_BOOT_OK__ = true;
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

})();
