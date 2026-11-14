/* ============================================================================
   FULL METAL CINEMA — shared view parts
   title card / poster strip / dossier editor / quick log / score input
   ========================================================================== */

import {
  h, posterEl, openModal, toast, field, confirmAction, chips, fmtDec, initials,
  posterStyle, clamp, download, copyText, fmtDate,
} from '../lib/dom.js';
import {
  state, rows, saveTitle, deleteTitle, toggleFavorite, quickRate, toggleWatchlist,
  onWatchlist, logActivity, addRow, splitTags, affinity, normaliseTitle,
} from '../lib/store.js';
import { CATEGORIES, TYPES, STATUSES, GENRES, COUNTRIES } from '../config.js';
import { askOnce, extractJson, AI_PRESETS } from '../lib/ai.js';

export function navigate(hash) {
  if (location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  location.hash = hash;
}

/* ---------- title card -------------------------------------------------- */
export function titleCard(t, { dense = false, onOpen = null } = {}) {
  const card = h('article', {
    class: 'card card--title',
    dataset: { id: t.id },
    tabindex: '0',
    role: 'button',
    'aria-label': `${t.title} — dossier`,
    onClick: (e) => {
      if (e.target.closest('.card__act')) return;
      (onOpen || (() => navigate(`#/title/${t.id}`)))(t);
    },
    onKeydown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (onOpen || (() => navigate(`#/title/${t.id}`)))(t); }
    },
  });

  const acts = h('div', { class: 'card__acts' });
  acts.appendChild(h('button', {
    class: `card__act ${t.favorite ? 'is-on' : ''}`,
    title: 'Star this title',
    'aria-label': 'Star this title',
    onClick: async (e) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      try {
        const next = await toggleFavorite(t.id);
        btn.classList.toggle('is-on', next);
        toast(next ? 'Starred' : 'Unstarred');
      } catch (err) { toast(err.message, 'err'); }
    },
  }, '★'));
  acts.appendChild(h('button', {
    class: `card__act ${onWatchlist(t.id) ? 'is-on' : ''}`,
    title: 'Watchlist',
    'aria-label': 'Add to watchlist',
    onClick: async (e) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      try {
        const added = await toggleWatchlist(t.id);
        btn.classList.toggle('is-on', added);
        toast(added ? 'Added to watchlist' : 'Removed from watchlist');
      } catch (err) { toast(err.message, 'err'); }
    },
  }, '▢'));
  acts.appendChild(h('button', {
    class: 'card__act',
    title: 'Edit dossier',
    'aria-label': 'Edit dossier',
    onClick: (e) => { e.stopPropagation(); openEditor({ title: t }); },
  }, '✎'));
  card.appendChild(acts);
  card.appendChild(posterEl(t, { small: dense }));
  return card;
}

export function posterStrip(titles, { max = 8, empty = 'no titles' } = {}) {
  const strip = h('div', { class: 'shelf__rail' });
  const list = titles.slice(0, max);
  if (!list.length) {
    strip.appendChild(h('div', { class: 'muted mono', style: { padding: '12px' } }, empty));
    return strip;
  }
  list.forEach((t) => strip.appendChild(titleCard(t, { dense: true })));
  return strip;
}

/* ---------- score input ------------------------------------------------- */
export function scoreInput(value = 0, onChange = () => {}) {
  const out = h('b', { class: 'tabular', style: { fontFamily: 'var(--font-display)', fontSize: '22px', minWidth: '34px' } }, fmtDec(value, 1));
  const range = h('input', {
    class: 'range', type: 'range', min: '0', max: '10', step: '0.1', value: String(value || 0),
    onInput: (e) => {
      const v = Number(e.target.value);
      out.textContent = fmtDec(v, 1);
      out.style.color = v >= 8 ? 'var(--accent)' : v >= 5 ? 'var(--ink)' : v > 0 ? 'var(--hot)' : 'var(--ink-4)';
      onChange(v);
    },
  });
  return h('div', { class: 'row', style: { gap: '12px' } }, range, out);
}

