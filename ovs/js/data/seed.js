// AURORA OS — Seed Data

const FIRST_NAMES = ['Ava', 'Liam', 'Noah', 'Emma', 'Olivia', 'Mateo', 'Sofia', 'Lucas', 'Mia', 'Zara', 'Kai', 'Nora', 'Elias', 'Iris', 'Omar', 'Priya', 'Diego', 'Hana', 'Felix', 'Leila'];
const LAST_NAMES = ['Chen', 'Park', 'Silva', 'Okafor', 'Haddad', 'Nakamura', 'Rossi', 'Novak', 'Kowalski', 'Hernandez', 'Ahmadi', 'Johansson', 'Kumar', 'Dubois', 'Castillo', 'Sharma', 'Mbeki', 'Fischer', 'Reyes', 'Yilmaz'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max) { return min + Math.random() * (max - min); }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function daysAgo(n) { return Date.now() - n * 86400000; }
function hoursAgo(n) { return Date.now() - n * 3600000; }

export function makeUsers(n = 20) {
  const out = [];
  const used = new Set();
  for (let i = 0; i < n; i++) {
    let first, last, name;
    do {
      first = pick(FIRST_NAMES);
      last = pick(LAST_NAMES);
      name = first + ' ' + last;
    } while (used.has(name));
    used.add(name);
    out.push({
      id: 'u-' + i,
      name,
      initials: first[0] + last[0],
      email: first.toLowerCase() + '.' + last.toLowerCase() + '@aurora.dev',
      role: pick(['Engineer', 'Designer', 'PM', 'Analyst', 'QA', 'DevOps']),
      status: pick(['online', 'online', 'online', 'away', 'offline']),
    });
  }
  return out;
}

export const USERS = makeUsers(20);

export function makeTasks(n = 28) {
  const titles = [
    'Refactor authentication middleware', 'Update pricing page copy', 'Fix mobile nav overlap',
    'Design new dashboard widget', 'Migrate DB to v3 schema', 'Add CSV export to reports',
    'Investigate slow API response', 'Write unit tests for parser', 'Review PR #482',
    'Improve onboarding flow', 'Add dark mode to settings', 'Fix tooltip z-index bug',
    'Optimize image pipeline', 'Set up CI pipeline for staging', 'Draft Q3 roadmap',
    'Update dependencies', 'Clean up dead CSS', 'Add empty-state illustrations',
    'Fix calendar drag on Safari', 'Implement search filters', 'Redesign icon set',
    'Set up error tracking', 'Document deployment process', 'Improve accessibility labels',
    'Add keyboard shortcuts', 'Migrate to new build tool', 'Profile slow render path',
    'Standardize form validation',
  ];
  const tags = ['bug', 'feature', 'design', 'infra', 'docs', 'chore', 'research'];
  const statuses = ['backlog', 'todo', 'progress', 'review', 'done'];
  const priorities = ['low', 'medium', 'high', 'critical'];
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: 't-' + i,
      title: titles[i % titles.length],
      status: statuses[i % statuses.length],
      priority: pick(priorities),
      assignee: pick(USERS).id,
      tags: [pick(tags), pick(tags)].filter((v, idx, a) => a.indexOf(v) === idx),
      due: daysAgo(-randInt(1, 21)),
      createdAt: daysAgo(randInt(1, 40)),
      order: i,
      comments: randInt(0, 5),
    });
  }
  return out;
}

export const TASKS = makeTasks(28);

export function makeTransactions(n = 40) {
  const services = ['Compute', 'Storage', 'Database', 'CDN', 'Functions', 'ML', 'Logs', 'Backup'];
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: 'tx-' + i,
      date: daysAgo(randInt(0, 30)),
      service: pick(services),
      amount: +(rand(12, 4200).toFixed(2)),
      status: pick(['paid', 'paid', 'paid', 'pending', 'failed']),
      region: pick(['us-east-1', 'us-west-2', 'eu-west-1', 'ap-south-1']),
    });
  }
  return out.sort((a, b) => b.date - a.date);
}

export const TRANSACTIONS = makeTransactions(40);

export function makeTimeseries(n = 30, base = 100, variance = 20) {
  const out = [];
  let val = base;
  for (let i = 0; i < n; i++) {
    val = val + rand(-variance, variance);
    val = Math.max(base * 0.4, Math.min(base * 1.6, val));
    out.push(+val.toFixed(1));
  }
  return out;
}

export function makeEvents(n = 12) {
  const titles = ['Team standup', 'Design review', '1:1 with Ava', 'Sprint planning', 'Retrospective', 'Client call', 'Lunch', 'Ship prep', 'Bug triage', 'Roadmap sync', 'Interview panel', 'Docs workshop'];
  const out = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + randInt(-3, 10));
    const hour = randInt(8, 18);
    d.setHours(hour, [0, 15, 30, 45][randInt(0, 3)], 0, 0);
    const dur = [30, 45, 60, 90][randInt(0, 3)];
    out.push({
      id: 'ev-' + i,
      title: titles[i % titles.length],
      start: d.toISOString(),
      duration: dur,
      attendees: [USERS[randInt(0, USERS.length - 1)].id, USERS[randInt(0, USERS.length - 1)].id],
      color: ['accent', 'success', 'warning', 'info', 'danger'][randInt(0, 4)],
    });
  }
  return out;
}

