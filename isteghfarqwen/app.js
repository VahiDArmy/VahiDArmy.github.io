/* ═══════════════════════════════════════════════════════════════
   NŪR · The Grand Istighfār — pure vanilla JS SPA
   Supabase auth + sync via REST (no SDK). WebAudio UI sounds.
═══════════════════════════════════════════════════════════════ */
'use strict';
(() => {

/* ── config ── */
const SB_URL = 'https://ummhohozmpwltbgeczsf.supabase.co';
const SB_KEY = 'sb_publishable_WcK2pmYMMu61z0KUub5jLA_KSxGpQD6';
const LS_STATE = 'nur.state.v1', LS_SESSION = 'nur.session.v1';

/* ── helpers ── */
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ic = (n, cls='') => `<svg class="ic ${cls}"><use href="#i-${n}"/></svg>`;
const clamp = (v,a,b) => Math.min(b, Math.max(a, v));
const dayKey = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch{} };
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const fmt = n => new Intl.NumberFormat('en').format(n);

/* ── state ── */
const DEFAULTS = {
  v: 1,
  settings: { theme:'midnight', arFont:'amiri', fontScale:1, lineHeight:2.1, trans:'en',
              sound:true, volume:.7, ambient:false, motion:true, ttsRate:.85, goal:5 },
  read: {}, last: null, bookmarks: {}, notes: {},
  tasbih: { total:0, session:0, target:100, phrase:0 },
  ach: {}, activity: {}
};
const loadJSON = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
let S = Object.assign({}, DEFAULTS, loadJSON(LS_STATE) || {});
S.settings = Object.assign({}, DEFAULTS.settings, S.settings);
S.tasbih   = Object.assign({}, DEFAULTS.tasbih, S.tasbih);
let session = loadJSON(LS_SESSION);
let DATA = null, SEGS = [], IDX = {}, SEC_OF = {}, VIEW = 'home', libTab = 'bm';
let lastActive = Date.now(), io = null, refreshTimer = null, syncTimer = null;

const act = () => (S.activity[dayKey()] ||= { r:0, t:0, s:0 });
const readCount = () => Object.keys(S.read).length;
function streak() {
  let n = 0, d = new Date();
  const has = k => { const a = S.activity[k]; return a && (a.r > 0 || a.t > 0 || a.s >= 60); };
  if (!has(dayKey(d))) d.setDate(d.getDate() - 1);
  while (has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function persistLocal() { try { localStorage.setItem(LS_STATE, JSON.stringify(S)); } catch{} }
function persist() { persistLocal(); updateHUD(); syncSoon(); }

/* ═══════════ SOUND ENGINE (WebAudio, synthesized) ═══════════ */
const Sound = {
  ctx: null, master: null,
  ensure() {
    if (!S.settings.sound) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.master.gain.value = S.settings.volume;
    return this.ctx;
  },
  tone(f, dur, type='sine', g=.14, at=0, f2) {
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(), gn = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    gn.gain.setValueAtTime(0, t);
    gn.gain.linearRampToValueAtTime(g, t + .008);
    gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(gn); gn.connect(this.master);
    o.start(t); o.stop(t + dur + .05);
  },
  play(name) {
    if (!this.ensure()) return;
    const T = this.tone.bind(this);
    switch (name) {
      case 'tap':      T(340,.06,'sine',.09); break;
      case 'hover':    T(560,.025,'sine',.028); break;
      case 'open':     T(300,.13,'sine',.08,0,620); break;
      case 'close':    T(620,.13,'sine',.07,0,300); break;
      case 'on':       T(440,.05,'triangle',.1); T(660,.07,'triangle',.1,.06); break;
      case 'off':      T(660,.05,'triangle',.09); T(330,.08,'triangle',.09,.06); break;
      case 'success':  T(523,.09,'sine',.11); T(659,.09,'sine',.11,.08); T(784,.16,'sine',.11,.16); break;
      case 'error':    T(190,.16,'sawtooth',.07); T(150,.2,'sawtooth',.06,.1); break;
      case 'bookmark': T(660,.06,'triangle',.11); T(880,.1,'triangle',.1,.06); break;
      case 'tick':     T(900,.03,'triangle',.13); T(180,.05,'sine',.1); break;
      case 'chime':    T(523,.9,'sine',.12); T(1046,.9,'sine',.06,.02); T(1568,1.1,'sine',.04,.05); break;
      case 'fanfare':  [523,659,784,1046].forEach((f,i)=>T(f,.22,'triangle',.11,i*.11)); T(1568,.7,'sine',.05,.5); break;
      case 'pop':      T(760,.045,'sine',.09,0,980); break;
    }
  }
};
const Ambient = {
  nodes: null,
  start() {
    if (this.nodes || !S.settings.ambient || !S.settings.sound) return;
    const c = Sound.ensure(); if (!c) return;
    const g = c.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(.05 * S.settings.volume, c.currentTime + 3);
    const o1 = c.createOscillator(), o2 = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain();
    o1.frequency.value = 110; o2.frequency.value = 110.6; o1.type = o2.type = 'sine';
    lfo.frequency.value = .08; lg.gain.value = .02 * S.settings.volume;
    lfo.connect(lg); lg.connect(g.gain);
    o1.connect(g); o2.connect(g); g.connect(c.destination);
    o1.start(); o2.start(); lfo.start();
    this.nodes = { o1, o2, lfo, g };
  },
  stop() {
    if (!this.nodes) return;
    const { o1, o2, lfo, g } = this.nodes, c = Sound.ctx;
    g.gain.linearRampToValueAtTime(0, c.currentTime + 1);
    setTimeout(() => { try { o1.stop(); o2.stop(); lfo.stop(); } catch{} }, 1200);
    this.nodes = null;
  }
};

/* ═══════════ SUPABASE (pure REST) ═══════════ */
const errMsg = j => j && (j.msg || j.error_description || j.message || j.error || j.hint) || 'Something went wrong';
function setSession(j) {
  session = {
    access_token: j.access_token, refresh_token: j.refresh_token,
    expires_at: j.expires_at || Math.floor(Date.now()/1000) + (j.expires_in || 3600),
    user: j.user
  };
  localStorage.setItem(LS_SESSION, JSON.stringify(session));
  scheduleRefresh(); updateAccountUI();
}
function clearSession() {
  session = null; localStorage.removeItem(LS_SESSION);
  clearTimeout(refreshTimer); updateAccountUI(); setSync('off');
}
async function sb(path, { method='GET', body, auth=true, prefer } = {}) {
  const headers = { apikey: SB_KEY, 'Content-Type': 'application/json' };
  headers.Authorization = 'Bearer ' + (auth && session ? session.access_token : SB_KEY);
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(SB_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  if (!r.ok) {
    if (r.status === 401 && session && path.startsWith('/rest')) {
      if (await tryRefresh()) return sb(path, { method, body, auth, prefer });
    }
    throw new Error(errMsg(j) || 'HTTP ' + r.status);
  }
  return j;
}
async function tryRefresh() {
  if (!session?.refresh_token) return false;
  try {
    const j = await sb('/auth/v1/token?grant_type=refresh_token', { method:'POST', auth:false, body:{ refresh_token: session.refresh_token } });
    setSession(j); return true;
  } catch { clearSession(); return false; }
}
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  if (!session) return;
  const ms = Math.max(5000, session.expires_at * 1000 - Date.now() - 60000);
  refreshTimer = setTimeout(async () => { if (await tryRefresh()) setSync('ok'); }, ms);
}
async function signIn(email, password) {
  setSession(await sb('/auth/v1/token?grant_type=password', { method:'POST', auth:false, body:{ email, password } }));
  await afterAuth();
}
async function signUp(name, email, password) {
  const j = await sb('/auth/v1/signup', { method:'POST', auth:false, body:{ email, password, data:{ name } } });
  if (j.access_token) { setSession(j); await afterAuth(); return true; }
  return false; // email confirmation required
}
async function signOut() {
  try { await sb('/auth/v1/logout', { method:'POST' }); } catch {}
  clearSession(); toast('Signed out — your data stays on this device', 'info', 'out');
}

/* ── cloud sync ── */
function setSync(state) {
  const el = $('#sync-dot');
  el.className = 'sync-chip ' + (session ? state : 'off');
  el.dataset.tip = { off:'Sign in to sync', ok:'Synced', sync:'Syncing…', err:'Sync error — click to retry', idle:'Cloud sync' }[state] || 'Cloud sync';
}
const unionMin = (a={}, b={}) => { const o = { ...a }; for (const k in b) o[k] = Math.min(o[k] ?? Infinity, b[k]); return o; };
function mergeState(local, cloud) {
  if (!cloud || cloud.v !== 1) return local;
  const m = { ...local };
  m.read = unionMin(cloud.read, local.read);
  m.bookmarks = unionMin(cloud.bookmarks, local.bookmarks);
  m.ach = unionMin(cloud.ach, local.ach);
  m.notes = { ...(cloud.notes || {}) };
  for (const k in (local.notes || {})) if (!m.notes[k] || local.notes[k].ts > m.notes[k].ts) m.notes[k] = local.notes[k];
  m.tasbih = { ...local.tasbih, total: Math.max(local.tasbih.total || 0, cloud.tasbih?.total || 0) };
  m.activity = { ...(cloud.activity || {}) };
  for (const d in (local.activity || {})) {
    const a = local.activity[d], b = m.activity[d] || { r:0, t:0, s:0 };
    m.activity[d] = { r: Math.max(a.r,b.r), t: Math.max(a.t,b.t), s: Math.max(a.s,b.s) };
  }
  m.last = local.last || cloud.last;
  return m;
}
async function push() {
  if (!session) return;
  setSync('sync');
  await sb('/rest/v1/user_state?on_conflict=user_id', { method:'POST', prefer:'resolution=merge-duplicates,return=minimal',
    body:{ user_id: session.user.id, state: S, updated_at: new Date().toISOString() } });
  const a = act();
  await sb('/rest/v1/daily_activity?on_conflict=user_id,day', { method:'POST', prefer:'resolution=merge-duplicates,return=minimal',
    body:{ user_id: session.user.id, day: dayKey(), reads: a.r, tasbih: a.t, seconds: a.s } });
  setSync('ok');
}
async function pull() {
  if (!session) return;
  const rows = await sb(`/rest/v1/user_state?user_id=eq.${session.user.id}&select=state`);
  if (rows?.[0]?.state) {
    S = mergeState(S, rows[0].state);
    persistLocal(); applySettings(); render(); updateHUD();
  }
}
async function afterAuth() {
  try { setSync('sync'); await pull(); await push(); }
  catch (e) { setSync('err'); toast('Sync: ' + e.message, 'err', 'alert'); }
}
const syncSoon = debounce(() => { if (session) push().catch(() => setSync('err')); }, 2500);
async function syncNow() {
  if (!session) { openAuth(); return; }
  try { await afterAuth(); toast('Everything is in sync', 'ok', 'sync'); Sound.play('success'); }
  catch (e) { setSync('err'); toast('Sync failed: ' + e.message, 'err', 'alert'); }
}

/* ═══════════ TOASTS / MODALS ═══════════ */
function toast(msg, type='ok', icon='check') {
  const box = $('#toasts');
  while (box.children.length >= 4) box.firstChild.remove();
  const t = document.createElement('div');
  t.className = 'toast ' + (type === 'ok' ? '' : type);
  t.innerHTML = ic(icon) + `<span>${esc(msg)}</span>`;
  t.onclick = () => t.remove();
  box.appendChild(t);
  setTimeout(() => { t.classList.add('bye'); setTimeout(() => t.remove(), 320); }, 3800);
}
let modalResolve = null;
function openModal(html) {
  $('#modal-root').innerHTML =
    `<div class="overlay open"><div class="ov-backdrop" data-action="modal-close"></div><div class="modal-card">${html}</div></div>`;
  Sound.play('open');
  const f = $('#modal-root textarea, #modal-root input, #modal-root .btn');
  f && setTimeout(() => f.focus(), 60);
}
function closeModal() {
  if (!$('#modal-root').innerHTML) return;
  $('#modal-root').innerHTML = ''; Sound.play('close');
  if (modalResolve) { modalResolve(false); modalResolve = null; }
}
function confirmBox({ title, body, ok='Confirm', danger=false }) {
  return new Promise(res => {
    modalResolve = res;
    openModal(`<h2>${ic(danger?'alert':'info')} ${esc(title)}</h2><div class="m-body">${esc(body)}</div>
      <div class="m-actions"><button class="btn ghost" data-action="modal-close">Cancel</button>
      <button class="btn ${danger?'danger':'primary'}" data-action="confirm-ok">${esc(ok)}</button></div>`);
  });
}

/* ═══════════ SETTINGS ═══════════ */
function applySettings() {
  const st = S.settings, root = document.documentElement;
  root.dataset.theme = st.theme; root.dataset.arfont = st.arFont;
  root.style.setProperty('--ar-scale', st.fontScale);
  root.style.setProperty('--ar-lh', st.lineHeight);
  document.body.classList.toggle('no-motion', !st.motion);
  document.body.classList.toggle('muted', !st.sound);
  $$('.theme-chip').forEach(c => c.classList.toggle('active', c.dataset.v === st.theme));
  if (!st.sound || !st.ambient) Ambient.stop(); else Ambient.start();
  if (!st.motion) FX.static();
}
function syncDrawerInputs() {
  $$('#drawer [data-set]').forEach(el => {
    const v = S.settings[el.dataset.set];
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
  });
}
const openSettings  = () => { syncDrawerInputs(); renderDrawerAccount(); document.body.classList.add('drawer-open'); Sound.play('open'); };
const closeSettings = () => { document.body.classList.remove('drawer-open'); Sound.play('close'); };

/* ═══════════ ACCOUNT UI ═══════════ */
const userName = () => session?.user?.user_metadata?.name || session?.user?.email?.split('@')[0] || 'Seeker';
function updateAccountUI() {
  const b = $('#btn-account');
  b.innerHTML = session ? esc(userName()[0].toUpperCase()) : ic('user');
  renderDrawerAccount();
}
function renderDrawerAccount() {
  const el = $('#drawer-account'); if (!el) return;
  el.innerHTML = session
    ? `<div class="acct-box"><span class="avatar-btn">${esc(userName()[0].toUpperCase())}</span>
       <div class="who"><b>${esc(userName())}</b><span>${esc(session.user.email)}</span></div></div>
       <div class="btn-col"><button class="btn" data-action="sync-now">${ic('sync')}Sync now</button>
       <button class="btn danger" data-action="logout">${ic('out')}Sign out</button></div>`
    : `<p class="mut" style="font-size:13px;margin-bottom:12px;line-height:1.6">You're reading as a guest. Sign in to sync progress, notes & tasbīḥ across devices.</p>
       <button class="btn primary wide" data-action="open-auth">${ic('user')}Sign in / Create account</button>`;
}
function toggleAccountMenu() {
  if (!session) { openAuth(); return; }
  const m = $('#account-menu');
  if (!m.hidden) { m.hidden = true; return; }
  const r = $('#btn-account').getBoundingClientRect();
  m.style.top = (r.bottom + 10) + 'px';
  m.style.right = Math.max(10, innerWidth - r.right) + 'px';
  m.innerHTML = `<div class="p-head"><b>${esc(userName())}</b><span>${esc(session.user.email)}</span></div>
    <button class="p-item" data-action="sync-now">${ic('sync')}Sync now</button>
    <button class="p-item" data-action="open-settings">${ic('set')}Settings</button>
    <button class="p-item" data-action="export">${ic('dl')}Export data</button>
    <button class="p-item danger" data-action="logout">${ic('out')}Sign out</button>`;
  m.hidden = false; Sound.play('pop');
}

/* ═══════════ AUTH MODAL ═══════════ */
function openAuth() { $('#auth-modal').classList.add('open'); authTab('in'); Sound.play('open'); setTimeout(() => $('#in-email').focus(), 80); }
function closeAuth() { $('#auth-modal').classList.remove('open'); Sound.play('close'); }
function authTab(v) {
  $$('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.v === v));
  $('#form-in').hidden = v !== 'in'; $('#form-up').hidden = v !== 'up';
  $('#form-forgot').hidden = true; $('#auth-verify').hidden = true; $('#auth-err').hidden = true;
}
function authError(msg) { const e = $('#auth-err'); e.textContent = msg; e.hidden = false; Sound.play('error'); }
function bindAuthForms() {
  const wrap = (form, fn) => form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.classList.add('loading'); $('#auth-err').hidden = true;
    try { await fn(); } catch (err) { authError(err.message); }
    finally { btn.classList.remove('loading'); }
  });
  wrap($('#form-in'), async () => {
    await signIn($('#in-email').value.trim(), $('#in-pass').value);
    closeAuth(); Sound.play('success'); toast(`Welcome back, ${userName()} — cloud sync is on`, 'gold', 'spark');
  });
  wrap($('#form-up'), async () => {
    const ok = await signUp($('#up-name').value.trim(), $('#up-email').value.trim(), $('#up-pass').value);
    if (ok) { closeAuth(); Sound.play('fanfare'); toast(`Ahlan, ${userName()}! Your journey is now synced`, 'gold', 'spark'); }
    else {
      $('#form-up').hidden = true; $('#auth-verify').hidden = false;
      $('#verify-email').textContent = $('#up-email').value.trim();
      $('#auth-verify').dataset.email = $('#up-email').value.trim();
      Sound.play('success');
    }
  });
  wrap($('#form-forgot'), async () => {
    await sb('/auth/v1/recover', { method:'POST', auth:false, body:{ email: $('#fg-email').value.trim() } });
    toast('Reset link sent — check your inbox', 'ok', 'mail'); Sound.play('success'); authTab('in');
  });
}

/* ═══════════ DATA ═══════════ */
const normCache = {};
function normAr(str) {
  let n = '', map = [];
  for (let i = 0; i < str.length; i++) {
    let c = str[i];
    if (/[\u064B-\u065F\u0670\u0640\u06D6-\u06ED]/.test(c)) continue;
    if ('أإآٱ'.includes(c)) c = 'ا'; else if (c === 'ة') c = 'ه'; else if (c === 'ى') c = 'ي'; else if (c === 'ؤ') c = 'و'; else if (c === 'ئ') c = 'ي';
    n += c; map.push(i);
  }
  return { n, map };
}
async function loadData() {
  const r = await fetch('data/estighfar.json');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  DATA = await r.json();
  if (!DATA.sections) throw new Error('Bad JSON shape');
  SEGS = []; IDX = {}; SEC_OF = {};
  DATA.sections.forEach(sec => sec.segments.forEach(sg => {
    SEGS.push(sg); IDX[sg.id] = sg; SEC_OF[sg.id] = sec;
    normCache[sg.id] = { ar: normAr(sg.ar), fa: normAr(sg.fa), en: { n: sg.en.toLowerCase(), map: null } };
  }));
}

/* ═══════════ ROUTER ═══════════ */
const TITLES = { home:'Home', read:'The Grand Istighfār', library:'Library', tasbih:'Tasbīḥ', stats:'Your Journey' };
function navigate(view, param) {
  location.hash = '#/' + view + (param != null ? '/' + param : '');
}
function parseHash() {
  const p = location.hash.replace(/^#\/?/, '').split('/');
  return { view: TITLES[p[0]] ? p[0] : 'home', param: p[1] || null };
}
function render() {
  stopAutoScroll(); TTS.stop();
  const { view, param } = parseHash();
  VIEW = view;
  $('#view-title').textContent = TITLES[view];
  document.title = 'Nūr · ' + TITLES[view];
  $$('.rail-btn, #tabbar button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  if (view !== 'read') document.body.classList.remove('focus');
  if (io) { io.disconnect(); io = null; }
  $('#view').innerHTML = ({ home:vHome, read:vRead, library:vLibrary, tasbih:vTasbih, stats:vStats })[view](param);
  if (view === 'read') initReader(param);
  if (view === 'tasbih') updateTasbihUI();
  updateHUD();
  if (!param) scrollTo({ top: 0 });
}
function updateHUD() {
  $('#hud-streak-n').textContent = streak();
  $('#progress-line').style.width = (SEGS.length ? readCount() / SEGS.length * 100 : 0) + '%';
}

/* ═══════════ VIEW · HOME ═══════════ */
function ringSVG(pct, size=118, r=50, w=9) {
  const C = 2 * Math.PI * r;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle class="bg" cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${w}"/>
    <circle class="fg" cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${w}"
      stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - clamp(pct,0,1))}"/></svg>`;
}
function vHome() {
  const h = new Date().getHours();
  const greet = h < 5 ? 'Blessed night' : h < 12 ? 'Blessed morning' : h < 17 ? 'Blessed afternoon' : h < 21 ? 'Blessed evening' : 'Blessed night';
  let pDate = ''; try { pDate = ' · ' + new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle:'full' }).format(new Date()); } catch {}
  const gDate = new Intl.DateTimeFormat('en', { dateStyle:'full' }).format(new Date());
  const total = SEGS.length, rc = readCount(), a = act(), goal = S.settings.goal;
  const last = S.last && IDX[S.last];
  const daily = SEGS[Math.floor(Date.now() / 864e5) % total];
  const cont = last || SEGS[0];
  return `<div class="page">
  <div class="hero">
    <div class="greet">${greet}, <b>${esc(userName())}</b></div>
    <div class="date-line">${esc(gDate)}${esc(pDate)}</div>
    <div class="hero-orn" style="margin-top:22px">۞ ۞ ۞</div>
    <div class="hero-ar">اللَّهُمَّ إِنِّي أَسْتَغْفِرُكَ</div>
    <p class="hero-sub">${esc(DATA.meta.attribution.en)} — ${total} passages of repentance, in Arabic with fresh English & Persian translations.</p>
    <p class="hero-fa">${esc(DATA.meta.attribution.fa)}</p>
    <div class="hero-cta">
      <button class="btn primary" data-action="${last ? 'continue' : 'begin'}">${ic(last ? 'play' : 'book')}${last ? 'Continue reading' : 'Begin the duʿāʾ'}</button>
      <button class="btn" data-action="nav" data-view="tasbih">${ic('target')}Open tasbīḥ</button>
    </div>
    <div class="hero-chips">
      <span class="chip active">${ic('book')} ${rc}/${total} passages</span>
      <span class="chip">${ic('flame')} ${streak()}-day streak</span>
      <span class="chip">${ic('target')} ${fmt(S.tasbih.total)} tasbīḥ</span>
    </div>
  </div>
  <div class="grid g3">
    <div class="card">
      <div class="home-card-h">${ic('clock')}${last ? 'Where you left off' : 'Start here'}</div>
      <div class="lib-meta">${esc(SEC_OF[cont.id].en)} · № ${cont.id}</div>
      <div class="snip-ar">${esc(cont.ar)}</div>
      <div class="snip-en">${esc(cont.en)}</div>
      <button class="btn wide" style="margin-top:14px" data-action="jump" data-id="${cont.id}">${ic('cr')}Open passage</button>
    </div>
    <div class="card">
      <div class="home-card-h">${ic('target')}Today's goal</div>
      <div class="ring-wrap">
        <div class="ring-box">${ringSVG(a.r / goal)}<div class="ring-txt"><b>${a.r}</b><small>of ${goal}</small></div></div>
        <div><div class="stat-big">${Math.min(100, Math.round(a.r / goal * 100))}%</div>
        <div class="stat-lbl">passages today</div>
        <p class="mut" style="font-size:12.5px;margin-top:10px;line-height:1.6">${a.r >= goal ? 'Goal fulfilled — may it be accepted.' : `${goal - a.r} more to fulfill today's intention.`}</p></div>
      </div>
    </div>
    <div class="card">
      <div class="home-card-h">${ic('spark')}Passage of the day</div>
      <div class="lib-meta">${esc(SEC_OF[daily.id].en)} · № ${daily.id}</div>
      <div class="snip-ar">${esc(daily.ar)}</div>
      <div class="snip-en">${esc(daily.en)}</div>
      <button class="btn wide" style="margin-top:14px" data-action="daily">${ic('cr')}Reflect on it</button>
    </div>
  </div>
  <div class="sec-title">Quick paths</div>
  <div class="quick">
    <button data-action="open-search">${ic('search')}Search the text</button>
    <button data-action="nav" data-view="library">${ic('bm')}Bookmarks & notes</button>
    <button data-action="nav" data-view="stats">${ic('flame')}Streaks & awards</button>
    <button data-action="open-settings">${ic('set')}Personalize</button>
  </div></div>`;
}

/* ═══════════ VIEW · READER ═══════════ */
function transHTML(sg) {
  const m = S.settings.trans; let h = '';
  if (m === 'en' || m === 'both') h += `<p class="t-en">${esc(sg.en)}</p>`;
  if (m === 'fa' || m === 'both') h += `<p class="t-fa" dir="rtl" lang="fa">${esc(sg.fa)}</p>`;
  return h;
}
function noteHTML(id) {
  const n = S.notes[id];
  return n ? `<div class="seg-note">${ic('note')}<span>${esc(n.t)}</span></div>` : '';
}
function segHTML(sg) {
  const cls = [S.read[sg.id] && 'read', S.bookmarks[sg.id] && 'bm'].filter(Boolean).join(' ');
  return `<article class="seg ${cls}" id="seg-${sg.id}" data-id="${sg.id}">
    <div class="seg-head"><span class="seg-num">${sg.id}</span>
      <div class="seg-tools">
        <button class="icon-btn ${S.read[sg.id] ? 'on green' : ''}" data-action="seg-read" data-id="${sg.id}" data-tip="Mark read (R)">${ic('check')}</button>
        <button class="icon-btn ${S.bookmarks[sg.id] ? 'on' : ''}" data-action="seg-bm" data-id="${sg.id}" data-tip="Bookmark (B)">${ic('bm')}</button>
        <button class="icon-btn ${S.notes[sg.id] ? 'on' : ''}" data-action="seg-note" data-id="${sg.id}" data-tip="Note">${ic('note')}</button>
        <button class="icon-btn" data-action="seg-copy" data-id="${sg.id}" data-tip="Copy">${ic('copy')}</button>
        <button class="icon-btn" data-action="seg-play" data-id="${sg.id}" data-tip="Listen">${ic('play','ic-play')}${ic('stop','ic-stop')}</button>
      </div></div>
    <p class="ar" dir="rtl" lang="ar">${sg.ar}</p>
    ${transHTML(sg)}${noteHTML(sg.id)}
  </article>`;
}
function vRead() {
  const rc = readCount(), total = SEGS.length;
  const opts = DATA.sections.map(s => `<option value="${s.id}">${esc(s.en)}</option>`).join('');
  const chapters = DATA.sections.map((sec, i) => {
    const done = sec.segments.filter(x => S.read[x.id]).length;
    return `<div class="chapter" id="${sec.id}">
      <div class="orn">۞</div>
      <h2>${i + 1}. ${esc(sec.en)}</h2>
      <div class="fa-t">${esc(sec.fa)}</div>
      <div class="ch-meta"><span>${done}/${sec.segments.length} read</span>
        <button class="chip mini" data-action="sec-read" data-sec="${sec.id}">${ic('check')}Mark chapter</button></div>
    </div>` + sec.segments.map(segHTML).join('');
  }).join('');
  return `<div class="page">
    <div class="reader-tools">
      <select id="reader-sec" title="Chapters">${opts}</select>
      <span class="rt-count" id="reader-count">${rc}/${total}</span>
      <div class="rt-bar"><i id="reader-bar" style="width:${rc/total*100}%"></i></div>
      <button class="tool-btn" data-action="font-down" data-tip="Smaller (−)">${ic('minus')}</button>
      <button class="tool-btn" data-action="font-up" data-tip="Larger (+)">${ic('plus')}</button>
      <button class="tool-btn" data-action="trans-cycle" data-tip="Translation">${ic('list')}</button>
      <button class="tool-btn" id="as-btn" data-action="autoscroll" data-tip="Auto-scroll (A)">${ic('scroll')}</button>
      <input type="range" class="rt-speed" id="as-speed" min="1" max="10" step="1" value="3" title="Scroll speed">
      <button class="tool-btn" data-action="focus" data-tip="Focus mode (F)">${ic('focus')}</button>
    </div>
    ${chapters}
    <div class="reader-end">
      <div class="orn">۞ ۞ ۞</div>
      <p>${rc === total ? 'You have read the entire duʿāʾ. May every word be a light for you.' : '“How often You court my love, though You have no need of me…”'}</p>
      <button class="btn" data-action="nav" data-view="stats">${ic('flame')}See your journey</button>
      <button class="btn primary" data-action="nav" data-view="tasbih">${ic('target')}Seal it with tasbīḥ</button>
    </div></div>`;
}
function initReader(param) {
  io = new IntersectionObserver(es => {
    let best = null;
    es.forEach(e => { if (e.isIntersecting && (!best || e.intersectionRatio > best.intersectionRatio)) best = e; });
    if (best) {
      const id = +best.target.dataset.id;
      if (S.last !== id) { S.last = id; persistLocal(); syncSoon(); }
      const sec = SEC_OF[id], sel = $('#reader-sec');
      if (sel && sel.value !== sec.id) sel.value = sec.id;
    }
  }, { threshold: [.55] });
  $$('.seg').forEach(el => io.observe(el));
  const target = param ? IDX[param] : (S.last ? IDX[S.last] : null);
  if (target) setTimeout(() => {
    const el = $('#seg-' + target.id);
    if (el) { el.scrollIntoView({ block:'center', behavior:'auto' }); if (param) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1700); } }
  }, 40);
}
function refreshSeg(id) {
  const el = $('#seg-' + id); if (!el) return;
  el.classList.toggle('read', !!S.read[id]);
  el.classList.toggle('bm', !!S.bookmarks[id]);
  el.querySelector('[data-action=seg-read]').classList.toggle('on', !!S.read[id]);
  el.querySelector('[data-action=seg-read]').classList.toggle('green', !!S.read[id]);
  el.querySelector('[data-action=seg-bm]').classList.toggle('on', !!S.bookmarks[id]);
  el.querySelector('[data-action=seg-note]').classList.toggle('on', !!S.notes[id]);
  const old = el.querySelector('.seg-note'); old && old.remove();
  el.insertAdjacentHTML('beforeend', noteHTML(id));
  const rc = readCount(), c = $('#reader-count'), b = $('#reader-bar');
  if (c) c.textContent = `${rc}/${SEGS.length}`;
  if (b) b.style.width = (rc / SEGS.length * 100) + '%';
}
function setRead(id, on, silent) {
  id = +id;
  if (on && !S.read[id]) { S.read[id] = Date.now(); act().r++; }
  else if (!on && S.read[id]) delete S.read[id];
  persist(); refreshSeg(id);
  if (!silent) Sound.play(on ? 'success' : 'tap');
  if (on) { checkAch(); if (readCount() === SEGS.length) celebrate(); }
}
function toggleBookmark(id) {
  id = +id;
  if (S.bookmarks[id]) { delete S.bookmarks[id]; Sound.play('tap'); }
  else { S.bookmarks[id] = Date.now(); Sound.play('bookmark'); buzz(12); toast('Passage bookmarked', 'ok', 'bm'); }
  persist(); refreshSeg(id); checkAch();
}
function openNote(id) {
  id = +id;
  const n = S.notes[id];
  openModal(`<button class="icon-btn modal-x" data-action="modal-close">${ic('x')}</button>
    <h2>${ic('note')}Note on passage ${id}</h2>
    <p class="m-body" style="margin-bottom:12px;font-family:var(--font-ar);direction:rtl;text-align:right;font-size:19px;color:var(--ink)">${esc(IDX[id].ar.slice(0, 90))}…</p>
    <textarea id="note-ta" placeholder="Your reflection…">${esc(n?.t || '')}</textarea>
    <div class="m-actions">${n ? `<button class="btn danger" data-action="note-del" data-id="${id}">${ic('trash')}Delete</button>` : ''}
    <button class="btn primary" data-action="note-save" data-id="${id}">${ic('check')}Save note</button></div>`);
}
function saveNote(id) {
  id = +id;
  const t = $('#note-ta').value.trim();
  if (t) S.notes[id] = { t, ts: Date.now() }; else delete S.notes[id];
  persist(); refreshSeg(id); closeModal();
  Sound.play('success'); toast(t ? 'Note saved' : 'Note removed', 'ok', 'note'); checkAch();
}
async function copySeg(id) {
  const s = IDX[+id];
  const txt = `${s.ar}\n\n${s.en}\n\n${s.fa}\n\n— ${DATA.meta.title.en}, № ${s.id}`;
  try { await navigator.clipboard.writeText(txt); }
  catch {
    const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); ta.remove();
  }
  Sound.play('pop'); toast('Passage copied to clipboard', 'ok', 'copy');
}
function markSection(secId) {
  const sec = DATA.sections.find(s => s.id === secId); if (!sec) return;
  let added = 0;
  sec.segments.forEach(sg => { if (!S.read[sg.id]) { S.read[sg.id] = Date.now(); added++; refreshSeg(sg.id); } });
  if (added) { act().r += added; persist(); Sound.play('success'); toast(`Chapter marked — ${added} passage${added>1?'s':''}`, 'ok', 'check'); checkAch(); if (readCount() === SEGS.length) celebrate(); }
  else toast('Chapter already complete', 'ok', 'check');
}

/* ── TTS ── */
const TTS = {
  id: null, warned: false,
  speak(id) {
    id = +id;
    if (!('speechSynthesis' in window)) { toast('Speech not supported in this browser', 'warn', 'alert'); return; }
    this.stop();
    const u = new SpeechSynthesisUtterance(IDX[id].ar);
    u.lang = 'ar-SA'; u.rate = S.settings.ttsRate;
    const v = speechSynthesis.getVoices().find(v => /^ar/i.test(v.lang));
    if (v) u.voice = v;
    else if (!this.warned) { this.warned = true; toast('No Arabic voice found — using default voice', 'warn', 'info'); }
    u.onend = u.onerror = () => this.clear();
    this.id = id;
    $('#seg-' + id)?.classList.add('playing');
    speechSynthesis.speak(u);
  },
  clear() { if (this.id != null) $('#seg-' + this.id)?.classList.remove('playing'); this.id = null; },
  stop() { if ('speechSynthesis' in window) speechSynthesis.cancel(); this.clear(); }
};
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => {};

/* ── auto-scroll ── */
const AS = { on:false, raf:0, speed:3 };
function asTick() { if (!AS.on) return; scrollBy(0, AS.speed * .55); AS.raf = requestAnimationFrame(asTick); }
function toggleAutoScroll() {
  AS.on = !AS.on;
  $('#as-btn')?.classList.toggle('on', AS.on);
  Sound.play(AS.on ? 'on' : 'off');
  if (AS.on) asTick(); else cancelAnimationFrame(AS.raf);
}
function stopAutoScroll() { AS.on = false; cancelAnimationFrame(AS.raf); $('#as-btn')?.classList.remove('on'); }
addEventListener('wheel', () => AS.on && stopAutoScroll(), { passive:true });
addEventListener('touchstart', () => AS.on && stopAutoScroll(), { passive:true });

/* ═══════════ VIEW · LIBRARY ═══════════ */
function vLibrary() {
  const bmIds = Object.keys(S.bookmarks).map(Number).sort((a,b) => a-b);
  const noteIds = Object.keys(S.notes).map(Number).sort((a,b) => a-b);
  const list = libTab === 'bm' ? bmIds : noteIds;
  const items = list.map(id => {
    const s = IDX[id]; if (!s) return '';
    return `<div class="lib-item">
      <span class="seg-num">${id}</span>
      <div class="body" data-action="jump" data-id="${id}">
        <div class="lib-meta">${esc(SEC_OF[id].en)}</div>
        <div class="snip-ar">${esc(s.ar)}</div>
        <div class="snip-en">${esc(s.en)}</div>
        ${libTab === 'notes' ? `<div class="lib-note">${esc(S.notes[id].t)}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${libTab === 'notes' ? `<button class="icon-btn" data-action="note-edit" data-id="${id}" data-tip="Edit">${ic('note')}</button>` : ''}
        <button class="icon-btn" data-action="${libTab === 'bm' ? 'bm-remove' : 'note-del-lib'}" data-id="${id}" data-tip="Remove">${ic('trash')}</button>
      </div></div>`;
  }).join('');
  const empty = `<div class="empty">${ic(libTab === 'bm' ? 'bm' : 'feather')}
    <h3>${libTab === 'bm' ? 'No bookmarks yet' : 'No notes yet'}</h3>
    <p>${libTab === 'bm' ? 'Tap the ribbon icon on any passage to keep it here.' : 'Tap the pen icon on any passage to write a reflection.'}</p>
    <button class="btn primary" data-action="nav" data-view="read">${ic('book')}Go to the reader</button></div>`;
  return `<div class="page">
    <div class="lib-tabs">
      <button class="chip ${libTab==='bm'?'active':''}" data-action="lib-tab" data-v="bm">${ic('bm')}Bookmarks · ${bmIds.length}</button>
      <button class="chip ${libTab==='notes'?'active':''}" data-action="lib-tab" data-v="notes">${ic('note')}Notes · ${noteIds.length}</button>
    </div>${list.length ? items : empty}</div>`;
}

