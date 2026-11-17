/**
 * DevSpace — entry point
 */
import { loadConfig, saveConfig, isConfigured } from './config.js';
import { initAuth, onAuthChange, signIn, signUp, signOut, getUser } from './auth/auth.js';
import { resetSupabaseClient } from './supabase-client.js';
import * as projects from './projects/store.js';
import * as fs from './files/fs-adapter.js';
import { listModels, syncModels, setModelActive } from './models/registry.js';
import { runAgent } from './agent/loop.js';
import { $, $$, on, show, hide, toast } from './utils/dom.js';
import * as chat from './ui/chat.js';

// ── State ──────────────────────────────────────────────────────────
let currentProject = null;
let abortController = null;
const activityLog = [];

// ── Boot ───────────────────────────────────────────────────────────
async function boot() {
  bindUI();
  hydrateSettingsForm();

  if (!isConfigured()) {
    showAuth(false);
    showPanel('settings');
    toast('Configure Supabase + OpenRouter in Settings to get started');
    show($('#main-screen'));
    hide($('#auth-screen'));
    return;
  }

  await initAuth();
}

onAuthChange((user) => {
  if (user) {
    hide($('#auth-screen'));
    show($('#main-screen'));
    refreshProjectList();
    // Restore last project if any
    const cfg = loadConfig();
    if (cfg.lastProjectId) {
      openProject(cfg.lastProjectId).catch(() => {});
    }
  } else if (isConfigured()) {
    showAuth(true);
  }
});

function showAuth(showForm) {
  if (showForm) {
    show($('#auth-screen'));
    hide($('#main-screen'));
  }
}

// ── UI binding ─────────────────────────────────────────────────────
function bindUI() {
  // Auth
  on($('#btn-signin'), 'click', async () => {
    try {
      hide($('#auth-error'));
      await signIn($('#auth-email').value.trim(), $('#auth-password').value);
    } catch (err) {
      const e = $('#auth-error');
      e.textContent = err.message;
      show(e);
    }
  });
  on($('#btn-signup'), 'click', async () => {
    try {
      hide($('#auth-error'));
      const res = await signUp($('#auth-email').value.trim(), $('#auth-password').value);
      if (res.session) toast('Account created');
      else toast('Check your email to confirm signup');
    } catch (err) {
      const e = $('#auth-error');
      e.textContent = err.message;
      show(e);
    }
  });
  on($('#btn-signout'), 'click', () => signOut());

  // Drawer
  on($('#btn-menu'), 'click', () => {
    $('#drawer').classList.add('open');
    show($('#drawer-overlay'));
  });
  on($('#btn-close-drawer'), 'click', closeDrawer);
  on($('#drawer-overlay'), 'click', closeDrawer);

  $$('.nav-list li').forEach(li => {
    on(li, 'click', () => {
      $$('.nav-list li').forEach(x => x.classList.remove('active'));
      li.classList.add('active');
      showPanel(li.dataset.panel);
      closeDrawer();
    });
  });

  on($('#btn-settings'), 'click', () => showPanel('settings'));
  on($('#btn-activity'), 'click', () => showPanel('activity'));

  // Projects
  on($('#btn-new-project'), 'click', async () => {
    const name = prompt('Project name');
    if (!name) return;
    try {
      const p = await projects.createProject({ name });
      await refreshProjectList();
      await openProject(p.id);
      showPanel('chat');
      toast('Project created');
    } catch (err) {
      toast(err.message);
    }
  });

  // Files
  on($('#btn-import-zip'), 'click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,application/zip';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        await fs.importZip(file);
        if (currentProject) {
          fs.setActiveProjectId(currentProject.id);
          await fs.persistTree(currentProject.id);
        }
        renderFileTree();
      } catch (err) {
        toast(err.message);
      }
    };
    input.click();
  });
  on($('#btn-export-zip'), 'click', () => {
    fs.exportZip(currentProject?.name || 'project');
  });
  on($('#btn-connect-dir'), 'click', async () => {
    const ok = await fs.connectDirectory();
    if (ok) renderFileTree();
  });
  on($('#btn-close-viewer'), 'click', () => hide($('#file-viewer')));

  // Models
  on($('#btn-sync-models'), 'click', async () => {
    try {
      toast('Syncing models…');
      const n = await syncModels();
      toast(`Synced ${n} models`);
      renderModels();
    } catch (err) {
      toast(err.message);
    }
  });
  on($('#filter-free'), 'change', () => renderModels());
  on($('#filter-tools'), 'change', () => renderModels());

  // Settings
  on($('#btn-save-settings'), 'click', () => {
    saveConfig({
      supabaseUrl: $('#cfg-supabase-url').value.trim(),
      supabaseAnonKey: $('#cfg-supabase-key').value.trim(),
      openRouterKey: $('#cfg-openrouter-key').value.trim(),
      defaultModel: $('#cfg-default-model').value,
    });
    resetSupabaseClient();
    $('#settings-status').textContent = 'Saved. Reloading auth…';
    initAuth();
    toast('Settings saved');
  });

  // Chat
  chat.bindComposer(handleUserMessage);
  on($('#btn-stop-agent'), 'click', () => {
    if (abortController) {
      abortController.abort();
      toast('Stopping agent…');
    }
  });

  on($('#btn-clear-activity'), 'click', () => {
    activityLog.length = 0;
    $('#activity-log').innerHTML = '';
  });
}

