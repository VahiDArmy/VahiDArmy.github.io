/** Prompt atelier: built-in personas, starters, and the user's saved prompts. */
import { state } from '../store.js';
import * as db from '../services/db.js';
import {
  BUILTIN_PERSONAS,
  PROMPT_CATEGORIES,
  PROMPT_STARTERS,
  allPrompts,
  filterPrompts,
} from '../services/prompts.js';
import { openModal, confirmDialog } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { reportError } from '../ui/errorDialog.js';
import { icon } from '../ui/icons.js';
import { escapeHtml, truncate } from '../utils.js';

const PENDING_SYSTEM_KEY = 'meraj.v1.pending-system';
const PENDING_DRAFT_KEY = 'meraj.v1.pending-draft';
const PENDING_TITLE_KEY = 'meraj.v1.pending-title';

let rootEl = null;
let ctx = null;
let userPrompts = [];
let error = null;
let query = '';
let category = 'All';
let tab = 'personas';

function setPending(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

function usePersona(persona) {
  setPending(PENDING_SYSTEM_KEY, persona.body);
  setPending(PENDING_TITLE_KEY, persona.title);
  toast({ title: 'Persona applied', message: `${persona.title} will guide a new conversation.`, type: 'success', duration: 3200 });
  ctx?.navigate?.('/chat');
}

function useStarter(starter) {
  setPending(PENDING_DRAFT_KEY, starter.prompt);
  toast({ title: 'Starter loaded', message: 'The prompt is in a new composer.', type: 'success', duration: 2600 });
  ctx?.navigate?.('/chat');
}

function useSaved(prompt, asSystem) {
  if (asSystem) {
    setPending(PENDING_SYSTEM_KEY, prompt.body);
    setPending(PENDING_TITLE_KEY, prompt.title);
    toast({ title: 'System prompt ready', message: prompt.title, type: 'success', duration: 2600 });
    ctx?.navigate?.('/chat');
  } else {
    setPending(PENDING_DRAFT_KEY, prompt.body);
    toast({ title: 'Prompt loaded', message: prompt.title, type: 'success', duration: 2600 });
    ctx?.navigate?.('/chat');
  }
}

function promptCard(prompt) {
  const builtin = prompt.builtin;
  return `<article class="prompt-card ${builtin ? 'prompt-card--builtin' : ''}" data-prompt-id="${escapeHtml(prompt.id)}">
    <header class="prompt-card__head">
      <span class="prompt-card__icon">${icon(prompt.icon || 'spark', { size: 18 })}</span>
      <span class="tag tag--ghost">${escapeHtml(prompt.category || 'general')}</span>
      ${builtin ? '<span class="tag tag--accent">Built in</span>' : ''}
      ${prompt.is_favorite ? `<span class="tag tag--favorite">${icon('star', { size: 10 })} Favourite</span>` : ''}
      <button type="button" class="icon-btn prompt-card__menu" data-prompt-menu="${escapeHtml(prompt.id)}" aria-label="Prompt actions">${icon('more', { size: 16 })}</button>
    </header>
    <h3>${escapeHtml(prompt.title)}</h3>
    <p class="prompt-card__desc">${escapeHtml(prompt.description || truncate(prompt.body, 120))}</p>
    <p class="prompt-card__body">${escapeHtml(truncate(prompt.body, 220))}</p>
    <footer class="prompt-card__foot">
      <span>${prompt.body.length.toLocaleString()} chars</span>
      <div>
        ${builtin
          ? `<button type="button" class="btn btn--small btn--ghost" data-prompt-copy="${escapeHtml(prompt.id)}">${icon('copy', { size: 13 })}<span>Copy</span></button>
             <button type="button" class="btn btn--small btn--primary" data-prompt-use="${escapeHtml(prompt.id)}">${icon('arrowRight', { size: 13 })}<span>Use</span></button>`
          : `<button type="button" class="btn btn--small btn--ghost" data-prompt-edit="${escapeHtml(prompt.id)}">${icon('edit', { size: 13 })}<span>Edit</span></button>
             <button type="button" class="btn btn--small btn--primary" data-prompt-use="${escapeHtml(prompt.id)}">${icon('arrowRight', { size: 13 })}<span>Use</span></button>`}
      </div>
    </footer>
  </article>`;
}

function starterCard(starter) {
  return `<article class="prompt-card prompt-card--starter" data-starter-id="${escapeHtml(starter.id)}">
    <header class="prompt-card__head"><span class="prompt-card__icon">${icon(starter.icon, { size: 18 })}</span><span class="tag tag--ghost">Starter</span></header>
    <h3>${escapeHtml(starter.title)}</h3>
    <p class="prompt-card__desc">${escapeHtml(starter.subtitle)}</p>
    <p class="prompt-card__body">${escapeHtml(starter.prompt)}</p>
    <footer class="prompt-card__foot"><span>${starter.prompt.length} chars</span><div><button type="button" class="btn btn--small btn--primary" data-starter-use="${escapeHtml(starter.id)}">${icon('magic', { size: 13 })}<span>Load into composer</span></button></div></footer>
  </article>`;
}

function filtered() {
  if (tab === 'starters') {
    const needle = query.trim().toLowerCase();
    return PROMPT_STARTERS.filter((starter) => !needle || `${starter.title} ${starter.subtitle} ${starter.prompt}`.toLowerCase().includes(needle));
  }
  const pool = tab === 'saved' ? userPrompts : allPrompts(userPrompts).filter((prompt) => prompt.builtin);
  return filterPrompts(pool, { query, category });
}

function renderBody() {
  const holder = rootEl?.querySelector('#prompt-content');
  if (!holder) return;
  const rows = filtered();
  if (!rows.length) {
    holder.innerHTML = `<div class="prompt-empty">${icon(tab === 'saved' ? 'book' : 'search', { size: 30 })}<h3>${tab === 'saved' ? 'No saved prompts yet' : 'No prompts match'}</h3><p>${tab === 'saved' ? 'Save a persona, a system instruction, or a reusable brief. It will live here with your other prompts.' : 'Try a different search or category.'}</p><div class="prompt-empty__actions">${tab === 'saved' ? '<button type="button" class="btn btn--primary" data-new-prompt>Create prompt</button>' : '<button type="button" class="btn btn--ghost" data-clear-prompt-filters>Clear filters</button>'}</div></div>`;
    return;
  }
  holder.innerHTML = tab === 'starters' ? `<div class="prompt-grid">${rows.map(starterCard).join('')}</div>` : `<div class="prompt-grid">${rows.map(promptCard).join('')}</div>`;
}

function render() {
  if (!rootEl) return;
  const personas = allPrompts(userPrompts).filter((prompt) => prompt.builtin).length;
  rootEl.innerHTML = `<div class="page prompts-page">
    <header class="page-head">
      <button type="button" class="icon-btn page-menu" data-open-sidebar aria-label="Open conversations">${icon('menu', { size: 19 })}</button>
      <div class="page-head__copy">
        <p class="eyebrow"><span class="eyebrow__line"></span> Reusable thought</p>
        <h1>Prompt atelier</h1>
        <p>Personas for the system message, starters for the composer, and a private library of prompts stored in your Supabase account.</p>
      </div>
      <div class="page-head__actions">
        <button type="button" class="btn btn--primary" data-new-prompt>${icon('plus', { size: 15 })}<span>New prompt</span></button>
      </div>
    </header>

    <div class="stats-grid stats-grid--prompts">
      <div class="stat-card"><span class="stat-card__icon">${icon('compass', { size: 17 })}</span><div><span class="stat-card__label">Built-in personas</span><strong>${personas}</strong><p>Carefully written, no setup</p></div></div>
      <div class="stat-card"><span class="stat-card__icon">${icon('zap', { size: 17 })}</span><div><span class="stat-card__label">Starters</span><strong>${PROMPT_STARTERS.length}</strong><p>One click into the composer</p></div></div>
      <div class="stat-card"><span class="stat-card__icon">${icon('book', { size: 17 })}</span><div><span class="stat-card__label">Your prompts</span><strong>${userPrompts.length}</strong><p>Stored in Supabase</p></div></div>
    </div>

    ${error ? `<div class="panel-error"><div class="inline-error"><div class="inline-error__head">${icon('alert', { size: 17 })}<strong>Saved prompts could not load</strong></div><p>${escapeHtml(error.message || '')}</p><details><summary>Exact error</summary><pre>${escapeHtml(JSON.stringify(error, null, 2))}</pre></details></div></div>` : ''}

    <div class="prompt-tabs">
      <div class="segmented">
        <button type="button" class="segmented__item ${tab === 'personas' ? 'is-active' : ''}" data-prompt-tab="personas">${icon('compass', { size: 14 })} Personas <span>${personas}</span></button>
        <button type="button" class="segmented__item ${tab === 'starters' ? 'is-active' : ''}" data-prompt-tab="starters">${icon('zap', { size: 14 })} Starters <span>${PROMPT_STARTERS.length}</span></button>
        <button type="button" class="segmented__item ${tab === 'saved' ? 'is-active' : ''}" data-prompt-tab="saved">${icon('book', { size: 14 })} Saved <span>${userPrompts.length}</span></button>
      </div>
      <div class="prompt-tools">
        <div class="searchfield">${icon('search', { size: 16 })}<input id="prompt-search" class="input input--search" type="search" placeholder="Search prompts…" value="${escapeHtml(query)}" autocomplete="off"></div>
        ${tab === 'personas' || tab === 'saved' ? `<select id="prompt-category" class="input input--select">${PROMPT_CATEGORIES.map((entry) => `<option ${entry === category ? 'selected' : ''}>${entry}</option>`).join('')}</select>` : ''}
      </div>
    </div>

    <div id="prompt-content"></div>

    <p class="page-footnote">${icon('info', { size: 14 })} A persona is sent as the system message and stored with the conversation. A starter is inserted into the composer so you can edit it before sending. Built-in prompts are never modified; duplicate one to make it yours.</p>
  </div>`;
  renderBody();
  bind();
}

function findPrompt(id) {
  return allPrompts(userPrompts).find((prompt) => prompt.id === id) || null;
}

function openPromptMenu(anchor, prompt) {
  const items = [
    { heading: truncate(prompt.title, 32) },
    {
      label: 'Use as system prompt',
      icon: 'quote',
      action: () => useSaved(prompt, true),
    },
    {
      label: 'Load into composer',
      icon: 'zap',
      action: () => useSaved(prompt, false),
    },
    {
      label: 'Copy text',
      icon: 'copy',
      action: async () => {
        try {
          await navigator.clipboard.writeText(prompt.body);
          toast({ title: 'Prompt copied', type: 'success' });
        } catch {
          toast({ title: 'Clipboard unavailable', type: 'error' });
        }
      },
    },
    { separator: true },
  ];
  if (prompt.builtin) {
    items.push({ label: 'Duplicate to my library', icon: 'plus', action: () => createPromptFrom(prompt) });
  } else {
    items.push({ label: 'Edit prompt', icon: 'edit', action: () => openPromptEditor(prompt) });
    items.push({
      label: prompt.is_favorite ? 'Remove favourite' : 'Mark favourite',
      icon: 'star',
      action: () => toggleFavorite(prompt),
    });
    items.push({
      label: 'Delete prompt',
      icon: 'trash',
      danger: true,
      action: () => deletePrompt(prompt),
    });
  }
  import('../ui/menu.js').then(({ openMenu }) => openMenu(anchor, items, { width: 232 }));
}

function promptForm({ title = '', category = 'general', body = '', isFavorite = false } = {}) {
  return `<div class="prompt-form">
    <label class="field"><span>Title</span><input id="prompt-title" class="input" type="text" maxlength="100" value="${escapeHtml(title)}" placeholder="e.g. Sharp technical editor"></label>
    <div class="param-grid">
      <label class="field"><span>Category</span><select id="prompt-form-category" class="input">${PROMPT_CATEGORIES.filter((entry) => entry !== 'All').map((entry) => `<option ${entry === category ? 'selected' : ''}>${entry}</option>`).join('')}</select></label>
      <label class="field"><span>Favourite</span><button type="button" class="switch ${isFavorite ? 'is-on' : ''}" id="prompt-favorite-toggle" role="switch" aria-checked="${isFavorite}"><span class="switch__track"><span class="switch__thumb"></span></span><span>${isFavorite ? 'Yes' : 'No'}</span></button></label>
    </div>
    <label class="field"><span>Prompt text <em>sent verbatim</em></span><textarea id="prompt-body" class="input textarea" rows="10" placeholder="You are…">${escapeHtml(body)}</textarea></label>
    <div class="prompt-form__preview"><span>${icon('hash', { size: 13 })}</span><span id="prompt-char-count">${body.length} characters</span></div>
  </div>`;
}

function readPromptForm(modal) {
  const title = modal.body.querySelector('#prompt-title')?.value?.trim() || '';
  const categoryValue = modal.body.querySelector('#prompt-form-category')?.value || 'general';
  const body = modal.body.querySelector('#prompt-body')?.value || '';
  const favourite = modal.body.querySelector('#prompt-favorite-toggle')?.classList.contains('is-on') || false;
  return { title, category: categoryValue, body, is_favorite: favourite };
}

function openPromptEditor(existing = null) {
  let favourite = existing?.is_favorite || false;
  const modal = openModal({
    title: existing ? 'Edit prompt' : 'New prompt',
    subtitle: 'Saved prompts live in Supabase and can be inserted or applied as a system message.',
    size: 'lg',
    body: promptForm(existing || {}),
    actions: [
      { label: 'Cancel', variant: 'ghost' },
      {
        label: existing ? 'Save changes' : 'Create prompt',
        variant: 'primary',
        close: false,
        onClick: async () => {
          const values = readPromptForm(modal);
          if (!values.title) {
            toast({ title: 'Title required', message: 'Give the prompt a short name.', type: 'warning' });
            return false;
          }
          if (!values.body.trim()) {
            toast({ title: 'Prompt text required', message: 'The prompt body cannot be empty.', type: 'warning' });
            return false;
          }
          if (existing) {
            const { data, error } = await db.updatePrompt(existing.id, values);
            if (error) {
              reportError('Could not save the prompt', error);
              return false;
            }
            userPrompts = userPrompts.map((prompt) => (prompt.id === existing.id ? data : prompt));
            toast({ title: 'Prompt updated', message: values.title, type: 'success' });
          } else {
            const { data, error } = await db.createPrompt(state.user.id, values);
            if (error) {
              reportError('Could not create the prompt', error);
              return false;
            }
            userPrompts = [data, ...userPrompts];
            tab = 'saved';
            toast({ title: 'Prompt created', message: values.title, type: 'success' });
          }
          modal.close();
          render();
          return false;
        },
      },
    ],
  });
  const toggle = modal.body.querySelector('#prompt-favorite-toggle');
  toggle?.addEventListener('click', () => {
    favourite = !favourite;
    toggle.classList.toggle('is-on', favourite);
    toggle.setAttribute('aria-checked', String(favourite));
    toggle.querySelector('span:last-child').textContent = favourite ? 'Yes' : 'No';
  });
  modal.body.querySelector('#prompt-body')?.addEventListener('input', (event) => {
    const count = modal.body.querySelector('#prompt-char-count');
    if (count) count.textContent = `${event.target.value.length} characters`;
  });
  modal.body.querySelector('#prompt-title')?.focus();
  return { modal, read: () => ({ ...readPromptForm(modal), is_favorite: favourite }) };
}

async function createPromptFrom(prompt) {
  const { data, error } = await db.createPrompt(state.user.id, {
    title: prompt.title,
    body: prompt.body,
    category: prompt.category || 'general',
    icon: prompt.icon || 'book',
    is_favorite: false,
  });
  if (error) {
    reportError('Could not duplicate the prompt', error);
    return;
  }
  userPrompts = [data, ...userPrompts];
  tab = 'saved';
  toast({ title: 'Saved to your library', message: prompt.title, type: 'success' });
  render();
}

async function toggleFavorite(prompt) {
  const { data, error } = await db.updatePrompt(prompt.id, { is_favorite: !prompt.is_favorite });
  if (error) {
    reportError('Could not update the prompt', error);
    return;
  }
  userPrompts = userPrompts.map((item) => (item.id === prompt.id ? data : item));
  render();
}

async function deletePrompt(prompt) {
  const confirmed = await confirmDialog({
    title: 'Delete this prompt?',
    message: `“${prompt.title}” will be removed from your library. This does not affect conversations where it was already applied.`,
    confirmLabel: 'Delete prompt',
    danger: true,
  });
  if (!confirmed) return;
  const { error } = await db.deletePrompt(prompt.id);
  if (error) {
    reportError('Could not delete the prompt', error);
    return;
  }
  userPrompts = userPrompts.filter((item) => item.id !== prompt.id);
  toast({ title: 'Prompt deleted', message: prompt.title, type: 'success' });
  render();
}

function showPersona(persona) {
  openModal({
    title: persona.title,
    subtitle: `${persona.category} · ${persona.body.length.toLocaleString()} characters`,
    size: 'lg',
    body: `<div class="persona-detail">
      <div class="persona-detail__hero"><span class="prompt-card__icon">${icon(persona.icon, { size: 22 })}</span><div><p>${escapeHtml(persona.description)}</p></div></div>
      <pre class="verbatim verbatim--tall" tabindex="0">${escapeHtml(persona.body)}</pre>
      <p class="field-help">Applied as the system message. It becomes part of the exact request and is visible in the request inspector.</p>
    </div>`,
    actions: [
      {
        label: 'Copy',
        variant: 'ghost',
        icon: 'copy',
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(persona.body);
            toast({ title: 'Persona copied', type: 'success' });
          } catch {
            toast({ title: 'Clipboard unavailable', type: 'error' });
          }
        },
      },
      { label: 'Use in new chat', variant: 'primary', icon: 'arrowRight', onClick: () => usePersona(persona) },
    ],
  });
}

