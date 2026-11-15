/** Bring a shelf in, take a shelf out. */

import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Upload,
} from 'lucide-react';
import { insertRow, logActivity, useDb, exportDatabase, importDatabase } from '../data/store';
import { download, nowIso, splitList, uid } from '../lib/utils';
import { bytesLabel, dateTime, n } from '../lib/format-extra';
import type { Title } from '../types';
import {
  Button,
  Chip,
  EmptyState,
  Field,
  Input,
  Modal,
  Notice,
  Stat,
  Textarea,
  useConfirm,
  useToast,
  cx,
} from '../components/ui';

interface Parsed {
  source: string;
  titles: Array<Partial<Title>>;
  fullDatabase: boolean;
  rawText: string;
  summary: string;
}

const BLANK_TITLE = {
  legacy_id: null,
  title: '',
  original_title: '',
  category: 'good' as const,
  type: 'film',
  genre: '',
  tags: '',
  year: null,
  rating: 0,
  favorite: false,
  notes: '',
  watched_date: null,
  summary: '',
  seasons: null,
  episodes: null,
  episodes_per_season: null,
  country: '',
  language: '',
  status: 'watched',
  reason: '',
  story_analysis: '',
  ai_standardized_at: null,
  source: 'import',
  poster_url: '',
  backdrop_url: '',
  trailer_url: '',
  runtime: null,
};

function parseCsv(text: string): Array<Partial<Title>> {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]).map((cell) => cell.trim().toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((key, index) => {
      row[key] = (cells[index] || '').trim();
    });
    return {
      ...BLANK_TITLE,
      title: row.title || row.name || '',
      original_title: row.original_title || '',
      category: (row.category === 'love' || row.category === 'hate' ? row.category : 'good') as Title['category'],
      type: row.type || 'film',
      genre: row.genre || '',
      tags: row.tags || '',
      year: Number(row.year) || null,
      rating: Number(row.rating) || 0,
      runtime: Number(row.runtime) || null,
      country: row.country || '',
      language: row.language || '',
      status: row.status || 'watched',
      watched_date: row.watched_date || null,
      summary: row.summary || row.notes || '',
      notes: row.notes || '',
      source: 'csv import',
    };
  });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      out.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  out.push(current);
  return out;
}

