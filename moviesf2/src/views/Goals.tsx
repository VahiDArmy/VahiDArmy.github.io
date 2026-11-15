/** Annual targets, measured without mercy. */

import { useMemo, useState } from 'react';
import { ArrowRight, CalendarCheck, Plus, Target } from 'lucide-react';
import { navigate } from '../app/router';
import { insertRow, updateRow, useDb } from '../data/store';
import { goalProgress, monthlyActivity } from '../data/queries';
import { hoursLabel, n } from '../lib/format-extra';
import {
  Bars,
  Button,
  Chip,
  EmptyState,
  Field,
  Input,
  Meter,
  ProgressRing,
  Stat,
  useToast,
} from '../components/ui';

export function Goals() {
  const db = useDb();
  const toast = useToast();
  const year = new Date().getFullYear();
  const goal = db.cinema_goals.find((entry) => entry.year === year) || db.cinema_goals[0];
  const [editing, setEditing] = useState(!goal);
  const [draft, setDraft] = useState({
    year: goal?.year || year,
    target_titles: goal?.target_titles || 40,
    target_minutes: goal?.target_minutes || 6000,
    target_rating_avg: goal?.target_rating_avg || 8,
  });

  const progress = useMemo(() => goalProgress(db, goal), [db, goal]);
  const months = useMemo(() => monthlyActivity(db, 12), [db]);

  const years = useMemo(() => {
    const map = new Map<string, { titles: number; minutes: number; ratings: number[] }>();
    for (const title of db.cinema_titles) {
      if (!title.watched_date) continue;
      const key = title.watched_date.slice(0, 4);
      const entry = map.get(key) || { titles: 0, minutes: 0, ratings: [] };
      entry.titles += 1;
      if (title.rating) entry.ratings.push(title.rating);
      map.set(key, entry);
    }
    for (const session of db.cinema_watch_sessions) {
      const key = session.watched_at.slice(0, 4);
      const entry = map.get(key) || { titles: 0, minutes: 0, ratings: [] };
      entry.minutes += session.minutes;
      map.set(key, entry);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [db]);

  const monthsLeft = 12 - new Date().getMonth();
  const titlesNeeded = goal ? Math.max(0, goal.target_titles - progress.titles) : 0;
  const perMonth = monthsLeft ? titlesNeeded / monthsLeft : titlesNeeded;

  const save = () => {
    if (goal) {
      updateRow('cinema_goals', goal.id, {
        year: draft.year,
        target_titles: draft.target_titles,
        target_minutes: draft.target_minutes,
        target_rating_avg: draft.target_rating_avg,
      });
      toast.push({ tone: 'success', title: 'Goal updated' });
    } else {
      insertRow('cinema_goals', {
        year: draft.year,
        target_titles: draft.target_titles,
        target_minutes: draft.target_minutes,
        target_rating_avg: draft.target_rating_avg,
        progress: 0,
      } as never);
      toast.push({ tone: 'success', title: 'Goal created' });
    }
    setEditing(false);
  };

  if (!goal && !editing) {
    return (
      <EmptyState
        icon={<Target size={22} />}
        title="No goal set"
        text="A target is a decision about attention. Pick a number you would be embarrassed to miss."
        action={<Button variant="primary" onClick={() => setEditing(true)}>Set a goal</Button>}
      />
    );
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head__copy">
          <div className="eyebrow">Planning · {goal?.year || year}</div>
          <h1 className="page-title">
            A number you can <em>argue with.</em>
          </h1>
          <p className="page-sub">
            Goals are not quotas. They are a way of noticing when the year has quietly become something else.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="outline" onClick={() => setEditing((value) => !value)}>
            {editing ? 'Close editor' : 'Edit targets'}
          </Button>
          <Button variant="ghost" icon={<ArrowRight size={13} />} onClick={() => navigate('challenges')}>
            Challenges
          </Button>
        </div>
      </div>

      <section className="goal-hero">
        <div className="goal-rings">
          <ProgressRing value={progress.titlesPct} size={96} stroke={7} label={`${Math.round(progress.titlesPct)}%`} />
          <div className="stack stack--tight" style={{ justifyContent: 'center' }}>
            <span className="eyebrow eyebrow--plain">Titles</span>
            <div className="big-number" style={{ fontSize: 42 }}>
              {progress.titles}
              <span>/ {goal?.target_titles}</span>
            </div>
            <span className="mono faint" style={{ fontSize: 9 }}>
              {titlesNeeded} to go · {perMonth.toFixed(1)} / month
            </span>
          </div>
        </div>
        <div className="stack" style={{ gap: 14 }}>
          <div>
            <div className="meter-label">
              <span>Minutes</span>
              <span>
                {n(progress.minutes)} / {n(goal?.target_minutes || 0)}
              </span>
            </div>
            <Meter value={progress.minutesPct} thick />
          </div>
          <div>
            <div className="meter-label">
              <span>Average rating</span>
              <span>
                {progress.avgRating.toFixed(2)} / {goal?.target_rating_avg || '—'}
              </span>
            </div>
            <Meter value={progress.ratingPct} thick tone="good" />
          </div>
          <div className="row row--between row--wrap">
            <Chip mono sm>{hoursLabel(progress.minutes)} projected</Chip>
            <Chip mono sm>{db.cinema_watch_sessions.filter((session) => session.watched_at.startsWith(String(goal?.year || year))).length} sessions</Chip>
            <Chip mono sm tone="accent">{monthsLeft} months left</Chip>
          </div>
        </div>
      </section>

      {editing && (
        <div className="card card--pad" style={{ marginTop: 'var(--sp-4)' }}>
          <div className="panel-title">
            <Target size={11} /> Targets
          </div>
          <div className="cols-4">
            <Field label="Year">
              <Input type="number" value={draft.year} onChange={(event) => setDraft((current) => ({ ...current, year: Number(event.target.value) }))} />
            </Field>
            <Field label="Titles">
              <Input type="number" value={draft.target_titles} onChange={(event) => setDraft((current) => ({ ...current, target_titles: Number(event.target.value) }))} />
            </Field>
            <Field label="Minutes">
              <Input type="number" value={draft.target_minutes} onChange={(event) => setDraft((current) => ({ ...current, target_minutes: Number(event.target.value) }))} />
            </Field>
            <Field label="Average rating">
              <Input type="number" step="0.1" value={draft.target_rating_avg} onChange={(event) => setDraft((current) => ({ ...current, target_rating_avg: Number(event.target.value) }))} />
            </Field>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <Button variant="primary" onClick={save}>Save targets</Button>
          </div>
        </div>
      )}

      <div className="dash-grid" style={{ marginTop: 'var(--sp-5)' }}>
        <div className="dash-col">
          <section className="card card--pad">
            <div className="panel-title">Pace across the year</div>
            <Bars data={months.map((month) => ({ label: month.label, value: month.titles }))} height={130} />
            <p className="faint" style={{ fontSize: 10, marginTop: 8 }}>
              Titles finished per month. The goal needs {perMonth.toFixed(1)} per month for the rest of the year.
            </p>
          </section>

          <section className="card">
            <div className="card__head">
              <div className="card__title">
                <CalendarCheck size={13} /> Year by year
              </div>
              <Chip mono sm>{years.length} years recorded</Chip>
            </div>
            <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th className="num">Titles</th>
                    <th className="num">Minutes</th>
                    <th className="num">Avg score</th>
                    <th>Bar</th>
                  </tr>
                </thead>
                <tbody>
                  {years.map(([label, value]) => {
                    const max = Math.max(...years.map(([, entry]) => entry.titles), 1);
                    return (
                      <tr key={label}>
                        <td><strong>{label}</strong></td>
                        <td className="num">{value.titles}</td>
                        <td className="num">{n(value.minutes)}</td>
                        <td className="num">
                          {value.ratings.length
                            ? (value.ratings.reduce((total, rating) => total + rating, 0) / value.ratings.length).toFixed(1)
                            : '—'}
                        </td>
                        <td>
                          <span className="meter" style={{ height: 4 }}>
                            <span className="meter__fill" style={{ display: 'block', width: `${(value.titles / max) * 100}%` }} />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="dash-col">
          <section className="card card--pad">
            <div className="panel-title">Milestones</div>
            <div className="stack">
              {[25, 50, 75, 100].map((milestone) => {
                const reached = progress.titlesPct >= milestone;
                return (
                  <div className="row" key={milestone} style={{ gap: 9 }}>
                    <span
                      className="timeline__dot"
                      style={{
                        borderColor: reached ? 'var(--accent)' : 'var(--border-2)',
                        color: reached ? 'var(--accent)' : 'var(--text-4)',
                        background: reached ? 'var(--accent-soft)' : 'var(--bg-2)',
                      }}
                    >
                      {reached ? '✓' : milestone}
                    </span>
                    <span style={{ fontSize: 'var(--fs-xs)', color: reached ? 'var(--text-1)' : 'var(--text-3)' }}>
                      {milestone}% — {Math.ceil(((goal?.target_titles || 0) * milestone) / 100)} titles
                    </span>
                    {reached && <Chip sm mono tone="accent" >done</Chip>}
                  </div>
                );
              })}
            </div>
          </section>
          <section className="card card--pad">
            <div className="panel-title">Read the shape</div>
            <ul className="stack stack--tight" style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-3)', lineHeight: 1.65 }}>
              <li>
                {progress.minutes > 0 && progress.titles > 0
                  ? `Average viewing: ${Math.round(progress.minutes / progress.titles)} minutes per title.`
                  : 'No viewing logged this year yet.'}
              </li>
              <li>
                {progress.avgRating >= (goal?.target_rating_avg || 0)
                  ? 'The average is above target. Either a good year or a forgiving eye.'
                  : 'The average is below target. That is allowed; it is a record, not a grade.'}
              </li>
              <li>{titlesNeeded === 0 ? 'Target met. Anything now is surplus.' : `${titlesNeeded} titles remain.`}</li>
            </ul>
          </section>
          <section className="card card--pad">
            <div className="panel-title">Quick add</div>
            <Button block variant="outline" icon={<Plus size={13} />} onClick={() => navigate('library')}>
              Log a film from the shelf
            </Button>
          </section>
        </aside>
      </div>
    </>
  );
}
