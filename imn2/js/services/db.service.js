/**
 * db.service.js — عملیات پایه CRUD روی جداول Supabase
 * هر تابع، RLS را تضمین می‌کند (کوئری همیشه شامل user_id است).
 */

import { getSupabase } from '../config/supabase.js';
import { currentUser } from './auth.service.js';
import { bus, EVENTS } from '../utils/events.js';

/* ---------- نگاشت نام صفحات به جداول ---------- */

export const TABLES = {
  meals:          'meals',
  insulin:        'insulin',
  glucose:        'glucose',
  bloodPressure:  'blood_pressure',
  weight:         'weight',
  sleep:          'sleep',
  exercise:       'exercise',
  otherNotes:     'other_notes',
};

/* ---------- helper ---------- */

function requireUser() {
  const u = currentUser();
  if (!u) throw new Error('کاربر وارد نشده است.');
  return u;
}

function assertOwner(row) {
  const u = requireUser();
  if (row.user_id !== u.id) throw new Error('دسترسی غیرمجاز');
}

function emitChange(kind, action, payload) {
  bus.emit(action, { table: kind, data: payload });
  if (action === EVENTS.RECORD_CREATED) bus.emit(EVENTS.REPORT_REFRESH, { table: kind });
}

/* =========================================================================
   Queries
   ========================================================================= */

/**
 * لیست رکوردهای یک روز
 */
export async function listByDate(table, isoDate) {
  const u = requireUser();
  const sb = getSupabase();
  const { data, error } = await sb
    .from(table)
    .select('*')
    .eq('user_id', u.id)
    .eq('entry_date', isoDate)
    .order('entry_time', { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * لیست محدوده تاریخ
 */
export async function listRange(table, fromIso, toIso, { order = 'entry_date' } = {}) {
  const u = requireUser();
  const sb = getSupabase();
  const { data, error } = await sb
    .from(table)
    .select('*')
    .eq('user_id', u.id)
    .gte('entry_date', fromIso)
    .lte('entry_date', toIso)
    .order(order, { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getById(table, id) {
  const u = requireUser();
  const sb = getSupabase();
  const { data, error } = await sb
    .from(table)
    .select('*')
    .eq('id', id)
    .eq('user_id', u.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/* =========================================================================
   Mutations
   ========================================================================= */

export async function insert(table, values) {
  const u = requireUser();
  const sb = getSupabase();
  const payload = { ...values, user_id: u.id };
  const { data, error } = await sb.from(table).insert(payload).select().single();
  if (error) throw error;
  emitChange(table, EVENTS.RECORD_CREATED, data);
  return data;
}

export async function insertMany(table, rows) {
  const u = requireUser();
  const sb = getSupabase();
  const payload = rows.map((r) => ({ ...r, user_id: u.id }));
  const { data, error } = await sb.from(table).insert(payload).select();
  if (error) throw error;
  data?.forEach((row) => emitChange(table, EVENTS.RECORD_CREATED, row));
  return data || [];
}

export async function update(table, id, patch) {
  const u = requireUser();
  const sb = getSupabase();
  const { data, error } = await sb
    .from(table)
    .update(patch)
    .eq('id', id)
    .eq('user_id', u.id)
    .select()
    .single();
  if (error) throw error;
  bus.emit(EVENTS.RECORD_UPDATED, { table, data });
  return data;
}

export async function remove(table, id) {
  const u = requireUser();
  const sb = getSupabase();
  const { error } = await sb
    .from(table)
    .delete()
    .eq('id', id)
    .eq('user_id', u.id);
  if (error) throw error;
  bus.emit(EVENTS.RECORD_DELETED, { table, id });
  bus.emit(EVENTS.REPORT_REFRESH, { table });
  return true;
}

export async function removeMany(table, ids) {
  const u = requireUser();
  if (!ids?.length) return true;
  const sb = getSupabase();
  const { error } = await sb
    .from(table)
    .delete()
    .eq('user_id', u.id)
    .in('id', ids);
  if (error) throw error;
  bus.emit(EVENTS.RECORD_DELETED, { table, ids });
  bus.emit(EVENTS.REPORT_REFRESH, { table });
  return true;
}

/* =========================================================================
   (اختیاری) عملیات ویژه
   ========================================================================= */

/**
 * حذف کل داده‌های یک روز برای کاربر
 */
export async function removeAllByDate(table, isoDate) {
  const u = requireUser();
  const sb = getSupabase();
  const { error } = await sb
    .from(table)
    .delete()
    .eq('user_id', u.id)
    .eq('entry_date', isoDate);
  if (error) throw error;
  bus.emit(EVENTS.REPORT_REFRESH, { table, date: isoDate });
  return true;
}

/**
 * خلاصه روزانه (view)
 */
export async function dailySummary(isoDate) {
  const u = requireUser();
  const sb = getSupabase();
  const { data, error } = await sb
    .from('daily_summary')
    .select('*')
    .eq('user_id', u.id)
    .eq('entry_date', isoDate)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * بررسی اینکه یک روز داده دارد یا نه (برای heatmap)
 */
export async function hasDataOnDate(table, isoDate) {
  const u = requireUser();
  const sb = getSupabase();
  const { data, error } = await sb
    .from(table)
    .select('id')
    .eq('user_id', u.id)
    .eq('entry_date', isoDate)
    .limit(1);
  if (error) throw error;
  return (data?.length || 0) > 0;
}