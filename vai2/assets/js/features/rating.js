/* ============================================================
   NEXUS CHAT — RESPONSE RATING
   Thumbs up/down on assistant messages, persisted to
   nexus_generations + nexus_feedback via Supabase (per-user).
   ============================================================ */
(function () {
  'use strict';
  if (window.__nexus_rating_loaded__) return;
  window.__nexus_rating_loaded__ = true;

  const STORAGE_KEY = 'nexus_pending_ratings_v1';

  const state = {
    pendingSync: [],
    isSyncing: false,
    lastSyncAt: null,
    stats: { total: 0, up: 0, down: 0, lastError: null },
  };

  /* ============================================================
     CSS
     ============================================================ */
  function injectStyles() {
    if (document.getElementById('nx-rating-styles')) return;
    const css = `
.nx-rating-bar{display:inline-flex;align-items:center;gap:2px;margin-top:6px;opacity:0;transition:opacity .2s;}
.message:hover .nx-rating-bar, .nx-rating-bar.has-rating{opacity:1;}
.nx-rating-btn{width:30px;height:30px;border-radius:6px;border:1px solid var(--border-subtle);background:var(--bg-tertiary);color:var(--text-tertiary);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:all .15s;padding:0;}
.nx-rating-btn:hover{background:var(--bg-hover);color:var(--text-primary);border-color:var(--border-strong);transform:scale(1.06);}
.nx-rating-btn:active{transform:scale(.94);}
.nx-rating-btn.active-up{background:rgba(0,184,148,.2);border-color:var(--success);color:var(--success);box-shadow:0 0 8px rgba(0,184,148,.3);}
.nx-rating-btn.active-down{background:rgba(225,112,85,.2);border-color:var(--danger);color:var(--danger);box-shadow:0 0 8px rgba(225,112,85,.3);}
.nx-rating-sync{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;margin-left:4px;font-size:10px;color:var(--text-tertiary);transition:color .2s;}
.nx-rating-sync.synced{color:var(--success);}
.nx-rating-sync.pending{color:var(--warning);}
.nx-rating-sync.error{color:var(--danger);}
.nx-rating-stats{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;background:var(--bg-tertiary);border:1px solid var(--border-subtle);border-radius:100px;font-size:10px;font-family:var(--font-mono);color:var(--text-tertiary);cursor:help;}
.nx-rating-stats .up{color:var(--success);} .nx-rating-stats .down{color:var(--danger);}
.nx-rating-stats .sep{color:var(--border-strong);}
`;
    const style = document.createElement('style');
    style.id = 'nx-rating-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ============================================================
     READY
     ============================================================ */
  function ready(fn) {
    if (window.__nexus && window.__nexus.ready) return fn();
    window.addEventListener('nexus:ready', fn, { once: true });
  }

  ready(() => {
    injectStyles();
    loadPending();
    loadStats();
    hookMessages();
    mountStatsPill();
    syncPending();
    setInterval(syncPending, 60000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') syncPending();
    });
  });

  /* ============================================================
     STORAGE
     ============================================================ */
  function loadPending() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) state.pendingSync = arr;
      }
    } catch (e) {}
  }
  function savePending() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.pendingSync)); } catch (e) {}
  }
  function loadStats() {
    try {
      const raw = localStorage.getItem('nexus_rating_stats_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        Object.assign(state.stats, parsed);
      }
    } catch (e) {}
  }
  function saveStats() {
    try { localStorage.setItem('nexus_rating_stats_v1', JSON.stringify(state.stats)); } catch (e) {}
  }

  /* ============================================================
     HOOKS
     ============================================================ */
  function hookMessages() {
    if (!window.__nexus || !window.__nexus.hooks) return;
    const hooks = window.__nexus.hooks;
    if (!Array.isArray(hooks.afterMessageElement)) return;
    if (hooks.afterMessageElement.__rating_hooked__) return;
    hooks.afterMessageElement.push(decorateMessageWithRating);
    hooks.afterMessageElement.__rating_hooked__ = true;
    if (window.__nexus.state.activeChatId) {
      window.__nexus.renderActiveChat();
    }
  }

  function decorateMessageWithRating(wrapper, msg, index, chat) {
    if (msg.role !== 'assistant') return;
    if (msg.streaming) return;
    if (wrapper.querySelector('.nx-rating-bar')) return;

    const body = wrapper.querySelector('.message-body');
    if (!body) return;

    const bar = document.createElement('div');
    bar.className = 'nx-rating-bar';
    if (msg.rating) bar.classList.add('has-rating');

    const upBtn = document.createElement('button');
    upBtn.className = 'nx-rating-btn' + (msg.rating === 1 ? ' active-up' : '');
    upBtn.type = 'button';
    upBtn.title = 'Good response';
    upBtn.setAttribute('aria-label', 'Rate positive');
    upBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M6.5 2.5v8.5h-3a1 1 0 01-1-1V8c0-.55.45-1 1-1h2l1.5-3.5a1.2 1.2 0 011.1-.7h.4c.7 0 1.2.7.9 1.3L8 7h4.3c.9 0 1.5.8 1.3 1.6l-1 4.5c-.15.55-.65.9-1.2.9H6.5z"/>
      </svg>`;
    upBtn.addEventListener('click', () => handleRate(chat, index, msg, 1));

    const downBtn = document.createElement('button');
    downBtn.className = 'nx-rating-btn' + (msg.rating === -1 ? ' active-down' : '');
    downBtn.type = 'button';
    downBtn.title = 'Bad response';
    downBtn.setAttribute('aria-label', 'Rate negative');
    downBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M9.5 13.5v-8.5h3a1 1 0 011 1V8c0 .55-.45 1-1 1h-2l-1.5 3.5a1.2 1.2 0 01-1.1.7h-.4c-.7 0-1.2-.7-.9-1.3L8 9H3.7c-.9 0-1.5-.8-1.3-1.6l1-4.5c.15-.55.65-.9 1.2-.9H9.5z"/>
      </svg>`;
    downBtn.addEventListener('click', () => handleRate(chat, index, msg, -1));

    bar.appendChild(upBtn);
    bar.appendChild(downBtn);

    if (msg.rating) {
      const sync = document.createElement('span');
      sync.className = 'nx-rating-sync';
      if (msg._ratingSynced) {
        sync.classList.add('synced');
        sync.textContent = '✓';
        sync.title = 'Synced to cloud';
      } else if (msg._ratingSyncError) {
        sync.classList.add('error');
        sync.textContent = '!';
        sync.title = 'Sync failed: ' + (msg._ratingSyncError || 'unknown');
      } else {
        sync.classList.add('pending');
        sync.textContent = '⟳';
        sync.title = 'Pending sync';
      }
      bar.appendChild(sync);
    }

    body.appendChild(bar);
  }

  /* ============================================================
     HANDLE CLICK
     ============================================================ */
  function handleRate(chat, messageIndex, msg, vote) {
    const newVote = msg.rating === vote ? 0 : vote;
    msg.rating = newVote || undefined;
    if (!newVote) delete msg.rating;

    if (newVote) {
      state.stats.total++;
      if (newVote === 1) state.stats.up++;
      else state.stats.down++;
      saveStats();
    }

    window.__nexus.persistChats();
    window.__nexus.renderActiveChat();
    updateStatsPill();

    if (newVote) {
      queueSync(chat, messageIndex, msg, newVote);
      window.__nexus.showToast(newVote === 1 ? 'Rated positive' : 'Rated negative', 'success', 1400);
    } else {
      window.__nexus.showToast('Rating removed', 'info', 1400);
    }
  }

  /* ============================================================
     SUPABASE SYNC
     ============================================================ */
  function queueSync(chat, msgIndex, msg, vote) {
    const ratingKey = `${chat.id}::${msgIndex}`;
    state.pendingSync = state.pendingSync.filter(p => p.key !== ratingKey);
    state.pendingSync.push({
      key: ratingKey,
      chatId: chat.id,
      msgIndex,
      generationId: msg._generationId || null,
      vote,
      model: msg.model || 'unknown',
      createdAt: new Date().toISOString(),
      attempts: 0,
    });
    savePending();
    syncPending();
  }

  async function syncPending() {
    if (state.isSyncing) return;
    if (!state.pendingSync.length) return;
    if (!window.supabase) return;
    // Auth gate: only sync when signed in
    const cloudStatus = window.Nexus?.Cloud?.getStatus?.();
    if (!cloudStatus?.authenticated) return;

    state.isSyncing = true;
    state.stats.lastError = null;

    const stillPending = [];
    for (const item of state.pendingSync) {
      try {
        await syncOne(item);
        markMessageSynced(item.chatId, item.msgIndex, true, null);
      } catch (err) {
        item.attempts++;
        item.lastError = err.message || String(err);
        state.stats.lastError = item.lastError;
        markMessageSynced(item.chatId, item.msgIndex, false, item.lastError);
        if (item.attempts < 5) stillPending.push(item);
      }
    }

    state.pendingSync = stillPending;
    savePending();
    state.lastSyncAt = new Date().toISOString();
    state.isSyncing = false;
  }

  async function syncOne(item) {
    if (!window.supabase) throw new Error('Supabase not available');
    const cloud = window.Nexus?.Cloud?.getStatus?.();
    if (!cloud?.authenticated) throw new Error('Not signed in');

    let genId = item.generationId;
    if (!genId) {
      const { data: existing, error: chkErr } = await window.supabase
        .from('nexus_generations')
        .select('id')
        .eq('chat_id', item.chatId)
        .eq('message_index', item.msgIndex)
        .limit(1);
      if (chkErr) throw new Error('nexus_generations check: ' + chkErr.message);

      if (existing && existing.length) {
        genId = existing[0].id;
      } else {
        const { data: gen, error: genErr } = await window.supabase
          .from('nexus_generations')
          .insert({
            chat_id: item.chatId,
            message_index: item.msgIndex,
            model: item.model || 'unknown',
          })
          .select('id')
          .single();
        if (genErr) throw new Error('nexus_generations insert: ' + genErr.message);
        genId = gen.id;
      }

      item.generationId = genId;
      const chat = window.__nexus.state.chats.find(c => c.id === item.chatId);
      if (chat && chat.messages[item.msgIndex]) {
        chat.messages[item.msgIndex]._generationId = genId;
        window.__nexus.persistChats();
      }
    }

    const { error: fbErr } = await window.supabase
      .from('nexus_feedback')
      .upsert({
        generation_id: genId,
        vote: item.vote,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'generation_id' });
    if (fbErr) throw new Error('nexus_feedback upsert: ' + fbErr.message);
  }

  function markMessageSynced(chatId, msgIndex, synced, errorMsg) {
    const chat = window.__nexus.state.chats.find(c => c.id === chatId);
    if (!chat || !chat.messages[msgIndex]) return;
    const msg = chat.messages[msgIndex];
    if (synced) {
      msg._ratingSynced = true;
      delete msg._ratingSyncError;
    } else {
      msg._ratingSyncError = errorMsg;
    }
    window.__nexus.persistChats();
    if (window.__nexus.state.activeChatId === chatId) {
      window.__nexus.renderActiveChat();
    }
  }

  /* ============================================================
     STATS PILL
     ============================================================ */
  function mountStatsPill() {
    const container = document.getElementById('contextReport');
    if (!container) return;
    if (container.querySelector('.nx-rating-stats')) return;
    const pill = document.createElement('div');
    pill.className = 'nx-rating-stats';
    pill.id = 'nxRatingStats';
    pill.title = 'Ratings across all chats';
    updateStatsPillEl(pill);
    container.appendChild(pill);
  }

  function updateStatsPill() {
    const pill = document.getElementById('nxRatingStats');
    if (pill) updateStatsPillEl(pill);
  }

  function updateStatsPillEl(pill) {
    if (!state.stats.total) {
      pill.style.display = 'none';
      return;
    }
    pill.style.display = 'inline-flex';
    pill.innerHTML = `
      <span class="up">▲ ${state.stats.up}</span>
      <span class="sep">·</span>
      <span class="down">▼ ${state.stats.down}</span>
    `;
  }

  /* ============================================================
     PUBLIC API
     ============================================================ */
  window.Nexus = window.Nexus || {};
  window.Nexus.Rating = {
    rate: (chatId, messageIndex, vote) => {
      const chat = window.__nexus.state.chats.find(c => c.id === chatId);
      if (!chat || !chat.messages[messageIndex]) return;
      handleRate(chat, messageIndex, chat.messages[messageIndex], vote);
    },
    getRating: (chatId, messageIndex) => {
      const chat = window.__nexus.state.chats.find(c => c.id === chatId);
      if (!chat || !chat.messages[messageIndex]) return 0;
      return chat.messages[messageIndex].rating || 0;
    },
    getStats: () => ({
      ...state.stats,
      pending: state.pendingSync.length,
      lastSyncAt: state.lastSyncAt,
    }),
    syncPending,
  };
})();
