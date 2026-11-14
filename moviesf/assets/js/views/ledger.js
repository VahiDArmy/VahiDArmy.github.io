/* ============================================================================
   FULL METAL CINEMA — timeline, activity, people, awards
   four ledgers that read the same shelf from different angles
   ========================================================================== */

import {
  h, fmtDate, fmtRel, fmtDec, fmtNum, toast, field, openModal, confirmAction,
  emptyState, posterEl, sortBy, groupBy,
} from '../lib/dom.js';
import {
  state, rows, addRow, updateRow, removeRow, titleById, splitTags, computeStats,
} from '../lib/store.js';
import { navigate, titleCard, posterStrip } from './shared.js';

/* ========================================================================== */
/*  TIMELINE                                                                 */
/* ========================================================================== */
export function renderTimeline(root) {
  const titles = rows('titles').filter((t) => t.watched_date || t.created_at);
  const stats = computeStats(rows('titles'));

  root.appendChild(h('div', { class: 'viewhead' },
    h('div', { class: 'sect__num' }, '05'),
    h('div', {},
      h('h1', {}, 'Timeline'),
      h('div', { class: 'viewhead__sub' }, `${titles.length} logged events · ${stats.thisYear} this year`),
    ),
    h('div', { class: 'viewhead__tools' },
      h('button', { class: 'btn btn--ghost btn--sm', onClick: () => navigate('#/stats') }, 'Statistics'),
      h('button', { class: 'btn btn--primary btn--sm', onClick: () => navigate('#/library') }, 'Library'),
    ),
  ));

  if (!titles.length) {
    root.appendChild(emptyState({ glyph: '⌇', title: 'No dates', body: 'Give a dossier a watched date and it appears here, in order, forever.' }));
    return;
  }

  const byYear = new Map();
  titles.forEach((t) => {
    const raw = t.watched_date || t.created_at;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return;
    const y = d.getFullYear();
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push({ ...t, _d: d });
  });

  const tl = h('div', { class: 'timeline' });
  [...byYear.entries()].sort((a, b) => b[0] - a[0]).forEach(([year, list]) => {
    const sorted = sortBy(list, (t) => t._d.getTime(), -1);
    tl.appendChild(h('div', { class: 'tl-year' }, String(year),
      h('span', { class: 'mono dim', style: { fontSize: '11px', marginLeft: '10px', letterSpacing: '.1em' } },
        `${sorted.length} titles · avg ${fmtDec(list.reduce((a, t) => a + (Number(t.rating) || 0), 0) / Math.max(1, list.length), 1)}`),
    ));
    sorted.forEach((t) => {
      tl.appendChild(h('div', { class: 'tl-item', onClick: () => navigate(`#/title/${t.id}`) },
        h('div', { class: 'tl-item__date' }, fmtDate(t._d).slice(0, 6)),
        h('div', {},
          h('div', { class: 'tl-item__name' }, t.title),
          h('div', { class: 'tl-item__meta' }, [t.year, t.type, t.genre].filter(Boolean).join(' · ')),
        ),
        h('div', { class: `badge badge--${t.category}` }, `${fmtDec(t.rating, 1)}`),
      ));
    });
  });
  root.appendChild(tl);
}

