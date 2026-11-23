/* views/deck.js — swipe/click rating deck, practical & fast */
import { state, esc, icon, fa, faNum, toast, play, haptic, getPrefs, errMsg, clamp } from '../core.js';
import { setScore, deleteScore, getScore, startSession, updateSession } from '../data.js';

const dk = {
  rankerId: null, traitId: 'all', queue: [], idx: 0, value: 5, sessionId: null,
  history: [], busy: false, done: 0, startedAt: null,
};

const people = () => state.people.filter((p) => !p.metadata?.archived);
const traits = () => state.traits.filter((t) => t.metadata?.active !== false);

export async function render(host) {
  document.onkeydown = null;
  if (!state.user) {
    host.innerHTML = `<div class="pagehead"><h2>${icon('zap')} دسته کارت</h2></div>
      <div class="empty">${icon('lock')}<div>برای امتیازدهی وارد شوید</div><button class="btn btn--primary" id="dk-login">ورود</button></div>`;
    host.querySelector('#dk-login').onclick = () => { location.href = '#'; document.getElementById('auth').hidden = false; };
    return;
  }
  if (!people().length) {
    host.innerHTML = `<div class="pagehead"><h2>${icon('zap')} دسته کارت</h2></div>
      <div class="empty">${icon('users')}<div>اول افراد را اضافه کنید</div><button class="btn btn--primary" id="dk-person">${icon('plus')} شخص جدید</button></div>`;
    host.querySelector('#dk-person').onclick = () => import('./people.js').then((m) => m.openPersonEditor());
    return;
  }
  if (!dk.rankerId || !people().some((p) => p.id === dk.rankerId)) dk.rankerId = state.people.find((p) => p.user_id === state.user?.id)?.id || people()[0].id;

  if (!dk.queue.length) return renderSetup(host);
  renderCard(host);
}

function renderSetup(host) {
  const ranker = state.peopleMap.get(dk.rankerId);
  const missing = missingCount(dk.rankerId, dk.traitId);
  host.innerHTML = `
    <div class="pagehead">
      <h2>${icon('zap')} دسته کارت</h2>
      <div class="pagehead__sub">امتیازدهی سریع، یک سلول در هر کارت</div>
      <div class="spacer"></div>
      <span class="chip chip--acc">${fa(missing)} سلول خالی</span>
    </div>
    <div class="grid" style="grid-template-columns:1fr 1fr;max-width:900px">
      <section class="panel">
        <div class="panel__head">${icon('user')}<h3>امتیازدهنده</h3></div>
        <div class="panel__body" style="display:flex;flex-direction:column;gap:8px;max-height:320px;overflow:auto">
          ${people().map((p) => `<button class="palette__item ${p.id === dk.rankerId ? 'is-on' : ''}" data-ranker="${p.id}">
            ${icon('user')}<span>${esc(p.full_name)}</span><span class="hint">${esc(p.department || '')}</span>
            ${p.id === ranker?.id ? `<span class="chip chip--acc">انتخاب</span>` : ''}</button>`).join('')}
        </div>
      </section>
      <section class="panel">
        <div class="panel__head">${icon('sliders')}<h3>دامنه ویژگی</h3></div>
        <div class="panel__body" style="display:flex;flex-direction:column;gap:8px;max-height:320px;overflow:auto">
          <button class="palette__item ${dk.traitId === 'all' ? 'is-on' : ''}" data-trait="all">${icon('layers')}<span>همه ویژگی‌ها</span><span class="hint">${fa(traits().length)}</span></button>
          ${traits().map((t) => `<button class="palette__item ${dk.traitId === t.id ? 'is-on' : ''}" data-trait="${t.id}">
            ${icon(t.icon || 'spark')}<span>${esc(t.name)}</span><span class="hint">${esc(t.category || '')}</span></button>`).join('')}
        </div>
      </section>
    </div>
    <div class="deck__bar" style="margin-top:12px;max-width:900px">
      <span class="muted" style="font-size:11.5px">${esc(ranker?.full_name || '—')} → ${fa(missing)} کارت</span>
      <div class="spacer"></div>
      <button class="btn btn--sm" id="dk-gaps">${icon('filter')} فقط خالی‌ها</button>
      <button class="btn btn--sm btn--primary" id="dk-start">${icon('play')} شروع جلسه</button>
    </div>`;

  host.querySelectorAll('[data-ranker]').forEach((b) => b.onclick = () => { dk.rankerId = b.dataset.ranker; play('tap'); render(host); });
  host.querySelectorAll('[data-trait]').forEach((b) => b.onclick = () => { dk.traitId = b.dataset.trait; play('tap'); render(host); });
  host.querySelector('#dk-gaps').onclick = () => buildQueue(true);
  host.querySelector('#dk-start').onclick = () => buildQueue(false);
  host.querySelector('#dk-gaps').dataset.mode = 'gaps';
}

