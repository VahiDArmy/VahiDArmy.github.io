/** The shell: rail, topbar, ticker, routing, command palette, boot. */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Aperture,
  Archive,
  Bookmark,
  CalendarDays,
  ChevronRight,
  Clock3,
  Command,
  Cpu,
  Database,
  Film,
  Flag,
  Gauge,
  GitBranch,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Menu,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  Plus,
  Quote,
  Search,
  Settings,
  Share2,
  Sparkles,
  Star,
  Swords,
  Target,
  TerminalSquare,
  Trophy,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { navigate, useRoute, getRoute, routeQuery } from './app/router';
import { useDb } from './data/store';
import { TAGLINE, VERSION } from './app/brand';
import {
  applyAppearance,
  getApiKey,
  getSettings,
  hasApiKey,
  useSettings,
  updateSettings,
} from './data/settings';
import { shelfSummary, usageSummary, viewingStreak, tagStats } from './data/queries';
import { n, hoursLabel, relative } from './lib/format';
import { clamp } from './lib/utils';
import { syncCatalogue } from './ai/models';
import {
  Button,
  IconButton,
  Kbd,
  ToastProvider,
  ConfirmProvider,
  useHotkey,
  useToast,
  cx,
  Avatar,
} from './components/ui';
import { TitleForm } from './components/TitleForm';
import { Dashboard } from './views/Dashboard';
import { Library } from './views/Library';
import { TitleDetail } from './views/TitleDetail';
import { Collections } from './views/Collections';
import { Ratings } from './views/Ratings';
import { Watchlist } from './views/Watchlist';
import { Sessions } from './views/Sessions';
import { People } from './views/People';
import { Quotes } from './views/Quotes';
import { Constellation } from './views/Constellation';
import { Goals } from './views/Goals';
import { Challenges } from './views/Challenges';
import { Events } from './views/Events';
import { Awards } from './views/Awards';
import { Prompts } from './views/Prompts';
import { Studio } from './views/Studio';
import { Arena } from './views/Arena';
import { Usage } from './views/Usage';
import { Shares } from './views/Shares';
import { Imports } from './views/Imports';
import { Notes } from './views/Notes';
import { DataLab } from './views/DataLab';
import { SettingsView } from './views/SettingsView';

interface NavItem {
  id: Parameters<typeof navigate>[0];
  label: string;
  icon: typeof Film;
  count?: number;
  hint?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function useNavGroups(): NavGroup[] {
  const db = useDb();
  const summary = useMemo(() => shelfSummary(db), [db]);
  const activeChallenges = db.cinema_challenges.filter((challenge) => challenge.status === 'active').length;
  const openWatchlist = db.cinema_watchlist.filter((item) => !item.done).length;
  return [
    {
      label: 'Screen',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'library', label: 'The shelf', icon: Film, count: summary.total },
        { id: 'constellation', label: 'Constellation', icon: Network },
        { id: 'sessions', label: 'Sessions', icon: Clock3, count: db.cinema_watch_sessions.length },
      ],
    },
    {
      label: 'Curation',
      items: [
        { id: 'collections', label: 'Collections', icon: Layers, count: db.cinema_collections.length },
        { id: 'ratings', label: 'Craft ratings', icon: Star, count: db.cinema_ratings.length },
        { id: 'quotes', label: 'Quotes & trivia', icon: Quote, count: db.cinema_quotes.length },
        { id: 'watchlist', label: 'Watchlist', icon: Bookmark, count: openWatchlist },
        { id: 'awards', label: 'Awards', icon: Trophy, count: db.cinema_awards.length },
      ],
    },
    {
      label: 'Planning',
      items: [
        { id: 'goals', label: 'Goals', icon: Target },
        { id: 'challenges', label: 'Challenges', icon: Flag, count: activeChallenges },
        { id: 'events', label: 'Screenings', icon: CalendarDays, count: db.cinema_events.length },
      ],
    },
    {
      label: 'Intelligence',
      items: [
        { id: 'studio', label: 'Projection booth', icon: TerminalSquare, count: db.cinema_ai_threads.length },
        { id: 'prompts', label: 'Prompt rack', icon: Sparkles, count: db.cinema_prompts.length },
        { id: 'arena', label: 'Model arena', icon: Swords },
        { id: 'usage', label: 'Usage ledger', icon: Gauge, count: db.cinema_ai_usage.length },
      ],
    },
    {
      label: 'Archive',
      items: [
        { id: 'people', label: 'People', icon: Users, count: db.cinema_people.length },
        { id: 'notes', label: 'Margin notes', icon: PenLine, count: db.cinema_mizan_notes.length },
        { id: 'shares', label: 'Share links', icon: Share2, count: db.cinema_shares.length },
        { id: 'imports', label: 'Imports', icon: Upload, count: db.cinema_import_batches.length },
        { id: 'data', label: 'Data lab', icon: Database },
      ],
    },
  ];
}

