/**
 * Supabase & Edge Function Services
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, EDGE_FUNCTION_URL } from '../config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'office-auth' }
});

export function normalizeName(name) {
  if (!name) return '';
  return name.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, '').trim();
}

export const apiService = {
  async getAllMeals() {
    const { data, error } = await supabase.from('meals').select('*');
    if (error) throw error;
    return data || [];
  },

  async getAllVotes() {
    const { data, error } = await supabase.from('meal_votes').select('*');
    if (error) throw error;
    return data || [];
  },

  async getOverallScores() {
    const { data, error } = await supabase.from('meal_votes').select('vote, meals!inner(name)');
    if (error) throw error;
    const scores = {};
    data.forEach(v => {
      if (!v.meals || !v.meals.name) return;
      scores[normalizeName(v.meals.name)] = (scores[normalizeName(v.meals.name)] || 0) + v.vote;
    });
    return scores;
  },

  async getAllMealNames() {
    const { data, error } = await supabase.from('meals').select('name');
    if (error) throw error;
    return [...new Set(data.map(m => m.name.trim()))].sort();
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

  // RICH ERROR HANDLING FOR FETCH
  async startImageExtraction(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error('شما وارد نشده اید.');

          let res;
          try {
            res = await fetch(EDGE_FUNCTION_URL, {
              method: 'POST',
              headers: { 
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ image: reader.result })
            });
          } catch (networkError) {
            // CORS or Network failure caught here
            throw new Error(`خطای شبکه یا CORS: ${networkError.message}. لطفا کنسول مرورگر را بررسی کنید.`);
          }
          
          // Try to read the response body for detailed server errors
          if (!res.ok) {
            let errorDetails = '';
            try {
              const contentType = res.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                const errData = await res.json();
                errorDetails = errData.error || JSON.stringify(errData);
              } else {
                errorDetails = await res.text();
              }
            } catch (e) {
              errorDetails = 'پاسخ نامفهوم از سرور';
            }
            throw new Error(`خطای سرور (${res.status}): ${errorDetails}`);
          }
          
          const { jobId } = await res.json();
          resolve(jobId);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('خطا در خواندن فایل عکس'));
      reader.readAsDataURL(file);
    });
  },

  async checkJobStatus(jobId) {
    const { data, error } = await supabase
      .from('ai_extraction_jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    
    if (error) throw error;
    return data;
  }
};