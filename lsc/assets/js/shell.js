/* ============================================================
   App shell wiring: sidebar, topbar, nav, breadcrumbs, clock,
   notifications, command palette, global shortcuts
   ============================================================ */
import { $, $$, el, escapeHtml, debounce } from './utils.js';
import { state, subscribe, setSidebarCollapsed, toggleTheme, initTheme } from './state.js';
import { navigate, setBreadcrumbs, goBack } from './router.js';
import { renderAuthSlot, displayName } from './auth.js';
import { openCommandPalette, toastInfo, toast, openModal } from './ui.js';
import { globalSearch } from './data.js';
import { formatJalali, formatJalaliTime } from './shamsi.js';
import { APP } from './config.js';

export const initShell = () => {
  initTheme();

  /* Sidebar toggle */
  const app = document.getElementById('app');
  const collapseBtn = $('#sidebar-collapse');
  const toggleBtn = $('#sidebar-toggle');
  if (state.sidebarCollapsed) app.classList.add('is-sidebar-collapsed');
  collapseBtn?.addEventListener('click', () => {
    setSidebarCollapsed(!state.sidebarCollapsed);
    app.classList.toggle('is-sidebar-collapsed', state.sidebarCollapsed);
  });
  toggleBtn?.addEventListener('click', () => {
    app.classList.toggle('is-mobile-open');
  });
  document.addEventListener('click', (e) => {
    if (app.classList.contains('is-mobile-open')) {
      if (e.target.closest('#sidebar') || e.target.closest('#sidebar-toggle')) return;
      app.classList.remove('is-mobile-open');
    }
  });

  /* Auth slot */
  const authSlot = $('#auth-slot');
  const renderAuth = () => renderAuthSlot(authSlot);
  renderAuth();
  subscribe('auth', renderAuth);
  subscribe('profile', renderAuth);

  /* Sidebar user */
  const sidebarUser = $('#sidebar-user');
  const renderSidebarUser = () => {
    sidebarUser.innerHTML = '';
    if (state.user) {
      const name = displayName();
      const p = state.profile || {};
      const card = document.createElement('a');
      card.href = '#/settings';
      card.dataset.link = '';
      card.className = 'user-card';
      card.style.cssText = 'display:flex;gap:10px;align-items:center;padding:6px;border-radius:10px;color:var(--ink);width:100%;';
      card.innerHTML = `
        <span class="avatar">${p.avatar_url ? `<img src="${escapeHtml(p.avatar_url)}" alt="" />` : escapeHtml(name.charAt(0) || 'ن')}</span>
        <div class="user-card__meta" style="min-width:0;flex:1;">
          <div style="font-size:var(--fs-sm);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(name)}</div>
          <div style="font-size:var(--fs-2xs);color:var(--ink-mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(state.user.email || '')}</div>
        </div>
        <i class="ri-arrow-left-s-line" style="color:var(--ink-faint);"></i>
      `;
      sidebarUser.appendChild(card);
    } else {
      const card = document.createElement('a');
      card.href = '#/auth';
      card.dataset.link = '';
      card.className = 'btn btn--soft btn--block';
      card.innerHTML = '<i class="ri-user-line"></i>ورود یا ثبت‌نام';
      sidebarUser.appendChild(card);
    }
  };
  renderSidebarUser();
  subscribe('auth', renderSidebarUser);
  subscribe('profile', renderSidebarUser);

  /* Nav active state */
  const navItems = $$('[data-nav]');
  const syncNav = (route) => {
    navItems.forEach(a => {
      a.classList.toggle('is-active', a.dataset.nav === route.name);
    });
  };
  syncNav(state.route);
  subscribe('route', (r) => syncNav(r));

  /* Breadcrumbs */
  const breadcrumbEl = $('#breadcrumbs');
  const setBC = (items) => {
    breadcrumbEl.innerHTML = '';
    (items || [{ label: 'خانه', href: '#/home' }]).forEach((it, i, arr) => {
      if (i > 0) {
        const sep = document.createElement('span');
        sep.className = 'breadcrumb__sep';
        sep.innerHTML = '<i class="ri-arrow-left-s-line"></i>';
        breadcrumbEl.appendChild(sep);
      }
      const isLast = i === arr.length - 1;
      if (isLast || !it.href) {
        const span = document.createElement('span');
        span.className = 'breadcrumb__item is-current';
        span.textContent = it.label;
        breadcrumbEl.appendChild(span);
      } else {
        const a = document.createElement('a');
        a.href = it.href;
        a.dataset.link = '';
        a.className = 'breadcrumb__item';
        a.textContent = it.label;
        breadcrumbEl.appendChild(a);
      }
    });
  };
  setBC([{ label: 'خانه', href: '#/home' }]);
  subscribe('breadcrumbs', setBC);

  /* Footer clock */
  const clock = $('#footer-clock');
  const tick = () => {
    if (clock) clock.textContent = `${formatJalali(new Date(), { withWeekday: true, long: true })} • ${formatJalaliTime(new Date())}`;
  };
  tick();
  setInterval(tick, 30000);

  /* Global search */
  const searchInput = $('#global-search-input');
  const searchResults = $('#global-search-results');
  if (searchInput && searchResults) {
    const perform = debounce(async () => {
      const q = searchInput.value.trim();
      if (!q) { searchResults.hidden = true; searchResults.innerHTML = ''; return; }
      try {
        const { theories, objects } = await globalSearch(q, 5);
        searchResults.innerHTML = '';
        if (!theories.length && !objects.length) {
          searchResults.innerHTML = `<div style="padding:12px;color:var(--ink-mute);font-size:var(--fs-sm);">نتیجه‌ای یافت نشد</div>`;
        } else {
          theories.forEach(t => {
            const a = document.createElement('a');
            a.href = `#/theories/${t.id}`;
            a.dataset.link = '';
            a.style.cssText = 'display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:8px;color:var(--ink-soft);font-size:var(--fs-sm);';
            a.innerHTML = `<i class="ri-lightbulb-line" style="color:var(--accent-1);"></i><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(t.title)}</span>`;
            a.addEventListener('click', () => { searchResults.hidden = true; });
            searchResults.appendChild(a);
          });
          objects.forEach(o => {
            const a = document.createElement('a');
            a.href = `#/objects/${o.id}`;
            a.dataset.link = '';
            a.style.cssText = 'display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:8px;color:var(--ink-soft);font-size:var(--fs-sm);';
            a.innerHTML = `<i class="ri-shape-2-line" style="color:var(--accent-1);"></i><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(o.title)}</span>`;
            a.addEventListener('click', () => { searchResults.hidden = true; });
            searchResults.appendChild(a);
          });
        }
        searchResults.hidden = false;
      } catch (e) {
        searchResults.hidden = true;
      }
    }, 260);
    searchInput.addEventListener('input', perform);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { navigate(`/search?q=${encodeURIComponent(searchInput.value.trim())}`); searchResults.hidden = true; }
      if (e.key === 'Escape') { searchInput.value = ''; searchResults.hidden = true; }
    });
    document.addEventListener('click', (e) => {
      if (!searchResults.contains(e.target) && e.target !== searchInput) searchResults.hidden = true;
    });
  }

  /* Theme button */
  document.querySelector('[data-action="toggle-theme"]')?.addEventListener('click', () => toggleTheme());

  /* Notification */
  document.querySelector('[data-action="notifications"]')?.addEventListener('click', () => {
    toastInfo('اعلان‌ها', 'در حال حاضر اعلان جدیدی ندارید.');
  });

  /* New theory action */
  $$('[data-action="new-theory"]').forEach(b => b.addEventListener('click', () => {
    if (!state.user) navigate('/auth'); else navigate('/theories/new');
  }));
  $$('[data-action="new-object"]').forEach(b => b.addEventListener('click', () => navigate('/objects')));

  /* Command palette */
  const buildCommands = () => [
    { label: 'خانه', icon: 'ri-home-5-line', group: 'ناوبری', run: () => navigate('/home') },
    { label: 'نظریه‌ها', icon: 'ri-lightbulb-flash-line', group: 'ناوبری', run: () => navigate('/theories') },
    { label: 'اشیاء', icon: 'ri-shape-2-line', group: 'ناوبری', run: () => navigate('/objects') },
    { label: 'گالری', icon: 'ri-gallery-line', group: 'ناوبری', run: () => navigate('/gallery') },
    { label: 'خط زمان', icon: 'ri-timeline-view', group: 'ناوبری', run: () => navigate('/timeline') },
    { label: 'نشان‌شده‌ها', icon: 'ri-bookmark-3-line', group: 'ناوبری', run: () => navigate('/bookmarks') },
    { label: 'جستجو', icon: 'ri-search-2-line', group: 'ناوبری', run: () => navigate('/search') },
    { label: 'تنظیمات', icon: 'ri-settings-5-line', group: 'ناوبری', run: () => navigate('/settings') },
    { label: 'نظریه جدید', icon: 'ri-add-line', group: 'دستور', hint: 'N', run: () => state.user ? navigate('/theories/new') : navigate('/auth') },
    { label: 'تغییر پوسته', icon: 'ri-moon-line', group: 'دستور', run: () => toggleTheme() },
    ...APP.categories.map(c => ({ label: `دسته: ${c.label}`, icon: c.icon, group: 'دسته‌بندی', run: () => navigate(`/theories?category=${c.id}`) }))
  ];
  const openCmd = () => openCommandPalette(buildCommands());

  document.addEventListener('keydown', (e) => {
    const isInput = e.target.matches?.('input, textarea, [contenteditable="true"]');
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCmd(); return; }
    if (isInput) return;
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); state.user ? navigate('/theories/new') : navigate('/auth'); }
    if (e.key === 'u' || e.key === 'U') { e.preventDefault(); navigate('/objects'); }
    if (e.key === '/') { e.preventDefault(); document.getElementById('global-search-input')?.focus(); }
    if (e.key === '?') { e.preventDefault(); showShortcutsHelp(); }
    if (e.key === 'Escape') { document.getElementById('app').classList.remove('is-mobile-open'); }
  });

  /* Sticky topbar shadow */
  const topbar = $('#topbar');
  window.addEventListener('scroll', () => {
    if (topbar) topbar.classList.toggle('is-scrolled', window.scrollY > 6);
  }, { passive: true });

  /* Aurora orbs */
  const orbs = document.createElement('div');
  orbs.className = 'aurora-orbs';
  orbs.innerHTML = '<div class="aurora-orbs__orb aurora-orbs__orb--1"></div><div class="aurora-orbs__orb aurora-orbs__orb--2"></div><div class="aurora-orbs__orb aurora-orbs__orb--3"></div>';
  document.body.appendChild(orbs);

  /* Online status toast */
  subscribe('network', () => toast(state.online ? 'آنلاین' : 'آفلاین', state.online ? 'اتصال برقرار است' : 'اتصال اینترنت قطع شد', state.online ? 'success' : 'warning'));
};

const showShortcutsHelp = () => {
  const body = document.createElement('div');
  body.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">
      ${APP.shortcuts.map(s => `
        <div style="background:var(--bg-elev-2);border:1px solid var(--line);border-radius:var(--r-md);padding:10px;">
          <div style="display:flex;gap:4px;margin-bottom:6px;">${s.keys.map(k => `<kbd>${escapeHtml(k)}</kbd>`).join('')}</div>
          <div style="font-size:var(--fs-xs);color:var(--ink-mute);">${escapeHtml(s.label)}</div>
        </div>
      `).join('')}
    </div>
  `;
  openModal({ title: 'میان‌برهای صفحه‌کلید', body, size: 'md' });
};
