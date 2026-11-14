/* ============================================================================
   FULL METAL CINEMA — collections
   hand-made racks, plus automatic racks computed from the shelf
   ========================================================================== */

import {
  h, toast, field, openModal, confirmAction, emptyState, posterEl, fmtDec,
  fmtDate, sortBy, download, toCsv,
} from '../lib/dom.js';
import {
  state, rows, addRow, updateRow, removeRow, titleById, computeStats, splitTags,
} from '../lib/store.js';
import { COLLECTION_COLORS } from '../config.js';
import { navigate, titleCard, posterStrip } from './shared.js';

export function renderCollections(root, { id } = {}) {
  if (id) return renderCollectionDetail(root, id);

  const colls = rows('collections');
  const items = rows('collectionItems');
  const s = computeStats(rows('titles'));

  root.appendChild(h('div', { class: 'viewhead' },
    h('div', { class: 'sect__num' }, '03'),
    h('div', {},
      h('h1', {}, 'Collections'),
      h('div', { class: 'viewhead__sub' }, `${colls.length} racks · ${items.length} filed titles`),
    ),
    h('div', { class: 'viewhead__tools' },
      h('button', { class: 'btn btn--primary', onClick: () => editCollection(null) }, '＋ New collection'),
      h('button', { class: 'btn btn--ghost', onClick: () => navigate('#/library') }, 'Library'),
    ),
  ));

  /* ---------- auto racks ---------- */
  const auto = [
    { name: 'Unscored', desc: 'No number attached. The archive is lying.', color: '#ffb03a', query: '#/library?sort=recent' },
    { name: 'Perfect run', desc: 'Everything at 9.5 and above.', color: '#58d98a', query: '#/library?min=9.5&sort=score' },
    { name: 'Regrets', desc: 'Filed under hate. Kept as evidence.', color: '#ff7a45', query: '#/library?cat=hate' },
    { name: 'Unanalysed', desc: 'No story analysis written yet.', color: '#7fe3ff', query: '#/library?sort=title' },
    { name: 'Series debt', desc: 'Series you started and have not finished.', color: '#c08cff', query: '#/library?status=watching' },
    { name: 'This decade', desc: 'Everything released 2020 or later.', color: '#d8ff3e', query: '#/library?sort=year' },
  ];

  root.appendChild(h('div', { class: 'shelf__head' }, h('h2', {}, 'Automatic racks'), h('span', { class: 'count' }, 'computed, never stored')));
  const autoGrid = h('div', { class: 'collgrid' });
  auto.forEach((a) => {
    autoGrid.appendChild(h('div', {
      class: 'coll', style: { minHeight: '110px' },
      onClick: () => navigate(a.query),
    },
    h('div', { class: 'coll__stripe', style: { background: a.color } }),
    h('div', { class: 'coll__name' }, a.name),
    h('div', { class: 'coll__desc' }, a.desc),
    h('div', { class: 'mono dim', style: { fontSize: '9px', letterSpacing: '.16em' } }, 'AUTO RACK →'),
    ));
  });
  root.appendChild(autoGrid);

  root.appendChild(h('div', { style: { height: '26px' } }));
  root.appendChild(h('div', { class: 'shelf__head' }, h('h2', {}, 'Your racks'), h('span', { class: 'count' }, `${colls.length}`)));

  if (!colls.length) {
    root.appendChild(emptyState({
      glyph: '❏',
      title: 'No racks yet',
      body: 'A collection is a thesis: "night shift", "never again", "films my father would hate". Build one.',
      action: h('button', { class: 'btn btn--primary', onClick: () => editCollection(null) }, '＋ New collection'),
    }));
  } else {
    const grid = h('div', { class: 'collgrid' });
    colls.forEach((c) => {
      const members = items.filter((i) => i.collection_id === c.id);
      const titles = members.map((m) => titleById(m.title_id)).filter(Boolean);
      grid.appendChild(h('div', {
        class: 'coll',
        onClick: (e) => { if (!e.target.closest('button')) navigate(`#/collections/${c.id}`); },
      },
      h('div', { class: 'coll__stripe', style: { background: c.color || 'var(--accent)' } }),
      h('div', { class: 'row' },
        h('span', { class: 'mono dim', style: { fontSize: '9px', letterSpacing: '.2em' } }, `${c.icon || '❏'} RACK`),
        h('span', { class: 'push' }),
        h('span', { class: 'mono dim', style: { fontSize: '9px' } }, `${members.length} TITLES`),
      ),
      h('div', { class: 'coll__name' }, c.name),
      c.description ? h('div', { class: 'coll__desc clamp-2' }, c.description) : null,
      h('div', { class: 'coll__stack' }, titles.slice(0, 5).map((t) => posterEl(t, { small: true }))),
      h('div', { class: 'row', style: { gap: '4px' } },
        h('button', { class: 'btn btn--ghost btn--sm', onClick: (e) => { e.stopPropagation(); editCollection(c); } }, 'Edit'),
        h('button', {
          class: 'btn btn--ghost btn--sm',
          onClick: (e) => { e.stopPropagation(); navigate(`#/collections/${c.id}`); },
        }, 'Open →'),
      ),
      ));
    });
    root.appendChild(grid);
  }

  function editCollection(c) {
    const name = h('input', { class: 'input', value: c?.name || '', placeholder: 'Night Shift' });
    const desc = h('input', { class: 'input', value: c?.description || '', placeholder: 'What is this rack for?' });
    const icon = h('input', { class: 'input', value: c?.icon || '❏', maxlength: '3', style: { maxWidth: '70px' } });
    const color = h('input', { class: 'input', type: 'color', value: c?.color || COLLECTION_COLORS[0], style: { maxWidth: '70px', padding: '2px' } });
    const swatches = h('div', { class: 'swatches' }, COLLECTION_COLORS.map((col) => h('button', {
      class: 'swatch', style: { background: col }, type: 'button',
      onClick: () => { color.value = col; },
    }, '')));

    const modal = openModal({
      title: c ? 'Edit collection' : 'New collection',
      body: h('div', { class: 'form' },
        h('div', { class: 'form__grid' }, field('Name', name), field('Icon', icon), field('Colour', color)),
        field('Description', desc),
        swatches,
      ),
      foot: h('div', { class: 'modal__foot' },
        c ? h('button', {
          class: 'btn btn--danger btn--sm',
          onClick: async () => {
            const ok = await confirmAction({ title: 'Delete collection', body: 'The rack goes; the titles stay on your shelf.', ok: 'Delete' });
            if (!ok) return;
            await removeRow('collections', c.id);
            modal.close();
            navigate('#/collections');
          },
        }, 'Delete') : null,
        h('div', { class: 'push' }),
        h('button', { class: 'btn btn--ghost', onClick: () => modal.close() }, 'Cancel'),
        h('button', {
          class: 'btn btn--primary',
          onClick: async () => {
            if (!name.value.trim()) { toast('A name, at least', 'warn'); return; }
            const payload = { name: name.value.trim(), description: desc.value, icon: icon.value, color: color.value };
            try {
              if (c) await updateRow('collections', c.id, payload);
              else await addRow('collections', payload);
              toast('Collection saved');
              modal.close();
              navigate('#/collections');
            } catch (err) { toast(err.message, 'err'); }
          },
        }, 'Save'),
      ),
    });
  }
}

