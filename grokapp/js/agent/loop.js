/**
 * Application-owned agent execution loop.
 *
 * - Models are replaceable workers.
 * - Tool calls are executed and verified by the app.
 * - Progress is checkpointed.
 * - Failed tools are retried once.
 * - Handles malformed responses, missing tool support, and interruptions.
 */
import { loadConfig } from '../config.js';
import { TOOL_DEFS, executeTool, setProjectContext } from './tools.js';
import * as fs from '../files/fs-adapter.js';
import { appendMessage, saveCheckpoint, clearCheckpoint } from '../projects/store.js';

const MAX_STEPS = 24;
const OR_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * @param {object} opts
 * @param {string} opts.projectId
 * @param {object} opts.project
 * @param {string} opts.userMessage
 * @param {string} [opts.model]
 * @param {(event: object) => void} opts.onEvent
 * @param {(project: object) => void} [opts.onProjectUpdate]
 * @param {AbortSignal} [opts.signal]
 */
export async function runAgent({
  projectId,
  project,
  userMessage,
  model,
  onEvent = () => {},
  onProjectUpdate,
  signal,
}) {
  const cfg = loadConfig();
  if (!cfg.openRouterKey) {
    throw new Error('OpenRouter API key is missing. Add it in Settings.');
  }

  const selectedModel = model || cfg.defaultModel || 'openrouter/free';

  // Inject project context for memory/roadmap tools
  setProjectContext({
    projectId,
    project,
    onProjectPatch: (p) => {
      project = p;
      onProjectUpdate?.(p);
    },
  });

  const tree = fs.getTreeSummary(3);
  const memory = project.memory || {};
  const roadmapSummary = summarizeRoadmap(project.roadmap);
  const fileCount = fs.listAllFiles().length;

  const systemPrompt = buildSystemPrompt({
    projectName: project.name,
    description: project.description,
    memory,
    roadmapSummary,
    tree,
    fileCount,
  });

  /** @type {Array<object>} */
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  await appendMessage(projectId, { role: 'user', content: userMessage });

  let step = 0;
  let finalText = '';
  const activity = [];

  const emit = (type, payload = {}) => {
    const ev = { type, step, ts: Date.now(), ...payload };
    activity.push(ev);
    onEvent(ev);
  };

  emit('start', { model: selectedModel });

  try {
    while (step < MAX_STEPS) {
      if (signal?.aborted) {
        emit('aborted');
        await saveCheckpoint(projectId, {
          reason: 'aborted',
          step,
          messages: messages.slice(-12),
          activity: activity.slice(-20),
        });
        break;
      }

      step += 1;
      emit('model_request', { model: selectedModel });

      const body = {
        model: selectedModel,
        messages,
        tools: TOOL_DEFS,
        tool_choice: 'auto',
        temperature: 0.2,
        max_tokens: 4096,
      };

      let data;
      try {
        data = await callOpenRouter(cfg.openRouterKey, body, signal);
      } catch (err) {
        if (String(err.message).toLowerCase().includes('tool')) {
          emit('fallback_no_tools');
          delete body.tools;
          delete body.tool_choice;
          data = await callOpenRouter(cfg.openRouterKey, body, signal);
        } else {
          throw err;
        }
      }

      const choice = data.choices?.[0];
      if (!choice) {
        emit('error', { message: 'Empty model response' });
        break;
      }

      const msg = choice.message || {};
      const finish = choice.finish_reason;

      if (msg.content) {
        finalText = msg.content;
        messages.push({ role: 'assistant', content: msg.content });
        emit('assistant_text', { text: msg.content.slice(0, 400) });
      }

      const toolCalls = msg.tool_calls || [];
      if (toolCalls.length === 0) {
        emit('done', { finish });
        break;
      }

      messages.push({
        role: 'assistant',
        content: msg.content || null,
        tool_calls: toolCalls,
      });

      for (const tc of toolCalls) {
        const name = tc.function?.name;
        let args = {};
        try {
          args = JSON.parse(tc.function?.arguments || '{}');
        } catch {
          args = {};
        }

        emit('tool_start', { name, args: summarizeArgs(args) });

        let result = await executeTool(name, args);

        // Retry once on failure (common with flaky free models / transient FS issues)
        if (!result.ok) {
          emit('tool_retry', { name, error: result.error });
          result = await executeTool(name, args);
        }

        emit(result.ok ? 'tool_success' : 'tool_error', {
          name,
          result: result.ok ? summarizeResult(result.result) : result.error,
        });

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          name,
          content: JSON.stringify(result),
        });
      }

      await saveCheckpoint(projectId, {
        reason: 'in_progress',
        step,
        lastTools: toolCalls.map((t) => t.function?.name),
        activity: activity.slice(-20),
      });
    }

    if (finalText) {
      await appendMessage(projectId, {
        role: 'assistant',
        content: finalText,
        meta: { model: selectedModel, steps: step },
      });
    }

    await clearCheckpoint(projectId);
    emit('complete', { steps: step });
    return { text: finalText, steps: step, activity, project };
  } catch (err) {
    emit('error', { message: err.message });
    await saveCheckpoint(projectId, {
      reason: 'error',
      step,
      error: err.message,
      activity: activity.slice(-20),
    });
    throw err;
  } finally {
    setProjectContext(null);
  }
}

