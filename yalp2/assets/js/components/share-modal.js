/* ============================================================
   Share modal — with QR code support
   ============================================================ */
import { sb, Tables } from '../supabase.js';
import { store } from '../state.js';
import { el, escapeHtml, formatNumber, formatRelative } from '../utils.js';
import { icon } from './icons.js';
import { mountModal } from './modal-shell.js';
import { confirmDialog } from './confirm.js';
import { notify } from './toast.js';
import { buildShopSnapshot, buildProductSnapshot, generateSlug, shareUrl } from '../utils/share.js';
import { renderQrToCanvas } from './qr-code.js';

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
        .from('sm_shares')
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
    if (shares.length) bodyHost.appendChild(renderList(shares));
    else bodyHost.appendChild(el('div', { class: 'share-empty' }, [
      el('span', { html: icon('external', 22) }),
      el('div', { class: 'share-empty__title', text: 'هنوز لینکی نساختی' }),
      el('div', { class: 'share-empty__desc',
        text: 'با زدن دکمهٔ بالا، یک لینک عمومی می‌سازی که آمار را نشان می‌دهد.' }),
    ]));
  }

  function renderCreateCard() {
    const expirySelect = el('select', { class: 'select' }, [
      el('option', { value: 'never', text: 'بدون انقضا' }),
      el('option', { value: '7', text: '۷ روز' }),
      el('option', { value: '30', text: '۳۰ روز' }),
      el('option', { value: '365', text: '۱ سال' }),
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
          const expiresAt = days === 'never' ? null : new Date(Date.now() + Number(days) * 86400000).toISOString();

          const { data, error } = await sb
            .from('sm_shares')
            .insert({ entity_type: entityType, entity_id: entityId, slug, snapshot, expires_at: expiresAt })
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
          text: 'لینک خودکار کپی می‌شود.' }),
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
      `${formatNumber(shares.length)} لینک`));

    for (const s of shares) {
      const url = shareUrl(s.slug);
      const expired = s.expires_at && new Date(s.expires_at) < new Date();

      list.appendChild(el('div', { class: 'share-row' + (expired ? ' is-expired' : '') }, [
        el('div', { class: 'share-row__main' }, [
          el('div', { class: 'share-row__url', dir: 'ltr', text: url }),
          el('div', { class: 'share-row__meta' }, [
            el('span', { text: `ساخته‌شده ${formatRelative(s.created_at)}` }),
            el('span', { text: ' · ' }),
            el('span', { text: `${formatNumber(s.views)} بازدید` }),
            s.expires_at
              ? el('span', { class: 'share-row__expiry',
                  text: expired ? ' · منقضی' : ` · تا ${new Date(s.expires_at).toLocaleDateString('fa-IR')}` })
              : el('span', { text: ' · بدون انقضا' }),
          ]),
        ]),
        el('div', { class: 'share-row__actions' }, [
          el('button', {
            type: 'button', class: 'btn btn--icon btn--sm',
            'aria-label': 'QR', 'data-tooltip': 'نمایش QR',
            html: icon('grid', 14),
            onclick: () => openQrModal(url),
          }),
          el('button', {
            type: 'button', class: 'btn btn--icon btn--sm',
            'aria-label': 'کپی', 'data-tooltip': 'کپی',
            html: icon('copy', 14),
            onclick: () => copyToClipboard(url),
          }),
          el('button', {
            type: 'button', class: 'btn btn--icon btn--sm',
            'aria-label': 'بازکردن', 'data-tooltip': 'بازکردن',
            html: icon('external', 14),
            onclick: () => window.open(url, '_blank', 'noopener'),
          }),
          el('button', {
            type: 'button', class: 'btn btn--icon btn--sm is-danger',
            'aria-label': 'حذف', 'data-tooltip': 'حذف',
            html: icon('trash', 14),
            onclick: () => handleDelete(s),
          }),
        ]),
      ]));
    }
    return list;
  }

  function openQrModal(url) {
    const canvas = el('canvas', { width: '240', height: '240', class: 'qr-canvas' });
    const downloadBtn = el('button', {
      type: 'button', class: 'btn btn--outline btn--sm',
      html: `${icon('arrowDown', 14)}<span>دانلود PNG</span>`,
      onclick: () => {
        try {
          const a = document.createElement('a');
          a.download = `qr-${Date.now()}.png`;
          a.href = canvas.toDataURL('image/png');
          a.click();
        } catch (e) { notify.error('دانلود ناموفق'); }
      },
    });
    const copyUrlBtn = el('button', {
      type: 'button', class: 'btn btn--primary btn--sm',
      html: `${icon('copy', 14)}<span>کپی لینک</span>`,
      onclick: () => copyToClipboard(url),
    });

    const body = el('div', { class: 'qr-modal-body' }, [
      el('div', { class: 'qr-modal-frame' }, [canvas]),
      el('div', { class: 'qr-modal-url', dir: 'ltr', text: url }),
      el('div', { class: 'qr-modal-actions' }, [copyUrlBtn, downloadBtn]),
    ]);

    mountModal({
      title: 'اسکن با دوربین',
      subtitle: 'این QR را با دوربین گوشی اسکن کن',
      size: 'sm',
      body,
    });

    renderQrToCanvas(canvas, url, { size: 240 })
      .catch(() => notify.error('تولید QR ناموفق بود — اتصال اینترنت را چک کن'));
  }

  async function handleDelete(s) {
    const ok = await confirmDialog({
      title: 'حذف لینک',
      message: 'این لینک برای همیشه غیرفعال می‌شود. مطمئنی؟',
      confirmLabel: 'حذف', danger: true,
    });
    if (!ok) return;
    try {
      const { error } = await sb.from('sm_shares').delete().eq('id', s.id);
      if (error) throw error;
      notify.success('حذف شد');
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

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    notify.success('کپی شد');
    return true;
  } catch {
    notify.error('کپی نشد');
    return false;
  }
}
