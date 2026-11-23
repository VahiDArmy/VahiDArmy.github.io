/* app.js — bootstrap, auth gate, router, command palette */
import {
  sb, state, CFG, $, $$, esc, icon, fa, faNum, pct, toast, confirmDialog, openModal,
  applyPrefs, loadLocalPrefs, getPrefs, savePrefs, signIn, signUp, signOut, loadProfile,
  play, haptic, subscribe, errMsg, isAdmin, timeAgo, initials,
} from './core.js';
import { loadAll, subscribeRealtime, setSync, loadUserPrefs } from './data.js';

const ROUTES = {
  dashboard: () => import('./views/dashboard.js'),
  matrix: () => import('./matrix.js'),
  people: () => import('./views/people.js'),
  traits: () => import('./views/traits.js'),
  deck: () => import('./views/deck.js'),
  ai: () => import('./ai.js'),
  admin: () => import('./views/admin.js'),
  settings: () => import('./views/settings.js'),
};
const TITLES = { dashboard: 'داشبورد', matrix: 'ماتریس', people: 'افراد', traits: 'ویژگی‌ها', deck: 'دسته کارت', ai: 'هوش', admin: 'مدیریت', settings: 'تنظیمات' };

let currentMod = null;
let booted = false;

/* ---------- boot ---------- */
(async function boot() {
  loadLocalPrefs();
  bindChrome();
  let session = null;
  try {
    const { data } = await sb.auth.getSession();
    session = data?.session || null;
  } catch { session = null; }
  if (session) {
    state.session = session; state.user = session.user;
    try { await loadProfile(); } catch { /* offline */ }
    await enterApp();
  } else if (sessionStorage.getItem('mx3.guest') === '1') {
    state.guest = true;
    await enterApp({ guest: true });
  } else {
    showAuth();
  }
  sb.auth.onAuthStateChange(async (evt, sess) => {
    if (evt === 'SIGNED_OUT') {
      state.session = null; state.user = null; state.profile = null;
      document.getElementById('app').hidden = true;
      showAuth();
    }
  });
  window.addEventListener('online', () => { state.online = true; setSync('ok', 'آنلاین'); });
  window.addEventListener('offline', () => { state.online = false; setSync('off', 'آفلاین'); });
})();

function showAuth() {
  const auth = $('#auth');
  auth.hidden = false;
  $('#app').hidden = true;
  const card = $('.auth__card');
  if (card) card.scrollTop = 0;
  auth.scrollTop = 0;
  $('#auth-email')?.focus({ preventScroll: true });
}

async function enterApp({ guest = false } = {}) {
  $('#auth').hidden = true;
  $('#app').hidden = false;
  state.guest = guest;
  renderIdentity();
  try {
    if (!guest) await loadUserPrefs();
    await loadAll({ quiet: true });
  } catch (err) {
    console.warn('[enterApp] load', err);
  }
  paintStats();
  if (!guest && state.user && state.scores.length && !state.people.length && sessionStorage.getItem('mx3.rlsWarn') !== '1') {
    sessionStorage.setItem('mx3.rlsWarn', '1');
    toast('افراد قابل خواندن نیستند؛ سیاست RLS جدول people را بررسی کنید', 'warn', 5200);
  }
  if (!guest) {
    try { subscribeRealtime(debounceRealtime); } catch (err) { console.warn('[enterApp] realtime', err); }
    logPresence();
  }
  const hash = (location.hash || '').replace('#', '');
  const start = ROUTES[hash] ? hash : 'matrix';
  try { await navigate(start, { silent: true }); } catch (err) { console.warn('[enterApp] navigate', err); }
}

