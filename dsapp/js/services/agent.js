import { AGENT_LIMITS } from '../config.js';
import { getToolDefinitions, executeTool } from './tools.js';
import { callModelWithReliability, modelSupportsTools } from './models.js';
import { updateTask, logOperation, setAppState, addMemory, addMessage } from './db.js';
import { state } from '../state.js';
import { truncate } from './context.js';

function extractJson(text) {
  const s = String(text || '').trim();
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1].trim() : s;
  try { return JSON.parse(body); } catch { /* fall through */ }
  const first = body.indexOf('{');
  const last = body.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(body.slice(first, last + 1)); } catch { /* ignore */ }
  }
  return null;
}

function parseProtocol(text) {
  const json = extractJson(text);
  if (!json || typeof json !== 'object') return null;
  if (json.type === 'final') return { final: String(json.content ?? '') };
  if (json.type === 'tool' && json.tool) return { tool: String(json.tool), args: json.args || {} };
  if (json.tool && !json.final) return { tool: String(json.tool), args: json.args || {} };
  return null;
}

export async function runAgent({ project, fs, task, initialMessages, onEvent, signal }) {
  const tools = getToolDefinitions();
  const nativeTools = modelSupportsTools(task.model, state.models);
  const messages = [...initialMessages];
  const seen = new Map();
  let iteration = 0;
  let finalText = '';

  await setAppState(project.id, {
    current_task_id: task.id,
    state: { status: 'running' },
  }).catch(() => {});

  try {
    while (iteration < AGENT_LIMITS.maxIterations) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      onEvent({ type: 'status', status: 'thinking', iteration: iteration + 1 });

      const response = await callModelWithReliability({
        modelId: task.model,
        messages,
        tools: nativeTools ? tools : null,
        models: state.models,
        prefs: state.modelPrefs,
        signal,
        useJsonProtocol: !nativeTools,
        onStream: (streamEvt) => {
          onEvent({ type: 'stream', streamType: streamEvt.type, text: streamEvt.text });
        }
      });

      if (nativeTools) messages.push(response.message);
      else messages.push({ role: 'assistant', content: response.content });

      // Save intermediate assistant thoughts to DB so they aren't lost on refresh
      if (response.content) {
        await addMessage(project.id, { role: 'assistant', content: response.content }).catch(() => {});
      }

      let toolCalls = response.toolCalls || [];

      if (!nativeTools) {
        const parsed = parseProtocol(response.content);
        if (parsed?.final !== undefined) { finalText = parsed.final; break; }
        if (parsed?.tool) {
          toolCalls = [{ id: `json-${iteration}`, name: parsed.tool, arguments: parsed.args }];
        }
      }

      if (!toolCalls.length) { finalText = response.content || ''; break; }

      onEvent({ type: 'status', status: 'executing_tools', count: toolCalls.length });

      for (const call of toolCalls) {
        if (!call.name) continue;
        const key = `${call.name}:${JSON.stringify(call.arguments || {})}`;
        const count = (seen.get(key) || 0) + 1;
        seen.set(key, count);

        if (count > 3) {
          messages.push({
            role: 'system',
            content:
              `You have called ${call.name} with identical arguments ${count} times. ` +
              `Stop repeating it and try a different approach or finish.`,
          });
          continue;
        }

        onEvent({ type: 'tool_start', call });
        let result;
        try {
          result = await executeTool(call.name, call.arguments, { project, fs, task, onEvent });
        } catch (err) {
          result = { ok: false, error: String(err?.message || err) };
        }

        if (result.awaiting_user) {
          onEvent({ type: 'awaiting_user', question: result.question, call, result });
          await updateTask(task.id, {
            status: 'blocked',
            result_summary: `Awaiting user: ${result.question}`,
          }).catch(() => {});
          await setAppState(project.id, {
            current_task_id: null,
            state: { status: 'awaiting_user', question: result.question },
          }).catch(() => {});
          return {
            content: `**Waiting for your input**\n\n${result.question}`,
            messages,
            awaitingUser: true,
          };
        }

        onEvent({ type: 'tool_end', call, result });

        const serialized = truncate(JSON.stringify(result), AGENT_LIMITS.maxToolResultChars);
        if (nativeTools) {
          messages.push({ role: 'tool', tool_call_id: call.id, content: serialized });
        } else {
          messages.push({ role: 'user', content: `TOOL_RESULT ${serialized}` });
        }

        await logOperation(project.id, {
          taskId: task.id,
          toolName: call.name,
          args: call.arguments || {},
          result,
          status: result.ok ? 'success' : 'error',
        }).catch(() => {});
      }

      iteration++;
    }

    if (!finalText) finalText = 'Task reached the iteration limit without a final answer.';
    await updateTask(task.id, { status: 'completed', result_summary: truncate(finalText, 4000) });
    await setAppState(project.id, {
      current_task_id: null,
      state: { status: 'idle' },
    }).catch(() => {});
    await addMemory(project.id, {
      kind: 'task_log',
      content: `Task: ${task.title}\nResult: ${truncate(finalText, 2000)}`,
      importance: 2,
    }).catch(() => {});

    return { content: finalText, messages };
  } catch (err) {
    if (err.name === 'AbortError') {
      await updateTask(task.id, { status: 'interrupted', result_summary: 'Aborted by user' }).catch(() => {});
      await setAppState(project.id, {
        current_task_id: null,
        state: { status: 'interrupted' },
      }).catch(() => {});
      throw err;
    }
    await updateTask(task.id, { status: 'failed', result_summary: String(err?.message || err) }).catch(() => {});
    await setAppState(project.id, {
      current_task_id: null,
      state: { status: 'failed', error: String(err) },
    }).catch(() => {});
    throw err;
  }
}
