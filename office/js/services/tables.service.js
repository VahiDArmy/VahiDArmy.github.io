/**
 * Dynamic tables service — user-defined tables with custom columns and rows.
 * Columns and rows store their payload in JSON so any column type is possible.
 */

import { supabase, requireSession } from './supabase.client.js';
import { TABLES } from '../config/supabase.config.js';
import { friendlyError } from '../utils/format.js';

function guard(error) {
  if (error) throw Object.assign(new Error(friendlyError(error)), { cause: error });
}

export const tablesService = {
  async list({ search = '', limit = 50, offset = 0 } = {}) {
    let q = supabase
      .from(TABLES.DATA_TABLES)
      .select('id, name, slug, description, columns_count, rows_count, created_by, created_at, updated_at', { count: 'exact' });
    if (search) q = q.ilike('name', `%${search}%`);
    q = q.order('updated_at', { ascending: false }).range(offset, offset + limit - 1);
    const { data, error, count } = await q;
    guard(error);
    return { items: data || [], total: count || 0 };
  },

  async getById(id) {
    const { data, error } = await supabase
      .from(TABLES.DATA_TABLES)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    guard(error);
    return data;
  },

  async create(payload) {
    const session = await requireSession();
    const { data, error } = await supabase
      .from(TABLES.DATA_TABLES)
      .insert({ ...payload, created_by: session.user.id })
      .select()
      .single();
    guard(error);
    return data;
  },

  async update(id, patch) {
    await requireSession();
    const { data, error } = await supabase
      .from(TABLES.DATA_TABLES)
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    guard(error);
    return data;
  },

  async remove(id) {
    await requireSession();
    const { error } = await supabase.from(TABLES.DATA_TABLES).delete().eq('id', id);
    guard(error);
    return true;
  },

  /* ---- Columns ---- */

  async listColumns(tableId) {
    const { data, error } = await supabase
      .from(TABLES.DATA_COLUMNS)
      .select('*')
      .eq('table_id', tableId)
      .order('position', { ascending: true });
    guard(error);
    return data || [];
  },

  async createColumn(tableId, payload) {
    await requireSession();
    const { data, error } = await supabase
      .from(TABLES.DATA_COLUMNS)
      .insert({ table_id: tableId, ...payload })
      .select()
      .single();
    guard(error);
    return data;
  },

  async updateColumn(id, patch) {
    await requireSession();
    const { data, error } = await supabase
      .from(TABLES.DATA_COLUMNS)
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    guard(error);
    return data;
  },

  async removeColumn(id) {
    await requireSession();
    const { error } = await supabase.from(TABLES.DATA_COLUMNS).delete().eq('id', id);
    guard(error);
    return true;
  },

  async reorderColumns(tableId, orderedIds) {
    await requireSession();
    await Promise.all(
      orderedIds.map((id, index) =>
        supabase.from(TABLES.DATA_COLUMNS).update({ position: index }).eq('id', id).eq('table_id', tableId)
      )
    );
    return true;
  },

  /* ---- Rows ---- */

  async listRows(tableId, { limit = 200, offset = 0 } = {}) {
    const { data, error, count } = await supabase
      .from(TABLES.DATA_ROWS)
      .select('*', { count: 'exact' })
      .eq('table_id', tableId)
      .order('position', { ascending: true })
      .range(offset, offset + limit - 1);
    guard(error);
    return { items: data || [], total: count || 0 };
  },

  async createRow(tableId, values) {
    await requireSession();
    const { data, error } = await supabase
      .from(TABLES.DATA_ROWS)
      .insert({ table_id: tableId, values })
      .select()
      .single();
    guard(error);
    return data;
  },

  async updateRow(id, values) {
    await requireSession();
    const { data, error } = await supabase
      .from(TABLES.DATA_ROWS)
      .update({ values })
      .eq('id', id)
      .select()
      .single();
    guard(error);
    return data;
  },

  async removeRow(id) {
    await requireSession();
    const { error } = await supabase.from(TABLES.DATA_ROWS).delete().eq('id', id);
    guard(error);
    return true;
  },
};

export default tablesService;