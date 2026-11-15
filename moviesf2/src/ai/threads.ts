/**
 * Thread orchestration: one assistant turn = one archived request = one call.
 *
 * The request snapshot is written before the network call. Partial content is
 * persisted while streaming, so a stopped or failed turn survives a reload and
 * can be resumed from exactly where it died.
 */

import type {
  AiError,
  AiThread,
  AiTurn,
  GenerationParams,
  RequestMessage,
  StreamEvent,
  TokenUsage,
} from '../types';
import { DEFAULT_PARAMS } from '../types';
import { buildRequest, estimateTokens, trimToWindow, usageFromProvider } from './request';
import { streamCompletion, AiTransportError, errorRecord, isAbort } from './client';
import { resolveModel } from './models';
import { getDb, insertRow, logActivity, logUsage, updateRow, upsertRow } from '../data/store';
import { nowIso, truncate, uid } from '../lib/utils';

export function newThread(input: {
  title?: string;
  title_id?: string | null;
  model: string;
  system: string;
  params?: GenerationParams;
  branch_of?: string | null;
}): AiThread {
  return insertRow('cinema_ai_threads', {
    title: input.title || 'Untitled thread',
    title_id: input.title_id ?? null,
    model: input.model,
    system: input.system,
    params: input.params ?? { ...DEFAULT_PARAMS },
    tags: '',
    pinned: false,
    archived: false,
    branch_of: input.branch_of ?? null,
    last_at: nowIso(),
  } as Partial<AiThread>) as AiThread;
}

