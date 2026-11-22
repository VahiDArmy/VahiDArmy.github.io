(function () {
  const T3D = window.T3D;
  const { h, esc, fmtNum, initials, colorFromString } = T3D.lib;

  T3D.router.register('stats', async function (root) {
    const st = T3D.state;
    if (!st.loaded) { root.appendChild(h('div', { class: 'empty' }, h('div', { class: 'spinner' }))); return; }

    const container = h('div', { class: 'view', style: { padding: '20px', overflow: 'auto' } });
    root.appendChild(container);

    const totalPeople = st.people.length;
    const totalTraits = st.traits.length;
    const totalScores = st.scores.length;
    const avgScore = totalScores ? st.scores.reduce((a, s) => a + Number(s.score), 0) / totalScores : null;
    const possible = totalPeople * Math.max(1, totalPeople - 1) * totalTraits;
    const coverage = possible ? (totalScores / possible) * 100 : 0;

    // Stat cards
    const cards = h('div', { class: 'stat-cards' });
    const stat = (big, lbl, color) => h('div', { class: 'stat-card' }, h('div', { class: 'big', style: { color: color || 'var(--text)' } }, big), h('div', { class: 'lbl' }, lbl));
    cards.appendChild(stat(String(totalPeople), 'People', 'var(--violet)'));
    cards.appendChild(stat(String(totalTraits), 'Traits', 'var(--cyan)'));
    cards.appendChild(stat(String(totalScores), 'Scores', 'var(--pink)'));
    cards.appendChild(stat(avgScore == null ? '—' : fmtNum(avgScore, 1), 'Avg score', 'var(--mint)'));
    cards.appendChild(stat(fmtNum(coverage, 0) + '%', 'Coverage', 'var(--orange)'));
    container.appendChild(cards);

    // Top traits
    const traitsPanel = h('div', { class: 'panel', style: { marginTop: '20px' } },
      h('h4', { class: 'panel-title' }, 'Traits by average')
    );
    const traitRows = st.traits.map(t => ({ t, avg: T3D.derive.avgTraitAcross(t.id), count: st.scores.filter(s => s.trait_id === t.id).length }))
      .sort((a, b) => (b.avg || 0) - (a.avg || 0));
    traitRows.forEach(({ t, avg, count }) => {
      const pct = avg == null ? 0 : avg;
      traitsPanel.appendChild(h('div', { class: 'trait-row' },
        h('div', { class: 'icon', style: { color: t.color } }, t.icon || '✨'),
        h('div', { class: 'name' }, t.name),
        h('div', { class: 'bar-wrap' }, h('div', { class: 'bar' }, h('i', { style: { width: pct + '%', background: `linear-gradient(90deg, ${t.color}, var(--violet))` } }))),
        h('div', { class: 'val' }, avg == null ? '—' : fmtNum(avg, 1)),
        h('div', { class: 'muted', style: { fontSize: '11px', width: '42px', textAlign: 'right' } }, count ? count + 'x' : '')
      ));
    });
    container.appendChild(traitsPanel);

    // Top people
    const peoplePanel = h('div', { class: 'panel', style: { marginTop: '20px' } },
      h('h4', { class: 'panel-title' }, 'Top people by avg received')
    );
    const peopleRows = st.people.map(p => ({ p, avg: T3D.derive.avgReceived(p.id), count: st.scores.filter(s => s.ratee_person_id === p.id).length }))
      .filter(x => x.avg != null).sort((a, b) => b.avg - a.avg).slice(0, 10);
    peopleRows.forEach(({ p, avg, count }, i) => {
      const bg = colorFromString(p.full_name);
      peoplePanel.appendChild(h('div', { class: 'lb-item' },
        h('div', { class: 'lb-rank' }, String(i + 1)),
        h('div', { class: 'avatar sm', style: { background: bg } }, esc(initials(p.full_name))),
        h('div', { class: 'lb-info' }, h('div', { class: 'n' }, esc(p.full_name)), h('div', { class: 's' }, count + ' ratings')),
        h('div', { class: 'lb-val' }, fmtNum(avg, 1))
      ));
    });
    if (!peopleRows.length) peoplePanel.appendChild(h('div', { class: 'empty' }, h('div', null, 'No data yet')));
    container.appendChild(peoplePanel);

    // Recent activity
    const recentPanel = h('div', { class: 'panel', style: { marginTop: '20px' } },
      h('h4', { class: 'panel-title' }, 'Recent scores')
    );
    const recent = [...st.scores].sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)).slice(0, 15);
    if (!recent.length) recentPanel.appendChild(h('div', { class: 'empty' }, h('div', null, 'No scores yet')));
    recent.forEach(s => {
      const rater = T3D.derive.personById(s.rater_person_id);
      const ratee = T3D.derive.personById(s.ratee_person_id);
      const trait = T3D.derive.traitById(s.trait_id);
      if (!rater || !ratee || !trait) return;
      recentPanel.appendChild(h('div', { class: 'row', style: { padding: '8px 0', borderBottom: '1px solid var(--border)' } },
        h('div', { class: 'avatar sm', style: { background: colorFromString(rater.full_name) } }, esc(initials(rater.full_name))),
        h('div', { style: { flex: 1, fontSize: '13px' } },
          h('b', null, esc(rater.full_name.split(' ')[0])), ' rated ',
          h('b', null, esc(ratee.full_name.split(' ')[0])), ' on ',
          h('span', { style: { color: trait.color } }, trait.icon || '✨', ' ', esc(trait.name))
        ),
        h('div', { class: 'chip' }, fmtNum(s.score, 0))
      ));
    });
    container.appendChild(recentPanel);

    // Distribution chart
    if (st.scores.length) {
      const distPanel = h('div', { class: 'panel', style: { marginTop: '20px' } },
        h('h4', { class: 'panel-title' }, 'Overall distribution')
      );
      const buckets = new Array(11).fill(0);
      st.scores.forEach(s => buckets[Math.min(10, Math.floor(Number(s.score) / 10))]++);
      const max = Math.max(...buckets, 1);
      const spark = h('div', { class: 'sparkline', style: { height: '120px', marginTop: '8px' } });
      buckets.forEach((c, i) => {
        const bar = h('div', { class: 'b', title: `${i * 10}-${i * 10 + 9}: ${c}`, style: { height: '0%' } });
        spark.appendChild(bar);
        requestAnimationFrame(() => { bar.style.height = Math.max(2, (c / max) * 100) + '%'; });
      });
      distPanel.appendChild(spark);
      const labels = h('div', { class: 'row between', style: { fontSize: '10px', color: 'var(--text-dim)', marginTop: '6px' } });
      ['0', '20', '40', '60', '80', '100'].forEach(l => labels.appendChild(h('span', null, l)));
      distPanel.appendChild(labels);
      container.appendChild(distPanel);
    }
  });
})();
