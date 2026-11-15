/* =========================================================
   مدیریت وضعیت برنامه
   ========================================================= */
window.State = (function () {
  const listeners = new Map();
  const state = {
    titles: [],
    filtered: [],
    starFilter: 'all',    /* all | 5 | 4 | 3 | 2 | 1 | 0 */
    search: '',
    filterType: 'all',
    sort: 'recent',
    onlyFav: false,
    onlyRated: false,
    view: 'grid',
    theme: 'dark',
    dirty: false,
    loading: false,
    lastSyncAt: null
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
    return function () { off(event, cb); };
  }
  function off(event, cb) {
    const arr = listeners.get(event) || [];
    const i = arr.indexOf(cb);
    if (i > -1) arr.splice(i, 1);
  }
  function emit(event, payload) {
    (listeners.get(event) || []).forEach(function (cb) {
      try { cb(payload); } catch (e) { console.error(e); }
    });
  }

  function loadAll() {
    state.titles = DB.getAllTitles();
    emit('titles:loaded', state.titles);
    return state.titles;
  }

  function applyFilters() {
    const q = Utils.normalizeFa(state.search);
    let list = state.titles.slice();

    /* فیلتر ستاره */
    if (state.starFilter !== 'all') {
      const s = Number(state.starFilter);
      if (s === 0) {
        /* بدون امتیاز */
        list = list.filter(function (t) { return !t.rating || t.rating === 0; });
      } else {
        list = list.filter(function (t) {
          /* اگر rating 4.5 بود، در گروه 4 می‌آید (round down) */
          return Math.floor(Number(t.rating) || 0) === s;
        });
      }
    }

    if (state.filterType !== 'all') list = list.filter(function (t) { return t.type === state.filterType; });
    if (state.onlyFav) list = list.filter(function (t) { return t.favorite; });
    if (state.onlyRated) list = list.filter(function (t) { return t.rating > 0; });

    if (q) {
      list = list.filter(function (t) {
        const hay = Utils.normalizeFa(
          t.title + ' ' + (t.genre || '') + ' ' + (t.notes || '') + ' ' + (t.year || '')
        );
        return q.split(' ').every(function (w) { return hay.indexOf(w) > -1; });
      });
    }

    list = sortList(list, state.sort);
    state.filtered = list;
    emit('filtered', state.filtered);
    return list;
  }

  function sortList(list, mode) {
    const arr = list.slice();
    switch (mode) {
      case 'oldest':    return arr.sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
      case 'title-asc': return arr.sort(function (a, b) { return a.title.localeCompare(b.title, 'fa'); });
      case 'title-desc':return arr.sort(function (a, b) { return b.title.localeCompare(a.title, 'fa'); });
      case 'rating-desc': return arr.sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); });
      case 'rating-asc':  return arr.sort(function (a, b) { return (a.rating || 0) - (b.rating || 0); });
      case 'year-desc': return arr.sort(function (a, b) { return (b.year || 0) - (a.year || 0); });
      case 'recent':
      default: return arr.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    }
  }

  function addTitle(data) {
    const id = DB.insertTitle(data, true);
    state.dirty = true;
    loadAll(); applyFilters();
    emit('title:added', id);
    return id;
  }
  function editTitle(id, data) {
    DB.updateTitle(id, data, true);
    state.dirty = true;
    loadAll(); applyFilters();
    emit('title:updated', id);
  }
  function removeTitle(id) {
    const row = DB.deleteTitle(id, true);
    state.dirty = true;
    loadAll(); applyFilters();
    emit('title:deleted', id);
    return row;
  }
  function restoreTitle(row) {
    const newId = DB.restoreTitle(row);
    state.dirty = true;
    loadAll(); applyFilters();
    emit('title:restored', newId);
    return newId;
  }
  function toggleFavorite(id) {
    const t = DB.getTitle(id);
    if (!t) return;
    DB.updateTitle(id, Object.assign({}, t, { favorite: !t.favorite }), true);
    state.dirty = true;
    loadAll(); applyFilters();
    emit('title:updated', id);
  }
  function setRating(id, stars) {
    const t = DB.getTitle(id);
    if (!t) return;
    const num = Math.max(0, Math.min(5, Number(stars) || 0));
    DB.updateTitle(id, Object.assign({}, t, { rating: num }), true);
    state.dirty = true;
    loadAll(); applyFilters();
    emit('title:updated', id);
  }

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
  function setStarFilter(f) {
    state.starFilter = f;
    localStorage.setItem(CONFIG.STORAGE.LAST_STAR_FILTER, String(f));
    emit('starFilter:changed', f);
  }

  return {
    get: get, set: set, on: on, off: off, emit: emit,
    loadAll: loadAll, applyFilters: applyFilters, sortList: sortList,
    addTitle: addTitle, editTitle: editTitle, removeTitle: removeTitle,
    restoreTitle: restoreTitle, toggleFavorite: toggleFavorite, setRating: setRating,
    setTheme: setTheme, setView: setView, setStarFilter: setStarFilter
  };
})();