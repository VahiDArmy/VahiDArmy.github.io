// AURORA OS — Kanban Board

import { h, $, $$, clear, fmtDate, uid } from '../core/dom.js';
import { store } from '../core/store.js';
import { bus } from '../core/bus.js';
import { TASKS, USERS } from '../data/seed.js';
import { badge, avatar, button, input, modal, emptyState } from '../ui/components.js';
import { contextMenu } from '../ui/contextmenu.js';
import toast from '../ui/toasts.js';

export const meta = {
  id: 'kanban',
  title: 'Kanban',
  icon: '▤',
  defaultSize: { width: 1000, height: 640 },
};

const COLUMNS = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'todo', label: 'To Do' },
  { id: 'progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
];

let _tasks = null;
let _boardRoot = null;
let _draggingId = null;
let _filterTag = null;
let _filterAssignee = null;

function getTasks() {
  if (!_tasks) {
    const stored = store.get('kanban.tasks');
    _tasks = stored && stored.length ? stored : TASKS.map((t) => ({ ...t }));
  }
  return _tasks;
}

function saveTasks() {
  store.set('kanban.tasks', _tasks);
}

function getUser(id) {
  return USERS.find((u) => u.id === id);
}

function priorityClass(p) {
  return 'priority-' + p;
}

function taskCard(task) {
  const el = h('div', { class: 'kanban-card', draggable: 'true', dataset: { taskId: task.id } });
  el.append(h('div', { class: 'kanban-card__head' }, [
    h('span', { class: 'kanban-priority ' + priorityClass(task.priority), text: task.priority.toUpperCase() }),
    task.due && h('span', { class: 'kanban-due', text: fmtDate(task.due) }),
  ]));
  el.append(h('div', { class: 'kanban-card__title', text: task.title }));
  if (task.tags?.length) {
    const tagRow = h('div', { class: 'kanban-tags' });
    for (const t of task.tags) tagRow.append(h('span', { class: 'kanban-tag', text: '#' + t }));
    el.append(tagRow);
  }
  const foot = h('div', { class: 'kanban-card__foot' });
  const assignee = getUser(task.assignee);
  if (assignee) foot.append(avatar(assignee.initials, { size: 'sm' }));
  if (task.comments > 0) foot.append(h('span', { class: 'kanban-meta', text: '💬 ' + task.comments }));
  el.append(foot);

  el.addEventListener('dragstart', (e) => {
    _draggingId = task.id;
    el.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  el.addEventListener('dragend', () => {
    _draggingId = null;
    el.classList.remove('is-dragging');
  });
  el.addEventListener('click', (e) => {
    if (e.target.closest('.kanban-card__foot')) return;
    openEditModal(task);
  });
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    contextMenu([
      { label: 'Edit task', icon: '✎', onClick: () => openEditModal(task) },
      { label: 'Duplicate', icon: '⧉', onClick: () => duplicateTask(task) },
      { sep: true },
      { label: 'Delete', icon: '✕', danger: true, onClick: () => deleteTask(task) },
    ], e.clientX, e.clientY);
  });
  return el;
}

function matchesFilter(task) {
  if (_filterTag && !task.tags?.includes(_filterTag)) return false;
  if (_filterAssignee && task.assignee !== _filterAssignee) return false;
  return true;
}

function columnView(col) {
  const tasks = getTasks().filter((t) => t.status === col.id && matchesFilter(t));
  const colEl = h('div', { class: 'kanban-column', dataset: { colId: col.id } });
  const head = h('div', { class: 'kanban-col-head' });
  head.append(h('span', { class: 'kanban-col-title', text: col.label }));
  head.append(h('span', { class: 'kanban-col-count', text: tasks.length }));
  head.append(h('button', {
    class: 'btn btn--ghost btn--sm', type: 'button', text: '+',
    onClick: () => openCreateModal(col.id),
  }));
  colEl.append(head);

  const body = h('div', { class: 'kanban-col-body' });
  for (const t of tasks) body.append(taskCard(t));
  if (!tasks.length) {
    body.append(h('div', { class: 'kanban-empty', text: 'Drop tasks here' }));
  }
  colEl.append(body);

  colEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    colEl.classList.add('is-over');
    e.dataTransfer.dropEffect = 'move';
  });
  colEl.addEventListener('dragleave', () => colEl.classList.remove('is-over'));
  colEl.addEventListener('drop', (e) => {
    e.preventDefault();
    colEl.classList.remove('is-over');
    if (!_draggingId) return;
    const task = getTasks().find((t) => t.id === _draggingId);
    if (!task) return;
    task.status = col.id;
    saveTasks();
    renderBoard();
    toast.success('Task moved to ' + col.label);
  });
  return colEl;
}