function Ticker() {
  const db = useDb();
  const summary = useMemo(() => shelfSummary(db), [db]);
  const streak = useMemo(() => viewingStreak(db), [db]);
  const stats = useMemo(() => usageSummary(db.cinema_ai_usage, 14), [db.cinema_ai_usage]);
  const tags = useMemo(() => tagStats(db).slice(0, 4), [db]);
  const quote = db.cinema_quotes.find((item) => item.favorite);
  const items = [
    <>
      <b>{summary.total}</b> entries
    </>,
    <>
      <b>{summary.loved}</b> loved <span className="dot" /> <b>{summary.hated}</b> hated
    </>,
    <>
      avg <b>{summary.avgRating.toFixed(1)}</b>/10
    </>,
    <>
      <b>{hoursLabel(summary.minutes)}</b> in the dark
    </>,
    <>
      streak <b>{streak.current}</b> days
    </>,
    <>
      <b>{stats.requests}</b> AI calls / 14d
    </>,
    <>
      <b>{db.cinema_collections.length}</b> collections
    </>,
    <>
      tags <b>{tags.map((tag) => tag.tag).join(' · ') || 'building'}</b>
    </>,
    quote ? <>“{quote.text.slice(0, 64)}…”</> : <>local-first · nothing leaves without a key</>,
    <>
      schema <b>27 tables</b>
    </>,
  ];
  return (
    <div className="ticker" aria-hidden>
      <div className="ticker__track">
        {[0, 1].map((pass) => (
          <div key={pass} style={{ display: 'flex', gap: 34, paddingRight: 34 }}>
            {items.map((item, index) => (
              <span className="ticker__item" key={`${pass}-${index}`}>
                <span className="dot" />
                {item}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <span className="rail__mark" aria-hidden>
      <Aperture size={21} strokeWidth={2.2} />
    </span>
  );
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const db = useDb();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);

  const commands = useMemo(() => {
    const nav = [
      ['dashboard', 'Dashboard'],
      ['library', 'The shelf'],
      ['studio', 'Projection booth'],
      ['collections', 'Collections'],
      ['ratings', 'Craft ratings'],
      ['watchlist', 'Watchlist'],
      ['sessions', 'Sessions'],
      ['constellation', 'Constellation'],
      ['goals', 'Goals'],
      ['challenges', 'Challenges'],
      ['events', 'Screenings'],
      ['quotes', 'Quotes & trivia'],
      ['people', 'People'],
      ['prompts', 'Prompt rack'],
      ['arena', 'Model arena'],
      ['usage', 'Usage ledger'],
      ['shares', 'Share links'],
      ['imports', 'Imports'],
      ['notes', 'Margin notes'],
      ['awards', 'Awards'],
      ['data', 'Data lab'],
      ['settings', 'Settings'],
    ].map(([id, label]) => ({
      group: 'Navigate',
      label,
      hint: id,
      icon: ChevronRight,
      run: () => navigate(id as never),
    }));

    const titles = db.cinema_titles.slice(0, 60).map((title) => ({
      group: 'Titles',
      label: title.title,
      hint: `${title.year || ''} ${title.category}`,
      icon: Film,
      run: () => navigate('title', title.id),
    }));

    const actions = [
      {
        group: 'Actions',
        label: 'Add a title',
        hint: 'N',
        icon: Plus,
        run: () => navigate('library', undefined, 'new=1'),
      },
      {
        group: 'Actions',
        label: 'Sync model catalogue',
        hint: 'OpenRouter',
        icon: Cpu,
        run: async () => {
          toast.push({ tone: 'info', title: 'Syncing catalogue…' });
          const result = await syncCatalogue();
          toast.push({ tone: result.ok ? 'success' : 'error', title: result.ok ? 'Catalogue synced' : 'Sync failed', body: result.message });
        },
      },
      {
        group: 'Actions',
        label: 'Open the hate shelf',
        hint: 'filter',
        icon: Archive,
        run: () => navigate('library', undefined, 'category=hate'),
      },
      {
        group: 'Actions',
        label: 'Export the database',
        hint: 'JSON',
        icon: Database,
        run: () => navigate('settings', undefined, 'tab=data'),
      },
    ];

    return [...actions, ...nav, ...titles];
  }, [db.cinema_titles, toast]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands.filter((command) => command.group !== 'Titles').slice(0, 40);
    return commands
      .filter((command) => `${command.label} ${command.hint}`.toLowerCase().includes(needle))
      .slice(0, 40);
  }, [commands, query]);

  useEffect(() => setSelected(0), [query]);

  const execute = useCallback(
    (index: number) => {
      const command = filtered[index];
      if (!command) return;
      onClose();
      void command.run();
    },
    [filtered, onClose],
  );

  return (
    <div className="scrim" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="cmdk__input">
          <Command size={16} style={{ color: 'var(--accent)' }} />
          <input
            autoFocus
            value={query}
            placeholder="Jump to a film, a room, or an action…"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setSelected((value) => Math.min(filtered.length - 1, value + 1));
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setSelected((value) => Math.max(0, value - 1));
              }
              if (event.key === 'Enter') execute(selected);
              if (event.key === 'Escape') onClose();
            }}
          />
          <Kbd>esc</Kbd>
        </div>
        <div className="cmdk__list">
          {filtered.map((command, index) => {
            const Icon = command.icon;
            const showGroup = index === 0 || filtered[index - 1].group !== command.group;
            return (
              <div key={`${command.group}-${command.label}-${index}`}>
                {showGroup && <div className="cmdk__group">{command.group}</div>}
                <button
                  className={cx('cmdk__item', index === selected && 'is-selected')}
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => execute(index)}
                >
                  <Icon size={13} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {command.label}
                  </span>
                  <span className="hint">{command.hint}</span>
                </button>
              </div>
            );
          })}
          {!filtered.length && (
            <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-4)', fontSize: 11 }}>
              Nothing in this room matches “{query}”.
            </div>
          )}
        </div>
        <div className="cmdk__foot">
          <span>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> move
          </span>
          <span>
            <Kbd>↵</Kbd> open
          </span>
          <span style={{ marginLeft: 'auto' }}>{filtered.length} results</span>
        </div>
      </div>
    </div>
  );
}

