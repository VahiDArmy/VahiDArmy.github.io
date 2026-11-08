// Tag management view — per-tag listing, rename, prune, and file assignment.

import { el, clear } from '../utils/dom.js';
import { State, subscribe } from '../core/state.js';
import { listTags, allTags, pathsWithTag, tagsFor, addTag, removeTag, tagColor } from '../core/tags.js';
import { basename } from '../utils/format.js';
import { navigate } from '../ui/router.js';
import { toastOk, toastWarn } from '../ui/toast.js';

export function mountTags(root) {
  const shell = el('div', { class: 'view-inner' });
  root.appendChild(shell);

  function render() {
    clear(shell);
    shell.appendChild(buildHead());
    shell.appendChild(buildPaletteCard());
    shell.appendChild(buildListCard());
  }

  render();

  const unsub = subscribe((type) => {
    if (type === 'tags' || type === 'files') render();
  });

  return () => unsub();
}

function buildHead() {
  const head = el('div', { class: 'view-head' });
  head.appendChild(el('div', { class: 'view-title' }, [
    el('h1', { text: 'Tags' }),
    el('p', { text: 'Organize files with color-coded tags. Tags live in localStorage and follow paths.' }),
  ]));
  head.appendChild(el('div', { class: 'view-actions' }, [
    el('button', {
      class: 'btn btn-ghost',
      type: 'button',
      onClick: () => navigate('files'),
      text: '← Back to files',
    }),
  ]));
  return head;
}

function buildPaletteCard() {
  const card = el('section', { class: 'card' });
  card.appendChild(el('div', { class: 'card-head' }, [
    el('div', { class: 'card-title' }, [el('span', { class: 'dot' }), el('span', { text: 'Color palette' })]),
  ]));
  const body = el('div', { class: 'card-body', style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } });
  for (const t of listTags()) {
    const used = pathsWithTag(t.id).length;
    const swatch = el('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '10px 14px',
        borderRadius: 'var(--r-sm)',
        border: '1px solid var(--line-2)',
        background: 'var(--surface-2)',
        minWidth: '110px',
      },
    }, [
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
        el('span', { style: { width: '12px', height: '12px', borderRadius: '50%', background: t.color } }),
        el('span', { style: { fontSize: 'var(--fs-sm)', color: 'var(--ink-2)', textTransform: 'capitalize' }, text: t.id }),
      ]),
      el('span', { style: { fontSize: 'var(--fs-2xs)', color: 'var(--faint)' }, text: used + ' file' + (used === 1 ? '' : 's') }),
    ]);
    body.appendChild(swatch);
  }
  card.appendChild(body);
  return card;
}

function buildListCard() {
  const card = el('section', { class: 'card' });
  card.appendChild(el('div', { class: 'card-head' }, [
    el('div', { class: 'card-title' }, [el('span', { class: 'dot', style: { background: 'var(--accent-2)' } }), el('span', { text: 'Tagged files' })]),
  ]));
  const body = el('div', { class: 'card-body flush' });

  const tagIds = allTags();
  if (!tagIds.length) {
    body.appendChild(el('div', { class: 'empty' }, [
      el('div', { class: 'empty-icon', html: '⚐' }),
      el('div', { class: 'empty-title', text: 'No tags yet' }),
      el('div', { class: 'empty-sub', text: 'Right-click any file in the Files view to tag it. Each file can carry up to a handful of tags.' }),
      el('div', { class: 'empty-actions' }, [
        el('button', {
          class: 'btn btn-primary',
          type: 'button',
          onClick: () => navigate('files'),
        }, ['Open files']),
      ]),
    ]));
    card.appendChild(body);
    return card;
  }

  for (const tagId of tagIds) {
    const filePaths = pathsWithTag(tagId).filter((p) => State.files.has(p));
    if (!filePaths.length) continue;
    body.appendChild(el('div', {
      style: {
        padding: '12px 14px',
        borderBottom: '1px solid var(--line)',
      },
    }, [
      el('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        },
      }, [
        el('span', { style: { width: '10px', height: '10px', borderRadius: '50%', background: tagColor(tagId) } }),
        el('span', {
          style: { fontSize: 'var(--fs-sm)', fontWeight: '500', color: 'var(--ink)', textTransform: 'capitalize' },
          text: tagId,
        }),
        el('span', {
          style: { fontSize: 'var(--fs-2xs)', color: 'var(--faint)', marginLeft: 'auto' },
          text: filePaths.length + ' file' + (filePaths.length === 1 ? '' : 's'),
        }),
      ]),
      el('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          paddingLeft: '18px',
        },
      }, filePaths.map((path) => el('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: 'var(--fs-sm)',
          color: 'var(--muted)',
        },
      }, [
        el('button', {
          type: 'button',
          style: {
            background: 'none',
            border: 0,
            padding: 0,
            color: 'var(--accent)',
            cursor: 'pointer',
            textDecoration: 'underline',
            textDecorationStyle: 'dotted',
            textUnderlineOffset: '3px',
          },
          text: basename(path),
          onClick: () => navigate('editor', { path }),
        }),
        el('span', {
          style: { fontSize: 'var(--fs-2xs)', color: 'var(--faint)', flex: '1 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
          text: path,
        }),
        el('button', {
          class: 'icon-btn',
          type: 'button',
          title: 'Remove from tag',
          html: '×',
          style: { width: '22px', height: '22px', fontSize: 'var(--fs-sm)' },
          onClick: () => {
            removeTag(path, tagId);
            toastOk('Removed tag');
          },
        }),
      ]))),
    ]));
  }

  card.appendChild(body);
  return card;
}
