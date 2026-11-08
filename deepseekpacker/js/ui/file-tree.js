// File tree component — collapsible folder structure from paths.

import { el, clear } from '../utils/dom.js';
import { extLabel, fileKind, fmtBytes, basename, dirname } from '../utils/format.js';

export function buildFileTree(files, options = {}) {
  const {
    onSelect = null,
    onToggleFavorite = null,
    favorites = new Set(),
  } = options;

  const root = { children: new Map(), files: [] };

  for (const f of files) {
    const parts = f.path.replace(/\\/g, '/').split('/').filter(Boolean);
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      if (!node.children.has(seg)) {
        node.children.set(seg, { name: seg, children: new Map(), files: [] });
      }
      node = node.children.get(seg);
    }
    node.files.push(f);
  }

  const wrap = el('div', { class: 'file-tree', role: 'tree', style: { display: 'flex', flexDirection: 'column' } });

  function renderNode(node, depth, prefix) {
    const entries = [];

    // Folders
    const folders = Array.from(node.children.values()).sort((a, b) => a.name.localeCompare(b.name));
    for (const folder of folders) {
      entries.push({ kind: 'folder', folder, prefix: prefix + folder.name + '/' });
    }
    // Files
    const files = node.files.slice().sort((a, b) => a.path.localeCompare(b.path));
    for (const f of files) entries.push({ kind: 'file', file: f });

    for (const entry of entries) {
      if (entry.kind === 'folder') {
        wrap.appendChild(renderFolder(entry.folder, depth, entry.prefix));
      } else {
        wrap.appendChild(renderFile(entry.file, depth));
      }
    }
  }

  function renderFolder(folder, depth, prefix) {
    const wrapRow = el('div', { role: 'group' });
    const row = el('div', {
      role: 'treeitem',
      'aria-expanded': 'true',
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 10px',
        paddingLeft: (10 + depth * 14) + 'px',
        borderRadius: 'var(--r-xs)',
        cursor: 'pointer',
        color: 'var(--ink-2)',
        fontSize: 'var(--fs-sm)',
        userSelect: 'none',
      },
      onMouseEnter: (e) => { e.currentTarget.style.background = 'var(--surface-hover)'; },
      onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent'; },
      onClick: (e) => {
        e.stopPropagation();
        const children = wrapRow.querySelector('.tree-children');
        const caret = row.querySelector('.tree-caret');
        if (!children) return;
        const hidden = children.style.display === 'none';
        children.style.display = hidden ? '' : 'none';
        caret.textContent = hidden ? '▾' : '▸';
        row.setAttribute('aria-expanded', hidden ? 'true' : 'false');
      },
    }, [
      el('span', { class: 'tree-caret', style: { width: '12px', textAlign: 'center', color: 'var(--faint)' }, text: '▾' }),
      el('span', { html: '▤', style: { color: 'var(--accent-2)', opacity: '0.85' } }),
      el('span', { style: { flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, text: folder.name }),
      el('span', { style: { fontSize: 'var(--fs-2xs)', color: 'var(--faint)' }, text: String(countFiles(folder)) }),
    ]);
    wrapRow.appendChild(row);

    const children = el('div', { class: 'tree-children', role: 'group' });
    const beforeCount = wrap.childElementCount;
    // Temporarily render into children
    const subWrap = el('div');
    renderNodeInto(folder, depth + 1, subWrap, prefix);
    for (const child of Array.from(subWrap.children)) children.appendChild(child);
    wrapRow.appendChild(children);
    return wrapRow;
  }

  function renderNodeInto(node, depth, host, prefix) {
    const folders = Array.from(node.children.values()).sort((a, b) => a.name.localeCompare(b.name));
    for (const folder of folders) {
      host.appendChild(renderFolderInto(folder, depth, prefix + folder.name + '/'));
    }
    const files = node.files.slice().sort((a, b) => a.path.localeCompare(b.path));
    for (const f of files) host.appendChild(renderFile(f, depth));
  }

  function renderFolderInto(folder, depth, prefix) {
    const wrapRow = el('div', { role: 'group' });
    const row = el('div', {
      role: 'treeitem',
      'aria-expanded': 'true',
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 10px',
        paddingLeft: (10 + depth * 14) + 'px',
        borderRadius: 'var(--r-xs)',
        cursor: 'pointer',
        color: 'var(--ink-2)',
        fontSize: 'var(--fs-sm)',
        userSelect: 'none',
      },
      onMouseEnter: (e) => { e.currentTarget.style.background = 'var(--surface-hover)'; },
      onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent'; },
      onClick: (e) => {
        e.stopPropagation();
        const children = wrapRow.querySelector('.tree-children');
        const caret = row.querySelector('.tree-caret');
        if (!children) return;
        const hidden = children.style.display === 'none';
        children.style.display = hidden ? '' : 'none';
        caret.textContent = hidden ? '▾' : '▸';
        row.setAttribute('aria-expanded', hidden ? 'true' : 'false');
      },
    }, [
      el('span', { class: 'tree-caret', style: { width: '12px', textAlign: 'center', color: 'var(--faint)' }, text: '▾' }),
      el('span', { html: '▤', style: { color: 'var(--accent-2)', opacity: '0.85' } }),
      el('span', { style: { flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, text: folder.name }),
      el('span', { style: { fontSize: 'var(--fs-2xs)', color: 'var(--faint)' }, text: String(countFiles(folder)) }),
    ]);
    wrapRow.appendChild(row);
    const children = el('div', { class: 'tree-children', role: 'group' });
    const subWrap = el('div');
    renderNodeInto(folder, depth + 1, subWrap, prefix);
    for (const child of Array.from(subWrap.children)) children.appendChild(child);
    wrapRow.appendChild(children);
    return wrapRow;
  }

  function renderFile(file, depth) {
    const isFav = favorites.has(file.path);
    const row = el('div', {
      role: 'treeitem',
      tabIndex: 0,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 10px',
        paddingLeft: (10 + depth * 14 + 12) + 'px',
        borderRadius: 'var(--r-xs)',
        cursor: 'pointer',
        color: 'var(--ink-2)',
        fontSize: 'var(--fs-sm)',
      },
      onMouseEnter: (e) => { e.currentTarget.style.background = 'var(--surface-hover)'; },
      onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent'; },
      onClick: () => { if (onSelect) onSelect(file); },
      onKeyDown: (e) => {
        if (e.key === 'Enter') { if (onSelect) onSelect(file); }
      },
    }, [
      el('span', {
        class: 'file-ext',
        dataset: { kind: fileKind(file.path) },
        style: { width: '20px', height: '20px', fontSize: '9px' },
        text: extLabel(file.path),
      }),
      el('span', {
        style: { flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
        text: basename(file.path),
      }),
      el('span', { style: { fontSize: 'var(--fs-2xs)', color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }, text: fmtBytes(file.bytes.length) }),
      el('span', {
        class: 'fav-star',
        html: isFav ? '★' : '☆',
        title: isFav ? 'Unfavorite' : 'Favorite',
        style: {
          cursor: 'pointer',
          fontSize: 'var(--fs-sm)',
          color: isFav ? 'var(--warn)' : 'var(--faint)',
          padding: '0 2px',
        },
        onClick: (e) => {
          e.stopPropagation();
          if (onToggleFavorite) onToggleFavorite(file);
        },
      }),
    ]);
    return row;
  }

  renderNode(root, 0, '');
  return wrap;
}

function countFiles(node) {
  let count = node.files.length;
  for (const child of node.children.values()) count += countFiles(child);
  return count;
}
