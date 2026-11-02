import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
// Same Supabase project + same session key as office/ and madacto/ → one login for all three systems.
const sb = createClient('https://nvmevqkaovazhmoznusf.supabase.co', 'sb_publishable_AuneSCRLhrKKDeK8q7kJtw_Bg4VNHgE',
  { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'office-auth' } });
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fa = n => Number(n).toLocaleString('fa-IR');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = $('#view'), INIT = [1, 3, 5, 7], COL = ['#5eead4', '#a5b4fc', '#f9a8d4', '#fcd34d'];
const ST = { lobby: 'در انتظار بازیکن', live: 'در جریان', done: 'پایان‌یافته' };
let me, myName, cur = {}, timer, subscribed, isAdmin = false;
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600) };

/* ---------- FX: drifting starfield + particle bursts ---------- */
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches, dpr = devicePixelRatio || 1;
const sky = $('#sky'), fx = $('#fx'), sc = sky.getContext('2d'), fc = fx.getContext('2d');
let W, H, stars = [], ps = [];
const fit = () => {
  W = sky.width = fx.width = innerWidth * dpr; H = sky.height = fx.height = innerHeight * dpr;
  stars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: (Math.random() * 1.5 + .4) * dpr, p: Math.random() * 6, v: calm ? 0 : Math.random() * .12 + .03 }));
};
addEventListener('resize', fit); fit();
function burst(x, y, col, n = 20, spd = 5) {
  if (calm) return;
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = (Math.random() * spd + 1) * dpr; ps.push({ x: x * dpr, y: y * dpr, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5 * dpr, l: 1, c: col, r: (Math.random() * 3 + 1.5) * dpr }) }
}
const confetti = () => COL.concat(COL).forEach((c, i) => setTimeout(() => burst(innerWidth * (.1 + Math.random() * .8), innerHeight * .25, c, 40, 8), i * 150));
(function frame(t) {
  sc.clearRect(0, 0, W, H); fc.clearRect(0, 0, W, H); sc.fillStyle = '#e9d5ff';
  for (const s of stars) { s.y -= s.v; if (s.y < 0) s.y = H; sc.globalAlpha = .3 + .35 * Math.sin(t / 900 + s.p); sc.beginPath(); sc.arc(s.x, s.y, s.r, 0, 6.283); sc.fill() }
  ps = ps.filter(p => p.l > 0);
  for (const p of ps) { p.x += p.vx; p.y += p.vy; p.vy += .12 * dpr; p.l -= .017; fc.globalAlpha = Math.max(p.l, 0); fc.fillStyle = p.c; fc.shadowColor = p.c; fc.shadowBlur = 10 * dpr; fc.beginPath(); fc.arc(p.x, p.y, p.r * p.l + .5, 0, 6.283); fc.fill() }
  requestAnimationFrame(frame);
})(0);

/* ---------- Auth (same users as office / madacto) ---------- */
function authView() {
  $('#tabs').hidden = true; $('#who').innerHTML = ''; let up = false;
  const draw = () => {
    view.innerHTML = `<form class="card auth" id="af"><h1>نیم</h1><p class="sub">نبرد مهره‌ها — با همان حساب اداره و ماداکتو وارد شو</p>
      ${up ? '<input name="dn" placeholder="نام نمایشی" required maxlength="40">' : ''}
      <input name="em" type="email" placeholder="ایمیل" required autocomplete="email" dir="ltr">
      <input name="pw" type="password" placeholder="رمز عبور" required minlength="6" autocomplete="${up ? 'new-password' : 'current-password'}" dir="ltr">
      <p class="msg" id="am"></p><button class="btn">${up ? 'ساخت حساب' : 'ورود'}</button>
      <button type="button" class="link" id="sw">${up ? 'حساب دارم — ورود' : 'حساب ندارم — ثبت‌نام'}</button></form>`;
    $('#sw').onclick = () => { up = !up; draw() };
    $('#af').onsubmit = async e => {
      e.preventDefault(); const f = new FormData(e.target), m = $('#am'); m.textContent = '';
      const r = up ? await sb.auth.signUp({ email: f.get('em'), password: f.get('pw'), options: { data: { display_name: f.get('dn') } } })
        : await sb.auth.signInWithPassword({ email: f.get('em'), password: f.get('pw') });
      if (r.error) return m.textContent = up ? 'ثبت‌نام انجام نشد؛ ایمیل و رمز (حداقل ۶ نویسه) را بررسی کن.' : 'ایمیل یا رمز اشتباه است.';
      if (up && !r.data.session) return m.textContent = 'ایمیل تأیید فرستاده شد؛ بعد از تأیید وارد شو.';
      boot();
    };
  };
  draw();
}
async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return authView();
  me = session.user;
  const { data: p } = await sb.from('profiles').select('display_name').eq('id', me.id).maybeSingle();
  const dn = p?.display_name?.trim(); // column defaults to 'کاربر' when no name was set
  myName = (dn && dn !== 'کاربر' ? dn : '') || me.user_metadata?.display_name || me.email.split('@')[0];
  isAdmin = !!(await sb.rpc('nim_is_admin')).data; // same 'admin' rule as the office app, enforced in the database
  $('#who').innerHTML = `<span class="chip">${esc(myName)}</span><button class="link" id="out">خروج</button>`;
  $('#out').onclick = () => sb.auth.signOut().then(() => location.reload());
  $('#tabs').hidden = false;
  if (!subscribed) {
    subscribed = true; const sync = () => { clearTimeout(timer); timer = setTimeout(() => cur.refresh?.(), 120) };
    ['nim_matches', 'nim_entries', 'nim_tournaments'].reduce((c, t) => c.on('postgres_changes', { event: '*', schema: 'public', table: t }, sync), sb.channel('nim')).subscribe();
  }
  route();
}