function missingCount(rankerId, traitId) {
  const ts = traitId === 'all' ? traits() : traits().filter((t) => t.id === traitId);
  let n = 0;
  for (const t of ts) for (const p of people()) {
    if (p.id === rankerId) continue;
    if (!getScore(t.id, rankerId, p.id)) n++;
  }
  return n;
}

async function buildQueue(gapsOnly) {
  const ts = dk.traitId === 'all' ? traits() : traits().filter((t) => t.id === dk.traitId);
  const queue = [];
  for (const t of ts) for (const p of people()) {
    if (p.id === dk.rankerId) continue;
    const score = getScore(t.id, dk.rankerId, p.id);
    if (gapsOnly && score) continue;
    queue.push({ traitId: t.id, targetId: p.id, score });
  }
  if (!queue.length) return toast(gapsOnly ? 'سلول خالی نیست — کامل است' : 'کارتی نیست', 'warn');
  // missing cells first, then lowest confidence
  queue.sort((a, b) => (a.score ? 1 : 0) - (b.score ? 1 : 0) || Number(a.score?.confidence ?? 0) - Number(b.score?.confidence ?? 0));
  dk.queue = queue; dk.idx = 0; dk.history = []; dk.done = 0; dk.startedAt = Date.now();
  try {
    const s = await startSession({ rankerId: dk.rankerId, kind: 'deck', spec: { traitId: dk.traitId, total: queue.length, gapsOnly } });
    dk.sessionId = s.id;
  } catch (e) { dk.sessionId = null; console.warn(e.message); }
  play('start'); haptic([8, 20, 8]);
  render(document.getElementById('view'));
}

function currentValue(card) {
  const t = state.traitMap.get(card.traitId);
  if (card.score) return Number(card.score.value);
  return Math.round(((t.min_value ?? 0) + (t.max_value ?? 10)) / 2);
}

