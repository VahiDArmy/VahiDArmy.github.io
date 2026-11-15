/** One title, opened like a dossier. */

import { useMemo, useState } from 'react';
import {
  Bookmark,
  Brain,
  CalendarDays,
  ChevronRight,
  Clock3,
  ExternalLink,
  GitBranch,
  Layers,
  NotebookPen,
  Pencil,
  Play,
  Plus,
  Quote as QuoteIcon,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { navigate, useRoute } from '../app/router';
import {
  insertRow,
  removeRow,
  updateRow,
  deleteTitle,
  logActivity,
  upsertRow,
  useDb,
} from '../data/store';
import {
  collectionsForTitle,
  creditsFor,
  ratingFor,
  relatedTitles,
  sessionsFor,
  watchlistFor,
} from '../data/queries';
import type { AiAction, Rating, Title } from '../types';
import { AI_ACTIONS } from '../ai/prompts';
import { splitList, joinList, nowIso } from '../lib/utils';
import {
  categoryGlyph,
  dateLabel,
  episodeLabel,
  n,
  relativeDay,
  runtime,
  shortDate,
  typeLabel,
} from '../lib/format-extra';
import { AiPanel } from '../components/AiPanel';
import { TitleForm } from '../components/TitleForm';
import { SEED_DEVICES, SEED_MOODS, SEED_PEOPLE_ROLES } from '../components/constants';
import {
  Avatar,
  Button,
  CategoryChip,
  Chip,
  EmptyState,
  Field,
  Input,
  Menu,
  MiniPoster,
  Modal,
  Notice,
  Poster,
  ProgressRing,
  SectionHead,
  Select,
  Slider,
  Stars,
  Tabs,
  TagInput,
  Textarea,
  Toggle,
  Tooltip,
  useConfirm,
  useToast,
  cx,
} from '../components/ui';

type TabId = 'overview' | 'craft' | 'sessions' | 'people' | 'margin';

type AxisKey = 'story' | 'acting' | 'direction' | 'visuals' | 'sound' | 'rewatch';

const AXES: Array<[AxisKey, string]> = [
  ['story', 'Story'],
  ['acting', 'Acting'],
  ['direction', 'Direction'],
  ['visuals', 'Visuals'],
  ['sound', 'Sound'],
  ['rewatch', 'Rewatch'],
];

const ACTION_GROUPS: AiAction['group'][] = ['analysis', 'writing', 'metadata', 'curation'];

export function TitleDetail({ id }: { id?: string }) {
  const route = useRoute();
  const titleId = id || route.param;
  const database = useDb();
  const confirm = useConfirm();
  const toast = useToast();
  const title = database.cinema_titles.find((entry) => entry.id === titleId);
  const [tab, setTab] = useState<TabId>('overview');
  const [editing, setEditing] = useState(false);
  const [aiAction, setAiAction] = useState<AiAction | null>(null);
  const [showSession, setShowSession] = useState(false);
  const [showCredit, setShowCredit] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState({ selected: '', text: '' });
  const [sessionDraft, setSessionDraft] = useState({
    watched_at: new Date().toISOString().slice(0, 16),
    minutes: 0,
    season: '',
    episode: '',
    mood: 'focused',
    device: 'projector',
    note: '',
  });
  const [creditDraft, setCreditDraft] = useState({ person_id: '', role: 'director', character: '' });
  const [reviewDraft, setReviewDraft] = useState('');
  const [axisDraft, setAxisDraft] = useState<Record<string, number>>({});
  const [tagDraft, setTagDraft] = useState<string[]>([]);

  const rating = title ? ratingFor(database, title.id) : undefined;
  const sessions = title ? sessionsFor(database, title.id) : [];
  const credits = title ? creditsFor(database, title.id) : [];
  const relations = title ? relatedTitles(database, title.id) : [];
  const quotes = title ? database.cinema_quotes.filter((quote) => quote.title_id === title.id) : [];
  const trivia = title ? database.cinema_trivia.filter((row) => row.title_id === title.id) : [];
  const awards = title ? database.cinema_awards.filter((row) => row.title_id === title.id) : [];
  const notes = title ? database.cinema_mizan_notes.filter((row) => row.title_id === title.id) : [];
  const collections = title ? collectionsForTitle(database, title.id) : [];
  const events = title ? database.cinema_events.filter((row) => row.title_id === title.id) : [];
  const inWatchlist = title ? watchlistFor(database, title.id) : false;

  if (!title) {
    return (
      <EmptyState
        title="This entry is not on the shelf"
        text="It may have been deleted, or the link is from a different local database."
        action={<Button variant="outline" onClick={() => navigate('library')}>Back to the shelf</Button>}
      />
    );
  }

  const startCraft = () => {
    setReviewDraft(rating?.review || '');
    setAxisDraft({
      story: rating?.story ?? title.rating ?? 5,
      acting: rating?.acting ?? 5,
      direction: rating?.direction ?? 5,
      visuals: rating?.visuals ?? 5,
      sound: rating?.sound ?? 5,
      rewatch: rating?.rewatch ?? 5,
    });
    setTagDraft(splitList(title.tags));
  };

  const saveCraft = () => {
    const values = {
      story: Number(axisDraft.story ?? 0),
      acting: Number(axisDraft.acting ?? 0),
      direction: Number(axisDraft.direction ?? 0),
      visuals: Number(axisDraft.visuals ?? 0),
      sound: Number(axisDraft.sound ?? 0),
      rewatch: Number(axisDraft.rewatch ?? 0),
      review: reviewDraft,
      spoiler: rating?.spoiler ?? false,
    };
    if (rating) {
      updateRow('cinema_ratings', rating.id, values);
    } else {
      upsertRow('cinema_ratings', { id: `rating-${title.id}`, title_id: title.id, ...values });
    }
    logActivity('rated', 'cinema_ratings', rating?.id || title.id, `Scored ${title.title}`);
    toast.push({ tone: 'success', title: 'Craft saved', body: `${title.title} · ${Math.round((values.story + values.acting + values.direction + values.visuals + values.sound + values.rewatch) / 6)}/10 average` });
  };

  const toggleFavourite = () => {
    updateRow('cinema_titles', title.id, { favorite: !title.favorite });
    logActivity('updated', 'cinema_titles', title.id, `${title.favorite ? 'Removed' : 'Marked'} favourite: ${title.title}`);
  };

  const toggleWatchlist = () => {
    if (inWatchlist) {
      database.cinema_watchlist
        .filter((item) => item.title_id === title.id)
        .forEach((item) => removeRow('cinema_watchlist', item.id));
      toast.push({ title: 'Removed from watchlist', tone: 'info' });
      return;
    }
    insertRow('cinema_watchlist', {
      title_id: title.id,
      priority: 3,
      note: '',
      target_date: null,
      done: false,
    } as never);
    toast.push({ title: 'Queued', body: title.title, tone: 'success' });
  };

  const addSession = () => {
    insertRow('cinema_watch_sessions', {
      title_id: title.id,
      season: sessionDraft.season ? Number(sessionDraft.season) : null,
      episode: sessionDraft.episode ? Number(sessionDraft.episode) : null,
      minutes: Number(sessionDraft.minutes) || title.runtime || 0,
      mood: sessionDraft.mood,
      device: sessionDraft.device,
      note: sessionDraft.note,
      watched_at: new Date(sessionDraft.watched_at).toISOString(),
    } as never);
    if (title.status !== 'watched') updateRow('cinema_titles', title.id, { status: 'watched' });
    logActivity('watched', 'cinema_watch_sessions', title.id, `Logged a session for ${title.title}`);
    setShowSession(false);
    toast.push({ tone: 'success', title: 'Session logged', body: `${sessionDraft.minutes || title.runtime || 0} minutes` });
  };

  const addCredit = () => {
    if (!creditDraft.person_id) return;
    insertRow('cinema_credits', {
      title_id: title.id,
      person_id: creditDraft.person_id,
      role: creditDraft.role,
      character: creditDraft.character,
      billing: credits.length + 1,
    } as never);
    setShowCredit(false);
    toast.push({ tone: 'success', title: 'Credit added' });
  };

  const addNote = () => {
    if (!noteDraft.text.trim()) return;
    insertRow('cinema_mizan_notes', {
      content_id: notes.length + 1,
      title_id: title.id,
      anchor_before: '',
      anchor_selected: noteDraft.selected || title.title,
      anchor_after: '',
      note_text: noteDraft.text,
    } as never);
    setShowNote(false);
    setNoteDraft({ selected: '', text: '' });
    toast.push({ tone: 'success', title: 'Margin note saved' });
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Delete “${title.title}”?`,
      body: 'Ratings, sessions, quotes, credits and margin notes attached to this title are removed with it. This cannot be undone from the interface.',
      confirmLabel: 'Delete entry',
      danger: true,
    });
    if (!ok) return;
    deleteTitle(title.id);
    toast.push({ tone: 'warn', title: 'Entry deleted', body: title.title });
    navigate('library');
  };

  const anchored = (text: string) => {
    if (!text) return null;
    const hits = notes.filter((note) => note.anchor_selected && text.includes(note.anchor_selected));
    if (!hits.length) return text;
    let parts: Array<string | { note: string }> = [text];
    hits.forEach((note) => {
      parts = parts.flatMap((part) => {
        if (typeof part !== 'string') return [part];
        const index = part.indexOf(note.anchor_selected);
        if (index < 0) return [part];
        return [
          part.slice(0, index),
          { note: note.note_text },
          part.slice(index + note.anchor_selected.length),
        ] as Array<string | { note: string }>;
      });
    });
    return parts.map((part, index) =>
      typeof part === 'string' ? (
        <span key={index}>{part}</span>
      ) : (
        <span className="note-anchor" key={index} title={part.note} onClick={() => setTab('margin')}>
          {hits[0]?.anchor_selected}
        </span>
      ),
    );
  };

  const avgCraft = rating
    ? (rating.story + rating.acting + rating.direction + rating.visuals + rating.sound + rating.rewatch) / 6
    : 0;

  return (
    <>
      <section className="title-hero">
        <div className="title-hero__wash" />
        <div className="title-hero__grain" />
        <div className="title-hero__inner">
          <div className="title-hero__poster">
            <Poster
              title={title.title}
              year={title.year}
              category={title.category}
              score={title.rating}
              favorite={title.favorite}
              flat
            />
          </div>
          <div className="title-hero__copy">
            <div className="title-hero__crumbs">
              <button onClick={() => navigate('library')}>Shelf</button>
              <ChevronRight size={9} />
              <span>{title.category}</span>
              <ChevronRight size={9} />
              <span>{title.type}</span>
            </div>
            <h1 className="title-hero__name">{title.title}</h1>
            {title.original_title && (
              <div className={cx('title-hero__orig', /[\u0600-\u06ff]/.test(title.original_title) ? 'fa' : 'latin')}>
                {title.original_title}
              </div>
            )}
            <div className="title-hero__facts">
              <span>{title.year || 'year unknown'}</span>
              <span className="sep">/</span>
              <span>{typeLabel(title.type)}</span>
              {title.runtime ? (
                <>
                  <span className="sep">/</span>
                  <span>{runtime(title.runtime)}</span>
                </>
              ) : null}
              {title.country && (
                <>
                  <span className="sep">/</span>
                  <span>{title.country}</span>
                </>
              )}
              {title.language && (
                <>
                  <span className="sep">/</span>
                  <span>{title.language}</span>
                </>
              )}
              {title.status && (
                <>
                  <span className="sep">/</span>
                  <span>{title.status}</span>
                </>
              )}
              {episodeLabel(title) && (
                <>
                  <span className="sep">/</span>
                  <span>{episodeLabel(title)}</span>
                </>
              )}
            </div>
            <p className="title-hero__summary">
              {title.summary || 'No summary yet. Run Standardise entry and the booth will propose one from what it actually knows.'}
            </p>
            <div className="title-hero__tags">
              <CategoryChip category={title.category} />
              {splitList(title.genre).map((genre) => (
                <Chip key={genre} sm>
                  {genre}
                </Chip>
              ))}
              {splitList(title.tags).map((tag) => (
                <button
                  key={tag}
                  className="tag"
                  onClick={() => navigate('library', undefined, `tag=${encodeURIComponent(tag)}`)}
                >
                  #{tag}
                </button>
              ))}
            </div>
            <div className="title-hero__actions">
              <Button variant="primary" icon={<Pencil size={13} />} onClick={() => setEditing(true)}>
                Edit entry
              </Button>
              <Button
                variant={title.favorite ? 'default' : 'outline'}
                icon={<Star size={13} />}
                onClick={toggleFavourite}
              >
                {title.favorite ? 'Favourite' : 'Mark favourite'}
              </Button>
              <Button variant={inWatchlist ? 'default' : 'outline'} icon={<Bookmark size={13} />} onClick={toggleWatchlist}>
                {inWatchlist ? 'In watchlist' : 'Watchlist'}
              </Button>
              <Menu
                trigger={({ onClick }) => (
                  <Button variant="outline" onClick={onClick}>
                    More
                  </Button>
                )}
              >
                {(close) => (
                  <>
                    <div className="menu__label">Status</div>
                    {['watched', 'watching', 'queued', 'abandoned'].map((status) => (
                      <button
                        key={status}
                        className="menu__item"
                        onClick={() => {
                          updateRow('cinema_titles', title.id, { status });
                          close();
                        }}
                      >
                        {status}
                      </button>
                    ))}
                    <div className="menu__sep" />
                    <button className="menu__item is-danger" onClick={() => { close(); void remove(); }}>
                      <Trash2 size={12} /> Delete entry
                    </button>
                  </>
                )}
              </Menu>
            </div>
          </div>
          <div className="title-hero__score">
            <div className="score-dial">
              {title.rating ? title.rating.toFixed(1) : '—'}
              <span>/10</span>
            </div>
            <Stars value={title.rating} />
            <span className="mono faint" style={{ fontSize: 8.5, letterSpacing: '0.08em' }}>
              {title.watched_date ? `watched ${dateLabel(title.watched_date)}` : 'not dated'}
            </span>
          </div>
        </div>
      </section>

      <div className="row row--between" style={{ marginBottom: 'var(--sp-3)' }}>
        <Chip mono sm>
          {sessions.length} sessions · {sessions.reduce((total, session) => total + session.minutes, 0)} minutes
        </Chip>
        <div className="row" style={{ gap: 5, overflowX: 'auto' }}>
          {AI_ACTIONS.filter((action) => !['curate', 'watchlist', 'taste', 'compare'].includes(action.id)).map((action) => (
            <button key={action.id} className="chip" onClick={() => setAiAction(action)} title={action.hint}>
              <Sparkles size={10} /> {action.label}
            </button>
          ))}
        </div>
      </div>

      <Tabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'craft', label: 'Craft', count: rating ? 6 : 0 },
          { id: 'sessions', label: 'Sessions', count: sessions.length },
          { id: 'people', label: 'People', count: credits.length },
          { id: 'margin', label: 'Margin', count: notes.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="title-layout" style={{ marginTop: 'var(--sp-4)' }}>
        <div className="title-main">
          {tab === 'overview' && (
            <>
              <div className="card card--pad">
                <div className="panel-title">
                  <Sparkles size={11} /> Why it is here
                </div>
                {title.reason ? (
                  <div className="quote-line">{title.reason}</div>
                ) : (
                  <p className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                    No verdict written. Ask the booth for a draft review, or write the sentence yourself.
                  </p>
                )}
              </div>

              {title.story_analysis && (
                <div className="card card--pad">
                  <div className="row row--between" style={{ marginBottom: 10 }}>
                    <div className="panel-title" style={{ marginBottom: 0 }}>
                      <Brain size={11} /> Story analysis
                    </div>
                    <Chip sm mono>
                      {title.ai_standardized_at ? `ai · ${shortDate(title.ai_standardized_at)}` : 'operator'}
                    </Chip>
                  </div>
                  <div className="analysis-block">{anchored(title.story_analysis)}</div>
                </div>
              )}

              {quotes.length > 0 && (
                <div className="card card--pad">
                  <div className="panel-title">
                    <QuoteIcon size={11} /> Lines kept
                  </div>
                  <div className="stack">
                    {quotes.map((quote) => (
                      <blockquote key={quote.id} className="quote-line" style={{ fontSize: 'var(--fs-lg)' }}>
                        {quote.text}
                        <cite>
                          {quote.speaker || 'unknown speaker'}
                          {quote.at_minute ? ` · ${quote.at_minute}′` : ''}
                          {quote.favorite ? ' · favourite' : ''}
                        </cite>
                      </blockquote>
                    ))}
                  </div>
                </div>
              )}

              {trivia.length > 0 && (
                <div className="card card--pad">
                  <div className="panel-title">
                    <NotebookPen size={11} /> Production notes
                  </div>
                  {trivia.map((item, index) => (
                    <div className="trivia-row" key={item.id}>
                      <span className="trivia-index">{String(index + 1).padStart(2, '0')}</span>
                      <div className="trivia-body">
                        <p>{item.content}</p>
                        <span>{item.source || 'unverified'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {relations.length > 0 && (
                <div className="card card--pad">
                  <div className="panel-title">
                    <GitBranch size={11} /> In conversation with
                  </div>
                  <div className="stack stack--tight">
                    {relations.map((relation) => (
                      <button
                        key={`${relation.title.id}-${relation.kind}`}
                        className="order-row"
                        onClick={() => navigate('title', relation.title.id)}
                      >
                        <MiniPoster title={relation.title.title} category={relation.title.category} />
                        <span style={{ flex: 1, textAlign: 'left' }}>
                          <strong style={{ fontSize: 'var(--fs-xs)' }}>{relation.title.title}</strong>
                          <div className="faint mono" style={{ fontSize: 8.5 }}>
                            {relation.title.year} · {relation.kind}
                          </div>
                        </span>
                        <span className="meter" style={{ width: 60, height: 3 }}>
                          <span className="meter__fill" style={{ display: 'block', width: `${relation.weight * 100}%` }} />
                        </span>
                        <ChevronRight size={12} style={{ color: 'var(--text-4)' }} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {title.notes && (
                <div className="card card--pad">
                  <div className="panel-title">Operator notes</div>
                  <p className="prose-block" style={{ whiteSpace: 'pre-wrap' }}>
                    {title.notes}
                  </p>
                </div>
              )}

              {collections.length > 0 && (
                <div className="card card--pad">
                  <div className="panel-title">
                    <Layers size={11} /> Appears in
                  </div>
                  <div className="filter-row">
                    {collections.map((collection) => (
                      <button
                        key={collection.id}
                        className="chip"
                        onClick={() => navigate('collections', collection.id)}
                        style={{ borderColor: `${collection.color}44` }}
                      >
                        <span style={{ color: collection.color }}>{collection.icon}</span>
                        {collection.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {events.length > 0 && (
                <div className="card card--pad">
                  <div className="panel-title">
                    <CalendarDays size={11} /> Screenings
                  </div>
                  {events.map((event) => (
                    <div className="event-row" key={event.id}>
                      <div className="event-date">
                        <b>{new Date(event.starts_at).getDate()}</b>
                        <span>{new Date(event.starts_at).toLocaleDateString('en-GB', { month: 'short' })}</span>
                      </div>
                      <div className="event-body" style={{ flex: 1 }}>
                        <strong>{event.kind}</strong>
                        <p>{event.location} · {event.note}</p>
                      </div>
                      <Chip sm mono>
                        {relativeDay(event.starts_at)}
                      </Chip>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'craft' && (
            <div className="card card--pad">
              <div className="row row--between" style={{ marginBottom: 12 }}>
                <div>
                  <div className="panel-title" style={{ marginBottom: 2 }}>
                    <Star size={11} /> Six axes
                  </div>
                  <p className="faint" style={{ fontSize: 10 }}>
                    The verdict score above and the craft scores below are deliberately separate.
                  </p>
                </div>
                <div className="big-number" style={{ fontSize: 34 }}>
                  {avgCraft ? avgCraft.toFixed(1) : '—'}
                  <span>/10 craft</span>
                </div>
              </div>
              <div className="stack">
                {AXES.map(([key, label]) => (
                  <div className="criteria-row" key={key}>
                    <span>{label}</span>
                    <input
                      type="range"
                      className="range"
                      min={0}
                      max={10}
                      step={1}
                      value={axisDraft[key] ?? rating?.[key] ?? 5}
                      onChange={(event) => setAxisDraft((current) => ({ ...current, [key]: Number(event.target.value) }))}
                      style={{ '--fill': `${((axisDraft[key] ?? rating?.[key] ?? 5) / 10) * 100}%` } as React.CSSProperties}
                      onFocus={() => {
                        if (!Object.keys(axisDraft).length) startCraft();
                      }}
                    />
                    <b>{axisDraft[key] ?? rating?.[key] ?? 5}</b>
                  </div>
                ))}
              </div>
              <div className="hairline" style={{ margin: '16px 0' }} />
              <Field label="Review" hint="Written for yourself. Spoiler flag is shown in lists.">
                <Textarea
                  className="textarea--tall"
                  value={reviewDraft || rating?.review || ''}
                  onChange={(event) => setReviewDraft(event.target.value)}
                  onFocus={() => {
                    if (!reviewDraft) startCraft();
                  }}
                  placeholder="What the film does, and what it costs."
                />
              </Field>
              <div className="row row--between" style={{ marginTop: 12 }}>
                <Toggle
                  checked={rating?.spoiler ?? false}
                  onChange={(value) => rating && updateRow('cinema_ratings', rating.id, { spoiler: value })}
                  label="Contains spoilers"
                />
                <div className="row" style={{ gap: 6 }}>
                  <Button
                    variant="outline"
                    icon={<Sparkles size={12} />}
                    onClick={() => setAiAction(AI_ACTIONS.find((action) => action.id === 'review') || null)}
                  >
                    Draft review with AI
                  </Button>
                  <Button variant="primary" onClick={saveCraft}>
                    Save craft
                  </Button>
                </div>
              </div>
              <div className="hairline" style={{ margin: '16px 0' }} />
              <Field label="Tags" hint="Shared with the shelf filter.">
                <TagInput
                  tags={tagDraft.length ? tagDraft : splitList(title.tags)}
                  onChange={(next) => {
                    setTagDraft(next);
                    updateRow('cinema_titles', title.id, { tags: joinList(next) });
                  }}
                />
              </Field>
            </div>
          )}

          {tab === 'sessions' && (
            <div className="card card--pad">
              <div className="row row--between" style={{ marginBottom: 10 }}>
                <div className="panel-title" style={{ marginBottom: 0 }}>
                  <Clock3 size={11} /> Viewing log
                </div>
                <Button size="sm" variant="outline" icon={<Plus size={12} />} onClick={() => setShowSession(true)}>
                  Log a session
                </Button>
              </div>
              {sessions.length ? (
                <div className="session-log">
                  {sessions.map((session) => (
                    <div className="session-item" key={session.id}>
                      <div className="session-date">
                        <b>{new Date(session.watched_at).getDate()}</b>
                        <span>{new Date(session.watched_at).toLocaleDateString('en-GB', { month: 'short' })}</span>
                      </div>
                      <div className="session-body">
                        <strong>
                          {session.minutes} minutes
                          {session.season ? ` · S${session.season}E${session.episode || '?'}` : ''}
                        </strong>
                        <p>
                          {session.mood} · {session.device} {session.note ? `· ${session.note}` : ''}
                        </p>
                      </div>
                      <span className="session-chip">{new Date(session.watched_at).getFullYear()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No sessions yet" text="Log the next viewing and the dashboard heatmap fills in." />
              )}
            </div>
          )}

          {tab === 'people' && (
            <div className="card card--pad">
              <div className="row row--between" style={{ marginBottom: 10 }}>
                <div className="panel-title" style={{ marginBottom: 0 }}>
                  <Users size={11} /> Credits
                </div>
                <Button size="sm" variant="outline" icon={<Plus size={12} />} onClick={() => setShowCredit(true)}>
                  Add credit
                </Button>
              </div>
              {credits.length ? (
                <div>
                  {credits.map((credit) => (
                    <div className="credit-row" key={credit.id}>
                      <Avatar name={credit.person?.name || '?'} size="sm" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <button onClick={() => credit.person && navigate('people', credit.person.id)}>
                          <span className="credit-row__name">{credit.person?.name || 'Unknown'}</span>
                        </button>
                        {credit.character && <div className="credit-row__char">as {credit.character}</div>}
                      </div>
                      <span className="credit-row__role">{credit.role}</span>
                      <button
                        className="icon-btn icon-btn--sm"
                        onClick={() => removeRow('cinema_credits', credit.id)}
                        aria-label="Remove credit"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No credits" text="Add the director and the performances you came for." />
              )}
            </div>
          )}

          {tab === 'margin' && (
            <div className="card card--pad">
              <div className="row row--between" style={{ marginBottom: 12 }}>
                <div className="panel-title" style={{ marginBottom: 0 }}>
                  <NotebookPen size={11} /> Anchored notes
                </div>
                <Button size="sm" variant="outline" icon={<Plus size={12} />} onClick={() => setShowNote(true)}>
                  New note
                </Button>
              </div>
              {notes.length ? (
                <div>
                  {notes.map((note) => (
                    <div className="note-margin" key={note.id}>
                      <span className="note-margin__bar" />
                      <div className="note-margin__body" style={{ flex: 1 }}>
                        <span className="note-margin__sel">“{note.anchor_selected}”</span>
                        <p>{note.note_text}</p>
                      </div>
                      <button
                        className="icon-btn icon-btn--sm"
                        onClick={() => removeRow('cinema_mizan_notes', note.id)}
                        aria-label="Delete note"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No margin notes"
                  text="Anchor a thought to a phrase in the analysis and it will be highlighted there."
                />
              )}
            </div>
          )}
        </div>

        <aside className="title-side">
          <div className="card card--pad">
            <div className="panel-title">At a glance</div>
            <dl className="kv">
              <dt>Verdict</dt>
              <dd>{categoryGlyph(title.category)} {title.category}</dd>
              <dt>Status</dt>
              <dd>{title.status}</dd>
              <dt>Score</dt>
              <dd>{title.rating || '—'}/10</dd>
              <dt>Watched</dt>
              <dd>{title.watched_date ? dateLabel(title.watched_date) : '—'}</dd>
              <dt>Country</dt>
              <dd>{title.country || '—'}</dd>
              <dt>Language</dt>
              <dd>{title.language || '—'}</dd>
              <dt>Source</dt>
              <dd>{title.source}</dd>
              <dt>Added</dt>
              <dd>{dateLabel(title.created_at)}</dd>
              <dt>Standardised</dt>
              <dd>{title.ai_standardized_at ? dateLabel(title.ai_standardized_at) : 'no'}</dd>
            </dl>
          </div>

          <div className="card card--pad">
            <div className="row row--between" style={{ marginBottom: 10 }}>
              <div className="panel-title" style={{ marginBottom: 0 }}>
                <Star size={11} /> Craft shape
              </div>
              <span className="mono" style={{ fontSize: 10, color: 'var(--accent)' }}>
                {avgCraft ? avgCraft.toFixed(1) : '—'}
              </span>
            </div>
            <div className="axis-list">
              {AXES.map(([key, label]) => (
                <div className="axis-row" key={key}>
                  <span>{label}</span>
                  <span className="axis-bar">
                    <span style={{ width: `${(rating?.[key] || 0) * 10}%` }} />
                  </span>
                  <b>{rating?.[key] ?? '—'}</b>
                </div>
              ))}
            </div>
            <Button block size="sm" variant="ghost" style={{ marginTop: 10 }} onClick={() => { startCraft(); setTab('craft'); }}>
              {rating ? 'Edit craft scores' : 'Score this film'}
            </Button>
          </div>

          {awards.length > 0 && (
            <div className="card card--pad">
              <div className="panel-title">
                <Trophy size={11} /> Recognition
              </div>
              {awards.map((award) => (
                <div className="award-row" key={award.id}>
                  <Trophy size={13} className={cx('award-row__trophy', !award.won && 'is-loss')} />
                  <div className="award-row__body">
                    <strong>{award.category}</strong>
                    <span>
                      {award.body} · {award.year}
                    </span>
                  </div>
                  <Chip sm mono tone={award.won ? 'accent' : undefined}>
                    {award.won ? 'won' : 'nom'}
                  </Chip>
                </div>
              ))}
            </div>
          )}

          <div className="card card--pad">
            <div className="panel-title">Booth</div>
            <p className="faint" style={{ fontSize: 10, lineHeight: 1.6, marginBottom: 10 }}>
              Direct calls only. Reasoning streams into the thinking panel; every reply is archived with its exact
              request body.
            </p>
            <div className="ai-action-grid">
              {AI_ACTIONS.filter((action) => ['analysis', 'review', 'standardise', 'translation', 'poster'].includes(action.id)).map((action) => (
                <button key={action.id} className="ai-action" onClick={() => setAiAction(action)}>
                  <Sparkles size={13} />
                  <span className="ai-action__copy">
                    <strong>{action.label}</strong>
                    <span>{action.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {title.trailer_url && (
            <a className="btn btn--outline btn--block" href={title.trailer_url} target="_blank" rel="noreferrer">
              <Play size={13} /> Trailer <ExternalLink size={11} style={{ marginLeft: 'auto' }} />
            </a>
          )}
        </aside>
      </div>

      {editing && <TitleForm editing={title} onClose={() => setEditing(false)} />}
      {aiAction && (
        <AiPanel
          action={aiAction}
          focusId={title.id}
          onClose={() => setAiAction(null)}
          onSendToStudio={(threadId) => {
            setAiAction(null);
            navigate('studio', threadId);
          }}
        />
      )}

      {showSession && (
        <Modal
          title="Log a session"
          subtitle={title.title}
          onClose={() => setShowSession(false)}
          size="md"
          actions={
            <>
              <Button variant="ghost" onClick={() => setShowSession(false)}>Cancel</Button>
              <Button variant="primary" onClick={addSession}>Save session</Button>
            </>
          }
        >
          <div className="stack">
            <div className="cols-2">
              <Field label="When">
                <Input
                  type="datetime-local"
                  value={sessionDraft.watched_at}
                  onChange={(event) => setSessionDraft((current) => ({ ...current, watched_at: event.target.value }))}
                />
              </Field>
              <Field label="Minutes" hint={`Film runtime is ${title.runtime || 'unknown'}`}>
                <Input
                  type="number"
                  value={sessionDraft.minutes}
                  onChange={(event) => setSessionDraft((current) => ({ ...current, minutes: Number(event.target.value) }))}
                  placeholder={String(title.runtime || 90)}
                />
              </Field>
            </div>
            {title.type === 'series' && (
              <div className="cols-2">
                <Field label="Season">
                  <Input
                    type="number"
                    value={sessionDraft.season}
                    onChange={(event) => setSessionDraft((current) => ({ ...current, season: event.target.value }))}
                  />
                </Field>
                <Field label="Episode">
                  <Input
                    type="number"
                    value={sessionDraft.episode}
                    onChange={(event) => setSessionDraft((current) => ({ ...current, episode: event.target.value }))}
                  />
                </Field>
              </div>
            )}
            <div className="cols-2">
              <Field label="Mood">
                <Select value={sessionDraft.mood} onChange={(event) => setSessionDraft((current) => ({ ...current, mood: event.target.value }))}>
                  {SEED_MOODS.map((mood) => (
                    <option key={mood} value={mood}>{mood}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Device">
                <Select value={sessionDraft.device} onChange={(event) => setSessionDraft((current) => ({ ...current, device: event.target.value }))}>
                  {SEED_DEVICES.map((device) => (
                    <option key={device} value={device}>{device}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Note">
              <Textarea
                value={sessionDraft.note}
                onChange={(event) => setSessionDraft((current) => ({ ...current, note: event.target.value }))}
                placeholder="What state were you in? What did you notice?"
              />
            </Field>
          </div>
        </Modal>
      )}

      {showCredit && (
        <Modal
          title="Add a credit"
          subtitle={title.title}
          onClose={() => setShowCredit(false)}
          size="sm"
          actions={
            <>
              <Button variant="ghost" onClick={() => setShowCredit(false)}>Cancel</Button>
              <Button variant="primary" onClick={addCredit}>Add</Button>
            </>
          }
        >
          <div className="stack">
            <Field label="Person">
              <Select
                value={creditDraft.person_id}
                onChange={(event) => setCreditDraft((current) => ({ ...current, person_id: event.target.value }))}
              >
                <option value="">Choose from the index…</option>
                {database.cinema_people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} · {person.role}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="cols-2">
              <Field label="Role">
                <Select
                  value={creditDraft.role}
                  onChange={(event) => setCreditDraft((current) => ({ ...current, role: event.target.value }))}
                >
                  {SEED_PEOPLE_ROLES.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Character">
                <Input
                  value={creditDraft.character}
                  onChange={(event) => setCreditDraft((current) => ({ ...current, character: event.target.value }))}
                />
              </Field>
            </div>
            <Notice tone="accent">
              A person must exist in the index first. <button className="section-link" style={{ color: 'var(--accent)' }} onClick={() => navigate('people')}>Open People</button>
            </Notice>
          </div>
        </Modal>
      )}

      {showNote && (
        <Modal
          title="Margin note"
          subtitle="Anchor a thought to a phrase."
          onClose={() => setShowNote(false)}
          size="sm"
          actions={
            <>
              <Button variant="ghost" onClick={() => setShowNote(false)}>Cancel</Button>
              <Button variant="primary" onClick={addNote}>Save note</Button>
            </>
          }
        >
          <div className="stack">
            <Field label="Anchor phrase" hint="Must appear in the summary or analysis to be highlighted.">
              <Input
                value={noteDraft.selected}
                onChange={(event) => setNoteDraft((current) => ({ ...current, selected: event.target.value }))}
                placeholder="the space between two people"
              />
            </Field>
            <Field label="Note">
              <Textarea
                value={noteDraft.text}
                onChange={(event) => setNoteDraft((current) => ({ ...current, text: event.target.value }))}
                placeholder="Why this phrase matters."
              />
            </Field>
          </div>
        </Modal>
      )}
    </>
  );
}


