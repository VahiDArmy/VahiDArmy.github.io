/* views/admin.js — permissions, disputes, audit, import */
import { sb, state, esc, icon, fa, faNum, pct, toast, openModal, confirmDialog, play, haptic, isAdmin, timeAgo, errMsg, initials } from '../core.js';
import { resolveDispute, fetchAudit, fetchEvents, createPerson, deleteScoreById } from '../data.js';

let profiles = [];
let audit = [];
let events = [];
let tab = 'members';

export async function render(host) {
  host.innerHTML = `
    <div class="pagehead">
      <h2>${icon('shield')} مدیریت</h2>
      <div class="pagehead__sub">${isAdmin() ? 'دسترسی مدیر' : 'دسترسی محدود'} · ${fa(state.disputes.filter((d) => d.status === 'open').length)} اعتراض باز</div>
      <div class="spacer"></div>
      <div class="toolrow">
        <button class="btn btn--sm" id="ad-refresh">${icon('refresh')} بازخوانی</button>
        <button class="btn btn--sm" id="ad-import">${icon('upload')} ورود گروهی</button>
      </div>
    </div>
    <div class="grid grid--4" style="margin-bottom:12px">
      ${kpi('اعضا', fa(profiles.length || '—'), 'users')}
      ${kpi('اعتراض باز', fa(state.disputes.filter((d) => d.status === 'open').length), 'flag')}
      ${kpi('رویداد', fa(events.length || '—'), 'db')}
      ${kpi('نقش شما', isAdmin() ? 'مدیر' : 'عضو', 'lock')}
    </div>
    <div class="seg" style="margin-bottom:10px" id="ad-tabs">
      ${['members', 'disputes', 'audit', 'events', 'data'].map((t) => `<button data-t="${t}" class="${t === tab ? 'is-on' : ''}">${{ members: 'اعضا و نقش‌ها', disputes: 'اعتراض‌ها', audit: 'ممیزی', events: 'رویدادها', data: 'داده و ابزار' }[t]}</button>`).join('')}
    </div>
    <div id="ad-body"></div>`;

  host.querySelectorAll('#ad-tabs [data-t]').forEach((b) => b.onclick = () => { tab = b.dataset.t; play('tap'); render(host); });
  host.querySelector('#ad-refresh').onclick = () => { play('tap'); boot(host); };
  host.querySelector('#ad-import').onclick = openImport;
  const body = host.querySelector('#ad-body');
  body.innerHTML = `<div class="panel"><div class="panel__body"><div class="skeleton" style="height:60px"></div></div></div>`;

  try {
    const [p, a, e] = await Promise.allSettled([
      sb.from('profiles').select('*').order('created_at', { ascending: true }).limit(300),
      fetchAudit(80),
      fetchEvents(80),
    ]);
    profiles = p.status === 'fulfilled' ? (p.value.data || []) : [];
    audit = a.status === 'fulfilled' ? a.value : [];
    events = e.status === 'fulfilled' ? e.value : [];
  } catch { /* ignore */ }
  paint(host);
}