export function threadTurns(threadId: string): AiTurn[] {
  return getDb()
    .cinema_ai_turns.filter((turn) => turn.thread_id === threadId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function rootToLeaf(turns: AiTurn[], leafId: string | null | undefined): AiTurn[] {
  if (!leafId) return [];
  const byId = new Map(turns.map((turn) => [turn.id, turn]));
  const path: AiTurn[] = [];
  let cursor = byId.get(leafId);
  let guard = 0;
  while (cursor && guard < 500) {
    path.unshift(cursor);
    cursor = cursor.parent_id ? byId.get(cursor.parent_id) : undefined;
    guard += 1;
  }
  return path;
}

export function childrenOf(turns: AiTurn[], parentId: string | null): AiTurn[] {
  return turns.filter((turn) => turn.parent_id === parentId);
}

export function siblingsOf(turns: AiTurn[], turn: AiTurn): AiTurn[] {
  return childrenOf(turns, turn.parent_id);
}

export function leafAfter(turns: AiTurn[], fromId: string): string {
  let cursor = fromId;
  let guard = 0;
  while (guard < 500) {
    const children = childrenOf(turns, cursor);
    if (!children.length) return cursor;
    cursor = children[children.length - 1].id;
    guard += 1;
  }
  return cursor;
}

export function lastAssistant(turns: AiTurn[]): AiTurn | undefined {
  return [...turns].reverse().find((turn) => turn.role === 'assistant');
}

export function threadPreview(turns: AiTurn[], limit = 90): string {
  const last = [...turns].reverse().find((turn) => turn.content.trim());
  return truncate((last?.content || 'No messages yet').replace(/\s+/g, ' '), limit);
}

export function toRequestMessages(path: AiTurn[], extra?: RequestMessage[]): RequestMessage[] {
  const messages: RequestMessage[] = path
    .filter((turn) => turn.role !== 'system' && turn.content.trim())
    .map((turn) => ({ role: turn.role as 'user' | 'assistant', content: turn.content }));
  if (extra?.length) messages.push(...extra);
  return messages;
}

export function autoTitle(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return 'Untitled thread';
  const cut = clean.slice(0, 64);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > 24 ? cut.slice(0, lastSpace) : cut;
  return base.charAt(0).toUpperCase() + base.slice(1) + (clean.length > base.length ? '…' : '');
}

function partialUsage(inputTokens: number, content: string, reasoning: string): TokenUsage {
  const completion = estimateTokens(content) + estimateTokens(reasoning);
  return {
    prompt_tokens: inputTokens,
    completion_tokens: completion,
    total_tokens: inputTokens + completion,
    estimated: true,
  };
}

function addStage(error: AiError, stage: string): AiError {
  return { ...error, provider: error.provider || null, bodyText: error.bodyText || `stage: ${stage}` };
}

export interface RunTurnArgs {
  thread: AiThread;
  turns: AiTurn[];
  parentId: string | null;
  userText: string;
  modelId: string;
  params: GenerationParams;
  systemPrompt: string;
  apiKey: string;
  baseUrl: string;
  signal: AbortSignal;
  mode?: 'normal' | 'regenerate' | 'continue';
  retryOf?: AiTurn;
  continueFrom?: AiTurn;
  responseFormat?: 'text' | 'json';
  onUserTurn?: (turn: AiTurn) => void;
  onAssistantTurn?: (turn: AiTurn) => void;
  onDelta?: (delta: string, full: string) => void;
  onReasoning?: (delta: string, full: string) => void;
  onEvent?: (event: StreamEvent) => void;
}

export interface RunTurnResult {
  userTurn: AiTurn | null;
  assistantTurn: AiTurn | null;
  status: 'complete' | 'stopped' | 'error' | 'empty';
  error: AiError | null;
}

export async function runTurn(args: RunTurnArgs): Promise<RunTurnResult> {
  const {
    thread,
    turns,
    parentId,
    userText,
    modelId,
    params,
    systemPrompt,
    apiKey,
    baseUrl,
    signal,
    mode = 'normal',
    retryOf,
    continueFrom,
  } = args;

  if (!apiKey.trim()) {
    const error: AiError = {
      kind: 'configuration',
      message: 'No API key stored on this device. Open Settings → Projection booth and add one.',
      at: nowIso(),
      bodyText: '',
    };
    return { userTurn: null, assistantTurn: null, status: 'error', error };
  }

  const model = resolveModel(modelId);
  const existingPath = rootToLeaf(turns, parentId);
  let path = existingPath;
  let userTurn: AiTurn | null = null;

  try {
    if (mode === 'normal') {
      userTurn = insertRow('cinema_ai_turns', {
        thread_id: thread.id,
        parent_id: parentId,
        role: 'user',
        content: userText,
        reasoning: '',
        status: 'complete',
        model: modelId,
        requested_model: modelId,
        provider: null,
        continue_of: null,
        usage: null,
        request: null,
        error: null,
        meta: null,
      } as Partial<AiTurn>) as AiTurn;
      args.onUserTurn?.(userTurn);
      path = [...existingPath, userTurn];
      if (getDb().cinema_ai_threads.find((item) => item.id === thread.id)?.title === 'Untitled thread') {
        updateRow('cinema_ai_threads', thread.id, { title: autoTitle(userText), last_at: nowIso() });
      }
    }

    const extra: RequestMessage[] = [];
    if (mode === 'continue' && continueFrom) {
      extra.push({
        role: 'user',
        content: `Continue the previous assistant response from exactly where it stopped. Do not repeat any completed sentence, heading or code block. Do not restart the answer. If the previous text ends mid-word or mid-sentence, complete it seamlessly. Finish the thought and then stop.`,
      });
    }

    const requestMessages = toRequestMessages(path, extra);
    if (!requestMessages.length) {
      throw new AiTransportError('There is nothing to send: the thread is empty.', {
        kind: 'client',
        bodyText: '',
      });
    }
    const trimmed = trimToWindow(model, requestMessages, params, 1200);
    const built = buildRequest({
      model,
      modelId,
      messages: trimmed.messages,
      params,
      systemPrompt,
      responseFormat: args.responseFormat,
      baseUrl,
      stream: params.stream,
    });
    built.snapshot.truncatedHistory = trimmed.dropped;

    const assistantParent = mode === 'continue' && continueFrom ? continueFrom.id : userTurn ? userTurn.id : parentId;
    const assistant = insertRow('cinema_ai_turns', {
      thread_id: thread.id,
      parent_id: assistantParent,
      role: 'assistant',
      content: '',
      reasoning: '',
      status: 'streaming',
      model: modelId,
      requested_model: modelId,
      provider: null,
      continue_of: continueFrom?.id ?? null,
      usage: null,
      request: built.snapshot,
      error: null,
      meta: { started_at: nowIso(), mode: params.stream ? 'stream' : 'json' },
    } as Partial<AiTurn>) as AiTurn;
    args.onAssistantTurn?.(assistant);
    updateRow('cinema_ai_threads', thread.id, {
      last_at: nowIso(),
      model: modelId,
      params,
    });

    let content = '';
    let reasoning = '';
    let meta = { model: modelId, provider: null as string | null, generation_id: null as string | null, finish_reason: null as string | null, usage: null as TokenUsage | null };
    let persistTimer: number | null = null;
    let pending = false;
    let persistChain: Promise<unknown> = Promise.resolve();

    const flushPersist = (): void => {
      if (!pending) return;
      pending = false;
      if (persistTimer) {
        window.clearTimeout(persistTimer);
        persistTimer = null;
      }
      const snapshotContent = content;
      const snapshotReasoning = reasoning;
      persistChain = persistChain.then(() => {
        updateRow('cinema_ai_turns', assistant.id, {
          content: snapshotContent,
          reasoning: snapshotReasoning,
        });
      });
    };

    const schedulePersist = (): void => {
      pending = true;
      if (persistTimer) return;
      persistTimer = window.setTimeout(() => {
        persistTimer = null;
        flushPersist();
      }, 180);
    };

    const startedAt = performance.now();

    try {
      const result = await streamCompletion({
        snapshot: built.snapshot,
        apiKey,
        baseUrl,
        signal,
        callbacks: {
          onDelta: (delta, full) => {
            content = full;
            args.onDelta?.(delta, content);
            schedulePersist();
          },
          onReasoning: (delta, full) => {
            reasoning = full;
            args.onReasoning?.(delta, reasoning);
            schedulePersist();
          },
          onMeta: (next) => {
            meta = {
              model: next.model || meta.model,
              provider: next.provider ?? meta.provider,
              generation_id: next.generation_id ?? meta.generation_id,
              finish_reason: next.finish_reason ?? meta.finish_reason,
              usage: next.usage || meta.usage,
            };
          },
          onEvent: args.onEvent,
        },
      });

      flushPersist();
      await persistChain;

      const usage = usageFromProvider(
        result.usage || meta.usage,
        built.snapshot.estimatedInputTokens,
        estimateTokens(content) + estimateTokens(reasoning),
      );
      const actualModel = result.model || meta.model || modelId;
      const completedMeta = {
        started_at: built.snapshot.createdAt,
        completed_at: nowIso(),
        latency_ms: Math.round(result.latencyMs || performance.now() - startedAt),
        model: actualModel,
        provider: result.provider || meta.provider,
        generation_id: result.generationId || meta.generation_id,
        finish_reason: result.finishReason || meta.finish_reason,
        http_status: 200,
        mode: result.mode,
        event_count: result.eventCount,
        empty: result.empty,
      };

      if (result.empty) {
        const error: AiError = {
          kind: 'empty',
          message: 'The provider returned a successful, empty completion. No visible content was produced.',
          status: 200,
          bodyText: result.content,
          at: nowIso(),
          provider: completedMeta.provider,
          requestId: completedMeta.generation_id,
          finish_reason: result.finishReason,
          usage,
        };
        updateRow('cinema_ai_turns', assistant.id, {
          status: 'error',
          error,
          usage,
          model: actualModel,
          meta: completedMeta,
          content,
          reasoning,
        });
        logUsage({
          provider: completedMeta.provider || 'openrouter',
          model: actualModel,
          prompt_tokens: usage.prompt_tokens,
          completion_tokens: usage.completion_tokens,
          total_tokens: usage.total_tokens,
          latency_ms: completedMeta.latency_ms,
          ok: false,
          reasoning: Boolean(reasoning),
          error: 'Empty completion',
        });
        return {
          userTurn,
          assistantTurn: { ...assistant, content, reasoning, status: 'error', error, usage, model: actualModel, meta: completedMeta },
          status: 'empty',
          error,
        };
      }

      updateRow('cinema_ai_turns', assistant.id, {
        status: 'complete',
        usage,
        model: actualModel,
        provider: completedMeta.provider,
        content,
        reasoning,
        meta: completedMeta,
      });
      updateRow('cinema_ai_threads', thread.id, {
        last_at: nowIso(),
        model: actualModel === 'openrouter/free' ? modelId : modelId,
      });
      logUsage({
        provider: completedMeta.provider || 'openrouter',
        model: actualModel,
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
        latency_ms: completedMeta.latency_ms,
        ok: true,
        reasoning: Boolean(reasoning),
        error: '',
      });

      // Archive the exchange in the SQL-shaped conversations table.
      upsertRow('cinema_conversations', {
        id: `conv-${thread.id}`,
        title_id: thread.title_id,
        title_context: thread.title,
        prompt: path.filter((turn) => turn.role === 'user').slice(-1)[0]?.content || userText,
        response: content,
        ai_model: actualModel,
        tags: thread.tags,
      });

      return {
        userTurn,
        assistantTurn: {
          ...assistant,
          content,
          reasoning,
          status: 'complete',
          usage,
          model: actualModel,
          meta: completedMeta,
        },
        status: 'complete',
        error: null,
      };
    } catch (error) {
      flushPersist();
      await persistChain;

      if (isAbort(error)) {
        const usage = partialUsage(built.snapshot.estimatedInputTokens, content, reasoning);
        const completedMeta = {
          started_at: built.snapshot.createdAt,
          completed_at: nowIso(),
          latency_ms: Math.round(performance.now() - startedAt),
          model: meta.model || modelId,
          provider: meta.provider,
          generation_id: meta.generation_id,
          finish_reason: 'aborted-by-user',
          mode: 'stream',
          aborted: true,
        };
        updateRow('cinema_ai_turns', assistant.id, {
          status: 'stopped',
          content,
          reasoning,
          usage,
          model: meta.model || modelId,
          meta: completedMeta,
        });
        logUsage({
          provider: meta.provider || 'openrouter',
          model: meta.model || modelId,
          prompt_tokens: usage.prompt_tokens,
          completion_tokens: usage.completion_tokens,
          total_tokens: usage.total_tokens,
          latency_ms: completedMeta.latency_ms,
          ok: false,
          reasoning: Boolean(reasoning),
          error: 'Stopped by operator',
        });
        return {
          userTurn,
          assistantTurn: {
            ...assistant,
            content,
            reasoning,
            status: 'stopped',
            usage,
            model: meta.model || modelId,
            meta: completedMeta,
          },
          status: 'stopped',
          error: null,
        };
      }

      const record = addStage(errorRecord(error), 'completion');
      if (!record.url) record.url = built.snapshot.url;
      if (!record.requestId) record.requestId = meta.generation_id || null;
      if (!record.provider) record.provider = meta.provider || null;

      const usage = partialUsage(built.snapshot.estimatedInputTokens, content, reasoning);
      const failedMeta = {
        started_at: built.snapshot.createdAt,
        completed_at: nowIso(),
        latency_ms: record.latencyMs ?? Math.round(performance.now() - startedAt),
        model: meta.model || modelId,
        provider: meta.provider,
        generation_id: meta.generation_id,
        http_status: record.status ?? null,
        error_kind: record.kind,
        mode: 'stream',
      };
      updateRow('cinema_ai_turns', assistant.id, {
        status: 'error',
        content,
        reasoning,
        error: record,
        usage,
        model: meta.model || modelId,
        meta: failedMeta,
      });
      logUsage({
        provider: meta.provider || 'openrouter',
        model: meta.model || modelId,
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
        latency_ms: failedMeta.latency_ms,
        ok: false,
        reasoning: Boolean(reasoning),
        error: `${record.kind}: ${record.message}`,
      });
      logActivity('ai', 'cinema_ai_turns', assistant.id, `Request failed: ${record.message}`);

      return {
        userTurn,
        assistantTurn: {
          ...assistant,
          content,
          reasoning,
          status: 'error',
          error: record,
          usage,
          model: meta.model || modelId,
          meta: failedMeta,
        },
        status: 'error',
        error: record,
      };
    }
  } catch (error) {
    const record = addStage(errorRecord(error), 'request-build');
    return {
      userTurn,
      assistantTurn: null,
      status: 'error',
      error: record,
    };
  }
}

/** Delete a turn and every descendant, keeping other branches intact. */
export function pruneBranch(turns: AiTurn[], turnId: string): string[] {
  const doomed = new Set<string>([turnId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const turn of turns) {
      if (turn.parent_id && doomed.has(turn.parent_id) && !doomed.has(turn.id)) {
        doomed.add(turn.id);
        changed = true;
      }
    }
  }
  return Array.from(doomed);
}

/** Simple context estimate for the composer's budget meter. */
export function threadContextEstimate(turns: AiTurn[], draft: string, systemPrompt: string): number {
  const history = turns.reduce((total, turn) => total + estimateTokens(turn.content) + 4, 0);
  return history + estimateTokens(draft) + estimateTokens(systemPrompt) + 8;
}

/**
 * Build the request used for the "resume" action. Exported so the UI can show
 * the exact continuation payload before it is sent.
 */
export function continuationMessages(turns: AiTurn[], continueFrom: AiTurn): RequestMessage[] {
  const path = rootToLeaf(turns, continueFrom.id);
  return toRequestMessages(path, [
    {
      role: 'user',
      content:
        'Continue the previous assistant response from exactly where it stopped. Do not repeat any completed text. Finish the thought and stop.',
    },
  ]);
}

export function newTurnId(): string {
  return uid('turn');
}
