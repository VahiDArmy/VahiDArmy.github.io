import { supabase, getSession } from './lib/supabase.js';
import { store } from './lib/store.js';
import { Sound } from './lib/sound.js';
import { esc, toast } from './lib/ui.js';
import { renderAuth } from './views/auth.js';
import Dashboard from './views/dashboard.js';
import MatrixView from './views/matrix.js';
import SwipeView from './views/swipe.js';
import PeopleView from './views/people.js';
import TraitsView from './views/traits.js';
import AIView from './views/ai.js';
import SettingsView from './views/settings.js';

const VIEWS = {
  dashboard: { label: 'Dashboard', icon: 'gauge-high', comp: Dashboard, key: '1' },
  matrix:    { label: 'Matrix',    icon: 'table-cells', comp: MatrixView, key: '2' },
  swipe:     { label: 'Swipe',     icon: 'arrows-left-right', comp: SwipeView, key: '3' },
  people:    { label: 'People',    icon: 'users', comp: PeopleView, key: '4' },
  traits:    { label: 'Traits',    icon: 'layer-group', comp: TraitsView, key: '5' },
  ai:        { label: 'AI Analyst', icon: 'wand-magic-sparkles', comp: AIView, key: '6' },
  settings:  { label: 'Settings',  icon: 'gear', comp: SettingsView, key: '7' }
};

const authScreen = document.getElementById('auth-screen');
const appEl = document.getElementById('app');
let currentView = null;
let currentRoute = null;

function stopCurrent() {
  if (currentView?.destroy) try { currentView.destroy(); } catch {}
  currentView = null;
}

function navigate(route) {
  if (!VIEWS[route]) route = 'dashboard';
  if (route === currentRoute) return;
  currentRoute = route;
  if (location.hash !== `#/${route}`) {
    history.replaceState(null, '', `#/${route}`);
  }
  renderRoute();
}

function renderRoute() {
  stopCurrent();
  const route = (location.hash.slice(2).split('/')[0]) || 'dashboard';
  const v = VIEWS[route] || VIEWS.dashboard;
  appEl.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.route === route);
  });
  const title = appEl.querySelector('#topbar-title');
  if (title) title.textContent = v.label;
  const viewRoot = appEl.querySelector('#view-root');
  viewRoot.innerHTML = '';
  const container = document.createElement('div');
  container.style.height = '100%';
  viewRoot.appendChild(container);
  try {
    currentView = v.comp(container) || {};
  } catch (e) {
    console.error(e);
    container.innerHTML = `<div class="view-pad"><div class="empty">Something went wrong: ${esc(e.message)}</div></div>`;
  }
  currentRoute = route;
}

function buildShell() {
  const myName = store.myPerson?.full_name || store.user.email?.split('@')[0] || 'You';
  const mySub = store.myPerson?.job_title || 'member';
  const avatar = store.myPerson
    ? (store.myPerson.avatar_url
        ? `<img class="avatar" src="${esc(store.myPerson.avatar_url)}" style="width:32px;height:32px" alt="">`
        : `<div class="avatar avatar-fallback" style="width:32px;height:32px;font-size:13px">${esc((store.myPerson.full_name || '?').slice(0, 2).toUpperCase())}</div>`)
    : `<div class="avatar avatar-fallback" style="width:32px;height:32px;font-size:13px">?</div>`;

  appEl.innerHTML = `
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">3</div>
        <div>
          <div class="brand-name">MATRIX·3D</div>
          <div class="brand-sub">Ranking Cube</div>
        </div>
      </div>
      <nav class="nav"></nav>
      <div class="sidebar-footer">
        <div class="user-mini" id="user-mini">
          ${avatar}
          <div style="min-width:0">
            <div class="user-mini-name">${esc(myName)}</div>
            <div class="user-mini-sub">${esc(mySub)}</div>
          </div>
        </div>
      </div>
    </aside>
    <main class="main">
      <header class="topbar">
        <div class="topbar-title" id="topbar-title">Dashboard</div>
        <div class="topbar-sub">${store.people.length}P · ${store.traits.length}T · ${store.scores.length}S</div>
      </header>
      <div class="view-root" id="view-root"></div>
    </main>
  `;

  const nav = appEl.querySelector('.nav');
  for (const [route, v] of Object.entries(VIEWS)) {
    const el = document.createElement('a');
    el.className = 'nav-item';
    el.dataset.route = route;
    el.href = `#/${route}`;
    el.innerHTML = `<i class="fa-solid fa-${v.icon}"></i><span>${v.label}</span><span class="nav-kbd">${v.key}</span>`;
    el.onclick = e => {
      e.preventDefault();
      Sound.tap();
      navigate(route);
    };
    nav.appendChild(el);
  }

  appEl.querySelector('#user-mini').onclick = () => navigate('settings');

  window.addEventListener('keydown', e => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const found = Object.entries(VIEWS).find(([, v]) => v.key === e.key);
    if (found) {
      e.preventDefault();
      navigate(found[0]);
      Sound.tap();
    }
  });

  window.addEventListener('hashchange', () => {
    const route = location.hash.slice(2).split('/')[0] || 'dashboard';
    if (route !== currentRoute) renderRoute();
  });
}

async function ensureMyPerson(user) {
  const { data: existing } = await supabase.from('people').select('*').eq('user_id', user.id).maybeSingle();
  if (existing) return existing;
  const name = user.user_metadata?.display_name || user.email?.split('@')[0] || 'New User';
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6);
  const { data, error } = await supabase.from('people').insert({
    full_name: name, user_id: user.id, created_by: user.id, slug
  }).select().single();
  if (error) { console.warn('ensureMyPerson:', error); return null; }
  return data;
}

async function boot() {
  // Ask audio context to be ready on first gesture
  const armAudio = () => { Sound.init(); document.removeEventListener('pointerdown', armAudio); };
  document.addEventListener('pointerdown', armAudio);

  const session = await getSession();
  if (!session) return showAuth();
  await enterApp(session.user);
}

function showAuth() {
  authScreen.hidden = false;
  appEl.hidden = true;
  renderAuth(authScreen, async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) await enterApp(data.session.user);
  });
}

async function enterApp(user) {
  store.session = { user };
  store.user = user;
  try {
    await ensureMyPerson(user);
    await store.load();
  } catch (e) {
    console.error(e);
    toast('Failed to load data: ' + e.message, 'error', 6000);
  }
  authScreen.hidden = true;
  authScreen.innerHTML = '';
  appEl.hidden = false;
  buildShell();
  const route = location.hash.slice(2).split('/')[0] || 'dashboard';
  currentRoute = null;
  navigate(route);
  Sound.glass(0.6);
}

// Auto-update shell header when store changes
store.on(() => {
  if (!appEl.hidden) {
    const sub = appEl.querySelector('.topbar-sub');
    if (sub) sub.textContent = `${store.people.length}P · ${store.traits.length}T · ${store.scores.length}S`;
    const mini = appEl.querySelector('#user-mini');
    if (mini && store.myPerson) {
      const nameEl = mini.querySelector('.user-mini-name');
      const subEl = mini.querySelector('.user-mini-sub');
      if (nameEl) nameEl.textContent = store.myPerson.full_name;
      if (subEl) subEl.textContent = store.myPerson.job_title || 'member';
    }
  }
});

// Auth state listener (handles token refresh / sign out elsewhere)
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    location.reload();
  } else if (event === 'SIGNED_IN' && appEl.hidden && session) {
    enterApp(session.user);
  }
});

boot();
