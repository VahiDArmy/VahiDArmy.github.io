/**
 * Person detail page
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { ROUTES, PEOPLE_STATUS_LABELS } from '../config/constants.js';
import { peopleService } from '../services/people.service.js';
import { tellallsService } from '../services/tellalls.service.js';
import { emptyState } from '../components/empty-state.js';
import { relatedSection } from '../components/related-section.js';
import { confirmAndDelete } from '../components/confirm-delete.js';
import { openPersonForm } from '../components/person-form.js';
import { requireAuthOrRedirect, canEditContent } from '../components/auth-guard.js';
import { renderMentions } from '../utils/render-mentions.js';
import { formatDate, initials } from '../utils/format.js';

function statusBadgeClass(status) {
  switch (status) {
    case 'in_site': return 'badge--success';
    case 'not_in_site': return 'badge--warning';
    case 'former': return 'badge--outline';
    default: return 'badge';
  }
}

export default async function personPage(info, outlet) {
  const session = await requireAuthOrRedirect();
  if (!session) return () => {};

  const id = info?.params?.id;
  if (!id) {
    router.navigate(ROUTES.PEOPLE, { replace: true });
    return () => {};
  }

  outlet.innerHTML = '';
  outlet.appendChild(buildLoading());

  let person;
  let related = { theories: [], stories: [], projects: [], tellalls: [], links: [] };
  let allPeople = [];
  
  try {
    person = await peopleService.getById(id);
    if (!person) {
      outlet.innerHTML = '';
      outlet.appendChild(buildNotFound());
      return () => {};
    }

    const [relData, tellallsData, peopleRes] = await Promise.all([
      peopleService.related(id),
      tellallsService.getByPersonId(id).catch(() => []),
      peopleService.list({ limit: 500 }) // Fetch all people to render mentions in bio
    ]);
    
    related = { ...relData, tellalls: tellallsData };
    allPeople = peopleRes.items;

  } catch (err) {
    outlet.innerHTML = '';
    outlet.appendChild(
      el('div', { class: 'container' }, [
        emptyState({
          iconName: 'alert-circle',
          title: 'خطا در بارگذاری',
          description: err?.message || 'این فرد یافت نشد.',
          actions: [
            el(
              'a',
              { class: 'btn btn--primary', href: router.href(ROUTES.PEOPLE) },
              ['بازگشت به فهرست افراد']
            ),
          ],
        }),
      ])
    );
    return () => {};
  }

  outlet.innerHTML = '';
  outlet.appendChild(buildView(person, related, allPeople));
  return () => {};
}

function buildLoading() {
  return el('div', { class: 'container' }, [
    el('div', { class: 'page-loading' }, [
      el('div', { class: 'skeleton skeleton--title' }),
      el('div', { class: 'skeleton skeleton--block' }),
      el('div', { class: 'skeleton skeleton--block' }),
    ]),
  ]);
}

function buildNotFound() {
  return el('div', { class: 'container' }, [
    emptyState({
      iconName: 'user',
      title: 'فرد پیدا نشد',
      description: 'این فرد وجود ندارد یا حذف شده است.',
      actions: [el('a', { class: 'btn btn--primary', href: router.href(ROUTES.PEOPLE) }, ['بازگشت'])],
    }),
  ]);
}

function buildView(person, related, allPeople) {
  const avatarInner = person.avatar_url
    ? el('img', { src: person.avatar_url, alt: person.full_name || '', loading: 'lazy' })
    : el('span', {}, [initials(person.full_name || '')]);

  const canEdit = canEditContent();

  const actions = el('div', { class: 'person-hero__actions' }, [
    canEdit
      ? el(
          'button',
          {
            type: 'button',
            class: 'btn btn--secondary btn--sm',
            on: { click: async () => {
              const updated = await openPersonForm({ person });
              if (updated) {
                const currentPath = router.getCurrent()?.path || '';
                router.navigate(currentPath, { replace: true });
              }
            }},
          },
          [icon('edit'), 'ویرایش']
        )
      : null,
    canEdit
      ? el(
          'button',
          {
            type: 'button',
            class: 'btn btn--danger btn--sm',
            on: {
              click: () =>
                confirmAndDelete({
                  title: 'حذف فرد',
                  message: `«${person.full_name}» حذف شود؟`,
                  onConfirm: () => peopleService.remove(person.id),
                  successMessage: 'فرد حذف شد.',
                  onDeleted: () => router.navigate(ROUTES.PEOPLE, { replace: true }),
                }),
            },
          },
          [icon('trash'), 'حذف']
        )
      : null,
  ].filter(Boolean));

  const bioHtml = person.bio ? renderMentions(person.bio, allPeople) : null;

  const hero = el('div', { class: 'person-hero' }, [
    el('div', { class: 'person-hero__avatar' }, [el('span', { class: 'avatar avatar--2xl' }, [avatarInner])]),
    el('div', { class: 'person-hero__main' }, [
      el('div', { class: 'person-hero__title-row' }, [
        el('div', {}, [
          el('h1', { class: 'person-hero__name' }, [person.full_name || 'بدون نام']),
          el('div', { class: 'person-hero__job' }, [
            person.job_title || 'بدون سمت',
            person.department ? ` — ${person.department}` : '',
          ]),
        ]),
        actions,
      ]),
      el('div', { class: 'person-hero__badges' }, [
        person.status ? el('span', { class: `badge ${statusBadgeClass(person.status)}` }, [PEOPLE_STATUS_LABELS[person.status] || person.status]) : null,
        ...(person.tags || []).map((t) => el('span', { class: 'chip chip--brand' }, [t])),
      ]),
      bioHtml ? el('p', { class: 'person-hero__bio', html: bioHtml }) : null,
    ]),
  ]);

  const info = el('div', { class: 'person-info' }, [
    person.email ? infoItem('ایمیل', person.email) : null,
    person.phone ? infoItem('تلفن', person.phone) : null,
    person.hire_date ? infoItem('تاریخ استخدام', formatDate(person.hire_date)) : null,
    person.birth_date ? infoItem('تاریخ تولد', formatDate(person.birth_date)) : null,
  ].filter(Boolean));

  const relatedTellalls = relatedSection({
    title: 'بگایی‌های مرتبط',
    iconName: 'message',
    items: (related.tellalls || []).map((t) => ({
      title: t.title,
      meta: t.created_at ? formatDate(t.created_at) : '',
      href: `/tellalls/${t.id}`,
    })),
    emptyText: 'هیچ بگایی مرتبط با این فرد ثبت نشده است.',
    viewAllHref: `/tellalls?person=${person.id}`,
  });

  const relatedTheories = relatedSection({
    title: 'نظریه‌های مرتبط',
    iconName: 'lightbulb',
    items: (related.theories || []).map((t) => ({
      title: t.title,
      meta: t.created_at ? formatDate(t.created_at) : '',
      href: ROUTES.THEORY(t.id),
    })),
    emptyText: 'هیچ نظریه‌ای مرتبط با این فرد ثبت نشده است.',
    viewAllHref: `/theories?person=${person.id}`,
  });

  const relatedStories = relatedSection({
    title: 'روایت‌ها',
    iconName: 'message',
    items: (related.stories || []).map((s) => ({
      title: s.title,
      meta: s.created_at ? formatDate(s.created_at) : '',
      href: `/stories/${s.id}`,
    })),
    emptyText: 'روایتی مرتبط با این فرد ثبت نشده است.',
  });

  const relatedProjects = relatedSection({
    title: 'پروژه‌ها',
    iconName: 'folder',
    items: (related.projects || []).map((p) => ({
      title: p.title,
      meta: p.status || '',
      href: `/projects/${p.id}`,
    })),
    emptyText: 'پروژه‌ای مرتبط با این فرد ثبت نشده است.',
  });

  const back = el('a', { class: 'person-back', href: router.href(ROUTES.PEOPLE) }, [icon('chevron-right'), 'بازگشت به افراد']);

  return el('div', { class: 'container' }, [
    el('div', { class: 'person-detail' }, [
      back,
      hero,
      info,
      relatedTellalls,
      el('div', { class: 'form-grid form-grid--2', style: { alignItems: 'start' } }, [
        relatedTheories,
        relatedStories,
      ]),
      relatedProjects,
    ]),
  ]);
}

function infoItem(label, value) {
  return el('div', { class: 'person-info__item' }, [
    el('div', { class: 'person-info__label' }, [label]),
    el('div', { class: 'person-info__value' }, [value || '—']),
  ]);
}