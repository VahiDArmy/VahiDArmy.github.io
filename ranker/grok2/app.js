const SUPABASE_URL = 'https://nvmevqkaovazhmoznusf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_AuneSCRLhrKKDeK8q7kJtw_Bg4VNHgE';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State
const state = {
  user: null,
  profile: null,
  people: [],
  traits: [],
  scores: [],
  viewMode: 'trait', // trait | ranker | scored
  stackIndex: 0,
  stacks: [], // current stacks data
  currentCards: [],
  openRouterKey: localStorage.getItem('or_key') || '',
  selectedModel: localStorage.getItem('or_model') || 'openrouter/free',
  soundsEnabled: localStorage.getItem('sounds') !== '0',
  vibeEnabled: localStorage.getItem('vibe') !== '0',
  aiHistory: [],
};

// Free models
const FREE_MODELS = [
  { id: 'openrouter/free', name: 'Free Router' },
  { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: 'Nemotron Ultra' },
  { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B' },
  { id: 'google/gemma-4-26b-a4b-it:free', name: 'Gemma 4 26B' },
  { id: 'nvidia/nemotron-3.5-lightning:free', name: 'Nemotron Lightning' },
  { id: 'baidu/ernie-5.5-flash-preview:free', name: 'ERNIE Flash' },
  { id: 'inclusionai/ling-3.2-flash:free', name: 'Ling Flash' },
  { id: 'recursive/flint-v1.0:free', name: 'Flint' },
];

// Audio
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, dur = 0.08, type = 'sine', gain = 0.08) {
  if (!state.soundsEnabled) return;
  try {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch (e) {}
}
function playGlass() {
  playTone(880, 0.05, 'triangle', 0.06);
  setTimeout(() => playTone(1320, 0.07, 'sine', 0.04), 30);
  setTimeout(() => playTone(1760, 0.04, 'triangle', 0.03), 60);
}
function playSwipe(dir) {
  playTone(dir > 0 ? 520 : 320, 0.1, 'sawtooth', 0.05);
}
function playClick() { playTone(640, 0.04, 'square', 0.03); }
function playSuccess() {
  playTone(523, 0.08); setTimeout(() => playTone(659, 0.08), 80); setTimeout(() => playTone(784, 0.12), 160);
}
function vibe(ms = 12) {
  if (state.vibeEnabled && navigator.vibrate) navigator.vibrate(ms);
}

// Utils
function $(sel, el = document) { return el.querySelector(sel); }
function $$(sel, el = document) { return [...el.querySelectorAll(sel)]; }
function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), ms);
}
function initials(name = '?') {
  return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}
function colorFromId(id) {
  const hues = [260, 320, 200, 40, 160, 10, 280, 180];
  let h = 0;
  for (let i = 0; i < (id || '').length; i++) h = (h + id.charCodeAt(i) * 17) % 360;
  return `hsl(${hues[h % hues.length]}, 65%, 55%)`;
}
function scoreColor(v) {
  if (v >= 8) return '#10b981';
  if (v >= 6) return '#84cc16';
  if (v >= 4) return '#f59e0b';
  if (v >= 2) return '#f97316';
  return '#ef4444';
}

// Screens
function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $(`#${id}`)?.classList.add('active');
}

// Auth
async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    state.user = session.user;
    await loadProfile();
    showScreen('main');
    await loadData();
    buildStacks();
  } else {
    showScreen('auth');
  }
  sb.auth.onAuthStateChange(async (ev, session) => {
    if (ev === 'SIGNED_IN' && session) {
      state.user = session.user;
      await loadProfile();
      showScreen('main');
      await loadData();
      buildStacks();
    } else if (ev === 'SIGNED_OUT') {
      state.user = null;
      showScreen('auth');
    }
  });
}

async function loadProfile() {
  const { data } = await sb.from('profiles').select('*').eq('id', state.user.id).maybeSingle();
  state.profile = data;
}

