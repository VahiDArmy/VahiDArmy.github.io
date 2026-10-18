/* ============================================================
   js/services/export.service.js
   COMPLETE FILE - NO TRUNCATION.
   ============================================================ */

import { getSupabase } from '../core/supabase.client.js';
import { TABLES } from '../config/constants.js';
import { sanitizeFilename } from '../utils/sanitize.js';
import { exportFilename } from '../utils/format.js';

export async function snapshot() {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('unauthorized');

  const [profiles, categories, tags, lies, lieTags, reflections] = await Promise.all([
    supabase.from(TABLES.PROFILES).select('*').eq('user_id', user.id),
    supabase.from(TABLES.CATEGORIES).select('*').order('sort_order'),
    supabase.from(TABLES.TAGS).select('*').order('name'),
    supabase.from(TABLES.LIES).select('*').order('created_at', { ascending: false }),
    supabase.from(TABLES.LIE_TAGS).select('*'),
    supabase.from(TABLES.REFLECTIONS).select('*').order('created_at', { ascending: false }),
  ]);

  for (const res of [profiles, categories, tags, lies, lieTags, reflections]) {
    if (res.error) throw res.error;
  }

  return {
    meta: {
      exportedAt: new Date().toISOString(),
      app: 'ayeneh-daroun',
      version: '1.0.0',
      userId: user.id,
      email: user.email,
    },
    profiles: profiles.data || [],
    categories: categories.data || [],
    tags: tags.data || [],
    lies: lies.data || [],
    lieTags: lieTags.data || [],
    reflections: reflections.data || [],
  };
}

