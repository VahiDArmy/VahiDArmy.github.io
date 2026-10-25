/**
 * Dynamic table detail page — column management, row CRUD, inline editing,
 * CSV export, search, right-click menus, and bulk people addition.
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
  if (!id) {
    router.navigate(ROUTES.TABLES, { replace: true });
    return () => {};
  }

  outlet.innerHTML = '';
  outlet.appendChild(buildLoading());

  let table, columns, rowsData, people = [];
  try {
    table = await tablesService.getById(id);
    if (!table) {
      outlet.innerHTML = '';
      outlet.appendChild(
        el('div', { class: 'container' }, [
          emptyState({
            iconName: 'table',
            title: 'جدول پیدا نشد',
            description: 'این جدول وجود ندارد یا حذف شده است.',
            actions: [
              el('a', { class: 'btn btn--primary', href: router.href(ROUTES.TABLES) }, ['بازگشت']),
            ],
          }),
        ])
      );
      return () => {};
    }
    [columns, rowsData] = await Promise.all([
      tablesService.listColumns(id),
      tablesService.listRows(id, { limit: 500 }),
    ]);
    // Load people only if there are person_ref columns
    if (columns.some((c) => c.type === 'person_ref')) {
      const res = await peopleService.list({ limit: 300 });
      people = res.items;
    }
  } catch (err) {
    outlet.innerHTML = '';
    outlet.appendChild(
      el('div', { class: 'container' }, [
        emptyState({
          iconName: 'alert-circle',
          title: 'خطا در بارگذاری',
          description: err?.message || 'این جدول بارگذاری نشد.',
        }),
      ])
    );
    return () => {};
  }

  const canEdit =
    canEditContent() || appStore.get('user')?.id === table.created_by;

  outlet.innerHTML = '';
  outlet.appendChild(buildView());

  return () => {};

  /* ================= build ================= */

  function buildView() {
    const back = el(
      'a',
      { class: 'table-back', href: router.href(ROUTES.TABLES) },
      [icon('chevron-right'), 'بازگشت به جدول‌ها']
    );

    const actions = el('div', { class: 'table-hero__actions' }, [
      canEdit
        ? el(
            'button',
            {
              type: 'button',
              class: 'btn btn--primary btn--sm',
              on: { click: () => addRow() },
            },
            [icon('plus'), 'افزودن ردیف']
          )
        : null,
      canEdit
        ? el(
            'button',
            {
              type: 'button',
              class: 'btn btn--secondary btn--sm',
              on: { click: () => addColumn() },
            },
            [icon('grid'), 'افزودن ستون']
          )
        : null,
      canEdit
        ? el(
            'button',
            {
              type: 'button',
              class: 'btn btn--secondary btn--sm',
              on: { click: () => bulkAddPeople() },
            },
            [icon('users'), 'افزودن افراد']
          )
        : null,
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn--secondary btn--sm',
          on: { click: () => exportCsv() },
        },
        [icon('download'), 'CSV']
      ),
      canEdit
        ? el(
            'button',
            {
              type: 'button',
              class: 'btn btn--secondary btn--sm',
              on: { click: () => editTable() },
            },
            [icon('edit'), 'ویرایش']
          )
        : null,
      canEdit
        ? el(
            'button',
            {
              type: 'button',
              class: 'btn btn--danger btn--sm',
              on: { click: () => deleteTable() },
            },
            [icon('trash'), 'حذف']
          )
        : null,
    ].filter(Boolean));

    const hero = el('div', { class: 'table-hero' }, [
      el('div', { class: 'table-hero__main' }, [
        el('h1', { class: 'table-hero__title' }, [table.name || 'بدون نام']),
        table.description
          ? el('p', { class: 'table-hero__desc' }, [table.description])
          : null,
        el('div', { class: 'table-hero__meta' }, [
          el('span', { class: 'table-hero__meta-item' }, [
            icon('grid'),
            `${formatNumber(columns.length)} ستون`,
          ]),
          el('span', { class: 'table-hero__meta-item' }, [
            icon('list'),
            `${formatNumber(rowsData.items.length)} ردیف`,
          ]),
          table.updated_at
            ? el('span', { class: 'table-hero__meta-item' }, [
                icon('clock'),
                formatDate(table.updated_at),
              ])
            : null,
        ]),
      ]),
      actions,
    ]);

    /* Grid section with search */
    const searchInput = el('input', {
      type: 'search',
      class: 'input',
      placeholder: 'جستجو در ردیف‌ها...',
    });

    const grid = createTableGrid({
      columns,
      rows: rowsData.items,
      people,
      canEdit,
      onEditRow: async (row, values) => {
        try {
          await tablesService.updateRow(row.id, values);
          row.values = values;
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
      onAddRow: () => addRow(),
      onAddColumn: () => addColumn(),
      onColumnContext: (e, col) => openColumnContext(e, col),
      onRowContext: (e, row) => openRowContext(e, row),
    });

    const gridWrap = el('div', {}, [grid.node]);

    const applySearch = debounce((query) => {
      const q = String(query || '').trim().toLowerCase();
      const filtered = !q
        ? rowsData.items
        : rowsData.items.filter((row) =>
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
      el('div', { class: 'search toolbar__search' }, [
        el('span', { class: 'search__icon' }, [icon('search')]),
        searchInput,
      ]),
    ]);

    return el('div', { class: 'container' }, [
      el('div', { class: 'table-detail' }, [back, hero, searchBar, gridWrap]),
    ]);

    /* ================= actions ================= */

    async function addRow() {
      if (!columns.length) {
        toast.warning('ابتدا حداقل یک ستون اضافه کنید.');
        return;
      }
      const values = await openRowEditor({ columns, values: {}, people });
      if (!values) return;
      try {
        const created = await tablesService.createRow(table.id, values);
        rowsData.items.push(created);
        grid.refresh(columns, rowsData.items);
        searchInput.value = '';
        toast.success('ردیف اضافه شد.');
      } catch (err) {
        toast.error(err?.message || 'افزودن ناموفق بود.');
      }
    }

    async function addColumn() {
      const values = await openColumnEditor({});
      if (!values) return;
      try {
        const position = columns.length;
        const created = await tablesService.createColumn(table.id, {
          ...values,
          position,
        });
        columns.push(created);
        grid.refresh(columns, rowsData.items);
        toast.success('ستون اضافه شد.');
      } catch (err) {
        toast.error(err?.message || 'افزودن ستون ناموفق بود.');
      }
    }

    async function bulkAddPeople() {
      const result = await openBulkPeopleForm({ hasColumns: columns.length > 0 });
      if (!result) return;

      const { mode, people: selectedPeople } = result;
      const toastId = toast.info(`در حال افزودن ${formatNumber(selectedPeople.length)} فرد...`, { duration: 0 });

      try {
        if (mode === 'columns') {
          let currentPos = columns.length;
          for (const person of selectedPeople) {
            await tablesService.createColumn(table.id, {
              name: person.full_name,
              type: COLUMN_TYPES.TEXT,
              position: currentPos++,
            });
          }
          toast.success(`${formatNumber(selectedPeople.length)} ستون اضافه شد.`);
          toastId.dismiss();
          // Reload page to refresh columns cleanly
          window.location.reload(); 
          
        } else if (mode === 'rows') {
          // Find best target column
          let targetCol = columns.find(c => c.type === COLUMN_TYPES.PERSON_REF);
          let isPersonRef = !!targetCol;
          if (!targetCol) targetCol = columns.find(c => c.type === COLUMN_TYPES.TEXT);
          if (!targetCol) targetCol = columns[0];

          if (!targetCol) {
            toast.error('ابتدا باید یک ستون ایجاد کنید.');
            toastId.dismiss();
            return;
          }

          for (const person of selectedPeople) {
            const val = isPersonRef ? person.id : person.full_name;
            await tablesService.createRow(table.id, { [targetCol.id]: val });
          }
          toast.success(`${formatNumber(selectedPeople.length)} ردیف اضافه شد.`);
          toastId.dismiss();
          window.location.reload();
        }
      } catch (err) {
        toast.error(err?.message || 'خطا در افزودن گروهی.');
        toastId.dismiss();
      }
    }

    function openColumnContext(e, col) {
      openContextMenu(e.clientX, e.clientY, [
        {
          label: 'ویرایش ستون',
          icon: 'edit',
          onClick: () => editColumn(col),
        },
        { divider: true },
        {
          label: 'حذف ستون',
          icon: 'trash',
          danger: true,
          onClick: () => deleteColumn(col),
        },
      ]);
    }

    async function editColumn(col) {
      const values = await openColumnEditor({ column: col });
      if (!values) return;
      try {
        const updated = await tablesService.updateColumn(col.id, values);
        const idx = columns.findIndex((c) => c.id === col.id);
        if (idx !== -1) columns[idx] = updated;
        grid.refresh(columns, rowsData.items);
        toast.success('ستون به‌روز شد.');
      } catch (err) {
        toast.error(err?.message || 'ویرایش ناموفق بود.');
      }
    }

    async function deleteColumn(col) {
      await confirmAndDelete({
        title: 'حذف ستون',
        message: `ستون «${col.name}» و همه داده‌های آن حذف شوند؟`,
        onConfirm: () => tablesService.removeColumn(col.id),
        successMessage: 'ستون حذف شد.',
        onDeleted: () => {
          columns = columns.filter((c) => c.id !== col.id);
          rowsData.items.forEach((r) => {
            if (r.values && col.id in r.values) delete r.values[col.id];
          });
          grid.refresh(columns, rowsData.items);
        },
      });
    }

    function openRowContext(e, row) {
      openContextMenu(e.clientX, e.clientY, [
        {
          label: 'ویرایش ردیف',
          icon: 'edit',
          onClick: async () => {
            const values = await openRowEditor({ columns, values: row.values || {}, people });
            if (!values) return;
            try {
              await tablesService.updateRow(row.id, values);
              row.values = values;
              grid.refresh(columns, rowsData.items);
              toast.success('ردیف به‌روز شد.');
            } catch (err) {
              toast.error(err?.message || 'ذخیره ناموفق بود.');
            }
          },
        },
        {
          label: 'کپی ردیف',
          icon: 'copy',
          onClick: async () => {
            try {
              const created = await tablesService.createRow(table.id, { ...row.values });
              rowsData.items.push(created);
              grid.refresh(columns, rowsData.items);
              toast.success('ردیف کپی شد.');
            } catch (err) {
              toast.error(err?.message || 'کپی ناموفق بود.');
            }
          },
        },
        { divider: true },
        {
          label: 'حذف ردیف',
          icon: 'trash',
          danger: true,
          onClick: () =>
            confirmAndDelete({
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
        toast.success('جدول به‌روز شد.');
        const container = hero.closest('.container');
        if (container) container.replaceWith(buildView());
      } catch (err) {
        toast.error(err?.message || 'ویرایش ناموفق بود.');
      }
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
      if (!columns.length || !rowsData.items.length) {
        toast.warning('داده‌ای برای خروجی وجود ندارد.');
        return;
      }
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
      const csvString = csv.rowsToCsv(headers, csvRows);
      downloadCsv(`${table.slug || 'table'}.csv`, csvString);
      toast.success('فایل CSV دانلود شد.');
    }
  }
}

function buildLoading() {
  return el('div', { class: 'container' }, [
    el('div', { class: 'page-loading' }, [
      el('div', { class: 'skeleton skeleton--title' }),
      el('div', { class: 'skeleton skeleton--block', style: { height: '200px' } }),
    ]),
  ]);
}

function editTableDialog(table) {
  return new Promise((resolve) => {
    const nameInput = el('input', {
      type: 'text',
      class: 'input',
      value: table?.name || '',
      maxlength: 120,
    });
    const descInput = el('textarea', {
      class: 'textarea',
      rows: 3,
      maxlength: 500,
    });
    descInput.value = table?.description || '';
    const slugInput = el('input', {
      type: 'text',
      class: 'input',
      dir: 'ltr',
      value: table?.slug || '',
    });

    const form = el('form', { class: 'form-grid' }, [
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['نام']),
        nameInput,
      ]),
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['توضیحات']),
        descInput,
      ]),
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['شناسه (slug)']),
        slugInput,
      ]),
    ]);

    const submitBtn = el('button', { 
      type: 'button', 
      class: 'btn btn--primary',
      on: { click: () => form.requestSubmit() }
    }, ['ذخیره']);

    const cancelBtn = el(
      'button',
      {
        type: 'button',
        class: 'btn btn--secondary',
        on: { click: () => { handle.close(); resolve(null); } },
      },
      ['انصراف']
    );

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const values = {
        name: nameInput.value.trim(),
        description: descInput.value.trim(),
        slug: slugInput.value.trim() || slugify(nameInput.value),
      };
      const errors = validate(values, {
        name: [rules.required('نام الزامی است')],
      });
      if (hasErrors(errors)) {
        toast.error(Object.values(errors)[0]);
        return;
      }
      handle.close();
      resolve(values);
    });

    const handle = openModal({
      title: 'ویرایش جدول',
      body: form,
      footer: el('div', { style: { display: 'flex', gap: '8px' } }, [cancelBtn, submitBtn]),
      size: 'md',
      initialFocus: nameInput,
      onClose: () => resolve(null),
    });
  });
}