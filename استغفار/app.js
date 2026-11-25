/* ═══════════════════════════════════════════════════════════════
   Nūr · The Grand Istighfār — reader, library, journey
   Vanilla JS, no build step. Arabic first; tap a verse to unfold it.
   ═══════════════════════════════════════════════════════════════ */
'use strict';
(() => {

const BUILD = '1.9';
const SB_URL  = 'https://ummhohozmpwltbgeczsf.supabase.co';
const SB_KEY  = 'sb_publishable_WcK2pmYMMu61z0KUub5jLA_KSxGpQD6';
const SB_DASH = 'https://supabase.com/dashboard/project/ummhohozmpwltbgeczsf/sql/new';
const T_STATE = 'istigfarqwen_user_state';
const T_ACT   = 'istigfarqwen_daily_activity';
const LS_STATE = 'nur.state.v1', LS_SESSION = 'nur.session.v1';
const AI_KEY_LS = 'nur.ai.key.v1', AI_CAT_LS = 'nur.ai.catalog.v1', AI_CACHE_LS = 'nur.ai.cache.v1', AI_BASE_LS = 'nur.ai.base.v1';
const AI_ENDPOINT = 'https://openrouter.ai/api/v1';

const SQL_TEXT = `create table if not exists public.istigfarqwen_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.istigfarqwen_daily_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  reads int not null default 0,
  seconds int not null default 0,
  primary key (user_id, day)
);
alter table public.istigfarqwen_user_state enable row level security;
alter table public.istigfarqwen_daily_activity enable row level security;
drop policy if exists "state_select" on public.istigfarqwen_user_state;
drop policy if exists "state_insert" on public.istigfarqwen_user_state;
drop policy if exists "state_update" on public.istigfarqwen_user_state;
create policy "state_select" on public.istigfarqwen_user_state for select using (auth.uid() = user_id);
create policy "state_insert" on public.istigfarqwen_user_state for insert with check (auth.uid() = user_id);
create policy "state_update" on public.istigfarqwen_user_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "act_select" on public.istigfarqwen_daily_activity;
drop policy if exists "act_insert" on public.istigfarqwen_daily_activity;
drop policy if exists "act_update" on public.istigfarqwen_daily_activity;
create policy "act_select" on public.istigfarqwen_daily_activity for select using (auth.uid() = user_id);
create policy "act_insert" on public.istigfarqwen_daily_activity for insert with check (auth.uid() = user_id);
create policy "act_update" on public.istigfarqwen_daily_activity for update using (auth.uid() = user_id) with check (auth.uid() = user_id);`;

/* ── helpers ─────────────────────────────────────────────────── */
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const ESC = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);
const ic = (n, cls = '') => `<svg class="ic ${cls}"><use href="#i-${n}"/></svg>`;
const flourish = () => `<svg class="flourish" viewBox="0 0 220 20" aria-hidden="true"><use href="#i-flourish"/></svg>`;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const deepCopy = o => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const buzz = ms => { try { navigator.vibrate?.(ms); } catch {} };
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const fmt = n => new Intl.NumberFormat('en').format(n);
const loadJSON = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const copyText = async txt => {
  try { await navigator.clipboard.writeText(txt); return true; }
  catch {
    const ta = document.createElement('textarea');
    ta.value = txt; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch {}
    ta.remove(); return ok;
  }
};

/* ── state ───────────────────────────────────────────────────── */
const reducedMotion = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
const SEED_MODELS = [
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B Instruct', ctx: 131072, free: true },
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1', ctx: 163840, free: true },
  { id: 'qwen/qwen-2.5-72b-instruct:free', name: 'Qwen 2.5 72B Instruct', ctx: 32768, free: true }
];
const DEFAULTS = {
  v: 1,
  settings: {
    theme: 'midnight', arFont: 'amiri', fontScale: 1, lineHeight: 2.05, trans: 'en',
    sound: true, volume: .7, ambient: false, motion: !reducedMotion, ttsRate: .85, goal: 5
  },
  read: {}, last: null, bookmarks: {}, notes: {}, ach: {}, activity: {}, coachSeen: false,
  ai: {
    models: SEED_MODELS.map(m => ({ ...m, enabled: true, addedAt: 0 })),
    active: SEED_MODELS[0].id
  }
};
const THEMES = ['midnight', 'royal', 'emerald', 'sepia', 'dawn'];
const ARFONTS = ['amiri', 'scheherazade', 'naskh'];
const TRANSS = ['en', 'fa', 'both'];
const TRANS_LABEL = { en: 'English', fa: 'فارسی', both: 'English + فارسی' };
const TRANS_SHORT = { en: 'EN', fa: 'فا', both: 'EN+فا' };

function withDefaults(s) {
  const d = deepCopy(DEFAULTS);
  if (!s || s.v !== 1) return d;
  return {
    ...d, ...s,
    settings: { ...d.settings, ...(s.settings || {}) },
    read: s.read || {}, bookmarks: s.bookmarks || {}, notes: s.notes || {},
    ach: s.ach || {}, activity: s.activity || {},
    ai: { ...d.ai, ...(s.ai || {}) }
  };
}
let S = withDefaults(loadJSON(LS_STATE));
let session = loadJSON(LS_SESSION);
let DATA = null, SEGS = [], IDX = {}, SEC_OF = {}, VIEW = 'read', libTab = 'bm';
let WORDS = {}, WORD = null, PICK = [];
let lastActive = Date.now(), io = null, refreshTimer = null;
let syncDetail = '', syncBlocked = false, setupToastShown = false, lastSyncAt = 0;
const normCache = {};

function clampSettings() {
  const st = S.settings;
  if (!THEMES.includes(st.theme)) st.theme = 'midnight';
  if (!ARFONTS.includes(st.arFont)) st.arFont = 'amiri';
  if (!TRANSS.includes(st.trans)) st.trans = 'en';
  st.fontScale = clamp(+st.fontScale || 1, .8, 1.6);
  st.lineHeight = clamp(+st.lineHeight || 2.05, 1.7, 2.7);
  st.volume = clamp(+st.volume || 0, 0, 1);
  st.ttsRate = clamp(+st.ttsRate || .85, .5, 1.3);
  st.goal = clamp(Math.round(+st.goal) || 5, 1, 43);
  st.sound = !!st.sound;
  st.ambient = !!st.ambient;
  st.motion = !!st.motion;
  if (!Array.isArray(S.ai?.models) || !S.ai.models.length) S.ai = deepCopy(DEFAULTS.ai);
  S.ai.models = S.ai.models.filter(m => m && typeof m.id === 'string' && m.id)
    .map(m => ({ ...m, enabled: m.enabled !== false }));
  if (!S.ai.models.some(m => m.id === S.ai.active && m.enabled !== false)) {
    const first = S.ai.models.find(m => m.enabled !== false);
    S.ai.active = first ? first.id : null;
  }
}
clampSettings();

const act = () => (S.activity[dayKey()] ||= { r: 0, s: 0 });
const readCount = () => Object.keys(S.read).length;
const chapterList = () => (DATA ? DATA.sections : []);
const chaptersDone = () => chapterList().filter(sec => sec.segments.every(x => S.read[x.id])).length;
const minutesTotal = () => Math.round(Object.values(S.activity).reduce((s, a) => s + (+a?.s || 0), 0) / 60);

function streak() {
  let n = 0; const d = new Date();
  const has = k => { const a = S.activity[k]; return !!a && ((+a.r || 0) > 0 || (+a.s || 0) >= 60); };
  if (!has(dayKey(d))) d.setDate(d.getDate() - 1);
  while (has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function sanitize() {
  const ok = id => !!IDX[+id];
  for (const k of Object.keys(S.read)) if (!ok(k)) delete S.read[k];
  for (const k of Object.keys(S.bookmarks)) if (!ok(k)) delete S.bookmarks[k];
  for (const k of Object.keys(S.notes)) if (!ok(k) || !S.notes[k]?.t) delete S.notes[k];
  if (S.last != null && !ok(S.last)) S.last = null;
  for (const k of Object.keys(S.activity)) {
    const a = S.activity[k];
    if (!a || typeof a !== 'object') { delete S.activity[k]; continue; }
    a.r = Math.max(0, Math.round(+a.r) || 0);
    a.s = Math.max(0, Math.round(+a.s) || 0);
    delete a.t;
  }
}
function persistLocal() { try { localStorage.setItem(LS_STATE, JSON.stringify(S)); } catch {} }
function persist() { persistLocal(); updateHUD(); syncSoon(); }

/* ═══════════ SOUND ═══════════ */
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
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    if (this.master) this.master.gain.value = S.settings.volume;
    return this.ctx;
  },
  tone(f, dur, type = 'sine', g = .14, at = 0, f2) {
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(), gn = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    gn.gain.setValueAtTime(0, t);
    gn.gain.linearRampToValueAtTime(g, t + .008);
    gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(gn); gn.connect(this.master);
    o.start(t); o.stop(t + dur + .05);
  },
  play(name) {
    if (name === 'hover' && (!this.ctx || this.ctx.state !== 'running')) return;
    if (!this.ensure()) return;
    const T = this.tone.bind(this);
    switch (name) {
      case 'tap':      T(340, .06, 'sine', .09); break;
      case 'hover':    T(560, .025, 'sine', .025); break;
      case 'open':     T(300, .13, 'sine', .08, 0, 620); break;
      case 'close':    T(620, .13, 'sine', .07, 0, 300); break;
      case 'on':       T(440, .05, 'triangle', .1); T(660, .07, 'triangle', .1, .06); break;
      case 'off':      T(660, .05, 'triangle', .09); T(330, .08, 'triangle', .09, .06); break;
      case 'success':  T(523, .09, 'sine', .11); T(659, .09, 'sine', .11, .08); T(784, .16, 'sine', .11, .16); break;
      case 'error':    T(190, .16, 'sawtooth', .07); T(150, .2, 'sawtooth', .06, .1); break;
      case 'bookmark': T(660, .06, 'triangle', .11); T(880, .1, 'triangle', .1, .06); break;
      case 'chime':    T(523, .9, 'sine', .12); T(1046, .9, 'sine', .06, .02); T(1568, 1.1, 'sine', .04, .05); break;
      case 'fanfare':  [523, 659, 784, 1046].forEach((f, i) => T(f, .22, 'triangle', .11, i * .11)); T(1568, .7, 'sine', .05, .5); break;
      case 'pop':      T(760, .045, 'sine', .09, 0, 980); break;
      case 'reveal':   T(520, .07, 'sine', .08, 0, 780); T(1040, .09, 'sine', .035, .05); break;
      case 'fold':     T(700, .07, 'sine', .06, 0, 420); break;
    }
  }
};
const Ambient = {
  nodes: null,
  start() {
    if (this.nodes) return;
    const c = Sound.ensure(); if (!c) return;
    const g = c.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(.05 * S.settings.volume, c.currentTime + 3);
    const o1 = c.createOscillator(), o2 = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain();
    o1.frequency.value = 110; o2.frequency.value = 110.6;
    o1.type = o2.type = 'sine';
    lfo.frequency.value = .08; lg.gain.value = .02 * S.settings.volume;
    lfo.connect(lg); lg.connect(g.gain);
    o1.connect(g); o2.connect(g); g.connect(c.destination);
    o1.start(); o2.start(); lfo.start();
    this.nodes = { o1, o2, lfo, g };
  },
  stop() {
    if (!this.nodes) return;
    const { o1, o2, lfo, g } = this.nodes, c = Sound.ctx;
    try { g.gain.linearRampToValueAtTime(0, c.currentTime + 1); } catch {}
    setTimeout(() => { try { o1.stop(); o2.stop(); lfo.stop(); } catch {} }, 1200);
    this.nodes = null;
  },
  sync() {
    if (!S.settings.sound || !S.settings.ambient) { this.stop(); return; }
    if (this.nodes) { try { this.nodes.g.gain.linearRampToValueAtTime(.05 * S.settings.volume, Sound.ctx.currentTime + .3); } catch {} }
    else this.start();
  }
};

/* ═══════════ SUPABASE (REST, no SDK) ═══════════ */
const errMsg = j => (j && (j.msg || j.error_description || j.message || (typeof j.error === 'string' && j.error) || j.hint)) || 'Something went wrong';

function setSession(j) {
  session = {
    access_token: j.access_token, refresh_token: j.refresh_token,
    expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600),
    user: j.user
  };
  try { localStorage.setItem(LS_SESSION, JSON.stringify(session)); } catch {}
  scheduleRefresh(); updateAccountUI();
}
function clearSession() {
  session = null;
  try { localStorage.removeItem(LS_SESSION); } catch {}
  clearTimeout(refreshTimer);
  updateAccountUI(); setSync('off');
}
async function sb(path, opts = {}) {
  const { method = 'GET', body, auth = true, prefer, _retried = false } = opts;
  const headers = { apikey: SB_KEY, 'Content-Type': 'application/json' };
  headers.Authorization = 'Bearer ' + (auth && session ? session.access_token : SB_KEY);
  if (prefer) headers.Prefer = prefer;
  let r;
  try { r = await fetch(SB_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined }); }
  catch { const e = new Error('Network error — check your connection'); e.network = true; throw e; }
  let j = null; try { j = await r.json(); } catch {}
  if (!r.ok) {
    if (r.status === 401 && session && path.startsWith('/rest') && !_retried) {
      if (await tryRefresh()) return sb(path, { ...opts, _retried: true });
    }
    const e = new Error(errMsg(j) || 'HTTP ' + r.status);
    e.code = j?.code; e.status = r.status;
    throw e;
  }
  return j;
}
async function tryRefresh() {
  if (!session?.refresh_token) return false;
  try {
    setSession(await sb('/auth/v1/token?grant_type=refresh_token', { method: 'POST', auth: false, body: { refresh_token: session.refresh_token } }));
    return true;
  } catch (e) {
    if (e.network) { setSync('err', 'Offline — session kept'); return false; }
    clearSession(); return false;
  }
}
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  if (!session) return;
  refreshTimer = setTimeout(async () => { if (await tryRefresh()) setSync('ok'); },
    Math.max(5000, session.expires_at * 1000 - Date.now() - 60000));
}
async function signIn(email, password) {
  setSession(await sb('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: { email, password } }));
  await afterAuth();
}
async function signUp(name, email, password) {
  const j = await sb('/auth/v1/signup', { method: 'POST', auth: false, body: { email, password, data: { name } } });
  if (j.access_token) { setSession(j); await afterAuth(); return true; }
  return false;
}
async function signOut() {
  try { await sb('/auth/v1/logout', { method: 'POST' }); } catch {}
  clearSession();
  toast('Signed out — your data stays on this device', 'ok', 'out');
}

function setSync(state, detail) {
  syncDetail = detail || '';
  const el = $('#sync-dot');
  if (!el) return;
  el.className = 'sync-chip ' + (session ? state : 'off');
  el.dataset.tip = !session ? 'Guest mode — tap for cloud sync'
    : state === 'ok' ? 'Synced'
    : state === 'sync' ? 'Syncing…'
    : (syncDetail || 'Sync problem — tap for details');
}
function classifySync(e) {
  const m = String(e?.message || '').toLowerCase();
  if (e?.network) return { kind: 'offline', title: 'You are offline', body: 'Reading, notes and bookmarks all work offline. Sync resumes automatically when you reconnect.' };
  if (e?.code === '42P01' || e?.code === 'PGRST205' || m.includes('does not exist') || m.includes('schema cache') || m.includes('could not find the table'))
    return { kind: 'setup', title: 'One-time database setup needed', body: 'Your account works, but the two sync tables have not been created yet. Run the SQL below once in Supabase → SQL Editor, then press Retry. Everything keeps working locally in the meantime.' };
  if (e?.code === '42501' || m.includes('row-level security') || m.includes('violates row-level'))
    return { kind: 'rls', title: 'Row-level security blocked the write', body: 'The tables exist but their policies are missing. Run the policy section of the SQL below, then press Retry.' };
  return { kind: 'other', title: 'Sync failed', body: e?.message || 'Unknown error.' };
}
function handleSyncErr(e) {
  const c = classifySync(e);
  setSync('err', c.title);
  if (c.kind === 'setup' || c.kind === 'rls') {
    syncBlocked = true;
    if (!setupToastShown) {
      setupToastShown = true;
      toast('Cloud sync needs a one-time SQL setup — tap the sync icon', 'warn', 'db');
    }
  }
  return c;
}
const unionMin = (a = {}, b = {}) => { const o = { ...a }; for (const k in b) o[k] = Math.min(o[k] ?? Infinity, b[k]); return o; };
function mergeState(local, cloud) {
  if (!cloud || cloud.v !== 1) return local;
  const c = withDefaults(cloud), m = withDefaults(local);
  m.read = unionMin(c.read, m.read);
  m.bookmarks = unionMin(c.bookmarks, m.bookmarks);
  m.ach = unionMin(c.ach, m.ach);
  m.notes = { ...c.notes };
  for (const k in m.notes) if (!m.notes[k]?.t) delete m.notes[k];
  for (const k in local.notes) if (local.notes[k]?.t && (!m.notes[k] || local.notes[k].ts > m.notes[k].ts)) m.notes[k] = local.notes[k];
  m.activity = { ...c.activity };
  for (const d in local.activity) {
    const a = local.activity[d] || {}, b = m.activity[d] || { r: 0, s: 0 };
    m.activity[d] = { r: Math.max(+a.r || 0, +b.r || 0), s: Math.max(+a.s || 0, +b.s || 0) };
  }
  m.last = local.last ?? c.last;
  m.coachSeen = local.coachSeen || c.coachSeen;
  return m;
}
async function push() {
  if (!session) return;
  setSync('sync');
  await sb(`/rest/v1/${T_STATE}?on_conflict=user_id`, {
    method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
    body: { user_id: session.user.id, state: S, updated_at: new Date().toISOString() }
  });
  const a = act();
  await sb(`/rest/v1/${T_ACT}?on_conflict=user_id,day`, {
    method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
    body: { user_id: session.user.id, day: dayKey(), reads: a.r, seconds: a.s }
  });
  lastSyncAt = Date.now(); setSync('ok');
}
async function pull() {
  if (!session) return;
  const rows = await sb(`/rest/v1/${T_STATE}?user_id=eq.${session.user.id}&select=state`);
  if (rows?.[0]?.state) {
    S = mergeState(S, rows[0].state);
    clampSettings(); sanitize(); persistLocal();
    applySettings(); rerenderPreserving(); updateHUD();
  }
}
async function afterAuth() {
  try { setSync('sync'); await pull(); await push(); }
  catch (e) { handleSyncErr(e); }
}
const syncSoon = debounce(() => { if (session && !syncBlocked) push().catch(handleSyncErr); }, 3000);
async function syncNow() {
  if (!session) { openAuth(); return; }
  syncBlocked = false;
  try {
    await afterAuth();
    if (!syncBlocked) { toast('Everything is in sync', 'ok', 'sync'); Sound.play('success'); }
  } catch (e) { const c = handleSyncErr(e); toast(c.title, 'err', 'alert'); Sound.play('error'); }
  syncInfoRefresh();
}
function syncInfo() {
  const el = $('#sync-dot');
  const state = !session ? 'off' : (el?.classList.contains('err') ? 'err' : 'ok');
  const c = state === 'err' ? classifySync({ message: syncDetail, code: syncBlocked ? '42P01' : undefined }) : null;
  let html = `<button class="icon-btn modal-x" data-action="modal-close" aria-label="Close">${ic('x')}</button><h2>${ic('db')}Cloud sync</h2>`;
  if (!session) {
    html += `<div class="status-line off">${ic('user')}Guest mode — everything is saved on this device</div>
      <div class="m-body">Reading, bookmarks, notes and streaks all work right now without an account. Sign in to carry them across devices.</div>
      <div class="m-actions"><button class="btn" data-action="modal-close">Keep reading</button>
      <button class="btn primary" data-action="open-auth">${ic('user')}Sign in</button></div>`;
  } else if (state === 'ok') {
    html += `<div class="status-line ok">${ic('check')}Synced${lastSyncAt ? ' · ' + new Date(lastSyncAt).toLocaleTimeString() : ''}</div>
      <div class="m-body">Signed in as <b>${esc(session.user.email || '')}</b>. Progress, notes and bookmarks live in your own row-level-secured tables.</div>
      <div class="m-actions"><button class="btn" data-action="sync-now">${ic('sync')}Sync now</button>
      <button class="btn danger" data-action="logout">${ic('out')}Sign out</button></div>`;
  } else {
    html += `<div class="status-line err">${ic('alert')}${esc(c.title)}</div>
      <div class="m-body">${esc(c.body)}</div>
      <pre class="sql-pre" id="sql-pre">${esc(SQL_TEXT)}</pre>
      <div class="m-actions">
        <a class="btn" href="${SB_DASH}" target="_blank" rel="noopener">${ic('send')}Open SQL Editor</a>
        <button class="btn" data-action="copy-sql">${ic('copy')}Copy SQL</button>
        <button class="btn primary" data-action="sync-now">${ic('sync')}Retry sync</button>
      </div>`;
  }
  openModal(html);
}
function syncInfoRefresh() { if ($('#modal-root .status-line')) syncInfo(); }
async function copySQL() {
  await copyText(SQL_TEXT);
  Sound.play('pop');
  toast('Setup SQL copied — paste it in Supabase → SQL Editor', 'ok', 'copy');
}

/* ═══════════ TOASTS / MODALS ═══════════ */
function toast(msg, type = 'ok', icon = 'check') {
  const box = $('#toasts');
  if (!box) return;
  while (box.children.length >= 4) box.firstChild.remove();
  const t = document.createElement('div');
  t.className = 'toast ' + (type === 'ok' ? '' : type);
  t.innerHTML = ic(icon) + `<span>${esc(msg)}</span>`;
  t.onclick = () => t.remove();
  box.appendChild(t);
  setTimeout(() => { t.classList.add('bye'); setTimeout(() => t.remove(), 320); }, 4200);
}
let modalResolve = null;
function openModal(html) {
  const root = $('#modal-root');
  if (!root) return;
  root.innerHTML = `<div class="overlay open"><div class="ov-backdrop" data-action="modal-close"></div><div class="modal-card">${html}</div></div>`;
  Sound.play('open');
}
function closeModal() {
  const root = $('#modal-root');
  if (!root || !root.innerHTML) return;
  root.innerHTML = '';
  Sound.play('close');
  if (modalResolve) { const r = modalResolve; modalResolve = null; r(false); }
}
function confirmBox({ title, body, ok = 'Confirm', danger = false }) {
  return new Promise(res => {
    modalResolve = res;
    openModal(`<h2>${ic(danger ? 'alert' : 'info')} ${esc(title)}</h2>
      <div class="m-body">${esc(body)}</div>
      <div class="m-actions"><button class="btn ghost" data-action="modal-close">Cancel</button>
      <button class="btn ${danger ? 'danger' : 'primary'}" data-action="confirm-ok">${esc(ok)}</button></div>`);
  });
}

/* ═══════════ SETTINGS ═══════════ */
function applySettings() {
  const st = S.settings, root = document.documentElement;
  root.dataset.theme = st.theme;
  root.dataset.arfont = st.arFont;
  root.style.setProperty('--ar-scale', st.fontScale);
  root.style.setProperty('--ar-lh', st.lineHeight);
  document.body.classList.toggle('no-motion', !st.motion);
  document.body.classList.toggle('muted', !st.sound);
  $('#btn-sound')?.setAttribute('aria-pressed', String(st.sound));
  $$('.theme-chip').forEach(c => c.classList.toggle('active', c.dataset.v === st.theme));
  Ambient.sync(); FX.refresh(); FX.sync();
}
function syncDrawerInputs() {
  $$('#drawer [data-set]').forEach(el => {
    const v = S.settings[el.dataset.set];
    if (el.type === 'checkbox') el.checked = !!v;
    else el.value = v;
  });
}
function openSettings() {
  syncDrawerInputs(); renderDrawerAccount(); renderAIModels();
  document.body.classList.add('drawer-open');
  Sound.play('open');
}
function closeSettings() {
  if (!document.body.classList.contains('drawer-open')) return;
  document.body.classList.remove('drawer-open');
  Sound.play('close');
}

/* ═══════════ ACCOUNT ═══════════ */
const userName = () => session?.user?.user_metadata?.name || session?.user?.email?.split('@')[0] || 'Seeker';
const initial = () => esc((userName()[0] || 'S').toUpperCase());
function updateAccountUI() {
  const btn = $('#btn-account');
  if (btn) btn.innerHTML = session ? initial() : ic('user');
  renderDrawerAccount();
}
function renderDrawerAccount() {
  const el = $('#drawer-account');
  if (!el) return;
  el.innerHTML = session
    ? `<div class="acct-box"><span class="avatar-btn">${initial()}</span>
       <div class="who"><b>${esc(userName())}</b><span>${esc(session.user.email || '')}</span></div></div>
       <div class="btn-col"><button class="btn" data-action="sync-info">${ic('db')}Sync status</button>
       <button class="btn danger" data-action="logout">${ic('out')}Sign out</button></div>`
    : `<p class="mut" style="font-size:12.5px;margin-bottom:12px;line-height:1.6">Reading as a guest. Everything is saved locally; sign in to sync across devices.</p>
       <button class="btn primary wide" data-action="open-auth">${ic('user')}Sign in / Create account</button>`;
}
function toggleAccountMenu() {
  if (!session) { openAuth(); return; }
  const m = $('#account-menu');
  if (!m) return;
  if (!m.hidden) { m.hidden = true; return; }
  const r = $('#btn-account').getBoundingClientRect();
  m.style.top = (r.bottom + 10) + 'px';
  m.style.right = Math.max(10, innerWidth - r.right) + 'px';
  m.innerHTML = `<div class="p-head"><b>${esc(userName())}</b><span>${esc(session.user.email || '')}</span></div>
    <button class="p-item" data-action="sync-info">${ic('db')}Cloud sync</button>
    <button class="p-item" data-action="open-settings">${ic('set')}Settings</button>
    <button class="p-item" data-action="export">${ic('dl')}Export data</button>
    <button class="p-item danger" data-action="logout">${ic('out')}Sign out</button>`;
  m.hidden = false;
  Sound.play('pop');
}

/* ═══════════ AUTH ═══════════ */
function openAuth() {
  closePalette(true); closeSearch(true); closeControls(true); closeSettings(); closeModal();
  $('#account-menu').hidden = true;
  $('#auth-modal').classList.add('open');
  authTab('in');
  Sound.play('open');
  setTimeout(() => $('#in-email')?.focus(), 90);
}
function closeAuth() {
  $('#auth-modal').classList.remove('open');
  Sound.play('close');
}
function authTab(v) {
  $$('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.v === v));
  $('#form-in').hidden = v !== 'in';
  $('#form-up').hidden = v !== 'up';
  $('#form-forgot').hidden = true;
  $('#auth-verify').hidden = true;
  $('#auth-err').hidden = true;
}
function authError(msg) {
  const e = $('#auth-err');
  e.textContent = msg; e.hidden = false;
  Sound.play('error');
}
function bindAuthForms() {
  const wrap = (form, fn) => form && form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.classList.add('loading');
    $('#auth-err').hidden = true;
    try { await fn(); }
    catch (err) { authError(err.message); }
    finally { btn.classList.remove('loading'); }
  });
  wrap($('#form-in'), async () => {
    await signIn($('#in-email').value.trim(), $('#in-pass').value);
    closeAuth(); Sound.play('success');
    toast(`Welcome back, ${userName()}`, 'gold', 'spark');
  });
  wrap($('#form-up'), async () => {
    const ok = await signUp($('#up-name').value.trim(), $('#up-email').value.trim(), $('#up-pass').value);
    if (ok) { closeAuth(); Sound.play('fanfare'); toast(`Ahlan, ${userName()}!`, 'gold', 'spark'); }
    else {
      $('#form-up').hidden = true;
      $('#auth-verify').hidden = false;
      const em = $('#up-email').value.trim();
      $('#verify-email').textContent = em;
      $('#auth-verify').dataset.email = em;
      Sound.play('success');
    }
  });
  wrap($('#form-forgot'), async () => {
    await sb('/auth/v1/recover', { method: 'POST', auth: false, body: { email: $('#fg-email').value.trim() } });
    toast('Reset link sent — check your inbox', 'ok', 'mail');
    Sound.play('success');
    authTab('in');
  });
}

/* ═══════════ DATA ═══════════ */
function normAr(str) {
  let n = '', map = [];
  for (let i = 0; i < str.length; i++) {
    let c = str[i];
    if (/[\u064B-\u065F\u0670\u0640\u06D6-\u06ED\u200c]/.test(c)) continue;
    if ('أإآٱ'.includes(c)) c = 'ا';
    else if (c === 'ة' || c === 'ۀ') c = 'ه';
    else if (c === 'ى' || c === 'ی') c = 'ي';
    else if (c === 'ک') c = 'ك';
    else if (c === 'ؤ') c = 'و';
    else if (c === 'ئ') c = 'ي';
    n += c; map.push(i);
  }
  return { n, map };
}
async function loadData() {
  let lastErr;
  for (const p of ['data/estighfar.json', 'estighfar.json']) {
    try {
      const r = await fetch(p, { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (!Array.isArray(j.sections) || !j.sections.length) throw new Error('Unexpected JSON shape');
      DATA = j;
      break;
    } catch (e) { lastErr = e; }
  }
  if (!DATA) throw lastErr || new Error('data/estighfar.json not found');
  try {
    const wr = await fetch('data/words.json', { cache: 'no-cache' });
    if (wr.ok) WORDS = await wr.json();
  } catch { WORDS = {}; }
  SEGS = []; IDX = {}; SEC_OF = {};
  DATA.sections.forEach(sec => sec.segments.forEach(sg => {
    if (!sg || sg.id == null || !sg.ar) return;
    sg.en = sg.en || ''; sg.fa = sg.fa || '';
    SEGS.push(sg);
    IDX[sg.id] = sg;
    SEC_OF[sg.id] = sec;
    normCache[sg.id] = { ar: normAr(sg.ar), fa: normAr(sg.fa), en: { n: sg.en.toLowerCase(), map: null } };
  }));
  if (!SEGS.length) throw new Error('No passages found in the JSON');
}

/* ═══════════ ROUTER ═══════════ */
const TITLES = { read: 'The Grand Istighfār', home: 'Overview', library: 'Library', stats: 'Your Journey' };
const NAV_ORDER = ['read', 'home', 'library', 'stats'];
function navigate(view, param) {
  if (!TITLES[view]) view = 'read';
  Sound.play('tap');
  const h = '#/' + view + (param != null ? '/' + param : '');
  if (location.hash === h) render(); else location.hash = h;
}
function parseHash() {
  const p = location.hash.replace(/^#\/?/, '').split('/');
  return { view: TITLES[p[0]] ? p[0] : 'read', param: p[1] || null };
}
function render(opts = {}) {
  if (!DATA) return;
  const keepScroll = !!opts.keepScroll, y = scrollY;
  stopAutoScroll(); TTS.stop(); closeControls(true);
  const { view, param } = parseHash();
  VIEW = view;
  $('#view-title').textContent = TITLES[view];
  document.title = 'Nūr · ' + TITLES[view];
  $$('.rail-btn, #tabbar button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  if (view !== 'read') document.body.classList.remove('focus');
  if (io) { io.disconnect(); io = null; }
  $('#view').innerHTML = ({ home: vHome, read: vRead, library: vLibrary, stats: vStats })[view](param);
  if (view === 'read') initReader(param, keepScroll);
  updateHUD();
  if (keepScroll) scrollTo(0, y);
  else if (!param) scrollTo(0, 0);
}
function rerenderPreserving() {
  const open = $$('.seg.open').map(el => +el.dataset.id);
  const controlsOpen = !!$('#controls')?.classList.contains('open');
  const y = scrollY;
  render({ keepScroll: true });
  if (controlsOpen) openControls();
  open.forEach(id => {
    const el = $('#seg-' + id);
    if (el) { el.classList.add('open'); el.setAttribute('aria-expanded', 'true'); }
  });
  scrollTo(0, y);
}
function updateHUD() {
  const s = $('#hud-streak-n'); if (s) s.textContent = streak();
  const p = $('#progress-line');
  if (p) p.style.width = (SEGS.length ? readCount() / SEGS.length * 100 : 0) + '%';
}

/* ═══════════ OVERVIEW ═══════════ */
function ringSVG(pct, size = 118, r = 50, w = 9) {
  const C = 2 * Math.PI * r;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle class="bg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${w}"/>
    <circle class="fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${w}"
      stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - clamp(pct || 0, 0, 1))}"/></svg>`;
}
function vHome() {
  const h = new Date().getHours();
  const greet = h < 5 ? 'Blessed night' : h < 12 ? 'Blessed morning' : h < 17 ? 'Blessed afternoon' : h < 21 ? 'Blessed evening' : 'Blessed night';
  let pDate = '';
  try { pDate = ' · ' + new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'full' }).format(new Date()); } catch {}
  const gDate = new Intl.DateTimeFormat('en', { dateStyle: 'full' }).format(new Date());
  const total = SEGS.length, rc = readCount(), a = act(), goal = S.settings.goal;
  const last = (S.last != null && IDX[S.last]) ? IDX[S.last] : null;
  const daily = SEGS[Math.floor(Date.now() / 864e5) % total];
  const cont = last || SEGS[0];
  const pctDay = Math.min(1, a.r / goal);
  return `<div class="page">
  <section class="hero">
    <div class="greet">${greet}, <b>${esc(userName())}</b></div>
    <div class="date-line">${esc(gDate)}${esc(pDate)}</div>
    <div class="hero-orn" style="margin-top:18px">۞ ۞ ۞</div>
    <div class="hero-ar">اللَّهُمَّ إِنِّي أَسْتَغْفِرُكَ</div>
    <p class="hero-sub">${esc(DATA.meta.attribution.en)} — ${total} passages. Tap any verse to unfold its meaning.</p>
    <p class="hero-fa">${esc(DATA.meta.attribution.fa)}</p>
    <div class="hero-cta">
      <button class="btn primary" data-action="${last ? 'continue' : 'begin'}">${ic('book')}${last ? 'Continue reading' : 'Begin the duʿāʾ'}</button>
      <button class="btn" data-action="nav" data-view="stats">${ic('flame')}Your journey</button>
    </div>
    <div class="hero-chips">
      <span class="chip active">${ic('book')}${rc}/${total} passages</span>
      <span class="chip">${ic('flame')}${streak()}-day streak</span>
      <span class="chip">${ic('target')}${a.r}/${goal} today</span>
    </div>
  </section>
  <div class="grid g3">
    <div class="card">
      <div class="home-card-h">${ic('clock')}${last ? 'Where you left off' : 'Start here'}</div>
      <div class="lib-meta">${esc(SEC_OF[cont.id].en)} · № ${cont.id}</div>
      <div class="snip-ar">${esc(cont.ar)}</div>
      <div class="snip-en">${esc(cont.en)}</div>
      <button class="btn wide" style="margin-top:16px" data-action="jump" data-id="${cont.id}">${ic('cr')}Open passage</button>
    </div>
    <div class="card">
      <div class="home-card-h">${ic('target')}Today’s goal</div>
      <div class="ring-wrap">
        <div class="ring-box">${ringSVG(pctDay)}<div class="ring-txt"><b>${a.r}</b><small>of ${goal}</small></div></div>
        <div>
          <div class="stat-big">${Math.round(pctDay * 100)}%</div>
          <div class="stat-lbl">passages today</div>
          <p class="mut" style="font-size:12.5px;margin-top:10px;line-height:1.6">${a.r >= goal ? 'Goal fulfilled — may it be accepted.' : `${goal - a.r} more to fulfil today’s intention.`}</p>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="home-card-h">${ic('spark')}Passage of the day</div>
      <div class="lib-meta">${esc(SEC_OF[daily.id].en)} · № ${daily.id}</div>
      <div class="snip-ar">${esc(daily.ar)}</div>
      <div class="snip-en">${esc(daily.en)}</div>
      <button class="btn wide" style="margin-top:16px" data-action="daily">${ic('cr')}Reflect on it</button>
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

/* ═══════════ READER ═══════════ */
function transHTML(sg) {
  const m = S.settings.trans;
  let h = '';
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
  const th = transHTML(sg);
  const hint = th ? `<div class="seg-hint">${ic('tap')}<span class="h-shut">Tap for meaning</span><span class="h-opened">Hide meaning</span></div>` : '';
  return `<article class="seg ${cls}" id="seg-${sg.id}" data-id="${sg.id}" tabindex="0" aria-expanded="false" aria-label="Passage ${sg.id}. Activate to reveal its meaning.">
    <i class="ribbon" aria-hidden="true"></i>
    <div class="seg-head"><span class="seg-num">${sg.id}</span>
      <div class="seg-tools">
        <button class="icon-btn ${S.read[sg.id] ? 'on green' : ''}" data-action="seg-read" data-id="${sg.id}" data-tip="Mark read (R)" aria-label="Mark read">${ic('check')}</button>
        <button class="icon-btn ${S.bookmarks[sg.id] ? 'on' : ''}" data-action="seg-bm" data-id="${sg.id}" data-tip="Bookmark (B)" aria-label="Bookmark">${ic('bm')}</button>
        <button class="icon-btn ${S.notes[sg.id] ? 'on' : ''}" data-action="seg-note" data-id="${sg.id}" data-tip="Note" aria-label="Note">${ic('note')}</button>
        <button class="icon-btn" data-action="seg-copy" data-id="${sg.id}" data-tip="Copy" aria-label="Copy">${ic('copy')}</button>
        <button class="icon-btn" data-action="seg-play" data-id="${sg.id}" data-tip="Listen" aria-label="Listen">${ic('play', 'ic-play')}${ic('stop', 'ic-stop')}</button>
      </div></div>
    <p class="ar" dir="rtl" lang="ar">${arHTML(sg)}</p>
    <div class="trans-wrap"><div class="trans-in">${th}</div></div>
    ${hint}${noteHTML(sg.id)}
  </article>`;
}
function vRead() {
  const rc = readCount(), total = SEGS.length;
  const opts = DATA.sections.map(s => `<option value="${s.id}">${esc(s.en)}</option>`).join('');
  const chapters = DATA.sections.map((sec, i) => {
    const done = sec.segments.filter(x => S.read[x.id]).length;
    return `<div class="chapter" id="${sec.id}">
      ${flourish()}
      <h2>${i + 1}. ${esc(sec.en)}</h2>
      <div class="fa-t">${esc(sec.fa)}</div>
      <div class="ch-meta"><span class="ch-done">${done}/${sec.segments.length} read</span>
        <span class="seal" ${done < sec.segments.length ? 'hidden' : ''}>${ic('check')}COMPLETE</span>
        <button class="chip mini" data-action="sec-read" data-sec="${sec.id}">${ic('check')}Mark chapter</button></div>
    </div>` + sec.segments.map(segHTML).join('');
  }).join('');
  const coach = S.coachSeen ? '' : `<div class="coach" id="coach">${ic('tap')}
    <span>Tap any Arabic word for its Persian gloss. Tap the verse itself to unfold the full meaning.</span>
    <button class="icon-btn" data-action="coach-dismiss" aria-label="Dismiss">${ic('x')}</button></div>`;
  return `<div class="page">
    <div class="bism">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
    ${coach}
    <div class="rbar">
      <select id="reader-sec" aria-label="Chapter">${opts}</select>
      <span class="rcount" id="reader-count">${rc}/${total}</span>
      <div class="rbar-track only-wide"><i id="reader-bar" style="width:${rc / total * 100}%"></i></div>
      <button class="sq only-wide" data-action="font-down" data-tip="Smaller Arabic (−)" aria-label="Smaller Arabic">A−</button>
      <button class="sq only-wide" data-action="font-up" data-tip="Larger Arabic (+)" aria-label="Larger Arabic">A+</button>
      <button class="lang-chip only-wide" data-action="lang-cycle" data-tip="Meaning language">${ic('lang')}<span id="lang-short">${TRANS_SHORT[S.settings.trans]}</span></button>
      <button class="sq only-wide" data-action="reveal-toggle" data-tip="Reveal / hide all meanings" aria-label="Reveal all">${ic('eye')}</button>
      <button class="sq only-wide" id="as-btn" data-action="autoscroll" data-tip="Auto-scroll (A)" aria-label="Auto-scroll">${ic('scroll')}</button>
      <button class="sq only-wide" data-action="focus" data-tip="Focus mode (F)" aria-label="Focus mode">${ic('focus')}</button>
      <button class="ctl-btn" data-action="open-controls">${ic('set')}<span>Controls</span></button>
      <i class="rbar-line" id="reader-line" style="width:${rc / total * 100}%"></i>
    </div>
    ${chapters}
    <div class="reader-end">
      ${flourish()}
      <p>${rc === total ? 'You have read the entire duʿāʾ. May every word be a light for you.' : '“How often You court my love, though You have no need of me…”'}</p>
      <div class="m-actions" style="justify-content:center">
        <button class="btn" data-action="nav" data-view="library">${ic('bm')}Your library</button>
        <button class="btn primary" data-action="nav" data-view="stats">${ic('flame')}See your journey</button>
      </div>
    </div></div>`;
}
function initReader(param, keepScroll) {
  io = new IntersectionObserver(es => {
    let best = null;
    es.forEach(e => { if (e.isIntersecting && (!best || e.intersectionRatio > best.intersectionRatio)) best = e; });
    if (!best) return;
    const id = +best.target.dataset.id;
    if (S.last !== id) { S.last = id; persistLocal(); syncSoon(); }
    const sel = $('#reader-sec');
    if (sel && SEC_OF[id] && sel.value !== SEC_OF[id].id) sel.value = SEC_OF[id].id;
  }, { threshold: [.12, .4, .65] });
  $$('.seg').forEach(el => io.observe(el));
  const pid = param != null ? +param : null;
  const target = (pid != null && IDX[pid]) ? IDX[pid] : ((S.last != null && IDX[S.last]) ? IDX[S.last] : null);
  const sel = $('#reader-sec');
  if (sel && target) sel.value = SEC_OF[target.id].id;
  if (pid != null && IDX[pid] && !keepScroll) setTimeout(() => {
    const el = $('#seg-' + pid);
    if (!el) return;
    el.scrollIntoView({ block: 'start', behavior: 'instant' });
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1700);
  }, 40);
}
function toggleSegTrans(seg) {
  if (!seg) return;
  if (!seg.querySelector('.trans-in')?.innerHTML.trim()) { toast('This passage has no translation in the JSON', 'warn', 'alert'); return; }
  const open = seg.classList.toggle('open');
  seg.setAttribute('aria-expanded', String(open));
  Sound.play(open ? 'reveal' : 'fold');
  buzz(6);
}
function setAllMeanings(open) {
  const segs = $$('.seg');
  if (!segs.length) return;
  segs.forEach(s => { s.classList.toggle('open', open); s.setAttribute('aria-expanded', String(open)); });
  Sound.play(open ? 'reveal' : 'fold');
  toast(open ? 'All meanings revealed' : 'All meanings folded', 'ok', open ? 'eye' : 'eyeoff');
  syncControlsUI();
}
function toggleAllMeanings() { setAllMeanings($$('.seg').some(s => !s.classList.contains('open'))); }
function setLang(v) {
  if (!TRANSS.includes(v)) return;
  S.settings.trans = v;
  persist(); rerenderPreserving(); syncControlsUI(); syncDrawerInputs();
  const el = $('#lang-short'); if (el) el.textContent = TRANS_SHORT[v];
  Sound.play('pop');
  toast('Meaning language: ' + TRANS_LABEL[v], 'ok', 'lang');
}
function refreshChapter(secId) {
  const sec = DATA.sections.find(s => s.id === secId);
  const el = $('#' + secId);
  if (!sec || !el) return;
  const done = sec.segments.filter(x => S.read[x.id]).length;
  const d = el.querySelector('.ch-done'); if (d) d.textContent = `${done}/${sec.segments.length} read`;
  const seal = el.querySelector('.seal'); if (seal) seal.hidden = done < sec.segments.length;
}
function refreshSeg(id) {
  const el = $('#seg-' + id);
  if (el) {
    el.classList.toggle('read', !!S.read[id]);
    el.classList.toggle('bm', !!S.bookmarks[id]);
    const bRead = el.querySelector('[data-action=seg-read]');
    if (bRead) { bRead.classList.toggle('on', !!S.read[id]); bRead.classList.toggle('green', !!S.read[id]); }
    el.querySelector('[data-action=seg-bm]')?.classList.toggle('on', !!S.bookmarks[id]);
    el.querySelector('[data-action=seg-note]')?.classList.toggle('on', !!S.notes[id]);
    el.querySelector('.seg-note')?.remove();
    el.insertAdjacentHTML('beforeend', noteHTML(id));
  }
  const rc = readCount(), pct = rc / SEGS.length * 100;
  const c = $('#reader-count'); if (c) c.textContent = `${rc}/${SEGS.length}`;
  const b = $('#reader-bar'); if (b) b.style.width = pct + '%';
  const l = $('#reader-line'); if (l) l.style.width = pct + '%';
  if (SEC_OF[id]) refreshChapter(SEC_OF[id].id);
  updateHUD();
}
function setRead(id, on) {
  id = +id;
  if (!IDX[id]) return;
  if (on && !S.read[id]) { S.read[id] = Date.now(); act().r++; }
  else if (!on && S.read[id]) { delete S.read[id]; act().r = Math.max(0, act().r - 1); }
  else return;
  persist(); refreshSeg(id);
  Sound.play(on ? 'success' : 'tap');
  if (on) {
    checkAch();
    if (readCount() === SEGS.length) { celebrate(); rerenderPreserving(); }
  }
}
function toggleBookmark(id) {
  id = +id;
  if (!IDX[id]) return;
  if (S.bookmarks[id]) { delete S.bookmarks[id]; Sound.play('tap'); }
  else { S.bookmarks[id] = Date.now(); Sound.play('bookmark'); buzz(12); toast('Passage bookmarked', 'ok', 'bm'); }
  persist(); refreshSeg(id); checkAch();
}
function openNote(id) {
  id = +id;
  if (!IDX[id]) return;
  const n = S.notes[id];
  openModal(`<button class="icon-btn modal-x" data-action="modal-close" aria-label="Close">${ic('x')}</button>
    <h2>${ic('note')}Note on passage ${id}</h2>
    <p class="ar" dir="rtl" style="font-family:var(--ar);text-align:right;font-size:19px;line-height:1.9;margin-bottom:14px;color:var(--ink)">${esc(IDX[id].ar.slice(0, 90))}…</p>
    <textarea id="note-ta" placeholder="Your reflection…">${esc(n?.t || '')}</textarea>
    <div class="m-actions">${n ? `<button class="btn danger" data-action="note-del" data-id="${id}">${ic('trash')}Delete</button>` : ''}
    <button class="btn primary" data-action="note-save" data-id="${id}">${ic('check')}Save note</button></div>`);
  setTimeout(() => $('#note-ta')?.focus(), 70);
}
function saveNote(id) {
  id = +id;
  const ta = $('#note-ta');
  if (!ta) return;
  const t = ta.value.trim();
  if (t) S.notes[id] = { t, ts: Date.now() }; else delete S.notes[id];
  persist(); refreshSeg(id); closeModal();
  Sound.play('success');
  toast(t ? 'Note saved' : 'Note removed', 'ok', 'note');
  checkAch();
  if (VIEW === 'library') rerenderPreserving();
}
async function copySeg(id) {
  const s = IDX[+id];
  if (!s) return;
  const txt = `${s.ar}\n\n${s.en}\n\n${s.fa}\n\n— ${DATA.meta.title.en}, № ${s.id}`;
  const ok = await copyText(txt);
  Sound.play('pop');
  toast(ok ? 'Passage copied' : 'Copy is blocked by this browser', ok ? 'ok' : 'warn', 'copy');
}
function markSection(secId) {
  const sec = DATA.sections.find(s => s.id === secId);
  if (!sec) return;
  let added = 0;
  sec.segments.forEach(sg => {
    if (!S.read[sg.id]) { S.read[sg.id] = Date.now(); added++; refreshSeg(sg.id); }
  });
  if (added) {
    act().r += added;
    persist(); Sound.play('success');
    toast(`Chapter marked — ${added} passage${added > 1 ? 's' : ''}`, 'ok', 'check');
    checkAch();
    if (readCount() === SEGS.length) { celebrate(); rerenderPreserving(); }
  } else toast('Chapter already complete', 'ok', 'check');
  syncControlsUI();
}

/* ═══════════ READING CONTROLS ═══════════ */
function currentChapterId() {
  const sel = $('#reader-sec');
  if (sel && sel.value) return sel.value;
  return (S.last != null && SEC_OF[S.last]) ? SEC_OF[S.last].id : DATA.sections[0].id;
}
function controlsHTML() {
  const st = S.settings, chId = currentChapterId();
  const sec = DATA.sections.find(s => s.id === chId) || DATA.sections[0];
  const done = sec.segments.filter(x => S.read[x.id]).length;
  return `<div class="sheet-grab"></div>
  <div class="sheet-head"><h2>${ic('set')}Reading controls</h2>
    <button class="icon-btn" data-action="close-controls" aria-label="Close">${ic('x')}</button></div>
  <p class="sheet-note">${ic('tap')}Tap a word for its Persian gloss, the verse for its meaning — these controls tune how it reads.</p>

  <div class="ctl-row">
    <div class="ctl-lbl"><span>Meaning language</span></div>
    <div class="seg-ctl" id="ctl-lang">
      ${TRANSS.map(v => `<button data-action="lang" data-v="${v}" class="${st.trans === v ? 'active' : ''}">${v === 'en' ? 'English' : v === 'fa' ? 'فارسی' : 'Both'}</button>`).join('')}
    </div>
  </div>

  <div class="ctl-row">
    <div class="ctl-lbl"><span>Arabic size</span><b id="ctl-size-out">${Math.round(st.fontScale * 100)}%</b></div>
    <div class="ctl-inline">
      <button class="sq" data-action="font-down" aria-label="Smaller">A−</button>
      <input type="range" data-set="fontScale" min="0.8" max="1.6" step="0.05" value="${st.fontScale}" aria-label="Arabic size">
      <button class="sq" data-action="font-up" aria-label="Larger">A+</button>
    </div>
  </div>

  <div class="ctl-row">
    <div class="ctl-lbl"><span>Line spacing</span><b id="ctl-lh-out">${(+st.lineHeight).toFixed(1)}</b></div>
    <div class="ctl-inline"><input type="range" data-set="lineHeight" min="1.7" max="2.7" step="0.1" value="${st.lineHeight}" aria-label="Line spacing"></div>
  </div>

  <div class="ctl-row">
    <div class="ctl-lbl"><span>Arabic typeface</span></div>
    <select data-set="arFont" aria-label="Arabic typeface">
      <option value="amiri" ${st.arFont === 'amiri' ? 'selected' : ''}>Amiri — classical naskh</option>
      <option value="scheherazade" ${st.arFont === 'scheherazade' ? 'selected' : ''}>Scheherazade New — wide, airy</option>
      <option value="naskh" ${st.arFont === 'naskh' ? 'selected' : ''}>Noto Naskh Arabic — compact</option>
    </select>
  </div>

  <div class="ctl-row">
    <div class="ctl-lbl"><span>Meanings on screen</span></div>
    <div class="ctl-two">
      <button class="btn sm" data-action="reveal-all">${ic('eye')}Reveal all</button>
      <button class="btn sm" data-action="hide-all">${ic('eyeoff')}Fold all</button>
    </div>
  </div>

  <div class="ctl-row">
    <div class="ctl-lbl"><span>Auto-scroll</span>
      <label class="switch"><input type="checkbox" data-ctl="auto" ${AS.on ? 'checked' : ''} aria-label="Auto-scroll"><i></i></label></div>
    <div class="ctl-inline"><span class="mut" style="font-size:11.5px">Slow</span>
      <input type="range" data-ctl="speed" min="1" max="10" step="1" value="${AS.speed}" aria-label="Auto-scroll speed">
      <span class="mut" style="font-size:11.5px">Fast</span></div>
  </div>

  <div class="ctl-row">
    <div class="ctl-two">
      <button class="btn sm" data-action="focus">${ic('focus')}Focus mode</button>
      <button class="btn sm" data-action="mark-chapter">${ic('check')}Mark chapter</button>
    </div>
    <p class="mut" style="font-size:11.5px;margin-top:10px">${esc(sec.en)} — ${done}/${sec.segments.length} read</p>
  </div>`;
}
function openControls() {
  if (VIEW !== 'read') { navigate('read'); setTimeout(openControls, 240); return; }
  closeSettings();
  const sheet = $('#controls-sheet');
  if (!sheet) return;
  sheet.innerHTML = controlsHTML();
  $('#controls').classList.add('open');
  Sound.play('open');
}
function closeControls(silent) {
  const o = $('#controls');
  if (!o || !o.classList.contains('open')) return;
  o.classList.remove('open');
  if (!silent) Sound.play('close');
}
function syncControlsUI() {
  const o = $('#controls');
  if (!o || !o.classList.contains('open')) return;
  $$('#ctl-lang button').forEach(b => b.classList.toggle('active', b.dataset.v === S.settings.trans));
  const so = $('#ctl-size-out'); if (so) so.textContent = Math.round(S.settings.fontScale * 100) + '%';
  const lo = $('#ctl-lh-out'); if (lo) lo.textContent = (+S.settings.lineHeight).toFixed(1);
  const sp = $('#controls [data-ctl="speed"]'); if (sp) sp.value = AS.speed;
  const a = $('#controls [data-ctl="auto"]'); if (a) a.checked = AS.on;
  const fs = $('#controls [data-set="fontScale"]'); if (fs) fs.value = S.settings.fontScale;
  const lh = $('#controls [data-set="lineHeight"]'); if (lh) lh.value = S.settings.lineHeight;
  const af = $('#controls [data-set="arFont"]'); if (af) af.value = S.settings.arFont;
}

/* ═══════════ TEXT TO SPEECH ═══════════ */
const TTS = {
  id: null, warned: false, timer: null,
  speak(id) {
    id = +id;
    if (!('speechSynthesis' in window)) { toast('Speech is not supported in this browser', 'warn', 'alert'); return; }
    if (!IDX[id]) return;
    this.stop();
    const u = new SpeechSynthesisUtterance(IDX[id].ar);
    u.lang = 'ar-SA';
    u.rate = S.settings.ttsRate;
    const v = speechSynthesis.getVoices().find(v => /^ar/i.test(v.lang));
    if (v) u.voice = v;
    else if (!this.warned) { this.warned = true; toast('No Arabic voice installed — using the default voice', 'warn', 'info'); }
    u.onend = u.onerror = () => this.clear();
    this.id = id;
    $('#seg-' + id)?.classList.add('playing');
    speechSynthesis.speak(u);
    this.timer = setInterval(() => { if (speechSynthesis.speaking) speechSynthesis.resume(); }, 9000);
  },
  clear() {
    if (this.id != null) $('#seg-' + this.id)?.classList.remove('playing');
    this.id = null;
    clearInterval(this.timer); this.timer = null;
  },
  stop() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    this.clear();
  }
};

/* ═══════════ AUTO-SCROLL ═══════════ */
const AS = { on: false, raf: 0, speed: 3 };
function asTick() {
  if (!AS.on) return;
  scrollBy(0, AS.speed * .55);
  AS.raf = requestAnimationFrame(asTick);
}
function toggleAutoScroll() {
  AS.on = !AS.on;
  $('#as-btn')?.classList.toggle('on', AS.on);
  Sound.play(AS.on ? 'on' : 'off');
  if (AS.on) asTick(); else cancelAnimationFrame(AS.raf);
  syncControlsUI();
}
function stopAutoScroll() {
  if (!AS.on) { cancelAnimationFrame(AS.raf); return; }
  AS.on = false;
  cancelAnimationFrame(AS.raf);
  $('#as-btn')?.classList.remove('on');
}
addEventListener('wheel', () => stopAutoScroll(), { passive: true });
addEventListener('touchstart', () => stopAutoScroll(), { passive: true });

/* ═══════════ LIBRARY ═══════════ */
function vLibrary() {
  const bmIds = Object.keys(S.bookmarks).map(Number).filter(id => IDX[id]).sort((a, b) => a - b);
  const noteIds = Object.keys(S.notes).map(Number).filter(id => IDX[id]).sort((a, b) => a - b);
  const list = libTab === 'bm' ? bmIds : noteIds;
  const items = list.map(id => {
    const s = IDX[id];
    return `<div class="lib-item">
      <span class="seg-num">${id}</span>
      <div class="body" data-action="jump" data-id="${id}">
        <div class="lib-meta">${esc(SEC_OF[id].en)}</div>
        <div class="snip-ar">${esc(s.ar)}</div>
        <div class="snip-en">${esc(s.en)}</div>
        ${libTab === 'notes' ? `<div class="lib-note">${esc(S.notes[id].t)}</div>` : ''}
      </div>
      <div class="btn-col" style="flex:none">
        ${libTab === 'notes' ? `<button class="icon-btn" data-action="note-edit" data-id="${id}" data-tip="Edit">${ic('note')}</button>` : ''}
        <button class="icon-btn" data-action="${libTab === 'bm' ? 'bm-remove' : 'note-del-lib'}" data-id="${id}" data-tip="Remove">${ic('trash')}</button>
      </div></div>`;
  }).join('');
  const empty = `<div class="empty">${ic(libTab === 'bm' ? 'bm' : 'feather')}
    <h3>${libTab === 'bm' ? 'No bookmarks yet' : 'No notes yet'}</h3>
    <p>${libTab === 'bm' ? 'Tap the ribbon on any passage to keep it here.' : 'Tap the pen on any passage to write a reflection.'}</p>
    <button class="btn primary" data-action="nav" data-view="read">${ic('book')}Go to the reader</button></div>`;
  return `<div class="page">
    <div class="lib-tabs">
      <button class="chip ${libTab === 'bm' ? 'active' : ''}" data-action="lib-tab" data-v="bm">${ic('bm')}Bookmarks · ${bmIds.length}</button>
      <button class="chip ${libTab === 'notes' ? 'active' : ''}" data-action="lib-tab" data-v="notes">${ic('note')}Notes · ${noteIds.length}</button>
    </div>${list.length ? items : empty}</div>`;
}

/* ═══════════ JOURNEY ═══════════ */
const ACH = [
  { k: 'first', ic: 'spark', t: 'First Light', d: 'Mark your first passage as read', f: () => readCount() >= 1 },
  { k: 'ten', ic: 'book', t: 'Devoted Reader', d: 'Read 10 passages', f: () => readCount() >= 10 },
  { k: 'all', ic: 'award', t: 'The Full Surrender', d: 'Read every passage', f: () => SEGS.length > 0 && readCount() >= SEGS.length },
  { k: 'bm5', ic: 'bm', t: 'Keeper of Verses', d: 'Bookmark 5 passages', f: () => Object.keys(S.bookmarks).length >= 5 },
  { k: 'note', ic: 'feather', t: 'The Scribe', d: 'Write your first reflection', f: () => Object.keys(S.notes).length >= 1 },
  { k: 'ch5', ic: 'list', t: 'Five Chapters', d: 'Complete 5 chapters', f: () => chaptersDone() >= 5 },
  { k: 's3', ic: 'flame', t: 'Three Dawns', d: 'A 3-day practice streak', f: () => streak() >= 3 },
  { k: 's7', ic: 'sun', t: 'A Week of Light', d: 'A 7-day practice streak', f: () => streak() >= 7 },
  { k: 's30', ic: 'cal', t: 'A Month of Constancy', d: 'A 30-day practice streak', f: () => streak() >= 30 }
];
function checkAch() {
  ACH.forEach(a => {
    if (!S.ach[a.k] && a.f()) {
      S.ach[a.k] = Date.now();
      persistLocal();
      Sound.play('fanfare'); confetti(70);
      toast(`Achievement — ${a.t}`, 'gold', 'award');
    }
  });
}
function celebrate() { Sound.play('fanfare'); confetti(220); toast('The entire duʿāʾ is read. Taqabbal Allāh!', 'gold', 'spark'); }
function heatHTML() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - start.getDay() - 77);
  let cells = '';
  for (let w = 0; w < 12; w++) for (let d = 0; d < 7; d++) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + w * 7 + d);
    const k = dayKey(dt), a = S.activity[k];
    const score = a ? (a.r || 0) + Math.floor((a.s || 0) / 90) : 0;
    const lvl = score === 0 ? 0 : score < 2 ? 1 : score < 5 ? 2 : score < 12 ? 3 : 4;
    const tip = a ? `${k} · ${a.r || 0} read · ${Math.round((a.s || 0) / 60)} min` : `${k} · rest`;
    cells += `<i class="${dt > today ? 'future' : lvl ? 'l' + lvl : ''}" title="${tip}"></i>`;
  }
  return `<div class="heat">${cells}</div>
    <div class="heat-legend">less <i style="background:var(--surf2)"></i><i style="background:color-mix(in srgb,var(--acc2) 30%,var(--surf2))"></i><i style="background:color-mix(in srgb,var(--acc2) 55%,var(--surf2))"></i><i style="background:color-mix(in srgb,var(--acc2) 78%,var(--surf2))"></i><i style="background:var(--acc2)"></i> more</div>`;
}
function vStats() {
  const rc = readCount(), mins = minutesTotal(), ch = chaptersDone();
  const a = act(), goal = S.settings.goal;
  const won = Object.keys(S.ach).length;
  return `<div class="page">
  <div class="grid g4">
    <div class="card"><div class="stat-ic">${ic('flame')}</div><div class="stat-big">${streak()}</div><div class="stat-lbl">day streak</div></div>
    <div class="card"><div class="stat-ic green">${ic('book')}</div><div class="stat-big">${rc}<span class="mut" style="font-size:17px">/${SEGS.length}</span></div><div class="stat-lbl">passages read</div></div>
    <div class="card"><div class="stat-ic green">${ic('list')}</div><div class="stat-big">${ch}<span class="mut" style="font-size:17px">/${DATA.sections.length}</span></div><div class="stat-lbl">chapters complete</div></div>
    <div class="card"><div class="stat-ic">${ic('clock')}</div><div class="stat-big">${fmt(mins)}</div><div class="stat-lbl">minutes with the text</div></div>
  </div>
  <div class="grid g2" style="margin-top:18px">
    <div class="card">
      <div class="home-card-h">${ic('target')}Today’s intention</div>
      <div class="ring-wrap">
        <div class="ring-box">${ringSVG(a.r / goal)}<div class="ring-txt"><b>${a.r}</b><small>of ${goal}</small></div></div>
        <div><p class="mut" style="font-size:13px;line-height:1.7">${a.r >= goal ? 'Fulfilled. Extra passages are extra light.' : `Read ${goal - a.r} more passage${goal - a.r > 1 ? 's' : ''} today.`}<br>Today: <b style="color:var(--ink)">${Math.round((a.s || 0) / 60)}</b> min reading.</p>
        <button class="btn" style="margin-top:12px" data-action="nav" data-view="read">${ic('book')}Continue</button></div>
      </div>
    </div>
    <div class="card"><div class="home-card-h">${ic('cal')}Last 12 weeks</div>${heatHTML()}</div>
  </div>
  <div class="sec-title">Achievements · ${won}/${ACH.length}</div>
  <div class="ach-grid">${ACH.map(x => {
    const got = S.ach[x.k];
    return `<div class="ach ${got ? 'won' : 'locked'}">${ic(x.ic)}<div><h4>${esc(x.t)}</h4><p>${esc(x.d)}</p>${got ? `<small>Unlocked ${new Date(got).toLocaleDateString()}</small>` : ''}</div></div>`;
  }).join('')}</div>
  <div class="sec-title">Data</div>
  <div style="display:flex;gap:10px;flex-wrap:wrap">
    <button class="btn" data-action="export">${ic('dl')}Export JSON</button>
    <button class="btn" data-action="import">${ic('ul')}Import JSON</button>
    <button class="btn" data-action="sync-info">${ic('db')}Cloud sync</button>
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
  if (!box) return;
  q = q.trim();
  if (q.length < 2) { box.innerHTML = `<div class="ov-empty">Type at least two letters — diacritics and ZWNJ are ignored.</div>`; return; }
  const isAr = /[\u0600-\u06FF]/.test(q);
  const qn = isAr ? normAr(q).n : q.toLowerCase();
  if (!qn) { box.innerHTML = `<div class="ov-empty">Keep typing…</div>`; return; }
  const out = [];
  for (const sg of SEGS) {
    const c = normCache[sg.id];
    let field = null, cache = null;
    if (isAr) {
      if (c.ar.n.includes(qn)) { field = 'ar'; cache = c.ar; }
      else if (c.fa.n.includes(qn)) { field = 'fa'; cache = c.fa; }
    } else if (c.en.n.includes(qn)) { field = 'en'; cache = c.en; }
    if (field) out.push({ sg, field, cache });
    if (out.length >= 30) break;
  }
  box.innerHTML = out.length
    ? out.map((r, i) => `<button class="ov-item ${i === 0 ? 'kactive' : ''}" data-action="jump" data-id="${r.sg.id}">
      <span class="seg-num">${r.sg.id}</span>
      <div class="t"><b>${esc(SEC_OF[r.sg.id].en)}</b>
      <span dir="${r.field === 'en' ? 'ltr' : 'rtl'}" class="${r.field === 'ar' ? 'ar-snip' : ''}">${highlight(r.sg[r.field], r.cache, qn)}</span></div>${ic('cr')}</button>`).join('')
    : `<div class="ov-empty">Nothing found for “${esc(q)}”.</div>`;
}
function openSearch() {
  closePalette(true); closeControls(true); closeSettings();
  $('#account-menu').hidden = true;
  $('#search-overlay').classList.add('open');
  $('#search-input').value = '';
  doSearch('');
  Sound.play('open');
  setTimeout(() => $('#search-input')?.focus(), 70);
}
function closeSearch(silent) {
  const o = $('#search-overlay');
  if (!o || !o.classList.contains('open')) return;
  o.classList.remove('open');
  if (!silent) Sound.play('close');
}

/* ═══════════ COMMAND PALETTE ═══════════ */
let palIdx = 0, palItems = [];
function commands() {
  const c = [
    { t: 'Reader · resume where you left off', ic: 'book', run: () => navigate('read') },
    { t: 'Reader · start from the beginning', ic: 'play', run: () => navigate('read', SEGS[0].id) },
    { t: 'Reader · reveal all meanings', ic: 'eye', run: () => { navigate('read'); setTimeout(() => setAllMeanings(true), 240); } },
    { t: 'Reader · fold all meanings', ic: 'eyeoff', run: () => { navigate('read'); setTimeout(() => setAllMeanings(false), 240); } },
    { t: 'Reader · reading controls', ic: 'set', run: openControls },
    { t: 'Go · Overview', ic: 'home', run: () => navigate('home') },
    { t: 'Go · Library', ic: 'bm', run: () => navigate('library') },
    { t: 'Go · Journey', ic: 'flame', run: () => navigate('stats') },
    { t: 'Search the text', ic: 'search', run: openSearch },
    { t: 'Toggle interface sounds', ic: 'vol', run: () => H['toggle-sound']() },
    { t: 'Toggle focus mode', ic: 'focus', run: () => H['focus']() },
    { t: 'Open settings', ic: 'set', run: openSettings },
    { t: 'Cloud sync status', ic: 'db', run: syncInfo },
    { t: 'Export my data', ic: 'dl', run: exportData },
    { t: session ? 'Sign out' : 'Sign in / Create account', ic: session ? 'out' : 'user', run: () => session ? signOut() : openAuth() },
    { t: 'About & keyboard shortcuts', ic: 'info', run: openAbout }
  ];
  if (DATA) DATA.sections.forEach((s, i) => c.push({
    t: `Chapter ${i + 1} · ${s.en}`, ic: 'list',
    run: () => { navigate('read'); setTimeout(() => $('#' + s.id)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 240); }
  }));
  return c;
}
function renderPalette(q = '') {
  palItems = commands().filter(c => c.t.toLowerCase().includes(q.toLowerCase()));
  palIdx = 0;
  const box = $('#palette-list');
  box.innerHTML = palItems.length
    ? palItems.map((c, i) => `<button class="ov-item ${i === 0 ? 'kactive' : ''}" data-pal="${i}">${ic(c.ic)}<div class="t"><b>${esc(c.t)}</b></div></button>`).join('')
    : `<div class="ov-empty">No matching command.</div>`;
}
function openPalette() {
  closeSearch(true); closeControls(true); closeSettings();
  $('#account-menu').hidden = true;
  $('#palette').classList.add('open');
  $('#palette-input').value = '';
  renderPalette();
  Sound.play('open');
  setTimeout(() => $('#palette-input')?.focus(), 70);
}
function closePalette(silent) {
  const o = $('#palette');
  if (!o || !o.classList.contains('open')) return;
  o.classList.remove('open');
  if (!silent) Sound.play('close');
}
function palMove(d) {
  if (!palItems.length) return;
  palIdx = clamp(palIdx + d, 0, palItems.length - 1);
  $$('#palette-list .ov-item').forEach((el, i) => el.classList.toggle('kactive', i === palIdx));
  $('#palette-list .kactive')?.scrollIntoView({ block: 'nearest' });
}
function palRun(i = palIdx) {
  const c = palItems[i];
  if (!c) return;
  closePalette();
  c.run();
}

/* ═══════════ ABOUT ═══════════ */
function openAbout() {
  const keys = [
    ['Tap a verse', 'Reveal / hide its meaning'],
    ['T', 'Toggle the current verse'],
    ['C', 'Reading controls'],
    ['/', 'Search'],
    ['Ctrl / ⌘ + K', 'Command palette'],
    ['1 – 4', 'Reader · Overview · Library · Journey'],
    ['M', 'Mute / unmute'],
    ['F', 'Focus mode'],
    ['A', 'Auto-scroll'],
    ['+ / −', 'Arabic size'],
    ['B', 'Bookmark current'],
    ['R', 'Mark current read'],
    ['← / →', 'Previous / next passage'],
    ['Esc', 'Close / exit'],
    ['?', 'This panel']
  ];
  openModal(`<button class="icon-btn modal-x" data-action="modal-close" aria-label="Close">${ic('x')}</button>
    <h2>${ic('info')}About Nūr</h2>
    <div class="about-ar">فَيَا مَنْ وَعَدَ فَوَفَى، وَأَوْعَدَ فَعَفَا</div>
    <div class="m-body">A luminous home for the Grand Istighfār — ${esc(DATA.meta.attribution.en)}.
    Arabic reconstructed and fully vocalized from published editions (${esc(DATA.meta.source)}); English and Persian meanings composed for this reader.
    ${SEGS.length} passages · ${DATA.sections.length} chapters. Meanings stay folded until you tap a verse.</div>
    <div class="sec-title" style="margin:22px 0 2px">Keyboard & touch</div>
    <div class="keys-grid">${keys.map(k => `<div><span>${esc(k[1])}</span><kbd>${esc(k[0])}</kbd></div>`).join('')}</div>
    <p class="mut" style="font-size:11.5px;margin-top:16px;text-align:center">Build ${BUILD} · vanilla JS · Supabase REST</p>`);
}

/* ═══════════ DATA I/O ═══════════ */
function exportData() {
  const blob = new Blob([JSON.stringify({ ...S, exported_at: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = `nur-istighfar-${dayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  Sound.play('success');
  toast('Data exported', 'ok', 'dl');
}
function bindImport() {
  const input = $('#import-file');
  if (!input) return;
  input.addEventListener('change', async e => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (j.v !== 1) throw new Error('Not a Nūr backup file');
      S = mergeState(S, j);
      clampSettings(); sanitize(); persistLocal();
      applySettings(); syncDrawerInputs(); persist(); rerenderPreserving();
      Sound.play('success');
      toast('Data imported & merged', 'ok', 'ul');
    } catch (err) {
      Sound.play('error');
      toast('Import failed: ' + err.message, 'err', 'alert');
    }
    e.target.value = '';
  });
}
async function resetData() {
  const ok = await confirmBox({
    title: 'Reset all progress?',
    body: 'Read marks, bookmarks, notes and streaks will be cleared on this device' + (session ? ' and in the cloud.' : '.'),
    ok: 'Reset everything', danger: true
  });
  if (!ok) return;
  const keep = S.settings, seen = S.coachSeen;
  S = deepCopy(DEFAULTS);
  S.settings = keep;
  S.coachSeen = seen;
  persist(); render();
  Sound.play('off');
  toast('A clean page. Begin again.', 'ok', 'rotate');
}

/* ═══════════ AMBIENT CANVAS ═══════════ */
const FX = {
  cv: null, cx: null, ps: [], raf: 0, running: false, cols: ['#e6b95c', '#4fd1b5'],
  init() {
    this.cv = $('#fx');
    if (!this.cv) return;
    this.cx = this.cv.getContext('2d');
    this.refresh(); this.resize();
    addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => document.hidden ? this.stop() : this.sync());
    this.sync();
  },
  refresh() {
    const cs = getComputedStyle(document.documentElement);
    this.cols = [cs.getPropertyValue('--acc').trim() || '#e6b95c', cs.getPropertyValue('--acc2').trim() || '#4fd1b5'];
  },
  resize() {
    if (!this.cx) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.cv.width = innerWidth * dpr;
    this.cv.height = innerHeight * dpr;
    this.cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(110, Math.floor(innerWidth * innerHeight / 18000));
    this.ps = Array.from({ length: n }, () => ({
      x: Math.random() * innerWidth, y: Math.random() * innerHeight,
      r: Math.random() * 1.6 + .4, v: Math.random() * .16 + .04,
      p: Math.random() * Math.PI * 2, gold: Math.random() > .45
    }));
    this.sync();
  },
  draw(t) {
    if (!this.cx) return;
    const [a, b] = this.cols;
    this.cx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of this.ps) {
      this.cx.globalAlpha = (.35 + .65 * Math.abs(Math.sin(t / 1700 + p.p))) * .55;
      this.cx.fillStyle = p.gold ? a : b;
      this.cx.beginPath();
      this.cx.arc(p.x, p.y, p.r, 0, 7);
      this.cx.fill();
    }
    this.cx.globalAlpha = 1;
  },
  loop() {
    if (!this.cx || this.running) return;
    this.running = true;
    const step = t => {
      if (!this.running) return;
      this.draw(t);
      for (const p of this.ps) { p.y -= p.v; if (p.y < -4) { p.y = innerHeight + 4; p.x = Math.random() * innerWidth; } }
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  },
  stop() { this.running = false; cancelAnimationFrame(this.raf); },
  still() { this.stop(); this.draw(1200); },
  sync() { if (!this.cx) return; S.settings.motion ? this.loop() : this.still(); }
};
function confetti(n = 120) {
  if (!S.settings.motion) return;
  const cv = $('#confetti');
  if (!cv) return;
  const cx = cv.getContext('2d');
  cv.width = innerWidth; cv.height = innerHeight;
  const cols = ['#e6b95c', '#4fd1b5', '#f0c674', '#e9edf5', '#c9a2ff'];
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
        cx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6);
        cx.restore();
      }
    }
    if (alive && ++frames < 300) requestAnimationFrame(tick);
    else cx.clearRect(0, 0, cv.width, cv.height);
  })();
}

/* ═══════════ WORD-BY-WORD · AI ═══════════ */
const AR_RUN = /([\u0621-\u064A\u064B-\u065F\u0670]+)/g;
const AR_STRIP = /[\u064B-\u065F\u0670\u0640\u06D6-\u06ED\u200C]/g;
function normWord(w) {
  return String(w).replace(AR_STRIP, '').replace(/[أإآٱ]/g, 'ا').replace(/[^\u0621-\u064A]/g, '');
}
function arHTML(sg) {
  return esc(sg.ar).replace(AR_RUN, m => `<span class="w" data-w="${esc(normWord(m))}" data-seg="${sg.id}">${m}</span>`);
}
const shortName = n => { n = String(n || ''); return n.length > 26 ? n.slice(0, 25) + '…' : n; };
const ctxLabel = n => !n ? '—' : (n >= 1000 ? Math.round(n / 1024) + 'k' : String(n));
function priceLabel(m) {
  if (m.free) return 'free';
  const f = x => x === 0 ? '0' : x < 0.01 ? x.toFixed(4) : x.toFixed(2);
  return `$${f((+m.p || 0) * 1e6)} / $${f((+m.c || 0) * 1e6)} per 1M`;
}

const AI_KEY_RE = /^sk-or-[A-Za-z0-9._\-]{8,}$/;
function cleanKey(v) {
  return String(v == null ? '' : v)
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '')
    .replace(/\s+/g, '')
    .replace(/^["'`\u201C\u201D\u2018\u2019]+|[\"'`\u201C\u201D\u2018\u2019]+$/g, '')
    .replace(/^bearer/i, '')
    .replace(/["'`\u201C\u201D\u2018\u2019]/g, '');
}
let DIAG = null;
const REASON_RE = /(deepseek-r1|deepseek-v3\.[12]|qwq|qvq|o[134]-|grok-4|magistral|thinking|reasoner)/i;
const HTTP_NAMES = {
  400: 'Bad request', 401: 'Unauthorized', 402: 'Payment required', 403: 'Forbidden',
  404: 'Not found', 408: 'Timeout', 413: 'Payload too large', 422: 'Unprocessable content',
  429: 'Too many requests', 500: 'Server error', 502: 'Bad gateway',
  503: 'Service unavailable', 504: 'Gateway timeout', 520: 'Provider error', 524: 'Provider timeout'
};
const snip = (t, n) => String(t == null ? '' : t).replace(/\s+/g, ' ').trim().slice(0, n || 300);
const isReasonModel = id => REASON_RE.test(String(id || ''));
const fmtMs = ms => ms >= 1000 ? (ms / 1000).toFixed(1) + ' s' : Math.round(ms) + ' ms';
function aiErr(o) { const e = new Error(o.msg || o.head || 'Request failed'); e.info = o; return e; }
const AI = {
  key() { try { return cleanKey(localStorage.getItem(AI_KEY_LS) || ''); } catch { return ''; } },
  keyValid(v) { return AI_KEY_RE.test(v == null ? this.key() : v); },
  setKey(v) {
    try { const k = cleanKey(v); k ? localStorage.setItem(AI_KEY_LS, k) : localStorage.removeItem(AI_KEY_LS); return true; }
    catch { return false; }
  },
  base() {
    try {
      const v = (localStorage.getItem(AI_BASE_LS) || '').trim().replace(/\/+$/, '');
      return /^https?:\/\/[^\s]+$/i.test(v) ? v : AI_ENDPOINT;
    } catch { return AI_ENDPOINT; }
  },
  customBase() {
    try {
      const v = (localStorage.getItem(AI_BASE_LS) || '').trim().replace(/\/+$/, '');
      return /^https?:\/\/[^\s]+$/i.test(v) ? v : '';
    } catch { return ''; }
  },
  setBase(v) {
    try { v ? localStorage.setItem(AI_BASE_LS, v) : localStorage.removeItem(AI_BASE_LS); return true; }
    catch { return false; }
  },
  host() { try { return new URL(this.base()).host; } catch { return 'OpenRouter'; } },
  deep() { return !!(S.ai && S.ai.deep); },
  netMsg() {
    if (navigator.onLine === false) return 'you are offline — reconnect and try again.';
    return 'the request never left your browser, so a VPN, proxy, firewall or extension is filtering ' + this.host() + '. Allow this site, or try another network.';
  },
  /* Checks the same layers the AI button uses: reachability, the key carrying
     request (needs a CORS preflight) and, on request, a live streamed reply. */
  async diag(opts) {
    const d = { base: this.base(), host: this.host(), at: 0, models: null, auth: null, chat: null };
    let t = Date.now();
    try {
      const r = await fetch(d.base + '/models');
      const txt = await r.text();
      let j = null; try { j = JSON.parse(txt); } catch {}
      d.models = { ok: r.ok, status: r.status, n: (j && j.data ? j.data.length : 0), ms: Date.now() - t, ct: r.headers.get('content-type') || '', raw: r.ok ? '' : snip(txt, 300) };
    } catch { d.models = { net: true, ms: Date.now() - t }; }
    const key = this.key();
    if (!key) d.auth = { none: true };
    else if (!this.keyValid(key)) d.auth = { invalid: true };
    else {
      t = Date.now();
      try {
        const r = await fetch(d.base + '/key', { headers: { Authorization: 'Bearer ' + key } });
        const txt = await r.text();
        let j = null; try { j = JSON.parse(txt); } catch {}
        d.auth = { ok: r.ok, status: r.status, ms: Date.now() - t, data: (j && j.data) || null, raw: r.ok ? '' : snip(txt, 300) };
      } catch { d.auth = { net: true, ms: Date.now() - t }; }
    }
    const m = this.active();
    if (opts && opts.chat && d.auth && d.auth.ok && m) {
      t = Date.now();
      try {
        const r = await fetch(d.base + '/chat/completions', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
          body: JSON.stringify({ model: m.id, messages: [{ role: 'user', content: 'ping' }], max_tokens: 4 })
        });
        const txt = await r.text();
        let j = null; try { j = JSON.parse(txt); } catch {}
        const er = (j && j.error) || null;
        d.chat = {
          ok: r.ok, status: r.status, ms: Date.now() - t, model: m.id,
          used: (j && j.model) || '', provider: (j && j.provider) || '',
          msg: er ? String(er.message || er.code || snip(txt, 200)) : (r.ok ? '' : snip(txt, 200)),
          code: er && er.code != null ? er.code : '',
          provider: (er && er.metadata && er.metadata.provider_name) || '',
          ct: r.headers.get('content-type') || '',
          raw: txt
        };
      } catch { d.chat = { net: true, ms: Date.now() - t, model: m.id }; }
    }
    d.at = Date.now();
    DIAG = d;
    return d;
  },
  diagMsg(d) {
    const p = [], m = d.models || {}, a = d.auth || {}, c = d.chat;
    if (m.ok) p.push(`${d.host} reachable · ${m.n} models · ${m.ms} ms`);
    else if (m.net) p.push(`no route to ${d.host} — ${navigator.onLine === false ? 'you are offline' : 'VPN, proxy or extension is blocking it'}`);
    else p.push(`${d.host} answered HTTP ${m.status}${m.raw ? ' — ' + snip(m.raw, 90) : ''}`);
    if (a.none) p.push('no key saved yet');
    else if (a.invalid) p.push('saved key has characters a key cannot contain — paste it again on one line');
    else if (a.net) p.push('key request blocked before it was sent (CORS, VPN or extension)');
    else if (a.ok) p.push('key accepted');
    else p.push(`key check HTTP ${a.status}${a.raw ? ' — ' + snip(a.raw, 90) : ''}`);
    if (c) {
      if (c.ok) p.push(`test prompt answered in ${fmtMs(c.ms)}${c.used && c.used !== c.model ? ' · router chose ' + c.used : c.used ? ' · model ' + c.used : ''}`);
      else if (c.net) p.push('chat request blocked before it was sent (CORS, VPN or extension)');
      else p.push(`chat HTTP ${c.status}${HTTP_NAMES[c.status] ? ' ' + HTTP_NAMES[c.status] : ''} — ${c.msg || 'empty body'}${c.provider ? ' (' + c.provider + ')' : ''}`);
    }
    return p.join(' · ').replace(/[.\s]+$/, '') + '.';
  },
  /* Turns any thrown value into the most exact error we can name: the server's
     own status and body when there is one, the browser string plus the failing
     layer when the request never got an answer. */
  async explain(e) {
    if (e && e.info) return e;
    if (e && e.name === 'AbortError') return aiErr({
      kind: 'abort', head: 'Timed out',
      msg: 'The model did not answer before the deadline (' + (this.deep() ? '180 s' : '90 s') + ').',
      hint: 'Reasoning models are slow. Retry, pick a smaller model, or leave deep reasoning off.', raw: ''
    });
    const d = await this.diag();
    const i = {
      kind: 'network', head: 'Network error — no answer reached the browser',
      msg: (e && e.message) || 'Failed to fetch', meta: '', hint: '', raw: this.diagMsg(d)
    };
    if (!d.models || !d.models.ok) {
      i.meta = 'GET ' + d.base + '/models failed';
      i.hint = 'Could not reach ' + d.host + ' — ' + this.netMsg();
    } else if (d.auth && d.auth.invalid) {
      i.meta = 'POST ' + d.base + '/chat/completions blocked';
      i.hint = 'Your saved key contains characters a key cannot have (a line break, a quote or a space). Paste it again in Settings → Word insight on one line.';
    } else if (d.auth && d.auth.net) {
      i.meta = 'GET ' + d.base + '/key blocked · ' + d.host + ' plain requests work';
      i.hint = 'The request that carries your key never left the browser — a VPN, proxy, firewall or extension is blocking authenticated calls. Allow this site, or try another network.';
    } else if (d.auth && d.auth.ok) {
      i.meta = 'key accepted · /chat/completions still blocked';
      i.hint = 'Your key works but the AI endpoint is filtered — an ad-blocker, VPN or proxy is dropping requests to ' + d.base + '/chat/completions. Allow this site, or use another base in Settings.';
    } else if (d.auth && d.auth.status === 401) {
      i.meta = 'key rejected with 401';
      i.hint = 'The key check returned 401, so no AI request could run. Check the key on ' + d.host + ', then paste it again.';
    } else {
      i.meta = 'the request was sent, the reply could not be read';
      i.hint = 'That is a CORS or TLS failure inside the reading of the response — usually an ad-blocker or privacy extension. Disable it for this page and retry.';
    }
    return aiErr(i);
  },
  list() { return (S.ai.models || []).filter(m => m && m.id); },
  active() {
    const l = this.list();
    return l.find(m => m.id === S.ai.active && m.enabled !== false) || l.find(m => m.enabled !== false) || null;
  },
  cache() { return loadJSON(AI_CACHE_LS) || {}; },
  cacheSet(k, v) {
    const c = this.cache(); c[k] = v;
    const ks = Object.keys(c);
    if (ks.length > 240) ks.slice(0, ks.length - 240).forEach(x => delete c[x]);
    try { localStorage.setItem(AI_CACHE_LS, JSON.stringify(c)); } catch {}
  },
  hintFor(status, notJSON) {
    if (notJSON) return 'Something between you and ' + this.host() + ' replaced the reply (captive portal, proxy, antivirus or extension). Open ' + this.base() + '/models in a tab to see what really comes back.';
    if (status === 400) return 'OpenRouter rejected the request itself — the message above is its own wording. Check the model id, or turn deep reasoning off if the model does not support it.';
    if (status === 401) return 'The key was rejected. Create or check it on ' + this.host() + ' → Keys, then paste it again in Settings → Word insight.';
    if (status === 402) return 'This model is paid and the balance is too low. Pick a model marked free, or top up on ' + this.host() + '.';
    if (status === 403) return 'The key is valid but not allowed to do this — moderation, region or provider policy refused it. Try another model.';
    if (status === 404) return 'No such model or endpoint at this base. Check the model id, or reset the API base in Settings.';
    if (status === 408 || status === 504 || status === 524) return 'The provider timed out. Retry, or pick a faster model.';
    if (status === 429) return 'Rate limit. Wait for the retry-after window (or a minute), then retry; free models share a small daily quota.';
    if (status >= 500) return 'This is ' + this.host() + ' or the upstream provider failing, not your key. Retry, or switch model.';
    return '';
  },
  /* One error object for every unexpected answer: exact HTTP status, exact body
     message, provider and code, the raw response, plus a hint. */
  serverErr(r, model, notJSON) {
    const status = r.status, text = r.text || '', ct = r.ct || '', ra = r.ra || '';
    let j = null; try { j = JSON.parse(text); } catch {}
    const er = (j && j.error) || null;
    const md = (er && er.metadata) || (j && j.metadata) || {};
    const provRaw = md.raw != null ? (typeof md.raw === 'string' ? md.raw : JSON.stringify(md.raw)) : '';
    const msg = er ? String(er.message || er.code || '') : (j && j.message ? String(j.message) : '');
    const code = er && er.code != null ? er.code : '';
    const meta = [];
    if (code !== '') meta.push('code ' + code);
    if (md.provider_name) meta.push('provider ' + md.provider_name);
    if (ra) meta.push('retry-after ' + ra + 's');
    if (ct) meta.push(ct.split(';')[0]);
    meta.push('model ' + model.id);
    if (md.is_byok) meta.push('BYOK');
    const detail = msg || provRaw || snip(text, 400) || '(the response body was empty)';
    const head = notJSON
      ? 'HTTP ' + status + ' · reply was not JSON'
      : 'HTTP ' + status + (HTTP_NAMES[status] ? ' ' + HTTP_NAMES[status] : '');
    this.last = { at: Date.now(), url: this.base() + '/chat/completions', model: model.id, status, ct, ms: 0, raw: text };
    return aiErr({ kind: 'server', head, msg: detail, meta: meta.join(' · '), hint: this.hintFor(status, notJSON), raw: text, retryAfter: ra, status });
  },
  emptyErr(model, finish, why, raw) {
    return aiErr({
      kind: 'empty',
      head: 'Empty answer' + (finish ? ' · finish_reason: ' + finish : ' · no content'),
      msg: finish === 'length'
        ? 'The model used its whole token budget before writing an answer.'
        : finish === 'content_filter'
          ? 'The provider filtered the answer (content_filter).'
          : 'The model finished its turn without writing any text.',
      meta: 'model ' + model.id + (why ? ' · reasoning only, ' + why.length + ' chars' : ''), 
      hint: finish === 'length' ? 'Retry, or choose a model with a larger context.' : 'Retry, or switch to another model.',
      raw: raw || ''
    });
  },
  fromJSON(text, ct, model, h) {
    let j = null; try { j = JSON.parse(text); } catch {}
    if (!j) throw this.serverErr({ status: 200, ct, text, ra: '' }, model, true);
    if (j.error) throw this.serverErr({ status: 200, ct, text, ra: '' }, model);
    const ch = (j.choices && j.choices[0]) || {};
    const msg = ch.message || {};
    const ans = String(msg.content == null ? '' : msg.content).trim();
    const why = String(msg.reasoning || msg.reasoning_content || '').trim();
    if (!ans) throw this.emptyErr(model, ch.finish_reason || j.finish_reason || '', why, text);
    if (why && h && h.reason) h.reason(why);
    if (h && h.delta) h.delta(ans);
    return { text: ans, why, finish: ch.finish_reason || '', ms: 0, model: model.id, used: j.model || '', provider: j.provider || '' };
  },
  /* Streams the answer token by token. Falls back to one JSON read when the
     server answers non-streamed, and reports the exact error in every failure. */
  async call(model, messages, h) {
    h = h || {};
    const key = this.key();
    if (!key) throw aiErr({ kind: 'config', head: 'No API key', msg: 'No ' + this.host() + ' key yet — add one in Settings → Word insight.', raw: '' });
    if (!this.keyValid(key)) throw aiErr({ kind: 'config', head: 'Key is malformed', msg: 'The saved key is not a valid key (expected sk-or-… on a single line). Paste it again in Settings → Word insight.', raw: '' });
    const deep = !!h.deep;
    const url = this.base() + '/chat/completions';
    const body = {
      model: model.id, messages,
      temperature: deep ? 0.3 : 0.2,
      max_tokens: deep ? 3200 : 900,
      stream: true
    };
    if (deep || isReasonModel(model.id)) body.reasoning = { effort: deep ? 'high' : 'medium' };
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), deep ? 180000 : 90000);
    const t0 = Date.now();
    const send = p => fetch(url, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify(p)
    });
    const readFail = async r => ({ status: r.status, ct: r.headers.get('content-type') || '', ra: r.headers.get('retry-after') || '', text: await r.text().catch(() => '') });
    try {
      let r = await send(body);
      let fail = null;
      if (!r.ok) {
        fail = await readFail(r);
        /* A model without reasoning support refuses the reasoning field: drop it
           once and retry, instead of reporting a failure that is our own fault. */
        if (fail.status === 400 && body.reasoning && /reasoning|effort|not supported|unsupported/i.test(fail.text)) {
          delete body.reasoning;
          r = await send(body);
          fail = r.ok ? null : await readFail(r);
        }
        if (fail) throw this.serverErr(fail, model);   /* the body is read once, kept verbatim */
      }
      const ct = r.headers.get('content-type') || '';
      if (!/event-stream/i.test(ct) || !r.body || typeof r.body.getReader !== 'function') {
        const txt = await r.text();
        const out = this.fromJSON(txt, ct, model, h);
        out.ms = Date.now() - t0;
        this.last = { at: Date.now(), url, model: model.id, status: r.status, ct, ms: out.ms, raw: txt, stream: false };
        return out;
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = '', ans = '', why = '', finish = '', srvErr = null, done = false, rawHead = '', used = '', provider = '';
      while (!done) {
        const step = await reader.read();
        if (step.done) break;
        buf += dec.decode(step.value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).replace(/\r$/, '');
          buf = buf.slice(nl + 1);
          if (!line || line.charAt(0) === ':') continue;   /* ": OPENROUTER PROCESSING" keep-alive */
          if (line.slice(0, 5) !== 'data:') continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') { done = true; break; }
          let j = null; try { j = JSON.parse(data); } catch { continue; }
          if (rawHead.length < 600) rawHead += data + '\n';
          if (j.error) { srvErr = j.error; done = true; break; }
          if (!used && j.model) used = String(j.model);
          if (!provider && j.provider) provider = String(j.provider);
          const ch = (j.choices && j.choices[0]) || {};
          const d = ch.delta || ch.message || {};
          const rsn = d.reasoning || d.reasoning_content;
          if (rsn) { why += rsn; if (h.reason) h.reason(why); }
          if (d.content) { ans += d.content; if (h.delta) h.delta(ans); }
          if (ch.finish_reason) finish = ch.finish_reason;
        }
      }
      try { reader.cancel(); } catch {}
      const ms = Date.now() - t0;
      this.last = { at: Date.now(), url, model: model.id, used, provider, status: r.status, ct, ms, finish, stream: true, raw: rawHead };
      if (srvErr) {
        const body2 = JSON.stringify({ error: srvErr, choices: ans ? [{ message: { content: ans } }] : [] });
        const st = typeof srvErr.code === 'number' ? srvErr.code : r.status;
        throw this.serverErr({ status: st, ct: 'application/json', ra: '', text: body2 }, model);
      }
      if (!ans.trim()) throw this.emptyErr(model, finish, why, rawHead);
      return { text: ans.trim(), why: why.trim(), finish, ms, model: model.id, used, provider };
    } catch (e) {
      throw await this.explain(e);
    } finally { clearTimeout(timer); }
  }
};


function aiPrompt(word, sg) {
  return [
    { role: 'system', content: 'تو آموزگار صرف و نحو عربی برای فارسی‌زبانانی هستی که عربی نمی‌دانند. پاسخ را فقط به فارسی روان و کوتاه بنویس، با اصطلاحات دقیق صرفی و نحوی ولی توضیح ساده. بی‌مقدمه و بدون مقدمه‌چینی شروع کن.' },
    { role: 'user', content: `واژه: «${word}»\nجمله: «${sg.ar}»\nترجمهٔ فارسی جمله: «${sg.fa}»\n\nاین واژه را در چهار بخش کوتاه (هر بخش یک تا دو خط، با تیتر) توضیح بده:\n۱. معنا در همین جمله\n۲. ریشه (جذر) و معنای آن\n۳. ساختار صرفی: وزن، باب، زمان، شخص و شمار\n۴. نقش نحوی در جمله` }
  ];
}
function aiLinesHTML(text, streaming) {
  const lines = String(text == null ? '' : text).replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
  const html = lines.map(line => {
    let t = esc(line).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    if (!/<b>/.test(t)) t = t.replace(/^([^:：]{1,52})[:：]\s*(.+)$/, '<b>$1:</b> $2');
    return `<div class="ai-blk">${t}</div>`;
  }).join('');
  return streaming ? html + '<span class="ai-caret" aria-hidden="true"></span>' : html;
}
/* Some ids (openrouter/auto, a router or a preset) are not models of their
   own: the server picks one and names it in every reply. Show that real model. */
function aiByHTML(reqId, used, provider) {
  used = String(used || '');
  if (!used || used === reqId) return '';
  const via = reqId ? `<b>${esc(reqId)}</b> → ` : '';
  return `<div class="ai-by">${via}answered by <b>${esc(used)}</b>${provider ? ' · ' + esc(provider) : ''}</div>`;
}
function aiWhyHTML(why) {
  if (!why) return '';
  return `<details class="ai-why"><summary>Reasoning · ${why.length} chars</summary><div class="ai-why-body" dir="auto">${esc(why)}</div></details>`;
}
/* Shows the exact failure: the server's own status and wording first, the hint
   second, and the untouched response body behind a fold. */
function aiErrHTML(e) {
  const i = (e && e.info) || null;
  if (!i) return `<div class="wp-err"><div class="we-head">${esc((e && e.message) || 'Request failed')}</div></div>`;
  const meta = i.meta ? `<div class="we-meta">${esc(i.meta)}</div>` : '';
  const hint = i.hint ? `<div class="we-hint">${esc(i.hint)}</div>` : '';
  const raw = i.raw
    ? `<details class="we-raw"><summary>Raw response · ${i.raw.length} chars</summary><pre dir="auto">${esc(i.raw)}</pre></details>`
    : '';
  return `<div class="wp-err"><div class="we-head">${esc(i.head || 'Request failed')}</div>` +
    (i.msg ? `<div class="we-msg" dir="auto">${esc(i.msg)}</div>` : '') + meta + hint + raw + '</div>';
}
function renderAI(v) {
  const out = $('#wp-out');
  if (!out) return;
  const t = v && typeof v === 'object' ? v.t : v;
  const w = v && typeof v === 'object' ? v.w : '';
  const u = v && typeof v === 'object' ? v.u : '';
  const p = v && typeof v === 'object' ? v.p : '';
  const r = v && typeof v === 'object' ? v.r : '';
  out.innerHTML = aiWhyHTML(w) + aiLinesHTML(t || '') + aiByHTML(r, u, p);
  out.hidden = false;
  out.scrollTop = 0;
  if (WORD) placeWord(WORD.el);
}
/* One live answer inside the word popup: loads, streams reasoning, streams text. */
function aiView(out, target, m, deep) {
  out.hidden = false;
  out.innerHTML = '<div class="wp-live">' +
    `<div class="wp-load"><i></i><span>${esc(shortName(m.name))} is ${deep ? 'reasoning' : 'thinking'}…</span></div>` +
    '<details class="ai-why" hidden><summary></summary><div class="ai-why-body" dir="auto"></div></details>' +
    '<div class="ai-body"></div>' +
    '<div class="ai-by" hidden></div></div>';
  const live = out.querySelector('.wp-live');
  const load = live.querySelector('.wp-load');
  const whyBox = live.querySelector('.ai-why');
  const whySum = whyBox.querySelector('summary');
  const whyBody = whyBox.querySelector('.ai-why-body');
  const bodyEl = live.querySelector('.ai-body');
  const byEl = live.querySelector('.ai-by');
  let text = '', why = '', raf = 0, finished = false;
  const paint = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (WORD !== target) return;
      if (why) {
        whyBox.hidden = false;
        whySum.textContent = `Reasoning · ${why.length} chars`;
        whyBody.textContent = why;
      }
      bodyEl.innerHTML = aiLinesHTML(text, !finished);
      if (text) load.hidden = true;
      if (out.scrollHeight - out.scrollTop - out.clientHeight < 90) out.scrollTop = out.scrollHeight;
      placeWord(target.el);
    });
  };
  return {
    reason(t) { why = t; paint(); },
    delta(t) { text = t; paint(); },
    done(res) {
      finished = true;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (res && res.text) text = res.text;
      if (res && res.why) why = res.why;
      load.hidden = true;
      /* Finish in place: keep the reader's scroll position and any reasoning
         fold they opened, so the answer never jumps or resets under them. */
      const st = out.scrollTop;
      const openWhy = whyBox.open;
      bodyEl.innerHTML = aiLinesHTML(text, false);
      if (why) {
        whyBox.hidden = false; whyBox.open = openWhy;
        whySum.textContent = `Reasoning · ${why.length} chars`;
        whyBody.textContent = why;
      } else whyBox.hidden = true;
      if (byEl) {
        const b = aiByHTML(m.id, res && res.used, res && res.provider);
        byEl.hidden = !b;
        byEl.innerHTML = b;
      }
      out.scrollTop = st;
      placeWord(target.el);
    },
    fail(e) {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      out.innerHTML = aiErrHTML(e);
      out.scrollTop = 0;
      placeWord(target.el);
    }
  };
}
function closeWord(silent) {
  const pop = $('#word-pop');
  if (!pop || pop.hidden) { WORD = null; return; }
  pop.hidden = true;
  if (WORD && WORD.el) WORD.el.classList.remove('hit');
  WORD = null;
  if (!silent) Sound.play('fold');
}
function placeWord(el) {
  const pop = $('#word-pop');
  if (!pop || !el) return;
  pop.hidden = false;
  const r = el.getBoundingClientRect();
  pop.style.visibility = 'hidden';
  const pr = pop.getBoundingClientRect();
  let top = r.bottom + 8;
  if (top + pr.height > innerHeight - 10) top = r.top - pr.height - 8;
  top = clamp(top, 10, Math.max(10, innerHeight - pr.height - 10));
  const left = clamp(r.left + r.width / 2 - pr.width / 2, 10, Math.max(10, innerWidth - pr.width - 10));
  pop.style.top = top + 'px';
  pop.style.left = left + 'px';
  pop.style.visibility = '';
}
function openWord(el) {
  const segId = +el.dataset.seg, sg = IDX[segId];
  if (!sg) return;
  if (WORD && WORD.el === el && !$('#word-pop').hidden) return;
  closeWord(true);
  WORD = { segId, tok: el.textContent.trim(), el, norm: el.dataset.w };
  const gloss = WORDS[el.dataset.w] || '';
  $('#wp-ar').textContent = el.textContent;
  $('#wp-fa').textContent = gloss || '—';
  $('#wp-sub').textContent = `Passage ${segId} · ${SEC_OF[segId].fa}`;
  const out = $('#wp-out');
  out.hidden = true; out.innerHTML = '';
  const m = AI.active();
  $('#wp-model').textContent = m ? (m.free ? 'free' : 'paid') + ' · ' + shortName(m.name) + (AI.deep() ? ' · deep' : '') : 'no model';
  el.classList.add('hit');
  placeWord(el);
  Sound.play('pop');
  buzz(4);
}
async function explainWord() {
  if (!WORD) return;
  const m = AI.active();
  if (!m) {
    toast('Add an AI model in Settings → Word insight', 'warn', 'spark');
    closeWord(true); openSettings();
    setTimeout(() => $('#ai-models')?.scrollIntoView({ block: 'center' }), 260);
    return;
  }
  if (!AI.key()) {
    toast('Add your OpenRouter key in Settings → Word insight', 'warn', 'lock');
    closeWord(true); openSettings();
    setTimeout(() => { $('#ai-key')?.scrollIntoView({ block: 'center' }); $('#ai-key')?.focus(); }, 260);
    return;
  }
  const target = WORD;
  const sg = IDX[target.segId];
  const out = $('#wp-out');
  const deep = AI.deep();
  const ck = `${m.id}|${target.segId}|${target.norm}|${deep ? 'd' : 'q'}`;
  const hit = AI.cache()[ck];
  Sound.play('tap');
  if (hit) { renderAI(hit); return; }
  const view = aiView(out, target, m, deep);
  if (WORD) placeWord(WORD.el);
  try {
    const res = await AI.call(m, aiPrompt(target.tok, sg), { deep, delta: view.delta, reason: view.reason });
    AI.cacheSet(ck, { t: res.text, w: res.why, u: res.used || '', p: res.provider || '', r: m.id });
    if (WORD !== target) return;
    view.done(res);
    Sound.play('reveal');
  } catch (e) {
    if (WORD !== target) return;
    view.fail(e);
    Sound.play('error');
  }
}

