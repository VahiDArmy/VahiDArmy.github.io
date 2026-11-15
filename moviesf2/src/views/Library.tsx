/** The shelf: filter, sort, read as a wall, a table, or a grid. */

import { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  Columns3,
  Filter,
  Grid3X3,
  LayoutList,
  Plus,
  Save,
  SearchX,
  SlidersHorizontal,
  Star,
  Table2,
  X,
} from 'lucide-react';
import { navigate, routeQuery, useRoute } from '../app/router';
import { useDb, insertRow, logActivity } from '../data/store';
import {
  DEFAULT_FILTER,
  filterTitles,
  libraryHistogram,
  tagStats,
  watchlistFor,
} from '../data/queries';
import type { FilterState } from '../types';
import { splitList } from '../lib/utils';
import { n, runtime, timestampLabel, typeLabel, statusLabel } from '../lib/format-extra';
import { TitleForm } from '../components/TitleForm';
import {
  Button,
  CategoryChip,
  Chip,
  EmptyState,
  IconButton,
  MiniPoster,
  Poster,
  SearchField,
  Select,
  Segmented,
  Stars,
  Tabs,
  useToast,
  cx,
} from '../components/ui';
import { SEED_STATUSES, SEED_TYPES } from '../components/constants';

export function Library() {
  const db = useDb();
  const route = useRoute();
  const toast = useToast();
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [adding, setAdding] = useState(false);
  const [savedName, setSavedName] = useState('');

  useEffect(() => {
    const params = routeQuery(route);
    setFilter((current) => ({
      ...current,
      search: params.get('q') || '',
      category: (params.get('category') as FilterState['category']) || 'all',
      tag: params.get('tag') || null,
      status: params.get('status') || 'all',
      favoriteOnly: params.get('favorite') === '1',
      minRating: Number(params.get('minRating') || 0),
    }));
    if (params.get('new') === '1') setAdding(true);
  }, [route.query]);

  const tags = useMemo(() => tagStats(db), [db]);
  const results = useMemo(() => filterTitles(db.cinema_titles, filter), [db.cinema_titles, filter]);
  const histogram = useMemo(() => libraryHistogram(results), [results]);
  const years = db.cinema_titles.map((title) => title.year).filter((year): year is number => Boolean(year));

  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    setFilter((current) => ({ ...current, [key]: value }));

  const activeFilters = [
    filter.category !== 'all' && { label: filter.category, clear: () => set('category', 'all') },
    filter.type !== 'all' && { label: filter.type, clear: () => set('type', 'all') },
    filter.status !== 'all' && { label: filter.status, clear: () => set('status', 'all') },
    filter.tag && { label: `#${filter.tag}`, clear: () => set('tag', null) },
    filter.minRating > 0 && { label: `≥ ${filter.minRating}`, clear: () => set('minRating', 0) },
    filter.favoriteOnly && { label: 'favourites', clear: () => set('favoriteOnly', false) },
    filter.search && { label: `“${filter.search}”`, clear: () => set('search', '') },
  ].filter(Boolean) as Array<{ label: string; clear: () => void }>;

  const saveView = () => {
    const name = savedName.trim() || `${filter.category} shelf`;
    insertRow('cinema_saved_views', {
      name,
      route: `library?category=${filter.category}&status=${filter.status}&tag=${filter.tag || ''}`,
      icon: '⌖',
      pin: true,
    } as never);
    logActivity('created', 'cinema_saved_views', null, `Saved view “${name}”`);
    setSavedName('');
    toast.push({ tone: 'success', title: 'View saved', body: name });
  };

  return (
    <>
      <div className="page-head">
        <div className="page-head__copy">
          <div className="eyebrow">The shelf · {db.cinema_titles.length} entries</div>
          <h1 className="page-title">
            Everything you have <em>decided.</em>
          </h1>
          <p className="page-sub">
            One room, three verdicts. Filter by verdict, decade, tag or the score you gave it at 1am. The wall view is
            for finding the film you cannot name.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setAdding(true)}>
            New entry
          </Button>
          <Button variant="outline" icon={<Save size={13} />} onClick={saveView}>
            Save view
          </Button>
        </div>
      </div>

      <div className="library-bar">
        <div style={{ flex: 1, minWidth: 180, maxWidth: 320 }}>
          <SearchField value={filter.search} onChange={(value) => set('search', value)} placeholder="Title, tag, country, note…" />
        </div>
        <div className="filter-row">
          {(['all', 'love', 'good', 'hate'] as const).map((category) => (
            <button
              key={category}
              className={cx('chip', filter.category === category && 'is-active')}
              onClick={() => set('category', category)}
            >
              {category === 'all' ? 'All' : category === 'love' ? '◆ Love' : category === 'hate' ? '✕ Hate' : '◇ Good'}
              <span className="faint" style={{ marginLeft: 3 }}>
                {category === 'all'
                  ? db.cinema_titles.length
                  : db.cinema_titles.filter((title) => title.category === category).length}
              </span>
            </button>
          ))}
        </div>
        <div className="filter-row">
          <Select className="filter-select" value={filter.type} onChange={(event) => set('type', event.target.value)} aria-label="Type">
            <option value="all">All types</option>
            {SEED_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
          <Select className="filter-select" value={filter.status} onChange={(event) => set('status', event.target.value)} aria-label="Status">
            <option value="all">All statuses</option>
            {SEED_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
          <Select className="filter-select" value={filter.sort} onChange={(event) => set('sort', event.target.value as FilterState['sort'])} aria-label="Sort">
            <option value="recent">Recently watched</option>
            <option value="title">Title A–Z</option>
            <option value="rating">Highest score</option>
            <option value="year">Newest first</option>
            <option value="year-asc">Oldest first</option>
            <option value="runtime">Longest first</option>
          </Select>
          <label className="range-mini" title="Minimum rating">
            <Star size={10} />
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={filter.minRating}
              onChange={(event) => set('minRating', Number(event.target.value))}
              className="range"
              style={{ '--fill': `${filter.minRating * 10}%` } as React.CSSProperties}
            />
            <b style={{ color: filter.minRating ? 'var(--accent)' : 'var(--text-4)' }}>{filter.minRating || 'any'}</b>
          </label>
          <button
            className={cx('chip', filter.favoriteOnly && 'is-active')}
            onClick={() => set('favoriteOnly', !filter.favoriteOnly)}
          >
            ★ favourites
          </button>
        </div>
        <div style={{ marginLeft: 'auto' }} className="row">
          <span className="count-label">
            <b>{results.length}</b> showing
          </span>
          <Segmented
            value={filter.view}
            onChange={(view) => set('view', view)}
            options={[
              { id: 'grid', label: '', icon: <Grid3X3 size={12} /> },
              { id: 'table', label: '', icon: <Table2 size={12} /> },
              { id: 'wall', label: '', icon: <Columns3 size={12} /> },
            ]}
          />
        </div>
      </div>

      {activeFilters.length > 0 && (
        <div className="filter-active" style={{ marginBottom: 12 }}>
          <Filter size={11} style={{ color: 'var(--text-4)' }} />
          {activeFilters.map((item) => (
            <button key={item.label} className="tag is-active" onClick={item.clear}>
              {item.label} <X size={9} />
            </button>
          ))}
          <button className="section-link" onClick={() => setFilter(DEFAULT_FILTER)}>
            clear all
          </button>
        </div>
      )}

      <div className="split" style={{ gridTemplateColumns: 'minmax(0,1fr) 236px', gap: 'var(--sp-5)' }}>
        <div style={{ minWidth: 0 }}>
          {results.length === 0 ? (
            <EmptyState
              icon={<SearchX size={24} />}
              title="Nothing on this shelf"
              text="No entry matches that combination. Loosen a filter, or add the film you were thinking of."
              action={
                <Button variant="outline" onClick={() => setFilter(DEFAULT_FILTER)}>
                  Reset filters
                </Button>
              }
            />
          ) : filter.view === 'grid' ? (
            <div className="poster-grid stagger">
              {results.map((title) => (
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
                    <span className="poster-cell__year">{title.year || '—'}</span>
                  </div>
                  <div className="poster-cell__tags">
                    <Chip sm mono tone={title.category === 'love' ? 'love' : title.category === 'hate' ? 'hate' : 'good'}>
                      {title.rating || '—'}
                    </Chip>
                    {splitList(title.tags).slice(0, 2).map((tag) => (
                      <Chip sm mono key={tag}>
                        {tag}
                      </Chip>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : filter.view === 'wall' ? (
            <div className="shelf-wall stagger">
              {results.map((title) => (
                <Poster
                  key={title.id}
                  size="sm"
                  title={title.title}
                  year={title.year}
                  category={title.category}
                  onClick={() => navigate('title', title.id)}
                  flat
                />
              ))}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 42 }} />
                    <th>Title</th>
                    <th className="num">Year</th>
                    <th>Type</th>
                    <th>Verdict</th>
                    <th className="num">Score</th>
                    <th className="num">Runtime</th>
                    <th>Status</th>
                    <th>Watched</th>
                    <th>Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((title) => (
                    <tr key={title.id} onClick={() => navigate('title', title.id)} style={{ cursor: 'pointer' }}>
                      <td>
                        <MiniPoster title={title.title} category={title.category} />
                      </td>
                      <td>
                        <strong>{title.title}</strong>
                        {title.favorite && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>★</span>}
                        <div className="faint mono" style={{ fontSize: 8.5 }}>
                          {title.original_title}
                        </div>
                      </td>
                      <td className="num">{title.year || '—'}</td>
                      <td>{typeLabel(title.type)}</td>
                      <td>
                        <CategoryChip category={title.category} />
                      </td>
                      <td className="num">{title.rating || '—'}</td>
                      <td className="num">{title.runtime ? runtime(title.runtime) : '—'}</td>
                      <td>{statusLabel(title.status)}</td>
                      <td className="mono" style={{ fontSize: 9 }}>
                        {title.watched_date || '—'}
                      </td>
                      <td>
                        <span className="mono faint" style={{ fontSize: 9 }}>
                          {splitList(title.tags).slice(0, 2).join(' · ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="stack" style={{ minWidth: 0 }}>
          <div className="panel panel--flat">
            <div className="panel-title">
              <SlidersHorizontal size={11} /> Shape of this view
            </div>
            <div className="bars" style={{ height: 76 }}>
              {histogram.map((item) => {
                const max = Math.max(...histogram.map((entry) => entry.value), 1);
                return (
                  <div className="bars__item" key={item.label} title={`${item.label}: ${item.value}`}>
                    <div className="bars__fill" style={{ height: `${(item.value / max) * 100}%`, maxWidth: 20 }} />
                    <span className="bars__label">{item.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="hairline" style={{ margin: '12px 0' }} />
            <div className="stack stack--tight" style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-4)' }}>
              <span className="row" style={{ justifyContent: 'space-between' }}>
                <span>years</span>
                <span style={{ color: 'var(--text-2)' }}>
                  {years.length ? `${Math.min(...years)}–${Math.max(...years)}` : '—'}
                </span>
              </span>
              <span className="row" style={{ justifyContent: 'space-between' }}>
                <span>avg score</span>
                <span style={{ color: 'var(--text-2)' }}>
                  {(results.reduce((total, title) => total + title.rating, 0) / Math.max(1, results.length)).toFixed(1)}
                </span>
              </span>
              <span className="row" style={{ justifyContent: 'space-between' }}>
                <span>favourites</span>
                <span style={{ color: 'var(--text-2)' }}>{results.filter((title) => title.favorite).length}</span>
              </span>
            </div>
          </div>

          <div className="panel panel--flat">
            <div className="panel-title">
              <Bookmark size={11} /> Saved views
            </div>
            <div className="stack stack--tight">
              {db.cinema_saved_views.map((view) => (
                <button
                  key={view.id}
                  className="mini-row"
                  style={{ textAlign: 'left', width: '100%' }}
                  onClick={() => {
                    const [, query] = view.route.split('?');
                    const params = new URLSearchParams(query || '');
                    setFilter({
                      ...DEFAULT_FILTER,
                      category: (params.get('category') as FilterState['category']) || 'all',
                      status: params.get('status') || 'all',
                      tag: params.get('tag') || null,
                      favoriteOnly: params.get('favorite') === '1',
                    });
                  }}
                >
                  <span style={{ color: 'var(--accent)' }}>{view.icon}</span>
                  <span className="mini-row__title">{view.name}</span>
                  {view.pin && <span className="faint">•</span>}
                </button>
              ))}
              {!db.cinema_saved_views.length && <span className="faint" style={{ fontSize: 10 }}>No saved views yet.</span>}
            </div>
            <div className="input-group" style={{ marginTop: 10 }}>
              <input
                className="input input--sm"
                placeholder="Name this view…"
                value={savedName}
                onChange={(event) => setSavedName(event.target.value)}
              />
              <IconButton label="Save current view" onClick={saveView}>
                <Save size={12} />
              </IconButton>
            </div>
          </div>

          <div className="panel panel--flat">
            <div className="panel-title">
              <Filter size={11} /> Tags ({tags.length})
            </div>
            <div className="filter-row" style={{ maxHeight: 190, overflowY: 'auto' }}>
              {tags.slice(0, 40).map((tag) => (
                <button
                  key={tag.tag}
                  className={cx('tag', filter.tag === tag.tag && 'is-active')}
                  onClick={() => set('tag', filter.tag === tag.tag ? null : tag.tag)}
                >
                  {tag.tag} <span className="faint">{tag.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="panel panel--flat">
            <div className="panel-title">
              <LayoutList size={11} /> Decade index
            </div>
            <div className="stack stack--tight">
              {Array.from(
                db.cinema_titles.reduce((map, title) => {
                  if (!title.year) return map;
                  const decade = Math.floor(title.year / 10) * 10;
                  map.set(decade, (map.get(decade) || 0) + 1);
                  return map;
                }, new Map<number, number>()),
              )
                .sort((a, b) => a[0] - b[0])
                .map(([decade, count]) => (
                  <button
                    key={decade}
                    className="mini-row"
                    style={{ width: '100%', textAlign: 'left' }}
                    onClick={() => {
                      set('yearFrom', decade);
                      set('yearTo', decade + 9);
                    }}
                  >
                    <span style={{ color: 'var(--text-2)', fontSize: 10 }}>{decade}s</span>
                    <span className="meter" style={{ flex: 1, height: 3 }}>
                      <span className="meter__fill" style={{ display: 'block', width: `${(count / db.cinema_titles.length) * 100 * 3}%` }} />
                    </span>
                    <span className="mini-row__meta">{count}</span>
                  </button>
                ))}
              {(filter.yearFrom || filter.yearTo) && (
                <Button size="sm" variant="ghost" onClick={() => { set('yearFrom', null); set('yearTo', null); }}>
                  Clear decade filter
                </Button>
              )}
            </div>
          </div>
        </aside>
      </div>

      {adding && <TitleForm onClose={() => setAdding(false)} onSaved={(title) => navigate('title', title.id)} />}
    </>
  );
}
