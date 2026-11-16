/* ============================================================
   Public share view — read-only page shown at ?share=SLUG
   ============================================================ */
import { sb } from '../supabase.js';
import { el, formatNumber, formatPrice, formatDate, escapeHtml } from '../utils.js';
import { icon } from './icons.js';
import { RATINGS } from '../state.js';

export async function renderShareView(root, slug) {
  root.innerHTML = '';
  root.appendChild(loadingSplash());

  let row = null;
  try {
    const { data, error } = await sb.rpc('sm_share_get', { p_slug: slug });
    if (error) throw error;
    row = Array.isArray(data) ? data[0] : data;
  } catch (err) {
    return renderError(root, 'خطا در بارگذاری لینک', String(err?.message || err));
  }

  if (!row) {
    return renderNotFound(root);
  }

  const snap = row.snapshot;
  if (!snap || !snap.type) {
    return renderError(root, 'محتوای لینک نامعتبر است', '');
  }

  renderPage(root, snap, row);
}

/* ---------- states ---------- */

function loadingSplash() {
  return el('div', { class: 'share-page share-page--loading' }, [
    el('div', { class: 'boot-loading' }, [
      el('div', { class: 'boot-loading__ring' }),
      el('div', { class: 'boot-loading__text', text: 'در حال بارگذاری اشتراک…' }),
    ]),
  ]);
}

function renderNotFound(root) {
  root.innerHTML = '';
  root.appendChild(el('div', { class: 'share-page share-page--center' }, [
    el('div', { class: 'share-page__error-icon', html: icon('xCircle', 40) }),
    el('div', { class: 'share-page__error-title', text: 'لینک پیدا نشد' }),
    el('div', { class: 'share-page__error-desc',
      text: 'ممکن است لینک منقضی شده باشد یا صاحبش آن را حذف کرده باشد.' }),
    el('a', { href: '/', class: 'btn btn--primary btn--lg', text: 'بازگشت به سوپرمارکت‌یار' }),
  ]));
}

function renderError(root, title, msg) {
  root.innerHTML = '';
  root.appendChild(el('div', { class: 'share-page share-page--center' }, [
    el('div', { class: 'share-page__error-icon', html: icon('alert', 40) }),
    el('div', { class: 'share-page__error-title', text: title }),
    msg ? el('div', { class: 'share-page__error-desc', text: msg }) : null,
    el('a', { href: '/', class: 'btn btn--primary btn--lg', text: 'بازگشت به سوپرمارکت‌یار' }),
  ].filter(Boolean)));
}

/* ---------- main page ---------- */

