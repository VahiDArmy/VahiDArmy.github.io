// AURORA OS — Notes

import { h, $, $$, clear, debounce, uid, relTime } from '../core/dom.js';
import { store } from '../core/store.js';
import { NOTES } from '../data/seed.js';
import { button, input, emptyState } from '../ui/components.js';
import toast from '../ui/toasts.js';

export const meta = {
  id: 'notes',
  title: 'Notes',
  icon: '✎',
  defaultSize: { width: 900, height: 580 },
};

let _notes = null;
let _activeId = null;
let _root = null;

function getNotes() {
  if (!_notes) {
    const stored = store.get('notes.items');
    _notes = stored && stored.length ? stored : NOTES.map((n) => ({ ...n }));
  }
  return _notes;
}

function saveNotes() { store.set('notes.items', _notes); }

function activeNote() {
  return getNotes().find((n) => n.id === _activeId) || getNotes()[0];
}

function markdownToHtml(md) {
  if (!md) return '';
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/^- (.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';
  return html;
}

function renderSidebar() {
  const sidebar = h('div', { class: 'notes-sidebar' });
  const head = h('div', { class: 'notes-sidebar__head' });
  head.append(h('div', { class: 'notes-sidebar__title', text: 'Notes' }));
  head.append(button('+', { variant: 'ghost', size: 'sm', onClick: createNote }));
  sidebar.append(head);

  const search = input({ placeholder: 'Search notes…', onInput: debounce((e) => {
    const q = e.target.value.toLowerCase();
    const items = sidebar.querySelectorAll('.notes-item');
    items.forEach((it) => {
      const t = it.querySelector('.notes-item__title').textContent.toLowerCase();
      it.style.display = t.includes(q) ? '' : 'none';
    });
  }, 200) });
  sidebar.append(h('div', { class: 'notes-search' }, [search]));

  const list = h('div', { class: 'notes-list' });
  for (const n of getNotes()) {
    const item = h('div', { class: 'notes-item' + (n.id === _activeId ? ' is-active' : '') });
    item.append(h('div', { class: 'notes-item__title', text: n.title || 'Untitled' }));
    item.append(h('div', { class: 'notes-item__preview', text: (n.body || '').replace(/\n/g, ' ').slice(0, 40) }));
    item.append(h('div', { class: 'notes-item__meta', text: relTime(n.updated) }));
    item.addEventListener('click', () => { _activeId = n.id; render(); });
    list.append(item);
  }
  sidebar.append(list);
  return sidebar;
}

function renderEditor() {
  const editor = h('div', { class: 'notes-editor' });
  const note = activeNote();
  if (!note) {
    editor.append(emptyState({ icon: '✎', title: 'Select a note', text: 'or create a new one' }));
    return editor;
  }

  const titleInput = input({ value: note.title || '', size: 'lg', onChange: (e) => {
    note.title = e.target.value;
    note.updated = Date.now();
    saveNotes();
    const list = _root.querySelector('.notes-list');
    if (list) {
      const titleEl = _root.querySelector('.notes-item.is-active .notes-item__title');
      if (titleEl) titleEl.textContent = note.title;
    }
  } });
  editor.append(h('div', { class: 'notes-editor__head' }, [titleInput]));

  const tabRow = h('div', { class: 'notes-tabs' });
  let view = 'split';
  const rerender = () => {
    const splitBody = editor.querySelector('.notes-body');
    if (!splitBody) return;
    clear(splitBody);
    if (view === 'edit' || view === 'split') splitBody.append(buildEditorPane(note));
    if (view === 'preview' || view === 'split') splitBody.append(buildPreviewPane(note));
    splitBody.classList.toggle('is-preview', view === 'preview');
    splitBody.classList.toggle('is-edit', view === 'edit');
  };
  const tabs = [
    { id: 'edit', label: 'Edit' },
    { id: 'split', label: 'Split' },
    { id: 'preview', label: 'Preview' },
  ];
  for (const t of tabs) {
    const btn = h('button', {
      class: 'segmented__item' + (view === t.id ? ' is-active' : ''),
      type: 'button', text: t.label,
      onClick: (e) => {
        view = t.id;
        $$('.segmented__item', tabRow).forEach((b) => b.classList.remove('is-active'));
        e.currentTarget.classList.add('is-active');
        rerender();
      },
    });
    tabRow.append(btn);
  }
  tabRow.classList.add('segmented');
  const actions = h('div', { class: 'notes-actions' });
  actions.append(button('Delete', { variant: 'ghost', size: 'sm', onClick: () => deleteNote(note) }));
  const head2 = h('div', { class: 'notes-toolbar' }, [tabRow, actions]);
  editor.append(head2);

  const splitBody = h('div', { class: 'notes-body' });
  editor.append(splitBody);
  setTimeout(rerender, 0);
  return editor;
}

function buildEditorPane(note) {
  const pane = h('div', { class: 'notes-pane notes-pane--edit' });
  const ta = h('textarea', { class: 'notes-textarea', placeholder: 'Start writing…' });
  ta.value = note.body || '';
  ta.addEventListener('input', debounce(() => {
    note.body = ta.value;
    note.updated = Date.now();
    saveNotes();
    const preview = _root.querySelector('.notes-preview');
    if (preview) preview.innerHTML = markdownToHtml(ta.value);
  }, 200));
  pane.append(ta);
  return pane;
}

function buildPreviewPane(note) {
  const pane = h('div', { class: 'notes-pane notes-pane--preview' });
  const prev = h('div', { class: 'notes-preview' });
  prev.innerHTML = markdownToHtml(note.body || '');
  pane.append(prev);
  return pane;
}

function createNote() {
  const note = { id: 'n-' + uid(), title: 'Untitled', body: '', updated: Date.now() };
  getNotes().unshift(note);
  saveNotes();
  _activeId = note.id;
  render();
  toast.success('Note created');
}

function deleteNote(note) {
  const idx = getNotes().findIndex((n) => n.id === note.id);
  if (idx >= 0) getNotes().splice(idx, 1);
  saveNotes();
  _activeId = getNotes()[0]?.id;
  render();
  toast.info('Note deleted');
}

function render() {
  if (!_root) return;
  clear(_root);
  if (!_activeId && getNotes().length) _activeId = getNotes()[0].id;
  _root.append(renderSidebar(), renderEditor());
}

export function mount(container) {
  clear(container);
  _root = h('div', { class: 'notes-wrap' });
  container.append(_root);
  render();
}

export default { meta, mount };