function renderCard(host) {
  const card = dk.queue[dk.idx];
  if (!card) return finish(host);
  const t = state.traitMap.get(card.traitId);
  const p = state.peopleMap.get(card.targetId);
  const ranker = state.peopleMap.get(dk.rankerId);
  const v = dk.value ?? currentValue(card);
  dk.value = v;
  const min = Number(t.min_value ?? 0); const max = Number(t.max_value ?? 10);
  const stp = Number(getPrefs().scoreStep) || 0.5;
  const quick = [];
  for (let i = min; i <= max; i += Math.max(1, Math.round((max - min) / 5))) quick.push(i);
  if (quick[quick.length - 1] !== max) quick.push(max);

  host.innerHTML = `
    <div class="pagehead">
      <h2>${icon('zap')} دسته کارت</h2>
      <div class="pagehead__sub">${esc(ranker?.full_name || '')} · ${esc(t.name)}</div>
      <div class="spacer"></div>
      <div class="toolrow">
        <span class="deck__counter">${fa(dk.idx + 1)} / ${fa(dk.queue.length)}</span>
        <button class="btn btn--sm" id="dk-exit">${icon('x')} پایان</button>
      </div>
    </div>
    <div class="deck">
      <div class="deck__stage" id="dk-stage">
        <div class="deck__card" id="dk-card" style="--tc:${esc(t.color)}">
          <div class="deck__top">
            <span class="deck__trait">${icon(t.icon || 'spark')} ${esc(t.name)}</span>
            <div class="spacer" style="flex:1"></div>
            <span class="chip">${esc(ranker?.full_name || '')} →</span>
          </div>
          <div class="deck__who">
            <h3>${esc(p?.full_name || '—')}</h3>
            <p>${esc(p?.job_title || '')}${p?.department ? ' · ' + esc(p.department) : ''}</p>
          </div>
          <div class="deck__big"><b id="dk-value">${faNum(v, 1)}</b><span>از ${faNum(min)} تا ${faNum(max)}</span></div>
          <input type="range" id="dk-range" min="${min}" max="${max}" step="${stp}" value="${v}">
          <div class="deck__dots" id="dk-quick">${quick.map((q) => `<button data-v="${q}" class="${Number(q) === Number(v) ? 'is-on' : ''}">${fa(q)}</button>`).join('')}</div>
          <div class="deck__hint"><span>→ ذخیره و بعدی</span><span>← رد کردن</span></div>
          <span class="deck__grav" id="dk-grav">کشیدن کارت</span>
        </div>
      </div>
      <div class="deck__bar">
        <button class="btn btn--sm" id="dk-prev" ${dk.idx === 0 ? 'disabled' : ''}>${icon('chev-right')} قبلی</button>
        <button class="btn btn--sm" id="dk-undo">${icon('undo')} بازگردانی</button>
        <div class="spacer"></div>
        <div class="deck__counter">${fa(dk.done)} ثبت · ${fa(dk.queue.length - dk.idx - 1)} مانده</div>
        <div class="spacer"></div>
        <button class="btn btn--sm" id="dk-skip">${icon('x')} رد</button>
        <button class="btn btn--primary" id="dk-save">${icon('check')} ذخیره ${icon('chev-left')}</button>
      </div>
    </div>`;

  const valueEl = host.querySelector('#dk-value');
  const range = host.querySelector('#dk-range');
  const setV = (nv) => {
    dk.value = clamp(Number(nv), min, max);
    valueEl.textContent = faNum(dk.value, 1);
    range.value = dk.value;
    host.querySelectorAll('#dk-quick button').forEach((b) => b.classList.toggle('is-on', Number(b.dataset.v) === Number(dk.value)));
    play('tick');
  };
  range.oninput = () => setV(range.value);
  host.querySelectorAll('#dk-quick button').forEach((b) => b.onclick = () => setV(b.dataset.v));
  host.querySelector('#dk-skip').onclick = () => { play('swoosh'); dk.idx++; dk.value = null; renderCard(host); };
  host.querySelector('#dk-prev').onclick = () => { if (dk.idx > 0) { dk.idx--; dk.value = null; render(document.getElementById('view')); } };
  host.querySelector('#dk-save').onclick = () => saveCard(host, card);
  host.querySelector('#dk-exit').onclick = () => { dk.queue = []; play('drop'); render(document.getElementById('view')); };
  host.querySelector('#dk-undo').onclick = async () => {
    const last = dk.history.pop();
    if (!last) return toast('چیزی برای بازگردانی نیست', 'warn');
    try {
      if (last.prev == null) await deleteScore(last.traitId, last.rankerId, last.targetId);
      else await setScore({ traitId: last.traitId, rankerId: last.rankerId, targetId: last.targetId, value: last.prev });
      dk.idx = Math.max(0, dk.idx - 1); dk.value = null; play('swoosh'); toast('بازگردانده شد', 'ok', 1400);
      render(document.getElementById('view'));
    } catch (e) { toast(errMsg(e), 'err'); }
  };

  // drag
  const cardEl = host.querySelector('#dk-card');
  let sx = 0, dx = 0, drag = false;
  cardEl.addEventListener('pointerdown', (e) => {
    if (e.target.closest('input,button')) return;
    drag = true; sx = e.clientX; dx = 0; cardEl.classList.add('is-drag'); cardEl.setPointerCapture(e.pointerId);
  });
  cardEl.addEventListener('pointermove', (e) => {
    if (!drag) return;
    dx = e.clientX - sx;
    cardEl.style.transform = `translateX(${dx}px) rotate(${dx * 0.04}deg)`;
    host.querySelector('#dk-grav').textContent = dx > 0 ? 'ذخیره' : 'رد';
  });
  cardEl.addEventListener('pointerup', () => {
    if (!drag) return;
    drag = false; cardEl.classList.remove('is-drag'); cardEl.style.transform = '';
    if (Math.abs(dx) > 90) {
      if (dx > 0) saveCard(host, card);
      else { cardEl.classList.add('is-out-l'); play('swoosh'); setTimeout(() => { dk.idx++; dk.value = null; renderCard(host); }, 160); }
    } else { host.querySelector('#dk-grav').textContent = 'کشیدن کارت'; }
  });
  cardEl.addEventListener('pointercancel', () => { drag = false; cardEl.classList.remove('is-drag'); cardEl.style.transform = ''; });

  const keyHandler = (e) => {
    if (e.target.matches('input,textarea')) return;
    if (/^[0-9]$/.test(e.key)) { setV(Number(e.key)); e.preventDefault(); }
    if (e.key === 'Enter') { e.preventDefault(); saveCard(host, card); }
    if (e.key === 'ArrowRight') { e.preventDefault(); saveCard(host, card); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); dk.idx++; dk.value = null; renderCard(host); }
  };
  document.onkeydown = keyHandler;
  host._cleanup = () => { document.onkeydown = null; };
}

