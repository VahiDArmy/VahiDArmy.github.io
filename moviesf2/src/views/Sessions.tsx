/** Every viewing, every mood, every device. */

import { useMemo, useState } from 'react';
import { Clock3, Plus, Trash2 } from 'lucide-react';
import { navigate } from '../app/router';
import { insertRow, removeRow, useDb } from '../data/store';
import { monthlyActivity, viewingHeatmap, weekdayProfile } from '../data/queries';
import { SEED_DEVICES, SEED_MOODS } from '../components/constants';
import { dateLabel, hoursLabel, n, timeOnly } from '../lib/format-extra';
import {
  Bars,
  Button,
  Chip,
  EmptyState,
  Field,
  Heatmap,
  Input,
  MiniPoster,
  Modal,
  Select,
  Stat,
  Textarea,
  useToast,
} from '../components/ui';

export function Sessions() {
  const db = useDb();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState('');
  const [moodFilter, setMoodFilter] = useState('all');
  const [draft, setDraft] = useState({
    title_id: '',
    watched_at: new Date().toISOString().slice(0, 16),
    minutes: 0,
    mood: 'focused',
    device: 'projector',
    note: '',
    season: '',
    episode: '',
  });

  const sessions = useMemo(
    () =>
      [...db.cinema_watch_sessions]
        .sort((a, b) => b.watched_at.localeCompare(a.watched_at))
        .filter((session) => {
          const title = db.cinema_titles.find((entry) => entry.id === session.title_id);
          if (moodFilter !== 'all' && session.mood !== moodFilter) return false;
          if (!filter.trim()) return true;
          return `${title?.title || ''} ${session.note} ${session.device}`.toLowerCase().includes(filter.toLowerCase());
        }),
    [db, filter, moodFilter],
  );

  const totalMinutes = db.cinema_watch_sessions.reduce((total, session) => total + session.minutes, 0);
  const avg = db.cinema_watch_sessions.length ? totalMinutes / db.cinema_watch_sessions.length : 0;
  const months = monthlyActivity(db, 12);
  const weekdays = weekdayProfile(db);
  const heat = viewingHeatmap(db);
  const moods = useMemo(() => {
    const map = new Map<string, number>();
    for (const session of db.cinema_watch_sessions) map.set(session.mood, (map.get(session.mood) || 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [db.cinema_watch_sessions]);
  const devices = useMemo(() => {
    const map = new Map<string, number>();
    for (const session of db.cinema_watch_sessions) map.set(session.device, (map.get(session.device) || 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [db.cinema_watch_sessions]);

  const grouped = useMemo(() => {
    const buckets = new Map<string, typeof sessions>();
    for (const session of sessions) {
      const key = session.watched_at.slice(0, 7);
      const list = buckets.get(key) || [];
      list.push(session);
      buckets.set(key, list);
    }
    return Array.from(buckets.entries());
  }, [sessions]);

  const add = () => {
    if (!draft.title_id) return;
    insertRow('cinema_watch_sessions', {
      title_id: draft.title_id,
      season: draft.season ? Number(draft.season) : null,
      episode: draft.episode ? Number(draft.episode) : null,
      minutes: Number(draft.minutes) || 0,
      mood: draft.mood,
      device: draft.device,
      note: draft.note,
      watched_at: new Date(draft.watched_at).toISOString(),
    } as never);
    setAdding(false);
    toast.push({ tone: 'success', title: 'Session logged' });
  };

  return (
    <>
      <div className="page-head">
        <div className="page-head__copy">
          <div className="eyebrow">Screen · {db.cinema_watch_sessions.length} sessions</div>
          <h1 className="page-title">
            Time, actually <em>spent.</em>
          </h1>
          <p className="page-sub">
            A session is a fact: a date, a duration, a device, a mood. The shelf is opinion; this is evidence.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setAdding(true)}>
            Log a session
          </Button>
        </div>
      </div>

      <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))', marginBottom: 'var(--sp-4)' }}>
        <Stat label="Total" value={hoursLabel(totalMinutes)} icon={<Clock3 size={11} />} foot={`${n(totalMinutes)} minutes`} />
        <Stat label="Sessions" value={n(db.cinema_watch_sessions.length)} foot={`${n(db.cinema_titles.length)} titles`} />
        <Stat label="Average" value={`${Math.round(avg)}m`} foot="per sitting" />
        <Stat label="Top device" value={devices[0]?.[0] || '—'} foot={`${devices[0]?.[1] || 0} sessions`} />
      </div>

      <div className="split">
        <div className="stack" style={{ minWidth: 0 }}>
          <section className="card card--pad">
            <div className="row row--between row--wrap" style={{ marginBottom: 10 }}>
              <div className="panel-title" style={{ marginBottom: 0 }}>
                <Clock3 size={11} /> The log
              </div>
              <div className="row" style={{ gap: 6 }}>
                <Input
                  className="input input--sm"
                  placeholder="Search sessions…"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  style={{ width: 170 }}
                />
                <Select className="select select--sm" value={moodFilter} onChange={(event) => setMoodFilter(event.target.value)}>
                  <option value="all">all moods</option>
                  {SEED_MOODS.map((mood) => (
                    <option key={mood} value={mood}>{mood}</option>
                  ))}
                </Select>
              </div>
            </div>

            {sessions.length ? (
              grouped.map(([month, group]) => (
                <div key={month} style={{ marginBottom: 18 }}>
                  <div className="shelf-ribbon">
                    <span>{new Date(`${month}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
                    <span className="value">{group.length} sessions · {group.reduce((total, session) => total + session.minutes, 0)}m</span>
                  </div>
                  {group.map((session) => {
                    const title = db.cinema_titles.find((entry) => entry.id === session.title_id);
                    return (
                      <div className="session-item" key={session.id}>
                        <div className="session-date">
                          <b>{new Date(session.watched_at).getDate()}</b>
                          <span>{new Date(session.watched_at).toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                        </div>
                        <div className="session-body">
                          <div className="row" style={{ gap: 7 }}>
                            {title && <MiniPoster title={title.title} category={title.category} />}
                            <div style={{ minWidth: 0 }}>
                              <button onClick={() => title && navigate('title', title.id)}>
                                <strong>{title?.title || 'Unknown title'}</strong>
                              </button>
                              <p>
                                {session.mood} · {session.device} · {timeOnly(session.watched_at)}
                                {session.season ? ` · S${session.season}E${session.episode || '?'}` : ''}
                              </p>
                              {session.note && <p style={{ color: 'var(--text-3)' }}>{session.note}</p>}
                            </div>
                          </div>
                        </div>
                        <div className="row" style={{ gap: 5 }}>
                          <Chip sm mono>{session.minutes}m</Chip>
                          <button className="icon-btn icon-btn--sm" onClick={() => removeRow('cinema_watch_sessions', session.id)} aria-label="Delete session">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            ) : (
              <EmptyState title="No sessions match" text="Clear the filters or log a new viewing." />
            )}
          </section>
        </div>

        <aside className="stack">
          <section className="card card--pad">
            <div className="panel-title">Sessions by month</div>
            <Bars data={months.map((month) => ({ label: month.label, value: month.sessions }))} height={92} />
          </section>
          <section className="card card--pad">
            <div className="panel-title">When you watch</div>
            <Bars data={weekdays} height={78} format={(value) => `${value} min`} />
            <p className="faint" style={{ fontSize: 9.5, marginTop: 6 }}>Minutes by weekday.</p>
          </section>
          <section className="card card--pad">
            <div className="panel-title">Moods</div>
            <div className="stack stack--tight">
              {moods.slice(0, 6).map(([mood, count]) => (
                <div className="mini-row" key={mood}>
                  <span className="mini-row__title">{mood}</span>
                  <span className="meter" style={{ width: 80, height: 3 }}>
                    <span className="meter__fill" style={{ display: 'block', width: `${(count / Math.max(1, db.cinema_watch_sessions.length)) * 100}%` }} />
                  </span>
                  <span className="mini-row__meta">{count}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="card card--pad">
            <div className="panel-title">The long view</div>
            <Heatmap cells={heat.map((cell) => ({ ...cell, level: cell.level as 0 | 1 | 2 | 3 | 4 }))} />
          </section>
        </aside>
      </div>

      {adding && (
        <Modal
          title="Log a session"
          subtitle="A fact for the ledger."
          icon={<Clock3 size={16} />}
          onClose={() => setAdding(false)}
          size="md"
          actions={
            <>
              <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              <Button variant="primary" onClick={add}>Save session</Button>
            </>
          }
        >
          <div className="stack">
            <Field label="Title">
              <Select value={draft.title_id} onChange={(event) => setDraft((current) => ({ ...current, title_id: event.target.value }))}>
                <option value="">Choose…</option>
                {db.cinema_titles.map((title) => (
                  <option key={title.id} value={title.id}>
                    {title.title} ({title.year || '—'})
                  </option>
                ))}
              </Select>
            </Field>
            <div className="cols-2">
              <Field label="When">
                <Input type="datetime-local" value={draft.watched_at} onChange={(event) => setDraft((current) => ({ ...current, watched_at: event.target.value }))} />
              </Field>
              <Field label="Minutes">
                <Input type="number" value={draft.minutes} onChange={(event) => setDraft((current) => ({ ...current, minutes: Number(event.target.value) }))} />
              </Field>
            </div>
            <div className="cols-2">
              <Field label="Season">
                <Input type="number" value={draft.season} onChange={(event) => setDraft((current) => ({ ...current, season: event.target.value }))} />
              </Field>
              <Field label="Episode">
                <Input type="number" value={draft.episode} onChange={(event) => setDraft((current) => ({ ...current, episode: event.target.value }))} />
              </Field>
            </div>
            <div className="cols-2">
              <Field label="Mood">
                <Select value={draft.mood} onChange={(event) => setDraft((current) => ({ ...current, mood: event.target.value }))}>
                  {SEED_MOODS.map((mood) => (
                    <option key={mood} value={mood}>{mood}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Device">
                <Select value={draft.device} onChange={(event) => setDraft((current) => ({ ...current, device: event.target.value }))}>
                  {SEED_DEVICES.map((device) => (
                    <option key={device} value={device}>{device}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Note">
              <Textarea value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} />
            </Field>
          </div>
        </Modal>
      )}
    </>
  );
}
