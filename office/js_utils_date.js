/**
 * Date utilities — Persian-calendar display via Intl.
 * (Formatting helpers live in format.js; here we do math & ranges.)
 */

import { toEnDigits } from './format.js';

export function parseDate(input) {
  if (!input) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  if (typeof input === 'string') {
    const cleaned = toEnDigits(input).trim();
    const d = new Date(cleaned);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === 'number') {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export const startOfDay = (d) => {
  const x = parseDate(d);
  if (!x) return null;
  const y = new Date(x);
  y.setHours(0, 0, 0, 0);
  return y;
};

export const endOfDay = (d) => {
  const x = parseDate(d);
  if (!x) return null;
  const y = new Date(x);
  y.setHours(23, 59, 59, 999);
  return y;
};

export const startOfMonth = (d) => {
  const x = parseDate(d);
  if (!x) return null;
  const y = new Date(x.getFullYear(), x.getMonth(), 1, 0, 0, 0, 0);
  return y;
};

export const endOfMonth = (d) => {
  const x = parseDate(d);
  if (!x) return null;
  const y = new Date(x.getFullYear(), x.getMonth() + 1, 0, 23, 59, 59, 999);
  return y;
};

export const addDays = (d, n) => {
  const x = parseDate(d);
  if (!x) return null;
  const y = new Date(x);
  y.setDate(y.getDate() + n);
  return y;
};

export const addMonths = (d, n) => {
  const x = parseDate(d);
  if (!x) return null;
  const y = new Date(x);
  y.setMonth(y.getMonth() + n);
  return y;
};

export const diffDays = (a, b) => {
  const x = startOfDay(a);
  const y = startOfDay(b);
  if (!x || !y) return null;
  return Math.round((y - x) / (1000 * 60 * 60 * 24));
};

export const isToday = (d) => {
  const x = parseDate(d);
  if (!x) return false;
  const now = new Date();
  return (
    x.getFullYear() === now.getFullYear() &&
    x.getMonth() === now.getMonth() &&
    x.getDate() === now.getDate()
  );
};

export const isSameDay = (a, b) => {
  const x = parseDate(a);
  const y = parseDate(b);
  if (!x || !y) return false;
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
};

/** ISO string used for DB queries (start of range). */
export const toISO = (d) => {
  const x = parseDate(d);
  return x ? x.toISOString() : null;
};

/** Named range presets — useful for filter dropdowns. */
export function getRangePreset(key) {
  const now = new Date();
  switch (key) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now), label: 'امروز' };
    case 'yesterday': {
      const y = addDays(now, -1);
      return { from: startOfDay(y), to: endOfDay(y), label: 'دیروز' };
    }
    case 'last_7':
      return { from: startOfDay(addDays(now, -6)), to: endOfDay(now), label: '۷ روز اخیر' };
    case 'last_30':
      return { from: startOfDay(addDays(now, -29)), to: endOfDay(now), label: '۳۰ روز اخیر' };
    case 'last_90':
      return { from: startOfDay(addDays(now, -89)), to: endOfDay(now), label: '۹۰ روز اخیر' };
    case 'this_month':
      return { from: startOfMonth(now), to: endOfMonth(now), label: 'این ماه' };
    case 'this_year': {
      const y = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      const yEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { from: y, to: yEnd, label: 'امسال' };
    }
    default:
      return { from: null, to: null, label: 'همه' };
  }
}

export const RANGE_PRESETS = [
  { key: 'all',        label: 'همه' },
  { key: 'today',      label: 'امروز' },
  { key: 'yesterday',  label: 'دیروز' },
  { key: 'last_7',     label: '۷ روز اخیر' },
  { key: 'last_30',    label: '۳۰ روز اخیر' },
  { key: 'last_90',    label: '۹۰ روز اخیر' },
  { key: 'this_month', label: 'این ماه' },
  { key: 'this_year',  label: 'امسال' },
];