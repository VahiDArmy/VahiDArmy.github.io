import { el, clear, timeAgo } from '../dom.js';
import { renderMarkdown } from '../../lib/markdown.js';
import { toast } from '../toast.js';
import { state } from '../../state.js';
import { promptDialog } from '../modal.js';
import {
  listMessages, addMessage, createTask, listRoadmap, listMemory,
  findInterruptedTasks, updateTask,
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
let activityCounter = 0;

// Streaming DOM elements
let currentMsgEl = null;
let currentContentEl = null;
let currentReasoningEl = null;
let currentRawContent = '';
let currentRawReasoning = '';

export async function renderChat(root, ctx) {
  clear(root);
  const project = state.currentProject;
  if (!project) {
    root.appendChild(el('div', { class: 'empty' }, 'Open a project to start chatting.'));
    return;
  }

  const chat = el('div', { class: 'chat' });

  const scroll = el('div', { class: 'chat-scroll' });
  messageListEl = scroll;
  chat.appendChild(scroll);

  statusEl = el('div', { class: 'chat-status hidden' });
  chat.appendChild(statusEl);

  const inputArea = el('div', { class: 'chat-input-area' });
  const inputRow = el('div', { class: 'chat-input-row' });
  inputEl = el('textarea', {
    class: 'textarea',
    placeholder: 'Describe what you want to build or change…',
    rows: 1,
    onkeydown: (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        if (!state.running) onSend(ctx);
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
  modelSelect = el('select', {
    class: 'select',
    onchange: (e) => { state.selectedModelId = e.target.value; },
  });
  populateModelSelect();
  controls.appendChild(modelSelect);
  controls.appendChild(el('div', { class: 'spacer' }));
  activityToggleEl = el('button', {
    class: 'btn btn-ghost btn-sm',
    onclick: () => {
      activityExpanded = !activityExpanded;
      activityListEl.classList.toggle('hidden', !activityExpanded);
      activityToggleEl.textContent = activityExpanded ? 'Hide activity' : 'Show activity';
    },
  }, activityExpanded ? 'Hide activity' : 'Show activity');
  controls.appendChild(activityToggleEl);
  inputArea.appendChild(controls);

  activityListEl = el('div', { class: `activity-list ${activityExpanded ? '' : 'hidden'}` });
  inputArea.appendChild(activityListEl);
  initActivity(activityListEl);

  chat.appendChild(inputArea);
  root.appendChild(chat);

  if (state.running) {
    setRunningUI(true);
    setStatus('Agent is running…');
  }

  await loadMessages();
  await detectInterrupted(ctx);
}

function populateModelSelect() {
  if (!modelSelect) return;
  clear(modelSelect);
  
  const freeModels = state.models.filter((m) => {
    const pref = state.modelPrefs.get(m.id);
    const enabled = pref ? pref.enabled !== false : true;
    return m.is_free && enabled;
  });

  freeModels.sort((a, b) => {
    const aIsTop = a.id.startsWith('openrouter/') || a.id.includes(':free');
    const bIsTop = b.id.startsWith('openrouter/') || b.id.includes(':free');
    if (aIsTop && !bIsTop) return -1;
    if (!aIsTop && bIsTop) return 1;
    return (b.context_length || 0) - (a.context_length || 0);
  });

  if (!state.selectedModelId || !freeModels.find(m => m.id === state.selectedModelId)) {
    const pick = pickDefaultModel(state.models, state.modelPrefs);
    state.selectedModelId = pick?.id || (freeModels[0]?.id || '');
  }

  for (const m of freeModels) {
    const toolsIcon = m.supports_tools ? ' 🛠' : '';
    const opt = el('option', { value: m.id }, `${m.name}${toolsIcon}`);
    if (m.id === state.selectedModelId) opt.selected = true;
    modelSelect.appendChild(opt);
  }

  if (!freeModels.length) {
    modelSelect.appendChild(el('option', { value: '' }, 'No free models available (Check Models tab)'));
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
  if (state.running) return; 
  const project = state.currentProject;
  if (!project) return;
  try {
    const interrupted = await findInterruptedTasks(project.id);
    if (!interrupted.length) return;
    const t = interrupted[0];
    const answer = await promptDialog({
      title: 'Interrupted task detected',
      label: `A previous task was interrupted: "${t.title}". Describe how to proceed (leave blank to mark it as failed).`,
      multiline: true,
    });
    if (answer === null) return;
    if (!answer) {
      await updateTask(t.id, { status: 'failed', result_summary: 'Marked as failed after interruption' });
      return;
    }
    await updateTask(t.id, { status: 'failed', result_summary: 'Superseded by new instruction' });
    inputEl.value = answer;
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
  setRunningUI(true);
  state.running = true;
  currentMsgEl = null; // Reset streaming state

  try {
    const userMsg = await addMessage(project.id, { role: 'user', content: text });
    state.messages.push(userMsg);
    renderMessage(userMsg);
    scrollToBottom();

    const task = await createTask(project.id, {
      title: text.slice(0, 120),
      description: text,
      model: modelId,
    });
    state.tasks.unshift(task);

    setStatus('Preparing context…');
    clearActivity();
    activityCounter = 0;

    const fs = state.fs;
    if (!fs) throw new Error('Filesystem not ready. Reload the project.');

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

    // Refresh messages from DB to ensure consistent view after all tools and streams
    await loadMessages();

    if (result.awaitingUser) {
      setStatus('Awaiting your input', false);
      toast('Agent is waiting for your answer — type it below.', 'info', 5000);
    } else {
      setStatus('');
    }

    await refreshSideData(project.id);
  } catch (err) {
    if (err.name === 'AbortError') {
      toast('Stopped', 'info');
      setStatus('Stopped', false);
      await loadMessages();
    } else {
      toast(err.message || String(err), 'error');
      setStatus(`Error: ${err.message || err}`, false);
      await loadMessages();
    }
  } finally {
    state.running = false;
    setRunningUI(false);
    abortController = null;
    currentMsgEl = null;
  }
}

function setRunningUI(running) {
  if (sendBtn) {
    sendBtn.textContent = running ? '■' : '➤';
    sendBtn.classList.toggle('btn-primary', !running);
    sendBtn.classList.toggle('btn-danger', running);
    sendBtn.title = running ? 'Stop' : 'Send';
  }
  if (inputEl) inputEl.disabled = running;
}

function handleAgentEvent(evt, ctx) {
  switch (evt.type) {
    case 'status':
      if (evt.status === 'thinking') setStatus(`Thinking (step ${evt.iteration})…`);
      else if (evt.status === 'executing_tools') setStatus(`Running ${evt.count} tool(s)…`);
      break;
      
    case 'stream': {
      if (!currentMsgEl) {
        currentMsgEl = el('div', { class: 'msg msg-assistant' });
        currentReasoningEl = el('div', { class: 'reasoning-box hidden' });
        currentContentEl = el('div', { class: 'content-box' });
        currentMsgEl.appendChild(currentReasoningEl);
        currentMsgEl.appendChild(currentContentEl);
        messageListEl.appendChild(currentMsgEl);
        currentRawContent = '';
        currentRawReasoning = '';
      }
      
      if (evt.streamType === 'reasoning') {
        currentRawReasoning += evt.text;
        currentReasoningEl.classList.remove('hidden');
        if (!currentReasoningEl.querySelector('.reasoning-content')) {
          currentReasoningEl.innerHTML = '<details open><summary>Thinking...</summary><div class="reasoning-content"></div></details>';
        }
        currentReasoningEl.querySelector('.reasoning-content').textContent = currentRawReasoning;
      } else if (evt.streamType === 'text') {
        currentRawContent += evt.text;
        currentContentEl.textContent = currentRawContent;
      }
      scrollToBottom();
      break;
    }

    case 'tool_start': {
      if (currentMsgEl) {
        if (currentRawContent) {
           currentContentEl.innerHTML = renderMarkdown(currentRawContent);
        }
        currentMsgEl = null; // Finalize current stream bubble before tools run
      }
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
