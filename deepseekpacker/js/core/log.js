// Log formatting and export helpers.

import { State } from './state.js';

export function headerLine(entry) {
  const parts = ['Paste ' + entry.n, formatTime(entry.time), entry.fresh + ' new'];
  const replaced = entry.changed + entry.identical;
  if (replaced === 0) {
    parts.push('0 replaced');
  } else if (entry.changed && entry.identical) {
    parts.push(replaced + ' replaced (' + entry.changed + ' changed, ' + entry.identical + ' identical)');
  } else if (entry.changed) {
    parts.push(replaced + ' replaced (changed)');
  } else {
    parts.push(replaced + ' replaced (identical)');
  }
  parts.push(entry.errors + ' error' + (entry.errors === 1 ? '' : 's'));
  return parts.join(' · ');
}

export function formatTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '--:--:--';
  const p = (n) => (n < 10 ? '0' : '') + n;
  return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

export function entryText(entry) {
  const lines = [headerLine(entry)];
  for (const note of entry.notes || []) {
    lines.push('  ' + note.text);
    if (note.excerpt !== null && note.excerpt !== undefined) {
      lines.push('    excerpt: "' + note.excerpt + '"');
    }
  }
  return lines.join('\n');
}

export function logText() {
  if (!State.log.length) return '';
  const out = [];
  for (const entry of State.log) {
    out.push(entryText(entry));
  }
  return out.join('\n') + '\n';
}

export function resendText() {
  const lines = ['Re-send these files complete, using the agreed format:'];
  for (const [path, type] of State.failures) {
    lines.push(path + ' (' + type + ')');
  }
  return lines.join('\n') + '\n';
}

export function logAsJson() {
  return JSON.stringify(
    State.log.map((entry) => ({
      n: entry.n,
      time: entry.time instanceof Date ? entry.time.toISOString() : entry.time,
      fresh: entry.fresh,
      changed: entry.changed,
      identical: entry.identical,
      errors: entry.errors,
      source: entry.source || 'paste',
      notes: entry.notes,
    })),
    null,
    2
  );
}
