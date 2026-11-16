/* ============================================================
   Command palette — Cmd/Ctrl+K opens a searchable action list
   ============================================================ */
import { el, normalizeFa } from '../utils.js';
import { icon } from './icons.js';
import { store } from '../state.js';
import { openPurchaseModal } from './purchase-modal.js';
import { openSettingsModal } from './settings-modal.js';
import { openAnalyticsModal } from './analytics-modal.js';
import { signOut } from '../api.js';
import { notify } from './toast.js';
import { confirmDialog } from './confirm.js';

let isOpen = false;
let overlayEl = null;

function buildActions() {
  return [
    {
      id: 'add-purchase',
      label: 'ثبت خرید جدید',
      hint: 'خرید تازه را با فروشگاه و محصول ثبت کن',
      icon: 'plus',
      group: 'اقدامات',
      keywords: ['خرید', 'اضافه', 'ثبت', 'add', 'purchase'],
      run: () => openPurchaseModal({ mode: 'create' }),
    },
    {
      id: 'analytics',
      label: 'تحلیل خریدها',
      hint: 'نمودارها و آمار فروشگاه‌ها',
      icon: 'barChart',
      group: 'نماها',
      keywords: ['تحلیل', 'آمار', 'نمودار', 'chart', 'stats', 'analytics'],
      run: () => openAnalyticsModal(),
    },
    {
      id: 'settings',
      label: 'تنظیمات',
      hint: 'مدیریت پلتفرم‌ها، فروشگاه‌ها، محصولات',
      icon: 'settings',
      group: 'نماها',
      keywords: ['تنظیمات', 'settings', 'مدیریت'],
      run: () => openSettingsModal(),
    },
    {
      id: 'focus-search',
      label: 'جستجوی خریدها',
      hint: 'پرش به نوار جستجو',
      icon: 'search',
      group: 'پیمایش',
      keywords: ['جستجو', 'search', 'find'],
      run: () => {
        const inp = document.querySelector('.header-search__input');
        if (inp) { inp.focus(); inp.select?.(); }
      },
    },
    {
      id: 'clear-filters',
      label: 'پاک کردن فیلترها',
      hint: 'همهٔ فیلترها را بردار',
      icon: 'refresh',
      group: 'پیمایش',
      keywords: ['فیلتر', 'پاک', 'clear', 'reset'],
      run: () => {
        const f = store.filters.get();
        store.filters.set({
          ...f,
          ratings: new Set(),
          platformIds: new Set(),
          shopIds: new Set(),
          productIds: new Set(),
        });
        notify.info('فیلترها پاک شدند');
      },
    },
    {
      id: 'toggle-view',
      label: 'تغییر نما (جدول / گروهی)',
      hint: 'جابه‌جایی بین نمای جدول و گروهی ماهانه',
      icon: 'list',
      group: 'پیمایش',
      keywords: ['نما', 'جدول', 'گروهی', 'view', 'table', 'grouped'],
      run: () => {
        const f = store.filters.get();
        store.filters.set({ ...f, view: f.view === 'grouped' ? 'table' : 'grouped' });
      },
    },
    {
      id: 'signout',
      label: 'خروج از حساب',
      hint: 'پایان نشست',
      icon: 'logout',
      group: 'حساب',
      keywords: ['خروج', 'signout', 'logout', 'exit'],
      danger: true,
      run: async () => {
        const ok = await confirmDialog({
          title: 'خروج',
          message: 'از حسابت خارج می‌شوی؟',
          confirmLabel: 'خروج',
          danger: true,
        });
        if (!ok) return;
        try { await signOut(); notify.info('خارج شدی'); } catch (e) { notify.error(e.message); }
      },
    },
  ];
}

function scoreAction(action, q) {
  if (!q) return 1;
  const nq = normalizeFa(q);
  if (!nq) return 1;
  let best = 0;
  const sources = [action.label, action.hint, ...(action.keywords || [])];
  for (const s of sources) {
    const ns = normalizeFa(s);
    if (!ns) continue;
    if (ns === nq) best = Math.max(best, 100);
    else if (ns.startsWith(nq)) best = Math.max(best, 80);
    else if (ns.includes(nq)) best = Math.max(best, 50);
  }
  return best;
}

