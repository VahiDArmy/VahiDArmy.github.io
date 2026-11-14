/* ============================================================================
   FULL METAL CINEMA — AI studio
   local key · streaming · reasoning traces · conversation ledger
   deliberately independent of any Supabase edge function
   ========================================================================== */

import {
  h, md, fmtRel, fmtDate, toast, field, copyText, download, openModal,
  confirmAction, posterEl, clamp, fmtNum, emptyState,
} from '../lib/dom.js';
import {
  state, rows, saveAi, titleById, addRow, removeRow, logActivity, updateRow,
} from '../lib/store.js';
import { PROVIDERS, REASONING_EFFORTS, DEFAULT_AI } from '../config.js';
import {
  resolveAiConfig, chat, providerById, getKeyRecord, maskKey, activeKey,
  fetchModels, estimateTokens, dossierContext, historySlice, AI_PRESETS,
} from '../lib/ai.js';
import { navigate, openEditor } from './shared.js';

let session = {
  messages: [],
  contextTitleId: '',
  controller: null,
  lastPrompt: '',
  conversationId: null,
  usage: { prompt: 0, completion: 0, total: 0, calls: 0, latency: 0 },
};

export function renderStudio(root) {
  const cfg = resolveAiConfig();
  root.classList.add('view--flush');
  const wrap = h('div', { class: 'studio', style: { padding: '0 var(--s6) var(--s6)' } });

  /* ================= SIDE ================= */
  const side = h('div', { class: 'studio__side' });

  const keyState = h('div', { class: 'panel' },
    h('div', { class: 'panel__head' }, h('h2', {}, 'Connection'),
      h('div', { class: 'panel__tools' }, h('span', { class: `dot ${cfg.apiKey || cfg.keyless ? 'is-ok' : 'is-bad'}` }))),
    h('div', { class: 'panel__body', style: { display: 'grid', gap: '8px' } },
      h('dl', { class: 'deflist' },
        h('div', { class: 'deflist__row' }, h('dt', {}, 'Provider'), h('dd', {}, cfg.providerMeta.label)),
        h('div', { class: 'deflist__row' }, h('dt', {}, 'Model'), h('dd', { class: 'mono', style: { fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' } }, cfg.model || 'unset')),
        h('div', { class: 'deflist__row' }, h('dt', {}, 'Key'), h('dd', { class: 'mono', style: { fontSize: '10px' } }, cfg.apiKey ? maskKey(cfg.apiKey) : cfg.keyless ? 'not required' : 'missing')),
        h('div', { class: 'deflist__row' }, h('dt', {}, 'Transport'), h('dd', {}, cfg.streaming ? 'streaming' : 'buffered')),
        h('div', { class: 'deflist__row' }, h('dt', {}, 'Reasoning'), h('dd', {}, cfg.reasoning ? cfg.reasoningEffort : 'off')),
        h('div', { class: 'deflist__row' }, h('dt', {}, 'Base URL'), h('dd', { class: 'mono', style: { fontSize: '9.5px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' } }, cfg.baseUrl || 'unset')),
      ),
      h('div', { class: 'form__row' },
        h('button', { class: 'btn btn--primary btn--sm', onClick: () => navigate('#/settings') }, 'Open AI settings'),
        h('button', {
          class: 'btn btn--ghost btn--sm',
          onClick: async (e) => {
            const b = e.currentTarget;
            b.classList.add('is-busy');
            try {
              const models = await fetchModels(cfg);
              toast(`${models.length} models reachable on ${cfg.providerMeta.label}`);
              openModelPicker(models, cfg);
            } catch (err) {
              toast(err.message || 'Could not reach provider', 'err');
            } finally { b.classList.remove('is-busy'); }
          },
        }, 'Test'),
      ),
      !cfg.apiKey && !cfg.keyless
        ? h('div', { class: 'keywarn' }, h('b', {}, 'No key.'), h('span', {}, 'Paste a key in Settings › AI Studio. It never leaves this browser.'))
        : null,
    ),
  );
  side.appendChild(keyState);

  /* quick switches */
  const switchBox = (label, key, hint) => h('label', { class: 'switch', style: { padding: '7px 10px', border: '1px solid var(--line)', background: 'var(--bg-1)' } },
    h('input', {
      type: 'checkbox', checked: !!state.ai[key],
      onChange: (e) => { saveAi({ [key]: e.target.checked }); rerender(); },
    }),
    h('span', { class: 'switch__track' }),
    h('span', { class: 'switch__label', style: { fontSize: '11.5px' } }, label,
      hint ? h('small', { class: 'dim', style: { display: 'block', fontSize: '9px' } }, hint) : null),
  );

  side.appendChild(switchBox('Streaming', 'streaming', 'render tokens as they arrive'));
  side.appendChild(switchBox('Reasoning trace', 'reasoning', 'show the model thinking, when it can'));

  const effortSel = h('select', {
    class: 'select',
    onChange: (e) => { saveAi({ reasoningEffort: e.target.value }); rerender(); },
  }, REASONING_EFFORTS.map((e) => h('option', { value: e, selected: state.ai.reasoningEffort === e }, `effort: ${e}`)));
  side.appendChild(effortSel);

  /* context selector */
  const ctxSel = h('select', {
    class: 'select',
    onChange: (e) => { session.contextTitleId = e.target.value; rerender(); },
  }, h('option', { value: '' }, 'no dossier context'),
  rows('titles').slice(0, 200).map((t) => h('option', { value: t.id, selected: session.contextTitleId === t.id }, t.title)));
  side.appendChild(h('div', { class: 'panel' },
    h('div', { class: 'panel__head' }, h('h2', {}, 'Context')),
    h('div', { class: 'panel__body' }, ctxSel,
      h('div', { class: 'form__note' }, 'The machine receives the dossier fields, your score, notes and analysis. Nothing else is sent.'),
    ),
  ));

  /* conversations */
  const convs = h('div', { class: 'panel' },
    h('div', { class: 'panel__head' }, h('h2', {}, 'Ledger'),
      h('div', { class: 'panel__tools' },
        h('button', {
          class: 'iconbtn', title: 'New conversation',
          onClick: () => { session = { ...session, messages: [], conversationId: null }; rerender(); },
        }, '＋'))),
    h('div', { class: 'panel__body panel__body--flush', style: { maxHeight: '280px', overflowY: 'auto' } },
      rows('conversations').length
        ? rows('conversations').slice(0, 40).map((c) => h('div', {
          class: `conv-item ${session.conversationId === c.id ? 'is-on' : ''}`,
          onClick: () => {
            session.messages = [
              { role: 'user', content: c.prompt },
              { role: 'assistant', content: c.response, meta: { model: c.ai_model, saved: c.created_at } },
            ];
            session.contextTitleId = c.title_id || '';
            session.conversationId = c.id;
            rerender();
          },
        },
        h('b', {}, c.prompt.slice(0, 54)),
        h('small', {}, `${c.ai_model || 'unknown'} · ${fmtRel(c.created_at)}`),
        ))
        : h('div', { class: 'panel__body muted' }, 'No saved exchanges yet.'),
    ),
  );
  side.appendChild(convs);

  /* ================= MAIN ================= */
  const main = h('div', { class: 'studio__main' });

  const top = h('div', { class: 'studio__top' });
  const modelPill = h('button', {
    class: 'model-pill',
    title: 'Change model',
    onClick: async () => {
      try {
        const models = await fetchModels(cfg);
        openModelPicker(models, cfg);
      } catch {
        openModelPicker(rows('models').map((m) => ({ id: m.id, label: m.label })), cfg);
      }
    },
  }, h('span', {}, 'MODEL'), h('b', {}, cfg.model || 'unset'));
  top.appendChild(modelPill);
  top.appendChild(h('span', { class: 'mono dim', style: { fontSize: '9.5px', letterSpacing: '.1em' } },
    `${cfg.providerMeta.label} · ${cfg.streaming ? 'STREAM' : 'BUFFER'}${cfg.reasoning ? ' · REASONING' : ''}`));
  if (session.contextTitleId) {
    const t = titleById(session.contextTitleId);
    top.appendChild(h('button', {
      class: 'model-pill', onClick: () => navigate(`#/title/${session.contextTitleId}`),
    }, h('span', {}, 'CONTEXT'), h('b', {}, t?.title || 'missing')));
  }
  top.appendChild(h('span', { class: 'push' }));
  top.appendChild(h('span', { class: 'mono dim', style: { fontSize: '9px', letterSpacing: '.12em' } },
    `${session.usage.calls} calls · ${fmtNum(session.usage.total)} tok · ${session.usage.latency ? `${Math.round(session.usage.latency / Math.max(1, session.usage.calls))}ms avg` : '—'}`));
  top.appendChild(h('button', {
    class: 'iconbtn', title: 'Export conversation',
    onClick: () => {
      const text = session.messages.map((m) => `**${m.role.toUpperCase()}**\n\n${m.content}`).join('\n\n---\n\n');
      download(`fmc-conversation-${Date.now()}.md`, text || '*empty*', 'text/markdown');
    },
  }, '⤓'));
  top.appendChild(h('button', {
    class: 'iconbtn', title: 'Clear',
    onClick: async () => {
      if (!session.messages.length) return;
      const ok = await confirmAction({ title: 'Clear the log', body: 'The conversation is discarded. Saved ledger entries stay.', ok: 'Clear', danger: false });
      if (ok) { session.messages = []; session.conversationId = null; rerender(); }
    },
  }, '⌫'));
  main.appendChild(top);

  /* log */
  const log = h('div', { class: 'studio__log' });
  if (!session.messages.length) {
    log.appendChild(welcomeBlock());
  } else {
    session.messages.forEach((m, i) => log.appendChild(messageEl(m, i)));
  }
  main.appendChild(log);

  /* composer */
  const ta = h('textarea', {
    placeholder: 'Ask the archivist…  (Enter to send, Shift+Enter for a new line)',
    rows: '2',
  });
  const autosize = () => { ta.style.height = 'auto'; ta.style.height = `${Math.min(220, ta.scrollHeight)}px`; };
  ta.addEventListener('input', autosize);

  const sendBtn = h('button', { class: 'btn btn--primary' }, 'Send ↵');
  const stopBtn = h('button', { class: 'btn btn--danger', hidden: true }, 'Stop');

  const runPrompt = async (prompt) => {
    const text = String(prompt ?? ta.value ?? '').trim();
    if (!text || session.controller) return;
    if (!cfg.apiKey && !cfg.keyless) {
      toast('No API key on this device. Open Settings › AI Studio.', 'err');
      return;
    }
    ta.value = '';
    autosize();
    session.lastPrompt = text;
    session.messages.push({ role: 'user', content: text });
    const assistant = { role: 'assistant', content: '', reasoning: '', model: cfg.model, streaming: true, usage: null, startedAt: performance.now() };
    session.messages.push(assistant);
    rerenderLog();

    const ctxTitle = session.contextTitleId ? titleById(session.contextTitleId) : null;
    session.controller = new AbortController();
    stopBtn.hidden = false;
    sendBtn.hidden = true;

    const node = log.querySelector(`[data-idx="${session.messages.length - 1}"]`);
    const bodyEl = node?.querySelector('.msg__body');
    const reasonBody = node?.querySelector('.reason__body');
    const reasonHead = node?.querySelector('.reason__head .tok');

    try {
      const res = await chat({
        messages: historySlice(session.messages.slice(0, -1), state.ai.historyDepth).map((m) => ({ role: m.role, content: m.content })),
        signal: session.controller.signal,
        config: { context: ctxTitle ? dossierContext(ctxTitle) : '', reasoning: !!state.ai.reasoning },
        onReasoning: (chunk, all) => {
          assistant.reasoning = all;
          if (reasonBody) { reasonBody.textContent = all; node.querySelector('.reason')?.classList.remove('is-closed'); }
          if (reasonHead) reasonHead.textContent = `${fmtNum(all.length)} chr`;
          log.scrollTop = log.scrollHeight;
        },
        onDelta: (chunk, all) => {
          assistant.content = all;
          if (bodyEl) { bodyEl.innerHTML = md(all); bodyEl.classList.remove('is-thinking'); }
          log.scrollTop = log.scrollHeight;
        },
      });
      assistant.content = res.text || assistant.content;
      assistant.reasoning = res.reasoning || assistant.reasoning;
      assistant.usage = res.usage;
      assistant.model = res.model;
      assistant.latency = res.latency;
      assistant.streaming = false;
      session.usage.calls += 1;
      session.usage.total += Number(res.usage?.total_tokens) || estimateTokens(res.text);
      session.usage.latency += res.latency || 0;
      persistExchange(text, assistant);
    } catch (err) {
      assistant.content = assistant.content || `⚠ ${err.message}${err.hint ? `\n\n${err.hint}` : ''}`;
      assistant.streaming = false;
      if (err.name === 'AbortError' || /abort/i.test(err.message)) {
        assistant.content = assistant.content || '*stopped*';
      } else {
        toast(err.message || 'Generation failed', 'err');
      }
    } finally {
      session.controller = null;
      stopBtn.hidden = true;
      sendBtn.hidden = false;
      rerenderLog();
      if (assistant.content && !assistant.streaming) persistExchange(text, assistant, true);
    }
  };

  sendBtn.addEventListener('click', () => runPrompt());
  stopBtn.addEventListener('click', () => session.controller?.abort());
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runPrompt(); }
  });

  const presetRow = h('div', { class: 'composer__row' });
  AI_PRESETS.forEach((p) => {
    presetRow.appendChild(h('button', {
      class: 'chip',
      onClick: () => {
        const t = session.contextTitleId ? titleById(session.contextTitleId) : null;
        ta.value = p.build(t || { title: 'my shelf' });
        ta.focus();
        autosize();
      },
    }, p.label));
  });
  presetRow.appendChild(h('span', { class: 'push' }));
  presetRow.appendChild(h('span', { class: 'composer__hint' }, `${cfg.reasoning ? 'reasoning ' + cfg.reasoningEffort : 'no reasoning'} · temp ${state.ai.temperature}`));
  presetRow.appendChild(stopBtn);
  presetRow.appendChild(sendBtn);

  main.appendChild(h('div', { class: 'composer' },
    h('div', { class: 'composer__box' }, ta),
    presetRow,
  ));

  wrap.appendChild(side);
  wrap.appendChild(main);
  root.appendChild(wrap);
  setTimeout(() => ta.focus(), 60);

  /* ---------- internals ---------- */
  function persistExchange(prompt, assistant, alreadySaved = false) {
    if (alreadySaved) return;
    const ctxTitle = session.contextTitleId ? titleById(session.contextTitleId) : null;
    const row = {
      title_id: session.contextTitleId || null,
      title_context: ctxTitle ? ctxTitle.title : '',
      prompt,
      response: assistant.content,
      ai_model: assistant.model || cfg.model,
      tags: [cfg.providerMeta.id, state.ai.reasoning ? 'reasoning' : 'plain'].join(', '),
    };
    if (session.conversationId) {
      updateRow('conversations', session.conversationId, row).catch(() => {});
      return;
    }
    addRow('conversations', row).then((created) => {
      session.conversationId = created.id;
    }).catch(() => {});
  }

  function rerenderLog() {
    log.replaceChildren();
    session.messages.forEach((m, i) => log.appendChild(messageEl(m, i)));
    log.scrollTop = log.scrollHeight;
  }

  function messageEl(m, i) {
    const isUser = m.role === 'user';
    const body = h('div', { class: `msg__body ${m.streaming && !m.content ? 'is-thinking' : ''}` });
    if (isUser) body.textContent = m.content;
    else if (m.content) body.innerHTML = md(m.content);
    else body.appendChild(h('span', { class: 'think-dots' }, h('i'), h('i'), h('i')));

    const node = h('div', { class: `msg ${isUser ? 'msg--user' : ''}`, dataset: { idx: String(i) } },
      h('div', { class: 'msg__who' },
        isUser ? 'OPERATOR' : 'MACHINE',
        !isUser && m.model ? h('span', { class: 'dim' }, `· ${m.model}`) : null,
        m.streaming ? h('span', { class: 'acid' }, '· live') : null,
      ),
    );

    if (!isUser && (m.reasoning || m.streaming)) {
      node.appendChild(h('div', { class: `reason ${m.reasoning ? '' : 'is-closed'}` },
        h('div', {
          class: 'reason__head',
          onClick: (e) => e.currentTarget.parentElement.classList.toggle('is-closed'),
        },
        h('span', {}, '▸ REASONING'),
        h('span', { class: 'tok' }, m.reasoning ? `${fmtNum(m.reasoning.length)} chr` : 'waiting'),
        ),
        h('div', { class: 'reason__body' }, m.reasoning || ''),
      ));
    }

    node.appendChild(body);

    if (!isUser) {
      const toolbar = h('div', { class: 'msg__toolbar' });
      toolbar.appendChild(h('button', { class: 'iconbtn', title: 'Copy', onClick: () => copyText(m.content) }, '⧉'));
      toolbar.appendChild(h('button', {
        class: 'iconbtn', title: 'Regenerate',
        onClick: () => {
          const prior = session.messages[i - 1];
          if (!prior) return;
          session.messages = session.messages.slice(0, i - 1);
          rerender();
          runPrompt(prior.content);
        },
      }, '↻'));
      toolbar.appendChild(h('button', {
        class: 'iconbtn', title: 'Save as analysis',
        onClick: async () => {
          if (!session.contextTitleId) { toast('No dossier context selected', 'warn'); return; }
          const t = titleById(session.contextTitleId);
          if (!t) return;
          const { saveTitle } = await import('../lib/store.js');
          await saveTitle({ ...t, story_analysis: m.content }, t.id);
          toast('Saved into the dossier');
        },
      }, '✎'));
      toolbar.appendChild(h('button', {
        class: 'iconbtn', title: 'Good answer',
        onClick: () => vote(m.model, true),
      }, '✓'));
      toolbar.appendChild(h('button', {
        class: 'iconbtn', title: 'Bad answer',
        onClick: () => vote(m.model, false),
      }, '✕'));
      node.appendChild(toolbar);

      const meta = h('div', { class: 'msg__foot' });
      if (m.usage) {
        meta.appendChild(h('span', {}, `${fmtNum(m.usage.total_tokens || 0)} tok`));
        meta.appendChild(h('span', {}, `in ${fmtNum(m.usage.prompt_tokens || 0)}`));
        meta.appendChild(h('span', {}, `out ${fmtNum(m.usage.completion_tokens || 0)}`));
      }
      if (m.latency) meta.appendChild(h('span', {}, `${Math.round(m.latency)} ms`));
      if (m.model) meta.appendChild(h('span', {}, m.model));
      node.appendChild(meta);
    }
    return node;
  }

  async function vote(modelId, good) {
    if (!modelId) return;
    const model = rows('models').find((m) => m.id === modelId);
    if (!model) {
      try {
        await addRow('models', { id: modelId, label: modelId, provider: cfg.providerMeta.id, wins: good ? 1 : 0, losses: good ? 0 : 1, active: true, source: 'vote' });
        toast('Model added to the arena ledger');
      } catch { toast('Could not record', 'err'); }
      return;
    }
    await updateRow('models', modelId, { wins: (model.wins || 0) + (good ? 1 : 0), losses: (model.losses || 0) + (good ? 0 : 1), last_tried_at: new Date().toISOString() });
    toast(good ? 'Recorded as a win' : 'Recorded as a loss');
  }

  function welcomeBlock() {
    const suggested = [
      ['Audit my shelf', 'Look at my last thirty dossiers and tell me what my taste actually is, versus what I think it is.'],
      ['Pick tonight', 'Give me three titles from my watchlist, ranked, with one line each on why tonight.'],
      ['Find the pattern', 'Which three titles do I love that share nothing with the rest of my shelf?'],
      ['Write the review', 'Write a 200-word review of the highest-scored thing on my shelf.'],
    ];
    return h('div', { style: { margin: 'auto', maxWidth: '720px', width: '100%' } },
      h('div', { style: { textAlign: 'center', marginBottom: '22px' } },
        h('div', { class: 'eyebrow' }, 'SECTOR 05 — MACHINE'),
        h('h1', { style: { fontSize: 'clamp(2rem,4vw,3.2rem)', margin: '6px 0' } }, 'The reasoning studio'),
        h('p', { style: { color: 'var(--ink-2)', maxWidth: '52ch', margin: '0 auto' } },
          'Your key. Your model. Your machine. Streaming tokens land as they are produced, and reasoning-capable models show their working in a separate pane.'),
      ),
      h('div', { class: 'grid-posters', style: { gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '8px' } },
        suggested.map(([label, prompt]) => h('button', {
          class: 'panel', style: { textAlign: 'left', padding: '12px', cursor: 'pointer' },
          onClick: () => { ta.value = prompt; ta.focus(); autosize(); },
        },
        h('div', { class: 'mono dim', style: { fontSize: '9px', letterSpacing: '.2em', marginBottom: '6px' } }, label.toUpperCase()),
        h('div', { style: { fontSize: '13.5px', color: 'var(--ink-2)', lineHeight: '1.5' } }, prompt),
        )),
      ),
      (!cfg.apiKey && !cfg.keyless)
        ? h('div', { class: 'keywarn', style: { marginTop: '18px' } },
          h('b', {}, 'No key yet.'),
          h('span', {}, 'Open Settings › AI Studio, pick a provider, paste a key. It is stored in this browser only — never in Supabase, never in this app\'s database. The edge-function path is optional and separate.'))
        : null,
    );
  }

  function rerender() {
    root.replaceChildren();
    renderStudio(root);
  }
}

/* ---------- model picker ------------------------------------------------ */
export function openModelPicker(models, cfg) {
  const search = h('input', { class: 'input', placeholder: 'Filter models…' });
  const list = h('div', { class: 'col', style: { gap: '2px' } });
  const paint = () => {
    const q = search.value.toLowerCase();
    list.replaceChildren(...models
      .filter((m) => !q || String(m.id).toLowerCase().includes(q) || String(m.label || '').toLowerCase().includes(q))
      .slice(0, 300)
      .map((m) => h('button', {
        class: 'modelrow',
        style: { textAlign: 'left', width: '100%', background: m.id === cfg.model ? 'var(--bg-3)' : 'transparent' },
        onClick: async () => {
          saveAi({ model: m.id, provider: cfg.providerMeta.id });
          toast(`Model set: ${m.id}`);
          modal.close();
          location.reload();
        },
      },
      h('div', {},
        h('div', { class: 'modelrow__id' }, m.id),
        h('div', { class: 'modelrow__meta' }, [m.context ? `${fmtNum(m.context)} ctx` : '', m.pricing ? 'priced' : ''].filter(Boolean).join(' · ')),
      ),
      h('span', { class: 'mono dim' }, m.id === cfg.model ? 'active' : ''),
      h('span', { class: 'mono dim' }, ''),
      )));
    if (!list.children.length) list.appendChild(h('div', { class: 'muted', style: { padding: '16px' } }, 'No models matched.'));
  };
  search.addEventListener('input', paint);
  paint();
  const manual = h('input', { class: 'input input--mono', placeholder: 'or type an exact model id', value: cfg.model });
  const modal = openModal({
    title: 'Choose a model',
    wide: true,
    body: h('div', { class: 'form' },
      search, list,
      h('div', { class: 'hairline' }),
      field('Manual model id', manual),
      h('div', { class: 'form__row' },
        h('button', {
          class: 'btn btn--primary btn--sm',
          onClick: () => { saveAi({ model: manual.value.trim() }); modal.close(); location.reload(); },
        }, 'Use this id'),
        h('span', { class: 'form__note' }, 'Anything the endpoint accepts works here, including local Ollama tags.'),
      ),
    ),
  });
}
