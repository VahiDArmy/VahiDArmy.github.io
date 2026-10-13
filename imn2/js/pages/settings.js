/**
 * settings.js — مودال تنظیمات کاربر
 */

import { el, clear } from '../utils/dom.js';
import { toast } from '../components/toast.js';
import { openModal, openConfirm } from '../components/modal.js';
import { formatNumber, toFaDigits } from '../utils/format.js';
import { MEALS, LS_KEYS } from '../config/constants.js';
import * as authSvc from '../services/auth.service.js';
import { storage } from '../utils/storage.js';
import { bus, EVENTS } from '../utils/events.js';
import { getSupabase } from '../config/supabase.js';

export function openSettings({ onChange } = {}) {
  const profile = authSvc.currentProfile() || {};

  const body = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } });

  // ---- Appearance ----
  const appear = buildSection('🎨', 'ظاهر');
  appear.appendChild(buildThemePicker(() => onChange?.('theme')));
  appear.appendChild(buildWeekStartPicker(profile, onChange));
  body.appendChild(appear);

  // ---- Profile ----
  const profileSec = buildSection('👤', 'پروفایل');
  profileSec.appendChild(buildTextRow('نام نمایشی', profile.display_name, async (v) => {
    await authSvc.updateProfile({ display_name: v });
    toast.success('ذخیره شد');
    onChange?.('profile');
  }));
  profileSec.appendChild(buildNumberRow('سال تولد', profile.birth_year, async (v) => {
    await authSvc.updateProfile({ birth_year: v ? Number(v) : null });
    toast.success('ذخیره شد');
  }, { min: 1300, max: 1450, placeholder: 'مثلاً ۱۳۷۰' }));
  profileSec.appendChild(buildNumberRow('قد (cm)', profile.height_cm, async (v) => {
    await authSvc.updateProfile({ height_cm: v ? Number(v) : null });
    toast.success('ذخیره شد');
  }, { min: 80, max: 250 }));
  body.appendChild(profileSec);

  // ---- Targets ----
  const targetSec = buildSection('🎯', 'اهداف روزانه');
  const targetGrid = el('div', { class: 'target-grid' });
  const targetFields = [
    ['target_kcal', 'کالری', 'kcal'],
    ['target_protein', 'پروتئین', 'گرم'],
    ['target_carbs', 'کربوهیدرات', 'گرم'],
    ['target_fat', 'چربی', 'گرم'],
    ['target_fiber', 'فیبر', 'گرم'],
    ['target_weight', 'وزن هدف', 'کیلوگرم'],
  ];
  for (const [key, label, unit] of targetFields) {
    targetGrid.appendChild(buildTargetField(key, label, unit, profile[key], async (v) => {
      await authSvc.updateProfile({ [key]: v ? Number(v) : null });
      toast.success('ذخیره شد');
    }));
  }
  targetSec.appendChild(targetGrid);
  body.appendChild(targetSec);

  // ---- Meal times ----
  const mealSec = buildSection('🕐', 'ساعت پیش‌فرض وعده‌ها');
  const mealGrid = el('div', { class: 'target-grid' });
  for (const m of MEALS) {
    mealGrid.appendChild(buildTimeField(m.title, `${m.key}`, async (v) => {
      const prefs = await authSvc.ensurePreferences();
      const mealTimes = { ...(prefs?.default_meal_times || {}), [m.key]: v };
      await authSvc.updatePreferences({ default_meal_times: mealTimes });
      toast.success('ذخیره شد');
    }));
  }
  mealSec.appendChild(mealGrid);
  body.appendChild(mealSec);

  // ---- Danger zone ----
  const dangerSec = buildSection('⚠️', 'منطقه خطر');
  dangerSec.classList.add('danger-zone');

  const logoutRow = el('div', { class: 'setting-row' });
  logoutRow.appendChild(el('div', { class: 'setting-row__info' }, [
    el('div', { class: 'setting-row__label' }, ['خروج از حساب کاربری']),
    el('div', { class: 'setting-row__hint' }, ['با خروج، نشست فعلی بسته می‌شود.']),
  ]));
  const logoutBtn = el('button', { class: 'btn btn--danger btn--sm', type: 'button' }, ['خروج']);
  logoutBtn.addEventListener('click', async () => {
    const ok = await openConfirm({ title: 'خروج از حساب', text: 'از حساب خود خارج می‌شوید؟', type: 'danger', confirmText: 'خروج' });
    if (!ok) return;
    await authSvc.logout();
  });
  logoutRow.appendChild(logoutBtn);
  dangerSec.appendChild(logoutRow);

  const clearRow = el('div', { class: 'setting-row' });
  clearRow.appendChild(el('div', { class: 'setting-row__info' }, [
    el('div', { class: 'setting-row__label' }, ['حذف داده‌های امروز']),
    el('div', { class: 'setting-row__hint' }, ['تمام رکوردهای امروز شما پاک می‌شود (قابل بازگشت نیست).']),
  ]));
  const clearBtn = el('button', { class: 'btn btn--outline btn--sm', type: 'button' }, ['حذف']);
  clearBtn.addEventListener('click', () => {
    toast.info('نیازمند پیاده‌سازی', 'این گزینه در نسخه بعدی فعال می‌شود.');
  });
  clearRow.appendChild(clearBtn);
  dangerSec.appendChild(clearRow);

  body.appendChild(dangerSec);

  openModal({
    title: 'تنظیمات',
    icon: '⚙️',
    size: 'lg',
    className: 'settings-modal',
    body,
    footer: (close) => {
      const wrap = el('div', { style: { display: 'flex', justifyContent: 'flex-end', width: '100%' } });
      const done = el('button', { class: 'btn btn--primary', type: 'button' }, ['تمام']);
      done.addEventListener('click', close);
      wrap.appendChild(done);
      return wrap;
    },
  });
}

