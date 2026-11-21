import { state, on } from '../lib/state.js';
import { icon } from '../lib/icons.js';
import { t } from '../lib/i18n.js';
import { escapeHtml, formatRelative, clip } from '../lib/utils.js';
import { updateSettings } from '../lib/prefs.js';
import { THEMES } from '../lib/themes.js';
import { openModelPicker, syncFreeModels } from './models.js';
import { openSettings } from './settings.js';
import {
  newChat,
  openConversation,
  openBranchMap,
  exportCurrentChat,
  previewLastRequest,
} from './chat.js';
import { signOut } from '../lib/supabase.js';
import { toast } from './toast.js';

export function initPalette() {
  on('palette:open', () => openPalette());
}

export function openPalette() {
  if (document.getElementById('palette-scrim')) return;

  const scrim = document.createElement('div');
  scrim.className = 'palette-scrim';
  scrim.id = 'palette-scrim';
  scrim.innerHTML = `<div class="palette" role="dialog" aria-modal="true">
    <div class="palette-input-wrap">
      ${icon('search')}
      <input class="palette-input" id="palette-input" placeholder="${t(
        'Type a command, or search your chats…',
      )}" dir="auto" autocomplete="off" />
      <kbd>esc</kbd>
    </div>
    <div class="palette-list" id="palette-list"></div>
  </div>`;
  document.getElementById('overlay-root').appendChild(scrim);

  const input = scrim.querySelector('#palette-input');
  const listEl = scrim.querySelector('#palette-list');
  let selection = 0;
  let visibleItems = [];

  const commands = () => [
    { group: t('Actions'), label: t('New chat'), icon: 'plus', hint: '⇧⌘O', run: () => newChat() },
    {
      group: t('Actions'),
      label: t('Open model picker'),
      icon: 'cpu',
      hint: state.models.length ? `${state.models.length} models` : '',
      run: () => openModelPicker(),
    },
    {
      group: t('Actions'),
      label: t('Sync free models'),
      icon: 'refresh',
      run: () => syncFreeModels(),
    },
    { group: t('Actions'), label: t('Branch map'), icon: 'tree', run: () => openBranchMap() },
    {
      group: t('Actions'),
      label: t('View last request'),
      icon: 'terminal',
      run: () => previewLastRequest(),
    },
    {
      group: t('Export'),
      label: t('Export chat as Markdown'),
      icon: 'download',
      run: () => exportCurrentChat('md'),
    },
    {
      group: t('Export'),
      label: t('Export chat as JSON'),
      icon: 'code',
      run: () => exportCurrentChat('json'),
    },
    { group: t('Settings'), label: t('Appearance'), icon: 'palette', run: () => openSettings('appearance') },
    { group: t('Settings'), label: t('Chat & generation'), icon: 'chat', run: () => openSettings('chat') },
    { group: t('Settings'), label: t('Models'), icon: 'cpu', run: () => openSettings('models') },
    { group: t('Settings'), label: t('API key'), icon: 'key', run: () => openSettings('api') },
    { group: t('Settings'), label: t('Prompt library'), icon: 'book', run: () => openSettings('prompts') },
    { group: t('Settings'), label: t('Data & backup'), icon: 'shield', run: () => openSettings('data') },
    {
      group: t('Appearance'),
      label: `${t('Next theme')} → ${THEMES[(THEMES.findIndex((x) => x.id === state.settings.theme) + 1) % THEMES.length].name}`,
      icon: 'palette',
      run: () => {
        const index = THEMES.findIndex((x) => x.id === state.settings.theme);
        const next = THEMES[(index + 1) % THEMES.length];
        updateSettings({ theme: next.id });
        toast(`${next.name}`, { type: 'info', title: t('Theme changed') });
      },
    },
    {
      group: t('Appearance'),
      label: state.settings.locale === 'fa' ? 'Switch interface to English' : 'تغییر زبان به فارسی',
      icon: 'globe',
      run: () => updateSettings({ locale: state.settings.locale === 'fa' ? 'en' : 'fa' }),
    },
    {
      group: t('Account'),
      label: t('Sign out'),
      icon: 'logout',
      run: async () => {
        await signOut();
        toast(t('Signed out.'), { type: 'info' });
      },
    },
  ];

  function compute() {
    const query = input.value.trim().toLowerCase();
    let items = commands();
    if (query) {
      items = items.filter((item) => item.label.toLowerCase().includes(query));
    }

    const chats = state.conversations
      .filter((conv) => !query || (conv.title || '').toLowerCase().includes(query))
      .slice(0, query ? 8 : 5)
      .map((conv) => ({
        group: t('Chats'),
        label: conv.title || t('New chat'),
        hint: formatRelative(conv.last_message_at || conv.created_at),
        icon: 'chat',
        run: () => openConversation(conv.id),
      }));

    return [...items.slice(0, query ? 40 : 9), ...chats];
  }

  function draw() {
    visibleItems = compute();
    if (selection >= visibleItems.length) selection = Math.max(0, visibleItems.length - 1);
    if (!visibleItems.length) {
      listEl.innerHTML = `<div class="palette-empty">${t('Nothing matches that.')}</div>`;
      return;
    }
    let html = '';
    let lastGroup = null;
    visibleItems.forEach((item, index) => {
      if (item.group !== lastGroup) {
        html += `<div class="palette-group">${escapeHtml(item.group)}</div>`;
        lastGroup = item.group;
      }
      html += `<button type="button" class="palette-item ${index === selection ? 'sel' : ''}" data-palette-index="${index}">
        ${icon(item.icon || 'spark')}
        <span dir="auto" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(
          clip(item.label, 60),
        )}</span>
        ${item.hint ? `<span class="p-hint">${escapeHtml(item.hint)}</span>` : ''}
      </button>`;
    });
    listEl.innerHTML = html;
    const selected = listEl.querySelector('.palette-item.sel');
    selected?.scrollIntoView({ block: 'nearest' });
  }

  function run(index) {
    const item = visibleItems[index];
    if (!item) return;
    close();
    try {
      item.run();
    } catch (error) {
      toast(error.message || String(error), { type: 'err' });
    }
  }

  function close() {
    document.removeEventListener('keydown', onKey, true);
    scrim.remove();
  }

  function onKey(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      selection = Math.min(selection + 1, visibleItems.length - 1);
      draw();
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      selection = Math.max(selection - 1, 0);
      draw();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      run(selection);
    }
  }

  input.addEventListener('input', () => {
    selection = 0;
    draw();
  });
  listEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-palette-index]');
    if (btn) run(Number(btn.dataset.paletteIndex));
  });
  scrim.addEventListener('mousedown', (event) => {
    if (event.target === scrim) close();
  });
  document.addEventListener('keydown', onKey, true);
  draw();
  input.focus();
}
