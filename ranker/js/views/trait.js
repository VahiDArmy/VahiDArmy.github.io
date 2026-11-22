(function () {
  const T3D = window.T3D;
  const { h, esc, fmtNum, initials, colorFromString } = T3D.lib;

  T3D.router.register('trait', async function (root) {
    const st = T3D.state;
    if (!st.loaded) { root.appendChild(h('div', { class: 'empty' }, h('div', { class: 'spinner' }))); return; }

    const split = h('div', { class: 'view-split' });
    const leftPane = h('div', { class: 'pane' },
      h('div', { class: 'pane-head' },
        h('div', { class: 'pane-title' }, 'Traits'),
        h('span', { class: 'chip' }, `${st.traits.length} traits`)
      )
    );
    const leftBody = h('div', { class: 'pane-body' });
    leftPane.appendChild(leftBody);
    const rightPane = h('div', { class: 'pane' });
    const rightBody = h('div', { class: 'pane-body' });
    rightPane.appendChild(rightBody);
    split.appendChild(leftPane);
    split.appendChild(rightPane);
    root.appendChild(h('div', { class: 'view' }, split));

    if (!st.traits.length) {
      rightBody.appendChild(h('div', { class: 'empty' },
        h('i', { class: 'fa-solid fa-compass' }),
        h('div', null, 'No traits defined.'),
        h('div', { class: 'muted' }, 'Run the seed SQL to create default traits.')
      ));
      return;
    }

    let focusedId = st.focusedTraitId || st.traits[0].id;

    const deck = T3D.createDeck({
      items: st.traits,
      getId: (t) => t.id,
      renderCard: (t) => {
        const avg = T3D.derive.avgTraitAcross(t.id);
        const count = st.scores.filter(s => s.trait_id === t.id).length;
        return `
          <div class="deck-card-inner" style="background: linear-gradient(160deg, ${t.color}22, transparent)">
            <div class="card-badge" style="background:${t.color}">${esc(t.icon || '✨')} trait</div>
            <div class="avatar" style="background:${t.color}">${esc((t.icon || '✨'))}</div>
            <h3>${esc(t.name)}</h3>
            <div class="muted">${esc(t.description || '—')}</div>
            <div class="score-row">
              <div class="mini"><b>${avg == null ? '—' : fmtNum(avg, 1)}</b><span>Average</span></div>
              <div class="mini"><b>${count}</b><span>Scores</span></div>
              <div class="mini"><b>${st.people.length}</b><span>Rated</span></div>
            </div>
          </div>
        `;
      },
      onFocus: (t) => { focusedId = t.id; T3D.setState({ focusedTraitId: t.id }); renderDetail(t.id); },
      onSelect: (t) => { deck.focusId(t.id); }
    });
    leftBody.appendChild(deck.el);
    if (st.focusedTraitId) deck.focusId(st.focusedTraitId);

    function renderDetail(tid) {
      rightBody.innerHTML = '';
      const t = T3D.derive.traitById(tid);
      if (!t) return;
      const scores = st.scores.filter(s => s.trait_id === tid);
      const avg = T3D.derive.avgTraitAcross(tid);

      // Header
      const hero = h('div', { class: 'person-hero' },
        h('div', { class: 'avatar xl', style: { background: t.color } }, esc(t.icon || '✨')),
        h('div', { class: 'person-hero-info' },
          h('h1', { class: 'h1' }, esc(t.name)),
          h('div', { class: 'sub' }, esc(t.description || 'Personality trait')),
          h('div', { class: 'row', style: { marginTop: '10px', gap: '6px' } },
            h('span', { class: 'chip' }, h('b', null, avg == null ? '—' : fmtNum(avg, 1)), ' average'),
            h('span', { class: 'chip' }, h('b', null, String(scores.length)), ' scores')
          )
        ),
        h('div', { class: 'person-hero-actions' },
          h('button', {
            class: 'btn primary',
            onclick: () => {
              const leader = computeLeaderboard(tid);
              const prompt = `Analyze the "${t.name}" trait rankings. Top people: ` +
                leader.slice(0, 8).map((x, i) => `${i + 1}. ${x.p.full_name}=${fmtNum(x.avg, 1)}`).join(', ') +
                `. Overall average=${avg == null ? 'N/A' : fmtNum(avg, 1)}. Give sharp observations about what this trait says about the group dynamic, and 3 actionable insights.`;
              T3D.modal.openAIInsight(prompt);
            }
          }, h('i', { class: 'fa-solid fa-wand-magic-sparkles' }), ' AI insight')
        )
      );

      const scroll = h('div', { class: 'pane-scroll' });
      scroll.appendChild(hero);

      // Leaderboard
      const leader = computeLeaderboard(tid);
      const lbPanel = h('div', { class: 'panel', style: { marginTop: '20px' } },
        h('h4', { class: 'panel-title' }, 'Leaderboard')
      );
      const lb = h('div', { class: 'leaderboard' });
      leader.slice(0, 12).forEach((row, i) => {
        const bg = colorFromString(row.p.full_name);
        lb.appendChild(h('div', { class: 'lb-item' },
          h('div', { class: 'lb-rank' }, String(i + 1)),
          h('div', { class: 'avatar sm', style: { background: bg } }, esc(initials(row.p.full_name))),
          h('div', { class: 'lb-info' },
            h('div', { class: 'n' }, esc(row.p.full_name)),
            h('div', { class: 's' }, row.count + ' vote' + (row.count === 1 ? '' : 's'))
          ),
          h('div', { class: 'lb-val' }, fmtNum(row.avg, 1))
        ));
      });
      if (!leader.length) lb.appendChild(h('div', { class: 'empty' }, h('div', null, 'No scores yet')));
      lbPanel.appendChild(lb);
      scroll.appendChild(lbPanel);

      // Heatmap rater x ratee
      if (st.people.length > 1) {
        const hmPanel = h('div', { class: 'panel', style: { marginTop: '20px' } },
          h('h4', { class: 'panel-title' }, 'Heatmap — who rates whom')
        );
        const people = st.people.slice(0, 14);
        const grid = h('div', { class: 'heatmap', style: { gridTemplateColumns: `120px repeat(${people.length}, minmax(32px, 1fr))` } });
        // header row
        grid.appendChild(h('div', { style: { fontSize: '11px', fontWeight: '700', color: 'var(--text-dim)' } }, 'Rater ↓ Ratee →'));
        people.forEach(p => grid.appendChild(h('div', { style: { fontSize: '10px', fontWeight: '700', color: 'var(--text-dim)', textAlign: 'center', overflow: 'hidden' }, title: p.full_name }, esc(p.full_name.split(' ')[0]))));
        people.forEach(rater => {
          grid.appendChild(h('div', { style: { fontSize: '11px', fontWeight: '700', padding: '2px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: rater.full_name }, esc(rater.full_name.split(' ')[0])));
          people.forEach(ratee => {
            if (rater.id === ratee.id) { grid.appendChild(h('div', { class: 'heat-cell', style: { background: 'var(--border)', color: 'transparent' } }, '·')); return; }
            const s = T3D.derive.scoreFor(rater.id, ratee.id, tid);
            if (s) {
              const v = Number(s.score);
              const hue = 260 - (v / 100) * 200;
              grid.appendChild(h('div', { class: 'heat-cell', style: { background: `hsl(${hue} 70% 55%)` }, title: `${rater.full_name} → ${ratee.full_name}: ${v}` }, fmtNum(v, 0)));
            } else {
              grid.appendChild(h('div', { class: 'heat-cell', style: { background: 'var(--border)', color: 'transparent' } }, '·'));
            }
          });
        });
        hmPanel.appendChild(grid);
        scroll.appendChild(hmPanel);
      }

      // Distribution
      if (scores.length) {
        const distPanel = h('div', { class: 'panel', style: { marginTop: '20px' } },
          h('h4', { class: 'panel-title' }, 'Distribution')
        );
        const buckets = new Array(11).fill(0);
        scores.forEach(s => buckets[Math.min(10, Math.floor(Number(s.score) / 10))]++);
        const max = Math.max(...buckets, 1);
        const spark = h('div', { class: 'sparkline', style: { height: '120px' } });
        buckets.forEach((c, i) => {
          const bar = h('div', { class: 'b', title: `${i * 10}-${i * 10 + 9}: ${c}`, style: { height: '0%' } });
          spark.appendChild(bar);
          requestAnimationFrame(() => { bar.style.height = Math.max(2, (c / max) * 100) + '%'; });
        });
        distPanel.appendChild(spark);
        scroll.appendChild(distPanel);
      }

      rightBody.appendChild(scroll);
    }
    renderDetail(focusedId);

    function computeLeaderboard(tid) {
      return st.people.map(p => {
        const rows = st.scores.filter(s => s.trait_id === tid && s.ratee_person_id === p.id);
        const avg = rows.length ? rows.reduce((a, s) => a + Number(s.score), 0) / rows.length : null;
        return { p, avg: avg == null ? -1 : avg, count: rows.length };
      }).filter(x => x.avg >= 0).sort((a, b) => b.avg - a.avg);
    }
  });
})();
