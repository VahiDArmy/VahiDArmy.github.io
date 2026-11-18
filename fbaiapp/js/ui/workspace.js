// ---------------------------------------------------------------------------
// The workspace: chat with the agent, plus files / plan / activity / memory.
// ---------------------------------------------------------------------------

import { repo } from '../core/repo.js';
import { openProject, indexProject } from '../core/project.js';
import { getApiKey } from '../core/keys.js';
import { buildZipBlob } from '../core/zip.js';
import { AgentRunner, buildChatHistory } from '../agent/runner.js';
import { planInstruction, analyzeInstruction, buildRecoveryNote } from '../agent/prompt.js';
import { applyPreferences, pickModel, describeModel } from '../core/models.js';
import {
  escapeHtml, truncate, timeAgo, formatDuration, formatDateTime,
  groupBy, downloadBlob, debounce,
} from '../core/util.js';
import {
  icon, toast, openModal, confirmDialog, promptDialog, closeModal,
  renderMarkdown, statusBadge, statusLabel, emptyState,
} from './dom.js';
import { mountFilesPane } from './files.js';

const TABS = [
  { id: 'chat', label: 'Chat', icon: 'chat' },
  { id: 'files', label: 'Files', icon: 'folder' },
  { id: 'plan', label: 'Plan', icon: 'list' },
  { id: 'activity', label: 'Activity', icon: 'activity' },
  { id: 'memory', label: 'Memory', icon: 'brain' },
];

const MODEL_KEY = (projectId) => `fb:model:${projectId}`;
const PENDING_KEY = (projectId) => `fb:pending-prompt:${projectId}`;

const SUGGESTIONS = [
  'Create a landing page for a small coffee roastery',
  'Explain how this project works and where to start',
  'Add dark mode and remember the choice',
  'Review the code and list the real problems you find',
];

