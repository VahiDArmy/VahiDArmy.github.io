const CATEGORIES = ['love', 'good', 'hate'];
const CATEGORY_LABEL = { love: 'Love', good: 'Good', hate: 'Hate' };
const CATEGORY_VAR = { love: '--love', good: '--good', hate: '--hate' };
const CATEGORY_GLOW = { love: '--love-soft', good: '--good-soft', hate: '--hate-soft' };

let columnIndex = {};     // { love: 0, good: 1, hate: 2 }
let rawRows = [];         // preserves the CSV's own rows/columns, for the "All" table
let byCategory = { love: [], good: [], hate: [] };
let activeFilter = 'all';
let searchTerm = '';

// Excel-style column filters: values in each set are HIDDEN for that column
let filterSets = { love: new Set(), good: new Set(), hate: new Set() };
let openFilterCat = null;

function uniqueValues(cat) {
  return [...new Set(byCategory[cat])].sort((a, b) => a.localeCompare(b));
}

/* ---------------- logging ---------------- */

function log(message, level = 'info') {
  const body = document.getElementById('logBody');
  const time = new Date().toLocaleTimeString([], { hour12: false });
  const line = document.createElement('div');
  line.className = `log-line log-${level}`;
  line.innerHTML = `<span class="log-time">${time}</span>${escapeHTML(message)}`;
  body.appendChild(line);
  body.scrollTop = body.scrollHeight;
}

document.getElementById('logToggle').addEventListener('click', (ev) => {
  const btn = ev.currentTarget;
  const expanded = btn.getAttribute('aria-expanded') === 'true';
  btn.setAttribute('aria-expanded', String(!expanded));
});

/* ---------------- toasts ---------------- */

function toast(message, type = 'info', ttl = 4200) {
  const colorVar = { info: '--violet', success: '--good', error: '--hate', warn: '--amber' }[type] || '--violet';
  const glowVar = { info: '--violet', success: '--good-soft', error: '--hate-soft', warn: '--amber' }[type] || '--violet';
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.setProperty('--toast-color', `var(${colorVar})`);
  el.style.setProperty('--toast-glow', type === 'info' ? 'transparent' : `var(${glowVar})`);
  el.innerHTML = `<span>${escapeHTML(message)}</span><button class="toast-close" aria-label="Dismiss">&times;</button>`;

  const remove = () => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 220);
  };
  el.querySelector('.toast-close').addEventListener('click', remove);
  const timer = setTimeout(remove, ttl);
  el.addEventListener('mouseenter', () => clearTimeout(timer));

  document.getElementById('toasts').appendChild(el);
}

/* ---------------- CSV parsing (wide format: love,good,hate columns) ---------------- */

function splitCSVLine(row) {
  const cells = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      cells.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map(c => c.trim());
}

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim().length);
  if (!lines.length) throw new Error('the file is empty');

  const headerCells = splitCSVLine(lines[0]).map(h => h.toLowerCase());
  const colMap = {};
  headerCells.forEach((h, i) => {
    if (CATEGORIES.includes(h)) colMap[h] = i;
    else log(`Unrecognized column "${h}" (ignored)`, 'warn');
  });

  CATEGORIES.forEach(cat => {
    if (!(cat in colMap)) log(`Missing "${cat}" column — that list will stay empty`, 'warn');
  });

  const rows = lines.slice(1).map(line => splitCSVLine(line));
  const grouped = { love: [], good: [], hate: [] };
  rows.forEach(cells => {
    CATEGORIES.forEach(cat => {
      const idx = colMap[cat];
      if (idx === undefined) return;
      const val = (cells[idx] || '').trim();
      if (val) grouped[cat].push(val);
    });
  });

  return { colMap, rows, grouped };
}

/* ---------------- rendering ---------------- */

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function rowDelay(i) { return `${(i % 8) * 0.15}s`; }

function filterButton(cat) {
  const active = filterSets[cat].size > 0;
  return `<button type="button" class="filter-btn${active ? ' is-filtered' : ''}" data-cat="${cat}" aria-label="Filter ${CATEGORY_LABEL[cat]}">&#9662;</button>`;
}

