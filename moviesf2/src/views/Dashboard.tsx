/** The room where the shelf introduces itself. */

import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Film,
  Flame,
  Layers,
  Plus,
  Sparkles,
  Star,
  Target,
  TerminalSquare,
  TrendingUp,
} from 'lucide-react';
import { navigate } from '../app/router';
import { useDb } from '../data/store';
import { useSettings, hasApiKey } from '../data/settings';
import {
  axisAverages,
  collectionsForTitle,
  goalProgress,
  monthlyActivity,
  recentTitles,
  shelfSummary,
  tagStats,
  tastePolarity,
  topRated,
  upcomingEvents,
  usageSummary,
  viewingHeatmap,
  viewingStreak,
  watchlistFor,
} from '../data/queries';
import { hoursLabel, n, relative, runtime, shortDate, tokens } from '../lib/format';
import { TitleForm } from '../components/TitleForm';
import {
  Avatar,
  Bars,
  Button,
  CategoryChip,
  Chip,
  Donut,
  EmptyState,
  Heatmap,
  IconButton,
  Meter,
  MiniPoster,
  Notice,
  Poster,
  ProgressRing,
  SectionHead,
  Sparkline,
  Stat,
  Stars,
  Tag,
  cx,
} from '../components/ui';

export function Dashboard() {
  const db = useDb();
  const settings = useSettings();
  const [adding, setAdding] = useState(false);
  const summary = useMemo(() => shelfSummary(db), [db]);
  const tone = useMemo(() => tastePolarity(db), [db]);
  const months = useMemo(() => monthlyActivity(db, 12), [db]);
  const heat = useMemo(() => viewingHeatmap(db), [db]);
  const streak = useMemo(() => viewingStreak(db), [db]);
  const tags = useMemo(() => tagStats(db).slice(0, 14), [db]);
  const axes = useMemo(() => axisAverages(db), [db]);
  const usage = useMemo(() => usageSummary(db.cinema_ai_usage, 14), [db.cinema_ai_usage]);
  const goal = db.cinema_goals[0];
  const progress = useMemo(() => goalProgress(db, goal), [db, goal]);
  const watching = db.cinema_titles.find((title) => title.status === 'watching') || db.cinema_titles[0];
  const recent = useMemo(() => recentTitles(db, 6), [db]);
  const best = useMemo(() => topRated(db, 5), [db]);
  const events = useMemo(() => upcomingEvents(db, 3), [db]);
  const queue = db.cinema_watchlist.filter((item) => !item.done).slice(0, 4);
  const keyPresent = hasApiKey();

  const lastSession = db.cinema_watch_sessions
    .slice()
    .sort((a, b) => b.watched_at.localeCompare(a.watched_at))[0];
  const lastSessionTitle = lastSession ? db.cinema_titles.find((title) => title.id === lastSession.title_id) : null;

  const monthMinutes = months[months.length - 1]?.minutes || 0;

  return (
    <>
      <section className="hero">
        <div className="hero__copy">
          <div className="hero__kicker">
            <span>{new Date().toLocaleDateString('en-GB', { weekday: 'long' })}</span>
            <span>room 01 · projection</span>
            <span>{summary.total} entries</span>
          </div>
          <h1 className="hero__title">
            The shelf
            <br />
            <em>remembers.</em>
          </h1>
          <p className="hero__sub">
            {summary.loved} films you love, {summary.good} you respect, {summary.hated} you would happily never
            defend. <b>{hoursLabel(summary.minutes)}</b> of projected time, catalogued by hand, argued about by a
            direct model that never sees your key leave this browser.
          </p>
          <div className="hero__actions">
            <Button variant="primary" size="lg" icon={<Plus size={15} />} onClick={() => setAdding(true)}>
              Add an entry
            </Button>
            <Button size="lg" variant="outline" icon={<TerminalSquare size={15} />} onClick={() => navigate('studio')}>
              Open the booth
            </Button>
            <Button size="lg" variant="ghost" icon={<Film size={15} />} onClick={() => navigate('library')}>
              Browse shelf
            </Button>
          </div>
        </div>
        <aside className="hero__aside">
          <div className="hero__reel">
            <i /> projector running · {months[months.length - 1]?.sessions || 0} sessions this month
          </div>
          <div className="hero__stat">
            <span>Average score</span>
            <b className="accent">{summary.avgRating.toFixed(1)}</b>
          </div>
          <div className="hero__stat">
            <span>Loved / hated</span>
            <b>
              {summary.loved} <span style={{ color: 'var(--text-4)', fontSize: 12 }}>/ {summary.hated}</span>
            </b>
          </div>
          <div className="hero__stat">
            <span>Viewing streak</span>
            <b>{streak.current}d</b>
          </div>
          <div className="hero__stat">
            <span>This month</span>
            <b>{hoursLabel(monthMinutes)}</b>
          </div>
          <div className="hero__stat">
            <span>Booth</span>
            <b style={{ color: keyPresent ? 'var(--success)' : 'var(--danger)' }}>
              {keyPresent ? 'direct' : 'no key'}
            </b>
          </div>
        </aside>
      </section>

      <div className="stat-strip">
        <Stat label="Titles" value={n(summary.total)} icon={<Film size={11} />} foot={`${summary.countries} countries`} />
        <Stat label="Minutes" value={hoursLabel(summary.minutes)} icon={<Clock3 size={11} />} foot={`${db.cinema_watch_sessions.length} sessions`} />
        <Stat label="Episodes" value={n(summary.episodes)} icon={<Layers size={11} />} foot={`${summary.languages} languages`} />
        <Stat label="Tags" value={n(summary.tags)} icon={<Sparkles size={11} />} foot="retrieval vocabulary" />
        <Stat
          label="AI calls"
          value={n(usage.requests)}
          icon={<TrendingUp size={11} />}
          foot={`${tokens(usage.totalTokens)} tokens / 14d`}
        />
      </div>

      <div className="dash-grid" style={{ marginTop: 'var(--sp-5)' }}>
        <div className="dash-col">
          <section className="card card--pad pulse-card">
            <div className="pulse-head">
              <div>
                <h3>The year in the dark</h3>
                <p>Minutes projected per month · last twelve</p>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <Chip mono sm>{hoursLabel(summary.minutes)} total</Chip>
                <Chip mono sm tone="accent">{streak.longest}d best streak</Chip>
              </div>
            </div>
            <Bars data={months.map((month) => ({ label: month.label, value: month.minutes }))} height={116} format={(value) => `${value} min`} />
            <div className="row row--between" style={{ marginTop: 4 }}>
              <span className="mono faint" style={{ fontSize: 9 }}>
                {months[0]?.label} → {months[months.length - 1]?.label}
              </span>
              <div className="row" style={{ gap: 10 }}>
                <span className="mono" style={{ fontSize: 9, color: 'var(--text-4)' }}>
                  titles
                </span>
                <Sparkline values={months.map((month) => month.titles)} height={26} />
              </div>
            </div>
          </section>

          <section className="card card--pad">
            <div className="row row--between" style={{ marginBottom: 12 }}>
              <div>
                <h3 className="section-title" style={{ fontSize: 'var(--fs-md)' }}>
                  <Flame size={14} style={{ color: 'var(--accent)' }} /> Viewing heat
                </h3>
                <p className="faint" style={{ fontSize: 10, marginTop: 2 }}>
                  22 weeks of sessions. Darker cells are longer nights.
                </p>
              </div>
              <Chip mono sm>{db.cinema_watch_sessions.length} logs</Chip>
            </div>
            <Heatmap cells={heat.map((cell) => ({ ...cell, level: cell.level as 0 | 1 | 2 | 3 | 4 }))} />
          </section>

          <section className="card">
            <div className="card__head">
              <div className="card__title">
                <Star size={13} /> Highest conviction
              </div>
              <button className="section-link" onClick={() => navigate('ratings')}>
                all ratings <ArrowRight size={10} />
              </button>
            </div>
            <div className="card__body">
              <div className="mini-list">
                {best.map((title, index) => (
                  <button className="mini-row" key={title.id} onClick={() => navigate('title', title.id)} style={{ textAlign: 'left' }}>
                    <span className="mono faint" style={{ width: 14, fontSize: 9 }}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <MiniPoster title={title.title} category={title.category} />
                    <span className="mini-row__title">{title.title}</span>
                    <Stars value={title.rating} />
                    <span className="mini-row__meta">{title.year}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="card card--pad">
            <div className="row row--between" style={{ marginBottom: 12 }}>
              <h3 className="section-title" style={{ fontSize: 'var(--fs-md)' }}>
                <Layers size={14} style={{ color: 'var(--accent)' }} /> Collections
              </h3>
              <button className="section-link" onClick={() => navigate('collections')}>
                open shelves <ArrowRight size={10} />
              </button>
            </div>
            <div className="cols-2">
              {db.cinema_collections.slice(0, 4).map((collection) => {
                const items = db.cinema_collection_items.filter((item) => item.collection_id === collection.id);
                return (
                  <button
                    key={collection.id}
                    className="panel panel--flat"
                    style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 7 }}
                    onClick={() => navigate('collections', collection.id)}
                  >
                    <span className="row" style={{ gap: 7 }}>
                      <span style={{ color: collection.color, fontSize: 15 }}>{collection.icon}</span>
                      <strong style={{ fontSize: 'var(--fs-xs)' }}>{collection.name}</strong>
                      <span className="mono faint" style={{ marginLeft: 'auto', fontSize: 9 }}>
                        {items.length}
                      </span>
                    </span>
                    <span className="faint" style={{ fontSize: 10, lineHeight: 1.5 }}>
                      {collection.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="dash-col">
          <section className="card card--pad">
            <div className="shelf-ribbon">
              <span>Now showing</span>
              <span className="value">{watching?.status || 'idle'}</span>
            </div>
            {watching ? (
              <div className="now-showing">
                <Poster
                  title={watching.title}
                  year={watching.year}
                  category={watching.category}
                  score={watching.rating}
                  favorite={watching.favorite}
                  onClick={() => navigate('title', watching.id)}
                />
                <div className="now-showing__copy">
                  <h4>{watching.title}</h4>
                  <span className="mono faint" style={{ fontSize: 9 }}>
                    {watching.year} · {runtime(watching.runtime)} · {watching.country}
                  </span>
                  <p>{watching.summary || watching.reason || 'No summary yet. The booth can standardise this entry.'}</p>
                  <div className="row" style={{ gap: 5, marginTop: 'auto' }}>
                    <CategoryChip category={watching.category} />
                    {watchlistFor(db, watching.id) && <Chip sm mono>queued</Chip>}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState title="The projector is dark" text="Add a film to begin." />
            )}
            <div className="hairline" style={{ margin: '12px 0' }} />
            <div className="row row--between">
              <span className="eyebrow eyebrow--plain">Last session</span>
              {lastSession ? (
                <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)' }}>
                  {shortDate(lastSession.watched_at)} · {lastSession.minutes}m
                </span>
              ) : null}
            </div>
            {lastSession ? (
              <button
                onClick={() => lastSessionTitle && navigate('title', lastSessionTitle.id)}
                style={{ textAlign: 'left', marginTop: 6, width: '100%' }}
              >
                <strong style={{ fontSize: 'var(--fs-xs)' }}>{lastSessionTitle?.title}</strong>
                <p className="faint" style={{ fontSize: 10, marginTop: 2 }}>
                  {lastSession.mood} · {lastSession.device} {lastSession.note ? `· ${lastSession.note}` : ''}
                </p>
              </button>
            ) : (
              <p className="faint" style={{ fontSize: 10 }}>
                No sessions logged.
              </p>
            )}
          </section>

          <section className="card card--pad">
            <h3 className="section-title" style={{ fontSize: 'var(--fs-md)', marginBottom: 12 }}>
              <Sparkles size={14} style={{ color: 'var(--accent)' }} /> The ratio
            </h3>
            <Donut
              data={[
                { label: 'Love', value: tone.love, color: 'var(--love)' },
                { label: 'Good', value: tone.good, color: 'var(--good)' },
                { label: 'Hate', value: tone.hate, color: 'var(--hate)' },
              ]}
              centerValue={summary.total}
              centerLabel="entries"
            />
            <div className="hairline" style={{ margin: '14px 0 10px' }} />
            <div className="axis-list">
              {axes.map((axis) => (
                <div className="axis-row" key={axis.label}>
                  <span>{axis.label}</span>
                  <span className="axis-bar">
                    <span style={{ width: `${axis.value * 10}%` }} />
                  </span>
                  <b>{axis.value.toFixed(1)}</b>
                </div>
              ))}
            </div>
          </section>

          <section className="card card--pad">
            <div className="row row--between" style={{ marginBottom: 10 }}>
              <h3 className="section-title" style={{ fontSize: 'var(--fs-md)' }}>
                <Target size={14} style={{ color: 'var(--accent)' }} /> {goal?.year || new Date().getFullYear()} goal
              </h3>
              <button className="section-link" onClick={() => navigate('goals')}>
                adjust <ArrowRight size={10} />
              </button>
            </div>
            <div className="row" style={{ gap: 16 }}>
              <ProgressRing value={progress.titlesPct} size={82} label={`${progress.titles}/${goal?.target_titles || 0}`} />
              <div style={{ flex: 1 }}>
                <div className="big-number" style={{ fontSize: 34 }}>
                  {progress.titles}
                  <span>titles</span>
                </div>
                <Meter value={progress.titlesPct} thin label={<><span>progress</span><span>{Math.round(progress.titlesPct)}%</span></>} />
                <p className="faint" style={{ fontSize: 9.5, marginTop: 5 }}>
                  {hoursLabel(progress.minutes)} · avg {progress.avgRating.toFixed(1)}
                </p>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card__head">
              <div className="card__title">
                <CalendarDays size={13} /> Next in the room
              </div>
              <button className="section-link" onClick={() => navigate('events')}>
                calendar <ArrowRight size={10} />
              </button>
            </div>
            <div className="card__body" style={{ paddingTop: 6, paddingBottom: 8 }}>
              {events.length ? (
                events.map((event) => (
                  <div className="event-row" key={event.id}>
                    <div className="event-date">
                      <b>{new Date(event.starts_at).getDate()}</b>
                      <span>{new Date(event.starts_at).toLocaleDateString('en-GB', { month: 'short' })}</span>
                    </div>
                    <div className="event-body" style={{ flex: 1 }}>
                      <strong>
                        {db.cinema_titles.find((title) => title.id === event.title_id)?.title || event.kind}
                      </strong>
                      <p>
                        {event.location} · {new Date(event.starts_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Chip sm mono>
                      {event.kind}
                    </Chip>
                  </div>
                ))
              ) : (
                <p className="faint" style={{ fontSize: 10 }}>
                  Nothing scheduled.
                </p>
              )}
            </div>
          </section>

          <section className="card card--pad">
            <div className="row row--between" style={{ marginBottom: 8 }}>
              <h3 className="section-title" style={{ fontSize: 'var(--fs-md)' }}>
                <Star size={14} style={{ color: 'var(--accent)' }} /> Queued
              </h3>
              <button className="section-link" onClick={() => navigate('watchlist')}>
                all <ArrowRight size={10} />
              </button>
            </div>
            {queue.length ? (
              <div className="stack stack--tight">
                {queue.map((item) => {
                  const title = db.cinema_titles.find((entry) => entry.id === item.title_id);
                  if (!title) return null;
                  return (
                    <button
                      key={item.id}
                      className="mini-row"
                      onClick={() => navigate('title', title.id)}
                      style={{ textAlign: 'left' }}
                    >
                      <MiniPoster title={title.title} category={title.category} />
                      <span className="mini-row__title">{title.title}</span>
                      <span className="priority-pips">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <i key={level} className={level <= item.priority ? 'is-on' : ''} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="faint" style={{ fontSize: 10 }}>
                The queue is empty. Rare.
              </p>
            )}
          </section>

          <section className="card card--pad">
            <div className="row row--between" style={{ marginBottom: 10 }}>
              <h3 className="section-title" style={{ fontSize: 'var(--fs-md)' }}>
                <Sparkles size={14} style={{ color: 'var(--accent)' }} /> Booth activity
              </h3>
              <Chip mono sm>{usage.requests} calls</Chip>
            </div>
            {usage.requests ? (
              <>
                <Sparkline values={usage.byDay.map((day) => day.requests)} height={38} />
                <div className="row row--between" style={{ marginTop: 6 }}>
                  <span className="mono faint" style={{ fontSize: 8.5 }}>
                    14-day requests
                  </span>
                  <span className="mono" style={{ fontSize: 8.5, color: 'var(--accent)' }}>
                    {Math.round(usage.successRate)}% ok
                  </span>
                </div>
                <div className="hairline" style={{ margin: '10px 0' }} />
                <div className="mono" style={{ fontSize: 9, color: 'var(--text-3)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="row" style={{ justifyContent: 'space-between' }}>
                    <span>last model</span>
                    <span style={{ color: 'var(--text-2)' }}>{usage.byModel[0]?.model || settings.defaultModel}</span>
                  </span>
                  <span className="row" style={{ justifyContent: 'space-between' }}>
                    <span>tokens</span>
                    <span style={{ color: 'var(--text-2)' }}>{tokens(usage.totalTokens)}</span>
                  </span>
                  <span className="row" style={{ justifyContent: 'space-between' }}>
                    <span>avg latency</span>
                    <span style={{ color: 'var(--text-2)' }}>{Math.round(usage.avgLatency)}ms</span>
                  </span>
                </div>
              </>
            ) : (
              <Notice tone="accent">
                The booth has not made a call yet. Add a key in settings and ask it something.
              </Notice>
            )}
          </section>
        </div>
      </div>

      <section className="section">
        <SectionHead
          title="Fresh off the projector"
          count={recent.length}
          action={
            <button className="section-link" onClick={() => navigate('library')}>
              the whole shelf <ArrowRight size={10} />
            </button>
          }
        />
        <div className="poster-grid">
          {recent.map((title) => (
            <div className="poster-cell" key={title.id}>
              <Poster
                title={title.title}
                year={title.year}
                category={title.category}
                score={title.rating}
                favorite={title.favorite}
                onClick={() => navigate('title', title.id)}
              />
              <div className="poster-cell__meta">
                <button className="poster-cell__title" onClick={() => navigate('title', title.id)}>
                  {title.title}
                </button>
                <span className="poster-cell__year">{title.year}</span>
              </div>
              <div className="poster-cell__tags">
                {collectionsForTitle(db, title.id)
                  .slice(0, 2)
                  .map((collection) => (
                    <Chip key={collection.id} sm mono>
                      {collection.icon} {collection.name}
                    </Chip>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="dash-grid" style={{ marginTop: 'var(--sp-5)' }}>
        <section className="card card--pad">
          <div className="row row--between" style={{ marginBottom: 10 }}>
            <h3 className="section-title" style={{ fontSize: 'var(--fs-md)' }}>
              <Sparkles size={14} style={{ color: 'var(--accent)' }} /> Vocabulary of the shelf
            </h3>
            <button className="section-link" onClick={() => navigate('library')}>
              filter by tag <ArrowRight size={10} />
            </button>
          </div>
          <div className="filter-row">
            {tags.map((tag) => (
              <Tag key={tag.tag} onClick={() => navigate('library', undefined, `tag=${encodeURIComponent(tag.tag)}`)}>
                {tag.tag} <span className="faint">{tag.count}</span>
              </Tag>
            ))}
            {!tags.length && <span className="faint" style={{ fontSize: 10 }}>No tags yet.</span>}
          </div>
        </section>
        <section className="card card--pad">
          <div className="row row--between" style={{ marginBottom: 10 }}>
            <h3 className="section-title" style={{ fontSize: 'var(--fs-md)' }}>
              <Clock3 size={14} style={{ color: 'var(--accent)' }} /> Operator log
            </h3>
            <Chip mono sm>{db.cinema_activity.length}</Chip>
          </div>
          <div className="timeline">
            {db.cinema_activity.slice(0, 7).map((activity) => (
              <div className="timeline__item" key={activity.id}>
                <span className={cx('timeline__dot', activity.action === 'ai' && 'timeline__dot--accent')}>
                  {activity.action.slice(0, 2)}
                </span>
                <div className="timeline__body">
                  <strong>{activity.detail}</strong>
                  <div className="timeline__time">
                    {relative(activity.created_at)} · {activity.entity || 'shelf'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {!keyPresent && (
        <div style={{ marginTop: 'var(--sp-5)' }}>
          <Notice tone="warn" icon={<TerminalSquare size={15} />}>
            <strong>The projection booth is idle.</strong> Every AI feature calls the provider directly from this
            browser. Add an OpenRouter key in <button className="section-link" style={{ color: 'var(--accent)' }} onClick={() => navigate('settings', undefined, 'tab=ai')}>Settings → Projection booth</button> to arm streaming, reasoning, resume and the exact-request inspector.
          </Notice>
        </div>
      )}

      {adding && (
        <TitleForm
          onClose={() => setAdding(false)}
          onSaved={(title) => navigate('title', title.id)}
        />
      )}
    </>
  );
}

export function DashboardQuickActions() {
  return (
    <div className="row">
      <IconButton label="Add entry" onClick={() => navigate('library', undefined, 'new=1')}>
        <Plus size={14} />
      </IconButton>
      <Avatar name="Operator 01" />
    </div>
  );
}
