/**
 * Theory detail page
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { appStore } from '../core/store.js';
import { ROUTES, THEORY_STATUS_LABELS } from '../config/constants.js';
import { theoriesService } from '../services/theories.service.js';
import { peopleService } from '../services/people.service.js';
import { emptyState } from '../components/empty-state.js';
import { confirmAndDelete } from '../components/confirm-delete.js';
import { toast } from '../ui/toast.js';
import { open as openModal } from '../ui/modal.js';
import { formatDate, formatNumber, initials, timeAgo, truncateText } from '../utils/format.js';
import { requireAuthOrRedirect, canEditContent } from '../components/auth-guard.js';

function statusBadgeClass(status) {
  switch (status) {
    case 'published': return 'badge--success';
    case 'draft':     return 'badge--warning';
    case 'archived':  return 'badge--outline';
    default: return 'badge';
  }
}

export default async function theoryPage(info, outlet) {
  const session = await requireAuthOrRedirect();
  if (!session) return () => {};

  const id = info?.params?.id;
  if (!id) {
    router.navigate(ROUTES.THEORIES, { replace: true });
    return () => {};
  }

  outlet.innerHTML = '';
  outlet.appendChild(buildLoading());

  let theory;
  let myVote = 0;
  let people = [];
  let comments = [];

  try {
    theory = await theoriesService.getById(id);
    if (!theory) {
      outlet.innerHTML = '';
      outlet.appendChild(
        el('div', { class: 'container' }, [
          emptyState({
            iconName: 'lightbulb',
            title: 'نظریه پیدا نشد',
            description: 'این نظریه وجود ندارد یا حذف شده است.',
            actions: [
              el('a', { class: 'btn btn--primary', href: router.href(ROUTES.THEORIES) }, ['بازگشت']),
            ],
          }),
        ])
      );
      return () => {};
    }

    const [vote, commentsRes] = await Promise.all([
      appStore.get('user') ? theoriesService.myVote(id) : Promise.resolve(0),
      theoriesService.listComments(id),
    ]);
    myVote = vote || 0;
    comments = commentsRes || [];

    if (theory.related_people && theory.related_people.length) {
      const fetched = await Promise.all(
        theory.related_people.map((pid) => peopleService.getById(pid).catch(() => null))
      );
      people = fetched.filter(Boolean);
    }
  } catch (err) {
    outlet.innerHTML = '';
    outlet.appendChild(
      el('div', { class: 'container' }, [
        emptyState({
          iconName: 'alert-circle',
          title: 'خطا در بارگذاری',
          description: err?.message || 'این نظریه بارگذاری نشد.',
        }),
      ])
    );
    return () => {};
  }

  outlet.innerHTML = '';
  outlet.appendChild(buildView(theory, { myVote, people, comments }));

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

function buildView(theory, { myVote, people, comments }) {
  const canEdit = canEditContent();
  const isAuthor = appStore.get('user') && theory.author_id === appStore.get('user').id;
  const canDelete = canEdit || isAuthor;

  /* ---- Head ---- */
  const upBtn = voteButton('up', myVote === 1, 'رأی مثبت', () => castVote(1));
  const downBtn = voteButton('down', myVote === -1, 'رأی منفی', () => castVote(-1));
  const scoreNode = el(
    'span',
    {
      class: `theory-card__score${theory.score > 0 ? ' is-positive' : theory.score < 0 ? ' is-negative' : ''}`,
    },
    [formatNumber(theory.score || 0)]
  );

  const badges = [
    theory.status
      ? el('span', { class: `badge ${statusBadgeClass(theory.status)}` }, [
          THEORY_STATUS_LABELS[theory.status] || theory.status,
        ])
      : null,
    ...(theory.tags || []).map((t) => el('span', { class: 'chip chip--brand' }, [t])),
  ].filter(Boolean);

  const metaRow = el('div', { class: 'theory-head__meta' }, [
    el('span', { class: 'theory-head__meta-item' }, [
      icon('clock'),
      formatDate(theory.created_at, { withTime: true }),
    ]),
    theory.updated_at && theory.updated_at !== theory.created_at
      ? el('span', { class: 'theory-head__meta-item' }, [
          icon('refresh'),
          `ویرایش: ${timeAgo(theory.updated_at)}`,
        ])
      : null,
    el('span', { class: 'theory-head__meta-item' }, [
      icon('message'),
      `${formatNumber(theory.comments_count || comments.length)} نظر`,
    ]),
  ].filter(Boolean));

  const actions = el('div', { class: 'theory-head__actions' }, [
    canDelete
      ? el(
          'button',
          {
            type: 'button',
            class: 'btn btn--secondary btn--sm',
            on: { click: () => router.navigate(`/theories/${theory.id}/edit`) },
          },
          [icon('edit'), 'ویرایش']
        )
      : null,
    canDelete
      ? el(
          'button',
          {
            type: 'button',
            class: 'btn btn--danger btn--sm',
            on: {
              click: () =>
                confirmAndDelete({
                  title: 'حذف نظریه',
                  message: `«${theory.title}» حذف شود؟`,
                  onConfirm: () => theoriesService.remove(theory.id),
                  successMessage: 'نظریه حذف شد.',
                  onDeleted: () => router.navigate(ROUTES.THEORIES, { replace: true }),
                }),
            },
          },
          [icon('trash'), 'حذف']
        )
      : null,
  ].filter(Boolean));

  const head = el('div', { class: 'theory-head' }, [
    el('div', { class: 'theory-head__vote' }, [upBtn, scoreNode, downBtn]),
    el('div', { class: 'theory-head__main' }, [
      el('h1', { class: 'theory-head__title' }, [theory.title || '']),
      metaRow,
      badges.length ? el('div', { class: 'theory-head__badges' }, badges) : null,
    ]),
    actions,
  ]);

  /* ---- Body ---- */
  const body = el('div', { class: 'theory-content' }, [
    theory.body || theory.summary || 'محتوایی ثبت نشده است.',
  ]);

  /* ---- Related people ---- */
  let relatedPeopleNode = null;
  if (people.length) {
    relatedPeopleNode = el('div', { class: 'theory-related-people' }, [
      el('span', { class: 'theory-related-people__label' }, ['افراد مرتبط:']),
      ...people.map((p) =>
        el(
          'a',
          {
            href: router.href(ROUTES.PERSON(p.id)),
            class: 'chip chip--interactive',
          },
          [
            el('span', { class: 'chip__avatar' }, [
              p.avatar_url
                ? el('img', { src: p.avatar_url, alt: p.full_name })
                : initials(p.full_name || ''),
            ]),
            el('span', { class: 'chip__label' }, [truncateText(p.full_name || '', 30)]),
          ]
        )
      ),
    ]);
  }

  const bodyCard = el('div', { class: 'theory-body-card' }, [
    head,
    body,
    relatedPeopleNode,
  ]);

  /* ---- Comments ---- */
  const commentsNode = buildComments(theory, comments);

  /* ---- Back ---- */
  const back = el(
    'a',
    { class: 'theory-back', href: router.href(ROUTES.THEORIES) },
    [icon('chevron-right'), 'بازگشت به نظریه‌ها']
  );

  /* ---- Vote logic ---- */
  async function castVote(value) {
    if (!appStore.get('user')) {
      toast.warning('برای رأی دادن وارد شوید.');
      router.navigate(ROUTES.LOGIN);
      return;
    }
    try {
      const next = myVote === value ? 0 : value;
      const updated = await theoriesService.vote(theory.id, next);
      theory.score = updated?.score ?? theory.score;
      theory.votes_count = updated?.votes_count ?? theory.votes_count;
      myVote = next;
      upBtn.classList.toggle('is-active', myVote === 1);
      upBtn.setAttribute('aria-pressed', myVote === 1 ? 'true' : 'false');
      downBtn.classList.toggle('is-active', myVote === -1);
      downBtn.setAttribute('aria-pressed', myVote === -1 ? 'true' : 'false');
      scoreNode.textContent = formatNumber(theory.score || 0);
      scoreNode.className = `theory-card__score${
        theory.score > 0 ? ' is-positive' : theory.score < 0 ? ' is-negative' : ''
      }`;
    } catch (err) {
      toast.error(err?.message || 'ثبت رأی ناموفق بود.');
    }
  }

  return el('div', { class: 'container' }, [
    el('div', { class: 'theory-detail' }, [back, bodyCard, commentsNode]),
  ]);
}

