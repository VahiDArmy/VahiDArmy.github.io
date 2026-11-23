/* views/traits.js — trait (layer) CRUD */
import { state, esc, icon, fa, faNum, pct, toast, openModal, confirmDialog, play, haptic, isAdmin, canEditTrait, errMsg } from '../core.js';
import { createTrait, updateTrait, deleteTrait, logEvent } from '../data.js';
import { traitStats, norm } from '../matrix.js';

const ICONS = ['heart', 'flame', 'shield', 'compass', 'spark', 'scale', 'target', 'wave', 'bolt', 'mountain', 'rocket', 'diamond', 'hourglass', 'sun', 'gem', 'brain', 'users', 'zap'];
const COLORS = ['#ff7bc6', '#ffb454', '#5ef2d6', '#7c5cff', '#7aa2ff', '#c39bff', '#8ef2a1', '#4cc9f0', '#ff9a8b', '#ffe066', '#ff6b6b', '#a8e6ff', '#b8c4ff', '#ffd28a'];

export async function render(host) {
  const traits = [...state.traits].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  host.innerHTML = `
    <div class="pagehead">
      <h2>${icon('sliders')} ویژگی‌ها</h2>
      <div class="pagehead__sub">${fa(traits.length)} لایه · هر ویژگی یک لایه از ماتریس است</div>
      <div class="spacer"></div>
      <div class="toolrow">
        <button class="btn btn--sm" id="tr-ai">${icon('brain')} پیشنهاد ویژگی</button>
        <button class="btn btn--sm btn--primary" id="tr-new">${icon('plus')} ویژگی جدید</button>
      </div>
    </div>
    <div class="grid grid--3" id="tr-grid">
      ${traits.map((t, i) => card(t, i, traits.length)).join('') || `<div class="empty">${icon('sliders')} ویژگی‌ای نیست</div>`}
    </div>
    <div style="margin-top:12px" class="panel">
      <div class="panel__head">${icon('layers')}<h3>وزن و پوشش لایه‌ها</h3><div class="spacer"></div><span class="count">میانگین وزنی در رتبه‌بندی</span></div>
      <div class="panel__body" style="display:flex;flex-direction:column;gap:9px">
        ${traits.map((t) => {
          const s = traitStats(t.id);
          const possible = Math.max(1, state.people.length * (state.people.length - 1));
          return `<div style="display:grid;grid-template-columns:130px 1fr 58px 58px 70px;gap:9px;align-items:center;font-size:11px">
            <span style="display:flex;align-items:center;gap:6px"><i class="stackcard__sw" style="--tc:${esc(t.color)}"></i>${esc(t.name)}</span>
            <div class="bar"><i style="width:${(s.n / possible) * 100}%;background:${esc(t.color)}"></i></div>
            <span class="muted">${pct(s.n / possible)}</span>
            <span class="muted">±${faNum(s.sd, 2)}</span>
            <span class="chip">وزن ${faNum(t.weight, 2)}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  host.querySelector('#tr-new').onclick = () => openTraitEditor();
  host.querySelector('#tr-ai').onclick = () => import('../ai.js').then((m) => m.openPanel('traits'));
  host.querySelectorAll('[data-tr]').forEach((b) => b.onclick = async () => {
    const t = state.traits.find((x) => x.id === b.dataset.tr);
    if (!t) return;
    const act = b.dataset.act;
    if (act === 'edit') return openTraitEditor(t);
    if (act === 'del') {
      const ok = await confirmDialog({ title: 'حذف ویژگی', text: `«${t.name}» و همه امتیازهای آن حذف می‌شود.`, danger: true, okText: 'حذف' });
      if (!ok) return;
      try { await deleteTrait(t.id); play('swoosh'); toast('حذف شد', 'ok'); window.mx.reload(); } catch (e) { toast(errMsg(e), 'err'); }
      return;
    }
    if (act === 'up' || act === 'down') {
      const arr = [...state.traits].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      const i = arr.findIndex((x) => x.id === t.id);
      const j = act === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= arr.length) return;
      const a = arr[i], b2 = arr[j];
      try {
        await updateTrait(a.id, { sort_order: b2.sort_order ?? j });
        await updateTrait(b2.id, { sort_order: a.sort_order ?? i });
        play('tap'); window.mx.reload();
      } catch (e) { toast(errMsg(e), 'err'); }
      return;
    }
    if (act === 'toggle') {
      try {
        await updateTrait(t.id, { metadata: { ...(t.metadata || {}), active: t.metadata?.active === false } });
        play('toggle'); window.mx.reload();
      } catch (e) { toast(errMsg(e), 'err'); }
      return;
    }
    if (act === 'matrix') {
      const m = await import('../matrix.js');
      window.mx.navigate('matrix');
      setTimeout(() => { m.mx.mode = 'trait'; m.mx.stack = Math.max(0, m.stacksFor('trait').findIndex((s) => s.id === t.id)); m.renderMatrix(document.getElementById('view')); }, 120);
    }
  });
}

