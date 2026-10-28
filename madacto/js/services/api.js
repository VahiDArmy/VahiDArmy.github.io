/**
 * Supabase & Edge Function Services
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, EDGE_FUNCTION_URL } from '../config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { 
    persistSession: true, 
    autoRefreshToken: true, 
    storageKey: 'office-auth'
  }
});

// Normalization Helper
export function normalizeName(name) {
  if (!name) return '';
  return name
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, '')
    .trim();
}

export const apiService = {
  async getMealsInRange(startDate, endDate) {
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .gte('meal_date', startDate)
      .lte('meal_date', endDate);
    if (error) throw error;
    return data || [];
  },

  // Fetch all votes joined with meal names for Overall Calculation
  async getOverallScores() {
    const { data, error } = await supabase
      .from('meal_votes')
      .select('vote, meals!inner(name)');
    if (error) throw error;
    
    const scores = {};
    data.forEach(v => {
      if (!v.meals || !v.meals.name) return;
      const norm = normalizeName(v.meals.name);
      scores[norm] = (scores[norm] || 0) + v.vote;
    });
    return scores;
  },

  // Get unique meal names for datalist autocomplete
  async getAllMealNames() {
    const { data, error } = await supabase.from('meals').select('name');
    if (error) throw error;
    const uniqueNames = [...new Set(data.map(m => m.name.trim()))];
    return uniqueNames.sort();
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
    const { error } = await supabase.from('meals').upsert(mealsToSave, { onConflict: 'meal_date,meal_type' });
    if (error) throw error;
  },

  async extractFromImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: reader.result })
          });
          if (!res.ok) throw new Error('خطا در ارتباط با هوش مصنوعی');
          resolve(await res.json());
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
};