/* ---------- one collection --------------------------------------------- */
function renderCollectionDetail(root, id) {
  const c = rows('collections').find((x) => x.id === id);
  if (!c) {
    root.appendChild(emptyState({ glyph: '404', title: 'Rack not found', body: 'It may have been deleted.', action: h('button', { class: 'btn btn--primary', onClick: () => navigate('#/collections') }, 'All collections') }));
    return;
  }
  const items = sortBy(rows('collectionItems').filter((i) => i.collection_id === id), (i) => i.position || 0, 1);
  const titles = items.map((i) => ({ ...titleById(i.title_id), _item: i })).filter((t) => t.id);

  root.appendChild(h('div', { class: 'viewhead' },
    h('div', {},
      h('div', { class: 'mono dim', style: { letterSpacing: '.2em', fontSize: '9.5px' } }, `${c.icon || '❏'} COLLECTION`),
      h('h1', { style: { color: c.color || 'var(--ink)' } }, c.name),
      h('div', { class: 'viewhead__sub' }, `${titles.length} titles${c.description ? ` · ${c.description}` : ''}`),
    ),
    h('div', { class: 'viewhead__tools' },
      h('button', { class: 'btn btn--primary', onClick: () => pickTitles() }, '＋ Add titles'),
      h('button', {
        class: 'btn btn--ghost',
        onClick: () => download(`${c.name}.csv`, toCsv(titles.map((t) => ({
          title: t.title, year: t.year, rating: t.rating, genre: t.genre, category: t.category,
        }))), 'text/csv'),
      }, 'Export'),
      h('button', { class: 'btn btn--ghost', onClick: () => navigate('#/collections') }, '↩ Racks'),
    ),
  ));

  if (!titles.length) {
    root.appendChild(emptyState({
      glyph: '❏', title: 'Rack is empty',
      body: 'File titles into this rack. Order is kept in cinema_collection_items.position.',
      action: h('button', { class: 'btn btn--primary', onClick: () => pickTitles() }, '＋ Add titles'),
    }));
    return;
  }

  const list = h('div', { class: 'col', style: { gap: '6px' } });
  titles.forEach((t, idx) => {
    list.appendChild(h('div', {
      class: 'tl-item', style: { gridTemplateColumns: '34px 40px 1fr auto auto' },
    },
    h('div', { class: 'mono dim' }, String(idx + 1).padStart(2, '0')),
    h('div', { style: { width: '34px' } }, posterEl(t, { small: true })),
    h('div', { onClick: () => navigate(`#/title/${t.id}`), style: { cursor: 'pointer' } },
      h('div', { class: 'tl-item__name' }, t.title),
      h('div', { class: 'tl-item__meta' }, [t.year, t.type, t.genre, t.country].filter(Boolean).join(' · ')),
    ),
    h('div', { class: 'mono', style: { color: Number(t.rating) >= 8 ? 'var(--accent)' : 'var(--ink-3)' } }, fmtDec(t.rating, 1)),
    h('div', { class: 'row', style: { gap: '2px' } },
      h('button', {
        class: 'iconbtn', title: 'Move up',
        onClick: async () => {
          if (idx === 0) return;
          await state.client.from('cinema_collection_items').update({ position: idx - 1 }).eq('id', t._item.id);
          await state.client.from('cinema_collection_items').update({ position: idx }).eq('id', titles[idx - 1]._item.id);
          navigate(`#/collections/${id}`);
        },
      }, '↑'),
      h('button', {
        class: 'iconbtn', title: 'Remove',
        onClick: async () => {
          await removeRow('collectionItems', t._item.id);
          navigate(`#/collections/${id}`);
        },
      }, '✕'),
    ),
    ));
  });
  root.appendChild(list);

  function pickTitles() {
    const existing = new Set(items.map((i) => i.title_id));
    const search = h('input', { class: 'input', placeholder: 'Search the shelf…' });
    const listEl = h('div', { class: 'col', style: { gap: '2px', maxHeight: '48vh', overflowY: 'auto' } });
    const chosen = new Set();

    const paint = () => {
      const q = search.value.toLowerCase();
      listEl.replaceChildren(...rows('titles')
        .filter((t) => !q || t.title.toLowerCase().includes(q))
        .slice(0, 200)
        .map((t) => h('label', {
          class: 'row', style: { padding: '6px 8px', borderBottom: '1px solid var(--line)', cursor: 'pointer' },
        },
        h('input', {
          type: 'checkbox', checked: existing.has(t.id) || chosen.has(t.id), disabled: existing.has(t.id),
          onChange: (e) => { if (e.target.checked) chosen.add(t.id); else chosen.delete(t.id); },
        }),
        h('div', { style: { width: '24px', flex: '0 0 auto' } }, posterEl(t, { small: true })),
        h('div', {}, h('div', { style: { textTransform: 'uppercase', fontSize: '13px' } }, t.title),
          h('div', { class: 'mono dim', style: { fontSize: '9px' } }, `${t.year || '—'} · ${t.type}`)),
        existing.has(t.id) ? h('span', { class: 'push mono dim', style: { fontSize: '9px' } }, 'IN RACK') : null,
        )));
    };
    search.addEventListener('input', paint);
    paint();

    const modal = openModal({
      title: `File into ${c.name}`,
      wide: true,
      body: h('div', { class: 'form' }, search, listEl),
      foot: h('div', { class: 'modal__foot' },
        h('span', { class: 'mono dim' }, ''),
        h('div', { class: 'push' }),
        h('button', { class: 'btn btn--ghost', onClick: () => modal.close() }, 'Cancel'),
        h('button', {
          class: 'btn btn--primary',
          onClick: async () => {
            let pos = items.length;
            for (const titleId of chosen) {
              await addRow('collectionItems', { collection_id: c.id, title_id: titleId, position: pos++ });
            }
            toast(`${chosen.size} titles filed`);
            modal.close();
            navigate(`#/collections/${id}`);
          },
        }, 'File selected'),
      ),
    });
  }
}
