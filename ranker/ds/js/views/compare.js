(function () {
  const T3D = window.T3D;
  const { h, esc, fmtNum, initials, colorFromString } = T3D.lib;

  T3D.router.register('compare', async function (root) {
    const st = T3D.state;
    if (!st.loaded) { root.appendChild(h('div', { class: 'empty' }, h('div', { class: 'spinner' }))); return; }

    if (st.people.length < 2) {
      root.appendChild(h('div', { class: 'empty' }, h('i', { class: 'fa-solid fa-scale-balanced' }), h('div', null, 'Need at least 2 people to compare')));
      return;
    }

    const container = h('div', { class: 'view', style: { padding: '20px', overflow: 'auto' } });
    root.appendChild(container);

    let leftId = st.people[0].id;
    let rightId = st.people[1].id;

    const grid = h('div', { class: 'compare-grid' });
    container.appendChild(grid);

    function sel(people, current, onChange, label) {
      const s = h('select', { class: 'select' });
      people.forEach(p => {
        const o = h('option', { value: p.id }, esc(p.full_name));
        if (p.id === current) o.selected = true;
        s.appendChild(o);
      });
      s.onchange = () => onChange(s.value);
      return h('label', { class: 'field' }, h('span', null, label), s);
    }

    function renderSide(id, side) {
      const p = T3D.derive.personById(id);
      if (!p) return;
      const avg = T3D.derive.avgReceived(id);
      const bg = colorFromString(p.full_name);
      const traits = st.traits.map(t => ({ t, v: T3D.derive.avgReceivedByTrait(id, t.id) }));
      const sideEl = h('div', { class: 'compare-side' });
      sideEl.appendChild(sel(st.people, id, (v) => { if (side === 'L') leftId = v; else rightId = v; renderAll(); }, side === 'L' ? 'Left person' : 'Right person'));
      sideEl.appendChild(h('div', { style: { display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px' } },
        h('div', { class: 'avatar lg', style: { background: bg } }, esc(initials(p.full_name))),
        h('div', null,
          h('div', { class: 'h2' }, esc(p.full_name)),
          h('div', { class: 'muted' }, esc(p.job_title || p.department || '—')),
          h('div', { class: 'chip', style: { marginTop: '6px' } }, 'Avg received: ', h('b', null, avg == null ? '—' : fmtNum(avg, 1)))
        )
      ));
      const list = h('div', { style: { marginTop: '16px' } });
      traits.forEach(({ t, v }) => {
        const pct = v == null ? 0 : v;
        list.appendChild(h('div', { class: 'trait-row' },
          h('div', { class: 'icon', style: { color: t.color } }, t.icon || '✨'),
          h('div', { class: 'name' }, t.name),
          h('div', { class: 'bar-wrap' }, h('div', { class: 'bar' }, h('i', { style: { width: pct + '%', background: `linear-gradient(90deg, ${t.color}, var(--violet))` } }))),
          h('div', { class: 'val' }, v == null ? '—' : fmtNum(v, 1))
        ));
      });
      sideEl.appendChild(list);
      return sideEl;
    }

    function renderAll() {
      grid.innerHTML = '';
      grid.appendChild(renderSide(leftId, 'L'));
      grid.appendChild(renderSide(rightId, 'R'));
    }
    renderAll();
  });
})();