/* ═══════════ VIEW · TASBIH ═══════════ */
const PHRASES = [
  { ar:'أَسْتَغْفِرُ اللهَ وَأَتُوبُ إِلَيْهِ', en:'I seek God’s forgiveness and turn to Him' },
  { ar:'سُبْحَانَ اللهِ وَبِحَمْدِهِ', en:'Glory and praise be to God' },
  { ar:'لَا إِلَهَ إِلَّا اللهُ', en:'There is no god but God' },
  { ar:'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَآلِ مُحَمَّدٍ', en:'O God, bless Muhammad and his family' }
];
const TARGETS = [33, 99, 100, 313, 1000];
function vTasbih() {
  const t = S.tasbih, p = PHRASES[t.phrase] || PHRASES[0];
  return `<div class="page"><div class="tas-wrap">
    <div class="phrase-row">${PHRASES.map((p,i) => `<button class="chip ${i===t.phrase?'active':''}" data-action="tasbih-phrase" data-v="${i}">${['Istighfār','Taḥmīd','Tahlīl','Ṣalawāt'][i]}</button>`).join('')}</div>
    <div class="tas-phrase">${p.ar}</div><div class="tas-phrase-en">${esc(p.en)}</div>
    <button class="tas-btn" id="tasbih-btn" data-action="tasbih-inc" aria-label="Count">
      <svg class="ring" viewBox="0 0 300 300">
        <circle class="bg" cx="150" cy="150" r="140" stroke-width="10"/>
        <circle class="fg" id="tasbih-ring" cx="150" cy="150" r="140" stroke-width="10" stroke-dasharray="${2*Math.PI*140}" stroke-dashoffset="${2*Math.PI*140}"/>
      </svg>
      <div class="tas-core"><small>tap or press space</small><b id="tasbih-count">0</b><div class="left" id="tasbih-left"></div></div>
    </button>
    <div class="phrase-row">${TARGETS.map(v => `<button class="chip ${v===t.target?'active':''}" data-action="tasbih-target" data-v="${v}">${v}</button>`).join('')}</div>
    <div class="tas-ctrl">
      <button class="btn" data-action="tasbih-dec">${ic('minus')}Undo</button>
      <button class="btn danger" data-action="tasbih-reset">${ic('rotate')}Reset round</button>
    </div>
    <div class="tas-stats">
      <span>Round <b id="tasbih-session">0</b> / ${t.target}</span>
      <span>Lifetime <b id="tasbih-total">${fmt(t.total)}</b></span>
      <span>Today <b id="tasbih-today">${fmt(act().t)}</b></span>
    </div>
  </div></div>`;
}
function updateTasbihUI() {
  const t = S.tasbih, C = 2 * Math.PI * 140;
  const ring = $('#tasbih-ring'); if (!ring) return;
  ring.style.strokeDashoffset = C * (1 - (t.session % (t.target + 1)) / t.target);
  if (t.session >= t.target && t.session % t.target === 0 && t.session > 0) ring.style.strokeDashoffset = 0;
  $('#tasbih-count').textContent = fmt(t.session);
  $('#tasbih-left').textContent = t.session >= t.target ? '✦ target reached ✦' : `${t.target - t.session} to go`;
  $('#tasbih-session').textContent = fmt(t.session);
  $('#tasbih-total').textContent = fmt(t.total);
  $('#tasbih-today').textContent = fmt(act().t);
}
function tasbihInc() {
  const t = S.tasbih;
  t.session++; t.total++; act().t++;
  persist(); updateTasbihUI();
  Sound.play('tick'); buzz(8);
  const b = $('#tasbih-btn'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
  if (t.session === t.target) { Sound.play('chime'); buzz([20,40,20]); confetti(90); toast(`Target of ${t.target} reached — may it be accepted`, 'gold', 'spark'); }
  checkAch();
}
function tasbihDec() {
  const t = S.tasbih;
  if (t.session > 0) { t.session--; t.total = Math.max(0, t.total - 1); act().t = Math.max(0, act().t - 1); persist(); updateTasbihUI(); Sound.play('tap'); }
}

/* ═══════════ VIEW · STATS ═══════════ */
const ACH = [
  { k:'first',  ic:'spark',  t:'First Light',       d:'Mark your first passage as read',        f:() => readCount() >= 1 },
  { k:'ten',    ic:'book',   t:'Devoted Reader',    d:'Read 10 passages',                        f:() => readCount() >= 10 },
  { k:'all',    ic:'award',  t:'The Full Surrender',d:'Read all 43 passages',                    f:() => readCount() >= SEGS.length },
  { k:'bm5',    ic:'bm',     t:'Keeper of Verses',  d:'Bookmark 5 passages',                     f:() => Object.keys(S.bookmarks).length >= 5 },
  { k:'note',   ic:'feather',t:'The Scribe',        d:'Write your first reflection',             f:() => Object.keys(S.notes).length >= 1 },
  { k:'d100',   ic:'target', t:'The Remembering',   d:'100 tasbīḥ counted',                      f:() => S.tasbih.total >= 100 },
  { k:'d1000',  ic:'zap',    t:'Thousandfold',      d:'1,000 tasbīḥ counted',                    f:() => S.tasbih.total >= 1000 },
  { k:'s3',     ic:'flame',  t:'Three Dawns',       d:'A 3-day practice streak',                 f:() => streak() >= 3 },
  { k:'s7',     ic:'sun',    t:'A Week of Light',   d:'A 7-day practice streak',                 f:() => streak() >= 7 }
];
function checkAch() {
  ACH.forEach(a => {
    if (!S.ach[a.k] && a.f()) {
      S.ach[a.k] = Date.now(); persist();
      Sound.play('fanfare'); confetti(70);
      toast(`Achievement — ${a.t}`, 'gold', 'award');
    }
  });
}
function celebrate() { Sound.play('fanfare'); confetti(220); toast('The entire duʿāʾ is read. Taqabbal Allāh!', 'gold', 'spark'); }
function heatHTML() {
  const today = new Date(); today.setHours(0,0,0,0);
  const start = new Date(today); start.setDate(start.getDate() - start.getDay() - 77);
  let cells = '';
  for (let w = 0; w < 12; w++) for (let d = 0; d < 7; d++) {
    const dt = new Date(start); dt.setDate(start.getDate() + w * 7 + d);
    const k = dayKey(dt), a = S.activity[k], v = a ? a.r + a.t : 0;
    const lvl = v === 0 ? 0 : v < 5 ? 1 : v < 15 ? 2 : v < 40 ? 3 : 4;
    cells += `<i class="${dt > today ? 'future' : lvl ? 'l'+lvl : ''}" title="${k} · ${a ? `${a.r} read, ${a.t} tasbīḥ` : 'rest'}"></i>`;
  }
  return `<div class="heat">${cells}</div>
    <div class="heat-legend">less <i style="background:var(--panel2)"></i><i class="l1" style="background:color-mix(in srgb,var(--acc2) 30%,var(--panel2))"></i><i style="background:color-mix(in srgb,var(--acc2) 55%,var(--panel2))"></i><i style="background:color-mix(in srgb,var(--acc2) 78%,var(--panel2))"></i><i style="background:var(--acc2)"></i> more</div>`;
}
function vStats() {
  const rc = readCount(), mins = Math.round(Object.values(S.activity).reduce((s,a) => s + a.s, 0) / 60);
  const a = act(), goal = S.settings.goal;
  return `<div class="page">
  <div class="grid g4">
    <div class="card"><div class="stat-ic">${ic('flame')}</div><div class="stat-big">${streak()}</div><div class="stat-lbl">day streak</div></div>
    <div class="card"><div class="stat-ic green">${ic('book')}</div><div class="stat-big">${rc}<span class="mut" style="font-size:18px">/${SEGS.length}</span></div><div class="stat-lbl">passages read</div></div>
    <div class="card"><div class="stat-ic">${ic('target')}</div><div class="stat-big">${fmt(S.tasbih.total)}</div><div class="stat-lbl">lifetime tasbīḥ</div></div>
    <div class="card"><div class="stat-ic green">${ic('clock')}</div><div class="stat-big">${fmt(mins)}</div><div class="stat-lbl">minutes with the text</div></div>
  </div>
  <div class="grid g2" style="margin-top:18px">
    <div class="card">
      <div class="home-card-h">${ic('target')}Today's intention</div>
      <div class="ring-wrap">
        <div class="ring-box">${ringSVG(a.r / goal)}<div class="ring-txt"><b>${a.r}</b><small>of ${goal}</small></div></div>
        <div><p class="mut" style="font-size:13.5px;line-height:1.7">${a.r >= goal ? 'Fulfilled. Extra passages are extra light.' : `Read ${goal - a.r} more passage${goal-a.r>1?'s':''} today.`}<br>Today: <b style="color:var(--ink)">${a.t}</b> tasbīḥ · <b style="color:var(--ink)">${Math.round(a.s/60)}</b> min reading.</p>
        <button class="btn" style="margin-top:12px" data-action="nav" data-view="read">${ic('book')}Continue</button></div>
      </div>
    </div>
    <div class="card">
      <div class="home-card-h">${ic('cal')}Last 12 weeks</div>
      ${heatHTML()}
    </div>
  </div>
  <div class="sec-title">Achievements · ${Object.keys(S.ach).length}/${ACH.length}</div>
  <div class="ach-grid">${ACH.map(x => {
    const won = S.ach[x.k];
    return `<div class="ach ${won ? 'won' : 'locked'}">${ic(x.ic)}<div><h4>${esc(x.t)}</h4><p>${esc(x.d)}</p>${won ? `<small>Unlocked ${new Date(won).toLocaleDateString()}</small>` : ''}</div></div>`;
  }).join('')}</div>
  <div class="sec-title">Data</div>
  <div style="display:flex;gap:10px;flex-wrap:wrap">
    <button class="btn" data-action="export">${ic('dl')}Export JSON</button>
    <button class="btn" data-action="import">${ic('ul')}Import JSON</button>
    <button class="btn" data-action="sync-now">${ic('sync')}Sync now</button>
  </div></div>`;
}

/* ═══════════ SEARCH ═══════════ */
function highlight(str, cache, qn) {
  const i = cache.n.indexOf(qn);
  if (i < 0) return esc(str.slice(0, 110)) + (str.length > 110 ? '…' : '');
  const s = cache.map ? cache.map[i] : i;
  const e = cache.map ? cache.map[i + qn.length - 1] + 1 : i + qn.length;
  const a = Math.max(0, s - 36), b = Math.min(str.length, e + 70);
  return (a > 0 ? '…' : '') + esc(str.slice(a, s)) + '<mark>' + esc(str.slice(s, e)) + '</mark>' + esc(str.slice(e, b)) + (b < str.length ? '…' : '');
}
function doSearch(q) {
  const box = $('#search-results');
  q = q.trim();
  if (q.length < 2) { box.innerHTML = `<div class="ov-empty">Type at least two letters — Arabic diacritics are ignored.</div>`; return; }
  const isAr = /[\u0600-\u06FF]/.test(q);
  const qn = isAr ? normAr(q).n : q.toLowerCase();
  const out = [];
  for (const sg of SEGS) {
    const c = normCache[sg.id]; let field = null, cache = null;
    if (isAr) {
      if (c.ar.n.includes(qn)) { field = 'ar'; cache = c.ar; }
      else if (c.fa.n.includes(qn)) { field = 'fa'; cache = c.fa; }
    } else if (c.en.n.includes(qn)) { field = 'en'; cache = c.en; }
    if (field) out.push({ sg, field, cache });
    if (out.length >= 30) break;
  }
  box.innerHTML = out.length ? out.map((r, i) => `<button class="ov-item ${i===0?'kactive':''}" data-action="jump" data-id="${r.sg.id}">
    <span class="seg-num">${r.sg.id}</span>
    <div class="t"><b>${esc(SEC_OF[r.sg.id].en)}</b>
    <span dir="${r.field==='en'?'ltr':'rtl'}" class="${r.field==='ar'?'ar-snip':''}">${highlight(r.sg[r.field], r.cache, qn)}</span></div>${ic('cr')}</button>`).join('')
    : `<div class="ov-empty">Nothing found for “${esc(q)}”.</div>`;
}
function openSearch() { $('#search-overlay').classList.add('open'); $('#search-input').value=''; doSearch(''); Sound.play('open'); setTimeout(() => $('#search-input').focus(), 60); }
function closeSearch() { $('#search-overlay').classList.remove('open'); Sound.play('close'); }

/* ═══════════ COMMAND PALETTE ═══════════ */
let palIdx = 0, palItems = [];
function commands() {
  const c = [
    { t:'Go · Home', ic:'home', run:() => navigate('home') },
    { t:'Go · Reader', ic:'book', run:() => navigate('read') },
    { t:'Go · Library', ic:'bm', run:() => navigate('library') },
    { t:'Go · Tasbīḥ', ic:'target', run:() => navigate('tasbih') },
    { t:'Go · Journey (stats)', ic:'flame', run:() => navigate('stats') },
    { t:'Search the text', ic:'search', run:openSearch },
    { t:'Toggle UI sounds', ic:'vol', run:() => H['toggle-sound']() },
    { t:'Toggle focus mode', ic:'focus', run:() => { navigate('read'); setTimeout(() => H.focus(), 120); } },
    { t:'Open settings', ic:'set', run:openSettings },
    { t:'Export my data', ic:'dl', run:exportData },
    { t:'Sync now', ic:'sync', run:syncNow },
    { t: session ? 'Sign out' : 'Sign in / Create account', ic: session ? 'out' : 'user', run:() => session ? signOut() : openAuth() },
    { t:'About & keyboard shortcuts', ic:'info', run:openAbout }
  ];
  if (DATA) DATA.sections.forEach((s, i) => c.push({ t:`Chapter ${i+1} · ${s.en}`, ic:'list', run:() => { navigate('read'); setTimeout(() => $('#' + s.id)?.scrollIntoView({ block:'start' }), 150); } }));
  return c;
}
function renderPalette(q='') {
  palItems = commands().filter(c => c.t.toLowerCase().includes(q.toLowerCase()));
  palIdx = 0;
  $('#palette-list').innerHTML = palItems.length
    ? palItems.map((c, i) => `<button class="ov-item ${i===0?'kactive':''}" data-pal="${i}">${ic(c.ic)}<div class="t"><b>${esc(c.t)}</b></div></button>`).join('')
    : `<div class="ov-empty">No matching command.</div>`;
}
function openPalette() { $('#palette').classList.add('open'); $('#palette-input').value=''; renderPalette(); Sound.play('open'); setTimeout(() => $('#palette-input').focus(), 60); }
function closePalette() { $('#palette').classList.remove('open'); Sound.play('close'); }
function palMove(d) {
  palIdx = clamp(palIdx + d, 0, palItems.length - 1);
  $$('#palette-list .ov-item').forEach((el, i) => el.classList.toggle('kactive', i === palIdx));
  $('#palette-list .kactive')?.scrollIntoView({ block:'nearest' });
}
function palRun(i = palIdx) { const c = palItems[i]; if (c) { closePalette(); c.run(); } }

/* ═══════════ ABOUT ═══════════ */
function openAbout() {
  const keys = [['/','Search'],['Ctrl / ⌘ + K','Command palette'],['1 – 5','Switch views'],['M','Mute / unmute'],
    ['F','Focus mode (reader)'],['A','Auto-scroll (reader)'],['+ / −','Arabic size'],['B','Bookmark current passage'],
    ['R','Mark current read'],['Space','Count tasbīḥ'],['Esc','Close / exit'],['?','This panel']];
  openModal(`<button class="icon-btn modal-x" data-action="modal-close">${ic('x')}</button>
    <h2>${ic('info')}About Nūr</h2>
    <div class="about-ar">فَيَا مَنْ وَعَدَ فَوَفَى، وَأَوْعَدَ فَعَفَا</div>
    <div class="m-body">A luminous home for the Grand Istighfār — ${esc(DATA.meta.attribution.en)}.
    Arabic reconstructed & fully vocalized from published editions (${esc(DATA.meta.source)}); English and Persian translations freshly composed for this app.
    43 passages · 13 chapters · guest mode with optional Supabase cloud sync.</div>
    <div class="sec-title" style="margin:22px 0 4px">Keyboard</div>
    <div class="keys-grid">${keys.map(k => `<div><span>${esc(k[1])}</span><kbd>${esc(k[0])}</kbd></div>`).join('')}</div>`);
}

/* ═══════════ DATA EXPORT / IMPORT / RESET ═══════════ */
function exportData() {
  const blob = new Blob([JSON.stringify({ ...S, exported_at: new Date().toISOString() }, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `nur-istighfar-${dayKey()}.json`; a.click();
  URL.revokeObjectURL(a.href);
  Sound.play('success'); toast('Data exported', 'ok', 'dl');
}
function bindImport() {
  $('#import-file').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (j.v !== 1) throw new Error('Not a Nūr backup file');
      S = mergeState(S, j); persistLocal(); applySettings(); persist(); render();
      Sound.play('success'); toast('Data imported & merged', 'ok', 'ul');
    } catch (err) { Sound.play('error'); toast('Import failed: ' + err.message, 'err', 'alert'); }
    e.target.value = '';
  });
}
async function resetData() {
  const ok = await confirmBox({ title:'Reset all progress?', body:'Read marks, bookmarks, notes, tasbīḥ and streaks will be cleared on this device' + (session ? ' and in the cloud.' : '.'), ok:'Reset everything', danger:true });
  if (!ok) return;
  S = { ...structuredClone(DEFAULTS), settings: S.settings };
  persist(); render(); Sound.play('off'); toast('A clean page. Begin again.', 'ok', 'rotate');
}

/* ═══════════ FX · starfield & confetti ═══════════ */
const FX = {
  cv: $('#fx'), cx: null, ps: [], raf: 0,
  init() {
    this.cx = this.cv.getContext('2d');
    this.resize(); addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => document.hidden ? cancelAnimationFrame(this.raf) : this.loop());
    this.loop();
  },
  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.cv.width = innerWidth * dpr; this.cv.height = innerHeight * dpr;
    this.cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(130, Math.floor(innerWidth * innerHeight / 16000));
    this.ps = Array.from({ length: n }, () => ({
      x: Math.random() * innerWidth, y: Math.random() * innerHeight,
      r: Math.random() * 1.7 + .4, v: Math.random() * .16 + .04,
      p: Math.random() * Math.PI * 2, gold: Math.random() > .45
    }));
    if (!S.settings.motion) this.static();
  },
  colors() {
    const cs = getComputedStyle(document.documentElement);
    return [cs.getPropertyValue('--acc').trim() || '#d4af37', cs.getPropertyValue('--acc2').trim() || '#2dd4a7'];
  },
  draw(t) {
    const [a, b] = this.colors();
    this.cx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of this.ps) {
      const tw = .35 + .65 * Math.abs(Math.sin(t / 1700 + p.p));
      this.cx.globalAlpha = tw * .55;
      this.cx.fillStyle = p.gold ? a : b;
      this.cx.beginPath(); this.cx.arc(p.x, p.y, p.r, 0, 7); this.cx.fill();
    }
    this.cx.globalAlpha = 1;
  },
  loop() {
    if (!S.settings.motion) { this.static(); return; }
    const step = t => {
      this.draw(t);
      for (const p of this.ps) { p.y -= p.v; if (p.y < -4) { p.y = innerHeight + 4; p.x = Math.random() * innerWidth; } }
      this.raf = requestAnimationFrame(step);
    };
    cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(step);
  },
  static() { cancelAnimationFrame(this.raf); this.draw(1200); }
};
function confetti(n = 120) {
  if (!S.settings.motion) return;
  const cv = $('#confetti'), cx = cv.getContext('2d');
  cv.width = innerWidth; cv.height = innerHeight;
  const cols = ['#d4af37', '#2dd4a7', '#f0c674', '#e9edf5', '#c9a2ff'];
  const ps = Array.from({ length: n }, () => ({
    x: innerWidth / 2 + (Math.random() - .5) * innerWidth * .5, y: innerHeight * .35,
    vx: (Math.random() - .5) * 11, vy: -Math.random() * 11 - 3,
    s: Math.random() * 7 + 4, r: Math.random() * Math.PI, vr: (Math.random() - .5) * .3,
    c: cols[Math.floor(Math.random() * cols.length)], life: 1
  }));
  let frames = 0;
  (function tick() {
    cx.clearRect(0, 0, cv.width, cv.height);
    let alive = false;
    for (const p of ps) {
      p.vy += .28; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= .008;
      if (p.life > 0 && p.y < cv.height + 30) {
        alive = true;
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r);
        cx.globalAlpha = Math.max(0, p.life); cx.fillStyle = p.c;
        cx.fillRect(-p.s/2, -p.s/2, p.s, p.s * .6); cx.restore();
      }
    }
    if (alive && ++frames < 300) requestAnimationFrame(tick);
    else cx.clearRect(0, 0, cv.width, cv.height);
  })();
}

