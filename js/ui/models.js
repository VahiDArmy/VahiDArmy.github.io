// ---------------------------------------------------------------------------
// Model registry: sync, filter, enable/disable, role assignment.
// ---------------------------------------------------------------------------

import { repo } from '../core/repo.js';
import { applyPreferences } from '../core/models.js';
import { escapeHtml, timeAgo } from '../core/util.js';
import { icon, toast, emptyState, confirmDialog } from './dom.js';

const ROLES = [
  { key: 'chat', label: 'Chat & questions' },
  { key: 'plan', label: 'Planning' },
  { key: 'code', label: 'Code changes' },
  { key: 'review', label: 'Review' },
];

export async function renderModels(root, ctx) {
  root.innerHTML = `
    <div class="page-head">
      <div style="flex:1">
        <h1>Models</h1>
        <p>Catalog synced from OpenRouter. Your on/off choices are yours — a sync never re-enables a model.</p>
      </div>
      <button class="btn" id="sync-models">${icon('refresh')} Sync</button>
    </div>
    <div id="models-body"><div class="skeleton" style="height:200px"></div></div>`;

  const body = root.querySelector('#models-body');
  let query = '';
  let filter = 'enabled';

  if (!ctx.state.modelsReady) {
    await ctx.ensureModels().catch(() => {});
  }

  function models() {
    return applyPreferences(ctx.state.registry || [], ctx.state.prefs || {});
  }

  function paint() {
    const settings = ctx.state.settings || {};
    const all = models();
    const enabledCount = all.filter((model) => model.enabled).length;
    const freeCount = all.filter((model) => model.is_free).length;

    let list = all;
    if (filter === 'enabled') list = list.filter((model) => model.enabled);
    if (filter === 'free') list = list.filter((model) => model.is_free);
    if (filter === 'tools') list = list.filter((model) => model.supports_tools);
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      list = list.filter((model) => model.id.toLowerCase().includes(needle) || model.name.toLowerCase().includes(needle));
    }
    list = [...list].sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      if (a.is_free !== b.is_free) return a.is_free ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    body.innerHTML = `
      <div class="card" style="margin-bottom:14px">
        <div class="section-title">Model per role</div>
        <div style="display:grid;gap:9px">
          ${ROLES.map((role) => `
            <div class="row">
              <span class="small" style="width:130px;color:var(--text-2)">${role.label}</span>
              <select class="select" data-role="${role.key}">
                <option value="">Automatic</option>
                ${all.filter((model) => model.enabled).map((model) => `
                  <option value="${escapeHtml(model.id)}" ${settings.roleModels?.[role.key] === model.id ? 'selected' : ''}>
                    ${escapeHtml(model.name)}${model.is_free ? ' (free)' : ''}
                  </option>`).join('')}
              </select>
            </div>`).join('')}
        </div>
        <p class="tiny muted" style="margin-top:9px">
          The project-level choice on the chat screen overrides these. Automatic picks a tool-capable model and falls back to another provider if it fails.
        </p>
      </div>

      <div class="row wrap" style="margin-bottom:10px;gap:8px">
        <div class="searchbox" style="flex:1;min-width:160px">${icon('search')}<input id="model-search" placeholder="Search models" value="${escapeHtml(query)}" /></div>
        <button class="btn small ghost" id="models-refresh" aria-label="Reload list">${icon('refresh')}</button>
      </div>
      <div class="filter-row">
        ${[['enabled', `Enabled ${enabledCount}`], ['all', `All ${all.length}`], ['free', `Free ${freeCount}`], ['tools', 'Tool calling']]
          .map(([key, label]) => `<button class="filter-chip ${filter === key ? 'active' : ''}" data-filter="${key}">${label}</button>`).join('')}
      </div>

      <div class="card" style="padding:0;overflow:hidden">
        ${list.length ? list.slice(0, 300).map(row).join('') : emptyState({
          iconName: 'cpu',
          title: ctx.state.registry?.length ? 'Nothing matches' : 'No models cached yet',
          body: ctx.state.registry?.length
            ? 'Try another filter, or enable more models.'
            : 'Press Sync to pull the catalog from OpenRouter. You need to be online.',
        })}
      </div>
      ${list.length > 300 ? '<p class="tiny muted" style="margin-top:8px">Showing 300 of ' + list.length + ' models. Use search to narrow down.</p>' : ''}
      <p class="tiny muted" style="margin-top:12px">
        ${ctx.state.settings?.modelsSyncedAt ? `Last sync ${timeAgo(ctx.state.settings.modelsSyncedAt)}.` : 'Never synced on this account.'}
        Free models are rate limited by OpenRouter and vary in quality — Forgebook verifies what they do rather than trusting them.
      </p>`;

    body.querySelectorAll('[data-role]').forEach((select) => {
      select.addEventListener('change', async () => {
        const roleModels = { ...(ctx.state.settings?.roleModels || {}) };
        roleModels[select.dataset.role] = select.value;
        try {
          ctx.state.settings = await repo.saveSettings({ roleModels });
          toast('Saved', { kind: 'ok' });
        } catch (err) { toast(err.message, { kind: 'bad' }); }
      });
    });

    const search = body.querySelector('#model-search');
    search.addEventListener('input', () => {
      query = search.value;
      const pos = search.selectionStart;
      paint();
      const next = body.querySelector('#model-search');
      if (next) { next.focus(); next.setSelectionRange(pos, pos); }
    });

    body.querySelectorAll('[data-filter]').forEach((chip) => {
      chip.addEventListener('click', () => { filter = chip.dataset.filter; paint(); });
    });

    body.querySelector('#models-refresh').addEventListener('click', async () => {
      await ctx.ensureModels();
      paint();
    });

    body.querySelectorAll('[data-toggle]').forEach((toggle) => {
      toggle.addEventListener('click', async () => {
        const id = toggle.dataset.toggle;
        const prefs = ctx.state.prefs || {};
        const nextEnabled = prefs[id]?.enabled === false;
        toggle.setAttribute('aria-checked', String(nextEnabled));
        try {
          await repo.setPref(id, nextEnabled);
          ctx.state.prefs = { ...prefs, [id]: { ...(prefs[id] || {}), model_id: id, enabled: nextEnabled } };
          paint();
        } catch (err) {
          toast(err.message, { kind: 'bad' });
          toggle.setAttribute('aria-checked', String(!nextEnabled));
        }
      });
    });
  }

  function row(model) {
    const price = model.is_free ? 'free' : `${Number(model.price_in).toFixed(2)} / ${Number(model.price_out).toFixed(2)} per M`;
    const ctxLabel = model.context_length ? `${Math.round(model.context_length / 1000)}K context` : 'context unknown';
    return `<div class="model-row">
      <button class="switch" role="switch" aria-checked="${model.enabled}" aria-label="Enable ${escapeHtml(model.name)}" data-toggle="${escapeHtml(model.id)}"></button>
      <div class="main">
        <div class="name">
          ${escapeHtml(model.name)}
          ${model.is_free ? '<span class="badge ok">free</span>' : ''}
          ${model.supports_tools ? '<span class="badge accent">tools</span>' : '<span class="badge">no tools</span>'}
          ${model.available ? '' : '<span class="badge danger">delisted</span>'}
        </div>
        <div class="id">${escapeHtml(model.id)}</div>
        <div class="stats">${escapeHtml(price)} · ${escapeHtml(ctxLabel)}${model.max_output ? ` · max ${Math.round(model.max_output / 1000)}K out` : ''}</div>
      </div>
    </div>`;
  }

  root.querySelector('#sync-models').addEventListener('click', async (event) => {
    const btn = event.currentTarget;
    btn.disabled = true;
    btn.innerHTML = `${icon('refresh')} Syncing…`;
    try {
      await ctx.ensureModels({ force: true });
      await ctx.refreshSettings();
      toast(`Registry updated — ${ctx.state.registry.length} models`, { kind: 'ok' });
      paint();
    } catch (err) {
      toast(err.message, { kind: 'bad' });
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${icon('refresh')} Sync`;
    }
  });

  paint();
  return () => {};
}
