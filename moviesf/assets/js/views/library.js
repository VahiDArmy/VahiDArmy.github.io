/* ============================================================================
   FULL METAL CINEMA — library
   the shelf: hero, filter deck, poster wall, ledger view, bulk operations
   ========================================================================== */

import {
  h, fmtNum, fmtDec, posterEl, emptyState, chips, toast, confirmAction,
  download, toCsv, fmtDate, skeletonGrid, debounce, sortBy, avg,
} from '../lib/dom.js';
import {
  state, rows, computeStats, applyTheme, savePrefs, affinity, toggleFavorite,
  deleteTitle, splitTags, titleById, logActivity,
} from '../lib/store.js';
import { CATEGORIES, TYPES, STATUSES, GENRES } from '../config.js';
import { navigate, titleCard, openEditor, openQuickLog } from './shared.js';

let page = 1;

export function renderLibrary(root, params = {}) {
  const all = rows('titles');
  const stats = computeStats(all);
  const f = readFilters(params);
  page = Number(params.page) || 1;

  root.appendChild(h('div', { class: 'lib-hero' },
    h('div', { class: 'lib-hero__body' },
      h('div', { class: 'lib-hero__kicker' }, 'SECTOR 01 — THE SHELF'),
      h('h1', {}, 'Your ', h('em', {}, 'archive'), ',', h('br'), 'sir.'),
      h('p', {}, `${stats.total} dossiers. ${stats.loved} you defend, ${stats.hated} you regret, ${stats.favorites} you keep forever. Every number on this page is computed from your own rows.`),
      h('div', { class: 'lib-hero__figures' },
        fig(stats.total, 'dossiers'),
        fig(stats.loved, 'loved'),
        fig(fmtDec(stats.avgRating, 1), 'avg score'),
        fig(`${stats.hours}h`, 'on screen'),
      ),
      h('div', { class: 'form__row', style: { marginTop: '20px' } },
        h('button', { class: 'btn btn--primary', onClick: () => openEditor({}) }, '＋ New dossier'),
        h('button', { class: 'btn', onClick: () => openQuickLog() }, 'Quick log'),
        h('button', { class: 'btn btn--ghost', onClick: () => navigate('#/stats') }, 'Statistics →'),
      ),
    ),
    h('div', { class: 'lib-hero__art' },
      sortBy(all, (t) => Number(t.rating) || 0, -1).slice(0, 3).map((t) => h('div', {}, posterEl(t))),
    ),
  ));

  /* ---------- filter deck ---------- */
  const results = h('div', { id: 'libResults' });
  const countEl = h('span', { class: 'mono dim' }, '');

  const search = h('input', {
    class: 'input', type: 'search', value: f.q, placeholder: 'Filter this shelf — title, note, tag, analysis…',
    onInput: debounce((e) => { f.q = e.target.value; page = 1; paint(); }, 180),
  });

  const sortSel = h('select', {
    class: 'select', style: { width: 'auto', minWidth: '150px' },
    onChange: (e) => { f.sort = e.target.value; page = 1; paint(); },
  }, [
    ['recent', 'Newest first'], ['oldest', 'Oldest first'], ['score', 'Highest score'],
    ['lowscore', 'Lowest score'], ['title', 'Title A→Z'], ['year', 'Release year'],
    ['watched', 'Date watched'], ['affinity', 'Best match'], ['random', 'Shuffle'],
  ].map(([v, l]) => h('option', { value: v, selected: f.sort === v }, l)));

  const catChips = chips(CATEGORIES.map((c) => ({ id: c.id, label: `${c.glyph} ${c.label}` })), {
    active: f.cats, onToggle: (v) => { f.cats = v; page = 1; paint(); },
  });
  const typeChips = chips(TYPES.map((t) => ({ id: t.id, label: t.label })), {
    active: f.types, onToggle: (v) => { f.types = v; page = 1; paint(); },
  });
  const statusChips = chips(STATUSES.map((t) => ({ id: t.id, label: t.label })), {
    active: f.statuses, onToggle: (v) => { f.statuses = v; page = 1; paint(); },
  });

  const genreSel = h('select', {
    class: 'select', style: { width: 'auto' },
    onChange: (e) => { f.genre = e.target.value; page = 1; paint(); },
  }, h('option', { value: '' }, 'any genre'),
  [...new Set([...GENRES, ...all.flatMap((t) => splitTags(t.genre))])].sort()
    .map((g) => h('option', { value: g, selected: f.genre === g }, g)));

  const countrySel = h('select', {
    class: 'select', style: { width: 'auto' },
    onChange: (e) => { f.country = e.target.value; page = 1; paint(); },
  }, h('option', { value: '' }, 'any country'),
  [...new Set(all.flatMap((t) => splitTags(t.country)))].sort()
    .map((c) => h('option', { value: c, selected: f.country === c }, c)));

  const minScore = h('input', {
    class: 'range', type: 'range', min: '0', max: '10', step: '0.5', value: String(f.minScore),
    style: { maxWidth: '140px' },
    onInput: (e) => { f.minScore = Number(e.target.value); e.target.nextSibling.textContent = `≥ ${fmtDec(f.minScore, 1)}`; page = 1; paint(); },
  });
  const minScoreLabel = h('span', { class: 'mono dim' }, `≥ ${fmtDec(f.minScore, 1)}`);

  const favToggle = h('button', {
    class: `chip ${f.fav ? 'is-on' : ''}`, onClick: (e) => {
      f.fav = !f.fav; e.currentTarget.classList.toggle('is-on'); page = 1; paint();
    },
  }, '★ Starred only');

  const notesToggle = h('button', {
    class: `chip ${f.hasNotes ? 'is-on' : ''}`, onClick: (e) => {
      f.hasNotes = !f.hasNotes; e.currentTarget.classList.toggle('is-on'); page = 1; paint();
    },
  }, '✎ Has notes');

  const aiToggle = h('button', {
    class: `chip ${f.hasAnalysis ? 'is-on' : ''}`, onClick: (e) => {
      f.hasAnalysis = !f.hasAnalysis; e.currentTarget.classList.toggle('is-on'); page = 1; paint();
    },
  }, '✦ Analysed');

  const densityBtn = h('button', {
    class: 'iconbtn', title: 'Grid density',
    onClick: () => {
      const order = ['dense', 'regular', 'roomy'];
      const next = order[(order.indexOf(state.prefs.gridDensity) + 1) % order.length];
      savePrefs({ gridDensity: next });
      paint();
    },
  }, '▦');

  const viewBtn = h('button', {
    class: 'iconbtn', title: 'Cards / ledger',
    onClick: () => { f.mode = f.mode === 'list' ? 'cards' : 'list'; paint(); },
  }, '☰');

  const clearBtn = h('button', {
    class: 'btn btn--ghost btn--sm',
    onClick: () => { resetFilters(f); navigate('#/library'); },
  }, 'Reset');

  root.appendChild(h('div', { class: 'filterbar' },
    h('div', { class: 'filterbar__row' },
      h('span', { class: 'filterbar__label' }, 'Find'),
      search,
      clearBtn,
      h('div', { class: 'filterbar__sort' }, countEl, sortSel, densityBtn, viewBtn),
    ),
    h('div', { class: 'filterbar__row' },
      h('span', { class: 'filterbar__label' }, 'Verdict'), catChips,
    ),
    h('div', { class: 'filterbar__row' },
      h('span', { class: 'filterbar__label' }, 'Format'), typeChips,
    ),
    h('div', { class: 'filterbar__row' },
      h('span', { class: 'filterbar__label' }, 'Status'), statusChips,
    ),
    h('div', { class: 'filterbar__row' },
      h('span', { class: 'filterbar__label' }, 'Narrow'),
      genreSel, countrySel,
      h('div', { class: 'rangebox' }, minScoreLabel, minScore),
      favToggle, notesToggle, aiToggle,
    ),
  ));

  root.appendChild(results);

  /* ---------- paint ---------- */
  function paint() {
    const list = applyFilters(all, f);
    countEl.textContent = `${fmtNum(list.length)} / ${fmtNum(all.length)}`;
    results.replaceChildren();

    if (!list.length) {
      results.appendChild(emptyState({
        glyph: '∅',
        title: all.length ? 'No dossiers match that order' : 'The shelf is empty',
        body: all.length ? 'Loosen a filter or reset the deck.' : 'Log the first thing you watched. The statistics stay useless until you do.',
        action: h('button', { class: 'btn btn--primary', onClick: () => openEditor({}) }, '＋ New dossier'),
      }));
      return;
    }

    const perPage = state.prefs.pageSize || 60;
    const visible = f.mode === 'list' ? list.slice(0, page * 200) : list.slice(0, page * perPage);

    if (f.mode === 'cards') {
      const grid = h('div', { class: `grid-posters ${state.prefs.gridDensity === 'dense' ? 'grid-posters--dense' : state.prefs.gridDensity === 'roomy' ? 'grid-posters--roomy' : ''}` });
      visible.forEach((t) => grid.appendChild(titleCard(t)));
      results.appendChild(grid);
    } else {
      results.appendChild(ledgerTable(list, f));
      return;
    }

    if (visible.length < list.length) {
      results.appendChild(h('div', { style: { display: 'grid', placeItems: 'center', marginTop: '24px' } },
        h('button', {
          class: 'btn btn--block', style: { maxWidth: '280px' },
          onClick: () => { page += 1; paint(); },
        }, `Load more (${list.length - visible.length} left)`),
      ));
    }
  }

  paint();
  return { rerender: paint };
}

