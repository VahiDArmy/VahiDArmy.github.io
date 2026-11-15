/** Screenings, watch parties, and the calendar that holds them. */

import { useMemo, useState } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import { navigate } from '../app/router';
import { insertRow, removeRow, useDb } from '../data/store';
import { SEED_EVENT_KINDS } from '../components/constants';
import { relativeDay } from '../lib/format-extra';
import {
  Button,
  Chip,
  EmptyState,
  Field,
  Input,
  MiniPoster,
  Modal,
  Select,
  Stat,
  Textarea,
  useToast,
  cx,
} from '../components/ui';

export function Events() {
  const db = useDb();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [draft, setDraft] = useState({
    title_id: '',
    kind: 'screening',
    starts_at: new Date(Date.now() + 86_400_000).toISOString().slice(0, 16),
    location: '',
    note: '',
  });

  const cursor = new Date();
  cursor.setMonth(cursor.getMonth() + monthOffset);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startWeekday = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = useMemo(() => {
    const list: Array<{ date: Date | null; events: typeof db.cinema_events }> = [];
    for (let index = 0; index < startWeekday; index += 1) list.push({ date: null, events: [] });
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const key = date.toISOString().slice(0, 10);
      list.push({
        date,
        events: db.cinema_events.filter((event) => event.starts_at.slice(0, 10) === key),
      });
    }
    return list;
  }, [db.cinema_events, year, month, startWeekday, daysInMonth]);

  const upcoming = useMemo(
    () =>
      [...db.cinema_events]
        .filter((event) => new Date(event.starts_at).getTime() >= Date.now() - 3_600_000)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [db.cinema_events],
  );
  const past = useMemo(
    () =>
      [...db.cinema_events]
        .filter((event) => new Date(event.starts_at).getTime() < Date.now() - 3_600_000)
        .sort((a, b) => b.starts_at.localeCompare(a.starts_at)),
    [db.cinema_events],
  );

  const add = () => {
    insertRow('cinema_events', {
      title_id: draft.title_id || null,
      kind: draft.kind,
      starts_at: new Date(draft.starts_at).toISOString(),
      location: draft.location,
      note: draft.note,
    } as never);
    setAdding(false);
    toast.push({ tone: 'success', title: 'Screening scheduled' });
  };

  return (
    <>
      <div className="page-head">
        <div className="page-head__copy">
          <div className="eyebrow">Planning · {upcoming.length} ahead</div>
          <h1 className="page-title">
            Put it in the <em>calendar.</em>
          </h1>
          <p className="page-sub">
            A film watched alone is a screening too. Schedule the ones you want to be present for.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setAdding(true)}>
            Schedule a screening
          </Button>
        </div>
      </div>

      <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', marginBottom: 'var(--sp-4)' }}>
        <Stat label="Ahead" value={upcoming.length} icon={<CalendarDays size={11} />} />
        <Stat label="Logged" value={db.cinema_events.length} foot="all time" />
        <Stat label="Next" value={upcoming[0] ? relativeDay(upcoming[0].starts_at) : '—'} foot={upcoming[0]?.kind || 'nothing'} />
      </div>

      <div className="split">
        <div className="card card--pad">
          <div className="row row--between" style={{ marginBottom: 10 }}>
            <div className="row" style={{ gap: 6 }}>
              <button className="icon-btn icon-btn--sm" onClick={() => setMonthOffset((value) => value - 1)}>←</button>
              <strong style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', fontWeight: 400 }}>
                {cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </strong>
              <button className="icon-btn icon-btn--sm" onClick={() => setMonthOffset((value) => value + 1)}>→</button>
            </div>
            <button className="section-link" onClick={() => setMonthOffset(0)}>today</button>
          </div>
          <div className="month-grid">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div className="month-dow" key={day}>{day}</div>
            ))}
            {cells.map((cell, index) => {
              const isToday = cell.date?.toDateString() === new Date().toDateString();
              return (
                <div key={index} className={cx('month-cell', !cell.date && 'is-out', isToday && 'is-today')}>
                  {cell.date && <span className="month-cell__num">{cell.date.getDate()}</span>}
                  {cell.events.slice(0, 2).map((event) => {
                    const title = db.cinema_titles.find((entry) => entry.id === event.title_id);
                    return (
                      <button
                        key={event.id}
                        className="month-event"
                        onClick={() => title && navigate('title', title.id)}
                        title={`${title?.title || event.kind} · ${event.location}`}
                      >
                        {title?.title || event.kind}
                      </button>
                    );
                  })}
                  {cell.events.length > 2 && <span className="mono faint" style={{ fontSize: 8 }}>+{cell.events.length - 2}</span>}
                </div>
              );
            })}
          </div>
        </div>

        <aside className="stack">
          <div className="card card--pad">
            <div className="panel-title">Next up</div>
            {upcoming.length ? (
              upcoming.slice(0, 5).map((event) => {
                const title = db.cinema_titles.find((entry) => entry.id === event.title_id);
                return (
                  <div className="event-row" key={event.id}>
                    <div className="event-date">
                      <b>{new Date(event.starts_at).getDate()}</b>
                      <span>{new Date(event.starts_at).toLocaleDateString('en-GB', { month: 'short' })}</span>
                    </div>
                    <div className="event-body" style={{ flex: 1 }}>
                      <strong>{title?.title || event.kind}</strong>
                      <p>
                        {event.location || 'location TBC'} ·{' '}
                        {new Date(event.starts_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button className="icon-btn icon-btn--sm" onClick={() => removeRow('cinema_events', event.id)} aria-label="Delete event">
                      ×
                    </button>
                  </div>
                );
              })
            ) : (
              <p className="faint" style={{ fontSize: 10 }}>Nothing scheduled.</p>
            )}
          </div>

          {past.length > 0 && (
            <div className="card card--pad">
              <div className="panel-title">Screened</div>
              {past.slice(0, 4).map((event) => {
                const title = db.cinema_titles.find((entry) => entry.id === event.title_id);
                return (
                  <div className="mini-row" key={event.id}>
                    {title ? <MiniPoster title={title.title} category={title.category} /> : <span className="dot" />}
                    <span className="mini-row__title">{title?.title || event.kind}</span>
                    <span className="mini-row__meta">{relativeDay(event.starts_at)}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="card card--pad">
            <div className="panel-title">Rooms</div>
            <div className="stack stack--tight">
              {Array.from(new Set(db.cinema_events.map((event) => event.location).filter(Boolean))).map((location) => (
                <div className="mini-row" key={location}>
                  <span className="mini-row__title">{location}</span>
                  <span className="mini-row__meta">{db.cinema_events.filter((event) => event.location === location).length}</span>
                </div>
              ))}
              {!db.cinema_events.some((event) => event.location) && <span className="faint" style={{ fontSize: 10 }}>No rooms recorded.</span>}
            </div>
          </div>
        </aside>
      </div>

      {upcoming.length === 0 && (
        <div style={{ marginTop: 'var(--sp-4)' }}>
          <EmptyState
            icon={<CalendarDays size={22} />}
            title="Nothing in the diary"
            text="Schedule one screening this month. A date makes the intention real."
            action={<Button variant="primary" onClick={() => setAdding(true)}>Schedule one</Button>}
          />
        </div>
      )}

      {adding && (
        <Modal
          title="Schedule a screening"
          icon={<CalendarDays size={16} />}
          onClose={() => setAdding(false)}
          size="md"
          actions={
            <>
              <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              <Button variant="primary" onClick={add}>Add to calendar</Button>
            </>
          }
        >
          <div className="stack">
            <Field label="Title">
              <Select value={draft.title_id} onChange={(event) => setDraft((current) => ({ ...current, title_id: event.target.value }))}>
                <option value="">No specific title</option>
                {db.cinema_titles.map((title) => (
                  <option key={title.id} value={title.id}>{title.title}</option>
                ))}
              </Select>
            </Field>
            <div className="cols-2">
              <Field label="Kind">
                <Select value={draft.kind} onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value }))}>
                  {SEED_EVENT_KINDS.map((kind) => (
                    <option key={kind} value={kind}>{kind}</option>
                  ))}
                </Select>
              </Field>
              <Field label="When">
                <Input type="datetime-local" value={draft.starts_at} onChange={(event) => setDraft((current) => ({ ...current, starts_at: event.target.value }))} />
              </Field>
            </div>
            <Field label="Location">
              <Input value={draft.location} onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))} placeholder="Living room · Cinema Rex" />
            </Field>
            <Field label="Note">
              <Textarea value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Print, format, who is coming, phones in the bowl." />
            </Field>
            {draft.title_id && (
              <div className="row" style={{ gap: 8 }}>
                <MiniPoster
                  title={db.cinema_titles.find((title) => title.id === draft.title_id)?.title || ''}
                  category={db.cinema_titles.find((title) => title.id === draft.title_id)?.category || 'good'}
                />
                <Chip sm mono>
                  {relativeDay(draft.starts_at)}
                </Chip>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
