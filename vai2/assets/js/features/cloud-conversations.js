/* ============================================================
   NEXUS CHAT — CLOUD CONVERSATIONS + ACTIVITY
   Per-user. Uses ONLY new nexus_* tables. Auth required.
   ============================================================ */
(function () {
  'use strict';
  if (window.__nexus_cloudconv_loaded__) return;
  window.__nexus_cloudconv_loaded__ = true;

  const SYNC_DEBOUNCE_MS = 2500;
  const MAX_ACTIVITY_PER_MINUTE = 20;
  const ALLOWED_ACTIONS = new Set([
    'chat_created', 'chat_updated', 'chat_deleted',
    'message_sent', 'message_received', 'rating_given',
    'summary_generated', 'branch_created', 'sync_pull', 'sync_push',
  ]);

  const state = {
    pushTimers: {},
    lastResult: null,
    activityBucket: [],
  };

  function getCloud() { return window.Nexus?.Cloud || null; }
  function isReady() {
    const st = getCloud()?.getStatus?.();
    return !!(st && st.clientReady && st.authenticated);
  }
  function getClient() { return window.supabase || null; }

  function serializeChat(chat) {
    return {
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      parentChatId: chat.parentChatId,
      branchedFromIndex: chat.branchedFromIndex,
      pinnedModelId: chat.pinnedModelId,
      fallbackChain: chat.fallbackChain,
      messages: (chat.messages || []).map(m => ({
        role: m.role,
        content: m.content || '',
        timestamp: m.timestamp,
        model: m.model,
        usage: m.usage,
        error: !!m.error,
        finish_reason: m.finish_reason,
        rating: m.rating,
        attachments: (m.attachments || []).map(a => ({ kind: a.kind, name: a.name, size: a.size })),
        _isSummary: m._isSummary,
        _summarizedCount: m._summarizedCount,
      })),
    };
  }

  async function pushChat(chatId) {
    if (!isReady()) return { ok: false, error: 'Not signed in' };
    const client = getClient(); if (!client) return { ok: false, error: 'No client' };
    const chat = window.__nexus?.state?.chats?.find(c => c.id === chatId);
    if (!chat) return { ok: false, error: 'Chat not found' };
    const data = serializeChat(chat);
    try {
      const { error } = await client.from('nexus_chats').upsert({
        chat_id: chat.id,
        title: (chat.title || 'Untitled').slice(0, 200),
        data,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,chat_id' });
      if (error) throw new Error(error.message);
      return { ok: true };
    } catch (err) { return { ok: false, error: err.message }; }
  }

  function schedulePushChat(chatId) {
    if (!chatId || !isReady()) return;
    if (state.pushTimers[chatId]) clearTimeout(state.pushTimers[chatId]);
    state.pushTimers[chatId] = setTimeout(async () => {
      delete state.pushTimers[chatId];
      await pushChat(chatId);
    }, SYNC_DEBOUNCE_MS);
  }

  async function pushAllChats() {
    if (!isReady()) return { ok: false, error: 'Not signed in' };
    const chats = window.__nexus?.state?.chats || [];
    let ok = 0, failed = 0;
    for (const c of chats) { const r = await pushChat(c.id); r.ok ? ok++ : failed++; }
    state.lastResult = { ok: true, pushed: ok, failed, total: chats.length, ts: Date.now() };
    return state.lastResult;
  }

  async function syncFromCloud() {
    if (!isReady()) return { ok: false, error: 'Not signed in' };
    const client = getClient(); if (!client) return { ok: false, error: 'No client' };
    try {
      const { data, error } = await client
        .from('nexus_chats')
        .select('chat_id,title,data,updated_at')
        .order('updated_at', { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);

      const localChats = window.__nexus?.state?.chats || [];
      const localById = new Map(localChats.map(c => [c.id, c]));
      let merged = 0, added = 0, skipped = 0;

      for (const row of (data || [])) {
        const remoteChat = row.data && typeof row.data === 'object' ? row.data : null;
        if (!remoteChat || !remoteChat.messages) { skipped++; continue; }
        const local = localById.get(row.chat_id);
        if (!local) {
          localChats.push({
            id: row.chat_id,
            title: remoteChat.title || row.title || 'Restored chat',
            messages: Array.isArray(remoteChat.messages) ? remoteChat.messages : [],
            createdAt: remoteChat.createdAt || new Date().toISOString(),
            updatedAt: remoteChat.updatedAt || row.updated_at,
            parentChatId: remoteChat.parentChatId,
            branchedFromIndex: remoteChat.branchedFromIndex,
            pinnedModelId: remoteChat.pinnedModelId,
            fallbackChain: remoteChat.fallbackChain,
            _fromCloud: true,
          });
          added++;
        } else {
          const tL = new Date(local.updatedAt || 0).getTime();
          const tR = new Date(remoteChat.updatedAt || row.updated_at || 0).getTime();
          if (tR > tL) {
            Object.assign(local, {
              messages: Array.isArray(remoteChat.messages) ? remoteChat.messages : local.messages,
              title: remoteChat.title || local.title,
              updatedAt: remoteChat.updatedAt || local.updatedAt,
              parentChatId: remoteChat.parentChatId || local.parentChatId,
              branchedFromIndex: remoteChat.branchedFromIndex ?? local.branchedFromIndex,
              pinnedModelId: remoteChat.pinnedModelId || local.pinnedModelId,
              fallbackChain: remoteChat.fallbackChain || local.fallbackChain,
            });
            merged++;
          } else skipped++;
        }
      }

      window.__nexus?.persistChats?.();
      window.__nexus?.renderChatList?.();
      window.__nexus?.renderActiveChat?.();
      state.lastResult = { ok: true, merged, added, skipped, total: (data || []).length, ts: Date.now() };
      return state.lastResult;
    } catch (err) {
      state.lastResult = { ok: false, error: err.message, ts: Date.now() };
      return state.lastResult;
    }
  }

  function rateLimitActivity() {
    const now = Date.now();
    const cutoff = now - 60000;
    state.activityBucket = state.activityBucket.filter(t => t > cutoff);
    if (state.activityBucket.length >= MAX_ACTIVITY_PER_MINUTE) return false;
    state.activityBucket.push(now);
    return true;
  }

  async function logActivity(action, entity, entityId, detail) {
    if (!ALLOWED_ACTIONS.has(action)) return { ok: false, error: 'invalid action' };
    if (!isReady()) return { ok: false, error: 'Not signed in' };
    if (!rateLimitActivity()) return { ok: false, error: 'rate limited' };
    const client = getClient(); if (!client) return { ok: false, error: 'No client' };
    try {
      const { error } = await client.from('nexus_activity').insert({
        action,
        entity: entity || null,
        entity_id: entityId || null,
        detail: typeof detail === 'string' ? detail : JSON.stringify(detail || {}),
      });
      if (error) throw new Error(error.message);
      return { ok: true };
    } catch (err) { return { ok: false, error: err.message }; }
  }

  async function attachGenerationToFeedback(chatId, messageIndex, vote) {
    if (!isReady()) return { ok: false, error: 'Not signed in' };
    const client = getClient(); if (!client) return { ok: false, error: 'No client' };
    const chat = window.__nexus?.state?.chats?.find(c => c.id === chatId);
    if (!chat) return { ok: false, error: 'Chat not found' };
    const msg = chat.messages[messageIndex];
    if (!msg || msg.role !== 'assistant') return { ok: false, error: 'Not an assistant message' };
    try {
      let genId = msg._generationId;
      if (!genId) {
        const { data: existing, error: chkErr } = await client
          .from('nexus_generations')
          .select('id')
          .eq('chat_id', chatId).eq('message_index', messageIndex)
          .limit(1);
        if (chkErr) throw new Error('nexus_generations check: ' + chkErr.message);
        if (existing && existing.length) genId = existing[0].id;
        else {
          const { data: gen, error: genErr } = await client.from('nexus_generations').insert({
            chat_id: chatId,
            message_index: messageIndex,
            model: msg.model || 'unknown',
          }).select('id').single();
          if (genErr) throw new Error('nexus_generations insert: ' + genErr.message);
          genId = gen.id;
        }
        msg._generationId = genId;
        window.__nexus?.persistChats?.();
      }
      const { error: fbErr } = await client.from('nexus_feedback').upsert({
        generation_id: genId,
        vote,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'generation_id' });
      if (fbErr) throw new Error('nexus_feedback upsert: ' + fbErr.message);
      return { ok: true, generationId: genId };
    } catch (err) { return { ok: false, error: err.message }; }
  }

  function bindHooks() {
    if (!window.__nexus?.hooks) return;
    if (Array.isArray(window.__nexus.hooks.beforeMessageSend)) {
      window.__nexus.hooks.beforeMessageSend.push((chat) => {
        if (!chat || !isReady()) return;
        logActivity('message_sent', 'chat', chat.id, { model: window.__nexus.state.activeModel?.id, messageCount: chat.messages.length });
        schedulePushChat(chat.id);
      });
    }
    if (Array.isArray(window.__nexus.hooks.afterMessageSend)) {
      window.__nexus.hooks.afterMessageSend.push((chat) => {
        if (!chat || !isReady()) return;
        const last = chat.messages[chat.messages.length - 1];
        logActivity('message_received', 'chat', chat.id, { model: last?.model, ok: !last?.error, tokens: last?.usage?.total_tokens || 0 });
        schedulePushChat(chat.id);
      });
    }
    if (Array.isArray(window.__nexus.hooks.afterMessageElement)) {
      window.__nexus.hooks.afterMessageElement.push((wrapper, msg, index, chat) => {
        if (wrapper.dataset.nxCloudConvWired) return;
        wrapper.dataset.nxCloudConvWired = '1';
        wrapper.querySelectorAll('.nx-rating-btn').forEach((btn, i) => {
          btn.addEventListener('click', () => {
            const vote = i === 0 ? 1 : -1;
            setTimeout(() => attachGenerationToFeedback(chat.id, index, vote), 800);
            logActivity('rating_given', 'chat', chat.id, { model: msg.model, vote });
          });
        });
      });
    }
    window.addEventListener('nexus:auth-changed', (e) => {
      if (e.detail?.user) {
        setTimeout(() => {
          if (isReady()) {
            const chats = window.__nexus?.state?.chats || [];
            if (chats.length) {
              logActivity('sync_push', 'app', null, { chatCount: chats.length, initial: true });
              pushAllChats();
            }
          }
        }, 2000);
      }
    });
  }

  function ready(fn) {
    if (window.__nexus && window.__nexus.ready) return fn();
    window.addEventListener('nexus:ready', fn, { once: true });
  }
  ready(() => {
    bindHooks();
    setTimeout(() => {
      if (isReady()) {
        const chats = window.__nexus?.state?.chats || [];
        if (chats.length) pushAllChats();
      }
    }, 5000);
  });

  window.Nexus = window.Nexus || {};
  window.Nexus.CloudConversations = {
    pushChat, pushAllChats, syncFromCloud, logActivity,
    attachGenerationToFeedback,
    getLastResult: () => state.lastResult,
    schedulePushChat,
  };
})();