function fig(value, label) {
  return h('div', { class: 'hero-fig' }, h('b', {}, String(value)), h('span', {}, label));
}

/* ---------- filter state ------------------------------------------------ */
function readFilters(params) {
  return {
    q: params.q || '',
    cats: params.cat ? String(params.cat).split(',') : [],
    types: params.type ? String(params.type).split(',') : [],
    statuses: params.status ? String(params.status).split(',') : [],
    genre: params.genre || '',
    country: params.country || '',
    minScore: Number(params.min || 0),
    fav: params.fav === '1',
    hasNotes: params.notes === '1',
    hasAnalysis: params.ai === '1',
    sort: params.sort || 'recent',
    mode: params.mode === 'list' ? 'list' : 'cards',
    year: params.year || '',
  };
}
function resetFilters(f) {
  Object.assign(f, {
    q: '', cats: [], types: [], statuses: [], genre: '', country: '',
    minScore: 0, fav: false, hasNotes: false, hasAnalysis: false, sort: 'recent', mode: 'cards', year: '',
  });
}

export function applyFilters(list, f) {
  let out = list.filter((t) => {
    if (f.cats.length && !f.cats.includes(t.category)) return false;
    if (f.types.length && !f.types.includes(t.type)) return false;
    if (f.statuses.length && !f.statuses.includes(t.status || 'watched')) return false;
    if (f.genre && !splitTags(t.genre).includes(f.genre)) return false;
    if (f.country && !splitTags(t.country).includes(f.country)) return false;
    if (f.minScore && (Number(t.rating) || 0) < f.minScore) return false;
    if (f.fav && !t.favorite) return false;
    if (f.hasNotes && !(t.notes && t.notes.trim())) return false;
    if (f.hasAnalysis && !(t.story_analysis && t.story_analysis.trim())) return false;
    if (f.year && String(t.year) !== String(f.year)) return false;
    if (f.q) {
      const hay = [t.title, t.original_title, t.genre, t.country, t.tags, t.notes, t.summary,
        t.story_analysis, t.reason, t.language, t.year, t.type, t.category].join(' ').toLowerCase();
      const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean);
      if (!terms.every((term) => hay.includes(term))) return false;
    }
    return true;
  });

  switch (f.sort) {
    case 'oldest': out = sortBy(out, (t) => t.created_at || '', 1); break;
    case 'score': out = sortBy(out, (t) => Number(t.rating) || 0, -1); break;
    case 'lowscore': out = sortBy(out, (t) => Number(t.rating) || 0, 1); break;
    case 'title': out = sortBy(out, (t) => (t.title || '').toLowerCase(), 1); break;
    case 'year': out = sortBy(out, (t) => Number(t.year) || 0, -1); break;
    case 'watched': out = sortBy(out, (t) => t.watched_date || '', -1); break;
    case 'affinity': out = sortBy(out, (t) => affinity(t), -1); break;
    case 'random': out = [...out].sort(() => Math.random() - 0.5); break;
    default: out = sortBy(out, (t) => t.created_at || '', -1);
  }
  return out;
}

