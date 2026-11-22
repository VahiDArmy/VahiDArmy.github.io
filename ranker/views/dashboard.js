import { store } from '../lib/store.js';
import { avatarHtml, esc, scoreColor } from '../lib/ui.js';

export default function Dashboard(root) {
  function render() {
    const people = store.people;
    const traits = store.traits;
    const scores = store.scores;
    const coverage = store.coverage();

    // Leaderboard (people by average score received)
    const leaders = people.map(p => ({
      person: p,
      avg: store.averageReceived(p.id),
      count: scores.filter(s => s.target_id === p.id).length
    })).filter(x => x.avg !== null).sort((a, b) => b.avg - a.avg).slice(0, 8);

    const topTraits = traits.map(t => {
      const tScores = scores.filter(s => s.trait_id === t.id);
      const avg = tScores.length ? tScores.reduce((a, s) => a + Number(s.score), 0) / tScores.length : 0;
      return { trait: t, avg, count: tScores.length };
    }).sort((a, b) => b.avg - a.avg);

    const recent = [...scores].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 8);
    const personMap = new Map(people.map(p => [p.id, p]));
    const traitMap = new Map(traits.map(t => [t.id, t]));

    root.innerHTML = `
      <div class="view-pad">
        <div class="dash-grid">
          <div class="stat-card"><div class="stat-label">People</div><div class="stat-value grad">${people.length}</div><div class="stat-sub">in the cube</div></div>
          <div class="stat-card"><div class="stat-label">Traits</div><div class="stat-value grad">${traits.length}</div><div class="stat-sub">dimensions</div></div>
          <div class="stat-card"><div class="stat-label">Scores</div><div class="stat-value grad">${scores.length}</div><div class="stat-sub">filled cells</div></div>
          <div class="stat-card"><div class="stat-label">Coverage</div><div class="stat-value grad">${coverage}%</div><div class="stat-sub">of the cube</div></div>
        </div>

        <div class="dash-row">
          <div class="panel">
            <div class="panel-title"><i class="fa-solid fa-trophy"></i> Leaderboard — most respected</div>
            ${leaders.length ? leaders.map((l, i) => `
              <div class="leader-row">
                <div class="leader-rank ${i < 3 ? 'top' + (i + 1) : ''}">${i + 1}</div>
                ${avatarHtml(l.person, 36)}
                <div class="leader-info">
                  <div class="leader-name">${esc(l.person.full_name)}</div>
                  <div class="leader-sub">${esc(l.person.job_title || '—')} · ${l.count} score${l.count === 1 ? '' : 's'}</div>
                </div>
                <div class="leader-score">${l.avg.toFixed(1)}</div>
              </div>
            `).join('') : `<div class="empty">No scores yet. Swipe or open the Matrix.</div>`}
          </div>

          <div class="panel">
            <div class="panel-title"><i class="fa-solid fa-layer-group"></i> Trait averages</div>
            ${topTraits.length ? topTraits.map(t => {
              const pct = Math.round(((t.avg + 10) / 20) * 100);
              return `
                <div style="padding:8px 0;border-bottom:1px solid var(--border)">
                  <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600">
                    <span><i class="fa-solid fa-${esc(t.trait.icon || 'sparkles')}" style="color:${esc(t.trait.color || '#a855f7')};margin-right:8px"></i>${esc(t.trait.name)}</span>
                    <span style="font-family:var(--mono);color:${t.avg > 0 ? '#4ade80' : t.avg < 0 ? '#f43f5e' : 'var(--text-faint)'}">${t.avg.toFixed(1)}</span>
                  </div>
                  <div class="bar"><div class="bar-fill" style="width:${pct}%;background:${t.trait.color || 'var(--accent)'}"></div></div>
                </div>
              `;
            }).join('') : `<div class="empty">No traits yet.</div>`}
          </div>
        </div>

        <div class="panel">
          <div class="panel-title"><i class="fa-solid fa-bolt"></i> Recent activity</div>
          ${recent.length ? `<div style="display:flex;flex-direction:column;gap:8px">
            ${recent.map(s => {
              const r = personMap.get(s.ranker_id);
              const tg = personMap.get(s.target_id);
              const tr = traitMap.get(s.trait_id);
              if (!r || !tg || !tr) return '';
              return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.03)">
                ${avatarHtml(r, 24)}
                <span style="font-size:13px;font-weight:500">${esc(r.full_name)}</span>
                <span style="color:var(--text-faint);font-size:12px">scored</span>
                <span style="font-size:13px;font-weight:500">${esc(tg.full_name)}</span>
                <span class="tag" style="background:rgba(168,85,247,.15)">${esc(tr.name)}</span>
                <span style="margin-left:auto;font-family:var(--mono);font-weight:600;color:${Number(s.score) > 0 ? '#4ade80' : Number(s.score) < 0 ? '#f43f5e' : 'var(--text-faint)'}">${Number(s.score) > 0 ? '+' : ''}${Number(s.score)}</span>
              </div>`;
            }).join('')}
          </div>` : `<div class="empty">No activity yet.</div>`}
        </div>
      </div>
    `;
  }
  render();
  const unsub = store.on(render);
  return { destroy: unsub };
}
