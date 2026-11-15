/** Derived data. Pure functions over the local database — no React inside. */

import type {
  AiUsageRow,
  Challenge,
  Collection,
  Credit,
  DatabaseShape,
  FilterState,
  Goal,
  Person,
  Rating,
  Title,
  WatchSession,
} from '../types';
import { average, clamp, groupBy, median, splitList, sum, unique } from '../lib/utils';
import { dayKey, monthName } from '../lib/format';

export interface ShelfSummary {
  total: number;
  loved: number;
  good: number;
  hated: number;
  favourites: number;
  watched: number;
  watching: number;
  queued: number;
  abandoned: number;
  avgRating: number;
  firstYear: number | null;
  lastYear: number | null;
  episodes: number;
  minutes: number;
  countries: number;
  languages: number;
  tags: number;
}

export function shelfSummary(db: DatabaseShape): ShelfSummary {
  const titles = db.cinema_titles;
  const rated = titles.map((title) => title.rating).filter((value) => value > 0);
  const years = titles.map((title) => title.year).filter((year): year is number => Boolean(year));
  return {
    total: titles.length,
    loved: titles.filter((title) => title.category === 'love').length,
    good: titles.filter((title) => title.category === 'good').length,
    hated: titles.filter((title) => title.category === 'hate').length,
    favourites: titles.filter((title) => title.favorite).length,
    watched: titles.filter((title) => title.status === 'watched').length,
    watching: titles.filter((title) => title.status === 'watching').length,
    queued: titles.filter((title) => title.status === 'queued').length,
    abandoned: titles.filter((title) => title.status === 'abandoned').length,
    avgRating: average(rated),
    firstYear: years.length ? Math.min(...years) : null,
    lastYear: years.length ? Math.max(...years) : null,
    episodes: sum(titles.map((title) => title.episodes || 0)),
    minutes: sum(db.cinema_watch_sessions.map((session) => session.minutes)),
    countries: unique(titles.flatMap((title) => splitList(title.country))).length,
    languages: unique(titles.flatMap((title) => splitList(title.language))).length,
    tags: unique(titles.flatMap((title) => splitList(title.tags))).length,
  };
}

export function titleById(db: DatabaseShape, id: string | null | undefined): Title | undefined {
  if (!id) return undefined;
  return db.cinema_titles.find((title) => title.id === id);
}

export function ratingFor(db: DatabaseShape, titleId: string): Rating | undefined {
  return db.cinema_ratings.find((rating) => rating.title_id === titleId);
}

export function watchlistFor(db: DatabaseShape, titleId: string): boolean {
  return db.cinema_watchlist.some((item) => item.title_id === titleId && !item.done);
}

export function sessionsFor(db: DatabaseShape, titleId: string): WatchSession[] {
  return db.cinema_watch_sessions
    .filter((session) => session.title_id === titleId)
    .sort((a, b) => b.watched_at.localeCompare(a.watched_at));
}

export function creditsFor(db: DatabaseShape, titleId: string): Array<Credit & { person?: Person }> {
  return db.cinema_credits
    .filter((credit) => credit.title_id === titleId)
    .map((credit) => ({
      ...credit,
      person: db.cinema_people.find((person) => person.id === credit.person_id),
    }))
    .sort((a, b) => (a.billing ?? 99) - (b.billing ?? 99));
}

export function creditTitles(db: DatabaseShape, personId: string): Title[] {
  const ids = new Set(db.cinema_credits.filter((credit) => credit.person_id === personId).map((credit) => credit.title_id));
  return db.cinema_titles.filter((title) => ids.has(title.id));
}

export function collectionTitles(db: DatabaseShape, collectionId: string): Title[] {
  return db.cinema_collection_items
    .filter((item) => item.collection_id === collectionId)
    .sort((a, b) => a.position - b.position)
    .map((item) => titleById(db, item.title_id))
    .filter((title): title is Title => Boolean(title));
}

export function collectionsForTitle(db: DatabaseShape, titleId: string): Collection[] {
  const ids = new Set(
    db.cinema_collection_items.filter((item) => item.title_id === titleId).map((item) => item.collection_id),
  );
  return db.cinema_collections.filter((collection) => ids.has(collection.id));
}

