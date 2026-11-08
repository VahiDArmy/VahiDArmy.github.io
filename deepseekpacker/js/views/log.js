// Log view — full ingest history with copy/export actions.

import { el, clear, copyToClipboard } from '../utils/dom.js';
import { State, subscribe } from '../core/state.js';
import { fmtNum, fmtTime } from '../utils/format.js';
import { headerLine, entryText, logText, resendText, logAsJson } from '../core/log.js';
import { downloadText } from '../ui/download.js';
import { toast, toastOk, toastWarn } from '../ui/toast.js';
import { navigate } from '../ui/router.js';
import { setStatusMessage } from '../ui/statusbar.js';

export function mountLog(root) {
  const shell = el('div', { class: 'view-inner' });
  root.appendChild(shell);

  const head = el('div', { class: 'view-head' });
  const headActions = el('div', { class: 'view-actions' });

  const card = el('section', { class: 'card' });
  const cardHead = el('div', { class: 'card-head' });
  const cardBody = el('div', { class: 'card-body flush' });
  card.appendChild(cardHead);
  card.appendChild(cardBody);

  shell.appendChild(head);
  shell.appendChild(card);

  function render() {
    clear(head);
    clear(headActions);
    clear(cardHead);
    clear(cardBody);

    head.appendChild(el('div', { class: 'view-title' }, [
      el('h1', { text: 'Log' }),
      el('p', {
        text: State.log.length
          ? State.log.length + ' entr' + (State.log.length === 1 ? 'y' : 'ies') + ' — newest first'
          : 'No pastes ingested yet',
      }),
    ]));

    headActions.appendChild(el('button', {
      class: 'btn',
      type: 'button',
      disabled: !State.log.length,
      onClick: async () => {
        if (!State.log.length) return;
        const ok = await copyToClipboard(logText());
        toastOk(ok ? 'Log copied' : 'Copy failed');
      },
      text: '⎘ Copy log',
    }));
    headActions.appendChild(el('button', {
      class: 'btn',
      type: 'button',
      disabled: State.failures.size === 0,
      onClick: async () => {
        if (!State.failures.size) return;
        const ok = await copyToClipboard(resendText());
        toastOk(ok ? 'Resend request copied' : 'Copy failed');
      },
      text: '⇄ Copy resend',
    }));
    headActions.appendChild(el('button', {
      class: 'btn',
      type: 'button',
      disabled: !State.log.length,
      onClick: () => {
        downloadText(logAsJson(), 'project-pack-log.json');
        toastOk('Downloaded project-pack-log.json');
      },
      text: '⤓ Export JSON',
    }));
    head.appendChild(headActions);

    cardHead.appendChild(el('div', { class: 'card-title' }, [
      el('span', { class: 'dot' }),
      el('span', { text: 'Ingest history' }),
    ]));
    cardHead.appendChild(el('span', {
      class: 'meta',
      style: { fontSize: 'var(--fs-2xs)', color: 'var(--faint)' },
      text: 'newest first',
    }));

    if (!State.log.length) {
      cardBody.appendChild(buildEmpty());
      return;
    }

    for (const entry of State.log) {
      cardBody.appendChild(buildEntry(entry));
    }
  }

  render();

  const unsub = subscribe((type) => {
    if (type === 'log' || type === 'files') {
      render();
    }
  });

  return () => unsub();
}

function buildEntry(entry) {
  const wrap = el('div', { class: 'log-entry' });

  const head = el('div', { class: 'log-head' });
  head.appendChild(el('span', { class: 'log-n', text: '#' + entry.n }));
  head.appendChild(el('span', { class: 'log-time', text: entry.time instanceof Date ? fmtTime(entry.time) : '--' }));
  if (entry.source === 'zip') {
    head.appendChild(el('span', { class: 'badge badge-accent', text: 'ZIP → text' }));
  } else {
    head.appendChild(el('span', { class: 'badge', text: 'paste' }));
  }

  const stats = el('div', { class: 'log-stats' });
  stats.appendChild(el('span', { class: 's-new', text: entry.fresh + ' new' }));
  const replaced = (entry.changed || 0) + (entry.identical || 0);
  if (replaced) {
    stats.appendChild(el('span', { text: '·' }));
    stats.appendChild(el('span', { class: 's-changed', text: entry.changed + ' changed' }));
    stats.appendChild(el('span', { text: '·' }));
    stats.appendChild(el('span', { class: 's-same', text: entry.identical + ' identical' }));
  }
  if (entry.errors) {
    stats.appendChild(el('span', { text: '·' }));
    stats.appendChild(el('span', { class: 's-err', text: entry.errors + ' error' + (entry.errors === 1 ? '' : 's') }));
  }
  head.appendChild(stats);
  wrap.appendChild(head);

  if (entry.notes && entry.notes.length) {
    const notes = el('div', { class: 'log-notes' });
    for (const note of entry.notes) {
      const kind = note.kind;
      const cls = (kind === 'truncated' || kind === 'corrupt' || kind === 'nomarkers') ? 'is-bad'
        : kind === 'outside' ? 'is-dim'
        : kind === 'duplicate' || kind === 'empty' ? 'is-warn'
        : '';
      const row = el('div', { class: 'note ' + cls });
      row.appendChild(el('span', { class: 'n-ico', html: iconFor(kind) }));
      row.appendChild(el('span', { text: note.text }));
      notes.appendChild(row);
      if (note.excerpt !== null && note.excerpt !== undefined) {
        notes.appendChild(el('div', { class: 'note-excerpt', text: '"' + note.excerpt + '"' }));
      }
    }
    wrap.appendChild(notes);
  }

  return wrap;
}

function iconFor(kind) {
  switch (kind) {
    case 'truncated': return '✂';
    case 'corrupt': return '!';
    case 'duplicate': return '⇋';
    case 'nomarkers': return '?';
    case 'outside': return '·';
    case 'empty': return '∅';
    default: return '·';
  }
}

function buildEmpty() {
  return el('div', { class: 'empty' }, [
    el('div', { class: 'empty-icon', html: '≡' }),
    el('div', { class: 'empty-title', text: 'No pastes recorded yet' }),
    el('div', { class: 'empty-sub', text: 'Paste a message with FILE/END blocks anywhere on the page. Every paste is logged here with its summary.' }),
    el('div', { class: 'empty-actions' }, [
      el('button', {
        class: 'btn btn-primary',
        type: 'button',
        onClick: () => navigate('dashboard'),
      }, ['Back to dashboard']),
      el('button', {
        class: 'btn',
        type: 'button',
        onClick: () => navigate('help'),
      }, ['Format & help']),
    ]),
  ]);
}
