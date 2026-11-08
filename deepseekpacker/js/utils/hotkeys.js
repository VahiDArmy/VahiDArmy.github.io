// Central hotkey registry — register a shortcut once, run callbacks safely.

const registry = new Map();
let initialized = false;

function keyId(event) {
  const parts = [];
  if (event.ctrlKey) parts.push('ctrl');
  if (event.metaKey) parts.push('meta');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  const key = (event.key || '').toLowerCase();
  parts.push(key);
  return parts.join('+');
}

function normalizeShortcut(spec) {
  return spec
    .toLowerCase()
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .sort((a, b) => {
      const order = ['ctrl', 'meta', 'alt', 'shift'];
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    })
    .join('+');
}

function ensureInit() {
  if (initialized) return;
  initialized = true;
  document.addEventListener('keydown', (event) => {
    const id = keyId(event);
    const handler = registry.get(id);
    if (!handler) return;

    const target = event.target;
    const tag = target && target.tagName;
    if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && !handler.allowInField) {
      if (!(event.ctrlKey || event.metaKey)) return;
    }

    if (typeof handler.allow === 'function' && !handler.allow(event)) return;

    event.preventDefault();
    try {
      handler.run(event);
    } catch (err) {
      console.error('[hotkey] handler failed for ' + id, err);
    }
  }, true);
}

export function register(spec, run, options = {}) {
  ensureInit();
  const id = normalizeShortcut(spec);
  registry.set(id, {
    run,
    allowInField: !!options.allowInField,
    allow: typeof options.allow === 'function' ? options.allow : null,
    label: options.label || spec,
    spec: id,
  });
  return () => registry.delete(id);
}

export function unregister(spec) {
  registry.delete(normalizeShortcut(spec));
}

export function bindAll(map) {
  const cleanups = [];
  for (const [spec, value] of Object.entries(map)) {
    const fn = typeof value === 'function' ? value : value && value.run;
    const opts = typeof value === 'object' ? value : {};
    if (typeof fn === 'function') {
      cleanups.push(register(spec, fn, opts));
    }
  }
  return () => cleanups.forEach((fn) => fn());
}

export function list() {
  const out = [];
  for (const [id, handler] of registry) {
    out.push({ id, label: handler.label });
  }
  return out;
}

export function clear() {
  registry.clear();
}

export function humanize(spec) {
  return spec
    .split('+')
    .map((part) => {
      if (part === 'ctrl') return 'Ctrl';
      if (part === 'meta') return '⌘';
      if (part === 'alt') return 'Alt';
      if (part === 'shift') return 'Shift';
      if (part === 'backspace') return '⌫';
      if (part === 'escape') return 'Esc';
      if (part === 'enter') return '↵';
      if (part === 'arrowup') return '↑';
      if (part === 'arrowdown') return '↓';
      if (part === 'arrowleft') return '←';
      if (part === 'arrowright') return '→';
      if (part === ' ') return 'Space';
      return part.length === 1 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' + ');
}