async function saveCard(host, card) {
  if (dk.busy) return;
  dk.busy = true;
  const prev = card.score ? Number(card.score.value) : null;
  try {
    await setScore({ traitId: card.traitId, rankerId: dk.rankerId, targetId: card.targetId, value: dk.value, confidence: card.score?.confidence ?? 0.8 });
    dk.history.push({ traitId: card.traitId, rankerId: dk.rankerId, targetId: card.targetId, prev });
    dk.done++;
    play('clink'); haptic([6, 18, 6]);
    const cardEl = host.querySelector('#dk-card');
    cardEl?.classList.add('is-out-r');
    dk.idx++; dk.value = null;
    setTimeout(() => renderCard(host), 140);
    if (dk.sessionId && dk.done % 3 === 0) {
      updateSession(dk.sessionId, { rated_count: dk.done, progress: { done: dk.done, total: dk.queue.length } }).catch(() => {});
    }
    window.mx.paintStats();
  } catch (e) { toast(errMsg(e), 'err', 3800); play('err'); }
  finally { dk.busy = false; }
}

async function finish(host) {
  document.onkeydown = null;
  dk.queue = [];
  if (dk.sessionId) {
    updateSession(dk.sessionId, { status: 'done', rated_count: dk.done, finished_at: new Date().toISOString(), progress: { done: dk.done, total: dk.queue.length } }).catch(() => {});
  }
  play('clink2'); haptic([10, 30, 10]);
  const mins = Math.max(1, Math.round((Date.now() - (dk.startedAt || Date.now())) / 60000));
  host.innerHTML = `<div class="pagehead"><h2>${icon('check')} جلسه تمام شد</h2></div>
    <div class="grid grid--3" style="max-width:760px">
      <div class="kpi"><div class="kpi__label">${icon('check')} ثبت‌شده</div><div class="kpi__value">${fa(dk.done)}</div></div>
      <div class="kpi"><div class="kpi__label">${icon('hourglass')} زمان</div><div class="kpi__value">${fa(mins)}<span style="font-size:12px"> دقیقه</span></div></div>
      <div class="kpi"><div class="kpi__label">${icon('zap')} سرعت</div><div class="kpi__value">${fa(Math.round(dk.done / Math.max(1, mins)))}<span style="font-size:12px">/دقیقه</span></div></div>
    </div>
    <div class="toolrow" style="margin-top:12px">
      <button class="btn btn--primary" id="dk-again">${icon('play')} جلسه جدید</button>
      <button class="btn" id="dk-matrix">${icon('layers')} دیدن ماتریس</button>
    </div>`;
  host.querySelector('#dk-again').onclick = () => { dk.queue = []; dk.idx = 0; dk.sessionId = null; render(host); };
  host.querySelector('#dk-matrix').onclick = () => { dk.queue = []; window.mx.navigate('matrix'); };
}