export const EVENTS = makeEvents(12);

export function makeMessages(n = 20) {
  const templates = [
    'Shipped the fix to staging.', 'Can you review when you get a sec?',
    'Looks good to me 👍', 'Have a minute to pair on this?',
    'Deployed v2.4.1 to prod.', 'Running into a CORS issue.',
    'Standup notes are up.', 'Pushed a new branch — check it out.',
    'PR merged, thanks!', 'Blocked on the API key rotation.',
  ];
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: 'msg-' + i,
      authorId: USERS[randInt(0, USERS.length - 1)].id,
      text: pick(templates),
      ts: hoursAgo(randInt(0, 72)),
    });
  }
  return out.sort((a, b) => a.ts - b.ts);
}

export const CHANNELS = [
  { id: 'general', name: 'general', topic: 'Company-wide announcements', members: 42, unread: 0 },
  { id: 'engineering', name: 'engineering', topic: 'Build, ship, iterate', members: 18, unread: 3 },
  { id: 'design', name: 'design', topic: 'Design critique & new work', members: 9, unread: 1 },
  { id: 'random', name: 'random', topic: 'Off-topic, always', members: 51, unread: 0 },
  { id: 'product', name: 'product', topic: 'Product strategy & roadmap', members: 14, unread: 2 },
];

export const MESSAGES = makeMessages(20);

export function makeFiles(path = '/', depth = 0) {
  if (depth > 3) return [];
  const dirs = ['Documents', 'Projects', 'Photos', 'Music', 'Downloads', 'Desktop', 'Archive'];
  const files = ['report.pdf', 'notes.md', 'budget.xlsx', 'diagram.svg', 'logo.png', 'app.js', 'config.json', 'README.md', 'data.csv', 'draft.docx'];
  const out = [];
  const n = randInt(3, 6);
  for (let i = 0; i < n; i++) {
    const isDir = Math.random() > 0.5;
    const name = isDir ? pick(dirs) : pick(files);
    out.push({
      id: 'f-' + Math.random().toString(36).slice(2, 8),
      name,
      type: isDir ? 'folder' : (name.split('.').pop() || 'file'),
      size: isDir ? 0 : randInt(1000, 5000000),
      modified: daysAgo(randInt(0, 90)),
      path: path + '/' + name,
      children: isDir ? makeFiles(path + '/' + name, depth + 1) : null,
    });
  }
  return out;
}

export const FILES = makeFiles('/');

export function makeNotes() {
  return [
    { id: 'n-1', title: 'Weekly planning', body: '# Weekly planning\n\n- Review PRs\n- Ship v2.4.1\n- Draft roadmap\n', updated: daysAgo(1) },
    { id: 'n-2', title: 'API design notes', body: '# API design\n\nConsider REST vs GraphQL for v2 endpoints.\n\n- Auth via JWT\n- Pagination via cursor\n', updated: daysAgo(3) },
    { id: 'n-3', title: 'Interview questions', body: '# Interview questions\n\n1. Explain event loop\n2. Difference between Promise.all and Promise.allSettled\n3. When to use `useMemo`\n', updated: daysAgo(5) },
    { id: 'n-4', title: 'Design system todo', body: '# Design system\n\n- Buttons variants ✓\n- Forms\n- Tables\n- Modals\n', updated: daysAgo(8) },
  ];
}

export const NOTES = makeNotes();

export const PLAYLIST = [
  { id: 's-1', title: 'Midnight Drive', artist: 'Neon Waves', duration: 213, album: 'Nightfall' },
  { id: 's-2', title: 'Echoes', artist: 'Aurora Bay', duration: 245, album: 'Lights' },
  { id: 's-3', title: 'Slow Motion', artist: 'Kinetic', duration: 198, album: 'Motion' },
  { id: 's-4', title: 'Cascade', artist: 'Rivers', duration: 276, album: 'Flow' },
  { id: 's-5', title: 'Halogen', artist: 'Lumen', duration: 221, album: 'Glow' },
  { id: 's-6', title: 'Paper Planes', artist: 'Fold', duration: 189, album: 'Origami' },
  { id: 's-7', title: 'Tide Pools', artist: 'Coastal', duration: 264, album: 'Shores' },
  { id: 's-8', title: 'Distance', artist: 'Kinetic', duration: 233, album: 'Motion' },
];

export const KPI_DATA = [
  { label: 'Revenue', value: '$284.7K', delta: 12.4, trend: 'up', series: makeTimeseries(20, 100, 12) },
  { label: 'Active users', value: '18,342', delta: 8.1, trend: 'up', series: makeTimeseries(20, 100, 15) },
  { label: 'Conversion', value: '4.28%', delta: -1.2, trend: 'down', series: makeTimeseries(20, 100, 10) },
  { label: 'Avg. session', value: '6m 42s', delta: 3.6, trend: 'up', series: makeTimeseries(20, 100, 8) },
];
