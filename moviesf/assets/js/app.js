/* ============================================================================
   FULL METAL CINEMA — application shell
   boot · auth gate · router · rail · ticker · search · command deck · keys
   ========================================================================== */

import {
  h, $, $$, clear, toast, debounce, fmtNum, fmtDec, slug, initials, posterEl,
} from './lib/dom.js';
import {
  state, bootClient, loadAll, applyTheme, savePrefs, on, computeStats, rows,
  titleById, cachedTitles, logActivity,
} from './lib/store.js';
import { APP, NAV, THEMES, SUPABASE } from './config.js';
import { vaultIsLocked, resolveAiConfig } from './lib/ai.js';
import { navigate, openQuickLog, openEditor } from './views/shared.js';
import { renderLibrary, renderWatchlist } from './views/library.js';
import { renderDossier } from './views/dossier.js';
import { renderStats } from './views/stats.js';
import { renderStudio } from './views/studio.js';
import { renderArena, renderPrompts } from './views/arena.js';
import { renderCollections } from './views/collections.js';
import { renderTimeline, renderActivity, renderPeople, renderAwards, renderAbout } from './views/ledger.js';
import { renderSettings } from './views/settings.js';

/* ---------- routes ------------------------------------------------------ */
const ROUTES = [
  { pattern: /^\/?$/, run: () => navigate('#/library') },
  { pattern: /^\/library$/, run: (root, p) => renderLibrary(root, p) },
  { pattern: /^\/title\/(.+)$/, run: (root, p, m) => renderDossier(root, { id: m[1] }) },
  { pattern: /^\/watchlist$/, run: (root) => renderWatchlist(root) },
  { pattern: /^\/collections$/, run: (root, p) => renderCollections(root, p) },
  { pattern: /^\/collections\/(.+)$/, run: (root, p, m) => renderCollections(root, { id: m[1] }) },
  { pattern: /^\/timeline$/, run: (root) => renderTimeline(root) },
  { pattern: /^\/stats$/, run: (root) => renderStats(root) },
  { pattern: /^\/people$/, run: (root) => renderPeople(root) },
  { pattern: /^\/activity$/, run: (root) => renderActivity(root) },
  { pattern: /^\/awards$/, run: (root) => renderAwards(root) },
  { pattern: /^\/studio$/, run: (root) => renderStudio(root) },
  { pattern: /^\/arena$/, run: (root) => renderArena(root) },
  { pattern: /^\/prompts$/, run: (root) => renderPrompts(root) },
  { pattern: /^\/settings$/, run: (root, p) => renderSettings(root, p) },
  { pattern: /^\/about$/, run: (root) => renderAbout(root) },
];

const bootLog = (msg) => {
  const el = $('#bootLog');
  if (el) el.textContent = msg;
};

/* ========================================================================== */
/*  BOOT                                                                      */
/* ========================================================================== */
async function main() {
  applyTheme();
  bootLog('reading configuration…');

  const client = bootClient();
  state.session = client.session;
  state.user = client.user;

  wireAuthGate(client);
  paintConnectionNotice(client);

  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const wantsDemo = params.get('demo') === '1';

  if (client.isDemo && !client.session) {
    bootLog('no project configured — entering local demo…');
    client.localSignIn('demo@local');
    state.session = client.session;
    state.user = client.user;
  }

  if (client.session) {
    await enterApp(client);
  } else {
    showGate(client);
  }

  client.onAuth(async (evt) => {
    if (evt === 'SIGNED_OUT') showGate(client);
  });

  window.addEventListener('hashchange', renderRoute);
  document.addEventListener('fmc:data', () => renderRoute(true));
  window.addEventListener('online', () => toast('Back online'));
  window.addEventListener('offline', () => toast('Offline — reads come from cache', 'warn'));

  setTimeout(() => $('#boot')?.classList.add('is-gone'), 220);
}

async function enterApp(client) {
  showShell();
  bootLog('authenticating…');
  try {
    await client.loadUser();
    state.user = client.user;
  } catch (err) {
    console.warn('[auth]', err.message);
  }

  if (vaultIsLocked()) {
    toast('Your key vault is sealed — open Settings › AI Studio to unlock', 'warn', 6000);
  }

  bootLog('loading tables…');
  try {
    await loadAll();
  } catch (err) {
    toast(`Some tables did not load: ${err.message}`, 'warn');
    state.tables.titles = cachedTitles();
  }

  paintRail();
  paintUser();
  paintTicker();
  paintFooter();
  wireSearch();
  wirePalette();
  wireKeys();
  wireRail();

  renderRoute();
  on('titles', () => { paintRail(); paintTicker(); paintFooter(); });
  on('watchlist', () => paintRail());
  on('activity', () => paintTicker());
}

