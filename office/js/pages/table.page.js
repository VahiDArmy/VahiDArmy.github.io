/**
 * Dynamic table detail page — complete permissions logic
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { appStore } from '../core/store.js';
import { ROUTES, COLUMN_TYPES } from '../config/constants.js';
import { tablesService } from '../services/tables.service.js';
import { peopleService } from '../services/people.service.js';
import { emptyState } from '../components/empty-state.js';
import { createTableGrid } from '../components/table-grid.js';
import { openColumnEditor } from '../components/column-editor.js';
import { openRowEditor } from '../components/row-editor.js';
import { openBulkPeopleForm } from '../components/table-bulk-people.js';
import { openBulkEditColumns } from '../components/bulk-edit-columns.js';
import { confirmAndDelete } from '../components/confirm-delete.js';
import { openContextMenu } from '../ui/context-menu.js';
import { open as openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { requireAuthOrRedirect, canEditContent } from '../components/auth-guard.js';
import { formatNumber, formatDate, slugify } from '../utils/format.js';
import { csv, downloadCsv } from '../utils/csv.js';
import { debounce } from '../utils/debounce.js';
import { validate, rules, hasErrors } from '../utils/validators.js';

export default async function tablePage(info, outlet) {
  const session = await requireAuthOrRedirect();
  if (!session) return () => {};

  const id = info?.params?.id;
  if (!id) { router.navigate(ROUTES.TABLES, { replace: true }); return () => {}; }

  outlet.innerHTML = '';
  outlet.appendChild(buildLoading());

  let table, columns, rowsData, people = [], myPersonId = null;
  try {
    table = await tablesService.getById(id);
    if (!table) {
      outlet.innerHTML = '';
      outlet.appendChild(el('div', { class: 'container' }, [emptyState({ iconName: 'table', title: 'جدول پیدا نشد', actions: [el('a', { class: 'btn btn--primary', href: router.href(ROUTES.TABLES) }, ['بازگشت'])] })]));
      return () => {};
    }
    [columns, rowsData] = await Promise.all([
      tablesService.listColumns(id),
      tablesService.listRows(id, { limit: 500 }),
    ]);
    
    if (columns.some((c) => c.type === 'person_ref') || table.permission_type !== 'public') {
      const res = await peopleService.list({ limit: 1000 });
      people = res.items;
      const myPerson = people.find(p => p.user_id === session.user.id || (session.user.email && p.email === session.user.email));
      if (myPerson) myPersonId = myPerson.id;
    }
  } catch (err) {
    outlet.innerHTML = '';
    outlet.appendChild(el('div', { class: 'container' }, [emptyState({ iconName: 'alert-circle', title: 'خطا در بارگذاری', description: err?.message })]));
    return () => {};
  }

  const user = appStore.get('user');
  const isOwner = user?.id === table.created_by;
  const isAdmin = canEditContent();

  // 3 distinct permission levels
  const canManageStructure = isAdmin || isOwner;  // Columns, table settings, delete
  const isPublic = table.permission_type === 'public' || !table.permission_type;
  const canAddRow = canManageStructure || isPublic;  // In private tables only owner adds rows
  const canAddColumn = canManageStructure;
  const canAddPeople = canManageStructure;

  // Compute ownership sets for UI highlighting
  const userOwnedRowIds = new Set();
  const userOwnedColumnIds = new Set();

  if (myPersonId) {
    if (table.permission_type === 'private_column') {
      const ownerCol = columns.find(c => c.is_owner_determining);
      if (ownerCol) rowsData.items.forEach(r => { if (r.values?.[ownerCol.id] === myPersonId) userOwnedRowIds.add(r.id); });
    } else if (table.permission_type === 'private_row') {
      const ownerRow = rowsData.items.find(r => r.is_owner_determining);
      if (ownerRow) columns.forEach(c => { if (ownerRow.values?.[c.id] === myPersonId) userOwnedColumnIds.add(c.id); });
    }
  }

  outlet.innerHTML = '';
  outlet.appendChild(buildView());

  return () => {};

  function buildView() {
    const back = el('a', { class: 'table-back', href: router.href(ROUTES.TABLES) }, [icon('chevron-right'), 'بازگشت به جدول‌ها']);

    const actions = el('div', { class: 'table-hero__actions' }, [
      canAddRow ? el('button', { type: 'button', class: 'btn btn--primary btn--sm', on: { click: () => addRow() } }, [icon('plus'), 'افزودن ردیف']) : null,
      canAddColumn ? el('button', { type: 'button', class: 'btn btn--secondary btn--sm', on: { click: () => addColumn() } }, [icon('grid'), 'افزودن ستون']) : null,
      canAddColumn ? el('button', { type: 'button', class: 'btn btn--secondary btn--sm', on: { click: () => bulkEditColumns() } }, [icon('edit'), 'ویرایش ستون‌ها']) : null,
      canAddPeople ? el('button', { type: 'button', class: 'btn btn--secondary btn--sm', on: { click: () => bulkAddPeople() } }, [icon('users'), 'افزودن افراد']) : null,
      el('button', { type: 'button', class: 'btn btn--secondary btn--sm', on: { click: () => exportCsv() } }, [icon('download'), 'CSV']),
      canManageStructure ? el('button', { type: 'button', class: 'btn btn--secondary btn--sm', on: { click: () => editTable() } }, [icon('settings'), 'تنظیمات']) : null,
      canManageStructure ? el('button', { type: 'button', class: 'btn btn--danger btn--sm', on: { click: () => deleteTable() } }, [icon('trash'), 'حذف']) : null,
    ].filter(Boolean));

    const permLabel = isPublic ? 'عمومی' : table.permission_type === 'private_column' ? 'خصوصی (ردیف‌ها)' : 'خصوصی (ستون‌ها)';
    
    let permWarning = null;
    if (table.permission_type === 'private_column' && !columns.some(c => c.is_owner_determining)) {
      permWarning = el('div', { class: 'badge badge--danger', style: { marginTop: '8px' } }, ['هشدار: ستون تعیین‌کننده مالک مشخص نشده است.']);
    } else if (table.permission_type === 'private_row' && !rowsData.items.some(r => r.is_owner_determining)) {
      permWarning = el('div', { class: 'badge badge--danger', style: { marginTop: '8px' } }, ['هشدار: ردیف تعیین‌کننده مالک مشخص نشده است.']);
    }

    const hero = el('div', { class: 'table-hero' }, [
      el('div', { class: 'table-hero__main' }, [
        el('h1', { class: 'table-hero__title' }, [table.name || 'بدون نام']),
        table.description ? el('p', { class: 'table-hero__desc' }, [table.description]) : null,
        el('div', { class: 'table-hero__meta' }, [
          el('span', { class: 'table-hero__meta-item' }, [icon('grid'), `${formatNumber(columns.length)} ستون`]),
          el('span', { class: 'table-hero__meta-item' }, [icon('list'), `${formatNumber(rowsData.items.length)} ردیف`]),
          el('span', { class: 'table-hero__meta-item' }, [icon('lock'), `دسترسی: ${permLabel}`]),
          table.updated_at ? el('span', { class: 'table-hero__meta-item' }, [icon('clock'), formatDate(table.updated_at)]) : null,
        ]),
        permWarning
      ]),
      actions,
    ]);

    const searchInput = el('input', { type: 'search', class: 'input', placeholder: 'جستجو در ردیف‌ها...' });

    // === ROW/CELL PERMISSION LOGIC ===
    const checkCanEditRow = (row) => {
      if (canManageStructure) return true;
      if (isPublic) return true;
      if (table.permission_type === 'private_column') {
        if (!myPersonId) return false;
        const ownerCol = columns.find(c => c.is_owner_determining);
        return ownerCol && row.values?.[ownerCol.id] === myPersonId;
      }
      if (table.permission_type === 'private_row') return true;
      return false;
    };

    const checkCanEditCell = (row, col) => {
      if (!checkCanEditRow(row)) return false;
      if (canManageStructure) return true;
      if (table.permission_type === 'private_row') {
        const ownerRow = rowsData.items.find(r => r.is_owner_determining);
        if (!ownerRow || !myPersonId) return false;
        return ownerRow.values?.[col.id] === myPersonId;
      }
      return true;
    };

    const grid = createTableGrid({
      columns,
      rows: rowsData.items,
      people,
      canEdit: true, // Always true; checkCanEditRow/Cell does the real filtering
      canEditRow: checkCanEditRow, 
      canEditCell: checkCanEditCell,
      userOwnedRowIds,
      userOwnedColumnIds,
      onEditRow: async (row, result) => {
        try {
          await tablesService.updateRow(row.id, result.values, row.is_owner_determining);
          row.values = result.values;
          toast.success('ردیف به‌روز شد.');
        } catch (err) {
          toast.error(err?.message || 'ذخیره ناموفق بود.');
          throw err;
        }
      },
      onInlineSave: async (row, col, value) => {
        const nextValues = { ...(row.values || {}), [col.id]: value };
        try {
          await tablesService.updateRow(row.id, nextValues);
          row.values = nextValues;
        } catch (err) {
          toast.error(err?.message || 'ذخیره ناموفق بود.');
          throw err;
        }
      },
      onAddRow: () => canAddRow ? addRow() : toast.warning('دسترسی ندارید.'),
      onAddColumn: () => canAddColumn ? addColumn() : toast.warning('دسترسی ندارید.'),
      onColumnContext: (e, col) => canManageStructure ? openColumnContext(e, col) : null,
      onRowContext: (e, row) => openRowContext(e, row),
    });

    const gridWrap = el('div', {}, [grid.node]);

    const applySearch = debounce((query) => {
      const q = String(query || '').trim().toLowerCase();
      const filtered = !q ? rowsData.items : rowsData.items.filter((row) =>
            Object.values(row.values || {}).some((v) => {
              if (v == null) return false;
              if (Array.isArray(v)) return v.join(' ').toLowerCase().includes(q);
              return String(v).toLowerCase().includes(q);
            })
          );
      grid.refresh(columns, filtered);
    }, 200);
    searchInput.addEventListener('input', () => applySearch(searchInput.value));

    const searchBar = el('div', { class: 'toolbar' }, [
      el('div', { class: 'search toolbar__search' }, [el('span', { class: 'search__icon' }, [icon('search')]), searchInput]),
    ]);

    return el('div', { class: 'container' }, [
      el('div', { class: 'table-detail' }, [back, hero, searchBar, gridWrap]),
    ]);

    /* ================= actions ================= */

    async function addRow() {
      if (!columns.length) return toast.warning('ابتدا حداقل یک ستون اضافه کنید.');
      const result = await openRowEditor({ columns, values: {}, people, tablePermissionType: table.permission_type });
      if (!result) return;
      try {
        const created = await tablesService.createRow(table.id, result.values, result.isOwnerDetermining);
        rowsData.items.push(created);
        grid.refresh(columns, rowsData.items);
        searchInput.value = '';
        toast.success('ردیف اضافه شد.');
      } catch (err) { toast.error(err?.message || 'افزودن ناموفق بود.'); }
    }

    async function addColumn() {
      const values = await openColumnEditor({ tablePermissionType: table.permission_type });
      if (!values) return;
      try {
        const position = columns.length;
        const created = await tablesService.createColumn(table.id, { ...values, position });
        columns.push(created);
        grid.refresh(columns, rowsData.items);
        toast.success('ستون اضافه شد.');
      } catch (err) { toast.error(err?.message || 'افزودن ستون ناموفق بود.'); }
    }

    async function bulkEditColumns() {
      if (!columns.length) return;
      const result = await openBulkEditColumns({ columns });
      if (!result) return;
      const { ids, props } = result;
      const toastId = toast.info(`در حال ویرایش ${formatNumber(ids.length)} ستون...`, { duration: 0 });
      try {
        await Promise.all(ids.map(id => tablesService.updateColumn(id, props)));
        toast.success(`تغییرات روی ${formatNumber(ids.length)} ستون اعمال شد.`);
        toastId.dismiss();
        columns = await tablesService.listColumns(table.id);
        outlet.innerHTML = '';
        outlet.appendChild(buildView());
      } catch (err) { toast.error(err?.message || 'خطا در ویرایش گروهی.'); toastId.dismiss(); }
    }

    async function bulkAddPeople() {
      const result = await openBulkPeopleForm({ hasColumns: columns.length > 0, columns });
      if (!result) return;
      const { mode, people: selectedPeople, columnProps, rowTargetColId } = result;
      const toastId = toast.info(`در حال پردازش ${formatNumber(selectedPeople.length)} نفر...`, { duration: 0 });
      try {
        if (mode === 'columns') {
          await Promise.all(selectedPeople.map((person, idx) => tablesService.createColumn(table.id, { ...columnProps, name: person.full_name, position: columns.length + idx })));
          toast.success(`${formatNumber(selectedPeople.length)} ستون برای افراد ساخته شد.`);
        } else {
          let targetColId = rowTargetColId || (columns.length === 0 ? (await tablesService.createColumn(table.id, { name: 'نام فرد', type: COLUMN_TYPES.TEXT, position: 0 })).id : columns[0].id);
          const isRef = columns.find(c => c.id === targetColId)?.type === COLUMN_TYPES.PERSON_REF;
          await Promise.all(selectedPeople.map(person => tablesService.createRow(table.id, { [targetColId]: isRef ? person.id : person.full_name })));
          toast.success(`${formatNumber(selectedPeople.length)} ردیف برای افراد ساخته شد.`);
        }
        toastId.dismiss();
        columns = await tablesService.listColumns(table.id);
        rowsData = await tablesService.listRows(table.id, { limit: 500 });
        outlet.innerHTML = '';
        outlet.appendChild(buildView());
      } catch (err) { toast.error(err?.message || 'خطا در افزودن گروهی.'); toastId.dismiss(); }
    }

    function openColumnContext(e, col) {
      openContextMenu(e.clientX, e.clientY, [
        { label: 'ویرایش ستون', icon: 'edit', onClick: () => editColumn(col) },
        { divider: true },
        { label: 'حذف ستون', icon: 'trash', danger: true, onClick: () => deleteColumn(col) },
      ]);
    }

    async function editColumn(col) {
      const values = await openColumnEditor({ column: col, tablePermissionType: table.permission_type });
      if (!values) return;
      try {
        if (values.is_owner_determining) {
          const others = columns.filter(c => c.id !== col.id && c.is_owner_determining);
          for (const other of others) await tablesService.updateColumn(other.id, { is_owner_determining: false });
        }
        const updated = await tablesService.updateColumn(col.id, values);
        const idx = columns.findIndex((c) => c.id === col.id);
        if (idx !== -1) columns[idx] = updated;
        columns = await tablesService.listColumns(table.id);
        grid.refresh(columns, rowsData.items);
        toast.success('ستون به‌روز شد.');
      } catch (err) { toast.error(err?.message || 'ویرایش ناموفق بود.'); }
    }

    async function deleteColumn(col) {
      await confirmAndDelete({
        title: 'حذف ستون',
        message: `ستون «${col.name}» و همه داده‌های آن حذف شوند؟`,
        onConfirm: () => tablesService.removeColumn(col.id),
        successMessage: 'ستون حذف شد.',
        onDeleted: () => {
          columns = columns.filter((c) => c.id !== col.id);
          rowsData.items.forEach((r) => { if (r.values && col.id in r.values) delete r.values[col.id]; });
          grid.refresh(columns, rowsData.items);
        },
      });
    }

    function openRowContext(e, row) {
      const canEditThisRow = checkCanEditRow(row);
      const canDeleteThisRow = canManageStructure || canEditThisRow;

      openContextMenu(e.clientX, e.clientY, [
        {
          label: 'ویرایش ردیف',
          icon: 'edit',
          disabled: !canEditThisRow,
          onClick: async () => {
            const result = await openRowEditor({ columns, values: row.values || {}, people, tablePermissionType: table.permission_type, isOwnerDetermining: row.is_owner_determining });
            if (!result) return;
            try {
              if (result.isOwnerDetermining) {
                const others = rowsData.items.filter(r => r.id !== row.id && r.is_owner_determining);
                for (const other of others) await tablesService.updateRow(other.id, other.values, false);
              }
              await tablesService.updateRow(row.id, result.values, result.isOwnerDetermining);
              row.values = result.values;
              row.is_owner_determining = result.isOwnerDetermining;
              rowsData = await tablesService.listRows(table.id, { limit: 500 });
              grid.refresh(columns, rowsData.items);
              toast.success('ردیف به‌روز شد.');
            } catch (err) { toast.error(err?.message || 'ذخیره ناموفق بود.'); }
          },
        },
        {
          label: 'کپی ردیف',
          icon: 'copy',
          disabled: !canManageStructure,
          onClick: async () => {
            try {
              const created = await tablesService.createRow(table.id, { ...row.values }, false);
              rowsData.items.push(created);
              grid.refresh(columns, rowsData.items);
              toast.success('ردیف کپی شد.');
            } catch (err) { toast.error(err?.message || 'کپی ناموفق بود.'); }
          },
        },
        { divider: true },
        {
          label: 'حذف ردیف',
          icon: 'trash',
          danger: true,
          disabled: !canDeleteThisRow,
          onClick: () => confirmAndDelete({
              title: 'حذف ردیف',
              message: 'این ردیف حذف شود؟',
              onConfirm: () => tablesService.removeRow(row.id),
              successMessage: 'ردیف حذف شد.',
              onDeleted: () => {
                rowsData.items = rowsData.items.filter((r) => r.id !== row.id);
                grid.refresh(columns, rowsData.items);
              },
            }),
        },
      ]);
    }

    async function editTable() {
      const values = await editTableDialog(table);
      if (!values) return;
      try {
        const updated = await tablesService.update(table.id, values);
        Object.assign(table, updated);
        toast.success('تنظیمات جدول به‌روز شد.');
        window.location.reload();
      } catch (err) { toast.error(err?.message || 'ویرایش ناموفق بود.'); }
    }

    async function deleteTable() {
      await confirmAndDelete({
        title: 'حذف جدول',
        message: `«${table.name}» و همه داده‌های آن حذف شوند؟ این عمل بازگشت‌پذیر نیست.`,
        onConfirm: () => tablesService.remove(table.id),
        successMessage: 'جدول حذف شد.',
        onDeleted: () => router.navigate(ROUTES.TABLES, { replace: true }),
      });
    }

    function exportCsv() {
      if (!columns.length || !rowsData.items.length) return toast.warning('داده‌ای برای خروجی وجود ندارد.');
      const headers = ['#', ...columns.map((c) => c.name)];
      const csvRows = rowsData.items.map((row, i) => [
        i + 1,
        ...columns.map((c) => {
          const v = row.values?.[c.id];
          if (Array.isArray(v)) return v.join('؛ ');
          if (v === true) return '✓';
          if (v === false) return '✗';
          return v == null ? '' : String(v);
        }),
      ]);
      downloadCsv(`${table.slug || 'table'}.csv`, csv.rowsToCsv(headers, csvRows));
      toast.success('فایل CSV دانلود شد.');
    }
  }
}

