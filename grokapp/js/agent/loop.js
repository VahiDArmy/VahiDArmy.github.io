/**
 * Application-owned agent execution loop.
 *
 * - Models are replaceable workers.
 * - Tool calls are executed and verified by the app.
 * - Progress is checkpointed.
 * - Handles malformed responses, missing tool support, and interruptions.
 */
import { loadConfig } from '../config.js';
import { TOOL_DEFS, executeTool } from './tools.js';
import * as fs from '../files/fs-adapter.js';
import { appendMessage, saveCheckpoint, clearCheckpoint } from '../projects/store.js';

const MAX_STEPS = 24;
const OR_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * @param {object} opts
 * @param {string} opts.projectId
 * @param {object} opts.project   full project row (memory, roadmap, …)
 * @param {string} opts.userMessage
 * @param {string} [opts.model]
 * @param {(event: object) => void} opts.onEvent  UI / activity callback
 * @param {AbortSignal} [opts.signal]
 */
export async function runAgent({
  projectId,
  project,
  userMessage,
  model,
  onEvent = () => {},
  signal,
}) {
  const cfg = loadConfig();
  if (!cfg.openRouterKey) {
    throw new Error('OpenRouter API key is missing. Add it in Settings.');
  }

  const selectedModel = model || cfg.defaultModel || 'openrouter/free';

  // Build system context
  const tree = fs.getTreeSummary(3);
  const memory = project.memory || {};
  const roadmapSummary = summarizeRoadmap(project.roadmap);

  const systemPrompt = buildSystemPrompt({
    projectName: project.name,
    description: project.description,
    memory,
    roadmapSummary,
    tree,
  });

  /** @type {Array<{role:string, content?:string, tool_calls?:any, tool_call_id?:string, name?:string}>} */
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  // Persist user message
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
          activity,
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
        // Retry once without tools if the model rejects tools
        if (String(err.message).includes('tools') || String(err.message).includes('tool')) {
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

      // Assistant text
      if (msg.content) {
        finalText = msg.content;
        messages.push({ role: 'assistant', content: msg.content });
        emit('assistant_text', { text: msg.content.slice(0, 400) });
      }

      // Tool calls
      const toolCalls = msg.tool_calls || [];
      if (toolCalls.length === 0) {
        // Done (or model can't use tools and just answered)
        emit('done', { finish });
        break;
      }

      // Keep the assistant message that requested tools
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

        const result = await executeTool(name, args);

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

      // Checkpoint after a batch of tools
      await saveCheckpoint(projectId, {
        reason: 'in_progress',
        step,
        lastTools: toolCalls.map(t => t.function?.name),
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
    return { text: finalText, steps: step, activity };
  } catch (err) {
    emit('error', { message: err.message });
    await saveCheckpoint(projectId, {
      reason: 'error',
      step,
      error: err.message,
      activity: activity.slice(-20),
    });
    throw err;
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

function buildSystemPrompt({ projectName, description, memory, roadmapSummary, tree }) {
  const memParts = [];
  if (memory.purpose) memParts.push(`Purpose: ${memory.purpose}`);
  if (memory.architecture) memParts.push(`Architecture: ${memory.architecture}`);
  if (memory.constraints?.length) memParts.push(`Constraints: ${memory.constraints.join('; ')}`);
  if (memory.known_issues?.length) memParts.push(`Known issues: ${memory.known_issues.join('; ')}`);

  return `You are an AI software engineer working inside DevSpace, a persistent development workspace.

Project: ${projectName || 'Untitled'}
${description ? `Description: ${description}` : ''}

${memParts.length ? 'Project memory:\n' + memParts.join('\n') : ''}

${roadmapSummary ? 'Roadmap status:\n' + roadmapSummary : ''}

Current project tree:
${tree}

Rules:
- Prefer using tools to inspect and modify real files rather than only describing changes.
- After writing or editing a file, the application verifies the write. Trust the tool result, not assumptions.
- Keep changes focused. Prefer edit_file for small surgical changes.
- If you are unsure about the current state of a file, read it first.
- When the task is complete, give a concise summary of what you did and any remaining risks.
- Do not invent files that do not exist. Use list_files / get_project_tree when needed.
- You may update mental notes in your reply, but the source of truth is always the files.`;
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
  if (copy.content && copy.content.length > 80) {
    copy.content = copy.content.slice(0, 80) + '…';
  }
  if (copy.old_string && copy.old_string.length > 60) {
    copy.old_string = copy.old_string.slice(0, 60) + '…';
  }
  if (copy.new_string && copy.new_string.length > 60) {
    copy.new_string = copy.new_string.slice(0, 60) + '…';
  }
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
