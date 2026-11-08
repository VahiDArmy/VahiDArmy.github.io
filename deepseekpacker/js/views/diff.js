// Diff view — compare two files side by side with simple LCS-based line diff.

import { el, clear } from '../utils/dom.js';
import { State, subscribe, getFileList, sortFiles } from '../core/state.js';
import { fmtBytes, basename } from '../utils/format.js';
import { navigate } from '../ui/router.js';

export function mountDiff(root, params = {}) {
  const shell = el('div', { class: 'view-inner' });
  root.appendChild(shell);

  let leftPath = params.left || null;
  let rightPath = params.right || null;

  function render() {
    clear(shell);
    shell.appendChild(buildHead());
    if (State.files.size < 2) {
      shell.appendChild(buildNotEnough());
      return;
    }
    const all = sortFiles(getFileList());
    if (!leftPath || !State.files.has(leftPath)) leftPath = all[0].path;
    if (!rightPath || !State.files.has(rightPath)) rightPath = all[1].path;
    shell.appendChild(buildPickers(all));
    shell.appendChild(buildDiffPanel());
  }

  function buildPickers(all) {
    const bar = el('div', { class: 'toolbar' });
    const makeSelect = (current, side) => {
      const sel = el('select', { class: 'select', style: { minWidth: '220px', flex: '1 1 auto' } });
      for (const f of all) {
        const opt = el('option', { value: f.path, text: f.path });
        if (f.path === current) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', () => {
        if (side === 'left') leftPath = sel.value;
        else rightPath = sel.value;
        render();
      });
      return sel;
    };
    bar.appendChild(el('span', { class: 'field-label', text: 'Left' }));
    bar.appendChild(makeSelect(leftPath, 'left'));
    bar.appendChild(el('span', { class: 'field-label', text: 'Right' }));
    bar.appendChild(makeSelect(rightPath, 'right'));
    bar.appendChild(el('button', {
      class: 'btn btn-ghost btn-sm',
      type: 'button',
      onClick: () => {
        const tmp = leftPath;
        leftPath = rightPath;
        rightPath = tmp;
        render();
      },
      text: '⇄ Swap',
    }));
    return bar;
  }

  function buildDiffPanel() {
    const left = State.files.get(leftPath);
    const right = State.files.get(rightPath);
    const card = el('section', { class: 'card' });

    const head = el('div', { class: 'card-head' });
    head.appendChild(el('div', { class: 'card-title' }, [
      el('span', { class: 'dot' }),
      el('span', { text: basename(leftPath) + ' ↔ ' + basename(rightPath) }),
    ]));
    head.appendChild(el('span', {
      style: { fontSize: 'var(--fs-2xs)', color: 'var(--faint)' },
      text: fmtBytes(left.bytes.length) + ' vs ' + fmtBytes(right.bytes.length),
    }));
    card.appendChild(head);

    const result = diffLines(left.content.split('\n'), right.content.split('\n'));
    const body = el('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--fs-sm)',
        lineHeight: '1.62',
        maxHeight: '64vh',
        overflow: 'auto',
      },
    });

    const leftCol = el('div', { style: { padding: '10px 0' } });
    const rightCol = el('div', { style: { padding: '10px 0', borderLeft: '1px solid var(--line)' } });

    for (const row of result) {
      leftCol.appendChild(buildDiffLine(row.left, row.type));
      rightCol.appendChild(buildDiffLine(row.right, row.type));
    }

    body.appendChild(leftCol);
    body.appendChild(rightCol);
    card.appendChild(body);

    // Summary
    let added = 0, removed = 0, same = 0;
    for (const row of result) {
      if (row.type === 'add') added++;
      else if (row.type === 'remove') removed++;
      else if (row.type === 'same') same++;
    }
    const foot = el('div', {
      class: 'card-foot',
      style: { display: 'flex', gap: 'var(--sp-3)', fontSize: 'var(--fs-xs)', color: 'var(--muted)' },
    });
    foot.appendChild(el('span', { html: '<b style="color: var(--ok)">+' + added + '</b> added' }));
    foot.appendChild(el('span', { html: '<b style="color: var(--bad)">−' + removed + '</b> removed' }));
    foot.appendChild(el('span', { html: '<b>' + same + '</b> unchanged' }));
    card.appendChild(foot);

    return card;
  }

  function buildDiffLine(text, type) {
    const bg = type === 'add' ? 'color-mix(in srgb, var(--ok) 12%, transparent)'
      : type === 'remove' ? 'color-mix(in srgb, var(--bad) 12%, transparent)'
      : type === 'change' ? 'color-mix(in srgb, var(--warn) 12%, transparent)'
      : 'transparent';
    const prefix = type === 'add' ? '+ ' : type === 'remove' ? '− ' : type === 'change' ? '~ ' : '  ';
    return el('div', {
      style: {
        padding: '1px 12px',
        background: bg,
        whiteSpace: 'pre',
        overflowX: 'auto',
        overflowWrap: 'normal',
        color: 'var(--ink-2)',
      },
      text: prefix + (text == null ? '' : text),
    });
  }

  render();

  const unsub = subscribe((type) => {
    if (type === 'files') render();
  });

  return () => unsub();
}

function buildHead() {
  const head = el('div', { class: 'view-head' });
  head.appendChild(el('div', { class: 'view-title' }, [
    el('h1', { text: 'Compare' }),
    el('p', { text: 'Side-by-side line diff of two packed files.' }),
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

function buildNotEnough() {
  return el('div', { class: 'card' }, [
    el('div', { class: 'empty' }, [
      el('div', { class: 'empty-icon', html: '⇄' }),
      el('div', { class: 'empty-title', text: 'Need two files to compare' }),
      el('div', { class: 'empty-sub', text: 'Paste more blocks or load a ZIP with at least two text files.' }),
      el('div', { class: 'empty-actions' }, [
        el('button', {
          class: 'btn btn-primary',
          type: 'button',
          onClick: () => navigate('files'),
        }, ['Open files']),
      ]),
    ]),
  ]);
}

// LCS-based line diff with change detection.
function diffLines(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const raw = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      raw.push({ left: a[i], right: b[j], type: 'same' });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      raw.push({ left: a[i], right: null, type: 'remove' });
      i++;
    } else {
      raw.push({ left: null, right: b[j], type: 'add' });
      j++;
    }
  }
  while (i < m) { raw.push({ left: a[i++], right: null, type: 'remove' }); }
  while (j < n) { raw.push({ left: null, right: b[j++], type: 'add' }); }

  // Merge adjacent remove+add runs into "change" rows
  const merged = [];
  let k = 0;
  while (k < raw.length) {
    if (raw[k].type === 'remove') {
      const removes = [];
      while (k < raw.length && raw[k].type === 'remove') removes.push(raw[k++].left);
      const adds = [];
      while (k < raw.length && raw[k].type === 'add') adds.push(raw[k++].right);
      const max = Math.max(removes.length, adds.length);
      for (let idx = 0; idx < max; idx++) {
        merged.push({
          left: removes[idx] != null ? removes[idx] : null,
          right: adds[idx] != null ? adds[idx] : null,
          type: 'change',
        });
      }
    } else {
      merged.push(raw[k++]);
    }
  }

  return merged;
}