export function openCommandPalette() {
  if (isOpen) return;

  const actions = buildActions();
  let query = '';
  let selectedIndex = 0;
  let filtered = actions;

  const overlay = el('div', {
    class: 'cmd-palette-backdrop',
    style: { position: 'fixed', inset: '0', background: 'rgba(4,4,10,0.72)', backdropFilter: 'blur(6px)', zIndex: '700', display: 'grid', placeItems: 'start center', padding: '15vh 16px 16px' },
  });
  const modal = el('div', {
    class: 'cmd-palette',
    role: 'dialog',
    'aria-label': 'فرمان‌ها',
    style: {
      width: '100%',
      maxWidth: '560px',
      background: '#0d0d17',
      border: '1px solid var(--border-2)',
      borderRadius: 'var(--r-2xl)',
      boxShadow: 'var(--sh-xl)',
      overflow: 'hidden',
      animation: 'modal-in 220ms cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
  });

  const searchInput = el('input', {
    type: 'text',
    placeholder: 'یک فرمان یا میانبر را جستجو کن…',
    autocomplete: 'off',
    spellcheck: 'false',
    style: {
      width: '100%',
      border: '0',
      background: 'transparent',
      color: 'var(--text-1)',
      fontSize: 'var(--fs-md)',
      padding: '14px 0',
      outline: 'none',
    },
  });

  const searchWrap = el('div', {
    style: {
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '0 16px',
      borderBottom: '1px solid var(--border-1)',
    },
  }, [
    el('span', { html: icon('search', 18), style: { color: 'var(--text-3)', flexShrink: '0' } }),
    searchInput,
    el('span', { class: 'kbd', text: 'ESC', style: { flexShrink: '0' } }),
  ]);

  const list = el('div', {
    style: { maxHeight: '55vh', overflowY: 'auto', padding: '6px' },
  });

  modal.append(searchWrap, list);
  overlay.appendChild(modal);
  (document.getElementById('portal-root') || document.body).appendChild(overlay);
  document.body.classList.add('has-modal');
  isOpen = true;

  function render() {
    const q = query.trim();
    filtered = actions
      .map((a) => ({ a, s: scoreAction(a, q) }))
      .filter((x) => x.s > 0)
      .sort((x, y) => y.s - x.s)
      .map((x) => x.a);

    if (selectedIndex >= filtered.length) selectedIndex = Math.max(0, filtered.length - 1);

    list.innerHTML = '';
    if (!filtered.length) {
      list.appendChild(el('div', {
        style: { padding: '32px 16px', textAlign: 'center', color: 'var(--text-4)', fontSize: 'var(--fs-sm)' },
        text: 'نتیجه‌ای یافت نشد',
      }));
      return;
    }

    let lastGroup = null;
    filtered.forEach((action, idx) => {
      if (action.group !== lastGroup) {
        lastGroup = action.group;
        list.appendChild(el('div', {
          style: {
            padding: '8px 12px 4px',
            fontSize: 'var(--fs-xxs)',
            color: 'var(--text-4)',
            fontWeight: 'var(--fw-semibold)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--ls-wide)',
          },
          text: action.group,
        }));
      }
      const isSel = idx === selectedIndex;
      const row = el('button', {
        type: 'button',
        class: 'cmd-item',
        dataset: { idx: String(idx) },
        style: {
          display: 'flex', alignItems: 'center', gap: '12px',
          width: '100%', padding: '10px 12px',
          borderRadius: 'var(--r-md)',
          textAlign: 'right',
          background: isSel ? 'var(--surface-2)' : 'transparent',
          color: isSel ? 'var(--text-1)' : 'var(--text-2)',
          cursor: 'pointer',
          transition: 'background 100ms',
          border: isSel ? '1px solid var(--border-2)' : '1px solid transparent',
        },
      }, [
        el('span', {
          style: {
            width: '28px', height: '28px', borderRadius: 'var(--r-sm)',
            background: action.danger ? 'var(--shit-soft)' : 'var(--brand-soft)',
            color: action.danger ? 'var(--shit-2)' : 'var(--violet-1)',
            display: 'grid', placeItems: 'center', flexShrink: '0',
          },
          html: icon(action.icon, 15),
        }),
        el('div', { style: { flex: '1', minWidth: '0' } }, [
          el('div', {
            style: { fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', color: 'inherit' },
            text: action.label,
          }),
          action.hint ? el('div', {
            style: { fontSize: 'var(--fs-xs)', color: 'var(--text-4)', marginTop: '2px' },
            text: action.hint,
          }) : null,
        ].filter(Boolean)),
      ]);
      row.addEventListener('mouseenter', () => {
        if (selectedIndex !== idx) {
          selectedIndex = idx;
          render();
        }
      });
      row.addEventListener('click', () => runAction(action));
      list.appendChild(row);
    });
  }

  function runAction(action) {
    close();
    // small delay so palette closes before action opens its own modal
    setTimeout(() => { try { action.run?.(); } catch (e) { console.error(e); } }, 60);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    overlay.style.animation = 'backdrop-out 160ms ease-in forwards';
    setTimeout(() => {
      overlay.remove();
      if (!document.querySelector('.modal-backdrop') && !document.querySelector('.drawer') && !document.querySelector('.cmd-palette-backdrop')) {
        document.body.classList.remove('has-modal');
      }
    }, 160);
    document.removeEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); selectedIndex = Math.min(filtered.length - 1, selectedIndex + 1); render(); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); selectedIndex = Math.max(0, selectedIndex - 1); render(); return; }
    if (e.key === 'Enter') { e.preventDefault(); const a = filtered[selectedIndex]; if (a) runAction(a); return; }
  }

  searchInput.addEventListener('input', () => { query = searchInput.value; selectedIndex = 0; render(); });
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);

  render();
  setTimeout(() => searchInput.focus(), 30);
}
