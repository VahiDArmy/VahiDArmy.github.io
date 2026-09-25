const CATEGORY_LABEL = { love: 'Love', good: 'Good', hate: 'Hate' };
const CATEGORY_VAR = { love: '--love', good: '--good', hate: '--hate' };
const CATEGORY_GLOW = { love: '--love-soft', good: '--good-soft', hate: '--hate-soft' };

let entries = [];
let activeFilter = 'all';
let searchTerm = '';

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim().length);
  if (!lines.length) return [];

  const splitRow = (row) => {
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
  };

  const headers = splitRow(lines[0]).map(h => h.toLowerCase());
  return lines.slice(1).map(line => {
    const cells = splitRow(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = cells[i] || ''; });
    row.category = (row.category || '').toLowerCase();
    return row;
  }).filter(row => row.title && CATEGORY_LABEL[row.category]);
}

function render() {
  const grid = document.getElementById('grid');
  const empty = document.getElementById('empty');

  const filtered = entries.filter(e => {
    const matchesFilter = activeFilter === 'all' || e.category === activeFilter;
    const matchesSearch = !searchTerm || e.title.toLowerCase().includes(searchTerm);
    return matchesFilter && matchesSearch;
  });

  grid.innerHTML = filtered.map((e, i) => {
    const colorVar = `var(${CATEGORY_VAR[e.category]})`;
    const glowVar = `var(${CATEGORY_GLOW[e.category]})`;
    const meta = [e.type, e.year].filter(Boolean);
    return `
      <article class="card" style="--card-color:${colorVar}; --card-glow:${glowVar}; animation-delay:${Math.min(i * 30, 300)}ms">
        <div class="card-top">
          <h3 class="card-title">${escapeHTML(e.title)}</h3>
          <span class="badge">${escapeHTML(CATEGORY_LABEL[e.category])}</span>
        </div>
        ${meta.length ? `<div class="card-meta">${meta.map(escapeHTML).join(' &middot; ')}</div>` : ''}
        ${e.note ? `<p class="card-note">${escapeHTML(e.note)}</p>` : ''}
      </article>`;
  }).join('');

  empty.hidden = filtered.length !== 0;
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function updateCounts() {
  const counts = { all: entries.length, love: 0, good: 0, hate: 0 };
  entries.forEach(e => { if (counts[e.category] !== undefined) counts[e.category]++; });
  Object.keys(counts).forEach(key => {
    const el = document.getElementById(`count-${key}`);
    if (el) el.textContent = counts[key];
  });
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
    render();
  });

  document.getElementById('search').addEventListener('input', (ev) => {
    searchTerm = ev.target.value.trim().toLowerCase();
    render();
  });

  document.getElementById('fileInput').addEventListener('change', (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      entries = parseCSV(reader.result);
      document.getElementById('loadFallback').hidden = true;
      updateCounts();
      render();
    };
    reader.readAsText(file);
  });
}

async function loadData() {
  try {
    const res = await fetch('movies.csv');
    if (!res.ok) throw new Error('not found');
    const text = await res.text();
    entries = parseCSV(text);
    updateCounts();
    render();
  } catch (err) {
    document.getElementById('loadFallback').hidden = false;
  }
}

wireControls();
loadData();
