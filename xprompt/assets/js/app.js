import { diffWordsWithSpace } from 'https://esm.sh/diff@5.2.0';
import { detectDirection, renderDiffLines, escapeHtml, toast, wordCount } from './utils.js';
import * as DB from './supabase.js';
import { fetchFreeModels, refine } from './openrouter.js';

const $ = (sel) => document.querySelector(sel);

const els = {
  textarea:      $('#prompt-input'),
  refined:       $('#refined-output'),
  charCount:     $('#char-count'),
  dirIndicator:  $('#dir-indicator'),
  status:        $('#status-text'),
  diffStats:     $('#diff-stats'),
  modelSelect:   $('#model-select'),
  btnLevel1:     $('#btn-level1'),
  btnLevel2:     $('#btn-level2'),
  btnUse:        $('#btn-use'),
  paneRefined:   document.querySelector('.pane-refined'),
  modelsList:    $('#models-list'),
  apiKeyInput:   $('#api-key'),
  reasoningPanel:   $('#reasoning-panel'),
  reasoningContent: $('#reasoning-content'),
  reasoningMeta:    $('#reasoning-meta')
};

const state = {
  apiKey:        localStorage.getItem('pf_openrouter_key') || '',
  models:        [],
  selectedId:    localStorage.getItem('pf_model_id') || null,
  direction:     'auto',          // 'auto' | 'ltr' | 'rtl'
  busy:          false,
  refinedText:   '',
  reasoning:     '',
  usage:         null,
  hideDeletions: false
};

/* ---------------- Startup ---------------- */

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  applyDirectionSetting();
  updateCharCount();
  updateUseButton();
  await loadModels();

  if (!state.apiKey) {
    toast('Add your OpenRouter API key in Settings to begin.', 'info', 5000);
  }
});

/* ---------------- Events ---------------- */

function bindEvents() {
  // Editor input
  els.textarea.addEventListener('input', () => {
    updateCharCount();
    if (state.direction === 'auto') applyDirectionSetting();
  });

  // Direction segmented control
  document.querySelectorAll('#dir-toggle button').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.direction = btn.dataset.dir;
      document.querySelectorAll('#dir-toggle button')
        .forEach((b) => b.classList.toggle('active', b === btn));
      applyDirectionSetting();
    });
  });

  // Refine buttons
  els.btnLevel1.addEventListener('click', () => runRefine(1));
  els.btnLevel2.addEventListener('click', () => runRefine(2));

  // Copy / clear / toggle deletions / use
  $('#btn-copy').addEventListener('click', copyRefined);
  els.btnUse.addEventListener('click', useRefinedAsInput);
  $('#btn-clear').addEventListener('click', () => {
    els.textarea.value = '';
    resetRefinedPane();
    updateCharCount();
    applyDirectionSetting();
    hideReasoning();
    els.textarea.focus();
  });
  $('#btn-toggle-del').addEventListener('click', () => {
    state.hideDeletions = !state.hideDeletions;
    els.refined.classList.toggle('hide-del', state.hideDeletions);
  });

  // Reasoning panel
  $('#btn-close-reasoning').addEventListener('click', hideReasoning);
  $('#btn-copy-reasoning').addEventListener('click', async () => {
    if (!state.reasoning) return;
    try {
      await navigator.clipboard.writeText(state.reasoning);
      toast('Reasoning copied.', 'success');
    } catch {
      toast('Clipboard unavailable.', 'error');
    }
  });

  // Modals
  $('#btn-settings').addEventListener('click', openSettings);
  $('#btn-models').addEventListener('click', openModels);
  document.querySelectorAll('[data-close]').forEach((b) =>
    b.addEventListener('click', () => b.closest('.modal').hidden = true)
  );
  document.querySelectorAll('.modal').forEach((m) => {
    m.addEventListener('click', (e) => {
      if (e.target === m) m.hidden = true;
    });
  });

  // Settings
  $('#btn-save-key').addEventListener('click', saveApiKey);
  $('#btn-clear-key').addEventListener('click', () => {
    localStorage.removeItem('pf_openrouter_key');
    state.apiKey = '';
    els.apiKeyInput.value = '';
    toast('API key removed.', 'success');
  });
  els.apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveApiKey();
  });

  // Models modal
  $('#btn-fetch-models').addEventListener('click', onFetchModels);
  els.modelsList.addEventListener('click', onModelAction);

  // Model select
  els.modelSelect.addEventListener('change', () => {
    state.selectedId = els.modelSelect.value || null;
    if (state.selectedId) localStorage.setItem('pf_model_id', state.selectedId);
  });

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) runRefine(2);
      else runRefine(1);
    }
  });
}

/* ---------------- Direction / counters ---------------- */