function renderAllTable() {
  const term = searchTerm;
  const visibleRows = rawRows.filter(cells => {
    const passesFilters = CATEGORIES.every(cat => {
      const idx = columnIndex[cat];
      if (idx === undefined) return true;
      const val = (cells[idx] || '').trim();
      return !val || !filterSets[cat].has(val);
    });
    if (!passesFilters) return false;
    if (!term) return true;
    return CATEGORIES.some(cat => {
      const idx = columnIndex[cat];
      if (idx === undefined) return false;
      return (cells[idx] || '').toLowerCase().includes(term);
    });
  });

  if (!visibleRows.length) return '';

  const head = CATEGORIES.map(cat =>
    `<th class="col-${cat}"><span class="th-label">${CATEGORY_LABEL[cat]}</span>${filterButton(cat)}</th>`
  ).join('');

  const body = visibleRows.map((cells, i) => {
    const tds = CATEGORIES.map(cat => {
      const idx = columnIndex[cat];
      const val = idx !== undefined ? (cells[idx] || '').trim() : '';
      return val
        ? `<td class="col-${cat}">${escapeHTML(val)}</td>`
        : `<td class="col-${cat} cell-empty">&mdash;</td>`;
    }).join('');
    return `<tr style="--row-delay:${rowDelay(i)}">${tds}</tr>`;
  }).join('');

  return `<table class="table-all"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderCategoryTable(cat) {
  const term = searchTerm;
  const items = byCategory[cat].filter(title => {
    if (filterSets[cat].has(title)) return false;
    return !term || title.toLowerCase().includes(term);
  });
  if (!items.length) return '';

  const colorVar = `var(${CATEGORY_VAR[cat]})`;
  const glowVar = `var(${CATEGORY_GLOW[cat]})`;
  const rows = items.map((title, i) => `
    <tr style="--row-color:${colorVar}; --row-glow:${glowVar}; --row-delay:${rowDelay(i)}">
      <td class="row-index">${i + 1}</td>
      <td class="row-title">${escapeHTML(title)}</td>
    </tr>`).join('');

  return `<table class="table-single"><thead><tr><th>#</th><th><span class="th-label">${CATEGORY_LABEL[cat]}</span>${filterButton(cat)}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function render() {
  const wrap = document.getElementById('tableWrap');
  const empty = document.getElementById('empty');

  const html = activeFilter === 'all' ? renderAllTable() : renderCategoryTable(activeFilter);

  wrap.innerHTML = html;
  wrap.hidden = !html;
  empty.hidden = !!html;
}

function updateCounts() {
  const counts = {
    all: CATEGORIES.reduce((sum, c) => sum + byCategory[c].length, 0),
    love: byCategory.love.length,
    good: byCategory.good.length,
    hate: byCategory.hate.length,
  };
  Object.keys(counts).forEach(key => {
    const el = document.getElementById(`count-${key}`);
    if (el) el.textContent = counts[key];
  });
}

/* ---------------- data intake ---------------- */

function applyParsed(parsed, sourceLabel) {
  columnIndex = parsed.colMap;
  rawRows = parsed.rows;
  byCategory = parsed.grouped;
  filterSets = { love: new Set(), good: new Set(), hate: new Set() };
  closeFilterPopover();

  const total = CATEGORIES.reduce((sum, c) => sum + byCategory[c].length, 0);
  log(`Parsed ${rawRows.length} row(s) from ${sourceLabel}`, 'info');
  log(`Love: ${byCategory.love.length}  Good: ${byCategory.good.length}  Hate: ${byCategory.hate.length}`, 'info');

  if (total === 0) {
    log('No recognizable titles found — check the column headers', 'error');
    toast('No titles found. Check that your headers are love, good, hate.', 'error');
  } else {
    log('Ready.', 'success');
    toast(`Loaded ${total} title${total === 1 ? '' : 's'} from ${sourceLabel}`, 'success');
  }

  updateCounts();
  render();
}

/* ---------------- column filter popover ---------------- */

function closeFilterPopover() {
  const pop = document.getElementById('filterPopover');
  pop.hidden = true;
  openFilterCat = null;
}

function positionFilterPopover(btn, pop) {
  const r = btn.getBoundingClientRect();
  pop.style.top = `${Math.min(r.bottom + 6, window.innerHeight - 280)}px`;
  pop.style.left = `${Math.min(r.left, window.innerWidth - 246)}px`;
}

function renderFilterList(cat) {
  const list = document.getElementById('filterList');
  const values = uniqueValues(cat);
  list.innerHTML = values.map(v => {
    const checked = filterSets[cat].has(v) ? '' : 'checked';
    return `<label class="filter-row"><input type="checkbox" value="${escapeHTML(v)}" ${checked}> ${escapeHTML(v)}</label>`;
  }).join('');
  document.getElementById('filterSelectAll').checked = filterSets[cat].size === 0;
}

