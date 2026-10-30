/* =========================================================
   مدیریت وضعیت برنامه
   ========================================================= */
window.State = (function () {
  const listeners = new Map();
  const state = {
    titles: [],
    filtered: [],
    categoryFilter: 'all', // all | love | good | hate
    starFilter: 'all',
    search: '',
    sort: 'recent',
    view: 'grid',
    theme: localStorage.getItem('cinema_theme') || 'dark',
    loading: false,
    editingId: null
  };

  function get() { return state; }

  function set(patch) {
    Object.assign(state, patch);
    emit('change', state);
  }

  function on(event, cb) {
    let arr = listeners.get(event);
    if (!arr) { arr = []; listeners.set(event, arr); }
    arr.push(cb);
    return () => off(event, cb);
  }

  function off(event, cb) {
    const arr = listeners.get(event) || [];
    const i = arr.indexOf(cb);
    if (i > -1) arr.splice(i, 1);
  }

  function emit(event, payload) {
    (listeners.get(event) || []).forEach(cb => {
      try { cb(payload); } catch (e) { console.error(e); }
    });
  }

  async function loadTitles() {
    set({ loading: true });
    try {
      const titles = await DB.getAllTitles();
      set({ titles, loading: false });
      applyFilters();
      emit('titles:loaded', titles);
      return titles;
    } catch (e) {
      set({ loading: false });
      Utils.toast('خطا در بارگذاری: ' + e.message, 'error');
      throw e;
    }
  }

  function applyFilters() {
    let list = state.titles.slice();

    // Category
    if (state.categoryFilter !== 'all') {
      list = list.filter(t => t.category === state.categoryFilter);
    }

    // Star / rating
    if (state.starFilter !== 'all') {
      const star = Number(state.starFilter);
      if (star === 0) {
        list = list.filter(t => !t.rating || t.rating === 0);
      } else {
        list = list.filter(t => Math.round(t.rating) === star);
      }
    }

    // Search
    if (state.search.trim()) {
      const q = state.search.trim().toLowerCase();
      list = list.filter(t =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.original_title || '').toLowerCase().includes(q) ||
        (t.genre || '').toLowerCase().includes(q) ||
        (t.notes || '').toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      if (state.sort === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (state.sort === 'title') return (a.title || '').localeCompare(b.title || '', 'fa');
      if (state.sort === 'year') return (b.year || 0) - (a.year || 0);
      // recent
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

    set({ filtered: list });
    emit('filtered', list);
    return list;
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('cinema_theme', theme);
    set({ theme });
  }

  // Init theme
  document.documentElement.dataset.theme = state.theme;

  return {
    get, set, on, off, emit,
    loadTitles, applyFilters, setTheme
  };
})();
