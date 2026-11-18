// ---------------------------------------------------------------------------
// The agent loop.
//
// One run = one instruction, executed as a sequence of model turns and tool
// calls. The runner owns verification (never trust a model's claim), the
// checkpoint journal (so a bad run is reversible), progress guards (so a weak
// model cannot spin forever) and the honest final status.
// ---------------------------------------------------------------------------

import { LIMITS, MEMORY_SECTIONS } from '../config.js';
import { repo } from '../core/repo.js';
import { RunJournal } from '../core/vault.js';
import { truncate, truncateMiddle, approxTokens, timeAgo } from '../core/util.js';
import { pickModel } from '../core/models.js';
import { executeTool, toolSchemas, TOOL_MAP } from './tools.js';
import { parseModelTurn, looksLikeWorkClaim, summarizeTurn } from './parse.js';
import { buildSystemPrompt } from './prompt.js';
import { LLMGateway } from './llm.js';

const NUDGE_PROTOCOL = `Your last reply did not contain a tool call. Reply with exactly one JSON object like:
{"thought": "…", "tool": "list_dir", "args": {"path": ""}}
Do not answer in prose. The task is not finished until you call finish.`;

export class AgentRunner {
  constructor({ project, fs, settings, registry = [], prefs = {}, apiKey = '', history = [], onEvent = () => {} }) {
    this.project = project;
    this.fs = fs;
    this.settings = settings || {};
    this.registry = registry;
    this.prefs = prefs;
    this.gateway = new LLMGateway({ apiKey });
    this.history = history.slice(-LIMITS.recentMessages);
    this.onEvent = onEvent;

    this.running = false;
    this.abort = null;
    this.run = null;
    this.tasks = [];
    this.memory = {};
    this.journal = null;
    this.modelUsed = '';
    this._heartbeat = null;
  }

  emit(event) {
    try { this.onEvent(event); } catch (err) { console.error('runner event handler failed', err); }
  }

  get isRunning() {
    return this.running;
  }

  stop() {
    if (this.abort) this.abort.abort();
    this.emit({ type: 'status', status: 'stopping', message: 'Stopping…' });
  }

  // -------------------------------------------------------------------------
  // public entry point
  // -------------------------------------------------------------------------