async function handleAuth(e) {
  e.preventDefault();
  const email = $('#auth-email').value.trim();
  const pass = $('#auth-pass').value;
  const isLogin = $('.auth-tabs .tab.active').dataset.tab === 'login';
  const msg = $('#auth-msg');
  msg.textContent = '...';
  try {
    if (isLogin) {
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
    } else {
      const { error } = await sb.auth.signUp({ email, password: pass });
      if (error) throw error;
      msg.textContent = 'Check email or try login';
      playSuccess();
    }
  } catch (err) {
    msg.textContent = err.message || 'Failed';
    vibe(30);
  }
}

// Data
async function loadData() {
  const [p, t, s] = await Promise.all([
    sb.from('people').select('*').order('full_name'),
    sb.from('mx_traits').select('*').eq('is_active', true).order('name'),
    sb.from('mx_scores').select('*'),
  ]);
  state.people = p.data || [];
  state.traits = t.data || [];
  state.scores = s.data || [];
  // fallback seed traits if empty (local only for demo)
  if (!state.traits.length) {
    state.traits = [
      { id: 't1', name: 'Kindness', slug: 'kindness', color: '#10b981', icon: 'heart' },
      { id: 't2', name: 'Bravery', slug: 'bravery', color: '#ef4444', icon: 'shield' },
      { id: 't3', name: 'Wisdom', slug: 'wisdom', color: '#8b5cf6', icon: 'brain' },
      { id: 't4', name: 'Creativity', slug: 'creativity', color: '#f59e0b', icon: 'palette' },
      { id: 't5', name: 'Integrity', slug: 'integrity', color: '#3b82f6', icon: 'scale' },
    ];
  }
}

function getScore(rankerId, scoredId, traitId) {
  return state.scores.find(s => s.ranker_id === rankerId && s.scored_id === scoredId && s.trait_id === traitId);
}

function avgScore(scores) {
  if (!scores.length) return null;
  return scores.reduce((a, s) => a + Number(s.score), 0) / scores.length;
}

// Stacks builders
function buildStacks() {
  const mode = state.viewMode;
  let stacks = [];
  if (mode === 'trait') {
    // Each stack = one trait. Cards = people (as scored), showing scores from all rankers
    stacks = state.traits.map(trait => ({
      id: trait.id,
      title: trait.name,
      color: trait.color,
      meta: trait.description || '',
      cards: state.people.map(person => {
        const relevant = state.scores.filter(s => s.scored_id === person.id && s.trait_id === trait.id);
        return {
          type: 'person-scored',
          person,
          trait,
          scores: relevant,
          avg: avgScore(relevant),
        };
      }),
    }));
  } else if (mode === 'ranker') {
    // Each stack = one ranker person. Cards = other people, showing that ranker's scores across traits
    stacks = state.people.map(ranker => ({
      id: ranker.id,
      title: ranker.full_name,
      color: colorFromId(ranker.id),
      meta: ranker.job_title || ranker.department || '',
      cards: state.people.filter(p => p.id !== ranker.id).map(scored => {
        const relevant = state.scores.filter(s => s.ranker_id === ranker.id && s.scored_id === scored.id);
        return {
          type: 'ranker-view',
          ranker,
          scored,
          scores: relevant,
          avg: avgScore(relevant),
        };
      }),
    }));
  } else {
    // scored: each stack = one person being scored. Cards = rankers, showing their scores for that person
    stacks = state.people.map(scored => ({
      id: scored.id,
      title: scored.full_name,
      color: colorFromId(scored.id),
      meta: 'receiving',
      cards: state.people.filter(p => p.id !== scored.id).map(ranker => {
        const relevant = state.scores.filter(s => s.ranker_id === ranker.id && s.scored_id === scored.id);
        return {
          type: 'scored-view',
          ranker,
          scored,
          scores: relevant,
          avg: avgScore(relevant),
        };
      }),
    }));
  }
  state.stacks = stacks;
  state.stackIndex = Math.min(state.stackIndex, Math.max(0, stacks.length - 1));
  renderStack();
}

