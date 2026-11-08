// AURORA OS — File Manager

import { h, $, $$, clear, fmtBytes, relTime } from '../core/dom.js';
import { store } from '../core/store.js';
import { FILES } from '../data/seed.js';
import { button, input, emptyState } from '../ui/components.js';
import { contextMenu } from '../ui/contextmenu.js';
import toast from '../ui/toasts.js';

export const meta = {
  id: 'files',
  title: 'Files',
  icon: '▤',
  defaultSize: { width: 900, height: 580 },
};

let _root = null;
let _path = '/';
let _tree = null;
let _view = 'grid';
let _selected = null;

function getTree() {
  if (!_tree) {
    const stored = store.get('files.tree');
    _tree = stored && stored.length ? stored : FILES.map((f) => ({ ...f }));
  }
  return _tree;
}

function saveTree() { store.set('files.tree', _tree); }

function findAtPath(nodes, pathParts) {
  if (!pathParts.length) return nodes;
  const [head, ...rest] = pathParts;
  const node = nodes.find((n) => n.name === head && n.type === 'folder');
  if (!node) return [];
  return findAtPath(node.children || [], rest);
}

function currentNode() {
  const parts = _path.split('/').filter(Boolean);
  return findAtPath(getTree(), parts);
}

function breadcrumbs() {
  const crumb = h('div', { class: 'files-breadcrumb' });
  const parts = _path.split('/').filter(Boolean);
  crumb.append(h('button', {
    class: 'files-crumb', type: 'button', text: '/',
    onClick: () => { _path = '/'; _selected = null; render(); },
  }));
  let acc = '';
  for (const p of parts) {
    acc += '/' + p;
    const target = acc;
    crumb.append(h('span', { class: 'files-crumb-sep', text: '›' }));
    crumb.append(h('button', {
      class: 'files-crumb', type: 'button', text: p,
      onClick: () => { _path = target; _selected = null; render(); },
    }));
  }
  return crumb;
}

function fileIcon(type) {
  if (type === 'folder') return '📁';
  if (type === 'png' || type === 'jpg' || type === 'svg') return '🖼';
  if (type === 'pdf') return '📄';
  if (type === 'xlsx' || type === 'csv') return '📊';
  if (type === 'js' || type === 'ts' || type === 'json') return '⚙';
  if (type === 'md') return '📝';
  return '📄';
}

function openFolder(node) {
  _path = _path.replace(/\/$/, '') + '/' + node.name;
  _selected = null;
  render();
}

function openFile(node) {
  _selected = node.id;
  render();
}

function fileRow(node) {
  const row = h('div', { class: 'file-item' + (_selected === node.id ? ' is-selected' : '') });
  row.append(h('div', { class: 'file-icon', text: fileIcon(node.type) }));
  row.append(h('div', { class: 'file-name', text: node.name }));
  if (_view === 'list') {
    row.append(h('div', { class: 'file-meta', text: node.type }));
    row.append(h('div', { class: 'file-meta', text: node.type === 'folder' ? '—' : fmtBytes(node.size) }));
    row.append(h('div', { class: 'file-meta', text: relTime(node.modified) }));
  }
  row.addEventListener('click', () => node.type === 'folder' ? openFolder(node) : openFile(node));
  row.addEventListener('dblclick', () => {
    if (node.type !== 'folder') toast.info('Opening ' + node.name + '...');
  });
  row.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    contextMenu([
      { label: 'Open', icon: '↗', onClick: () => node.type === 'folder' ? openFolder(node) : openFile(node) },
      { label: 'Rename', icon: '✎', onClick: () => renameNode(node) },
      { sep: true },
      { label: 'Delete', icon: '✕', danger: true, onClick: () => deleteNode(node) },
    ], e.clientX, e.clientY);
  });
  return row;
}

