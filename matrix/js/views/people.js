/* views/people.js — people CRUD + profile panel */
import { state, esc, icon, fa, faNum, pct, initials, avatarColor, timeAgo, toast, openModal, confirmDialog, play, haptic, isAdmin, canEditPerson, errMsg } from '../core.js';
import { createPerson, updatePerson, deletePerson, addRelation, deleteRelation, logEvent } from '../data.js';
import { personStats, coverage, norm } from '../matrix.js';

let query = '';
let sortKey = 'name';
let dir = 1;

export async function render(host) {
  const rows = filtered();
  host.innerHTML = `
    <div class="pagehead">
      <h2>${icon('users')} افراد</h2>
      <div class="pagehead__sub">${fa(state.people.length)} نفر · ${fa(state.scores.length)} امتیاز</div>
      <div class="spacer"></div>
      <div class="toolrow">
        <button class="btn btn--sm" id="pp-export">${icon('download')} CSV</button>
        <button class="btn btn--sm btn--primary" id="pp-new">${icon('plus')} شخص جدید</button>
      </div>
    </div>
    <section class="panel">
      <div class="toolbar">
        <div class="searchmini">${icon('search')}<input id="pp-q" placeholder="نام، شغل، دپارتمان، برچسب…" value="${esc(query)}"></div>
        <div class="seg" id="pp-sort">
          <button data-k="name" class="${sortKey === 'name' ? 'is-on' : ''}">الفبا</button>
          <button data-k="received" class="${sortKey === 'received' ? 'is-on' : ''}">دریافتی</button>
          <button data-k="given" class="${sortKey === 'given' ? 'is-on' : ''}">دهنده</button>
        </div>
        <button class="btn btn--sm" id="pp-dir">${icon(dir === 1 ? 'chev-down' : 'chev-up')}</button>
        <span class="spacer" style="flex:1"></span>
        <span class="count">${fa(rows.length)} نتیجه</span>
      </div>
      <div style="overflow:auto">
        <table class="dtable">
          <thead><tr><th>شخص</th><th>نقش</th><th>برچسب‌ها</th><th class="num">دریافتی</th><th class="num">دهنده</th><th class="num">پوشش</th><th></th></tr></thead>
          <tbody>
            ${rows.map((p) => {
              const s = personStats(p.id);
              const mine = p.user_id === state.user?.id;
              return `<tr data-id="${p.id}">
                <td><div class="cellperson"><span class="avatar avatar--sm">${p.avatar_url ? `<img src="${esc(p.avatar_url)}">` : esc(initials(p.full_name))}</span>
                  <div class="cellperson__text"><strong>${esc(p.full_name)} ${mine ? '<span class="chip chip--acc" style="font-size:8px">شما</span>' : ''}</strong>
                  <span>${esc(p.job_title || '—')}${p.department ? ' · ' + esc(p.department) : ''}</span></div></div></td>
                <td>${p.status && p.status !== 'not_in_site' ? `<span class="chip chip--ok">${esc(p.status)}</span>` : '<span class="chip">—</span>'}</td>
                <td><div style="display:flex;gap:3px;flex-wrap:wrap">${(p.tags || []).slice(0, 3).map((t) => `<span class="chip">${esc(t)}</span>`).join('') || '<span class="muted">—</span>'}</div></td>
                <td class="num" style="font-weight:700">${faNum(s.avgReceived, 2)}</td>
                <td class="num">${faNum(s.avgGiven, 2)}</td>
                <td class="num">${pct(Math.min(1, (s.received + s.given) / Math.max(1, (state.people.length - 1) * state.traits.length * 2)))}</td>
                <td><div class="rowacts">
                  <button class="iconbtn iconbtn--xs" data-act="view" title="پروفایل">${icon('eye')}</button>
                  <button class="iconbtn iconbtn--xs" data-act="edit" title="ویرایش">${icon('edit')}</button>
                  <button class="iconbtn iconbtn--xs" data-act="matrix" title="در ماتریس">${icon('layers')}</button>
                  ${isAdmin() ? `<button class="iconbtn iconbtn--xs" data-act="del" title="حذف">${icon('trash')}</button>` : ''}
                </div></td>
              </tr>`;
            }).join('') || `<tr><td colspan="7">${emptyRow()}</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>`;

  const q = host.querySelector('#pp-q');
  q.oninput = () => { query = q.value; render(host); setTimeout(() => { const n = host.querySelector('#pp-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 0); };
  host.querySelectorAll('#pp-sort [data-k]').forEach((b) => b.onclick = () => { sortKey = b.dataset.k; play('tap'); render(host); });
  host.querySelector('#pp-dir').onclick = () => { dir *= -1; render(host); };
  host.querySelector('#pp-new').onclick = () => openPersonEditor();
  host.querySelector('#pp-export').onclick = exportPeople;
  host.querySelectorAll('tr[data-id]').forEach((tr) => {
    const id = tr.dataset.id;
    tr.onclick = (e) => { if (!e.target.closest('[data-act]')) openPersonPanel(id); };
    tr.ondblclick = () => openPersonPanel(id);
    tr.querySelectorAll('[data-act]').forEach((b) => b.onclick = async (e) => {
      e.stopPropagation();
      const p = state.people.find((x) => x.id === id);
      if (!p) return;
      if (b.dataset.act === 'view') openPersonPanel(id);
      if (b.dataset.act === 'edit') openPersonEditor(p);
      if (b.dataset.act === 'matrix') {
        const m = await import('../matrix.js');
        window.mx.navigate('matrix');
        setTimeout(() => { m.mx.mode = 'ranker'; m.mx.stack = Math.max(0, m.stacksFor('ranker').findIndex((s) => s.id === id)); m.renderMatrix(document.getElementById('view')); }, 120);
      }
      if (b.dataset.act === 'del') {
        const ok = await confirmDialog({ title: 'حذف شخص', text: `«${p.full_name}» و ارتباط امتیازهایش پاک می‌شود.`, danger: true, okText: 'حذف' });
        if (!ok) return;
        try { await deletePerson(id); play('swoosh'); toast('حذف شد', 'ok'); window.mx.reload(); }
        catch (err) { toast(errMsg(err), 'err'); }
      }
    });
  });
}

function filtered() {
  let arr = state.people.filter((p) => !p.metadata?.archived);
  if (query.trim()) {
    const s = query.trim().toLowerCase();
    arr = arr.filter((p) => [p.full_name, p.job_title, p.department, ...(p.tags || [])].filter(Boolean).some((v) => String(v).toLowerCase().includes(s)));
  }
  arr = [...arr].sort((a, b) => {
    if (sortKey === 'name') return a.full_name.localeCompare(b.full_name, 'fa') * dir;
    const sa = personStats(a.id); const sb = personStats(b.id);
    return ((sortKey === 'received' ? sa.avgReceived : sa.avgGiven) - (sortKey === 'received' ? sb.avgReceived : sb.avgGiven)) * dir;
  });
  return arr;
}
function emptyRow() { return `<div class="empty">${icon('users')} شخصی نیست — «شخص جدید» را بزنید</div>`; }

export function openPersonEditor(person = null) {
  if (!state.user) return toast('برای ویرایش وارد شوید', 'warn');
  const p = person || {};
  const body = `<div class="formgrid">
    <label class="field full"><span>نام کامل *</span><input id="pf-name" value="${esc(p.full_name || '')}" placeholder="نام و نام خانوادگی"></label>
    <label class="field"><span>عنوان شغلی</span><input id="pf-job" value="${esc(p.job_title || '')}"></label>
    <label class="field"><span>دپارتمان</span><input id="pf-dept" value="${esc(p.department || '')}"></label>
    <label class="field"><span>تلفن</span><input id="pf-phone" dir="ltr" value="${esc(p.phone || '')}"></label>
    <label class="field"><span>ایمیل</span><input id="pf-email" dir="ltr" type="email" value="${esc(p.email || '')}"></label>
    <label class="field full"><span>تصویر (URL)</span><input id="pf-avatar" dir="ltr" value="${esc(p.avatar_url || '')}" placeholder="https://…"></label>
    <label class="field full"><span>برچسب‌ها (با کاما)</span><input id="pf-tags" value="${esc((p.tags || []).join(', '))}"></label>
    <label class="field full"><span>درباره</span><textarea id="pf-bio" rows="2">${esc(p.bio || '')}</textarea></label>
  </div>`;
  openModal({
    title: p.id ? 'ویرایش شخص' : 'شخص جدید', body,
    foot: `<div class="spacer"></div><button class="btn" data-close>انصراف</button><button class="btn btn--primary" id="pf-save">${icon('check')} ذخیره</button>`,
    onMount(node, close) {
      node.querySelector('#pf-save').onclick = async () => {
        const full_name = node.querySelector('#pf-name').value.trim();
        if (!full_name) return toast('نام لازم است', 'warn');
        const payload = {
          full_name, job_title: node.querySelector('#pf-job').value.trim() || null,
          department: node.querySelector('#pf-dept').value.trim() || null,
          phone: node.querySelector('#pf-phone').value.trim() || null,
          email: node.querySelector('#pf-email').value.trim() || null,
          avatar_url: node.querySelector('#pf-avatar').value.trim() || null,
          tags: node.querySelector('#pf-tags').value.split(',').map((x) => x.trim()).filter(Boolean),
          bio: node.querySelector('#pf-bio').value.trim() || null,
        };
        try {
          if (p.id) { await updatePerson(p.id, payload); toast('به‌روزرسانی شد', 'ok'); }
          else { const row = await createPerson(payload); toast('شخص اضافه شد', 'ok'); logEvent('person.create', row.full_name, { id: row.id }); }
          play('clink'); haptic([8, 24, 8]);
          close(); window.mx.reload();
        } catch (err) {
          try {
            if (!p.id) {
              const row = await createPerson({ full_name, job_title: payload.job_title, department: payload.department, avatar_url: payload.avatar_url });
              toast('با فیلدهای پایه ذخیره شد', 'warn', 3000); close(); window.mx.reload(); return;
            }
          } catch { /* fallthrough */ }
          toast(errMsg(err), 'err', 4000);
        }
      };
    },
  });
}

export async function openPersonPanel(id) {
  const p = state.people.find((x) => x.id === id);
  if (!p) return toast('شخص پیدا نشد', 'err');
  const s = personStats(id);
  const rels = state.relations.filter((r) => r.person_id === id || r.other_id === id);
  const given = state.scores.filter((x) => x.ranker_person_id === id);
  const received = state.scores.filter((x) => x.target_person_id === id);
  const me = p.user_id === state.user?.id;
  document.querySelector('.drawer')?.remove();
  const d = document.createElement('div');
  d.className = 'drawer';
  d.innerHTML = `
    <div class="drawer__head">
      <div class="avatar" style="width:46px;height:46px;font-size:16px">${p.avatar_url ? `<img src="${esc(p.avatar_url)}">` : esc(initials(p.full_name))}</div>
      <div style="display:flex;flex-direction:column;line-height:1.3;min-width:0">
        <strong style="font-size:14px">${esc(p.full_name)}</strong>
        <span class="muted" style="font-size:11px">${esc(p.job_title || '—')}${p.department ? ' · ' + esc(p.department) : ''}</span>
      </div>
      <div class="spacer"></div>
      ${me ? '<span class="chip chip--acc">شما</span>' : ''}
      <button class="iconbtn" data-d="close">${icon('x')}</button>
    </div>
    <div class="drawer__body">
      ${p.bio ? `<p style="font-size:11.5px;color:var(--ink-2);line-height:1.9">${esc(p.bio)}</p>` : ''}
      <div style="display:flex;gap:5px;flex-wrap:wrap">${(p.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>
      <div class="grid grid--3" style="gap:7px">
        ${miniStat('دریافتی', faNum(s.avgReceived, 2))}
        ${miniStat('دهنده', faNum(s.avgGiven, 2))}
        ${miniStat('امتیازها', fa(s.given + s.received))}
      </div>
      <div class="seg" id="dp-tabs" style="align-self:flex-start">
        <button class="is-on" data-t="recv">دریافتی</button><button data-t="given">دهنده</button>
      </div>
      <div id="dp-bars" style="display:flex;flex-direction:column;gap:7px"></div>
      <div class="divider"></div>
      <div style="display:flex;align-items:center;gap:6px"><strong style="font-size:12px">روابط</strong><span class="spacer" style="flex:1"></span>
        <button class="btn btn--sm" data-d="rel">${icon('plus')} رابطه</button></div>
      <div style="display:flex;flex-direction:column;gap:4px" id="dp-rels">
        ${rels.map((r) => {
          const other = state.peopleMap.get(r.person_id === id ? r.other_id : r.person_id);
          return `<div class="kv"><span class="kv__k">${esc(other?.full_name || '؟')}</span><span class="chip">${esc(r.kind)}</span>
            <button class="iconbtn iconbtn--xs" data-rel="${r.id}">${icon('x')}</button></div>`;
        }).join('') || '<span class="muted" style="font-size:11px">رابطه‌ای ثبت نشده</span>'}
      </div>
      <div class="divider"></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn--sm" data-d="edit">${icon('edit')} ویرایش</button>
        <button class="btn btn--sm" data-d="matrix">${icon('layers')} در ماتریس</button>
        <button class="btn btn--sm" data-d="ai">${icon('brain')} تحلیل</button>
        ${isAdmin() ? `<button class="btn btn--sm btn--danger" data-d="del">${icon('trash')}</button>` : ''}
      </div>
    </div>`;
  document.body.appendChild(d);

  const barsBox = d.querySelector('#dp-bars');
  const paintBars = (kind) => {
    const arr = kind === 'recv' ? s.receivedByTrait : s.givenByTrait;
    barsBox.innerHTML = arr.map(({ trait, avg, n }) => `
      <div class="traitbar"><div class="traitbar__top"><span class="stackcard__sw" style="--tc:${esc(trait.color)}"></span><span>${esc(trait.name)}</span>
        <span class="chip" style="font-size:9px">${fa(n)}</span><span class="val">${avg === null ? '—' : faNum(avg, 2)}</span></div>
        <div class="traitbar__track"><i style="width:${avg === null ? 0 : norm(trait, avg) * 100}%;background:${esc(trait.color)}"></i></div></div>`).join('') || '<span class="muted">داده‌ای نیست</span>';
  };
  paintBars('recv');
  d.querySelectorAll('#dp-tabs [data-t]').forEach((b) => b.onclick = () => {
    d.querySelectorAll('#dp-tabs button').forEach((x) => x.classList.toggle('is-on', x === b));
    paintBars(b.dataset.t === 'recv' ? 'recv' : 'given'); play('tick');
  });
  d.querySelector('[data-d=close]').onclick = () => d.remove();
  d.querySelector('[data-d=edit]').onclick = () => { d.remove(); openPersonEditor(p); };
  d.querySelector('[data-d=del]').onclick = async () => {
    const ok = await confirmDialog({ title: 'حذف شخص', text: p.full_name, danger: true, okText: 'حذف' });
    if (!ok) return;
    try { await deletePerson(id); d.remove(); toast('حذف شد', 'ok'); window.mx.reload(); } catch (e) { toast(errMsg(e), 'err'); }
  };
  d.querySelector('[data-d=matrix]').onclick = async () => {
    d.remove();
    const m = await import('../matrix.js');
    window.mx.navigate('matrix');
    setTimeout(() => { m.mx.mode = 'ranker'; m.mx.stack = Math.max(0, m.stacksFor('ranker').findIndex((x) => x.id === id)); m.renderMatrix(document.getElementById('view')); }, 120);
  };
  d.querySelector('[data-d=ai]').onclick = () => { d.remove(); import('../ai.js').then((m) => m.openPanel('person', { personId: id })); };
  d.querySelector('[data-d=rel]').onclick = async () => {
    const opts = state.people.filter((x) => x.id !== id).map((x) => `<option value="${x.id}">${esc(x.full_name)}</option>`).join('');
    openModal({
      title: 'رابطه جدید', slim: true,
      body: `<label class="field"><span>شخص</span><select id="rel-other">${opts}</select></label>
        <label class="field"><span>نوع</span><input id="rel-kind" value="peer" placeholder="peer / mentor / friend"></label>`,
      foot: `<div class="spacer"></div><button class="btn" data-close>انصراف</button><button class="btn btn--primary" id="rel-ok">${icon('check')} ثبت</button>`,
      onMount(node, close) {
        node.querySelector('#rel-ok').onclick = async () => {
          try { await addRelation({ personId: id, otherId: node.querySelector('#rel-other').value, kind: node.querySelector('#rel-kind').value.trim() || 'peer' }); close(); play('clink'); d.remove(); openPersonPanel(id); }
          catch (e) { toast(errMsg(e), 'err'); }
        };
      },
    });
  };
  d.querySelectorAll('[data-rel]').forEach((b) => b.onclick = async () => {
    try { await deleteRelation(b.dataset.rel); d.remove(); openPersonPanel(id); } catch (e) { toast(errMsg(e), 'err'); }
  });
  void given; void received; void coverage;
}

function miniStat(label, value) {
  return `<div class="kpi" style="padding:8px"><div class="kpi__label" style="font-size:9.5px">${esc(label)}</div><div class="kpi__value" style="font-size:17px">${value}</div></div>`;
}

function exportPeople() {
  const rows = [['نام', 'شغل', 'دپارتمان', 'برچسب‌ها', 'میانگین دریافتی', 'میانگین دهنده'].join(',')];
  for (const p of state.people) {
    const s = personStats(p.id);
    rows.push([p.full_name, p.job_title, p.department, (p.tags || []).join('|'), s.avgReceived?.toFixed(2) ?? '', s.avgGiven?.toFixed(2) ?? '']
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
  }
  const blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'people.csv'; a.click();
  play('save');
}

export { canEditPerson, avatarColor };