function renderIdentity() {
  const name = state.profile?.display_name || state.user?.user_metadata?.display_name || state.user?.email?.split('@')[0] || 'مهمان';
  const role = state.user ? (isAdmin() ? 'مدیر' : 'عضو') : 'فقط خواندن';
  const mail = state.user?.email || 'بدون حساب';
  const av = state.profile?.avatar_url;
  const ini = initials(name);
  $('#rail-name').textContent = name;
  $('#rail-role').textContent = role;
  $('#top-name').textContent = name;
  $('#top-mail').textContent = mail;
  for (const id of ['rail-avatar', 'top-avatar']) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.innerHTML = av ? `<img src="${esc(av)}" alt="">` : esc(ini);
  }
  const guestOnly = $$('.only-guest');
  guestOnly.forEach((el) => { el.hidden = !!state.user; });
  $('#btn-logout').style.display = state.user ? 'grid' : 'none';
  $('#rail-user').title = mail;
  document.querySelectorAll('[data-route=admin]').forEach((el) => { el.style.display = state.user ? '' : 'none'; });
}

/* ---------- chrome ---------- */
function bindChrome() {
  $('#nav').addEventListener('click', (e) => {
    const b = e.target.closest('[data-route]'); if (!b) return;
    navigate(b.dataset.route);
  });
  $('#btn-menu')?.addEventListener('click', () => $('#rail').classList.toggle('is-open'));
  $('#btn-refresh').onclick = async () => { play('tap'); await loadAll(); paintStats(); rerender(true); toast('همگام شد', 'ok', 1500); };
  $('#btn-logout').onclick = async () => {
    if (!state.user) return;
    const ok = await confirmDialog({ title: 'خروج', text: 'از حساب خارج می‌شوید؟', okText: 'خروج' });
    if (!ok) return;
    await signOut(); play('drop');
    document.getElementById('app').hidden = true; showAuth();
  };
  $('#btn-login').onclick = () => showAuth();
  $('#btn-sound').onclick = async () => {
    const p = getPrefs(); await savePrefs({ sound: !(p.sound !== false) });
    $('#btn-sound').classList.toggle('is-on', getPrefs().sound !== false);
    if (getPrefs().sound) play('clink2');
  };
  $('#btn-ai').onclick = () => toggleAiDock();
  $('#btn-palette').onclick = openPalette;
  previewAuthForm();
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
    if (e.key === 'Escape') { closePalette(); closeAiDock(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); toggleAiDock(); }
  });
}

function previewAuthForm() {
  let mode = 'login';
  const form = $('#auth-form');
  const msg = $('#auth-msg');
  const nameWrap = $('.auth__name');
  const nameInput = $('#auth-name');
  const submit = $('#auth-submit');
  const syncMode = () => {
    const login = mode === 'login';
    nameWrap.hidden = login;
    nameInput.required = !login;
    submit.textContent = login ? 'ورود به ماتریس' : 'ساخت حساب';
    $('#auth-pass').autocomplete = login ? 'current-password' : 'new-password';
    msg.hidden = true;
  };
  syncMode();
  $$('.auth__tab').forEach((tab) => tab.onclick = () => {
    mode = tab.dataset.authtab;
    $$('.auth__tab').forEach((t) => t.classList.toggle('is-on', t === tab));
    syncMode();
    $('#auth-form').scrollIntoView?.({ block: 'nearest' });
    play('tap');
  });
  const showMsg = (text, ok = false) => { msg.hidden = false; msg.textContent = text; msg.classList.toggle('is-ok', ok); };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#auth-email').value.trim();
    const pass = $('#auth-pass').value;
    const name = $('#auth-name').value.trim();
    submit.disabled = true; const old = submit.textContent; submit.innerHTML = '…'; msg.hidden = true;
    try {
      if (mode === 'signup') {
        const res = await signUp(email, pass, name || email.split('@')[0]);
        if (!res.session) {
          showMsg('حساب ساخته شد. اگر تأیید ایمیل فعال باشد، ایمیل خود را بررسی کنید.', true);
          submit.disabled = false; submit.textContent = old; return;
        }
      } else {
        await signIn(email, pass);
      }
      const sess = (await sb.auth.getSession()).data.session;
      if (!sess?.user) throw new Error('نشست ساخته نشد — ایمیل یا گذرواژه را بررسی کنید');
      state.session = sess; state.user = sess.user;
      await loadProfile();
      play('clink2'); haptic([10, 30, 10]);
      await enterApp();
    } catch (err) {
      showMsg(errMsg(err)); play('err'); haptic(30);
      submit.disabled = false; submit.textContent = old;
      console.warn('[auth]', err);
    }
  });
  $('#auth-guest').onclick = async (ev) => {
    const btn = ev.currentTarget;
    btn.disabled = true;
    sessionStorage.setItem('mx3.guest', '1');
    state.guest = true; play('tap');
    try {
      await enterApp({ guest: true });
    } catch (err) {
      console.warn('[guest]', err);
      state.guest = false;
      sessionStorage.removeItem('mx3.guest');
      toast('ورود مهمان ممکن نشد — دوباره تلاش کنید', 'err');
    } finally {
      btn.disabled = false;
    }
  };
}

