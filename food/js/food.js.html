import { supabase } from './config.js';

// دریافت لیست غذاهای کاربر
export async function getFoods(userId) {
  const { data, error } = await supabase
    .from('foods')
    .select('id, persian_name, calories, protein, carbs, fat')
    .eq('user_id', userId);
  if (error) throw error;
  return data || [];
}

// ثبت مصرف جدید
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

// دریافت مصرف‌های یک روز خاص
export async function getIntakesByDate(userId, date) {
  const { data, error } = await supabase
    .from('daily_intake')
    .select('*, foods(persian_name, calories, protein, carbs, fat)')
    .eq('user_id', userId)
    .eq('date', date)
    .order('id');
  if (error) throw error;
  return data || [];
}

// حذف یک مصرف
export async function deleteIntake(intakeId) {
  const { error } = await supabase
    .from('daily_intake')
    .delete()
    .eq('id', intakeId);
  if (error) throw error;
}

// دریافت مصرف‌های یک ماه (برای گزارش)
export async function getIntakesByMonth(userId, year, month) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const startStr = start.toISOString().slice(0,10);
  const endStr = end.toISOString().slice(0,10);

  const { data, error } = await supabase
    .from('daily_intake')
    .select('date, total_calories')
    .eq('user_id', userId)
    .gte('date', startStr)
    .lte('date', endStr)
    .order('date');
  if (error) throw error;
  return data || [];
}