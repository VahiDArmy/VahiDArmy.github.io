import { el, clear } from '../dom.js';
import { toast } from '../toast.js';
import { state } from '../../state.js';
import { loadModelsAndPrefs, setModelPref, syncModels } from '../../services/models.js';

export async function renderModels(root, ctx) {
  clear(root);
  root.appendChild(el('div', { class: 'panel-header' },
    el('h2', {}, 'Models'),
    el('div', { class: 'spacer' }),
    el('button', { class: 'btn btn-sm', onclick: () => doSync(root, ctx) }, 'Sync')
  ));

  const scroll = el('div', { class: 'panel-scroll' });
  root.appendChild(scroll);

  const searchInput = el('input', { class: 'input', type: 'text', placeholder: 'Search models…' });
  const freeOnly = el('input', { type: 'checkbox' });
  const filterRow = el('div', { class: 'row wrap gap-sm' },
    searchInput,
    el('label', { class: 'row small dim', style: 'gap:6px; cursor:pointer;' }, freeOnly, 'Free only')
  );
  scroll.appendChild(filterRow);

  const list = el('div', { class: 'mt-16' });
  scroll.appendChild(list);

  function applyFilter() {
    clear(list);
    const q = searchInput.value.toLowerCase();
    const showFree = freeOnly.checked;
    const models = state.models.filter((m) => {
      if (showFree && !m.is_free) return false;
      if (q && !m.id.toLowerCase().includes(q) && !m.name.toLowerCase().includes(q)) return false;
      return true;
    });
    if (!models.length) {
      list.appendChild(el('div', { class: 'empty' }, 'No matching models. Try clicking Sync.'));
      return;
    }
    for (const m of models) {
      const pref = state.modelPrefs.get(m.id);
      const enabled = pref?.enabled !== false;
      const row = el('div', { class: 'model-row' });
      const info = el('div', { class: 'info' },
        el('div', { class: 'name' }, m.name),
        el('div', { class: 'meta' },
          `${m.provider}${m.is_free ? ' · free' : ''}${m.supports_tools ? ' · tools' : ''}` +
          (m.context_length ? ` · ${(m.context_length / 1000).toFixed(0)}k ctx` : ''))
      );
      row.appendChild(info);
      const toggle = el('label', { class: 'toggle' });
      const cb = el('input', { type: 'checkbox', checked: enabled });
      cb.onchange = async () => {
        try {
          await setModelPref(m.id, { enabled: cb.checked });
          state.modelPrefs.set(m.id, { ...(pref || {}), enabled: cb.checked });
        } catch (err) {
          cb.checked = !cb.checked;
          toast(err.message, 'error');
        }
      };
      toggle.appendChild(cb);
      toggle.appendChild(el('span', {}));
      row.appendChild(toggle);
      list.appendChild(row);
    }
  }

  searchInput.oninput = applyFilter;
  freeOnly.onchange = applyFilter;
  applyFilter();
}

async function doSync(root, ctx) {
  try {
    toast('Syncing models from OpenRouter…', 'info', 5000);
    await syncModels();
    const { models, prefs } = await loadModelsAndPrefs();
    state.models = models;
    state.modelPrefs = prefs;
    toast(`Successfully synced ${models.length} models!`, 'success');
    renderModels(root, ctx);
  } catch (err) {
    console.error('Sync error:', err);
    toast(`Sync failed: ${err.message}`, 'error', 6000);
  }
}