/* ═══════════ ACTION HANDLERS ═══════════ */
const H = {
  'nav': t => navigate(t.dataset.view),
  'jump': t => { closeSearch(); closePalette(); navigate('read', t.dataset.id); },
  'begin': () => navigate('read', SEGS[0].id),
  'continue': () => navigate('read', S.last || SEGS[0].id),
  'daily': () => navigate('read', SEGS[Math.floor(Date.now()/864e5) % SEGS.length].id),
  'account': () => toggleAccountMenu(),
  'open-auth': () => { closeSettings(); openAuth(); },
  'close-auth': () => closeAuth(),
  'auth-tab': t => { authTab(t.dataset.v); Sound.play('tap'); },
  'auth-forgot': () => { $('#form-in').hidden = true; $('#form-forgot').hidden = false; $('#fg-email').value = $('#in-email').value; },
  'auth-back': () => authTab('in'),
  'resend': async () => {
    try {
      await sb('/auth/v1/resend', { method:'POST', auth:false, body:{ type:'signup', email: $('#auth-verify').dataset.email } });
      toast('Verification email resent', 'ok', 'mail'); Sound.play('success');
    } catch (e) { authError(e.message); }
  },
  'eye': t => { const i = $('#' + t.dataset.t); i.type = i.type === 'password' ? 'text' : 'password'; t.innerHTML = ic(i.type === 'password' ? 'eye' : 'eyeoff'); },
  'logout': () => { $('#account-menu').hidden = true; closeSettings(); signOut(); },
  'sync-now': () => { $('#account-menu').hidden = true; syncNow(); },
  'toggle-sound': () => { S.settings.sound = !S.settings.sound; applySettings(); persist(); syncDrawerInputs(); Sound.play(S.settings.sound ? 'on' : 'off'); toast(S.settings.sound ? 'Sounds on' : 'Sounds muted', 'ok', S.settings.sound ? 'vol' : 'volx'); },
  'open-settings': () => { $('#account-menu').hidden = true; openSettings(); },
  'close-settings': () => closeSettings(),
  'open-search': () => openSearch(),
  'close-search': () => closeSearch(),
  'open-palette': () => openPalette(),
  'close-palette': () => closePalette(),
  'open-about': () => openAbout(),
  'theme': t => { S.settings.theme = t.dataset.v; applySettings(); persist(); Sound.play('pop'); FX.static(); if (S.settings.motion) FX.loop(); },
  'font-up':   () => { S.settings.fontScale = clamp(+(S.settings.fontScale + .1).toFixed(2), .8, 1.6); applySettings(); persist(); },
  'font-down': () => { S.settings.fontScale = clamp(+(S.settings.fontScale - .1).toFixed(2), .8, 1.6); applySettings(); persist(); },
  'trans-cycle': () => { const o = ['en','fa','both','none']; S.settings.trans = o[(o.indexOf(S.settings.trans) + 1) % 4]; persist(); render(); toast('Translation: ' + { en:'English', fa:'فارسی', both:'Both', none:'Arabic only' }[S.settings.trans], 'ok', 'list'); },
  'focus': () => { document.body.classList.toggle('focus'); Sound.play(document.body.classList.contains('focus') ? 'open' : 'close'); },
  'autoscroll': () => toggleAutoScroll(),
  'seg-read': t => setRead(t.dataset.id, !S.read[+t.dataset.id]),
  'seg-bm': t => toggleBookmark(t.dataset.id),
  'seg-note': t => openNote(t.dataset.id),
  'seg-copy': t => copySeg(t.dataset.id),
  'seg-play': t => { const id = +t.dataset.id; if (TTS.id === id) { TTS.stop(); Sound.play('tap'); } else TTS.speak(id); },
  'sec-read': t => markSection(t.dataset.sec),
  'lib-tab': t => { libTab = t.dataset.v; render(); Sound.play('tap'); },
  'bm-remove': t => { toggleBookmark(t.dataset.id); render(); },
  'note-edit': t => openNote(t.dataset.id),
  'note-del-lib': t => { delete S.notes[+t.dataset.id]; persist(); render(); Sound.play('tap'); toast('Note removed', 'ok', 'trash'); },
  'note-save': t => saveNote(t.dataset.id),
  'note-del': t => { delete S.notes[+t.dataset.id]; persist(); refreshSeg(+t.dataset.id); closeModal(); Sound.play('tap'); toast('Note removed', 'ok', 'trash'); },
  'tasbih-inc': () => tasbihInc(),
  'tasbih-dec': () => tasbihDec(),
  'tasbih-reset': async () => { if (await confirmBox({ title:'Reset this round?', body:`The round counter returns to 0. Lifetime total (${fmt(S.tasbih.total)}) is kept.`, ok:'Reset round' })) { S.tasbih.session = 0; persist(); updateTasbihUI(); Sound.play('off'); } },
  'tasbih-target': t => { S.tasbih.target = +t.dataset.v; persist(); render(); Sound.play('pop'); },
  'tasbih-phrase': t => { S.tasbih.phrase = +t.dataset.v; persist(); render(); Sound.play('pop'); },
  'export': () => { $('#account-menu').hidden = true; exportData(); },
  'import': () => $('#import-file').click(),
  'reset-data': () => resetData(),
  'modal-close': () => closeModal(),
  'confirm-ok': () => { const r = modalResolve; modalResolve = null; closeModal(); r && r(true); },
  'retry': () => location.reload()
};
const SELF_SOUND = new Set(['seg-read','seg-bm','seg-play','toggle-sound','theme','tasbih-inc','tasbih-dec','tasbih-target','tasbih-phrase','font-up','font-down','trans-cycle','focus','autoscroll','modal-close','close-search','close-palette','close-settings','close-auth','open-search','open-palette','open-settings','open-about','open-auth','lib-tab','seg-copy','note-save','note-del','bm-remove','note-del-lib','export','resend','auth-tab','eye','seg-note','note-edit','sec-read','account','continue','begin','daily','jump','nav']);

