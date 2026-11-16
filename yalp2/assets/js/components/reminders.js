/* ============================================================
   Reminders — show subtle banner for favorite shops not visited
   in N+ days. Client-side only, dismissible per shop for 7 days.
   ============================================================ */
import { store } from '../state.js';
import { el, escapeHtml } from '../utils.js';
import { icon } from './icons.js';

const DISMISS_KEY = 'smyar.reminders.dismissed.v1';
const DAY_MS = 86400000;
const THRESHOLD_DAYS = 30;
const DISMISS_COOLDOWN = 7 * DAY_MS;

export function mountReminders() {
  const wrap = el('div', { class: 'reminders-host' });
  const dismissed = loadDismissed();

  function render() {
    wrap.innerHTML = '';
    const all = computeReminders();
    const now = Date.now();
    const active = all.filter((r) => {
      const t = dismissed[r.shopId] || 0;
      return now - t > DISMISS_COOLDOWN;
    });

    if (!active.length) {
      wrap.classList.remove('is-visible');
      return;
    }
    wrap.classList.add('is-visible');

    for (const r of active.slice(0, 2)) {
      wrap.appendChild(renderBanner(r));
    }
  }

  function computeReminders() {
    const purchases = store.purchases.get();
    const shops = store.shops.get();
    if (!purchases.length || !shops.length) return [];

    const byShop = new Map();
    for (const p of purchases) {
      if (!p.shop_id) continue;
      if (!byShop.has(p.shop_id)) byShop.set(p.shop_id, []);
      byShop.get(p.shop_id).push(p);
    }

    const now = Date.now();
    const out = [];
    for (const [shopId, items] of byShop) {
      if (items.length < 2) continue;
      let lastAt = 0;
      let goods = 0;
      for (const p of items) {
        const t = new Date(p.purchased_at || p.created_at).getTime();
        if (t > lastAt) lastAt = t;
        if (p.rating === 'good') goods++;
      }
      if (goods < 1) continue;
      const days = Math.floor((now - lastAt) / DAY_MS);
      if (days < THRESHOLD_DAYS) continue;
      const shop = shops.find((s) => s.id === shopId);
      if (!shop) continue;
      out.push({ shopId, shop, days, total: items.length, goods });
    }

    out.sort((a, b) => b.days - a.days);
    return out;
  }

  function renderBanner(r) {
    const banner = el('div', { class: 'reminder-banner' }, [
      el('span', { class: 'reminder-banner__icon', html: icon('clock', 18) }),
      el('div', { class: 'reminder-banner__body' }, [
        el('div', { class: 'reminder-banner__title' },
          `از «${escapeHtml(r.shop.name)}» خرید نکردی`),
        el('div', { class: 'reminder-banner__desc' },
          `آخرین خرید ${toFa(r.days)} روز پیش بود · ${toFa(r.goods)} خرید خوب داشتی`),
      ]),
      el('div', { class: 'reminder-banner__actions' }, [
        el('button', {
          type: 'button',
          class: 'btn btn--ghost btn--sm',
          text: 'یادم نمی‌آید',
          onclick: () => {
            dismissed[r.shopId] = Date.now();
            saveDismissed(dismissed);
            render();
          },
        }),
        el('button', {
          type: 'button',
          class: 'btn btn--primary btn--sm',
          html: `${icon('store', 12)}<span>بررسی</span>`,
          onclick: async () => {
            const mod = await import('./details-drawer.js');
            mod.openShopDrawer(r.shopId);
          },
        }),
      ]),
    ]);
    return banner;
  }

  function loadDismissed() {
    try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}') || {}; }
    catch { return {}; }
  }
  function saveDismissed(obj) {
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(obj)); } catch {}
  }
  function toFa(n) {
    return String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
  }

  store.purchases.subscribe(render);
  store.shops.subscribe(render);
  render();
  return wrap;
}
