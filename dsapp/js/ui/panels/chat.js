import { el, clear, timeAgo } from '../dom.js';
import { renderMarkdown } from '../../lib/markdown.js';
import { toast } from '../toast.js';
import { state } from '../../state.js';
import { promptDialog } from '../modal.js';
import {
  listMessages, addMessage, createTask, listRoadmap, listMemory,
  findInterruptedTasks, updateTask, getAppState, setAppState,
} from '../../services/db.js';
import { selectRelevantFiles, buildContext, buildInitialAgentMessages } from '../../services/context.js';
import { runAgent } from '../../services/agent.js';
import { activeModels, pickDefaultModel, modelSupportsTools } from '../../services/models.js';
import { initActivity, pushActivity, clearActivity, updateActivity } from '../activity.js';

let abortController = null;
let messageListEl = null;
let statusEl = null;
let inputEl = null;
let sendBtn = null;
let modelSelect = null;
let activityToggleEl = null;
let activityListEl = null;
let activityExpanded = false;

export async function renderChat(root, ctx) {
  clear(root);
  const project = state.currentProject;
  if (!project) {
    root.appendChild(el('div', { class: 'empty' }, 'Open a project to start chatting.'));
    return;
  }

  const chat = el('div', { class: 'chat' });

  // --- messages
  const scroll = el('div', { class: 'chat-scroll' });
  messageListEl = scroll;
  chat.appendChild(scroll);

  // --- status
  statusEl = el('div', { class: 'chat-status hidden' });
  chat.appendChild(statusEl);

  // --- input area
  const inputArea = el('div', { class: 'chat-input-area' });
  const inputRow = el('div', { class: 'chat-input-row' });
  inputEl = el('textarea', {
    class: 'textarea',
    placeholder: 'Describe what you want to build or change…',
    rows: 1,
    onkeydown: (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        onSend(ctx);
      }
    },
    oninput: () => {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + 'px';
    },
  });
  sendBtn = el('button', {
    class: 'btn btn-primary btn-icon',
    onclick: () => state.running ? onStop() : onSend(ctx),
    title: 'Send',
  }, '➤');
  inputRow.appendChild(inputEl);
  inputRow.appendChild(sendBtn);
  inputArea.appendChild(inputRow);

  const controls = el('div', { class: 'chat-input-controls' });
  modelSelect = el('select', { class: 'select', onchange: () => {
    state.selectedModelId = modelSelect.value;
  } });
  populateModelSelect();
  controls.appendChild(modelSelect);
  controls.appendChild(el('div', { class: 'spacer' }));
  activityToggleEl = el('button', { class: 'btn btn-ghost btn-sm', onclick: () => {
    activityExpanded = !activityExpanded;
    activityListEl.classList.toggle('hidden', !activityExpanded);
    activityToggleEl.textContent = activityExpanded ? 'Hide activity' : 'Show activity';
  } }, 'Show activity');
  controls.appendChild(activityToggleEl);
  inputArea.appendChild(controls);

  activityListEl = el('div', { class: 'activity-list hidden' });
  inputArea.appendChild(activityListEl);
  initActivity(activityListEl);

  chat.appendChild(inputArea);
  root.appendChild(chat);

  // --- load history
  await loadMessages();
  await detectInterrupted(ctx);
}

function populateModelSelect() {
  if (!modelSelect) return;
  clear(modelSelect);
  const active = activeModels(state.models, state.modelPrefs);
  if (!state.selectedModelId) {
    const pick = pickDefaultModel(state.models, state.modelPrefs);
    state.selectedModelId = pick?.id || '';
  }
  for (const m of active) {
    const opt = el('option', { value: m.id }, `${m.name}${m.is_free ? ' · free' : ''}`);
    if (m.id === state.selectedModelId) opt.selected = true;
    modelSelect.appendChild(opt);
  }
  if (!active.length) {
    modelSelect.appendChild(el('option', { value: '' }, 'No models available'));
  }
}

async function loadMessages() {
  const project = state.currentProject;
  if (!project || !messageListEl) return;
  clear(messageListEl);
  try {
    const msgs = await listMessages(project.id, 200);
    state.messages = msgs;
    for (const m of msgs) renderMessage(m);
    scrollToBottom();
  } catch (err) {
    messageListEl.appendChild(el('div', { class: 'empty' }, `Failed to load messages: ${err.message}`));
  }
}

function renderMessage(m) {
  if (!messageListEl) return;
  if (m.role === 'tool' || m.role === 'system') return;
  const cls = m.role === 'user' ? 'msg msg-user' : 'msg msg-assistant';
  const body = m.role === 'assistant'
    ? el('div', { html: renderMarkdown(m.content) })
    : el('div', {}, m.content);
  const node = el('div', { class: cls }, body);
  if (m.created_at) node.appendChild(el('div', { class: 'msg-meta' }, timeAgo(m.created_at)));
  messageListEl.appendChild(node);
}

function scrollToBottom() {
  if (messageListEl) messageListEl.scrollTop = messageListEl.scrollHeight;
}

function setStatus(text, active = true) {
  if (!statusEl) return;
  if (!text) { statusEl.classList.add('hidden'); return; }
  clear(statusEl);
  statusEl.classList.remove('hidden');
  if (active) statusEl.appendChild(el('span', { class: 'dot' }));
  statusEl.appendChild(el('span', {}, text));
}

