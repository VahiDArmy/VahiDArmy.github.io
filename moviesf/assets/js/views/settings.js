/* ============================================================================
   FULL METAL CINEMA — settings
   connection · AI studio (local keys) · appearance · campaign · data
   ========================================================================== */

import {
  h, field, toast, openModal, confirmAction, download,
  fmtDate, fmtRel, fmtDec, copyText, readFile, safeJson, clamp, fmtNum, switchRow,
} from '../lib/dom.js';
import {
  state, rows, savePrefs, saveAi, applyTheme, exportSnapshot, importTitles,
  parseCsv, loadAll, computeStats, cachedTitles,
} from '../lib/store.js';
import { APP, SUPABASE, THEMES, ACCENTS, PROVIDERS, REASONING_EFFORTS, DEFAULT_AI } from '../config.js';
import {
  getKeyRecord, saveKeyRecord, clearKey, maskKey, listKeys, vaultIsLocked,
  lockVault, unlockVault, destroyVault, resolveAiConfig, fetchModels, chat,
  estimateTokens, providerKindLabel,
} from '../lib/ai.js';
import { navigate } from './shared.js';

const SECTIONS = [
  { id: 'connection', label: 'Connection' },
  { id: 'ai', label: 'AI Studio' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'campaign', label: 'Campaign' },
  { id: 'data', label: 'Data' },
  { id: 'account', label: 'Account' },
  { id: 'about', label: 'Build' },
];