/* ═══════════ GLOBAL EVENTS ═══════════ */
document.addEventListener('click', e => {
  const pal = e.target.closest('[data-pal]');
  if (pal) { palRun(+pal.dataset.pal); return; }
  const t = e.target.closest('[data-action]');
  if (!t) { if (!e.target.closest('#account-menu') && !e.target.closest('#btn-account')) $('#account-menu').hidden = true; return; }
  const a = t.dataset.action;
  if (!SELF_SOUND.has(a)) Sound.play('tap');
  H[a] && H[a](t, e);
});
let hoverAt = 0;
document.addEventListener('mouseover', e => {
  if (!e.target.closest('.btn, .icon-btn, .rail-btn, .chip, .tool-btn, .quick button')) return;
  const now = Date.now();
  if (now - hoverAt > 90) { hoverAt = now; Sound.play('hover'); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'as-speed') { AS.speed = +t.value; return; }
  if (t.id === 'search-input') { doSearch(t.value); return; }
  if (t.id === 'palette-input') { renderPalette(t.value); return; }
  const k = t.dataset.set; if (!k) return;
  const v = t.type === 'checkbox' ? t.checked : (t.type === 'range' || t.type === 'number') ? parseFloat(t.value) : t.value;
  S.settings[k] = k === 'goal' ? clamp(Math.round(v) || 5, 1, 43) : v;
  applySettings(); persist();
  if (k === 'volume') Sound.play('tick');
  if (k === 'sound') Sound.play(v ? 'on' : 'off');
  if ((k === 'trans' && VIEW === 'read') || k === 'goal') render();
});
document.addEventListener('change', e => {
  if (e.target.id === 'reader-sec') $('#' + e.target.value)?.scrollIntoView({ block:'start', behavior:'smooth' });
});
['pointerdown','keydown'].forEach(ev => document.addEventListener(ev, () => { lastActive = Date.now(); }, { passive:true }));
document.addEventListener('pointerdown', function once() {
  document.removeEventListener('pointerdown', once);
  if (S.settings.ambient && S.settings.sound) Ambient.start();
}, { once:true });