/* ---------- router ---------- */
export async function navigate(route, { silent = false } = {}) {
  if (!ROUTES[route]) route = 'matrix';
  state.route = route;
  document.querySelectorAll('#nav .navitem').forEach((b) => b.classList.toggle('is-on', b.dataset.route === route));
  if (!silent) history.replaceState(null, '', `#${route}`);
  location.hash = route;
  if (!silent) play('tap');
  $('#rail').classList.remove('is-open');
  await rerender();
  $('#view').scrollTop = 0;
  $('#view').focus({ preventScroll: true });
}

async function rerender(keep = false) {
  const host = $('#view');
  try { host._cleanup?.(); host._cleanup = null; host.onkeydown = null; } catch { /* ignore */ }
  document.onkeydown = null;
  const mod = await ROUTES[state.route]();
  currentMod = mod;
  try {
    if (mod.renderMatrix && state.route === 'matrix') mod.renderMatrix(host);
    else await mod.render(host, { keep });
  } catch (err) {
    console.error(err);
    host.innerHTML = `<div class="empty">${icon('alert')} خطا در نمایش: ${esc(errMsg(err))}</div>`;
  }
  paintStats();
  renderIdentity();
}

export function currentRoute() { return state.route; }

function debounceRealtime() {
  if (state._rtTimer) clearTimeout(state._rtTimer);
  state._rtTimer = setTimeout(async () => {
    await loadAll({ quiet: true });
    paintStats();
    if (['matrix', 'dashboard', 'people', 'traits'].includes(state.route)) await rerender(true);
  }, 1400);
}

async function logPresence() {
  if (sessionStorage.getItem('mx3.presence') === '1') return;
  try {
    await sb.from('mtx_events').insert({ user_id: state.user.id, kind: 'presence', label: 'session', payload: { route: 'boot' } });
    sessionStorage.setItem('mx3.presence', '1');
  } catch { /* silent */ }
}

/* ---------- status bar ---------- */
export function paintStats() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('stat-people', fa(state.people.length));
  set('stat-traits', fa(state.traits.filter((t) => t.metadata?.active !== false).length));
  set('stat-scores', fa(state.scores.length));
  const p = state.people.length, t = state.traits.length;
  const possible = Math.max(1, p * (p - 1) * t);
  set('stat-coverage', pct(Math.min(1, state.scores.length / possible)));
}

/* ---------- AI dock ---------- */
export function toggleAiDock(open) {
  import('./ai.js').then((m) => m.toggleDock(open));
}
export function closeAiDock() {
  import('./ai.js').then((m) => m.closeDock?.()).catch(() => {});
}

