import { LS } from './config.js';

function readLeaves() {
  try {
    return JSON.parse(localStorage.getItem(LS.leaves) || '{}');
  } catch {
    return {};
  }
}

export const state = {
  booted: false,
  session: null,
  user: null,
  profile: null,
  settings: null,
  conversations: [],
  models: [],
  prompts: [],
  conversation: null,
  messages: [],
  leafId: null,
  leaves: readLeaves(),
  streaming: null,
  bootError: null,
  setupNeeded: false,
  sidebarOpen: window.matchMedia('(min-width: 981px)').matches,
  archivedOpen: false,
  convSearch: '',
  modelFilter: 'active',
  modelSearch: '',
  activeTab: 'chat',
  lastRequest: null,
  syncing: false,
  profileSaving: false,
};

export function saveLeaves() {
  try {
    localStorage.setItem(LS.leaves, JSON.stringify(state.leaves));
  } catch {
    /* storage may be full or blocked */
  }
}

export function rememberLeaf(conversationId, messageId) {
  if (!conversationId || !messageId) return;
  state.leaves[conversationId] = messageId;
  saveLeaves();
}

/** Tiny event bus on window, so modules never import each other in cycles. */
export function emit(event, detail) {
  window.dispatchEvent(new CustomEvent(`nebula:${event}`, { detail }));
}

export function on(event, handler) {
  const listener = (e) => handler(e.detail);
  window.addEventListener(`nebula:${event}`, listener);
  return () => window.removeEventListener(`nebula:${event}`, listener);
}
