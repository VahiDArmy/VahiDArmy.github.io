/* core.js — client, state, auth, prefs, sound, UI primitives */
export const CFG = {
  url: 'https://nvmevqkaovazhmoznusf.supabase.co',
  key: 'sb_publishable_AuneSCRLhrKKDeK8q7kJtw_Bg4VNHgE',
  app: 'ماتریس ۳بعدی',
  pageSize: 1000,
};

export const sb = window.supabase.createClient(CFG.url, CFG.key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'mx3.auth' },
  global: { headers: { 'x-application-name': 'matrix3d' } },
  realtime: { params: { eventsPerSecond: 8 } },
});

export const state = {
  session: null,
  user: null,
  profile: null,
  guest: false,
  ready: false,
  people: [],
  traits: [],
  scores: [],
  comments: [],
  disputes: [],
  sessions: [],
  views: [],
  relations: [],
  aiRuns: [],
  prefs: {},
  peopleMap: new Map(),
  traitMap: new Map(),
  scoreKey: new Map(), // trait|ranker|target -> score
  route: 'matrix',
  online: navigator.onLine,
  lastSync: null,
};

export const listeners = new Set();
export function emit(evt, data) { for (const fn of listeners) { try { fn(evt, data); } catch (e) { console.warn(e); } } }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/* ---------- tiny dom / format utils ---------- */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const icon = (name, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
export const uid = () => crypto.randomUUID();
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const debounce = (fn, ms = 220) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
export const fa = (v) => String(v ?? '').replace(/\d/g, (d) => FA_DIGITS[+d]);
export const faNum = (n, digits = 0) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  const num = Number(n);
  const s = Number.isInteger(num) && digits === 0 ? String(num) : num.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
  return fa(s.replace('.', '٫'));
};
export const pct = (n) => `${fa(Math.round(n * 100))}٪`;
export const initials = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '؟';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] || '') + (parts[parts.length - 1][0] || '');
};
export const avatarColor = (seed = '') => {
  let h = 0; for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 62% 58%)`;
};
export function timeAgo(iso) {
  if (!iso) return '—';
  const d = new Date(iso); const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 45) return 'همین حالا';
  if (diff < 3600) return `${fa(Math.floor(diff / 60))} دقیقه پیش`;
  if (diff < 86400) return `${fa(Math.floor(diff / 3600))} ساعت پیش`;
  if (diff < 2592000) return `${fa(Math.floor(diff / 86400))} روز پیش`;
  try { return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(d); } catch { return d.toLocaleDateString(); }
}
export const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
export function download(name, text, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- sound + haptics ---------- */
const Snd = (() => {
  let ctx = null;
  const ensure = () => {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; } }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const vol = () => {
    const p = state.prefs || {};
    if (p.sound === false) return 0;
    return Number.isFinite(p.volume) ? p.volume : 0.5;
  };
  function tone(freq, dur, type = 'sine', amp = 0.12, when = 0, glide = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t0);
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + glide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp), t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ctx.destination); osc.start(t0); osc.stop(t0 + dur + .02);
  }
  function noise(dur, freq, amp = .06) {
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 1.4;
    const g = ctx.createGain(); g.gain.value = amp;
    src.connect(bp).connect(g).connect(ctx.destination); src.start();
  }
  return {
    tick() { const v = vol(); if (!v) return; ensure(); tone(980, .035, 'triangle', .03 * v); },
    tap() { const v = vol(); if (!v) return; ensure(); tone(520, .05, 'sine', .05 * v, 0, -180); },
    clink() { // two glasses
      const v = vol(); if (!v) return; ensure();
      tone(2140, .28, 'sine', .10 * v); tone(3180, .22, 'sine', .06 * v, .002);
      tone(4720, .16, 'sine', .03 * v, .004); noise(.05, 5200, .05 * v);
    },
    clink2() { const v = vol(); if (!v) return; ensure(); tone(1980, .3, 'sine', .10 * v); tone(2640, .24, 'sine', .07 * v, .07); tone(3960, .2, 'sine', .04 * v, .075); noise(.06, 4200, .05 * v); },
    swoosh() { const v = vol(); if (!v) return; ensure(); noise(.16, 900, .05 * v); tone(320, .18, 'sine', .04 * v, 0, 320); },
    err() { const v = vol(); if (!v) return; ensure(); tone(180, .16, 'square', .05 * v, 0, -60); tone(120, .2, 'sawtooth', .035 * v, .05); },
    save() { const v = vol(); if (!v) return; ensure(); tone(880, .1, 'sine', .06 * v); tone(1320, .15, 'sine', .05 * v, .07); },
    drop() { const v = vol(); if (!v) return; ensure(); tone(240, .12, 'sine', .06 * v, 0, 140); noise(.08, 1800, .04 * v); },
    start() { const v = vol(); if (!v) return; ensure(); [523, 659, 784].forEach((f, i) => tone(f, .18, 'sine', .05 * v, i * .06)); },
    toggle(on) { const v = vol(); if (!v) return; ensure(); tone(on ? 1320 : 660, .09, 'triangle', .05 * v); },
  };
})();

export function play(name) {
  if (state.prefs?.sound === false) return;
  try { Snd[name]?.(); } catch { /* audio blocked */ }
}
export function haptic(pattern = 12) {
  if (state.prefs?.haptics === false) return;
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}
export function bump(strong = false) { play(strong ? 'clink' : 'tick'); haptic(strong ? [8, 26, 8] : 8); }

/* ---------- prefs ---------- */
export const DEFAULT_PREFS = {
  accent: 'aqua', sound: true, volume: 0.45, haptics: true, density: 'comfortable',
  scoreStep: 0.5, defaultMode: 'trait', confirmDelete: true, showLabels: true,
  heat: 'spectrum', privacy: false, autoSave: true, showGrid: true, defaultView: 'matrix',
  maxStackLayers: 21, aiModel: '', aiTemp: 0.7, aiReasoning: 'medium', aiSystem: '',
};

export function applyPrefs(p = {}) {
  const root = document.documentElement;
  root.dataset.accent = p.accent || 'aqua';
  root.dataset.density = p.density || 'comfortable';
  document.getElementById('btn-sound')?.classList.toggle('is-on', p.sound !== false);
}
export function getPrefs() { return { ...DEFAULT_PREFS, ...(state.prefs || {}) }; }
export async function savePrefs(patch) {
  state.prefs = { ...getPrefs(), ...patch };
  applyPrefs(state.prefs);
  try { localStorage.setItem('mx3.prefs', JSON.stringify(state.prefs)); } catch { /* ignore */ }
  if (state.user) {
    await sb.from('mtx_prefs').upsert({ user_id: state.user.id, prefs: state.prefs, updated_at: new Date().toISOString() });
  }
  emit('prefs', state.prefs);
}
export function loadLocalPrefs() {
  try { state.prefs = { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem('mx3.prefs') || '{}') }; } catch { state.prefs = { ...DEFAULT_PREFS }; }
  applyPrefs(state.prefs);
}

/* ---------- auth ---------- */
export const roleOf = () => String(state.profile?.role || 'member');
export const isAdmin = () => ['admin', 'owner', 'super_admin', 'moderator'].includes(roleOf());
export const isAuthenticated = () => !!state.user;
export const canEdit = () => !!state.user;
export const isMinePerson = (personId) => !!state.people.find((p) => p.id === personId && p.user_id === state.user?.id);
export const canEditPerson = (p) => !!state.user && (isAdmin() || p.created_by === state.user.id || p.user_id === state.user.id);
export const canEditTrait = (t) => !!state.user && (isAdmin() || !t.owner_id || t.owner_id === state.user.id);
export const canEditScore = (s) => !!state.user && (isAdmin() || s.created_by === state.user.id || isMinePerson(s.ranker_person_id));

export async function loadProfile() {
  if (!state.user) { state.profile = null; return null; }
  const { data, error } = await sb.from('profiles').select('*').eq('id', state.user.id).maybeSingle();
  if (error) { state.profile = null; return null; }
  if (!data) {
    const meta = state.user.user_metadata || {};
    const row = { id: state.user.id, display_name: meta.display_name || state.user.email?.split('@')[0] || 'کاربر' };
    await sb.from('profiles').upsert(row).then(() => {});
    state.profile = row;
  } else state.profile = data;
  return state.profile;
}

export async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
export async function signUp(email, password, displayName) {
  const { data, error } = await sb.auth.signUp({ email, password, options: { data: { display_name: displayName } } });
  if (error) throw error;
  return data;
}
export async function signOut() {
  try { await sb.auth.signOut(); } catch { /* ignore */ }
  state.session = null; state.user = null; state.profile = null; state.guest = false;
  sessionStorage.removeItem('mx3.guest');
}

/* ---------- toast / modal / confirm ---------- */
export function toast(message, kind = 'info', ms = 2600) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const ic = { ok: 'check', err: 'x', warn: 'flag', info: 'spark' }[kind] || 'spark';
  const node = document.createElement('div');
  node.className = `toast toast--${kind}`;
  node.innerHTML = `${icon(ic)}<span>${esc(message)}</span>`;
  root.appendChild(node);
  setTimeout(() => { node.classList.add('is-out'); setTimeout(() => node.remove(), 200); }, ms);
}

export function openModal({ title, body = '', foot = '', wide = false, slim = false, onMount, onClose }) {
  const root = document.getElementById('modal-root');
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal ${wide ? 'modal--wide' : ''} ${slim ? 'modal--slim' : ''}" role="dialog" aria-modal="true">
    <div class="modal__head"><h3>${esc(title)}</h3><div class="spacer"></div>
      <button class="iconbtn" data-close title="بستن">${icon('x')}</button></div>
    <div class="modal__body">${body}</div>
    ${foot ? `<div class="modal__foot">${foot}</div>` : ''}
  </div>`;
  root.appendChild(back);
  const close = () => { back.remove(); onClose?.(); };
  back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-close]')) close(); });
  const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
  const node = back.querySelector('.modal');
  onMount?.(node, close);
  setTimeout(() => node.querySelector('input:not([type=hidden]),textarea,select')?.focus(), 60);
  return { node, close };
}