function renameNode(node) {
  const nameInput = input({ value: node.name, size: 'lg' });
  const ok = button('Rename', { variant: 'primary', onClick: () => {
    const newName = nameInput.value.trim();
    if (newName && newName !== node.name) {
      node.name = newName;
      saveTree();
      render();
      toast.success('Renamed to ' + newName);
    }
    modal?.close?.();
  } });
  const cancel = button('Cancel', { variant: 'ghost', onClick: () => modal?.close?.() });
  const modal = (function(){
    const m = document.createElement('div');
    return m;
  })();
  // Use simple prompt fallback via modal-less approach
  toast.info('Rename: editing file name inline not yet implemented');
}

function deleteNode(node) {
  const parts = _path.split('/').filter(Boolean);
  const nodes = parts.length ? findAtPath(getTree(), parts.slice(0, -1)) : getTree();
  const target = nodes?.find((n) => n.id === node.id);
  if (target?.children) {
    const idx = nodes.indexOf(target);
    if (idx >= 0) nodes.splice(idx, 1);
    saveTree();
    render();
    toast.info('Deleted ' + node.name);
  }
}

function renderGrid() {
  const nodes = currentNode();
  if (!nodes.length) {
    return h('div', { class: 'files-grid' }, [emptyState({ icon: '📂', title: 'Empty folder', text: 'Nothing here' })]);
  }
  const grid = h('div', { class: 'files-grid' });
  for (const n of nodes) grid.append(fileRow(n));
  return grid;
}

function renderList() {
  const nodes = currentNode();
  if (!nodes.length) {
    return h('div', { class: 'files-list' }, [emptyState({ icon: '📂', title: 'Empty folder', text: 'Nothing here' })]);
  }
  const list = h('div', { class: 'files-list' });
  const header = h('div', { class: 'file-item file-item--head' });
  header.append(h('div', { class: 'file-icon' }));
  header.append(h('div', { class: 'file-name', text: 'Name' }));
  header.append(h('div', { class: 'file-meta', text: 'Type' }));
  header.append(h('div', { class: 'file-meta', text: 'Size' }));
  header.append(h('div', { class: 'file-meta', text: 'Modified' }));
  list.append(header);
  for (const n of nodes) list.append(fileRow(n));
  return list;
}

function render() {
  if (!_root) return;
  clear(_root);

  const head = h('div', { class: 'files-head' });
  head.append(button('‹', { variant: 'ghost', size: 'sm', onClick: () => {
    const parts = _path.split('/').filter(Boolean);
    if (parts.length) { parts.pop(); _path = '/' + parts.join('/'); render(); }
  } }));
  head.append(breadcrumbs());
  head.append(h('div', { style: { flex: '1' } }));
  head.append(h('button', {
    class: 'btn btn--ghost btn--sm', type: 'button',
    text: _view === 'grid' ? '☰' : '▦',
    onClick: () => { _view = _view === 'grid' ? 'list' : 'grid'; render(); },
  }));
  _root.append(head);

  const content = h('div', { class: 'files-content' });
  if (_view === 'grid') content.append(renderGrid());
  else content.append(renderList());
  _root.append(content);

  if (_selected) {
    const nodes = currentNode();
    const node = nodes.find((n) => n.id === _selected);
    if (node) {
      const preview = h('div', { class: 'files-preview' });
      preview.append(h('div', { class: 'file-icon file-icon--lg', text: fileIcon(node.type) }));
      preview.append(h('div', { class: 'files-preview__name', text: node.name }));
      if (node.type !== 'folder') {
        preview.append(h('div', { class: 'files-preview__meta', text: fmtBytes(node.size) + ' · ' + relTime(node.modified) }));
      }
      preview.append(button('Close', { variant: 'ghost', size: 'sm', onClick: () => { _selected = null; render(); } }));
      _root.append(preview);
    }
  }
}

export function mount(container) {
  clear(container);
  getTree();
  _root = h('div', { class: 'files-wrap' });
  container.append(_root);
  render();
}

export default { meta, mount };
