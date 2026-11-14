/**
 * The completion controller.
 *
 * One assistant turn = one archived request = one provider call.
 * It persists the request snapshot before sending, streams into the message
 * row, keeps partial content on abort, and records analytics.
 */
import { CONFIG } from '../config.js';
import { createRequestSnapshot, snapshotBodyText } from './requestBuilder.js';
import { streamCompletion, errorRecordFrom, OpenRouterError } from './openrouter.js';
import * as db from './db.js';
import { estimateTokens, usageFromProvider } from './tokens.js';
import { toIso } from '../utils.js';

function providerErrorCode(record) {
  const code = record?.parsed?.error?.code ?? record?.parsed?.code ?? record?.status ?? record?.kind;
  return code === null || code === undefined ? null : String(code);
}

function addStage(record, stage) {
  return {
    ...record,
    stage,
    at: record.at || new Date().toISOString(),
  };
}

function partialUsage(snapshot, content, reasoning) {
  return {
    prompt_tokens: snapshot?.estimated_input_tokens || 0,
    completion_tokens: estimateTokens(content || '') + estimateTokens(reasoning || ''),
    total_tokens: (snapshot?.estimated_input_tokens || 0) + estimateTokens(content || '') + estimateTokens(reasoning || ''),
    estimated: true,
  };
}

/**
 * @param {object} options
 * @param {object} options.user
 * @param {object} options.conversation
 * @param {string|null} options.parentId
 * @param {object} options.model
 * @param {Array} options.path
 * @param {object} options.settings
 * @param {string} options.apiKey
 * @param {AbortSignal} options.signal
 */
