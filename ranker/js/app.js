(function () {
  const T3D = window.T3D;
  const { h, esc } = T3D.lib;
  const st = T3D.state;

  T3D.bootstrap = async function () {
    // Session
    const { data: { session } } = await T3D.auth.getSession();
    st.user = session ? session.user : null;

    // Theme
    document.documentElement.setAttribute('data-theme', st.theme);
    updateThemeIcon();

    // Sound icon
    updateSoundIcon();

    // Auth button state
    updateAuthButton();

    // Fetch data
    try {
      const [people, traits, scores] = await Promise.all([
        T3D.api.listPeople().catch(() => []),
        T3D.api.listTraits().catch(() => []),
        T3D.api.listScores().catch(() => [])
      ]);
      T3D.setState({ people: people || [], traits: traits || [], scores: scores || [], loaded: true });
      T3D.setStatus(`${people.length} people · ${traits.length} traits · ${scores.length} scores`);

      if (st.user) {
        try {
          const my = await T3D.api.myPerson();
          T3D.setState({ myPerson: my });
        } catch {}
        try { const bm = await T3D.api.listBookmarks(); T3D.setState({ bookmarks: bm }); } catch {}
      }
    } catch (e) {
      console.error(e);
      T3D.toast('Failed to load data — check schema', 'error');
      T3D.setState({ loaded: true });
    }

    // Real-time
    try {
      T3D.api.subscribeScores((payload) => {
        const all = st.scores.slice();
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const idx = all.findIndex(s => s.id === payload.new.id);
          if (idx >= 0) all[idx] = payload.new; else all.push(payload.new);
          T3D.sound.clink(0.05);
        } else if (payload.eventType === 'DELETE') {
          const idx = all.findIndex(s => s.id === payload.old.id);
          if (idx >= 0) all.splice(idx, 1);
        }
        T3D.setState({ scores: all });
        T3D.setStatus(`${st.people.length} people · ${st.traits.length} traits · ${all.length} scores`);
      });
      T3D.api.subscribeTraits(() => T3D.refreshData());
    } catch (e) { console.warn('realtime', e); }
  };

  T3D.refreshData = async function () {
    const [people, traits, scores] = await Promise.all([
      T3D.api.listPeople().catch(() => st.people),
      T3D.api.listTraits().catch(() => st.traits),
      T3D.api.listScores().catch(() => st.scores)
    ]);
    T3D.setState({ people, traits, scores });
    T3D.setStatus(`${people.length} people · ${traits.length} traits · ${scores.length} scores`);
  };

  function updateAuthButton() {
    const btn = document.getElementById('btn-auth');
    if (!btn) return;
    if (st.user) {
      btn.textContent = (st.user.email || 'Signed in').split('@')[0];
      btn.classList.add('signed');
      btn.onclick = async () => {
        if (!(await T3D.modal.confirmDialog('Sign out?'))) return;
        await T3D.auth.signOut();
        T3D.toast('Signed out', 'info');
        T3D.setState({ user: null, myPerson: null });
        updateAuthButton();
      };
    } else {
      btn.textContent = 'Sign in';
      btn.classList.remove('signed');
      btn.onclick = T3D.modal.openAuth;
    }
  }

  function updateThemeIcon() {
    const b = document.getElementById('btn-theme');
    if (!b) return;
    b.innerHTML = st.theme === 'dark'
      ? '<i class="fa-solid fa-sun"></i>'
      : '<i class="fa-solid fa-moon"></i>';
  }
  function updateSoundIcon() {
    const b = document.getElementById('btn-sound');
    if (!b) return;
    b.innerHTML = T3D.sound.enabled ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';
    b.classList.toggle('off', !T3D.sound.enabled);
  }

  // Auth listener
  T3D.auth.onAuthStateChange((event, session) => {
    st.user = session ? session.user : null;
    updateAuthButton();
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
      T3D.bootstrap().then(() => T3D.router.render());
    }
  });

  // Bind header buttons
  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.addEventListener('click', () => T3D.router.navigate(b.dataset.view));
    });

    document.getElementById('btn-theme').onclick = () => {
      const next = st.theme === 'dark' ? 'light' : 'dark';
      st.theme = next;
      document.documentElement.setAttribute('data-theme', next);
      T3D.store.set('theme', next);
      updateThemeIcon();
      T3D.sound.clink(0.08);
    };
    document.getElementById('btn-sound').onclick = () => { T3D.sound.toggle(); updateSoundIcon(); };
    document.getElementById('btn-settings').onclick = T3D.modal.openSettings;
    document.getElementById('btn-auth').onclick = T3D.modal.openAuth;

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      const map = { '1': 'person', '2': 'trait', '3': 'compare', '4': 'stats', '5': 'ai' };
      if (map[e.key]) T3D.router.navigate(map[e.key]);
    });
  });

  // Boot
  window.addEventListener('load', async () => {
    await T3D.bootstrap();
    T3D.router.render();
    const boot = document.getElementById('boot');
    const app = document.getElementById('app');
    setTimeout(() => {
      boot.classList.add('hidden');
      app.hidden = false;
      requestAnimationFrame(() => app.classList.add('ready'));
      T3D.sound.clink(0.1);
      setTimeout(() => boot.remove(), 700);
    }, 600);
  });
})();
