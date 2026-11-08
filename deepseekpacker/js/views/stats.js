// Insights view — charts, bars, top files.

import { el, clear } from '../utils/dom.js';
import { State, subscribe, getStats, getFileList, sortFiles } from '../core/state.js';
import { fmtBytes, fmtNum, formatPercent, extLabel, fileKind, basename, dirname } from '../utils/format.js';
import { navigate } from '../ui/router.js';

export function mountStats(root) {
  const shell = el('div', { class: 'view-inner' });
  root.appendChild(shell);

  function render() {
    clear(shell);
    const stats = getStats();
    shell.appendChild(buildHead(stats));
    shell.appendChild(buildTiles(stats));
    shell.appendChild(buildBars(stats));
    shell.appendChild(buildExtBars(stats));
    shell.appendChild(buildLargest(stats));
    shell.appendChild(buildLogSpark());
  }

  render();

  const unsub = subscribe((type) => {
    if (type === 'files' || type === 'log' || type === 'ingest') {
      render();
    }
  });

  return () => unsub();
}

function buildHead(stats) {
  const head = el('div', { class: 'view-head' });
  head.appendChild(el('div', { class: 'view-title' }, [
    el('h1', { text: 'Insights' }),
    el('p', { text: 'A quick read on what is packed and how healthy the workspace is.' }),
  ]));
  head.appendChild(el('div', { class: 'view-actions' }, [
    el('button', {
      class: 'btn btn-ghost',
      type: 'button',
      onClick: () => navigate('files'),
      text: 'Open files →',
    }),
  ]));
  return head;
}

function buildTiles(stats) {
  const grid = el('div', { class: 'stat-grid' });
  grid.appendChild(tile('Total files', fmtNum(stats.fileCount), stats.failed ? 'bad' : 'accent', stats.failed ? stats.failed + ' need attention' : 'all healthy'));
  grid.appendChild(tile('Total size', fmtBytes(stats.totalBytes), '', stats.totalBytes ? 'packed workspace' : 'empty'));
  grid.appendChild(tile('Total lines', fmtNum(stats.totalLines), '', 'across all files'));
  grid.appendChild(tile('Avg size', stats.fileCount ? fmtBytes(Math.round(stats.totalBytes / stats.fileCount)) : '—', '', 'per file'));
  return grid;
}

function tile(label, value, variant, sub) {
  return el('div', { class: ['stat', variant || ''].filter(Boolean).join(' ') }, [
    el('div', { class: 'stat-label', text: label }),
    el('div', { class: 'stat-value', text: value }),
    el('div', { class: 'stat-sub', text: sub }),
  ]);
}

function buildBars(stats) {
  const card = el('section', { class: 'card' });
  card.appendChild(el('div', { class: 'card-head' }, [
    el('div', { class: 'card-title' }, [el('span', { class: 'dot' }), el('span', { text: 'By status' })]),
  ]));
  const body = el('div', { class: 'card-body' });
  const chart = el('div', { class: 'bar-chart' });

  const total = Math.max(1, stats.fileCount);
  const rows = [
    { key: 'new', label: 'New', value: stats.byStatus.new || 0, cls: '' },
    { key: 'changed', label: 'Changed', value: stats.byStatus.changed || 0, cls: 'warn' },
    { key: 'identical', label: 'Identical', value: stats.byStatus.identical || 0, cls: 'muted' },
    { key: 'edited', label: 'Edited', value: stats.byStatus.edited || 0, cls: '' },
    { key: 'truncated', label: 'Truncated', value: stats.byStatus.truncated || 0, cls: 'bad' },
    { key: 'corrupt', label: 'Corrupt', value: stats.byStatus.corrupt || 0, cls: 'bad' },
  ];

  for (const row of rows) {
    chart.appendChild(barRow(row.label, row.value, total, row.cls));
  }
  body.appendChild(chart);
  card.appendChild(body);
  return card;
}

