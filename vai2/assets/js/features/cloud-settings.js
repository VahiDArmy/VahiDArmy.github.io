/* ============================================================
   NEXUS CHAT — CLOUD SETTINGS SYNC
   Syncs settings, folder layout, prompt library via the
   Cloud engine. Loaded by cloud-sync.js.
   ============================================================ */
(function () {
  'use strict';
  if (window.__nexus_cloudsettings_loaded__) return;
  window.__nexus_cloudsettings_loaded__ = true;

  const KEYS = {
    settings: 'settings_v1',
    folders: 'folders_v1',
    prompts: 'prompts_v1',
    analytics: 'analytics_rollup_v1',
  };
  const LOCAL_KEYS = {
    settings: 'nexus_settings_v1',
    folders: 'nexus_folders_v1',
    prompts: 'nexus_prompt_library_v1',
    analytics: 'nexus_analytics_events_v1',
  };
  const SYNC_DEBOUNCE_MS = 2000;

  const state = {
    syncTimers: {},
    lastResult: null,
    suppressing: false,
  };

  function readLocal(name) {
    try {
      const raw = localStorage.getItem(LOCAL_KEYS[name]);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function writeLocal(name, value) {
    try {
      localStorage.setItem(LOCAL_KEYS[name], JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('[cloud-settings] writeLocal failed:', e.message);
      return false;
    }
  }

  function mergeFolders(local, remote) {
    if (!remote) return local;
    if (!local) return remote;
    const out = { folders: [], chatFolders: {}, pinned: [], archived: [], showArchived: false };
    const folderById = new Map();
    for (const f of (local.folders || [])) if (f && f.id) folderById.set(f.id, f);
    for (const f of (remote.folders || [])) {
      if (!f || !f.id) continue;
      const existing = folderById.get(f.id);
      if (!existing) folderById.set(f.id, f);
      else {
        const tLocal = existing.updatedAt || existing.createdAt || 0;
        const tRemote = f.updatedAt || f.createdAt || 0;
        if (tRemote > tLocal) folderById.set(f.id, f);
      }
    }
    out.folders = Array.from(folderById.values());
    out.chatFolders = { ...(remote.chatFolders || {}), ...(local.chatFolders || {}) };
    const pinSet = new Set([...(remote.pinned || []), ...(local.pinned || [])]);
    out.pinned = Array.from(pinSet);
    const archSet = new Set([...(remote.archived || []), ...(local.archived || [])]);
    out.archived = Array.from(archSet);
    out.showArchived = !!(local.showArchived || remote.showArchived);
    return out;
  }

  function mergePrompts(local, remote) {
    if (!remote) return local;
    if (!local) return remote;
    const byId = new Map();
    const byTitleBody = new Set();
    function addAll(list) {
      for (const p of (list || [])) {
        if (!p) continue;
        const key = `${p.title || ''}|${(p.body || '').slice(0, 100)}`;
        if (byId.has(p.id) || byTitleBody.has(key)) continue;
        byId.set(p.id, p);
        byTitleBody.add(key);
      }
    }
    addAll(remote.prompts);
    for (const p of (local.prompts || [])) {
      if (!p) continue;
      if (byId.has(p.id)) byId.set(p.id, p);
      else {
        const key = `${p.title || ''}|${(p.body || '').slice(0, 100)}`;
        if (!byTitleBody.has(key)) { byId.set(p.id, p); byTitleBody.add(key); }
      }
    }
    const cats = new Set([...(local.categories || []), ...(remote.categories || [])]);
    return { prompts: Array.from(byId.values()), categories: Array.from(cats) };
  }

  function mergeSettings(local, remote) {
    if (!remote) return local;
    if (!local) return remote;
    return { ...remote, ...local };
  }

  async function syncFromCloud() {
    if (!window.Nexus?.Cloud) return { ok: false, error: 'Cloud not available' };
    const results = {};

    try {
      const local = readLocal('settings');
      const remote = await window.Nexus.Cloud.pull(KEYS.settings);
      if (remote == null && local) {
        window.Nexus.Cloud.push(KEYS.settings, local);
        results.settings = { action: 'pushed-initial' };
      } else if (remote != null) {
        const merged = mergeSettings(local, remote);
        writeLocal('settings', merged);
        results.settings = { action: 'merged', source: 'cloud' };
        applySettingsLive(merged);
      }
    } catch (err) { results.settings = { action: 'error', error: err.message }; }

    try {
      const local = readLocal('folders');
      const remote = await window.Nexus.Cloud.pull(KEYS.folders);
      if (remote == null && local) {
        window.Nexus.Cloud.push(KEYS.folders, local);
        results.folders = { action: 'pushed-initial' };
      } else if (remote != null) {
        const merged = mergeFolders(local, remote);
        writeLocal('folders', merged);
        window.dispatchEvent(new Event('nexus:folders-changed'));
        results.folders = { action: 'merged', source: 'cloud' };
      }
    } catch (err) { results.folders = { action: 'error', error: err.message }; }

    try {
      const local = readLocal('prompts');
      const remote = await window.Nexus.Cloud.pull(KEYS.prompts);
      if (remote == null && local) {
        window.Nexus.Cloud.push(KEYS.prompts, local);
        results.prompts = { action: 'pushed-initial' };
      } else if (remote != null) {
        const merged = mergePrompts(local, remote);
        writeLocal('prompts', merged);
        results.prompts = { action: 'merged', source: 'cloud' };
      }
    } catch (err) { results.prompts = { action: 'error', error: err.message }; }

    state.lastResult = { ok: true, results, ts: Date.now() };
    return { ok: true, results };
  }

  function applySettingsLive(settings) {
    if (!settings || typeof settings !== 'object') return;
    const html = document.documentElement;
    if (settings.theme) html.dataset.theme = settings.theme;
    if (settings.accent) html.dataset.accent = settings.accent;
    if (settings.fontSize) html.dataset.fontSize = settings.fontSize;
    if (settings.density) html.dataset.density = settings.density;
    if (settings.fontFamily) html.dataset.fontFamily = settings.fontFamily;
  }

  function pushAll() {
    if (!window.Nexus?.Cloud) return;
    const settings = readLocal('settings');
    const folders = readLocal('folders');
    const prompts = readLocal('prompts');
    if (settings) window.Nexus.Cloud.push(KEYS.settings, settings);
    if (folders) window.Nexus.Cloud.push(KEYS.folders, folders);
    if (prompts) window.Nexus.Cloud.push(KEYS.prompts, prompts);
  }

  function schedulePush(name) {
    if (state.suppressing) return;
    if (state.syncTimers[name]) clearTimeout(state.syncTimers[name]);
    state.syncTimers[name] = setTimeout(() => {
      delete state.syncTimers[name];
      if (!window.Nexus?.Cloud) return;
      const value = readLocal(name);
      if (value) window.Nexus.Cloud.push(KEYS[name], value);
    }, SYNC_DEBOUNCE_MS);
  }

  function bindWatchers() {
    if (window.Nexus?.Settings?.onChange) {
      window.Nexus.Settings.onChange(() => schedulePush('settings'));
    }
    window.addEventListener('nexus:folders-changed', () => schedulePush('folders'));

    const wrapPromptMethod = (name) => {
      if (!window.Nexus?.PromptLibrary) return;
      const original = window.Nexus.PromptLibrary[name];
      if (typeof original !== 'function' || original.__cloudWrapped) return;
      const wrapped = function (...args) {
        const result = original.apply(this, args);
        schedulePush('prompts');
        return result;
      };
      wrapped.__cloudWrapped = true;
      window.Nexus.PromptLibrary[name] = wrapped;
    };
    setTimeout(() => {
      wrapPromptMethod('createPrompt');
      wrapPromptMethod('updatePrompt');
      wrapPromptMethod('deletePrompt');
      wrapPromptMethod('duplicatePrompt');
      wrapPromptMethod('importPrompts');
    }, 800);

    window.addEventListener('storage', (e) => {
      if (!e.key) return;
      if (e.key === LOCAL_KEYS.settings) schedulePush('settings');
      else if (e.key === LOCAL_KEYS.folders) schedulePush('folders');
      else if (e.key === LOCAL_KEYS.prompts) schedulePush('prompts');
    });
  }

  function ready(fn) {
    if (window.__nexus && window.__nexus.ready) return fn();
    window.addEventListener('nexus:ready', fn, { once: true });
  }

  ready(() => {
    bindWatchers();
    setTimeout(() => {
      const hasSettings = readLocal('settings');
      const hasFolders = readLocal('folders');
      const hasPrompts = readLocal('prompts');
      if (hasSettings) window.Nexus?.Cloud?.push(KEYS.settings, hasSettings);
      if (hasFolders) window.Nexus?.Cloud?.push(KEYS.folders, hasFolders);
      if (hasPrompts) window.Nexus?.Cloud?.push(KEYS.prompts, hasPrompts);
    }, 3000);
  });

  window.Nexus = window.Nexus || {};
  window.Nexus.CloudSettings = {
    syncFromCloud,
    pushAll,
    getLastResult: () => state.lastResult,
    keys: { ...KEYS },
  };
})();