function bind() {
  rootEl.querySelector('[data-open-sidebar]')?.addEventListener('click', () => ctx?.openSidebar?.());
  rootEl.querySelectorAll('[data-new-prompt]').forEach((button) => button.addEventListener('click', () => openPromptEditor()));
  rootEl.querySelectorAll('[data-prompt-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      tab = button.dataset.promptTab;
      render();
    });
  });
  const search = rootEl.querySelector('#prompt-search');
  search?.addEventListener('input', () => {
    query = search.value;
    renderBody();
  });
  rootEl.querySelector('#prompt-category')?.addEventListener('change', (event) => {
    category = event.target.value;
    renderBody();
  });
  rootEl.querySelector('[data-clear-prompt-filters]')?.addEventListener('click', () => {
    query = '';
    category = 'All';
    render();
  });
  rootEl.querySelector('#prompt-content')?.addEventListener('click', (event) => {
    if (event.target.closest('[data-new-prompt]')) {
      openPromptEditor();
      return;
    }
    if (event.target.closest('[data-clear-prompt-filters]')) {
      query = '';
      category = 'All';
      render();
      return;
    }
    const menu = event.target.closest('[data-prompt-menu]');
    if (menu) {
      const prompt = findPrompt(menu.dataset.promptMenu);
      if (prompt) openPromptMenu(menu, prompt);
      return;
    }
    const use = event.target.closest('[data-prompt-use]');
    if (use) {
      const prompt = findPrompt(use.dataset.promptUse);
      if (prompt) useSaved(prompt, true);
      return;
    }
    const copy = event.target.closest('[data-prompt-copy]');
    if (copy) {
      const prompt = findPrompt(copy.dataset.promptCopy);
      if (prompt) {
        navigator.clipboard.writeText(prompt.body).then(
          () => toast({ title: 'Prompt copied', type: 'success' }),
          () => toast({ title: 'Clipboard unavailable', type: 'error' }),
        );
      }
      return;
    }
    const edit = event.target.closest('[data-prompt-edit]');
    if (edit) {
      const prompt = findPrompt(edit.dataset.promptEdit);
      if (prompt) openPromptEditor(prompt);
      return;
    }
    const starter = event.target.closest('[data-starter-use]');
    if (starter) {
      const found = PROMPT_STARTERS.find((item) => item.id === starter.dataset.starterUse);
      if (found) useStarter(found);
      return;
    }
    const card = event.target.closest('[data-prompt-id]');
    if (card && !event.target.closest('button')) {
      const prompt = findPrompt(card.dataset.promptId);
      if (prompt) showPersona(prompt);
    }
  });
}

export async function mountPrompts(root, context = {}) {
  rootEl = root;
  ctx = context;
  query = '';
  category = 'All';
  tab = 'personas';
  error = null;
  userPrompts = [];
  rootEl.innerHTML = `<div class="page-loading"><span class="boot-spinner"></span><p>Opening the prompt atelier…</p></div>`;
  const { data, error: loadError } = await db.listPrompts(state.user.id);
  if (loadError) {
    error = loadError;
  } else {
    userPrompts = data || [];
  }
  render();
}

export function unmountPrompts() {
  rootEl = null;
  ctx = null;
  userPrompts = [];
}
