// =============================================================
// RaiseMind SPA bootstrap — full feature parity
// =============================================================
(function () {
  const np = document.getElementById('nprogress');
  const bar = np?.querySelector('.bar');
  let progressTimer = null;

  function showProgress() {
    if (!np || !bar) return;
    np.classList.add('visible');
    bar.style.width = '28%';
    clearTimeout(progressTimer);
    progressTimer = setTimeout(() => { bar.style.width = '68%'; }, 160);
  }
  function hideProgress() {
    if (!np || !bar) return;
    bar.style.width = '100%';
    setTimeout(() => {
      np.classList.remove('visible');
      bar.style.width = '0%';
    }, 260);
  }

  const viewWork = document.getElementById('view-work');
  const viewApp  = document.getElementById('app');

  function showWorkView() {
    if (viewWork) viewWork.hidden = false;
    if (viewApp)  viewApp.hidden = true;
  }
  function showAppView() {
    if (viewWork) viewWork.hidden = true;
    if (viewApp)  viewApp.hidden = false;
  }

  Router.setHooks({
    before: async () => { showProgress(); },
    after:  async () => { hideProgress(); },
  });

  // Work route — reveal the pre-rendered original markup
  // (MizanPanel, AskAI, work-original.js already bound to the permanent DOM)
  async function WorkRoute() {
    showWorkView();
    // Optional deep-link: #/?surah=2&ayah=255
    try {
      const qs = location.hash.split('?')[1] || '';
      const p = new URLSearchParams(qs);
      const s = p.get('surah');
      const a = p.get('ayah');
      if (s && a) {
        const surahSel = document.getElementById('formSurahSelect');
        const ayahSel  = document.getElementById('formAyahSelect');
        if (surahSel && ayahSel) {
          surahSel.value = s;
          surahSel.dispatchEvent(new Event('change'));
          setTimeout(() => {
            ayahSel.value = a;
            ayahSel.dispatchEvent(new Event('change'));
          }, 140);
        }
      }
    } catch (e) {}
  }

  function wrap(viewFn) {
    return async (ctx) => {
      showAppView();
      await viewFn(ctx);
    };
  }

  Router.register('/', WorkRoute);
  Router.register('/work', WorkRoute);
  Router.register('/browse', wrap(window.Views.Browse));
  Router.register('/browse/:surah/:ayah', wrap(window.Views.Browse));
  Router.register('/tags', wrap(window.Views.Tags));
  Router.register('/tags/:tag', wrap(window.Views.Tags));
  Router.register('/relations', wrap(window.Views.Relations));
  Router.register('/search', wrap(window.Views.Search));
  Router.register('/login', wrap(window.Views.Login));

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await Auth.signOut();
      Router.navigate('/login');
    });
  }

  Auth.getSession().then((s) => {
    if (logoutBtn) logoutBtn.hidden = !s;
  });
  if (typeof sb !== 'undefined') {
    sb.auth.onAuthStateChange((_event, session) => {
      if (logoutBtn) logoutBtn.hidden = !session;
    });
  }

  Router.interceptLinks();
  Router.init('#app');
})();
