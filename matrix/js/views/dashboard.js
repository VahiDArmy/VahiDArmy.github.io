/* views/dashboard.js */
import { state, esc, icon, fa, faNum, pct, timeAgo, initials, play, toast } from '../core.js';
import { traitStats, personStats, coverage } from '../matrix.js';
import { fetchEvents } from '../data.js';

const traitList = () => state.traits.filter((t) => t.metadata?.active !== false);
const peopleList = () => state.people.filter((p) => !p.metadata?.archived);

export async function render(host) {
  const people = peopleList(); const traits = traitList();
  const cov = coverage();
  const openDisputes = state.disputes.filter((d) => d.status === 'open');
  const avgConf = state.scores.length ? state.scores.reduce((s, x) => s + Number(x.confidence ?? 0), 0) / state.scores.length : 0;
  const traitAgg = traits.map((t) => ({ t, s: traitStats(t.id) })).filter((x) => x.s.n > 0);
  const peopleAgg = people.map((p) => ({ p, s: personStats(p.id) }))
    .filter((x) => x.s.received > 0).sort((a, b) => (b.s.avgReceived || 0) - (a.s.avgReceived || 0));
  const top = peopleAgg.slice(0, 5);
  const low = [...peopleAgg].reverse().slice(0, 5);

  host.innerHTML = `
    <div class="pagehead">
      <h2>${icon('grid')} داشبورد</h2>
      <div class="pagehead__sub">${fa(state.scores.length)} امتیاز در ${fa(traits.length)} لایه · ${timeAgo(state.lastSync)}</div>
      <div class="spacer"></div>
      <div class="toolrow">
        <button class="btn btn--sm" id="db-person">${icon('plus')} شخص</button>
        <button class="btn btn--sm" id="db-trait">${icon('plus')} ویژگی</button>
        <button class="btn btn--sm" id="db-deck">${icon('zap')} امتیازدهی سریع</button>
        <button class="btn btn--sm btn--primary" id="db-ai">${icon('brain')} تحلیل هوش</button>
      </div>
    </div>

    <div class="grid grid--4" style="margin-bottom:12px">
      ${kpi('افراد', fa(people.length), 'users', `${fa(state.people.filter((p) => p.status && p.status !== 'not_in_site').length)} فعال`)}
      ${kpi('ویژگی‌ها', fa(traits.length), 'sliders', `${fa(traits.filter((t) => t.is_core).length)} هسته‌ای`)}
      ${kpi('پوشش ماتریس', pct(cov), 'layers', `${fa(state.scores.length)} از ${fa(people.length * (people.length - 1) * traits.length)} سلول`)}
      ${kpi('اعتراض باز', fa(openDisputes.length), 'flag', `اطمینان میانگین ${pct(avgConf)}`)}
    </div>

    <div class="grid" style="grid-template-columns:1.35fr .9fr;margin-bottom:12px">
      <section class="panel">
        <div class="panel__head">${icon('sliders')}<h3>میانگین لایه‌ها</h3><div class="spacer"></div><span class="count">${fa(traitAgg.length)} ویژگی</span></div>
        <div class="panel__body" style="display:flex;flex-direction:column;gap:8px;max-height:330px;overflow:auto">
          ${traitAgg.sort((a, b) => b.s.avg - a.s.avg).map(({ t, s }) => `
            <button class="traitbar" data-trait="${t.id}" style="text-align:right;background:none;border:0;cursor:pointer">
              <div class="traitbar__top"><span class="stackcard__sw" style="--tc:${esc(t.color)}"></span>
                <span>${esc(t.name)}</span><span class="chip" style="font-size:9px">${fa(s.n)}</span>
                <span class="val">${faNum(s.avg, 1)}</span></div>
              <div class="traitbar__track"><i style="width:${((s.avg - t.min_value) / Math.max(1, t.max_value - t.min_value)) * 100}%;background:${esc(t.color)}"></i></div>
            </button>`).join('') || empty('ویژگی‌ای نیست')}
        </div>
      </section>

      <section class="panel">
        <div class="panel__head">${icon('target')}<h3>پوشش لایه‌ها</h3><div class="spacer"></div><span class="count">${pct(cov)}</span></div>
        <div class="panel__body" style="display:flex;flex-direction:column;gap:7px;max-height:330px;overflow:auto">
          ${traits.map((t) => {
            const n = state.scores.filter((s) => s.trait_id === t.id).length;
            const possible = Math.max(1, people.length * (people.length - 1));
            return `<div class="traitbar"><div class="traitbar__top"><span>${esc(t.name)}</span><span class="val">${pct(n / possible)}</span></div>
              <div class="traitbar__track"><i style="width:${(n / possible) * 100}%;background:${esc(t.color)}"></i></div></div>`;
          }).join('') || empty('—')}
        </div>
      </section>
    </div>

    <div class="grid grid--3" style="margin-bottom:12px">
      <section class="panel">
        <div class="panel__head">${icon('spark')}<h3>بهترین‌ها</h3><div class="spacer"></div><span class="count">میانگین وزنی</span></div>
        <div class="panel__body" style="display:flex;flex-direction:column;gap:7px">
          ${top.map(({ p, s }, i) => rankRow(p, s.avgReceived, i + 1, 'var(--ok)')).join('') || empty('داده کافی نیست')}
        </div>
      </section>
      <section class="panel">
        <div class="panel__head">${icon('flag')}<h3>پایین‌ترین‌ها</h3><div class="spacer"></div><span class="count">نیازمند بررسی</span></div>
        <div class="panel__body" style="display:flex;flex-direction:column;gap:7px">
          ${low.map(({ p, s }, i) => rankRow(p, s.avgReceived, i + 1, 'var(--bad)')).join('') || empty('داده کافی نیست')}
        </div>
      </section>
      <section class="panel">
        <div class="panel__head">${icon('zap')}<h3>میان‌برها</h3><div class="spacer"></div></div>
        <div class="panel__body" style="display:flex;flex-direction:column;gap:6px">
          <button class="palette__item" data-go="matrix">${icon('layers')} ماتریس ۳بعدی <span class="hint">M</span></button>
          <button class="palette__item" data-go="deck">${icon('zap')} دسته کارت <span class="hint">D</span></button>
          <button class="palette__item" data-go="people">${icon('users')} افراد <span class="hint">P</span></button>
          <button class="palette__item" data-go="traits">${icon('sliders')} ویژگی‌ها</button>
          <button class="palette__item" id="db-export">${icon('download')} خروجی کامل JSON</button>
          <button class="palette__item" id="db-disputes">${icon('flag')} اعتراض‌های باز <span class="hint">${fa(openDisputes.length)}</span></button>
        </div>
      </section>
    </div>

    <div class="grid grid--2">
      <section class="panel">
        <div class="panel__head">${icon('brain')}<h3>آخرین اجراهای هوش</h3><div class="spacer"></div><span class="count">${fa(state.aiRuns.length)}</span></div>
        <div class="panel__body" style="max-height:230px;overflow:auto;display:flex;flex-direction:column;gap:6px">
          ${state.aiRuns.slice(0, 8).map((r) => `<div class="kv"><span class="kv__k">${esc((r.model_slug || '—').split('/').pop())} · ${esc(r.kind)}</span>
            <span class="chip ${r.status === 'ok' ? 'chip--ok' : 'chip--bad'}">${esc(r.status)}</span><span class="muted" style="font-size:10px">${timeAgo(r.created_at)}</span></div>`).join('') || empty('اجرایی ثبت نشده')}
        </div>
      </section>
      <section class="panel">
        <div class="panel__head">${icon('db')}<h3>رویدادهای اخیر</h3><div class="spacer"></div><button class="btn btn--sm" id="db-ev-refresh">${icon('refresh')}</button></div>
        <div class="panel__body" id="db-events" style="max-height:230px;overflow:auto;font-size:11px;color:var(--ink-3)">در حال بارگذاری…</div>
      </section>
    </div>`;

  host.querySelectorAll('[data-trait]').forEach((b) => b.onclick = () => {
    import('../matrix.js').then((m) => {
      window.mx.navigate('matrix');
      setTimeout(() => { m.mx.mode = 'trait'; m.mx.stack = Math.max(0, m.stacksFor('trait').findIndex((s) => s.id === b.dataset.trait)); m.renderMatrix(document.getElementById('view')); }, 120);
    });
  });
  host.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => window.mx.navigate(b.dataset.go));
  host.querySelector('#db-person').onclick = () => import('./people.js').then((m) => m.openPersonEditor());
  host.querySelector('#db-trait').onclick = () => import('./traits.js').then((m) => m.openTraitEditor());
  host.querySelector('#db-deck').onclick = () => window.mx.navigate('deck');
  host.querySelector('#db-ai').onclick = () => import('../ai.js').then((m) => m.openPanel('analyze'));
  host.querySelector('#db-disputes').onclick = () => window.mx.navigate('admin');
  host.querySelector('#db-export').onclick = () => {
    const data = { exported_at: new Date().toISOString(), people: state.people, traits: state.traits, scores: state.scores, comments: state.comments, disputes: state.disputes, views: state.views };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'matrix3d-export.json'; a.click();
    play('save'); toast('خروجی گرفته شد', 'ok');
  };
  host.querySelectorAll('.rankrow').forEach((b) => b.onclick = () => import('./people.js').then((m) => m.openPersonPanel(b.dataset.person)));

  const loadEvents = async () => {
    const box = host.querySelector('#db-events'); if (!box) return;
    try {
      const evts = await fetchEvents(40);
      box.innerHTML = evts.length ? evts.map((e) => `<div class="kv"><span class="kv__k">${esc(e.kind)}${e.label ? ` · ${esc(e.label)}` : ''}</span><span>${timeAgo(e.created_at)}</span></div>`).join('') : empty('رویدادی نیست');
    } catch (err) { box.innerHTML = `<span class="muted">${esc(err.message)}</span>`; }
  };
  host.querySelector('#db-ev-refresh').onclick = loadEvents;
  loadEvents();
}

function kpi(label, value, ic, meta) {
  return `<div class="kpi"><div class="kpi__label">${icon(ic)} ${label}</div><div class="kpi__value">${value}</div><div class="kpi__meta">${esc(meta)}</div></div>`;
}
function rankRow(p, avg, i, color) {
  return `<button class="rankrow palette__item" data-person="${p.id}" style="gap:8px">${icon('grip')}
    <span style="width:18px;color:var(--ink-3);font-size:10px">${fa(i)}</span>
    <span class="avatar avatar--sm" style="background:${color}">${p.avatar_url ? `<img src="${esc(p.avatar_url)}">` : esc(initials(p.full_name))}</span>
    <span style="display:flex;flex-direction:column;line-height:1.2;text-align:right"><strong style="font-size:11.5px">${esc(p.full_name)}</strong>
    <span style="font-size:9.5px;color:var(--ink-3)">${esc(p.department || p.job_title || '—')}</span></span>
    <span class="hint" style="font-weight:700;color:${color}">${faNum(avg, 2)}</span></button>`;
}
function empty(t) { return `<div class="empty">${icon('spark')} ${esc(t)}</div>`; }