function Boot({ done }: { done: boolean }) {
  return (
    <div className={cx('boot', done && 'is-done')} aria-hidden={done}>
      <div className="boot__inner">
        <div className="boot__reel" />
        <div className="boot__title">Full Metal Cinema</div>
        <div className="boot__bar">
          <span />
        </div>
        <div className="boot__meta">threading the projector · local database · direct AI</div>
      </div>
    </div>
  );
}

function Shell() {
  const route = useRoute();
  const db = useDb();
  const settings = useSettings();
  const groups = useNavGroups();
  const [palette, setPalette] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const keyPresent = hasApiKey();

  useHotkey('mod+k', () => setPalette(true));
  useHotkey('mod+shift+n', () => setAdding(true));
  useHotkey('mod+/', () => setPalette(true));

  useEffect(() => {
    applyAppearance(settings);
  }, [settings]);

  useEffect(() => {
    const params = routeQuery(route);
    if (params.get('new') === '1') {
      setAdding(true);
      navigate('library');
    }
  }, [route]);

  useEffect(() => {
    document.body.style.overflow = drawer ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawer]);

  const crumb = useMemo(() => {
    const map: Record<string, string> = {
      dashboard: 'Dashboard',
      library: 'The shelf',
      title: db.cinema_titles.find((title) => title.id === route.param)?.title || 'Title',
      collections: 'Collections',
      ratings: 'Craft ratings',
      watchlist: 'Watchlist',
      sessions: 'Sessions',
      people: 'People',
      quotes: 'Quotes & trivia',
      constellation: 'Constellation',
      goals: 'Goals',
      challenges: 'Challenges',
      events: 'Screenings',
      awards: 'Awards',
      prompts: 'Prompt rack',
      studio: 'Projection booth',
      arena: 'Model arena',
      usage: 'Usage ledger',
      shares: 'Share links',
      imports: 'Imports',
      notes: 'Margin notes',
      data: 'Data lab',
      settings: 'Settings',
    };
    return map[route.id] || 'Dashboard';
  }, [route, db.cinema_titles]);

  const view = (() => {
    switch (route.id) {
      case 'library':
        return <Library />;
      case 'title':
        return <TitleDetail id={route.param} />;
      case 'collections':
        return <Collections param={route.param} />;
      case 'ratings':
        return <Ratings />;
      case 'watchlist':
        return <Watchlist />;
      case 'sessions':
        return <Sessions />;
      case 'people':
        return <People param={route.param} />;
      case 'quotes':
        return <Quotes />;
      case 'constellation':
        return <Constellation />;
      case 'goals':
        return <Goals />;
      case 'challenges':
        return <Challenges />;
      case 'events':
        return <Events />;
      case 'awards':
        return <Awards />;
      case 'prompts':
        return <Prompts />;
      case 'studio':
        return <Studio threadId={route.param} />;
      case 'arena':
        return <Arena />;
      case 'usage':
        return <Usage />;
      case 'shares':
        return <Shares />;
      case 'imports':
        return <Imports />;
      case 'notes':
        return <Notes />;
      case 'data':
        return <DataLab />;
      case 'settings':
        return <SettingsView />;
      case 'dashboard':
      default:
        return <Dashboard />;
    }
  })();

  const liveThread = db.cinema_ai_threads.filter((thread) => !thread.archived).length;

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="shell" data-collapsed={settings.sidebarCollapsed} data-drawer={drawer}>
        <aside className="rail" aria-label="Primary navigation">
          <button className="rail__brand" onClick={() => navigate('dashboard')} aria-label="Full Metal Cinema, dashboard">
            <BrandMark />
            <span className="rail__wordmark">
              <strong>Full Metal Cinema</strong>
              <span>shelf · booth</span>
            </span>
          </button>

          <button className="rail__key" data-ok={keyPresent} onClick={() => navigate('settings', undefined, 'tab=ai')}>
            <span className="led" />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {keyPresent ? 'Direct AI armed' : 'Add a provider key'}
            </span>
            {settings.sidebarCollapsed ? null : <ChevronRight size={12} />}
          </button>

          <div className="rail__scroll">
            {groups.map((group) => (
              <div className="rail__group" key={group.label}>
                <div className="rail__group-label">
                  <span>{group.label}</span>
                  {group.label === 'Intelligence' && <em>{liveThread}</em>}
                </div>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = route.id === item.id || (item.id === 'library' && route.id === 'title');
                  return (
                    <button
                      key={item.id}
                      className={cx('nav-item', active && 'is-active')}
                      onClick={() => {
                        navigate(item.id);
                        setDrawer(false);
                      }}
                      title={settings.sidebarCollapsed ? item.label : undefined}
                    >
                      <Icon size={15} strokeWidth={1.8} />
                      <span>{item.label}</span>
                      {item.count !== undefined && item.count > 0 && <span className="nav-item__count">{item.count}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="rail__stack">
            <div className="rail__card">
              <div className="rail__card-label">
                <Sparkles size={10} /> Now showing
              </div>
              <div className="rail__card-title">
                {db.cinema_ai_threads.find((thread) => thread.pinned)?.title ||
                  db.cinema_titles.find((title) => title.status === 'watching')?.title ||
                  'Your shelf'}
              </div>
              <div className="rail__card-meta">
                {db.cinema_ai_threads.length} booth threads · {db.cinema_titles.length} entries
              </div>
            </div>
            <button className="nav-item" onClick={() => navigate('settings')}>
              <Settings size={15} strokeWidth={1.8} />
              <span>Settings</span>
            </button>
          </div>

          <div className="rail__foot">
            <Avatar name="Operator 01" accent />
            <div className="rail__foot-meta">
              <strong>Operator 01</strong>
              <span>local · v{VERSION}</span>
            </div>
            <IconButton
              label={settings.sidebarCollapsed ? 'Expand rail' : 'Collapse rail'}
              size="sm"
              onClick={() => updateSettings({ sidebarCollapsed: !settings.sidebarCollapsed })}
              style={{ marginLeft: 'auto' }}
            >
              {settings.sidebarCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
            </IconButton>
          </div>
        </aside>

        {drawer && <div className="rail__overlay" onClick={() => setDrawer(false)} />}

        <div className="main">
          <header className="topbar">
            <IconButton label="Open navigation" className="topbar__menu" onClick={() => setDrawer(true)}>
              <Menu size={17} />
            </IconButton>
            <div className="topbar__crumbs">
              <button onClick={() => navigate('dashboard')} style={{ color: 'inherit' }}>
                FMC
              </button>
              <span className="crumb-sep">/</span>
              <strong>{crumb}</strong>
            </div>
            <div className="topbar__spacer" />
            <form
              className="topbar__search"
              onSubmit={(event) => {
                event.preventDefault();
                navigate('library', undefined, search ? `q=${encodeURIComponent(search)}` : undefined);
              }}
            >
              <Search size={13} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search the shelf…"
                aria-label="Search the shelf"
              />
              <kbd>↵</kbd>
            </form>
            <div className="topbar__actions">
              <button className="topbar__ai" data-ok={keyPresent} onClick={() => navigate('studio')} title="Open the projection booth">
                <span className="led" />
                <span className="ai-label">{keyPresent ? 'Booth online' : 'Booth idle'}</span>
              </button>
              <IconButton label="Command palette (Ctrl K)" onClick={() => setPalette(true)}>
                <Command size={15} />
              </IconButton>
              <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => setAdding(true)}>
                Entry
              </Button>
            </div>
          </header>
          <Ticker />
          <main className="page" id="main" key={route.id + (route.param || '')}>
            {view}
          </main>
          <footer className="foot">
            <span className="foot__mark">FMC</span>
            <span>{TAGLINE}</span>
            <span className="foot__dot">·</span>
            <span>{db.cinema_titles.length} entries</span>
            <span className="foot__dot">·</span>
            <span>{db.cinema_watch_sessions.length} sessions</span>
            <span className="foot__dot">·</span>
            <span>{db.cinema_ai_threads.length} booth threads</span>
            <span className="foot__dot">·</span>
            <span>last activity {relative(db.cinema_activity[0]?.created_at)}</span>
            <span style={{ marginLeft: 'auto' }} className="foot__dot">
              no telemetry · key {keyPresent ? 'on device' : 'absent'} · {TAGLINE}
            </span>
          </footer>
        </div>
      </div>

      {palette && <CommandPalette onClose={() => setPalette(false)} />}
      {adding && (
        <TitleForm
          onClose={() => setAdding(false)}
          onSaved={(title) => {
            if (title?.id) navigate('title', title.id);
          }}
        />
      )}
    </>
  );
}

export function Root() {
  const [booted, setBooted] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setBooted(true), 850);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!window.location.hash) {
      const stored = getSettings();
      navigate(stored.sidebarCollapsed ? 'dashboard' : 'dashboard');
    }
  }, []);
  void getApiKey;
  void getRoute;
  void clamp;
  void n;
  return (
    <ToastProvider>
      <ConfirmProvider>
        <Shell />
        <Boot done={booted} />
      </ConfirmProvider>
    </ToastProvider>
  );
}