/* ── model manager ───────────────────────────────────────────── */
function renderAIModels() {
  const box = $('#ai-models');
  if (!box) return;
  const key = AI.key();
  const badKey = !!key && !AI.keyValid(key);
  const line = $('#ai-keyline');
  if (line) {
    line.className = 'ai-keyline' + (badKey ? ' bad' : key ? ' ok' : '');
    line.innerHTML = badKey
      ? `${ic('alert')}Saved key has stray characters — paste it again on one line.`
      : key
        ? `${ic('lock')}Key saved on this device · ${esc(key.slice(0, 7))}…${esc(key.slice(-4))}`
        : `${ic('lock')}No key yet — paste your OpenRouter key and save.`;
  }
  const inp = $('#ai-key');
  if (inp) inp.placeholder = key ? 'Saved — paste a new key to replace' : 'sk-or-v1-…';
  const dp = $('#ai-deep');
  if (dp) dp.checked = AI.deep();
  const bi = $('#ai-base');
  if (bi && !bi.value) bi.value = AI.customBase();
  const bl = $('#ai-baseline');
  if (bl) {
    const cb = AI.customBase();
    bl.className = 'ai-keyline' + (cb ? ' ok' : '');
    bl.innerHTML = cb
      ? `${ic('check')}Using ${esc(AI.base())}`
      : `${ic('info')}Default endpoint · openrouter.ai. Change it only if your network blocks OpenRouter.`;
  }
  const list = AI.list();
  if (!list.length) {
    box.innerHTML = `<div class="ai-empty">No models yet.<br>Add a free one from OpenRouter.</div>`;
    return;
  }
  box.innerHTML = list.map(m => {
    const on = m.id === S.ai.active && m.enabled !== false;
    return `<div class="ai-model ${on ? 'on' : ''} ${m.enabled === false ? 'off' : ''}">
      <div class="amain"><b>${esc(shortName(m.name || m.id))}</b><code>${esc(m.id)}</code>
        <div class="ameta"><span>${ctxLabel(m.ctx)} ctx</span><span class="${m.free ? 'free' : ''}">${esc(priceLabel(m))}</span>${m.enabled === false ? '<span>disabled</span>' : ''}</div></div>
      <div class="abtns">
        ${on ? `<button class="on" data-action="ai-active" title="Active model">${ic('check')}</button>`
             : `<button data-action="ai-activate" data-id="${esc(m.id)}" title="Use this model">Use</button>`}
        <button data-action="ai-toggle" data-id="${esc(m.id)}" title="${m.enabled === false ? 'Enable' : 'Disable'} this model">${m.enabled === false ? 'Enable' : 'Disable'}</button>
        <button data-action="ai-del" data-id="${esc(m.id)}" title="Delete" aria-label="Delete model">${ic('trash')}</button>
      </div></div>`;
  }).join('');
}
async function aiCatalog(force) {
  const c = loadJSON(AI_CAT_LS);
  if (!force && c && c.at && Date.now() - c.at < 432e5 && Array.isArray(c.list)) return c.list;
  const r = await fetch(AI.base() + '/models');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const list = (j.data || []).map(m => ({
    id: m.id,
    name: m.name || m.id,
    ctx: m.context_length || 0,
    p: +m.pricing?.prompt || 0,
    c: +m.pricing?.completion || 0,
    free: /:free$/.test(m.id) || (+m.pricing?.prompt === 0 && +m.pricing?.completion === 0)
  })).sort((a, b) => (b.free - a.free) || a.name.localeCompare(b.name));
  try { localStorage.setItem(AI_CAT_LS, JSON.stringify({ at: Date.now(), list })); } catch {}
  return list;
}
function renderPick(q) {
  const box = $('#ai-pick-list');
  if (!box) return;
  const term = String(q || '').toLowerCase().trim();
  const match = PICK.filter(m => !term || (m.name + ' ' + m.id).toLowerCase().includes(term));
  const list = [...match.filter(m => m.free), ...match.filter(m => !m.free)].slice(0, 60);
  if (!list.length) { box.innerHTML = `<div class="pick-note">No match — paste the model id below instead.</div>`; return; }
  box.innerHTML = list.map(m => {
    const has = (S.ai.models || []).some(x => x.id === m.id);
    return `<div class="pick-row ${has ? 'added' : ''}">
      <div class="amain"><b>${esc(m.name)}</b><code>${esc(m.id)}</code>
        <div class="ameta"><span>${ctxLabel(m.ctx)} ctx</span><span class="${m.free ? 'free' : ''}">${esc(priceLabel(m))}</span></div></div>
      <button class="btn sm" data-action="ai-pick" data-id="${esc(m.id)}" ${has ? 'disabled' : ''}>${has ? 'Added' : 'Add'}</button></div>`;
  }).join('');
}
async function openModelPicker() {
  openModal(`<button class="icon-btn modal-x" data-action="modal-close" aria-label="Close">${ic('x')}</button>
    <h2>${ic('spark')}Add a model</h2>
    <div class="pick-q"><input id="ai-pick-q" type="search" placeholder="Search OpenRouter models…" autocomplete="off" spellcheck="false" aria-label="Search models"></div>
    <div class="pick-list" id="ai-pick-list"><div class="pick-note">Loading the OpenRouter catalogue…</div></div>
    <div class="pick-q" style="display:flex;gap:6px">
      <input id="ai-manual" type="text" placeholder="or paste a model id, e.g. deepseek/deepseek-r1:free" autocomplete="off" spellcheck="false" aria-label="Model id">
      <button class="btn sm" data-action="ai-manual-add">Add</button>
    </div>
    <p class="pick-note">Free models are listed first. Rate limits and availability come from OpenRouter, not from this app.</p>`);
  setTimeout(() => $('#ai-pick-q')?.focus(), 80);
  try { PICK = await aiCatalog(); renderPick(''); }
  catch (e) {
    const box = $('#ai-pick-list');
    if (box) box.innerHTML = `<div class="pick-note">Could not load the catalogue from ${esc(AI.host())} (${esc(e.message)}). Paste a model id below instead.</div>`;
  }
}
function addModel(m) {
  if (!m || !m.id) return;
  S.ai.models = S.ai.models || [];
  if (S.ai.models.some(x => x.id === m.id)) { toast('Already in your list', 'ok', 'check'); return; }
  S.ai.models.push({
    id: m.id, name: m.name || m.id, ctx: m.ctx || 0,
    p: m.p || 0, c: m.c || 0, free: !!m.free, enabled: true, addedAt: Date.now()
  });
  if (!AI.active()) S.ai.active = m.id;
  persist(); renderAIModels();
  renderPick($('#ai-pick-q')?.value || '');
  Sound.play('success');
  toast('Model added', 'ok', 'spark');
}