function renderPage(root, snap, row) {
  root.innerHTML = '';

  const page = el('div', { class: 'share-page' });

  // Top bar
  page.appendChild(el('div', { class: 'share-topbar' }, [
    el('a', { class: 'brand', href: '/' }, [
      el('span', { class: 'brand__mark', html: brandSvg() }),
      el('span', { class: 'brand__text' }, [
        el('span', { class: 'brand__title', text: 'سوپرمارکت‌یار' }),
        el('span', { class: 'brand__sub', text: 'دفترچهٔ خرید شخصی' }),
      ]),
    ]),
    el('a', { href: '/', class: 'btn btn--primary btn--sm',
      html: `${icon('external', 14)}<span>ورود / ثبت‌نام</span>` }),
  ]));

  const container = el('div', { class: 'share-container' });

  // Hero
  const entity = snap.type === 'shop' ? snap.shop : snap.product;
  const subtitle = snap.type === 'shop'
    ? (entity.category || 'فروشگاه')
    : [entity.category, entity.unit].filter(Boolean).join(' · ') || 'محصول';

  container.appendChild(el('div', { class: 'share-hero' }, [
    el('div', { class: 'share-hero__badge' }, [
      el('span', { html: icon(snap.type === 'shop' ? 'store' : 'package', 14) }),
      el('span', { text: snap.type === 'shop' ? 'فروشگاه' : 'محصول' }),
    ]),
    el('div', { class: 'share-hero__avatar',
      text: (entity.name?.[0] || '؟').toUpperCase() }),
    el('h1', { class: 'share-hero__title', text: entity.name || '—' }),
    subtitle ? el('div', { class: 'share-hero__sub', text: subtitle }) : null,
    entity.note ? el('div', { class: 'share-hero__note', text: entity.note }) : null,
    el('div', { class: 'share-hero__meta' }, [
      el('span', { text: `${formatNumber(snap.stats.total)} خرید ثبت‌شده` }),
      el('span', { class: 'share-hero__dot' }),
      el('span', { text: `${formatNumber(row.views)} بازدید` }),
      el('span', { class: 'share-hero__dot' }),
      el('span', { text: `به‌اشتراک‌گذاشته‌شده در ${formatDate(row.created_at)}` }),
    ]),
  ]));

  // Stats
  const stats = snap.stats;
  container.appendChild(el('div', { class: 'share-stats' }, [
    statBox('کل خریدها', stats.total, 'brand'),
    statBox('خرید خوب', stats.good, 'good'),
    statBox('نچندان خوب', stats.bad, 'bad'),
    statBox('افتضاح', stats.shit, 'shit'),
    statBox('مجموع هزینه', formatPrice(stats.spent), 'money'),
  ]));

  // Body
  if (snap.type === 'shop') {
    container.appendChild(renderShopBody(snap));
  } else {
    container.appendChild(renderProductBody(snap));
  }

  // CTA
  container.appendChild(el('div', { class: 'share-cta' }, [
    el('div', { class: 'share-cta__icon', html: icon('sparkles', 22) }),
    el('div', { class: 'share-cta__body' }, [
      el('div', { class: 'share-cta__title', text: 'دفترچهٔ خرید شخصی خودت را بساز' }),
      el('div', { class: 'share-cta__desc',
        text: 'فروشگاه‌های خوب را ذخیره کن، فروشنده‌های بد را علامت بزن و دفعهٔ بعد درست خرید کن.' }),
    ]),
    el('a', { href: '/', class: 'btn btn--primary btn--lg',
      html: `${icon('plus', 16)}<span>شروع کن</span>` }),
  ]));

  // Footer
  container.appendChild(el('div', { class: 'share-footer' }, [
    el('span', { text: 'ساخته‌شده با سوپرمارکت‌یار' }),
    el('a', { href: '/', text: 'ساخت حساب رایگان' }),
  ]));

  page.appendChild(container);
  root.appendChild(page);
}

function statBox(label, value, tone) {
  return el('div', { class: `share-stat share-stat--${tone}` }, [
    el('div', { class: 'share-stat__value', text: String(value) }),
    el('div', { class: 'share-stat__label', text: label }),
  ]);
}

function renderShopBody(snap) {
  const wrap = el('div', { class: 'share-body-grid' });

  // Top products
  const prodCard = el('div', { class: 'share-card' }, [
    el('div', { class: 'share-card__header' }, [
      el('span', { class: 'share-card__icon', html: icon('package', 16) }),
      el('div', { class: 'share-card__title', text: 'پرتکرارترین محصولات' }),
    ]),
  ]);
  if (!snap.products?.length) {
    prodCard.appendChild(el('div', { class: 'share-card__empty', text: 'داده‌ای نیست' }));
  } else {
    const list = el('div', { class: 'share-prod-list' });
    for (const p of snap.products) {
      const total = p.count || 1;
      const goodPct = Math.round((p.good / total) * 100);
      const shitPct = Math.round((p.shit / total) * 100);
      list.appendChild(el('div', { class: 'share-prod-row' }, [
        el('div', { class: 'share-prod-row__name', text: p.name || '—' }),
        el('div', { class: 'share-prod-row__bar' }, [
          goodPct ? el('span', { class: 'share-prod-row__seg share-prod-row__seg--good', style: { flex: String(goodPct) } }) : null,
          shitPct ? el('span', { class: 'share-prod-row__seg share-prod-row__seg--shit', style: { flex: String(shitPct) } }) : null,
        ].filter(Boolean)),
        el('div', { class: 'share-prod-row__count', text: `${formatNumber(p.count)}×` }),
      ]));
    }
    prodCard.appendChild(list);
  }
  wrap.appendChild(prodCard);

  // Recent purchases
  const recentCard = el('div', { class: 'share-card' }, [
    el('div', { class: 'share-card__header' }, [
      el('span', { class: 'share-card__icon', html: icon('clock', 16) }),
      el('div', { class: 'share-card__title', text: 'آخرین خریدها' }),
    ]),
  ]);
  if (!snap.recent?.length) {
    recentCard.appendChild(el('div', { class: 'share-card__empty', text: 'داده‌ای نیست' }));
  } else {
    const list = el('div', { class: 'share-recent-list' });
    for (const p of snap.recent) {
      const r = RATINGS[p.rating] || { label: '—' };
      list.appendChild(el('div', { class: 'share-recent-row' }, [
        el('div', { class: 'share-recent-row__main' }, [
          el('div', { class: 'share-recent-row__name', text: p.product_name || '—' }),
          el('div', { class: 'share-recent-row__meta' }, [
            p.platform_name ? el('span', { class: 'share-recent-row__platform' }, [
              p.platform_color
                ? el('span', { class: 'share-recent-row__dot', style: { background: p.platform_color } })
                : null,
              el('span', { text: p.platform_name }),
            ].filter(Boolean)) : null,
            el('span', { text: formatDate(p.date) }),
            p.price != null ? el('span', { text: formatPrice(p.price) }) : null,
          ].filter(Boolean)),
        ]),
        el('span', { class: `rating rating--${p.rating}` }, [
          el('span', { class: 'rating__dot' }),
          el('span', { text: r.label }),
        ]),
      ]));
    }
    recentCard.appendChild(list);
  }
  wrap.appendChild(recentCard);

  return wrap;
}

