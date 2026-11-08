// Dashboard view — hero, stat tiles, recent activity, quick start.

import { el, clear } from '../utils/dom.js';
import { State, subscribe, getStats, getFileList, sortFiles } from '../core/state.js';
import { fmtBytes, fmtNum, fmtRelative, fmtTime, basename, dirname, extLabel, fileKind } from '../utils/format.js';
import { navigate } from '../ui/router.js';
import { openZipPicker } from '../ui/zip-flow.js';
import { downloadCurrentPack } from '../ui/commands.js';
import { openHelpModal } from '../ui/help-modal.js';

export function mountDashboard(root) {
  const shell = el('div', { class: 'view-inner' });
  root.appendChild(shell);

  function render() {
    clear(shell);
    shell.appendChild(buildHero());
    shell.appendChild(buildStats());
    shell.appendChild(buildColumns());
    shell.appendChild(buildFormatCard());
  }

  render();

  const unsub = subscribe((type) => {
    if (type === 'files' || type === 'log' || type === 'ingest' || type === 'settings') {
      render();
    }
  });

  return () => unsub();
}

function buildHero() {
  const stats = getStats();
  const hasFiles = stats.fileCount > 0;
  const hasFailures = stats.failed > 0;

  const hero = el('div', {
    style: {
      position: 'relative',
      padding: '28px 28px 26px',
      borderRadius: 'var(--r-lg)',
      border: '1px solid var(--line)',
      background: 'linear-gradient(160deg, color-mix(in srgb, var(--surface-2) 92%, transparent), color-mix(in srgb, var(--surface) 96%, transparent))',
      boxShadow: 'var(--shadow-1)',
      overflow: 'hidden',
    },
  });

  hero.appendChild(el('div', {
    'aria-hidden': 'true',
    style: {
      position: 'absolute',
      inset: 'auto -60px -80px auto',
      width: '340px',
      height: '340px',
      borderRadius: '50%',
      background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 22%, transparent), transparent 70%)',
      filter: 'blur(6px)',
      opacity: '0.7',
      pointerEvents: 'none',
    },
  }));

  hero.appendChild(el('div', {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: 'var(--fs-2xs)',
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: 'var(--accent)',
      padding: '4px 10px',
      border: '1px solid color-mix(in srgb, var(--accent) 32%, transparent)',
      borderRadius: 'var(--r-pill)',
      background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
      marginBottom: '14px',
    },
  }, [
    el('span', {
      style: {
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: 'var(--accent)',
        boxShadow: '0 0 8px var(--accent)',
      },
    }),
    el('span', { text: 'Project Packer · workspace' }),
  ]));

  hero.appendChild(el('h1', {
    style: {
      fontSize: 'var(--fs-3xl)',
      fontWeight: '600',
      letterSpacing: '-0.025em',
      lineHeight: '1.1',
      marginBottom: '10px',
      maxWidth: '640px',
    },
    html: hasFiles
      ? 'Your pack holds <span style="color: var(--accent);">' + fmtNum(stats.fileCount) + '</span> file' + (stats.fileCount === 1 ? '' : 's') + '.'
      : 'Paste file blocks. Ship a ZIP.',
  }));

  hero.appendChild(el('p', {
    style: {
      color: 'var(--muted)',
      fontSize: 'var(--fs-sm)',
      maxWidth: '580px',
      lineHeight: '1.7',
      marginBottom: '20px',
    },
    text: hasFailures
      ? stats.failed + ' file' + (stats.failed === 1 ? '' : 's') + ' need attention. Check the Log view for details, then use "Copy resend request".'
      : hasFiles
        ? 'Everything is packed and ready. Download the ZIP, or keep pasting more blocks — duplicates merge cleanly.'
        : 'Copy a message containing {[[FILE: …]]}…{[[END: …]]} blocks and press Ctrl+V anywhere on this page. Or drop a .zip file to unpack it.',
  }));

  const actions = el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } });
  actions.appendChild(el('button', {
    class: 'btn btn-primary btn-lg',
    type: 'button',
    onClick: () => hasFiles ? downloadCurrentPack() : openZipPicker(),
  }, [
    el('span', { class: 'btn-icon', html: hasFiles ? '⤓' : '⌘' }),
    el('span', { text: hasFiles ? 'Download .zip' : 'Get started' }),
  ]));
  actions.appendChild(el('button', {
    class: 'btn btn-lg',
    type: 'button',
    onClick: () => openZipPicker(),
  }, [
    el('span', { class: 'btn-icon', html: '⤒' }),
    el('span', { text: 'Load .zip → text' }),
  ]));
  actions.appendChild(el('button', {
    class: 'btn btn-ghost btn-lg',
    type: 'button',
    onClick: () => navigate('files'),
  }, [
    el('span', { class: 'btn-icon', html: '▤' }),
    el('span', { text: 'Browse files' }),
  ]));

  hero.appendChild(actions);
  return hero;
}

