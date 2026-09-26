const CATEGORIES = ['love', 'good', 'hate'];
const CATEGORY_LABEL = { love: 'Love', good: 'Good', hate: 'Hate' };
const CATEGORY_VAR = { love: '--love', good: '--good', hate: '--hate' };
const CATEGORY_GLOW = { love: '--love-soft', good: '--good-soft', hate: '--hate-soft' };

let columnIndex = {};     // { love: 0, good: 1, hate: 2 }
let rawRows = [];         // preserves the CSV's own rows/columns, for the "All" table
let byCategory = { love: [], good: [], hate: [] };
let activeFilter = 'all';
let searchTerm = '';

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

function renderAllTable() {
  const term = searchTerm;
  const visibleRows = rawRows.filter(cells => {
    if (!term) return true;
    return CATEGORIES.some(cat => {
      const idx = columnIndex[cat];
      if (idx === undefined) return false;
      return (cells[idx] || '').toLowerCase().includes(term);
    });
  });

  if (!visibleRows.length) return '';

  const head = CATEGORIES.map(cat => `<th class="col-${cat}">${CATEGORY_LABEL[cat]}</th>`).join('');
  const body = visibleRows.map(cells => {
    const tds = CATEGORIES.map(cat => {
      const idx = columnIndex[cat];
      const val = idx !== undefined ? (cells[idx] || '').trim() : '';
      return val
        ? `<td class="col-${cat}">${escapeHTML(val)}</td>`
        : `<td class="col-${cat} cell-empty">&mdash;</td>`;
    }).join('');
    return `<tr>${tds}</tr>`;
  }).join('');

  return `<table class="table-all"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderCategoryTable(cat) {
  const term = searchTerm;
  const items = byCategory[cat].filter(title => !term || title.toLowerCase().includes(term));
  if (!items.length) return '';

  const colorVar = `var(${CATEGORY_VAR[cat]})`;
  const glowVar = `var(${CATEGORY_GLOW[cat]})`;
  const rows = items.map((title, i) => `
    <tr style="--row-color:${colorVar}; --row-glow:${glowVar}">
      <td class="row-index">${i + 1}</td>
      <td class="row-title">${escapeHTML(title)}</td>
    </tr>`).join('');

  return `<table class="table-single"><thead><tr><th>#</th><th>${CATEGORY_LABEL[cat]}</th></tr></thead><tbody>${rows}</tbody></table>`;
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

wireControls();
loadData();
