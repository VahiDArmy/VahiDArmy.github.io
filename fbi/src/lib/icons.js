// Minimal stroke icon set (24x24 grid, currentColor).
const P = {
  spark:
    '<path d="M12 3l1.9 5.2L19 10l-5.1 1.8L12 17l-1.9-5.2L5 10l5.1-1.8z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  send: '<path d="M4.5 12h15M13 5.5L19.5 12 13 18.5"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M15 6.5V5a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2h1.5"/>',
  check: '<path d="M4.5 12.5l5 5 10-11"/>',
  edit: '<path d="M4 20h4l10.5-10.5a2.8 2.8 0 10-4-4L4 16z"/><path d="M13.5 5.5l5 5"/>',
  refresh: '<path d="M20 11a8 8 0 10-2.5 6.4"/><path d="M20 5v6h-6"/>',
  trash: '<path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
  branch:
    '<circle cx="6" cy="5" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="6" cy="19" r="2.4"/><path d="M6 7.4v9.2M8.4 19h5.1a4 4 0 004-4V8.4"/>',
  download: '<path d="M12 3v11M7.5 10L12 14.5 16.5 10"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/>',
  upload: '<path d="M12 16V5M7.5 9L12 4.5 16.5 9"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.34 1.88l.06.06a2 2 0 11-2.83 2.83l-.06-.06A1.7 1.7 0 0015 19.4a1.7 1.7 0 00-1 1.56V21a2 2 0 11-4 0v-.1A1.7 1.7 0 009 19.4a1.7 1.7 0 00-1.88.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.7 1.7 0 004.6 15a1.7 1.7 0 00-1.56-1H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.34-1.88l-.06-.06a2 2 0 112.83-2.83l.06.06A1.7 1.7 0 009 4.6h.06A1.7 1.7 0 0010 3.04V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.56 1.7 1.7 0 001.88-.34l.06-.06a2 2 0 112.83 2.83l-.06.06A1.7 1.7 0 0019.4 9v.06a1.7 1.7 0 001.56 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16 7l2 2M19 4l2 2"/>',
  cpu: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  chevronRight: '<path d="M9 6l6 6-6 6"/>',
  chevronLeft: '<path d="M15 6l-6 6 6 6"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  pin: '<path d="M12 3l2.3 6.1L20 11l-4.6 4 1 6-4.4-3.2L7.6 21l1-6L4 11l5.7-1.9z"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1.5"/><path d="M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8"/><path d="M10 12h4"/>',
  code: '<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  star: '<path d="M12 3.5l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.9l6.1-.8z"/>',
  lock: '<rect x="4.5" y="10" width="15" height="10" rx="2.5"/><path d="M8 10V7.5a4 4 0 018 0V10"/>',
  unlock: '<rect x="4.5" y="10" width="15" height="10" rx="2.5"/><path d="M8 10V7.5a4 4 0 017-2.6"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0115 0"/>',
  logout: '<path d="M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4"/><path d="M10 8l-4 4 4 4M6 12h9"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5z"/><path d="M4 18.5h16"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.1"/>',
  alert: '<path d="M12 3.5l9 16H3z"/><path d="M12 9v5M12 16.6v.1"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 3 2.6 15 0 18M12 3c-2.6 3-2.6 15 0 18"/>',
  zap: '<path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z"/>',
  file: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/>',
  paperclip: '<path d="M20 11.5l-7.6 7.6a5 5 0 01-7-7l8-8a3.4 3.4 0 114.8 4.8l-8 8a1.8 1.8 0 11-2.5-2.5l7-7"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9 4v16"/>',
  message: '<path d="M20 15a3 3 0 01-3 3H9l-5 3V6a3 3 0 013-3h10a3 3 0 013 3z"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  activity: '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
  external: '<path d="M14 4h6v6M20 4l-8 8"/><path d="M18 14v5a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h5"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7 9l3 3-3 3M13 15h4"/>',
  palette:
    '<path d="M12 3a9 9 0 000 18c1.4 0 2-.9 2-1.8 0-1.3-1-1.7-1-2.9 0-.8.7-1.5 1.7-1.5H17a4 4 0 004-4A9 9 0 0012 3z"/><circle cx="7.6" cy="11" r="1.1"/><circle cx="10" cy="7.3" r="1.1"/><circle cx="15" cy="7.5" r="1.1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.5 2"/>',
  hash: '<path d="M9 3.5L7.5 20.5M16.5 3.5L15 20.5M3.5 8.5h17M3 15.5h17"/>',
  github:
    '<path d="M9 19c-4 1.5-4-2.5-6-3m12 6v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 00-1.3-3.2 4.3 4.3 0 00-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 00-6.2 0C7.5 3.8 6.4 4.1 6.4 4.1a4.3 4.3 0 00-.1 3.2A4.6 4.6 0 005 10.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V22"/>',
  google:
    '<path d="M21.5 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.3a4.6 4.6 0 01-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z"/><path d="M12 22c2.7 0 4.9-.9 6.5-2.4l-3.2-2.5c-.9.6-2 1-3.3 1a5.8 5.8 0 01-5.5-4H3.2v2.6A10 10 0 0012 22z"/><path d="M6.5 14.1a6 6 0 010-3.8V7.7H3.2a10 10 0 000 8.6z"/><path d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 003.2 7.7l3.3 2.6A5.8 5.8 0 0112 6.1z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 7.5L12 13l8.5-5.5"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 7.8-8 9-4.6-1.2-8-4.5-8-9V6z"/><path d="M8.8 12.2l2.2 2.2 4.4-4.4"/>',
  wand: '<path d="M15 4V2M15 22v-2M4 12H2M22 12h-2M6.3 6.3L4.8 4.8M19.2 19.2l-1.5-1.5M17.7 6.3l1.5-1.5M4.8 19.2l1.5-1.5"/><path d="M9 15l6-6"/>',
  history: '<path d="M3.5 12a8.5 8.5 0 108.5-8.5A8.4 8.4 0 005.4 7"/><path d="M3 3v4.5h4.5"/><path d="M12 7.5V12l3 2"/>',
  save: '<path d="M5 3h11l4 4v12a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"/><path d="M8 3v6h7V3M8 21v-7h8v7"/>',
  arrowLeft: '<path d="M20 12H4M10 6l-6 6 6 6"/>',
  arrowRight: '<path d="M4 12h16M14 6l6 6-6 6"/>',
  arrowUpRight: '<path d="M7 17L17 7M9 7h8v8"/>',
  tree: '<rect x="9" y="2.5" width="6" height="5" rx="1.5"/><rect x="2.5" y="16.5" width="6" height="5" rx="1.5"/><rect x="15.5" y="16.5" width="6" height="5" rx="1.5"/><path d="M12 7.5v4M5.5 16.5v-2.5h13v2.5"/>',
  chat: '<path d="M21 12a8.5 8.5 0 01-12.3 7.6L4 21l1.4-4.6A8.5 8.5 0 1121 12z"/>',
  filter: '<path d="M4 5h16l-6 7.5V20l-4-2v-5.5z"/>',
  expand: '<path d="M4 9V4h5M20 15v5h-5M20 9V4h-5M4 15v5h5"/>',
  compress: '<path d="M9 4v5H4M15 20v-5h5M15 4v5h5M9 20v-5H4"/>',
  brain: '<path d="M9.5 4.5A3 3 0 006.6 8a3 3 0 00-1.4 5.5A3 3 0 007 19a3 3 0 005.5 1.2V3.8A3 3 0 009.5 4.5z"/><path d="M14.5 4.5A3 3 0 0117.4 8a3 3 0 011.4 5.5A3 3 0 0117 19a3 3 0 01-5.5 1.2"/>',
  tweet: '<path d="M4 4l7 9-7 7h3l5.5-5.5L17 20h3l-7.2-9.3L19.5 4h-3l-5 5L7 4z"/>',
};

export function icon(name, cls = '') {
  const paths = P[name] || P.spark;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="${cls}" aria-hidden="true">${paths}</svg>`;
}

export function iconFilled(name, cls = '') {
  const paths = P[name] || P.spark;
  return `<svg viewBox="0 0 24 24" fill="currentColor" class="${cls}" aria-hidden="true">${paths}</svg>`;
}

export const ICON_NAMES = Object.keys(P);
