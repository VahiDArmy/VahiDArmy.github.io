/** Every Supabase read/write used by the app. Errors are returned, never swallowed. */
import { supabase, TABLES, normalizeError, isMissingTableError } from './supabase.js';
import { CONFIG } from '../config.js';

const MESSAGE_COLUMNS = [
  'id',
  'conversation_id',
  'parent_id',
  'role',
  'content',
  'reasoning',
  'model_slug',
  'requested_model',
  'status',
  'error',
  'usage',
  'response_meta',
  'created_at',
  'updated_at',
].join(',');

async function run(promise) {
  try {
    const { data, error, count } = await promise;
    return { data, error: normalizeError(error), count };
  } catch (error) {
    return { data: null, error: normalizeError(error), count: null };
  }
}

function table(name) {
  return supabase.from(name);
}

/* ───────────────────────────── schema ───────────────────────────── */

export async function checkSchema() {
  const entries = [
    ['profiles', TABLES.profiles],
    ['models', TABLES.models],
    ['conversations', TABLES.conversations],
    ['messages', TABLES.messages],
    ['prompts', TABLES.prompts],
    ['events', TABLES.events],
  ];

  const results = await Promise.all(
    entries.map(async ([key, name]) => {
      const { error } = await run(table(name).select('*', { head: true, count: 'exact' }).limit(1));
      return { key, table: name, error };
    }),
  );

  const missing = results
    .filter((result) => result.error && isMissingTableError(result.error))
    .map((result) => ({ key: result.key, table: result.table, error: result.error }));
  const otherErrors = results.filter((result) => result.error && !isMissingTableError(result.error));

  if (missing.length) {
    return { status: 'missing', missing, otherErrors, error: missing[0].error };
  }
  if (otherErrors.length) {
    return { status: 'error', missing: [], otherErrors, error: otherErrors[0].error };
  }
  return { status: 'ready', missing: [], otherErrors: [], error: null };
}

/* ───────────────────────────── profile ───────────────────────────── */

export async function getProfile(userId) {
  return run(table(TABLES.profiles).select('*').eq('user_id', userId).maybeSingle());
}

export async function upsertProfile(userId, patch = {}) {
  const payload = { user_id: userId, ...patch };
  return run(
    table(TABLES.profiles)
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .maybeSingle(),
  );
}

/* ───────────────────────── conversations ───────────────────────── */

const CONVERSATION_COLUMNS =
  'id,title,model_slug,system_prompt,params,pinned,archived,folder,active_leaf_id,message_count,total_tokens,last_message_at,metadata,created_at,updated_at';

export async function listConversations({ archived = false, limit = CONFIG.limits.conversations } = {}) {
  return run(
    table(TABLES.conversations)
      .select(CONVERSATION_COLUMNS)
      .eq('archived', archived)
      .order('pinned', { ascending: false })
      .order('last_message_at', { ascending: false })
      .limit(limit),
  );
}

export async function getConversation(id) {
  return run(table(TABLES.conversations).select(CONVERSATION_COLUMNS).eq('id', id).maybeSingle());
}

export async function createConversation(userId, values = {}) {
  const payload = {
    user_id: userId,
    title: values.title || 'New conversation',
    model_slug: values.model_slug || CONFIG.defaults.model,
    system_prompt: values.system_prompt || null,
    params: values.params || CONFIG.defaults.params,
  };
  return run(table(TABLES.conversations).insert(payload).select(CONVERSATION_COLUMNS).single());
}

export async function updateConversation(id, patch) {
  return run(
    table(TABLES.conversations)
      .update(patch)
      .eq('id', id)
      .select(CONVERSATION_COLUMNS)
      .maybeSingle(),
  );
}

export async function deleteConversation(id) {
  return run(table(TABLES.conversations).delete().eq('id', id).select('id').maybeSingle());
}

export async function deleteAllConversations(userId) {
  return run(table(TABLES.conversations).delete().eq('user_id', userId).select('id'));
}

/* ──────────────────────────── messages ─────────────────────────── */

export async function listMessages(conversationId, limit = CONFIG.limits.messagesPerConversation) {
  const result = await run(
    table(TABLES.messages)
      .select(MESSAGE_COLUMNS)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit),
  );
  if (result.error || !Array.isArray(result.data)) return result;

  const staleIds = [];
  const now = Date.now();
  const messages = result.data.map((message) => {
    if (message.status !== 'streaming') return message;
    const updated = new Date(message.updated_at).getTime();
    if (!Number.isFinite(updated) || now - updated > 90000) staleIds.push(message.id);
    return { ...message, status: 'interrupted' };
  });

  if (staleIds.length) {
    // Best effort; a failure here must not prevent reading the conversation.
    table(TABLES.messages)
      .update({ status: 'interrupted' })
      .in('id', staleIds)
      .then(({ error }) => {
        if (error) console.warn('[معراج] could not mark stale streams as interrupted', error);
      });
  }

  return { ...result, data: messages };
}

export async function createMessage(values) {
  const payload = {
    conversation_id: values.conversation_id,
    user_id: values.user_id,
    parent_id: values.parent_id || null,
    role: values.role,
    content: values.content || '',
    reasoning: values.reasoning || null,
    model_slug: values.model_slug || null,
    requested_model: values.requested_model || null,
    status: values.status || 'complete',
    error: values.error || null,
    usage: values.usage || null,
    request: values.request || null,
    response_meta: values.response_meta || null,
  };
  return run(table(TABLES.messages).insert(payload).select(MESSAGE_COLUMNS).single());
}