/* ---------- dossier editor ---------------------------------------------- */
export function openEditor({ title = null, preset = {}, onSaved = null } = {}) {
  const isEdit = !!title;
  const t = { ...preset, ...(title || {}) };

  const f = {};
  const mk = (key, node) => { f[key] = node; return node; };

  const form = h('form', { class: 'form', id: 'dossierForm' });

  const titleInput = mk('title', h('input', { class: 'input', name: 'title', required: true, value: t.title || '', placeholder: 'e.g. Full Metal Jacket', autocomplete: 'off' }));
  const origInput = mk('original_title', h('input', { class: 'input', name: 'original_title', value: t.original_title || '', placeholder: 'original language title' }));

  form.appendChild(h('div', { class: 'form__grid' },
    field('Title *', titleInput),
    field('Original title', origInput),
  ));

  const catWrap = h('div', { class: 'pillrow' });
  let cat = t.category || 'good';
  CATEGORIES.forEach((c) => {
    const b = h('button', {
      type: 'button',
      class: `chip ${cat === c.id ? 'is-on' : ''}`,
      onClick: () => {
        cat = c.id;
        [...catWrap.children].forEach((x) => x.classList.remove('is-on'));
        b.classList.add('is-on');
      },
    }, `${c.glyph} ${c.label}`);
    catWrap.appendChild(b);
  });
  mk('category', { get value() { return cat; } });

  const typeSel = mk('type', h('select', { class: 'select', name: 'type' },
    TYPES.map((x) => h('option', { value: x.id, selected: (t.type || 'movie') === x.id }, x.label)),
  ));
  const statusSel = mk('status', h('select', { class: 'select', name: 'status' },
    STATUSES.map((x) => h('option', { value: x.id, selected: (t.status || 'watched') === x.id }, x.label)),
  ));

  form.appendChild(h('div', { class: 'form__grid' },
    field('Verdict', catWrap),
    field('Format', typeSel),
    field('Status', statusSel),
  ));

  const num = (v) => (v == null ? '' : String(v));
  const yearInput = mk('year', h('input', { class: 'input', type: 'number', min: '1888', max: '2100', value: num(t.year), placeholder: '1987' }));
  const genreInput = mk('genre', h('input', { class: 'input', value: t.genre || '', placeholder: 'war, drama', list: 'genreList' }));
  const countryInput = mk('country', h('input', { class: 'input', value: t.country || '', placeholder: 'USA', list: 'countryList' }));
  const langInput = mk('language', h('input', { class: 'input', value: t.language || '', placeholder: 'English' }));

  form.appendChild(h('div', { class: 'form__grid' },
    field('Year', yearInput),
    field('Genre', genreInput),
    field('Country', countryInput),
    field('Language', langInput),
  ));

  const seasonsInput = mk('seasons', h('input', { class: 'input', type: 'number', min: '0', value: num(t.seasons), placeholder: '0' }));
  const episodesInput = mk('episodes', h('input', { class: 'input', type: 'number', min: '0', value: num(t.episodes), placeholder: '0' }));
  const epsSeasonInput = mk('episodes_per_season', h('input', { class: 'input', type: 'number', min: '0', value: num(t.episodes_per_season), placeholder: '0' }));
  const runtimeInput = mk('runtime', h('input', { class: 'input', type: 'number', min: '0', value: num(t.runtime), placeholder: '116' }));

  form.appendChild(h('div', { class: 'form__grid' },
    field('Seasons', seasonsInput),
    field('Episodes', episodesInput),
    field('Eps / season', epsSeasonInput),
    field('Runtime (min)', runtimeInput),
  ));

  form.appendChild(h('div', { class: 'form__grid' },
    field('Watched on', mk('watched_date', h('input', { class: 'input', type: 'date', value: (t.watched_date || '').slice(0, 10) }))),
    field('Tags', mk('tags', h('input', { class: 'input', value: Array.isArray(t.tags) ? t.tags.join(', ') : (t.tags || ''), placeholder: 'kubrick, vietnam, boot camp' }))),
    field('Poster URL', mk('poster_url', h('input', { class: 'input', value: t.poster_url || '', placeholder: 'https://… (optional)' }))),
  ));

  /* score + favourite */
  let rating = Number(t.rating) || 0;
  const scoreOut = h('b', { style: { fontFamily: 'var(--font-display)', fontSize: '26px', minWidth: '46px', textAlign: 'center' } }, fmtDec(rating, 1));
  const scoreRange = h('input', {
    class: 'range', type: 'range', min: '0', max: '10', step: '0.1', value: String(rating),
    onInput: (e) => {
      rating = Number(e.target.value);
      scoreOut.textContent = fmtDec(rating, 1);
      scoreOut.style.color = rating >= 8 ? 'var(--accent)' : rating >= 5 ? 'var(--ink)' : 'var(--hot)';
    },
  });
  let favorite = !!t.favorite;
  const favBox = h('input', { type: 'checkbox', checked: favorite, onChange: (e) => { favorite = e.target.checked; } });
  mk('rating', { get value() { return rating; } });
  mk('favorite', { get value() { return favorite; } });

  form.appendChild(h('div', { class: 'row', style: { gap: '16px', flexWrap: 'wrap' } },
    h('div', { style: { flex: '1 1 260px' } },
      h('div', { class: 'field__label', style: { marginBottom: '6px' } }, 'My score'),
      h('div', { class: 'row', style: { gap: '10px' } }, scoreOut, scoreRange),
    ),
    h('label', { class: 'check' }, favBox, h('span', {}, 'Star / keep forever')),
  ));

  const summaryInput = mk('summary', h('textarea', { class: 'textarea', rows: '2', placeholder: 'One paragraph. What is it?' }, t.summary || ''));
  const analysisInput = mk('story_analysis', h('textarea', { class: 'textarea', rows: '3', placeholder: 'What is it actually about?', style: { minHeight: '88px' } }, t.story_analysis || ''));
  const notesInput = mk('notes', h('textarea', { class: 'textarea', rows: '3', placeholder: 'Private notes, timestamps, arguments.', style: { minHeight: '88px' } }, t.notes || ''));
  const reasonInput = mk('reason', h('textarea', { class: 'textarea', rows: '2', placeholder: 'Why this verdict?' }, t.reason || ''));

  form.appendChild(h('div', { class: 'tabs', style: { marginTop: '4px' } },
    h('div', { class: 'tab is-active' }, 'CONTENT'),
  ));
  form.appendChild(field('Summary', summaryInput));
  form.appendChild(field('Story analysis', analysisInput));
  form.appendChild(field('Notes', notesInput));
  form.appendChild(field('Verdict reason', reasonInput));

  /* datalists */
  const datalists = h('div', {},
    h('datalist', { id: 'genreList' }, GENRES.map((g) => h('option', { value: g }))),
    h('datalist', { id: 'countryList' }, COUNTRIES.map((c) => h('option', { value: c }))),
  );

  /* AI helpers */
  const aiBar = h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } },
    h('span', { class: 'field__label', style: { minWidth: '70px' } }, 'Machine'),
    ...AI_PRESETS.slice(0, 4).map((p) => h('button', {
      type: 'button', class: 'chip',
      onClick: async (e) => {
        const btn = e.currentTarget;
        if (!titleInput.value.trim()) { toast('Give it a title first', 'warn'); return; }
        btn.classList.add('is-on');
        const original = btn.textContent;
        btn.textContent = 'thinking…';
        try {
          const res = await askOnce(p.build({ title: titleInput.value, rating, category: cat }), {
            config: { maxTokens: 900, reasoning: false },
          });
          const json = extractJson(res.text);
          if (json) {
            if (json.genre) genreInput.value = json.genre;
            if (json.country) countryInput.value = json.country;
            if (json.language) langInput.value = json.language;
            if (json.year) yearInput.value = json.year;
            if (json.seasons) seasonsInput.value = json.seasons;
            if (json.episodes) episodesInput.value = json.episodes;
            if (json.status) statusSel.value = json.status;
            if (json.summary) summaryInput.value = json.summary;
            if (json.story_analysis) analysisInput.value = json.story_analysis;
            if (json.tags) f.tags.value = json.tags;
            toast('Fields standardised by the machine');
          } else if (p.id === 'review') {
            if (!notesInput.value.trim()) notesInput.value = res.text;
            else notesInput.value += `\n\n${res.text}`;
            toast('Review written into notes');
          } else {
            notesInput.value += `\n\n${res.text}`;
            toast('Output appended to notes');
          }
        } catch (err) {
          toast(err.message, 'err');
        } finally {
          btn.classList.remove('is-on');
          btn.textContent = original;
        }
      },
    }, p.label)),
  );
  form.appendChild(aiBar);
  form.appendChild(datalists);

  const footer = h('div', { class: 'modal__foot' },
    isEdit && h('button', {
      class: 'btn btn--danger btn--sm', type: 'button',
      onClick: async () => {
        const ok = await confirmAction({ title: 'Delete dossier', body: `"${t.title}" and its ratings, quotes and notes will be removed.`, ok: 'Delete' });
        if (!ok) return;
        try { await deleteTitle(t.id); toast('Dossier deleted'); modal.close(); onSaved && onSaved(null); }
        catch (err) { toast(err.message, 'err'); }
      },
    }, 'Delete'),
    h('div', { class: 'push' }),
    h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => modal.close() }, 'Cancel'),
    h('button', { class: 'btn btn--primary', type: 'submit', form: 'dossierForm' }, isEdit ? 'Save dossier' : 'Enlist title'),
  );

  const modal = openModal({
    title: isEdit ? 'Edit dossier' : 'New dossier',
    body: form, foot: footer, wide: true,
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = footer.querySelector('button[type=submit]');
    if (!titleInput.value.trim()) { toast('A title is required', 'warn'); titleInput.focus(); return; }
    btn.classList.add('is-busy');
    const payload = {
      title: titleInput.value,
      original_title: origInput.value,
      category: f.category.value,
      type: typeSel.value,
      status: statusSel.value,
      year: yearInput.value,
      genre: genreInput.value,
      country: countryInput.value,
      language: langInput.value,
      seasons: seasonsInput.value,
      episodes: episodesInput.value,
      episodes_per_season: epsSeasonInput.value,
      runtime: runtimeInput.value,
      watched_date: f.watched_date.value || null,
      tags: f.tags.value,
      poster_url: f.poster_url.value,
      rating: f.rating.value,
      favorite: f.favorite.value,
      summary: summaryInput.value,
      story_analysis: analysisInput.value,
      notes: notesInput.value,
      reason: reasonInput.value,
    };
    try {
      const saved = await saveTitle(payload, isEdit ? t.id : null);
      toast(isEdit ? 'Dossier updated' : 'Dossier enlisted');
      modal.close();
      if (onSaved) onSaved(saved);
      else document.dispatchEvent(new CustomEvent('fmc:data'));
    } catch (err) {
      toast(err.message || 'Could not save', 'err');
      btn.classList.remove('is-busy');
    }
  });

  return modal;
}

