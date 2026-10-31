/**
 * Madacto Home Page (Weekly Table)
 */

import { apiService, normalizeName } from '../services/api.js';
import { WEEKDAYS, MEAL_TYPES } from '../config.js';
import { getStartOfWeek, formatDateISO, formatDateShamsi } from '../utils/date.js';
import { escapeHtml, showToast } from '../utils/ui.js';

const iconPlus = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const iconEdit = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>`;
const iconUser = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

function requireAuth(e, user) {
  if (!user) {
    e.preventDefault();
    e.stopPropagation();
    showToast('برای انجام این عملیات باید وارد شوید.', 'error');
    window.location.hash = '#/login';
    return true; 
  }
  return false; 
}

export async function renderHome(root, user = null) {
  root.innerHTML = `<div class="container" style="text-align:center;padding:20px;color:var(--text-secondary);font-size:12px">در حال بارگذاری...</div>`;

  try {
    const [allMeals, allVotes, overallScores, myVotes] = await Promise.all([
      apiService.getAllMeals(),
      apiService.getAllVotes(),
      apiService.getOverallScores(),
      user ? apiService.getMyVotes() : Promise.resolve({})
    ]);

    const weeklyVoteSums = {};
    allVotes.forEach(v => {
      weeklyVoteSums[v.meal_id] = (weeklyVoteSums[v.meal_id] || 0) + v.vote;
    });

    const mealsByWeek = {};
    const currentWeekStart = getStartOfWeek();
    const currentWeekStr = formatDateISO(currentWeekStart);
    mealsByWeek[currentWeekStr] = [];

    allMeals.forEach(m => {
      const d = new Date(m.meal_date);
      const day = d.getDay(); 
      const diff = (day === 6) ? 0 : -(day + 1);
      const start = new Date(d);
      start.setDate(start.getDate() + diff);
      const weekStr = formatDateISO(start);
      
      if (!mealsByWeek[weekStr]) mealsByWeek[weekStr] = [];
      mealsByWeek[weekStr].push(m);
    });

    const sortedWeeks = Object.keys(mealsByWeek)
      .filter(weekStr => weekStr >= currentWeekStr)
      .sort();

    let worstScore = 0;
    let worstMealId = null;
    
    allMeals.forEach(m => {
      const score = weeklyVoteSums[m.id] || 0;
      if (score < worstScore || (worstMealId === null && score < 0)) {
        worstScore = score;
        worstMealId = m.id;
      }
    });

    let html = `<div class="container">`;

    if (!user) {
      html += `
        <div style="background: var(--bg-surface); border: 1px solid var(--accent); border-radius: var(--radius-md); padding: var(--space-3); margin-bottom: var(--space-4); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; box-shadow: var(--shadow-sm);">
          <div style="display: flex; align-items: center; gap: 8px; color: var(--text-primary); font-size: 13px;">
            <span style="color: var(--accent); display: flex;">${iconUser}</span>
            <span>شما در حالت مهمان هستید. برای ثبت رأی و رزرو غذا وارد شوید.</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <a href="#/login" class="btn btn--primary btn--sm">ورود</a>
            <a href="#/signup" class="btn btn--secondary btn--sm">ثبت‌نام</a>
          </div>
        </div>
      `;
    }

    sortedWeeks.forEach(weekStr => {
      const weekStartDate = new Date(weekStr);
      const weekMeals = mealsByWeek[weekStr];
      
      const startShamsi = formatDateShamsi(weekStartDate);
      const endShamsi = formatDateShamsi(new Date(new Date(weekStartDate).setDate(weekStartDate.getDate() + 4)));
      
      const isCurrent = weekStr === currentWeekStr;

      html += `
        <div class="week-nav" style="margin-top: 16px; margin-bottom: 8px;">
          <div class="week-nav__center" style="width: 100%;">
            <div class="week-nav__title" style="color: ${isCurrent ? 'var(--accent)' : 'var(--text-primary)'};">
              ${isCurrent ? 'هفته جاری' : 'هفته آینده'} 
              <span style="font-size: 10px; font-weight: normal; color: var(--text-secondary); margin-inline-start: 4px;">(${startShamsi} تا ${endShamsi})</span>
            </div>
          </div>
        </div>
      `;

      html += `
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

      const weekMealMap = {};
      weekMeals.forEach(m => { weekMealMap[`${m.meal_date}_${m.meal_type}`] = m; });

      const dates = [];
      for (let i = 0; i < 5; i++) {
        const d = new Date(weekStartDate);
        d.setDate(d.getDate() + i);
        dates.push(formatDateISO(d));
      }

      dates.forEach((date, idx) => {
        const dObj = new Date(weekStartDate);
        dObj.setDate(dObj.getDate() + idx);
        const shamsiStr = formatDateShamsi(dObj);

        html += `<tr>`;
        html += `<td>
          <div class="day-cell">
            <span class="day-name">${WEEKDAYS[idx]}</span>
            <span class="day-date">${shamsiStr}</span>
          </div>
        </td>`;

        MEAL_TYPES.forEach(mt => {
          const meal = weekMealMap[`${date}_${mt.id}`];
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

            html += `
              <td>
                <div class="meal-cell-inner ${bgClass} ${worstClass}">
                  <button class="edit-meal-btn" data-date="${shamsiStr}" data-type="${mt.id}" data-name="${escapeHtml(meal.name)}" data-desc="${escapeHtml(meal.description || '')}" title="ویرایش">${iconEdit}</button>
                  
                  <div class="meal-info">
                    <div class="meal-name">${escapeHtml(meal.name)}</div>
                    ${meal.description ? `<div class="meal-desc">${escapeHtml(meal.description)}</div>` : ''}
                  </div>
                  
                  <div class="meal-actions-row">
                    <div class="weekly-score ${weeklyClass}">${weekly > 0 ? '+' : ''}${weekly}</div>
                    <button class="vote-btn ${upClass}" data-meal="${meal.id}" data-val="1" title="خوشمزه">❤️</button>
                    <button class="vote-btn ${downClass}" data-meal="${meal.id}" data-val="-1" title="بدمزه">💩</button>
                  </div>
                </div>
              </td>
            `;
          } else {
            html += `
              <td>
                <button class="add-meal-btn" data-date="${shamsiStr}" data-type="${mt.id}">
                  ${iconPlus}
                  <span>ثبت</span>
                </button>
              </td>
            `;
          }
        });
        html += `</tr>`;
      });

      html += `</tbody></table></div>`;
    });

    html += `</div>`;
    root.innerHTML = html;

    document.querySelectorAll('.add-meal-btn').forEach(btn => {
      btn.onclick = (e) => {
        if (requireAuth(e, user)) return;
        window.openManualEntryModal(btn.dataset.date, btn.dataset.type);
      };
    });

    document.querySelectorAll('.edit-meal-btn').forEach(btn => {
      btn.onclick = (e) => {
        if (requireAuth(e, user)) return;
        window.openManualEntryModal(btn.dataset.date, btn.dataset.type, btn.dataset.name, btn.dataset.desc);
      };
    });

    document.querySelectorAll('.vote-btn').forEach(btn => {
      btn.onclick = async (e) => {
        if (requireAuth(e, user)) return;
        
        const mealId = btn.dataset.meal;
        const val = parseInt(btn.dataset.val);
        const current = myVotes[mealId] || 0;
        const nextVal = current === val ? 0 : val;

        const parent = btn.parentElement;
        const upBtn = parent.querySelector('[data-val="1"]');
        const downBtn = parent.querySelector('[data-val="-1"]');
        upBtn.className = `vote-btn ${nextVal === 1 ? 'active-up' : ''}`;
        downBtn.className = `vote-btn ${nextVal === -1 ? 'active-down' : ''}`;

        try {
          await apiService.vote(mealId, nextVal);
          const scrollPos = window.scrollY;
          await renderHome(root, user);
          window.scrollTo(0, scrollPos);
        } catch (err) {
          showToast('خطا در ثبت رأی', 'error');
          renderHome(root, user);
        }
      };
    });

  } catch (err) {
    root.innerHTML = `<div class="container" style="text-align:center;padding:20px;color:var(--danger-500);font-size:12px">خطا در دریافت اطلاعات: ${err.message}</div>`;
  }
}