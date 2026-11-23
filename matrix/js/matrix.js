/* matrix.js — 3D matrix engine: stacks of 2D tables */
import { state, esc, icon, faNum, fa, pct, initials, clamp, getPrefs, toast, confirmDialog, openModal, play, haptic, emit, timeAgo } from './core.js';
import { setScore, deleteScore, getScore, addComment, deleteComment, addDispute } from './data.js';

export const MODES = {
  trait: { key: 'trait', label: 'پایه ویژگی', icon: 'sliders', depth: 'ویژگی', row: 'امتیازدهنده', col: 'امتیازگیرنده' },
  ranker: { key: 'ranker', label: 'پایه امتیازدهنده', icon: 'users', depth: 'شخص', row: 'ویژگی', col: 'امتیازگیرنده' },
  target: { key: 'target', label: 'پایه امتیازگیرنده', icon: 'target', depth: 'شخص', row: 'ویژگی', col: 'امتیازدهنده' },
};

const saved = (() => { try { return JSON.parse(sessionStorage.getItem('mx3.mx') || '{}'); } catch { return {}; } })();
export const mx = {
  mode: saved.mode || getPrefs().defaultMode || 'trait',
  stack: saved.stack || 0,
  sort: saved.sort || 'name',
  dir: saved.dir || 1,
  search: '',
  hideEmpty: false,
  privacy: false,
  sel: new Set(),
  focus: null,       // {kind:'person', id}
  auto: null,
  lastCell: null,
};
const persist = () => { try { sessionStorage.setItem('mx3.mx', JSON.stringify({ mode: mx.mode, stack: mx.stack, sort: mx.sort, dir: mx.dir })); } catch { /* ignore */ } };

/* ---------- colors ---------- */
const HEAT = {
  spectrum: ['#1d2740', '#2c5aa8', '#2fb6c9', '#5ef2a1', '#c8ff8f'],
  warm: ['#241c33', '#6f2a5e', '#d64d72', '#ff9a5a', '#ffe066'],
  mono: ['#152033', '#20455f', '#2f7d8c', '#45b3a8', '#7ff0d4'],
};
function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function heatColor(t, alpha = 1) {
  const stops = HEAT[getPrefs().heat] || HEAT.spectrum;
  const x = clamp(t, 0, 1) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x)); const f = x - i;
  const a = hex2rgb(stops[i]); const b = hex2rgb(stops[i + 1]);
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}
const heatInk = (t) => (t > 0.62 ? '#04141a' : '#e7efff');

/* ---------- data helpers ---------- */
const traits = () => state.traits.filter((t) => t.metadata?.active !== false);
const people = () => state.people.filter((p) => !p.metadata?.archived);
export const personName = (id) => state.peopleMap.get(id)?.full_name || 'ناشناس';
export const traitOf = (id) => state.traitMap.get(id);

export function norm(trait, value) {
  if (!trait) return 0;
  const min = Number(trait.min_value ?? 0); const max = Number(trait.max_value ?? 10);
  return clamp((Number(value) - min) / Math.max(0.0001, max - min), 0, 1);
}

function match(p, q) {
  if (!q) return true;
  const s = q.trim().toLowerCase();
  return [p.full_name, p.job_title, p.department, p.handle, ...(p.tags || [])].filter(Boolean).some((v) => String(v).toLowerCase().includes(s));
}
function matchT(t, q) {
  if (!q) return true;
  const s = q.trim().toLowerCase();
  return [t.name, t.key, t.category, t.description].filter(Boolean).some((v) => String(v).toLowerCase().includes(s));
}

function rowItems(st, mode) {
  let arr;
  if (mode === 'trait') arr = people().filter((p) => p.id !== st?.id || true);
  else arr = traits();
  if (mx.search) arr = arr.filter((x) => (mode === 'trait' ? match(x, mx.search) : matchT(x, mx.search)));
  arr = [...arr];
  const avgOf = (item) => {
    const vals = colItems(st, mode).map((c) => cellOf(st, item, c, mode)).filter(Boolean);
    if (!vals.length) return -1;
    return vals.reduce((s, v) => s + norm(v.trait, v.value), 0) / vals.length;
  };
  if (mx.sort === 'name') arr.sort((a, b) => (a.full_name || a.name).localeCompare(b.full_name || b.name, 'fa') * mx.dir);
  else if (mx.sort === 'avg') arr.sort((a, b) => (avgOf(a) - avgOf(b)) * mx.dir);
  else if (mx.sort === 'order') arr.sort((a, b) => ((a.sort_order || 0) - (b.sort_order || 0)) * mx.dir);
  if (mx.hideEmpty) arr = arr.filter((it) => colItems(st, mode).some((c) => cellOf(st, it, c, mode)));
  return arr;
}
function colItems(st, mode) {
  let arr = mx.mode === 'trait' ? people() : people();
  if (mx.search) arr = arr.filter((p) => match(p, mx.search));
  if (mx.hideEmpty) arr = arr.filter((p) => rowItemsSafe(st, mode).some((r) => cellOf(st, r, p, mode)));
  arr = [...arr];
  if (mx.sort === 'avg' && mode === 'trait') {
    const avg = (p) => { const v = rowItemsSafe(st, mode).map((r) => cellOf(st, r, p, mode)).filter(Boolean); return v.length ? v.reduce((s, x) => s + norm(x.trait, x.value), 0) / v.length : -1; };
    arr.sort((a, b) => (avg(a) - avg(b)) * mx.dir);
  } else arr.sort((a, b) => a.full_name.localeCompare(b.full_name, 'fa'));
  return arr;
}
function rowItemsSafe(st, mode) {
  const arr = mode === 'trait' ? people() : traits();
  return mx.search ? arr.filter((x) => (mode === 'trait' ? match(x, mx.search) : matchT(x, mx.search))) : arr;
}
export function stacksFor(mode = mx.mode) {
  if (mode === 'trait') return traits().filter((t) => !mx.search || matchT(t, mx.search) || true).map((t) => ({ id: t.id, name: t.name, sub: t.category || '', color: t.color || 'var(--acc)', icon: t.icon || 'spark', raw: t }));
  return people().map((p) => ({ id: p.id, name: p.full_name, sub: p.job_title || '', color: 'var(--acc)', icon: 'user', raw: p }));
}

