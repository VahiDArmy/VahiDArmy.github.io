import { store } from '../lib/store.js';
import { supabase } from '../lib/supabase.js';
import { Sound } from '../lib/sound.js';
import { toast, confirmDialog } from '../lib/ui.js';
import { getApiKey, setApiKey } from '../lib/ai.js';

export default function SettingsView(root) {
  function render() {
    root.innerHTML = `
      <div class="view-pad">
        <div class="section-head">
          <div>
            <div class="section-title">Settings</div>
            <div class="section-sub">Personal preferences & data.</div>
          </div>
        </div>

        <div class="settings-grid">
          <div class="panel">
            <div class="panel-title"><i class="fa-solid fa-user"></i> Account</div>
            <div class="field"><label>Email</label><input value="${store.user.email || ''}" disabled></div>
            <div class="field"><label>Linked person</label>
              <select id="st-person">
                <option value="">— none —</option>
                ${store.people.map(p => `<option value="${p.id}" ${store.myPerson?.id === p.id ? 'selected' : ''}>${p.full_name}</option>`).join('')}
              </select>
            </div>
            <button class="btn btn-ghost" id="st-link" style="margin-top:6px">Link</button>
            <div style="margin-top:20px">
              <button class="btn btn-danger btn-block" id="st-signout"><i class="fa-solid fa-right-from-bracket"></i>&nbsp; Sign out</button>
            </div>
          </div>

          <div class="panel">
            <div class="panel-title"><i class="fa-solid fa-volume-high"></i> Feedback</div>
            <div class="toggle-row">
              <div><div class="toggle-label">Sound effects</div><div class="toggle-sub">Glass clinks, taps & swipes</div></div>
              <div class="switch ${Sound.enabled ? 'on' : ''}" id="t-sound"></div>
            </div>
            <div class="toggle-row">
              <div><div class="toggle-label">Vibration</div><div class="toggle-sub">Haptic feedback on mobile</div></div>
              <div class="switch ${Sound.vib ? 'on' : ''}" id="t-vib"></div>
            </div>
            <div style="margin-top:16px">
              <button class="btn btn-ghost btn-block" id="t-test"><i class="fa-solid fa-wine-glass"></i>&nbsp; Test glass sound</button>
            </div>
          </div>

          <div class="panel">
            <div class="panel-title"><i class="fa-solid fa-key"></i> OpenRouter</div>
            <div class="field"><label>API key</label>
              <input id="st-key" type="password" value="${(getApiKey() || '').replace(/./g, '•')}" placeholder="sk-or-v1-…">
            </div>
            <button class="btn btn-primary" id="st-key-save">Save key</button>
            <div style="font-size:12px;color:var(--text-faint);margin-top:10px">Stored only in this browser.</div>
          </div>

          <div class="panel">
            <div class="panel-title"><i class="fa-solid fa-database"></i> Data</div>
            <div class="toggle-row" style="border:0;padding:0">
              <div><div class="toggle-label">Export cube</div><div class="toggle-sub">JSON of people, traits, scores</div></div>
              <button class="btn btn-ghost" id="st-export">Export</button>
            </div>
            <div class="toggle-row" style="border:0;padding:12px 0 0">
              <div><div class="toggle-label">Delete my scores</div><div class="toggle-sub">Removes scores you created</div></div>
              <button class="btn btn-danger" id="st-wipe">Wipe</button>
            </div>
          </div>
        </div>
      </div>
    `;

    root.querySelector('#st-signout').onclick = async () => {
      Sound.tap();
      await supabase.auth.signOut();
      location.reload();
    };

    const sw = (el, initial, onChange) => {
      let on = initial;
      el.onclick = () => {
        on = !on;
        el.classList.toggle('on', on);
        Sound.tap();
        onChange(on);
      };
    };
    sw(root.querySelector('#t-sound'), Sound.enabled, v => { Sound.setEnabled(v); if (v) Sound.glass(); });
    sw(root.querySelector('#t-vib'), Sound.vib, v => { Sound.setVib(v); if (v) Sound.vibrate(30); });
    root.querySelector('#t-test').onclick = () => Sound.glass(1);

    root.querySelector('#st-key-save').onclick = () => {
      const v = root.querySelector('#st-key').value;
      if (v.includes('•')) return toast('Type a new key', 'info');
      setApiKey(v.trim());
      root.querySelector('#st-key').value = (v.trim()).replace(/./g, '•');
      toast('API key saved', 'success');
    };

    root.querySelector('#st-link').onclick = async () => {
      const id = root.querySelector('#st-person').value;
      if (!id) return toast('Select a person', 'error');
      try {
        const myId = store.myPerson?.id;
        if (myId && myId !== id) await supabase.from('people').update({ user_id: null }).eq('id', myId);
        await supabase.from('people').update({ user_id: store.user.id }).eq('id', id);
        await store.load();
        toast('Linked', 'success');
        render();
      } catch (e) { toast(e.message, 'error'); }
    };

    root.querySelector('#st-export').onclick = () => {
      const data = {
        exported_at: new Date().toISOString(),
        people: store.people,
        traits: store.traits,
        scores: store.scores
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `matrix3d-export-${Date.now()}.json`;
      a.click();
      Sound.glass(0.6);
    };

    root.querySelector('#st-wipe').onclick = async () => {
      const ok = await confirmDialog('Delete your scores?', 'This deletes every mx_scores row you created.');
      if (!ok) return;
      try {
        await supabase.from('mx_scores').delete().eq('created_by', store.user.id);
        await store.load();
        toast('Wiped', 'success');
      } catch (e) { toast(e.message, 'error'); }
    };
  }
  render();
  const unsub = store.on(render);
  return { destroy: unsub };
}