function showGate(client) {
  $('#gate')?.classList.add('is-gone');
  const gate = $('#authGate');
  const shell = $('#shell');
  if (gate) gate.hidden = false;
  if (shell) shell.hidden = true;
  applyTheme();
  const conn = $('#authConn');
  if (conn) {
    conn.textContent = client.configured
      ? `connected to ${new URL(client.url).host}`
      : 'no project configured — demo mode available';
    const dot = $('[data-conn-dot]');
    if (dot) dot.className = `dot ${client.configured ? 'is-ok' : 'is-warn'}`;
  }
  const form = $('#authForm');
  if (form && !form.dataset.wired) {
    form.dataset.wired = '1';
    wireAuthGate(client);
  }
  setTimeout(() => $('#boot')?.classList.add('is-gone'), 260);
}

function showShell() {
  const gate = $('#authGate');
  const shell = $('#shell');
  if (gate) gate.hidden = true;
  if (shell) shell.hidden = false;
}

function paintConnectionNotice(client) {
  if (client.configured) return;
  const host = $('#view');
  const bar = h('div', {
    class: 'ribbon', style: {
      margin: '12px var(--s6) 0', display: 'flex', gap: '10px', alignItems: 'center',
      borderLeft: '3px solid var(--hot)',
    },
  },
  h('b', { style: { color: 'var(--hot)' } }, 'DEMO MODE'),
  h('span', {}, 'No Supabase project configured. Everything you do is stored in this browser only.'),
  h('button', {
    class: 'chip', style: { marginLeft: 'auto' },
    onClick: () => navigate('#/settings'),
  }, 'Configure →'));
  document.querySelector('.stage')?.insertBefore(bar, host);
}

/* ========================================================================== */
/*  AUTH GATE                                                                */
/* ========================================================================== */
function wireAuthGate(client) {
  const form = $('#authForm');
  if (!form) return;
  let mode = 'signin';

  $$('[data-auth-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('[data-auth-tab]').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      mode = btn.dataset.authTab;
      $('[data-auth-callsign]').hidden = mode !== 'signup';
      $('[data-auth-password]').hidden = mode === 'magic';
      $('#authSubmit').querySelector('span').textContent =
        mode === 'signup' ? 'ENLIST' : mode === 'magic' ? 'SEND THE LINK' : 'ENTER THE ARCHIVE';
      const pwd = form.querySelector('[name=password]');
      if (pwd) pwd.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
      error('');
    });
  });

  const error = (msg) => {
    const el = $('#authError');
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#authSubmit');
    const email = form.querySelector('[name=email]').value.trim();
    const password = form.querySelector('[name=password]')?.value || '';
    if (!email) { error('An email is required.'); return; }
    btn.classList.add('is-busy');
    error('');
    try {
      if (mode === 'signup') {
        if (password.length < 6) throw new Error('Passphrase must be at least 6 characters.');
        const res = await client.signUp(email, password, {
          callsign: form.querySelector('[name=callsign]')?.value || '',
        });
        if (!client.session) {
          error('Account created. Check your inbox to confirm, then sign in.');
          btn.classList.remove('is-busy');
          return;
        }
      } else if (mode === 'magic') {
        await client.signInWithOtp(email);
        error('Link sent. Open it on this device.');
        btn.classList.remove('is-busy');
        return;
      } else {
        await client.signIn(email, password);
      }
      state.session = client.session;
      state.user = client.user;
      await enterApp(client);
      toast('Welcome back, operator');
    } catch (err) {
      error(err.message || 'Sign-in failed');
    } finally {
      btn.classList.remove('is-busy');
    }
  });

  $('[data-auth-demo]')?.addEventListener('click', async () => {
    client.localSignIn('demo@local');
    state.session = client.session;
    state.user = client.user;
    await enterApp(client);
    toast('Demo mode: rows live in this browser');
  });

  $('[data-auth-reset]')?.addEventListener('click', async () => {
    const email = form.querySelector('[name=email]').value.trim();
    if (!email) { error('Enter your email first, then press again.'); return; }
    try {
      await client.sendRecovery(email);
      error('Recovery email sent.');
    } catch (err) { error(err.message); }
  });

  $('[data-peek]')?.addEventListener('click', () => {
    const input = form.querySelector('[name=password]');
    if (input) input.type = input.type === 'password' ? 'text' : 'password';
  });
}