  async start(instruction, { recovery = '', role = 'code', preferredModel = '' } = {}) {
    if (this.running) throw new Error('A task is already running.');
    if (!this.gateway.ready) {
      throw new Error('Add your OpenRouter API key in Settings first — the agent cannot think without a model.');
    }

    const chosen = pickModel(this.registry, this.prefs, this.settings, { role, preferred: preferredModel });
    const modelIds = [chosen.primary, ...chosen.fallbacks].filter(Boolean);
    if (!modelIds.length) throw new Error('No model is available. Enable one on the Models screen.');

    this.running = true;
    this.abort = new AbortController();
    const startedAt = Date.now();

    let run;
    try {
      run = await repo.createRun({ projectId: this.project.id, instruction, model: chosen.primary });
    } catch (err) {
      this.running = false;
      this.abort = null;
      throw err;
    }

    this.run = run;
    this.emit({ type: 'run', run });

    const journal = new RunJournal(this.fs, {
      runId: run.id,
      projectId: this.project.id,
      label: truncate(instruction, 90),
    });
    this.journal = journal;

    let step = 0;
    let tokensIn = 0;
    let tokensOut = 0;
    let mutations = 0;
    let final = null;

    this._heartbeat = setInterval(() => {
      repo.heartbeatRun(run.id, { step_count: step }).catch(() => {});
    }, LIMITS.heartbeatMs);

    try {
      await journal.begin();
      await repo.saveCheckpointMeta({
        id: run.id,
        project_id: this.project.id,
        run_id: run.id,
        label: truncate(instruction, 90),
        file_count: journal.entries.size,
        byte_count: journal.bytes,
      }).catch(() => {});

      this.tasks = await repo.listTasks(this.project.id).catch(() => []);
      this.memory = await repo.getMemory(this.project.id).catch(() => ({}));

      const files = await this.fs.list();
      const nativeTools = Boolean(chosen.model?.supports_tools);

      const buildPrompt = () => buildSystemPrompt({
        project: this.project,
        memory: this.memory,
        tasks: this.tasks,
        files,
        nativeTools,
        today: new Date().toDateString(),
      });

      const messages = [{ role: 'system', content: buildPrompt() }];
      for (const message of this.history) {
        if (!message.content) continue;
        messages.push({ role: message.role, content: truncate(message.content, 2500) });
      }

      const userBlock = [
        instruction,
        recovery ? `\n\n---\n${recovery}` : '',
      ].join('');
      messages.push({ role: 'user', content: userBlock });

      const ctx = {
        fs: this.fs,
        projectId: this.project.id,
        journal,
        settings: this.settings,
        applyPlanOps: (ops) => this.applyPlanOps(ops),
        applyMemory: (section, content, mode) => this.applyMemory(section, content, mode),
      };

      const tools = nativeTools ? toolSchemas() : null;
      let nudges = 0;
      let lastSignature = '';
      let repeats = 0;
      let consecutiveToolFailures = 0;

      while (step < (this.settings.maxSteps || LIMITS.maxSteps)) {
        if (this.abort.signal.aborted) {
          final = { status: 'cancelled', summary: 'Stopped by you before the task finished.' };
          break;
        }
        if (Date.now() - startedAt > LIMITS.runSeconds * 1000) {
          final = { status: 'interrupted', summary: 'Run hit the time limit before finishing. The work so far is checkpointed.' };
          break;
        }

        step += 1;
        this.emit({
          type: 'status',
          status: 'thinking',
          message: `Step ${step}: asking ${this.modelUsed || chosen.primary}`,
          step,
        });

        // Keep the system prompt current: plan and memory may have changed.
        if (step % 3 === 0) {
          this.tasks = await repo.listTasks(this.project.id).catch(() => this.tasks);
          this.memory = await repo.getMemory(this.project.id).catch(() => this.memory);
          messages[0] = { role: 'system', content: buildPrompt() };
        }

        this._trim(messages);

        let turn;
        try {
          turn = await this.gateway.completeWithFallback({
            models: modelIds,
            messages,
            tools,
            temperature: Number(this.settings.temperature ?? 0.2),
            maxTokens: 4096,
            signal: this.abort.signal,
            retries: LIMITS.retriesPerModel,
            onModelChange: (nextModel, err) => {
              this.modelUsed = nextModel;
              this.emit({
                type: 'notice',
                message: `Switched to ${nextModel} — ${truncate(err?.message || 'previous model failed', 160)}`,
              });
            },
          });
        } catch (err) {
          if (err?.name === 'AbortError') {
            final = { status: 'cancelled', summary: 'Stopped by you before the task finished.' };
            break;
          }
          final = {
            status: 'failed',
            summary: `The model could not continue: ${err.message}`,
            error: err.message,
          };
          break;
        }

        this.modelUsed = turn.model || this.modelUsed || chosen.primary;
        tokensIn += turn.usage?.in || 0;
        tokensOut += turn.usage?.out || 0;

        const parsed = parseModelTurn({ content: turn.content, toolCalls: turn.toolCalls });

        if (parsed.thought) {
          this.emit({ type: 'thought', text: parsed.thought });
          await repo.addStep({
            runId: run.id, projectId: this.project.id, seq: step * 10,
            type: 'thought', name: '', ok: true, input: null,
            output: { thought: truncate(parsed.thought, 800) },
          });
        }

        if (!parsed.calls.length) {
          const text = parsed.text;
          if (!text) {
            nudges += 1;
            if (nudges <= 2) {
              messages.push({ role: 'user', content: 'Your reply was empty. Continue with one tool call, or call finish if the task is done.' });
              continue;
            }
            final = { status: 'failed', summary: 'The model kept returning empty replies.' };
            break;
          }
          if (nudges < 2 && mutations === 0) {
            nudges += 1;
            messages.push({ role: 'assistant', content: text.slice(0, 1200) });
            messages.push({ role: 'user', content: NUDGE_PROTOCOL });
            this.emit({ type: 'notice', message: 'Asked the model for a tool call instead of prose.' });
            continue;
          }
          final = {
            status: looksLikeWorkClaim(text) ? 'unverified' : 'completed',
            summary: looksLikeWorkClaim(text)
              ? `The model described changes but made no verified file edits.\n\n${truncate(text, 2000)}`
              : truncate(text, 2000),
            prose: true,
          };
          break;
        }

        // Record the assistant turn in the same dialect the model used, so the
        // conversation stays valid across native and JSON-protocol models.
        const nativeCalls = parsed.calls.filter((call) => call.native);
        if (nativeCalls.length) {
          const toolCalls = nativeCalls.map((call, index) => {
            call.id = call.id || `call_${run.id.slice(0, 8)}_${step}_${index}`;
            return {
              id: call.id,
              type: 'function',
              function: { name: call.name, arguments: JSON.stringify(call.args || {}) },
            };
          });
          messages.push({ role: 'assistant', content: turn.content || '', tool_calls: toolCalls });
        } else {
          const first = parsed.calls[0];
          messages.push({
            role: 'assistant',
            content: JSON.stringify({ thought: parsed.thought || '', tool: first.name, args: first.args || {} }),
          });
        }

        let stop = false;
        const batch = parsed.calls.slice(0, 5);
        for (const call of batch) {
          const signature = `${call.name}:${JSON.stringify(call.args || {})}`.slice(0, 400);
          if (signature === lastSignature) repeats += 1;
          else { repeats = 0; lastSignature = signature; }

          const t0 = performance.now();
          const outcome = await executeTool(call, ctx);
          const durationMs = performance.now() - t0;

          const ok = outcome.ok;
          if (ok && outcome.mutating) mutations += 1;
          if (!ok) consecutiveToolFailures += 1;
          else consecutiveToolFailures = 0;

          const payload = ok ? outcome.result : { error: outcome.error };
          const serialized = JSON.stringify(payload ?? {});
          const stepEntry = {
            seq: step * 10 + parsed.calls.indexOf(call) + 1,
            type: 'tool',
            name: call.name,
            ok,
            durationMs,
            input: call.args || {},
            output: serialized.slice(0, LIMITS.maxToolOutput),
          };
          this.emit({ type: 'step', step: stepEntry });
          await repo.addStep({
            runId: run.id,
            projectId: this.project.id,
            seq: stepEntry.seq,
            type: 'tool',
            name: call.name,
            ok,
            durationMs,
            input: stepEntry.input,
            output: { summary: truncate(serialized, 1200) },
          });

          if (outcome.finished) {
            final = {
              status: outcome.result.status,
              summary: outcome.result.summary,
              nextSteps: outcome.result.next_steps,
            };
            stop = true;
            break;
          }

          if (outcome.blocked) {
            final = {
              status: 'blocked',
              summary: outcome.result.question,
              question: outcome.result.question,
              options: outcome.result.options || [],
            };
            stop = true;
            break;
          }

          const toolText = truncate(serialized, LIMITS.maxToolOutput);
          if (call.native && call.id) {
            messages.push({ role: 'tool', tool_call_id: call.id, content: toolText });
          } else {
            messages.push({ role: 'user', content: `TOOL RESULT ${call.name}: ${toolText}` });
          }
        }

        // Native tool calls must all be answered or the next request is invalid.
        if (!stop) {
          for (const call of parsed.calls.slice(5)) {
            if (call.native && call.id) {
              messages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: '{"skipped":true,"reason":"more than 5 tool calls in one turn"}',
              });
            }
          }
        }

        if (stop) break;

        if (repeats >= 2) {
          messages.push({
            role: 'user',
            content: 'You are repeating the same call with the same arguments. Look at the last result, choose a different action, or call finish with an honest summary.',
          });
          repeats = 0;
          this.emit({ type: 'notice', message: 'Nudged the model — it was repeating itself.' });
        } else if (consecutiveToolFailures >= 3) {
          messages.push({
            role: 'user',
            content: 'Three tool calls in a row failed. Re-read the relevant files, fix the root cause, or call finish with status "blocked" explaining what is stopping you.',
          });
          consecutiveToolFailures = 0;
        }

        await repo.heartbeatRun(run.id, { step_count: step }).catch(() => {});
      }

