(function () {
  const T3D = window.T3D;
  const { h, esc, initials, colorFromString, fmtNum } = T3D.lib;

  T3D.router.register('person', async function (root) {
    const st = T3D.state;
    if (!st.loaded) { root.appendChild(h('div', { class: 'empty' }, h('div', { class: 'spinner' }))); return; }

    const split = h('div', { class: 'view-split' });
    const leftPane = h('div', { class: 'pane' },
      h('div', { class: 'pane-head' },
        h('div', { class: 'pane-title' }, 'People'),
        h('span', { class: 'chip' }, `${st.people.length} total`)
      )
    );
    const leftBody = h('div', { class: 'pane-body' });
    leftPane.appendChild(leftBody);
    const rightPane = h('div', { class: 'pane' });
    const rightBody = h('div', { class: 'pane-body' });
    rightPane.appendChild(rightBody);
    split.appendChild(leftPane);
    split.appendChild(rightPane);
    const view = h('div', { class: 'view' }, split);
    root.appendChild(view);

    if (!st.people.length) {
      rightBody.appendChild(h('div', { class: 'empty' },
        h('i', { class: 'fa-solid fa-users' }),
        h('div', null, 'No people yet.'),
        h('div', { class: 'muted' }, 'Add people via your admin or the SQL seed.')
      ));
      return;
    }

    let focusedId = st.focusedPersonId || st.people[0].id;

    const deck = T3D.createDeck({
      items: st.people,
      getId: (p) => p.id,
      renderCard: (p) => {
        const avg = T3D.derive.avgReceived(p.id);
        const given = T3D.derive.avgGiven(p.id);
        const top = st.traits
          .map(t => ({ t, v: T3D.derive.avgReceivedByTrait(p.id, t.id) }))
          .filter(x => x.v != null)
          .sort((a, b) => b.v - a.v)
          .slice(0, 3);
        const bg = colorFromString(p.full_name);
        return `
          <div class="deck-card-inner">
            <div class="card-badge" style="background:${bg}">${esc(p.job_title || p.department || 'Member')}</div>
            <div class="avatar" style="background:${bg}">${esc(initials(p.full_name))}</div>
            <h3>${esc(p.full_name)}</h3>
            <div class="muted">${esc(p.bio || p.email || '—')}</div>
            <div class="score-row">
              <div class="mini"><b>${avg == null ? '—' : fmtNum(avg, 1)}</b><span>Received</span></div>
              <div class="mini"><b>${given == null ? '—' : fmtNum(given, 1)}</b><span>Given</span></div>
              <div class="mini"><b>${top.length ? fmtNum(top[0].v, 0) : '—'}</b><span>${top.length ? esc(top[0].t.name) : 'Top'}</span></div>
            </div>
          </div>
        `;
      },
      onFocus: (p) => { focusedId = p.id; T3D.setState({ focusedPersonId: p.id }); renderDetail(p.id); },
      onSelect: (p) => { openPersonDeep(p.id); }
    });

    leftBody.appendChild(deck.el);
    if (st.focusedPersonId) deck.focusId(st.focusedPersonId);

    function renderDetail(pid) {
      rightBody.innerHTML = '';
      const p = T3D.derive.personById(pid);
      if (!p) return;
      const incoming = st.traits.map(t => ({ t, v: T3D.derive.avgReceivedByTrait(pid, t.id), count: st.scores.filter(s => s.ratee_person_id === pid && s.trait_id === t.id).length }));
      const outgoing = st.traits.map(t => {
        const rows = st.scores.filter(s => s.rater_person_id === pid && s.trait_id === t.id);
        const avg = rows.length ? rows.reduce((a, s) => a + Number(s.score), 0) / rows.length : null;
        return { t, avg, count: rows.length };
      });
      const bg = colorFromString(p.full_name);

      const hero = h('div', { class: 'person-hero' },
        h('div', { class: 'avatar xl', style: { background: bg } }, esc(initials(p.full_name))),
        h('div', { class: 'person-hero-info' },
          h('h1', { class: 'h1' }, esc(p.full_name)),
          h('div', { class: 'sub' }, esc([p.job_title, p.department].filter(Boolean).join(' · ') || 'Person')),
          h('div', { class: 'row', style: { marginTop: '10px', gap: '6px', flexWrap: 'wrap' } },
            p.tags && p.tags.length ? p.tags.map(t => h('span', { class: 'chip' }, t)) : null,
            p.location ? h('span', { class: 'chip' }, h('i', { class: 'fa-solid fa-location-dot' }), p.location) : null,
            p.email ? h('span', { class: 'chip' }, h('i', { class: 'fa-solid fa-envelope' }), p.email) : null
          )
        ),
        h('div', { class: 'person-hero-actions' },
          h('button', {
            class: 'btn primary',
            onclick: () => { T3D.sound.clink(0.12); T3D.modal.openScoreModal({ rateeId: pid, onSaved: () => {} }); }
          }, h('i', { class: 'fa-solid fa-star' }), ' Score'),
          h('button', {
            class: 'btn',
            onclick: () => {
              const prompt = `Analyze personality profile of ${p.full_name}. Incoming trait averages: ` +
                incoming.map(x => `${x.t.name}=${x.v == null ? 'N/A' : fmtNum(x.v, 1)}`).join(', ') +
                `. Outgoing trait averages: ` + outgoing.map(x => `${x.t.name}=${x.avg == null ? 'N/A' : fmtNum(x.avg, 1)}`).join(', ') +
                `. Give a concise, insightful personality summary and 3 actionable observations.`;
              T3D.modal.openAIInsight(prompt);
            }
          }, h('i', { class: 'fa-solid fa-wand-magic-sparkles' }), ' AI insight')
        )
      );

      const scroll = h('div', { class: 'pane-scroll' });
      scroll.appendChild(hero);

      // Traits received
      const rcvd = h('div', { class: 'panel', style: { marginTop: '20px' } },
        h('h4', { class: 'panel-title' }, 'Received (how others see ' + p.full_name.split(' ')[0] + ')')
      );
      const list = h('div', { class: 'stack' });
      incoming.forEach(({ t, v, count }) => {
        const pct = v == null ? 0 : v;
        list.appendChild(h('div', { class: 'trait-row' },
          h('div', { class: 'icon', style: { color: t.color } }, t.icon || '✨'),
          h('div', { class: 'name' }, t.name),
          h('div', { class: 'bar-wrap' }, h('div', { class: 'bar' }, h('i', { style: { width: pct + '%', background: `linear-gradient(90deg, ${t.color}, var(--violet))` } }))),
          h('div', { class: 'val' }, v == null ? '—' : fmtNum(v, 1)),
          h('div', { class: 'muted', style: { fontSize: '11px', width: '42px', textAlign: 'right' } }, count ? count + 'x' : '')
        ));
      });
      rcvd.appendChild(list);
      scroll.appendChild(rcvd);

      // Traits given
      const given = h('div', { class: 'panel', style: { marginTop: '20px' } },
        h('h4', { class: 'panel-title' }, 'Outgoing (how they see others)')
      );
      const list2 = h('div', { class: 'stack' });
      outgoing.forEach(({ t, avg, count }) => {
        const pct = avg == null ? 0 : avg;
        list2.appendChild(h('div', { class: 'trait-row' },
          h('div', { class: 'icon', style: { color: t.color } }, t.icon || '✨'),
          h('div', { class: 'name' }, t.name),
          h('div', { class: 'bar-wrap' }, h('div', { class: 'bar' }, h('i', { style: { width: pct + '%', background: `linear-gradient(90deg, ${t.color}, var(--cyan))` } }))),
          h('div', { class: 'val' }, avg == null ? '—' : fmtNum(avg, 1)),
          h('div', { class: 'muted', style: { fontSize: '11px', width: '42px', textAlign: 'right' } }, count ? count + 'x' : '')
        ));
      });
      given.appendChild(list2);
      scroll.appendChild(given);

      // Matrix: outgoing detailed
      const matrixPanel = h('div', { class: 'panel', style: { marginTop: '20px' } },
        h('h4', { class: 'panel-title' }, 'Detailed matrix — ' + p.full_name.split(' ')[0] + ' rates everyone')
      );
      if (st.people.length > 1 && st.traits.length) {
        const table = h('table', { class: 'matrix' });
        const thead = h('thead');
        const headRow = h('tr');
        headRow.appendChild(h('th', null, 'Trait'));
        st.people.filter(x => x.id !== pid).slice(0, 12).forEach((other) => {
          headRow.appendChild(h('th', { title: other.full_name }, esc(other.full_name.split(' ')[0])));
        });
        thead.appendChild(headRow);
        table.appendChild(thead);
        const tbody = h('tbody');
        st.traits.forEach((t) => {
          const tr = h('tr');
          tr.appendChild(h('td', { style: { textAlign: 'left', fontWeight: '700' } }, h('span', { style: { color: t.color } }, t.icon || '✨'), ' ', t.name));
          st.people.filter(x => x.id !== pid).slice(0, 12).forEach((other) => {
            const s = T3D.derive.scoreFor(pid, other.id, t.id);
            const v = s ? Number(s.score) : null;
            const td = h('td', { class: 'heat' });
            if (v != null) {
              const hue = 260 - (v / 100) * 200;
              td.style.background = `hsl(${hue} 70% 60% / 0.25)`;
              td.appendChild(h('span', null, fmtNum(v, 0)));
            } else {
              td.textContent = '·';
            }
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        matrixPanel.appendChild(table);
      }
      scroll.appendChild(matrixPanel);

      rightBody.appendChild(scroll);
    }
    renderDetail(focusedId);

    function openPersonDeep(pid) {
      // Simple: navigate within the same view by focusing that person's card
      deck.focusId(pid);
    }

    // Listen for realtime changes
    const unsub = T3D.subscribeState(() => {
      // re-render deck when people/traits change
      if (leftBody.querySelector('.deck')) return;
      if (st.loaded) T3D.router.render();
    });
    // cleanup on view change
    const obs = new MutationObserver(() => {
      if (!document.body.contains(view)) { unsub && unsub(); obs.disconnect(); }
    });
    obs.observe(document.getElementById('main'), { childList: true });
  });
})();