function closeDrawer() {
  $('#drawer').classList.remove('open');
  hide($('#drawer-overlay'));
}

function showPanel(name) {
  // Map "chat" to chat-panel; others match id
  const id = name === 'chat' ? 'chat-panel' : `${name}-panel`;
  $$('.panel').forEach(p => p.classList.remove('active'));
  const panel = $(`#${id}`);
  if (panel) panel.classList.add('active');

  if (name === 'projects') refreshProjectList();
  if (name === 'files') renderFileTree();
  if (name === 'roadmap') renderRoadmap();
  if (name === 'models') renderModels();
  if (name === 'activity') renderActivity();
}

// ── Projects ───────────────────────────────────────────────────────
async function refreshProjectList() {
  const el = $('#project-list');
  if (!el) return;
  if (!getUser()) {
    el.innerHTML = '<p class="hint" style="padding:16px">Sign in to see projects</p>';
    return;
  }
  try {
    const list = await projects.listProjects();
    el.innerHTML = '';
    if (!list.length) {
      el.innerHTML = '<p class="hint" style="padding:16px">No projects yet</p>';
      return;
    }
    for (const p of list) {
      const item = document.createElement('div');
      item.className = 'list-item' + (currentProject?.id === p.id ? ' active' : '');
      item.innerHTML = `<div class="meta"><div class="title">${escapeHtml(p.name)}</div>
        <div class="sub">${p.description || 'No description'} · ${new Date(p.updated_at).toLocaleDateString()}</div></div>`;
      item.onclick = () => openProject(p.id);
      el.appendChild(item);
    }
  } catch (err) {
    el.innerHTML = `<p class="error" style="padding:16px">${escapeHtml(err.message)}</p>`;
  }
}

async function openProject(id) {
  try {
    currentProject = await projects.getProject(id);
    saveConfig({ lastProjectId: id });
    fs.setActiveProjectId(id);
    $('#current-project-name').textContent = currentProject.name;
    chat.clearChat();
    chat.addSystemNote(`Opened project “${currentProject.name}”`);

    // Restore virtual files from IndexedDB (survives reload when no native folder)
    try {
      const n = await fs.restoreTree(id);
      if (n > 0) chat.addSystemNote(`Restored ${n} files from local cache`);
    } catch (e) {
      console.warn('restoreTree', e);
    }

    // Load recent messages
    const msgs = await projects.getMessages(id, 40);
    for (const m of msgs) {
      if (m.role === 'user' || m.role === 'assistant') {
        chat.addMessage(m.role, m.content);
      }
    }

    // Resume checkpoint notice
    if (currentProject.checkpoint) {
      chat.addSystemNote(`Previous session interrupted (${currentProject.checkpoint.reason}). Inspect files before continuing.`);
    }

    renderFileTree();
    renderRoadmap();
    showPanel('chat');
  } catch (err) {
    toast(err.message);
  }
}