function renderStack() {
  const stack = state.stacks[state.stackIndex];
  const container = $('#stack-cards');
  container.innerHTML = '';
  const indicator = $('#stack-indicator');
  indicator.innerHTML = '';

  state.stacks.forEach((_, i) => {
    const d = document.createElement('div');
    d.className = 'stack-dot' + (i === state.stackIndex ? ' active' : '');
    indicator.appendChild(d);
  });

  if (!stack || !stack.cards.length) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-layer-group"></i><p>Empty stack</p></div>`;
    $('#tinder').classList.add('loaded');
    return;
  }

  // Show top 4 cards in stack visual
  const visible = stack.cards.slice(0, 6);
  visible.forEach((card, idx) => {
    const el = createCardEl(card, idx);
    container.appendChild(el);
  });

  initHammer();
  $('#tinder').classList.add('loaded');
  playClick();
}

function createCardEl(data, index) {
  const el = document.createElement('div');
  el.className = 'tinder--card';
  el.dataset.index = index;
  el.style.zIndex = 100 - index;
  el.style.transform = `scale(${(20 - index) / 20}) translateY(-${28 * index}px)`;
  el.style.opacity = (12 - index) / 12;

  let title = '', sub = '', body = '';
  if (data.type === 'person-scored') {
    title = data.person.full_name;
    sub = data.trait.name;
    body = renderScoreGridForPersonTrait(data);
  } else if (data.type === 'ranker-view') {
    title = data.scored.full_name;
    sub = `by ${data.ranker.full_name}`;
    body = renderTraitsForRanker(data);
  } else {
    title = data.ranker.full_name;
    sub = `→ ${data.scored.full_name}`;
    body = renderTraitsForRanker(data);
  }

  const avg = data.avg != null ? data.avg.toFixed(1) : '—';
  const avatarColor = colorFromId(data.person?.id || data.scored?.id || data.ranker?.id);

  el.innerHTML = `
    <div class="card-header">
      <div class="card-avatar" style="background:${avatarColor}">${initials(title)}</div>
      <div class="card-meta">
        <div class="card-title">${escapeHtml(title)}</div>
        <div class="card-sub">${escapeHtml(sub)}</div>
      </div>
    </div>
    <div class="card-body">${body}</div>
    <div class="card-footer">
      <span>avg <strong>${avg}</strong></span>
      <span class="badge">${data.scores?.length || 0} scores</span>
    </div>
  `;
  return el;
}

function renderScoreGridForPersonTrait(data) {
  if (!data.scores.length) return `<div class="empty-state" style="padding:2rem"><i class="fa-solid fa-ghost"></i><p>No scores yet</p></div>`;
  const cells = data.scores.slice(0, 8).map(s => {
    const ranker = state.people.find(p => p.id === s.ranker_id);
    return `
      <div class="score-cell">
        <div class="score-label">${escapeHtml(ranker?.full_name || '?')}</div>
        <div class="score-value" style="color:${scoreColor(s.score)}">${Number(s.score).toFixed(1)}</div>
        <div class="score-bar"><div style="width:${s.score * 10}%;background:${scoreColor(s.score)}"></div></div>
      </div>
    `;
  }).join('');
  return `<div class="score-grid">${cells}</div>`;
}

