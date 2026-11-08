// AURORA OS — Code Pad

import { h, $, clear } from '../core/dom.js';
import { store } from '../core/store.js';
import { button } from '../ui/components.js';
import toast from '../ui/toasts.js';

export const meta = {
  id: 'codepad',
  title: 'Code Pad',
  icon: '⌨',
  defaultSize: { width: 800, height: 560 },
};

const DEFAULT_TABS = [
  { id: 'tab-1', name: 'main.js', content: '// Welcome to Code Pad\n// A simple code editor.\n\nfunction hello(name) {\n  return "Hello, " + name + "!";\n}\n\nconsole.log(hello("AURORA"));\n' },
  { id: 'tab-2', name: 'styles.css', content: '/* Add your styles here */\nbody {\n  background: #0b0d12;\n  color: #e6ebf5;\n  font-family: system-ui;\n}\n' },
  { id: 'tab-3', name: 'notes.md', content: '# Notes\n\n- Write something\n- Save often\n- Have fun\n' },
];

let _root = null;
let _tabs = null;
let _activeTab = null;
let _refs = {};

function getTabs() {
  if (!_tabs) {
    const saved = store.get('codepad.tabs');
    _tabs = saved && saved.length ? saved : DEFAULT_TABS.map((t) => ({ ...t }));
    _activeTab = _tabs[0]?.id;
  }
  return _tabs;
}

function saveTabs() { store.set('codepad.tabs', _tabs); }

function currentTab() { return getTabs().find((t) => t.id === _activeTab); }

function renderTabs() {
  if (!_refs.tabs) return;
  clear(_refs.tabs);
  for (const tab of getTabs()) {
    const el = h('div', { class: 'codepad-tab' + (tab.id === _activeTab ? ' is-active' : '') });
    el.append(h('span', { text: tab.name }));
    const close = h('span', { class: 'codepad-tab__close', text: '×' });
    close.addEventListener('click', (e) => { e.stopPropagation(); closeTab(tab.id); });
    el.append(close);
    el.addEventListener('click', () => { _activeTab = tab.id; renderTabs(); renderEditor(); });
    _refs.tabs.append(el);
  }
  const add = h('div', { class: 'codepad-tab', style: { padding: '6px 12px' } });
  add.append(h('span', { text: '+ New' }));
  add.addEventListener('click', createTab);
  _refs.tabs.append(add);
}

function renderEditor() {
  if (!_refs.editor) return;
  clear(_refs.editor);
  const tab = currentTab();
  if (!tab) {
    _refs.gutter.textContent = '';
    return;
  }
  const ta = h('textarea', { class: 'codepad-textarea', spellcheck: 'false', wrap: 'off' });
  ta.value = tab.content;
  ta.addEventListener('input', () => {
    tab.content = ta.value;
    saveTabs();
    updateGutter(ta.value);
    updateStatus(tab);
  });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      ta.value = ta.value.slice(0, start) + '  ' + ta.value.slice(end);
      ta.selectionStart = ta.selectionEnd = start + 2;
      tab.content = ta.value;
      saveTabs();
    }
  });
  _refs.editor.append(ta);
  updateGutter(tab.content);
  updateStatus(tab);
  setTimeout(() => ta.focus(), 10);
}

function updateGutter(content) {
  if (!_refs.gutter) return;
  clear(_refs.gutter);
  const lines = content.split('\n').length;
  const gutter = h('div', { class: 'codepad-lines' });
  for (let i = 1; i <= lines; i++) {
    gutter.append(h('span', { class: 'codepad-line-num', text: String(i) }));
  }
  _refs.gutter.append(gutter);
}

function updateStatus(tab) {
  if (!_refs.status) return;
  const lines = tab.content.split('\n').length;
  const chars = tab.content.length;
  _refs.status.textContent = 'Lines: ' + lines + ' · Chars: ' + chars + ' · ' + tab.name;
}

function createTab() {
  const name = prompt('File name:', 'untitled.txt');
  if (!name) return;
  const tab = { id: 'tab-' + Date.now(), name, content: '' };
  getTabs().push(tab);
  _activeTab = tab.id;
  saveTabs();
  renderTabs();
  renderEditor();
}

function closeTab(id) {
  const idx = getTabs().findIndex((t) => t.id === id);
  if (idx < 0) return;
  if (getTabs().length === 1) { toast.warning('Cannot close last tab'); return; }
  getTabs().splice(idx, 1);
  if (_activeTab === id) _activeTab = getTabs()[Math.max(0, idx - 1)]?.id;
  saveTabs();
  renderTabs();
  renderEditor();
}

export function mount(container) {
  clear(container);
  _root = h('div', { class: 'codepad-wrap' });
  _refs.tabs = h('div', { class: 'codepad-tabs' });
  _root.append(_refs.tabs);

  const body = h('div', { class: 'codepad-body' });
  _refs.gutter = h('div', { class: 'codepad-gutter' });
  _refs.editor = h('div', { class: 'codepad-editor' });
  body.append(_refs.gutter, _refs.editor);
  _root.append(body);

  _refs.status = h('div', { class: 'codepad-footer' });
  _refs.status.textContent = 'Ready';
  _root.append(_refs.status);

  container.append(_root);
  getTabs();
  renderTabs();
  renderEditor();
}

export default { meta, mount };
