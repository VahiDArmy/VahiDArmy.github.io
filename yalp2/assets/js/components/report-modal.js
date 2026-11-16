/* ============================================================
   Monthly report — printable summary of one month's purchases
   ============================================================ */
import { store } from '../state.js';
import { el, formatNumber, formatDate, formatPrice } from '../utils.js';
import { icon } from './icons.js';
import { mountModal } from './modal-shell.js';
import { RATINGS } from '../state.js';

export function openReportModal({ monthKey } = {}) {
  const purchases = store.purchases.get();
  if (!purchases.length) {
    import('./toast.js').then((m) => m.notify.warn('خریدی برای گزارش وجود ندارد'));
    return;
  }

  // Group by month
  const byMonth = new Map();
  for (const p of purchases) {
    const d = new Date(p.purchased_at || p.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key).push(p);
  }
  const months = [...byMonth.keys()].sort((a, b) => (a < b ? 1 : -1));

  let activeMonth = monthKey && byMonth.has(monthKey) ? monthKey : months[0];
  const bodyHost = el('div', { class: 'report-body' });

  const { close, footer } = mountModal({
    title: 'گزارش ماهانه',
    subtitle: 'قابل چاپ و ذخیره به‌صورت PDF',
    size: 'xl',
    body: [bodyHost],
    footer: [
      el('button', {
        type: 'button', class: 'btn btn--ghost btn--lg', text: 'بستن',
        onclick: () => close(),
      }),
      el('button', {
        type: 'button', class: 'btn btn--primary btn--lg',
        html: `${icon('external', 16)}<span>چاپ / ذخیره PDF</span>`,
        onclick: () => {
          document.body.classList.add('printing-report');
          // ensure styles flushed
          setTimeout(() => {
            window.print();
            setTimeout(() => document.body.classList.remove('printing-report'), 400);
          }, 40);
        },
      }),
    ],
  });

  // Suppress footer mutation while printing (keep reference)
  void footer;

  function render() {
    bodyHost.innerHTML = '';
    const items = byMonth.get(activeMonth) || [];
    const monthItems = [...items].sort((a, b) =>
      new Date(b.purchased_at || b.created_at).getTime() -
      new Date(a.purchased_at || a.created_at).getTime()
    );

    // Month label
    const [yy, mm] = activeMonth.split('-');
    let monthLabel = activeMonth;
    try {
      monthLabel = new Intl.DateTimeFormat('fa-IR', { month: 'long', year: 'numeric' })
        .format(new Date(Number(yy), Number(mm) - 1, 1));
    } catch {}

    // Stats
    const good = items.filter((p) => p.rating === 'good').length;
    const bad = items.filter((p) => p.rating === 'bad').length;
    const shit = items.filter((p) => p.rating === 'shit').length;
    let spent = 0;
    for (const p of items) {
      if (p.price != null) spent += Number(p.price) * (Number(p.quantity) || 1);
    }

    // Header
    const monthSelect = el('select', { class: 'select report-month-select' });
    for (const key of months) {
      const [y, m] = key.split('-');
      let label = key;
      try {
        label = new Intl.DateTimeFormat('fa-IR', { month: 'long', year: 'numeric' })
          .format(new Date(Number(y), Number(m) - 1, 1));
      } catch {}
      const opt = el('option', { value: key, text: label });
      if (key === activeMonth) opt.selected = true;
      monthSelect.appendChild(opt);
    }
    monthSelect.addEventListener('change', () => {
      activeMonth = monthSelect.value;
      render();
    });

    const header = el('div', { class: 'report-header' }, [
      el('div', { class: 'report-header__brand' }, [
        el('div', { class: 'report-header__logo' }, [
          el('span', { html: brandSvg() }),
        ]),
        el('div', {}, [
          el('div', { class: 'report-header__title', text: 'گزارش خرید ماهانه' }),
          el('div', { class: 'report-header__sub', text: 'سوپرمارکت‌یار' }),
        ]),
      ]),
      el('div', { class: 'report-header__right' }, [
        el('div', { class: 'report-header__month', text: monthLabel }),
        monthSelect,
      ]),
    ]);

    // Summary
    const summary = el('div', { class: 'report-summary' }, [
      stat('کل خریدها', formatNumber(items.length)),
      stat('خرید خوب', formatNumber(good), 'good'),
      stat('نچندان خوب', formatNumber(bad), 'bad'),
      stat('افتضاح', formatNumber(shit), 'shit'),
      stat('مجموع هزینه', formatPrice(spent), 'money'),
    ]);

    // Table
    const table = el('table', { class: 'report-table' });
    table.appendChild(el('thead', {}, [
      el('tr', {}, [
        el('th', { text: 'تاریخ' }),
        el('th', { text: 'فروشگاه' }),
        el('th', { text: 'محصول' }),
        el('th', { text: 'پلتفرم' }),
        el('th', { text: 'امتیاز' }),
        el('th', { text: 'قیمت' }),
      ]),
    ]));
    const tbody = el('tbody');
    if (!monthItems.length) {
      tbody.appendChild(el('tr', {}, [
        el('td', {
          colspan: '6',
          style: { textAlign: 'center', color: 'var(--text-3)', padding: '24px' },
          text: 'خریدی در این ماه ثبت نشده',
        }),
      ]));
    } else {
      for (const p of monthItems) {
        const r = RATINGS[p.rating]?.label || '—';
        tbody.appendChild(el('tr', {}, [
          el('td', { text: formatDate(p.purchased_at || p.created_at) }),
          el('td', { text: p.shop?.name || '—' }),
          el('td', { text: p.product?.name || '—' }),
          el('td', { text: p.platform?.name || '—' }),
          el('td', { text: r }),
          el('td', { class: 'report-table__price',
            text: p.price != null ? formatPrice(p.price) : '—' }),
        ]));
      }
    }
    table.appendChild(tbody);

    // Footer
    const footNote = el('div', { class: 'report-footer' }, [
      el('span', { text: 'تولیدشده در ' + new Date().toLocaleDateString('fa-IR') }),
      el('span', { text: 'سوپرمارکت‌یار — دفترچهٔ خرید شخصی' }),
    ]);

    bodyHost.append(header, summary, table, footNote);
  }

  function stat(label, value, tone) {
    const cls = 'report-stat' + (tone ? ' report-stat--' + tone : '');
    return el('div', { class: cls }, [
      el('div', { class: 'report-stat__label', text: label }),
      el('div', { class: 'report-stat__value', text: String(value) }),
    ]);
  }

  function brandSvg() {
    return `<svg viewBox="0 0 32 32" fill="none" width="24" height="24" aria-hidden="true">
      <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#22d3ee"/>
      </linearGradient></defs>
      <rect width="32" height="32" rx="8" fill="url(#rg)"/>
      <path d="M9 12h14l-2 11H11L9 12z" stroke="white" stroke-width="1.8" fill="none" stroke-linejoin="round"/>
      <path d="M12.5 12a3.5 3.5 0 0 1 7 0" stroke="white" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    </svg>`;
  }

  render();
}
