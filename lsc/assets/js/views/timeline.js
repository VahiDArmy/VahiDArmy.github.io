/* ============================================================
   Timeline view
   ============================================================ */
import { el, escapeHtml } from '../utils.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { listEvents, createEvent, listTheories } from '../data.js';
import { emptyState, pagination } from '../components.js';
import { formatJalali, relativeJalali } from '../shamsi.js';
import { toastSuccess, toastError, openModal } from '../ui.js';
import { APP } from '../config.js';

export const renderTimeline = async (root, { query = {} } = {}) => {
  root.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'page timeline-page';

  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = `
    <div class="page-header__main">
      <div class="page-header__eyebrow"><i class="ri-timeline-view"></i>خط زمان</div>
      <h1 class="page-header__title">خط زمان رخدادها</h1>
      <p class="page-header__desc">رخدادها، بازنگری‌ها و بینش‌ها به ترتیب تاریخ شمسی.</p>
    </div>
    <div class="page-header__actions">
      <button class="btn btn--primary" data-act="new"><i class="ri-add-line"></i>رخداد جدید</button>
    </div>
  `;
  page.appendChild(header);

  const timelineEl = document.createElement('div');
  timelineEl.className = 'timeline';
  page.appendChild(timelineEl);
  root.appendChild(page);

  let currentPage = Number(query.page || 1);

  const load = async () => {
    timelineEl.innerHTML = '';
    try {
      const { items, count } = await listEvents({ page: currentPage, perPage: APP.pagination.timelinePerPage });
      if (!items.length) {
        timelineEl.appendChild(emptyState({
          title: 'هنوز رخدادی ثبت نشده',
          desc: 'اولین رخداد از سفر نظریه‌پردازی خود را ثبت کنید.',
          actions: state.user ? [{ label: 'رخداد جدید', primary: true, onClick: () => openNewEvent() }] : [{ label: 'ورود', primary: true, onClick: () => navigate('/auth') }]
        }));
        return;
      }
      items.forEach(ev => {
        const row = document.createElement('div');
        row.className = 'timeline-item';
        const shamsiDate = (ev.shamsi_year && ev.shamsi_month && ev.shamsi_day)
          ? formatJalali(new Date(ev.created_at))
          : formatJalali(ev.created_at);
        row.innerHTML = `
          <div class="timeline-item__time">${formatJalali(ev.created_at, { long: true })}</div>
          <div class="card" style="padding:14px;">
            <div class="timeline-card__body">
              <div class="timeline-card__date">${relativeJalali(ev.created_at)}</div>
              <div class="timeline-card__title">${escapeHtml(ev.title)}</div>
              ${ev.description ? `<div class="timeline-card__desc">${escapeHtml(ev.description)}</div>` : ''}
              ${ev.theory ? `<a href="#/theories/${ev.theory.id}" data-link style="font-size:var(--fs-xs);color:var(--accent-1);display:inline-block;margin-top:6px;"><i class="ri-lightbulb-line"></i>${escapeHtml(ev.theory.title)}</a>` : ''}
            </div>
          </div>
        `;
        timelineEl.appendChild(row);
      });
      if (count > APP.pagination.timelinePerPage) {
        timelineEl.appendChild(pagination({
          page: currentPage, perPage: APP.pagination.timelinePerPage, total: count,
          onPage: (p) => { currentPage = p; load(); }
        }));
      }
    } catch (e) {
      timelineEl.innerHTML = '';
      timelineEl.appendChild(emptyState({ title: 'خطا', desc: e.message }));
    }
  };

  const openNewEvent = async () => {
    if (!state.user) { navigate('/auth'); return; }
    let theories = [];
    try { theories = (await listTheories({ perPage: 100, mine: true })).items; } catch {}
    const body = document.createElement('div');
    body.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
    body.innerHTML = `
      <div class="field"><label class="field__label">عنوان <span class="req">*</span></label><input class="input" name="title" required maxlength="200" /></div>
      <div class="field"><label class="field__label">توضیح</label><textarea class="textarea" name="description" rows="3"></textarea></div>
      <div class="field"><label class="field__label">نظریه مرتبط</label>
        <select class="select" name="theory_id">
          <option value="">— بدون —</option>
          ${theories.map(t => `<option value="${t.id}">${escapeHtml(t.title)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label class="field__label">نوع</label>
        <select class="select" name="event_type">
          <option value="milestone">نقطه عطف</option>
          <option value="insight">بینش</option>
          <option value="revision">بازنگری</option>
          <option value="link">پیوند</option>
          <option value="publish">انتشار</option>
        </select>
      </div>
    `;
    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;gap:8px;';
    const cancel = document.createElement('button'); cancel.className = 'btn'; cancel.textContent = 'انصراف';
    const save = document.createElement('button'); save.className = 'btn btn--primary'; save.textContent = 'ثبت';
    footer.append(cancel, save);
    const modal = openModal({ title: 'رخداد جدید', body, footer });
    cancel.addEventListener('click', modal.close);
    save.addEventListener('click', async () => {
      const title = body.querySelector('[name="title"]').value.trim();
      if (!title) return;
      try {
        await createEvent({
          title,
          description: body.querySelector('[name="description"]').value.trim(),
          theory_id: body.querySelector('[name="theory_id"]').value || null,
          event_type: body.querySelector('[name="event_type"]').value
        });
        toastSuccess('ثبت شد');
        modal.close();
        load();
      } catch (e) { toastError('خطا', e.message); }
    });
  };

  page.querySelector('[data-act="new"]').addEventListener('click', openNewEvent);
  await load();
};
