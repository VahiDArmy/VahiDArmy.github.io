/** The data lab: every table, every column, every row, on the bench. */

import { useMemo, useState } from 'react';
import {
  Braces,
  Copy,
  Database,
  Download,
  HardDrive,
  RefreshCw,
  Search,
  Table2,
  TerminalSquare,
  Trash2,
} from 'lucide-react';
import { clearDb, exportDatabase, removeRow, resetDb, storageFootprint, useDb } from '../data/store';
import { GROUP_LABEL, TABLE_META } from '../data/schema';
import type { TableName } from '../types';
import { copyText, download } from '../lib/utils';
import { bytesLabel, n } from '../lib/format-extra';
import {
  Button,
  Chip,
  EmptyState,
  Modal,
  Notice,
  Stat,
  useConfirm,
  useToast,
  cx,
} from '../components/ui';

export function DataLab() {
  const db = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const [table, setTable] = useState<TableName>('cinema_titles');
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<'all' | keyof typeof GROUP_LABEL>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const meta = TABLE_META.find((entry) => entry.name === table);
  const tableMetaFiltered = TABLE_META.filter((entry) => group === 'all' || entry.group === group);

  const rows = useMemo(() => {
    const list = (db[table] as unknown as Array<Record<string, unknown>>) || [];
    const needle = search.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((row) => JSON.stringify(row).toLowerCase().includes(needle));
  }, [db, table, search]);

  const columns = useMemo(() => {
    const declared = meta?.columns.map((column) => column.name) || [];
    const discovered = new Set<string>();
    rows.slice(0, 40).forEach((row) => Object.keys(row).forEach((key) => discovered.add(key)));
    return Array.from(new Set([...declared, ...Array.from(discovered)]));
  }, [meta, rows]);

  const totalRows = useMemo(
    () => TABLE_META.reduce((total, entry) => total + ((db[entry.name] as unknown[]) || []).length, 0),
    [db],
  );

  const exportTableJson = () => {
    download(`fmc-${table}.json`, JSON.stringify(rows, null, 2), 'application/json');
    toast.push({ tone: 'success', title: 'Table exported', body: `${rows.length} rows` });
  };

  const exportTableCsv = () => {
    const body = rows.map((row) =>
      columns.map((column) => `"${String(row[column] ?? '').replace(/"/g, '""')}"`).join(','),
    );
    download(`fmc-${table}.csv`, [columns.join(','), ...body].join('\n'), 'text/csv');
  };

  return (
    <>
      <div className="page-head">
        <div className="page-head__copy">
          <div className="eyebrow">Data · {TABLE_META.length} tables · {n(totalRows)} rows</div>
          <h1 className="page-title">
            The bench, <em>open.</em>
          </h1>
          <p className="page-sub">
            A direct view of the local store, aligned column-for-column with the supplied SQL schema. Client-only
            archive tables are marked LOCAL.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="outline" icon={<Braces size={13} />} onClick={() => setSchemaOpen(true)}>
            Schema atlas
          </Button>
          <Button variant="ghost" icon={<Download size={13} />} onClick={() => download('full-metal-cinema.json', exportDatabase(), 'application/json')}>
            Export all
          </Button>
        </div>
      </div>

      <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))', marginBottom: 'var(--sp-4)' }}>
        <Stat label="Tables" value={TABLE_META.length} icon={<Table2 size={11} />} foot={`${TABLE_META.filter((entry) => entry.local).length} local only`} />
        <Stat label="Rows" value={n(totalRows)} foot="across every table" />
        <Stat label="Footprint" value={bytesLabel(storageFootprint())} icon={<HardDrive size={11} />} foot="localStorage JSON" />
        <Stat label="Selected" value={n(rows.length)} foot={meta?.label || table} />
      </div>

      <div className="split">
        <aside className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 10, borderBottom: '1px solid var(--border-1)' }}>
            <div className="panel-title" style={{ marginBottom: 6 }}>
              <Database size={11} /> Tables
            </div>
            <div className="filter-row">
              {(['all', 'core', 'curation', 'people', 'planning', 'ai', 'archive', 'system'] as const).map((item) => (
                <button key={item} className={cx('chip chip--sm', group === item && 'is-active')} onClick={() => setGroup(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div style={{ maxHeight: 620, overflowY: 'auto' }}>
            {tableMetaFiltered.map((entry) => {
              const count = ((db[entry.name] as unknown[]) || []).length;
              return (
                <button
                  key={entry.name}
                  className={cx('table-pick', entry.name === table && 'is-active')}
                  onClick={() => {
                    setTable(entry.name);
                    setExpanded(null);
                  }}
                >
                  <span className="table-pick__name">
                    {entry.label}
                    {entry.local && <span className="mono" style={{ fontSize: 7.5, color: 'var(--warn)' }}>LOCAL</span>}
                  </span>
                  <span className="table-pick__meta">{entry.name}</span>
                  <span className="table-pick__count">{n(count)}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="stack" style={{ minWidth: 0 }}>
          <section className="card card--pad" style={{ minWidth: 0 }}>
            <div className="row row--between row--wrap" style={{ marginBottom: 8, gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div className="panel-title" style={{ margin: 0 }}>
                  <Table2 size={11} /> {meta?.label || table}
                  <Chip sm mono>{GROUP_LABEL[meta?.group || 'core']}</Chip>
                </div>
                <p className="faint" style={{ fontSize: 10, marginTop: 4, maxWidth: 620 }}>{meta?.description}</p>
              </div>
              <div className="row" style={{ gap: 4 }}>
                <Button size="sm" variant="ghost" icon={<Download size={11} />} onClick={exportTableCsv}>CSV</Button>
                <Button size="sm" variant="ghost" icon={<Copy size={11} />} onClick={exportTableJson}>JSON</Button>
              </div>
            </div>

            <div className="row" style={{ gap: 6, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div className="input-wrap">
                  <Search size={12} className="input-wrap__icon" />
                  <input
                    className="input"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={`Search ${rows.length} rows as JSON…`}
                  />
                </div>
              </div>
              <Chip mono sm>{columns.length} columns</Chip>
            </div>

            <div className="table-wrap" style={{ maxHeight: 460 }}>
              <table className="table table--sm table--sticky">
                <thead>
                  <tr>
                    <th style={{ width: 28 }} />
                    {columns.map((column) => {
                      const declared = meta?.columns.find((entry) => entry.name === column);
                      return (
                        <th key={column} title={declared?.type}>
                          <span className="mono" style={{ fontSize: 8.5 }}>{column}</span>
                          {declared?.pk && <span style={{ color: 'var(--accent)' }}> ⚿</span>}
                          {declared?.fk && <span style={{ color: 'var(--info)' }}> ↗</span>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 200).map((row, index) => {
                    const id = String(row.id ?? index);
                    const open = expanded === id;
                    return (
                      <>
                        <tr key={id} onClick={() => setExpanded(open ? null : id)} style={{ cursor: 'pointer' }} className={cx(open && 'is-open')}>
                          <td className="mono" style={{ color: 'var(--text-4)' }}>{index + 1}</td>
                          {columns.map((column) => {
                            const value = row[column];
                            return (
                              <td key={column} style={{ maxWidth: 200 }}>
                                <Cell value={value} />
                              </td>
                            );
                          })}
                        </tr>
                        {open && (
                          <tr key={`${id}-json`}>
                            <td colSpan={columns.length + 1} style={{ background: 'var(--bg-2)', padding: 0 }}>
                              <div style={{ padding: 10 }}>
                                <div className="row row--between" style={{ marginBottom: 6 }}>
                                  <span className="mono" style={{ fontSize: 8.5, color: 'var(--text-4)' }}>row · {Object.keys(row).length} keys</span>
                                  <span className="row" style={{ gap: 4 }}>
                                    <button
                                      className="action-label"
                                      onClick={async (event) => {
                                        event.stopPropagation();
                                        await copyText(JSON.stringify(row, null, 2));
                                        toast.push({ tone: 'success', title: 'Row copied' });
                                      }}
                                    >
                                      <Copy size={9} /> copy JSON
                                    </button>
                                    {table !== 'cinema_meta' && (
                                      <button
                                        className="action-label"
                                        style={{ color: 'var(--danger)' }}
                                        onClick={async (event) => {
                                          event.stopPropagation();
                                          const ok = await confirm({
                                            title: 'Delete this row?',
                                            body: 'The row is removed from this table only. Foreign references are not cascaded here.',
                                            confirmLabel: 'Delete row',
                                            danger: true,
                                          });
                                          if (ok) removeRow(table as never, id);
                                        }}
                                      >
                                        <Trash2 size={9} /> delete
                                      </button>
                                    )}
                                  </span>
                                </div>
                                <pre className="codeblock codeblock--wrap" style={{ maxHeight: 260 }}>{JSON.stringify(row, null, 2)}</pre>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                  {!rows.length && (
                    <tr>
                      <td colSpan={columns.length + 1}>
                        <EmptyState icon={<Search size={18} />} title="No rows" text={search ? 'Nothing matches this search.' : 'This table is empty.'} />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {rows.length > 200 && (
              <p className="faint" style={{ fontSize: 9, marginTop: 6 }}>Showing 200 of {rows.length} rows. Export the table for everything.</p>
            )}
          </section>

          <section className="card card--pad">
            <div className="panel-title"><TerminalSquare size={11} /> Schema</div>
            <div className="cols-3" style={{ gap: 8 }}>
              {(meta?.columns || []).map((column) => (
                <div key={column.name} className="schema-column">
                  <div className="row row--between">
                    <span className="mono" style={{ fontSize: 9.5 }}>{column.name}</span>
                    {column.pk && <Chip sm mono tone="accent">pk</Chip>}
                    {column.fk && <Chip sm mono>fk</Chip>}
                  </div>
                  <span className="mono faint" style={{ fontSize: 8.5 }}>{column.type}</span>
                  {column.note && <span className="faint" style={{ fontSize: 8.5 }}>{column.note}</span>}
                  {column.enum && (
                    <div className="filter-row" style={{ marginTop: 2 }}>
                      {column.enum.map((value) => (
                        <span className="tag" key={value} style={{ fontSize: 7.5 }}>{value}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="card card--pad">
            <div className="panel-title">Danger zone</div>
            <div className="cols-2">
              <div>
                <p style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-3)', lineHeight: 1.6 }}>
                  Reseeding rebuilds the demo shelf from the bundled seed. Your rating history and AI threads are
                  removed.
                </p>
                <Button size="sm" variant="outline" icon={<RefreshCw size={11} />} onClick={() => setConfirmReset(true)} style={{ marginTop: 8 }}>
                  Reset to seed
                </Button>
              </div>
              <div>
                <p style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-3)', lineHeight: 1.6 }}>
                  Clearing empties every table — including the projection booth. Export first; this is not reversible.
                </p>
                <Button size="sm" variant="danger" icon={<Trash2 size={11} />} onClick={() => setConfirmClear(true)} style={{ marginTop: 8 }}>
                  Clear everything
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {schemaOpen && (
        <Modal
          title="Schema atlas"
          subtitle={`${TABLE_META.length} tables · ${TABLE_META.reduce((total, entry) => total + entry.columns.length, 0)} columns`}
          icon={<Braces size={16} />}
          onClose={() => setSchemaOpen(false)}
          size="lg"
        >
          <div className="stack">
            <Notice tone="accent">
              Column names mirror the supplied SQL. Tables marked LOCAL are client-only because the schema has no message
              archive; they never pretend to be server tables.
            </Notice>
            {Object.entries(GROUP_LABEL).map(([key, label]) => {
              const entries = TABLE_META.filter((entry) => entry.group === key);
              if (!entries.length) return null;
              return (
                <div key={key}>
                  <div className="eyebrow eyebrow--plain" style={{ marginBottom: 6 }}>{label}</div>
                  <div className="cols-2" style={{ gap: 6 }}>
                    {entries.map((entry) => (
                      <button
                        key={entry.name}
                        className="schema-table"
                        onClick={() => {
                          setTable(entry.name);
                          setSchemaOpen(false);
                        }}
                      >
                        <span className="row row--between">
                          <b style={{ fontSize: 'var(--fs-2xs)' }}>{entry.label}</b>
                          <Chip sm mono>{((db[entry.name] as unknown[]) || []).length} rows</Chip>
                        </span>
                        <span className="mono faint" style={{ fontSize: 8.5, textAlign: 'left' }}>{entry.name}</span>
                        <span className="faint" style={{ fontSize: 8.5, textAlign: 'left' }}>{entry.columns.length} columns{entry.local ? ' · LOCAL' : ''}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}

      {confirmReset && (
        <Modal
          title="Reset to the seed?"
          onClose={() => setConfirmReset(false)}
          size="sm"
          actions={
            <>
              <Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => {
                  resetDb();
                  setConfirmReset(false);
                  toast.push({ tone: 'warn', title: 'Database reseeded' });
                }}
              >
                Reset
              </Button>
            </>
          }
        >
          <p className="muted" style={{ fontSize: 'var(--fs-xs)', lineHeight: 1.7 }}>
            The bundled shelf replaces the current one. Export a JSON copy first if you want it back.
          </p>
        </Modal>
      )}

      {confirmClear && (
        <Modal
          title="Clear every table?"
          onClose={() => setConfirmClear(false)}
          size="sm"
          actions={
            <>
              <Button variant="ghost" onClick={() => setConfirmClear(false)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => {
                  clearDb();
                  setConfirmClear(false);
                  toast.push({ tone: 'warn', title: 'Database cleared' });
                }}
              >
                Clear everything
              </Button>
            </>
          }
        >
          <p className="muted" style={{ fontSize: 'var(--fs-xs)', lineHeight: 1.7 }}>
            Every table is emptied: titles, sessions, ratings, threads and notes. The app returns to an empty shell.
          </p>
        </Modal>
      )}
    </>
  );
}

function Cell({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span style={{ color: 'var(--text-4)' }}>null</span>;
  if (typeof value === 'boolean') return <Chip sm mono tone={value ? 'accent' : undefined}>{value ? 'true' : 'false'}</Chip>;
  if (typeof value === 'number') return <span className="mono">{value}</span>;
  if (typeof value === 'object') {
    const text = JSON.stringify(value);
    return <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)' }}>{text.length > 48 ? `${text.slice(0, 46)}…` : text}</span>;
  }
  const text = String(value);
  return (
    <span title={text.length > 40 ? text : undefined} style={{ fontSize: 'var(--fs-2xs)' }}>
      {text.length > 60 ? `${text.slice(0, 58)}…` : text || '—'}
    </span>
  );
}