function openFilterPopover(cat, btn) {
  openFilterCat = cat;
  const pop = document.getElementById('filterPopover');
  document.getElementById('filterSearchInput').value = '';
  renderFilterList(cat);
  pop.hidden = false;
  positionFilterPopover(btn, pop);
}

function wireFilterPopover() {
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.filter-btn');
    const pop = document.getElementById('filterPopover');
    if (btn) {
      ev.stopPropagation();
      const cat = btn.dataset.cat;
      if (openFilterCat === cat && !pop.hidden) { closeFilterPopover(); return; }
      openFilterPopover(cat, btn);
      return;
    }
    if (!pop.hidden && !pop.contains(ev.target)) closeFilterPopover();
  });

  document.getElementById('filterPopover').addEventListener('click', (ev) => ev.stopPropagation());

  document.getElementById('filterList').addEventListener('change', (ev) => {
    const cb = ev.target.closest('input[type="checkbox"]');
    if (!cb || !openFilterCat) return;
    if (cb.checked) filterSets[openFilterCat].delete(cb.value);
    else filterSets[openFilterCat].add(cb.value);
    document.getElementById('filterSelectAll').checked = filterSets[openFilterCat].size === 0;
    render();
  });

  document.getElementById('filterSelectAll').addEventListener('change', (ev) => {
    if (!openFilterCat) return;
    if (ev.target.checked) filterSets[openFilterCat].clear();
    else uniqueValues(openFilterCat).forEach(v => filterSets[openFilterCat].add(v));
    renderFilterList(openFilterCat);
    render();
  });

  document.getElementById('filterClear').addEventListener('click', () => {
    if (!openFilterCat) return;
    filterSets[openFilterCat].clear();
    log(`Cleared filter on "${openFilterCat}"`, 'info');
    renderFilterList(openFilterCat);
    render();
  });

  document.getElementById('filterSearchInput').addEventListener('input', (ev) => {
    const q = ev.target.value.toLowerCase();
    document.querySelectorAll('#filterList .filter-row').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeFilterPopover(); });
  window.addEventListener('resize', closeFilterPopover);
  window.addEventListener('scroll', closeFilterPopover, true);
}

function wireControls() {
  document.getElementById('pills').addEventListener('click', (ev) => {
    const btn = ev.target.closest('.pill');
    if (!btn) return;
    document.querySelectorAll('.pill').forEach(p => {
      p.classList.remove('is-active');
      p.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('is-active');
    btn.setAttribute('aria-selected', 'true');
    activeFilter = btn.dataset.filter;
    log(`Switched to "${activeFilter}" view`, 'info');
    closeFilterPopover();
    render();
  });

  document.getElementById('search').addEventListener('input', (ev) => {
    searchTerm = ev.target.value.trim().toLowerCase();
    render();
  });

  document.getElementById('fileInput').addEventListener('change', (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    log(`Reading "${file.name}" from disk (${file.size} bytes)...`, 'info');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCSV(reader.result);
        document.getElementById('loadFallback').hidden = true;
        applyParsed(parsed, `"${file.name}"`);
      } catch (err) {
        log(`Couldn't parse the file: ${err.message}`, 'error');
        toast("Couldn't read that file. Check its formatting.", 'error');
      }
    };
    reader.onerror = () => {
      log('File read failed.', 'error');
      toast('File read failed.', 'error');
    };
    reader.readAsText(file);
  });
}

async function loadData() {
  log('Reading movies.csv...', 'info');
  try {
    const res = await fetch('movies.csv');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    log(`Fetch OK (${text.length} bytes)`, 'info');
    const parsed = parseCSV(text);
    applyParsed(parsed, 'movies.csv');
  } catch (err) {
    log(`Fetch failed: ${err.message} (likely opened via file://)`, 'error');
    log('Waiting for manual file selection...', 'warn');
    toast("Couldn't load movies.csv automatically", 'error');
    document.getElementById('loadFallback').hidden = false;
  }
}

function wireSpotlight() {
  const root = document.documentElement;
  let raf = null;
  const move = (x, y) => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      root.style.setProperty('--mx', `${x}px`);
      root.style.setProperty('--my', `${y}px`);
      raf = null;
    });
  };
  window.addEventListener('pointermove', (ev) => move(ev.clientX, ev.clientY));
  window.addEventListener('touchmove', (ev) => {
    const t = ev.touches[0];
    if (t) move(t.clientX, t.clientY);
  }, { passive: true });
}

wireControls();
wireFilterPopover();
wireSpotlight();
loadData();