/* =========================================================================
   Builders
   ========================================================================= */

function buildSection(icon, title) {
  const sec = el('div', { class: 'settings-section' });
  sec.appendChild(el('div', { class: 'settings-section__title' }, [
    el('span', { class: 'settings-section__title-icon' }, [icon]),
    title,
  ]));
  return sec;
}

function buildThemePicker(onChange) {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const wrap = el('div', { class: 'theme-picker' });
  for (const opt of [
    { value: 'dark', label: '🌙 تیره' },
    { value: 'light', label: '☀️ روشن' },
  ]) {
    const card = el('button', {
      class: `theme-option ${current === opt.value ? 'is-active' : ''}`,
      type: 'button',
      'data-theme-value': opt.value,
    });
    card.appendChild(el('div', { class: 'theme-option__preview' }));
    card.appendChild(el('div', { class: 'theme-option__name' }, [opt.label]));
    card.addEventListener('click', () => {
      document.documentElement.setAttribute('data-theme', opt.value);
      storage.set(LS_KEYS.theme, opt.value);
      wrap.querySelectorAll('.theme-option').forEach((c) => c.classList.remove('is-active'));
      card.classList.add('is-active');
      bus.emit(EVENTS.THEME_CHANGE, opt.value);
      onChange?.();
    });
    wrap.appendChild(card);
  }
  return wrap;
}

function buildWeekStartPicker(profile, onChange) {
  const row = el('div', { class: 'setting-row' });
  row.appendChild(el('div', { class: 'setting-row__info' }, [
    el('div', { class: 'setting-row__label' }, ['شروع هفته']),
    el('div', { class: 'setting-row__hint' }, ['برای گزارش‌های هفتگی']),
  ]));
  const sel = el('select', { class: 'field__select', style: { width: 'auto', minWidth: '120px' } });
  sel.appendChild(el('option', { value: 'saturday' }, ['شنبه']));
  sel.appendChild(el('option', { value: 'monday' }, ['دوشنبه']));
  sel.value = profile.week_start || 'saturday';
  sel.addEventListener('change', async () => {
    await authSvc.updatePreferences({ week_start: sel.value });
    toast.success('ذخیره شد');
    onChange?.();
  });
  row.appendChild(sel);
  return row;
}

function buildTextRow(label, value, onSave) {
  const row = el('div', { class: 'setting-row' });
  row.appendChild(el('div', { class: 'setting-row__info' }, [
    el('div', { class: 'setting-row__label' }, [label]),
  ]));
  const inp = el('input', { class: 'field__input', type: 'text', value: value || '', style: { width: '180px' } });
  inp.addEventListener('change', () => onSave(inp.value.trim()));
  row.appendChild(inp);
  return row;
}

function buildNumberRow(label, value, onSave, opts = {}) {
  const row = el('div', { class: 'setting-row' });
  row.appendChild(el('div', { class: 'setting-row__info' }, [
    el('div', { class: 'setting-row__label' }, [label]),
  ]));
  const inp = el('input', {
    class: 'field__input',
    type: 'number',
    value: value ?? '',
    placeholder: opts.placeholder || '',
    min: opts.min,
    max: opts.max,
    style: { width: '140px' },
  });
  inp.addEventListener('change', () => onSave(inp.value));
  row.appendChild(inp);
  return row;
}

function buildTargetField(key, label, unit, value, onSave) {
  const wrap = el('div', { class: 'field' });
  wrap.appendChild(el('label', { class: 'field__label' }, [`${label} (${unit})`]));
  const inp = el('input', { class: 'field__input', type: 'number', value: value ?? '', min: 0 });
  inp.addEventListener('change', () => onSave(inp.value));
  wrap.appendChild(inp);
  return wrap;
}

function buildTimeField(label, key, onSave) {
  const wrap = el('div', { class: 'field' });
  wrap.appendChild(el('label', { class: 'field__label' }, [label]));
  const inp = el('input', { class: 'field__input', type: 'time' });
  wrap.appendChild(inp);

  // بارگذاری مقدار فعلی
  authSvc.ensurePreferences().then((prefs) => {
    inp.value = prefs?.default_meal_times?.[key] || '08:00';
  }).catch(() => { inp.value = '08:00'; });

  inp.addEventListener('change', () => onSave(inp.value));
  return wrap;
}