function paint(host) {
  const body = host.querySelector('#ad-body');
  if (!body) return;
  if (tab === 'members') {
    body.innerHTML = `<section class="panel"><div class="toolbar">${icon('users')}<strong style="font-size:12.5px">اعضا</strong>
      <span class="spacer" style="flex:1"></span><span class="count">${fa(profiles.length)}</span></div>
      <div style="overflow:auto"><table class="dtable"><thead><tr><th>کاربر</th><th>نام</th><th>نقش</th><th>خروجی</th><th>عضویت</th><th></th></tr></thead><tbody>
      ${profiles.map((p) => `<tr>
        <td><div class="cellperson"><span class="avatar avatar--sm">${p.avatar_url ? `<img src="${esc(p.avatar_url)}">` : esc(initials(p.display_name || '?'))}</span>
          <div class="cellperson__text"><strong>${esc(p.display_name || '—')}</strong><span class="mono">${esc((p.id || '').slice(0, 8))}</span></div></div></td>
        <td class="mono">${esc(p.username || '—')}</td>
        <td><span class="chip ${['admin', 'owner', 'super_admin'].includes(String(p.role)) ? 'chip--acc' : ''}">${esc(p.role || 'member')}</span></td>
        <td>${p.preferences && Object.keys(p.preferences).length ? `<span class="chip">${fa(Object.keys(p.preferences).length)}</span>` : '—'}</td>
        <td class="muted" style="font-size:10px">${timeAgo(p.created_at)}</td>
        <td><button class="iconbtn iconbtn--xs" data-role="${p.id}" title="تغییر نقش" ${isAdmin() ? '' : 'disabled'}>${icon('edit')}</button></td>
      </tr>`).join('') || `<tr><td colspan="6"><div class="empty">${icon('lock')} ${profiles.length ? '' : 'دسترسی به فهرست اعضا ندارید (RLS)'}</div></td></tr>`}
      </tbody></table></div>
      <div class="panel__body" style="border-top:1px solid var(--line);font-size:11px;color:var(--ink-3)">
        نقش‌ها از جدول <span class="mono">profiles.role</span> خوانده می‌شوند؛ تغییر نقش نیازمند سیاست مدیریتی در Supabase است.
      </div></section>`;
    body.querySelectorAll('[data-role]').forEach((b) => b.onclick = () => openRole(b.dataset.role));
  }
  if (tab === 'disputes') {
    const list = state.disputes;
    body.innerHTML = `<section class="panel"><div class="toolbar">${icon('flag')}<strong style="font-size:12.5px">اعتراض‌ها</strong><span class="spacer" style="flex:1"></span><span class="count">${fa(list.length)}</span></div>
      <div style="overflow:auto"><table class="dtable"><thead><tr><th>ویژگی</th><th>هدف</th><th>دلیل</th><th>وضعیت</th><th>زمان</th><th></th></tr></thead><tbody>
      ${list.map((d) => `<tr><td>${esc(state.traitMap.get(d.trait_id)?.name || '—')}</td>
        <td>${esc(state.peopleMap.get(d.target_person_id)?.full_name || '—')}</td>
        <td class="muted" style="max-width:280px">${esc(d.reason || '—')}</td>
        <td><span class="chip ${d.status === 'open' ? 'chip--warn' : d.status === 'accepted' ? 'chip--ok' : 'chip--bad'}">${esc(d.status)}</span></td>
        <td class="muted" style="font-size:10px">${timeAgo(d.created_at)}</td>
        <td><div class="rowacts">${d.status === 'open' ? `<button class="iconbtn iconbtn--xs" data-dsp="${d.id}" data-to="accepted" title="پذیرش">${icon('check')}</button>
          <button class="iconbtn iconbtn--xs" data-dsp="${d.id}" data-to="rejected" title="رد">${icon('x')}</button>` : ''}</div></td></tr>`).join('') || `<tr><td colspan="6"><div class="empty">${icon('flag')} اعتراضی نیست</div></td></tr>`}
      </tbody></table></div></section>`;
    body.querySelectorAll('[data-dsp]').forEach((b) => b.onclick = async () => {
      try { await resolveDispute(b.dataset.dsp, b.dataset.to); play('clink'); toast('وضعیت به‌روز شد', 'ok'); render(host); } catch (e) { toast(errMsg(e), 'err'); }
    });
  }
  if (tab === 'audit') {
    body.innerHTML = `<section class="panel"><div class="toolbar">${icon('db')}<strong style="font-size:12.5px">ممیزی</strong><span class="spacer" style="flex:1"></span><span class="count">${fa(audit.length)}</span></div>
      <div style="overflow:auto;max-height:60vh"><table class="dtable"><thead><tr><th>عمل</th><th>جدول</th><th>ردیف</th><th>زمان</th></tr></thead><tbody>
      ${audit.map((a) => `<tr><td><span class="chip">${esc(a.action)}</span></td><td class="mono">${esc(a.table_name)}</td>
        <td class="mono muted">${esc(String(a.row_id || '—').slice(0, 12))}</td><td class="muted" style="font-size:10px">${timeAgo(a.created_at)}</td></tr>`).join('') || `<tr><td colspan="4"><div class="empty">${icon('db')} رکوردی نیست یا دسترسی ندارید</div></td></tr>`}
      </tbody></table></div></section>`;
  }
  if (tab === 'events') {
    body.innerHTML = `<section class="panel"><div class="toolbar">${icon('zap')}<strong style="font-size:12.5px">رویدادهای کاربران</strong><span class="spacer" style="flex:1"></span><span class="count">${fa(events.length)}</span></div>
      <div class="panel__body" style="max-height:60vh;overflow:auto">
      ${events.map((e) => `<div class="kv"><span class="kv__k">${esc(e.kind)}${e.label ? ' · ' + esc(e.label) : ''}</span>
        <span class="mono muted" style="font-size:9px">${esc((e.user_id || '').slice(0, 8))}</span><span class="muted" style="font-size:10px">${timeAgo(e.created_at)}</span></div>`).join('') || `<div class="empty">${icon('db')} رویدادی نیست</div>`}
      </div></section>`;
  }
  if (tab === 'data') {
    const tables = [['people', state.people.length], ['mtx_traits', state.traits.length], ['mtx_scores', state.scores.length], ['mtx_comments', state.comments.length], ['mtx_disputes', state.disputes.length], ['mtx_sessions', state.sessions.length], ['mtx_views', state.views.length], ['mtx_relations', state.relations.length], ['mtx_ai_runs', state.aiRuns.length]];
    body.innerHTML = `<div class="grid grid--2">
      <section class="panel"><div class="panel__head">${icon('db')}<h3>جدول‌ها</h3></div>
        <div class="panel__body">${tables.map(([n, c]) => `<div class="kv"><span class="kv__k mono">${n}</span><b>${fa(c)}</b></div>`).join('')}</div></section>
      <section class="panel"><div class="panel__head">${icon('upload')}<h3>ورود گروهی افراد</h3></div>
        <div class="panel__body" style="display:flex;flex-direction:column;gap:7px">
          <textarea id="ad-csv" rows="6" placeholder="نام, عنوان شغلی, دپارتمان, برچسب‌ها&#10;سارا, طراح, محصول, ux|research"></textarea>
          <button class="btn btn--sm btn--primary" id="ad-csv-go">${icon('upload')} افزودن</button>
        </div></section>
      <section class="panel"><div class="panel__head">${icon('refresh')}<h3>همگام‌سازی</h3></div>
        <div class="panel__body" style="display:flex;flex-direction:column;gap:6px">
          <div class="kv"><span class="kv__k">آخرین همگام</span><span>${timeAgo(state.lastSync)}</span></div>
          <div class="kv"><span class="kv__k">کاربر</span><span class="mono">${esc(state.user?.id?.slice(0, 8) || 'مهمان')}</span></div>
          <button class="btn btn--sm" id="ad-full">${icon('refresh')} بارگذاری کامل</button>
          <button class="btn btn--sm" id="ad-export">${icon('download')} خروجی JSON</button>
        </div></section>
      <section class="panel"><div class="panel__head" style="color:var(--bad)">${icon('flag')}<h3>ناحیه حساس</h3></div>
        <div class="panel__body" style="display:flex;flex-direction:column;gap:6px">
          <span class="muted" style="font-size:11px">امتیازهای ساخته‌شده توسط شما حذف شوند.</span>
          <button class="btn btn--sm btn--danger" id="ad-wipe">${icon('trash')} حذف امتیازهای من</button>
        </div></section>
    </div>`;
    body.querySelector('#ad-csv-go').onclick = async () => {
      const txt = body.querySelector('#ad-csv').value.trim();
      if (!txt) return;
      const rows = txt.split('\n').map((l) => l.split(',').map((x) => x.trim())).filter((r) => r[0]);
      let done = 0;
      for (const r of rows) {
        try { await createPerson({ full_name: r[0], job_title: r[1] || null, department: r[2] || null, tags: (r[3] || '').split('|').filter(Boolean) }); done++; } catch (e) { console.warn(e.message); }
      }
      play('clink'); toast(`${fa(done)} نفر افزوده شد`, 'ok'); window.mx.reload();
    };
    body.querySelector('#ad-full').onclick = () => window.mx.reload();
    body.querySelector('#ad-export').onclick = () => {
      const data = { people: state.people, traits: state.traits, scores: state.scores, comments: state.comments, disputes: state.disputes };
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); a.download = 'admin-export.json'; a.click();
      play('save');
    };
    body.querySelector('#ad-wipe').onclick = async () => {
      const mine = state.scores.filter((s) => s.created_by === state.user?.id);
      if (!mine.length) return toast('امتیازی از شما نیست', 'info');
      if (!await confirmDialog({ title: 'حذف امتیازها', text: `${fa(mine.length)} امتیاز شما حذف شود؟`, danger: true, okText: 'حذف' })) return;
      let done = 0;
      for (const s of mine) { try { await deleteScoreById(s.id); done++; } catch { /* skip */ } }
      play('swoosh'); toast(`${fa(done)} حذف شد`, 'ok'); window.mx.reload();
    };
  }
}