/* ========================================================================== */
/*  ACTIVITY                                                                 */
/* ========================================================================== */
export function renderActivity(root) {
  const all = rows('activity');
  const filter = { action: '', range: 'all' };

  root.appendChild(h('div', { class: 'viewhead' },
    h('div', { class: 'sect__num' }, '08'),
    h('div', {},
      h('h1', {}, 'Activity'),
      h('div', { class: 'viewhead__sub' }, `${all.length} recorded operations · local and remote`),
    ),
    h('div', { class: 'viewhead__tools' },
      h('button', {
        class: 'btn btn--ghost btn--sm',
        onClick: async () => {
          const ok = await confirmAction({ title: 'Clear activity', body: 'The log is deleted. Dossiers are untouched.', ok: 'Clear log' });
          if (!ok) return;
          for (const a of all) await removeRow('activity', a.id).catch(() => {});
          toast('Activity cleared');
          navigate('#/activity');
        },
      }, 'Clear log'),
    ),
  ));

  const actions = [...new Set(all.map((a) => a.action))];
  const chipsRow = h('div', { class: 'filterbar__chips' });
  chipsRow.appendChild(h('button', { class: `chip ${!filter.action ? 'is-on' : ''}`, onClick: () => { filter.action = ''; paint(); } }, 'ALL'));
  actions.forEach((a) => chipsRow.appendChild(h('button', {
    class: `chip ${filter.action === a ? 'is-on' : ''}`,
    onClick: () => { filter.action = a; paint(); },
  }, a)));

  const host = h('div', {});
  root.appendChild(h('div', { class: 'filterbar' }, h('div', { class: 'filterbar__row' },
    h('span', { class: 'filterbar__label' }, 'Filter'), chipsRow)));
  root.appendChild(host);

  function paint() {
    const list = filter.action ? all.filter((a) => a.action === filter.action) : all;
    host.replaceChildren();
    if (!list.length) {
      host.appendChild(emptyState({ glyph: '≡', title: 'Nothing logged', body: 'Every create, edit, rating and AI call leaves a trace here.' }));
      return;
    }
    const byDay = new Map();
    list.slice(0, 400).forEach((a) => {
      const day = String(a.created_at || '').slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(a);
    });
    [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).forEach(([day, evs]) => {
      const head = h('div', { class: 'shelf__head', style: { marginTop: '16px' } },
        h('h2', {}, day === new Date().toISOString().slice(0, 10) ? 'TODAY' : fmtDate(day)),
        h('span', { class: 'count' }, String(evs.length)),
      );
      const rowsEl = h('div', { class: 'act' });
      for (const a of evs) {
        const what = a.entity_id && a.entity === 'title'
          ? h('a', {
            style: { cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '2px' },
            onClick: () => navigate(`#/title/${a.entity_id}`),
          }, a.detail || 'a title')
          : h('span', {}, a.detail || '');
        rowsEl.appendChild(h('div', { class: 'act__row' },
          h('div', { class: 'act__time' }, new Date(a.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })),
          h('div', { class: 'act__what' }, h('b', {}, a.action), ' ', what),
          h('div', { class: 'act__tag' }, a.entity || ''),
        ));
      }
      host.appendChild(head);
      host.appendChild(h('div', { class: 'panel' }, h('div', { class: 'panel__body panel__body--flush' }, rowsEl)));
    });
  }
  paint();
}