/* ---------- Router ---------- */
function route() {
  cur.refresh = null; $$('.over').forEach(x => x.remove()); scrollTo(0, 0);
  const [k, a] = location.hash.slice(2).split('/');
  $$('#tabs a').forEach(x => x.classList.toggle('on', x.dataset.k === (k === 'lb' ? 'lb' : '')));
  ({ t: tView, m: mView, lb: lbView }[k] || home)(a);
}
addEventListener('hashchange', () => me && route());

/* ---------- Tournaments list ---------- */
const GAMES = { nim: 'نیم', mani: 'مانی' };
const rule = (g, p) => g === 'mani' ? `${fa(p)} مهره؛ در هر نوبت ۱ یا ۲ یا ۳ مهره بردار. هر کس آخرین مهره را بردارد، برنده است.` : 'چهار ردیف مهره؛ در هر نوبت از یک ردیف هر چند مهره خواستی بردار. هر کس آخرین مهره را بردارد، برنده است.';
function home() {
  view.innerHTML = `<section class="stack"><form class="card stack" id="nf"><div class="row2"><input name="n" placeholder="نام مسابقه جدید" minlength="2" maxlength="60" required style="margin:0"><button class="btn sm">بساز</button></div>
    <div class="seg"><label><input type="radio" name="g" value="nim" checked><span>نیم</span></label><label><input type="radio" name="g" value="mani"><span>مانی</span></label></div>
    <label class="pcs" id="pc" hidden>تعداد مهره<input name="p" type="number" min="5" max="60" value="21"></label><p class="muted" id="gh" style="margin:0"></p></form>
    <h2>مسابقه‌ها</h2><div id="list" class="stack"></div></section>`;
  const f = $('#nf'), sync = () => { $('#pc').hidden = f.g.value !== 'mani'; $('#gh').textContent = rule(f.g.value, +f.p.value || 21) };
  f.oninput = f.onchange = sync; sync();
  f.onsubmit = async e => {
    e.preventDefault(); const g = f.g.value, p = Math.min(60, Math.max(5, +f.p.value || 21));
    const { data, error } = await sb.from('nim_tournaments').insert({ name: f.n.value.trim(), game: g, pieces: p }).select().single();
    if (error) return toast('ساخت مسابقه ممکن نشد');
    await sb.from('nim_entries').insert({ tournament_id: data.id, name: myName });
    location.hash = '#/t/' + data.id;
  };
  cur.refresh = async () => {
    const { data } = await sb.from('nim_tournaments').select('id,name,status,game').order('created_at', { ascending: false }).limit(30);
    $('#list').innerHTML = (data || []).map(t => `<a class="card tcard" href="#/t/${t.id}"><b>${esc(t.name)}</b><span class="row2"><span class="pill">${GAMES[t.game]}</span><span class="pill ${t.status}">${ST[t.status]}</span></span></a>`).join('') || '<p class="muted">هنوز مسابقه‌ای نیست. اولین را بساز.</p>';
  };
  cur.refresh();
}

