// Formatting helpers — bytes, numbers, dates, paths.

export function fmtBytes(n) {
  const num = Number(n) || 0;
  if (num < 1024) return num + ' B';
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = num / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const fixed = value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2);
  return fixed + ' ' + units[unit];
}

export function fmtNum(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

export function fmtTime(d) {
  const date = d instanceof Date ? d : new Date(d);
  return pad2(date.getHours()) + ':' + pad2(date.getMinutes()) + ':' + pad2(date.getSeconds());
}

export function fmtDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return y + '-' + m + '-' + day;
}

export function fmtDateTime(d) {
  const date = d instanceof Date ? d : new Date(d);
  return fmtDate(date) + ' ' + fmtTime(date);
}

export function fmtRelative(d) {
  const date = d instanceof Date ? d : new Date(d);
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return sec + 's ago';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + 'm ago';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + 'h ago';
  const day = Math.floor(hr / 24);
  if (day < 30) return day + 'd ago';
  const mon = Math.floor(day / 30);
  if (mon < 12) return mon + 'mo ago';
  const yr = Math.floor(mon / 12);
  return yr + 'y ago';
}

export function pluralize(n, singular, plural) {
  if (n === 1) return singular;
  return plural !== undefined ? plural : singular + 's';
}

export function truncate(s, max = 80) {
  if (!s) return '';
  if (s.length <= max) return s;
  const head = Math.max(0, Math.floor(max * 0.7));
  const tail = Math.max(0, max - head - 1);
  return s.slice(0, head) + '…' + (tail > 0 ? s.slice(-tail) : '');
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => {
    switch (ch) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return ch;
    }
  });
}

export function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function basename(path) {
  if (!path) return '';
  const trimmed = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const idx = trimmed.lastIndexOf('/');
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}

export function dirname(path) {
  if (!path) return '';
  const trimmed = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const idx = trimmed.lastIndexOf('/');
  return idx >= 0 ? trimmed.slice(0, idx) : '';
}

export function extname(path) {
  const base = basename(path);
  const idx = base.lastIndexOf('.');
  if (idx <= 0) return '';
  return base.slice(idx + 1).toLowerCase();
}

export function fileKind(path) {
  const ext = extname(path);
  const code = ['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'css', 'scss', 'sass', 'less', 'html', 'htm', 'vue', 'svelte', 'php', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'kts', 'swift', 'c', 'h', 'cpp', 'hpp', 'cc', 'cs', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'lua', 'pl', 'pm', 'r', 'sql', 'graphql', 'gql', 'yml', 'yaml'];
  const doc = ['md', 'markdown', 'mdx', 'txt', 'rst', 'org', 'adoc', 'tex', 'log'];
  const data = ['json', 'jsonc', 'json5', 'xml', 'csv', 'tsv', 'toml', 'ini', 'conf', 'env'];
  if (code.includes(ext)) return 'code';
  if (doc.includes(ext)) return 'doc';
  if (data.includes(ext)) return 'data';
  return 'other';
}

export function extLabel(path) {
  const ext = extname(path);
  if (!ext) return 'txt';
  return ext.slice(0, 4);
}

export function formatPercent(num, total) {
  if (!total) return '0%';
  const pct = (num / total) * 100;
  if (pct >= 100) return '100%';
  if (pct >= 10) return pct.toFixed(0) + '%';
  return pct.toFixed(1) + '%';
}

export function formatDuration(ms) {
  if (!ms || ms < 0) return '0 ms';
  if (ms < 1000) return Math.round(ms) + ' ms';
  const s = ms / 1000;
  if (s < 60) return s.toFixed(1) + ' s';
  const m = Math.floor(s / 60);
  const rem = Math.round(s - m * 60);
  return m + 'm ' + rem + 's';
}

export function formatCount(n) {
  if (!n) return '0';
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
}

export function formatRange(a, b) {
  return fmtNum(a) + ' – ' + fmtNum(b);
}
