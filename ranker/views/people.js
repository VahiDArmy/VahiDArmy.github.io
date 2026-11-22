import { store } from '../lib/store.js';
import { Sound } from '../lib/sound.js';
import { avatarHtml, esc, toast, openModal, confirmDialog } from '../lib/ui.js';

export default function PeopleView(root) {
  let search = '';

  function render() {
    const list = store.people.filter(p => !search || p.full_name.toLowerCase().includes(search.toLowerCase()));
    root.innerHTML = `
      <div class="view-pad">
        <div class="section-head">
          <div>
            <div class="section-title">People</div>
            <div class="section-sub">${store.people.length} in the cube</div>
          </div>
          <div style="display:flex;gap:10px;align-items:center">
            <input class="search-input" placeholder="Search people…" value="${esc(search)}" id="ppl-search">
            <button class="btn btn-primary" id="ppl-add"><i class="fa-solid fa-plus"></i>&nbsp; Add person</button>
          </div>
        </div>
        ${list.length ? `<div class="list-grid">
          ${list.map(p => `
            <div class="entity-card">
              <div class="entity-head">
                ${avatarHtml(p, 48)}
                <div style="min-width:0;flex:1">
                  <div class="entity-name">${esc(p.full_name)}</div>
                  <div class="entity-sub">${esc(p.job_title || '—')} · ${esc(p.department || 'no dept')}</div>
                </div>
              </div>
              ${p.bio ? `<div style="font-size:12px;color:var(--text-dim);line-height:1.5;margin-bottom:8px">${esc(p.bio).slice(0, 120)}</div>` : ''}
              <div class="entity-actions">
                <button data-edit="${p.id}"><i class="fa-solid fa-pen"></i> Edit</button>
                <button class="danger" data-del="${p.id}"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          `).join('')}
        </div>` : `<div class="empty">No people. Add the first one.</div>`}
      </div>
    `;

    const si = root.querySelector('#ppl-search');
    si.oninput = e => { search = e.target.value; render(); si.focus(); si.setSelectionRange(search.length, search.length); };
    root.querySelector('#ppl-add').onclick = () => editPerson(null);
    root.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
      const p = store.people.find(x => x.id === b.dataset.edit);
      editPerson(p);
    });
    root.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const ok = await confirmDialog('Delete person?', 'All their scores will be removed.');
      if (!ok) return;
      try {
        await store.deletePerson(b.dataset.del);
        Sound.error();
        toast('Person deleted', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  function editPerson(p) {
    const isEdit = !!p;
    const content = document.createElement('div');
    content.innerHTML = `
      <div class="field"><label>Full name</label><input id="f-name" value="${esc(p?.full_name || '')}" placeholder="Jane Doe"></div>
      <div class="field"><label>Job title</label><input id="f-job" value="${esc(p?.job_title || '')}" placeholder="Product Manager"></div>
      <div class="field"><label>Department</label><input id="f-dept" value="${esc(p?.department || '')}" placeholder="Design"></div>
      <div class="field"><label>Avatar URL</label><input id="f-avatar" value="${esc(p?.avatar_url || '')}" placeholder="https://…"></div>
      <div class="field"><label>Bio</label><textarea id="f-bio" rows="3" placeholder="Short bio">${esc(p?.bio || '')}</textarea></div>
    `;
    openModal({
      title: isEdit ? 'Edit person' : 'Add person',
      subtitle: isEdit ? 'Update the record.' : 'They will join the cube.',
      content,
      actions: [
        { label: 'Cancel' },
        { label: isEdit ? 'Save' : 'Create', className: 'btn-primary', onClick: async () => {
          const full_name = content.querySelector('#f-name').value.trim();
          if (!full_name) { toast('Name required', 'error'); return false; }
          const payload = {
            full_name,
            job_title: content.querySelector('#f-job').value.trim() || null,
            department: content.querySelector('#f-dept').value.trim() || null,
            avatar_url: content.querySelector('#f-avatar').value.trim() || null,
            bio: content.querySelector('#f-bio').value.trim() || null
          };
          try {
            if (isEdit) await store.updatePerson(p.id, payload);
            else {
              payload.slug = full_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6);
              payload.created_by = store.user.id;
              await store.addPerson(payload);
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