function kpi(label, value, ic) {
  return `<div class="kpi"><div class="kpi__label">${icon(ic)} ${label}</div><div class="kpi__value">${value}</div></div>`;
}

function openRole(id) {
  const p = profiles.find((x) => x.id === id);
  openModal({
    title: 'تغییر نقش', slim: true,
    body: `<div class="kv"><span class="kv__k">کاربر</span><b>${esc(p?.display_name || id.slice(0, 8))}</b></div>
      <label class="field"><span>نقش</span><select id="rl-role">
        ${['member', 'moderator', 'admin', 'owner'].map((r) => `<option value="${r}" ${String(p?.role) === r ? 'selected' : ''}>${r}</option>`).join('')}
      </select></label>`,
    foot: `<div class="spacer"></div><button class="btn" data-close>انصراف</button><button class="btn btn--primary" id="rl-save">${icon('check')} ذخیره</button>`,
    onMount(node, close) {
      node.querySelector('#rl-save').onclick = async () => {
        const role = node.querySelector('#rl-role').value;
        const { error } = await sb.from('profiles').update({ role }).eq('id', id);
        if (error) return toast(errMsg(error), 'err', 4000);
        profiles = profiles.map((x) => (x.id === id ? { ...x, role } : x));
        play('clink'); toast('نقش تغییر کرد', 'ok'); close(); render(document.getElementById('view'));
      };
    },
  });
}