async function callOpenRouter(apiKey, body, signal) {
  const res = await fetch(OR_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': location.origin,
      'X-Title': 'DevSpace',
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

function buildSystemPrompt({ projectName, description, memory, roadmapSummary, tree, fileCount }) {
  const memParts = [];
  if (memory.purpose) memParts.push(`Purpose: ${memory.purpose}`);
  if (memory.architecture) memParts.push(`Architecture: ${memory.architecture}`);
  if (memory.constraints?.length) memParts.push(`Constraints: ${memory.constraints.join('; ')}`);
  if (memory.known_issues?.length) memParts.push(`Known issues: ${memory.known_issues.join('; ')}`);
  if (memory.next_steps?.length) memParts.push(`Next steps: ${memory.next_steps.join('; ')}`);
  if (memory.notes) memParts.push(`Notes: ${memory.notes}`);

  return `You are an AI software engineer inside DevSpace, a persistent development workspace.

Project: ${projectName || 'Untitled'}
${description ? `Description: ${description}` : ''}
Files in workspace: ${fileCount}

${memParts.length ? 'Project memory:\n' + memParts.join('\n') : 'Project memory: (empty — update it when you learn something durable)'}

${roadmapSummary ? 'Roadmap status:\n' + roadmapSummary : 'Roadmap: (empty — create one for multi-step work)'}

Current project tree:
${tree}

Rules:
- Prefer tools to inspect and modify real files; do not only describe changes.
- After write/edit, trust the verified tool result.
- Prefer edit_file for small surgical changes; write_file for new files or full rewrites.
- If unsure about a file, read it first. Source files are the source of truth over memory.
- Use update_memory when you learn durable facts (purpose, architecture, constraints, issues, next steps).
- Use update_roadmap for multi-step work; keep task statuses accurate (pending | in_progress | done | blocked | failed).
- Do not invent files. Use list_files / get_project_tree / search_files when needed.
- Avoid deleting important files unless the user clearly asked; never delete the project root.
- When finished, give a concise summary of what changed and any remaining risks.`;
}

function summarizeRoadmap(roadmap) {
  if (!roadmap?.phases?.length) return '';
  const lines = [];
  for (const phase of roadmap.phases) {
    lines.push(`## ${phase.title || 'Phase'}`);
    for (const t of phase.tasks || []) {
      lines.push(`- [${t.status || 'pending'}] ${t.title}`);
    }
  }
  return lines.join('\n');
}

function summarizeArgs(args) {
  const copy = { ...args };
  if (copy.content && copy.content.length > 80) copy.content = copy.content.slice(0, 80) + '…';
  if (copy.old_string && copy.old_string.length > 60) copy.old_string = copy.old_string.slice(0, 60) + '…';
  if (copy.new_string && copy.new_string.length > 60) copy.new_string = copy.new_string.slice(0, 60) + '…';
  if (copy.phases) copy.phases = `[${copy.phases.length} phases]`;
  return copy;
}

function summarizeResult(result) {
  if (typeof result === 'string') {
    return result.length > 200 ? result.slice(0, 200) + '…' : result;
  }
  try {
    const s = JSON.stringify(result);
    return s.length > 200 ? s.slice(0, 200) + '…' : s;
  } catch {
    return String(result);
  }
}