document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#palette').classList.contains('open') ? closePalette() : openPalette(); return; }
  if (e.key === 'Escape') {
    if ($('#modal-root').innerHTML) closeModal();
    else if ($('#palette').classList.contains('open')) closePalette();
    else if ($('#search-overlay').classList.contains('open')) closeSearch();
    else if ($('#auth-modal').classList.contains('open')) closeAuth();
    else if (document.body.classList.contains('drawer-open')) closeSettings();
    else if (!$('#account-menu').hidden) $('#account-menu').hidden = true;
    else if (document.body.classList.contains('focus')) H.focus();
    return;
  }
  if ($('#palette').classList.contains('open')) {
    if (e.key === 'ArrowDown') { e.preventDefault(); palMove(1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); palMove(-1); }
    if (e.key === 'Enter') { e.preventDefault(); palRun(); }
    return;
  }
  if ($('#search-overlay').classList.contains('open')) {
    if (e.key === 'Enter') { e.preventDefault(); $('#search-results .ov-item')?.click(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = $$('#search-results .ov-item'); if (!items.length) return;
      let i = items.findIndex(x => x.classList.contains('kactive'));
      i = clamp(i + (e.key === 'ArrowDown' ? 1 : -1), 0, items.length - 1);
      items.forEach((x, j) => x.classList.toggle('kactive', j === i));
      items[i].scrollIntoView({ block:'nearest' });
    }
    return;
  }
  if (typing) return;
  const k = e.key;
  if (k === '/') { e.preventDefault(); openSearch(); return; }
  if (k === '?') { openAbout(); return; }
  if (k.toLowerCase() === 'm') { H['toggle-sound'](); return; }
  if (['1','2','3','4','5'].includes(k)) { navigate(['home','read','library','tasbih','stats'][+k - 1]); return; }
  if (VIEW === 'tasbih' && k === ' ') { e.preventDefault(); tasbihInc(); return; }
  if (VIEW === 'read') {
    if (k.toLowerCase() === 'f') H.focus();
    if (k.toLowerCase() === 'a') toggleAutoScroll();
    if (k === '+' || k === '=') H['font-up']();
    if (k === '-') H['font-down']();
    if (k.toLowerCase() === 'b' && S.last) toggleBookmark(S.last);
    if (k.toLowerCase() === 'r' && S.last) setRead(S.last, !S.read[S.last]);
    if (k === 'ArrowRight' || k === 'ArrowLeft') {
      e.preventDefault();
      const ids = SEGS.map(s => s.id);
      const i = clamp(ids.indexOf(S.last || ids[0]) + (k === 'ArrowRight' ? 1 : -1), 0, ids.length - 1);
      $('#seg-' + ids[i])?.scrollIntoView({ block:'center', behavior:'smooth' });
    }
  }
});