export async function runAssistantTurn({
  user,
  conversation,
  parentId,
  model,
  path,
  includeErrorContent = false,
  settings,
  apiKey,
  signal,
  onAssistantCreated,
  onDelta,
  onReasoning,
  onMeta,
  onRoute,
  onComplete,
  onAbort,
  onError,
  onPersistError,
}) {
  if (!apiKey) {
    return {
      assistant: null,
      status: 'error',
      error: {
        kind: 'configuration',
        message: 'No OpenRouter API key is stored on this device. Open Settings → OpenRouter and add a key before sending.',
        at: new Date().toISOString(),
        bodyText: '',
        status: null,
      },
    };
  }
  if (!conversation?.id || !user?.id) {
    return {
      assistant: null,
      status: 'error',
      error: {
        kind: 'client',
        message: 'The conversation or user session is missing, so no request was built.',
        at: new Date().toISOString(),
        bodyText: '',
      },
    };
  }

  let snapshot;
  try {
    snapshot = await createRequestSnapshot({
      conversation,
      model,
      path,
      includeErrorContent,
      settings,
      stream: settings?.stream !== false,
    });
  } catch (error) {
    const record = addStage(errorRecordFrom(error), 'request-build');
    return { assistant: null, status: 'error', error: record };
  }

  const placeholder = {
    conversation_id: conversation.id,
    user_id: user.id,
    parent_id: parentId,
    role: 'assistant',
    content: '',
    reasoning: null,
    model_slug: snapshot.model_slug,
    requested_model: snapshot.requested_model,
    status: 'streaming',
    request: snapshot,
    response_meta: { started_at: toIso() },
  };

  const created = await db.createMessage(placeholder);
  if (created.error || !created.data) {
    return {
      assistant: null,
      status: 'error',
      error: {
        kind: 'database',
        ...created.error,
        stage: 'assistant-insert',
        message: created.error?.message || 'The assistant message could not be created in Supabase.',
        bodyText: '',
        at: new Date().toISOString(),
      },
    };
  }

  const assistant = { ...created.data, request: snapshot };
  onAssistantCreated?.(assistant);

  // Persist the active leaf immediately so a reload during streaming shows this turn.
  db.updateConversation(conversation.id, {
    active_leaf_id: assistant.id,
    last_message_at: toIso(),
  }).then(({ error }) => {
    if (error) console.warn('[معراج] Could not update active leaf before streaming', error);
  });

  let content = '';
  let reasoning = '';
  let meta = {
    model: snapshot.model_slug,
    provider: null,
    id: null,
    usage: null,
    finishReason: null,
  };
  let routedModel = null;
  let routeAnnounced = false;
  let persistTimer = null;
  let pendingPersist = null;
  let persistChain = Promise.resolve();
  const persistErrors = [];

  const schedulePersist = () => {
    pendingPersist = { content, reasoning };
    if (persistTimer) return;
    persistTimer = window.setTimeout(() => {
      persistTimer = null;
      if (!pendingPersist) return;
      const payload = pendingPersist;
      pendingPersist = null;
      persistChain = persistChain.then(async () => {
        const { error } = await db.updateMessage(assistant.id, {
          content: payload.content,
          reasoning: payload.reasoning || null,
        });
        if (error) {
          persistErrors.push(error);
          onPersistError?.(error);
        }
      });
    }, CONFIG.limits.streamPersistIntervalMs);
  };

  const handleMeta = (nextMeta) => {
    if (!nextMeta) return;
    meta = { ...meta, ...nextMeta, usage: nextMeta.usage || meta.usage };
    if (meta.model) {
      routedModel = meta.model;
      if (!routeAnnounced && meta.model !== snapshot.model_slug) {
        routeAnnounced = true;
        onRoute?.(meta.model, meta);
      }
    }
    onMeta?.(meta);
  };

  const startedAt = performance.now();

  try {
    const result = await streamCompletion({
      requestSnapshot: snapshot,
      apiKey,
      signal,
      onDelta: (delta, full) => {
        content = full;
        onDelta?.(delta, content);
        schedulePersist();
      },
      onReasoning: (delta, full) => {
        reasoning = full;
        onReasoning?.(delta, reasoning);
        schedulePersist();
      },
      onMeta: handleMeta,
    });

    if (persistTimer) {
      window.clearTimeout(persistTimer);
      persistTimer = null;
    }
    await persistChain;

    const actualModel = result.model || meta.model || snapshot.model_slug;
    const provider = result.provider || meta.provider || null;
    const usage = usageFromProvider(result.usage || meta.usage, snapshot.estimated_input_tokens, estimateTokens(content) + estimateTokens(reasoning));
    const empty = !content.trim() && !reasoning.trim();
    const responseMeta = {
      started_at: snapshot.created_at,
      completed_at: toIso(),
      latency_ms: Math.round(result.latencyMs || performance.now() - startedAt),
      model: actualModel,
      provider,
      generation_id: result.generationId || meta.id || null,
      finish_reason: result.finishReason || meta.finishReason || null,
      headers: result.headers || {},
      event_count: result.eventCount ?? null,
      mode: result.mode || (settings?.stream !== false ? 'stream' : 'json'),
      http_status: 200,
      empty,
    };

    if (empty) {
      const errorRecord = {
        kind: 'empty',
        name: 'Empty completion',
        message: 'OpenRouter completed the call successfully but the assistant returned no visible content.',
        status: 200,
        statusText: 'OK',
        bodyText: result.content || '',
        parsed: null,
        url: snapshot.url,
        requestId: responseMeta.generation_id,
        provider,
        headers: result.headers || {},
        latencyMs: responseMeta.latency_ms,
        at: toIso(),
        finish_reason: responseMeta.finish_reason,
        usage,
      };
      const saved = await db.updateMessage(assistant.id, {
        content,
        reasoning: reasoning || null,
        status: 'error',
        error: errorRecord,
        usage,
        model_slug: actualModel,
        response_meta: responseMeta,
      });
      if (saved.error) {
        persistErrors.push(saved.error);
        onPersistError?.(saved.error);
      }
      await db.updateConversation(conversation.id, {
        active_leaf_id: assistant.id,
        last_message_at: toIso(),
      });
      await db.insertEvent({
        user_id: user.id,
        conversation_id: conversation.id,
        message_id: assistant.id,
        kind: 'completion',
        model_slug: actualModel,
        requested_model: snapshot.model_slug,
        status: 'error',
        http_status: 200,
        error_code: 'empty-completion',
        error_message: errorRecord.message,
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
        latency_ms: responseMeta.latency_ms,
      });
      const merged = { ...assistant, content, reasoning, status: 'error', error: errorRecord, usage, model_slug: actualModel, response_meta: responseMeta };
      onError?.(errorRecord, merged, { persistErrors });
      return { assistant: merged, status: 'error', error: errorRecord, persistErrors };
    }

    const saved = await db.updateMessage(assistant.id, {
      content,
      reasoning: reasoning || null,
      status: 'complete',
      usage,
      model_slug: actualModel,
      response_meta: responseMeta,
    });
    if (saved.error) {
      persistErrors.push(saved.error);
      onPersistError?.(saved.error);
    }

    const conversationPatch = {
      active_leaf_id: assistant.id,
      last_message_at: toIso(),
      total_tokens: Number(conversation.total_tokens || 0) + Number(usage.total_tokens || 0),
    };
    if (snapshot.model_slug === 'openrouter/free' && actualModel && actualModel !== snapshot.model_slug) {
      conversationPatch.model_slug = actualModel;
    }
    const conversationUpdate = await db.updateConversation(conversation.id, conversationPatch);
    if (conversationUpdate.error) {
      persistErrors.push(conversationUpdate.error);
      onPersistError?.(conversationUpdate.error);
    }

    await db.insertEvent({
      user_id: user.id,
      conversation_id: conversation.id,
      message_id: assistant.id,
      kind: 'completion',
      model_slug: actualModel,
      requested_model: snapshot.model_slug,
      status: 'ok',
      http_status: 200,
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens,
      latency_ms: responseMeta.latency_ms,
    });

    const merged = {
      ...assistant,
      content,
      reasoning,
      status: 'complete',
      usage,
      model_slug: actualModel,
      requested_model: snapshot.model_slug,
      response_meta: responseMeta,
      conversation_model_update:
        snapshot.model_slug === 'openrouter/free' && actualModel !== snapshot.model_slug ? actualModel : null,
    };
    onComplete?.(merged, { persistErrors, routedModel: actualModel });
    return { assistant: merged, status: 'complete', error: null, persistErrors, routedModel: actualModel };
  } catch (error) {
    if (persistTimer) {
      window.clearTimeout(persistTimer);
      persistTimer = null;
    }
    await persistChain;

    if (error?.name === 'AbortError') {
      const usage = partialUsage(snapshot, content, reasoning);
      const responseMeta = {
        started_at: snapshot.created_at,
        completed_at: toIso(),
        latency_ms: Math.round(performance.now() - startedAt),
        model: meta.model || snapshot.model_slug,
        provider: meta.provider || null,
        generation_id: meta.id || null,
        finish_reason: 'aborted-by-user',
        headers: {},
        mode: 'stream',
        aborted: true,
      };
      const saved = await db.updateMessage(assistant.id, {
        content,
        reasoning: reasoning || null,
        status: 'stopped',
        usage,
        model_slug: meta.model || snapshot.model_slug,
        response_meta: responseMeta,
      });
      if (saved.error) {
        persistErrors.push(saved.error);
        onPersistError?.(saved.error);
      }
      await db.updateConversation(conversation.id, {
        active_leaf_id: assistant.id,
        last_message_at: toIso(),
        total_tokens: Number(conversation.total_tokens || 0) + Number(usage.total_tokens || 0),
      });
      await db.insertEvent({
        user_id: user.id,
        conversation_id: conversation.id,
        message_id: assistant.id,
        kind: 'completion',
        model_slug: meta.model || snapshot.model_slug,
        requested_model: snapshot.model_slug,
        status: 'aborted',
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
        latency_ms: responseMeta.latency_ms,
      });
      const merged = {
        ...assistant,
        content,
        reasoning,
        status: 'stopped',
        usage,
        model_slug: meta.model || snapshot.model_slug,
        response_meta: responseMeta,
      };
      onAbort?.(merged);
      return { assistant: merged, status: 'stopped', error: null, persistErrors };
    }

    const record = addStage(errorRecordFrom(error), 'completion');
    if (routedModel) record.model = routedModel;
    if (!record.url) record.url = snapshot.url;
    if (!record.requestId && meta.id) record.requestId = meta.id;
    if (!record.provider && meta.provider) record.provider = meta.provider;

    const saved = await db.updateMessage(assistant.id, {
      content,
      reasoning: reasoning || null,
      status: 'error',
      error: record,
      model_slug: meta.model || snapshot.model_slug,
      response_meta: {
        started_at: snapshot.created_at,
        completed_at: toIso(),
        latency_ms: record.latencyMs ?? Math.round(performance.now() - startedAt),
        model: meta.model || snapshot.model_slug,
        provider: meta.provider || null,
        generation_id: meta.id || null,
        http_status: record.status ?? null,
        error_kind: record.kind,
      },
    });
    if (saved.error) {
      persistErrors.push(saved.error);
      onPersistError?.(saved.error);
    }
    await db.updateConversation(conversation.id, {
      active_leaf_id: assistant.id,
      last_message_at: toIso(),
    });
    await db.insertEvent({
      user_id: user.id,
      conversation_id: conversation.id,
      message_id: assistant.id,
      kind: 'completion',
      model_slug: meta.model || snapshot.model_slug,
      requested_model: snapshot.model_slug,
      status: 'error',
      http_status: record.status ?? null,
      error_code: providerErrorCode(record),
      error_message: record.message,
      latency_ms: record.latencyMs ?? null,
    });

    const merged = {
      ...assistant,
      content,
      reasoning,
      status: 'error',
      error: record,
      model_slug: meta.model || snapshot.model_slug,
    };
    onError?.(record, merged, { persistErrors });
    return { assistant: merged, status: 'error', error: record, persistErrors };
  }
}

export function abortErrorMessage(error) {
  if (error instanceof OpenRouterError) return error.message;
  return error?.message || String(error);
}