/* ---------- command palette ---------- */
let palOpen = false;
function closePalette() { const p = $('#palette'); if (!p) return; p.hidden = true; palOpen = false; }
function openPalette() {
  const p = $('#palette');
  if (!p) return;
  palOpen = true; p.hidden = false;
  p.innerHTML = `<div class="palette__box">
    <div class="palette__input">${icon('search')}<input id="pal-q" placeholder="جست‌وجو یا فرمان…" autocomplete="off" /><kbd class="muted">ESC</kbd></div>
    <div class="palette__list" id="pal-list"></div></div>`;
  p.onclick = (e) => { if (e.target === p) closePalette(); };
  const input = p.querySelector('#pal-q');
  const list = p.querySelector('#pal-list');
  let idx = 0;
  const goMode = (mode) => import('./matrix.js').then((m) => { m.mx.mode = mode; m.mx.stack = 0; navigate('matrix'); });
  const actions = [
    { label: 'ماتریس ویژگی‌محور', icon: 'sliders', run: () => goMode('trait') },
    { label: 'ماتریس امتیازدهنده‌محور', icon: 'users', run: () => goMode('ranker') },
    { label: 'ماتریس امتیازگیرنده‌محور', icon: 'target', run: () => goMode('target') },
    { label: 'داشبورد', icon: 'grid', run: () => navigate('dashboard') },
    { label: 'افراد', icon: 'users', run: () => navigate('people') },
    { label: 'ویژگی‌ها', icon: 'sliders', run: () => navigate('traits') },
    { label: 'دسته کارت امتیازدهی', icon: 'zap', run: () => navigate('deck') },
    { label: 'دستیار هوش مصنوعی', icon: 'brain', run: () => toggleAiDock(true) },
    { label: 'مدیریت و مجوزها', icon: 'shield', run: () => navigate('admin') },
    { label: 'تنظیمات', icon: 'settings', run: () => navigate('settings') },
    { label: 'بارگذاری مجدد داده‌ها', icon: 'refresh', run: async () => { await loadAll(); rerender(true); } },
    { label: 'خروجی CSV ماتریس', icon: 'download', run: () => import('./matrix.js').then((m) => m.exportMatrix()) },
  ];
  const render = (q = '') => {
    const ql = q.trim().toLowerCase();
    const people = state.people.filter((x) => !ql || x.full_name?.toLowerCase().includes(ql)).slice(0, 6)
      .map((x) => ({ label: x.full_name, sub: x.job_title || 'شخص', icon: 'user', run: async () => { navigate('matrix'); (await import('./views/people.js')).openPersonPanel(x.id); } }));
    const traits = state.traits.filter((x) => !ql || x.name?.toLowerCase().includes(ql)).slice(0, 6)
      .map((x) => ({ label: x.name, sub: `ویژگی · ${x.category || ''}`, icon: x.icon || 'sliders', run: () => { navigate('matrix'); import('./matrix.js').then((m) => { m.mx.mode = 'trait'; m.mx.stack = m.stacksFor('trait').findIndex((s) => s.id === x.id); m.renderMatrix($('#view')); }); } }));
    const acts = actions.filter((a) => !ql || a.label.toLowerCase().includes(ql));
    const items = [...acts, ...people, ...traits];
    idx = Math.min(idx, Math.max(0, items.length - 1));
    list.innerHTML = items.length ? items.map((a, i) => `<button class="palette__item ${i === idx ? 'is-on' : ''}" data-i="${i}">${icon(a.icon)}<span>${esc(a.label)}</span>${a.sub ? `<span class="hint">${esc(a.sub)}</span>` : ''}</button>`).join('') : `<div class="palette__empty">نتیجه‌ای نیست</div>`;
    list.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => { closePalette(); items[+b.dataset.i].run(); });
  };
  input.oninput = () => { idx = 0; render(input.value); };
  input.onkeydown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); idx++; render(input.value); list.querySelector('.is-on')?.scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); render(input.value); list.querySelector('.is-on')?.scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'Enter') { const b = list.querySelector('[data-i]'); if (b) b.click(); }
  };
  render('');
  setTimeout(() => input.focus(), 30);
}

/* expose for views */
window.mx = {
  navigate, paintStats, rerender,
  reload: async () => { await loadAll(); await rerender(true); },
};
