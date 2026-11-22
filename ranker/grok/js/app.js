(() => {
  'use strict';

  // State
  const state = {
    user: null,
    people: [],
    traits: [],
    scores: [],
    mode: 'people', // people | traits
    currentRaterId: null,
    selectedTarget: null,
    selectedTrait: null,
    vibrate: localStorage.getItem('r3d_vibrate') !== '0',
    theme: localStorage.getItem('r3d_theme') || 'dark',
    chart: null
  };

  // DOM
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Toast
  function toast(msg, ms = 2200) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), ms);
  }

  // Modal
  function openModal(html) {
    $('#modal-body').innerHTML = html;
    $('#modal-overlay').classList.add('open');
  }
  function closeModal() {
    $('#modal-overlay').classList.remove('open');
  }
  $('.modal-close').addEventListener('click', closeModal);
  $('#modal-overlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });

  // Theme
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme === 'light' ? 'light' : 'dark');
    const btn = $('#toggle-theme');
    if (btn) btn.textContent = state.theme === 'light' ? 'LIGHT' : 'DARK';
  }

  // Auth UI
  function showAuth() {
    $('#auth-screen').classList.add('active');
    $('#main-screen').classList.remove('active');
  }
  function showMain() {
    $('#auth-screen').classList.remove('active');
    $('#main-screen').classList.add('active');
  }

  // Auth form
  let authMode = 'login';
  $$('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      authMode = tab.dataset.tab;
      $('#auth-name-group').classList.toggle('hidden', authMode !== 'signup');
      $('#auth-submit').textContent = authMode === 'login' ? 'ENTER' : 'CREATE';
    });
  });

  $('#auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#auth-email').value.trim();
    const password = $('#auth-password').value;
    const name = $('#auth-name').value.trim();
    const errEl = $('#auth-error');
    errEl.textContent = '';
    try {
      SFX.ensureCtx();
      if (authMode === 'signup') {
        await DB.signUp(email, password, name);
        toast('CHECK EMAIL');
      } else {
        await DB.signIn(email, password);
      }
      SFX.successChime();
    } catch (err) {
      errEl.textContent = err.message || 'FAILED';
      SFX.errorBuzz();
    }
  });

  $('#btn-logout').addEventListener('click', async () => {
    await DB.signOut();
    showAuth();
  });

  // Navigation
  $$('.nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $$('.view').forEach(v => v.classList.remove('active'));
      const view = $(`#view-${btn.dataset.view}`);
      if (view) view.classList.add('active');
      if (btn.dataset.view === 'rank') rebuildStacks();
      if (btn.dataset.view === 'people') renderPeople();
      if (btn.dataset.view === 'traits') renderTraits();
      if (btn.dataset.view === 'matrix') renderMatrix();
      if (btn.dataset.view === 'viz') renderViz();
      if (btn.dataset.view === 'insights') updateAiBadge();
      SFX.softTick();
    });
  });

  // Mode toggle
  $$('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.mode = btn.dataset.mode;
      rebuildStacks();
      SFX.softTick();
    });
  });

  // Load data
  async function loadAll() {
    try {
      const [people, traits, scores] = await Promise.all([
        DB.getPeople(),
        DB.getTraits(),
        DB.getScores()
      ]);
      state.people = people;
      state.traits = traits;
      state.scores = scores;
      populateSelects();
      if (!state.currentRaterId && people.length) state.currentRaterId = people[0].id;
      rebuildStacks();
      renderPeople();
      renderTraits();
    } catch (e) {
      console.error(e);
      toast('DATA ERR');
    }
  }

  function populateSelects() {
    const raterSel = $('#rater-select');
    raterSel.innerHTML = state.people.map(p => `<option value="${p.id}">${p.full_name}</option>`).join('');
    if (state.currentRaterId) raterSel.value = state.currentRaterId;
    raterSel.onchange = () => {
      state.currentRaterId = raterSel.value;
      rebuildStacks();
    };

    const matrixTrait = $('#matrix-trait-select');
    matrixTrait.innerHTML = state.traits.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    matrixTrait.onchange = renderMatrix;

    const vizPerson = $('#viz-person-select');
    vizPerson.innerHTML = state.people.map(p => `<option value="${p.id}">${p.full_name}</option>`).join('');
    vizPerson.onchange = renderViz;
    $('#viz-type').onchange = renderViz;
  }

  // STACKS
  function rebuildStacks() {
    const container = $('#stacks-container');
    CardStacks.clear(container);
    if (!state.people.length || !state.traits.length) {
      container.innerHTML = '<div style="color:var(--text2);padding:40px;letter-spacing:2px">NEED PEOPLE + TRAITS</div>';
      return;
    }
    const raterId = state.currentRaterId || state.people[0].id;

    if (state.mode === 'people') {
      // One stack per ratee (other people). Cards inside = traits to score for that person.
      const others = state.people.filter(p => p.id !== raterId);
      others.forEach(person => {
        const items = state.traits.map(t => ({
          id: `${person.id}__${t.id}`,
          name: t.name,
          meta: person.full_name,
          color: t.color,
          tags: [t.description || ''].filter(Boolean),
          personId: person.id,
          traitId: t.id
        }));
        CardStacks.createStack(container, {
          label: person.full_name,
          items,
          accent: 'var(--accent)',
          onSwipe: ({ item, direction, scoreHint }) => {
            openScorePanel(item.personId, item.traitId, scoreHint);
          },
          onSelect: ({ item }) => openScorePanel(item.personId, item.traitId, 0)
        });
      });
    } else {
      // One stack per trait. Cards = people to score on that trait.
      state.traits.forEach(trait => {
        const others = state.people.filter(p => p.id !== raterId);
        const items = others.map(p => ({
          id: `${p.id}__${trait.id}`,
          name: p.full_name,
          meta: trait.name,
          color: trait.color,
          tags: (p.tags || []).slice(0, 3),
          personId: p.id,
          traitId: trait.id
        }));
        CardStacks.createStack(container, {
          label: trait.name,
          items,
          accent: trait.color || 'var(--accent)',
          onSwipe: ({ item, direction, scoreHint }) => {
            openScorePanel(item.personId, item.traitId, scoreHint);
          },
          onSelect: ({ item }) => openScorePanel(item.personId, item.traitId, 0)
        });
      });
    }
  }

  function openScorePanel(rateeId, traitId, hint = 0) {
    const person = state.people.find(p => p.id === rateeId);
    const trait = state.traits.find(t => t.id === traitId);
    if (!person || !trait) return;
    state.selectedTarget = rateeId;
    state.selectedTrait = traitId;
    $('#score-target-name').textContent = person.full_name;
    $('#score-trait-name').textContent = trait.name;
    const existing = state.scores.find(s => s.rater_id === state.currentRaterId && s.ratee_id === rateeId && s.trait_id === traitId);
    const val = existing ? Number(existing.score) : Number(hint) || 0;
    $('#score-slider').value = val;
    $('#score-value').textContent = (val > 0 ? '+' : '') + val;
    $('#score-note').value = existing?.note || '';
    SFX.glassClink(0.4);
  }

  $('#score-slider').addEventListener('input', (e) => {
    const v = Number(e.target.value);
    $('#score-value').textContent = (v > 0 ? '+' : '') + v;
    SFX.softTick();
  });

  $('#btn-commit').addEventListener('click', async () => {
    if (!state.selectedTarget || !state.selectedTrait || !state.currentRaterId) return;
    const score = Number($('#score-slider').value);
    const note = $('#score-note').value.trim();
    try {
      const row = await DB.upsertScore({
        rater_id: state.currentRaterId,
        ratee_id: state.selectedTarget,
        trait_id: state.selectedTrait,
        score,
        note
      });
      // update local
      const idx = state.scores.findIndex(s => s.rater_id === row.rater_id && s.ratee_id === row.ratee_id && s.trait_id === row.trait_id);
      if (idx >= 0) state.scores[idx] = row; else state.scores.push(row);
      SFX.commitPop();
      SFX.glassClink(1);
      if (state.vibrate && navigator.vibrate) navigator.vibrate([10, 20, 10]);
      toast('LOCKED');
    } catch (e) {
      console.error(e);
      toast('SAVE FAIL');
      SFX.errorBuzz();
    }
  });

  $('#btn-skip').addEventListener('click', () => {
    state.selectedTarget = null;
    state.selectedTrait = null;
    $('#score-target-name').textContent = '—';
    $('#score-trait-name').textContent = '—';
    SFX.softTick();
  });

  $('#btn-shuffle').addEventListener('click', () => {
    rebuildStacks();
    SFX.glassClink(0.5);
  });

  // Sound toggle
  let soundOn = true;
  $('#btn-sound-toggle').addEventListener('click', () => {
    soundOn = !soundOn;
    SFX.setEnabled(soundOn);
    $('#btn-sound-toggle').innerHTML = soundOn ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';
  });

  // PEOPLE
  function renderPeople() {
    const grid = $('#people-grid');
    grid.innerHTML = state.people.map(p => `
      <div class="person-card" data-id="${p.id}">
        <div class="avatar">${(p.full_name || '?')[0]}</div>
        <h3>${escape(p.full_name)}</h3>
        <p>${escape(p.job_title || p.bio || '—')}</p>
      </div>
    `).join('');
  }
  function escape(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

  $('#btn-add-person').addEventListener('click', () => {
    openModal(`
      <h3>NEW PERSON</h3>
      <div class="input-group"><input id="m-name" placeholder=" "><label>name</label></div>
      <div class="input-group"><input id="m-title" placeholder=" "><label>title</label></div>
      <div class="input-group"><input id="m-bio" placeholder=" "><label>bio</label></div>
      <button class="btn-primary" id="m-save-person">ADD</button>
    `);
    $('#m-save-person').onclick = async () => {
      const full_name = $('#m-name').value.trim();
      if (!full_name) return;
      try {
        const p = await DB.createPerson({ full_name, job_title: $('#m-title').value.trim(), bio: $('#m-bio').value.trim() });
        state.people.push(p);
        populateSelects();
        renderPeople();
        closeModal();
        SFX.successChime();
        toast('ADDED');
      } catch (e) {
        toast(e.message);
        SFX.errorBuzz();
      }
    };
  });

  // TRAITS
  function renderTraits() {
    const grid = $('#traits-grid');
    grid.innerHTML = state.traits.map(t => `
      <div class="trait-card" data-id="${t.id}">
        <h3><span class="trait-color" style="background:${t.color || '#7c5cff'}"></span>${escape(t.name)}</h3>
        <p>${escape(t.description || '—')}</p>
      </div>
    `).join('');
  }

  $('#btn-add-trait').addEventListener('click', () => {
    openModal(`
      <h3>NEW TRAIT</h3>
      <div class="input-group"><input id="m-tname" placeholder=" "><label>name</label></div>
      <div class="input-group"><input id="m-tdesc" placeholder=" "><label>desc</label></div>
      <div class="input-group"><input id="m-tcolor" type="color" value="#7c5cff" style="height:42px;padding:4px"></div>
      <button class="btn-primary" id="m-save-trait">ADD</button>
    `);
    $('#m-save-trait').onclick = async () => {
      const name = $('#m-tname').value.trim();
      if (!name) return;
      try {
        const t = await DB.createTrait({ name, description: $('#m-tdesc').value.trim(), color: $('#m-tcolor').value });
        state.traits.push(t);
        populateSelects();
        renderTraits();
        closeModal();
        SFX.successChime();
        toast('ADDED');
      } catch (e) {
        toast(e.message || 'TABLE?');
        SFX.errorBuzz();
      }
    };
  });

  // MATRIX
  function renderMatrix() {
    const traitId = $('#matrix-trait-select').value;
    if (!traitId || !state.people.length) {
      $('#score-matrix').innerHTML = '';
      return;
    }
    const people = state.people;
    let html = '<thead><tr><th></th>' + people.map(p => `<th>${escape(p.full_name.slice(0, 8))}</th>`).join('') + '</tr></thead><tbody>';
    people.forEach(rater => {
      html += `<tr><td>${escape(rater.full_name.slice(0, 10))}</td>`;
      people.forEach(ratee => {
        if (rater.id === ratee.id) {
          html += '<td class="cell-zero">·</td>';
        } else {
          const s = state.scores.find(x => x.rater_id === rater.id && x.ratee_id === ratee.id && x.trait_id === traitId);
          if (!s) html += '<td class="cell-zero">—</td>';
          else {
            const v = Number(s.score);
            const cls = v > 0 ? 'cell-pos' : v < 0 ? 'cell-neg' : 'cell-zero';
            html += `<td class="${cls}">${v > 0 ? '+' : ''}${v}</td>`;
          }
        }
      });
      html += '</tr>';
    });
    html += '</tbody>';
    $('#score-matrix').innerHTML = html;
  }

  // VIZ
  function renderViz() {
    const personId = $('#viz-person-select').value;
    const type = $('#viz-type').value;
    const canvas = $('#viz-canvas');
    if (state.chart) { state.chart.destroy(); state.chart = null; }
    if (!personId || !state.traits.length) return;

    const labels = state.traits.map(t => t.name);
    // received scores (others rating this person)
    const received = state.traits.map(t => {
      const list = state.scores.filter(s => s.ratee_id === personId && s.trait_id === t.id);
      if (!list.length) return 0;
      return list.reduce((a, b) => a + Number(b.score), 0) / list.length;
    });
    // given scores (this person rating others) average per trait
    const given = state.traits.map(t => {
      const list = state.scores.filter(s => s.rater_id === personId && s.trait_id === t.id);
      if (!list.length) return 0;
      return list.reduce((a, b) => a + Number(b.score), 0) / list.length;
    });

    const ctx = canvas.getContext('2d');
    if (type === 'radar') {
      state.chart = new Chart(ctx, {
        type: 'radar',
        data: {
          labels,
          datasets: [
            { label: 'RECV', data: received, borderColor: '#7c5cff', backgroundColor: 'rgba(124,92,255,0.2)', pointBackgroundColor: '#7c5cff' },
            { label: 'GIVE', data: given, borderColor: '#ff4d9e', backgroundColor: 'rgba(255,77,158,0.15)', pointBackgroundColor: '#ff4d9e' }
          ]
        },
        options: {
          scales: { r: { min: -5, max: 5, ticks: { stepSize: 2.5, color: '#8b90a0' }, grid: { color: 'rgba(255,255,255,0.06)' }, pointLabels: { color: '#e8eaf0', font: { size: 11 } } } },
          plugins: { legend: { labels: { color: '#8b90a0' } } }
        }
      });
    } else if (type === 'bars') {
      state.chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'RECV', data: received, backgroundColor: 'rgba(124,92,255,0.7)' },
            { label: 'GIVE', data: given, backgroundColor: 'rgba(255,77,158,0.7)' }
          ]
        },
        options: {
          scales: { y: { min: -5, max: 5, ticks: { color: '#8b90a0' }, grid: { color: 'rgba(255,255,255,0.06)' } }, x: { ticks: { color: '#8b90a0' } } },
          plugins: { legend: { labels: { color: '#8b90a0' } } }
        }
      });
    } else {
      // heat-like: simple dataset of all pairwise for selected trait? fallback radar
      state.chart = new Chart(ctx, {
        type: 'radar',
        data: { labels, datasets: [{ label: 'RECV', data: received, borderColor: '#3dffb5', backgroundColor: 'rgba(61,255,181,0.2)' }] },
        options: { scales: { r: { min: -5, max: 5 } }, plugins: { legend: { display: false } } }
      });
    }
  }

  // AI
  function updateAiBadge() {
    $('#ai-model-badge').textContent = AI.getModel().split('/').pop();
  }

  function buildAiContext() {
    return {
      people: state.people.map(p => ({ id: p.id, name: p.full_name })),
      traits: state.traits.map(t => ({ id: t.id, name: t.name })),
      scores: state.scores.slice(0, 200).map(s => ({
        rater: state.people.find(p => p.id === s.rater_id)?.full_name,
        ratee: state.people.find(p => p.id === s.ratee_id)?.full_name,
        trait: state.traits.find(t => t.id === s.trait_id)?.name,
        score: s.score
      }))
    };
  }

  async function runAi(userText) {
    const messagesEl = $('#ai-messages');
    const userMsg = document.createElement('div');
    userMsg.className = 'ai-msg user';
    userMsg.textContent = userText;
    messagesEl.appendChild(userMsg);

    const botMsg = document.createElement('div');
    botMsg.className = 'ai-msg assistant';
    botMsg.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(botMsg);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      if (!AI.getKey()) throw new Error('NO_KEY');
      const ctx = buildAiContext();
      const messages = [
        { role: 'system', content: AI.systemPrompt(ctx) },
        { role: 'user', content: userText }
      ];
      const result = await AI.streamChat(messages, ({ content, reasoning }) => {
        let html = content.replace(/\n/g, '<br>');
        if (reasoning) html += `<div class="reasoning">${reasoning}</div>`;
        botMsg.innerHTML = html || '<div class="typing"><span></span><span></span><span></span></div>';
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }, { temperature: 0.75, max_tokens: 1500 });
      if (!result.content) botMsg.textContent = '…';
      SFX.glassClink(0.5);
    } catch (e) {
      botMsg.textContent = e.message === 'NO_KEY' ? 'SET KEY IN SETTINGS' : (e.message || 'AI ERR');
      SFX.errorBuzz();
    }
  }

  $('#ai-send').addEventListener('click', () => {
    const input = $('#ai-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    runAi(text);
  });
  $('#ai-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#ai-send').click();
  });
  $$('.ai-chip').forEach(chip => {
    chip.addEventListener('click', () => runAi(chip.dataset.prompt));
  });

  // Settings
  $('#or-key').value = AI.getKey();
  $('#or-model').value = AI.getModel();
  $('#btn-save-key').addEventListener('click', () => {
    AI.setKey($('#or-key').value);
    toast('KEY SAVED');
    SFX.commitPop();
  });
  $('#or-model').addEventListener('change', (e) => {
    AI.setModel(e.target.value);
    updateAiBadge();
  });
  $('#sfx-volume').addEventListener('input', (e) => SFX.setVolume(Number(e.target.value)));
  $('#toggle-vibrate').addEventListener('click', () => {
    state.vibrate = !state.vibrate;
    localStorage.setItem('r3d_vibrate', state.vibrate ? '1' : '0');
    $('#toggle-vibrate').textContent = state.vibrate ? 'ON' : 'OFF';
    $('#toggle-vibrate').classList.toggle('active', state.vibrate);
  });
  $('#toggle-theme').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('r3d_theme', state.theme);
    applyTheme();
  });

  // Seed demo
  $('#btn-seed').addEventListener('click', async () => {
    const demoPeople = [
      { full_name: 'Aria Voss', job_title: 'Architect' },
      { full_name: 'Kai Mercer', job_title: 'Strategist' },
      { full_name: 'Luna Park', job_title: 'Designer' },
      { full_name: 'Rex Hale', job_title: 'Engineer' }
    ];
    const demoTraits = [
      { name: 'Kindness', color: '#ff6b9d' },
      { name: 'Bravery', color: '#7c5cff' },
      { name: 'Clarity', color: '#3dffb5' },
      { name: 'Wit', color: '#ffc857' }
    ];
    try {
      for (const p of demoPeople) {
        if (!state.people.find(x => x.full_name === p.full_name)) {
          const created = await DB.createPerson(p);
          state.people.push(created);
        }
      }
      for (const t of demoTraits) {
        if (!state.traits.find(x => x.name === t.name)) {
          const created = await DB.createTrait(t);
          state.traits.push(created);
        }
      }
      populateSelects();
      renderPeople();
      renderTraits();
      rebuildStacks();
      SFX.successChime();
      toast('SEEDED');
    } catch (e) {
      toast('SEED FAIL · CREATE TABLES');
      console.error(e);
    }
  });

  // AI Orb opens insights
  $('#ai-orb').addEventListener('click', () => {
    $$('.nav-btn').forEach(b => b.classList.remove('active'));
    $$('.nav-btn[data-view="insights"]')[0]?.classList.add('active');
    $$('.view').forEach(v => v.classList.remove('active'));
    $('#view-insights').classList.add('active');
    updateAiBadge();
    SFX.glassClink(0.6);
  });

  // Boot
  applyTheme();
  $('#toggle-vibrate').textContent = state.vibrate ? 'ON' : 'OFF';
  $('#toggle-vibrate').classList.toggle('active', state.vibrate);
  SFX.setVolume(0.6);

  DB.onAuthChange(async (event, session) => {
    if (session) {
      state.user = session.user;
      showMain();
      await loadAll();
    } else {
      state.user = null;
      showAuth();
    }
  });

  // Initial session check
  DB.getSession().then(session => {
    if (session) {
      state.user = session.user;
      showMain();
      loadAll();
    } else {
      showAuth();
    }
  });

  // First interaction resume audio
  document.body.addEventListener('pointerdown', () => SFX.ensureCtx(), { once: true });
})();