function buildExtBars(stats) {
  const card = el('section', { class: 'card' });
  card.appendChild(el('div', { class: 'card-head' }, [
    el('div', { class: 'card-title' }, [el('span', { class: 'dot', style: { background: 'var(--accent-2)' } }), el('span', { text: 'By extension' })]),
  ]));
  const body = el('div', { class: 'card-body' });
  const chart = el('div', { class: 'bar-chart' });

  const entries = Object.entries(stats.byExt || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!entries.length) {
    body.appendChild(el('div', { class: 'empty', style: { padding: '20px 0' } }, [
      el('div', { class: 'empty-title', text: 'No extensions yet' }),
    ]));
  } else {
    const total = Math.max(1, stats.fileCount);
    for (const [ext, count] of entries) {
      chart.appendChild(barRow(ext === 'none' ? '(none)' : '.' + ext, count, total, ''));
    }
    body.appendChild(chart);
  }
  card.appendChild(body);
  return card;
}

function barRow(label, value, total, cls) {
  const pct = total ? (value / total) * 100 : 0;
  const row = el('div', { class: 'bar-row' });
  row.appendChild(el('div', { class: 'bar-label', text: label }));
  const track = el('div', { class: 'bar-track' });
  track.appendChild(el('div', {
    class: ['bar-fill', cls || ''].filter(Boolean).join(' '),
    style: { width: Math.max(1.5, pct) + '%' },
  }));
  row.appendChild(track);
  row.appendChild(el('div', { class: 'bar-value', text: String(value) }));
  return row;
}

function buildLargest(stats) {
  const card = el('section', { class: 'card' });
  card.appendChild(el('div', { class: 'card-head' }, [
    el('div', { class: 'card-title' }, [el('span', { class: 'dot', style: { background: 'var(--accent-3)' } }), el('span', { text: 'Largest files' })]),
  ]));
  const body = el('div', { class: 'card-body' });
  const files = sortFiles(getFileList()).sort((a, b) => b.bytes.length - a.bytes.length).slice(0, 8);
  if (!files.length) {
    body.appendChild(el('div', { class: 'empty', style: { padding: '20px 0' } }, [
      el('div', { class: 'empty-title', text: 'No files packed' }),
    ]));
  } else {
    const list = el('div', { class: 'largest-list' });
    for (const f of files) {
      const row = el('div', { class: 'largest-row' });
      row.appendChild(el('div', { class: 'lr-path', text: f.path }));
      row.appendChild(el('div', { class: 'lr-size', text: fmtBytes(f.bytes.length) }));
      list.appendChild(row);
    }
    body.appendChild(list);
  }
  card.appendChild(body);
  return card;
}

function buildLogSpark() {
  const card = el('section', { class: 'card' });
  card.appendChild(el('div', { class: 'card-head' }, [
    el('div', { class: 'card-title' }, [el('span', { class: 'dot' }), el('span', { text: 'Pastes per recent' })]),
    el('button', {
      class: 'btn btn-ghost btn-sm',
      type: 'button',
      onClick: () => navigate('log'),
      text: 'Open log →',
    }),
  ]));
  const body = el('div', { class: 'card-body' });

  const entries = State.log.slice(0, 12).reverse();
  if (!entries.length) {
    body.appendChild(el('div', { class: 'empty', style: { padding: '20px 0' } }, [
      el('div', { class: 'empty-title', text: 'No log entries yet' }),
    ]));
  } else {
    const counts = entries.map((e) => (e.fresh || 0) + (e.changed || 0) + (e.identical || 0));
    const max = Math.max(1, ...counts);
    const spark = el('div', { class: 'spark' });
    for (const c of counts) {
      const h = Math.max(4, Math.round((c / max) * 100));
      spark.appendChild(el('div', {
        class: 'spark-bar',
        style: { height: h + '%' },
        title: c + ' file' + (c === 1 ? '' : 's'),
      }));
    }
    body.appendChild(spark);
    body.appendChild(el('div', {
      style: { marginTop: '8px', fontSize: 'var(--fs-2xs)', color: 'var(--faint)' },
      text: 'Oldest → newest · bar height = files touched per paste',
    }));
  }
  card.appendChild(body);
  return card;
}