function buildStats() {
  const stats = getStats();
  const grid = el('div', { class: 'stat-grid' });

  grid.appendChild(statTile('Files packed', fmtNum(stats.fileCount), stats.fileCount === 1 ? 'file' : 'files', stats.failed ? 'bad' : 'accent', stats.failed ? stats.failed + ' failed' : 'all healthy'));
  grid.appendChild(statTile('Total size', fmtBytes(stats.totalBytes), '', '', stats.fileCount ? (stats.totalBytes > 0 ? '≈ ' + fmtNum(Math.round(stats.totalBytes / Math.max(1, stats.fileCount))) + ' B avg' : 'empty') : 'nothing yet'));
  grid.appendChild(statTile('Lines', fmtNum(stats.totalLines), '', '', stats.fileCount ? fmtNum(stats.totalLines) + ' total' : '—'));
  grid.appendChild(statTile('Pastes', fmtNum(stats.pastes), stats.pastes === 1 ? 'ingest' : 'ingests', '', stats.logEntries + ' log entries'));

  return grid;
}

function statTile(label, value, unit, variant, sub) {
  return el('div', { class: ['stat', variant || ''].filter(Boolean).join(' ') }, [
    el('div', { class: 'stat-label', text: label }),
    el('div', { class: 'stat-value', html: escapeText(value) + (unit ? '<small>' + escapeText(unit) + '</small>' : '') }),
    sub ? el('div', { class: 'stat-sub', text: sub }) : null,
  ]);
}

function escapeText(s) {
  return String(s).replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return ch;
    }
  });
}

