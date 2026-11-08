// Export helpers — serialize the current pack in alternative formats.

import { State } from './state.js';

export function exportAsJson(files) {
  const list = files || Array.from(State.files.values());
  const out = list.map((f) => ({
    path: f.path,
    content: f.content,
    size: f.bytes.length,
    lines: f.lineCount,
    status: f.status,
    failure: f.failure || null,
    edited: !!f.edited,
    crc32: (f.crc >>> 0).toString(16).padStart(8, '0'),
  }));
  return JSON.stringify(out, null, 2);
}

export function exportAsManifest(files) {
  const list = files || Array.from(State.files.values());
  const total = list.reduce((acc, f) => acc + f.bytes.length, 0);
  const ext = {};
  for (const f of list) ext[f.ext || 'none'] = (ext[f.ext || 'none'] || 0) + 1;
  const manifest = {
    generator: 'Project Packer v2.0.0',
    generatedAt: new Date().toISOString(),
    fileCount: list.length,
    totalBytes: total,
    extensions: ext,
    files: list.map((f) => ({
      path: f.path,
      bytes: f.bytes.length,
      lines: f.lineCount,
      status: f.status,
    })),
  };
  return JSON.stringify(manifest, null, 2);
}

export function exportAsMarkdown(files) {
  const list = files || Array.from(State.files.values());
  const sorted = list.slice().sort((a, b) => a.path.localeCompare(b.path));
  const lines = [];
  lines.push('# Project Pack');
  lines.push('');
  lines.push('_Generated ' + new Date().toISOString() + '_');
  lines.push('');
  lines.push('Files: **' + sorted.length + '**');
  lines.push('');
  lines.push('## Contents');
  lines.push('');
  for (const f of sorted) {
    lines.push('- `' + f.path + '` — ' + f.bytes.length + ' bytes');
  }
  lines.push('');
  for (const f of sorted) {
    lines.push('## `' + f.path + '`');
    lines.push('');
    const ext = f.ext || 'txt';
    lines.push('```' + ext);
    lines.push(f.content);
    lines.push('```');
    lines.push('');
  }
  return lines.join('\n');
}

export function exportAsHtml(files) {
  const list = (files || Array.from(State.files.values())).slice().sort((a, b) => a.path.localeCompare(b.path));
  const escape = (s) => String(s).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
  const parts = [];
  parts.push('<!doctype html>');
  parts.push('<html><head><meta charset="utf-8"><title>Project Pack</title>');
  parts.push('<style>body{font-family:ui-monospace,monospace;background:#0a0c10;color:#e7eaef;padding:32px;max-width:1000px;margin:0 auto;line-height:1.6}h1{font-size:24px;margin:0 0 20px}h2{font-size:15px;color:#7dd3a8;margin:32px 0 8px;border-bottom:1px solid #22262c;padding-bottom:6px}pre{background:#0e1116;border:1px solid #22262c;padding:14px;border-radius:8px;overflow:auto;font-size:12px}p.meta{color:#7e8792;font-size:12px}</style>');
  parts.push('</head><body>');
  parts.push('<h1>Project Pack</h1>');
  parts.push('<p class="meta">Generated ' + new Date().toISOString() + ' · ' + list.length + ' files</p>');
  for (const f of list) {
    parts.push('<h2>' + escape(f.path) + '</h2>');
    parts.push('<pre>' + escape(f.content) + '</pre>');
  }
  parts.push('</body></html>');
  return parts.join('\n');
}
