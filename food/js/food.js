import { supabase } from './config.js';

export async function getFoods() {
  const { data, error } = await supabase
    .from('foods')
    .select('id, persian_name, calories, protein, carbs, fat');
  if (error) throw error;
  return data || [];
}

export async function addIntake(userId, foodId, date, quantity, totalCalories) {
  const { error } = await supabase.from('daily_intake').insert({
    user_id: userId,
    food_id: foodId,
    date,
    quantity,
    total_calories: totalCalories
  });
  if (error) throw error;
}

export async function getIntakesByDate(userId, date) {
  const { data, error } = await supabase
    .from('daily_intake')
    .select('*, foods(persian_name, calories, protein, carbs, fat)')
    .eq('date', date)
    .order('id');
  if (error) throw error;
  return data || [];
}

export async function deleteIntake(id) {
  const { error } = await supabase.from('daily_intake').delete().eq('id', id);
  if (error) throw error;
}

export async function getIntakesByMonth(userId, year, month) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const { data, error } = await supabase
    .from('daily_intake')
    .select('date, total_calories')
    .gte('date', start.toISOString().slice(0,10))
    .lte('date', end.toISOString().slice(0,10))
    .order('date');
  if (error) throw error;
  return data || [];
}