/**
 * Madacto Home Page (Weekly Table)
 */

import { apiService, normalizeName } from '../services/api.js';
import { WEEKDAYS, MEAL_TYPES } from '../config.js';
import { getStartOfWeek, formatDateISO, formatDateShamsi } from '../utils/date.js';
import { escapeHtml, showToast } from '../utils/ui.js';

let currentWeekStart = getStartOfWeek();

const iconRight = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
const iconLeft = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
const iconPlus = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const iconEdit = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>`;

export async function renderHome(root) {
  root.innerHTML = `<div class="container" style="text-align:center;padding:20px;color:var(--text-secondary);font-size:12px">در حال بارگذاری...</div>`;

  try {
    const dates = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() + i);
      dates.push(formatDateISO(d));
    }

    const startDateISO = dates[0];
    const endDateISO = dates[4];
    
    const [meals, myVotes, overallScores] = await Promise.all([
      apiService.getMealsInRange(startDateISO, endDateISO),
      apiService.getMyVotes(),
      apiService.getOverallScores()
    ]);

    const mealMap = {};
    meals.forEach(m => { mealMap[`${m.meal_date}_${m.meal_type}`] = m; });

    const mealIds = meals.map(m => m.id);
    let allWeekVotes = [];
    if (mealIds.length > 0) {
      const { data } = await import('../services/api.js').then(m => m.supabase.from('meal_votes').select('*').in('meal_id', mealIds));
      allWeekVotes = data || [];
    }

    const weeklyVoteSums = {};
    allWeekVotes.forEach(v => {
      weeklyVoteSums[v.meal_id] = (weeklyVoteSums[v.meal_id] || 0) + v.vote;
    });

    let worstScore = 0;
    let worstMealId = null;
    
    meals.forEach(m => {
      const score = weeklyVoteSums[m.id] || 0;
      if (score < worstScore || (worstMealId === null && score < 0)) {
        worstScore = score;
        worstMealId = m.id;
      }
    });

    const startShamsi = formatDateShamsi(currentWeekStart);
    const endShamsi = formatDateShamsi(new Date(new Date(currentWeekStart).setDate(currentWeekStart.getDate() + 4)));

    let tableHTML = `
      <div class="container">
        
        <div class="week-nav">
          <button id="prev-week" class="btn-nav" aria-label="هفته قبل">${iconRight}</button>
          <div class="week-nav__center">
            <div class="week-nav__title">برنامه غذایی</div>
            <div class="week-nav__range">
              <span dir="ltr">${startShamsi}</span>
              <span>تا</span>
              <span dir="ltr">${endShamsi}</span>
            </div>
          </div>
          <button id="next-week" class="btn-nav" aria-label="هفته بعد">${iconLeft}</button>
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
        <div class="day-cell">
          <span class="day-name">${WEEKDAYS[idx]}</span>
          <span class="day-date">${shamsiStr}</span>
        </div>
      </td>`;

      MEAL_TYPES.forEach(mt => {
        const meal = mealMap[`${date}_${mt.id}`];
        if (meal) {
          const normName = normalizeName(meal.name);
          const overall = overallScores[normName] || 0;
          const weekly = weeklyVoteSums[meal.id] || 0;
          const myVote = myVotes[meal.id] || 0;

          const isWorst = meal.id === worstMealId;
          
          let bgClass = '';
          if (overall > 0) bgClass = 'overall-positive';
          else if (overall < 0) bgClass = 'overall-negative';

          const worstClass = isWorst ? 'worst-weekly' : '';
          const weeklyClass = weekly > 0 ? 'positive' : weekly < 0 ? 'negative' : '';
          const upClass = myVote === 1 ? 'active-up' : '';
          const downClass = myVote === -1 ? 'active-down' : '';

          tableHTML += `
            <td>
              <div class="meal-cell-inner ${bgClass} ${worstClass}">
                <div class="weekly-score ${weeklyClass}">${weekly > 0 ? '+' : ''}${weekly}</div>
                <button class="edit-meal-btn" data-date="${shamsiStr}" data-type="${mt.id}" data-name="${escapeHtml(meal.name)}" data-desc="${escapeHtml(meal.description || '')}" title="ویرایش">${iconEdit}</button>
                <div class="meal-name">${escapeHtml(meal.name)}</div>
                ${meal.description ? `<div class="meal-desc">${escapeHtml(meal.description)}</div>` : ''}
                <div class="vote-group">
                  <button class="vote-btn ${upClass}" data-meal="${meal.id}" data-val="1">👍</button>
                  <button class="vote-btn ${downClass}" data-meal="${meal.id}" data-val="-1">👎</button>
                </div>
              </div>
            </td>
          `;
        } else {
          tableHTML += `
            <td>
              <button class="add-meal-btn" data-date="${shamsiStr}" data-type="${mt.id}">
                ${iconPlus}
                <span>ثبت</span>
              </button>
            </td>
          `;
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

    // Add Manual Entry Triggers
    document.querySelectorAll('.add-meal-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        window.openManualEntryModal(btn.dataset.date, btn.dataset.type);
      };
    });

    // Edit Meal Triggers
    document.querySelectorAll('.edit-meal-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        window.openManualEntryModal(btn.dataset.date, btn.dataset.type, btn.dataset.name, btn.dataset.desc);
      };
    });

    // Attach Vote Logic
    document.querySelectorAll('.vote-btn').forEach(btn => {
      btn.onclick = async (e) => {
        e.preventDefault();
        const mealId = btn.dataset.meal;
        const val = parseInt(btn.dataset.val);
        const current = myVotes[mealId] || 0;
        const nextVal = current === val ? 0 : val;

        // Optimistic UI
        const parent = btn.parentElement;
        const upBtn = parent.querySelector('[data-val="1"]');
        const downBtn = parent.querySelector('[data-val="-1"]');
        upBtn.className = `vote-btn ${nextVal === 1 ? 'active-up' : ''}`;
        downBtn.className = `vote-btn ${nextVal === -1 ? 'active-down' : ''}`;

        try {
          await apiService.vote(mealId, nextVal);
          const scrollPos = window.scrollY;
          await renderHome(root);
          window.scrollTo(0, scrollPos);
        } catch (err) {
          showToast('خطا در ثبت رأی', 'error');
          renderHome(root);
        }
      };
    });

  } catch (err) {
    root.innerHTML = `<div class="container" style="text-align:center;padding:20px;color:var(--danger-500);font-size:12px">خطا در دریافت اطلاعات: ${err.message}</div>`;
  }
}