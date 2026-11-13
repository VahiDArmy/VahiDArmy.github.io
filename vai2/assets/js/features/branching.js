/* ============================================================
   NEXUS CHAT — BRANCHING & REGENERATE
   - Fork a conversation from any message ("branch")
   - Regenerate an assistant response (either from existing
     context, or by re-sending the prior user prompt)
   - Copy-context menu on any message
   - Branch metadata stored on chat objects (parentChatId,
     branchedFromIndex)
   ============================================================ */
(function () {
  'use strict';

  if (window.__nexus_branching_loaded__) return;
  window.__nexus_branching_loaded__ = true;

  function ready(fn) {
    if (window.__nexus && window.__nexus.ready) return fn();
    window.addEventListener('nexus:ready', fn, { once: true });
  }

  ready(() => {
    window.__nexus.hooks.afterMessageElement.push(decorateMessage);
    // Re-render to apply decorations on current chat
    if (window.__nexus.state.activeChatId) {
      window.__nexus.renderActiveChat();
    }
  });

  /* ---------- Decorate each message with extra actions ---------- */
  function decorateMessage(wrapper, msg, index, chat) {
    // Idempotence: skip if already decorated
    if (wrapper.querySelector('.nx-message-extra-actions')) return;

    const body = wrapper.querySelector('.message-body');
    if (!body) return;

    const actions = document.createElement('div');
    actions.className = 'nx-message-extra-actions';

    if (msg.role === 'user') {
      // Fork from this user message
      const forkBtn = document.createElement('button');
      forkBtn.className = 'nx-msg-extra-btn accent';
      forkBtn.title = 'Branch this conversation from this message';
      forkBtn.innerHTML = '⑂ Branch here';
      forkBtn.addEventListener('click', () => branchFromMessage(chat, index));
      actions.appendChild(forkBtn);

      // Regenerate response to this prompt
      const regenBtn = document.createElement('button');
      regenBtn.className = 'nx-msg-extra-btn warning';
      regenBtn.title = 'Ask the model again from this point';
      regenBtn.innerHTML = '↻ Regenerate';
      regenBtn.addEventListener('click', () => regenerateFromUserMessage(chat, index));
      actions.appendChild(regenBtn);
    }

    if (msg.role === 'assistant') {
      // Regenerate this specific response
      const regenBtn = document.createElement('button');
      regenBtn.className = 'nx-msg-extra-btn warning';
      regenBtn.title = 'Regenerate this response';
      regenBtn.innerHTML = '↻ Regenerate';
      regenBtn.addEventListener('click', () => regenerateAssistantMessage(chat, index));
      actions.appendChild(regenBtn);

      // Edit context: let user re-send the prior prompt (edit then submit)
      const editPrevBtn = document.createElement('button');
      editPrevBtn.className = 'nx-msg-extra-btn';
      editPrevBtn.title = 'Edit the prompt that produced this response';
      editPrevBtn.innerHTML = '✎ Edit prompt';
      editPrevBtn.addEventListener('click', () => {
        const prevIdx = findPreviousUserIndex(chat, index);
        if (prevIdx === -1) {
          window.__nexus.showToast('No prior prompt found', 'warning', 2000);
          return;
        }
        // Truncate and open in edit mode via existing feature
        window.__nexus.state.activeChatId = chat.id;
        const inputEl = document.getElementById('chatInput');
        const prevMsg = chat.messages[prevIdx];
        if (inputEl) {
          inputEl.value = prevMsg.content;
          inputEl.focus();
          inputEl.style.height = 'auto';
          inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + 'px';
        }
        window.__nexus.state.editingMessage = {
          chatId: chat.id,
          messageIndex: prevIdx,
          originalContent: prevMsg.content,
        };
        const sendBtn = document.getElementById('sendBtn');
        if (sendBtn) {
          sendBtn.title = 'Update message';
          sendBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 8l4 4 8-8"/></svg>`;
        }
        window.__nexus.showToast('Editing prompt — send to regenerate', 'warning', 3500);
      });
      actions.appendChild(editPrevBtn);

      // Branch from this assistant message
      const forkBtn = document.createElement('button');
      forkBtn.className = 'nx-msg-extra-btn accent';
      forkBtn.title = 'Branch the conversation from here';
      forkBtn.innerHTML = '⑂ Branch here';
      forkBtn.addEventListener('click', () => branchFromMessage(chat, index));
      actions.appendChild(forkBtn);
    }

    body.appendChild(actions);
  }

  /* ---------- Helpers ---------- */
  function findPreviousUserIndex(chat, assistantIndex) {
    for (let i = assistantIndex - 1; i >= 0; i--) {
      if (chat.messages[i].role === 'user') return i;
    }
    return -1;
  }

  /* ---------- Branch from a message ---------- */
  function branchFromMessage(chat, messageIndex) {
    const sourceChat = chat;
    const cutoff = Math.min(messageIndex + 1, sourceChat.messages.length);

    // Ask how to branch
    const choice = window.prompt(
      'Branch conversation:\n\n' +
      '• Enter or type "copy" = start new chat with messages up to this point\n' +
      '• Type "keep" = fork source is retained and linked\n',
      'copy'
    );
    if (choice === null) return;

    const clone = {
      id: window.__nexus.uid(),
      title: `Branch of: ${sourceChat.title}`.slice(0, 60),
      messages: sourceChat.messages.slice(0, cutoff).map(m => ({ ...m })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      parentChatId: sourceChat.id,
      branchedFromIndex: messageIndex,
    };

    window.__nexus.state.chats.unshift(clone);
    window.__nexus.state.activeChatId = clone.id;
    window.__nexus.persistChats();
    window.__nexus.renderChatList();
    window.__nexus.renderActiveChat();
    window.__nexus.showToast(`Branched into new chat (${cutoff} messages)`, 'success', 2500);
  }

  /* ---------- Regenerate from a user message ---------- */
  async function regenerateFromUserMessage(chat, userIndex) {
    const userMsg = chat.messages[userIndex];
    if (!userMsg || userMsg.role !== 'user') return;

    if (!confirm(
      `Regenerate from this prompt?\n\n` +
      `All messages after this point (${chat.messages.length - userIndex - 1}) will be removed ` +
      `and the model will be asked again.`
    )) return;

    // Truncate: keep up to and including this user message
    chat.messages = chat.messages.slice(0, userIndex + 1);
    chat.updatedAt = new Date().toISOString();
    window.__nexus.persistChats();
    window.__nexus.renderActiveChat();

    // Trigger the assistant call directly
    await window.__nexus.streamAssistantResponse(chat);
  }

  /* ---------- Regenerate a specific assistant message ---------- */
  async function regenerateAssistantMessage(chat, assistantIndex) {
    const msg = chat.messages[assistantIndex];
    if (!msg || msg.role !== 'assistant') return;

    const prevUserIdx = findPreviousUserIndex(chat, assistantIndex);
    if (prevUserIdx === -1) {
      window.__nexus.showToast('No prior prompt to regenerate from', 'warning', 2500);
      return;
    }

    if (!confirm(
      `Regenerate this response?\n\n` +
      `Current response will be removed, plus ${chat.messages.length - assistantIndex - 1} ` +
      `message(s) after it.`
    )) return;

    // Truncate: keep everything up to (and including) the preceding user message
    chat.messages = chat.messages.slice(0, prevUserIdx + 1);
    chat.updatedAt = new Date().toISOString();
    window.__nexus.persistChats();
    window.__nexus.renderActiveChat();

    await window.__nexus.streamAssistantResponse(chat);
  }

  /* ---------- Public API ---------- */
  window.Nexus = window.Nexus || {};
  window.Nexus.Branching = {
    branchFromMessage,
    regenerateFromUserMessage,
    regenerateAssistantMessage,
  };
})();
