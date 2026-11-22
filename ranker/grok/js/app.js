(() => {
  'use strict';

  const state = {
    user: null,
    people: [],
    traits: [],
    scores: [],
    mode: 'people',
    currentRaterId: null,
    selectedTarget: null,
    selectedTrait: null,
    vibrate: localStorage.getItem('r3d_vibrate') !== '0',
    theme: localStorage.getItem('r3d_theme') || 'dark',
    chart: null
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const VIEW_TITLES = {
    rank: 'RANK', people: 'PEOPLE', traits: 'TRAITS',
    matrix: 'MATRIX', viz: 'VIZ', insights: 'INSIGHTS', settings: 'SETTINGS'
  };

  function toast(msg, ms = 2000) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), ms);
  }

  function openModal(html) {
    $('#modal-body').innerHTML = html;
    $('#modal-overlay').classList.add('open');
  }
  function closeModal() {
    $('#modal-overlay').classList.remove('open');
  }
  $('.modal-close').addEventListener('click', closeModal);
  $('#modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme === 'light' ? 'light' : 'dark');
    const btn = $('#toggle-theme');
    if (btn) btn.textContent = state.theme === 'light' ? 'LIGHT' : 'DARK';
  }

  function showAuth() {
    $('#auth-screen').classList.add('active');
    $('#main-screen').classList.remove('active');
  }
  function showMain() {
    $('#auth-screen').classList.remove('active');
    $('#main-screen').classList.add('active');
  }

  // Auth
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
    closeMenu();
    await DB.signOut();
    showAuth();
  });

  // Menu
  function openMenu() {
    $('#ctx-menu').classList.add('open');
    $('#ctx-overlay').classList.add('open');
  }
  function closeMenu() {
    $('#ctx-menu').classList.remove('open');
    $('#ctx-overlay').classList.remove('open');
  }
  $('#btn-menu').addEventListener('click', openMenu);
  $('#ctx-overlay').addEventListener('click', closeMenu);

  // Navigation
  function goView(name) {
    $$('.ctx-item[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    $$('.bnav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    $$('.view').forEach(v => v.classList.remove('active'));
    const view = $(`#view-${name}`);
    if (view) view.classList.add('active');
    $('#topbar-title').textContent = VIEW_TITLES[name] || name.toUpperCase();
    closeMenu();
    closeScoreSheet();

    if (name === 'rank') rebuildStacks();
    if (name === 'people') renderPeople();
    if (name === 'traits') renderTraits();
    if (name === 'matrix') renderMatrix();
    if (name === 'viz') renderViz();
    if (name === 'insights') {
      updateAiBadge();
      renderAiChips();
    }
    SFX.softTick();
  }

  $$('.ctx-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => goView(btn.dataset.view));
  });
  $$('.bnav-btn').forEach(btn => {
    btn.addEventListener('click', () => goView(btn.dataset.view));
  });
  $('#btn-ai-quick').addEventListener('click', () => goView('insights'));

  // Mode
  $$('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.mode = btn.dataset.mode;
      rebuildStacks();
      SFX.softTick();
    });
  });

  // Data
  async function loadAll() {
    try {
      const [people, traits, scores] = await Promise.all([
        DB.getPeople(), DB.getTraits(), DB.getScores()
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
    raterSel.innerHTML = state.people.map(p =>
      `<option value="${p.id}">${escape(p.full_name)}</option>`
    ).join('');
    if (state.currentRaterId) raterSel.value = state.currentRaterId;
    raterSel.onchange = () => {
      state.currentRaterId = raterSel.value;
      rebuildStacks();
    };

    const matrixTrait = $('#matrix-trait-select');
    matrixTrait.innerHTML = state.traits.map(t =>
      `<option value="${t.id}">${escape(t.name)}</option>`
    ).join('');
    matrixTrait.onchange = renderMatrix;

    const vizPerson = $('#viz-person-select');
    vizPerson.innerHTML = state.people.map(p =>
      `<option value="${p.id}">${escape(p.full_name)}</option>`
    ).join('');
    vizPerson.onchange = renderViz;
    $('#viz-type').onchange = renderViz;
  }

  function escape(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // STACKS
  function rebuildStacks() {
    const container = $('#stacks-container');
    CardStacks.clear(container);
    if (!state.people.length || !state.traits.length) {
      container.innerHTML = '<div style="color:var(--text2);padding:40px 20px;letter-spacing:1px;font-size:13px;text-align:center;width:100%">NEED PEOPLE + TRAITS</div>';
      return;
    }
    const raterId = state.currentRaterId || state.people[0].id;

    if (state.mode === 'people') {
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
          onSwipe: ({ item, scoreHint }) => openScorePanel(item.personId, item.traitId, scoreHint),
          onSelect: ({ item }) => openScorePanel(item.personId, item.traitId, 0)
        });
      });
    } else {
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
          onSwipe: ({ item, scoreHint }) => openScorePanel(item.personId, item.traitId, scoreHint),
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
    const existing = state.scores.find(s =>
      s.rater_id === state.currentRaterId && s.ratee_id === rateeId && s.trait_id === traitId
    );
    const val = existing ? Number(existing.score) : Number(hint) || 0;
    $('#score-slider').value = val;
    $('#score-value').textContent = (val > 0 ? '+' : '') + val;
    $('#score-note').value = existing?.note || '';
    $('#score-sheet').classList.add('open');
    SFX.glassClink(0.35);
  }

  function closeScoreSheet() {
    $('#score-sheet').classList.remove('open');
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
      const idx = state.scores.findIndex(s =>
        s.rater_id === row.rater_id && s.ratee_id === row.ratee_id && s.trait_id === row.trait_id
      );
      if (idx >= 0) state.scores[idx] = row; else state.scores.push(row);
      SFX.commitPop();
      SFX.glassClink(0.9);
      if (state.vibrate && navigator.vibrate) navigator.vibrate([10, 20, 10]);
      toast('LOCKED');
      closeScoreSheet();
    } catch (e) {
      console.error(e);
      toast('SAVE FAIL');
      SFX.errorBuzz();
    }
  });

  $('#btn-skip').addEventListener('click', () => {
    closeScoreSheet();
    SFX.softTick();
  });

  $('#btn-analyze-score').addEventListener('click', () => {
    if (!state.selectedTarget || !state.selectedTrait) return;
    const person = state.people.find(p => p.id === state.selectedTarget);
    const trait = state.traits.find(t => t.id === state.selectedTrait);
    const rater = state.people.find(p => p.id === state.currentRaterId);
    goView('insights');
    runAi(`Analyze why ${rater?.full_name || 'rater'} would score ${person?.full_name} on ${trait?.name}. Look at all related scores: how others rate ${person?.full_name} on ${trait?.name}, how ${person?.full_name} rates others on it, and mutual patterns. Give a short dense verdict.`);
  });

  $('#btn-shuffle').addEventListener('click', () => {
    rebuildStacks();
    SFX.glassClink(0.4);
  });

  let soundOn = true;
  $('#btn-sound-toggle').addEventListener('click', () => {
    soundOn = !soundOn;
    SFX.setEnabled(soundOn);
    $('#btn-sound-toggle').innerHTML = soundOn
      ? '<i class="fa-solid fa-volume-high"></i>'
      : '<i class="fa-solid fa-volume-xmark"></i>';
  });

  // PEOPLE with analyze
  function renderPeople() {
    const grid = $('#people-grid');
    grid.innerHTML = state.people.map(p => `
      <div class="person-card" data-id="${p.id}">
        <div class="avatar">${(p.full_name || '?')[0]}</div>
        <h3>${escape(p.full_name)}</h3>
        <p>${escape(p.job_title || p.bio || '—')}</p>
        <div class="card-actions">
          <button class="btn-analyze-person" data-id="${p.id}"><i class="fa-solid fa-wand-magic-sparkles"></i> AI</button>
        </div>
      </div>
    `).join('');
    grid.querySelectorAll('.btn-analyze-person').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const person = state.people.find(p => p.id === btn.dataset.id);
        if (!person) return;
        goView('insights');
        runAi(`Deep profile of ${person.full_name}. How do others rate them across all traits? How do they rate others? Asymmetries, strengths, polarizing traits, missing data. Dense short analysis.`);
      });
    });
  }

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
        const p = await DB.createPerson({
          full_name,
          job_title: $('#m-title').value.trim(),
          bio: $('#m-bio').value.trim()
        });
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

  // TRAITS with analyze
  function renderTraits() {
    const grid = $('#traits-grid');
    grid.innerHTML = state.traits.map(t => `
      <div class="trait-card" data-id="${t.id}">
        <h3><span class="trait-color" style="background:${t.color || '#7c5cff'}"></span>${escape(t.name)}</h3>
        <p>${escape(t.description || '—')}</p>
        <div class="card-actions">
          <button class="btn-analyze-trait" data-id="${t.id}"><i class="fa-solid fa-wand-magic-sparkles"></i> AI</button>
        </div>
      </div>
    `).join('');
    grid.querySelectorAll('.btn-analyze-trait').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const trait = state.traits.find(t => t.id === btn.dataset.id);
        if (!trait) return;
        goView('insights');
        runAi(`Analyze the trait "${trait.name}" across the whole ranking space. Who is rated highest/lowest? Biggest asymmetries (A rates B high, B rates A low)? Clusters? Who is polarizing on this trait? Short dense read.`);
      });
    });
  }

  $('#btn-add-trait').addEventListener('click', () => {
    openModal(`
      <h3>NEW TRAIT</h3>
      <div class="input-group"><input id="m-tname" placeholder=" "><label>name</label></div>
      <div class="input-group"><input id="m-tdesc" placeholder=" "><label>desc</label></div>
      <div class="input-group"><input id="m-tcolor" type="color" value="#7c5cff" style="height:42px;padding:4px;width:100%"></div>
      <button class="btn-primary" id="m-save-trait">ADD</button>
    `);
    $('#m-save-trait').onclick = async () => {
      const name = $('#m-tname').value.trim();
      if (!name) return;
      try {
        const t = await DB.createTrait({
          name,
          description: $('#m-tdesc').value.trim(),
          color: $('#m-tcolor').value
        });
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

  // MATRIX + cell analyze
  function renderMatrix() {
    const traitId = $('#matrix-trait-select').value;
    if (!traitId || !state.people.length) {
      $('#score-matrix').innerHTML = '';
      return;
    }
    const people = state.people;
    let html = '<thead><tr><th></th>' +
      people.map(p => `<th>${escape(p.full_name.slice(0, 7))}</th>`).join('') +
      '</tr></thead><tbody>';
    people.forEach(rater => {
      html += `<tr><td>${escape(rater.full_name.slice(0, 8))}</td>`;
      people.forEach(ratee => {
        if (rater.id === ratee.id) {
          html += '<td class="cell-zero">·</td>';
        } else {
          const s = state.scores.find(x =>
            x.rater_id === rater.id && x.ratee_id === ratee.id && x.trait_id === traitId
          );
          if (!s) {
            html += `<td class="cell-zero" data-r="${rater.id}" data-e="${ratee.id}" data-t="${traitId}">—</td>`;
          } else {
            const v = Number(s.score);
            const cls = v > 0 ? 'cell-pos' : v < 0 ? 'cell-neg' : 'cell-zero';
            html += `<td class="${cls}" data-r="${rater.id}" data-e="${ratee.id}" data-t="${traitId}">${v > 0 ? '+' : ''}${v}</td>`;
          }
        }
      });
      html += '</tr>';
    });
    html += '</tbody>';
    $('#score-matrix').innerHTML = html;

    $('#score-matrix').querySelectorAll('td[data-r]').forEach(td => {
      td.addEventListener('click', () => {
        const rater = state.people.find(p => p.id === td.dataset.r);
        const ratee = state.people.find(p => p.id === td.dataset.e);
        const trait = state.traits.find(t => t.id === td.dataset.t);
        goView('insights');
        runAi(`Cell focus: ${rater?.full_name} → ${ratee?.full_name} on ${trait?.name} (value: ${td.textContent}). Why this score? Compare to reverse direction, to how others rate ${ratee?.full_name} on this trait, and to ${rater?.full_name}'s typical rating style. Short verdict.`);
      });
    });
  }

  $('#btn-analyze-matrix')?.addEventListener('click', () => {
    const trait = state.traits.find(t => t.id === $('#matrix-trait-select').value);
    if (!trait) return;
    goView('insights');
    runAi(`Full matrix analysis for trait "${trait.name}". Rank people by average received and given. Call out strongest mutual pairs, biggest one-way asymmetries, and anyone missing data. Dense.`);
  });

  // VIZ
  function renderViz() {
    const personId = $('#viz-person-select').value;
    const type = $('#viz-type').value;
    const canvas = $('#viz-canvas');
    if (state.chart) { state.chart.destroy(); state.chart = null; }
    if (!personId || !state.traits.length) return;

    const labels = state.traits.map(t => t.name);
    const received = state.traits.map(t => {
      const list = state.scores.filter(s => s.ratee_id === personId && s.trait_id === t.id);
      if (!list.length) return 0;
      return list.reduce((a, b) => a + Number(b.score), 0) / list.length;
    });
    const given = state.traits.map(t => {
      const list = state.scores.filter(s => s.rater_id === personId && s.trait_id === t.id);
      if (!list.length) return 0;
      return list.reduce((a, b) => a + Number(b.score), 0) / list.length;
    });

    const ctx = canvas.getContext('2d');
    const common = {
      scales: type === 'radar'
        ? { r: { min: -5, max: 5, ticks: { stepSize: 2.5, color: '#8b90a0' }, grid: { color: 'rgba(255,255,255,0.06)' }, pointLabels: { color: '#e8eaf0', font: { size: 10 } } } }
        : { y: { min: -5, max: 5, ticks: { color: '#8b90a0' }, grid: { color: 'rgba(255,255,255,0.06)' } }, x: { ticks: { color: '#8b90a0', font: { size: 10 } } } },
      plugins: { legend: { labels: { color: '#8b90a0', boxWidth: 12 } } }
    };

    state.chart = new Chart(ctx, {
      type: type === 'bars' ? 'bar' : 'radar',
      data: {
        labels,
        datasets: [
          { label: 'RECV', data: received, borderColor: '#7c5cff', backgroundColor: type === 'bars' ? 'rgba(124,92,255,0.7)' : 'rgba(124,92,255,0.2)', pointBackgroundColor: '#7c5cff' },
          { label: 'GIVE', data: given, borderColor: '#ff4d9e', backgroundColor: type === 'bars' ? 'rgba(255,77,158,0.7)' : 'rgba(255,77,158,0.15)', pointBackgroundColor: '#ff4d9e' }
        ]
      },
      options: common
    });
  }

  $('#btn-analyze-viz')?.addEventListener('click', () => {
    const person = state.people.find(p => p.id === $('#viz-person-select').value);
    if (!person) return;
    goView('insights');
    runAi(`Visual profile of ${person.full_name}: interpret received vs given scores across traits. Where do they over/under-rate relative to how they are perceived? Signature pattern in one short paragraph.`);
  });

  // AI
  function updateAiBadge() {
    const el = $('#ai-model-badge');
    if (el) el.textContent = AI.getModel().split('/').pop();
  }

  function renderAiChips() {
    const chips = [
      { label: 'ASYMMETRY', prompt: 'Find the biggest mutual ranking asymmetries across all traits. Name the pairs and the gap.' },
      { label: 'NEW TRAITS', prompt: 'Suggest 5 sharp new personality traits worth ranking in this group.' },
      { label: 'AUTO SCORE', prompt: 'Propose plausible scores for missing cells based on existing patterns. List only the most confident ones.' },
      { label: '3D SPACE', prompt: 'Describe the 3D ranking space: clusters, outliers, and the main axes of variance.' },
      { label: 'POLAR', prompt: 'Who is the most polarizing person and on which traits? Evidence.' },
      { label: 'KINDNESS', prompt: 'Focus on kindness (or closest trait): who is kind, who is ranked kind, mismatches.' },
      { label: 'POEM', prompt: 'One cryptic 4-line ranking poem from the current data.' }
    ];
    const el = $('#ai-quick');
    el.innerHTML = chips.map(c =>
      `<button class="ai-chip" data-prompt="${escape(c.prompt)}">${c.label}</button>`
    ).join('');
    el.querySelectorAll('.ai-chip').forEach(chip => {
      chip.addEventListener('click', () => runAi(chip.dataset.prompt));
    });
  }

  function buildAiContext() {
    return {
      people: state.people.map(p => ({ id: p.id, name: p.full_name })),
      traits: state.traits.map(t => ({ id: t.id, name: t.name })),
      scores: state.scores.slice(0, 250).map(s => ({
        rater: state.people.find(p => p.id === s.rater_id)?.full_name,
        ratee: state.people.find(p => p.id === s.ratee_id)?.full_name,
        trait: state.traits.find(t => t.id === s.trait_id)?.name,
        score: s.score
      }))
    };
  }

  async function runAi(userText) {
    const messagesEl = $('#ai-messages');
    if (!messagesEl) return;

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
      await AI.streamChat(messages, ({ content, reasoning }) => {
        let html = (content || '').replace(/\n/g, '<br>');
        if (reasoning) html += `<div class="reasoning">${reasoning}</div>`;
        botMsg.innerHTML = html || '<div class="typing"><span></span><span></span><span></span></div>';
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }, { temperature: 0.75, max_tokens: 1600 });
      SFX.glassClink(0.45);
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
          state.people.push(await DB.createPerson(p));
        }
      }
      for (const t of demoTraits) {
        if (!state.traits.find(x => x.name === t.name)) {
          state.traits.push(await DB.createTrait(t));
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

  DB.getSession().then(session => {
    if (session) {
      state.user = session.user;
      showMain();
      loadAll();
    } else {
      showAuth();
    }
  });

  document.body.addEventListener('pointerdown', () => SFX.ensureCtx(), { once: true });
})();