/* ---------- ledger (list) view ----------------------------------------- */
function ledgerTable(list, f) {
  const selected = state.ui.selection;
  const wrap = h('div', { class: 'panel' });
  const head = h('div', { class: 'panel__head' },
    h('h2', {}, 'Ledger'),
    h('span', { class: 'mono dim' }, `${list.length} rows`),
    h('div', { class: 'panel__tools' },
      h('button', {
        class: 'btn btn--ghost btn--sm',
        onClick: () => {
          const rowsOut = list.map((t) => ({
            title: t.title, category: t.category, type: t.type, year: t.year,
            rating: t.rating, genre: t.genre, country: t.country, status: t.status,
            watched_date: t.watched_date, tags: t.tags, favorite: t.favorite,
          }));
          download(`fmc-library-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rowsOut), 'text/csv');
        },
      }, 'Export CSV'),
      h('button', {
        class: 'btn btn--ghost btn--sm',
        onClick: async () => {
          const ids = [...selected];
          if (!ids.length) { toast('Nothing selected', 'warn'); return; }
          const ok = await confirmAction({ title: `Star ${ids.length} titles`, body: 'They will be marked as keepers.', ok: 'Star all', danger: false });
          if (!ok) return;
          for (const id of ids) await toggleFavorite(id).catch(() => {});
          selected.clear();
          toast('Starred');
          navigate('#/library');
        },
      }, 'Bulk star'),
      h('button', {
        class: 'btn btn--danger btn--sm',
        onClick: async () => {
          const ids = [...selected];
          if (!ids.length) { toast('Nothing selected', 'warn'); return; }
          const ok = await confirmAction({ title: `Delete ${ids.length} dossiers`, body: 'This cannot be undone.', ok: 'Delete all' });
          if (!ok) return;
          for (const id of ids) await deleteTitle(id).catch(() => {});
          selected.clear();
          toast('Deleted');
          navigate('#/library');
        },
      }, 'Bulk delete'),
    ),
  );
  wrap.appendChild(head);

  const table = h('table', { class: 'table table--tight' },
    h('thead', {}, h('tr', {},
      h('th', {}, ''), h('th', {}, 'Title'), h('th', {}, 'Verdict'), h('th', {}, 'Format'),
      h('th', {}, 'Year'), h('th', {}, 'Score'), h('th', {}, 'Status'),
      h('th', {}, 'Watched'), h('th', {}, 'Tags'), h('th', {}, ''),
    )),
    h('tbody', {}, list.map((t) => h('tr', {},
      h('td', {}, h('input', {
        type: 'checkbox', checked: selected.has(t.id),
        onChange: (e) => { if (e.target.checked) selected.add(t.id); else selected.delete(t.id); },
      })),
      h('td', {},
        h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer' }, onClick: () => navigate(`#/title/${t.id}`) },
          h('div', { style: { width: '26px', flex: '0 0 auto' } }, posterEl(t, { small: true })),
          h('div', {},
            h('div', { style: { textTransform: 'uppercase', letterSpacing: '.03em' } }, t.title),
            t.original_title ? h('div', { class: 'mono dim', style: { fontSize: '9.5px' } }, t.original_title) : null,
          ),
        ),
      ),
      h('td', {}, h('span', { class: `badge badge--${t.category}` }, t.category)),
      h('td', { class: 'mono' }, t.type),
      h('td', { class: 'mono' }, t.year || '—'),
      h('td', { class: 'table__num', style: { color: Number(t.rating) >= 8 ? 'var(--accent)' : 'inherit' } }, fmtDec(t.rating, 1)),
      h('td', { class: 'mono dim' }, t.status || 'watched'),
      h('td', { class: 'mono dim' }, t.watched_date ? fmtDate(t.watched_date) : '—'),
      h('td', {}, h('div', { class: 'pillrow' }, splitTags(t.tags).slice(0, 3).map((tag) => h('span', { class: 'chip chip--static' }, tag)))),
      h('td', {}, h('button', {
        class: 'iconbtn', title: 'Edit', onClick: () => openEditor({ title: t }),
      }, '✎')),
    ))),
  );
  wrap.appendChild(h('div', { class: 'panel__body panel__body--flush', style: { overflowX: 'auto' } }, table));
  return wrap;
}