/* ═══════════ ACTIONS ═══════════ */
const H = {
  nav: t => navigate(t.dataset.view),
  jump: t => { closeSearch(true); closePalette(true); navigate('read', t.dataset.id); },
  begin: () => navigate('read', SEGS[0].id),
  continue: () => navigate('read', S.last != null ? S.last : SEGS[0].id),
  daily: () => navigate('read', SEGS[Math.floor(Date.now() / 864e5) % SEGS.length].id),
  account: () => toggleAccountMenu(),
  'open-auth': () => openAuth(),
  'close-auth': () => closeAuth(),
  'auth-tab': t => { authTab(t.dataset.v); Sound.play('tap'); },
  'auth-forgot': () => {
    $('#form-in').hidden = true;
    $('#form-forgot').hidden = false;
    $('#fg-email').value = $('#in-email').value;
    $('#auth-err').hidden = true;
    $('#fg-email').focus();
  },
  'auth-back': () => authTab('in'),
  resend: async () => {
    try {
      await sb('/auth/v1/resend', { method: 'POST', auth: false, body: { type: 'signup', email: $('#auth-verify').dataset.email } });
      toast('Verification email resent', 'ok', 'mail');
      Sound.play('success');
    } catch (e) { authError(e.message); }
  },
  eye: t => {
    const i = $('#' + t.dataset.t);
    if (!i) return;
    i.type = i.type === 'password' ? 'text' : 'password';
    t.innerHTML = ic(i.type === 'password' ? 'eye' : 'eyeoff');
    Sound.play('tap');
  },
  logout: () => { $('#account-menu').hidden = true; closeSettings(); closeModal(); signOut(); },
  'sync-info': () => { $('#account-menu').hidden = true; closeSettings(); syncInfo(); },
  'sync-now': () => syncNow(),
  'copy-sql': () => copySQL(),
  'toggle-sound': () => {
    S.settings.sound = !S.settings.sound;
    applySettings(); persist(); syncDrawerInputs();
    Sound.play(S.settings.sound ? 'on' : 'off');
    toast(S.settings.sound ? 'Sounds on' : 'Sounds muted', 'ok', S.settings.sound ? 'vol' : 'volx');
  },
  'open-settings': () => { $('#account-menu').hidden = true; openSettings(); },
  'close-settings': () => closeSettings(),
  'open-search': () => openSearch(),
  'close-search': () => closeSearch(),
  'open-palette': () => openPalette(),
  'close-palette': () => closePalette(),
  'open-about': () => openAbout(),
  'open-controls': () => openControls(),
  'close-controls': () => closeControls(),
  'coach-dismiss': () => { S.coachSeen = true; persist(); $('#coach')?.remove(); Sound.play('tap'); },
  theme: t => { S.settings.theme = t.dataset.v; applySettings(); persist(); Sound.play('pop'); },
  'font-up': () => {
    S.settings.fontScale = clamp(+(S.settings.fontScale + .1).toFixed(2), .8, 1.6);
    applySettings(); persist(); syncControlsUI(); syncDrawerInputs(); Sound.play('tap');
  },
  'font-down': () => {
    S.settings.fontScale = clamp(+(S.settings.fontScale - .1).toFixed(2), .8, 1.6);
    applySettings(); persist(); syncControlsUI(); syncDrawerInputs(); Sound.play('tap');
  },
  lang: t => setLang(t.dataset.v),
  'lang-cycle': () => setLang(TRANSS[(TRANSS.indexOf(S.settings.trans) + 1) % TRANSS.length]),
  'reveal-all': () => setAllMeanings(true),
  'hide-all': () => setAllMeanings(false),
  'reveal-toggle': () => toggleAllMeanings(),
  'mark-chapter': () => markSection(currentChapterId()),
  focus: () => {
    closeControls(true);
    if (VIEW !== 'read') { navigate('read'); setTimeout(() => H.focus(), 240); return; }
    document.body.classList.toggle('focus');
    Sound.play(document.body.classList.contains('focus') ? 'open' : 'close');
  },
  autoscroll: () => toggleAutoScroll(),
  'seg-read': t => setRead(t.dataset.id, !S.read[+t.dataset.id]),
  'seg-bm': t => toggleBookmark(t.dataset.id),
  'seg-note': t => openNote(t.dataset.id),
  'seg-copy': t => copySeg(t.dataset.id),
  'seg-play': t => {
    const id = +t.dataset.id;
    if (TTS.id === id) { TTS.stop(); Sound.play('tap'); }
    else TTS.speak(id);
  },
  'sec-read': t => markSection(t.dataset.sec),
  'lib-tab': t => { libTab = t.dataset.v; rerenderPreserving(); Sound.play('tap'); },
  'bm-remove': t => { toggleBookmark(t.dataset.id); rerenderPreserving(); },
  'note-edit': t => openNote(t.dataset.id),
  'note-del-lib': t => {
    delete S.notes[+t.dataset.id];
    persist(); rerenderPreserving(); Sound.play('tap');
    toast('Note removed', 'ok', 'trash');
  },
  'note-save': t => saveNote(t.dataset.id),
  'note-del': t => {
    delete S.notes[+t.dataset.id];
    persist(); refreshSeg(+t.dataset.id); closeModal();
    Sound.play('tap'); toast('Note removed', 'ok', 'trash');
    if (VIEW === 'library') rerenderPreserving();
  },
  export: () => { $('#account-menu').hidden = true; exportData(); },
  import: () => $('#import-file').click(),
  'reset-data': () => resetData(),
  'modal-close': () => closeModal(),
  'confirm-ok': () => {
    const r = modalResolve;
    modalResolve = null;
    $('#modal-root').innerHTML = '';
    Sound.play('close');
    r && r(true);
  },
  retry: () => location.reload(),
  'word-close': () => closeWord(),
  'word-ai': () => explainWord(),
  'ai-key-save': () => {
    const v = cleanKey($('#ai-key')?.value || '');
    if (!v) { toast('Paste your OpenRouter key first', 'warn', 'lock'); return; }
    if (!AI.keyValid(v)) {
      toast(/^sk-or-/.test(v)
        ? 'That key has stray characters (line breaks, quotes, spaces) — copy it again on one line'
        : 'That does not look like an OpenRouter key (sk-or-…)', 'warn', 'alert');
      return;
    }
    if (!AI.setKey(v)) { toast('This browser blocks local storage', 'err', 'alert'); return; }
    $('#ai-key').value = '';
    DIAG = null;
    renderAIModels(); Sound.play('success');
    toast('Key saved on this device only', 'ok', 'lock');
  },
  'ai-key-clear': () => {
    AI.setKey('');
    const inp = $('#ai-key'); if (inp) inp.value = '';
    renderAIModels(); Sound.play('tap');
    toast('Key removed', 'ok', 'trash');
  },
  'ai-base-save': () => {
    const v = ($('#ai-base')?.value || '').trim().replace(/\/+$/, '');
    if (v && !/^https?:\/\/[^\s]+$/i.test(v)) { toast('Use a full http(s) URL, e.g. https://openrouter.ai/api/v1', 'warn', 'alert'); return; }
    if (!AI.setBase(v)) { toast('This browser blocks local storage', 'err', 'alert'); return; }
    try { localStorage.removeItem(AI_CAT_LS); } catch {}
    renderAIModels();
    const line = $('#ai-testline'); if (line) { line.className = ''; line.textContent = ''; line.title = ''; }
    const rb = $('#ai-testraw'); if (rb) rb.hidden = true;
    Sound.play('success');
    toast(v ? 'Using ' + AI.host() : 'Back to the default endpoint', 'ok', 'check');
  },
  'ai-test': async () => {
    const btn = $('#ai-test-btn'), line = $('#ai-testline');
    const rawBox = $('#ai-testraw'), rawPre = $('#ai-testraw-pre');
    if (line) { line.className = ''; line.title = ''; line.textContent = 'Testing ' + AI.host() + '…'; }
    if (rawBox) rawBox.hidden = true;
    if (btn) btn.disabled = true;
    const d = await AI.diag({ chat: true });
    const ok = !!(d.models && d.models.ok && (!d.auth || d.auth.ok) && (!d.chat || d.chat.ok));
    if (btn) btn.disabled = false;
    if (line) {
      line.className = ok ? 'ok' : 'bad';
      line.textContent = AI.diagMsg(d);
      line.title = (d.chat && d.chat.raw) || '';
    }
    if (rawBox && rawPre) {
      const raw = (d.chat && d.chat.raw) || (d.auth && d.auth.raw) || (d.models && d.models.raw) || '';
      rawBox.hidden = !raw || ok;
      rawPre.textContent = raw;
    }
    Sound.play(ok ? 'success' : 'error');
  },
  'ai-deep': t => {
    S.ai.deep = !!t.checked;
    persist(); renderAIModels();
    Sound.play('tap');
    toast(S.ai.deep ? 'Deep reasoning on — slower, shows the model\u2019s thinking' : 'Deep reasoning off', 'ok', 'spark');
  },
  'ai-add': () => openModelPicker(),
  'ai-active': () => Sound.play('tap'),
  'ai-activate': t => {
    S.ai.active = t.dataset.id;
    const m = AI.list().find(x => x.id === t.dataset.id);
    if (m) m.enabled = true;
    persist(); renderAIModels(); Sound.play('pop');
  },
  'ai-toggle': t => {
    const m = AI.list().find(x => x.id === t.dataset.id);
    if (!m) return;
    m.enabled = m.enabled === false;
    if (m.enabled === false && S.ai.active === m.id) {
      const alt = AI.list().find(x => x.enabled !== false);
      S.ai.active = alt ? alt.id : null;
    }
    persist(); renderAIModels(); Sound.play('tap');
  },
  'ai-del': async t => {
    const m = AI.list().find(x => x.id === t.dataset.id);
    if (!m) return;
    const ok = await confirmBox({ title: 'Delete model?', body: `Remove ${m.name || m.id} from your list?`, ok: 'Delete', danger: true });
    if (!ok) return;
    S.ai.models = AI.list().filter(x => x.id !== m.id);
    if (S.ai.active === m.id) { const alt = AI.list().find(x => x.enabled !== false); S.ai.active = alt ? alt.id : null; }
    persist(); renderAIModels(); renderPick($('#ai-pick-q')?.value || '');
    Sound.play('tap'); toast('Model removed', 'ok', 'trash');
  },
  'ai-pick': t => {
    const m = PICK.find(x => x.id === t.dataset.id) || { id: t.dataset.id, name: t.dataset.id };
    addModel(m);
  },
  'ai-manual-add': () => {
    const id = ($('#ai-manual')?.value || '').trim();
    if (!id.includes('/')) { toast('A model id looks like owner/model', 'warn', 'alert'); return; }
    const known = PICK.find(x => x.id === id);
    addModel(known || { id, name: id, free: /:free$/.test(id) });
    if ($('#ai-manual')) $('#ai-manual').value = '';
  }
};
const SELF_SOUND = new Set([
  'seg-read', 'seg-bm', 'seg-play', 'seg-note', 'seg-copy', 'note-edit', 'note-save', 'note-del', 'bm-remove', 'note-del-lib',
  'toggle-sound', 'theme', 'font-up', 'font-down', 'lang', 'lang-cycle', 'reveal-all', 'hide-all', 'reveal-toggle',
  'focus', 'autoscroll', 'modal-close', 'confirm-ok', 'close-search', 'close-palette', 'close-settings', 'close-auth',
  'close-controls', 'open-search', 'open-palette', 'open-settings', 'open-about', 'open-auth', 'open-controls',
  'lib-tab', 'export', 'resend', 'auth-tab', 'eye', 'sec-read', 'account', 'continue', 'begin', 'daily', 'jump',
  'nav', 'reset-data', 'coach-dismiss', 'copy-sql', 'sync-info', 'sync-now', 'mark-chapter',
  'word-close', 'word-ai', 'ai-add', 'ai-active', 'ai-activate', 'ai-toggle', 'ai-del', 'ai-pick',
  'ai-key-save', 'ai-key-clear', 'ai-manual-add', 'ai-base-save', 'ai-test', 'ai-deep'
]);

