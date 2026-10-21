/**
 * Dynamic table renderer.
 * Renders a scrolling, sticky-header table with inline cell editing
 * for simple types and modal-based editing for complex types.
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { ROUTES, COLUMN_TYPES } from '../config/constants.js';
import { formatNumber, formatDate, initials, truncateText } from '../utils/format.js';
import { openRowEditor } from './row-editor.js';
import { toast } from '../ui/toast.js';

function formatCellDisplay(col, value, { people = [] } = {}) {
  if (value == null || value === '') {
    return el('span', { style: { color: 'var(--text-tertiary)' } }, ['—']);
  }

  switch (col.type) {
    case COLUMN_TYPES.CHECKBOX:
      return el(
        'span',
        { class: `data-grid__checkbox${value ? ' is-checked' : ''}`, role: 'checkbox', 'aria-checked': value ? 'true' : 'false' }
      );

    case COLUMN_TYPES.NUMBER:
      return el('span', { style: { fontVariantNumeric: 'tabular-nums' } }, [
        formatNumber(Number(value)),
      ]);

    case COLUMN_TYPES.DATE:
      return el('span', {}, [formatDate(value)]);

    case COLUMN_TYPES.URL:
      return el('a', {
        class: 'data-grid__url',
        href: String(value).startsWith('http') ? value : `https://${value}`,
        target: '_blank',
        rel: 'noopener noreferrer',
        on: { click: (e) => e.stopPropagation() },
      }, [icon('external'), truncateText(value, 30)]);

    case COLUMN_TYPES.SELECT:
      return el('span', { class: 'data-grid__badge' }, [String(value)]);

    case COLUMN_TYPES.MULTI_SELECT:
      return el(
        'div',
        { class: 'data-grid__chips' },
        (Array.isArray(value) ? value : []).slice(0, 3).map((v) =>
          el('span', { class: 'data-grid__badge' }, [String(v)])
        )
      );

    case COLUMN_TYPES.PERSON_REF: {
      const person = people.find((p) => p.id === value);
      if (!person) {
        return el('span', { style: { color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' } }, ['—']);
      }
      return el('a', {
        class: 'data-grid__person',
        href: router.href(ROUTES.PERSON(person.id)),
        on: { click: (e) => e.stopPropagation() },
      }, [
        el('span', { class: 'avatar' }, [
          person.avatar_url
            ? el('img', { src: person.avatar_url, alt: person.full_name })
            : initials(person.full_name || ''),
        ]),
        el('span', {}, [truncateText(person.full_name || '', 24)]),
      ]);
    }

    case COLUMN_TYPES.LONG_TEXT:
      return el('span', { title: String(value) }, [truncateText(String(value), 60)]);

    case COLUMN_TYPES.TEXT:
    default:
      return el('span', { title: String(value) }, [truncateText(String(value), 80)]);
  }
}

function isInlineEditable(type) {
  return [COLUMN_TYPES.TEXT, COLUMN_TYPES.NUMBER, COLUMN_TYPES.DATE, COLUMN_TYPES.URL, COLUMN_TYPES.CHECKBOX].includes(type);
}

/**
 * @param {Object} opts
 * @param {Array} opts.columns
 * @param {Array} opts.rows
 * @param {Array} [opts.people]
 * @param {Function} opts.onEditRow    — (row) => Promise<void>
 * @param {Function} opts.onDeleteRow  — (row) => Promise<void>
 * @param {Function} opts.onInlineSave — (row, column, value) => Promise<void>
 * @param {Function} opts.onAddRow
 * @param {Function} opts.onAddColumn
 * @param {Function} opts.onColumnContext — (e, column)
 * @param {Function} [opts.onRowContext]  — (e, row)
 * @param {boolean} [opts.canEdit]
 */
