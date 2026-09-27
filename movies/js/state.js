/* =========================================================
   مدیریت وضعیت برنامه
   ========================================================= */
window.State = (function () {
  const listeners = new Map();
  const state = {
    titles: [],           // همه‌ی عنوان‌ها
    filtered: [],         // بعد از فیلتر
    category: 'all',
    search: '',
    filterType: 'all',
    sort: 'recent',
    onlyFav: false,
    onlyRated: false,
    view: 'grid',
    theme: 'dark',
    dirty: false,         // تغییرات محلی که push نشده
    loading: false,
    lastSyncAt: null
  };

  function get() { return state; }

  function set(patch) {
    Object.assign(state, patch);
    emit('change', state);
  }

  function on(event, cb) {
    (listeners.get(event) || listeners.set(event, []).get(event)).push(cb);
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

  /* ---- بارگذاری همه ---- */
  function loadAll() {
    state.titles = DB.getAllTitles();
    emit('titles:loaded', state.titles);
    return state.titles;
  }

  /* ---- اعمال فیلترها ---- */
  function applyFilters() {
    const q = Utils.normalizeFa(state.search);
    let list = state.titles.slice();

    if (state.category !== 'all') {
      list = list.filter(t => t.category === state.category);
    }
    if (state.filterType !== 'all') {
      list = list.filter(t => t.type === state.filterType);
    }
    if (state.onlyFav) list = list.filter(t => t.favorite);
    if (state.onlyRated) list = list.filter(t => t.rating > 0);

    if (q) {
      list = list.filter(t => {
        const hay = Utils.normalizeFa(
          `${t.title} ${t.genre || ''} ${t.notes || ''} ${t.year || ''}`
        );
        return q.split(' ').every(w => hay.includes(w));
      });
    }

    list = sortList(list, state.sort);
    state.filtered = list;
    emit('filtered', state.filtered);
    return list;
  }

  function sortList(list, mode) {
    const arr = [...list];
    switch (mode) {
      case 'oldest':   return arr.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
      case 'title-asc':return arr.sort((a,b) => a.title.localeCompare(b.title, 'fa'));
      case 'title-desc':return arr.sort((a,b) => b.title.localeCompare(a.title, 'fa'));
      case 'rating-desc': return arr.sort((a,b) => (b.rating || 0) - (a.rating || 0));
      case 'rating-asc': return arr.sort((a,b) => (a.rating || 0) - (b.rating || 0));
      case 'year-desc': return arr.sort((a,b) => (b.year || 0) - (a.year || 0));
      case 'recent':
      default: return arr.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    }
  }

  /* ---- CRUD wrappers ---- */
  function addTitle(data) {
    const id = DB.insertTitle(data, true);
    state.dirty = true;
    loadAll();
    applyFilters();
    emit('title:added', id);
    return id;
  }
  function editTitle(id, data) {
    DB.updateTitle(id, data, true);
    state.dirty = true;
    loadAll();
    applyFilters();
    emit('title:updated', id);
  }
  function removeTitle(id) {
    DB.deleteTitle(id, true);
    state.dirty = true;
    loadAll();
    applyFilters();
    emit('title:deleted', id);
  }
  function toggleFavorite(id) {
    const t = DB.getTitle(id);
    if (!t) return;
    DB.updateTitle(id, { ...t, favorite: !t.favorite }, true);
    state.dirty = true;
    loadAll();
    applyFilters();
    emit('title:updated', id);
  }

  /* ---- تنظیمات ظاهری ---- */
  function setTheme(t) {
    state.theme = t;
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem(CONFIG.STORAGE.THEME, t);
  }
  function setView(v) {
    state.view = v;
    localStorage.setItem(CONFIG.STORAGE.VIEW, v);
    emit('view:changed', v);
  }
  function setCategory(c) {
    state.category = c;
    localStorage.setItem(CONFIG.STORAGE.LAST_CATEGORY, c);
    emit('category:changed', c);
  }

  return {
    get, set, on, off, emit,
    loadAll, applyFilters, sortList,
    addTitle, editTitle, removeTitle, toggleFavorite,
    setTheme, setView, setCategory
  };
})();