/* ========================================================================== */
/*  ROUTER                                                                    */
/* ========================================================================== */
async function renderRoute(force = false) {
  const view = $('#view');
  if (!view || $('#shell')?.hidden) return;
  view.classList.remove('view--flush');

  const hash = location.hash.replace(/^#/, '') || '/library';
  const [path, query] = hash.split('?');
  const params = Object.fromEntries(new URLSearchParams(query || ''));

  const route = ROUTES.find((r) => r.pattern.test(path));
  const match = path.match(/^\/title\/(.+)$/);

  clear(view);
  view.scrollTop = 0;
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });

  if (!route) {
    view.appendChild(h('div', { class: 'empty', style: { marginTop: '40px' } },
      h('div', { class: 'empty__glyph' }, '404'),
      h('h3', {}, 'No such sector'),
      h('p', {}, `"${path}" is not a route. The manual lists all of them.`),
      h('button', { class: 'btn btn--primary', onClick: () => navigate('#/library') }, 'Back to library'),
    ));
    return;
  }

  try {
    await route.run(view, params, match);
  } catch (err) {
    console.error(err);
    view.appendChild(h('div', { class: 'panel panel--danger', style: { marginTop: '20px' } },
      h('div', { class: 'panel__head' }, h('h2', {}, 'Render fault')),
      h('div', { class: 'panel__body' },
        h('div', { class: 'prose' }, err.message || 'Unknown error'),
        h('button', { class: 'btn btn--sm', style: { marginTop: '10px' }, onClick: () => renderRoute() }, 'Retry'),
      ),
    ));
  }

  markActiveNav(path);
  savePrefs({ lastRoute: `#${hash}` });
  const prefill = sessionStorage.getItem('fmc.prefill');
  if (prefill && path === '/studio') {
    sessionStorage.removeItem('fmc.prefill');
    setTimeout(() => {
      const box = document.querySelector('.studio .composer textarea');
      if (box) { box.value = prefill; box.focus(); box.dispatchEvent(new Event('input')); }
    }, 120);
  }
}

/* ========================================================================== */
/*  RAIL                                                                      */
/* ========================================================================== */
function paintRail() {
  const nav = $('#railNav');
  if (!nav) return;
  clear(nav);
  const counts = {
    library: rows('titles').length,
    watchlist: rows('watchlist').filter((w) => !w.done).length,
    collections: rows('collections').length,
    studio: rows('conversations').length,
    arena: rows('models').length,
    people: rows('people').length,
    activity: rows('activity').length,
    awards: rows('awards').length,
  };

  NAV.forEach((item) => {
    if (item.group) {
      nav.appendChild(h('div', { class: 'rail__group' }, item.group));
      return;
    }
    nav.appendChild(h('a', {
      href: item.route,
      class: 'rail__link',
      dataset: { nav: item.id },
    },
    h('span', { class: 'glyph' }, item.glyph),
    h('span', {}, item.label),
    counts[item.id] ? h('span', { class: 'count' }, String(counts[item.id])) : null,
    ));
  });

  paintMeter();
}

function paintMeter() {
  const target = state.prefs.tourTarget;
  const year = state.prefs.tourYear;
  const done = rows('titles').filter((t) => t.watched_date && new Date(t.watched_date).getFullYear() === year).length;
  const head = $('[data-tour-count]');
  if (head) head.textContent = `${done}/${target}`;
  const note = $('[data-tour-note]');
  if (note) note.textContent = done >= target ? 'campaign complete' : `${target - done} to go in ${year}`;
  const bar = $('#railMeter .meter i');
  if (bar) bar.style.width = `${Math.min(100, (done / Math.max(1, target)) * 100)}%`;
}

function paintUser() {
  const el = $('#railUser');
  const av = $('#topAvatar');
  const email = state.user?.email || 'operator';
  const name = state.user?.user_metadata?.callsign || email.split('@')[0];
  if (av) {
    clear(av);
    av.textContent = initials(name, 1);
  }
  if (el) {
    clear(el);
    el.appendChild(h('div', { class: 'avatar' }, initials(name, 2)));
    el.appendChild(h('div', { class: 'who' },
      h('b', {}, name),
      h('small', {}, state.client?.isDemo ? 'demo / localStorage' : email),
    ));
    el.addEventListener('click', () => navigate('#/settings?section=account'));
  }
}