export function createTableGrid({
  columns,
  rows,
  people = [],
  onEditRow,
  onDeleteRow,
  onInlineSave,
  onAddRow,
  onAddColumn,
  onColumnContext,
  onRowContext,
  canEdit = false,
} = {}) {
  const wrap = el('div', { class: 'data-grid-wrap' });
  const scroller = el('div', { class: 'data-grid-scroll' });
  wrap.appendChild(scroller);

  render();

  function render() {
    scroller.innerHTML = '';

    const table = el('table', { class: 'data-grid' });

    /* Head */
    const thead = el('thead');
    const headRow = el('tr');

    headRow.appendChild(el('th', { class: 'data-grid__row-num' }, ['#']));

    for (const col of columns) {
      const th = el(
        'th',
        {
          dataset: { colId: col.id },
          on: {
            contextmenu: (e) => {
              if (!canEdit) return;
              e.preventDefault();
              e.stopPropagation();
              onColumnContext?.(e, col);
            },
          },
        },
        [
          el('span', { class: 'data-grid__col-head' }, [
            el('span', { class: 'data-grid__col-name' }, [col.name || '—']),
            el('span', { class: 'data-grid__col-type' }, [col.type]),
            col.required ? el('span', { style: { color: 'var(--danger-500)' } }, ['*']) : null,
          ]),
        ]
      );
      headRow.appendChild(th);
    }

    if (canEdit) {
      headRow.appendChild(
        el(
          'th',
          {
            class: 'col-add',
            title: 'افزودن ستون',
            on: { click: () => onAddColumn?.() },
          },
          [icon('plus')]
        )
      );
    }

    thead.appendChild(headRow);
    table.appendChild(thead);

    /* Body */
    const tbody = el('tbody');

    if (!rows.length) {
      tbody.appendChild(
        el('tr', { class: 'data-grid__empty-row' }, [
          el('td', { colspan: String(columns.length + (canEdit ? 2 : 1)) }, [
            canEdit ? 'هنوز ردیفی اضافه نشده — روی «افزودن ردیف» کلیک کنید.' : 'ردیفی وجود ندارد.',
          ]),
        ])
      );
    } else {
      rows.forEach((row, index) => {
        const tr = el(
          'tr',
          {
            dataset: { rowId: row.id },
            on: {
              contextmenu: (e) => {
                if (!canEdit) return;
                e.preventDefault();
                e.stopPropagation();
                onRowContext?.(e, row);
              },
            },
          },
          [el('td', { class: 'data-grid__row-num' }, [formatNumber(index + 1)])]
        );

        for (const col of columns) {
          const value = row.values?.[col.id];
          const cell = el(
            'td',
            {
              class: 'data-grid__cell',
              dataset: { colId: col.id, rowId: row.id },
            },
            [formatCellDisplay(col, value, { people })]
          );

          if (canEdit) {
            cell.addEventListener('click', () => startCellEdit(cell, row, col));
          }

          tr.appendChild(cell);
        }

        if (canEdit) {
          tr.appendChild(
            el('td', { class: 'data-grid__cell--actions' }, [
              el(
                'button',
                {
                  type: 'button',
                  class: 'data-grid__cell-actions-btn',
                  'aria-label': 'عملیات',
                  on: {
                    click: (e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      onRowContext?.(
                        {
                          preventDefault: () => {},
                          stopPropagation: () => {},
                          clientX: rect.left,
                          clientY: rect.bottom + 4,
                        },
                        row
                      );
                    },
                  },
                },
                [icon('more-vertical')]
              ),
            ])
          );
        }

        tbody.appendChild(tr);
      });
    }

    table.appendChild(tbody);
    scroller.appendChild(table);
  }

  async function startCellEdit(cell, row, col) {
    if (cell.classList.contains('is-editing')) return;

    /* Complex types → full row editor */
    if (!isInlineEditable(col.type)) {
      const values = await openRowEditor({ columns, values: row.values || {}, people });
      if (!values) return;
      try {
        await onEditRow?.(row, values);
      } catch (err) {
        // Parent already toasts
      }
      return;
    }

    const currentValue = row.values?.[col.id];

    /* Checkbox: instant toggle */
    if (col.type === COLUMN_TYPES.CHECKBOX) {
      const next = !currentValue;
      try {
        await onInlineSave?.(row, col, next);
      } catch (err) {
        return;
      }
      return;
    }

    /* Inline text/number/date/url */
    cell.classList.add('is-editing');
    cell.innerHTML = '';

    const inputType =
      col.type === COLUMN_TYPES.NUMBER ? 'number'
      : col.type === COLUMN_TYPES.DATE ? 'date'
      : col.type === COLUMN_TYPES.URL ? 'url'
      : 'text';

    const input = el('input', {
      type: inputType,
      class: 'data-grid__cell-input',
      dir: col.type === COLUMN_TYPES.NUMBER || col.type === COLUMN_TYPES.URL ? 'ltr' : undefined,
      value: currentValue != null ? String(currentValue) : '',
      on: {
        keydown: (e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        },
        blur: () => commit(),
      },
    });

    cell.appendChild(input);
    input.focus();
    if (typeof input.select === 'function') input.select();

    let settled = false;

    async function commit() {
      if (settled) return;
      settled = true;
      let value = input.value;
      if (col.type === COLUMN_TYPES.NUMBER && value !== '') value = Number(value);
      if (col.type === COLUMN_TYPES.URL || col.type === COLUMN_TYPES.TEXT) value = value.trim();
      if (col.type === COLUMN_TYPES.CHECKBOX) value = !!value;

      try {
        await onInlineSave?.(row, col, value);
      } catch (err) {
        cancel();
      }
    }

    function cancel() {
      if (settled && !input.isConnected) return;
      settled = true;
      cell.classList.remove('is-editing');
      cell.innerHTML = '';
      cell.appendChild(formatCellDisplay(col, row.values?.[col.id], { people }));
    }
  }

  return {
    node: wrap,
    refresh(newColumns, newRows) {
      columns = newColumns || columns;
      rows = newRows || rows;
      render();
    },
    get columns() { return columns; },
    get rows() { return rows; },
  };
}

export default createTableGrid;