export function downloadBlob(data, filename, type = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = sanitizeFilename(filename);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function exportJSON() {
  const snap = await snapshot();
  const json = JSON.stringify(snap, null, 2);
  downloadBlob(json, exportFilename('ayeneh-daroun', 'json'), 'application/json;charset=utf-8');
}

function csvEscape(val) {
  if (val === null || val === undefined) return '';
  let s = String(val);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function exportLiesCSV() {
  const snap = await snapshot();
  const tagsById = {}; for (const t of snap.tags) tagsById[t.id] = t.name;
  const tagsByLie = {}; for (const link of snap.lieTags) { (tagsByLie[link.lie_id] ||= []).push(tagsById[link.tag_id] || ''); }
  const catsById = {}; for (const c of snap.categories) catsById[c.id] = c.name;
  
  const rows = snap.lies.map((l) => ({
    id: l.id, title: l.title, body: l.body || '', truth: l.truth || '', type: l.type, status: l.status, mood: l.mood || '',
    intensity: l.intensity, belief: l.belief, category: catsById[l.category_id] || '', tags: (tagsByLie[l.id] || []).join(' | '),
    occurred_at: l.occurred_at || '', is_pinned: l.is_pinned ? '1' : '0', created_at: l.created_at, updated_at: l.updated_at,
  }));

  const columns = ['id', 'title', 'body', 'truth', 'type', 'status', 'mood', 'intensity', 'belief', 'category', 'tags', 'occurred_at', 'is_pinned', 'created_at', 'updated_at'];
  const header = columns.join(',');
  const body = rows.map((r) => columns.map((c) => csvEscape(r[c])).join(',')).join('\n');
  
  const csv = '\uFEFF' + header + '\n' + body;
  downloadBlob(csv, exportFilename('lies', 'csv'), 'text/csv;charset=utf-8');
}

export async function exportMarkdown() {
  const snap = await snapshot();
  const active = snap.lies.filter((l) => l.status === 'active');
  const tagsById = {}; for (const t of snap.tags) tagsById[t.id] = t.name;
  const catsById = {}; for (const c of snap.categories) catsById[c.id] = c.name;
  const tagsByLie = {}; for (const link of snap.lieTags) { (tagsByLie[link.lie_id] ||= []).push(tagsById[link.tag_id] || ''); }

  const groups = {}; for (const l of active) (groups[l.type] ||= []).push(l);

  const lines = [];
  lines.push('# دروغ‌هایی که به خودمان می‌گوییم');
  lines.push('');
  lines.push(`> تاریخ خروجی: ${new Date().toLocaleString('fa-IR')}`);
  lines.push(`> تعداد کل: ${active.length}`);
  lines.push('');

  for (const [type, arr] of Object.entries(groups)) {
    lines.push(`## ${type}`);
    lines.push('');
    for (const l of arr) {
      lines.push(`### ${l.title}`);
      if (l.category_id && catsById[l.category_id]) lines.push(`**دسته:** ${catsById[l.category_id]}`);
      if (l.mood) lines.push(`**حال:** ${l.mood}`);
      lines.push(`**شدت:** ${l.intensity}/۱۰ · **باور:** ${l.belief}/۱۰`);
      const tgs = tagsByLie[l.id] || [];
      if (tgs.length) lines.push(`**برچسب‌ها:** ${tgs.join(' · ')}`);
      lines.push('');
      if (l.body) { lines.push(l.body); lines.push(''); }
      if (l.truth) { lines.push(`> **حقیقت:** ${l.truth}`); lines.push(''); }
      lines.push('---');
      lines.push('');
    }
  }

  downloadBlob(lines.join('\n'), exportFilename('lies', 'md'), 'text/markdown;charset=utf-8');
}

export async function importJSON(input, opts = {}) {
  const { mode = 'merge' } = opts;
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('unauthorized');

  let text = '';
  if (typeof input === 'string') text = input;
  else text = await input.text();

  let snap;
  try { snap = JSON.parse(text); }
  catch { throw new Error('فایل JSON نامعتبر است.'); }

  if (!snap || typeof snap !== 'object' || !Array.isArray(snap.lies)) {
    throw new Error('ساختار فایل با این برنامه سازگار نیست.');
  }

  if (mode === 'replace') {
    await supabase.from(TABLES.LIES).delete().eq('user_id', user.id);
    await supabase.from(TABLES.CATEGORIES).delete().eq('user_id', user.id);
    await supabase.from(TABLES.TAGS).delete().eq('user_id', user.id);
  }

  const catIdMap = {};
  if (Array.isArray(snap.categories) && snap.categories.length) {
    const rows = snap.categories.map((c) => ({
      user_id: user.id, name: c.name, color: c.color || '#7c5cff', icon: c.icon || '📁',
      description: c.description || null, sort_order: c.sort_order ?? 0,
    }));
    const { data, error } = await supabase.from(TABLES.CATEGORIES).upsert(rows, { onConflict: 'user_id,name', ignoreDuplicates: false }).select('id,name');
    if (error) throw error;
    for (const row of data || []) catIdMap[row.name] = row.id;
  }

  const tagIdMap = {};
  if (Array.isArray(snap.tags) && snap.tags.length) {
    const rows = snap.tags.map((t) => ({ user_id: user.id, name: t.name, color: t.color || '#7c5cff' }));
    const { data, error } = await supabase.from(TABLES.TAGS).upsert(rows, { onConflict: 'user_id,name', ignoreDuplicates: false }).select('id,name');
    if (error) throw error;
    for (const row of data || []) tagIdMap[row.name] = row.id;
  }

  const origTagName = {}; for (const t of snap.tags || []) origTagName[t.id] = t.name;
  const origCatName = {}; for (const c of snap.categories || []) origCatName[c.id] = c.name;

  const lieIdMap = {};
  let liesCount = 0;
  if (Array.isArray(snap.lies) && snap.lies.length) {
    const rows = snap.lies.map((l) => ({
      user_id: user.id,
      category_id: l.category_id && origCatName[l.category_id] ? (catIdMap[origCatName[l.category_id]] || null) : null,
      title: l.title, body: l.body || null, truth: l.truth || null, type: l.type || 'other', status: l.status || 'active',
      mood: l.mood || null, intensity: l.intensity ?? 5, belief: l.belief ?? 5, occurred_at: l.occurred_at || null,
      is_pinned: !!l.is_pinned, archived_at: l.archived_at || null, trashed_at: l.trashed_at || null,
      created_at: l.created_at || new Date().toISOString(), updated_at: l.updated_at || new Date().toISOString(),
    }));

    const { data, error } = await supabase.from(TABLES.LIES).insert(rows).select('id');
    if (error) throw error;
    liesCount = data?.length || 0;
    
    const insertedIds = (data || []).map((r) => r.id);
    for (let i = 0; i < snap.lies.length; i++) lieIdMap[snap.lies[i].id] = insertedIds[i];
  }

  if (Array.isArray(snap.lieTags) && snap.lieTags.length) {
    const rows = [];
    for (const link of snap.lieTags) {
      const newLie = lieIdMap[link.lie_id];
      const tagName = origTagName[link.tag_id];
      const newTag = tagName ? tagIdMap[tagName] : null;
      if (newLie && newTag) rows.push({ lie_id: newLie, tag_id: newTag });
    }
    if (rows.length) await supabase.from(TABLES.LIE_TAGS).upsert(rows, { onConflict: 'lie_id,tag_id', ignoreDuplicates: true });
  }

  let reflCount = 0;
  if (Array.isArray(snap.reflections) && snap.reflections.length) {
    const rows = [];
    for (const r of snap.reflections) {
      const newLie = lieIdMap[r.lie_id];
      if (!newLie) continue;
      rows.push({ lie_id: newLie, user_id: user.id, body: r.body, mood: r.mood || null, created_at: r.created_at || new Date().toISOString() });
    }
    if (rows.length) {
      const { error } = await supabase.from(TABLES.REFLECTIONS).insert(rows);
      if (!error) reflCount = rows.length;
    }
  }

  return {
    categories: Object.keys(catIdMap).length,
    tags: Object.keys(tagIdMap).length,
    lies: liesCount,
    reflections: reflCount,
  };
}

export default {
  snapshot, exportJSON, exportLiesCSV, exportMarkdown, importJSON, downloadBlob,
};