function openImport() {
  openModal({
    title: 'ورود گروهی افراد', wide: true,
    body: `<p class="muted" style="font-size:11px">هر خط: نام, عنوان شغلی, دپارتمان, برچسب‌ها (با |)</p>
      <textarea id="im-csv" rows="10" dir="auto" placeholder="سارا احمدی, طراح محصول, محصول, ux|research"></textarea>
      <div id="im-preview" class="muted" style="font-size:11px"></div>`,
    foot: `<div class="spacer"></div><button class="btn" data-close>انصراف</button><button class="btn btn--primary" id="im-go">${icon('upload')} افزودن</button>`,
    onMount(node, close) {
      const ta = node.querySelector('#im-csv');
      ta.oninput = () => {
        const n = ta.value.split('\n').filter((l) => l.trim()).length;
        node.querySelector('#im-preview').textContent = `${fa(n)} خط`;
      };
      node.querySelector('#im-go').onclick = async () => {
        const rows = ta.value.split('\n').map((l) => l.split(',').map((x) => x.trim())).filter((r) => r[0]);
        if (!rows.length) return;
        let done = 0, fail = 0;
        for (const r of rows) {
          try { await createPerson({ full_name: r[0], job_title: r[1] || null, department: r[2] || null, tags: (r[3] || '').split('|').filter(Boolean) }); done++; }
          catch { fail++; }
        }
        play('clink2'); toast(`${fa(done)} افزوده${fail ? `، ${fa(fail)} خطا` : ''}`, fail ? 'warn' : 'ok', 3200);
        close(); window.mx.reload();
      };
    },
  });
}

export { pct };
