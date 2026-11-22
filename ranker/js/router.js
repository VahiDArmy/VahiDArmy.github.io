(function () {
  const T3D = window.T3D;
  const views = {};
  let current = null;

  function register(name, mountFn) { views[name] = mountFn; }

  function navigate(name, params) {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    location.hash = '#/' + name + q;
  }

  function parseHash() {
    const hash = location.hash.replace(/^#\/?/, '');
    const [path, query] = hash.split('?');
    const name = path || 'person';
    const params = Object.fromEntries(new URLSearchParams(query || ''));
    return { name, params };
  }

  async function render() {
    const { name, params } = parseHash();
    const view = views[name] || views.person;
    T3D.setState({ route: name });
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    const main = document.getElementById('main');
    main.innerHTML = '';
    current = name;
    T3D.vibrate.tick();
    T3D.sound.thud(0.05);
    try {
      await view(main, params);
    } catch (e) {
      console.error(e);
      main.innerHTML = `<div class="empty"><i class="fa-solid fa-triangle-exclamation"></i><div>Failed to render view</div><div class="muted">${T3D.lib.esc(e.message || e)}</div></div>`;
    }
  }

  window.addEventListener('hashchange', render);
  window.addEventListener('load', () => { if (!location.hash) location.hash = '#/person'; });

  T3D.router = { register, navigate, render };
})();
