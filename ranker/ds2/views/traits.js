import { store } from '../lib/store.js';
import { Sound } from '../lib/sound.js';
import { esc, toast, openModal, confirmDialog } from '../lib/ui.js';

const ICONS = ['sparkles','heart','shield-halved','brain','face-laugh','handshake','fire','star','bolt','eye','gem','crown','compass','leaf','moon','sun','dragon','ghost'];

export default function TraitsView(root) {
  function render() {
    root.innerHTML = `
      <div class="view-pad">
        <div class="section-head">
          <div>
            <div class="section-title">Traits</div>
            <div class="section-sub">${store.traits.length} dimensions of the cube</div>
          </div>
          <button class="btn btn-primary" id="tr-add"><i class="fa-solid fa-plus"></i>&nbsp; Add trait</button>
        </div>
        ${store.traits.length ? `<div class="list-grid">
          ${store.traits.map(t => `
            <div class="entity-card">
              <div class="entity-head">
                <div style="width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-size:22px;color:${esc(t.color || '#a855f7')};background:${esc(t.color || '#a855f7')}22">
                  <i class="fa-solid fa-${esc(t.icon || 'sparkles')}"></i>
                </div>
                <div style="min-width:0;flex:1">
                  <div class="entity-name">${esc(t.name)}</div>
                  <div class="entity-sub">${esc(t.slug || '')}</div>
                </div>
              </div>
              ${t.description ? `<div style="font-size:12px;color:var(--text-dim);line-height:1.5;margin-bottom:8px">${esc(t.description)}</div>` : ''}
              <div class="entity-actions">
                <button data-edit="${t.id}"><i class="fa-solid fa-pen"></i> Edit</button>
                <button class="danger" data-del="${t.id}"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          `).join('')}
        </div>` : `<div class="empty">No traits yet.</div>`}
      </div>
    `;
    root.querySelector('#tr-add').onclick = () => editTrait(null);
    root.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
      const t = store.traits.find(x => x.id === b.dataset.edit);
      editTrait(t);
    });
    root.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const ok = await confirmDialog('Delete trait?', 'All associated scores will be removed.');
      if (!ok) return;
      try {
        await store.deleteTrait(b.dataset.del);
        toast('Trait deleted', 'success'); Sound.error();
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  function editTrait(t) {
    const isEdit = !!t;
    const content = document.createElement('div');
    content.innerHTML = `
      <div class="field"><label>Name</label><input id="f-name" value="${esc(t?.name || '')}" placeholder="Kindness"></div>
      <div class="field"><label>Icon</label>
        <select id="f-icon">${ICONS.map(i => `<option value="${i}" ${t?.icon === i ? 'selected' : ''}>${i}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Color</label><input id="f-color" type="color" value="${esc(t?.color || '#a855f7')}" style="height:44px"></div>
      <div class="field"><label>Description</label><textarea id="f-desc" rows="3">${esc(t?.description || '')}</textarea></div>
    `;
    openModal({
      title: isEdit ? 'Edit trait' : 'Add trait',
      content,
      actions: [
        { label: 'Cancel' },
        { label: isEdit ? 'Save' : 'Create', className: 'btn-primary', onClick: async () => {
          const name = content.querySelector('#f-name').value.trim();
          if (!name) { toast('Name required', 'error'); return false; }
          const payload = {
            name,
            icon: content.querySelector('#f-icon').value,
            color: content.querySelector('#f-color').value,
            description: content.querySelector('#f-desc').value.trim() || null
          };
          try {
            if (isEdit) await store.updateTrait(t.id, payload);
            else {
              payload.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).slice(2, 5);
              payload.created_by = store.user.id;
              payload.sort_order = store.traits.length;
              await store.addTrait(payload);
            }
            Sound.glass(0.8);
            toast(isEdit ? 'Saved' : 'Created', 'success');
          } catch (e) { toast(e.message, 'error'); return false; }
        }}
      ]
    });
  }

  render();
  const unsub = store.on(render);
  return { destroy: unsub };
}
