/**
 * Home page — hero, stats, recent items for signed-in users.
 * Signed-out users see a marketing hero and feature overview.
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { appStore } from '../core/store.js';
import { ROUTES } from '../config/constants.js';
import { peopleService } from '../services/people.service.js';
import { theoriesService } from '../services/theories.service.js';
import { rankingsService } from '../services/rankings.service.js';
import { tablesService } from '../services/tables.service.js';
import { formatNumber, timeAgo, truncateText } from '../utils/format.js';

export default async function homePage(info, outlet) {
  outlet.innerHTML = '';
  const root = el('div', { class: 'container' }, [el('div', { class: 'home' })]);
  outlet.appendChild(root);
  const home = root.querySelector('.home');

  const user = appStore.get('user');
  const profile = appStore.get('profile');

  // Hero
  home.appendChild(buildHero(user, profile));

  if (!user) {
    home.appendChild(buildFeatures());
    return () => {};
  }

  // Load stats + recent
  try {
    const [peopleRes, theoriesRes, rankingsRes, tablesRes] = await Promise.all([
      peopleService.list({ limit: 1 }),
      theoriesService.list({ limit: 5, status: 'published', sort: 'created_at', direction: 'desc' }),
      rankingsService.list({ limit: 1 }),
      tablesService.list({ limit: 1 }),
    ]);

    home.appendChild(
      el('section', { class: 'home-stats' }, [
        statCard('users', peopleRes.total, 'افراد اداره', ROUTES.PEOPLE, 'در بایگانی'),
        statCard('lightbulb', theoriesRes.total, 'نظریه‌ها', ROUTES.THEORIES, 'منتشرشده'),
        statCard('trophy', rankingsRes.total, 'رتبه‌بندی‌ها', ROUTES.RANKINGS, 'فهرست‌های امتیاز'),
        statCard('table', tablesRes.total, 'جدول‌ها', ROUTES.TABLES, 'داده‌های سفارشی'),
      ])
    );

    if (theoriesRes.items.length) {
      home.appendChild(buildRecentTheories(theoriesRes.items));
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[home] stats', err);
  }

  return () => {};
}

function buildHero(user, profile) {
  const signedIn = !!user;
  const displayName = profile?.display_name || user?.email?.split('@')[0];

  return el('section', { class: 'home-hero' }, [
    el('div', { class: 'home-hero__content' }, [
      el('span', { class: 'home-hero__eyebrow' }, [
        signedIn ? 'بایگانی داخلی اداره' : 'به اداره خوش آمدید',
      ]),
      el('h1', { class: 'home-hero__title' }, [
        signedIn ? `${greeting()}، ${displayName || 'همکار'}` : 'The Office',
      ]),
      el('p', { class: 'home-hero__subtitle' }, [
        signedIn
          ? 'همه افراد، نظریه‌ها، رتبه‌بندی‌ها و جدول‌های اداره در یک‌جا.'
          : 'بایگانی داخلی اداره؛ افراد، نظریه‌ها، رتبه‌بندی‌ها و جدول‌های داده — همه در یک پلتفرم.',
      ]),
      el('div', { class: 'home-hero__actions' }, [
        signedIn
          ? el('a', { class: 'btn btn--primary btn--lg', href: router.href(ROUTES.PEOPLE) }, [
              icon('users'),
              'مشاهده افراد',
            ])
          : el('a', { class: 'btn btn--primary btn--lg', href: router.href(ROUTES.SIGNUP) }, [
              'شروع کنید',
            ]),
        signedIn
          ? el('a', { class: 'btn btn--secondary btn--lg', href: router.href(ROUTES.THEORIES) }, [
              icon('lightbulb'),
              'نظریه‌ها',
            ])
          : el('a', { class: 'btn btn--secondary btn--lg', href: router.href(ROUTES.LOGIN) }, [
              'ورود به حساب',
            ]),
      ]),
    ]),
  ]);
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'شب بخیر';
  if (h < 12) return 'صبح بخیر';
  if (h < 17) return 'وقت بخیر';
  return 'عصر بخیر';
}

function statCard(iconName, value, label, href, hint) {
  return el('a', { class: 'stat-card', href: router.href(href) }, [
    el('div', { class: 'stat-card__icon' }, [icon(iconName)]),
    el('div', { class: 'stat-card__value' }, [formatNumber(value || 0)]),
    el('div', { class: 'stat-card__label' }, [label]),
    hint ? el('div', { class: 'stat-card__hint' }, [hint]) : null,
  ]);
}

function buildFeatures() {
  return el('section', { class: 'home-section' }, [
    el('div', { class: 'home-section__head' }, [
      el('h2', { class: 'home-section__title' }, ['چه چیزهایی در اداره پیدا می‌کنید']),
    ]),
    el('div', { class: 'home-features' }, [
      featureCard(
        'users',
        'افراد اداره',
        'پروفایل کامل همکاران، سمت، دپارتمان و ارتباطات بین آن‌ها.'
      ),
      featureCard(
        'lightbulb',
        'نظریه‌ها',
        'نظریه‌های تیمی درباره افراد و رویدادها، با رأی و کامنت.'
      ),
      featureCard(
        'trophy',
        'رتبه‌بندی‌ها',
        'فهرست‌های رتبه‌بندی سفارشی بر اساس معیارهای مختلف.'
      ),
      featureCard(
        'table',
        'جدول‌های داده',
        'جدول‌های سفارشی با ستون‌های دلخواه برای هر نوع اطلاعات.'
      ),
    ]),
  ]);
}

function featureCard(iconName, title, description) {
  return el('div', { class: 'feature-card' }, [
    el('div', { class: 'feature-card__icon' }, [icon(iconName)]),
    el('div', { class: 'feature-card__title' }, [title]),
    el('p', { class: 'feature-card__desc' }, [description]),
  ]);
}

function buildRecentTheories(items) {
  const list = el('div', { class: 'recent-list' }, []);

  for (const theory of items) {
    const meta = [
      theory.created_at ? el('span', {}, [timeAgo(theory.created_at)]) : null,
      theory.score != null
        ? el('span', { class: 'recent-item__score' }, [
            icon('thumbs-up'),
            formatNumber(theory.score),
          ])
        : null,
    ].filter(Boolean);

    list.appendChild(
      el(
        'a',
        {
          class: 'recent-item',
          href: router.href(ROUTES.THEORY(theory.id)),
        },
        [
          el('div', { class: 'recent-item__main' }, [
            el('div', { class: 'recent-item__title' }, [
              truncateText(theory.title, 90),
            ]),
            el('div', { class: 'recent-item__meta' }, meta),
          ]),
          icon('chevron-left'),
        ]
      )
    );
  }

  return el('section', { class: 'home-section' }, [
    el('div', { class: 'home-section__head' }, [
      el('h2', { class: 'home-section__title' }, ['آخرین نظریه‌ها']),
      el(
        'a',
        { class: 'home-section__link', href: router.href(ROUTES.THEORIES) },
        ['همه', icon('arrow-left')]
      ),
    ]),
    list,
  ]);
}