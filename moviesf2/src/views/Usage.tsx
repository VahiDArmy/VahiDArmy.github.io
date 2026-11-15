/** The ledger: every direct model call, what it cost, how it ended. */

import { useMemo, useState } from 'react';
import { Activity, Coins, Download, Gauge, Trash2, Zap } from 'lucide-react';
import { removeRows, useDb } from '../data/store';
import { usageSummary } from '../data/queries';
import { getModelInfo } from '../ai/models';
import { download } from '../lib/utils';
import { duration, n, tokens } from '../lib/format-extra';
import {
  Bars,
  Button,
  Chip,
  EmptyState,
  Modal,
  Stat,
  Tabs,
  useConfirm,
  useToast,
  cx,
} from '../components/ui';

export function Usage() {
  const db = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const [window, setWindow] = useState<'14' | '30' | 'all'>('14');
  const [filter, setFilter] = useState<'all' | 'errors'>('all');
  const [confirmWipe, setConfirmWipe] = useState(false);

  const rows = useMemo(() => {
    const list = [...db.cinema_ai_usage].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (window === 'all') return list;
    const days = Number(window);
    const cutoff = Date.now() - days * 86_400_000;
    return list.filter((row) => new Date(row.created_at).getTime() >= cutoff);
  }, [db.cinema_ai_usage, window]);

  const summary = useMemo(() => usageSummary(rows, window === 'all' ? 60 : Number(window)), [rows, window]);
  const visible = useMemo(
    () => (filter === 'errors' ? rows.filter((row) => !row.ok) : rows),
    [rows, filter],
  );

  const exportCsv = () => {
    const header = ['created_at', 'provider', 'model', 'prompt_tokens', 'completion_tokens', 'total_tokens', 'latency_ms', 'ok', 'reasoning', 'error'];
    const body = visible.map((row) =>
      [row.created_at, row.provider, row.model, row.prompt_tokens, row.completion_tokens, row.total_tokens, row.latency_ms, row.ok ? 'ok' : 'error', row.reasoning ? 'yes' : 'no', `"${(row.error || '').replace(/"/g, '""')}"`].join(','),
    );
    download('fmc-usage.csv', [header.join(','), ...body].join('\n'), 'text/csv');
    toast.push({ tone: 'success', title: 'Ledger exported', body: `${visible.length} rows` });
  };

  return (
    <>
      <div className="page-head">
        <div className="page-head__copy">
          <div className="eyebrow">Intelligence · local ledger</div>
          <h1 className="page-title">
            Every call, <em>accounted for.</em>
          </h1>
          <p className="page-sub">
            The browser talks to the provider directly. This ledger is the only record: tokens the provider reported,
            latency measured here, failures kept with their error strings.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="outline" icon={<Download size={13} />} onClick={exportCsv}>
            Export CSV
          </Button>
          <Button variant="ghost" icon={<Trash2 size={13} />} onClick={() => setConfirmWipe(true)}>
            Clear ledger
          </Button>
        </div>
      </div>

      <div className="stat-strip" style={{ marginBottom: 'var(--sp-4)' }}>
        <Stat label="Requests" value={n(summary.requests)} icon={<Zap size={11} />} foot={`${summary.ok} ok · ${summary.errors} failed`} />
        <Stat label="Tokens" value={tokens(summary.totalTokens)} icon={<Coins size={11} />} foot={`${tokens(summary.promptTokens)} in · ${tokens(summary.completionTokens)} out`} />
        <Stat label="Avg latency" value={duration(summary.avgLatency)} icon={<Gauge size={11} />} foot="wall clock, measured locally" />
        <Stat label="Reasoning" value={n(summary.reasoningCalls)} icon={<Activity size={11} />} foot="calls that returned thinking" />
      </div>

      <Tabs
        tabs={[
          { id: '14', label: '14 days' },
          { id: '30', label: '30 days' },
          { id: 'all', label: 'All time' },
        ]}
        value={window}
        onChange={(value) => setWindow(value as '14' | '30' | 'all')}
      />

      <div className="dash-grid" style={{ marginTop: 'var(--sp-4)' }}>
        <div className="dash-col">
          <section className="card card--pad">
            <div className="row row--between" style={{ marginBottom: 10 }}>
              <div className="panel-title" style={{ margin: 0 }}>Requests per day</div>
              <Chip mono sm>{summary.successRate.toFixed(1)}% success</Chip>
            </div>
            <Bars data={summary.byDay.map((day) => ({ label: day.label, value: day.requests }))} height={150} />
            <div className="row row--between" style={{ marginTop: 10 }}>
              <span className="faint" style={{ fontSize: 9 }}>{n(summary.promptTokens)} prompt tokens</span>
              <span className="faint" style={{ fontSize: 9 }}>{n(summary.completionTokens)} completion tokens</span>
            </div>
          </section>

          <section className="card">
            <div className="card__head">
              <div className="card__title">Calls</div>
              <div className="filter-row">
                <button className={cx('chip', filter === 'all' && 'is-active')} onClick={() => setFilter('all')}>all</button>
                <button className={cx('chip', filter === 'errors' && 'is-active')} onClick={() => setFilter('errors')}>failures</button>
              </div>
            </div>
            <div className="table-wrap" style={{ border: 0, borderRadius: 0, maxHeight: 480 }}>
              <table className="table table--sm">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Model</th>
                    <th className="num">In</th>
                    <th className="num">Out</th>
                    <th className="num">Latency</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.slice(0, 120).map((row) => (
                    <tr key={row.id}>
                      <td className="mono" style={{ fontSize: 9 }}>{row.created_at.slice(5, 16).replace('T', ' ')}</td>
                      <td>
                        <span className="mono" style={{ fontSize: 9 }}>{row.model}</span>
                        {getModelInfo(row.model)?.name && <span className="faint" style={{ display: 'block', fontSize: 8.5 }}>{getModelInfo(row.model)?.name}</span>}
                      </td>
                      <td className="num">{tokens(row.prompt_tokens)}</td>
                      <td className="num">{tokens(row.completion_tokens)}</td>
                      <td className="num">{duration(row.latency_ms)}</td>
                      <td>
                        {row.ok ? (
                          <Chip sm mono tone="accent">ok</Chip>
                        ) : (
                          <span title={row.error}>
                            <Chip sm mono tone="hate">error</Chip>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!visible.length && (
                    <tr>
                      <td colSpan={6}>
                        <div style={{ padding: 24 }}>
                          <EmptyState icon={<Zap size={20} />} title="No calls recorded" text="Run an AI action or a thread. Every request lands here with its real usage." />
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="dash-col">
          <section className="card card--pad">
            <div className="panel-title">By model</div>
            <div className="stack stack--tight">
              {summary.byModel.map((entry) => (
                <div key={entry.model} className="stack stack--tight" style={{ gap: 4 }}>
                  <div className="row row--between">
                    <span className="mono" style={{ fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.model.split('/').pop()}</span>
                    <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)' }}>{tokens(entry.tokens)}</span>
                  </div>
                  <span className="meter meter--thin">
                    <span
                      className="meter__fill"
                      style={{ display: 'block', width: `${(entry.requests / Math.max(...summary.byModel.map((item) => item.requests), 1)) * 100}%` }}
                    />
                  </span>
                  <span className="faint" style={{ fontSize: 8.5 }}>
                    {entry.requests} calls · {duration(entry.avgLatency)} avg · {entry.successRate.toFixed(0)}% ok
                  </span>
                </div>
              ))}
              {!summary.byModel.length && <span className="faint" style={{ fontSize: 10 }}>Nothing yet.</span>}
            </div>
          </section>

          <section className="card card--pad">
            <div className="panel-title">Failure kinds</div>
            <div className="stack stack--tight">
              {summary.errorKinds.map((kind) => (
                <div key={kind.label} className="row row--between">
                  <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-2)' }}>{kind.label}</span>
                  <Chip sm mono tone="hate">{kind.value}</Chip>
                </div>
              ))}
              {!summary.errorKinds.length && <span className="faint" style={{ fontSize: 10 }}>No failures in this window.</span>}
            </div>
          </section>

          <section className="card card--pad">
            <div className="panel-title">Cost</div>
            <p style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-3)', lineHeight: 1.7 }}>
              Token pricing is not assumed. Free-tier models report zero cost; paid models are shown by the provider
              only when it returns a price. This app never estimates currency.
            </p>
            <div className="row row--between" style={{ marginTop: 8 }}>
              <span className="faint" style={{ fontSize: 10 }}>recorded cost</span>
              <Chip mono sm>0.00 USD</Chip>
            </div>
          </section>
        </aside>
      </div>

      {confirmWipe && (
        <Modal
          title="Clear the ledger?"
          subtitle={`${db.cinema_ai_usage.length} call records`}
          onClose={() => setConfirmWipe(false)}
          size="sm"
          actions={
            <>
              <Button variant="ghost" onClick={() => setConfirmWipe(false)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => {
                  removeRows('cinema_ai_usage', db.cinema_ai_usage.map((row) => row.id));
                  setConfirmWipe(false);
                  toast.push({ tone: 'warn', title: 'Ledger cleared' });
                }}
              >
                Clear ledger
              </Button>
            </>
          }
        >
          <p className="muted" style={{ fontSize: 'var(--fs-xs)', lineHeight: 1.7 }}>
            Threads, turns and archived request bodies are not touched. Only the usage rows are removed.
          </p>
        </Modal>
      )}
    </>
  );
}