export function Imports() {
  const db = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState('');
  const [defaultCategory, setDefaultCategory] = useState<Title['category']>('good');
  const [busy, setBusy] = useState(false);

  const batches = useMemo(
    () => [...db.cinema_import_batches].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [db.cinema_import_batches],
  );

  const handleText = (text: string, filename: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.push({ tone: 'error', title: 'Empty file' });
      return;
    }
    if (trimmed.startsWith('{')) {
      try {
        const data = JSON.parse(trimmed) as Record<string, unknown>;
        if (Array.isArray(data.cinema_titles)) {
          setParsed({
            source: filename,
            titles: [],
            fullDatabase: true,
            rawText: trimmed,
            summary: `Full database export · ${n((data.cinema_titles as unknown[]).length)} titles and ${Object.keys(data).length} tables`,
          });
          return;
        }
        const array = Array.isArray(data) ? data : Array.isArray(data.titles) ? data.titles : [];
        const titles = (array as Array<Partial<Title>>).map((row) => ({ ...BLANK_TITLE, ...row }));
        setParsed({ source: filename, titles, fullDatabase: false, rawText: trimmed, summary: `${titles.length} title records` });
        return;
      } catch (error) {
        toast.push({ tone: 'error', title: 'Invalid JSON', body: (error as Error).message });
        return;
      }
    }
    if (filename.toLowerCase().endsWith('.csv') || trimmed.includes(',')) {
      const titles = parseCsv(trimmed).map((row) => ({ ...row, category: row.category || defaultCategory }));
      setParsed({ source: filename, titles, fullDatabase: false, rawText: trimmed, summary: `${titles.length} CSV rows` });
      return;
    }
    // Plain text: one title per line, "Title (Year)" tolerated.
    const titles = trimmed
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => {
        const match = line.match(/^(.*?)\s*\((\d{4})\)\s*$/);
        return {
          ...BLANK_TITLE,
          title: (match ? match[1] : line).trim(),
          year: match ? Number(match[2]) : null,
          category: defaultCategory,
          source: 'text import',
        } as Partial<Title>;
      });
    setParsed({ source: filename, titles, fullDatabase: false, rawText: trimmed, summary: `${titles.length} lines` });
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => handleText(String(reader.result || ''), file.name);
    reader.onerror = () => toast.push({ tone: 'error', title: 'Could not read file' });
    reader.readAsText(file);
  };

  const commit = async () => {
    if (!parsed) return;
    if (parsed.fullDatabase) {
      const ok = await confirm({
        title: 'Replace the entire database?',
        body: 'Every current table is replaced by the export. This cannot be undone unless you export first.',
        confirmLabel: 'Replace everything',
        danger: true,
      });
      if (!ok) return;
      const result = importDatabase(parsed.rawText);
      toast.push({ tone: result.ok ? 'success' : 'error', title: result.ok ? 'Database restored' : 'Restore failed', body: result.message });
      setParsed(null);
      return;
    }
    setBusy(true);
    let added = 0;
    for (const row of parsed.titles) {
      if (!row.title?.trim()) continue;
      insertRow('cinema_titles', {
        ...BLANK_TITLE,
        ...row,
        title: row.title.trim(),
        original_title: row.original_title || row.title.trim(),
        source: row.source || parsed.source,
        rating: Number(row.rating) || 0,
      } as never);
      added += 1;
    }
    insertRow('cinema_import_batches', {
      source: parsed.source,
      count: added,
      status: 'applied',
      payload_summary: parsed.summary,
    } as never);
    logActivity('imported', 'cinema_titles', null, `${added} titles from ${parsed.source}`);
    setBusy(false);
    setParsed(null);
    toast.push({ tone: 'success', title: 'Import applied', body: `${added} titles added to the shelf.` });
  };

  const exportJson = () => download('full-metal-cinema.json', exportDatabase(), 'application/json');

  const exportCsv = () => {
    const header = ['title', 'original_title', 'category', 'type', 'genre', 'year', 'rating', 'runtime', 'country', 'language', 'status', 'watched_date', 'tags', 'summary'];
    const rows = db.cinema_titles.map((title) =>
      [title.title, title.original_title, title.category, title.type, title.genre, title.year, title.rating, title.runtime, title.country, title.language, title.status, title.watched_date, title.tags, title.summary]
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(','),
    );
    download('fmc-titles.csv', [header.join(','), ...rows].join('\n'), 'text/csv');
  };

  const exportMarkdown = () => {
    const lines = ['# Full Metal Cinema', '', `Exported ${nowIso().slice(0, 10)} · ${db.cinema_titles.length} titles`, ''];
    for (const category of ['love', 'good', 'hate'] as const) {
      const group = db.cinema_titles.filter((title) => title.category === category);
      if (!group.length) continue;
      lines.push(`## ${category.toUpperCase()} (${group.length})`, '');
      for (const title of group.sort((a, b) => b.rating - a.rating)) {
        lines.push(`- **${title.title}** (${title.year || '—'}) — ${title.rating.toFixed(1)}/10 — ${title.genre}`);
        if (title.summary) lines.push(`  ${title.summary}`);
      }
      lines.push('');
    }
    download('fmc-shelf.md', lines.join('\n'), 'text/markdown');
  };

  return (
    <>
      <div className="page-head">
        <div className="page-head__copy">
          <div className="eyebrow">Data · import &amp; export</div>
          <h1 className="page-title">
            Move the <em>archive.</em>
          </h1>
          <p className="page-sub">
            JSON round-trips the whole database. CSV and plain text add titles without touching anything else. Nothing
            leaves this browser.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="outline" icon={<Upload size={13} />} onClick={() => fileRef.current?.click()}>
            Choose a file
          </Button>
          <Button variant="ghost" icon={<FileText size={13} />} onClick={() => setPasteOpen(true)}>
            Paste data
          </Button>
        </div>
      </div>

      <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))', marginBottom: 'var(--sp-4)' }}>
        <Stat label="Titles" value={n(db.cinema_titles.length)} icon={<Database size={11} />} />
        <Stat label="Batches" value={n(batches.length)} foot="applied imports" />
        <Stat label="Last import" value={batches[0] ? n(batches[0].count) : '—'} foot={batches[0]?.source || 'never'} />
        <Stat label="Export size" value={bytesLabel(exportDatabase().length)} foot="JSON on disk" />
      </div>

      <div className="split">
        <div className="stack">
          <div
            className={cx('dropzone', dragging && 'is-dragging')}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files?.[0];
              if (file) readFile(file);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".json,.csv,.txt"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) readFile(file);
                event.target.value = '';
              }}
            />
            <div className="dropzone__icon">
              <Upload size={22} />
            </div>
            <h3>Drop a file here</h3>
            <p>JSON export, CSV with a title column, or one title per line. Files are parsed in the browser.</p>
            <Button variant="outline" icon={<Upload size={13} />} onClick={() => fileRef.current?.click()}>
              Browse files
            </Button>
          </div>

          {parsed && (
            <section className="card card--pad">
              <div className="row row--between" style={{ marginBottom: 8 }}>
                <div className="panel-title" style={{ margin: 0 }}>
                  <FileJson size={11} /> {parsed.source}
                </div>
                <Chip mono sm tone={parsed.fullDatabase ? 'accent' : undefined}>
                  {parsed.fullDatabase ? 'full restore' : `${parsed.titles.length} rows`}
                </Chip>
              </div>
              <p className="faint" style={{ fontSize: 10, marginBottom: 10 }}>{parsed.summary}</p>
              {parsed.fullDatabase ? (
                <Notice tone="warn" icon={<AlertTriangle size={13} />}>
                  This is a full database export. Applying it replaces every table with the file’s contents.
                </Notice>
              ) : (
                <>
                  <div className="row row--between" style={{ marginBottom: 8 }}>
                    <span className="faint" style={{ fontSize: 10 }}>Default category for rows without one</span>
                    <div className="filter-row">
                      {(['love', 'good', 'hate'] as const).map((category) => (
                        <button
                          key={category}
                          className={cx('chip chip--sm', defaultCategory === category && 'is-active')}
                          onClick={() => setDefaultCategory(category)}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="table-wrap" style={{ maxHeight: 240 }}>
                    <table className="table table--sm">
                      <thead>
                        <tr><th>Title</th><th>Year</th><th>Category</th><th>Rating</th></tr>
                      </thead>
                      <tbody>
                        {parsed.titles.slice(0, 30).map((row, index) => (
                          <tr key={`${row.title}-${index}`}>
                            <td>{row.title || <span className="faint">(missing title)</span>}</td>
                            <td className="mono">{row.year || '—'}</td>
                            <td><Chip sm mono>{row.category || defaultCategory}</Chip></td>
                            <td className="num">{row.rating || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsed.titles.length > 30 && (
                    <p className="faint" style={{ fontSize: 9, marginTop: 6 }}>Showing 30 of {parsed.titles.length}. All valid rows will be imported.</p>
                  )}
                </>
              )}
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12, gap: 8 }}>
                <Button variant="ghost" onClick={() => setParsed(null)}>Discard</Button>
                <Button variant="primary" icon={<Check size={13} />} onClick={commit} disabled={busy}>
                  {busy ? 'Applying…' : parsed.fullDatabase ? 'Replace database' : `Import ${parsed.titles.length} titles`}
                </Button>
              </div>
            </section>
          )}

          <section className="card card--pad">
            <div className="panel-title">Batches</div>
            {batches.length ? (
              <div className="table-wrap" style={{ border: 0 }}>
                <table className="table table--sm">
                  <thead>
                    <tr><th>Source</th><th className="num">Count</th><th>Status</th><th>When</th></tr>
                  </thead>
                  <tbody>
                    {batches.map((batch) => (
                      <tr key={batch.id}>
                        <td>
                          {batch.source}
                          <span className="faint" style={{ display: 'block', fontSize: 8.5 }}>{batch.payload_summary}</span>
                        </td>
                        <td className="num">{batch.count}</td>
                        <td><Chip sm mono tone="accent">{batch.status}</Chip></td>
                        <td className="mono" style={{ fontSize: 8.5 }}>{dateTime(batch.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={<Upload size={20} />} title="No batches" text="Every applied import is recorded with its source and row count." />
            )}
          </section>
        </div>

        <aside className="stack">
          <section className="card card--pad">
            <div className="panel-title">Export</div>
            <div className="stack stack--tight">
              <button className="export-row" onClick={exportJson}>
                <FileJson size={15} />
                <span>
                  <b>Full database</b>
                  <em>Every table, every turn, every note</em>
                </span>
                <Download size={13} />
              </button>
              <button className="export-row" onClick={exportCsv}>
                <FileSpreadsheet size={15} />
                <span>
                  <b>Titles CSV</b>
                  <em>{db.cinema_titles.length} rows, spreadsheet-safe</em>
                </span>
                <Download size={13} />
              </button>
              <button className="export-row" onClick={exportMarkdown}>
                <FileText size={15} />
                <span>
                  <b>Shelf markdown</b>
                  <em>Grouped by verdict, with summaries</em>
                </span>
                <Download size={13} />
              </button>
            </div>
          </section>

          <section className="card card--pad">
            <div className="panel-title">Formats</div>
            <dl className="kv">
              <dt>JSON</dt><dd>Full database restore</dd>
              <dt>CSV</dt><dd>title, year, genre, rating…</dd>
              <dt>Text</dt><dd>one title per line</dd>
              <dt>Markdown</dt><dd>export only</dd>
            </dl>
            <p className="faint" style={{ fontSize: 9, marginTop: 10, lineHeight: 1.6 }}>
              The JSON export is the canonical backup. Keep a copy outside the browser if the shelf matters.
            </p>
          </section>

          <section className="card card--pad">
            <div className="panel-title">Round trip</div>
            <ol className="faint" style={{ fontSize: 10, lineHeight: 1.8, paddingLeft: 16 }}>
              <li>Export the full database.</li>
              <li>Edit titles in any JSON tool.</li>
              <li>Drop the file back here.</li>
              <li>Restore replaces all tables.</li>
            </ol>
          </section>
        </aside>
      </div>

      {pasteOpen && (
        <Modal
          title="Paste data"
          subtitle="JSON, CSV or one title per line."
          onClose={() => setPasteOpen(false)}
          size="lg"
          actions={
            <>
              <Button variant="ghost" onClick={() => setPasteOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => {
                  handleText(paste, 'pasted-data.txt');
                  setPasteOpen(false);
                  setPaste('');
                }}
              >
                Parse
              </Button>
            </>
          }
        >
          <div className="stack">
            <Field label="Content">
              <Textarea className="textarea--tall textarea--mono" value={paste} onChange={(event) => setPaste(event.target.value)} placeholder={'Stalker (1979)\nThe Mirror (1975)'} />
            </Field>
            <Field label="Example id">
              <Input readOnly value={uid('import')} className="input--mono" />
            </Field>
          </div>
        </Modal>
      )}
    </>
  );
}