function renderTraitsForRanker(data) {
  if (!state.traits.length) return '';
  const cells = state.traits.map(t => {
    const sc = data.scores.find(s => s.trait_id === t.id);
    const val = sc ? Number(sc.score).toFixed(1) : '—';
    const col = sc ? scoreColor(sc.score) : 'var(--text-dim)';
    return `
      <div class="score-cell">
        <div class="score-label">${escapeHtml(t.name)}</div>
        <div class="score-value" style="color:${col}">${val}</div>
        <div class="score-bar"><div style="width:${sc ? sc.score * 10 : 0}%;background:${col}"></div></div>
      </div>
    `;
  }).join('');
  return `<div class="score-grid">${cells}</div>`;
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Hammer / swipe
function initHammer() {
  const cards = $$('.tinder--card:not(.removed)');
  cards.forEach(el => {
    if (el._hammer) return;
    const hammertime = new Hammer(el);
    el._hammer = hammertime;
    hammertime.on('pan', ev => {
      el.classList.add('moving');
      if (ev.deltaX === 0) return;
      const tinder = $('#tinder');
      tinder.classList.toggle('tinder_love', ev.deltaX > 0);
      tinder.classList.toggle('tinder_nope', ev.deltaX < 0);
      const xMulti = ev.deltaX * 0.03;
      const yMulti = ev.deltaY / 80;
      const rotate = xMulti * yMulti;
      el.style.transform = `translate(${ev.deltaX}px, ${ev.deltaY}px) rotate(${rotate}deg)`;
    });
    hammertime.on('panend', ev => {
      el.classList.remove('moving');
      $('#tinder').classList.remove('tinder_love', 'tinder_nope');
      const moveOut = document.body.clientWidth;
      const keep = Math.abs(ev.deltaX) < 90 || Math.abs(ev.velocityX) < 0.45;
      if (keep) {
        el.style.transform = '';
        // reset stack positions
        const all = $$('.tinder--card:not(.removed)');
        all.forEach((c, i) => {
          c.style.zIndex = 100 - i;
          c.style.transform = `scale(${(20 - i) / 20}) translateY(-${28 * i}px)`;
          c.style.opacity = (12 - i) / 12;
        });
      } else {
        playSwipe(ev.deltaX);
        vibe(18);
        playGlass();
        const endX = Math.max(Math.abs(ev.velocityX) * moveOut, moveOut);
        const toX = ev.deltaX > 0 ? endX : -endX;
        const endY = Math.abs(ev.velocityY) * moveOut * 0.4;
        const toY = ev.deltaY > 0 ? endY : -endY;
        const rotate = (ev.deltaX * 0.03) * (ev.deltaY / 80);
        el.style.transform = `translate(${toX}px, ${toY + ev.deltaY}px) rotate(${rotate}deg)`;
        el.classList.add('removed');
        setTimeout(() => {
          el.remove();
          // re-stack remaining
          const remaining = $$('.tinder--card:not(.removed)');
          remaining.forEach((c, i) => {
            c.style.zIndex = 100 - i;
            c.style.transform = `scale(${(20 - i) / 20}) translateY(-${28 * i}px)`;
            c.style.opacity = (12 - i) / 12;
          });
          // if stack empty, advance
          if (!remaining.length) {
            nextStack();
          }
        }, 280);
      }
    });
  });
}

function nextStack() {
  if (state.stackIndex < state.stacks.length - 1) {
    state.stackIndex++;
    renderStack();
    playClick();
  } else {
    toast('End of stacks');
    vibe(25);
  }
}
function prevStack() {
  if (state.stackIndex > 0) {
    state.stackIndex--;
    renderStack();
    playClick();
  }
}

// Button listeners for love/nope
function createButtonListener(love) {
  return function (e) {
    e.preventDefault();
    const cards = $$('.tinder--card:not(.removed)');
    if (!cards.length) { nextStack(); return; }
    const card = cards[0];
    const moveOut = document.body.clientWidth * 1.4;
    card.classList.add('removed');
    playSwipe(love ? 1 : -1);
    vibe(15);
    playGlass();
    if (love) {
      card.style.transform = `translate(${moveOut}px, -80px) rotate(-28deg)`;
    } else {
      card.style.transform = `translate(-${moveOut}px, -80px) rotate(28deg)`;
    }
    setTimeout(() => {
      card.remove();
      const remaining = $$('.tinder--card:not(.removed)');
      remaining.forEach((c, i) => {
        c.style.zIndex = 100 - i;
        c.style.transform = `scale(${(20 - i) / 20}) translateY(-${28 * i}px)`;
        c.style.opacity = (12 - i) / 12;
      });
      if (!remaining.length) nextStack();
    }, 300);
  };
}

// Panels
function openPanel(name) {
  const titles = { people: 'People', traits: 'Traits', scores: 'Scores', insights: 'Insights', 'ai-chat': 'AI Chat', settings: 'Settings' };
  $('#panel-title').textContent = titles[name] || name;
  $('#panel').classList.add('open');
  const body = $('#panel-body');
  body.innerHTML = '';
  if (name === 'people') renderPeoplePanel(body);
  else if (name === 'traits') renderTraitsPanel(body);
  else if (name === 'scores') renderScoresPanel(body);
  else if (name === 'insights') renderInsightsPanel(body);
  else if (name === 'ai-chat') { closePanel(); openAI(); }
  else if (name === 'settings') renderSettingsPanel(body);
}

function closePanel() {
  $('#panel').classList.remove('open');
}

function renderPeoplePanel(body) {
  if (!state.people.length) {
    body.innerHTML = `<div class="empty-state"><i class="fa-solid fa-users"></i><p>No people</p>
      <button class="btn primary" style="margin-top:1rem" id="add-person-btn">Add</button></div>`;
    $('#add-person-btn')?.addEventListener('click', () => showAddPerson());
    return;
  }
  body.innerHTML = state.people.map(p => `
    <div class="list-item" data-id="${p.id}">
      <div class="avatar" style="background:${colorFromId(p.id)}">${p.avatar_url ? `<img src="${p.avatar_url}">` : initials(p.full_name)}</div>
      <div class="info">
        <div class="name">${escapeHtml(p.full_name)}</div>
        <div class="meta">${escapeHtml(p.job_title || p.department || '')}</div>
      </div>
    </div>
  `).join('') + `<button class="btn primary full" style="margin-top:1rem" id="add-person-btn">+ Person</button>`;
  $('#add-person-btn')?.addEventListener('click', () => showAddPerson());
}

function showAddPerson() {
  const name = prompt('Full name');
  if (!name) return;
  (async () => {
    const { data, error } = await sb.from('people').insert({ full_name: name, created_by: state.user.id }).select().single();
    if (error) { toast(error.message); return; }
    state.people.push(data);
    toast('Added');
    playSuccess();
    buildStacks();
    openPanel('people');
  })();
}

function renderTraitsPanel(body) {
  body.innerHTML = state.traits.map(t => `
    <div class="list-item">
      <div class="avatar" style="background:${t.color || '#6366f1'}"><i class="fa-solid fa-${t.icon || 'tag'}"></i></div>
      <div class="info">
        <div class="name">${escapeHtml(t.name)}</div>
        <div class="meta">${escapeHtml(t.description || '')}</div>
      </div>
    </div>
  `).join('') + `<button class="btn primary full" style="margin-top:1rem" id="add-trait-btn">+ Trait</button>`;
  $('#add-trait-btn')?.addEventListener('click', () => showAddTrait());
}

function showAddTrait() {
  const name = prompt('Trait name');
  if (!name) return;
  (async () => {
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    const { data, error } = await sb.from('mx_traits').insert({ name, slug, created_by: state.user.id }).select().single();
    if (error) {
      // local fallback
      state.traits.push({ id: 'local-' + Date.now(), name, slug, color: '#6366f1' });
      toast('Local trait added');
    } else {
      state.traits.push(data);
      toast('Added');
    }
    playSuccess();
    buildStacks();
    openPanel('traits');
  })();
}

function renderScoresPanel(body) {
  const recent = state.scores.slice(-30).reverse();
  if (!recent.length) {
    body.innerHTML = `<div class="empty-state"><i class="fa-solid fa-table"></i><p>No scores</p></div>`;
    return;
  }
  body.innerHTML = recent.map(s => {
    const r = state.people.find(p => p.id === s.ranker_id);
    const sc = state.people.find(p => p.id === s.scored_id);
    const t = state.traits.find(tr => tr.id === s.trait_id);
    return `
      <div class="list-item">
        <div class="info">
          <div class="name">${escapeHtml(r?.full_name || '?')} → ${escapeHtml(sc?.full_name || '?')}</div>
          <div class="meta">${escapeHtml(t?.name || '?')} · <strong style="color:${scoreColor(s.score)}">${s.score}</strong></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderInsightsPanel(body) {
  // Simple stats + AI button
  const totalScores = state.scores.length;
  const peopleCount = state.people.length;
  const traitCount = state.traits.length;
  const avgs = state.traits.map(t => {
    const ss = state.scores.filter(s => s.trait_id === t.id);
    return { name: t.name, avg: avgScore(ss), n: ss.length };
  }).sort((a, b) => (b.avg || 0) - (a.avg || 0));

  body.innerHTML = `
    <div class="settings-section">
      <h4>Overview</h4>
      <div class="score-grid">
        <div class="score-cell"><div class="score-label">People</div><div class="score-value">${peopleCount}</div></div>
        <div class="score-cell"><div class="score-label">Traits</div><div class="score-value">${traitCount}</div></div>
        <div class="score-cell"><div class="score-label">Scores</div><div class="score-value">${totalScores}</div></div>
        <div class="score-cell"><div class="score-label">Density</div><div class="score-value">${peopleCount ? ((totalScores / (peopleCount * peopleCount * traitCount || 1)) * 100).toFixed(0) : 0}%</div></div>
      </div>
    </div>
    <div class="settings-section">
      <h4>Trait averages</h4>
      ${avgs.map(a => `
        <div class="list-item">
          <div class="info">
            <div class="name">${escapeHtml(a.name)}</div>
            <div class="meta">${a.n} scores</div>
          </div>
          <div class="score-value" style="color:${scoreColor(a.avg || 0)}">${a.avg != null ? a.avg.toFixed(1) : '—'}</div>
        </div>
      `).join('')}
    </div>
    <button class="btn primary full" id="ai-insight-btn">Generate AI Insight</button>
  `;
  $('#ai-insight-btn')?.addEventListener('click', () => {
    closePanel();
    openAI();
    setTimeout(() => {
      $('#ai-input').value = 'Analyze the current ranking matrix. Highlight top and bottom performers, strongest traits, and interesting asymmetries in mutual scores.';
      sendAI();
    }, 300);
  });
}

function renderSettingsPanel(body) {
  body.innerHTML = `
    <div class="settings-section">
      <h4>OpenRouter API Key</h4>
      <div class="setting-row">
        <input type="password" id="or-key-input" placeholder="sk-or-..." value="${state.openRouterKey}" />
      </div>
      <button class="btn primary full" id="save-key-btn" style="margin-top:0.5rem">Save Key</button>
    </div>
    <div class="settings-section">
      <h4>Preferences</h4>
      <div class="setting-row">
        <span>Sounds</span>
        <input type="checkbox" id="set-sounds" ${state.soundsEnabled ? 'checked' : ''} />
      </div>
      <div class="setting-row">
        <span>Vibration</span>
        <input type="checkbox" id="set-vibe" ${state.vibeEnabled ? 'checked' : ''} />
      </div>
    </div>
    <div class="settings-section">
      <h4>Account</h4>
      <p style="font-size:0.85rem;color:var(--text-dim);margin-bottom:0.8rem">${state.user?.email || ''}</p>
      <button class="btn ghost full" id="reload-data-btn">Reload Data</button>
    </div>
  `;
  $('#save-key-btn')?.addEventListener('click', () => {
    state.openRouterKey = $('#or-key-input').value.trim();
    localStorage.setItem('or_key', state.openRouterKey);
    toast('Key saved');
    playSuccess();
  });
  $('#set-sounds')?.addEventListener('change', e => {
    state.soundsEnabled = e.target.checked;
    localStorage.setItem('sounds', e.target.checked ? '1' : '0');
  });
  $('#set-vibe')?.addEventListener('change', e => {
    state.vibeEnabled = e.target.checked;
    localStorage.setItem('vibe', e.target.checked ? '1' : '0');
  });
  $('#reload-data-btn')?.addEventListener('click', async () => {
    await loadData();
    buildStacks();
    toast('Reloaded');
  });
}

// Score modal
function openScoreModal() {
  const form = $('#score-form');
  if (!state.people.length || !state.traits.length) {
    toast('Need people & traits');
    return;
  }
  form.innerHTML = `
    <div class="form-row">
      <label>Ranker</label>
      <select id="sc-ranker">${state.people.map(p => `<option value="${p.id}">${escapeHtml(p.full_name)}</option>`).join('')}</select>
    </div>
    <div class="form-row">
      <label>Scored</label>
      <select id="sc-scored">${state.people.map(p => `<option value="${p.id}">${escapeHtml(p.full_name)}</option>`).join('')}</select>
    </div>
    <div class="form-row">
      <label>Trait</label>
      <select id="sc-trait">${state.traits.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}</select>
    </div>
    <div class="score-preview" id="sc-preview">5.0</div>
    <div class="form-row">
      <input type="range" min="0" max="10" step="0.5" value="5" class="score-slider" id="sc-score" />
    </div>
    <div class="form-row">
      <label>Note</label>
      <textarea id="sc-note" placeholder="optional"></textarea>
    </div>
    <button class="btn primary full" id="sc-submit">Save Score</button>
    <button class="btn ghost full" style="margin-top:0.5rem" id="sc-ai">AI Suggest</button>
  `;
  $('#score-modal').classList.add('open');
  $('#sc-score').addEventListener('input', e => {
    $('#sc-preview').textContent = Number(e.target.value).toFixed(1);
  });
  $('#sc-submit').addEventListener('click', saveScore);
  $('#sc-ai').addEventListener('click', aiSuggestScore);
}

function closeScoreModal() {
  $('#score-modal').classList.remove('open');
}

async function saveScore() {
  const ranker_id = $('#sc-ranker').value;
  const scored_id = $('#sc-scored').value;
  const trait_id = $('#sc-trait').value;
  const score = Number($('#sc-score').value);
  const note = $('#sc-note').value;
  if (ranker_id === scored_id) { toast('Cannot self-score'); return; }
  try {
    const { data, error } = await sb.from('mx_scores').upsert({
      ranker_id, scored_id, trait_id, score, note, source: 'manual',
      updated_at: new Date().toISOString()
    }, { onConflict: 'ranker_id,scored_id,trait_id' }).select().single();
    if (error) throw error;
    // update local
    const idx = state.scores.findIndex(s => s.ranker_id === ranker_id && s.scored_id === scored_id && s.trait_id === trait_id);
    if (idx >= 0) state.scores[idx] = data;
    else state.scores.push(data);
    toast('Saved');
    playSuccess();
    vibe(20);
    closeScoreModal();
    buildStacks();
  } catch (err) {
    // local fallback
    const local = { id: 'local-' + Date.now(), ranker_id, scored_id, trait_id, score, note, source: 'manual' };
    const idx = state.scores.findIndex(s => s.ranker_id === ranker_id && s.scored_id === scored_id && s.trait_id === trait_id);
    if (idx >= 0) state.scores[idx] = local;
    else state.scores.push(local);
    toast('Saved locally');
    playSuccess();
    closeScoreModal();
    buildStacks();
  }
}

async function aiSuggestScore() {
  if (!state.openRouterKey) { toast('Set API key in Settings'); return; }
  const ranker = state.people.find(p => p.id === $('#sc-ranker').value);
  const scored = state.people.find(p => p.id === $('#sc-scored').value);
  const trait = state.traits.find(t => t.id === $('#sc-trait').value);
  toast('AI thinking...');
  const prompt = `You are a precise scoring assistant. Suggest a score from 0 to 10 (one decimal) for how ${ranker?.full_name} would rate ${scored?.full_name} on the trait "${trait?.name}". Reply ONLY with the number, nothing else.`;
  try {
    const res = await callOpenRouter(prompt, 0.3);
    const num = parseFloat(res.match(/[\d.]+/)?.[0]);
    if (!isNaN(num)) {
      const clamped = Math.max(0, Math.min(10, num));
      $('#sc-score').value = clamped;
      $('#sc-preview').textContent = clamped.toFixed(1);
      playSuccess();
    } else toast('Could not parse');
  } catch (e) {
    toast(e.message || 'AI error');
  }
}

// AI
function openAI() {
  $('#ai-overlay').classList.add('open');
  const modelsEl = $('#ai-models');
  modelsEl.innerHTML = FREE_MODELS.map(m => `
    <div class="model-chip ${m.id === state.selectedModel ? 'active' : ''}" data-id="${m.id}">${m.name}</div>
  `).join('');
  $$('.model-chip', modelsEl).forEach(c => c.addEventListener('click', () => {
    state.selectedModel = c.dataset.id;
    localStorage.setItem('or_model', state.selectedModel);
    $$('.model-chip').forEach(x => x.classList.toggle('active', x.dataset.id === state.selectedModel));
    playClick();
  }));
  if (!$('#ai-messages').children.length) {
    addAIMsg('system', 'Ready. Ask about rankings, people, or request analysis.');
  }
}

function closeAI() {
  $('#ai-overlay').classList.remove('open');
}

function addAIMsg(role, text) {
  const div = document.createElement('div');
  div.className = `ai-msg ${role}`;
  div.textContent = text;
  $('#ai-messages').appendChild(div);
  $('#ai-messages').scrollTop = $('#ai-messages').scrollHeight;
}

async function callOpenRouter(prompt, temperature = 0.7) {
  if (!state.openRouterKey) throw new Error('No OpenRouter key');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${state.openRouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': location.origin,
      'X-Title': 'Matrix3',
    },
    body: JSON.stringify({
      model: state.selectedModel,
      messages: [
        { role: 'system', content: 'You are an expert analyst for a 3D personality ranking matrix. Be concise, insightful, data-driven. Prefer short structured answers.' },
        ...state.aiHistory.slice(-6),
        { role: 'user', content: prompt }
      ],
      temperature,
      max_tokens: 1024,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err.slice(0, 120) || res.statusText);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content || '';
}

async function sendAI() {
  const input = $('#ai-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  addAIMsg('user', text);
  state.aiHistory.push({ role: 'user', content: text });
  addAIMsg('assistant', '…');
  const msgs = $('#ai-messages');
  const last = msgs.lastElementChild;
  try {
    // enrich with context
    const ctx = `People: ${state.people.map(p => p.full_name).join(', ')}. Traits: ${state.traits.map(t => t.name).join(', ')}. Total scores: ${state.scores.length}. View: ${state.viewMode}.`;
    const fullPrompt = ctx + '\n\nUser: ' + text;
    const reply = await callOpenRouter(fullPrompt);
    last.textContent = reply;
    state.aiHistory.push({ role: 'assistant', content: reply });
    playSuccess();
  } catch (e) {
    last.textContent = 'Error: ' + (e.message || 'failed');
    vibe(40);
  }
}

// FX particles on swipe
const canvas = $('#fx-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
function resizeCanvas() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function spawnParticles(x, y, color) {
  for (let i = 0; i < 18; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8 - 2,
      life: 1,
      color,
      size: Math.random() * 4 + 2,
    });
  }
}
function tickFX() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles = particles.filter(p => {
    p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= 0.025;
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
    return p.life > 0;
  });
  requestAnimationFrame(tickFX);
}
tickFX();

// Events
function bindEvents() {
  // Auth
  $('#auth-form').addEventListener('submit', handleAuth);
  $$('.auth-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.auth-tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      playClick();
    });
  });

  // View switch
  $$('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.viewMode = btn.dataset.view;
      state.stackIndex = 0;
      buildStacks();
      playClick();
      vibe(8);
    });
  });

  // Stack nav
  $('#next-stack').addEventListener('click', nextStack);
  $('#prev-stack').addEventListener('click', prevStack);

  // Love / Nope
  $('#love').addEventListener('click', createButtonListener(true));
  $('#nope').addEventListener('click', createButtonListener(false));

  // Menu / drawer
  $('#btn-menu').addEventListener('click', () => {
    $('#drawer').classList.add('open');
    $('#drawer-overlay').classList.add('show');
    playClick();
  });
  $('#close-drawer').addEventListener('click', closeDrawer);
  $('#drawer-overlay').addEventListener('click', closeDrawer);
  $$('.drawer-nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      closeDrawer();
      openPanel(btn.dataset.panel);
      playClick();
    });
  });
  $('#btn-logout').addEventListener('click', async () => {
    await sb.auth.signOut();
    closeDrawer();
  });

  function closeDrawer() {
    $('#drawer').classList.remove('open');
    $('#drawer-overlay').classList.remove('show');
  }

  // Panel
  $('#close-panel').addEventListener('click', closePanel);

  // AI
  $('#btn-ai').addEventListener('click', () => { openAI(); playClick(); });
  $('#close-ai').addEventListener('click', closeAI);
  $('#ai-send').addEventListener('click', sendAI);
  $('#ai-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendAI(); });

  // Score
  $('#btn-score').addEventListener('click', () => { openScoreModal(); playClick(); });
  $('#close-score').addEventListener('click', closeScoreModal);

  // Info button → insights
  $('#btn-info').addEventListener('click', () => openPanel('insights'));

  // Profile
  $('#btn-profile').addEventListener('click', () => openPanel('settings'));
}

// Boot
async function boot() {
  bindEvents();
  // splash timing
  setTimeout(async () => {
    await initAuth();
  }, 1400);
}

boot();
