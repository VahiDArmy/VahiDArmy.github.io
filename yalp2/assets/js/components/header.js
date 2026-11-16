/* ============================================================
   Header — brand, live search, add button, user menu
   ============================================================ */
import { el, debounce } from '../utils.js';
import { icon } from './icons.js';
import { store } from '../state.js';
import { signOut } from '../api.js';
import { notify } from './toast.js';
import { CONFIG } from '../config.js';

export function mountHeader({ onSearch, onAdd, onOpenSettings } = {}) {
  const searchInput = el('input', {
    type: 'search',
    class: 'header-search__input',
    placeholder: 'جستجو در خریدها…',
    'aria-label': 'جستجو در خریدها',
    autocomplete: 'off',
    spellcheck: 'false',
  });

  const searchWrap = el('div', { class: 'header-search' }, [
    el('span', { class: 'header-search__icon', html: icon('search', 16) }),
    searchInput,
    el('span', { class: 'header-search__hint' }, [
      el('kbd', { class: 'kbd', text: '⌘' }),
      el('kbd', { class: 'kbd', text: 'K' }),
    ]),
    el('button', {
      class: 'header-search__clear',
      type: 'button',
      'aria-label': 'پاک کردن جستجو',
      html: icon('close', 14),
      style: { display: 'none' },
    }),
  ]);
  const clearBtn = searchWrap.querySelector('.header-search__clear');

  const handleSearch = debounce((v) => {
    const f = store.filters.get();
    store.filters.set({ ...f, query: v });
    onSearch?.(v);
  }, 150);

  searchInput.addEventListener('input', () => {
    const v = searchInput.value;
    clearBtn.style.display = v ? 'grid' : 'none';
    handleSearch(v);
  });
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.style.display = 'none';
    searchInput.focus();
    handleSearch('');
  });

  // Keyboard shortcut Cmd/Ctrl + K
  const onKey = (e) => {
    const tag = (e.target?.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    } else if (e.key === '/' && !typing) {
      e.preventDefault();
      searchInput.focus();
    }
  };
  document.addEventListener('keydown', onKey);

  // Add button
  const addBtn = el('button', {
    class: 'btn btn--primary header-add-btn',
    type: 'button',
    onclick: () => onAdd?.(),
  }, [
    el('span', { html: icon('plus', 16) }),
    el('span', { class: 'header-add-btn__label', text: 'ثبت خرید' }),
  ]);

  // User menu
  const userBtn = el('button', {
    class: 'header-user-btn',
    type: 'button',
    'aria-haspopup': 'menu',
    'aria-expanded': 'false',
  }, [
    el('span', { class: 'avatar avatar--sm', 'data-user-initial': '' }),
  ]);

  const userMenuWrap = el('div', { class: 'header-user-wrap', style: { position: 'relative' } }, [userBtn]);

  const updateUser = (user) => {
    const initialEl = userBtn.querySelector('[data-user-initial]');
    if (!initialEl) return;
    initialEl.textContent = getInitial(user);
  };
  updateUser(store.user.get());
  store.user.subscribe(updateUser);

  // Menu open/close
  let menuEl = null;
  const closeMenu = () => {
    if (!menuEl) return;
    menuEl.remove();
    menuEl = null;
    userBtn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onDocClick);
  };
  const onDocClick = (e) => {
    if (!menuEl) return;
    if (!userMenuWrap.contains(e.target)) closeMenu();
  };
  const openMenu = () => {
    if (menuEl) { closeMenu(); return; }
    const user = store.user.get();
    const email = user?.email || '';
    const namePart = email.split('@')[0] || '';
    const initial = getInitial(user);

    const menu = el('div', { class: 'menu', role: 'menu', style: { top: 'calc(100% + 8px)', left: '0', minWidth: '260px' } }, [
      el('div', { class: 'menu__header' }, [
        el('div', { class: 'menu__header-title', text: namePart || 'کاربر' }),
        el('div', { class: 'menu__header-sub', text: email || 'بدون ایمیل' }),
      ]),
      el('button', {
        class: 'menu__item', type: 'button', role: 'menuitem',
        html: `${icon('settings', 16)}<span>تنظیمات</span>`,
        onclick: () => { closeMenu(); onOpenSettings?.(); },
      }),
      el('button', {
        class: 'menu__item', type: 'button', role: 'menuitem',
        html: `${icon('barChart', 16)}<span>آمار خریدها</span>`,
        onclick: () => { closeMenu(); /* hooks for future */ },
      }),
      el('div', { class: 'menu__divider' }),
      el('button', {
        class: 'menu__item menu__item--danger', type: 'button', role: 'menuitem',
        html: `${icon('logout', 16)}<span>خروج از حساب</span>`,
        onclick: async () => {
          closeMenu();
          try {
            await signOut();
            notify.info('از حسابت خارج شدی');
          } catch (e) {
            notify.error(e.message);
          }
        },
      }),
    ]);
    userMenuWrap.appendChild(menu);
    menuEl = menu;
    userBtn.setAttribute('aria-expanded', 'true');
    setTimeout(() => document.addEventListener('mousedown', onDocClick), 0);
  };
  userBtn.addEventListener('click', openMenu);

  // Build header
  const header = el('header', { class: 'site-header' }, [
    el('div', { class: 'container site-header__inner' }, [
      el('a', { class: 'brand', href: '/' }, [
        el('span', { class: 'brand__mark', html: brandSvg() }),
        el('span', { class: 'brand__text' }, [
          el('span', { class: 'brand__title', text: CONFIG.appName }),
          el('span', { class: 'brand__sub', text: CONFIG.appTagline }),
        ]),
      ]),
      el('div', { class: 'header-center' }, [searchWrap]),
      el('div', { class: 'header-actions' }, [addBtn, userMenuWrap]),
    ]),
  ]);

  injectHeaderStyles();
  return header;
}