function markActiveNav(path) {
  const map = {
    '/library': 'library', '/title': 'library', '/watchlist': 'watchlist',
    '/collections': 'collections', '/timeline': 'timeline', '/stats': 'stats',
    '/people': 'people', '/activity': 'activity', '/awards': 'awards',
    '/studio': 'studio', '/arena': 'models', '/prompts': 'prompts',
    '/settings': 'settings', '/about': 'about',
  };
  const key = map[path] || map[path.split('/').slice(0, 2).join('/')] || '';
  $$('.rail__link').forEach((a) => a.classList.toggle('is-active', a.dataset.nav === key));
  closeRail();
}

function wireRail() {
  $('#burger')?.addEventListener('click', () => {
    const rail = $('#rail');
    const scrim = $('#railScrim');
    rail?.classList.add('is-open');
    if (scrim) scrim.hidden = false;
  });
  $('#railScrim')?.addEventListener('click', closeRail);
}
function closeRail() {
  $('#rail')?.classList.remove('is-open');
  const scrim = $('#railScrim');
  if (scrim) scrim.hidden = true;
}

/* ========================================================================== */
/*  TICKER + FOOTER                                                          */
/* ========================================================================== */
function paintTicker() {
  const track = $('#tickerTrack');
  if (!track) return;
  const s = computeStats(rows('titles'));
  const bits = [
    `${fmtNum(s.total)} dossiers`,
    `${fmtNum(s.loved)} loved`,
    `${fmtNum(s.hated)} regretted`,
    `avg ${fmtDec(s.avgRating, 2)}`,
    `${fmtNum(s.hours)} hours on screen`,
    `${fmtNum(s.countries)} countries`,
    `${fmtNum(s.genres)} genres`,
    `${fmtNum(s.episodes)} episodes`,
    s.streak ? `${s.streak}-day streak` : 'no streak',
    `${fmtNum(rows('watchlist').filter((w) => !w.done).length)} queued`,
    `${fmtNum(rows('models').length)} models in the ledger`,
  ];
  const line = bits.map((b) => h('span', {}, b.toUpperCase()));
  clear(track);
  line.forEach((n) => track.appendChild(n));
  line.forEach((n) => track.appendChild(n.cloneNode(true)));
}

function paintFooter() {
  const el = $('#footStat');
  if (!el) return;
  const s = computeStats(rows('titles'));
  el.textContent = `${fmtNum(s.total)} TITLES · ${fmtNum(s.hours)}H · AVG ${fmtDec(s.avgRating, 1)}`;
}

/* ========================================================================== */
/*  SEARCH                                                                    */
/* ========================================================================== */
function wireSearch() {
  const input = $('#globalSearch');
  const drop = $('#searchDrop');
  if (!input || !drop) return;
  let cursor = -1;
  let results = [];

  const draw = () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { drop.hidden = true; return; }
    results = rows('titles').filter((t) => {
      const hay = [t.title, t.original_title, t.genre, t.country, t.tags, t.notes, t.summary].join(' ').toLowerCase();
      return q.split(/\s+/).every((w) => hay.includes(w));
    }).slice(0, 8);
    clear(drop);
    drop.hidden = false;
    drop.appendChild(h('div', { class: 'searchdrop__head' },
      h('span', {}, `${results.length} dossiers`),
      h('span', {}, 'enter to search the shelf')));
    if (!results.length) {
      drop.appendChild(h('div', { class: 'searchdrop__empty' }, 'Nothing matches. Try a genre, a tag, a country.'));
      return;
    }
    results.forEach((t, i) => {
      drop.appendChild(h('div', {
        class: `searchdrop__item ${i === cursor ? 'is-cursor' : ''}`,
        onClick: () => { input.value = ''; drop.hidden = true; navigate(`#/title/${t.id}`); },
      },
      h('div', { style: { width: '26px', flex: '0 0 auto' } }, posterEl(t, { small: true })),
      h('div', {},
        h('b', {}, t.title),
        h('small', { style: { display: 'block' } }, [t.year, t.type, t.genre].filter(Boolean).join(' · ')),
      ),
      h('span', { class: 'push mono dim', style: { fontSize: '10px' } }, fmtDec(t.rating, 1)),
      ));
    });
  };

  input.addEventListener('input', debounce(draw, 130));
  input.addEventListener('focus', draw);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { drop.hidden = true; input.blur(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      cursor = Math.max(0, Math.min(results.length - 1, cursor + (e.key === 'ArrowDown' ? 1 : -1)));
      draw();
    }
    if (e.key === 'Enter') {
      if (results[cursor]) { const t = results[cursor]; input.value = ''; drop.hidden = true; navigate(`#/title/${t.id}`); }
      else { const q = input.value.trim(); drop.hidden = true; navigate(`#/library?q=${encodeURIComponent(q)}`); }
    }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.topbar__search')) drop.hidden = true;
  });
}

