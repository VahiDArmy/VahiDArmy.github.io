/**
 * Supabase & Edge Function Services
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, EDGE_FUNCTION_URL } from '../config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'madacto-auth' }
});

export const apiService = {
  async getWeeklyMeals(dates) {
    const { data, error } = await supabase.from('meals').select('*').in('meal_date', dates);
    if (error) throw error;
    return data || [];
  },

  async getMyVotes() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};
    const { data, error } = await supabase.from('meal_votes').select('meal_id, vote').eq('user_id', user.id);
    if (error) throw error;
    const map = {};
    (data || []).forEach(v => { map[v.meal_id] = v.vote; });
    return map;
  },

  async vote(mealId, value) {
    const { data: { user } } = await supabase.auth.getUser();
    if (value === 0) {
      const { error } = await supabase.from('meal_votes').delete().eq('meal_id', mealId).eq('user_id', user.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('meal_votes').upsert(
        { meal_id: mealId, user_id: user.id, vote: value },
        { onConflict: 'meal_id,user_id' }
      );
      if (error) throw error;
    }
  },

  async saveMeals(mealsToSave) {
    // mealsToSave is an array of objects: { meal_date, meal_type, name, description }
    const { error } = await supabase.from('meals').upsert(mealsToSave, { onConflict: 'meal_date,meal_type' });
    if (error) throw error;
  },

  async extractFromImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result;
          const res = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64 })
          });
          if (!res.ok) throw new Error('خطا در ارتباط با هوش مصنوعی');
          const json = await res.json();
          resolve(json);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
};