export function cellOf(stack, row, col, mode = mx.mode) {
  let traitId, rankerId, targetId;
  if (mode === 'trait') { traitId = stack.id; rankerId = row.id; targetId = col.id; }
  else if (mode === 'ranker') { traitId = row.id; rankerId = stack.id; targetId = col.id; }
  else { traitId = row.id; rankerId = col.id; targetId = stack.id; }
  if (rankerId === targetId) return { self: true, traitId, rankerId, targetId, value: null };
  const s = getScore(traitId, rankerId, targetId);
  const trait = state.traitMap.get(traitId);
  return { score: s, trait, traitId, rankerId, targetId, value: s ? Number(s.value) : null };
}

/* ---------- aggregates ---------- */
export function traitStats(traitId) {
  const arr = state.scores.filter((s) => s.trait_id === traitId && s.ranker_person_id !== s.target_person_id);
  const values = arr.map((s) => Number(s.value));
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const variance = values.length ? values.reduce((a, b) => a + (b - avg) ** 2, 0) / values.length : 0;
  const targets = new Map();
  for (const s of arr) { const cur = targets.get(s.target_person_id) || { sum: 0, n: 0 }; cur.sum += Number(s.value); cur.n++; targets.set(s.target_person_id, cur); }
  const ranked = [...targets.entries()].map(([id, v]) => ({ id, name: personName(id), avg: v.sum / v.n, n: v.n })).sort((a, b) => b.avg - a.avg);
  return { n: values.length, avg, sd: Math.sqrt(variance), ranked, min: values.length ? Math.min(...values) : 0, max: values.length ? Math.max(...values) : 0 };
}

