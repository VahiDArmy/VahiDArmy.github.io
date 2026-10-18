/* ============================================================
   js/services/export.service.js
   FIXED: Added CSV formula injection protection.
   ============================================================ */

import { getSupabase } from '../core/supabase.client.js';
import { TABLES } from '../config/constants.js';
import { sanitizeFilename } from '../utils/sanitize.js';
import { exportFilename } from '../utils/format.js';

// ... (Snapshot and Blob helpers unchanged) ...

function csvEscape(val) {
  if (val === null || val === undefined) return '';
  let s = String(val);
  // 🛡️ FIXED: Prevent CSV Formula Injection
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
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

// ... (Rest of standard export/import methods) ...