/* ============================================================
   Share modal — generate / list / delete public share links
   ============================================================ */
import { sb, Tables } from '../supabase.js';
import { store } from '../state.js';
import { el, escapeHtml, formatNumber, formatRelative } from '../utils.js';
import { icon } from './icons.js';
import { mountModal } from './modal-shell.js';
import { confirmDialog } from './confirm.js';
import { notify } from './toast.js';
import { buildShopSnapshot, buildProductSnapshot, generateSlug, shareUrl } from '../utils/share.js';

export async function openShareModal({ entityType, entityId } = {}) {
  if (!['shop', 'product'].includes(entityType)) {
    return notify.error('نوع موجودیت نامعتبر است');
  }

  const bodyHost = el('div', { class: 'share-body' });
  const { close } = mountModal({
    title: entityType === 'shop' ? 'اشتراک‌گذاری فروشگاه' : 'اشتراک‌گذاری محصول',
    subtitle: 'یک لینک عمومی بساز که هر کسی بتواند ببیند',
    size: 'lg',
    body: [bodyHost],
    footer: [
      el('button', {
        type: 'button', class: 'btn btn--ghost btn--lg', text: 'بستن',
        onclick: () => close(),
      }),
    ],
  });

  async function refresh() {
    bodyHost.innerHTML = '';
    bodyHost.appendChild(el('div', { class: 'share-loading' }, [
      el('span', { class: 'spinner' }),
      el('span', { text: 'در حال بارگذاری لینک‌ها…' }),
    ]));

    let shares = [];
    try {
      const { data, error } = await sb
        .from(Tables.platforms ? 'sm_shares' : 'sm_shares') // literal
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      shares = data || [];
    } catch (err) {
      bodyHost.innerHTML = '';
      bodyHost.appendChild(renderError(err));
      return;
    }

    bodyHost.innerHTML = '';
    bodyHost.appendChild(renderCreateCard());
    if (shares.length) {
      bodyHost.appendChild(renderList(shares));
    } else {
      bodyHost.appendChild(el('div', { class: 'share-empty' }, [
        el('span', { html: icon('external', 22) }),
        el('div', { class: 'share-empty__title', text: 'هنوز لینکی نساختی' }),
        el('div', { class: 'share-empty__desc',
          text: 'با زدن دکمهٔ بالا، یک لینک عمومی می‌سازی که آمار فروشگاه/محصول را نشان می‌دهد.' }),
      ]));
    }
  }

  function renderCreateCard() {
    const expirySelect = el('select', { class: 'select' }, [
      opt('never', 'بدون انقضا'),
      opt('7', '۷ روز'),
      opt('30', '۳۰ روز'),
      opt('365', '۱ سال'),
    ]);
    const createBtn = el('button', {
      type: 'button', class: 'btn btn--primary',
      html: `${icon('plus', 14)}<span>ساخت لینک جدید</span>`,
      onclick: async () => {
        createBtn.classList.add('is-loading');
        createBtn.disabled = true;
        try {
          const snapshot = entityType === 'shop'
            ? buildShopSnapshot(entityId, store.purchases.get())
            : buildProductSnapshot(entityId, store.purchases.get());

          const slug = generateSlug(10);
          const days = expirySelect.value;
          const expiresAt = days === 'never'
            ? null
            : new Date(Date.now() + Number(days) * 86400000).toISOString();

          const { data, error } = await sb
            .from('sm_shares')
            .insert({
              entity_type: entityType,
              entity_id: entityId,
              slug,
              snapshot,
              expires_at: expiresAt,
            })
            .select()
            .single();
          if (error) throw error;

          notify.success('لینک ساخته شد');
          await copyToClipboard(shareUrl(data.slug));
          await refresh();
        } catch (err) {
          notify.error(err?.message || 'خطا در ساخت لینک');
          createBtn.classList.remove('is-loading');
          createBtn.disabled = false;
        }
      },
    });

    return el('div', { class: 'share-create-card' }, [
      el('div', { class: 'share-create-card__icon', html: icon('external', 20) }),
      el('div', { class: 'share-create-card__body' }, [
        el('div', { class: 'share-create-card__title', text: 'ساخت لینک عمومی جدید' }),
        el('div', { class: 'share-create-card__desc',
          text: 'لینک به‌صورت خودکار کپی می‌شود و می‌توانی با هر کسی به اشتراک بگذاری.' }),
        el('div', { class: 'share-create-card__actions' }, [
          el('label', { class: 'share-create-card__expiry' }, [
            el('span', { text: 'انقضا' }),
            expirySelect,
          ]),
          createBtn,
        ]),
      ]),
    ]);
  }

  function renderList(shares) {
    const list = el('div', { class: 'share-list' });
    list.appendChild(el('div', { class: 'share-list__title' },
      `${formatNumber(shares.length)} لینک فعال`));

    for (const s of shares) {
      const url = shareUrl(s.slug);
      const expired = s.expires_at && new Date(s.expires_at) < new Date();

      const card = el('div', { class: 'share-row' + (expired ? ' is-expired' : '') }, [
        el('div', { class: 'share-row__main' }, [
          el('div', { class: 'share-row__url', dir: 'ltr', text: url }),
          el('div', { class: 'share-row__meta' }, [
            el('span', { text: `ساخته‌شده ${formatRelative(s.created_at)}` }),
            el('span', { text: ' · ' }),
            el('span', { text: `${formatNumber(s.views)} بازدید` }),
            s.expires_at
              ? el('span', { class: 'share-row__expiry',
                  text: expired ? ' · منقضی شده' : ` · تا ${new Date(s.expires_at).toLocaleDateString('fa-IR')}` })
              : el('span', { text: ' · بدون انقضا' }),
          ]),
        ]),
        el('div', { class: 'share-row__actions' }, [
          el('button', {
            type: 'button', class: 'btn btn--icon btn--sm',
            'aria-label': 'کپی', 'data-tooltip': 'کپی لینک',
            html: icon('copy', 14),
            onclick: () => copyToClipboard(url),
          }),
          el('button', {
            type: 'button', class: 'btn btn--icon btn--sm',
            'aria-label': 'بازکردن', 'data-tooltip': 'بازکردن لینک',
            html: icon('external', 14),
            onclick: () => window.open(url, '_blank', 'noopener'),
          }),
          el('button', {
            type: 'button', class: 'btn btn--icon btn--sm is-danger',
            'aria-label': 'حذف', 'data-tooltip': 'حذف لینک',
            html: icon('trash', 14),
            onclick: () => handleDelete(s),
          }),
        ]),
      ]);
      list.appendChild(card);
    }
    return list;
  }

  async function handleDelete(s) {
    const ok = await confirmDialog({
      title: 'حذف لینک',
      message: 'این لینک برای همیشه غیرفعال می‌شود. مطمئنی؟',
      confirmLabel: 'حذف',
      danger: true,
    });
    if (!ok) return;
    try {
      const { error } = await sb.from('sm_shares').delete().eq('id', s.id);
      if (error) throw error;
      notify.success('لینک حذف شد');
      await refresh();
    } catch (err) {
      notify.error(err?.message || 'خطا');
    }
  }

  function renderError(err) {
    return el('div', { class: 'share-error' }, [
      el('span', { html: icon('alert', 20) }),
      el('div', {}, [
        el('div', { style: { fontWeight: 'var(--fw-bold)' }, text: 'بارگذاری لینک‌ها ناموفق بود' }),
        el('div', { style: { fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: '4px' },
          text: String(err?.message || err) }),
      ]),
    ]);
  }

  await refresh();
}

function opt(value, label) {
  return el('option', { value, text: label });
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    notify.success('لینک کپی شد');
    return true;
  } catch {
    notify.error('کپی نشد — دستی انتخاب کن');
    return false;
  }
}