/* ========================================================================== */
/*  COMMAND DECK                                                             */
/* ========================================================================== */
function wirePalette() {
  const box = $('#palette');
  const input = $('#paletteInput');
  const list = $('#paletteList');
  if (!box || !input || !list) return;
  let cursor = 0;
  let items = [];

  const commands = () => {
    const cmds = [
      { group: 'Go', label: 'Library', meta: 'G L', glyph: '▤', run: () => navigate('#/library') },
      { group: 'Go', label: 'Watchlist', meta: 'G W', glyph: '▢', run: () => navigate('#/watchlist') },
      { group: 'Go', label: 'Collections', meta: '', glyph: '❏', run: () => navigate('#/collections') },
      { group: 'Go', label: 'Statistics', meta: 'G S', glyph: '▥', run: () => navigate('#/stats') },
      { group: 'Go', label: 'Timeline', meta: '', glyph: '⌇', run: () => navigate('#/timeline') },
      { group: 'Go', label: 'People', meta: '', glyph: '☖', run: () => navigate('#/people') },
      { group: 'Go', label: 'Activity', meta: '', glyph: '≡', run: () => navigate('#/activity') },
      { group: 'Go', label: 'Awards', meta: '', glyph: '✪', run: () => navigate('#/awards') },
      { group: 'Go', label: 'AI Studio', meta: 'A', glyph: '✦', run: () => navigate('#/studio') },
      { group: 'Go', label: 'Model Arena', meta: '', glyph: '⚔', run: () => navigate('#/arena') },
      { group: 'Go', label: 'Prompt Rack', meta: '', glyph: '❝', run: () => navigate('#/prompts') },
      { group: 'Go', label: 'Settings', meta: '', glyph: '⚙', run: () => navigate('#/settings') },
      { group: 'Go', label: 'Field manual', meta: '?', glyph: '☰', run: () => navigate('#/about') },
      { group: 'Action', label: 'New dossier', meta: 'N', glyph: '＋', run: () => openEditor({}) },
      { group: 'Action', label: 'Quick log', meta: '', glyph: '⚡', run: () => openQuickLog() },
      { group: 'Action', label: 'Cycle theatre', meta: 'T', glyph: '◐', run: () => cycleTheme() },
      { group: 'Action', label: 'Export snapshot', meta: '', glyph: '⇣', run: () => navigate('#/settings?section=data') },
      { group: 'Action', label: 'AI settings', meta: '', glyph: '✦', run: () => navigate('#/settings?section=ai') },
      { group: 'Filter', label: 'Everything I loved', meta: '', glyph: '♥', run: () => navigate('#/library?cat=love&sort=score') },
      { group: 'Filter', label: 'Everything I hated', meta: '', glyph: '✖', run: () => navigate('#/library?cat=hate') },
      { group: 'Filter', label: 'Unscored titles', meta: '', glyph: '∅', run: () => navigate('#/library?sort=recent') },
      { group: 'Filter', label: 'Perfect 9.5 and up', meta: '', glyph: '★', run: () => navigate('#/library?min=9.5&sort=score') },
      { group: 'Filter', label: 'Series only', meta: '', glyph: '▣', run: () => navigate('#/library?type=series,mini,anime') },
    ];
    return cmds;
  };

  const draw = () => {
    const q = input.value.trim().toLowerCase();
    const cmds = commands().filter((c) => !q || c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q));
    const titles = q ? rows('titles').filter((t) => t.title.toLowerCase().includes(q)).slice(0, 6)
      .map((t) => ({ group: 'Dossier', label: t.title, meta: t.year ? String(t.year) : '', glyph: '▣', run: () => navigate(`#/title/${t.id}`) })) : [];
    items = [...cmds, ...titles];
    cursor = Math.min(cursor, Math.max(0, items.length - 1));
    clear(list);
    if (!items.length) {
      list.appendChild(h('div', { class: 'searchdrop__empty' }, 'No command matches'));
      return;
    }
    let lastGroup = '';
    items.forEach((it, i) => {
      if (it.group !== lastGroup) {
        list.appendChild(h('div', { class: 'palette__group' }, it.group));
        lastGroup = it.group;
      }
      list.appendChild(h('div', {
        class: `palette__row ${i === cursor ? 'is-cursor' : ''}`,
        dataset: { i: String(i) },
        onClick: () => { close(); it.run(); },
        onMouseenter: () => { cursor = i; },
      },
      h('span', { class: 'glyph' }, it.glyph),
      h('span', { class: 'label', html: highlight(it.label, input.value.trim()) }),
      h('span', { class: 'meta' }, it.meta || ''),
      ));
    });
    $('#paletteHint').textContent = `${items.length} results`;
  };

  const open = () => { box.hidden = false; input.value = ''; cursor = 0; draw(); setTimeout(() => input.focus(), 20); };
  const close = () => { box.hidden = true; input.value = ''; };
  let isOpen = false;

  input.addEventListener('input', () => { cursor = 0; draw(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); cursor = Math.min(items.length - 1, cursor + 1); draw(); scrollCursor(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); cursor = Math.max(0, cursor - 1); draw(); scrollCursor(); }
    if (e.key === 'Enter') { e.preventDefault(); const it = items[cursor]; if (it) { close(); it.run(); } }
    if (e.key === 'Escape') close();
  });
  box.addEventListener('click', (e) => { if (e.target === box) close(); });

  function scrollCursor() {
    const el = list.querySelector('.is-cursor');
    el?.scrollIntoView({ block: 'nearest' });
  }

  window.__palette = { open, close };
  $$('[data-cmd="palette"]').forEach((b) => b.addEventListener('click', open));
  $$('[data-palette-hint]').forEach((b) => b.addEventListener('click', open));
}