function applyDirectionSetting() {
  const text = els.textarea.value;
  const detected = detectDirection(text);
  const dir = state.direction === 'auto' ? detected : state.direction;

  els.textarea.setAttribute('dir', dir);
  els.dirIndicator.textContent = state.direction === 'auto'
    ? `AUTO · ${detected.toUpperCase()}`
    : dir.toUpperCase();

  els.refined.setAttribute('dir', dir);
}

function updateCharCount() {
  const n = els.textarea.value.length;
  els.charCount.textContent = `${n.toLocaleString()} character${n === 1 ? '' : 's'}`;
}

/* ---------------- Refine ---------------- */

async function runRefine(level) {
  if (state.busy) return;

  const text = els.textarea.value.trim();
  if (!text) { toast('Write a prompt first.', 'error'); return; }
  if (!state.apiKey) { openSettings(); toast('Add your OpenRouter API key.', 'error'); return; }
  if (!state.selectedId) { openModels(); toast('Select or add a model first.', 'error'); return; }

  setBusy(true);
  els.status.textContent = level === 2 ? 'Deep review in progress…' : 'Fixing grammar…';
  els.diffStats.textContent = '';

  try {
    const result = await refine({
      apiKey: state.apiKey,
      model: state.selectedId,
      text,
      level
    });

    state.refinedText = result.text;
    state.reasoning = result.reasoning || '';
    state.usage = result.usage || null;

    const detected = detectDirection(result.text);
    const dir = state.direction === 'auto' ? detected : state.direction;

    const parts = diffWordsWithSpace(els.textarea.value, result.text);
    els.refined.setAttribute('dir', dir);
    els.refined.innerHTML = renderDiffLines(parts);
    els.refined.dataset.hasContent = 'true';
    els.refined.classList.toggle('hide-del', state.hideDeletions);

    let added = 0, removed = 0;
    for (const p of parts) {
      if (p.added) added += wordCount(p.value);
      else if (p.removed) removed += wordCount(p.value);
    }
    els.diffStats.textContent = `+${added} −${removed} words`;
    els.status.textContent = level === 2 ? 'Deep review complete' : 'Grammar fixed';

    showReasoning(state.reasoning, state.usage);
    updateUseButton();

    toast(level === 2 ? 'Deep review applied.' : 'Grammar applied.', 'success');
  } catch (err) {
    console.error(err);
    els.status.textContent = 'Error';
    toast(err.message || 'Refinement failed.', 'error', 6000);
  } finally {
    setBusy(false);
  }
}

function setBusy(busy) {
  state.busy = busy;
  els.btnLevel1.disabled = busy;
  els.btnLevel2.disabled = busy;
  els.paneRefined.classList.toggle('loading', busy);
  updateUseButton();
}

function updateUseButton() {
  els.btnUse.disabled = state.busy || !state.refinedText;
}

async function copyRefined() {
  if (!state.refinedText) { toast('Nothing to copy yet.', 'error'); return; }
  try {
    await navigator.clipboard.writeText(state.refinedText);
    toast('Refined prompt copied.', 'success');
  } catch {
    toast('Clipboard unavailable.', 'error');
  }
}

function useRefinedAsInput() {
  if (!state.refinedText) { toast('Nothing to use yet.', 'error'); return; }
  els.textarea.value = state.refinedText;
  els.textarea.dispatchEvent(new Event('input'));

  resetRefinedPane();
  hideReasoning();
  els.status.textContent = 'Applied as new input';
  toast('Refined prompt moved to input.', 'success');
  els.textarea.focus();
}

function resetRefinedPane() {
  els.refined.innerHTML = '<div class="placeholder">Your refined prompt will appear here.<br><small>Green glow = added or changed · red = removed</small></div>';
  els.refined.dataset.hasContent = 'false';
  els.refined.removeAttribute('dir');
  els.refined.setAttribute('dir', 'auto');
  state.refinedText = '';
  state.reasoning = '';
  state.usage = null;
  els.diffStats.textContent = '';
  els.status.textContent = 'Ready';
  updateUseButton();
}

/* ---------------- Reasoning ---------------- */

function showReasoning(reasoning, usage) {
  if (!reasoning || !reasoning.trim()) { hideReasoning(); return; }

  els.reasoningContent.textContent = reasoning;
  els.reasoningContent.setAttribute('dir', 'auto');

  const bits = [];
  if (usage?.prompt_tokens)     bits.push(`${usage.prompt_tokens} in`);
  if (usage?.completion_tokens) bits.push(`${usage.completion_tokens} out`);
  els.reasoningMeta.textContent = bits.join(' · ');

  els.reasoningPanel.hidden = false;
}

