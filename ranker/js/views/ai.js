(function () {
  const T3D = window.T3D;
  const { h, esc, md } = T3D.lib;
  const CFG = T3D.CONFIG;

  T3D.router.register('ai', async function (root) {
    const st = T3D.state;
    const layout = h('div', { class: 'ai-layout' });
    const convsPanel = h('div', { class: 'ai-convs' },
      h('div', { class: 'pane-head' },
        h('div', { class: 'pane-title' }, 'Chats'),
        h('button', { class: 'icon-btn', title: 'New', onclick: newChat }, h('i', { class: 'fa-solid fa-plus' }))
      )
    );
    const convList = h('div', { class: 'ai-conv-list' });
    convsPanel.appendChild(convList);
    const chatPanel = h('div', { class: 'ai-chat' });
    const modelBar = h('div', { class: 'ai-model-bar' });
    const msgsEl = h('div', { class: 'ai-msgs' });
    const inputRow = h('div', { class: 'ai-input-row' });
    chatPanel.appendChild(modelBar);
    chatPanel.appendChild(msgsEl);
    chatPanel.appendChild(inputRow);
    layout.appendChild(convsPanel);
    layout.appendChild(chatPanel);
    root.appendChild(h('div', { class: 'view' }, layout));

    // Model selection
    const modelSel = h('select', { class: 'select' });
    CFG.FREE_MODELS.forEach(m => {
      const o = h('option', { value: m }, m);
      if (m === T3D.store.get('openrouter_model', CFG.DEFAULT_MODEL)) o.selected = true;
      modelSel.appendChild(o);
    });
    const customModel = h('input', { class: 'input', style: { maxWidth: '180px', padding: '6px 10px', fontSize: '12px' }, placeholder: 'custom model…' });
    modelSel.onchange = () => { T3D.store.set('openrouter_model', modelSel.value); T3D.sound.clink(0.06); };
    const keyBtn = h('button', { class: 'btn', style: { padding: '6px 10px', fontSize: '12px' } }, 'API key');
    keyBtn.onclick = T3D.modal.openSettings;
    modelBar.appendChild(h('span', { class: 'muted', style: { fontSize: '12px', fontWeight: '600' } }, 'Model:'));
    modelBar.appendChild(modelSel);
    modelBar.appendChild(customModel);
    modelBar.appendChild(h('div', { style: { flex: 1 } }));
    modelBar.appendChild(keyBtn);

    // Input
    const textarea = h('textarea', { class: 'textarea', rows: '1', placeholder: 'Ask about your ranking data…' });
    const sendBtn = h('button', { class: 'btn primary', style: { padding: '10px 16px' } }, h('i', { class: 'fa-solid fa-paper-plane' }));
    inputRow.appendChild(textarea);
    inputRow.appendChild(sendBtn);

    let currentConv = null;
    let messages = [];

    function newChat() {
      currentConv = null;
      messages = [];
      renderMessages();
      textarea.focus();
      T3D.sound.clink(0.1);
    }

    async function loadConvs() {
      convList.innerHTML = '';
      try {
        const convs = await T3D.api.listConvs();
        T3D.setState({ aiConvs: convs });
        if (!convs.length) {
          convList.appendChild(h('div', { class: 'empty', style: { padding: '20px' } }, h('div', null, 'No chats yet')));
          return;
        }
        convs.forEach(c => {
          const item = h('div', { class: 'ai-conv-item' + (currentConv && currentConv.id === c.id ? ' active' : '') },
            h('i', { class: 'fa-solid fa-comment' }),
            h('span', { class: 't' }, c.title || 'Untitled'),
            h('button', { class: 'icon-btn', style: { width: '26px', height: '26px' }, onclick: async (e) => { e.stopPropagation(); if (await T3D.modal.confirmDialog('Delete this chat?')) { await T3D.api.deleteConv(c.id); if (currentConv && currentConv.id === c.id) newChat(); loadConvs(); } } }, h('i', { class: 'fa-solid fa-trash', style: { fontSize: '11px' } }))
          );
          item.onclick = () => loadConv(c);
          convList.appendChild(item);
        });
      } catch (e) {
        convList.appendChild(h('div', { class: 'empty' }, h('div', null, 'Sign in to save chats')));
      }
    }

    async function loadConv(c) {
      currentConv = c;
      const msgs = await T3D.api.listMessages(c.id);
      messages = msgs.map(m => ({ role: m.role, content: m.content, reasoning: m.reasoning }));
      renderMessages();
      loadConvs();
    }

    function renderMessages() {
      msgsEl.innerHTML = '';
      if (!messages.length) {
        msgsEl.appendChild(h('div', { class: 'empty' },
          h('i', { class: 'fa-solid fa-wand-magic-sparkles' }),
          h('div', null, 'Ask TRIAD AI about your rankings'),
          h('div', { class: 'muted', style: { fontSize: '12px', maxWidth: '360px' } }, 'Examples: "Who has the most consistent ratings?" or "Which trait is most contested?"')
        ));
        // Quick prompts
        const row = h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '12px' } });
        [
          'Summarize the group dynamics',
          'Which trait is most disputed?',
          'Who is the most polarizing person?',
          'Recommend team pairings'
        ].forEach(p => {
          const b = h('button', { class: 'chip', style: { cursor: 'pointer' } }, p);
          b.onclick = () => { textarea.value = p; send(); };
          row.appendChild(b);
        });
        msgsEl.appendChild(row);
        return;
      }
      messages.forEach(m => {
        const el = h('div', { class: 'ai-msg ' + m.role });
        el.innerHTML = md(m.content || '');
        if (m.reasoning) {
          el.appendChild(h('div', { class: 'reasoning' }, m.reasoning));
        }
        msgsEl.appendChild(el);
      });
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }

    function buildSystemPrompt() {
      const st = T3D.state;
      let data = 'TRIAD personality ranking dataset.\n\nTraits:\n';
      st.traits.forEach(t => { data += `- ${t.name}: ${t.description || ''}\n`; });
      data += '\nPeople:\n';
      st.people.forEach(p => {
        const avg = T3D.derive.avgReceived(p.id);
        data += `- ${p.full_name} (avg received: ${avg == null ? 'N/A' : avg.toFixed(1)})\n`;
      });
      data += '\nScore rows (rater -> ratee [trait]: score):\n';
      st.scores.slice(0, 200).forEach(s => {
        const rater = T3D.derive.personById(s.rater_person_id);
        const ratee = T3D.derive.personById(s.ratee_person_id);
        const trait = T3D.derive.traitById(s.trait_id);
        if (rater && ratee && trait) data += `${rater.full_name} -> ${ratee.full_name} [${trait.name}]: ${s.score}\n`;
      });
      return 'You are TRIAD AI, a sharp analyst. Given the dataset below, answer the user\'s question with concrete observations, numbers, and actionable insight. Keep answers concise and structured.\n\n' + data;
    }

    async function send() {
      const text = textarea.value.trim();
      if (!text) return;
      const key = T3D.store.get('openrouter_key', '');
      if (!key) { T3D.toast('Add your OpenRouter API key in Settings', 'error'); T3D.modal.openSettings(); return; }
      textarea.value = '';
      messages.push({ role: 'user', content: text });
      renderMessages();
      T3D.sound.clink(0.1);

      // Ensure conversation exists
      if (!currentConv) {
        try {
          const model = T3D.store.get('openrouter_model', CFG.DEFAULT_MODEL);
          currentConv = await T3D.api.createConv(model, text.slice(0, 40));
        } catch (e) {
          // Fall back to local-only conversation
          currentConv = { id: null, local: true };
        }
      }
      if (currentConv.id) {
        try { await T3D.api.addMessage(currentConv.id, 'user', text); } catch {}
      }

      const assistantEl = h('div', { class: 'ai-msg assistant' });
      assistantEl.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;display:inline-block;vertical-align:middle"></span> thinking…';
      msgsEl.appendChild(assistantEl);
      msgsEl.scrollTop = msgsEl.scrollHeight;

      try {
        const model = customModel.value.trim() || T3D.store.get('openrouter_model', CFG.DEFAULT_MODEL);
        const sys = buildSystemPrompt();
        const apiMessages = [
          { role: 'system', content: sys },
          ...messages.map(m => ({ role: m.role, content: m.content }))
        ];
        const resp = await fetch(CFG.OPENROUTER_URL + '/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + key,
            'HTTP-Referer': location.origin,
            'X-Title': 'TRIAD'
          },
          body: JSON.stringify({
            model,
            messages: apiMessages,
            temperature: 0.7,
            max_tokens: 1024,
            reasoning: { enabled: false }
          })
        });
        if (!resp.ok) {
          const err = await resp.text();
          throw new Error(err.slice(0, 300));
        }
        const data = await resp.json();
        const msg = data.choices && data.choices[0] && data.choices[0].message;
        const content = (msg && msg.content) || '(empty)';
        const reasoning = msg && (msg.reasoning || msg.reasoning_content);
        messages.push({ role: 'assistant', content, reasoning });
        assistantEl.innerHTML = md(content);
        if (reasoning) assistantEl.appendChild(h('div', { class: 'reasoning' }, reasoning));
        if (currentConv.id) {
          try { await T3D.api.addMessage(currentConv.id, 'assistant', content, reasoning); } catch {}
        }
        T3D.sound.chime(0.08);
      } catch (e) {
        assistantEl.innerHTML = '<span style="color:var(--red)">Error: ' + esc(e.message || String(e)) + '</span>';
        T3D.toast('AI error', 'error');
      }
      msgsEl.scrollTop = msgsEl.scrollHeight;
      loadConvs();
    }

    sendBtn.onclick = send;
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
      // auto-resize
    });
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(160, textarea.scrollHeight) + 'px';
    });

    // Prefill from modal.openAIInsight
    const prefill = T3D.store.get('ai_prefill', '');
    if (prefill) {
      T3D.store.del('ai_prefill');
      textarea.value = prefill;
      setTimeout(send, 60);
    }

    renderMessages();
    loadConvs();
  });
})();
