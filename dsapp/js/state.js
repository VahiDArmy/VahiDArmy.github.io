import { DEFAULT_SETTINGS, STORAGE } from './config.js';

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE.settings);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

export const state = {
  user: null,
  projects: [],
  currentProject: null,
  fs: null,
  models: [],
  modelPrefs: new Map(), // modelId -> { enabled, preferred_role }
  messages: [],
  roadmap: [],
  memory: [],
  checkpoints: [],
  tasks: [],
  operations: [],
  selectedModelId: null,
  running: false,
  pendingQuestion: null,
  settings: loadSettings(),
};

export function setState(patch) {
  Object.assign(state, patch);
}

export function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  localStorage.setItem(STORAGE.settings, JSON.stringify(state.settings));
}

export function resetProjectState() {
  Object.assign(state, {
    currentProject: null,
    fs: null,
    messages: [],
    roadmap: [],
    memory: [],
    checkpoints: [],
    tasks: [],
    operations: [],
    selectedModelId: null,
    running: false,
    pendingQuestion: null,
  });
}