// ── Files UI ───────────────────────────────────────────────────────
function renderFileTree() {
  const el = $('#file-tree');
  if (!el) return;
  const entries = flattenTree('', 0);
  if (!entries.length) {
    el.innerHTML = `<p class="hint">No files. Import a ZIP or connect a folder${fs.supportsDirectoryPicker() ? '' : ' (ZIP recommended on this browser)'}.</p>`;
    return;
  }
  el.innerHTML = entries.map(e => {
    const pad = '&nbsp;'.repeat(e.depth * 4);
    const icon = e.type === 'dir' ? '📁' : '📄';
    return `<div class="file-entry ${e.type}" data-path="${escapeAttr(e.path)}" data-type="${e.type}">
      <span>${pad}${icon} ${escapeHtml(e.name)}</span>
    </div>`;
  }).join('');

  el.querySelectorAll('.file-entry[data-type="file"]').forEach(node => {
    node.onclick = async () => {
      const path = node.dataset.path;
      const content = await fs.readFile(path);
      $('#viewer-path').textContent = path;
      $('#viewer-content').textContent = content ?? '(empty or unreadable)';
      show($('#file-viewer'));
    };
  });
}

function flattenTree(path, depth) {
  const out = [];
  for (const e of fs.listDir(path)) {
    out.push({ ...e, depth });
    if (e.type === 'dir') out.push(...flattenTree(e.path, depth + 1));
  }
  return out;
}

// ── Roadmap ────────────────────────────────────────────────────────
function renderRoadmap() {
  const el = $('#roadmap-content');
  if (!el) return;
  const roadmap = currentProject?.roadmap;
  if (!roadmap?.phases?.length) {
    el.innerHTML = '<p class="hint">No roadmap yet. Ask the AI to plan the project.</p>';
    return;
  }
  el.innerHTML = roadmap.phases.map(phase => {
    const tasks = (phase.tasks || []).map(t => {
      const st = t.status || 'pending';
      return `<div class="task ${st}"><div class="status"></div><div>${escapeHtml(t.title || '')}</div></div>`;
    }).join('');
    return `<div class="phase"><div class="phase-title">${escapeHtml(phase.title || 'Phase')}</div>${tasks}</div>`;
  }).join('');
}

// ── Models ─────────────────────────────────────────────────────────
async function renderModels() {
  const el = $('#model-list');
  if (!el) return;
  try {
    const freeOnly = $('#filter-free')?.checked;
    const toolsOnly = $('#filter-tools')?.checked;
    const models = await listModels({ freeOnly, toolsOnly, includeInactive: true });
    el.innerHTML = '';
    if (!models.length) {
      el.innerHTML = '<p class="hint" style="padding:16px">No models in registry. Click Sync (requires OpenRouter key).</p>';
      return;
    }
    for (const m of models) {
      const item = document.createElement('div');
      item.className = 'list-item';
      const badge = [
        m.is_free ? 'free' : 'paid',
        m.supports_tools ? 'tools' : null,
        m.user_active ? null : 'off',
      ].filter(Boolean).join(' · ');
      item.innerHTML = `<div class="meta">
        <div class="title">${escapeHtml(m.name)}</div>
        <div class="sub">${escapeHtml(m.id)} · ${badge} · ctx ${m.context_length || '?'}</div>
      </div>
      <button class="btn small toggle-active">${m.user_active ? 'Disable' : 'Enable'}</button>`;
      item.querySelector('.toggle-active').onclick = async (e) => {
        e.stopPropagation();
        await setModelActive(m.id, !m.user_active);
        renderModels();
      };
      item.onclick = () => {
        saveConfig({ defaultModel: m.id });
        hydrateSettingsForm();
        toast(`Default model → ${m.name}`);
      };
      el.appendChild(item);
    }

    // Populate settings select
    const sel = $('#cfg-default-model');
    if (sel) {
      const active = models.filter(m => m.user_active);
      sel.innerHTML = active.map(m =>
        `<option value="${escapeAttr(m.id)}">${escapeHtml(m.name)}</option>`
      ).join('');
      sel.value = loadConfig().defaultModel;
    }
  } catch (err) {
    el.innerHTML = `<p class="error" style="padding:16px">${escapeHtml(err.message)}</p>`;
  }
}

