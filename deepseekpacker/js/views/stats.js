// Insights view — charts, bars, top files.

import { el, clear } from '../utils/dom.js';
import { State, subscribe, getStats, getFileList, sortFiles } from '../core/state.js';
import { fmtBytes, fmtNum } from '../utils/format.js';
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
    shell.appendChild(buildLargest(stats));
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
  return el('div', { class: 'stat' }, [
    el('div', { class: 'stat-label', text: label }),
    el('div', { class: `stat-value ${variant}`.trim(), text: value }),
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

function barRow(label, value, total, cls) {
  const pct = total ? (value / total) * 100 : 0;
  const row = el('div', { style: { display: 'grid', gridTemplateColumns: '80px 1fr 30px', alignItems: 'center', gap: '12px', fontSize: '12px', marginBottom: '8px' } });
  
  row.appendChild(el('div', { style: { color: 'var(--muted)' }, text: label }));
  
  const track = el('div', { style: { height: '8px', background: 'var(--surface-3)', borderRadius: '4px', overflow: 'hidden' } });
  track.appendChild(el('div', {
    style: { 
      height: '100%', 
      width: `${Math.max(1.5, pct)}%`, 
      background: cls === 'bad' ? 'var(--bad)' : cls === 'warn' ? 'var(--warn)' : 'var(--accent)',
      borderRadius: '4px'
    },
  }));
  row.appendChild(track);
  
  row.appendChild(el('div', { style: { textAlign: 'right', color: 'var(--ink-2)' }, text: String(value) }));
  
  return row;
}

function buildLargest(stats) {
  const card = el('section', { class: 'card' });
  card.appendChild(el('div', { class: 'card-head' }, [
    el('div', { class: 'card-title' }, [el('span', { class: 'dot', style: { background: 'var(--accent-3)' } }), el('span', { text: 'Largest files' })]),
  ]));
  const body = el('div', { class: 'card-body flush' });
  const files = sortFiles(getFileList()).sort((a, b) => b.bytes.length - a.bytes.length).slice(0, 8);
  
  if (!files.length) {
    body.appendChild(el('div', { class: 'empty', style: { padding: '20px 0' } }, [
      el('div', { class: 'empty-title', text: 'No files packed' }),
    ]));
  } else {
    const list = el('div');
    for (const f of files) {
      const row = el('div', { style: { display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--line)', fontSize: '13px' } });
      row.appendChild(el('div', { style: { color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, text: f.path }));
      row.appendChild(el('div', { style: { color: 'var(--muted)', flex: '0 0 auto', marginLeft: '12px' }, text: fmtBytes(f.bytes.length) }));
      list.appendChild(row);
    }
    body.appendChild(list);
  }
  card.appendChild(body);
  return card;
}