/* ---------- Tournament: lobby → bracket → champion ---------- */
const mcard = (m, nm, ms) => {
  const num = x => fa(ms.indexOf(x) + 1), bye = m.round === 1 && m.status === 'done' && !m.p2, tag = m.status === 'live' || (m.status === 'done' && !bye) ? 'a' : 'div';
  const ph = side => { const f = m.round > 1 && ms.find(x => x.round === m.round - 1 && x.slot === m.slot * 2 + side); return f ? 'برنده بازی ' + num(f) : '—' };
  const row = (p, side, b) => `<div class="${m.winner && m.winner === p ? 'w' : ''}${m.status === 'live' && m.turn === p ? ' turn' : ''}${p ? '' : ' ph'}">${p ? esc(nm[p] || '؟') : b ? 'استراحت' : ph(side)}</div>`;
  return `<${tag} class="mcard ${m.status}" ${tag === 'a' ? `href="#/m/${m.id}"` : ''}><small class="mn">بازی ${num(m)}</small>${row(m.p1, 0)}${row(m.p2, 1, bye)}</${tag}>`;
};
function tView(id) {
  view.innerHTML = '<div id="tv" class="stack"></div>'; let cheered = false;
  cur.refresh = async () => {
    const [a, b, c] = await Promise.all([
      sb.from('nim_tournaments').select('*').eq('id', id).maybeSingle(),
      sb.from('nim_entries').select('user_id,name').eq('tournament_id', id),
      sb.from('nim_matches').select('*').eq('tournament_id', id).order('round').order('slot')]);
    const t = a.data, es = b.data || [], ms = c.data || [], tv = $('#tv');
    if (!tv) return; if (!t) return tv.innerHTML = '<p class="muted">این مسابقه پیدا نشد.</p>';
    const nm = Object.fromEntries(es.map(e => [e.user_id, e.name])), L = t.rounds;
    let h = `<div class="hero"><h1>${esc(t.name)}</h1><span class="pill ${t.status}">${ST[t.status]}</span></div><p class="muted" style="margin:0"><b>${GAMES[t.game]}</b> — ${rule(t.game, t.pieces)}</p>`;
    if (t.status === 'lobby') {
      h += `<div class="card"><h2>بازیکنان (${fa(es.length)})</h2><div class="chips">${es.map(e => `<span class="chip">${esc(e.name)}</span>`).join('')}</div></div>`;
      h += nm[me.id] ? '<button class="btn ghost" id="lv">انصراف از شرکت</button>' : '<button class="btn" id="jn">شرکت در مسابقه</button>';
      h += t.owner === me.id ? `<button class="btn gold" id="st" ${es.length < 2 ? 'disabled' : ''}>شروع مسابقه و قرعه‌کشی</button>`
        : '<p class="muted">منتظر بمان تا سازنده مسابقه را شروع کند؛ جدول خودکار ساخته می‌شود.</p>';
    } else {
      if (t.status === 'done' && t.champion) h += `<div class="champ"><span>🏆</span><small>قهرمان</small><b>${esc(nm[t.champion] || '؟')}</b></div>`;
      const mine = ms.find(m => m.status === 'live' && (m.p1 === me.id || m.p2 === me.id));
      if (mine) h += `<a class="btn go" href="#/m/${mine.id}">${mine.turn === me.id ? 'نوبت توست' : 'بازی تو در جریان است'} — مقابل ${esc(nm[mine.p1 === me.id ? mine.p2 : mine.p1])}</a>`;
      h += '<div class="bracket">' + Array.from({ length: L }, (_, i) => i + 1).map(r => `<section class="rnd"><h3>${r === L ? 'فینال' : r === L - 1 ? 'نیمه‌نهایی' : 'دور ' + fa(r)}</h3>${ms.filter(m => m.round === r).map(m => mcard(m, nm, ms)).join('')}</section>`).join('') + '</div>';
    }
    if (isAdmin) h += '<button class="btn ghost danger" id="dl">حذف مسابقه</button>';
    tv.innerHTML = h;
    const on = (q, fn) => { const e = $(q); if (e) e.onclick = async () => { e.disabled = true; const r = await fn(); if (r?.error) toast('انجام نشد؛ دوباره تلاش کن'); cur.refresh() } };
    on('#jn', () => sb.from('nim_entries').insert({ tournament_id: id, name: myName }));
    on('#lv', () => sb.from('nim_entries').delete().eq('tournament_id', id).eq('user_id', me.id));
    on('#st', () => sb.rpc('nim_start', { t: id }));
    const dl = $('#dl');
    if (dl) dl.onclick = async () => {
      if (!dl.classList.contains('ask')) { dl.classList.add('ask'); dl.textContent = 'مطمئنی؟ برای حذف دوباره بزن'; return setTimeout(() => { dl.classList.remove('ask'); dl.textContent = 'حذف مسابقه' }, 4000) }
      dl.disabled = true;
      const { data, error } = await sb.from('nim_tournaments').delete().eq('id', id).select('id');
      if (error || !data?.length) { dl.disabled = false; return toast('حذف انجام نشد') }
      toast('مسابقه حذف شد'); location.hash = '#/';
    };
    if (t.status === 'done' && !cheered) { cheered = true; confetti() }
  };
  cur.refresh();
}