/* reading-time tracker */
setInterval(() => {
  if (VIEW === 'read' && document.visibilityState === 'visible' && Date.now() - lastActive < 90000) {
    act().s += 5; persistLocal(); syncSoon();
  }
}, 5000);

/* ═══════════ BOOT ═══════════ */
async function init() {
  applySettings();
  FX.init();
  bindAuthForms(); bindImport();
  addEventListener('hashchange', render);
  try {
    await loadData();
  } catch (err) {
    $('#boot-msg').innerHTML = `Could not load <b>data/estighfar.json</b> (${esc(err.message)}).<br>Serve this folder over HTTP, e.g.<br><kbd>python -m http.server</kbd> or <kbd>npx serve</kbd>`;
    $('.boot-bar').style.display = 'none';
    $('.boot-inner').insertAdjacentHTML('beforeend', `<button class="btn primary" data-action="retry">${ic('rotate')}Retry</button>`);
    return;
  }
  if (!location.hash) history.replaceState(null, '', '#/home');
  render(); updateAccountUI();
  $('#boot').classList.add('done');
  setTimeout(() => $('#boot').remove(), 700);
  if (session) {
    if (session.expires_at * 1000 < Date.now() + 60000) await tryRefresh();
    if (session) { scheduleRefresh(); afterAuth(); }
  } else setSync('off');
  checkAch();
  console.log('%c۞ Nūr · The Grand Istighfār — vanilla JS, no frameworks.', 'color:#d4af37;font-size:13px');
}
init();

})();