function highlight(label, q) {
  if (!q) return escapeHtml(label);
  const i = label.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return escapeHtml(label);
  return `${escapeHtml(label.slice(0, i))}<mark>${escapeHtml(label.slice(i, i + q.length))}</mark>${escapeHtml(label.slice(i + q.length))}`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ========================================================================== */
/*  KEYBOARD + TOOLBAR                                                        */
/* ========================================================================== */
function cycleTheme() {
  const order = THEMES.map((t) => t.id);
  const idx = order.indexOf(state.prefs.theme);
  const next = order[(idx + 1) % order.length];
  savePrefs({ theme: next });
  applyTheme();
  toast(`Theatre: ${next}`);
}

function wireKeys() {
  let gPending = false;
  let gTimer = null;

  $$('[data-cmd]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      if (cmd === 'quick-add') openEditor({});
      if (cmd === 'palette') window.__palette?.open();
      if (cmd === 'theme') cycleTheme();
      if (cmd === 'ai') navigate('#/studio');
      if (cmd === 'profile') navigate('#/settings?section=account');
    });
  });

  document.addEventListener('keydown', (e) => {
    const typing = /^(input|textarea|select)$/i.test(e.target.tagName) || e.target.isContentEditable;
    const meta = e.metaKey || e.ctrlKey;

    if (meta && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      window.__palette?.open();
      return;
    }
    if (typing) return;

    if (gPending) {
      clearTimeout(gTimer);
      gPending = false;
      const k = e.key.toLowerCase();
      if (k === 'l') { navigate('#/library'); e.preventDefault(); return; }
      if (k === 's') { navigate('#/stats'); e.preventDefault(); return; }
      if (k === 'a') { navigate('#/arena'); e.preventDefault(); return; }
      if (k === 'w') { navigate('#/watchlist'); e.preventDefault(); return; }
    }

    switch (e.key) {
      case 'g': gPending = true; gTimer = setTimeout(() => { gPending = false; }, 900); break;
      case 'n': e.preventDefault(); openEditor({}); break;
      case 'a': e.preventDefault(); navigate('#/studio'); break;
      case 't': e.preventDefault(); cycleTheme(); break;
      case '/': e.preventDefault(); $('#globalSearch')?.focus(); break;
      case '?': e.preventDefault(); navigate('#/about'); break;
      case 'Escape': closeRail(); break;
      default: break;
    }
  });
}

/* ---------- service worker --------------------------------------------- */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline shell is optional */ });
  });
}

main().catch((err) => {
  console.error(err);
  const el = $('#bootLog');
  if (el) {
    el.style.color = 'var(--blood)';
    el.textContent = `boot failed: ${err.message}`;
  }
});