/* ═══════════ EVENTS ═══════════ */
const isOpen = sel => !!$(sel)?.classList.contains('open');
const anyOverlay = () => isOpen('#palette') || isOpen('#search-overlay') || isOpen('#auth-modal') ||
  isOpen('#controls') || !!$('#modal-root').innerHTML;

document.addEventListener('click', e => {
  const wd = e.target.closest('.seg .w');
  if (wd) { openWord(wd); return; }
  const pal = e.target.closest('[data-pal]');
  if (pal) { palRun(+pal.dataset.pal); return; }
  const t = e.target.closest('[data-action]');
  if (!t) {
    if (!e.target.closest('#account-menu') && !e.target.closest('#btn-account')) {
      const menu = $('#account-menu');
      if (menu) menu.hidden = true;
    }
    const seg = e.target.closest('.seg');
    if (seg && VIEW === 'read' && !String(window.getSelection?.() || '')) toggleSegTrans(seg);
    return;
  }
  const a = t.dataset.action;
  if (!SELF_SOUND.has(a)) Sound.play('tap');
  if (H[a]) H[a](t, e);
});

let hoverAt = 0;
document.addEventListener('mouseover', e => {
  if (!e.target.closest('.btn, .icon-btn, .rail-btn, .chip, .sq, .ctl-btn, .quick button, .lang-chip')) return;
  const now = Date.now();
  if (now - hoverAt > 90) { hoverAt = now; Sound.play('hover'); }
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.ctl === 'speed') { AS.speed = +t.value; syncControlsUI(); return; }
  if (t.dataset.ctl === 'auto') { toggleAutoScroll(); return; }
  if (t.id === 'search-input') { doSearch(t.value); return; }
  if (t.id === 'palette-input') { renderPalette(t.value); return; }
  if (t.id === 'ai-pick-q') { renderPick(t.value); return; }
  const k = t.dataset.set;
  if (!k) return;
  const v = t.type === 'checkbox' ? t.checked
    : (t.type === 'range' || t.type === 'number') ? parseFloat(t.value)
    : t.value;
  S.settings[k] = v;
  clampSettings();
  applySettings(); persist(); syncControlsUI(); syncDrawerInputs();
  if (k === 'volume') Sound.play('tap');
  if (k === 'sound') Sound.play(S.settings.sound ? 'on' : 'off');
  if (k === 'trans') { rerenderPreserving(); const el = $('#lang-short'); if (el) el.textContent = TRANS_SHORT[S.settings.trans]; syncControlsUI(); }
  if (k === 'goal' && VIEW !== 'read') rerenderPreserving();
});

