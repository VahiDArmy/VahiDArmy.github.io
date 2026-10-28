/**
 * Madacto Home Page (Weekly Table)
 */

import { apiService } from '../services/api.js';
import { WEEKDAYS, MEAL_TYPES } from '../config.js';
import { getStartOfWeek, formatDateISO, formatDateShamsi, toJalali } from '../utils/date.js';
import { escapeHtml, showToast } from '../utils/ui.js';

let currentWeekStart = getStartOfWeek();

export async function renderHome(root) {
  root.innerHTML = `<div class="container" style="text-align:center;padding:40px;color:var(--text-secondary)">در حال بارگذاری برنامه هفتگی...</div>`;

  try {
    const dates = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() + i);
      dates.push(formatDateISO(d));
    }

    // Fetch a range that covers the current week to ensure we get all meals
    const startDateISO = dates[0];
    const endDateISO = dates[4];
    
    const meals = await apiService.getMealsInRange(startDateISO, endDateISO);
    const myVotes = await apiService.getMyVotes();

    const mealMap = {};
    meals.forEach(m => { mealMap[`${m.meal_date}_${m.meal_type}`] = m; });

    // Calculate Week Title (e.g., هفته ۱۲ آبان تا ۱۶ آبان)
    const startShamsi = formatDateShamsi(currentWeekStart);
    const endShamsi = formatDateShamsi(new Date(new Date(currentWeekStart).setDate(currentWeekStart.getDate() + 4)));

    let tableHTML = `
      <div class="container">
        
        <div class="week-nav">
          <button id="prev-week" class="btn btn--secondary btn--sm">&rarr; هفته قبل</button>
          <h2>برنامه غذایی (${startShamsi} تا ${endShamsi})</h2>
          <button id="next-week" class="btn btn--secondary btn--sm">هفته بعد &larr;</button>
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
      const dObj = new Date(currentWeekStart);
      dObj.setDate(dObj.getDate() + idx);
      const shamsiStr = formatDateShamsi(dObj);

      tableHTML += `<tr>`;
      tableHTML += `<td>
        <div class="day-name">${WEEKDAYS[idx]}</div>
        <div class="day-date">${shamsiStr}</div>
      </td>`;

      MEAL_TYPES.forEach(mt => {
        const meal = mealMap[`${date}_${mt.id}`];
        if (meal) {
          const vote = myVotes[meal.id] || 0;
          const upClass = vote === 1 ? 'active-up' : '';
          const downClass = vote === -1 ? 'active-down' : '';
          
          tableHTML += `
            <td>
              <div class="meal-name">${escapeHtml(meal.name)}</div>
              ${meal.description ? `<div class="meal-desc">${escapeHtml(meal.description)}</div>` : ''}
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

    tableHTML += `</tbody></table></div></div>`;
    root.innerHTML = tableHTML;

    // Navigation Logic
    document.getElementById('prev-week').onclick = () => {
      currentWeekStart.setDate(currentWeekStart.getDate() - 7);
      renderHome(root);
    };
    document.getElementById('next-week').onclick = () => {
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
      renderHome(root);
    };

    // Attach Vote Logic
    document.querySelectorAll('.vote-btn').forEach(btn => {
      btn.onclick = async (e) => {
        e.preventDefault();
        const mealId = btn.dataset.meal;
        const val = parseInt(btn.dataset.val);
        const current = myVotes[mealId] || 0;
        const nextVal = current === val ? 0 : val;

        const parent = btn.parentElement;
        const upBtn = parent.querySelector('[data-val="1"]');
        const downBtn = parent.querySelector('[data-val="-1"]');

        upBtn.className = `vote-btn ${nextVal === 1 ? 'active-up' : ''}`;
        downBtn.className = `vote-btn ${nextVal === -1 ? 'active-down' : ''}`;
        myVotes[mealId] = nextVal;

        try {
          await apiService.vote(mealId, nextVal);
        } catch (err) {
          upBtn.className = `vote-btn ${current === 1 ? 'active-up' : ''}`;
          downBtn.className = `vote-btn ${current === -1 ? 'active-down' : ''}`;
          myVotes[mealId] = current;
          showToast('خطا در ثبت رأی', 'error');
        }
      };
    });

  } catch (err) {
    root.innerHTML = `<div class="container" style="text-align:center;padding:40px;color:var(--danger-500)">خطا در دریافت اطلاعات: ${err.message}</div>`;
  }
}