// ── Activity ───────────────────────────────────────────────────────
function pushActivity(ev) {
  activityLog.push(ev);
  if (activityLog.length > 200) activityLog.shift();
  // Live append if panel visible
  const log = $('#activity-log');
  if (log && $('#activity-panel').classList.contains('active')) {
    appendActivityEntry(log, ev);
  }
}

function renderActivity() {
  const log = $('#activity-log');
  if (!log) return;
  log.innerHTML = '';
  for (const ev of activityLog) appendActivityEntry(log, ev);
}

function appendActivityEntry(log, ev) {
  const div = document.createElement('div');
  let cls = 'activity-entry';
  if (ev.type?.startsWith('tool')) cls += ' tool';
  if (ev.type === 'tool_success' || ev.type === 'complete') cls += ' success';
  if (ev.type === 'tool_error' || ev.type === 'error') cls += ' error';
  div.className = cls;
  const time = new Date(ev.ts || Date.now()).toLocaleTimeString();
  let body = ev.type;
  if (ev.name) body += ` · ${ev.name}`;
  if (ev.message) body += ` — ${ev.message}`;
  if (ev.result) body += ` → ${typeof ev.result === 'string' ? ev.result : JSON.stringify(ev.result)}`;
  if (ev.text) body += ` — ${ev.text}`;
  div.innerHTML = `<div class="time">${time}</div><div>${escapeHtml(body)}</div>`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

// ── Chat / Agent ───────────────────────────────────────────────────
async function handleUserMessage(text) {
  if (!currentProject) {
    toast('Create or open a project first');
    showPanel('projects');
    return;
  }
  if (!getUser()) {
    toast('Sign in required');
    return;
  }

  chat.addMessage('user', text);
  chat.setAgentStatus(true, 'Thinking…');

  if (abortController) abortController.abort();
  abortController = new AbortController();

  try {
    const result = await runAgent({
      projectId: currentProject.id,
      project: currentProject,
      userMessage: text,
      signal: abortController.signal,
      onEvent: (ev) => {
        pushActivity(ev);
        if (ev.type === 'tool_start') {
          chat.setAgentStatus(true, `Running ${ev.name}…`);
        } else if (ev.type === 'model_request') {
          chat.setAgentStatus(true, 'Waiting for model…');
        } else if (ev.type === 'assistant_text') {
          chat.setAgentStatus(true, 'Writing response…');
        }
      },
    });

    if (result?.text) {
      chat.addMessage('assistant', result.text);
    } else {
      chat.addSystemNote('Agent finished with no final message (check Activity for details).');
    }

    // Refresh project metadata + persist files
    currentProject = await projects.getProject(currentProject.id);
    try { await fs.persistTree(currentProject.id); } catch (_) {}
    renderRoadmap();
    renderFileTree();
  } catch (err) {
    if (err.name === 'AbortError') {
      chat.addSystemNote('Cancelled');
    } else {
      chat.addSystemNote('Error: ' + err.message);
      toast(err.message);
    }
  } finally {
    chat.setAgentStatus(false);
    abortController = null;
  }
}

// ── Settings form ──────────────────────────────────────────────────
function hydrateSettingsForm() {
  const cfg = loadConfig();
  const url = $('#cfg-supabase-url');
  const key = $('#cfg-supabase-key');
  const or = $('#cfg-openrouter-key');
  if (url) url.value = cfg.supabaseUrl || '';
  if (key) key.value = cfg.supabaseAnonKey || '';
  if (or) or.value = cfg.openRouterKey || '';
}

// ── Utils ──────────────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

// ── Start ──────────────────────────────────────────────────────────
boot();