/* ---------- standalone watchlist view ---------------------------------- */
export function renderWatchlist(root) {
  const wl = rows('watchlist').filter((w) => !w.done);
  const items = wl.map((w) => ({ ...titleById(w.title_id), _entry: w })).filter((t) => t.id);

  root.appendChild(h('div', { class: 'viewhead' },
    h('div', { class: 'sect__num' }, '02'),
    h('div', {},
      h('h1', {}, 'Watchlist'),
      h('div', { class: 'viewhead__sub' }, `${items.length} queued · sorted by priority and shelf affinity`),
    ),
    h('div', { class: 'viewhead__tools' },
      h('button', { class: 'btn btn--primary', onClick: () => openEditor({ preset: { status: 'planned' } }) }, '＋ Queue a title'),
      h('button', { class: 'btn', onClick: () => navigate('#/library') }, 'Library'),
    ),
  ));

  if (!items.length) {
    root.appendChild(emptyState({
      glyph: '▢',
      title: 'The queue is empty',
      body: 'Add titles you intend to watch. The list reorders itself by how closely each one matches the shelf you love.',
      action: h('button', { class: 'btn btn--primary', onClick: () => navigate('#/library') }, 'Pick from the library'),
    }));
    return;
  }

  const sorted = sortBy(items, (t) => (Number(t._entry.priority) || 0) * 2 + affinity(t), -1);
  const cols = h('div', { class: 'grid-posters' });
  sorted.forEach((t) => {
    const entry = t._entry;
    const card = h('article', { class: 'card card--title', onClick: (e) => { if (!e.target.closest('button')) navigate(`#/title/${t.id}`); } },
      posterEl(t),
      h('div', { style: { padding: '8px', display: 'grid', gap: '6px' } },
        h('div', { class: 'row', style: { gap: '4px' } },
          h('span', { class: 'mono dim', style: { fontSize: '9px' } }, `PRIORITY ${entry.priority || 0}`),
          h('span', { class: 'push' }),
          h('button', {
            class: 'chip', title: 'Raise priority',
            onClick: async (e) => {
              e.stopPropagation();
              const next = Math.min(5, (Number(entry.priority) || 0) + 1);
              await state.client.from('cinema_watchlist').update({ priority: next }).eq('id', entry.id);
              entry.priority = next;
              navigate('#/watchlist');
            },
          }, '▲'),
          h('button', {
            class: 'chip', title: 'Mark watched',
            onClick: async (e) => {
              e.stopPropagation();
              await state.client.from('cinema_watchlist').update({ done: true }).eq('id', entry.id);
              await state.client.from('cinema_titles').update({ status: 'watched', watched_date: new Date().toISOString().slice(0, 10) }).eq('id', t.id);
              logActivity('watched', 'title', t.id, t.title);
              toast('Logged as watched');
              navigate('#/watchlist');
            },
          }, '✓'),
        ),
        entry.note ? h('div', { class: 'mono dim clamp-2', style: { fontSize: '10px' } }, entry.note) : null,
      ),
    );
    cols.appendChild(card);
  });
  root.appendChild(cols);
}