/* ---------- The match: orbs (Nim: pick a row · Mani: take 1-3) ---------- */
async function mView(id) {
  const { data: M0 } = await sb.from('nim_matches').select('*').eq('id', id).maybeSingle();
  if (!M0) return view.innerHTML = '<p class="muted">این بازی پیدا نشد.</p>';
  const [{ data: T }, { data: es }] = await Promise.all([sb.from('nim_tournaments').select('game,pieces').eq('id', M0.tournament_id).single(), sb.from('nim_entries').select('user_id,name').eq('tournament_id', M0.tournament_id)]);
  if (location.hash !== '#/m/' + id) return;
  const mani = T.game === 'mani', SZ = mani ? [T.pieces] : INIT, nm = Object.fromEntries((es || []).map(e => [e.user_id, e.name]));
  let M = M0, sel = null, first = true, over = false;
  const tg = mani ? 'span' : 'button', rows = mani ? Array.from({ length: Math.ceil(SZ[0] / 7) }, (_, c) => [0, c * 7, Math.min(SZ[0], c * 7 + 7), c % 4]) : SZ.map((n, r) => [r, 0, n, r]);
  const field = rows.map(([r, a, b, k]) => `<div class="row" style="--c:${COL[k]}">${Array.from({ length: b - a }, (_, j) => `<${tg} class="orb" data-r="${r}" data-i="${a + j}" data-k="${k}" style="--d:${((r * 5 + a + j) * .37 % 3).toFixed(2)}s"></${tg}>`).join('')}</div>`).join('');
  const ctrl = mani ? `<div class="t3" id="t3">${[1, 2, 3].map(k => `<button class="btn" data-k="${k}" disabled>${fa(k)}</button>`).join('')}</div><div class="left" id="lf"></div>` : '<button class="btn big" id="tk" disabled></button>';
  view.innerHTML = `<div class="arena"><a class="back" id="bk" href="#/t/${M0.tournament_id}">بازگشت به جدول</a>
    <div class="vs"><div class="pl" id="pa"></div><b>VS</b><div class="pl" id="pb"></div></div><div class="banner" id="bn"></div>
    <div class="field${mani ? ' pile' : ''}" id="fd">${field}</div>${ctrl}<p class="hint">${rule(T.game, T.pieces)}</p></div>`;
  const fd = $('#fd'), orbs = $$('.orb', fd), tk = $('#tk'), t3 = $('#t3');
  const move = async (h, k) => { $$('.btn', view).forEach(b => b.disabled = true); sel = null; const { error } = await sb.rpc('nim_move', { m: id, h, k }); if (error) toast('این حرکت پذیرفته نشد'); load() };
  const upd = () => { orbs.forEach(x => x.classList.toggle('sel', !!sel && +x.dataset.r === sel.r && sel.s.has(+x.dataset.i))); if (tk) { const n = sel ? sel.s.size : 0; tk.disabled = !n; tk.textContent = n ? `بردار ${fa(n)} مهره` : 'مهره‌ها را انتخاب کن' } };
  if (tk) {
    fd.onclick = e => {
      const o = e.target.closest('.orb'); if (!o || o.disabled) return; const r = +o.dataset.r, i = +o.dataset.i;
      if (!sel || sel.r !== r) sel = { r, s: new Set() }; sel.s.has(i) ? sel.s.delete(i) : sel.s.add(i);
      navigator.vibrate?.(10); upd();
    };
    tk.onclick = () => sel?.s.size && move(sel.r, sel.s.size);
  } else t3.onclick = e => { const b = e.target.closest('button'); if (b && !b.disabled) { navigator.vibrate?.(10); move(0, +b.dataset.k) } };
  const finish = () => {
    const w = M.winner === me.id, part = M.p1 === me.id || M.p2 === me.id, o = document.createElement('div'); o.className = 'over';
    o.innerHTML = `<div><h1>${w ? 'برنده شدی!' : part ? 'این بار نشد' : 'بازی تمام شد'}</h1><p>${w ? 'حریف را شکست دادی.' : 'برنده: ' + esc(nm[M.winner])}</p><a class="btn" href="#/t/${M.tournament_id}">دیدن جدول</a></div>`;
    document.body.append(o); if (w) confetti();
  };
  const paint = () => {
    const live = M.status === 'live', mine = live && M.turn === me.id, part = M.p1 === me.id || M.p2 === me.id;
    $('#pa').textContent = nm[M.p1] || '—'; $('#pb').textContent = nm[M.p2] || '—';
    $('#pa').classList.toggle('turn', live && M.turn === M.p1); $('#pb').classList.toggle('turn', live && M.turn === M.p2);
    orbs.forEach(o => {
      const gone = +o.dataset.i >= M.heaps[+o.dataset.r];
      if (gone && !o.classList.contains('gone') && !first) { const b = o.getBoundingClientRect(); burst(b.x + b.width / 2, b.y + b.height / 2, COL[+o.dataset.k], 22) }
      o.classList.toggle('gone', gone); if (!mani) o.disabled = gone || !mine;
    });
    if (!mine) sel = null; upd();
    if (t3) { $$('button', t3).forEach(b => b.disabled = !mine || +b.dataset.k > M.heaps[0]); $('#lf').textContent = `${fa(M.heaps[0])} مهره باقی مانده` }
    const bn = $('#bn'); bn.className = 'banner' + (mine ? ' mine' : '');
    bn.textContent = M.status === 'waiting' ? 'منتظر تعیین حریف…' : live ? (mine ? 'نوبت توست' : part ? `نوبت ${nm[M.turn]} است…` : `تماشاگر — نوبت ${nm[M.turn]}`) : `برنده: ${nm[M.winner] || '؟'}`;
    if (M.status === 'done' && !over && !first) { over = true; finish() }
    first = false;
  };
  const load = async () => { const { data } = await sb.from('nim_matches').select('*').eq('id', id).maybeSingle(); if (!data) { toast('این مسابقه حذف شد'); location.hash = '#/'; return } M = data; paint() };
  cur.refresh = load; paint();
}