function buildColumns() {
  const wrap = el('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)',
      gap: 'var(--sp-4)',
    },
  });

  const activity = el('section', { class: 'card' });
  activity.appendChild(el('div', { class: 'card-head' }, [
    el('div', { class: 'card-title' }, [el('span', { class: 'dot' }), el('span', { text: 'Recent activity' })]),
    el('button', {
      class: 'btn btn-ghost btn-sm',
      type: 'button',
      onClick: () => navigate('log'),
      text: 'View log →',
    }),
  ]));
  const activityBody = el('div', { class: 'card-body flush' });
  if (!State.log.length) {
    activityBody.appendChild(el('div', { class: 'empty' }, [
      el('div', { class: 'empty-icon', text: '≡' }),
      el('div', { class: 'empty-title', text: 'No pastes yet' }),
      el('div', { class: 'empty-sub', text: 'Paste a message with FILE/END blocks, or drop a ZIP anywhere on the page.' }),
    ]));
  } else {
    const list = el('div', { style: { display: 'flex', flexDirection: 'column' } });
    for (const entry of State.log.slice(0, 4)) {
      const row = el('div', {
        style: {
          padding: '10px 14px',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          gap: '10px',
          alignItems: 'baseline',
        },
      });
      row.appendChild(el('span', { class: 'log-n', text: '#' + entry.n }));
      row.appendChild(el('span', { class: 'log-time', text: entry.time instanceof Date ? fmtTime(entry.time) : '--' }));
      row.appendChild(el('span', {
        style: { fontSize: 'var(--fs-sm)', color: 'var(--ink-2)', flex: '1 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
        text: entry.source === 'zip'
          ? 'ZIP → text · ' + entry.fresh + ' files'
          : entry.fresh + ' new · ' + (entry.changed + entry.identical) + ' replaced',
      }));
      if (entry.errors) {
        row.appendChild(el('span', { class: 'badge badge-bad', text: entry.errors + ' error' + (entry.errors === 1 ? '' : 's') }));
      }
      list.appendChild(row);
    }
    activityBody.appendChild(list);
  }
  activity.appendChild(activityBody);

  const recent = el('section', { class: 'card' });
  recent.appendChild(el('div', { class: 'card-head' }, [
    el('div', { class: 'card-title' }, [el('span', { class: 'dot', style: { background: 'var(--accent-2)' } }), el('span', { text: 'Recent files' })]),
    el('button', {
      class: 'btn btn-ghost btn-sm',
      type: 'button',
      onClick: () => navigate('files'),
      text: 'All files →',
    }),
  ]));
  const recentBody = el('div', { class: 'card-body flush' });
  const files = sortFiles(getFileList()).slice(0, 5);
  if (!files.length) {
    recentBody.appendChild(el('div', { class: 'empty' }, [
      el('div', { class: 'empty-icon', text: '▤' }),
      el('div', { class: 'empty-title', text: 'No files packed' }),
      el('div', { class: 'empty-sub', text: 'Nothing has been ingested yet.' }),
    ]));
  } else {
    const list = el('div');
    for (const f of files) {
      list.appendChild(el('button', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          width: '100%',
          padding: '9px 14px',
          borderBottom: '1px solid var(--line)',
          textAlign: 'left',
          color: 'var(--ink-2)',
          background: 'transparent',
        },
        onMouseEnter: (e) => { e.currentTarget.style.background = 'var(--surface-hover)'; },
        onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent'; },
        onClick: () => navigate('editor', { path: f.path }),
      }, [
        el('span', {
          class: 'file-ext',
          dataset: { kind: fileKind(f.path) },
          text: extLabel(f.path),
        }),
        el('span', {
          style: { flex: '1 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--fs-sm)' },
          text: basename(f.path),
        }),
        el('span', {
          style: { fontSize: 'var(--fs-2xs)', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' },
          text: fmtBytes(f.bytes.length),
        }),
      ]));
    }
    recentBody.appendChild(list);
  }
  recent.appendChild(recentBody);

  wrap.appendChild(activity);
  wrap.appendChild(recent);
  return wrap;
}

function buildFormatCard() {
  const card = el('section', { class: 'card' });
  card.appendChild(el('div', { class: 'card-head' }, [
    el('div', { class: 'card-title' }, [el('span', { class: 'dot', style: { background: 'var(--accent-3)' } }), el('span', { text: 'Format reminder' })]),
    el('button', {
      class: 'btn btn-ghost btn-sm',
      type: 'button',
      onClick: () => openHelpModal(),
      text: 'Full reference →',
    }),
  ]));
  const body = el('div', { class: 'card-body' });
  body.appendChild(el('pre', { class: 'code-block', html:
    '<span class="m">{[[FILE: src/app.js]]}</span>\n' +
    'function main() {\n  return 42;\n}\n' +
    '<span class="m">{[[END: src/app.js]]}</span>\n\n' +
    '<span class="m">{[[FILE: styles/theme.css]]}</span>\n' +
    ':root { --bg: #07080a; }\n' +
    '<span class="m">{[[END: styles/theme.css]]}</span>'
  }));
  card.appendChild(body);
  return card;
}
