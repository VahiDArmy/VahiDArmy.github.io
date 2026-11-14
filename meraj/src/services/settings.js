/** Preferences, drafts and the device-local OpenRouter key. */
import { CONFIG } from '../config.js';

const PREFIX = CONFIG.app.storagePrefix;

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (error) {
    console.warn('[معراج] Could not read local preference', key, error);
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn('[معراج] Could not write local preference', key, error);
    return false;
  }
}

function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* private mode */
  }
}

export function loadSettings() {
  const stored = readJson(CONFIG.keys.settings, {});
  // v1 shipped a hard 2048-token cap. Treat that old default as automatic
  // once, while preserving any other explicit value the user chose.
  if ((Number(stored.settingsVersion) || 1) < 2 && Number(stored.params?.max_tokens) === 2048) {
    stored.params = { ...(stored.params || {}), max_tokens: null };
    stored.settingsVersion = 2;
  }
  const merged = {
    ...CONFIG.defaults,
    ...stored,
    settingsVersion: 2,
    params: { ...CONFIG.defaults.params, ...(stored.params || {}) },
  };
  if (!['nocturne', 'mihrab', 'nebula', 'dawn'].includes(merged.theme)) merged.theme = CONFIG.defaults.theme;
  if (!['gold', 'jade', 'rose', 'azure', 'amber'].includes(merged.accent)) merged.accent = CONFIG.defaults.accent;
  merged.fontScale = Math.min(1.3, Math.max(0.85, Number(merged.fontScale) || 1));
  return merged;
}

export function saveSettings(patch) {
  const current = loadSettings();
  const next = {
    ...current,
    ...patch,
    params: { ...current.params, ...(patch.params || {}) },
  };
  writeJson(CONFIG.keys.settings, next);
  return next;
}

export function resetSettings() {
  remove(CONFIG.keys.settings);
  return loadSettings();
}

/* ─────────────────────── OpenRouter key ─────────────────────── */

export function getRememberKey() {
  return loadSettings().rememberKey !== false;
}

export function getApiKey() {
  try {
    return sessionStorage.getItem(CONFIG.keys.apiKeySession) || localStorage.getItem(CONFIG.keys.apiKey) || '';
  } catch {
    return '';
  }
}

export function hasApiKey() {
  return getApiKey().trim().length > 0;
}

export function setApiKey(key, remember = true) {
  const value = String(key || '').trim();
  try {
    if (!value) {
      clearApiKey();
      return '';
    }
    if (remember) {
      localStorage.setItem(CONFIG.keys.apiKey, value);
      sessionStorage.removeItem(CONFIG.keys.apiKeySession);
    } else {
      sessionStorage.setItem(CONFIG.keys.apiKeySession, value);
      localStorage.removeItem(CONFIG.keys.apiKey);
    }
  } catch (error) {
    console.warn('[معراج] Could not store the OpenRouter key on this device', error);
  }
  return value;
}

export function clearApiKey() {
  try {
    localStorage.removeItem(CONFIG.keys.apiKey);
    sessionStorage.removeItem(CONFIG.keys.apiKeySession);
  } catch {
    /* private mode */
  }
}

export function maskKey(key) {
  const value = String(key || '');
  if (!value) return '';
  if (value.length <= 10) return `${value.slice(0, 2)}••••`;
  return `${value.slice(0, 7)}••••••••${value.slice(-4)}`;
}

/* ───────────────────────── drafts ──────────────────────────── */

function draftKey(conversationId) {
  return `${CONFIG.keys.draft}${conversationId || 'new'}`;
}

export function saveDraft(conversationId, text) {
  const key = draftKey(conversationId);
  if (!text) {
    remove(key);
    return;
  }
  try {
    localStorage.setItem(key, text.slice(0, 60000));
  } catch (error) {
    console.warn('[معراج] Draft could not be saved locally', error);
  }
}

export function getDraft(conversationId) {
  try {
    return localStorage.getItem(draftKey(conversationId)) || '';
  } catch {
    return '';
  }
}

export function clearDraft(conversationId) {
  remove(draftKey(conversationId));
}

/* ───────────────────────── misc UI ─────────────────────────── */

export function getLastModel() {
  try {
    return localStorage.getItem(CONFIG.keys.lastModel) || '';
  } catch {
    return '';
  }
}

export function setLastModel(slug) {
  try {
    localStorage.setItem(CONFIG.keys.lastModel, slug);
  } catch {
    /* ignore */
  }
}

export function getSidebarCollapsed() {
  try {
    return localStorage.getItem(PREFIX + '.sidebar') === '1';
  } catch {
    return false;
  }
}

export function setSidebarCollapsed(collapsed) {
  try {
    localStorage.setItem(PREFIX + '.sidebar', collapsed ? '1' : '0');
  } catch {
    /* ignore */
  }
}
