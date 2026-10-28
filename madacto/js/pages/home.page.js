/**
 * Madacto Home Page (Weekly Table)
 */

import { apiService } from '../services/api.js';
import { WEEKDAYS, MEAL_TYPES } from '../config.js';
import { getStartOfWeek, formatDateISO } from '../utils/date.js';

export async function renderHome(root) {
  root.innerHTML = `<div class="container" style="text-align:center;padding:40px;color:var(--text-secondary)">در حال بارگذاری برنامه هفتگی...</div>`;

  try {
    const start = getStartOfWeek();
    const dates = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dates.push(formatDateISO(d));
    }

    const meals = await apiService.getWeeklyMeals(dates);
    const myVotes = await apiService.getMyVotes();

    const mealMap = {};
    meals.forEach(m => { mealMap[`${m.meal_date}_${m.meal_type}`] = m; });

    let tableHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div>
          <h2 style="margin:0 0 8px;font-size:24px">برنامه غذایی هفته</h2>
          <p style="margin:0;color:var(--text-secondary);font-size:14px">به غذاهای خوب رأی مثبت و به غذاهای ضعیف رأی منفی بدهید.</p>
        </div>
        <a href="#/upload" class="btn btn--secondary btn--sm">📷 آپلود عکس منو</a>
      </div>
      <div class="meal-table-wrap">
        <table class="meal-table">
          <thead>
            <tr>
              <th>روز</th>
              ${MEAL_TYPES.map(mt => `<th>${mt.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    dates.forEach((date, idx) => {
      tableHTML += `<tr>`;
      tableHTML += `<td>${WEEKDAYS[idx]}</td>`;

      MEAL_TYPES.forEach(mt => {
        const meal = mealMap[`${date}_${mt.id}`];
        if (meal) {
          const vote = myVotes[meal.id] || 0;
          const upClass = vote === 1 ? 'active-up' : '';
          const downClass = vote === -1 ? 'active-down' : '';
          
          tableHTML += `
            <td>
              <div class="meal-name">${meal.name}</div>
              ${meal.description ? `<div class="meal-desc">${meal.description}</div>` : ''}
              <div style="display:flex;justify-content:center;gap:8px">
                <button class="vote-btn ${upClass}" data-meal="${meal.id}" data-val="1">👍</button>
                <button class="vote-btn ${downClass}" data-meal="${meal.id}" data-val="-1">👎</button>
              </div>
            </td>
          `;
        } else {
          tableHTML += `<td style="color:var(--text-tertiary);font-size:12px;vertical-align:middle">ثبت نشده</td>`;
        }
      });
      tableHTML += `</tr>`;
    });

    tableHTML += `</tbody></table></div>`;

    root.innerHTML = `<div class="container">${tableHTML}</div>`;

    // Attach Vote Logic
    document.querySelectorAll('.vote-btn').forEach(btn => {
      btn.onclick = async () => {
        const mealId = btn.dataset.meal;
        const val = parseInt(btn.dataset.val);
        const current = myVotes[mealId] || 0;
        const nextVal = current === val ? 0 : val;

        try {
          await apiService.vote(mealId, nextVal);
          renderHome(root); // Re-render
        } catch (err) {
          alert(err.message);
        }
      };
    });

  } catch (err) {
    root.innerHTML = `<div class="container" style="text-align:center;padding:40px;color:var(--danger-500)">خطا در دریافت اطلاعات: ${err.message}</div>`;
  }
}