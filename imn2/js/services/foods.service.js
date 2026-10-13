/**
 * foods.service.js — جستجو و مدیریت دیتابیس غذاها (data/foods.json)
 * این سرویس کاملاً سمت کلاینت است و از فایل استاتیک تغذیه می‌شود.
 */

import { APP, LS_KEYS } from '../config/constants.js';
import { storage } from '../utils/storage.js';

let _foods = [];
let _loaded = false;
let _loadPromise = null;

/* ---------- بارگذاری ---------- */

export async function load() {
  if (_loaded) return _foods;
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    try {
      const res = await fetch(APP.DATA_URL, { cache: 'force-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      _foods = normalizeAll(json);
      _loaded = true;
      return _foods;
    } catch (e) {
      console.error('[foods] load error:', e);
      _foods = [];
      _loaded = true;
      return _foods;
    } finally {
      _loadPromise = null;
    }
  })();

  return _loadPromise;
}

/* ---------- نرمال‌سازی ---------- */

function normalizeAll(list) {
  return list.map((f, i) => {
    const name = String(f.Persian_Name || '').trim();
    const nameEn = String(f.Name_En || '').trim();
    return {
      id: i,
      name,
      nameEn,
      searchFa: name.replace(/\s+/g, ''),
      searchEn: nameEn.toLowerCase(),
      calories: num(f.Calories),
      fat: num(f.Fat),
      protein: num(f.Protein),
      carbs: num(f.Carbs),
      fiber: num(f.Fiber),
      sugar: num(f.Sugar),
    };
  });
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* ---------- جستجو ---------- */

/**
 * جستجوی هوشمند با اولویت:
 *  1) شروع با عبارت (فارسی)
 *  2) شامل عبارت (فارسی)
 *  3) شامل معادل انگلیسی
 */
export function search(query, limit = 20) {
  if (!_loaded) return [];
  const q = String(query || '').trim();
  if (!q) return _foods.slice(0, limit);

  const qFa = q.replace(/\s+/g, '');
  const qEn = q.toLowerCase();

  const starts = [];
  const contains = [];
  const enMatch = [];

  for (const f of _foods) {
    if (f.searchFa.startsWith(qFa)) starts.push(f);
    else if (f.searchFa.includes(qFa)) contains.push(f);
    else if (f.searchEn.includes(qEn)) enMatch.push(f);
    if (starts.length >= limit) break;
  }

  return [...starts, ...contains, ...enMatch].slice(0, limit);
}

/**
 * جستجوی دقیق بر اساس نام
 */
export function findByName(name) {
  if (!_loaded) return null;
  const target = String(name || '').trim();
  return _foods.find((f) => f.name === target) || null;
}

export function getById(id) {
  return _foods.find((f) => f.id === id) || null;
}

export function total() { return _foods.length; }

/* ---------- محاسبه مقادیر بر اساس مقدار ---------- */

/**
 * محاسبه مواد مغذی بر اساس مقدار مشخص‌شده
 * توجه: دیتابیس بر مبنای "۱۰۰ گرم" یا "۱ واحد" است؛ این تابع ضرب می‌کند.
 */
export function computeNutrients(food, quantity = 1) {
  const q = Number(quantity) || 0;
  return {
    calories: round1(food.calories * q),
    fat:      round1(food.fat * q),
    protein:  round1(food.protein * q),
    carbs:    round1(food.carbs * q),
    fiber:    round1(food.fiber * q),
    sugar:    food.sugar == null ? null : round1(food.sugar * q),
  };
}

function round1(n) { return Math.round(n * 10) / 10; }

/* ---------- غذایی‌های اخیر (recent) ---------- */

export function getRecent() {
  const list = storage.get(LS_KEYS.recentFoods, []);
  return Array.isArray(list) ? list : [];
}

export function pushRecent(food) {
  if (!food) return;
  const list = getRecent().filter((f) => f.name !== food.name);
  list.unshift({
    name: food.name,
    nameEn: food.nameEn,
    calories: food.calories,
    lastQuantity: food.lastQuantity || 1,
    at: Date.now(),
  });
  storage.set(LS_KEYS.recentFoods, list.slice(0, 12));
}

/* ---------- پرکاربردها ---------- */

export function getFrequent(limit = 8) {
  return getRecent().slice(0, limit);
}