/* ---------- quick log --------------------------------------------------- */
export function openQuickLog() {
  const input = h('input', { class: 'input', placeholder: 'What did you just watch?', autocomplete: 'off' });
  const suggestions = h('div', { class: 'pillrow', style: { marginTop: '10px' } });
  ['movie', 'series', 'anime', 'documentary'].forEach((tp) => {
    suggestions.appendChild(h('button', {
      type: 'button', class: 'chip',
      onClick: () => { modal.close(); openEditor({ preset: { title: input.value.trim(), type: tp, status: 'watched', watched_date: new Date().toISOString().slice(0, 10) } }); },
    }, tp));
  });
  const modal = openModal({
    title: 'Quick log',
    body: h('div', { class: 'form' },
      field('Title', input),
      h('div', { class: 'form__note' }, 'Type a name and pick a format. The full dossier opens with today\'s date already set.'),
      suggestions,
    ),
    foot: h('div', { class: 'modal__foot' },
      h('div', { class: 'push' }),
      h('button', {
        class: 'btn btn--primary',
        onClick: () => {
          if (!input.value.trim()) { toast('A title helps', 'warn'); return; }
          modal.close();
          openEditor({ preset: { title: input.value.trim(), watched_date: new Date().toISOString().slice(0, 10) } });
        },
      }, 'Continue'),
    ),
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); modal.el.querySelector('.btn--primary').click(); }
  });
  return modal;
}