document.addEventListener('change', e => {
  if (e.target.id === 'reader-sec') {
    $('#' + e.target.value)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
});

['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { lastActive = Date.now(); }, { passive: true }));
document.addEventListener('pointerdown', () => { if (S.settings.ambient && S.settings.sound) Ambient.sync(); }, { once: true });
addEventListener('pagehide', persistLocal);
document.addEventListener('visibilitychange', () => { if (document.hidden) persistLocal(); });
addEventListener('online', () => { if (session && !syncBlocked) syncNow(); });

document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    isOpen('#palette') ? closePalette() : openPalette();
    return;
  }
  if (e.key === 'Escape') {
    if (WORD) { closeWord(); return; }
    if ($('#modal-root').innerHTML) closeModal();
    else if (isOpen('#controls')) closeControls();
    else if (isOpen('#palette')) closePalette();
    else if (isOpen('#search-overlay')) closeSearch();
    else if (isOpen('#auth-modal')) closeAuth();
    else if (document.body.classList.contains('drawer-open')) closeSettings();
    else if (!$('#account-menu').hidden) $('#account-menu').hidden = true;
    else if (document.body.classList.contains('focus')) H.focus();
    return;
  }
  if (isOpen('#palette')) {
    if (e.key === 'ArrowDown') { e.preventDefault(); palMove(1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); palMove(-1); }
    if (e.key === 'Enter') { e.preventDefault(); palRun(); }
    return;
  }
  if (isOpen('#search-overlay')) {
    if (e.key === 'Enter') { e.preventDefault(); $('#search-results .ov-item')?.click(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = $$('#search-results .ov-item');
      if (!items.length) return;
      let i = items.findIndex(x => x.classList.contains('kactive'));
      i = clamp(i + (e.key === 'ArrowDown' ? 1 : -1), 0, items.length - 1);
      items.forEach((x, j) => x.classList.toggle('kactive', j === i));
      items[i].scrollIntoView({ block: 'nearest' });
    }
    return;
  }
  if (typing || anyOverlay()) return;
  const k = e.key;
  if (k === '/') { e.preventDefault(); openSearch(); return; }
  if (k === '?') { openAbout(); return; }
  if (k.toLowerCase() === 'm') { H['toggle-sound'](); return; }
  if (k.toLowerCase() === 'c') { isOpen('#controls') ? closeControls() : openControls(); return; }
  if (['1', '2', '3', '4'].includes(k)) { navigate(NAV_ORDER[+k - 1]); return; }
  if (VIEW !== 'read') return;
  if ((k === 'Enter' || k === ' ') && e.target.classList?.contains('seg')) {
    e.preventDefault(); toggleSegTrans(e.target); return;
  }
  if (k.toLowerCase() === 't' && S.last != null) toggleSegTrans($('#seg-' + S.last));
  if (k.toLowerCase() === 'f') H.focus();
  if (k.toLowerCase() === 'a') toggleAutoScroll();
  if (k === '+' || k === '=') H['font-up']();
  if (k === '-') H['font-down']();
  if (k.toLowerCase() === 'b' && S.last != null) toggleBookmark(S.last);
  if (k.toLowerCase() === 'r' && S.last != null) setRead(S.last, !S.read[S.last]);
  if (k === 'ArrowRight' || k === 'ArrowLeft') {
    e.preventDefault();
    const ids = SEGS.map(s => s.id);
    const cur = S.last != null ? ids.indexOf(S.last) : 0;
    const i = clamp((cur < 0 ? 0 : cur) + (k === 'ArrowRight' ? 1 : -1), 0, ids.length - 1);
    $('#seg-' + ids[i])?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
});

let timeTick = 0;
setInterval(() => {
  if (VIEW === 'read' && document.visibilityState === 'visible' && Date.now() - lastActive < 90000) {
    act().s += 5;
    persistLocal();
    if (++timeTick % 12 === 0) syncSoon();
  }
}, 5000);

/* ═══════════ BOOT ═══════════ */
async function init() {
  const bn = $('#build-n');
  if (bn) bn.textContent = BUILD;
  try { history.scrollRestoration = 'manual'; } catch {}

  applySettings();
  FX.init();
  bindAuthForms();
  bindImport();
  addEventListener('hashchange', () => { closeWord(true); render(); });
  addEventListener('resize', () => closeWord(true));
  addEventListener('scroll', e => {
    if (!WORD) return;
    if (e.target instanceof Element && e.target.closest('#word-pop')) return;
    closeWord(true);
  }, { passive: true, capture: true });
  document.addEventListener('pointerdown', e => {
    if (!WORD) return;
    if (e.target.closest('#word-pop') || e.target.closest('.seg .w')) return;
    closeWord(true);
  }, true);

  if ('speechSynthesis' in window) {
    speechSynthesis.getVoices();
    speechSynthesis.addEventListener?.('voiceschanged', () => speechSynthesis.getVoices());
  }

  try { await loadData(); }
  catch (err) {
    const msg = $('#boot-msg');
    if (msg) msg.innerHTML = `Could not load <b>data/estighfar.json</b> (${esc(err.message)}).<br>Serve this folder over HTTP, for example <kbd>python3 -m http.server</kbd>`;
    const bar = $('.boot-bar');
    if (bar) bar.style.display = 'none';
    $('.boot-inner')?.insertAdjacentHTML('beforeend', `<button class="btn primary" data-action="retry">${ic('rotate')}Retry</button>`);
    return;
  }

  sanitize();
  if (!location.hash) history.replaceState(null, '', '#/read');
  render();
  updateAccountUI();

  $('#boot')?.classList.add('done');
  setTimeout(() => $('#boot')?.remove(), 700);

  if (session) {
    if (session.expires_at * 1000 < Date.now() + 60000) await tryRefresh();
    if (session) { scheduleRefresh(); afterAuth(); }
  } else setSync('off');

  checkAch();
  console.log(`%c۞ Nūr v${BUILD} — tap any verse to unfold its meaning.`, 'color:#e6b95c;font-size:13px');
}

init();

})();