/* ========================================================================== */
/*  PEOPLE                                                                   */
/* ========================================================================== */
export function renderPeople(root) {
  const people = rows('people');
  const credits = rows('credits');

  root.appendChild(h('div', { class: 'viewhead' },
    h('div', { class: 'sect__num' }, '09'),
    h('div', {},
      h('h1', {}, 'People'),
      h('div', { class: 'viewhead__sub' }, `${people.length} names · ${credits.length} credits filed`),
    ),
    h('div', { class: 'viewhead__tools' },
      h('button', { class: 'btn btn--primary', onClick: () => addPerson() }, '＋ Add person'),
      h('button', { class: 'btn btn--ghost', onClick: () => navigate('#/library') }, 'Library'),
    ),
  ));

  if (!people.length) {
    root.appendChild(emptyState({
      glyph: '☖', title: 'Nobody filed',
      body: 'Directors, writers, composers. Follow one and every title they touch gets a marker.',
      action: h('button', { class: 'btn btn--primary', onClick: () => addPerson() }, '＋ Add person'),
    }));
    return;
  }

  const dirs = new Map();
  people.forEach((p) => {
    const list = credits.filter((c) => c.person_id === p.id).map((c) => titleById(c.title_id)).filter(Boolean);
    dirs.set(p.id, list);
  });

  const grid = h('div', { class: 'collgrid' });
  sortBy(people, (p) => (dirs.get(p.id) || []).length, -1).forEach((p) => {
    const list = dirs.get(p.id) || [];
    const avgScore = list.length ? list.reduce((a, t) => a + (Number(t.rating) || 0), 0) / list.length : 0;
    grid.appendChild(h('div', {
      class: 'coll', style: { cursor: 'pointer' },
      onClick: () => openPerson(p, list),
    },
    h('div', { class: 'coll__stripe', style: { background: p.following ? 'var(--accent)' : 'var(--line-2)' } }),
    h('div', { class: 'row' },
      h('div', { class: 'avatar' }, p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')),
      h('div', {},
        h('div', { class: 'coll__name', style: { fontSize: '17px' } }, p.name),
        h('div', { class: 'mono dim', style: { fontSize: '9.5px', letterSpacing: '.12em' } },
          [p.role, p.country, p.birth_year].filter(Boolean).join(' · ').toUpperCase()),
      ),
      h('span', { class: 'push' }),
      p.following ? h('span', { class: 'badge badge--fav' }, '★ FOLLOWING') : null,
    ),
    h('div', { class: 'row', style: { gap: '12px' } },
      h('div', { class: 'mono dim', style: { fontSize: '10px' } }, `${list.length} in archive`),
      list.length ? h('div', { class: 'mono', style: { fontSize: '10px', color: 'var(--accent)' } }, `avg ${fmtDec(avgScore, 1)}`) : null,
    ),
    h('div', { class: 'coll__stack' }, list.slice(0, 5).map((t) => posterEl(t, { small: true }))),
    ));
  });
  root.appendChild(grid);

  function addPerson() {
    const name = h('input', { class: 'input', placeholder: 'Stanley Kubrick' });
    const role = h('select', { class: 'select' }, ['director', 'writer', 'actor', 'composer', 'cinematographer', 'editor'].map((r) => h('option', { value: r }, r)));
    const country = h('input', { class: 'input', placeholder: 'USA' });
    const birth = h('input', { class: 'input', type: 'number', placeholder: '1928' });
    const modal = openModal({
      title: 'Add person',
      body: h('div', { class: 'form' },
        field('Name', name),
        h('div', { class: 'form__grid' }, field('Role', role), field('Country', country), field('Born', birth)),
      ),
      foot: h('div', { class: 'modal__foot' },
        h('div', { class: 'push' }),
        h('button', { class: 'btn btn--ghost', onClick: () => modal.close() }, 'Cancel'),
        h('button', {
          class: 'btn btn--primary',
          onClick: async () => {
            if (!name.value.trim()) { toast('Name required', 'warn'); return; }
            await addRow('people', { name: name.value.trim(), role: role.value, country: country.value, birth_year: Number(birth.value) || null, following: false });
            toast('Person filed');
            modal.close();
            navigate('#/people');
          },
        }, 'Save'),
      ),
    });
  }

  function openPerson(p, list) {
    const avgScore = list.length ? list.reduce((a, t) => a + (Number(t.rating) || 0), 0) / list.length : 0;
    const modal = openModal({
      title: p.name,
      wide: true,
      body: h('div', { class: 'col', style: { gap: '14px' } },
        h('div', { class: 'row', style: { gap: '14px', flexWrap: 'wrap' } },
          h('div', { class: 'avatar', style: { width: '54px', height: '54px', fontSize: '20px' } }, p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')),
          h('div', {},
            h('div', { class: 'mono dim' }, [p.role, p.country, p.birth_year].filter(Boolean).join(' · ')),
            h('div', { class: 'mono', style: { marginTop: '4px' } }, `${list.length} titles in archive · avg ${fmtDec(avgScore, 2)}`),
          ),
          h('span', { class: 'push' }),
          h('button', {
            class: 'btn btn--primary btn--sm',
            onClick: async () => {
              await updateRow('people', p.id, { following: !p.following });
              p.following = !p.following;
              toast(p.following ? 'Following' : 'Unfollowed');
              modal.close();
              navigate('#/people');
            },
          }, p.following ? '★ Following' : '☆ Follow'),
        ),
        list.length ? posterStrip(list, { max: 10 }) : h('div', { class: 'muted' }, 'No credits yet. Add one from a dossier.'),
      ),
    });
  }
}

/* ========================================================================== */
/*  AWARDS                                                                   */
/* ========================================================================== */
export function renderAwards(root) {
  const awards = rows('awards');
  const titles = rows('titles');

  root.appendChild(h('div', { class: 'viewhead' },
    h('div', { class: 'sect__num' }, '10'),
    h('div', {},
      h('h1', {}, 'Awards'),
      h('div', { class: 'viewhead__sub' }, `${awards.length} entries · ${awards.filter((a) => a.won).length} won`),
    ),
    h('div', { class: 'viewhead__tools' },
      h('button', { class: 'btn btn--primary', onClick: () => addAward() }, '＋ Record an award'),
    ),
  ));

  const grid = h('div', { class: 'statgrid' });
  const won = awards.filter((a) => a.won);
  grid.appendChild(h('div', { class: 'stat stat--accent' }, h('div', { class: 'stat__label' }, 'Wins'), h('div', { class: 'stat__value' }, String(won.length))));
  grid.appendChild(h('div', { class: 'stat' }, h('div', { class: 'stat__label' }, 'Nominations'), h('div', { class: 'stat__value' }, String(awards.length - won.length))));
  grid.appendChild(h('div', { class: 'stat' }, h('div', { class: 'stat__label' }, 'Bodies'), h('div', { class: 'stat__value' }, String(new Set(awards.map((a) => a.body)).size))));
  root.appendChild(grid);

  if (!awards.length) {
    root.appendChild(emptyState({
      glyph: '✪', title: 'No awards filed',
      body: 'Track the trophies you care about — or the ones you think were stolen. It is your archive; the record is yours to keep.',
      action: h('button', { class: 'btn btn--primary', onClick: () => addAward() }, '＋ Record an award'),
    }));
    return;
  }

  root.appendChild(h('div', { class: 'panel' },
    h('div', { class: 'panel__head' }, h('h2', {}, 'Record')),
    h('div', { class: 'panel__body panel__body--flush', style: { overflowX: 'auto' } },
      h('table', { class: 'table table--tight' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Year'), h('th', {}, 'Body'), h('th', {}, 'Category'), h('th', {}, 'Title'), h('th', {}, 'Result'), h('th', {}, ''))),
        h('tbody', {}, sortBy(awards, (a) => Number(a.year) || 0, -1).map((a) => {
          const t = titleById(a.title_id);
          return h('tr', {},
            h('td', { class: 'mono' }, String(a.year || '—')),
            h('td', { class: 'mono dim' }, a.body || '—'),
            h('td', {}, a.category || '—'),
            h('td', {}, t ? h('a', { style: { cursor: 'pointer', textDecoration: 'underline' }, onClick: () => navigate(`#/title/${t.id}`) }, t.title) : '—'),
            h('td', {}, a.won ? h('span', { class: 'badge badge--good' }, 'WON') : h('span', { class: 'badge badge--soft' }, 'NOMINATED')),
            h('td', {}, h('button', { class: 'iconbtn', onClick: async () => { await removeRow('awards', a.id); navigate('#/awards'); } }, '✕')),
          );
        })),
      ),
    ),
  ));

  function addAward() {
    const tSel = h('select', { class: 'select' }, h('option', { value: '' }, '— title —'), titles.map((t) => h('option', { value: t.id }, t.title)));
    const body = h('input', { class: 'input', placeholder: 'Academy / Cannes / your own' });
    const cat = h('input', { class: 'input', placeholder: 'Best Picture' });
    const year = h('input', { class: 'input', type: 'number', placeholder: String(new Date().getFullYear()) });
    const won = h('input', { type: 'checkbox', checked: true });
    const modal = openModal({
      title: 'Record an award',
      body: h('div', { class: 'form' },
        field('Title', tSel),
        h('div', { class: 'form__grid' }, field('Body', body), field('Category', cat), field('Year', year)),
        h('label', { class: 'check' }, won, h('span', {}, 'It won (otherwise a nomination)')),
      ),
      foot: h('div', { class: 'modal__foot' },
        h('div', { class: 'push' }),
        h('button', { class: 'btn btn--ghost', onClick: () => modal.close() }, 'Cancel'),
        h('button', {
          class: 'btn btn--primary',
          onClick: async () => {
            await addRow('awards', { title_id: tSel.value || null, body: body.value, category: cat.value, year: Number(year.value) || null, won: won.checked });
            toast('Award recorded');
            modal.close();
            navigate('#/awards');
          },
        }, 'Save'),
      ),
    });
  }
}

/* ========================================================================== */
/*  ABOUT / FIELD MANUAL                                                     */
/* ========================================================================== */
export function renderAbout(root) {
  root.appendChild(h('div', { class: 'lib-hero', style: { minHeight: 'auto' } },
    h('div', { class: 'lib-hero__body' },
      h('div', { class: 'lib-hero__kicker' }, 'SECTOR 00 — FIELD MANUAL'),
      h('h1', {}, 'Read the', h('br'), h('em', {}, 'manual'), '.'),
      h('p', {}, 'This is a private archive. It has no analytics, no telemetry, no social feed and no recommendation service. Every number is computed in your browser from rows you own.'),
    ),
    h('div', { class: 'lib-hero__art' }, [
      ['01', 'The shelf'], ['02', 'The dossier'], ['03', 'The ledger'],
    ].map(([n, label]) => h('div', { style: { display: 'grid', placeItems: 'center', background: 'var(--bg-2)', borderRight: '1px solid var(--line)' } },
      h('div', { style: { textAlign: 'center' } },
        h('div', { style: { fontFamily: 'var(--font-display)', fontSize: '40px', fontWeight: '900', color: 'var(--ink-4)' } }, n),
        h('div', { class: 'mono dim', style: { fontSize: '9px', letterSpacing: '.2em' } }, label.toUpperCase()),
      )))),
  ));

  const secs = [
    {
      title: 'Keyboard', rows: [
        ['⌘K / Ctrl+K', 'Command deck'],
        ['N', 'New dossier'],
        ['A', 'AI studio'],
        ['T', 'Cycle theatre (theme)'],
        ['/', 'Focus search'],
        ['?', 'This manual'],
        ['G then L', 'Go to library'],
        ['G then S', 'Go to statistics'],
        ['Esc', 'Close overlay'],
      ],
    },
    {
      title: 'Where the data lives', rows: [
        ['cinema_titles', 'One row per title. Everything else references it.'],
        ['cinema_ratings', 'Six criteria and a review per title.'],
        ['cinema_watchlist', 'The queue, with priority and notes.'],
        ['cinema_collections', 'Your racks and their membership.'],
        ['cinema_watch_sessions', 'Individual sittings, mood and device.'],
        ['cinema_ai_models', 'The arena ledger with wins and losses.'],
        ['cinema_conversations', 'Saved machine exchanges.'],
        ['cinema_activity', 'Everything you did, in order.'],
      ],
    },
    {
      title: 'The AI rule', rows: [
        ['Local key', 'Stored in this browser. Never written to Supabase.'],
        ['Streaming', 'Tokens arrive as produced, through fetch.'],
        ['Reasoning', 'Shown in its own pane when the model exposes it.'],
        ['No edge function', 'The browser talks to the provider directly.'],
        ['Edge fallback', 'Optional, off by default, never required.'],
        ['Your cost', 'You pay the provider, not a middleman.'],
      ],
    },
  ];

  const grid = h('div', { class: 'chartgrid' });
  secs.forEach((s) => {
    grid.appendChild(h('div', { class: 'panel span-4' },
      h('div', { class: 'panel__head' }, h('h2', {}, s.title)),
      h('div', { class: 'panel__body panel__body--flush' },
        h('table', { class: 'table table--tight' },
          h('tbody', {}, s.rows.map(([k, v]) => h('tr', {},
            h('td', { class: 'mono', style: { color: 'var(--accent)', whiteSpace: 'nowrap', width: '44%' } }, k),
            h('td', {}, v),
          )))),
      ),
    ));
  });
  root.appendChild(h('div', { style: { height: '16px' } }));
  root.appendChild(grid);
}
