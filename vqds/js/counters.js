/* ==========================================================================
   counters.js — مدیریت شمارنده‌های دو نفره، رخدادهای قرائت و UI هدر
   ========================================================================== */

import { supabase } from './supabase.js';
import { CONFIG } from './config.js';
import { store } from './store.js';
import { $, onDblTap, faDigits } from './utils.js';
import { toast, successToast, errorToast } from './toast.js';
import { openHistoryModal } from './history.js';

let isInitialized = false;

export function initCounters() {
  if (isInitialized) return;
  isInitialized = true;

  // دکمه‌های هدر (برای مودال تاریخچه)
  const card1 = $('#counterCard1');
  const card2 = $('#counterCard2');
  const brandTitle = $('#brandTitle');

  if (card1) {
    onDblTap(card1, () => {
      const state = store.getState();
      if (state.profile1Id) {
        openHistoryModal(state.profile1Id, 'شخص ۱');
      } else {
        toast('کاربر دوم هنوز ثبت‌نام نکرده است', 'info');
      }
    });
  }

  if (card2) {
    onDblTap(card2, () => {
      const state = store.getState();
      if (state.profile2Id) {
        openHistoryModal(state.profile2Id, 'شخص ۲');
      } else {
        toast('کاربر دوم هنوز ثبت‌نام نکرده است', 'info');
      }
    });
  }

  if (brandTitle) {
    onDblTap(brandTitle, () => {
      const state = store.getState();
      // اگر لاگین است، تاریخچه‌ی خودش را نشان بده
      if (state.user) {
        openHistoryModal(state.user.id, state.profile?.display_name || 'من');
      } else {
        toast('برای مشاهده تاریخچه ابتدا وارد شوید', 'info');
      }
    });
  }

  // بروزرسانی UI در هنگام تغییر state
  store.subscribe((state) => {
    renderCountersUI(state);
  });

  // بارگذاری اولیه
  fetchAndRenderCounters();
}

export function renderCountersUI(state) {
  const val1 = $('#counterValue1');
  const val2 = $('#counterValue2');
  const name1 = $('#counterName1');
  const name2 = $('#counterName2');
  const avatar1 = $('#counterAvatar1');
  const avatar2 = $('#counterAvatar2');

  if (val1) val1.textContent = faDigits(state.counter1 || 0);
  if (val2) val2.textContent = faDigits(state.counter2 || 0);

  if (state.profile1Id) {
    if (name1) name1.textContent = 'شخص ۱';
    if (avatar1) avatar1.textContent = '🌸';
  }

  if (state.profile2Id) {
    if (name2) name2.textContent = 'شخص ۲';
    if (avatar2) avatar2.textContent = '🌊';
  }
}

export async function fetchAndRenderCounters() {
  try {
    const { data, error } = await supabase
      .from(CONFIG.tables.profiles)
      .select('user_id, display_name, avatar_emoji, read_count, created_at')
      .order('created_at', { ascending: true });

    if (error) throw error;

    if (data && data.length > 0) {
      const p1 = data[0];
      const p2 = data[1] || null;

      store.set({
        profile1Id: p1.user_id,
        counter1: p1.read_count,
        profile2Id: p2 ? p2.user_id : null,
        counter2: p2 ? p2.read_count : 0,
      });

      // آپدیت نام‌ها و آواتارها در هدر
      const name1 = $('#counterName1');
      const name2 = $('#counterName2');
      const avatar1 = $('#counterAvatar1');
      const avatar2 = $('#counterAvatar2');

      if (name1 && p1.display_name) name1.textContent = p1.display_name;
      if (avatar1 && p1.avatar_emoji) avatar1.textContent = p1.avatar_emoji;

      if (p2) {
        if (name2 && p2.display_name) name2.textContent = p2.display_name;
        if (avatar2 && p2.avatar_emoji) avatar2.textContent = p2.avatar_emoji;
      }
    }
  } catch (err) {
    console.error('[counters] fetch failed', err);
  }
}

export async function incrementReadCount() {
  const state = store.getState();
  if (!state.user) {
    toast('برای ثبت قرائت باید وارد شوید', 'error');
    window.dispatchEvent(new CustomEvent('q56:navigate', { detail: { route: 'auth' } }));
    return;
  }

  try {
    const { error } = await supabase
      .from(CONFIG.tables.reads)
      .insert([{ user_id: state.user.id }]);

    if (error) throw error;

    successToast('قرائت شما ثبت شد. خدا قبول کند ♥');
    
    // رفرش کردن شمارنده‌ها
    await fetchAndRenderCounters();

    // اگر مودال تاریخچه باز است، رفرش شود
    window.dispatchEvent(new CustomEvent('q56:read-registered'));

  } catch (err) {
    console.error('[counters] increment failed', err);
    errorToast('خطا در ثبت قرائت');
  }
}