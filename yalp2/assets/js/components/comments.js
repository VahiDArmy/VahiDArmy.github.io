/* ============================================================
   Comments — list + form for a target (shop/product/platform/purchase)
   ============================================================ */
import { store } from '../state.js';
import { el, formatRelative, escapeHtml } from '../utils.js';
import { icon } from './icons.js';
import { createComment, deleteComment } from '../api.js';
import { confirmDialog } from './confirm.js';
import { notify } from './toast.js';

export function mountComments({ targetType, targetId, compact = false }) {
  const wrap = el('div', { class: 'comments' + (compact ? ' comments--compact' : '') });

  const form = el('form', { class: 'comments__form' });
  const input = el('input', {
    type: 'text',
    class: 'input comments__input',
    placeholder: 'یادداشت بنویس…',
    maxlength: '2000',
  });
  const submitBtn = el('button', {
    type: 'submit',
    class: 'btn btn--primary btn--icon',
    'aria-label': 'ارسال',
    html: icon('plus', 16),
  });
  form.append(input, submitBtn);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    submitBtn.classList.add('is-loading');
    submitBtn.disabled = true;
    try {
      const created = await createComment({
        target_type: targetType,
        target_id: targetId,
        content: text,
      });
      store.comments.set([created, ...store.comments.get()]);
      input.value = '';
      notify.success('یادداشت ثبت شد');
    } catch (err) {
      notify.error(err?.message || 'خطا');
    } finally {
      submitBtn.classList.remove('is-loading');
      submitBtn.disabled = false;
    }
  });

  const list = el('div', { class: 'comments__list' });

  function render() {
    const all = store.comments.get()
      .filter((c) => c.target_type === targetType && c.target_id === targetId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    list.innerHTML = '';
    if (!all.length) {
      list.appendChild(el('div', { class: 'comments__empty', text: 'هنوز یادداشتی نیست' }));
    } else {
      for (const c of all) {
        list.appendChild(renderItem(c));
      }
    }
  }

  function renderItem(c) {
    return el('div', { class: 'comment-item' }, [
      el('div', { class: 'comment-item__meta' }, [
        el('span', { class: 'avatar avatar--sm', style: { '--_size': '22px', fontSize: '10px' },
          text: (c.user_id?.[0] || 'U').toUpperCase() }),
        el('span', { text: formatRelative(c.created_at) }),
      ]),
      el('div', { class: 'comment-item__content', text: c.content }),
      el('div', { class: 'comment-item__actions' }, [
        el('button', {
          type: 'button',
          class: 'btn btn--icon btn--sm',
          'aria-label': 'حذف',
          'data-tooltip': 'حذف',
          html: icon('trash', 12),
          onclick: () => handleDelete(c),
        }),
      ]),
    ]);
  }

  async function handleDelete(c) {
    const ok = await confirmDialog({
      title: 'حذف یادداشت',
      message: 'این یادداشت حذف شود؟',
      confirmLabel: 'حذف',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteComment(c.id);
      store.comments.set(store.comments.get().filter((x) => x.id !== c.id));
      notify.success('حذف شد');
    } catch (err) {
      notify.error(err?.message || 'خطا');
    }
  }

  wrap.append(form, list);
  store.comments.subscribe(render);
  render();
  return wrap;
}
