/**
 * بازاربان — مجموعهٔ آیکون‌ها
 * ---------------------------------------------------------------------------
 * همهٔ آیکون‌ها SVG درون‌خطی هستند: بدون فونت آیکون، بدون درخواست شبکه،
 * با ارث‌بری رنگ از متن. اندازه و کلاس قابل تنظیم است.
 */

const PATHS = {
  /* ناوبری و عمومی */
  home: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1Z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m4 12.5 5 5L20 6.5"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.7 2.7L16 9.5"/>',
  'x-circle': '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  'alert-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
  'alert-triangle': '<path d="M10.3 4.3 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 16.5v.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.01"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.4 9a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.2-2.6 4M12 17v.01"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  'more-horizontal': '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  'more-vertical': '<circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-up': '<path d="m6 15 6-6 6 6"/>',
  'chevron-left': '<path d="m14 6-6 6 6 6"/>',
  'chevron-right': '<path d="m10 6 6 6-6 6"/>',
  'chevrons-up': '<path d="m7 14 5-5 5 5M7 19l5-5 5 5"/>',
  'chevrons-down': '<path d="m7 10 5 5 5-5M7 5l5 5 5-5"/>',
  'arrow-left': '<path d="M20 12H4M10 6l-6 6 6 6"/>',
  'arrow-right': '<path d="M4 12h16M14 6l6 6-6 6"/>',
  'arrow-up': '<path d="M12 20V4M6 10l6-6 6 6"/>',
  'arrow-down': '<path d="M12 4v16M6 14l6 6 6-6"/>',
  'arrow-up-left': '<path d="M18 18 6 6M6 15V6h9"/>',
  external: '<path d="M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 6M20 5v6h-6"/>',
  loader: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',

  /* برند / موجودیت‌ها */
  store: '<path d="M4 9.5V20h16V9.5M3 9.5 5.5 4h13L21 9.5M3 9.5h18M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M10 20v-5h4v5"/>',
  building: '<path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18"/><path d="M8 8h3M8 12h3M8 16h3"/>',
  package: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
  box: '<rect x="3.5" y="6.5" width="17" height="14" rx="2"/><path d="M3.5 10.5h17M8 6.5V3.5h8v3"/>',
  cart: '<circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17.5" cy="19.5" r="1.4"/><path d="M3 4h2l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.3L21 8H6"/>',
  bag: '<path d="M5 8h14l-1.2 12H6.2L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  tag: '<path d="M20 12.5 12.5 20 4 11.5V4h7.5L20 12.5Z"/><circle cx="8" cy="8" r="1.4"/>',
  barcode: '<path d="M4 6v12M7.5 6v12M11 6v12M14.5 6v12M18 6v12M20.5 6v12"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5M3 17l9 5 9-5"/>',
  'map-pin': '<path d="M20 10.5c0 5.5-8 11.5-8 11.5S4 16 4 10.5a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10.5" r="2.6"/>',
  map: '<path d="m9 4 6 3 6-3v13l-6 3-6-3-6 3V7l6-3Z"/><path d="M9 4v13M15 7v13"/>',
  phone: '<path d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z"/><path d="M10.5 17.5h3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1.2 1.2"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1.2-1.2"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/>',
  share: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.2 10.7 7.6-4M8.2 13.3l7.6 4"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/>',
  lock: '<rect x="4.5" y="10" width="15" height="10.5" rx="2"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>',
  key: '<circle cx="8" cy="16" r="4"/><path d="m11 13 8-8M16 5l3 3M14 7l3 3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.4A5.5 5.5 0 0 1 21.5 20"/>',
  logout: '<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M15 8l4 4-4 4M19 12H9"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3.5 6.5h17M9 6.5V4h6v2.5M6 6.5 7 21h10l1-14.5M10 10.5v6M14 10.5v6"/>',
  flag: '<path d="M5 21V4h9l-1 3h6l-1.5 4.5L19 16h-8l-1-3H5"/>',
  bookmark: '<path d="M6 4h12v17l-6-4-6 4V4Z"/>',
  heart: '<path d="M12 20s-8-4.7-8-10a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.3-8 10-8 10Z"/>',
  star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8Z"/>',
  sparkles: '<path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z"/><path d="M18.5 14.5 19.4 17l2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9Z"/>',
  shield: '<path d="M12 3 5 6v6c0 4.6 3 7.8 7 9 4-1.2 7-4.4 7-9V6l-7-3Z"/>',
  verified: '<path d="m12 2.5 2.4 2.1 3.2-.2.9 3 2.6 1.9-1.3 3 .9 3-2.9 1.3-1.6 2.8-3.1-.8-2.8 1.5-2-2.5-3.1-.6.1-3.2L3 9.6l2.2-2.3L5.9 4l3.2.2L12 2.5Z"/><path d="m8.8 12.2 2.1 2.1 4.4-4.4"/>',
  award: '<circle cx="12" cy="9" r="5.5"/><path d="m8.5 13.5-1.7 7L12 18l5.2 2.5-1.7-7"/>',
  crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8Z"/><path d="M5 19h14"/>',
  flame: '<path d="M12 21c3.9 0 6-2.5 6-5.8 0-4.3-4-6.4-4-9.7 0-.8-.2-1.4-.8-2.2-1.3 2.3-2.4 3.3-3.7 5.2C7.2 11.4 6 12.8 6 15.2 6 18.5 8.1 21 12 21Z"/><path d="M12 21c-1.8 0-2.8-1.2-2.8-2.6 0-1.8 1.6-2.6 2.8-4.4 1.2 1.8 2.8 2.6 2.8 4.4 0 1.4-1 2.6-2.8 2.6Z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  activity: '<path d="M3 12h4l2.5-7 5 14 2.5-7h4"/>',
  scale: '<path d="M12 3v18M7 21h10M4 7l8-4 8 4M4 7l-2 6a4 4 0 0 0 8 0L8 7M20 7l-2 6a4 4 0 0 0 8 0"/>',
  columns: '<rect x="3.5" y="4" width="7" height="16" rx="1.5"/><rect x="13.5" y="4" width="7" height="16" rx="1.5"/>',
  list: '<path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12M4 6.5v.01M4 12v.01M4 17.5v.01"/>',
  'list-checks': '<path d="M11 6.5h10M11 12h10M11 17.5h10M3.5 6l1.5 1.5L7.5 5M3.5 11.5 5 13l2.5-2.5M3.5 17 5 18.5 7.5 16"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  filter: '<path d="M3 5h18l-7 8.2V20l-4-2v-4.8L3 5Z"/>',
  sort: '<path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',

  /* واکنش / نقد */
  message: '<path d="M20.5 12a8.5 8.5 0 0 1-8.5 8.5H4l2.2-3.4A8.5 8.5 0 1 1 20.5 12Z"/>',
  'message-plus': '<path d="M20.5 11.5A8.5 8.5 0 0 1 12 20H4l2.2-3.4A8.5 8.5 0 1 1 20.5 11.5Z"/><path d="M12 8.5v6M9 11.5h6"/>',
  reply: '<path d="M9 7 4 12l5 5"/><path d="M4 12h9a7 7 0 0 1 7 7v1"/>',
  send: '<path d="M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5 21 3Z"/>',
  lightbulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z"/>',
  'thumbs-up': '<path d="M7 20H4.5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1H7"/><path d="M7 20h9.4a2 2 0 0 0 2-1.6l1.3-7A2 2 0 0 0 17.7 9H14l.5-3.6A2.4 2.4 0 0 0 12.2 3L7 11"/>',
  'thumbs-down': '<path d="M17 4h2.5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H17"/><path d="M17 4H7.6a2 2 0 0 0-2 1.6l-1.3 7A2 2 0 0 0 6.3 15H10l-.5 3.6A2.4 2.4 0 0 0 11.8 21L17 13"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.3 14.4c.9 1.3 2.1 2 3.7 2s2.8-.7 3.7-2"/><circle cx="9" cy="9.6" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="9.6" r="1" fill="currentColor" stroke="none"/>',
  meh: '<circle cx="12" cy="12" r="9"/><path d="M8.5 15h7"/><circle cx="9" cy="9.6" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="9.6" r="1" fill="currentColor" stroke="none"/>',
  frown: '<circle cx="12" cy="12" r="9"/><path d="M8.3 16.3c.9-1.3 2.1-2 3.7-2s2.8.7 3.7 2"/><circle cx="9" cy="9.6" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="9.6" r="1" fill="currentColor" stroke="none"/>',
  'star-off': '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8Z"/><path d="m4 4 16 16"/>',
  quote: '<path d="M9 7H5a1.5 1.5 0 0 0-1.5 1.5V13A1.5 1.5 0 0 0 5 14.5h4V17c0 2-1.2 3.3-3 4M20 7h-4a1.5 1.5 0 0 0-1.5 1.5V13A1.5 1.5 0 0 0 16 14.5h4V17c0 2-1.2 3.3-3 4"/>',

  /* نمودار و داده */
  'chart-bar': '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  'chart-pie': '<path d="M12 3v9h9A9 9 0 0 0 12 3Z"/><path d="M21 15a9 9 0 1 1-12-8.5"/>',
  'trending-up': '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  'trending-down': '<path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
  'pie-chart': '<circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/>',
  database: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  wallet: '<path d="M20 8H5a2 2 0 0 1 0-4h13v4"/><path d="M3.5 6v12a2 2 0 0 0 2 2H20a1 1 0 0 0 1-1V8H5.5"/><circle cx="17" cy="14" r="1.2" fill="currentColor" stroke="none"/>',
  percent: '<path d="m5 19 14-14"/><circle cx="7" cy="7" r="2.4"/><circle cx="17" cy="17" r="2.4"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="M4 4l16 16M9.9 5.9A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.7M6.2 8.3A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9.6 9.6 0 0 0 4-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  download: '<path d="M12 3v12M8 11l4 4 4-4M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  upload: '<path d="M12 16V4M8 8l4-4 4 4M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',

  /* وضعیت */
  'wifi-off': '<path d="m3 3 18 18M8.5 15.5a5 5 0 0 1 7 0M5 12a10 10 0 0 1 4-2.4M15 9.6a10 10 0 0 1 4 2.4M2 8.5a15 15 0 0 1 5-3M17 5.5a15 15 0 0 1 5 3"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  zap: '<path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/>',

  /* دسته‌بندی محصولات */
  apple: '<path d="M12 7.5c1.5-2 4-2.6 5.4-1.3 1.8 1.6 1.4 5.2-.4 8.4-1.2 2.2-2.5 3.4-3.8 3.4-1 0-1.6-.5-2.4-.5s-1.4.5-2.4.5c-1.3 0-2.6-1.2-3.8-3.4-1.8-3.2-2.2-6.8-.4-8.4C6 5 8.5 5.5 10 7.5"/><path d="M12 7.5c0-2.5 1.2-4 3.5-4.5"/>',
  milk: '<path d="M8 3h8v3l2 3v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9l2-3V3Z"/><path d="M6 9h12M9 3h6M9 13h6"/>',
  bread: '<path d="M4 11a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7Z"/><path d="M4 11h16M8 12v5M12 12v5M16 12v5"/>',
  protein: '<path d="M14.5 4.5c2.8 0 5 2.2 5 5 0 2-1.2 3.4-2.8 4.4L14 16.2l-4.2 4.2a2 2 0 0 1-2.8-2.8l4.2-4.2 2.3-2.7c1-1.6 2.4-2.8 4.4-2.8 0 0-.4-1.4-2.4-1.4"/><path d="M5 19 3 21M6.5 16.5 5 18"/>',
  pantry: '<path d="M6 3h12v18H6z"/><path d="M6 7h12M6 12h12M6 17h12M10 10h4"/>',
  drink: '<path d="M7 3h10l-1 6H8L7 3Z"/><path d="M8 9h8l1.5 11a1.5 1.5 0 0 1-1.5 1.6H8A1.5 1.5 0 0 1 6.5 20L8 9Z"/><path d="M7.5 14h9"/>',
  snack: '<circle cx="12" cy="12" r="8.5"/><circle cx="9" cy="9" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="10" cy="15" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1" fill="currentColor" stroke="none"/>',
  spray: '<path d="M8 9h8v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9Z"/><path d="M10 9V4h4v5M14 6h4M18 4h2M18 8h2M11 13h2"/>',
  personal: '<path d="M12 3s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.2 12 3 12 3Z"/><path d="M9.5 13.5a2.5 2.5 0 0 0 2.5 2.5"/>',
  snowflake: '<path d="M12 2v20M3.3 6.5l17.4 10M3.3 17.5 20.7 7.5M9 4.5 12 7l3-2.5M9 19.5 12 17l3 2.5M4.5 10.5l3.5-.5.5-3.5M19.5 13.5 16 14l-.5 3.5M4.5 13.5 8 14l.5 3.5M19.5 10.5 16 10l-.5-3.5"/>',
  utensils: '<path d="M7 3v7a2.5 2.5 0 0 0 5 0V3M9.5 3v18M17 3c-1.5 1.5-2 4-2 6.5 0 2 1 3 2 3s2-1 2-3C19 7 18.5 4.5 17 3v18"/>',
  baby: '<circle cx="12" cy="8" r="4.5"/><path d="M9 12.2c-1.6 1-2.5 2.7-2.5 4.3 0 3 2.4 5 5.5 5s5.5-2 5.5-5c0-1.6-.9-3.3-2.5-4.3"/><circle cx="10" cy="7.5" r=".9" fill="currentColor" stroke="none"/><circle cx="14" cy="7.5" r=".9" fill="currentColor" stroke="none"/>',
  paw: '<circle cx="6.5" cy="9" r="1.8"/><circle cx="10" cy="5.8" r="1.8"/><circle cx="14" cy="5.8" r="1.8"/><circle cx="17.5" cy="9" r="1.8"/><path d="M12 11c2.8 0 5 2.2 5 4.6 0 1.8-1.4 3.4-3.3 3.4-1 0-1.4-.4-2.2-.4s-1.2.4-2.2.4c-1.9 0-3.3-1.6-3.3-3.4C7 13.2 9.2 11 12 11Z"/>',
  leaf: '<path d="M20 4c0 9-4.5 13-10 13a6 6 0 0 1-6-6C4 6 9 4 20 4Z"/><path d="M4 21c1-6 4-9 9-11"/>',

  /* رفتار */
  hand: '<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v6M17 12V9.5a1.5 1.5 0 0 1 3 0V15c0 3.5-2.5 6-6 6h-2.5a7 7 0 0 1-5.4-2.6L3 14.6a1.6 1.6 0 0 1 2.4-2.1L8 15"/>',
  gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M12 8v13"/><path d="M12 8S10.5 3 7.5 3a2.5 2.5 0 0 0 0 5M12 8s1.5-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  truck: '<path d="M3 6h11v11H3z"/><path d="M14 10h4l3 3v4h-7"/><circle cx="7" cy="18.5" r="1.8"/><circle cx="17" cy="18.5" r="1.8"/>',
  'shopping-cart': '<circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17.5" cy="19.5" r="1.4"/><path d="M3 4h2l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.3L21 8H6"/>',
};