export interface TagStat {
  tag: string;
  count: number;
  loved: number;
  hated: number;
  avgRating: number;
}

export function tagStats(db: DatabaseShape): TagStat[] {
  const map = new Map<string, { count: number; loved: number; hated: number; ratings: number[] }>();
  for (const title of db.cinema_titles) {
    for (const tag of splitList(title.tags)) {
      const key = tag.toLowerCase();
      const entry = map.get(key) || { count: 0, loved: 0, hated: 0, ratings: [] };
      entry.count += 1;
      if (title.category === 'love') entry.loved += 1;
      if (title.category === 'hate') entry.hated += 1;
      if (title.rating) entry.ratings.push(title.rating);
      map.set(key, entry);
    }
  }
  return Array.from(map.entries())
    .map(([tag, value]) => ({
      tag,
      count: value.count,
      loved: value.loved,
      hated: value.hated,
      avgRating: average(value.ratings),
    }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export interface Counter {
  label: string;
  value: number;
  extra?: number;
}

export function genreCounts(db: DatabaseShape): Counter[] {
  const counts = new Map<string, { value: number; ratings: number[] }>();
  for (const title of db.cinema_titles) {
    for (const genre of splitList(title.genre)) {
      const key = genre.trim();
      const entry = counts.get(key) || { value: 0, ratings: [] };
      entry.value += 1;
      if (title.rating) entry.ratings.push(title.rating);
      counts.set(key, entry);
    }
  }
  return Array.from(counts.entries())
    .map(([label, entry]) => ({ label, value: entry.value, extra: average(entry.ratings) }))
    .sort((a, b) => b.value - a.value);
}

export function countryCounts(db: DatabaseShape): Counter[] {
  const counts = new Map<string, number>();
  for (const title of db.cinema_titles) {
    for (const country of splitList(title.country)) {
      const key = country.trim();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export function decadeCounts(db: DatabaseShape): Counter[] {
  const buckets = new Map<number, number>();
  for (const title of db.cinema_titles) {
    if (!title.year) continue;
    const decade = Math.floor(title.year / 10) * 10;
    buckets.set(decade, (buckets.get(decade) || 0) + 1);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([decade, value]) => ({ label: `${decade}s`, value }));
}

export function runtimeBuckets(db: DatabaseShape): Counter[] {
  const buckets: Array<{ label: string; min: number; max: number }> = [
    { label: '< 90', min: 0, max: 89 },
    { label: '90–119', min: 90, max: 119 },
    { label: '120–149', min: 120, max: 149 },
    { label: '150–179', min: 150, max: 179 },
    { label: '180+', min: 180, max: 10_000 },
  ];
  return buckets.map((bucket) => ({
    label: bucket.label,
    value: db.cinema_titles.filter(
      (title) => title.runtime && title.runtime >= bucket.min && title.runtime <= bucket.max,
    ).length,
  }));
}

export function axisAverages(db: DatabaseShape): Array<{ label: string; value: number }> {
  const keys: Array<[keyof Rating, string]> = [
    ['story', 'Story'],
    ['acting', 'Acting'],
    ['direction', 'Direction'],
    ['visuals', 'Visuals'],
    ['sound', 'Sound'],
    ['rewatch', 'Rewatch'],
  ];
  return keys.map(([key, label]) => ({
    label,
    value: average(db.cinema_ratings.map((rating) => Number(rating[key]) || 0)),
  }));
}

export function ratingDistribution(db: DatabaseShape): Counter[] {
  const buckets = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  return buckets.map((score) => ({
    label: String(score),
    value: db.cinema_titles.filter((title) => Math.round(title.rating) === score).length,
  }));
}

export interface MonthPoint {
  key: string;
  label: string;
  titles: number;
  minutes: number;
  sessions: number;
}

export function monthlyActivity(db: DatabaseShape, months = 12): MonthPoint[] {
  const now = new Date();
  const points: MonthPoint[] = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    points.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: monthName(date.getMonth()),
      titles: 0,
      minutes: 0,
      sessions: 0,
    });
  }
  const index = new Map(points.map((point) => [point.key, point]));
  for (const session of db.cinema_watch_sessions) {
    const key = session.watched_at.slice(0, 7);
    const point = index.get(key);
    if (!point) continue;
    point.minutes += session.minutes;
    point.sessions += 1;
  }
  for (const title of db.cinema_titles) {
    if (!title.watched_date) continue;
    const point = index.get(title.watched_date.slice(0, 7));
    if (point) point.titles += 1;
  }
  return points;
}

export function weekdayProfile(db: DatabaseShape): Counter[] {
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const counts = names.map((label) => ({ label, value: 0 }));
  for (const session of db.cinema_watch_sessions) {
    const date = new Date(session.watched_at);
    const index = (date.getDay() + 6) % 7;
    counts[index].value += session.minutes;
  }
  return counts;
}

export interface HeatCell {
  key: string;
  date: Date;
  minutes: number;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export function viewingHeatmap(db: DatabaseShape, days = 154): HeatCell[] {
  const byDay = new Map<string, { minutes: number; count: number }>();
  for (const session of db.cinema_watch_sessions) {
    const key = session.watched_at.slice(0, 10);
    const entry = byDay.get(key) || { minutes: 0, count: 0 };
    entry.minutes += session.minutes;
    entry.count += 1;
    byDay.set(key, entry);
  }
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const cells: HeatCell[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today.getTime() - offset * 86_400_000);
    const key = dayKey(date);
    const entry = byDay.get(key) || { minutes: 0, count: 0 };
    const level = entry.minutes === 0 ? 0 : entry.minutes < 60 ? 1 : entry.minutes < 150 ? 2 : entry.minutes < 300 ? 3 : 4;
    cells.push({ key, date, minutes: entry.minutes, count: entry.count, level });
  }
  return cells;
}

export function viewingStreak(db: DatabaseShape): { current: number; longest: number } {
  const days = unique(db.cinema_watch_sessions.map((session) => session.watched_at.slice(0, 10))).sort();
  if (!days.length) return { current: 0, longest: 0 };
  const set = new Set(days);
  const today = new Date();
  let current = 0;
  for (let offset = 0; offset < 400; offset += 1) {
    const key = dayKey(new Date(today.getTime() - offset * 86_400_000));
    if (set.has(key)) current += 1;
    else if (offset > 0) break;
  }
  let longest = 0;
  let run = 0;
  let previous: number | null = null;
  for (const day of days) {
    const time = new Date(`${day}T12:00:00`).getTime();
    run = previous !== null && time - previous === 86_400_000 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = time;
  }
  return { current, longest };
}

export function topRated(db: DatabaseShape, limit = 8): Title[] {
  return [...db.cinema_titles]
    .filter((title) => title.category !== 'hate')
    .sort((a, b) => b.rating - a.rating || b.year! - a.year!)
    .slice(0, limit);
}

export function recentTitles(db: DatabaseShape, limit = 8): Title[] {
  return [...db.cinema_titles]
    .sort((a, b) => (b.watched_date || '').localeCompare(a.watched_date || ''))
    .slice(0, limit);
}

export function upcomingEvents(db: DatabaseShape, limit = 5) {
  return [...db.cinema_events]
    .filter((event) => new Date(event.starts_at).getTime() >= Date.now() - 3_600_000)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, limit);
}

export function goalProgress(db: DatabaseShape, goal: Goal | undefined): {
  titles: number;
  minutes: number;
  avgRating: number;
  titlesPct: number;
  minutesPct: number;
  ratingPct: number;
  yearTitles: number;
} {
  const year = goal?.year || new Date().getFullYear();
  const titlesThisYear = db.cinema_titles.filter(
    (title) => title.watched_date && Number(title.watched_date.slice(0, 4)) === year,
  );
  const minutesThisYear = db.cinema_watch_sessions
    .filter((session) => Number(session.watched_at.slice(0, 4)) === year)
    .reduce((total, session) => total + session.minutes, 0);
  const rated = titlesThisYear.map((title) => title.rating).filter(Boolean);
  const avg = average(rated);
  return {
    titles: titlesThisYear.length,
    minutes: minutesThisYear,
    avgRating: avg,
    titlesPct: goal ? clamp((titlesThisYear.length / goal.target_titles) * 100, 0, 100) : 0,
    minutesPct: goal && goal.target_minutes ? clamp((minutesThisYear / goal.target_minutes) * 100, 0, 100) : 0,
    ratingPct: goal?.target_rating_avg ? clamp((avg / goal.target_rating_avg) * 100, 0, 100) : 0,
    yearTitles: titlesThisYear.length,
  };
}

export function challengeProgress(db: DatabaseShape, challenge: Challenge): {
  value: number;
  pct: number;
  detail: string;
} {
  let value = challenge.progress;
  let detail = 'Tracked manually';
  const rule = challenge.rule || {};
  if (typeof rule.minRuntime === 'number') {
    value = db.cinema_titles.filter((title) => (title.runtime || 0) >= (rule.minRuntime as number)).length;
    detail = `Titles over ${rule.minRuntime} minutes`;
  } else if (typeof rule.country === 'string') {
    value = db.cinema_titles.filter((title) => title.country.toLowerCase().includes(String(rule.country).toLowerCase())).length;
    detail = `Titles from ${rule.country}`;
  } else if (Array.isArray(rule.decades)) {
    const decades = new Set(
      db.cinema_titles
        .filter((title) => title.year)
        .map((title) => Math.floor((title.year as number) / 10) * 10),
    );
    value = decades.size;
    detail = `Decades represented: ${Array.from(decades).sort().join(', ')}`;
  }
  return {
    value,
    pct: clamp((value / Math.max(1, challenge.target)) * 100, 0, 100),
    detail,
  };
}

export interface UsageSummary {
  requests: number;
  ok: number;
  errors: number;
  successRate: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  avgLatency: number;
  reasoningCalls: number;
  estimatedCost: number;
  byDay: Array<{ key: string; label: string; requests: number; tokens: number }>;
  byModel: Array<{ model: string; requests: number; tokens: number; avgLatency: number; successRate: number }>;
  errorKinds: Array<{ label: string; value: number }>;
}

export function usageSummary(rows: AiUsageRow[], days = 14): UsageSummary {
  const ok = rows.filter((row) => row.ok);
  const byDayMap = new Map<string, { requests: number; tokens: number }>();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.now() - offset * 86_400_000);
    byDayMap.set(date.toISOString().slice(0, 10), { requests: 0, tokens: 0 });
  }
  for (const row of rows) {
    const key = row.created_at.slice(0, 10);
    const entry = byDayMap.get(key);
    if (!entry) continue;
    entry.requests += 1;
    entry.tokens += row.total_tokens;
  }
  const modelMap = new Map<string, { requests: number; tokens: number; latency: number[]; ok: number }>();
  for (const row of rows) {
    const entry = modelMap.get(row.model) || { requests: 0, tokens: 0, latency: [], ok: 0 };
    entry.requests += 1;
    entry.tokens += row.total_tokens;
    entry.latency.push(row.latency_ms);
    if (row.ok) entry.ok += 1;
    modelMap.set(row.model, entry);
  }
  const errorMap = new Map<string, number>();
  for (const row of rows.filter((item) => !item.ok)) {
    const key = row.error.split(':')[0]?.slice(0, 48) || 'Unknown error';
    errorMap.set(key, (errorMap.get(key) || 0) + 1);
  }
  return {
    requests: rows.length,
    ok: ok.length,
    errors: rows.length - ok.length,
    successRate: rows.length ? (ok.length / rows.length) * 100 : 0,
    promptTokens: sum(rows.map((row) => row.prompt_tokens)),
    completionTokens: sum(rows.map((row) => row.completion_tokens)),
    totalTokens: sum(rows.map((row) => row.total_tokens)),
    avgLatency: average(rows.map((row) => row.latency_ms)),
    reasoningCalls: rows.filter((row) => row.reasoning).length,
    estimatedCost: 0,
    byDay: Array.from(byDayMap.entries()).map(([key, value]) => ({
      key,
      label: key.slice(5),
      requests: value.requests,
      tokens: value.tokens,
    })),
    byModel: Array.from(modelMap.entries())
      .map(([model, entry]) => ({
        model,
        requests: entry.requests,
        tokens: entry.tokens,
        avgLatency: average(entry.latency),
        successRate: entry.requests ? (entry.ok / entry.requests) * 100 : 0,
      }))
      .sort((a, b) => b.requests - a.requests),
    errorKinds: Array.from(errorMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
  };
}

/* ── filtering ─────────────────────────────────────────────────────────── */

export const DEFAULT_FILTER: FilterState = {
  search: '',
  category: 'all',
  type: 'all',
  status: 'all',
  tag: null,
  minRating: 0,
  yearFrom: null,
  yearTo: null,
  favoriteOnly: false,
  sort: 'recent',
  view: 'grid',
};

export function filterTitles(titles: Title[], filter: FilterState): Title[] {
  const needle = filter.search.trim().toLowerCase();
  const filtered = titles.filter((title) => {
    if (filter.category !== 'all' && title.category !== filter.category) return false;
    if (filter.type !== 'all' && title.type !== filter.type) return false;
    if (filter.status !== 'all' && title.status !== filter.status) return false;
    if (filter.favoriteOnly && !title.favorite) return false;
    if (filter.minRating && title.rating < filter.minRating) return false;
    if (filter.yearFrom && (title.year || 0) < filter.yearFrom) return false;
    if (filter.yearTo && (title.year || 0) > filter.yearTo) return false;
    if (filter.tag && !splitList(title.tags).map((tag) => tag.toLowerCase()).includes(filter.tag.toLowerCase())) {
      return false;
    }
    if (needle) {
      const haystack = [
        title.title,
        title.original_title,
        title.genre,
        title.tags,
        title.country,
        title.language,
        title.summary,
        title.notes,
        title.reason,
        String(title.year || ''),
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
  const sorted = [...filtered];
  switch (filter.sort) {
    case 'title':
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'rating':
      sorted.sort((a, b) => b.rating - a.rating);
      break;
    case 'year':
      sorted.sort((a, b) => (b.year || 0) - (a.year || 0));
      break;
    case 'year-asc':
      sorted.sort((a, b) => (a.year || 0) - (b.year || 0));
      break;
    case 'runtime':
      sorted.sort((a, b) => (b.runtime || 0) - (a.runtime || 0));
      break;
    default:
      sorted.sort((a, b) => (b.watched_date || '').localeCompare(a.watched_date || ''));
  }
  return sorted;
}

export function libraryHistogram(titles: Title[]): Array<{ label: string; value: number }> {
  const decades = new Map<number, number>();
  for (const title of titles) {
    if (!title.year) continue;
    const decade = Math.floor(title.year / 10) * 10;
    decades.set(decade, (decades.get(decade) || 0) + 1);
  }
  return Array.from(decades.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([decade, value]) => ({ label: `${String(decade).slice(2)}s`, value }));
}

export function medianRuntime(titles: Title[]): number {
  return median(titles.map((title) => title.runtime || 0).filter(Boolean));
}

export function relatedTitles(db: DatabaseShape, titleId: string): Array<{ title: Title; kind: string; weight: number }> {
  return db.cinema_relationships
    .filter((relationship) => relationship.title_id === titleId)
    .map((relationship) => ({
      title: titleById(db, relationship.related_title_id),
      kind: relationship.kind,
      weight: relationship.weight,
    }))
    .filter((entry): entry is { title: Title; kind: string; weight: number } => Boolean(entry.title))
    .sort((a, b) => b.weight - a.weight);
}

export function tastePolarity(db: DatabaseShape): { love: number; good: number; hate: number } {
  return {
    love: db.cinema_titles.filter((title) => title.category === 'love').length,
    good: db.cinema_titles.filter((title) => title.category === 'good').length,
    hate: db.cinema_titles.filter((title) => title.category === 'hate').length,
  };
}

export { groupBy };
