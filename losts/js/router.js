import { $, $$ } from './utils.js';
import { emit } from './state.js';
import { VIEW_TITLES } from './config.js';

const views = {};
let currentView = 'dashboard';
let currentParams = {};

export function registerViews(map) {
  Object.assign(views, map);
}

export function initRouter() {
  $$('button[data-view]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const target = btn.dataset.view;
      if (target) navigate(target);
    });
  });

  $('#menu-btn')?.addEventListener('click', () => {
    $('#sidebar')?.classList.add('open');
    $('#sidebar-overlay')?.classList.add('active');
  });

  $('#sidebar-overlay')?.addEventListener('click', closeSidebar);

  document.addEventListener('click', (event) => {
    const goto = event.target.closest('[data-goto]');
    if (goto) {
      event.preventDefault();
      const mode = goto.dataset.mode;
      navigate(goto.dataset.goto, mode ? { mode } : {});
    }
  });

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '').trim();
    if (hash && views[hash] && hash !== currentView) navigate(hash);
  });
}

export function closeSidebar() {
  $('#sidebar')?.classList.remove('open');
  $('#sidebar-overlay')?.classList.remove('active');
}

export function navigate(name, params = {}) {
  const mod = views[name];
  if (!mod) {
    console.warn('[router] view not found', name);
    return;
  }

  currentView = name;
  currentParams = params;

  $$('.view').forEach((section) => section.classList.toggle('active', section.dataset.view === name));
  $$('.nav-item').forEach((btn) => btn.classList.toggle('active', btn.dataset.view === name));
  
  // Update Topbar Switch State
  // اگر در صفحه کارما یا فرم ثبت کارما هستیم، دکمه کارما فعال باشد
  const isKarmaContext = name === 'karma' || (name === 'add' && params.mode === 'karma');
  const switchTarget = isKarmaContext ? 'karma' : 'dashboard';
  
  $$('.topbar-switch .switch-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === switchTarget);
  });

  const titleEl = $('#topbar-title');
  if (titleEl) titleEl.textContent = VIEW_TITLES[name] || '';

  if (window.location.hash.replace('#', '') !== name) {
    try { history.replaceState(null, '', `#${name}`); } catch (err) { /* ignore */ }
  }

  const fab = $('#fab');
  if (fab) {
    const hideFabViews = ['add', 'settings', 'reflections', 'karma'];
    if (hideFabViews.includes(name)) {
      fab.classList.add('is-hidden');
    } else {
      fab.classList.remove('is-hidden');
    }
  }

  const section = document.getElementById(`view-${name}`);
  if (section) {
    try {
      mod.render(section, params);
    } catch (err) {
      console.error('[router] render error', err);
      section.innerHTML = `
        <div class="empty-state">
          <div class="empty-emoji">😵</div>
          <div class="empty-title">مشکلی در نمایش این بخش پیش آمد</div>
          <div class="empty-desc">${String(err.message || err)}</div>
        </div>`;
    }
  }

  closeSidebar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  emit('view:changed', { view: name, params });
}

export function rerender() {
  navigate(currentView, currentParams);
}

export function getCurrentView() {
  return currentView;
}

export function getCurrentParams() {
  return currentParams;
}
