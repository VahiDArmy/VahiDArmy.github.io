import { store } from '../lib/store.js';
import { Sound } from '../lib/sound.js';
import { avatarHtml, esc, scoreColor, openScoreEditor, toast } from '../lib/ui.js';

export default function MatrixView(root) {
  let mode = localStorage.getItem('mx_mode') || 'trait';
  let stackId = null;

  root.innerHTML = `
    <div class="matrix-view">
      <div class="matrix-toolbar">
        <div class="segmented">
          <button data-mode="trait">TRAIT STACKS</button>
          <button data-mode="ranker">RANKER STACKS</button>
          <button data-mode="target">TARGET STACKS</button>
        </div>
        <div class="toolbar-actions">
          <button id="mx-random" class="btn btn-ghost"><i class="fa-solid fa-dice"></i>&nbsp; Random</button>
        </div>
      </div>
      <div class="matrix-body">
        <aside class="stack-deck">
          <div class="stack-deck-title" id="stack-deck-title">Stack</div>
          <div class="stack-deck-cards" id="stack-deck-cards"></div>
          <div class="stack-hint">Drag · Click · Swipe</div>
        </aside>
        <section class="matrix-canvas" id="matrix-canvas"></section>
      </div>
    </div>
  `;

  const deckEl = root.querySelector('#stack-deck-cards');
  const canvasEl = root.querySelector('#matrix-canvas');
  const deckTitle = root.querySelector('#stack-deck-title');

  function setMode(m) {
    if (mode === m) return;
    mode = m;
    stackId = null;
    localStorage.setItem('mx_mode', mode);
    updateSegmented();
    renderDeck();
    renderTable();
  }

  function updateSegmented() {
    root.querySelectorAll('.segmented button').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    deckTitle.textContent = mode === 'trait' ? 'Trait stacks' : mode === 'ranker' ? 'Ranker stacks' : 'Target stacks';
  }

  root.querySelectorAll('.segmented button').forEach(b => {
    b.onclick = () => { Sound.tap(); setMode(b.dataset.mode); };
  });
  root.querySelector('#mx-random').onclick = () => {
    const items = getStacks();
    if (!items.length) return;
    stackId = items[Math.floor(Math.random() * items.length)].id;
    Sound.glass(0.7);
    renderDeck(); renderTable();
  };

  function getStacks() {
    if (mode === 'trait') {
      return store.traits.map(t => ({
        id: t.id,
        label: t.name,
        icon: t.icon || 'sparkles',
        color: t.color || '#a855f7',
        meta: `${store.scores.filter(s => s.trait_id === t.id).length} scores`
      }));
    }
    return store.people.map(p => ({
      id: p.id,
      label: p.full_name,
      icon: 'user',
      color: '#a855f7',
      meta: p.job_title || '—',
      avatar: p
    }));
  }

  function renderDeck() {
    const items = getStacks();
    deckEl.innerHTML = '';
    if (!items.length) {
      deckEl.innerHTML = `<div class="empty">No stacks</div>`;
      return;
    }
    if (!stackId || !items.find(i => i.id === stackId)) stackId = items[0].id;
    const curIdx = items.findIndex(i => i.id === stackId);
    const ordered = [...items.slice(curIdx), ...items.slice(0, curIdx)];
    const MAX = Math.min(ordered.length, 6);

    ordered.slice(0, MAX).forEach((item, i) => {
      const card = document.createElement('div');
      card.className = 'stack-card' + (i === 0 ? ' top' : '');
      const sc = 1 - i * 0.06;
      const ty = i * -14;
      card.style.transform = `translate(-50%, -50%) translateY(${ty}px) scale(${sc})`;
      card.style.zIndex = 100 - i;
      card.style.opacity = i === 0 ? 1 : Math.max(0.15, 1 - i * 0.22);
      if (item.avatar) {
        card.innerHTML = `
          ${avatarHtml(item.avatar, 72)}
          <div class="stack-name">${esc(item.label)}</div>
          <div class="stack-meta">${esc(item.meta)}</div>
        `;
      } else {
        card.innerHTML = `
          <div class="stack-icon" style="color:${esc(item.color)}"><i class="fa-solid fa-${esc(item.icon)}"></i></div>
          <div class="stack-name">${esc(item.label)}</div>
          <div class="stack-meta">${esc(item.meta)}</div>
        `;
      }
      if (i === 0) attachDrag(card, items, curIdx);
      card.addEventListener('click', e => {
        if (i === 0) return;
        e.stopPropagation();
        stackId = item.id;
        Sound.tap();
        renderDeck(); renderTable();
      });
      deckEl.appendChild(card);
    });
  }

  function attachDrag(card, items, curIdx) {
    let sx = 0, sy = 0, dx = 0, dy = 0, dragging = false, moved = false;
    card.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      dragging = true; moved = false;
      sx = e.clientX; sy = e.clientY;
      card.setPointerCapture(e.pointerId);
      card.style.transition = 'none';
    });
    card.addEventListener('pointermove', e => {
      if (!dragging) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      const sc = 1;
      card.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(${sc}) rotate(${dx * 0.04}deg)`;
    });
    card.addEventListener('pointerup', e => {
      if (!dragging) return;
      dragging = false;
      card.style.transition = '';
      if (Math.abs(dx) > 90) {
        const dir = dx > 0 ? -1 : 1;
        const ni = (curIdx + dir + items.length) % items.length;
        stackId = items[ni].id;
        Sound.swipe(dx > 0 ? 1 : -1);
        renderDeck(); renderTable();
      } else if (!moved) {
        // treat as click; do nothing special
        card.style.transform = `translate(-50%, -50%)`;
      } else {
        card.style.transform = `translate(-50%, -50%)`;
      }
      dx = dy = 0;
    });
    card.addEventListener('pointercancel', () => {
      dragging = false;
      card.style.transition = '';
      card.style.transform = `translate(-50%, -50%)`;
    });
  }

  function buildTable(config) {
    const wrap = document.createElement('div');
    wrap.className = 'mx-scroll';
    const grid = document.createElement('div');
    grid.className = 'mx-grid';
    grid.style.gridTemplateColumns = `200px repeat(${config.cols.length}, minmax(56px, 1fr))`;

    const corner = document.createElement('div');
    corner.className = 'mx-th mx-corner';
    corner.textContent = config.corner;
    grid.appendChild(corner);

    for (const c of config.cols) {
      const th = document.createElement('div');
      th.className = 'mx-th';
      th.innerHTML = c.html;
      grid.appendChild(th);
    }

    for (const r of config.rows) {
      const rth = document.createElement('div');
      rth.className = 'mx-th mx-rowhead';
      rth.innerHTML = `<div class="mx-label">${r.html}</div>`;
      grid.appendChild(rth);
      for (const c of config.cols) {
        grid.appendChild(config.render(r, c));
      }
    }
    wrap.appendChild(grid);
    return wrap;
  }

  function cellFor(rankerId, targetId, traitId, { editable = false, disabled = false } = {}) {
    const cell = document.createElement('div');
    cell.className = 'mx-cell';
    if (disabled) {
      cell.classList.add('self');
      cell.textContent = '—';
      return cell;
    }
    const v = store.getScore(rankerId, targetId, traitId);
    cell.style.background = scoreColor(v);
    cell.textContent = v === null ? '' : v;
    if (v === null) cell.classList.add('empty');

    if (editable) {
      cell.classList.add('editable');
      cell.onclick = () => {
        openScoreEditor(
          cell,
          v,
          async (val) => {
            try {
              await store.setScore(rankerId, targetId, traitId, val);
              Sound.glass(1);
              renderTable();
            } catch (e) { toast(e.message, 'error'); Sound.error(); }
          },
          async () => {
            try {
              await store.setScore(rankerId, targetId, traitId, null);
              Sound.tap();
              renderTable();
            } catch (e) { toast(e.message, 'error'); }
          }
        );
      };
    } else {
      cell.classList.add('readonly');
      cell.onclick = () => toast('You can only score from your own row.', 'info', 2200);
    }
    return cell;
  }

  function renderTable() {
    const myId = store.myPerson?.id || null;
    const people = store.people;
    const traits = store.traits;

    if (!people.length || !traits.length) {
      canvasEl.innerHTML = `<div class="empty">Add people and traits to see the cube.</div>`;
      return;
    }

    if (mode === 'trait') {
      const trait = traits.find(t => t.id === stackId) || traits[0];
      if (!trait) { canvasEl.innerHTML = `<div class="empty">No trait selected.</div>`; return; }
      stackId = trait.id;

      const table = buildTable({
        corner: 'Ranker \\ Target',
        rows: people.map(p => ({ id: p.id, html: `${avatarHtml(p, 22)}<span>${esc(p.full_name)}</span>` })),
        cols: people.map(p => ({ id: p.id, html: `${avatarHtml(p, 22)}<span style="max-width:70px;overflow:hidden;text-overflow:ellipsis">${esc(p.full_name.split(' ')[0])}</span>` })),
        render: (r, c) => cellFor(r.id, c.id, trait.id, {
          editable: r.id === myId,
          disabled: r.id === c.id
        })
      });

      canvasEl.innerHTML = '';
      const header = document.createElement('div');
      header.style.cssText = 'margin-bottom:14px;display:flex;align-items:center;gap:12px';
      header.innerHTML = `
        <div style="font-size:44px;color:${esc(trait.color || '#a855f7')}"><i class="fa-solid fa-${esc(trait.icon || 'sparkles')}"></i></div>
        <div>
          <div style="font-family:var(--display);font-size:22px;font-weight:700">${esc(trait.name)}</div>
          <div style="color:var(--text-faint);font-size:12px;font-family:var(--mono)">stack: trait · ${esc(trait.slug || '')}</div>
        </div>
      `;
      canvasEl.appendChild(header);
      canvasEl.appendChild(table);
      return;
    }

    if (mode === 'ranker') {
      const ranker = people.find(p => p.id === stackId) || people[0];
      if (!ranker) { canvasEl.innerHTML = `<div class="empty">No ranker selected.</div>`; return; }
      stackId = ranker.id;
      const isMine = ranker.id === myId;

      const table = buildTable({
        corner: 'Target \\ Trait',
        rows: people.filter(p => p.id !== ranker.id).map(p => ({ id: p.id, html: `${avatarHtml(p, 22)}<span>${esc(p.full_name)}</span>` })),
        cols: traits.map(t => ({ id: t.id, html: `<i class="fa-solid fa-${esc(t.icon || 'sparkles')}" style="color:${esc(t.color || '#a855f7')}"></i><span style="max-width:80px;overflow:hidden;text-overflow:ellipsis">${esc(t.name)}</span>` })),
        render: (r, c) => cellFor(ranker.id, r.id, c.id, { editable: isMine })
      });

      canvasEl.innerHTML = '';
      const header = document.createElement('div');
      header.style.cssText = 'margin-bottom:14px;display:flex;align-items:center;gap:12px';
      header.innerHTML = `
        ${avatarHtml(ranker, 48)}
        <div>
          <div style="font-family:var(--display);font-size:22px;font-weight:700">${esc(ranker.full_name)}</div>
          <div style="color:var(--text-faint);font-size:12px;font-family:var(--mono)">stack: ranker · ${isMine ? 'YOU' : 'read only'}</div>
        </div>
      `;
      canvasEl.appendChild(header);
      canvasEl.appendChild(table);
      return;
    }

    // target
    const target = people.find(p => p.id === stackId) || people[0];
    if (!target) { canvasEl.innerHTML = `<div class="empty">No target selected.</div>`; return; }
    stackId = target.id;

    const table = buildTable({
      corner: 'Ranker \\ Trait',
      rows: people.filter(p => p.id !== target.id).map(p => ({ id: p.id, html: `${avatarHtml(p, 22)}<span>${esc(p.full_name)}</span>` })),
      cols: traits.map(t => ({ id: t.id, html: `<i class="fa-solid fa-${esc(t.icon || 'sparkles')}" style="color:${esc(t.color || '#a855f7')}"></i><span style="max-width:80px;overflow:hidden;text-overflow:ellipsis">${esc(t.name)}</span>` })),
      render: (r, c) => cellFor(r.id, target.id, c.id, { editable: r.id === myId })
    });

    canvasEl.innerHTML = '';
    const header = document.createElement('div');
    header.style.cssText = 'margin-bottom:14px;display:flex;align-items:center;gap:12px';
    header.innerHTML = `
      ${avatarHtml(target, 48)}
      <div>
        <div style="font-family:var(--display);font-size:22px;font-weight:700">${esc(target.full_name)}</div>
        <div style="color:var(--text-faint);font-size:12px;font-family:var(--mono)">stack: target · received scores</div>
      </div>
    `;
    canvasEl.appendChild(header);
    canvasEl.appendChild(table);
  }

  updateSegmented();
  renderDeck();
  renderTable();

  const unsub = store.on(() => { renderDeck(); renderTable(); });
  return { destroy: unsub };
}
