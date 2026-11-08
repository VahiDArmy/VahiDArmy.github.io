// AURORA OS — Data Grid

import { h, $, $$, clear, fmtNum, fmtDate, debounce } from '../core/dom.js';
import { store } from '../core/store.js';
import { TRANSACTIONS } from '../data/seed.js';
import { input, select, badge, button, emptyState, table } from '../ui/components.js';
import toast from '../ui/toasts.js';

export const meta = {
  id: 'datagrid',
  title: 'Data Grid',
  icon: '▦',
  defaultSize: { width: 900, height: 600 },
};

const COLUMNS = [
  { key: 'id', label: 'ID', width: 90 },
  { key: 'date', label: 'Date', width: 130, render: (r) => fmtDate(r.date) },
  { key: 'service', label: 'Service', width: 140 },
  { key: 'amount', label: 'Amount', width: 120, align: 'right', render: (r) => '$' + r.amount.toFixed(2) },
  { key: 'status', label: 'Status', width: 110, render: (r) => {
      const v = r.status === 'paid' ? 'success' : r.status === 'pending' ? 'warning' : 'danger';
      return badge(r.status, v);
    } },
  { key: 'region', label: 'Region', width: 120 },
];

const PAGE_SIZE = 15;

let _state = {
  query: '',
  sortKey: 'date',
  sortDir: 'desc',
  statusFilter: 'all',
  page: 0,
  selection: new Set(),
};

function filteredRows() {
  let rows = [...TRANSACTIONS];
  if (_state.query) {
    const q = _state.query.toLowerCase();
    rows = rows.filter((r) =>
      r.id.toLowerCase().includes(q) ||
      r.service.toLowerCase().includes(q) ||
      r.region.toLowerCase().includes(q)
    );
  }
  if (_state.statusFilter !== 'all') {
    rows = rows.filter((r) => r.status === _state.statusFilter);
  }
  const k = _state.sortKey;
  const dir = _state.sortDir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    const va = a[k];
    const vb = b[k];
    if (va === vb) return 0;
    return va < vb ? -1 * dir : 1 * dir;
  });
  return rows;
}

function rowView(row) {
  const tr = h('tr', { dataset: { rowId: row.id } });
  if (_state.selection.has(row.id)) tr.classList.add('is-selected');

  const checkTd = h('td', { style: { width: '32px' } });
  const cb = h('input', { type: 'checkbox', class: 'grid-check' });
  cb.checked = _state.selection.has(row.id);
  cb.addEventListener('change', (e) => {
    if (e.target.checked) _state.selection.add(row.id);
    else _state.selection.delete(row.id);
    updateBulkBar();
  });
  checkTd.append(cb);
  tr.append(checkTd);

  for (const c of COLUMNS) {
    const td = h('td', { style: c.align ? 'text-align:' + c.align : '' });
    const v = c.render ? c.render(row) : row[c.key];
    if (v?.nodeType) td.append(v);
    else td.textContent = v == null ? '' : v;
    tr.append(td);
  }
  return tr;
}

let _gridBody, _bulkBar, _pager, _gridRoot;

function updateBulkBar() {
  if (!_bulkBar) return;
  clear(_bulkBar);
  if (_state.selection.size === 0) {
    _bulkBar.hidden = true;
    return;
  }
  _bulkBar.hidden = false;
  _bulkBar.append(h('span', { class: 'bulk-count', text: _state.selection.size + ' selected' }));
  _bulkBar.append(h('div', { style: { flex: '1' } }));
  _bulkBar.append(button('Export', { variant: 'secondary', size: 'sm', onClick: exportSelection }));
  _bulkBar.append(button('Delete', { variant: 'danger', size: 'sm', onClick: deleteSelection }));
  _bulkBar.append(button('Clear', { variant: 'ghost', size: 'sm', onClick: () => { _state.selection.clear(); render(); } }));
}

function exportSelection() {
  const rows = filteredRows().filter((r) => _state.selection.has(r.id));
  const csv = ['id,date,service,amount,status,region'];
  for (const r of rows) {
    csv.push([r.id, new Date(r.date).toISOString(), r.service, r.amount, r.status, r.region].join(','));
  }
  const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: 'transactions.csv' });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast.success('Exported ' + rows.length + ' rows');
}