function getInitial(user) {
  const email = user?.email || '';
  const ch = email.trim()[0];
  if (!ch) return '؟';
  if (/[a-zA-Z]/.test(ch)) return ch.toUpperCase();
  return '؟';
}

function brandSvg() {
  return `
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M6 10h20l-2.5 15h-15L6 10z" stroke="white" stroke-width="2" stroke-linejoin="round"/>
      <path d="M11 10a5 5 0 0 1 10 0" stroke="white" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
}

/* ---------- header-scoped styles ---------- */
function injectHeaderStyles() {
  if (document.getElementById('header-styles')) return;
  const s = document.createElement('style');
  s.id = 'header-styles';
  s.textContent = `
    .header-center {
      flex: 1;
      display: flex;
      justify-content: center;
      padding-inline: var(--s-3);
      min-width: 0;
    }
    .header-search {
      position: relative;
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      max-width: 520px;
      height: 38px;
      padding: 0 12px;
      border-radius: var(--r-full);
      background: var(--surface-1);
      border: 1px solid var(--border-1);
      transition: border-color var(--t-fast), background var(--t-fast), box-shadow var(--t-fast);
    }
    .header-search:hover { background: var(--surface-2); border-color: var(--border-2); }
    .header-search:focus-within {
      background: var(--surface-2);
      border-color: var(--border-brand);
      box-shadow: 0 0 0 4px var(--brand-soft);
    }
    .header-search__icon { color: var(--text-3); flex-shrink: 0; display: grid; place-items: center; }
    .header-search__icon svg { width: 16px; height: 16px; }
    .header-search__input {
      flex: 1;
      min-width: 0;
      background: transparent;
      border: 0;
      outline: none;
      font-size: var(--fs-sm);
      color: var(--text-1);
      font-family: inherit;
    }
    .header-search__input::placeholder { color: var(--text-4); }
    .header-search__input::-webkit-search-cancel-button { display: none; }
    .header-search__hint { display: flex; gap: 4px; flex-shrink: 0; }
    .header-search__clear {
      width: 20px; height: 20px;
      border-radius: 50%;
      background: var(--surface-3);
      color: var(--text-2);
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }
    .header-search__clear:hover { background: var(--surface-4); color: var(--text-1); }
    .header-search__clear svg { width: 12px; height: 12px; }

    .header-add-btn {
      height: 36px;
      padding-inline: 14px;
    }
    .header-add-btn__label {
      display: inline-block;
    }

    .header-user-btn {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      transition: background var(--t-fast);
    }
    .header-user-btn:hover { background: var(--surface-2); }

    @media (max-width: 720px) {
      .header-center { order: 3; padding-inline: 0; flex-basis: 100%; }
      .site-header__inner { flex-wrap: wrap; }
      .header-search__hint { display: none; }
      .header-add-btn__label { display: none; }
      .header-add-btn { padding-inline: 0; width: 36px; }
    }
  `;
  document.head.appendChild(s);
}
