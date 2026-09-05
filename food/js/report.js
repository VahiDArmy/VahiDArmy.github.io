export function calculateDailyStats(intakes) {
  let totalCal = 0, totalProt = 0, totalCarb = 0, totalFat = 0;
  intakes.forEach(item => {
    const f = item.foods || {};
    totalCal += item.total_calories;
    totalProt += (f.protein || 0) * (item.quantity / 100);
    totalCarb += (f.carbs || 0) * (item.quantity / 100);
    totalFat += (f.fat || 0) * (item.quantity / 100);
  });
  return { totalCal, totalProt, totalCarb, totalFat };
}

export function calculateMonthlyStats(data) {
  const map = {};
  data.forEach(item => { map[item.date] = (map[item.date] || 0) + item.total_calories; });
  const days = Object.keys(map).sort();
  const values = days.map(d => map[d]);
  const total = values.reduce((a,b) => a+b, 0);
  return {
    days, values, total,
    avg: days.length ? total / days.length : 0,
    max: days.length ? Math.max(...values) : 0,
    min: days.length ? Math.min(...values) : 0,
    count: days.length
  };
}