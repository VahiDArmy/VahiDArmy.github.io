/* =========================================================
   صفحهٔ فیلم و سریال — راه‌اندازی
   ========================================================= */
(function () {
  Boot.start(async function () {
    const savedView = localStorage.getItem(CONFIG.STORAGE.VIEW) || CONFIG.DEFAULTS.VIEW;
    const savedStar = localStorage.getItem(CONFIG.STORAGE.STAR_FILTER) || CONFIG.DEFAULTS.STAR_FILTER;

    State.set({ view: savedView, starFilter: savedStar });
    State.loadAll();
    State.applyFilters();

    Render.renderSidebarCounts();
    Render.renderPageTitle();

    document.querySelectorAll('.view-btn').forEach(function (b) { b.classList.toggle('is-active', b.dataset.view === savedView); });
    const grid = document.getElementById('grid');
    if (grid) grid.classList.toggle('is-list', savedView === 'list');
    document.querySelectorAll('#star-list .side-item').forEach(function (b) { b.classList.toggle('is-active', b.dataset.star === String(savedStar)); });

    const s = State.get();
    const typeSel = document.getElementById('filter-type');
    const sortSel = document.getElementById('filter-sort');
    if (typeSel) typeSel.value = s.filterType;
    if (sortSel) sortSel.value = s.sort;

    Events.bind();
    Events.renderList();
    document.getElementById('app-version').textContent = Utils.toFa(CONFIG.APP_VERSION);
    setTimeout(Events.openFromUrl, 400);
  });
})();