/* ---------- criteria rating panel (used in dossier) -------------------- */
export function ratingPanel(title) {
  const existing = rows('ratings').find((r) => r.title_id === title.id);
  const vals = {};
  const wrap = h('div', { class: 'col' });
  const dial = h('div', { class: 'dial' });
  const criteria = [
    ['story', 'Story'], ['acting', 'Acting'], ['direction', 'Direction'],
    ['visuals', 'Visuals'], ['sound', 'Sound'], ['rewatch', 'Rewatch'],
  ];
  criteria.forEach(([key, label]) => {
    vals[key] = Number(existing?.[key]) || 0;
    const valEl = h('b', {}, String(vals[key]));
    const bar = h('i', { style: { width: `${vals[key] * 10}%` } });
    const range = h('input', {
      class: 'range', type: 'range', min: '0', max: '10', step: '1', value: String(vals[key]),
      style: { height: '14px' },
      onInput: (e) => {
        vals[key] = Number(e.target.value);
        valEl.textContent = String(vals[key]);
        bar.style.width = `${vals[key] * 10}%`;
      },
    });
    dial.appendChild(h('div', { class: 'dial__cell' },
      h('div', { class: 'dial__head' }, h('span', {}, label), valEl),
      h('div', { class: 'dial__track' }, bar),
      range,
    ));
  });
  const review = h('textarea', { class: 'textarea', rows: '3', placeholder: 'Write the verdict…' }, existing?.review || '');
  const spoiler = h('input', { type: 'checkbox', checked: !!existing?.spoiler });
  wrap.appendChild(dial);
  wrap.appendChild(review);
  wrap.appendChild(h('label', { class: 'check' }, spoiler, h('span', {}, 'Contains spoilers')));
  wrap.appendChild(h('div', { class: 'row' },
    h('button', {
      class: 'btn btn--primary btn--sm',
      onClick: async () => {
        try {
          const payload = { title_id: title.id, ...vals, review: review.value, spoiler: spoiler.checked };
          if (existing) {
            await state.client.from('cinema_ratings').update(payload).eq('id', existing.id);
            Object.assign(existing, payload);
          } else {
            const created = await addRow('ratings', payload);
            state.tables.ratings.unshift(created);
          }
          const avgScore = criteria.reduce((a, [k]) => a + (Number(vals[k]) || 0), 0) / criteria.length;
          if (avgScore > 0) await quickRate(title.id, Math.round(avgScore * 10) / 10);
          toast('Criteria saved');
          document.dispatchEvent(new CustomEvent('fmc:data'));
        } catch (err) { toast(err.message, 'err'); }
      },
    }, existing ? 'Update criteria' : 'Save criteria'),
    h('span', { class: 'interactive-note' }, existing ? `last saved ${fmtDate(existing.created_at)}` : 'not scored yet'),
  ));
  return wrap;
}
