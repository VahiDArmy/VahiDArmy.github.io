import { el, clear } from './dom.js';

let target = null;
let items = [];

export function initActivity(node) {
  target = node;
  items = [];
  render();
}

export function clearActivity() {
  items = [];
  render();
}

export function pushActivity(entry) {
  items.push({ ...entry, at: Date.now() });
  if (items.length > 60) items = items.slice(-60);
  render();
}

export function updateActivity(id, patch) {
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  items[idx] = { ...items[idx], ...patch };
  render();
}

function iconFor(entry) {
  if (entry.status === 'error') return '⚠';
  if (entry.status === 'pending') return '…';
  if (entry.status === 'done') return '✓';
  return '•';
}

function render() {
  if (!target) return;
  clear(target);
  for (const entry of items) {
    const cls = entry.status === 'error' ? 'activity-item error' : 'activity-item';
    target.appendChild(
      el('div', { class: cls },
        el('span', { class: 'ico' }, iconFor(entry)),
        el('span', { class: 'act-body' }, entry.label || entry.tool || entry.type || '')
      )
    );
  }
}