async function detectInterrupted(ctx) {
  const project = state.currentProject;
  if (!project) return;
  try {
    const interrupted = await findInterruptedTasks(project.id);
    if (!interrupted.length) return;
    const t = interrupted[0];
    const shouldResume = await promptDialog({
      title: 'Interrupted task detected',
      label: `A previous task was interrupted: "${t.title}". Describe how to proceed (or leave blank to mark it as failed).`,
      multiline: true,
    });
    if (shouldResume === null) return;
    if (!shouldResume) {
      await updateTask(t.id, { status: 'failed', result_summary: 'Marked as failed after interruption' });
      return;
    }
    await updateTask(t.id, { status: 'failed', result_summary: 'Superseded by new instruction' });
    inputEl.value = shouldResume;
    inputEl.focus();
  } catch (err) {
    console.warn('interrupted check failed', err);
  }
}

function onStop() {
  if (abortController) abortController.abort();
}

async function onSend(ctx) {
  const project = state.currentProject;
  if (!project || !inputEl) return;
  const text = inputEl.value.trim();
  if (!text) return;
  const modelId = state.selectedModelId;
  if (!modelId) { toast('Select a model first', 'error'); return; }

  inputEl.value = '';
  inputEl.style.height = 'auto';
  setRunning(true);

  try {
    // Persist user message.
    const userMsg = await addMessage(project.id, { role: 'user', content: text });
    state.messages.push(userMsg);
    renderMessage(userMsg);
    scrollToBottom();

    // Create task.
    const task = await createTask(project.id, {
      title: text.slice(0, 120),
      description: text,
      model: modelId,
    });
    state.tasks.unshift(task);

    setStatus('Preparing context…');
    clearActivity();

    const fs = state.fs;
    if (!fs) throw new Error('Filesystem not ready. Reload the project.');

    // Build context.
    const tree = await fs.tree();
    const roadmap = state.roadmap.length ? state.roadmap : await listRoadmap(project.id);
    const memory = state.memory.length ? state.memory : await listMemory(project.id);
    const relevant = selectRelevantFiles({
      task: text,
      messages: state.messages.slice(-8),
      tree,
      limit: 6,
    });
    const fileContents = [];
    for (const f of relevant) {
      try {
        const content = await fs.read(f.path);
        fileContents.push({ path: f.path, content });
      } catch { /* skip */ }
    }
    const contextBlock = buildContext({
      project,
      task: text,
      recentMessages: state.messages.slice(-10),
      memory,
      roadmap,
      fileIndex: tree,
      relevantFiles: fileContents,
    });
    const nativeTools = modelSupportsTools(modelId, state.models);
    const initialMessages = buildInitialAgentMessages({
      project,
      task: text,
      contextBlock,
      toolsAvailable: nativeTools,
    });

    abortController = new AbortController();
    setStatus('Thinking…');

    const result = await runAgent({
      project,
      fs,
      task,
      initialMessages,
      signal: abortController.signal,
      onEvent: (evt) => handleAgentEvent(evt, ctx),
    });

    // Persist assistant message.
    const assistantMsg = await addMessage(project.id, { role: 'assistant', content: result.content });
    state.messages.push(assistantMsg);
    renderMessage(assistantMsg);
    scrollToBottom();

    if (result.awaitingUser) {
      setStatus('Awaiting your input', false);
    } else {
      setStatus('');
    }

    // Refresh memory and roadmap from server.
    await refreshSideData(project.id);
  } catch (err) {
    if (err.name === 'AbortError') {
      toast('Stopped', 'info');
      setStatus('Stopped', false);
    } else {
      toast(err.message || String(err), 'error');
      setStatus(`Error: ${err.message || err}`, false);
      const assistantMsg = await addMessage(project.id, {
        role: 'assistant',
        content: `⚠️ ${err.message || err}`,
      }).catch(() => null);
      if (assistantMsg) {
        state.messages.push(assistantMsg);
        renderMessage(assistantMsg);
        scrollToBottom();
      }
    }
  } finally {
    setRunning(false);
    abortController = null;
  }
}

function setRunning(running) {
  state.running = running;
  if (sendBtn) {
    sendBtn.textContent = running ? '■' : '➤';
    sendBtn.classList.toggle('btn-primary', !running);
    sendBtn.classList.toggle('btn-danger', running);
  }
  if (inputEl) inputEl.disabled = running;
}

let activityCounter = 0;

function handleAgentEvent(evt, ctx) {
  switch (evt.type) {
    case 'status':
      if (evt.status === 'thinking') setStatus(`Thinking (step ${evt.iteration})…`);
      else if (evt.status === 'executing_tools') setStatus(`Running ${evt.count} tool(s)…`);
      break;
    case 'tool_start': {
      const id = ++activityCounter;
      evt.call._activityId = id;
      pushActivity({ id, status: 'pending', label: `${evt.call.name}(${shortArgs(evt.call.arguments)})` });
      break;
    }
    case 'tool_end': {
      const id = evt.call._activityId;
      if (!id) return;
      updateActivity(id, {
        status: evt.result.ok ? 'done' : 'error',
        label: `${evt.call.name}(${shortArgs(evt.call.arguments)}) ${evt.result.ok ? '✓' : '✗'}`,
      });
      break;
    }
    case 'file_changed':
      ctx.notifyFileChanged?.(evt.path);
      break;
    case 'awaiting_user':
      break;
  }
}

function shortArgs(args) {
  try {
    const s = JSON.stringify(args || {});
    return s.length > 80 ? s.slice(0, 77) + '…' : s;
  } catch { return ''; }
}

async function refreshSideData(projectId) {
  try {
    state.roadmap = await listRoadmap(projectId);
    state.memory = await listMemory(projectId);
  } catch { /* ignore */ }
}
