/* ============================================================================
   FULL METAL CINEMA — dossier
   one title, every field, every relationship, and a machine that can argue
   ========================================================================== */

import {
  h, md, fmtDec, fmtDate, fmtRel, fmtDur, posterEl, posterStyle, initials, toast,
  openModal, confirmAction, field, copyText, download, emptyState, tabBar, chips,
  safeJson, clamp,
} from '../lib/dom.js';
import {
  state, rows, titleById, saveTitle, deleteTitle, toggleFavorite, quickRate,
  toggleWatchlist, onWatchlist, addRow, removeRow, updateRow, titleMeta,
  similarTitles, affinity, splitTags, logActivity, normaliseTitle,
} from '../lib/store.js';
import { CATEGORIES, TYPES, STATUSES, MOODS, DEVICES } from '../config.js';
import {
  chat, dossierContext, resolveAiConfig, AI_PRESETS, extractJson, activeKey,
  estimateTokens, maskKey,
} from '../lib/ai.js';
import { navigate, openEditor, ratingPanel, titleCard, posterStrip } from './shared.js';

export function renderDossier(root, { id } = {}) {
  const t = titleById(id);
  if (!t) {
    root.appendChild(emptyState({
      glyph: '404',
      title: 'Dossier not found',
      body: 'That title is not on this shelf. It may have been deleted, or the link belongs to another account.',
      action: h('button', { class: 'btn btn--primary', onClick: () => navigate('#/library') }, 'Back to library'),
    }));
    return;
  }

  const catMeta = CATEGORIES.find((c) => c.id === t.category) || CATEGORIES[1];
  const rating = rows('ratings').find((r) => r.title_id === t.id);
  const quotes = rows('quotes').filter((q) => q.title_id === t.id);
  const sessions = rows('sessions').filter((s) => s.title_id === t.id);
  const credits = rows('credits').filter((c) => c.title_id === t.id);
  const trivia = rows('trivia').filter((x) => x.title_id === t.id);
  const inColl = rows('collectionItems').filter((ci) => ci.title_id === t.id)
    .map((ci) => rows('collections').find((c) => c.id === ci.collection_id)).filter(Boolean);

  /* ---------- hero ---------- */
  const hero = h('div', { class: 'dossier__hero' });
  if (t.backdrop_url || t.poster_url) {
    hero.appendChild(h('div', { class: 'dossier__bg', style: { backgroundImage: `url("${t.backdrop_url || t.poster_url}")` } }));
  }
  hero.appendChild(h('div', { class: 'dossier__poster' }, posterEl(t)));

  const scoreBox = h('div', { class: 'row', style: { gap: '10px', alignItems: 'baseline' } },
    h('b', { style: { fontFamily: 'var(--font-display)', fontSize: '44px', lineHeight: '.8', color: Number(t.rating) >= 8 ? 'var(--accent)' : 'var(--ink)' } }, fmtDec(t.rating, 1)),
    h('span', { class: 'mono dim' }, '/ 10'),
    h('span', { class: 'mono dim', style: { fontSize: '9.5px' } }, `${affinity(t) > 0.6 ? 'HIGH AFFINITY' : affinity(t) > 0.3 ? 'MID AFFINITY' : 'OUTLIER'}`),
  );

  const facts = h('dl', { class: 'dossier__facts' });
  const fact = (k, v, small = '') => {
    if (v == null || v === '' || v === '—') return;
    facts.appendChild(h('div', { class: 'fact' },
      h('dt', {}, k),
      h('dd', {}, String(v), small ? h('small', {}, ` ${small}`) : null),
    ));
  };
  fact('Year', t.year || '—');
  fact('Format', t.type);
  fact('Genre', (t.genre || '—').split(',')[0]);
  fact('Country', t.country || '—');
  fact('Language', t.language || '—');
  fact('Status', t.status || 'watched');
  if (t.seasons) fact('Seasons', t.seasons);
  if (t.episodes) fact('Episodes', t.episodes);
  if (t.runtime) fact('Runtime', fmtDur(t.runtime));
  fact('Watched', t.watched_date ? fmtDate(t.watched_date) : '—');

  hero.appendChild(h('div', {},
    h('div', { class: 'dossier__kicker' },
      h('span', { class: `badge badge--${t.category}` }, `${catMeta.glyph} ${catMeta.label}`),
      t.favorite ? h('span', { class: 'badge badge--fav' }, '★ KEPT') : null,
      h('span', { class: 'badge badge--type' }, t.type),
      t.status && t.status !== 'watched' ? h('span', { class: 'badge badge--soft' }, t.status) : null,
      inColl.length ? h('span', { class: 'badge badge--soft' }, `${inColl.length} collection${inColl.length > 1 ? 's' : ''}`) : null,
    ),
    h('h1', { class: 'dossier__title' }, t.title),
    t.original_title ? h('div', { class: 'dossier__orig' }, t.original_title) : null,
    scoreBox,
    facts,
    t.summary ? h('p', { class: 'dossier__summary' }, t.summary) : null,
    h('div', { class: 'dossier__actions' },
      h('button', { class: 'btn btn--primary', onClick: () => openEditor({ title: t, onSaved: () => rerender() }) }, '✎ Edit dossier'),
      h('button', {
        class: 'btn',
        onClick: async (e) => {
          const btn = e.currentTarget;
          try {
            const next = await toggleFavorite(t.id);
            btn.classList.toggle('is-on', next);
            t.favorite = next;
            toast(next ? 'Kept forever' : 'Unstarred');
            rerender();
          } catch (err) { toast(err.message, 'err'); }
        },
      }, t.favorite ? '★ Starred' : '☆ Star'),
      h('button', {
        class: 'btn',
        onClick: async (e) => {
          const btn = e.currentTarget;
          const added = await toggleWatchlist(t.id);
          btn.classList.toggle('is-on', added);
          toast(added ? 'Queued' : 'Dequeued');
        },
      }, onWatchlist(t.id) ? '▣ Queued' : '▢ Queue'),
      h('button', { class: 'btn btn--ghost', onClick: () => shareSheet(t) }, '⌁ Export'),
      h('button', { class: 'btn btn--ghost', onClick: () => navigate('#/studio') }, '✦ Ask the machine'),
      h('button', {
        class: 'btn btn--ghost',
        onClick: async () => {
          const ok = await confirmAction({ title: 'Delete dossier', body: `"${t.title}" will be removed from the archive.`, ok: 'Delete' });
          if (!ok) return;
          await deleteTitle(t.id);
          toast('Dossier deleted');
          navigate('#/library');
        },
      }, 'Delete'),
    ),
  ));

  const layout = h('div', { class: 'dossier' });
  layout.appendChild(hero);

  /* ---------- tabs ---------- */
  const body = h('div', {});
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'analysis', label: 'Analysis' },
    { id: 'notes', label: 'Notes' },
    { id: 'score', label: 'Criteria' },
    { id: 'quotes', label: `Quotes (${quotes.length})` },
    { id: 'sessions', label: `Sessions (${sessions.length})` },
    { id: 'credits', label: `Credits (${credits.length})` },
    { id: 'related', label: 'Neighbours' },
    { id: 'machine', label: '✦ Machine' },
  ];
  let active = 'overview';

  const tabHost = h('div', { class: 'tabs' });
  const paintTabs = () => {
    tabHost.replaceChildren(...tabs.map((tab) => h('button', {
      class: `tab ${active === tab.id ? 'is-active' : ''}`,
      onClick: () => { active = tab.id; paintTabs(); paint(); },
    }, tab.label)));
  };

  function paint() {
    body.replaceChildren();
    switch (active) {
      case 'analysis': body.appendChild(analysisPanel()); break;
      case 'notes': body.appendChild(notesPanel()); break;
      case 'score': body.appendChild(scorePanel()); break;
      case 'quotes': body.appendChild(quotesPanel()); break;
      case 'sessions': body.appendChild(sessionsPanel()); break;
      case 'credits': body.appendChild(creditsPanel()); break;
      case 'related': body.appendChild(relatedPanel()); break;
      case 'machine': body.appendChild(machinePanel()); break;
      default: body.appendChild(overviewPanel());
    }
    document.dispatchEvent(new CustomEvent('fmc:painted'));
  }

  /* ---------- overview ---------- */
  function overviewPanel() {
    const grid = h('div', { class: 'dossier__cols' });
    const left = h('div', { class: 'col', style: { gap: '16px' } });
    const right = h('div', { class: 'col', style: { gap: '16px' } });

    left.appendChild(h('div', { class: 'panel' },
      h('div', { class: 'panel__head' }, h('h2', {}, 'Synopsis'), h('div', { class: 'panel__tools' },
        h('span', { class: 'mono dim' }, `${(t.summary || '').split(/\s+/).filter(Boolean).length} words`))),
      h('div', { class: 'panel__body' },
        t.summary ? h('div', { class: 'prose', html: md(t.summary) }) : h('div', { class: 'muted' }, 'No synopsis filed.'),
        t.reason ? h('div', { style: { marginTop: '14px' } },
          h('div', { class: 'field__label' }, 'Verdict reason'),
          h('div', { class: 'prose', html: md(t.reason) }),
        ) : null,
      ),
    ));

    left.appendChild(h('div', { class: 'panel' },
      h('div', { class: 'panel__head' }, h('h2', {}, 'Verdict ledger'),
        h('div', { class: 'panel__tools' },
          h('button', { class: 'btn btn--ghost btn--sm', onClick: () => { active = 'score'; paintTabs(); paint(); } }, 'Edit criteria'))),
      h('div', { class: 'panel__body' },
        rating
          ? h('div', { class: 'dial' }, [['story', 'Story'], ['acting', 'Acting'], ['direction', 'Direction'], ['visuals', 'Visuals'], ['sound', 'Sound'], ['rewatch', 'Rewatch']].map(([k, l]) => h('div', { class: 'dial__cell' },
            h('div', { class: 'dial__head' }, h('span', {}, l), h('b', {}, String(rating[k] ?? 0))),
            h('div', { class: 'dial__track' }, h('i', { style: { width: `${(Number(rating[k]) || 0) * 10}%` } })),
          )))
          : h('div', { class: 'muted' }, 'No criteria scores yet. The criteria tab breaks a verdict into six parts.'),
        rating?.review ? h('div', { class: 'prose', style: { marginTop: '14px' } }, h('blockquote', {}, rating.review)) : null,
      ),
    ));

    if (trivia.length) {
      left.appendChild(h('div', { class: 'panel' },
        h('div', { class: 'panel__head' }, h('h2', {}, 'Trivia')),
        h('div', { class: 'panel__body' }, h('div', { class: 'col' }, trivia.map((x) => h('div', { class: 'prose', html: md(x.content) })))),
      ));
    }

    right.appendChild(h('div', { class: 'panel' },
      h('div', { class: 'panel__head' }, h('h2', {}, 'File')),
      h('div', { class: 'panel__body' },
        h('dl', { class: 'deflist' },
          defRow('Added', fmtDate(t.created_at)),
          defRow('Updated', fmtRel(t.updated_at)),
          defRow('Source', t.source || 'manual'),
          defRow('Tags', splitTags(t.tags).length ? '' : '—'),
        ),
        splitTags(t.tags).length ? h('div', { class: 'pillrow', style: { marginTop: '8px' } },
          splitTags(t.tags).map((tag) => h('button', {
            class: 'chip', onClick: () => navigate(`#/library?q=${encodeURIComponent(tag)}`),
          }, `#${tag}`))) : null,
        t.trailer_url ? h('a', { class: 'btn btn--ghost btn--sm', style: { marginTop: '10px' }, href: t.trailer_url, target: '_blank', rel: 'noopener' }, '▶ Trailer') : null,
        t.poster_url ? h('div', { class: 'mono dim', style: { marginTop: '10px', fontSize: '9.5px', wordBreak: 'break-all' } }, 'poster: ' + t.poster_url) : null,
      ),
    ));

    const wl = rows('watchlist').find((w) => w.title_id === t.id && !w.done);
    if (wl) {
      right.appendChild(h('div', { class: 'panel' },
        h('div', { class: 'panel__head' }, h('h2', {}, 'Queued')),
        h('div', { class: 'panel__body' },
          h('dl', { class: 'deflist' }, defRow('Priority', wl.priority || 0), defRow('Queued', fmtRel(wl.created_at))),
          wl.note ? h('div', { class: 'prose', style: { marginTop: '8px' } }, wl.note) : null,
          h('button', {
            class: 'btn btn--ghost btn--sm', style: { marginTop: '8px' },
            onClick: async () => {
              await updateRow('watchlist', wl.id, { done: true });
              toast('Marked as watched');
              rerender();
            },
          }, '✓ Mark watched'),
        ),
      ));
    }

    if (inColl.length) {
      right.appendChild(h('div', { class: 'panel' },
        h('div', { class: 'panel__head' }, h('h2', {}, 'Filed under')),
        h('div', { class: 'panel__body' }, h('div', { class: 'pillrow' },
          inColl.map((c) => h('button', { class: 'chip', onClick: () => navigate(`#/collections/${c.id}`) }, `${c.icon || '❏'} ${c.name}`)))),
      ));
    }

    const evs = rows('activity').filter((a) => a.entity_id === t.id).slice(0, 8);
    if (evs.length) {
      right.appendChild(h('div', { class: 'panel' },
        h('div', { class: 'panel__head' }, h('h2', {}, 'History')),
        h('div', { class: 'panel__body panel__body--flush' },
          h('div', { class: 'act' }, evs.map((a) => h('div', { class: 'act__row', style: { gridTemplateColumns: '1fr auto' } },
            h('div', { class: 'act__what' }, h('b', {}, a.action), ' ', a.detail && a.detail !== t.title ? a.detail : ''),
            h('div', { class: 'act__time' }, fmtRel(a.created_at)),
          )))),
      ));
    }

    grid.appendChild(left);
    grid.appendChild(right);
    return grid;
  }

  function defRow(k, v) {
    return h('div', { class: 'deflist__row' }, h('dt', {}, k), h('dd', {}, String(v)));
  }

  /* ---------- analysis ---------- */
  function analysisPanel() {
    const out = h('div', { class: 'prose' }, t.story_analysis ? null : h('span', { class: 'muted' }, 'No analysis yet. Write one, or make the machine draft it and then argue with it.'));
    if (t.story_analysis) out.innerHTML = md(t.story_analysis);
    const stream = h('div', { class: 'prose', style: { marginTop: '12px' } });
    const btnRow = h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } });
    let busy = false;
    const aiBtn = h('button', { class: 'btn btn--primary btn--sm' }, '✦ Draft analysis');
    aiBtn.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      stream.replaceChildren();
      btnRow.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      const reasonBox = h('div', { class: 'reason' },
        h('div', { class: 'reason__head' }, h('span', {}, 'REASONING'), h('span', { class: 'tok' }, 'live')),
        h('div', { class: 'reason__body' }, ''),
      );
      stream.appendChild(reasonBox);
      const txt = h('div', {});
      stream.appendChild(txt);
      try {
        await chat({
          messages: [{ role: 'user', content: `Write a 220-word analysis of "${t.title}" (${[t.year, t.genre, t.country].filter(Boolean).join(', ')}). State the thesis, then give the structural argument. No plot summary.` }],
          config: { context: dossierContext(t, { rating }), maxTokens: 1200 },
          onReasoning: (chunk, all) => { reasonBox.querySelector('.reason__body').textContent = all; },
          onDelta: (chunk, all) => { txt.innerHTML = md(all); },
        });
        toast('Analysis drafted — review before saving');
        const save = h('button', { class: 'btn btn--primary btn--sm' }, 'Save as analysis');
        save.addEventListener('click', async () => {
          await saveTitle({ ...t, story_analysis: txt.innerText }, t.id);
          toast('Analysis saved');
          rerender();
        });
        btnRow.prepend(save);
      } catch (err) {
        toast(err.message, 'err');
        reasonBox.remove();
      } finally {
        busy = false;
        btnRow.querySelectorAll('button').forEach((b) => { b.disabled = false; });
        aiBtn.disabled = false;
      }
    });
    btnRow.appendChild(aiBtn);
    btnRow.appendChild(h('button', {
      class: 'btn btn--ghost btn--sm',
      onClick: () => { active = 'notes'; paintTabs(); paint(); },
    }, 'Open notes'));
    btnRow.appendChild(h('button', {
      class: 'btn btn--ghost btn--sm',
      onClick: () => { active = 'machine'; paintTabs(); paint(); },
    }, 'Interrogate the machine'));

    return h('div', { class: 'col', style: { gap: '16px' } },
      h('div', { class: 'panel' },
        h('div', { class: 'panel__head' }, h('h2', {}, 'Story analysis'), h('div', { class: 'panel__tools' }, btnRow)),
        h('div', { class: 'panel__body' }, out, stream),
      ),
      h('div', { class: 'panel' },
        h('div', { class: 'panel__head' }, h('h2', {}, 'Prompt rack for this title')),
        h('div', { class: 'panel__body' }, h('div', { class: 'pillrow' },
          AI_PRESETS.map((p) => h('button', {
            class: 'chip',
            onClick: () => {
              active = 'machine';
              paintTabs();
              paint();
              setTimeout(() => {
                const box = document.querySelector('#machineInput');
                if (box) { box.value = p.build(t); box.focus(); }
              }, 60);
            },
          }, p.label))),
        ),
      ),
    );
  }

  /* ---------- notes ---------- */
  function notesPanel() {
    const ta = h('textarea', { class: 'textarea', rows: '16', style: { minHeight: '320px' }, placeholder: 'Timestamps, arguments, the scene you keep returning to…' }, t.notes || '');
    const status = h('span', { class: 'interactive-note' }, 'not saved');
    let timer;
    ta.addEventListener('input', () => {
      status.textContent = 'dirty…';
      clearTimeout(timer);
      timer = setTimeout(async () => {
        status.textContent = 'saving…';
        try {
          await saveTitle({ ...t, notes: ta.value }, t.id);
          t.notes = ta.value;
          status.textContent = `saved ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
        } catch (err) { status.textContent = 'save failed'; toast(err.message, 'err'); }
      }, 900);
    });

    const preview = h('div', { class: 'prose' });
    preview.innerHTML = md(t.notes || '*nothing written yet*');

    return h('div', { class: 'split2' },
      h('div', { class: 'panel' },
        h('div', { class: 'panel__head' }, h('h2', {}, 'Notes'), h('div', { class: 'panel__tools' }, status,
          h('button', { class: 'btn btn--ghost btn--sm', onClick: () => { preview.innerHTML = md(ta.value); } }, 'Preview'))),
        h('div', { class: 'panel__body' }, ta),
      ),
      h('div', { class: 'panel' },
        h('div', { class: 'panel__head' }, h('h2', {}, 'Rendered')),
        h('div', { class: 'panel__body' },
          h('div', { class: 'prose', html: md(t.notes || '') }),
          h('div', { class: 'hairline', style: { margin: '14px 0' } }),
          h('div', { class: 'mono dim', style: { fontSize: '10px' } }, `${(t.notes || '').length} characters · ${(t.notes || '').split(/\s+/).filter(Boolean).length} words`),
        ),
      ),
    );
  }

  /* ---------- criteria ---------- */
  function scorePanel() {
    return h('div', { class: 'split2' },
      h('div', { class: 'panel' },
        h('div', { class: 'panel__head' }, h('h2', {}, 'Break the verdict down')),
        h('div', { class: 'panel__body' }, ratingPanel(t)),
      ),
      h('div', { class: 'panel' },
        h('div', { class: 'panel__head' }, h('h2', {}, 'Dial')),
        h('div', { class: 'panel__body' },
          h('div', { style: { display: 'grid', placeItems: 'center', padding: '12px' } },
            h('div', { style: { fontFamily: 'var(--font-display)', fontSize: '86px', fontWeight: '900', lineHeight: '.8' } }, fmtDec(t.rating, 1)),
            h('div', { class: 'mono dim', style: { marginTop: '8px', letterSpacing: '.2em' } }, 'MY SCORE'),
          ),
          h('div', { class: 'hairline', style: { margin: '16px 0' } }),
          h('div', { class: 'form' },
            field('Quick adjust', (() => {
              const r = h('input', {
                class: 'range', type: 'range', min: '0', max: '10', step: '0.1', value: String(t.rating || 0),
                onInput: (e) => { quickRate(t.id, Number(e.target.value)).catch(() => {}); },
              });
              return r;
            })()),
          ),
          h('div', { class: 'mono dim', style: { fontSize: '10px', marginTop: '10px' } },
            `Favourites mean nothing here. A 10 that you never rewatch is a lie.`),
        ),
      ),
    );
  }

  /* ---------- quotes ---------- */
  function quotesPanel() {
    const list = h('div', { class: 'col' });
    if (!quotes.length) list.appendChild(h('div', { class: 'muted' }, 'No lines captured.'));
    quotes.forEach((q) => {
      list.appendChild(h('div', { class: 'panel' },
        h('div', { class: 'panel__body' },
          h('blockquote', { style: { fontFamily: 'var(--font-display)', fontSize: '22px', lineHeight: '1.15', textTransform: 'uppercase', borderLeft: '3px solid var(--accent)', paddingLeft: '12px' } }, `“${q.text}”`),
          h('div', { class: 'row', style: { marginTop: '10px' } },
            h('span', { class: 'mono dim' }, [q.speaker, q.at_minute ? `${q.at_minute}m` : ''].filter(Boolean).join(' · ') || 'unknown speaker'),
            h('span', { class: 'push' }),
            h('button', {
              class: 'iconbtn', title: 'Favourite',
              onClick: async () => {
                await updateRow('quotes', q.id, { favorite: !q.favorite });
                q.favorite = !q.favorite;
                paint();
              },
            }, q.favorite ? '★' : '☆'),
            h('button', { class: 'iconbtn', title: 'Copy', onClick: () => copyText(`"${q.text}" — ${t.title}`) }, '⧉'),
            h('button', {
              class: 'iconbtn', title: 'Delete',
              onClick: async () => { await removeRow('quotes', q.id); paint(); },
            }, '✕'),
          ),
        ),
      ));
    });

    const text = h('input', { class: 'input', placeholder: 'The line itself' });
    const who = h('input', { class: 'input', placeholder: 'Speaker' });
    const at = h('input', { class: 'input', type: 'number', placeholder: 'minute', min: '0' });
    return h('div', { class: 'col', style: { gap: '16px' } },
      h('div', { class: 'panel' },
        h('div', { class: 'panel__head' }, h('h2', {}, 'Capture a line')),
        h('div', { class: 'panel__body' },
          h('div', { class: 'form__grid' }, field('Quote', text), field('Speaker', who), field('At minute', at)),
          h('button', {
            class: 'btn btn--primary btn--sm', style: { marginTop: '10px' },
            onClick: async () => {
              if (!text.value.trim()) { toast('Nothing to save', 'warn'); return; }
              await addRow('quotes', { title_id: t.id, text: text.value.trim(), speaker: who.value.trim(), at_minute: Number(at.value) || null, favorite: false });
              toast('Line captured');
              paint();
            },
          }, 'Save line'),
        ),
      ),
      h('div', { class: 'panel' }, h('div', { class: 'panel__head' }, h('h2', {}, `${quotes.length} lines`)),
        h('div', { class: 'panel__body' }, list)),
    );
  }

  /* ---------- sessions ---------- */
  function sessionsPanel() {
    const total = sessions.reduce((a, s) => a + (Number(s.minutes) || 0), 0);
    const mood = h('select', { class: 'select' }, h('option', { value: '' }, 'mood'), MOODS.map((m) => h('option', { value: m }, m)));
    const device = h('select', { class: 'select' }, h('option', { value: '' }, 'device'), DEVICES.map((d) => h('option', { value: d }, d)));
    const mins = h('input', { class: 'input', type: 'number', min: '0', placeholder: 'minutes' });
    const season = h('input', { class: 'input', type: 'number', min: '0', placeholder: 'season' });
    const ep = h('input', { class: 'input', type: 'number', min: '0', placeholder: 'episode' });
    const note = h('input', { class: 'input', placeholder: 'note (optional)' });

    return h('div', { class: 'col', style: { gap: '16px' } },
      h('div', { class: 'statgrid' },
        h('div', { class: 'stat' }, h('div', { class: 'stat__label' }, 'Sessions'), h('div', { class: 'stat__value' }, String(sessions.length))),
        h('div', { class: 'stat' }, h('div', { class: 'stat__label' }, 'Minutes'), h('div', { class: 'stat__value' }, fmtNumLocal(total))),
        h('div', { class: 'stat' }, h('div', { class: 'stat__label' }, 'Hours'), h('div', { class: 'stat__value' }, fmtDec(total / 60, 1))),
        h('div', { class: 'stat stat--accent' }, h('div', { class: 'stat__label' }, 'Last'), h('div', { class: 'stat__value', style: { fontSize: '20px' } }, sessions[0] ? fmtRel(sessions[0].watched_at) : '—')),
      ),
      h('div', { class: 'panel' },
        h('div', { class: 'panel__head' }, h('h2', {}, 'Log a session')),
        h('div', { class: 'panel__body' },
          h('div', { class: 'form__grid' }, field('Minutes', mins), field('Season', season), field('Episode', ep), field('Mood', mood), field('Device', device)),
          h('div', { style: { marginTop: '10px' } }, field('Note', note)),
          h('button', {
            class: 'btn btn--primary btn--sm', style: { marginTop: '10px' },
            onClick: async () => {
              await addRow('sessions', {
                title_id: t.id, minutes: Number(mins.value) || 0, season: Number(season.value) || null,
                episode: Number(ep.value) || null, mood: mood.value || '', device: device.value || '',
                note: note.value || '', watched_at: new Date().toISOString(),
              });
              logActivity('session', 'title', t.id, t.title);
              toast('Session logged');
              paint();
            },
          }, 'Log it'),
        ),
      ),
      h('div', { class: 'panel' },
        h('div', { class: 'panel__head' }, h('h2', {}, 'History')),
        h('div', { class: 'panel__body panel__body--flush' },
          sessions.length ? h('table', { class: 'table table--tight' },
            h('thead', {}, h('tr', {}, h('th', {}, 'When'), h('th', {}, 'S / E'), h('th', {}, 'Minutes'), h('th', {}, 'Mood'), h('th', {}, 'Device'), h('th', {}, 'Note'), h('th', {}, ''))),
            h('tbody', {}, sessions.map((s) => h('tr', {},
              h('td', { class: 'mono dim' }, fmtDate(s.watched_at)),
              h('td', { class: 'mono' }, `${s.season ?? '—'} / ${s.episode ?? '—'}`),
              h('td', { class: 'table__num' }, String(s.minutes || 0)),
              h('td', { class: 'mono' }, s.mood || '—'),
              h('td', { class: 'mono' }, s.device || '—'),
              h('td', {}, s.note || ''),
              h('td', {}, h('button', { class: 'iconbtn', onClick: async () => { await removeRow('sessions', s.id); paint(); } }, '✕')),
            ))),
          ) : h('div', { class: 'panel__body muted' }, 'No sessions logged.'),
        ),
      ),
    );
  }

  /* ---------- credits ---------- */
  function creditsPanel() {
    const people = rows('people');
    const sel = h('select', { class: 'select' },
      h('option', { value: '' }, '— pick a person —'),
      people.map((p) => h('option', { value: p.id }, `${p.name} (${p.role || 'person'})`)),
    );
    const roleSel = h('select', { class: 'select' }, ['director', 'writer', 'actor', 'cinematographer', 'composer', 'editor', 'producer'].map((r) => h('option', { value: r }, r)));
    const newName = h('input', { class: 'input', placeholder: 'or add a new person' });
    const newRole = h('select', { class: 'select' }, ['director', 'writer', 'actor', 'composer', 'cinematographer'].map((r) => h('option', { value: r }, r)));

    const list = h('div', { class: 'col' });
    if (!credits.length) list.appendChild(h('div', { class: 'muted' }, 'No credits filed.'));
    credits.forEach((c) => {
      const p = people.find((x) => x.id === c.person_id);
      list.appendChild(h('div', { class: 'row', style: { borderBottom: '1px solid var(--line)', padding: '8px 0' } },
        h('div', { class: 'avatar' }, initials(p?.name || '?')),
        h('div', {}, h('div', { style: { textTransform: 'uppercase', letterSpacing: '.04em' } }, p?.name || 'unknown'),
          h('div', { class: 'mono dim', style: { fontSize: '9.5px' } }, c.role)),
        h('span', { class: 'push' }),
        h('button', { class: 'iconbtn', onClick: async () => { await removeRow('credits', c.id); paint(); } }, '✕'),
      ));
    });

    return h('div', { class: 'col', style: { gap: '16px' } },
      h('div', { class: 'panel' },
        h('div', { class: 'panel__head' }, h('h2', {}, 'Attach a credit')),
        h('div', { class: 'panel__body' },
          h('div', { class: 'form__grid' }, field('Existing person', sel), field('Role', roleSel)),
          h('button', {
            class: 'btn btn--sm', style: { marginTop: '10px' },
            onClick: async () => {
              if (!sel.value) { toast('Pick a person', 'warn'); return; }
              await addRow('credits', { title_id: t.id, person_id: sel.value, role: roleSel.value });
              toast('Credit attached');
              paint();
            },
          }, 'Attach'),
          h('div', { class: 'hairline', style: { margin: '14px 0' } }),
          h('div', { class: 'form__grid' }, field('New person', newName), field('As', newRole)),
          h('button', {
            class: 'btn btn--ghost btn--sm', style: { marginTop: '10px' },
            onClick: async () => {
              if (!newName.value.trim()) { toast('Name required', 'warn'); return; }
              const person = await addRow('people', { name: newName.value.trim(), role: newRole.value, following: false });
              await addRow('credits', { title_id: t.id, person_id: person.id, role: newRole.value });
              toast('Person added and credited');
              paint();
            },
          }, 'Add person + credit'),
        ),
      ),
      h('div', { class: 'panel' }, h('div', { class: 'panel__head' }, h('h2', {}, 'Credited')), h('div', { class: 'panel__body' }, list)),
    );
  }

  /* ---------- related ---------- */
  function relatedPanel() {
    const similar = similarTitles(t, 8);
    return h('div', { class: 'col', style: { gap: '16px' } },
      h('div', { class: 'panel' },
        h('div', { class: 'panel__head' }, h('h2', {}, 'Neighbours on this shelf'), h('div', { class: 'panel__tools' }, h('span', { class: 'mono dim' }, 'scored by shared genre, country, tags'))),
        h('div', { class: 'panel__body' }, similar.length ? posterStrip(similar, { max: 8 }) : h('div', { class: 'muted' }, 'Not enough titles to compare yet.')),
      ),
      h('div', { class: 'panel' },
        h('div', { class: 'panel__head' }, h('h2', {}, 'Explicit relationships')),
        h('div', { class: 'panel__body' },
          h('div', { class: 'muted', style: { marginBottom: '10px' } }, 'Sequels, remakes, spiritual twins. Stored in cinema_relationships.'),
          h('div', { class: 'col' },
            rows('relationships').filter((r) => r.title_id === t.id || r.related_title_id === t.id).map((r) => {
              const other = titleById(r.title_id === t.id ? r.related_title_id : r.title_id);
              return h('div', { class: 'row', style: { borderBottom: '1px solid var(--line)', padding: '6px 0' } },
                h('span', { class: 'chip chip--static' }, r.kind),
                h('button', { class: 'chip', onClick: () => navigate(`#/title/${other?.id}`) }, other?.title || 'missing'),
                h('span', { class: 'push' }),
                h('button', { class: 'iconbtn', onClick: async () => { await removeRow('relationships', r.id); paint(); } }, '✕'),
              );
            }),
          ),
          (() => {
            const sel = h('select', { class: 'select' }, h('option', { value: '' }, '— other title —'),
              rows('titles').filter((x) => x.id !== t.id).map((x) => h('option', { value: x.id }, x.title)));
            const kind = h('select', { class: 'select' }, ['sequel', 'prequel', 'remake', 'same-universe', 'spiritual-twin', 'parody'].map((k) => h('option', { value: k }, k)));
            return h('div', { class: 'row', style: { marginTop: '12px', gap: '6px' } },
              kind, sel,
              h('button', {
                class: 'btn btn--sm',
                onClick: async () => {
                  if (!sel.value) { toast('Pick a title', 'warn'); return; }
                  await addRow('relationships', { title_id: t.id, related_title_id: sel.value, kind: kind.value, weight: 1 });
                  toast('Relationship stored');
                  paint();
                },
              }, 'Link'),
            );
          })(),
        ),
      ),
      h('div', { class: 'panel' },
        h('div', { class: 'panel__head' }, h('h2', {}, 'Affinity breakdown')),
        h('div', { class: 'panel__body' },
          h('div', { class: 'meter meter--tall' }, h('i', { style: { width: `${clamp(affinity(t) / 2, 0, 1) * 100}%` } })),
          h('div', { class: 'mono dim', style: { marginTop: '8px', fontSize: '10px' } },
            `Affinity ${fmtDec(affinity(t), 2)} — how strongly this title matches the rest of what you love. Above 0.60 is a pattern; below 0.20 is an outlier worth keeping.`),
        ),
      ),
    );
  }

  /* ---------- machine ---------- */
  function machinePanel() {
    const log = h('div', { class: 'studio__log', style: { maxHeight: '52vh', border: '1px solid var(--line)' } });
    const input = h('textarea', { id: 'machineInput', placeholder: `Ask about ${t.title}…`, rows: '2' });
    const send = h('button', { class: 'btn btn--primary btn--sm' }, 'Send');
    const cfg = resolveAiConfig();
    const keyChip = h('span', { class: 'ribbon' }, cfg.apiKey ? `KEY ${maskKey(cfg.apiKey).slice(0, 10)}…` : cfg.keyless ? 'LOCAL RUNTIME' : 'NO KEY');
    const reasonOn = h('input', { type: 'checkbox', checked: !!state.ai.reasoning });
    const history = [];

    if (!cfg.apiKey && !cfg.keyless) {
      log.appendChild(h('div', { class: 'keywarn' },
        h('b', {}, 'No key.'),
        h('span', {}, 'The machine needs a browser-side key. Open Settings › AI Studio and paste one. It stays in this browser.'),
      ));
    }

    function addMsg(role, text) {
      const bodyEl = h('div', { class: 'msg__body', html: role === 'assistant' ? md(text) : null }, role === 'user' ? text : null);
      const msg = h('div', { class: `msg ${role === 'user' ? 'msg--user' : ''}` },
        h('div', { class: 'msg__who' }, role === 'user' ? 'OPERATOR' : `MACHINE · ${cfg.model || 'unset'}`),
        bodyEl,
      );
      log.appendChild(msg);
      log.scrollTop = log.scrollHeight;
      return { msg, bodyEl };
    }

    async function run(prompt) {
      const text = String(prompt || input.value || '').trim();
      if (!text) return;
      input.value = '';
      addMsg('user', text);
      history.push({ role: 'user', content: text });
      const { msg, bodyEl } = addMsg('assistant', '');
      const reason = h('div', { class: 'reason is-closed' },
        h('div', { class: 'reason__head' }, h('span', {}, 'REASONING'), h('span', { class: 'tok' }, '0 chars')),
        h('div', { class: 'reason__body' }, ''),
      );
      msg.insertBefore(reason, bodyEl);
      const dots = h('div', { class: 'think-dots' }, h('i'), h('i'), h('i'));
      bodyEl.appendChild(dots);
      const start = performance.now();
      try {
        const res = await chat({
          messages: history.slice(-10),
          config: { context: dossierContext(t, { rating }), reasoning: reasonOn.checked },
          onReasoning: (chunk, all) => {
            reason.querySelector('.reason__body').textContent = all;
            reason.querySelector('.tok').textContent = `${all.length} chars`;
            if (reason.classList.contains('is-closed') && all.length > 80) reason.classList.remove('is-closed');
          },
          onDelta: (chunk, all) => {
            dots.remove();
            bodyEl.innerHTML = md(all);
            log.scrollTop = log.scrollHeight;
          },
        });
        history.push({ role: 'assistant', content: res.text });
        const meta = h('div', { class: 'msg__foot' },
          h('span', {}, `${res.usage.total_tokens || estimateTokens(res.text)} tok`),
          h('span', {}, `${Math.round(performance.now() - start)}ms`),
          h('button', { class: 'chip', onClick: () => copyText(res.text) }, 'copy'),
          h('button', {
            class: 'chip',
            onClick: async () => {
              await saveTitle({ ...t, story_analysis: res.text }, t.id);
              toast('Saved as analysis');
            },
          }, 'save as analysis'),
        );
        msg.appendChild(meta);
      } catch (err) {
        dots.remove();
        bodyEl.innerHTML = `<span class="blood">${err.message}</span>${err.hint ? `<br><span class="dim mono">${err.hint}</span>` : ''}`;
      }
    }

    send.addEventListener('click', () => run());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); }
    });

    return h('div', { class: 'panel' },
      h('div', { class: 'panel__head' }, h('h2', {}, 'Machine'), h('div', { class: 'panel__tools' }, keyChip,
        h('label', { class: 'switch' }, reasonOn, h('span', { class: 'switch__track' }), h('span', { class: 'switch__label' }, 'reasoning')))),
      h('div', { class: 'panel__body panel__body--flush' },
        log,
        h('div', { class: 'composer' },
          h('div', { class: 'composer__box' }, input),
          h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } },
            AI_PRESETS.map((p) => h('button', {
              class: 'chip',
              onClick: () => { input.value = p.build(t); input.focus(); },
            }, p.label)),
            h('span', { class: 'push' }),
            send,
          ),
        ),
      ),
    );
  }

  /* ---------- share / export ---------- */
  function shareSheet(title) {
    const markdown = [
      `# ${title.title}`,
      title.original_title ? `*${title.original_title}*` : '',
      '',
      `**Verdict:** ${title.category} · **Score:** ${title.rating ?? '—'}/10`,
      `**Format:** ${title.type}${title.year ? ` · ${title.year}` : ''}${title.genre ? ` · ${title.genre}` : ''}`,
      title.country ? `**Country:** ${title.country}` : '',
      title.watched_date ? `**Watched:** ${title.watched_date}` : '',
      '',
      title.summary || '',
      '',
      title.story_analysis ? `## Analysis\n\n${title.story_analysis}` : '',
      title.notes ? `## Notes\n\n${title.notes}` : '',
      quotes.length ? `## Lines\n\n${quotes.map((q) => `> ${q.text}`).join('\n>\n')}` : '',
      '',
      `---\n*Exported from FULL METAL CINEMA*`,
    ].filter(Boolean).join('\n');

    const json = JSON.stringify({ title, rating, quotes, sessions, credits }, null, 2);
    const body = h('div', { class: 'col' },
      h('div', { class: 'form__note' }, 'A dossier card as Markdown, or the raw rows as JSON.'),
      h('div', { class: 'form__row' },
        h('button', { class: 'btn btn--primary btn--sm', onClick: () => download(`${title.title.replace(/[^\w]+/g, '-')}.md`, markdown, 'text/markdown') }, 'Download Markdown'),
        h('button', { class: 'btn btn--sm', onClick: () => download(`${title.title.replace(/[^\w]+/g, '-')}.json`, json) }, 'Download JSON'),
        h('button', { class: 'btn btn--ghost btn--sm', onClick: () => copyText(markdown) }, 'Copy Markdown'),
        h('button', { class: 'btn btn--ghost btn--sm', onClick: () => copyText(json) }, 'Copy JSON'),
      ),
      h('pre', { class: 'codeblock' }, markdown.slice(0, 2600)),
    );
    openModal({ title: 'Export dossier', body, wide: true });
  }

  paintTabs();
  paint();
  layout.appendChild(h('div', { class: 'panel' }, tabHost, h('div', { class: 'panel__body' }, body)));
  root.appendChild(layout);

  function rerender() {
    root.replaceChildren();
    root.scrollTop = 0;
    renderDossier(root, { id });
  }
}

function fmtNumLocal(n) {
  return new Intl.NumberFormat('en-US').format(Math.round(n || 0));
}