function hideReasoning() {
  els.reasoningPanel.hidden = true;
  els.reasoningContent.textContent = '';
  els.reasoningMeta.textContent = '';
}

/* ---------------- Settings ---------------- */

function openSettings() {
  els.apiKeyInput.value = state.apiKey;
  $('#modal-settings').hidden = false;
  setTimeout(() => els.apiKeyInput.focus(), 40);
}

function saveApiKey() {
  const key = els.apiKeyInput.value.trim();
  if (!key) { toast('Key is empty.', 'error'); return; }
  localStorage.setItem('pf_openrouter_key', key);
  state.apiKey = key;
  toast('API key saved.', 'success');
  $('#modal-settings').hidden = true;
}

/* ---------------- Models ---------------- */

async function loadModels() {
  try {
    state.models = await DB.listModels();
    refreshModelSelect();
    renderModelsList();
  } catch (err) {
    console.error(err);
    toast('Could not load models. Check Supabase RLS policies.', 'error', 6000);
  }
}

function refreshModelSelect() {
  const active = state.models.filter((m) => m.active);
  if (!active.length) {
    els.modelSelect.innerHTML = '<option value="">No active models</option>';
    els.modelSelect.disabled = true;
    state.selectedId = null;
    return;
  }
  els.modelSelect.disabled = false;

  let selected = state.selectedId;
  if (!active.some((m) => m.model_id === selected)) {
    const def = active.find((m) => m.is_default);
    selected = def ? def.model_id : active[0].model_id;
    state.selectedId = selected;
    localStorage.setItem('pf_model_id', selected);
  }

  els.modelSelect.innerHTML = active.map((m) =>
    `<option value="${escapeHtml(m.model_id)}">${escapeHtml(m.label || m.model_id)}</option>`
  ).join('');
  els.modelSelect.value = selected;
}

function renderModelsList() {
  if (!state.models.length) {
    els.modelsList.innerHTML = `<div class="empty">No models yet. Click <b>Fetch free models</b> to import from OpenRouter.</div>`;
    return;
  }

  els.modelsList.innerHTML = state.models.map((m) => {
    const badges = [];
    if (m.is_default) badges.push('<span class="badge badge-default">default</span>');
    if (!m.active)   badges.push('<span class="badge badge-inactive">inactive</span>');
    return `
      <div class="model-row" data-id="${escapeHtml(m.model_id)}" data-default="${!!m.is_default}">
        <div class="model-main">
          <div class="model-title">
            <span class="model-label">${escapeHtml(m.label || m.model_id)}</span>
            ${badges.join('')}
          </div>
          <div class="model-meta">
            ${escapeHtml(m.model_id)} · ${escapeHtml(m.provider || '—')} · ${(m.context_length || 0).toLocaleString()} ctx
          </div>
        </div>
        <div class="model-actions">
          <button class="btn tiny" data-action="default" ${m.is_default ? 'disabled' : ''}>☆ Default</button>
          <button class="btn tiny" data-action="toggle">${m.active ? 'Deactivate' : 'Activate'}</button>
          <button class="btn tiny danger" data-action="delete">Delete</button>
        </div>
      </div>`;
  }).join('');
}

function openModels() {
  renderModelsList();
  $('#modal-models').hidden = false;
}

async function onFetchModels() {
  const btn = $('#btn-fetch-models');
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Fetching…';
  try {
    const free = await fetchFreeModels(state.apiKey);
    if (!free.length) { toast('No free models returned by OpenRouter.', 'error'); return; }
    await DB.upsertModels(free);
    await loadModels();
    toast(`Imported ${free.length} free models.`, 'success');
  } catch (err) {
    console.error(err);
    toast(err.message || 'Failed to fetch models.', 'error', 6000);
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

async function onModelAction(e) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const row = btn.closest('.model-row');
  const id = row?.dataset.id;
  const action = btn.dataset.action;
  if (!id) return;

  const model = state.models.find((m) => m.model_id === id);
  if (!model) return;

  try {
    if (action === 'default') {
      await DB.setDefaultModel(id);
      toast(`Default set to ${model.label || id}.`, 'success');
    } else if (action === 'toggle') {
      await DB.toggleActive(id, !model.active);
      toast(model.active ? 'Model deactivated.' : 'Model activated.', 'success');
    } else if (action === 'delete') {
      if (!confirm(`Delete "${model.label || id}"? This cannot be undone.`)) return;
      await DB.deleteModel(id);
      toast('Model deleted.', 'success');
      if (state.selectedId === id) {
        state.selectedId = null;
        localStorage.removeItem('pf_model_id');
      }
    }
    await loadModels();
  } catch (err) {
    console.error(err);
    toast(err.message || 'Operation failed.', 'error', 6000);
  }
}