function renderProductBody(snap) {
  const wrap = el('div', { class: 'share-body-grid share-body-grid--single' });

  const shopCard = el('div', { class: 'share-card' }, [
    el('div', { class: 'share-card__header' }, [
      el('span', { class: 'share-card__icon', html: icon('store', 16) }),
      el('div', { class: 'share-card__title', text: 'مقایسهٔ فروشگاه‌ها' }),
    ]),
  ]);

  if (!snap.shops?.length) {
    shopCard.appendChild(el('div', { class: 'share-card__empty', text: 'داده‌ای نیست' }));
  } else {
    const list = el('div', { class: 'share-shop-list' });
    const best = snap.shops.reduce((acc, s) => {
      const score = s.good - s.shit;
      return score > (acc?.score ?? -Infinity) ? { ...s, score } : acc;
    }, null);

    for (const s of snap.shops) {
      const isBest = best && s.name === best.name && (s.good - s.shit) > 0;
      const total = s.count || 1;
      const goodPct = Math.round((s.good / total) * 100);
      const badPct = Math.round((s.bad / total) * 100);
      const shitPct = Math.round((s.shit / total) * 100);

      list.appendChild(el('div', { class: 'share-shop-row' + (isBest ? ' is-best' : '') }, [
        el('div', { class: 'share-shop-row__avatar', text: (s.name?.[0] || '؟').toUpperCase() }),
        el('div', { class: 'share-shop-row__body' }, [
          el('div', { class: 'share-shop-row__name' }, [
            document.createTextNode(s.name || '—'),
            isBest ? el('span', { class: 'share-shop-row__best', text: 'بهترین' }) : null,
          ].filter(Boolean)),
          s.category ? el('div', { class: 'share-shop-row__category', text: s.category }) : null,
          el('div', { class: 'share-shop-row__bar' }, [
            goodPct ? el('span', { class: 'share-shop-row__seg share-shop-row__seg--good', style: { flex: String(goodPct) } }) : null,
            badPct ? el('span', { class: 'share-shop-row__seg share-shop-row__seg--bad', style: { flex: String(badPct) } }) : null,
            shitPct ? el('span', { class: 'share-shop-row__seg share-shop-row__seg--shit', style: { flex: String(shitPct) } }) : null,
          ].filter(Boolean)),
          el('div', { class: 'share-shop-row__meta' }, [
            el('span', { text: `${formatNumber(s.good)} خوب · ${formatNumber(s.bad)} بد · ${formatNumber(s.shit)} افتضاح` }),
            s.avg_price != null
              ? el('span', { text: ' · میانگین ' + formatPrice(s.avg_price) })
              : null,
          ].filter(Boolean)),
        ]),
      ]));
    }
    shopCard.appendChild(list);
  }
  wrap.appendChild(shopCard);
  return wrap;
}

function brandSvg() {
  return `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M6 10h20l-2.5 15h-15L6 10z" stroke="white" stroke-width="2" stroke-linejoin="round"/>
    <path d="M11 10a5 5 0 0 1 10 0" stroke="white" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}