export function renderSettings(root, params = {}) {
  let active = params.section || 'connection';

  const nav = h('div', { class: 'setnav' });
  const body = h('div', { class: 'setsec' });

  const paintNav = () => {
    nav.replaceChildren(...SECTIONS.map((s) => h('button', {
      class: active === s.id ? 'is-active' : '',
      onClick: () => { active = s.id; paintNav(); paint(); history.replaceState(null, '', `#/settings?section=${s.id}`); },
    }, s.label)));
  };

  function paint() {
    body.replaceChildren();
    switch (active) {
      case 'ai': body.appendChild(aiSection()); break;
      case 'appearance': body.appendChild(appearanceSection()); break;
      case 'campaign': body.appendChild(campaignSection()); break;
      case 'data': body.appendChild(dataSection()); break;
      case 'account': body.appendChild(accountSection()); break;
      case 'about': body.appendChild(buildSection()); break;
      default: body.appendChild(connectionSection());
    }
  }

  root.appendChild(h('div', { class: 'viewhead' },
    h('div', { class: 'sect__num' }, '11'),
    h('div', {},
      h('h1', {}, 'Settings'),
      h('div', { class: 'viewhead__sub' }, `${APP.name} ${APP.version} · ${state.client?.isDemo ? 'local demo mode' : 'connected'}`),
    ),
  ));

  const grid = h('div', { class: 'setgrid' }, nav, body);
  root.appendChild(grid);
  paintNav();
  paint();

  /* ====================================================================== */
  function connectionSection() {
    const c = state.client;
    const configured = c?.configured;
    const outbox = c?.pending?.length || 0;
    const section = h('div', { class: 'col', style: { gap: '16px' } });

    section.appendChild(h('div', { class: 'panel' },
      h('div', { class: 'panel__head' }, h('h2', {}, 'Supabase'), h('div', { class: 'panel__tools' },
        h('span', { class: `dot ${configured ? 'is-ok' : 'is-warn'}` }),
        h('span', { class: 'mono dim' }, configured ? 'CONFIGURED' : 'LOCAL DEMO'))),
      h('div', { class: 'panel__body' },
        h('dl', { class: 'deflist' },
          row('Project URL', configured ? c.url : 'not set — running on localStorage'),
          row('Anon key', configured ? `${SUPABASE.anonKey.slice(0, 8)}…${SUPABASE.anonKey.slice(-4)}` : 'not set'),
          row('Signed in as', c?.user?.email || '—'),
          row('User id', c?.user?.id || '—'),
          row('Mode', c?.isDemo ? 'demo (local backend)' : 'remote (PostgREST)'),
          row('Tables loaded', `${Object.values(state.tables).filter(Array.isArray).reduce((a, b) => a + b.length, 0)} rows`),
          row('Outbox', outbox ? `${outbox} queued writes` : 'empty'),
        ),
        h('div', { class: 'form__row', style: { marginTop: '14px' } },
          h('button', {
            class: 'btn btn--primary btn--sm',
            onClick: async (e) => {
              const btn = e.currentTarget;
              btn.classList.add('is-busy');
              try { await loadAll(); toast('Reloaded every table'); }
              catch (err) { toast(err.message, 'err'); }
              finally { btn.classList.remove('is-busy'); }
            },
          }, 'Reload data'),
          h('button', {
            class: 'btn btn--ghost btn--sm',
            onClick: async () => {
              const res = await state.client.request('/rest/v1/cinema_titles?select=id&limit=1').catch((e) => e);
              if (res instanceof Error) toast(`${res.status || '×'} ${res.message}`, 'err');
              else toast('REST reachable');
            },
          }, 'Ping'),
          outbox ? h('button', {
            class: 'btn btn--ghost btn--sm',
            onClick: async () => {
              const pending = [...(state.client?.pending || [])];
              let ok = 0;
              for (const op of pending) {
                try {
                  await state.client.from(op.table).insert(op.rows);
                  ok += 1;
                } catch { /* leave it queued */ }
              }
              state.client.clearQueue();
              toast(`${ok} of ${pending.length} flushed`);
            },
          }, `Flush outbox (${outbox})`) : null,
          h('button', { class: 'btn btn--ghost btn--sm', onClick: () => navigate('#/library') }, 'Library'),
        ),
      ),
    ));

    section.appendChild(h('div', { class: 'panel' },
      h('div', { class: 'panel__head' }, h('h2', {}, 'How to point this at your project')),
      h('div', { class: 'panel__body' },
        h('div', { class: 'prose' },
          h('p', {}, 'Open ', h('code', {}, 'assets/js/config.js'), ' and set two values from your Supabase dashboard (Project settings → API):'),
        ),
        h('pre', { class: 'codeblock' }, `export const SUPABASE = {
  url: 'https://xxxxxxxxxxxx.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
};`),
        h('div', { class: 'prose' },
          h('p', {}, 'Then run the SQL in ', h('code', {}, 'supabase/schema.sql'), ' once in the SQL editor. It creates the cinema_ tables, the new tables this UI uses, row-level security for every one of them, and the triggers that keep ', h('code', {}, 'updated_at'), ' honest.'),
          h('p', {}, 'Without a configuration the app runs in demo mode: the same interface, backed by this browser\'s localStorage, pre-loaded with a small platoon so nothing is empty.'),
        ),
        h('div', { class: 'form__row', style: { marginTop: '10px' } },
          h('button', {
            class: 'btn btn--ghost btn--sm',
            onClick: () => copyText('assets/js/config.js'),
          }, 'Copy path'),
          h('button', {
            class: 'btn btn--ghost btn--sm',
            onClick: () => {
              openModal({
                title: 'Schema excerpt',
                wide: true,
                body: h('pre', { class: 'codeblock' },
                  `-- every cinema_ table follows the same contract\nid uuid primary key default gen_random_uuid()\nuser_id uuid default auth.uid() references auth.users(id)\ncreated_at timestamptz not null default now()\nupdated_at timestamptz not null default now()\n\n-- RLS: each row belongs to exactly one operator\nalter table cinema_titles enable row level security;\ncreate policy "own rows" on cinema_titles\n  for all using (auth.uid() = user_id)\n  with check (auth.uid() = user_id);`),
              });
            },
          }, 'Show contract'),
        ),
      ),
    ));

    const tables = Object.entries(state.tables).filter(([, v]) => Array.isArray(v));
    section.appendChild(h('div', { class: 'panel' },
      h('div', { class: 'panel__head' }, h('h2', {}, 'Loaded tables')),
      h('div', { class: 'panel__body panel__body--flush', style: { overflowX: 'auto' } },
        h('table', { class: 'table table--tight' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Key'), h('th', {}, 'Rows'), h('th', {}, 'State'))),
          h('tbody', {}, tables.map(([k, v]) => h('tr', {},
            h('td', { class: 'mono' }, k),
            h('td', { class: 'table__num' }, fmtNum(v.length)),
            h('td', {}, v.length ? h('span', { class: 'badge badge--good' }, 'ok') : h('span', { class: 'badge badge--soft' }, 'empty')),
          ))),
        ),
      ),
    ));

    return section;

    function row(k, v) {
      return h('div', { class: 'deflist__row' }, h('dt', {}, k), h('dd', { class: 'mono', style: { fontSize: '11px', maxWidth: '58%', wordBreak: 'break-all' } }, String(v)));
    }
  }

  /* ====================================================================== */
  function aiSection() {
    const ai = state.ai;
    const cfg = resolveAiConfig();
    const section = h('div', { class: 'col', style: { gap: '16px' } });

    /* provider */
    const provSel = h('select', {
      class: 'select',
      onChange: (e) => {
        const p = PROVIDERS.find((x) => x.id === e.target.value);
        saveAi({ provider: p.id, baseUrl: p.baseUrl, model: p.defaultModel });
        toast(`Provider → ${p.label}`);
        paint();
      },
    }, PROVIDERS.map((p) => h('option', { value: p.id, selected: ai.provider === p.id }, p.label)));

    const provider = PROVIDERS.find((p) => p.id === ai.provider) || PROVIDERS[0];
    const rec = getKeyRecord(provider.id);

    section.appendChild(h('div', { class: 'panel panel--accent' },
      h('div', { class: 'panel__head' }, h('h2', {}, 'Browser key — independent of Supabase edge'),
        h('div', { class: 'panel__tools' }, h('span', { class: 'ribbon ribbon--accent' }, 'LOCAL ONLY'))),
      h('div', { class: 'panel__body', style: { display: 'grid', gap: '14px' } },
        h('div', { class: 'keywarn' },
          h('b', {}, 'Read this.'),
          h('span', {}, 'The key below is stored in this browser (localStorage) and sent directly to the provider you pick. It is never written to Supabase, never included in exports, and never sent to this app\'s hosting. The optional edge-function path is a separate fallback and is not used while a local key is present.'),
        ),
        h('div', { class: 'form__grid' },
          field('Provider', provSel),
          field('Base URL', h('input', {
            class: 'input input--mono', value: ai.baseUrl || provider.baseUrl || '',
            placeholder: provider.baseUrl || 'https://…',
            onChange: (e) => saveAi({ baseUrl: e.target.value.trim() }),
          }), provider.kind === 'openai' ? 'OpenAI-compatible root, no /chat/completions' : ''),
        ),
        h('div', { class: 'row', style: { gap: '8px', fontSize: '12px', color: 'var(--ink-3)' } },
          h('span', { class: 'badge badge--soft' }, providerKindLabel(provider)),
          h('span', {}, provider.note),
          provider.keysUrl ? h('a', { class: 'mono', style: { color: 'var(--accent)' }, href: provider.keysUrl, target: '_blank', rel: 'noopener' }, 'get a key ↗') : null,
        ),
        keyEditor(provider, rec),
      ),
    ));

    /* generation */
    const tempOut = h('b', { class: 'mono' }, String(ai.temperature));
    const tokensOut = h('b', { class: 'mono' }, String(ai.maxTokens));
    const budgetOut = h('b', { class: 'mono' }, String(ai.reasoningBudget));

    section.appendChild(h('div', { class: 'panel' },
      h('div', { class: 'panel__head' }, h('h2', {}, 'Generation')),
      h('div', { class: 'panel__body', style: { display: 'grid', gap: '4px' } },
        setRow('Stream tokens', 'Render the answer while it is being written. Required for reasoning traces on most providers.',
          h('label', { class: 'switch' },
            h('input', { type: 'checkbox', checked: !!ai.streaming, onChange: (e) => saveAi({ streaming: e.target.checked }) }),
            h('span', { class: 'switch__track' }))),
        setRow('Reasoning', 'Ask the model to think before answering, and show the trace in a separate pane. Works with OpenRouter reasoning models, OpenAI o-series / GPT-5 and Anthropic extended thinking.',
          h('label', { class: 'switch' },
            h('input', { type: 'checkbox', checked: !!ai.reasoning, onChange: (e) => { saveAi({ reasoning: e.target.checked }); paint(); } }),
            h('span', { class: 'switch__track' }))),
        ai.reasoning ? setRow('Reasoning effort', 'Low is cheap and blunt. High spends tokens on the trace.',
          h('select', {
            class: 'select', style: { width: 'auto' },
            onChange: (e) => saveAi({ reasoningEffort: e.target.value }),
          }, h('option', { value: 'low', selected: ai.reasoningEffort === 'low' }, 'low'),
          h('option', { value: 'medium', selected: ai.reasoningEffort === 'medium' }, 'medium'),
          h('option', { value: 'high', selected: ai.reasoningEffort === 'high' }, 'high'))) : null,
        ai.reasoning && provider.kind === 'anthropic'
          ? setRow('Thinking budget (tokens)', 'Anthropic bills the thinking budget as output. 2048 is a sane start.',
            h('div', { class: 'row' }, h('input', {
              class: 'range', type: 'range', min: '1024', max: '8192', step: '256', value: String(ai.reasoningBudget),
              onInput: (e) => { budgetOut.textContent = e.target.value; saveAi({ reasoningBudget: Number(e.target.value) }); },
            }), budgetOut))
          : null,
        setRow('Temperature', 'Below 0.4 for factual standardisation; above 0.8 for pitch work.',
          h('div', { class: 'row' }, h('input', {
            class: 'range', type: 'range', min: '0', max: '2', step: '0.1', value: String(ai.temperature),
            onInput: (e) => { tempOut.textContent = e.target.value; saveAi({ temperature: Number(e.target.value) }); },
          }), tempOut)),
        setRow('Max output tokens', 'A hard ceiling per answer.',
          h('div', { class: 'row' }, h('input', {
            class: 'range', type: 'range', min: '256', max: '8000', step: '64', value: String(ai.maxTokens),
            onInput: (e) => { tokensOut.textContent = e.target.value; saveAi({ maxTokens: Number(e.target.value) }); },
          }), tokensOut)),
        setRow('History depth', 'How many turns of the conversation are re-sent. Lower is cheaper.',
          h('input', {
            class: 'input', type: 'number', min: '0', max: '40', value: String(ai.historyDepth),
            style: { width: '90px' },
            onChange: (e) => saveAi({ historyDepth: clamp(Number(e.target.value), 0, 40) }),
          })),
        setRow('Edge fallback', `Call the optional Supabase edge function "${SUPABASE.edgeAiFunction || 'none configured'}" if no local key exists. Off by default; the local path never uses it.`,
          h('label', { class: 'switch' },
            h('input', { type: 'checkbox', checked: !!ai.useEdgeFallback, onChange: (e) => saveAi({ useEdgeFallback: e.target.checked }) }),
            h('span', { class: 'switch__track' }))),
        h('div', { class: 'hairline', style: { margin: '8px 0' } }),
        field('System prompt', h('textarea', {
          class: 'textarea', rows: '5', style: { minHeight: '110px' },
          onInput: (e) => saveAi({ systemPrompt: e.target.value }),
        }, ai.systemPrompt)),
      ),
    ));

    /* model */
    const modelInput = h('input', {
      class: 'input input--mono', value: ai.model || provider.defaultModel || '',
      placeholder: 'model id',
      onChange: (e) => saveAi({ model: e.target.value.trim() }),
    });
    section.appendChild(h('div', { class: 'panel' },
      h('div', { class: 'panel__head' }, h('h2', {}, 'Model')),
      h('div', { class: 'panel__body' },
        h('div', { class: 'form__grid' }, field('Model id', modelInput, 'Anything the endpoint accepts')),
        h('div', { class: 'form__row', style: { marginTop: '10px' } },
          h('button', {
            class: 'btn btn--sm',
            onClick: async (e) => {
              const b = e.currentTarget;
              b.classList.add('is-busy');
              try {
                const models = await fetchModels(cfg);
                openModelList(models, provider);
              } catch (err) { toast(err.message, 'err'); }
              finally { b.classList.remove('is-busy'); }
            },
          }, '⇣ Fetch model list'),
          h('button', {
            class: 'btn btn--primary btn--sm',
            onClick: async (e) => {
              const b = e.currentTarget;
              b.classList.add('is-busy');
              const out = h('div', { class: 'form__note' }, '');
              try {
                const started = performance.now();
                let firstToken = 0;
                const res = await chat({
                  messages: [{ role: 'user', content: 'Reply with exactly: FIELD TEST OK' }],
                  config: { reasoning: false, streaming: true, maxTokens: 64, temperature: 0 },
                  onDelta: () => { if (!firstToken) firstToken = performance.now(); },
                });
                out.style.color = 'var(--accent)';
                out.textContent = `✓ ${res.model} · ${Math.round(performance.now() - started)} ms total, ${Math.round(firstToken - started)} ms to first token · ${res.usage?.total_tokens || 0} tokens · "${res.text.trim().slice(0, 40)}"`;
                toast('Connection works');
              } catch (err) {
                out.style.color = 'var(--blood)';
                out.textContent = `✕ ${err.message}${err.hint ? ` — ${err.hint}` : ''}`;
                toast('Connection failed', 'err');
              } finally { b.classList.remove('is-busy'); }
            },
          }, 'Run field test'),
        ),
        h('div', { style: { marginTop: '10px' } }, h('div', { class: 'form__note', id: 'aiTestOut' }, '')),
      ),
    ));

    /* vault */
    section.appendChild(h('div', { class: 'panel' },
      h('div', { class: 'panel__head' }, h('h2', {}, 'Seal the vault'),
        h('div', { class: 'panel__tools' }, h('span', { class: 'mono dim' }, vaultIsLocked() ? 'SEALED' : 'OPEN'))),
      h('div', { class: 'panel__body' },
        h('div', { class: 'form__note', style: { marginBottom: '12px' } },
          'Optional: encrypt every stored key with a passphrase (AES-GCM, 210k PBKDF2 rounds). You will be asked to unlock after each reload. There is no recovery — a forgotten passphrase means re-entering the keys.'),
        h('div', { class: 'form__row' },
          h('button', {
            class: 'btn btn--sm',
            onClick: () => sealPrompt(),
          }, vaultIsLocked() ? 'Unlock' : 'Seal keys'),
          vaultIsLocked() ? h('button', {
            class: 'btn btn--danger btn--sm',
            onClick: async () => {
              const ok = await confirmAction({ title: 'Destroy sealed vault', body: 'The encrypted blob and its keys are erased from this browser.', ok: 'Destroy' });
              if (ok) { destroyVault(); toast('Vault destroyed'); paint(); }
            },
          }, 'Destroy') : null,
          h('span', { class: 'push' }),
          h('span', { class: 'mono dim', style: { fontSize: '10px' } }, `${Object.keys(listKeys()).length} keys stored`),
        ),
      ),
    ));

    return section;

    function setRow(title, hint, ctl) {
      return h('div', { class: 'setrow' },
        h('div', { class: 'setrow__text' }, h('b', {}, title), h('small', {}, hint)),
        h('div', { class: 'setrow__ctl' }, ctl),
      );
    }

    function keyEditor(p, record) {
      const input = h('input', {
        class: 'input input--mono', type: 'password',
        value: record.key || '', placeholder: p.id === 'ollama' ? 'not required for local runtime' : 'sk-…',
        autocomplete: 'off', spellcheck: 'false',
      });
      const show = h('button', { class: 'field__peek', type: 'button', onClick: () => { input.type = input.type === 'password' ? 'text' : 'password'; } }, '◉');
      return h('div', {},
        field(`API key — ${p.label}`, h('div', { style: { position: 'relative' } }, input, show),
          'Stored as plain JSON under fmc4.aikeys in this browser, or sealed with your passphrase.'),
        h('div', { class: 'form__row', style: { marginTop: '8px' } },
          h('button', {
            class: 'btn btn--primary btn--sm',
            onClick: () => {
              if (!input.value.trim() && p.id !== 'ollama' && p.id !== 'custom') {
                toast('That is empty', 'warn');
                return;
              }
              saveKeyRecord(p.id, { key: input.value.trim(), baseUrl: state.ai.baseUrl });
              toast(`Key stored for ${p.label}`);
              paint();
            },
          }, 'Save key'),
          h('button', {
            class: 'btn btn--ghost btn--sm',
            onClick: async () => {
              if (!input.value.trim()) return;
              const before = input.value;
              saveKeyRecord(p.id, { key: before });
              try {
                await fetchModels({ ...resolveAiConfig(), apiKey: before });
                toast('Key verified against the provider');
              } catch (err) {
                toast(`Provider said: ${err.message}`, 'err');
              }
            },
          }, 'Verify'),
          h('button', {
            class: 'btn btn--danger btn--sm',
            onClick: async () => {
              const ok = await confirmAction({ title: 'Forget key', body: `The ${p.label} key is removed from this browser.`, ok: 'Forget' });
              if (!ok) return;
              clearKey(p.id);
              input.value = '';
              toast('Key removed');
              paint();
            },
          }, 'Forget'),
          h('span', { class: 'push' }),
          h('span', { class: 'mono dim', style: { fontSize: '10px' } },
            record.savedAt ? `saved ${fmtRel(record.savedAt)}` : 'no key on this device'),
        ),
      );
    }

    function openModelList(models, p) {
      const q = h('input', { class: 'input', placeholder: 'Filter…' });
      const list = h('div', { class: 'col', style: { gap: '1px', maxHeight: '54vh', overflowY: 'auto' } });
      const draw = () => {
        const s = q.value.toLowerCase();
        list.replaceChildren(...models.filter((m) => !s || m.id.toLowerCase().includes(s)).slice(0, 400).map((m) => h('button', {
          class: 'modelrow', style: { width: '100%', textAlign: 'left' },
          onClick: () => { saveAi({ model: m.id }); toast(`Model → ${m.id}`); modal.close(); paint(); },
        },
        h('div', {}, h('div', { class: 'modelrow__id' }, m.id),
          h('div', { class: 'modelrow__meta' }, [m.context ? `${fmtNum(m.context)} ctx` : '', m.pricing ? 'priced' : ''].filter(Boolean).join(' · '))),
        h('span', { class: 'mono dim' }, m.id === state.ai.model ? 'active' : ''),
        h('span', {}), h('span', {}),
        )));
      };
      q.addEventListener('input', draw);
      draw();
      const modal = openModal({ title: `${models.length} models on ${p.label}`, wide: true, body: h('div', { class: 'form' }, q, list) });
    }

    function sealPrompt() {
      if (vaultIsLocked()) {
        const pass = h('input', { class: 'input', type: 'password', placeholder: 'passphrase' });
        const modal = openModal({
          title: 'Unlock vault',
          body: h('div', { class: 'form' }, field('Passphrase', pass)),
          foot: h('div', { class: 'modal__foot' }, h('div', { class: 'push' }),
            h('button', { class: 'btn btn--ghost', onClick: () => modal.close() }, 'Cancel'),
            h('button', {
              class: 'btn btn--primary',
              onClick: async () => {
                try { await unlockVault(pass.value); toast('Vault unlocked'); modal.close(); paint(); }
                catch (err) { toast(err.message, 'err'); }
              },
            }, 'Unlock')),
        });
        return;
      }
      const pass = h('input', { class: 'input', type: 'password', placeholder: 'new passphrase' });
      const again = h('input', { class: 'input', type: 'password', placeholder: 'repeat' });
      const modal = openModal({
        title: 'Seal keys',
        body: h('div', { class: 'form' },
          h('div', { class: 'keywarn' }, h('b', {}, 'No recovery.'), h('span', {}, 'If you forget this passphrase the sealed keys are unrecoverable.')),
          field('Passphrase', pass), field('Repeat', again)),
        foot: h('div', { class: 'modal__foot' }, h('div', { class: 'push' }),
          h('button', { class: 'btn btn--ghost', onClick: () => modal.close() }, 'Cancel'),
          h('button', {
            class: 'btn btn--primary',
            onClick: async () => {
              if (pass.value.length < 8) { toast('At least 8 characters', 'warn'); return; }
              if (pass.value !== again.value) { toast('They do not match', 'warn'); return; }
              try { await lockVault(pass.value); toast('Vault sealed'); modal.close(); paint(); }
              catch (err) { toast(err.message, 'err'); }
            },
          }, 'Seal')),
      });
    }
  }

  /* ====================================================================== */
  function appearanceSection() {
    const p = state.prefs;
    const section = h('div', { class: 'col', style: { gap: '16px' } });

    const swatches = h('div', { class: 'swatches' }, THEMES.map((t) => h('button', {
      class: `swatch ${p.theme === t.id ? 'is-on' : ''}`,
      style: { background: t.swatch },
      title: t.label,
      onClick: () => { savePrefs({ theme: t.id }); applyTheme(); paint(); },
    }, t.label.slice(0, 4))));

    const accentRow = h('div', { class: 'swatches' },
      h('button', {
        class: `swatch ${!p.accent ? 'is-on' : ''}`, style: { background: 'var(--bg-4)' },
        onClick: () => { savePrefs({ accent: '' }); applyTheme(); paint(); },
      }, 'AUTO'),
      ACCENTS.map((c) => h('button', {
        class: `swatch ${p.accent === c ? 'is-on' : ''}`, style: { background: c },
        onClick: () => { savePrefs({ accent: c }); applyTheme(); paint(); },
      }, '')),
    );

    section.appendChild(h('div', { class: 'panel' },
      h('div', { class: 'panel__head' }, h('h2', {}, 'Theatre')),
      h('div', { class: 'panel__body' },
        h('div', { class: 'field__label', style: { marginBottom: '8px' } }, 'Colour scheme'),
        swatches,
        h('div', { class: 'field__label', style: { margin: '18px 0 8px' } }, 'Accent'),
        accentRow,
      ),
    ));

    const seg = (label, value, options, key) => h('div', { class: 'setrow' },
      h('div', { class: 'setrow__text' }, h('b', {}, label)),
      h('div', { class: 'segmented' }, options.map((o) => h('button', {
        class: value === o ? 'is-active' : '',
        onClick: () => { savePrefs({ [key]: o }); applyTheme(); paint(); },
      }, o))),
    );

    section.appendChild(h('div', { class: 'panel' },
      h('div', { class: 'panel__head' }, h('h2', {}, 'Density & texture')),
      h('div', { class: 'panel__body' },
        seg('Density', p.density, ['compact', 'regular', 'roomy'], 'density'),
        seg('Base font', p.font, ['sm', 'md', 'lg'], 'font'),
        seg('Poster grid', p.gridDensity, ['dense', 'regular', 'roomy'], 'gridDensity'),
        h('div', { class: 'setrow' },
          h('div', { class: 'setrow__text' }, h('b', {}, 'Film grain'), h('small', {}, 'Animated noise over the whole interface.')),
          h('label', { class: 'switch' }, h('input', {
            type: 'checkbox', checked: p.grain, onChange: (e) => { savePrefs({ grain: e.target.checked }); applyTheme(); },
          }), h('span', { class: 'switch__track' })),
        ),
        h('div', { class: 'setrow' },
          h('div', { class: 'setrow__text' }, h('b', {}, 'Scanlines'), h('small', {}, 'CRT refresh lines. Turn off for print or screenshots.')),
          h('label', { class: 'switch' }, h('input', {
            type: 'checkbox', checked: p.scanlines, onChange: (e) => { savePrefs({ scanlines: e.target.checked }); applyTheme(); },
          }), h('span', { class: 'switch__track' })),
        ),
        h('div', { class: 'setrow' },
          h('div', { class: 'setrow__text' }, h('b', {}, 'Ticker'), h('small', {}, 'The acid strip under the header with live archive numbers.')),
          h('label', { class: 'switch' }, h('input', {
            type: 'checkbox', checked: p.ticker, onChange: (e) => { savePrefs({ ticker: e.target.checked }); applyTheme(); },
          }), h('span', { class: 'switch__track' })),
        ),
        h('div', { class: 'setrow' },
          h('div', { class: 'setrow__text' }, h('b', {}, 'Rows per page'), h('small', {}, 'Library pagination.')),
          h('input', {
            class: 'input', type: 'number', min: '12', max: '300', value: String(p.pageSize),
            style: { width: '96px' },
            onChange: (e) => savePrefs({ pageSize: clamp(Number(e.target.value), 12, 300) }),
          }),
        ),
      ),
    ));
    return section;
  }

  /* ====================================================================== */
  function campaignSection() {
    const stats = computeStats(rows('titles'));
    const p = state.prefs;
    const year = p.tourYear;
    const done = rows('titles').filter((t) => t.watched_date && new Date(t.watched_date).getFullYear() === year).length;
    const section = h('div', { class: 'col', style: { gap: '16px' } });

    section.appendChild(h('div', { class: 'panel' },
      h('div', { class: 'panel__head' }, h('h2', {}, `Campaign ${year}`), h('div', { class: 'panel__tools' },
        h('span', { class: 'mono dim' }, `${done} logged`))),
      h('div', { class: 'panel__body' },
        h('div', { class: 'form__grid' },
          field('Year', h('input', {
            class: 'input', type: 'number', value: String(year),
            onChange: (e) => { savePrefs({ tourYear: Number(e.target.value) }); paint(); },
          })),
          field('Target titles', h('input', {
            class: 'input', type: 'number', value: String(p.tourTarget),
            onChange: (e) => savePrefs({ tourTarget: clamp(Number(e.target.value), 1, 999) }),
          })),
        ),
        h('div', { class: 'meter meter--tall', style: { marginTop: '16px' } },
          h('i', { style: { width: `${Math.min(100, (done / Math.max(1, p.tourTarget)) * 100)}%` } })),
        h('div', { class: 'row', style: { marginTop: '8px' } },
          h('span', { class: 'mono dim' }, `${Math.round((done / Math.max(1, p.tourTarget)) * 100)}% of ${p.tourTarget}`),
          h('span', { class: 'push' }),
          h('span', { class: 'mono dim' }, `avg score ${fmtDec(stats.avgRating, 2)}`),
        ),
        h('div', { class: 'form__note', style: { marginTop: '12px' } },
          'The campaign also shows in the sidebar meter and on the statistics page. It is stored with your preferences, not in the database — change it freely.'),
      ),
    ));

    section.appendChild(h('div', { class: 'panel' },
      h('div', { class: 'panel__head' }, h('h2', {}, 'Quick presets')),
      h('div', { class: 'panel__body' }, h('div', { class: 'pillrow' },
        [24, 52, 100, 150, 200].map((n) => h('button', {
          class: 'chip', onClick: () => { savePrefs({ tourTarget: n }); paint(); },
        }, `${n} titles / year`)))),
    ));
    return section;
  }

  /* ====================================================================== */
  function dataSection() {
    const section = h('div', { class: 'col', style: { gap: '16px' } });
    const counts = Object.entries(state.tables).filter(([, v]) => Array.isArray(v) && v.length);

    section.appendChild(h('div', { class: 'panel' },
      h('div', { class: 'panel__head' }, h('h2', {}, 'Export')),
      h('div', { class: 'panel__body' },
        h('div', { class: 'form__row' },
          h('button', {
            class: 'btn btn--primary btn--sm',
            onClick: () => {
              const snap = exportSnapshot();
              snap.tables = Object.fromEntries(Object.entries(snap.tables).map(([k, v]) => [k, Array.isArray(v) ? v : []]));
              download(`fmc-snapshot-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(snap, null, 2));
              toast('Snapshot downloaded');
            },
          }, '⇣ Full JSON snapshot'),
          h('button', {
            class: 'btn btn--sm',
            onClick: () => {
              const rowsOut = rows('titles').map((t) => ({
                title: t.title, category: t.category, type: t.type, year: t.year,
                rating: t.rating, genre: t.genre, country: t.country, language: t.language,
                status: t.status, seasons: t.seasons, episodes: t.episodes,
                watched_date: t.watched_date, favorite: t.favorite, tags: t.tags,
                summary: t.summary, story_analysis: t.story_analysis, notes: t.notes,
              }));
              const csv = [Object.keys(rowsOut[0] || {}).join(','), ...rowsOut.map((r) => Object.values(r).map((v) => {
                const s = v == null ? '' : String(v);
                return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
              }).join(','))].join('\n');
              download(`fmc-titles-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
            },
          }, '⇣ Titles CSV'),
          h('button', {
            class: 'btn btn--ghost btn--sm',
            onClick: () => copyText(JSON.stringify(exportSnapshot())),
          }, 'Copy snapshot'),
        ),
        h('div', { class: 'form__note', style: { marginTop: '10px' } },
          `Snapshot includes ${counts.map(([k, v]) => `${k} (${v.length})`).join(', ') || 'nothing yet'}. API keys are never included.`),
      ),
    ));

    section.appendChild(h('div', { class: 'panel' },
      h('div', { class: 'panel__head' }, h('h2', {}, 'Import')),
      h('div', { class: 'panel__body' },
        h('div', { class: 'form__note', style: { marginBottom: '10px' } },
          'JSON: an array of title objects, or a snapshot with a titles table. CSV: a header row with at least a "title" column.'),
        h('div', { class: 'form__row' },
          fileButton('⇡ Import JSON', 'application/json', async (text) => {
            const parsed = safeJson(text, null);
            if (!parsed) { toast('That is not valid JSON', 'err'); return; }
            const list = Array.isArray(parsed) ? parsed : parsed.titles || parsed.tables?.titles || [];
            if (!list.length) { toast('No titles found in the file', 'warn'); return; }
            const res = await importTitles(list, { source: 'json-import' });
            toast(`${res.inserted} titles imported`);
            navigate('#/library');
          }),
          fileButton('⇡ Import CSV', '.csv,text/csv', async (text) => {
            const list = parseCsv(text);
            if (!list.length) { toast('No rows found', 'warn'); return; }
            const res = await importTitles(list, { source: 'csv-import' });
            toast(`${res.inserted} titles imported`);
            navigate('#/library');
          }),
          h('button', {
            class: 'btn btn--ghost btn--sm',
            onClick: () => {
              const template = JSON.stringify([{ title: 'Example Title', category: 'good', type: 'movie', year: 1999, rating: 7.5, genre: 'drama', country: 'USA', watched_date: '2026-01-01', tags: 'example' }], null, 2);
              download('fmc-import-template.json', template);
            },
          }, '⇣ Template'),
        ),
        h('div', { class: 'form__note', style: { marginTop: '10px' } },
          'Imports are appended; nothing is overwritten. Duplicates are not filtered — clean them in the library.'),
      ),
    ));

    section.appendChild(h('div', { class: 'panel panel--danger' },
      h('div', { class: 'panel__head' }, h('h2', {}, 'Danger')),
      h('div', { class: 'panel__body' },
        h('div', { class: 'setrow' },
          h('div', { class: 'setrow__text' }, h('b', {}, 'Clear local cache'),
            h('small', {}, 'Removes the cached title list and the offline outbox. The database is untouched.')),
          h('button', {
            class: 'btn btn--danger btn--sm',
            onClick: async () => {
              const ok = await confirmAction({ title: 'Clear local cache', body: 'Only this browser\'s cache is cleared.', ok: 'Clear' });
              if (!ok) return;
              localStorage.removeItem(`${APP.storagePrefix}titles.cache`);
              state.client?.clearQueue();
              toast('Cache cleared');
            },
          }, 'Clear'),
        ),
        h('div', { class: 'setrow' },
          h('div', { class: 'setrow__text' }, h('b', {}, 'Wipe demo database'),
            h('small', {}, 'Only in demo mode: deletes seeded localStorage tables and reloads.')),
          h('button', {
            class: 'btn btn--danger btn--sm',
            onClick: async () => {
              if (!state.client?.isDemo) { toast('Only available in demo mode', 'warn'); return; }
              const ok = await confirmAction({ title: 'Wipe demo data', body: 'All local demo rows are erased and reseeded on reload.', ok: 'Wipe' });
              if (!ok) return;
              state.client.wipeLocal();
              location.reload();
            },
          }, 'Wipe'),
        ),
      ),
    ));

    return section;

    function fileButton(label, accept, onText) {
      const input = h('input', { type: 'file', accept, style: { display: 'none' } });
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          const text = await readFile(file);
          await onText(String(text));
        } catch (err) {
          toast(err.message || 'Import failed', 'err');
        } finally { input.value = ''; }
      });
      const btn = h('button', { class: 'btn btn--sm', onClick: () => input.click() }, label);
      return h('span', {}, input, btn);
    }
  }

  /* ====================================================================== */
  function accountSection() {
    const c = state.client;
    const u = c?.user;
    const section = h('div', { class: 'col', style: { gap: '16px' } });
    section.appendChild(h('div', { class: 'panel' },
      h('div', { class: 'panel__head' }, h('h2', {}, 'Operator')),
      h('div', { class: 'panel__body' },
        h('div', { class: 'row', style: { gap: '14px' } },
          h('div', { class: 'avatar', style: { width: '52px', height: '52px', fontSize: '20px' } },
            String(u?.email || 'OP').slice(0, 2).toUpperCase()),
          h('div', {},
            h('div', { style: { fontFamily: 'var(--font-display)', fontSize: '24px', textTransform: 'uppercase' } }, u?.email || 'offline operator'),
            h('div', { class: 'mono dim', style: { fontSize: '10px' } }, u?.id || 'no id'),
          ),
        ),
        h('div', { class: 'hairline', style: { margin: '16px 0' } }),
        h('dl', { class: 'deflist' },
          h('div', { class: 'deflist__row' }, h('dt', {}, 'Session'), h('dd', {}, c?.isDemo ? 'local' : `expires ${c?.session?.expires_at ? new Date(c.session.expires_at * 1000).toLocaleString() : '—'}`)),
          h('div', { class: 'deflist__row' }, h('dt', {}, 'Created'), h('dd', {}, u?.created_at ? fmtDate(u.created_at) : '—')),
          h('div', { class: 'deflist__row' }, h('dt', {}, 'Provider'), h('dd', {}, c?.isDemo ? 'localStorage' : 'Supabase auth')),
        ),
        h('div', { class: 'form__row', style: { marginTop: '16px' } },
          h('button', {
            class: 'btn btn--sm',
            onClick: async () => {
              try { await c.refresh(); toast('Session refreshed'); }
              catch (err) { toast(err.message, 'err'); }
            },
          }, 'Refresh session'),
          h('button', {
            class: 'btn btn--danger btn--sm',
            onClick: async () => {
              const ok = await confirmAction({ title: 'Sign out', body: 'The session is cleared from this browser. Your rows stay in Supabase.', ok: 'Sign out' });
              if (!ok) return;
              await c.signOut();
              location.reload();
            },
          }, 'Sign out'),
        ),
      ),
    ));
    return section;
  }

  /* ====================================================================== */
  function buildSection() {
    return h('div', { class: 'col', style: { gap: '16px' } },
      h('div', { class: 'panel' },
        h('div', { class: 'panel__head' }, h('h2', {}, 'Build')),
        h('div', { class: 'panel__body' },
          h('dl', { class: 'deflist' },
            h('div', { class: 'deflist__row' }, h('dt', {}, 'App'), h('dd', {}, APP.name)),
            h('div', { class: 'deflist__row' }, h('dt', {}, 'Version'), h('dd', {}, APP.version)),
            h('div', { class: 'deflist__row' }, h('dt', {}, 'Build'), h('dd', {}, APP.build)),
            h('div', { class: 'deflist__row' }, h('dt', {}, 'Storage prefix'), h('dd', {}, APP.storagePrefix)),
            h('div', { class: 'deflist__row' }, h('dt', {}, 'User agent'), h('dd', { class: 'mono', style: { fontSize: '9.5px', maxWidth: '60%' } }, navigator.userAgent)),
          ),
          h('div', { class: 'form__note', style: { marginTop: '12px' } },
            'No build step. No bundler. Plain ES modules, one stylesheet layer per concern, zero runtime dependencies.'),
        ),
      ),
      h('div', { class: 'panel' },
        h('div', { class: 'panel__head' }, h('h2', {}, 'Keyboard reference')),
        h('div', { class: 'panel__body', style: { display: 'grid', gap: '6px' } },
          [['⌘K', 'Command deck'], ['N', 'New dossier'], ['A', 'AI studio'], ['T', 'Theme'],
            ['/', 'Search'], ['?', 'Field manual'], ['Esc', 'Close']].map(([k, v]) => h('div', { class: 'row', style: { gap: '10px' } },
            h('kbd', { class: 'kbd' }, k), h('span', { style: { fontSize: '13px', color: 'var(--ink-2)' } }, v))),
        ),
      ),
    );
  }
}

const pad2 = (n) => String(n).padStart(2, '0');
