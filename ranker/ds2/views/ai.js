import { store } from '../lib/store.js';
import { supabase } from '../lib/supabase.js';
import { Sound } from '../lib/sound.js';
import { esc, toast } from '../lib/ui.js';
import { chatAI, getApiKey, setApiKey, getModel, setModel, listModels } from '../lib/ai.js';

export default function AIView(root) {
  const historyKey = `mx_chat_${store.user.id}`;
  let messages = JSON.parse(localStorage.getItem(historyKey) || '[]');
  if (!messages.length) {
    messages.push({
      role: 'assistant',
      content: 'MATRIX·3D analyst online. Ask anything about the cube — top targets, trait overlap, who scores unusually, patterns across rankers, or what the AI notices that the heatmaps hide.'
    });
  }
  let models = [];
  let activeModel = getModel();
  let streaming = false;

  root.innerHTML = `
    <div class="ai-layout">
      <aside class="ai-side">
        <div class="ai-side-title">Models</div>
        <div id="ai-models"></div>
        <div class="ai-side-title">API key</div>
        <input class="search-input" id="ai-key" placeholder="sk-or-v1-…" style="width:100%;font-family:var(--mono);font-size:11px" value="${esc(getApiKey())}" type="password">
        <button class="btn btn-ghost" id="ai-key-save" style="margin-top:8px;width:100%;font-size:12px">Save key</button>
        <div class="ai-side-title">Actions</div>
        <button class="btn btn-ghost" id="ai-clear" style="width:100%;font-size:12px;text-align:left"><i class="fa-solid fa-trash"></i> Clear chat</button>
        <button class="btn btn-ghost" id="ai-summary" style="width:100%;font-size:12px;text-align:left;margin-top:6px"><i class="fa-solid fa-chart-simple"></i> Analyse cube</button>
      </aside>

      <section class="ai-chat">
        <div class="ai-messages" id="ai-messages"></div>
        <div class="ai-input-wrap">
          <textarea class="ai-input" id="ai-input" placeholder="Ask MATRIX·3D…"></textarea>
          <button class="ai-send" id="ai-send" title="Send"><i class="fa-solid fa-paper-plane"></i></button>
        </div>
      </section>

      <aside class="ai-context">
        <div class="ai-context-section">
          <div class="ai-context-title">Cube</div>
          <ul>
            <li><span>people</span><b>${store.people.length}</b></li>
            <li><span>traits</span><b>${store.traits.length}</b></li>
            <li><span>scores</span><b>${store.scores.length}</b></li>
            <li><span>coverage</span><b>${store.coverage()}%</b></li>
          </ul>
        </div>
        <div class="ai-context-section">
          <div class="ai-context-title">Top received</div>
          <ul>
            ${[...store.people].map(p => ({ p, avg: store.averageReceived(p.id) }))
              .filter(x => x.avg !== null).sort((a, b) => b.avg - a.avg).slice(0, 5)
              .map(x => `<li><span style="overflow:hidden;text-overflow:ellipsis">${esc(x.p.full_name)}</span><b style="color:${x.avg > 0 ? '#4ade80' : '#f43f5e'}">${x.avg.toFixed(1)}</b></li>`).join('') || '<li><span>—</span></li>'}
          </ul>
        </div>
        <div class="ai-context-section">
          <div class="ai-context-title">Trait avg</div>
          <ul>
            ${store.traits.slice(0, 6).map(t => {
              const ss = store.scores.filter(s => s.trait_id === t.id);
              const avg = ss.length ? ss.reduce((a, s) => a + Number(s.score), 0) / ss.length : 0;
              return `<li><span style="overflow:hidden;text-overflow:ellipsis;color:${esc(t.color || '#a855f7')}">${esc(t.name)}</span><b>${avg.toFixed(1)}</b></li>`;
            }).join('') || '<li><span>—</span></li>'}
          </ul>
        </div>
      </aside>
    </div>
  `;

  const messagesEl = root.querySelector('#ai-messages');
  const inputEl = root.querySelector('#ai-input');
  const sendBtn = root.querySelector('#ai-send');
  const modelsEl = root.querySelector('#ai-models');

  function renderMessages() {
    messagesEl.innerHTML = messages.map(m => {
      if (m.role === 'assistant' && !m.content && !m._typing) return '';
      const content = m.content || '';
      return `<div class="ai-msg ${m.role} ${m._error ? 'error' : ''}">${renderMd(content)}</div>`;
    }).join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderMd(text) {
    let html = esc(text);
    html = html.replace(/```([\s\S]*?)```/g, (_, c) => `<pre>${c}</pre>`);
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    return html;
  }

  function renderModels() {
    modelsEl.innerHTML = models.map(m => `
      <div class="ai-model ${m.slug === activeModel ? 'active' : ''}" data-slug="${esc(m.slug)}">
        <div class="ai-model-name">${esc(m.name)}</div>
        <div class="ai-model-sub">${esc(m.description || '')}</div>
      </div>
    `).join('');
    modelsEl.querySelectorAll('.ai-model').forEach(el => {
      el.onclick = () => {
        activeModel = el.dataset.slug;
        setModel(activeModel);
        Sound.tap();
        renderModels();
      };
    });
  }

  function pushMsg(msg) {
    messages.push(msg);
    localStorage.setItem(historyKey, JSON.stringify(messages));
    renderMessages();
  }

  function matrixContext() {
    const lines = [];
    lines.push(`People (${store.people.length}):`);
    for (const p of store.people) {
      const recv = store.scores.filter(s => s.target_id === p.id);
      const avg = recv.length ? (recv.reduce((a, s) => a + Number(s.score), 0) / recv.length).toFixed(1) : 'n/a';
      lines.push(`- ${p.full_name} (${p.job_title || 'no title'}) avg_received=${avg}, scored=${recv.length}`);
    }
    lines.push('');
    lines.push(`Traits (${store.traits.length}): ${store.traits.map(t => t.name).join(', ')}`);
    lines.push('');
    const my = store.myPerson;
    if (my) {
      const mine = store.scores.filter(s => s.ranker_id === my.id);
      lines.push(`Current user person: ${my.full_name}. Has scored ${mine.length} pairs.`);
    }
    return lines.join('\n');
  }

  async function send(text) {
    if (streaming) return;
    if (!getApiKey()) { toast('Add an OpenRouter API key first', 'error'); return; }
    text = text.trim();
    if (!text) return;
    pushMsg({ role: 'user', content: text });
    inputEl.value = '';
    inputEl.style.height = '';

    const sys = `You are MATRIX·3D Analyst, an AI inside a 3D ranking app. Answer concisely with insight, not restating the question. Use markdown. If a conclusion is speculative, say so. Live cube summary:\n${matrixContext()}`;

    const apiMessages = [
      { role: 'system', content: sys },
      ...messages.filter(m => !m._typing && !m._error).map(m => ({ role: m.role, content: m.content }))
    ];

    const assistant = { role: 'assistant', content: '', _typing: true };
    messages.push(assistant);
    renderMessages();

    streaming = true;
    sendBtn.disabled = true;
    Sound.tap();

    try {
      await chatAI({
        messages: apiMessages,
        model: activeModel,
        onToken: tok => {
          assistant._typing = false;
          assistant.content += tok;
          localStorage.setItem(historyKey, JSON.stringify(messages));
          renderMessages();
        }
      });
      assistant._typing = false;
      localStorage.setItem(historyKey, JSON.stringify(messages));
      renderMessages();
      Sound.glass(0.5);
    } catch (e) {
      assistant._error = true;
      assistant.content = e.message || 'Request failed';
      assistant._typing = false;
      localStorage.setItem(historyKey, JSON.stringify(messages));
      renderMessages();
      Sound.error();
    } finally {
      streaming = false;
      sendBtn.disabled = false;
    }
  }

  function analyse() {
    send('Give me a sharp, structured analysis of this cube: the 5 most interesting patterns, ranking disagreements, and any suspicious outliers. Use markdown headings.');
  }

  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 150) + 'px';
  });
  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(inputEl.value);
    }
  });
  sendBtn.onclick = () => send(inputEl.value);
  root.querySelector('#ai-clear').onclick = () => {
    messages = [{ role: 'assistant', content: 'Session reset. Ask anything about the cube.' }];
    localStorage.setItem(historyKey, JSON.stringify(messages));
    renderMessages();
  };
  root.querySelector('#ai-summary').onclick = analyse;
  root.querySelector('#ai-key-save').onclick = () => {
    setApiKey(root.querySelector('#ai-key').value.trim());
    toast('API key saved', 'success');
  };

  renderMessages();
  (async () => {
    models = await listModels(supabase);
    if (!models.find(m => m.slug === activeModel)) activeModel = models[0].slug;
    renderModels();
  })();

  return { destroy: () => {} };
}