/** نام‌های جایگزین برای راحتی استفاده */
const ALIASES = {
  x: 'close',
  remove: 'close',
  search2: 'search',
  comment: 'message',
  comments: 'message',
  rating: 'star',
  ratings: 'star',
  best: 'award',
  worst: 'frown',
  pickup: 'bag',
  delivery: 'truck',
  location: 'map-pin',
  city: 'building',
  product: 'package',
  vendor: 'store',
  shop: 'building',
  fire: 'flame',
  up: 'trending-up',
  down: 'trending-down',
  spinner: 'loader',
  trash2: 'trash',
  chart: 'chart-bar',
  eye2: 'eye',
  meat: 'protein',
  water: 'personal',
  frozen: 'snowflake',
  cookies: 'snack',
  cookie: 'snack',
  dairy: 'milk',
  bakery: 'bread',
  produce: 'apple',
  household: 'spray',
  cleaning: 'spray',
  drink: 'drink',
  drinks: 'drink',
  pantry2: 'pantry',
};

/**
 * ساخت آیکون.
 * @param {string} name نام آیکون
 * @param {number|{size?:number,class?:string,stroke?:number,label?:string}} [options]
 * @returns {string} رشتهٔ HTML قابل درج
 */
export function icon(name, options = {}) {
  const opts = typeof options === 'number' ? { size: options } : options || {};
  const key = ALIASES[name] || name;
  const inner = PATHS[key] || PATHS.info;
  const size = opts.size || 18;
  const stroke = opts.stroke ?? 1.8;
  const cls = opts.class ? ` ${opts.class}` : '';
  const label = opts.label
    ? ` role="img" aria-label="${String(opts.label).replace(/"/g, '&quot;')}"`
    : ' aria-hidden="true"';
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" class="icon icon--${key}${cls}"${label}>${inner}</svg>`;
}

/** آیا آیکون وجود دارد؟ */
export function hasIcon(name) {
  return Boolean(PATHS[ALIASES[name] || name]);
}

export const ICON_NAMES = Object.freeze(Object.keys(PATHS));
