/** A hand-drawn, inline SVG icon set — no icon-font dependency. */

const PATHS = {
  menu: ['M3 6h18', 'M3 12h18', 'M3 18h18'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  plus: ['M12 5v14', 'M5 12h14'],
  search: ['M21 21l-4.35-4.35', 'circle:11,11,7'],
  send: ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7z'],
  stop: ['rect:6,6,12,12,2'],
  copy: ['rect:9,9,12,12,2', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
  check: ['M20 6L9 17l-5-5'],
  checkCircle: ['circle:12,12,9', 'M8.5 12.5l2.5 2.5 4.8-5.2'],
  xCircle: ['circle:12,12,9', 'M9 9l6 6', 'M15 9l-6 6'],
  alert: ['M12 9v4', 'M12 17h.01', 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'],
  info: ['circle:12,12,9', 'M12 11v5', 'M12 8h.01'],
  edit: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z'],
  refresh: ['M21 12a9 9 0 1 1-2.6-6.4', 'M21 3v6h-6'],
  trash: ['M3 6h18', 'M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2', 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6', 'M10 11v6', 'M14 11v6'],
  pin: ['M12 17v5', 'M8 3h8l-1 6 4 4H5l4-4-1-6z'],
  archive: ['rect:3,4,18,4,1', 'M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8', 'M10 12h4'],
  settings: ['circle:12,12,3', 'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'],
  chart: ['M3 3v18h18', 'M7 15l4-5 4 3 5-7'],
  cpu: ['rect:4,4,16,16,2', 'rect:9,9,6,6,1', 'M9 1v3', 'M15 1v3', 'M9 20v3', 'M15 20v3', 'M1 9h3', 'M1 15h3', 'M20 9h3', 'M20 15h3'],
  spark: ['M12 2l1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2z', 'M19 17l.7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7L19 17z'],
  sun: ['circle:12,12,4', 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
  moon: ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronUp: ['M18 15l-6-6-6 6'],
  chevronLeft: ['M15 18l-6-6 6-6'],
  chevronRight: ['M9 18l6-6-6-6'],
  arrowRight: ['M5 12h14', 'M13 6l6 6-6 6'],
  arrowLeft: ['M19 12H5', 'M11 18l-6-6 6-6'],
  arrowUp: ['M12 19V5', 'M6 11l6-6 6 6'],
  key: ['circle:7.5,15.5,4.5', 'M10.7 12.3L21 2', 'M16 7l3 3', 'M19 4l2 2'],
  external: ['M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6', 'M15 3h6v6', 'M10 14L21 3'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12'],
  folder: ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z'],
  chat: ['M21 11.5a8.4 8.4 0 0 1-8.5 8.5 9 9 0 0 1-3.7-.8L3 21l1.8-5.8a8.5 8.5 0 1 1 16.2-3.7z'],
  user: ['circle:12,8,4', 'M4 21a8 8 0 0 1 16 0'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  branch: ['circle:6,6,3', 'circle:18,6,3', 'circle:12,18,3', 'M6 9v2a3 3 0 0 0 3 3h3a3 3 0 0 1 3 3v1', 'M18 9v1a3 3 0 0 1-3 3h-2'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'circle:12,12,3'],
  eyeOff: ['M3 3l18 18', 'M10.6 10.6a3 3 0 0 0 4.2 4.2', 'M9.9 5.2A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.1 3.2', 'M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a10 10 0 0 0 4.2-.9'],
  sliders: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'],
  zap: ['M13 2L3 14h9l-1 8 10-12h-9l1-8z'],
  clock: ['circle:12,12,9', 'M12 7v5l3 2'],
  more: ['circle:5,12,1.6', 'circle:12,12,1.6', 'circle:19,12,1.6'],
  filter: ['M4 4h16', 'M7 12h10', 'M10 20h4'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  code: ['M8 9l-4 3 4 3', 'M16 9l4 3-4 3', 'M14 5l-4 14'],
  terminal: ['M4 17l6-6-6-6', 'M12 19h8'],
  globe: ['circle:12,12,9', 'M3 12h18', 'M12 3a15 15 0 0 1 0 18', 'M12 3a15 15 0 0 0 0 18'],
  star: ['M12 2l3 6.2 6.8 1-4.9 4.8 1.2 6.8-6.1-3.2-6.1 3.2 1.2-6.8L2.2 9.2l6.8-1L12 2z'],
  lock: ['rect:4,10,16,11,2', 'M8 10V7a4 4 0 0 1 8 0v3'],
  mail: ['rect:3,5,18,14,2', 'M3 7l9 6 9-6'],
  magic: ['M15 4V2', 'M15 10V8', 'M12 5h-2', 'M20 5h-2', 'M6 18l10-10', 'M4 20l2-2'],
  layers: ['M12 2l9 5-9 5-9-5 9-5z', 'M3 12l9 5 9-5', 'M3 17l9 5 9-5'],
  brain: ['M9.5 3a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 1 4.5A3 3 0 0 0 9.5 21a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3z', 'M14.5 3a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-1 4.5A3 3 0 0 1 14.5 21a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z'],
  compass: ['circle:12,12,9', 'M16.2 7.8l-2.1 6.3-6.3 2.1 2.1-6.3 6.3-2.1z'],
  pen: ['M12 19l7-7 3 3-7 7-3-3z', 'M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z', 'M2 2l7.6 7.6', 'circle:11,11,2'],
  target: ['circle:12,12,9', 'circle:12,12,5', 'circle:12,12,1.5'],
  scale: ['M12 3v18', 'M5 21h14', 'M3 7h18', 'M6 7l-3 7a3.5 3.5 0 0 0 7 0L6 7z', 'M18 7l-3 7a3.5 3.5 0 0 0 7 0l-4-7z'],
  book: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'],
  database: ['ellipse:12,5,8,3', 'M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5', 'M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3'],
  activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  link: ['M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5', 'M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5'],
  loader: ['M12 2v4', 'M12 18v4', 'M4.9 4.9l2.8 2.8', 'M16.3 16.3l2.8 2.8', 'M2 12h4', 'M18 12h4', 'M4.9 19.1l2.8-2.8', 'M16.3 7.7l2.8-2.8'],
  quote: ['M3 21c3-2 4-5 4-8H3V5h8v8c0 4-2 7-8 8z', 'M14 21c3-2 4-5 4-8h-4V5h8v8c0 4-2 7-8 8z'],
  sidebar: ['rect:3,3,18,18,2', 'M9 3v18'],
  expand: ['M8 3H5a2 2 0 0 0-2 2v3', 'M16 3h3a2 2 0 0 1 2 2v3', 'M8 21H5a2 2 0 0 1-2-2v-3', 'M16 21h3a2 2 0 0 0 2-2v-3'],
  message: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z'],
  wand: ['M15 4V2', 'M15 10V8', 'M12 5h-2', 'M20 5h-2', 'M6 18l10-10', 'M4 20l2-2'],
  hash: ['M4 9h16', 'M4 15h16', 'M10 3L8 21', 'M16 3l-2 18'],
  wifiOff: ['M3 3l18 18', 'M8.5 8.5a10 10 0 0 1 7 0', 'M5 12.5a15 15 0 0 1 4-2', 'M15 10.5a15 15 0 0 1 4 2', 'M8.5 16a10 10 0 0 1 7 0', 'M12 20h.01'],
  shieldCheck: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M8.5 12l2.5 2.5 4.5-5'],
  circle: ['circle:12,12,9'],
  dot: ['circle:12,12,4'],
  command: ['M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6z'],
  percent: ['M19 5L5 19', 'circle:6.5,6.5,2.5', 'circle:17.5,17.5,2.5'],
  split: ['M16 3h5v5', 'M8 3H3v5', 'M12 22v-8', 'M3 3l6 6', 'M21 3l-6 6'],
};

export function icon(name, { size = 18, className = '', stroke = 1.7, title = '' } = {}) {
  const paths = PATHS[name] || PATHS.spark;
  const content = paths
    .map((entry) => {
      if (entry.startsWith('circle:')) {
        const [cx, cy, r] = entry.slice(7).split(',');
        return `<circle cx="${cx}" cy="${cy}" r="${r}"></circle>`;
      }
      if (entry.startsWith('rect:')) {
        const [x, y, w, h, rx] = entry.slice(5).split(',');
        return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx || 0}"></rect>`;
      }
      if (entry.startsWith('ellipse:')) {
        const [cx, cy, rx, ry] = entry.slice(8).split(',');
        return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"></ellipse>`;
      }
      return `<path d="${entry}"></path>`;
    })
    .join('');
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="${title ? 'false' : 'true'}"${title ? ` role="img"` : ''}>${title ? `<title>${title}</title>` : ''}${content}</svg>`;
}

export function logoMark({ size = 44, className = '', animate = false } = {}) {
  const id = `lg${Math.random().toString(36).slice(2, 7)}`;
  return `<svg class="logo-mark ${className} ${animate ? 'logo-mark--animate' : ''}" width="${size}" height="${size}" viewBox="0 0 64 64" role="img" aria-label="معراج">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="var(--accent)"></stop>
        <stop offset="1" stop-color="var(--accent-soft)"></stop>
      </linearGradient>
    </defs>
    <circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" stroke-opacity=".16" stroke-width="1"></circle>
    <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" stroke-opacity=".1" stroke-width="1" stroke-dasharray="1 5"></circle>
    <path d="M32 10 L49 44 H15 Z" fill="none" stroke="url(#${id})" stroke-width="1.6" stroke-linejoin="round"></path>
    <path d="M32 19 L41 37 H23 Z" fill="url(#${id})" fill-opacity=".13" stroke="url(#${id})" stroke-width="1.2"></path>
    <circle cx="32" cy="44" r="2.2" fill="var(--accent)"></circle>
    <circle cx="32" cy="10" r="1.5" fill="var(--accent-soft)"></circle>
    <path d="M12 32h8M44 32h8" stroke="var(--accent)" stroke-opacity=".5" stroke-width="1"></path>
  </svg>`;
}

export const iconNames = Object.keys(PATHS);