function renderBoard() {
  if (!_boardRoot) return;
  clear(_boardRoot);
  const board = h('div', { class: 'kanban-board' });
  for (const c of COLUMNS) board.append(columnView(c));
  _boardRoot.append(board);
}

function openCreateModal(status = 'backlog') {
  const titleInput = input({ placeholder: 'Task title', size: 'lg' });
  const tagInput = input({ placeholder: 'tags, comma-separated' });
  const body = h('div', { class: 'form-stack' });
  body.append(
    h('label', { class: 'form-label' }, ['Title', titleInput]),
    h('label', { class: 'form-label' }, ['Tags', tagInput]),
  );
  let m;
  const onCreate = () => {
    const title = titleInput.value.trim();
    if (!title) { toast.error('Title is required'); return; }
    const task = {
      id: 't-' + uid(),
      title,
      status,
      priority: 'medium',
      assignee: USERS[0].id,
      tags: tagInput.value.split(',').map((s) => s.trim()).filter(Boolean),
      due: Date.now() + 7 * 86400000,
      createdAt: Date.now(),
      order: getTasks().length,
      comments: 0,
    };
    getTasks().push(task);
    saveTasks();
    renderBoard();
    toast.success('Task created');
    m.close();
  };
  m = modal({
    title: 'New task',
    body,
    footer: h('div', { style: { display: 'flex', gap: '8px' } }, [
      button('Cancel', { variant: 'ghost', onClick: () => m.close() }),
      button('Create', { variant: 'primary', onClick: onCreate }),
    ]),
  });
}

function openEditModal(task) {
  const titleInput = input({ value: task.title, size: 'lg' });
  const body = h('div', { class: 'form-stack' });
  body.append(
    h('label', { class: 'form-label' }, ['Title', titleInput]),
    h('label', { class: 'form-label' }, ['Priority',
      h('div', { class: 'segmented' }, ['low', 'medium', 'high', 'critical'].map((p) =>
        h('button', {
          class: 'segmented__item' + (task.priority === p ? ' is-active' : ''),
          type: 'button', text: p, dataset: { p },
          onClick: (e) => {
            $$('.segmented__item', e.currentTarget.parentNode).forEach((x) => x.classList.remove('is-active'));
            e.currentTarget.classList.add('is-active');
            task.priority = p;
          },
        })
      )),
    ]),
  );
  let m;
  const onSave = () => {
    task.title = titleInput.value.trim() || task.title;
    saveTasks();
    renderBoard();
    toast.success('Task updated');
    m.close();
  };
  m = modal({
    title: 'Edit task',
    body,
    footer: h('div', { style: { display: 'flex', gap: '8px' } }, [
      button('Delete', { variant: 'danger', onClick: () => { m.close(); deleteTask(task); } }),
      h('div', { style: { flex: '1' } }),
      button('Cancel', { variant: 'ghost', onClick: () => m.close() }),
      button('Save', { variant: 'primary', onClick: onSave }),
    ]),
  });
}

function duplicateTask(task) {
  const copy = { ...task, id: 't-' + uid(), title: task.title + ' (copy)' };
  getTasks().push(copy);
  saveTasks();
  renderBoard();
  toast.info('Task duplicated');
}

function deleteTask(task) {
  const idx = getTasks().findIndex((t) => t.id === task.id);
  if (idx >= 0) {
    getTasks().splice(idx, 1);
    saveTasks();
    renderBoard();
    toast.info('Task deleted');
  }
}

function buildFilters() {
  const bar = h('div', { class: 'kanban-filters' });
  const allTags = new Set();
  for (const t of getTasks()) for (const tag of t.tags || []) allTags.add(tag);
  const tagRow = h('div', { class: 'kanban-filter-group' });
  tagRow.append(h('span', { class: 'filter-label', text: 'Tags:' }));
  tagRow.append(h('button', {
    class: 'chip' + (!_filterTag ? ' is-active' : ''), type: 'button', text: 'All',
    onClick: () => { _filterTag = null; refreshAll(); },
  }));
  for (const tag of allTags) {
    tagRow.append(h('button', {
      class: 'chip' + (_filterTag === tag ? ' is-active' : ''), type: 'button', text: '#' + tag,
      onClick: () => { _filterTag = _filterTag === tag ? null : tag; refreshAll(); },
    }));
  }
  bar.append(tagRow);
  return bar;
}

let _filtersRoot = null;

function refreshAll() {
  if (_filtersRoot) {
    clear(_filtersRoot);
    _filtersRoot.append(buildFilters());
  }
  renderBoard();
}

export function mount(container) {
  clear(container);
  _boardRoot = h('div', { class: 'kanban-wrap' });
  _filtersRoot = h('div', { class: 'kanban-filters-wrap' });
  _filtersRoot.append(buildFilters());
  container.append(_filtersRoot, _boardRoot);
  renderBoard();
}

export function render() { return document.createElement('div'); }

export default { meta, mount };