function card(t, i, total) {
  const s = traitStats(t.id);
  const possible = Math.max(1, state.people.length * (state.people.length - 1));
  const active = t.metadata?.active !== false;
  return `<section class="panel" style="overflow:hidden;${active ? '' : 'opacity:.55'}">
    <div style="padding:12px;display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:color-mix(in srgb,${esc(t.color)} 18%,transparent);color:${esc(t.color)}">${icon(t.icon || 'spark')}</span>
        <div style="display:flex;flex-direction:column;line-height:1.25;min-width:0">
          <strong style="font-size:13px">${esc(t.name)}</strong>
          <span class="muted" style="font-size:9.5px;direction:ltr;text-align:right">${esc(t.key)}</span>
        </div>
        <span class="spacer" style="flex:1"></span>
        ${t.is_core ? `<span class="chip chip--acc">هسته</span>` : ''}
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        <span class="chip">${esc(t.category || 'general')}</span>
        <span class="chip">${faNum(t.min_value)}–${faNum(t.max_value)}</span>
        <span class="chip">وزن ${faNum(t.weight, 2)}</span>
        <span class="chip">${fa(s.n)} امتیاز</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center;font-size:10.5px;color:var(--ink-3)">
        <span>میانگین <b style="color:var(--ink)">${faNum(s.avg, 2)}</b></span>
        <div class="bar" style="flex:1"><i style="width:${(s.n / possible) * 100}%;background:${esc(t.color)}"></i></div>
        <span>${pct(s.n / possible)}</span>
      </div>
      <div style="display:flex;gap:3px;justify-content:flex-end">
        <button class="iconbtn iconbtn--xs" data-tr="${t.id}" data-act="up" ${i === 0 ? 'disabled' : ''} title="بالا">${icon('chev-up')}</button>
        <button class="iconbtn iconbtn--xs" data-tr="${t.id}" data-act="down" ${i === total - 1 ? 'disabled' : ''} title="پایین">${icon('chev-down')}</button>
        <button class="iconbtn iconbtn--xs" data-tr="${t.id}" data-act="toggle" title="فعال/غیرفعال">${icon(active ? 'eye' : 'eye-off')}</button>
        <button class="iconbtn iconbtn--xs" data-tr="${t.id}" data-act="matrix" title="در ماتریس">${icon('layers')}</button>
        <button class="iconbtn iconbtn--xs" data-tr="${t.id}" data-act="edit" title="ویرایش">${icon('edit')}</button>
        ${isAdmin() ? `<button class="iconbtn iconbtn--xs" data-tr="${t.id}" data-act="del" title="حذف">${icon('trash')}</button>` : ''}
      </div>
    </div>
  </section>`;
}