/* ---------- Leaderboard (all games / per game) ---------- */
function lbView() {
  let g = 'all';
  view.innerHTML = `<div class="stack"><h2>جدول رتبه‌ها</h2><div class="seg" id="lg">${[['all', 'همه'], ['nim', 'نیم'], ['mani', 'مانی']].map(([k, t]) => `<button data-g="${k}" class="${k === g ? 'on' : ''}">${t}</button>`).join('')}</div><div id="lb" class="stack"></div></div>`;
  $('#lg').onclick = e => { const b = e.target.closest('button'); if (!b) return; g = b.dataset.g; $$('#lg button').forEach(x => x.classList.toggle('on', x === b)); cur.refresh() };
  cur.refresh = async () => {
    const { data } = await sb.from('nim_leaderboard').select('*'), by = {};
    for (const r of data || []) { if (g !== 'all' && r.game !== g) continue; const u = by[r.user_id] ||= { user_id: r.user_id, name: r.name, wins: 0, losses: 0, titles: 0 }; u.wins += +r.wins; u.losses += +r.losses; u.titles += +r.titles }
    const rows = Object.values(by).sort((a, b) => b.titles - a.titles || b.wins - a.wins || a.losses - b.losses);
    $('#lb').innerHTML = rows.map((r, i) => `<div class="card lrow ${r.user_id === me.id ? 'me' : ''}" style="--i:${i}"><span class="rk">${fa(i + 1)}</span><b>${esc(r.name)}</b><span class="st"><i>🏆 ${fa(r.titles)}</i><i>برد ${fa(r.wins)}</i><i>باخت ${fa(r.losses)}</i></span></div>`).join('') || '<p class="muted">با اولین مسابقه، رتبه‌ها ساخته می‌شود.</p>';
  };
  cur.refresh();
}

boot();
