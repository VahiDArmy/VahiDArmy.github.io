// =============================================================
// RaiseMind SPA bootstrap
// =============================================================
(function () {
  // Progress bar helpers
  const np = document.getElementById('nprogress');
  const bar = np?.querySelector('.bar');
  let progressTimer = null;

  function showProgress() {
    if (!np || !bar) return;
    np.classList.add('visible');
    bar.style.width = '30%';
    clearTimeout(progressTimer);
    progressTimer = setTimeout(() => { bar.style.width = '70%'; }, 180);
  }
  function hideProgress() {
    if (!np || !bar) return;
    bar.style.width = '100%';
    setTimeout(() => {
      np.classList.remove('visible');
      bar.style.width = '0%';
    }, 280);
  }

  Router.setHooks({
    before: async () => { showProgress(); },
    after: async () => { hideProgress(); },
  });

  // Register routes
  Router.register('/', Views.Work);
  Router.register('/work', Views.Work);
  Router.register('/browse', Views.Browse);
  Router.register('/browse/:surah/:ayah', Views.Browse);
  Router.register('/tags', Views.Tags);
  Router.register('/tags/:tag', Views.Tags);
  Router.register('/relations', Views.Relations);
  Router.register('/search', Views.Search);
  Router.register('/login', Views.Login);

  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await Auth.signOut();
      logoutBtn.hidden = true;
      Router.navigate('/login');
    });
  }

  // Show logout when authenticated
  Auth.getSession().then((s) => {
    if (logoutBtn) logoutBtn.hidden = !s;
  });

  // Intercept hash links
  Router.interceptLinks();

  // Start
  Router.init('#app');
})();