export async function updateMessage(id, patch) {
  return run(
    table(TABLES.messages)
      .update(patch)
      .eq('id', id)
      .select(MESSAGE_COLUMNS)
      .maybeSingle(),
  );
}

export async function getMessageSnapshot(id) {
  return run(
    table(TABLES.messages)
      .select('id,request,error,usage,response_meta,model_slug,requested_model,status,content,created_at')
      .eq('id', id)
      .maybeSingle(),
  );
}

export async function deleteMessage(id) {
  return run(table(TABLES.messages).delete().eq('id', id).select('id').maybeSingle());
}

export async function countMessages(conversationId) {
  return run(
    table(TABLES.messages)
      .select('id', { head: true, count: 'exact' })
      .eq('conversation_id', conversationId),
  );
}

/* ───────────────────────────── models ──────────────────────────── */

export async function listModels() {
  return run(
    table(TABLES.models)
      .select('*')
      .order('is_favorite', { ascending: false })
      .order('name', { ascending: true }),
  );
}

export async function upsertModels(rows) {
  if (!Array.isArray(rows) || !rows.length) return { data: [], error: null };
  return run(
    table(TABLES.models)
      .upsert(rows, { onConflict: 'user_id,slug' })
      .select('*'),
  );
}

export async function updateModel(id, patch) {
  return run(
    table(TABLES.models)
      .update(patch)
      .eq('id', id)
      .select('*')
      .maybeSingle(),
  );
}

export async function bulkUpdateModels(userId, ids, patch) {
  if (!ids.length) return { data: [], error: null };
  return run(
    table(TABLES.models)
      .update(patch)
      .eq('user_id', userId)
      .in('id', ids)
      .select('*'),
  );
}

/* ───────────────────────────── prompts ─────────────────────────── */

export async function listPrompts(userId) {
  return run(
    table(TABLES.prompts)
      .select('*')
      .eq('user_id', userId)
      .order('is_favorite', { ascending: false })
      .order('updated_at', { ascending: false }),
  );
}

export async function createPrompt(userId, values) {
  return run(
    table(TABLES.prompts)
      .insert({
        user_id: userId,
        title: values.title,
        body: values.body,
        category: values.category || 'general',
        icon: values.icon || 'spark',
        is_favorite: Boolean(values.is_favorite),
      })
      .select('*')
      .single(),
  );
}

export async function updatePrompt(id, patch) {
  return run(table(TABLES.prompts).update(patch).eq('id', id).select('*').maybeSingle());
}

export async function deletePrompt(id) {
  return run(table(TABLES.prompts).delete().eq('id', id).select('id').maybeSingle());
}

/* ───────────────────────────── events ──────────────────────────── */

export async function insertEvent(values) {
  return run(
    table(TABLES.events)
      .insert({
        user_id: values.user_id,
        conversation_id: values.conversation_id || null,
        message_id: values.message_id || null,
        kind: values.kind || 'completion',
        model_slug: values.model_slug || null,
        requested_model: values.requested_model || null,
        status: values.status || 'ok',
        http_status: values.http_status ?? null,
        error_code: values.error_code || null,
        error_message: values.error_message ? String(values.error_message).slice(0, 1200) : null,
        prompt_tokens: values.prompt_tokens || 0,
        completion_tokens: values.completion_tokens || 0,
        total_tokens: values.total_tokens || 0,
        latency_ms: values.latency_ms ?? null,
      })
      .select('id')
      .maybeSingle(),
  );
}

export async function listEvents({ since = null, limit = CONFIG.limits.events } = {}) {
  let query = table(TABLES.events)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (since) query = query.gte('created_at', since);
  return run(query);
}

export async function deleteAllEvents(userId) {
  return run(table(TABLES.events).delete().eq('user_id', userId).select('id'));
}

/* ───────────────────────────── export ──────────────────────────── */

export async function exportWorkspace(userId) {
  const [conversations, models, prompts, events] = await Promise.all([
    listConversations({ archived: false, limit: 1000 }),
    listModels(),
    listPrompts(userId),
    listEvents({ limit: 10000 }),
  ]);
  const archivedResult = await listConversations({ archived: true, limit: 1000 });
  const firstError = [conversations, archivedResult, models, prompts, events].find((result) => result.error)?.error;
  if (firstError) return { data: null, error: firstError };

  const allConversations = [...(conversations.data || []), ...(archivedResult.data || [])];
  const messageResults = await Promise.all(
    allConversations.map(async (conversation) => {
      const result = await run(
        table(TABLES.messages)
          .select(`${MESSAGE_COLUMNS},request`)
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: true }),
      );
      return { conversationId: conversation.id, ...result };
    }),
  );
  const messageError = messageResults.find((result) => result.error)?.error;
  if (messageError) return { data: null, error: messageError };

  return {
    data: {
      exported_at: new Date().toISOString(),
      app: 'معراج · MI\'RAJ',
      version: CONFIG.app.version,
      user_id: userId,
      conversations: allConversations,
      messages: messageResults.flatMap((result) =>
        (result.data || []).map((message) => ({ ...message, conversation_id: result.conversationId })),
      ),
      models: models.data || [],
      prompts: prompts.data || [],
      events: events.data || [],
    },
    error: null,
  };
}

/* ─────────────────────────── current user ──────────────────────── */

export async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return { data: null, error: normalizeError(error) };
  return { data: data?.user?.id || null, error: null };
}