function voteButton(dir, active, label, onClick) {
  return el(
    'button',
    {
      type: 'button',
      class: `theory-card__vote-btn is-${dir}${active ? ' is-active' : ''}`,
      'aria-label': label,
      'aria-pressed': active ? 'true' : 'false',
      on: { click: onClick },
    },
    [icon(dir === 'up' ? 'chevron-up' : 'chevron-down')]
  );
}

function buildComments(theory, comments) {
  const list = el('div', { class: 'comments-list' });
  const renderList = () => {
    list.innerHTML = '';
    if (!comments.length) {
      list.appendChild(
        el('div', { style: { padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-tertiary)' } }, ['هنوز نظری ثبت نشده است. اولین نفر باشید!'])
      );
      return;
    }
    for (const c of comments) list.appendChild(renderComment(c));
  };
  renderList();

  /* Compose */
  const user = appStore.get('user');
  const profile = appStore.get('profile');
  const name = profile?.display_name || user?.email?.split('@')[0] || 'کاربر';

  let composer = null;
  if (user) {
    const textarea = el('textarea', {
      class: 'comment-composer__textarea',
      placeholder: 'نظر خود را بنویسید...',
      maxlength: 2000,
    });
    const submitBtn = el(
      'button',
      {
        type: 'button',
        class: 'btn btn--primary btn--sm',
        on: {
          click: async () => {
            const body = textarea.value.trim();
            if (!body) {
              toast.warning('متن نظر خالی است.');
              return;
            }
            submitBtn.classList.add('is-loading');
            submitBtn.disabled = true;
            try {
              const c = await theoriesService.addComment(theory.id, body);
              comments.push({
                ...c,
                profiles: { display_name: name, avatar_url: profile?.avatar_url },
              });
              textarea.value = '';
              renderList();
              toast.success('نظر شما ثبت شد.');
            } catch (err) {
              toast.error(err?.message || 'ثبت نظر ناموفق بود.');
            } finally {
              submitBtn.classList.remove('is-loading');
              submitBtn.disabled = false;
            }
          },
        },
      },
      [icon('send'), 'ارسال']
    );

    composer = el('div', { class: 'comment-composer' }, [
      el('span', { class: 'comment-composer__avatar' }, [
        el('span', { class: 'avatar' }, [profile?.avatar_url ? el('img', { src: profile.avatar_url, alt: name }) : initials(name)]),
      ]),
      el('div', { class: 'comment-composer__main' }, [textarea, el('div', { class: 'comment-composer__actions' }, [submitBtn])]),
    ]);
  } else {
    composer = el('div', { class: 'comment-composer', style: { justifyContent: 'center', textAlign: 'center', color: 'var(--text-secondary)' } }, [
      el('span', {}, ['برای ثبت نظر ']),
      el('a', { href: router.href(ROUTES.LOGIN), class: 'link' }, ['وارد شوید']),
      el('span', {}, ['.']),
    ]);
  }

  return el('section', { class: 'comments-section' }, [
    el('div', { class: 'comments-section__head' }, [
      icon('message'),
      'نظرات',
      el('span', { class: 'comments-section__count' }, [`(${formatNumber(comments.length)})`]),
    ]),
    list,
    composer,
  ]);

  function renderComment(c) {
    const authorName = c.profiles?.display_name || 'کاربر';
    const authorAvatar = c.profiles?.avatar_url;
    const canModify = appStore.get('user')?.id === c.author_id || canEditContent();

    const editBtn = canModify
      ? el('button', {
          type: 'button',
          class: 'comment__delete', // reuse style
          style: { marginRight: '8px' },
          'aria-label': 'ویرایش نظر',
          on: {
            click: () => {
              const input = el('textarea', { class: 'textarea', rows: 3, value: c.body });
              const saveBtn = el('button', { class: 'btn btn--primary', onClick: async () => {
                try {
                  await theoriesService.updateComment(c.id, input.value);
                  c.body = input.value;
                  renderList();
                  handle.close();
                  toast.success('نظر ویرایش شد.');
                } catch (e) { toast.error(e.message); }
              }}, ['ذخیره']);
              
              const handle = openModal({
                title: 'ویرایش نظر',
                body: el('div', { class: 'form-field' }, [input]),
                footer: saveBtn,
                size: 'sm',
                initialFocus: input
              });
            }
          }
        }, [icon('edit')])
      : null;

    const deleteBtn = canModify
      ? el('button', {
          type: 'button',
          class: 'comment__delete',
          'aria-label': 'حذف نظر',
          on: {
            click: async () => {
              const ok = await confirmAndDelete({
                title: 'حذف نظر',
                message: 'این نظر حذف شود؟',
                onConfirm: () => theoriesService.deleteComment(c.id),
                successMessage: 'نظر حذف شد.',
              });
              if (ok) {
                const idx = comments.findIndex((x) => x.id === c.id);
                if (idx !== -1) comments.splice(idx, 1);
                renderList();
              }
            },
          },
        }, [icon('trash')])
      : null;

    return el('div', { class: 'comment' }, [
      el('span', { class: 'comment__avatar' }, [
        el('span', { class: 'avatar' }, [authorAvatar ? el('img', { src: authorAvatar, alt: authorName }) : initials(authorName)]),
      ]),
      el('div', { class: 'comment__main' }, [
        el('div', { class: 'comment__head' }, [
          el('span', { class: 'comment__author' }, [authorName]),
          el('span', { class: 'comment__time' }, [timeAgo(c.created_at)]),
          el('div', { style: { marginInlineStart: 'auto', display: 'flex' } }, [editBtn, deleteBtn].filter(Boolean)),
        ]),
        el('div', { class: 'comment__body' }, [c.body || '']),
      ]),
    ]);
  }
}