      if (!final) {
        final = {
          status: 'interrupted',
          summary: `Reached the ${this.settings.maxSteps || LIMITS.maxSteps}-step limit. The work so far is checkpointed; send a follow-up to continue.`,
        };
      }
    } catch (err) {
      console.error('agent run crashed', err);
      final = {
        status: 'failed',
        summary: `The run stopped unexpectedly: ${err.message}`,
        error: err.message,
      };
    } finally {
      clearInterval(this._heartbeat);
      this._heartbeat = null;
      await this._finalize(final || { status: 'failed', summary: 'The run ended without a result.' }, {
        run, step, tokensIn, tokensOut, mutations, startedAt,
      });
      this.running = false;
      this.abort = null;
    }

    return this.run;
  }

  // -------------------------------------------------------------------------
  // model-facing side effects
  // -------------------------------------------------------------------------

  async applyPlanOps(ops) {
    const applied = [];
    const current = await repo.listTasks(this.project.id).catch(() => this.tasks);
    const byId = new Map(current.map((task) => [task.id, task]));

    for (const op of ops) {
      const kind = String(op.op || '').toLowerCase();
      try {
        if (kind === 'add') {
          if (!op.title) { applied.push({ op: 'add', ok: false, error: 'title is required' }); continue; }
          const task = await repo.addTask(this.project.id, {
            title: op.title,
            detail: op.detail || '',
            phase: op.phase || 'General',
            status: op.status || 'todo',
          });
          byId.set(task.id, task);
          applied.push({ op: 'add', ok: true, id: task.id, title: task.title });
          continue;
        }
        const task = op.id ? byId.get(op.id) : null;
        if (!task) { applied.push({ op: kind, ok: false, error: `Unknown task id ${op.id}` }); continue; }

        if (kind === 'update') {
          const patch = {};
          if (op.title) patch.title = op.title;
          if (op.detail !== undefined) patch.detail = op.detail;
          if (op.phase) patch.phase = op.phase;
          if (op.status) patch.status = op.status;
          const updated = await repo.updateTask(task.id, patch);
          byId.set(updated.id, updated);
          applied.push({ op: 'update', ok: true, id: updated.id, title: updated.title, status: updated.status });
        } else if (kind === 'done') {
          const updated = await repo.updateTask(task.id, { status: 'done' });
          byId.set(updated.id, updated);
          applied.push({ op: 'done', ok: true, id: updated.id, title: updated.title });
        } else if (kind === 'block') {
          const updated = await repo.updateTask(task.id, {
            status: 'blocked',
            blocked_reason: op.detail || 'blocked',
          });
          byId.set(updated.id, updated);
          applied.push({ op: 'block', ok: true, id: updated.id, title: updated.title });
        } else if (kind === 'remove') {
          await repo.deleteTask(task.id);
          byId.delete(task.id);
          applied.push({ op: 'remove', ok: true, id: task.id });
        } else {
          applied.push({ op: kind, ok: false, error: 'unknown op' });
        }
      } catch (err) {
        applied.push({ op: kind, ok: false, error: err.message });
      }
    }

    this.tasks = [...byId.values()];
    this.emit({ type: 'plan', tasks: this.tasks });
    return { applied, tasks: this.tasks.length };
  }

  async applyMemory(section, content, mode) {
    const key = String(section || '').toLowerCase().replace(/\s+/g, '_');
    if (!MEMORY_SECTIONS.some((entry) => entry.key === key)) {
      return { ok: false, error: `Unknown section "${section}". Use one of: ${MEMORY_SECTIONS.map((s) => s.key).join(', ')}.` };
    }
    const existing = this.memory[key]?.content || '';
    const next = mode === 'append' && existing
      ? `${existing.trim()}\n\n${content.trim()}`
      : content.trim();
    await repo.setMemory(this.project.id, key, next, 'ai');
    this.memory = { ...this.memory, [key]: { section: key, content: next } };
    this.emit({ type: 'memory', memory: this.memory });
    return { ok: true, section: key, mode, saved: true, characters: next.length };
  }

  // -------------------------------------------------------------------------
  // internals
  // -------------------------------------------------------------------------

  _trim(messages) {
    const budget = LIMITS.maxContextChars;
    const size = messages.reduce((sum, message) => sum + (message.content?.length || 0), 0);
    if (size <= budget) return;

    // 1. shrink long tool output
    for (const message of messages) {
      if (typeof message.content === 'string' && message.content.length > 1800 && message.role !== 'system') {
        message.content = truncateMiddle(message.content, 1800);
      }
    }
    let total = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
    if (total <= budget) return;

    // 2. drop the oldest turns, never the system prompt
    while (total > budget && messages.length > 3) {
      messages.splice(1, 2);
      while (messages.length > 2 && messages[1]?.role !== 'user') messages.splice(1, 1);
      total = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
      if (messages.length <= 3) break;
    }
  }

  async _finalize(final, { run, step, tokensIn, tokensOut, mutations, startedAt }) {
    const durationMs = Date.now() - startedAt;
    let status = final.status || 'completed';
    if (status === 'completed' && mutations === 0 && final.prose) status = final.status;

    const summary = truncate(final.summary || '', 4000);

    await repo.updateRun(run.id, {
      status,
      summary,
      error: truncate(final.error || '', 2000),
      step_count: step,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      finished_at: new Date().toISOString(),
    });

    const message = await repo.addMessage({
      projectId: this.project.id,
      role: 'assistant',
      kind: status === 'blocked' ? 'question' : 'outcome',
      content: summary,
      runId: run.id,
      meta: {
        status,
        model: this.modelUsed || run.model,
        steps: step,
        mutations,
        durationMs,
        question: final.question || '',
        options: final.options || [],
        nextSteps: final.nextSteps || [],
        tokensIn,
        tokensOut,
        checkpointId: run.id,
      },
    }).catch(() => null);

    try {
      const stats = await this.fs.stats();
      await repo.updateProject(this.project.id, {
        file_count: stats.files,
        byte_count: stats.bytes,
        last_opened_at: new Date().toISOString(),
      });
      const files = await this.fs.list();
      await repo.saveFileIndex(this.project.id, files);
    } catch (err) {
      console.warn('post-run project bookkeeping failed', err);
    }

    await this.fs.vault.pruneCheckpoints(14).catch(() => {});

    this.run = { ...run, status, summary };
    this.emit({
      type: 'done',
      run: this.run,
      message,
      summary,
      status,
      mutations,
      steps: step,
      durationMs,
    });
  }
}

// ---------------------------------------------------------------------------
// helpers used by the UI
// ---------------------------------------------------------------------------

export function buildChatHistory(messages, limit = LIMITS.recentMessages) {
  return messages
    .filter((message) => message.role !== 'system' && message.content)
    .filter((message) => message.kind === 'chat' || message.kind === 'outcome' || message.kind === 'question')
    .slice(-limit)
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.kind === 'outcome'
        ? `[previous task ${message.meta?.status || 'finished'}] ${message.content}`
        : message.content,
    }));
}

export function runTimelineLine(run) {
  const bits = [`${run.status}`];
  if (run.step_count) bits.push(`${run.step_count} steps`);
  if (run.model) bits.push(run.model);
  return bits.join(' · ');
}

export function describeElapsed(startedAt) {
  return timeAgo(startedAt);
}

export { summarizeTurn, approxTokens, TOOL_MAP };
