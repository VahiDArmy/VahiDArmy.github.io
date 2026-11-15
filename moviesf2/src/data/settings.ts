/**
 * Operator preferences and the device-local provider key.
 *
 * The key never enters the database, the export or a request archive. It lives
 * in localStorage, or sessionStorage when "remember" is off, and only the AI
 * transport reads it.
 */

import { useSyncExternalStore } from 'react';
import type { GenerationParams, ProviderId } from '../types';
import { DEFAULT_PARAMS } from '../types';
import { safeJsonParse } from '../lib/utils';

export const SETTINGS_KEY = 'fmc.v2.settings';
export const KEY_STORAGE = 'fmc.v2.key';

export type ThemeId = 'projection' | 'nocturne' | 'print' | 'blood';
export type Density = 'compact' | 'comfortable' | 'roomy';

export interface AppSettings {
  provider: ProviderId;
  baseUrl: string;
  defaultModel: string;
  rememberKey: boolean;
  theme: ThemeId;
  accent: string;
  density: Density;
  motion: boolean;
  fontScale: number;
  sidebarCollapsed: boolean;
  streamPersist: boolean;
  showReasoning: boolean;
  reasoningExpanded: boolean;
  autoTitle: boolean;
  confirmDestructive: boolean;
  systemPrompt: string;
  params: GenerationParams;
  arenaModelA: string;
  arenaModelB: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  provider: 'openrouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  defaultModel: 'deepseek/deepseek-r1:free',
  rememberKey: true,
  theme: 'projection',
  accent: '#d8ff3e',
  density: 'comfortable',
  motion: true,
  fontScale: 1,
  sidebarCollapsed: false,
  streamPersist: true,
  showReasoning: true,
  reasoningExpanded: false,
  autoTitle: true,
  confirmDestructive: true,
  systemPrompt:
    'You are the projectionist of Full Metal Cinema: a precise, unsentimental film critic with deep knowledge of world cinema. You reason about craft — camera, structure, performance, sound — rather than plot. You never invent facts. When a fact is uncertain you say so plainly.',
  params: { ...DEFAULT_PARAMS },
  arenaModelA: 'deepseek/deepseek-r1:free',
  arenaModelB: 'meta-llama/llama-3.3-70b-instruct:free',
};

function load(): AppSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  const raw = window.localStorage.getItem(SETTINGS_KEY);
  const parsed = raw ? safeJsonParse<Partial<AppSettings>>(raw) : null;
  if (!parsed) return { ...DEFAULT_SETTINGS };
  return {
    ...DEFAULT_SETTINGS,
    ...parsed,
    params: { ...DEFAULT_SETTINGS.params, ...(parsed.params || {}) },
  };
}

let state: AppSettings = load();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getSettings(): AppSettings {
  return state;
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribeSettings, getSettings, getSettings);
}

export function updateSettings(patch: Partial<AppSettings>): void {
  state = { ...state, ...patch };
  if (patch.params) state.params = { ...state.params, ...patch.params };
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(state));
  } catch {
    /* the UI still works for this session */
  }
  emit();
}

export function setParams(patch: Partial<GenerationParams>): void {
  updateSettings({ params: { ...state.params, ...patch } });
}

/* ── the key ───────────────────────────────────────────────────────────── */

export function getApiKey(): string {
  if (typeof window === 'undefined') return '';
  const fromLocal = window.localStorage.getItem(KEY_STORAGE);
  if (fromLocal) return fromLocal;
  return window.sessionStorage.getItem(KEY_STORAGE) || '';
}

export function setApiKey(value: string, remember: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY_STORAGE);
  window.sessionStorage.removeItem(KEY_STORAGE);
  if (!value) {
    emit();
    return;
  }
  if (remember) window.localStorage.setItem(KEY_STORAGE, value);
  else window.sessionStorage.setItem(KEY_STORAGE, value);
  emit();
}

export function clearApiKey(): void {
  setApiKey('', true);
}

export function hasApiKey(): boolean {
  return getApiKey().trim().length > 0;
}

export function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 12) return '•'.repeat(key.length);
  return `${key.slice(0, 7)}${'•'.repeat(10)}${key.slice(-4)}`;
}

/* ── appearance application ────────────────────────────────────────────── */

export function applyAppearance(settings: AppSettings): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.dataset.density = settings.density;
  root.dataset.motion = settings.motion ? 'on' : 'off';
  root.style.setProperty('--accent', settings.accent);
  root.style.setProperty('--font-scale', String(settings.fontScale));
}

export const THEMES: Array<{ id: ThemeId; name: string; note: string; swatch: string[] }> = [
  {
    id: 'projection',
    name: 'Projection',
    note: 'Near-black, lime beam, sprocket details.',
    swatch: ['#0a0a0b', '#141416', '#d8ff3e', '#f2f5ea'],
  },
  {
    id: 'nocturne',
    name: 'Nocturne',
    note: 'Indigo dusk with a cool cyan gate.',
    swatch: ['#0b0b14', '#161628', '#8ab4ff', '#e8ecff'],
  },
  {
    id: 'print',
    name: 'Print',
    note: 'Warm paper, ink, and a red margin.',
    swatch: ['#f3efe4', '#e7e0cf', '#c8462f', '#191712'],
  },
  {
    id: 'blood',
    name: 'Blood',
    note: 'Oxide red on charcoal, for the hate shelf.',
    swatch: ['#100b0c', '#1c1214', '#ff5d6c', '#ffe9e4'],
  },
];

export const ACCENTS = [
  { id: 'lime', hex: '#d8ff3e', name: 'Lime' },
  { id: 'cyan', hex: '#5ee7ff', name: 'Cyan' },
  { id: 'rose', hex: '#ff6ec7', name: 'Rose' },
  { id: 'amber', hex: '#ffb86b', name: 'Amber' },
  { id: 'mint', hex: '#7cf0b4', name: 'Mint' },
  { id: 'violet', hex: '#a99bff', name: 'Violet' },
];