function deleteSelection() {
  const before = TRANSACTIONS.length;
  for (let i = TRANSACTIONS.length - 1; i >= 0; i--) {
    if (_state.selection.has(TRANSACTIONS[i].id)) TRANSACTIONS.splice(i, 1);
  }
  const removed = before - TRANSACTIONS.length;
  _state.selection.clear();
  render();
  toast.info('Removed ' + removed + ' rows');
}

function renderPager(total, pages) {
  clear(_pager);
  const prev = button('‹', { variant: 'secondary', size: 'sm', onClick: () => { if (_state.page > 0) { _state.page--; render(); } } });
  prev.disabled = _state.page === 0;
  const next = button('›', { variant: 'secondary', size: 'sm', onClick: () => { if (_state.page < pages - 1) { _state.page++; render(); } } });
  next.disabled = _state.page >= pages - 1;
  _pager.append(prev);
  _pager.append(h('span', { class: 'pager-info', text: 'Page ' + (_state.page + 1) + ' of ' + pages + ' · ' + total + ' rows' }));
  _pager.append(next);
}

function render() {
  if (!_gridRoot) return;
  const rows = filteredRows();
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  if (_state.page >= pages) _state.page = pages - 1;
  const pageRows = rows.slice(_state.page * PAGE_SIZE, (_state.page + 1) * PAGE_SIZE);

  clear(_gridBody);
  const thead = h('thead');
  const headRow = h('tr');
  headRow.append(h('th', { style: { width: '32px' } }));
  for (const c of COLUMNS) {
    const th = h('th', { style: c.align ? 'text-align:' + c.align : '' });
    const isSorted = _state.sortKey === c.key;
    const lbl = h('span', { text: c.label });
    if (isSorted) lbl.append(h('span', { text: _state.sortDir === 'asc' ? ' ↑' : ' ↓', style: { color: 'var(--accent)' } }));
    th.append(lbl);
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      if (_state.sortKey === c.key) _state.sortDir = _state.sortDir === 'asc' ? 'desc' : 'asc';
      else { _state.sortKey = c.key; _state.sortDir = 'asc'; }
      render();
    });
    headRow.append(th);
  }
  thead.append(headRow);
  _gridBody.append(thead);

  const tbody = h('tbody');
  for (const r of pageRows) tbody.append(rowView(r));
  if (!pageRows.length) {
    const tr = h('tr');
    const td = h('td', { colspan: String(COLUMNS.length + 1) });
    td.append(emptyState({ icon: '◌', title: 'No rows match', text: 'Try adjusting filters' }));
    tr.append(td);
    tbody.append(tr);
  }
  _gridBody.append(tbody);
  renderPager(rows.length, pages);
  updateBulkBar();
}

export function mount(container) {
  clear(container);
  _gridRoot = h('div', { class: 'grid-wrap' });

  const toolbar = h('div', { class: 'grid-toolbar' });
  const search = input({ placeholder: 'Search transactions…', onInput: debounce((e) => { _state.query = e.target.value; _state.page = 0; render(); }, 200) });
  toolbar.append(search);
  const statusSel = select([
    { value: 'all', label: 'All statuses' },
    { value: 'paid', label: 'Paid' },
    { value: 'pending', label: 'Pending' },
    { value: 'failed', label: 'Failed' },
  ], { value: _state.statusFilter, onChange: (e) => { _state.statusFilter = e.target.value; _state.page = 0; render(); } });
  toolbar.append(statusSel);
  _gridRoot.append(toolbar);

  _bulkBar = h('div', { class: 'bulk-bar', hidden: true });
  _gridRoot.append(_bulkBar);

  _gridBody = h('table', { class: 'table grid-table' });
  _gridRoot.append(h('div', { class: 'grid-scroll' }, [_gridBody]));

  _pager = h('div', { class: 'grid-pager' });
  _gridRoot.append(_pager);

  container.append(_gridRoot);
  render();
}

export function renderer() { return document.createElement('div'); }

export default { meta, mount };