export function personStats(personId) {
  const given = state.scores.filter((s) => s.ranker_person_id === personId && s.ranker_person_id !== s.target_person_id);
  const received = state.scores.filter((s) => s.target_person_id === personId && s.ranker_person_id !== s.target_person_id);
  const byTrait = (arr) => traits().map((t) => {
    const vals = arr.filter((s) => s.trait_id === t.id).map((s) => Number(s.value));
    return { trait: t, n: vals.length, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
  });
  const wavg = (arr) => {
    let sw = 0, sv = 0;
    for (const s of arr) { const t = state.traitMap.get(s.trait_id); const w = Number(t?.weight || 1); sv += Number(s.value) * w; sw += w; }
    return sw ? sv / sw : null;
  };
  return {
    given: given.length, received: received.length,
    avgGiven: wavg(given), avgReceived: wavg(received),
    givenByTrait: byTrait(given), receivedByTrait: byTrait(received),
  };
}

export function coverage() {
  const p = people().length; const t = traits().length;
  const possible = Math.max(1, p * (p - 1) * t);
  return clamp(state.scores.length / possible, 0, 1);
}

/* ---------- main render ---------- */
let hostEl = null;
let tableHost = null;

export function renderMatrix(host) {
  hostEl = host;
  const stacks = stacksFor(mx.mode);
  mx.stack = clamp(mx.stack, 0, Math.max(0, stacks.length - 1));
  const st = stacks[mx.stack] || null;
  const M = MODES[mx.mode];

  host.innerHTML = `
    <div class="pagehead">
      <h2>${icon('layers')} ماتریس ۳بعدی <span class="mattrunc">${fa(MODES[mx.mode].label)}</span></h2>
      <div class="pagehead__sub">عمق: ${esc(M.depth)} · ردیف: ${esc(M.row)} · ستون: ${esc(M.col)}</div>
      <div class="spacer"></div>
      <div class="toolrow">
        <div class="seg" id="mx-modes">
          ${Object.values(MODES).map((m) => `<button data-mode="${m.key}" class="${m.key === mx.mode ? 'is-on' : ''}">${icon(m.icon)} ${esc(m.label)}</button>`).join('')}
        </div>
        <button class="btn btn--sm" id="mx-saveview" title="ذخیره نمای فعلی">${icon('download')} نما</button>
        <button class="btn btn--sm" id="mx-export" title="خروجی CSV">${icon('download')} CSV</button>
      </div>
    </div>

    <div class="mx">
      <div class="mx__bar">
        <div class="searchmini" style="position:relative;min-width:180px;flex:1;max-width:300px">
          ${icon('search')}
          <input id="mx-search" type="search" placeholder="جست‌وجو در ${esc(M.depth === 'ویژگی' ? 'افراد' : 'ویژگی‌ها و افراد')}…" value="${esc(mx.search)}" style="padding-inline-start:30px" />
        </div>
        <button class="btn btn--sm ${mx.hideEmpty ? 'is-on' : ''}" id="mx-hideempty">${icon('filter')} خالی‌ها</button>
        <button class="btn btn--sm ${mx.privacy ? 'is-on' : ''}" id="mx-privacy">${icon(mx.privacy ? 'eye-off' : 'eye')} پنهان</button>
        <div class="seg" id="mx-sort">
          <button data-sort="name" class="${mx.sort === 'name' ? 'is-on' : ''}">الفبا</button>
          <button data-sort="avg" class="${mx.sort === 'avg' ? 'is-on' : ''}">میانگین</button>
          ${mx.mode === 'trait' ? `<button data-sort="order" class="${mx.sort === 'order' ? 'is-on' : ''}">ترتیب</button>` : ''}
        </div>
        <button class="btn btn--sm" id="mx-dir" title="جهت مرتب‌سازی">${icon(mx.dir === 1 ? 'chev-down' : 'chev-up')}</button>
        <div class="mx__bar spacer"></div>
        <button class="btn btn--sm ${mx.auto ? 'is-on' : ''}" id="mx-auto">${icon(mx.auto ? 'pause' : 'play')} چرخش</button>
        <span class="count" id="mx-count"></span>
      </div>

      <div class="mx__body">
        <aside class="stackrail" id="mx-rail">
          <div class="stackrail__head">${icon('layers')} لایه‌ها <span class="spacer"></span><span id="mx-depthlabel">۱/${fa(stacks.length)}</span></div>
          <div class="stackrail__list" id="mx-stacklist"></div>
          <div class="stackrail__foot">
            <div class="depthbar"><i id="mx-depthbar" style="width:0%"></i></div>
            <div class="stackrail__nav">
              <button class="btn btn--sm" id="mx-prev" title="لایه قبل">${icon('chev-right')}</button>
              <button class="btn btn--sm" id="mx-next" title="لایه بعد">${icon('chev-left')}</button>
            </div>
          </div>
        </aside>

        <div class="mx__main">
          <div class="mxpanel">
            <div class="mxpanel__head">
              <div class="mxpanel__title" style="--tc:${esc(st?.color || 'var(--acc)')}">
                <span class="sw"></span>${esc(st?.name || '—')}
                <small>${esc(st?.sub || '')}</small>
              </div>
              <div class="spacer"></div>
              <div class="toolrow" id="mx-bulk" hidden>
                <span class="chip chip--acc" id="mx-selcount">۰</span>
                <button class="btn btn--sm" id="mx-bulkset">${icon('edit')} مقدار</button>
                <button class="btn btn--sm btn--danger" id="mx-bulkdel">${icon('trash')}</button>
                <button class="btn btn--sm" id="mx-bulkclear">${icon('x')}</button>
              </div>
              <button class="btn btn--sm" id="mx-legend-toggle" title="راهنما">${icon('spark')}</button>
            </div>
            <div class="mxpanel__scroll" id="mx-scroll"></div>
            <div class="mxlegend">
              <span>کم</span>
              <div class="mxlegend__scale">${Array.from({ length: 7 }, (_, i) => `<i style="background:${heatColor(i / 6)}"></i>`).join('')}</div>
              <span>زیاد</span>
              <span class="spacer"></span>
              <span><kbd>↑↓←→</kbd> حرکت</span>
              <span><kbd>Enter</kbd> ویرایش</span>
              <span><kbd>0-9</kbd> امتیاز</span>
              <span><kbd>]</kbd><kbd>[</kbd> لایه</span>
              <span class="spacer"></span>
              <span id="mx-stackmeta"></span>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  tableHost = host.querySelector('#mx-scroll');
  host._cleanup = () => { if (mx.auto) { clearInterval(mx.auto); mx.auto = null; } closePop(); };
  renderRail();
  renderTable();
  bind(host);
  updateStatus();
  emit('matrix:render');
}

function renderRail() {
  const list = hostEl?.querySelector('#mx-stacklist');
  if (!list) return;
  const stacks = stacksFor(mx.mode);
  const scrollTop = list.scrollTop;
  list.innerHTML = stacks.map((s, i) => {
    const cov = stackCoverage(s);
    return `<button class="stackcard ${i === mx.stack ? 'is-on' : ''}" data-stack="${i}" style="--tc:${esc(s.color)}">
      <span class="stackcard__sw"></span>
      <span class="stackcard__txt"><strong>${esc(s.name)}</strong><span>${esc(s.sub || '—')}</span></span>
      <span class="stackcard__pct">${pct(cov)}</span>
    </button>`;
  }).join('') || `<div class="empty">${icon('layers')} لایه‌ای نیست</div>`;
  list.scrollTop = scrollTop;
  const label = hostEl.querySelector('#mx-depthlabel');
  if (label) label.textContent = `${fa(mx.stack + 1)}/${fa(stacks.length)}`;
  const bar = hostEl.querySelector('#mx-depthbar');
  if (bar) bar.style.width = `${((mx.stack + 1) / Math.max(1, stacks.length)) * 100}%`;
  const st = stacks[mx.stack];
  const meta = hostEl.querySelector('#mx-stackmeta');
  if (meta && st) {
    const cov = stackCoverage(st);
    meta.innerHTML = `لایه ${fa(mx.stack + 1)} · ${esc(st.name)} · پوشش ${pct(cov)}`;
  }
}

function stackCoverage(st) {
  const stacks = stacksFor(mx.mode);
  if (!st) return 0;
  let total = 0, filled = 0;
  for (const r of rowItems(st, mx.mode)) for (const c of colItems(st, mx.mode)) {
    const cell = cellOf(st, r, c, mx.mode);
    if (cell.self) continue;
    total++; if (cell.score) filled++;
  }
  return total ? filled / total : 0;
}

function renderTable({ keepScroll = false } = {}) {
  if (!tableHost) return;
  const stacks = stacksFor(mx.mode);
  const st = stacks[mx.stack];
  const M = MODES[mx.mode];
  const scrollEl = tableHost;
  const prev = { top: scrollEl.scrollTop, left: scrollEl.scrollLeft };
  if (!st) {
    scrollEl.innerHTML = `<div class="empty">${icon('layers')}<div>لایه‌ای برای نمایش وجود ندارد</div>
      <div class="muted" style="font-size:11px">${state.people.length ? 'یک ویژگی بسازید' : 'برای دیدن ماتریس وارد شوید'}</div>
      ${state.user ? '' : '<button class="btn btn--primary btn--sm" onclick="document.getElementById(\'auth\').hidden=false">ورود</button>'}</div>`;
    return;
  }
  const rows = rowItems(st, mx.mode);
  const cols = colItems(st, mx.mode);
  if (!rows.length || !cols.length) {
    scrollEl.innerHTML = `<div class="empty">${icon('grid')}<div>داده‌ای برای این لایه نیست</div>
      <div class="muted" style="font-size:11px">${!state.user ? 'فهرست افراد برای مهمان قابل خواندن نیست — وارد شوید' : (state.scores.length && !state.people.length ? 'جدول people برای این نقش قابل خواندن نیست (RLS)' : 'افراد یا ویژگی‌ها را کامل کنید')}</div>
      ${state.user ? '' : '<button class="btn btn--primary btn--sm" onclick="document.getElementById(\'auth\').hidden=false">ورود</button>'}</div>`;
    return;
  }
  const headEl = hostEl?.querySelector('.mxpanel__title');
  if (headEl) {
    headEl.style.setProperty('--tc', st.color || 'var(--acc)');
    headEl.innerHTML = `<span class="sw"></span>${esc(st.name)} <small>${esc(st.sub || '')}</small>`;
  }
  const selfPerson = state.people.find((p) => p.user_id === state.user?.id)?.id;

  const head = cols.map((c) => {
    const isSelf = c.id === selfPerson;
    return `<th class="colhead ${mx.focus?.id === c.id ? 'is-hi' : ''} ${isSelf ? 'is-self' : ''}" data-col="${c.id}" title="${esc(c.full_name)}">
      <div class="colhead__inner">
        <div class="colhead__av">${c.avatar_url ? `<img src="${esc(c.avatar_url)}" alt="">` : esc(initials(c.full_name))}</div>
        ${getPrefs().showLabels ? `<div class="colhead__name">${esc(c.full_name)}</div>` : ''}
      </div></th>`;
  }).join('');

  const body = rows.map((r) => {
    const rh = mx.mode === 'trait'
      ? `<div class="rowhead__in"><div class="rowhead__av">${r.avatar_url ? `<img src="${esc(r.avatar_url)}" alt="">` : esc(initials(r.full_name))}</div>
         <div class="rowhead__txt"><strong>${esc(r.full_name)}</strong><span>${esc(r.job_title || '—')}</span></div></div>`
      : `<div class="rowhead__in"><span class="stackcard__sw" style="--tc:${esc(r.color || 'var(--acc)')}"></span>
         <div class="rowhead__txt"><strong>${esc(r.name)}</strong><span>${esc(r.category || '')}</span></div></div>`;
    const isSelf = r.id === selfPerson;
    const cells = cols.map((c) => {
      const cell = cellOf(st, r, c, mx.mode);
      if (cell.self) return `<td class="cellwrap" data-self="1"><div class="mxcell is-empty" style="cursor:not-allowed;opacity:.28" title="خودارزیابی">·</div></td>`;
      const key = `${cell.traitId}|${cell.rankerId}|${cell.targetId}`;
      const trait = cell.trait;
      const t = cell.score ? norm(trait, cell.value) : 0;
      const isSel = mx.sel.has(key);
      const hasTalk = state.comments.some((cm) => cm.trait_id === cell.traitId && cm.ranker_person_id === cell.rankerId && cm.target_person_id === cell.targetId);
      const dispute = state.disputes.some((d) => d.trait_id === cell.traitId && d.target_person_id === cell.targetId && d.status === 'open' && (!d.score_id || d.score_id === cell.score?.id));
      const bg = cell.score ? heatColor(t, 1) : '';
      const ink = cell.score ? heatInk(t) : '';
      return `<td class="cellwrap" data-t="${cell.traitId}" data-r="${cell.rankerId}" data-g="${cell.targetId}" data-key="${key}">
        <div class="mxcell ${cell.score ? '' : 'is-empty'} ${isSel ? 'is-sel' : ''} ${hasTalk ? 'has-talk' : ''} ${dispute ? 'is-dispute' : ''} ${cell.score?.note ? 'has-note' : ''}"
          style="${cell.score ? `background:${bg};color:${ink}` : ''}" data-key="${key}" tabindex="-1"
          title="${esc(trait?.name || '')} · ${esc(personName(cell.rankerId))} → ${esc(personName(cell.targetId))}${cell.score ? ` = ${faNum(cell.value, 2)}` : ''}">
          ${mx.privacy ? (cell.score ? '·' : '') : (cell.score ? faNum(cell.value, trait && (trait.max_value - trait.min_value) > 20 ? 0 : 2) : '')}
          ${cell.score && cell.score.confidence < 0.5 ? '<span class="mxcell__lock">' + icon('eye-off') + '</span>' : ''}
        </div></td>`;
    }).join('');
    return `<tr data-row="${r.id}"><th class="rowhead ${mx.focus?.id === r.id ? 'is-hi' : ''} ${isSelf ? 'is-self' : ''}" data-rowh="${r.id}">${rh}</th>${cells}</tr>`;
  }).join('');

  const colAvg = cols.map((c) => {
    const vals = rows.map((r) => cellOf(st, r, c, mx.mode)).filter((x) => x.score);
    if (!vals.length) return '—';
    return faNum(vals.reduce((s, v) => s + norm(v.trait, v.value), 0) / vals.length * 100, 0) + '٪';
  });
  const foot = `<tfoot><tr><th>میانگین ستون</th>${colAvg.map((v) => `<td>${v}</td>`).join('')}</tr></tfoot>`;

  tableHost.innerHTML = `<table class="mxtable" id="mx-table">
    <thead><tr><th class="corner">${esc(M.row)} ↓ / ${esc(M.col)} ←<br><span style="font-weight:500">${esc(st.name)}</span></th>${head}</tr></thead>
    <tbody>${body}</tbody>${foot}</table>`;
  if (keepScroll) { scrollEl.scrollTop = prev.top; scrollEl.scrollLeft = prev.left; }
  const count = hostEl.querySelector('#mx-count');
  if (count) count.textContent = `${fa(rows.length)}×${fa(cols.length)}`;
}

function updateStatus() {
  const stacks = stacksFor(mx.mode);
  const el = document.getElementById('stat-stack');
  if (el) el.textContent = `لایه ${fa(mx.stack + 1)} از ${fa(stacks.length)}`;
  const sel = document.getElementById('stat-sel');
  if (sel) sel.textContent = mx.sel.size ? `${fa(mx.sel.size)} انتخاب` : '—';
}

/* ---------- interactions ---------- */
function bind(host) {
  host.querySelectorAll('#mx-modes [data-mode]').forEach((b) => b.onclick = () => {
    mx.mode = b.dataset.mode; mx.stack = 0; mx.sel.clear(); mx.focus = null;
    play('tap'); haptic(8); persist(); renderMatrix(host);
  });
  host.querySelector('#mx-search').oninput = debounceFn((v) => { mx.search = v; renderTable(); renderRail(); }, 220);
  host.querySelector('#mx-hideempty').onclick = (e) => { mx.hideEmpty = !mx.hideEmpty; e.currentTarget.classList.toggle('is-on', mx.hideEmpty); play('tap'); renderTable(); };
  host.querySelector('#mx-privacy').onclick = (e) => {
    mx.privacy = !mx.privacy;
    e.currentTarget.classList.toggle('is-on', mx.privacy);
    e.currentTarget.innerHTML = `${icon(mx.privacy ? 'eye-off' : 'eye')} پنهان`;
    renderTable(); play('tap');
  };
  host.querySelectorAll('#mx-sort [data-sort]').forEach((b) => b.onclick = () => {
    mx.sort = b.dataset.sort; host.querySelectorAll('#mx-sort button').forEach((x) => x.classList.toggle('is-on', x === b));
    renderTable(); renderRail(); persist(); play('tap');
  });
  host.querySelector('#mx-dir').onclick = (e) => {
    mx.dir *= -1; e.currentTarget.innerHTML = icon(mx.dir === 1 ? 'chev-down' : 'chev-up'); renderTable(); persist();
  };
  host.querySelector('#mx-auto').onclick = (e) => {
    if (mx.auto) { clearInterval(mx.auto); mx.auto = null; e.currentTarget.classList.remove('is-on'); e.currentTarget.innerHTML = `${icon('play')} چرخش`; }
    else {
      mx.auto = setInterval(() => step(1, true), 2600);
      e.currentTarget.classList.add('is-on'); e.currentTarget.innerHTML = `${icon('pause')} چرخش`; play('start');
    }
  };
  host.querySelector('#mx-prev').onclick = () => step(-1);
  host.querySelector('#mx-next').onclick = () => step(1);

  host.querySelectorAll('[data-stack]').forEach((b) => b.onclick = () => { mx.stack = +b.dataset.stack; play('tap'); renderRail(); renderTable(); updateStatus(); persist(); });
  host.querySelector('#mx-stacklist').addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) < 12) return;
    e.preventDefault(); step(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  // table events
  const table = host.querySelector('#mx-table');
  if (!table) return;
  table.addEventListener('click', (e) => {
    const cellEl = e.target.closest('.mxcell');
    if (cellEl) {
      const td = cellEl.closest('td');
      const ctx = { traitId: td.dataset.t, rankerId: td.dataset.r, targetId: td.dataset.g };
      if (e.shiftKey) { toggleSel(td.dataset.key, cellEl); updateBulk(); return; }
      openCellEditor(cellEl, ctx);
      return;
    }
    const rowH = e.target.closest('[data-rowh]');
    if (rowH) { mx.focus = { kind: mx.mode === 'trait' ? 'person' : 'trait', id: rowH.dataset.rowh }; renderTable({ keepScroll: true }); return; }
    const colH = e.target.closest('[data-col]');
    if (colH) { mx.focus = { kind: 'person', id: colH.dataset.col }; renderTable({ keepScroll: true }); openPersonDrawer(colH.dataset.col); return; }
  });
  table.addEventListener('contextmenu', (e) => {
    const cellEl = e.target.closest('.mxcell'); if (!cellEl) return;
    e.preventDefault();
    const td = cellEl.closest('td');
    openCellMenu(e.clientX, e.clientY, cellEl, { traitId: td.dataset.t, rankerId: td.dataset.r, targetId: td.dataset.g });
  });
  host.querySelector('#mx-bulkclear').onclick = () => { mx.sel.clear(); host.querySelectorAll('.mxcell.is-sel').forEach((c) => c.classList.remove('is-sel')); updateBulk(); };
  host.querySelector('#mx-bulkset').onclick = () => bulkSet(host);
  host.querySelector('#mx-bulkdel').onclick = () => bulkDelete(host);
  host.querySelector('#mx-export').onclick = () => exportMatrix();
  host.querySelector('#mx-saveview').onclick = () => saveViewDialog();
  host.querySelector('#mx-legend-toggle').onclick = () => {
    const legend = host.querySelector('.mxlegend');
    legend.style.display = legend.style.display === 'none' ? 'flex' : 'none';
  };
  updateBulk();
  host.onkeydown = onKeys;
  host.querySelector('#mx-search').value = mx.search;
}

function debounceFn(fn, ms) { let t; return (e) => { const v = e.target.value; clearTimeout(t); t = setTimeout(() => fn(v), ms); }; }

function step(delta, auto = false) {
  const stacks = stacksFor(mx.mode);
  if (!stacks.length) return;
  mx.stack = (mx.stack + delta + stacks.length) % stacks.length;
  renderRail(); renderTable(); updateStatus(); persist();
  if (!auto) play('tap');
}

function toggleSel(key, el) {
  if (mx.sel.has(key)) { mx.sel.delete(key); el.classList.remove('is-sel'); }
  else { mx.sel.add(key); el.classList.add('is-sel'); }
  haptic(6);
}
function updateBulk() {
  const wrap = hostEl?.querySelector('#mx-bulk');
  if (!wrap) return;
  wrap.hidden = mx.sel.size === 0;
  const c = hostEl.querySelector('#mx-selcount');
  if (c) c.textContent = `${fa(mx.sel.size)} انتخاب`;
  const sel = document.getElementById('stat-sel');
  if (sel) sel.textContent = mx.sel.size ? `${fa(mx.sel.size)} انتخاب` : '—';
}

/* ---------- cell editor ---------- */
let pop = null;
function closePop() { if (pop) { pop.remove(); pop = null; } document.removeEventListener('mousedown', outside, true); }
function outside(e) { if (pop && !pop.contains(e.target) && !e.target.closest('.mxcell')) closePop(); }

export function openCellEditor(anchor, ctx) {
  closePop();
  const trait = state.traitMap.get(ctx.traitId);
  if (!trait) return;
  const score = getScore(ctx.traitId, ctx.rankerId, ctx.targetId);
  const prefs = getPrefs();
  const min = Number(trait.min_value ?? 0); const max = Number(trait.max_value ?? 10);
  const step = Number(prefs.scoreStep) || 0.5;
  const value = score ? Number(score.value) : Math.round((min + max) / 2);
  const confidence = score?.confidence ?? 0.75;
  const comments = state.comments.filter((c) => c.trait_id === ctx.traitId && c.ranker_person_id === ctx.rankerId && c.target_person_id === ctx.targetId);
  const editable = !!state.user;

  pop = document.createElement('div');
  pop.className = 'cellpop';
  pop.innerHTML = `
    <div class="cellpop__head">
      <span class="stackcard__sw" style="--tc:${esc(trait.color)}"></span>
      <div class="cellpop__who"><strong>${esc(personName(ctx.rankerId))} → ${esc(personName(ctx.targetId))}</strong>
      <span>${esc(trait.name)} · ${esc(trait.category || '')}</span></div>
      <div class="spacer"></div>
      <button class="iconbtn iconbtn--xs" data-cp="close">${icon('x')}</button>
    </div>
    <div class="cellpop__score">
      <input class="cellpop__num" data-cp="num" type="number" value="${value}" min="${min}" max="${max}" step="${step}" ${editable ? '' : 'disabled'} />
      <div class="cellpop__range">
        <input type="range" data-cp="range" min="${min}" max="${max}" step="${step}" value="${value}" ${editable ? '' : 'disabled'} />
        <div class="cellpop__ticks"><span>${faNum(min)}</span><span>${faNum(max)}</span></div>
      </div>
    </div>
    <div class="cellpop__row">اطمینان <input type="range" data-cp="conf" min="0" max="1" step="0.05" value="${confidence}" style="flex:1" ${editable ? '' : 'disabled'} /><span class="val" data-cp="confv">${fa(Math.round(confidence * 100))}٪</span></div>
    <textarea data-cp="note" placeholder="یادداشت…" rows="2" ${editable ? '' : 'disabled'}>${esc(score?.note || '')}</textarea>
    <div class="cellpop__acts">
      <button class="btn btn--primary btn--sm" data-cp="save" ${editable ? '' : 'disabled'}>${icon('check')} ذخیره</button>
      ${score ? `<button class="btn btn--sm" data-cp="talk">${icon('comment')} ${fa(comments.length)}</button>
        <button class="btn btn--sm btn--danger" data-cp="del" ${editable ? '' : 'disabled'}>${icon('trash')}</button>` : `<button class="btn btn--sm" data-cp="dispute" ${editable ? '' : 'disabled'}>${icon('flag')}</button>`}
    </div>
    <div class="cellpop__meta">${score ? `<span class="chip">${esc(score.source || 'manual')}</span><span>${timeAgo(score.updated_at || score.created_at)}</span>` : '<span>بدون امتیاز</span>'}
      <span class="spacer"></span><span>${editable ? '' : 'فقط‌خواندنی'}</span>
      <button class="iconbtn iconbtn--xs" data-cp="ai" title="پیشنهاد هوش">${icon('brain')}</button>
    </div>`;

  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  const pw = 272, ph = pop.offsetHeight;
  let left = r.left + r.width / 2 - pw / 2;
  let top = r.bottom + 8;
  if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 8);
  left = clamp(left, 8, window.innerWidth - pw - 8);
  pop.style.left = `${left}px`; pop.style.top = `${top}px`;

  const num = pop.querySelector('[data-cp=num]'); const range = pop.querySelector('[data-cp=range]');
  const confV = pop.querySelector('[data-cp=confv]');
  const syncNum = (v) => { num.value = v; range.value = v; };
  range.oninput = () => { syncNum(range.value); play('tick'); };
  num.oninput = () => { range.value = num.value; };
  pop.querySelector('[data-cp=conf]').oninput = (e) => { confV.textContent = `${fa(Math.round(e.target.value * 100))}٪`; };

  pop.querySelector('[data-cp=close]').onclick = closePop;
  pop.querySelector('[data-cp=save]').onclick = async () => {
    const v = Number(num.value);
    if (Number.isNaN(v)) return toast('مقدار نامعتبر', 'err');
    try {
      await setScore({
        traitId: ctx.traitId, rankerId: ctx.rankerId, targetId: ctx.targetId,
        value: clamp(v, min, max), confidence: Number(pop.querySelector('[data-cp=conf]').value),
        note: pop.querySelector('[data-cp=note]').value.trim() || null,
      });
      play('clink'); haptic([10, 30, 10]);
      toast(`ثبت شد · ${trait.name}`, 'ok', 1600);
      closePop(); renderTable({ keepScroll: true }); renderRail();
      emit('scores:changed');
    } catch (err) { play('err'); toast(err.message, 'err', 3600); }
  };
  pop.querySelector('[data-cp=del]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'حذف امتیاز', text: `${trait.name} · ${personName(ctx.rankerId)} → ${personName(ctx.targetId)}`, danger: true, okText: 'حذف' });
    if (!ok) return;
    try { await deleteScore(ctx.traitId, ctx.rankerId, ctx.targetId); play('swoosh'); closePop(); renderTable({ keepScroll: true }); renderRail(); emit('scores:changed'); }
    catch (err) { toast(err.message, 'err'); }
  });
  pop.querySelector('[data-cp=talk]')?.addEventListener('click', () => openThread(ctx));
  pop.querySelector('[data-cp=dispute]')?.addEventListener('click', () => openDispute(ctx));
  pop.querySelector('[data-cp=ai]').onclick = () => {
    closePop();
    import('./ai.js').then((m) => m.askAboutCell(ctx));
  };
  document.addEventListener('mousedown', outside, true);
  setTimeout(() => { if (editable) num.select(); }, 40);
}

function openCellMenu(x, y, el, ctx) {
  closePop();
  const trait = state.traitMap.get(ctx.traitId);
  const score = getScore(ctx.traitId, ctx.rankerId, ctx.targetId);
  pop = document.createElement('div');
  pop.className = 'cellpop'; pop.style.width = '212px'; pop.style.padding = '6px';
  pop.innerHTML = `
    <button class="palette__item" data-m="edit">${icon('edit')} ویرایش</button>
    <button class="palette__item" data-m="talk">${icon('comment')} گفتگو</button>
    <button class="palette__item" data-m="dispute">${icon('flag')} اعتراض</button>
    <button class="palette__item" data-m="copy">${icon('copy')} کپی مقدار</button>
    <button class="palette__item" data-m="row">${icon('users')} سطر این شخص</button>
    <button class="palette__item" data-m="ai">${icon('brain')} تحلیل هوش</button>
    ${score ? `<button class="palette__item" data-m="del" style="color:var(--bad)">${icon('trash')} حذف</button>` : ''}`;
  document.body.appendChild(pop);
  pop.style.left = `${clamp(x - 100, 8, innerWidth - 220)}px`; pop.style.top = `${clamp(y, 8, innerHeight - pop.offsetHeight - 8)}px`;
  pop.querySelector('[data-m=edit]').onclick = () => { closePop(); openCellEditor(el, ctx); };
  pop.querySelector('[data-m=talk]').onclick = () => { closePop(); openThread(ctx); };
  pop.querySelector('[data-m=dispute]').onclick = () => { closePop(); openDispute(ctx); };
  pop.querySelector('[data-m=copy]').onclick = async () => { closePop(); try { await navigator.clipboard.writeText(String(score?.value ?? '')); toast('کپی شد', 'ok', 1200); } catch { toast('کپی نشد', 'err'); } };
  pop.querySelector('[data-m=row]').onclick = () => { closePop(); mx.focus = { kind: 'person', id: ctx.rankerId }; renderTable({ keepScroll: true }); openPersonDrawer(ctx.rankerId); };
  pop.querySelector('[data-m=ai]').onclick = () => { closePop(); import('./ai.js').then((m) => m.askAboutCell(ctx)); };
  pop.querySelector('[data-m=del]')?.addEventListener('click', async () => {
    closePop();
    try { await deleteScore(ctx.traitId, ctx.rankerId, ctx.targetId); play('swoosh'); renderTable({ keepScroll: true }); renderRail(); toast('حذف شد', 'ok', 1200); emit('scores:changed'); }
    catch (e) { toast(e.message, 'err'); }
  });
  document.addEventListener('mousedown', outside, true);
  void trait;
}

/* comments thread */
export function openThread(ctx) {
  const trait = state.traitMap.get(ctx.traitId);
  const list = state.comments.filter((c) => c.trait_id === ctx.traitId && c.ranker_person_id === ctx.rankerId && c.target_person_id === ctx.targetId);
  const body = `<div style="display:flex;flex-direction:column;gap:8px">
    <div class="chip chip--acc">${esc(trait?.name)} · ${esc(personName(ctx.rankerId))} → ${esc(personName(ctx.targetId))}</div>
    <div id="th-list">${list.length ? list.map((c) => `<div class="msg"><span class="msg__role">${icon('user')} کاربر · ${timeAgo(c.created_at)}</span>
      <div class="msg__bubble">${esc(c.body)}</div></div>`).join('') : `<div class="empty">${icon('comment')} هنوز گفتگویی نیست</div>`}</div>
    <textarea id="th-body" placeholder="نظر خود را بنویسید…" rows="3"></textarea>
  </div>`;
  openModal({
    title: 'گفت‌وگوی سلول', body,
    foot: `<div class="spacer"></div><button class="btn" data-close>بستن</button><button class="btn btn--primary" id="th-send">${icon('comment')} ارسال</button>`,
    onMount(node, close) {
      node.querySelector('#th-send').onclick = async () => {
        const text = node.querySelector('#th-body').value.trim();
        if (!text) return;
        try {
          await addComment({ traitId: ctx.traitId, rankerId: ctx.rankerId, targetId: ctx.targetId, body: text });
          play('clink'); haptic(10); toast('ثبت شد', 'ok', 1400); close(); renderTable({ keepScroll: true });
        } catch (e) { toast(e.message, 'err'); }
      };
    },
  });
}

export function openDispute(ctx) {
  const body = `<p class="muted" style="font-size:11.5px">${esc(state.traitMap.get(ctx.traitId)?.name)} · ${esc(personName(ctx.targetId))}</p>
    <textarea id="dp-reason" placeholder="دلیل اعتراض…" rows="3"></textarea>`;
  openModal({
    title: 'ثبت اعتراض', body,
    foot: `<div class="spacer"></div><button class="btn" data-close>انصراف</button><button class="btn btn--danger" id="dp-send">${icon('flag')} ارسال</button>`,
    onMount(node, close) {
      node.querySelector('#dp-send').onclick = async () => {
        const reason = node.querySelector('#dp-reason').value.trim();
        try {
          const score = getScore(ctx.traitId, ctx.rankerId, ctx.targetId);
          await addDispute({ scoreId: score?.id, traitId: ctx.traitId, targetId: ctx.targetId, reason });
          play('err'); toast('اعتراض ثبت شد', 'warn', 2200); close(); renderTable({ keepScroll: true });
        } catch (e) { toast(e.message, 'err'); }
      };
    },
  });
}

/* person drawer */
export async function openPersonDrawer(personId) {
  const { openPersonPanel } = await import('./views/people.js');
  openPersonPanel(personId);
}

/* bulk */
async function bulkSet(host) {
  if (!mx.sel.size) return;
  const keys = [...mx.sel].map((k) => k.split('|'));
  const traitId = keys[0][0]; const trait = state.traitMap.get(traitId);
  if (!trait) return;
  const body = `<div class="field"><span>مقدار برای ${fa(keys.length)} سلول</span>
    <input type="number" id="bulk-val" min="${trait.min_value}" max="${trait.max_value}" step="0.5" value="${Math.round((trait.min_value + trait.max_value) / 2)}"></div>
    <p class="muted" style="font-size:11px">فقط سلول‌های همین ویژگی (${esc(trait.name)}) اعمال می‌شوند.</p>`;
  openModal({
    title: 'تعیین گروهی مقدار', slim: true, body,
    foot: `<div class="spacer"></div><button class="btn" data-close>انصراف</button><button class="btn btn--primary" id="bulk-ok">${icon('check')} اعمال</button>`,
    onMount(node, close) {
      node.querySelector('#bulk-ok').onclick = async () => {
        const v = Number(node.querySelector('#bulk-val').value);
        let done = 0;
        for (const [t, r, g] of keys) {
          if (t !== traitId) continue;
          try { await setScore({ traitId: t, rankerId: r, targetId: g, value: v }); done++; } catch { /* skip */ }
        }
        play('clink2'); haptic([8, 20, 8]); toast(`${fa(done)} سلول به‌روزرسانی شد`, 'ok');
        mx.sel.clear(); close(); renderMatrix(host); emit('scores:changed');
      };
    },
  });
}
async function bulkDelete(host) {
  if (!mx.sel.size) return;
  const ok = await confirmDialog({ title: 'حذف گروهی', text: `${fa(mx.sel.size)} امتیاز حذف شود؟`, danger: true, okText: 'حذف' });
  if (!ok) return;
  let done = 0;
  for (const k of [...mx.sel]) { const [t, r, g] = k.split('|'); try { await deleteScore(t, r, g); done++; } catch { /* skip */ } }
  mx.sel.clear(); play('swoosh'); toast(`${fa(done)} امتیاز حذف شد`, 'ok');
  renderMatrix(host); emit('scores:changed');
}

/* export */
export function exportMatrix() {
  const stacks = stacksFor(mx.mode);
  const st = stacks[mx.stack];
  if (!st) return;
  const rows = rowItems(st, mx.mode); const cols = colItems(st, mx.mode);
  const lines = [];
  lines.push([MODES[mx.mode].row, ...cols.map((c) => c.full_name || c.name)].map(csv).join(','));
  for (const r of rows) {
    const name = r.full_name || r.name;
    const vals = cols.map((c) => { const cell = cellOf(st, r, c, mx.mode); return cell.self ? '' : (cell.value ?? ''); });
    lines.push([name, ...vals].map(csv).join(','));
  }
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `matrix-${mx.mode}-${(st.name || 'stack').replace(/\s+/g, '-')}.csv`; a.click();
  play('save'); toast('CSV دانلود شد', 'ok');
}
const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

async function saveViewDialog() {
  if (!state.user) return toast('برای ذخیره نما وارد شوید', 'warn');
  const body = `<div class="field"><span>نام نما</span><input id="vw-name" placeholder="مثلاً ماتریس مهندسی" value="${esc(MODES[mx.mode].label)} — ${esc(stacksFor(mx.mode)[mx.stack]?.name || '')}"></div>
    <label class="kv"><span class="kv__k">ذخیره به‌عنوان پیش‌فرض</span><button class="switch" id="vw-def" type="button"></button></label>`;
  openModal({
    title: 'ذخیره نما', slim: true, body,
    foot: `<div class="spacer"></div><button class="btn" data-close>انصراف</button><button class="btn btn--primary" id="vw-ok">${icon('download')} ذخیره</button>`,
    onMount(node, close) {
      let def = false;
      node.querySelector('#vw-def').onclick = (e) => { def = !def; e.currentTarget.classList.toggle('is-on', def); };
      node.querySelector('#vw-ok').onclick = async () => {
        const name = node.querySelector('#vw-name').value.trim() || 'نما';
        try {
          const { saveView } = await import('./data.js');
          await saveView({ name, mode: mx.mode, config: { stack: stacksFor(mx.mode)[mx.stack]?.id, sort: mx.sort, dir: mx.dir, hideEmpty: mx.hideEmpty, privacy: mx.privacy, isDefault: def } });
          play('save'); toast('نما ذخیره شد', 'ok'); close();
        } catch (e) { toast(e.message, 'err'); }
      };
    },
  });
}

/* keyboard */
function onKeys(e) {
  if (e.target.matches('input,textarea,select')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const cells = [...(tableHost?.querySelectorAll('.mxcell') || [])];
  const cur = document.activeElement?.classList?.contains('mxcell') ? document.activeElement : null;
  if (e.key === ']' || e.key === 'PageDown') { e.preventDefault(); return step(1); }
  if (e.key === '[' || e.key === 'PageUp') { e.preventDefault(); return step(-1); }
  if (!cells.length) return;
  if (e.key === 'Escape') { mx.sel.clear(); hostEl?.querySelectorAll('.mxcell.is-sel').forEach((c) => c.classList.remove('is-sel')); updateBulk(); return; }
  if (e.key === 'Enter' && cur) {
    e.preventDefault();
    const td = cur.closest('td');
    if (td?.dataset.t) openCellEditor(cur, { traitId: td.dataset.t, rankerId: td.dataset.r, targetId: td.dataset.g });
    return;
  }
  const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  if (arrows.includes(e.key)) {
    e.preventDefault();
    if (!cur) { cells.find((c) => !c.closest('[data-self]'))?.focus(); return; }
    const td = cur.closest('td'); const tr = td.parentElement;
    const rows = [...tableHost.querySelectorAll('tbody tr')];
    const ri = rows.indexOf(tr); const ci = [...tr.children].indexOf(td) - 1;
    let nr = ri, nc = ci;
    if (e.key === 'ArrowUp') nr--;
    if (e.key === 'ArrowDown') nr++;
    if (e.key === 'ArrowRight') nc--; // RTL
    if (e.key === 'ArrowLeft') nc++;
    const target = rows[nr]?.children[nc + 1]?.querySelector('.mxcell');
    target?.focus(); play('tick');
    return;
  }
  if (/^[0-9]$/.test(e.key) && cur) {
    const td = cur.closest('td');
    const trait = state.traitMap.get(td.dataset.t);
    if (!trait) return;
    const max = Number(trait.max_value);
    const v = Math.min(Number(e.key) * (max > 10 ? max / 10 : 1), max);
    e.preventDefault();
    cur.textContent = faNum(v, 0);
    cur.style.background = heatColor(norm(trait, v)); cur.style.color = heatInk(norm(trait, v));
    cur.classList.remove('is-empty');
    haptic(8);
    setScore({ traitId: td.dataset.t, rankerId: td.dataset.r, targetId: td.dataset.g, value: v })
      .then(() => { play('tick'); updateAfterInline(td, cur); })
      .catch((err) => toast(err.message, 'err'));
  }
}

async function updateAfterInline(td, cur) {
  renderRail();
  const key = td.dataset.key;
  const s = getScore(td.dataset.t, td.dataset.r, td.dataset.g);
  if (s) { cur.classList.add('is-flash'); setTimeout(() => cur.classList.remove('is-flash'), 500); }
  void key;
}