export function confirmDialog({ title = 'تأیید', text = '', danger = false, okText = 'تأیید' } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const { close } = openModal({
      title, slim: true,
      body: `<p style="font-size:12.5px;line-height:1.9;color:var(--ink-2)">${esc(text)}</p>`,
      foot: `<div class="spacer"></div><button class="btn" data-close>انصراف</button>
             <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-ok>${esc(okText)}</button>`,
      onMount(node, closeFn) {
        node.querySelector('[data-ok]').onclick = () => { done = true; resolve(true); closeFn(); };
        node.addEventListener('click', (e) => { if (!done && (e.target === node.parentElement || e.target.closest('[data-close]'))) resolve(false); });
      },
      onClose() { if (!done) resolve(false); },
    });
    void close;
  });
}

/* ---------- error helper ---------- */
export function errMsg(error) {
  if (!error) return 'خطای نامشخص';
  const m = error.message || error.error_description || String(error);
  if (/row-level security|permission denied|42501/i.test(m)) return 'دسترسی نوشتن ندارید (RLS) — با حساب مجاز وارد شوید';
  if (/duplicate key|unique/i.test(m)) return 'این مقدار تکراری است';
  if (/JWT|token|session/i.test(m)) return 'نشست منقضی شده — دوباره وارد شوید';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'اتصال به سرور برقرار نشد';
  return m.slice(0, 160);
}