export function openTraitEditor(trait = null) {
  if (!state.user) return toast('برای ویرایش وارد شوید', 'warn');
  const t = trait || {};
  const body = `<div class="formgrid">
    <label class="field full"><span>نام ویژگی *</span><input id="tf-name" value="${esc(t.name || '')}" placeholder="مثلاً صداقت"></label>
    <label class="field"><span>کلید (یکتا)</span><input id="tf-key" dir="ltr" value="${esc(t.key || '')}" placeholder="honesty"></label>
    <label class="field"><span>دسته</span><input id="tf-cat" value="${esc(t.category || 'general')}"></label>
    <label class="field"><span>کمینه</span><input id="tf-min" type="number" step="1" value="${esc(t.min_value ?? 0)}"></label>
    <label class="field"><span>بیشینه</span><input id="tf-max" type="number" step="1" value="${esc(t.max_value ?? 10)}"></label>
    <label class="field"><span>وزن</span><input id="tf-weight" type="number" step="0.1" min="0.1" value="${esc(t.weight ?? 1)}"></label>
    <label class="field"><span>قطبیت</span><select id="tf-pol"><option value="1" ${Number(t.polarity ?? 1) === 1 ? 'selected' : ''}>مثبت</option><option value="-1" ${Number(t.polarity) === -1 ? 'selected' : ''}>منفی</option></select></label>
    <label class="field full"><span>توضیح</span><input id="tf-desc" value="${esc(t.description || '')}"></label>
    <div class="field full"><span>رنگ</span><div id="tf-colors" style="display:flex;gap:5px;flex-wrap:wrap">
      ${COLORS.map((c) => `<button type="button" data-c="${c}" class="swatch" style="width:24px;height:24px;border-radius:7px;background:${c};border:2px solid ${(t.color || COLORS[2]) === c ? '#fff' : 'transparent'}"></button>`).join('')}
      <input id="tf-color" dir="ltr" value="${esc(t.color || '#5ef2d6')}" style="width:96px;margin-inline-start:6px">
    </div></div>
    <div class="field full"><span>آیکون</span><div id="tf-icons" style="display:flex;gap:4px;flex-wrap:wrap">
      ${ICONS.map((n) => `<button type="button" data-i="${n}" class="iconbtn ${(t.icon || 'spark') === n ? 'is-on' : ''}" style="border:1px solid var(--line)">${icon(n)}</button>`).join('')}
    </div></div>
    <label class="kv full" style="border:0"><span class="kv__k">ویژگی هسته‌ای</span><button type="button" class="switch ${t.is_core ? 'is-on' : ''}" id="tf-core"></button></label>
  </div>`;
  openModal({
    title: t.id ? 'ویرایش ویژگی' : 'ویژگی جدید', body,
    foot: `<div class="spacer"></div><button class="btn" data-close>انصراف</button><button class="btn btn--primary" id="tf-save">${icon('check')} ذخیره</button>`,
    onMount(node, close) {
      let core = !!t.is_core;
      node.querySelector('#tf-core').onclick = (e) => { core = !core; e.currentTarget.classList.toggle('is-on', core); };
      node.querySelectorAll('#tf-colors [data-c]').forEach((b) => b.onclick = () => {
        node.querySelector('#tf-color').value = b.dataset.c;
        node.querySelectorAll('#tf-colors [data-c]').forEach((x) => x.style.borderColor = x === b ? '#fff' : 'transparent');
      });
      node.querySelectorAll('#tf-icons [data-i]').forEach((b) => b.onclick = () => {
        node.querySelectorAll('#tf-icons .iconbtn').forEach((x) => x.classList.toggle('is-on', x === b));
      });
      node.querySelector('#tf-save').onclick = async () => {
        const payload = {
          name: node.querySelector('#tf-name').value.trim(),
          key: node.querySelector('#tf-key').value.trim() || `t_${Math.random().toString(36).slice(2, 8)}`,
          category: node.querySelector('#tf-cat').value.trim() || 'general',
          min_value: Number(node.querySelector('#tf-min').value),
          max_value: Number(node.querySelector('#tf-max').value),
          weight: Number(node.querySelector('#tf-weight').value) || 1,
          polarity: Number(node.querySelector('#tf-pol').value),
          description: node.querySelector('#tf-desc').value.trim() || null,
          color: node.querySelector('#tf-color').value.trim() || '#5ef2d6',
          icon: node.querySelector('#tf-icons .is-on')?.dataset.i || 'spark',
          is_core: core,
        };
        if (!payload.name) return toast('نام لازم است', 'warn');
        if (payload.max_value <= payload.min_value) return toast('بیشینه باید بزرگ‌تر باشد', 'warn');
        try {
          if (t.id) { await updateTrait(t.id, payload); toast('به‌روزرسانی شد', 'ok'); }
          else { const row = await createTrait({ ...payload, sort_order: state.traits.length }); toast('ویژگی ساخته شد', 'ok'); logEvent('trait.create', row.name); }
          play('clink'); haptic([8, 20, 8]); close(); window.mx.reload();
        } catch (e) { toast(errMsg(e), 'err', 4000); }
      };
    },
  });
}

export { norm, canEditTrait };
