/* ============================================================
   CSV export — BOM-prefixed for Excel + Persian support
   ============================================================ */
import { CONFIG } from '../config.js';
import { RATINGS } from '../state.js';

function esc(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function purchasesToCsv(purchases) {
  const header = [
    'تاریخ',
    'فروشگاه',
    'دسته فروشگاه',
    'محصول',
    'دسته محصول',
    'واحد',
    'پلتفرم',
    'امتیاز',
    'قیمت',
    'تعداد',
    'یادداشت',
  ];

  const rows = purchases.map((p) => {
    const shop = p.shop || {};
    const product = p.product || {};
    const platform = p.platform || null;
    const rating = RATINGS[p.rating]?.label || p.rating || '';
    return [
      p.purchased_at || p.created_at || '',
      shop.name || '',
      shop.category || '',
      product.name || '',
      product.category || '',
      product.unit || '',
      platform?.name || '',
      rating,
      p.price == null ? '' : p.price,
      p.quantity == null ? 1 : p.quantity,
      p.note || '',
    ];
  });

  const all = [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  // BOM for Excel + RTL handling
  return '\uFEFF' + all;
}

export function downloadPurchasesCsv(purchases, filename) {
  if (!purchases.length) throw new Error('داده‌ای برای خروجی نیست');
  const csv = purchasesToCsv(purchases);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `purchases-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
