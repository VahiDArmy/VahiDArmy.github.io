/* ============================================================================
   FULL METAL CINEMA — model arena + prompt rack
   ========================================================================== */

import {
  h, md, toast, field, openModal, confirmAction, emptyState, fmtDec, fmtRel,
  fmtNum, copyText, sortBy, clamp,
} from '../lib/dom.js';
import {
  state, rows, addRow, updateRow, removeRow, saveAi, titleById, upsertRow, logActivity,
} from '../lib/store.js';
import { SEED_PROMPTS, PROVIDERS } from '../config.js';
import {
  chat, resolveAiConfig, fetchModels, extractJson, maskKey, AI_PRESETS,
} from '../lib/ai.js';
import { navigate } from './shared.js';

/* ========================================================================== */
/*  ARENA                                                                    */
/* ========================================================================== */
export function renderArena(root) {
  const models = rows('models');
  const cfg = resolveAiConfig();

  root.appendChild(h('div', { class: 'viewhead' },
    h('div', { class: 'sect__num' }, '06'),
    h('div', {},
      h('h1', {}, 'Model arena'),
      h('div', { class: 'viewhead__sub' }, `${models.length} models in the ledger · ${models.reduce((a, m) => a + (m.wins || 0), 0)} wins recorded`),
    ),
    h('div', { class: 'viewhead__tools' },
      h('button', {
        class: 'btn btn--ghost btn--sm',
        onClick: async (e) => {
          const b = e.currentTarget;
          b.classList.add('is-busy');
          try {
            const remote = await fetchModels(cfg);
            let added = 0;
            for (const m of remote.slice(0, 120)) {
              if (rows('models').some((x) => x.id === m.id)) continue;
              await upsertRow('models', {
                id: m.id, label: m.label || m.id, provider: cfg.providerMeta.id,
                is_free: /free/i.test(m.id), active: true, source: 'sync',
                wins: 0, losses: 0, context: m.context ? String(m.context) : '',
              }, 'id');
              added += 1;
            }
            toast(`${added} models imported from ${cfg.providerMeta.label}`);
            navigate('#/arena');
          } catch (err) { toast(err.message, 'err'); }
          finally { b.classList.remove('is-busy'); }
        },
      }, '⇣ Sync from provider'),
      h('button', { class: 'btn btn--ghost btn--sm', onClick: () => navigate('#/settings') }, 'AI settings'),
    ),
  ));

  /* ---------- duel ---------- */
  const aSel = h('select', { class: 'select' }, modelOptions(models, cfg.model));
  const bSel = h('select', { class: 'select' }, modelOptions(models, models[1]?.id || cfg.model));
  const titleSel = h('select', { class: 'select' }, h('option', { value: '' }, 'no dossier'),
    rows('titles').slice(0, 120).map((t) => h('option', { value: t.id }, t.title)));
  const prompt = h('textarea', { class: 'textarea', rows: '2', placeholder: 'The question both models must answer…' },
    `Pitch a double bill with the selected title as the first half. Two lines on each half, then one sentence on the seam between them.`);

  const leftBody = h('div', { class: 'arena__colbody' }, h('div', { class: 'muted' }, 'Idle.'));
  const rightBody = h('div', { class: 'arena__colbody' }, h('div', { class: 'muted' }, 'Idle.'));
  const leftStats = h('div', { class: 'arena__stats' });
  const rightStats = h('div', { class: 'arena__stats' });
  const leftCol = h('div', { class: 'arena__col' },
    h('div', { class: 'arena__colhead' }, h('span', { class: 'dot is-ok' }), h('span', { class: 'mono' }, 'A'), h('b', { class: 'push mono', style: { fontWeight: '400' } }, '')),
    leftBody, leftStats);
  const rightCol = h('div', { class: 'arena__col' },
    h('div', { class: 'arena__colhead' }, h('span', { class: 'dot is-warn' }), h('span', { class: 'mono' }, 'B'), h('b', { class: 'push mono', style: { fontWeight: '400' } }, '')),
    rightBody, rightStats);

  let resultA = null, resultB = null;
  const voteRow = h('div', { class: 'form__row', hidden: true },
    h('span', { class: 'mono dim' }, 'WHO WON?'),
    h('button', { class: 'btn btn--primary btn--sm', onClick: () => castVote('a') }, 'A wins'),
    h('button', { class: 'btn btn--primary btn--sm', onClick: () => castVote('b') }, 'B wins'),
    h('button', { class: 'btn btn--ghost btn--sm', onClick: () => castVote('tie') }, 'Tie'),
    h('span', { class: 'form__note' }, 'Votes update the wins / losses columns on cinema_ai_models.'),
  );

  async function duel() {
    if (!prompt.value.trim()) { toast('Write a question', 'warn'); return; }
    if (!cfg.apiKey && !cfg.keyless) { toast('No key on this device', 'err'); return; }
    const t = titleSel.value ? titleById(titleSel.value) : null;
    voteRow.hidden = true;
    leftCol.classList.remove('is-winner');
    rightCol.classList.remove('is-winner');
    leftBody.replaceChildren(h('div', { class: 'think-dots' }, h('i'), h('i'), h('i')));
    rightBody.replaceChildren(h('div', { class: 'think-dots' }, h('i'), h('i'), h('i')));
    leftStats.replaceChildren();
    rightStats.replaceChildren();
    leftCol.querySelector('b').textContent = aSel.value;
    rightCol.querySelector('b').textContent = bSel.value;

    const ctx = t ? `Title: ${t.title} (${t.year || '—'}, ${t.genre || '—'}, ${t.country || '—'}). My score ${t.rating}/10, verdict ${t.category}. ${t.summary || ''}` : '';
    const messages = [{ role: 'user', content: prompt.value }];

    const runOne = async (modelId, bodyEl, statsEl) => {
      const started = performance.now();
      let text = '';
      try {
        const res = await chat({
          messages,
          config: { model: modelId, context: ctx, streaming: true, reasoning: false },
          onDelta: (chunk, all) => { text = all; bodyEl.innerHTML = md(all); },
        });
        const ms = Math.round(performance.now() - started);
        statsEl.replaceChildren(
          h('span', {}, `${fmtNum(res.usage?.total_tokens || 0)} tok`),
          h('span', {}, `${ms} ms`),
          h('span', {}, `${fmtDec((res.usage?.completion_tokens || 0) / (ms / 1000), 1)} tok/s`),
        );
        return { modelId, text: res.text, ms, usage: res.usage };
      } catch (err) {
        bodyEl.innerHTML = `<span class="blood">${err.message}</span>`;
        statsEl.replaceChildren(h('span', { class: 'blood' }, 'failed'));
        return { modelId, text: '', error: err.message };
      }
    };

    [resultA, resultB] = await Promise.all([
      runOne(aSel.value, leftBody, leftStats),
      runOne(bSel.value, rightBody, rightStats),
    ]);
    voteRow.hidden = !(resultA.text && resultB.text);
  }

  async function castVote(which) {
    if (!resultA || !resultB) return;
    const winner = which === 'a' ? aSel.value : which === 'b' ? bSel.value : null;
    const loser = which === 'a' ? bSel.value : which === 'b' ? aSel.value : null;
    if (which === 'tie') {
      await bump(aSel.value, 'tie');
      await bump(bSel.value, 'tie');
      toast('Tie recorded');
    } else {
      await bump(winner, 'win');
      await bump(loser, 'loss');
      leftCol.classList.toggle('is-winner', which === 'a');
      rightCol.classList.toggle('is-winner', which === 'b');
      toast(`${winner} recorded a win`);
    }
    voteRow.hidden = true;
  }

  async function bump(modelId, kind) {
    let m = rows('models').find((x) => x.id === modelId);
    if (!m) {
      await addRow('models', { id: modelId, label: modelId, provider: cfg.providerMeta.id, wins: kind === 'win' ? 1 : 0, losses: kind === 'loss' ? 1 : 0, active: true, source: 'vote' });
      return;
    }
    await updateRow('models', m.id, {
      wins: (m.wins || 0) + (kind === 'win' ? 1 : 0),
      losses: (m.losses || 0) + (kind === 'loss' ? 1 : 0),
      last_tried_at: new Date().toISOString(),
    });
  }

  root.appendChild(h('div', { class: 'arena' },
    h('div', { class: 'panel' },
      h('div', { class: 'panel__head' }, h('h2', {}, 'Set the duel'), h('div', { class: 'panel__tools' },
        h('span', { class: 'mono dim' }, cfg.providerMeta.label))),
      h('div', { class: 'panel__body' },
        h('div', { class: 'form__grid', style: { gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' } },
          field('Model A', aSel), field('Model B', bSel), field('Dossier', titleSel)),
        h('div', { style: { marginTop: '10px' } }, field('Question', prompt)),
        h('div', { class: 'form__row', style: { marginTop: '10px' } },
          h('button', { class: 'btn btn--primary', onClick: duel }, '⚔ Run both'),
          h('button', {
            class: 'btn btn--ghost btn--sm',
            onClick: () => {
              const arr = rows('models').filter((m) => m.active !== false);
              if (arr.length < 2) { toast('Need two models', 'warn'); return; }
              aSel.value = arr[0].id;
              bSel.value = arr[1].id;
            },
          }, 'Shuffle pair'),
          h('span', { class: 'form__note' }, 'Both calls use the same prompt and the same dossier context, streamed in parallel.'),
        ),
        voteRow,
      ),
    ),
    h('div', { class: 'arena__cols' }, leftCol, rightCol),
  ));

  /* ---------- leaderboard ---------- */
  const ranked = sortBy(models.filter((m) => (m.wins || 0) + (m.losses || 0) > 0),
    (m) => (m.wins || 0) / Math.max(1, (m.wins || 0) + (m.losses || 0)), -1);
  const board = h('div', { class: 'panel' },
    h('div', { class: 'panel__head' }, h('h2', {}, 'Ledger'), h('div', { class: 'panel__tools' },
      h('span', { class: 'mono dim' }, `${models.length} rows`))),
    h('div', { class: 'panel__body panel__body--flush', style: { overflowX: 'auto' } },
      models.length ? h('table', { class: 'table table--tight' },
        h('thead', {}, h('tr', {},
          h('th', {}, ''), h('th', {}, 'Model'), h('th', {}, 'Provider'), h('th', {}, 'W'), h('th', {}, 'L'), h('th', {}, 'Win %'), h('th', {}, 'Free'), h('th', {}, 'Last tried'), h('th', {}, ''),
        )),
        h('tbody', {}, sortBy(models, (m) => (m.wins || 0) - (m.losses || 0), -1).map((m) => {
          const total = (m.wins || 0) + (m.losses || 0);
          const rate = total ? (m.wins || 0) / total : 0;
          return h('tr', {},
            h('td', {}, h('button', {
              class: 'iconbtn', title: 'Use in studio',
              onClick: () => { saveAi({ model: m.id, provider: m.provider || state.ai.provider }); toast(`Studio model → ${m.id}`); },
            }, '→')),
            h('td', {}, h('div', { class: 'modelrow__id' }, m.id),
              m.label && m.label !== m.id ? h('div', { class: 'modelrow__meta' }, m.label) : null),
            h('td', { class: 'mono dim' }, m.provider || '—'),
            h('td', { class: 'table__num', style: { color: '#58d98a' } }, String(m.wins || 0)),
            h('td', { class: 'table__num', style: { color: 'var(--blood)' } }, String(m.losses || 0)),
            h('td', { class: 'table__num' }, total ? `${Math.round(rate * 100)}%` : '—'),
            h('td', {}, m.is_free ? h('span', { class: 'badge badge--good' }, 'free') : h('span', { class: 'mono dim' }, 'paid')),
            h('td', { class: 'mono dim' }, m.last_tried_at ? fmtRel(m.last_tried_at) : '—'),
            h('td', {}, h('button', {
              class: 'iconbtn', title: 'Remove',
              onClick: async () => {
                const ok = await confirmAction({ title: 'Remove model', body: `${m.id} leaves the ledger.`, ok: 'Remove' });
                if (ok) { await removeRow('models', m.id); navigate('#/arena'); }
              },
            }, '✕')),
          );
        })),
      ) : emptyState({ glyph: '⚔', title: 'No models in the ledger', body: 'Sync from your provider, or vote on a duel. Every model you try gets a row.', action: h('button', { class: 'btn btn--primary', onClick: () => navigate('#/settings') }, 'Set up AI') }),
    ),
  );
  root.appendChild(h('div', { style: { height: '16px' } }));
  root.appendChild(board);

  if (ranked.length) {
    root.appendChild(h('div', { style: { height: '16px' } }));
    root.appendChild(h('div', { class: 'panel' },
      h('div', { class: 'panel__head' }, h('h2', {}, 'Podium')),
      h('div', { class: 'panel__body' }, h('div', { class: 'statgrid', style: { margin: 0 } },
        ranked.slice(0, 3).map((m, i) => h('div', { class: `stat ${i === 0 ? 'stat--accent' : ''}` },
          h('div', { class: 'stat__label' }, `#${i + 1} · ${m.provider || 'model'}`),
          h('div', { class: 'stat__value', style: { fontSize: '18px', lineHeight: '1.2' } }, m.label || m.id),
          h('div', { class: 'stat__delta' }, `${m.wins}W / ${m.losses}L`),
        )),
      )),
    ));
  }
}

function modelOptions(models, selected) {
  const known = models.length ? models : [];
  if (!known.length) return h('option', { value: selected || '' }, selected || 'no models');
  return known.map((m) => h('option', { value: m.id, selected: m.id === selected }, `${m.label || m.id}${m.is_free ? ' · free' : ''}`));
}

/* ========================================================================== */
/*  PROMPT RACK                                                              */
/* ========================================================================== */
export function renderPrompts(root) {
  const custom = rows('prompts');
  const titles = rows('titles');

  root.appendChild(h('div', { class: 'viewhead' },
    h('div', { class: 'sect__num' }, '07'),
    h('div', {},
      h('h1', {}, 'Prompt rack'),
      h('div', { class: 'viewhead__sub' }, `${SEED_PROMPTS.length} field prompts · ${custom.length} of your own`),
    ),
    h('div', { class: 'viewhead__tools' },
      h('button', { class: 'btn btn--primary', onClick: () => editPrompt(null) }, '＋ New prompt'),
      h('button', { class: 'btn btn--ghost', onClick: () => navigate('#/studio') }, 'Studio'),
    ),
  ));

  const all = [
    ...custom.map((p) => ({ ...p, _custom: true })),
    ...SEED_PROMPTS.map((p) => ({ ...p, _seed: true })),
  ];

  const grid = h('div', { class: 'collgrid' });
  all.forEach((p) => {
    grid.appendChild(h('div', { class: 'coll' },
      h('div', { class: 'coll__stripe', style: { background: p._custom ? 'var(--accent)' : 'var(--line-2)' } }),
      h('div', { class: 'row' },
        h('span', { class: 'eyebrow' }, p.category || 'uncategorised'),
        h('span', { class: 'push' }),
        p._custom ? h('button', { class: 'iconbtn', onClick: (e) => { e.stopPropagation(); editPrompt(p); } }, '✎') : null,
        p._custom ? h('button', { class: 'iconbtn', onClick: async (e) => { e.stopPropagation(); await removeRow('prompts', p.id); navigate('#/prompts'); } }, '✕') : null,
      ),
      h('div', { class: 'coll__name', style: { fontSize: '17px' } }, p.name),
      h('div', { class: 'coll__desc clamp-3' }, p.body),
      h('div', { class: 'row', style: { gap: '4px', flexWrap: 'wrap' } },
        h('button', {
          class: 'btn btn--primary btn--sm',
          onClick: () => runPrompt(p),
        }, 'Run in studio'),
        h('button', { class: 'btn btn--ghost btn--sm', onClick: () => copyText(p.body) }, 'Copy'),
        p._custom ? h('button', {
          class: 'btn btn--ghost btn--sm',
          onClick: async () => {
            await addRow('prompts', { name: `${p.name} (copy)`, body: p.body, category: p.category });
            toast('Copied into your rack');
            navigate('#/prompts');
          },
        }, 'Duplicate') : null,
      ),
    ));
  });
  root.appendChild(grid);

  function runPrompt(p) {
    const body = p.body.replace(/\{\{\s*title\s*\}\}/g, titles[0]?.title || 'a title from my shelf');
    sessionStorage.setItem('fmc.prefill', body);
    navigate('#/studio');
  }

  function editPrompt(p) {
    const name = h('input', { class: 'input', value: p?.name || '', placeholder: 'Name' });
    const body = h('textarea', { class: 'textarea', rows: '7', placeholder: 'Prompt body. Use {{title}} for the dossier.' }, p?.body || '');
    const cat = h('input', { class: 'input', value: p?.category || 'review', placeholder: 'category' });
    const modal = openModal({
      title: p ? 'Edit prompt' : 'New prompt',
      wide: true,
      body: h('div', { class: 'form' },
        h('div', { class: 'form__grid' }, field('Name', name), field('Category', cat)),
        field('Body', body),
        h('div', { class: 'form__note' }, 'Placeholders: {{title}} {{year}} {{genre}} {{category}} {{rating}} — they are filled from the dossier context.'),
      ),
      foot: h('div', { class: 'modal__foot' },
        h('div', { class: 'push' }),
        h('button', { class: 'btn btn--ghost', onClick: () => modal.close() }, 'Cancel'),
        h('button', {
          class: 'btn btn--primary',
          onClick: async () => {
            if (!name.value.trim() || !body.value.trim()) { toast('Name and body required', 'warn'); return; }
            if (p) await updateRow('prompts', p.id, { name: name.value, body: body.value, category: cat.value });
            else await addRow('prompts', { name: name.value, body: body.value, category: cat.value });
            toast('Prompt saved');
            modal.close();
            navigate('#/prompts');
          },
        }, 'Save'),
      ),
    });
  }
}
