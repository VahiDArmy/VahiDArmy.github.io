/** A deliberately small observable store. Views render; this holds truth. */

const listeners = new Set();
const emitter = new EventTarget();

export const state = {
  booted: false,
  session: null,
  user: null,
  profile: null,
  schema: {
    status: 'unknown', // unknown | ready | missing | error
    missing: [],
    error: null,
    checkedAt: null,
  },
  settings: null,
  conversations: [],
  conversationsLoaded: false,
  conversationsError: null,
  archivedConversations: [],
  models: [],
  modelsLoaded: false,
  modelsError: null,
  modelsSyncing: false,
  lastModelSync: null,
  activeConversationId: null,
  openRouterKeyPresent: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  route: { name: 'chat', params: {} },
  busy: false,
};

export function getState() {
  return state;
}

export function setState(patch = {}, reason = 'state') {
  const changed = {};
  for (const [key, value] of Object.entries(patch)) {
    if (state[key] !== value) {
      state[key] = value;
      changed[key] = value;
    }
  }
  if (Object.keys(changed).length) {
    for (const listener of listeners) {
      try {
        listener(changed, reason);
      } catch (error) {
        console.error('[store] listener failed', error);
      }
    }
    emit('state', { changed, reason });
  }
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emit(type, detail = null) {
  let event;
  try {
    event = new CustomEvent(type, { detail });
  } catch {
    event = new Event(type);
    event.detail = detail;
  }
  emitter.dispatchEvent(event);
}

export function on(type, handler) {
  const wrapped = (event) => handler(event.detail, event);
  emitter.addEventListener(type, wrapped);
  return () => emitter.removeEventListener(type, wrapped);
}

export function once(type, handler) {
  const off = on(type, (detail, event) => {
    off();
    handler(detail, event);
  });
  return off;
}

export function getConversationById(id) {
  if (!id) return null;
  return (
    state.conversations.find((conversation) => conversation.id === id) ||
    state.archivedConversations.find((conversation) => conversation.id === id) ||
    null
  );
}

export function getModelBySlug(slug) {
  if (!slug) return null;
  return state.models.find((model) => model.slug === slug) || null;
}

export function updateConversationInState(conversation) {
  if (!conversation?.id) return;
  const apply = (list) => list.map((item) => (item.id === conversation.id ? { ...item, ...conversation } : item));
  setState({ conversations: apply(state.conversations) }, 'conversation-updated');
  setState({ archivedConversations: apply(state.archivedConversations) }, 'conversation-updated');
}

export function removeConversationFromState(id) {
  setState(
    {
      conversations: state.conversations.filter((c) => c.id !== id),
      archivedConversations: state.archivedConversations.filter((c) => c.id !== id),
    },
    'conversation-removed',
  );
}
