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
import { appendMessage, getMessages, saveCheckpoint, clearCheckpoint } from '../projects/store.js';
import { packRelevantContext } from './context.js';
import { pickFallbackModels } from '../models/registry.js';
import { chatCompletion } from './openrouter.js';

const MAX_STEPS = 24;

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

  let selectedModel = model || cfg.defaultModel || 'openrouter/free';
  let fallbackQueue = [];
  let consecutiveModelFailures = 0;

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

  // Smart context: relevant file snippets for this request
  const packed = await packRelevantContext(userMessage, { maxFiles: 6, maxCharsPerFile: 2200 });

  const systemPrompt = buildSystemPrompt({
    projectName: project.name,
    description: project.description,
    memory,
    roadmapSummary,
    tree,
    fileCount,
    relevantFiles: packed.summary,
  });

  // Prior conversation (summarize if long)
  const historyBlock = await buildHistoryContext(projectId);

  /** @type {Array<object>} */
  const messages = [
    { role: 'system', content: systemPrompt + (historyBlock ? '\n\n' + historyBlock : '') },
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
  emit('task_state', { state: 'in_progress', label: 'Working on request' });
  if (packed.files?.length) {
    emit('context_packed', { files: packed.files.map((f) => f.path), tokens: packed.tokens });
  }

  try {
    while (step < MAX_STEPS) {
      if (signal?.aborted) {
        emit('aborted');
        emit('task_state', { state: 'blocked', label: 'Interrupted' });
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

      const streamEnabled = cfg.streamResponses !== false;

      async function requestOnce(reqBody, { allowStream = streamEnabled } = {}) {
        const onDelta = allowStream
          ? (d) => {
              if (d.type === 'content' && d.text) {
                emit('assistant_delta', { text: d.text, content: d.content });
              }
            }
          : undefined;
        try {
          const data = await chatCompletion(cfg.openRouterKey, reqBody, { signal, onDelta });
          const choice = data?.choices?.[0];
          const message = choice?.message || {};
          const empty =
            !message.content &&
            !(Array.isArray(message.tool_calls) && message.tool_calls.length);
          // Weak free models sometimes "succeed" with empty stream bodies
          if (allowStream && empty) {
            emit('stream_fallback', { reason: 'empty_stream' });
            return chatCompletion(cfg.openRouterKey, reqBody, { signal, onDelta: undefined });
          }
          return data;
        } catch (err) {
          if (allowStream) {
            emit('stream_fallback', { reason: err.message });
            return chatCompletion(cfg.openRouterKey, reqBody, { signal, onDelta: undefined });
          }
          throw err;
        }
      }

      let data;
      try {
        data = await requestOnce(body);
        consecutiveModelFailures = 0;
      } catch (err) {
        const msg = String(err.message || '').toLowerCase();
        if (msg.includes('tool')) {
          emit('fallback_no_tools');
          delete body.tools;
          delete body.tool_choice;
          data = await requestOnce(body);
          consecutiveModelFailures = 0;
        } else {
          consecutiveModelFailures += 1;
          if (consecutiveModelFailures >= 1) {
            if (!fallbackQueue.length) {
              try {
                fallbackQueue = await pickFallbackModels(selectedModel, { limit: 4 });
              } catch {
                fallbackQueue = [];
              }
            }
            if (fallbackQueue.length) {
              const next = fallbackQueue.shift();
              emit('model_switch', {
                from: selectedModel,
                to: next,
                reason: err.message,
              });
              selectedModel = next;
              body.model = selectedModel;
              emit('model_request', { model: selectedModel });
              data = await requestOnce(body);
              consecutiveModelFailures = 0;
            } else {
              throw err;
            }
          } else {
            throw err;
          }
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

      const batchApplied = [];
      const batchFailed = [];

      for (const tc of toolCalls) {
        if (signal?.aborted) break;

        const name = tc.function?.name;
        let args = {};
        try {
          args = JSON.parse(tc.function?.arguments || '{}');
        } catch {
          args = {};
        }

        emit('tool_start', { name, args: summarizeArgs(args) });

        let result = await executeTool(name, args);

        // Retry once on failure
        if (!result.ok) {
          emit('tool_retry', { name, error: result.error });
          result = await executeTool(name, args);
        }

        emit(result.ok ? 'tool_success' : 'tool_error', {
          name,
          result: result.ok ? summarizeResult(result.result) : result.error,
        });

        if (result.ok) {
          batchApplied.push({ name, path: result.result?.path, summary: summarizeResult(result.result) });
          // Single-file diff
          if (result.result?.diff) {
            emit('file_diff', {
              path: result.result.path,
              stats: result.result.stats,
              diff: result.result.diff,
            });
          }
          // Batch apply diffs
          if (Array.isArray(result.result?.applied)) {
            for (const item of result.result.applied) {
              if (item.diff) {
                emit('file_diff', { path: item.path, stats: item.stats, diff: item.diff });
              }
            }
            if (result.result.partial) {
              emit('batch_partial', {
                applied: result.result.applied_count,
                failed: result.result.failed_count,
              });
            }
          }
        } else {
          batchFailed.push({ name, error: result.error, args: summarizeArgs(args) });
          // Continue remaining tools — do not unwind successful work
          emit('batch_continue', {
            failed: name,
            error: result.error,
            applied_so_far: batchApplied.length,
          });
        }

        const forModel = trimToolResultForModel(result);

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          name,
          content: JSON.stringify(forModel),
        });
      }

      if (batchFailed.length && batchApplied.length) {
        emit('batch_partial', {
          applied: batchApplied.length,
          failed: batchFailed.length,
        });
        // Help the model recover without redoing successful ops
        messages.push({
          role: 'user',
          content:
            '[system recovery] Some tools in the last batch failed after others succeeded. ' +
            `Already applied (${batchApplied.length}): ${batchApplied.map((x) => x.name + (x.path ? ':' + x.path : '')).join(', ')}. ` +
            `Failed (${batchFailed.length}): ${batchFailed.map((x) => x.name + ' — ' + x.error).join('; ')}. ` +
            'Do not repeat successful operations. Fix or skip the failed ones, then continue.',
        });
      }

      await saveCheckpoint(projectId, {
        reason: batchFailed.length && !batchApplied.length ? 'tool_errors' : 'in_progress',
        step,
        lastTools: toolCalls.map((t) => t.function?.name),
        applied: batchApplied,
        failed: batchFailed,
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
    emit('task_state', { state: 'verified', label: 'Completed' });
    emit('complete', { steps: step });
    return { text: finalText, steps: step, activity, project };
  } catch (err) {
    emit('error', { message: err.message });
    emit('task_state', { state: 'failed', label: err.message });
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


function buildSystemPrompt({ projectName, description, memory, roadmapSummary, tree, fileCount, relevantFiles }) {
  const memParts = [];
  if (memory.purpose) memParts.push(`Purpose: ${memory.purpose}`);
  if (memory.architecture) memParts.push(`Architecture: ${memory.architecture}`);
  if (memory.constraints?.length) memParts.push(`Constraints: ${memory.constraints.join('; ')}`);
  if (memory.known_issues?.length) memParts.push(`Known issues: ${memory.known_issues.join('; ')}`);
  if (memory.next_steps?.length) memParts.push(`Next steps: ${memory.next_steps.join('; ')}`);
  if (memory.notes) memParts.push(`Notes: ${memory.notes}`);

  const relevantBlock = relevantFiles
    ? `\nRelevant file excerpts for this request:\n${relevantFiles}\n`
    : '';

  return `You are an AI software engineer inside DevSpace, a persistent development workspace.

Project: ${projectName || 'Untitled'}
${description ? `Description: ${description}` : ''}
Files in workspace: ${fileCount}

${memParts.length ? 'Project memory:\n' + memParts.join('\n') : 'Project memory: (empty — update it when you learn something durable)'}

${roadmapSummary ? 'Roadmap status:\n' + roadmapSummary : 'Roadmap: (empty — create one for multi-step work)'}

Current project tree:
${tree}
${relevantBlock}
Rules:
- Prefer tools to inspect and modify real files; do not only describe changes.
- After write/edit, trust the verified tool result.
- Prefer edit_file for small surgical changes; write_file for new files or full rewrites.
- When changing several related files, prefer apply_files (one batch, one summary) over many write_file calls.
- If unsure about a file, read it first. Source files are the source of truth over memory.
- Use update_memory when you learn durable facts (purpose, architecture, constraints, issues, next steps).
- Use update_roadmap for multi-step work; keep task statuses accurate (pending | in_progress | done | blocked | failed).
- Do not invent files. Use list_files / get_project_tree / search_files when needed.
- Avoid deleting important files unless the user clearly asked; never delete the project root. Deletes require user confirmation in the UI.
- When finished, give a concise summary of what changed and any remaining risks.`;
}


/**
 * Load recent project messages and compress older ones into a short summary
 * so long threads stay within context limits.
 */
async function buildHistoryContext(projectId) {
  let rows = [];
  try {
    rows = await getMessages(projectId, 60);
  } catch {
    return '';
  }
  // Drop the message we are about to append (caller appends after); keep prior only
  const prior = rows.filter((m) => m.role === 'user' || m.role === 'assistant');
  if (prior.length <= 1) return '';

  const MAX_RECENT = 8;
  const recent = prior.slice(-MAX_RECENT);
  const older = prior.slice(0, Math.max(0, prior.length - MAX_RECENT));

  const parts = [];
  if (older.length) {
    const bullets = older.slice(-12).map((m) => {
      const role = m.role === 'user' ? 'User' : 'Assistant';
      const text = String(m.content || '').replace(/\s+/g, ' ').slice(0, 120);
      return `- ${role}: ${text}`;
    });
    parts.push('Earlier conversation (summarized):\n' + bullets.join('\n'));
  }
  if (recent.length) {
    const lines = recent.map((m) => {
      const role = m.role === 'user' ? 'User' : 'Assistant';
      const text = String(m.content || '').slice(0, 600);
      return `${role}: ${text}`;
    });
    parts.push('Recent messages:\n' + lines.join('\n\n'));
  }
  return parts.join('\n\n');
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

function trimToolResultForModel(result) {
  if (!result?.ok || !result.result) return result;
  const r = { ...result, result: { ...result.result } };
  if (typeof r.result.diff === 'string' && r.result.diff.length > 1500) {
    r.result.diff = r.result.diff.slice(0, 1500) + '\n…(diff truncated for model)';
  }
  if (Array.isArray(r.result.applied)) {
    r.result.applied = r.result.applied.map((item) => ({
      ...item,
      diff: typeof item.diff === 'string' && item.diff.length > 800
        ? item.diff.slice(0, 800) + '\n…'
        : item.diff,
    }));
  }
  return r;
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