function buildLoading() {
  return el('div', { class: 'container' }, [
    el('div', { class: 'page-loading' }, [el('div', { class: 'skeleton skeleton--title' }), el('div', { class: 'skeleton skeleton--block', style: { height: '200px' } })]),
  ]);
}

function editTableDialog(table) {
  return new Promise((resolve) => {
    const nameInput = el('input', { type: 'text', class: 'input', value: table?.name || '', maxlength: 120 });
    const descInput = el('textarea', { class: 'textarea', rows: 3, maxlength: 500 });
    descInput.value = table?.description || '';
    const slugInput = el('input', { type: 'text', class: 'input', dir: 'ltr', value: table?.slug || '' });
    
    const permSelect = el('select', { class: 'select' }, [
      el('option', { value: 'public', selected: table?.permission_type === 'public' }, ['عمومی (همه می‌توانند ویرایش کنند)']),
      el('option', { value: 'private_column', selected: table?.permission_type === 'private_column' }, ['خصوصی (بر اساس یک ستون)']),
      el('option', { value: 'private_row', selected: table?.permission_type === 'private_row' }, ['خصوصی (بر اساس یک ردیف)']),
    ]);

    const form = el('form', { class: 'form-grid' }, [
      el('div', { class: 'form-field' }, [el('label', { class: 'form-label' }, ['نام']), nameInput]),
      el('div', { class: 'form-field' }, [el('label', { class: 'form-label' }, ['توضیحات']), descInput]),
      el('div', { class: 'form-field' }, [el('label', { class: 'form-label' }, ['شناسه (slug)']), slugInput]),
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['حالت مالکیت']),
        permSelect,
        el('p', { class: 'form-help' }, ['در حالت خصوصی، فقط صاحب ردیف یا ستون (که در تنظیمات آن مشخص می‌کنید) حق ویرایش دارد.'])
      ]),
    ]);

    const submitBtn = el('button', { type: 'button', class: 'btn btn--primary', on: { click: () => form.requestSubmit() } }, ['ذخیره']);
    const cancelBtn = el('button', { type: 'button', class: 'btn btn--secondary', on: { click: () => { handle.close(); resolve(null); } } }, ['انصراف']);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const values = {
        name: nameInput.value.trim(),
        description: descInput.value.trim(),
        slug: slugInput.value.trim() || slugify(nameInput.value),
        permission_type: permSelect.value,
      };
      const errors = validate(values, { name: [rules.required('نام الزامی است')] });
      if (hasErrors(errors)) return toast.error(Object.values(errors)[0]);
      handle.close();
      resolve(values);
    });

    const handle = openModal({
      title: 'تنظیمات جدول',
      body: form,
      footer: el('div', { style: { display: 'flex', gap: '8px' } }, [cancelBtn, submitBtn]),
      size: 'md',
      initialFocus: nameInput,
      onClose: () => resolve(null),
    });
  });
}