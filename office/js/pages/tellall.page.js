/**
 * Tellall detail page — full content, central person, related people, and entries.
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { appStore } from '../core/store.js';
import { ROUTES } from '../config/constants.js';
import { tellallsService } from '../services/tellalls.service.js';
import { peopleService } from '../services/people.service.js';
import { emptyState } from '../components/empty-state.js';
import { requireAuthOrRedirect } from '../components/auth-guard.js';
import { createMentionTextarea } from '../components/mention-textarea.js';
import { renderMentions } from '../utils/render-mentions.js';
import { toast } from '../ui/toast.js';
import { formatDate, formatNumber, initials, timeAgo } from '../utils/format.js';

export default async function tellallPage(info, outlet) {
  const session = await requireAuthOrRedirect();
  if (!session) return () => {};

  const id = info?.params?.id;
  if (!id) {
    router.navigate('/tellalls', { replace: true });
    return () => {};
  }

  outlet.innerHTML = '';
  outlet.appendChild(buildLoading());

  let tellall;
  let peopleList = [];

  try {
    // Fetch tellall and all people in parallel
    // (fetching all people is required for @mention rendering and selection)
    const [tellallRes, peopleRes] = await Promise.all([
      tellallsService.getById(id),
      peopleService.list({ limit: 500 })
    ]);

    tellall = tellallRes;
    peopleList = peopleRes.items;

    if (!tellall) {
      outlet.innerHTML = '';
      outlet.appendChild(
        el('div', { class: 'container' }, [
          emptyState({
            iconName: 'message',
            title: 'بگایی پیدا نشد',
            description: 'این موضوع وجود ندارد یا حذف شده است.',
            actions: [
              el('a', { class: 'btn btn--primary', href: router.href('/tellalls') }, ['بازگشت']),
            ],
          }),
        ])
      );
      return () => {};
    }
  } catch (err) {
    outlet.innerHTML = '';
    outlet.appendChild(
      el('div', { class: 'container' }, [
        emptyState({
          iconName: 'alert-circle',
          title: 'خطا در بارگذاری',
          description: err?.message || 'این بگایی بارگذاری نشد.',
        }),
      ])
    );
    return () => {};
  }

  outlet.innerHTML = '';
  outlet.appendChild(buildView(tellall, peopleList));

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

function buildView(tellall, peopleList) {
  const user = appStore.get('user');
  const profile = appStore.get('profile');

  // Resolve related people (tags)
  const relatedPeopleData = (tellall.related_people || [])
    .map(id => peopleList.find(p => p.id === id))
    .filter(Boolean);

  // Central person
  const centralPerson = tellall.person;

  /* ---- Header ---- */
  const back = el(
    'a',
    { class: 'tellall-back', href: router.href('/tellalls') },
    [icon('chevron-right'), 'بازگشت به بگایی‌ها']
  );

  const metaRow = el('div', { class: 'tellall-head__meta' }, [
    el('span', { class: 'tellall-head__meta-item' }, [
      icon('clock'),
      formatDate(tellall.created_at, { withTime: true })
    ]),
    el('span', { class: 'tellall-head__meta-item' }, [
      icon('user'),
      `نویسنده: ${tellall.author?.display_name || 'کاربر'}`
    ]),
    centralPerson ? el('span', { class: 'tellall-head__meta-item' }, [
      icon('flag'),
      `شخص محوری: `,
      el('a', { href: router.href(ROUTES.PERSON(centralPerson.id)), class: 'link' }, [centralPerson.full_name])
    ]) : null
  ]);

  const tagsRow = relatedPeopleData.length > 0 
    ? el('div', { class: 'tellall-head__tags' }, [
        el('span', { class: 'text-xs text-muted', style: { marginLeft: '8px' } }, ['افراد تگ شده:']),
        ...relatedPeopleData.map(p => 
          el('a', { 
            href: router.href(ROUTES.PERSON(p.id)), 
            class: 'chip chip--interactive' 
          }, [
            el('span', { class: 'chip__avatar' }, [
              p.avatar_url ? el('img', { src: p.avatar_url, alt: p.full_name }) : initials(p.full_name)
            ]),
            el('span', { class: 'chip__label' }, [p.full_name])
          ])
        )
      ])
    : null;

  const head = el('div', { class: 'tellall-head' }, [
    el('h1', { class: 'tellall-head__title' }, [tellall.title || 'بدون عنوان']),
    metaRow,
    tagsRow
  ].filter(Boolean));

  /* ---- Main Content ---- */
  // Convert @mentions to clickable links
  const bodyHtml = renderMentions(tellall.description || '', peopleList);
  const body = el('div', { class: 'tellall-content', html: bodyHtml });

  const bodyCard = el('div', { class: 'tellall-body-card' }, [head, body]);

  /* ---- Entries (Replies) ---- */
  const entries = tellall.entries || [];
  
  const entriesList = el('div', { class: 'entries-list' });
  const renderEntries = () => {
    entriesList.innerHTML = '';
    if (!entries.length) {
      entriesList.appendChild(
        el('div', { style: { padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-tertiary)' } }, [
          'هنوز پاسخی ثبت نشده است.'
        ])
      );
      return;
    }

    // Sort by date
    const sortedEntries = [...entries].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    for (const entry of sortedEntries) {
      const authorName = entry.author?.display_name || 'کاربر';
      const authorAvatar = entry.author?.avatar_url;
      const entryHtml = renderMentions(entry.content, peopleList);

      entriesList.appendChild(
        el('div', { class: 'entry' }, [
          el('div', { class: 'entry__avatar' }, [
            el('span', { class: 'avatar' }, [
              authorAvatar ? el('img', { src: authorAvatar, alt: authorName }) : initials(authorName)
            ])
          ]),
          el('div', { class: 'entry__main' }, [
            el('div', { class: 'entry__head' }, [
              el('span', { class: 'entry__author' }, [authorName]),
              el('span', { class: 'entry__time' }, [timeAgo(entry.created_at)])
            ]),
            el('div', { class: 'entry__body', html: entryHtml })
          ])
        ])
      );
    }
  };
  renderEntries();

  /* ---- Composer ---- */
  let composer = null;
  if (user) {
    const editor = createMentionTextarea({
      people: peopleList,
      placeholder: 'پاسخ یا جزئیات جدیدی اضافه کنید...\nبرای تگ کردن از @ استفاده کنید.',
      rows: 3,
      minHeight: '100px'
    });

    const submitBtn = el('button', {
      type: 'button',
      class: 'btn btn--primary btn--sm',
      on: {
        click: async () => {
          const content = editor.getValue().trim();
          if (!content) {
            toast.warning('متن پاسخ نمی‌تواند خالی باشد.');
            return;
          }

          submitBtn.classList.add('is-loading');
          submitBtn.disabled = true;

          try {
            const newEntry = await tellallsService.addEntry(tellall.id, content, tellall.person_id);
            entries.push(newEntry);
            editor.setValue('');
            renderEntries();
            toast.success('پاسخ شما ثبت شد.');
          } catch (err) {
            toast.error(err?.message || 'خطا در ثبت پاسخ.');
          } finally {
            submitBtn.classList.remove('is-loading');
            submitBtn.disabled = false;
          }
        }
      }
    }, [icon('send'), 'ارسال پاسخ']);

    composer = el('div', { class: 'entry-composer' }, [
      el('div', { class: 'entry-composer__avatar' }, [
        el('span', { class: 'avatar' }, [
          profile?.avatar_url ? el('img', { src: profile.avatar_url, alt: profile.display_name }) : initials(profile?.display_name || 'کاربر')
        ])
      ]),
      el('div', { class: 'entry-composer__main' }, [
        editor.node,
        el('div', { class: 'entry-composer__actions' }, [submitBtn])
      ])
    ]);
  } else {
    composer = el('div', { class: 'entry-composer', style: { justifyContent: 'center', color: 'var(--text-secondary)' } }, [
      el('span', {}, ['برای ثبت پاسخ ']),
      el('a', { href: router.href(ROUTES.LOGIN), class: 'link' }, ['وارد شوید']),
      el('span', {}, ['.'])
    ]);
  }

  const entriesSection = el('section', { class: 'entries-section' }, [
    el('div', { class: 'entries-section__head' }, [
      icon('message'),
      'پاسخ‌ها و جزئیات',
      el('span', { class: 'entries-section__count' }, [`(${formatNumber(entries.length)})`])
    ]),
    entriesList,
    composer
  ]);

  return el('div', { class: 'container container--narrow' }, [
    el('div', { class: 'tellall-detail' }, [back, bodyCard, entriesSection])
  ]);
}