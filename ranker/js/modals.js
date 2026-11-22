(function () {
  const T3D = window.T3D;
  const { h, esc } = T3D.lib;
  const root = () => document.getElementById('modals');

  function openModal({ title, body, footer, wide }) {
    const close = () => { backdrop.remove(); };
    const backdrop = h('div', { class: 'modal-backdrop' });
    const modal = h('div', { class: 'modal' + (wide ? ' wide' : '') });
    const head = h('div', { class: 'modal-head' },
      h('h3', { class: 'modal-title' }, title || ''),
      h('button', { class: 'icon-btn', onclick: close }, h('i', { class: 'fa-solid fa-xmark' }))
    );
    const bodyEl = h('div', { class: 'modal-body' });
    if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
    modal.appendChild(head);
    modal.appendChild(bodyEl);
    if (footer) {
      const foot = h('div', { class: 'modal-foot' });
      if (typeof footer === 'string') foot.innerHTML = footer; else foot.appendChild(footer);
      modal.appendChild(foot);
    }
    backdrop.appendChild(modal);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', function onEsc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); } });
    root().appendChild(backdrop);
    T3D.sound.clink(0.12);
    T3D.vibrate.tick();
    return { el: modal, body: bodyEl, close };
  }

  // ---------- AUTH ----------
  function openAuth() {
    const { body, close } = openModal({ title: 'Welcome to TRIAD' });
    let mode = 'signin';

    function render() {
      body.innerHTML = '';
      const tabs = h('div', { class: 'auth-tabs' });
      const signin = h('button', { class: mode === 'signin' ? 'active' : '' }, 'Sign in');
      const signup = h('button', { class: mode === 'signup' ? 'active' : '' }, 'Sign up');
      signin.onclick = () => { mode = 'signin'; render(); };
      signup.onclick = () => { mode = 'signup'; render(); };
      tabs.appendChild(signin);
      tabs.appendChild(signup);

      const email = h('input', { class: 'input', type: 'email', placeholder: 'you@example.com', autocomplete: 'email' });
      const password = h('input', { class: 'input', type: 'password', placeholder: '••••••••', autocomplete: 'current-password' });
      const nameInput = h('input', { class: 'input', type: 'text', placeholder: 'Your full name' });

      const form = h('div', { class: 'stack' });
      form.appendChild(tabs);
      if (mode === 'signup') form.appendChild(h('label', { class: 'field' }, h('span', null, 'Full name'), nameInput));
      form.appendChild(h('label', { class: 'field' }, h('span', null, 'Email'), email));
      form.appendChild(h('label', { class: 'field' }, h('span', null, 'Password'), password));

      const btn = h('button', { class: 'btn primary', style: { width: '100%', padding: '14px' } }, mode === 'signin' ? 'Sign in' : 'Create account');
      const googleBtn = h('button', { class: 'btn', style: { width: '100%' } }, h('i', { class: 'fa-brands fa-google', style: { marginRight: '8px' } }), 'Continue with Google');
      const status = h('div', { style: { fontSize: '13px', color: 'var(--text-dim)', textAlign: 'center', marginTop: '8px' } });

      btn.onclick = async () => {
        try {
          btn.disabled = true;
          btn.textContent = 'Working…';
          status.textContent = '';
          if (mode === 'signin') {
            const { error } = await T3D.auth.signInWithPassword({ email: email.value, password: password.value });
            if (error) throw error;
            T3D.toast('Signed in', 'success');
            T3D.sound.chime();
          } else {
            const { data, error } = await T3D.auth.signUp({ email: email.value, password: password.value });
            if (error) throw error;
            if (data && data.user) {
              await T3D.api.createMyPerson(nameInput.value || email.value.split('@')[0]).catch(() => {});
            }
            T3D.toast('Account created — check email if confirmation is on', 'success');
            T3D.sound.chime();
          }
          close();
          await T3D.bootstrap();
        } catch (e) {
          status.textContent = e.message || String(e);
          T3D.toast(e.message || 'Auth failed', 'error');
          T3D.sound.thud();
        } finally {
          btn.disabled = false;
          btn.textContent = mode === 'signin' ? 'Sign in' : 'Create account';
        }
      };

      googleBtn.onclick = async () => {
        try {
          const { error } = await T3D.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } });
          if (error) throw error;
        } catch (e) { T3D.toast(e.message, 'error'); }
      };

      form.appendChild(h('div', { style: { marginTop: '12px' } }, btn));
      form.appendChild(h('div', { style: { marginTop: '8px' } }, googleBtn));
      form.appendChild(status);
      body.appendChild(form);
      setTimeout(() => (mode === 'signin' ? email : nameInput).focus(), 60);
    }
    render();
  }

  // ---------- SCORE MODAL ----------
  function openScoreModal({ rateeId, onSaved }) {
    const st = T3D.state;
    if (!st.myPerson) {
      T3D.toast('Set up your person first (sign in)', 'error');
      return;
    }
    if (rateeId === st.myPerson.id) { T3D.toast('You can\'t rate yourself', 'info'); return; }
    const ratee = T3D.derive.personById(rateeId);
    if (!ratee) return;

    const { body, close } = openModal({
      title: 'Score ' + esc(ratee.full_name),
      wide: true,
      footer: (() => {
        const save = h('button', { class: 'btn primary' }, 'Save scores');
        save.onclick = async () => {
          save.disabled = true; save.textContent = 'Saving…';
          try {
            for (const t of st.traits) {
              const row = body.querySelector(`[data-trait="${t.id}"]`);
              if (!row) continue;
              const val = Number(row.querySelector('input[type=range]').value);
              const existing = T3D.derive.scoreFor(st.myPerson.id, rateeId, t.id);
              if (existing && Math.abs(Number(existing.score) - val) < 0.01) continue;
              await T3D.api.upsertScore({
                rater_person_id: st.myPerson.id,
                ratee_person_id: rateeId,
                trait_id: t.id,
                score: val
              });
            }
            T3D.toast('Scores saved', 'success');
            T3D.sound.chime();
            T3D.vibrate.long();
            close();
            if (onSaved) onSaved();
            await T3D.refreshData();
          } catch (e) {
            T3D.toast(e.message || 'Save failed', 'error');
          } finally {
            save.disabled = false; save.textContent = 'Save scores';
          }
        };
        const cancel = h('button', { class: 'btn ghost' }, 'Cancel');
        cancel.onclick = close;
        const wrap = h('div', { style: { display: 'flex', gap: '8px' } }, cancel, save);
        return wrap;
      })()
    });

    body.innerHTML = '';
    st.traits.forEach((t) => {
      const existing = T3D.derive.scoreFor(st.myPerson.id, rateeId, t.id);
      const init = existing ? Number(existing.score) : 50;
      const range = h('input', { type: 'range', min: '0', max: '100', value: String(init), step: '1' });
      const valBadge = h('div', { class: 'val-badge' }, String(init));
      range.addEventListener('input', () => { valBadge.textContent = range.value; });
      range.addEventListener('change', () => { T3D.sound.clink(0.05); T3D.vibrate.tick(); });
      const row = h('div', { class: 'score-row', dataset: { trait: t.id } },
        h('div', { class: 'row' },
          h('div', { class: 'icon' }, t.icon || '✨'),
          h('div', { class: 'name', style: { color: t.color || 'var(--text)' } }, t.name)
        ),
        range,
        valBadge
      );
      body.appendChild(row);
    });
  }

  // ---------- SETTINGS ----------
  function openSettings() {
    const { body } = openModal({ title: 'Settings' });
    body.innerHTML = '';
    const sound = h('input', { type: 'checkbox' });
    sound.checked = T3D.sound.enabled;
    sound.onchange = () => { const en = T3D.sound.toggle(); sound.checked = en; };
    const vib = h('input', { type: 'checkbox' });
    vib.checked = T3D.vibrate.enabled;
    vib.onchange = () => { const en = T3D.vibrate.toggle(); vib.checked = en; };

    const key = h('input', { class: 'input', type: 'password', placeholder: 'sk-or-v1-…', value: T3D.store.get('openrouter_key', '') });
    const model = h('input', { class: 'input', type: 'text', value: T3D.store.get('openrouter_model', T3D.CONFIG.DEFAULT_MODEL) });
    const save = h('button', { class: 'btn primary' }, 'Save key');
    save.onclick = () => {
      T3D.store.set('openrouter_key', key.value.trim());
      T3D.store.set('openrouter_model', model.value.trim() || T3D.CONFIG.DEFAULT_MODEL);
      T3D.toast('Saved', 'success');
      T3D.sound.clink(0.12);
    };

    body.appendChild(h('div', { class: 'stack' },
      h('div', { class: 'row between' }, h('div', null, h('b', null, 'Sound'), h('div', { class: 'muted', style: { fontSize: '12px' } }, 'Glass-click feedback')), sound),
      h('div', { class: 'row between' }, h('div', null, h('b', null, 'Haptics'), h('div', { class: 'muted', style: { fontSize: '12px' } }, 'Vibration on supported devices')), vib),
      h('hr', { style: { border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' } }),
      h('label', { class: 'field' }, h('span', null, 'OpenRouter API Key'), key),
      h('label', { class: 'field' }, h('span', null, 'Default model'), model),
      h('div', { style: { display: 'flex', gap: '8px', marginTop: '8px' } }, save),
      h('div', { class: 'muted', style: { fontSize: '12px', marginTop: '8px' } }, 'Key is stored only in your browser (localStorage). Get one at openrouter.ai/keys')
    ));
  }

  // ---------- AI ANALYZE ----------
  function openAIInsight(prompt) {
    T3D.store.set('ai_prefill', prompt);
    T3D.router.navigate('ai');
  }

  // ---------- CONFIRM ----------
  function confirmDialog(message) {
    return new Promise((resolve) => {
      const { body, close } = openModal({ title: 'Confirm' });
      body.innerHTML = `<p>${esc(message)}</p>`;
      const cancel = h('button', { class: 'btn ghost' }, 'Cancel');
      const ok = h('button', { class: 'btn danger' }, 'Confirm');
      cancel.onclick = () => { close(); resolve(false); };
      ok.onclick = () => { close(); resolve(true); };
      body.appendChild(h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '16px' } }, cancel, ok));
    });
  }

  T3D.modal = { openModal, openAuth, openScoreModal, openSettings, openAIInsight, confirmDialog };
})();