export async function renderWorkspace(root, ctx, route) {
  const opened = await openProject(route.projectId);
  if (!opened) {
    root.innerHTML = `<div class="pane-scroll"><div class="callout danger">That project no longer exists.</div></div>`;
    return () => {};
  }
  const { project, fs } = opened;

  const ui = {
    tab: TABS.some((tab) => tab.id === route.tab) ? route.tab : 'chat',
    messages: [],
    tasks: [],
    memory: {},
    runs: [],
    runner: null,
    running: false,
    live: null,
    preferredModel: localStorage.getItem(MODEL_KEY(project.id)) || '',
    interrupted: [],
    expandedRun: null,
    stepsByRun: {},
    pending: sessionStorage.getItem(PENDING_KEY(project.id)) || '',
    filesCount: project.file_count || 0,
    linkState: fs.linkState,
  };
  sessionStorage.removeItem(PENDING_KEY(project.id));

  const [messages, tasks, memory, runs] = await Promise.all([
    repo.listMessages(project.id).catch(() => []),
    repo.listTasks(project.id).catch(() => []),
    repo.getMemory(project.id).catch(() => ({})),
    repo.listRuns(project.id).catch(() => []),
  ]);
  ui.messages = messages;
  ui.tasks = tasks;
  ui.memory = memory;
  ui.runs = runs;
  try { ui.interrupted = await repo.reconcileRuns(project.id); } catch { /* offline */ }

  root.innerHTML = `
    <div class="workspace">
      <header class="ws-head">
        <button class="btn ghost icon" id="back" aria-label="Back to projects">${icon('back')}</button>
        <div class="ws-title">
          <h1 class="truncate">${escapeHtml(project.name)}</h1>
          <div class="sub">
            <span id="ws-link" class="badge ${ui.linkState === 'linked' ? 'ok' : ''} dot">${linkLabel()}</span>
            <span id="ws-count">${ui.filesCount} files</span>
          </div>
        </div>
        <button class="btn ghost icon" id="ws-menu" aria-label="Project menu">${icon('more')}</button>
      </header>
      <div class="ws-tabs" id="ws-tabs">
        ${TABS.map((tab) => `<button data-tab="${tab.id}" class="${tab.id === ui.tab ? 'active' : ''}">
          ${icon(tab.icon)}<span>${tab.label}</span>
          <span class="count" data-count="${tab.id}"></span>
        </button>`).join('')}
      </div>
      <div class="ws-body"><section class="ws-pane" id="pane"></section></div>
    </div>`;

  const pane = root.querySelector('#pane');
  const tabsEl = root.querySelector('#ws-tabs');

  function linkLabel() {
    if (ui.linkState === 'linked') return 'folder linked';
    if (ui.linkState === 'needs-permission') return 'reconnect folder';
    return 'browser copy';
  }

  function updateCounts() {
    const counts = {
      chat: 0,
      files: ui.filesCount,
      plan: ui.tasks.filter((task) => task.status !== 'done').length,
      activity: ui.runs.length,
      memory: Object.values(ui.memory).filter((section) => section?.content?.trim()).length,
    };
    for (const [key, value] of Object.entries(counts)) {
      const el = tabsEl.querySelector(`[data-count="${key}"]`);
      if (el) el.textContent = value ? String(value) : '';
    }
    const countEl = root.querySelector('#ws-count');
    if (countEl) countEl.textContent = `${ui.filesCount} files`;
    const linkEl = root.querySelector('#ws-link');
    if (linkEl) {
      linkEl.textContent = linkLabel();
      linkEl.classList.toggle('ok', ui.linkState === 'linked');
      linkEl.classList.toggle('warn', ui.linkState === 'needs-permission');
    }
  }

  // -------------------------------------------------------------------------
  // tab plumbing
  // -------------------------------------------------------------------------

  function setTab(tab) {
    ui.tab = tab;
    for (const btn of tabsEl.querySelectorAll('[data-tab]')) {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    }
    try { history.replaceState(null, '', `#/p/${project.id}/${tab}`); } catch { /* ignore */ }
    paintPane();
  }

  tabsEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-tab]');
    if (btn) setTab(btn.dataset.tab);
  });

  async function paintPane() {
    pane.innerHTML = '';
    if (ui.tab === 'chat') paintChatPane();
    else if (ui.tab === 'files') await paintFilesPane();
    else if (ui.tab === 'plan') paintPlanPane();
    else if (ui.tab === 'activity') await paintActivityPane();
    else if (ui.tab === 'memory') paintMemoryPane();
    updateCounts();
  }

  // -------------------------------------------------------------------------
  // chat
  // -------------------------------------------------------------------------

  let chatInner = null;
  let composer = null;
  let input = null;
  let sendBtn = null;
  let liveHost = null;

  function paintChatPane() {
    pane.innerHTML = `
      <div class="chat-scroll" id="chat-scroll"><div class="chat-inner" id="chat-inner"></div></div>
      <div class="composer-wrap">
        <div class="composer">
          <textarea id="composer-input" rows="1" placeholder="Describe what to build, change or fix…" enterkeyhint="send"></textarea>
          <button class="send" id="send" aria-label="Send" disabled>${icon('send')}</button>
        </div>
        <div class="composer-meta">
          <button class="chip-btn" id="model-chip">${icon('cpu')}<span id="model-label"></span></button>
          <span class="spacer"></span>
          <span class="tiny" id="composer-hint"></span>
        </div>
      </div>`;

    chatInner = pane.querySelector('#chat-inner');
    composer = pane.querySelector('.composer');
    input = pane.querySelector('#composer-input');
    sendBtn = pane.querySelector('#send');

    input.addEventListener('input', () => {
      autoGrow();
      sendBtn.disabled = !input.value.trim() || ui.running;
    });
    input.addEventListener('keydown', (event) => {
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      if (event.key === 'Enter' && !event.shiftKey && !coarse) {
        event.preventDefault();
        submit();
      }
    });
    sendBtn.addEventListener('click', () => {
      if (ui.running) { ui.runner?.stop(); return; }
      submit();
    });
    pane.querySelector('#model-chip').addEventListener('click', openModelPicker);

    paintMessages();
    paintComposer();
    if (ui.pending) {
      input.value = ui.pending;
      autoGrow();
      sendBtn.disabled = false;
      ui.pending = '';
      setTimeout(() => input.focus(), 60);
      toast('Brief added — press send when you are ready', { timeout: 5000 });
    }
  }

  function autoGrow() {
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, window.innerHeight * 0.42)}px`;
  }

  function messageHTML(message) {
    if (message.kind === 'outcome' || message.kind === 'question') {
      const meta = message.meta || {};
      const status = meta.status || (message.kind === 'question' ? 'blocked' : 'completed');
      const bits = [
        statusLabel(status),
        meta.model ? meta.model.split('/').pop() : '',
        meta.steps ? `${meta.steps} steps` : '',
        meta.durationMs ? formatDuration(meta.durationMs) : '',
      ].filter(Boolean);
      const options = Array.isArray(meta.options) ? meta.options : [];
      return `<div class="outcome ${escapeHtml(status)}">
        <div class="outcome-head">
          ${icon(status === 'completed' ? 'check' : status === 'blocked' ? 'info' : 'clock')}
          <span>${escapeHtml(bits.join(' · '))}</span>
          <span class="spacer"></span>
          ${message.run_id ? `<button class="btn ghost small" data-view-run="${message.run_id}">Details</button>` : ''}
        </div>
        <div class="outcome-body markdown">${renderMarkdown(message.content)}</div>
        ${options.length ? `<div class="outcome-body" style="padding-top:0">
          <div class="suggestions">${options.map((option) => `<button class="suggestion" data-fill="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join('')}</div>
        </div>` : ''}
        ${status === 'failed' || status === 'interrupted' || status === 'unverified' ? `<div class="outcome-body" style="padding-top:0">
          <button class="btn small" data-undo="${message.run_id || ''}">${icon('refresh')} Undo this run's file changes</button>
        </div>` : ''}
      </div>`;
    }
    if (message.kind === 'system') {
      return `<div class="center tiny muted" style="padding:2px 0">${escapeHtml(message.content)}</div>`;
    }
    if (message.role === 'user') {
      return `<div class="msg user"><div class="bubble">${escapeHtml(message.content)}</div></div>`;
    }
    return `<div class="msg assistant"><div style="min-width:0">
      <div class="who">${icon('sparkle')} Forgebook</div>
      <div class="bubble markdown">${renderMarkdown(message.content)}</div>
    </div></div>`;
  }

  function paintMessages() {
    if (!chatInner) return;
    const scroll = pane.querySelector('#chat-scroll');
    const atBottom = !scroll || scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 120;

    if (!ui.messages.length) {
      chatInner.innerHTML = `
        <div class="empty" style="margin-top:12px">
          <div style="color:var(--accent)">${icon('sparkle')}</div>
          <h3>${ui.filesCount ? 'What should we change?' : 'What are we building?'}</h3>
          <p>Describe the outcome in plain language. The agent plans, edits real files and checks its own work — it keeps going until the task is done or it needs a decision from you.</p>
        </div>
        <div class="suggestions" style="justify-content:center;margin-top:12px">
          ${SUGGESTIONS.map((text) => `<button class="suggestion" data-fill="${escapeHtml(text)}">${escapeHtml(text)}</button>`).join('')}
        </div>
        ${!getApiKey() ? `<div class="callout warn small" style="margin-top:14px">
          No OpenRouter key yet. <a href="#/settings">Add one in Settings</a> so the agent can run.
        </div>` : ''}`;
    } else {
      chatInner.innerHTML = ui.messages.map(messageHTML).join('') + `<div id="live-host"></div>`;
    }
    liveHost = chatInner.querySelector('#live-host') || null;
    paintLive();

    if (atBottom && scroll) scroll.scrollTop = scroll.scrollHeight;
  }

  function paintLive() {
    if (!liveHost) {
      // The empty state may have been replaced; make sure a host exists.
      if (!chatInner) return;
      if (!chatInner.querySelector('#live-host')) {
        chatInner.insertAdjacentHTML('beforeend', '<div id="live-host"></div>');
      }
      liveHost = chatInner.querySelector('#live-host');
    }
    if (!ui.live) { liveHost.innerHTML = ''; return; }

    const log = ui.live.log.slice(-40);
    const scroll = pane.querySelector('#chat-scroll');
    const atBottom = !scroll || scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 140;

    liveHost.innerHTML = `
      <div class="activity-strip">
        <div class="activity-line">
          ${ui.running ? '<span class="spinner"></span>' : icon('check')}
          <span class="truncate" style="flex:1">${escapeHtml(ui.live.status || 'Working…')}</span>
          <span class="tiny muted">${ui.live.steps ? `${ui.live.steps} steps` : ''}</span>
          ${ui.running ? `<button class="btn ghost small" id="live-stop">Stop</button>` : ''}
        </div>
        ${log.length ? `<div class="activity-log">
          ${log.map((entry) => `<div class="${entry.kind}">${escapeHtml(entry.text)}</div>`).join('')}
        </div>` : ''}
      </div>`;

    liveHost.querySelector('#live-stop')?.addEventListener('click', () => ui.runner?.stop());
    if (atBottom && scroll) scroll.scrollTop = scroll.scrollHeight;
  }

  function paintComposer() {
    if (!sendBtn) return;
    sendBtn.classList.toggle('stop', ui.running);
    sendBtn.innerHTML = ui.running ? icon('stop') : icon('send');
    sendBtn.disabled = ui.running ? false : !input?.value.trim();
    if (input) input.disabled = ui.running;
    const label = pane.querySelector('#model-label');
    if (label) {
      const models = applyPreferences(ctx.state.registry || [], ctx.state.prefs || {});
      const chosen = ui.preferredModel || pickModel(ctx.state.registry || [], ctx.state.prefs || {}, ctx.state.settings || {}, { role: 'code' }).primary;
      const record = models.find((model) => model.id === chosen);
      label.textContent = record ? record.name : 'No model — add a key';
      const hint = pane.querySelector('#composer-hint');
      if (hint) {
        hint.textContent = ui.running ? 'agent running' : getApiKey() ? '' : 'add a key to run';
      }
    }
  }

  pane.addEventListener('click', (event) => {
    const fill = event.target.closest('[data-fill]');
    if (fill && input) {
      input.value = fill.dataset.fill;
      autoGrow();
      sendBtn.disabled = false;
      input.focus();
      return;
    }
    const viewRun = event.target.closest('[data-view-run]');
    if (viewRun) { ui.expandedRun = viewRun.dataset.viewRun; setTab('activity'); return; }
    const undo = event.target.closest('[data-undo]');
    if (undo) {
      const runId = undo.dataset.undo;
      if (runId) restoreCheckpoint(runId);
      return;
    }
    const copy = event.target.closest('[data-copy]');
    if (copy) {
      const code = copy.parentElement?.querySelector('code')?.textContent || '';
      navigator.clipboard.writeText(code).then(() => toast('Copied', { kind: 'ok' })).catch(() => {});
    }
  });

  function submit() {
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    if (ui.running) return;
    input.value = '';
    autoGrow();
    sendBtn.disabled = true;
    startRun(text);
  }

  async function startRun(instruction, { recovery = '', quiet = false } = {}) {
    if (!getApiKey()) {
      toast('Add an OpenRouter API key in Settings first.', { kind: 'warn' });
      ctx.navigate('/settings');
      return;
    }

    let userMessage = null;
    if (!quiet) {
      try {
        userMessage = await repo.addMessage({
          projectId: project.id, role: 'user', kind: 'chat', content: instruction,
        });
        ui.messages.push(userMessage);
        paintMessages();
      } catch (err) {
        toast(`Could not save the message: ${err.message}`, { kind: 'bad' });
        return;
      }
    }

    await ctx.ensureModels().catch(() => {});

    ui.running = true;
    ui.live = { status: 'Thinking…', log: [], steps: 0, startedAt: Date.now() };
    ui.interrupted = [];
    paintComposer();
    paintLive();

    const history = buildChatHistory(ui.messages.filter((m) => m !== userMessage));

    const runner = new AgentRunner({
      project,
      fs,
      settings: ctx.state.settings || {},
      registry: ctx.state.registry || [],
      prefs: ctx.state.prefs || {},
      apiKey: getApiKey(),
      history,
      onEvent,
    });
    ui.runner = runner;

    try {
      await runner.start(instruction, { recovery, preferredModel: ui.preferredModel });
    } catch (err) {
      toast(err.message, { kind: 'bad' });
      ui.live.log.push({ kind: 'bad', text: err.message });
      paintLive();
    } finally {
      ui.running = false;
      ui.runner = null;
      await reloadAfterRun();
    }
  }

  const refreshStats = debounce(async () => {
    try {
      const files = await fs.list();
      ui.filesCount = files.length;
      updateCounts();
    } catch { /* ignore */ }
  }, 900);

  function onEvent(event) {
    if (!ui.live) ui.live = { status: '', log: [], steps: 0, startedAt: Date.now() };
    if (event.type === 'run') {
      ui.live.startedAt = Date.now();
    } else if (event.type === 'status') {
      ui.live.status = event.message || 'Working…';
      paintLive();
    } else if (event.type === 'thought') {
      ui.live.log.push({ kind: 'thought', text: truncate(event.text, 200) });
      paintLive();
    } else if (event.type === 'step') {
      const step = event.step;
      ui.live.steps += 1;
      ui.live.status = `${step.name} ${step.ok ? 'ok' : 'failed'}`;
      ui.live.log.push({
        kind: step.ok ? 'ok' : 'bad',
        text: `${step.name}${step.ok ? '' : ' ✕'} ${Math.round(step.durationMs)}ms`,
      });
      paintLive();
      if (step.ok) refreshStats();
    } else if (event.type === 'notice') {
      ui.live.log.push({ kind: '', text: event.message });
      paintLive();
    } else if (event.type === 'plan') {
      ui.tasks = event.tasks;
      updateCounts();
    } else if (event.type === 'memory') {
      ui.memory = event.memory;
    } else if (event.type === 'done') {
      ui.live.status = event.status === 'completed' ? 'Finished' : `Finished: ${statusLabel(event.status)}`;
      ui.live.log.push({ kind: event.status === 'completed' ? 'ok' : 'bad', text: truncate(event.summary, 160) });
      paintLive();
    }
  }

  async function reloadAfterRun() {
    const [messages, tasks, memory, runs] = await Promise.all([
      repo.listMessages(project.id).catch(() => ui.messages),
      repo.listTasks(project.id).catch(() => ui.tasks),
      repo.getMemory(project.id).catch(() => ui.memory),
      repo.listRuns(project.id).catch(() => ui.runs),
    ]);
    ui.messages = messages;
    ui.tasks = tasks;
    ui.memory = memory;
    ui.runs = runs;
    ui.live = null;
    if (ui.tab === 'chat') paintMessages();
    paintComposer();
    updateCounts();
    refreshStats();
  }

  // -------------------------------------------------------------------------
  // files
  // -------------------------------------------------------------------------

  async function paintFilesPane() {
    const host = document.createElement('div');
    host.className = 'ws-pane';
    host.style.width = '100%';
    pane.appendChild(host);
    await mountFilesPane(host, {
      project,
      fs,
      ctx,
      onChanged: async () => {
        const files = await fs.list().catch(() => []);
        ui.filesCount = files.length;
        ui.linkState = fs.linkState;
        updateCounts();
        indexProject(project, fs).catch(() => {});
      },
      onOpenChat: () => setTab('chat'),
    });
  }

  // -------------------------------------------------------------------------
  // plan
  // -------------------------------------------------------------------------

  function paintPlanPane() {
    const groups = groupBy(ui.tasks, (task) => task.phase || 'General');
    const phases = [...groups.entries()];

    pane.innerHTML = `
      <div class="pane-toolbar">
        <span class="section-title" style="margin:0;flex:1">Roadmap</span>
        <button class="btn small" id="plan-ai">${icon('sparkle')} Plan with AI</button>
      </div>
      <div class="pane-scroll">
        <div class="searchbox" style="margin-bottom:12px">
          ${icon('plus')}
          <input id="new-task" placeholder="Add a task and press Enter" />
        </div>
        <div id="plan-body"></div>
      </div>`;

    const body = pane.querySelector('#plan-body');
    if (!phases.length) {
      body.innerHTML = emptyState({
        iconName: 'list',
        title: 'No roadmap yet',
        body: 'Ask the agent to plan the work, or add the first task yourself. The roadmap is what the agent reads before each task.',
      });
    } else {
      body.innerHTML = phases.map(([phase, tasks]) => `
        <div class="phase-block">
          <div class="phase-head">
            <h3>${escapeHtml(phase)}</h3>
            <span class="badge">${tasks.filter((t) => t.status === 'done').length}/${tasks.length}</span>
          </div>
          ${tasks.map(taskHTML).join('')}
        </div>`).join('');
    }

    function taskHTML(task) {
      return `<div class="task ${escapeHtml(task.status)}" data-task="${task.id}">
        <button class="status-dot" data-cycle="${task.id}" aria-label="Change status" style="border:0;cursor:pointer"></button>
        <div style="flex:1;min-width:0">
          <div class="task-title">${escapeHtml(task.title)}</div>
          ${task.detail ? `<div class="task-detail">${escapeHtml(truncate(task.detail, 180))}</div>` : ''}
          ${task.blocked_reason ? `<div class="task-detail" style="color:var(--warn)">Blocked: ${escapeHtml(task.blocked_reason)}</div>` : ''}
        </div>
        <div class="task-actions">
          <button class="btn ghost icon small" data-edit-task="${task.id}" aria-label="Edit task">${icon('edit')}</button>
        </div>
      </div>`;
    }

    pane.querySelector('#new-task').addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter') return;
      const title = event.target.value.trim();
      if (!title) return;
      event.target.value = '';
      try {
        const task = await repo.addTask(project.id, { title });
        ui.tasks = [...ui.tasks, task];
        paintPlanPane();
        updateCounts();
      } catch (err) { toast(err.message, { kind: 'bad' }); }
    });

    pane.querySelector('#plan-ai').addEventListener('click', () => {
      setTab('chat');
      startRun(planInstruction(project.description || project.name));
    });

    body.addEventListener('click', async (event) => {
      const cycle = event.target.closest('[data-cycle]');
      if (cycle) {
        const task = ui.tasks.find((t) => t.id === cycle.dataset.cycle);
        if (!task) return;
        const order = ['todo', 'doing', 'done'];
        const next = order[(order.indexOf(task.status) + 1) % order.length];
        try {
          const updated = await repo.updateTask(task.id, { status: next });
          ui.tasks = ui.tasks.map((t) => (t.id === updated.id ? updated : t));
          paintPlanPane();
          updateCounts();
        } catch (err) { toast(err.message, { kind: 'bad' }); }
        return;
      }

      const edit = event.target.closest('[data-edit-task]');
      if (edit) {
        const task = ui.tasks.find((t) => t.id === edit.dataset.editTask);
        if (task) editTask(task);
      }
    });
  }

  async function editTask(task) {
    const body = `
      <div class="field"><label>Title</label><input class="input" id="t-title" value="${escapeHtml(task.title)}" /></div>
      <div class="field"><label>Details</label><textarea class="textarea" id="t-detail" rows="3">${escapeHtml(task.detail || '')}</textarea></div>
      <div class="field"><label>Phase</label><input class="input" id="t-phase" value="${escapeHtml(task.phase || 'General')}" /></div>
      <div class="field"><label>Status</label>
        <select class="select" id="t-status">
          ${['todo', 'doing', 'done', 'blocked'].map((status) => `<option value="${status}" ${task.status === status ? 'selected' : ''}>${statusLabel(status)}</option>`).join('')}
        </select>
      </div>`;
    const save = await openModal({
      title: 'Edit task',
      body,
      actions: [
        { label: 'Delete', value: 'delete', variant: 'danger' },
        { label: 'Cancel', value: null, variant: 'ghost' },
        { label: 'Save', value: 'save', variant: 'primary' },
      ],
    });
    if (save === 'delete') {
      try {
        await repo.deleteTask(task.id);
        ui.tasks = ui.tasks.filter((t) => t.id !== task.id);
        paintPlanPane();
        updateCounts();
      } catch (err) { toast(err.message, { kind: 'bad' }); }
      return;
    }
    if (save !== 'save') return;
    const patch = {
      title: document.getElementById('t-title')?.value.trim() || task.title,
      detail: document.getElementById('t-detail')?.value || '',
      phase: document.getElementById('t-phase')?.value.trim() || 'General',
      status: document.getElementById('t-status')?.value || task.status,
    };
    try {
      const updated = await repo.updateTask(task.id, patch);
      ui.tasks = ui.tasks.map((t) => (t.id === updated.id ? updated : t));
      paintPlanPane();
      updateCounts();
    } catch (err) { toast(err.message, { kind: 'bad' }); }
  }

  // -------------------------------------------------------------------------
  // activity
  // -------------------------------------------------------------------------

  async function paintActivityPane() {
    const runs = ui.runs;
    pane.innerHTML = `
      <div class="pane-toolbar">
        <span class="section-title" style="margin:0;flex:1">Activity</span>
        <button class="btn small ghost icon" id="runs-refresh" aria-label="Refresh">${icon('refresh')}</button>
      </div>
      <div class="pane-scroll" id="runs-body">
        ${runs.length ? runs.map(runHTML).join('') : emptyState({
          iconName: 'activity',
          title: 'Nothing has run yet',
          body: 'Every task the agent runs is logged here: the model, each tool call, what succeeded and what did not.',
        })}
      </div>`;

    function runHTML(run) {
      const expanded = ui.expandedRun === run.id;
      const steps = ui.stepsByRun[run.id];
      return `<div class="run-card">
        <div class="run-head" data-run="${run.id}">
          ${statusBadge(run.status)}
          <div class="title truncate">${escapeHtml(truncate(run.instruction, 100))}</div>
          <div class="tiny muted">${timeAgo(run.started_at)}</div>
          ${icon(expanded ? 'chevron' : 'chevron', expanded ? '' : 'rot')}
        </div>
        ${expanded ? `<div class="run-steps" id="steps-${run.id}">
          <div class="tiny muted">${escapeHtml(run.model || 'unknown model')} · ${run.step_count || 0} steps${run.tokens_in ? ` · ${run.tokens_in}+${run.tokens_out} tokens` : ''}</div>
          ${run.summary ? `<div class="small" style="color:var(--text-2);margin:4px 0">${escapeHtml(truncate(run.summary, 400))}</div>` : ''}
          ${!steps ? '<div class="tiny muted">Loading steps…</div>' : (steps.length ? steps.map((step) => `
            <div class="step-row">
              <span class="tiny muted" style="width:26px">${step.seq}</span>
              <span class="tool">${escapeHtml(step.name || step.type)}</span>
              <span class="${step.ok === false ? 'bad' : 'ok'}">${step.ok === false ? 'failed' : step.ok === true ? 'ok' : ''}</span>
              <span class="tiny" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(truncate(JSON.stringify(step.input || {}), 100))}</span>
            </div>`).join('') : '<div class="tiny muted">No steps were recorded.</div>')}
          <div class="row" style="margin-top:8px">
            <button class="btn small" data-restore="${run.id}">${icon('refresh')} Restore files to before this run</button>
          </div>
        </div>` : ''}
      </div>`;
    }

    pane.querySelector('#runs-refresh').addEventListener('click', async () => {
      ui.runs = await repo.listRuns(project.id).catch(() => ui.runs);
      await paintActivityPane();
    });

    pane.querySelector('#runs-body').addEventListener('click', async (event) => {
      const restore = event.target.closest('[data-restore]');
      if (restore) {
        event.stopPropagation();
        restoreCheckpoint(restore.dataset.restore);
        return;
      }
      const head = event.target.closest('[data-run]');
      if (!head) return;
      const id = head.dataset.run;
      if (ui.expandedRun === id) { ui.expandedRun = null; }
      else {
        ui.expandedRun = id;
        if (!ui.stepsByRun[id]) {
          ui.stepsByRun[id] = await repo.listSteps(id).catch(() => []);
        }
      }
      await paintActivityPane();
    });

    if (ui.expandedRun && !ui.stepsByRun[ui.expandedRun]) {
      ui.stepsByRun[ui.expandedRun] = await repo.listSteps(ui.expandedRun).catch(() => []);
      await paintActivityPane();
    }
  }

  async function restoreCheckpoint(runId) {
    const checkpoint = await fs.vault.getCheckpoint(runId).catch(() => null);
    if (!checkpoint) {
      toast('No local checkpoint for that run on this device.', { kind: 'warn' });
      return;
    }
    const ok = await confirmDialog({
      title: 'Restore files?',
      message: `This puts ${checkpoint.entries.length} file(s) back to how they were before that run.`,
      details: 'Edits you made after that run to the same files will be overwritten.',
      confirmLabel: 'Restore files',
      danger: true,
    });
    if (!ok) return;
    try {
      let count = 0;
      for (const entry of checkpoint.entries) {
        if (entry.existed) await fs.write(entry.path, entry.content, { binary: entry.binary });
        else await fs.remove(entry.path);
        count += 1;
      }
      await repo.markCheckpointRestored(runId).catch(() => {});
      toast(`Restored ${count} file(s)`, { kind: 'ok' });
      // Refresh whichever pane is visible.
      await paintPane();
      await onEvent({ type: 'refresh' });
    } catch (err) {
      toast(`Restore failed: ${err.message}`, { kind: 'bad' });
    }
  }

  // -------------------------------------------------------------------------
  // memory
  // -------------------------------------------------------------------------

  function paintMemoryPane() {
    const sections = [
      { key: 'overview', label: 'Overview' },
      { key: 'architecture', label: 'Architecture' },
      { key: 'conventions', label: 'Conventions' },
      { key: 'decisions', label: 'Decisions' },
      { key: 'issues', label: 'Known issues' },
    ];

    pane.innerHTML = `
      <div class="pane-toolbar">
        <span class="section-title" style="margin:0;flex:1">Project memory</span>
        <button class="btn small" id="analyze">${icon('brain')} Analyse project</button>
      </div>
      <div class="pane-scroll">
        <p class="tiny muted" style="margin-bottom:12px">
          Memory is what the agent reads before each task. It is a summary, never a substitute for the files —
          the agent re-reads anything it is about to change.
        </p>
        ${sections.map((section) => {
          const record = ui.memory[section.key];
          const content = record?.content?.trim() || '';
          return `<div class="memory-section" data-section="${section.key}">
            <div class="memory-head">
              <h3>${section.label}</h3>
              <span class="spacer"></span>
              <span class="tiny muted">${record?.updated_at ? timeAgo(record.updated_at) : 'empty'}</span>
              <button class="btn ghost icon small" data-edit-memory="${section.key}" aria-label="Edit">${icon('edit')}</button>
            </div>
            <div class="memory-body">
              ${content
                ? `<div class="memory-preview">${escapeHtml(truncate(content, 420))}</div>`
                : `<div class="tiny muted">Nothing recorded yet. ${section.key === 'overview' ? 'Run “Analyse project” to fill this in.' : ''}</div>`}
            </div>
          </div>`;
        }).join('')}
        <div class="callout small" style="margin-top:4px">
          File index: ${ui.filesCount} files recorded in your Supabase project, so the structure is visible from another device even though the files themselves stay local.
        </div>
      </div>`;

    pane.querySelector('#analyze').addEventListener('click', () => {
      setTab('chat');
      startRun(analyzeInstruction());
    });

    pane.querySelector('.pane-scroll').addEventListener('click', async (event) => {
      const edit = event.target.closest('[data-edit-memory]');
      if (!edit) return;
      const key = edit.dataset.editMemory;
      const current = ui.memory[key]?.content || '';
      const next = await promptDialog({
        title: `Edit ${key}`,
        label: 'Content (markdown)',
        value: current,
        multiline: true,
        confirmLabel: 'Save',
      });
      if (next === null) return;
      try {
        await repo.setMemory(project.id, key, next, 'user');
        ui.memory = { ...ui.memory, [key]: { ...(ui.memory[key] || {}), section: key, content: next, updated_at: new Date().toISOString() } };
        paintMemoryPane();
        updateCounts();
        toast('Memory saved', { kind: 'ok' });
      } catch (err) { toast(err.message, { kind: 'bad' }); }
    });
  }

  // -------------------------------------------------------------------------
  // model picker + project menu
  // -------------------------------------------------------------------------

  async function openModelPicker() {
    await ctx.ensureModels().catch(() => {});
    const models = applyPreferences(ctx.state.registry || [], ctx.state.prefs || {})
      .filter((model) => model.enabled && model.available)
      .sort((a, b) => (b.is_free === true) - (a.is_free === true) || a.name.localeCompare(b.name));

    const auto = pickModel(ctx.state.registry || [], ctx.state.prefs || {}, ctx.state.settings || {}, { role: 'code' });

    let modalEl = null;
    const body = `
      <div class="callout small" style="margin-bottom:10px">
        Applies to this project. Leave it on <strong>Automatic</strong> to let Forgebook pick a capable model and switch if one fails.
      </div>
      <div class="filter-row">
        <button class="filter-chip ${!ui.preferredModel ? 'active' : ''}" data-pick="">Automatic${auto.primary ? ` · ${escapeHtml(auto.primary.split('/').pop())}` : ''}</button>
      </div>
      <div style="max-height:46dvh;overflow:auto;border:1px solid var(--line-soft);border-radius:12px">
        ${models.length ? models.map((model) => `
          <button class="file-row" data-pick="${escapeHtml(model.id)}" style="width:100%;text-align:left;border-radius:0;border-bottom:1px solid var(--line-soft)">
            <span class="name">${escapeHtml(model.name)}${model.id === ui.preferredModel ? ' ✓' : ''}</span>
            <span class="size">${model.is_free ? 'free' : `$${Number(model.price_in).toFixed(2)}/M`}</span>
          </button>`).join('') : '<div class="pane-scroll tiny muted">No enabled models. Turn some on in the Models screen.</div>'}
      </div>`;

    await openModal({
      title: 'Model for this project',
      body,
      actions: [{ label: 'Close', value: null, variant: 'ghost' }],
      onMount: (el) => {
        modalEl = el;
        el.addEventListener('click', (event) => {
          const pick = event.target.closest('[data-pick]');
          if (!pick) return;
          ui.preferredModel = pick.dataset.pick || '';
          if (ui.preferredModel) localStorage.setItem(MODEL_KEY(project.id), ui.preferredModel);
          else localStorage.removeItem(MODEL_KEY(project.id));
          paintComposer();
          closeModal();
          toast(ui.preferredModel ? 'Model set for this project' : 'Back to automatic model selection', { kind: 'ok' });
        });
      },
    });
    // No-op: openModal owns the element lifecycle.
    void modalEl;
  }

  async function projectMenu() {
    const choice = await openModal({
      title: project.name,
      body: `<div class="small muted" style="margin-bottom:10px">${escapeHtml(project.description || 'No description yet.')}</div>
        <div class="row wrap" style="gap:6px">
          <span class="badge">${escapeHtml(project.stack || 'stack unknown')}</span>
          <span class="badge">${ui.filesCount} files</span>
          <span class="badge ${ui.linkState === 'linked' ? 'ok' : ''}">${linkLabel()}</span>
        </div>`,
      actions: [
        { label: 'Export ZIP', value: 'export' },
        { label: 'Rename', value: 'rename', variant: 'ghost' },
        { label: 'Delete project', value: 'delete', variant: 'danger' },
      ],
    });
    if (!choice) return;

    if (choice === 'export') {
      try {
        const files = await fs.list();
        const entries = [];
        for (const file of files) {
          const record = await fs.read(file.path).catch(() => null);
          if (record) entries.push(record);
        }
        const blob = await buildZipBlob(entries, { folder: project.name.replace(/[^\w.-]+/g, '-') });
        downloadBlob(blob, `${project.name.replace(/[^\w.-]+/g, '-')}.zip`);
        toast(`Exported ${entries.length} files`, { kind: 'ok' });
      } catch (err) { toast(`Export failed: ${err.message}`, { kind: 'bad' }); }
      return;
    }

    if (choice === 'rename') {
      const name = await promptDialog({ title: 'Rename project', label: 'Name', value: project.name });
      if (!name) return;
      try {
        await repo.updateProject(project.id, { name });
        project.name = name;
        root.querySelector('.ws-title h1').textContent = name;
        toast('Renamed', { kind: 'ok' });
      } catch (err) { toast(err.message, { kind: 'bad' }); }
      return;
    }

    if (choice === 'delete') {
      const ok = await confirmDialog({
        title: 'Delete this project?',
        message: 'Chat history, memory and the local file copy will be removed.',
        details: 'A linked folder on your computer is not touched.',
        confirmLabel: 'Delete project',
        danger: true,
      });
      if (!ok) return;
      try {
        await fs.vault.wipe();
        await repo.deleteProject(project.id);
        ctx.navigate('/');
      } catch (err) { toast(err.message, { kind: 'bad' }); }
    }
  }

  // -------------------------------------------------------------------------
  // wiring
  // -------------------------------------------------------------------------

  root.querySelector('#back').addEventListener('click', () => ctx.navigate('/'));
  root.querySelector('#ws-menu').addEventListener('click', projectMenu);

  await paintPane();
  updateCounts();

  // Resume banner for interrupted runs.
  if (ui.interrupted.length) {
    const run = ui.interrupted[0];
    const banner = document.createElement('div');
    banner.className = 'callout warn small';
    banner.style.margin = '12px 12px 0';
    banner.innerHTML = `<strong>That last task was interrupted.</strong>
      The files may be half-finished. Resume inspects the project and continues, instead of repeating itself.
      <div class="row" style="margin-top:8px">
        <button class="btn small primary" id="resume-run">Resume task</button>
        <button class="btn small ghost" id="dismiss-run">Dismiss</button>
      </div>`;
    pane.parentElement.parentElement.insertBefore(banner, pane.parentElement);
    banner.querySelector('#dismiss-run').addEventListener('click', () => banner.remove());
    banner.querySelector('#resume-run').addEventListener('click', async () => {
      banner.remove();
      if (ui.tab !== 'chat') setTab('chat');
      const steps = await repo.listSteps(run.id).catch(() => []);
      const files = await fs.list().catch(() => []);
      const recovery = buildRecoveryNote({ run, steps, files });
      await repo.addMessage({
        projectId: project.id, role: 'system', kind: 'system',
        content: `Resuming an interrupted task (${timeAgo(run.started_at)}).`,
      }).catch(() => {});
      ui.messages = await repo.listMessages(project.id).catch(() => ui.messages);
      paintMessages();
      startRun(run.instruction, { recovery, quiet: true });
    });
  }

  return () => {
    if (ui.runner?.isRunning) ui.runner.stop();
  };
}
