// محاسبه آمار روزانه از لیست مصرف‌ها
export function calculateDailyStats(intakes) {
  let totalCal = 0, totalProt = 0, totalCarb = 0, totalFat = 0;
  intakes.forEach(item => {
    const food = item.foods || {};
    totalCal += item.total_calories;
    totalProt += (food.protein || 0) * (item.quantity / 100);
    totalCarb += (food.carbs || 0) * (item.quantity / 100);
    totalFat += (food.fat || 0) * (item.quantity / 100);
  });
  return { totalCal, totalProt, totalCarb, totalFat };
}

// محاسبه آمار ماهانه از داده‌های روزانه
export function calculateMonthlyStats(dailyData) {
  const dailyMap = {};
  dailyData.forEach(item => {
    const d = item.date;
    dailyMap[d] = (dailyMap[d] || 0) + item.total_calories;
  });
  const days = Object.keys(dailyMap).sort();
  const values = days.map(d => dailyMap[d]);
  const total = values.reduce((a,b) => a+b, 0);
  const avg = days.length ? total / days.length : 0;
  const max = days.length ? Math.max(...values) : 0;
  const min = days.length ? Math.min(...values) : 0;
  return { days, values, total, avg, max, min, count: days.length };
}