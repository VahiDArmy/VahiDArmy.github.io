/**
 * Madacto Upload Page (AI Extraction & Preview)
 */

import { apiService } from '../services/api.js';
import { WEEKDAYS, MEAL_TYPES } from '../config.js';
import { toGregorian, formatDateISO, formatDateShamsi } from '../utils/date.js';

export function renderUpload(root) {
  root.innerHTML = `
    <div class="container">
      <div style="margin-bottom: 20px;">
        <a href="#/" style="color: var(--text-secondary); text-decoration: none;">&rarr; بازگشت به برنامه هفتگی</a>
        <h2 style="margin-top: 8px;">آپلود عکس منو</h2>
        <p style="color: var(--text-secondary); font-size: 14px;">عکس منوی غذا را آپلود کنید تا هوش مصنوعی آن را استخراج کند.</p>
      </div>

      <div id="upload-state">
        <label class="upload-area">
          <input type="file" id="file-input" accept="image/*" />
          <div style="font-size: 40px; margin-bottom: 12px;">📷</div>
          <div style="font-weight: bold; margin-bottom: 4px;">برای انتخاب عکس کلیک کنید</div>
          <div style="font-size: 12px; color: var(--text-secondary);">فرمت‌های مجاز: JPG, PNG</div>
        </label>
      </div>

      <div id="loading-state" style="display:none; text-align:center; padding: 40px;">
        <div class="boot-splash__spinner" style="margin: 0 auto 16px;"></div>
        <div style="font-weight: bold;">در حال پردازش با هوش مصنوعی...</div>
        <div style="font-size: 12px; color: var(--text-secondary);">ممکن است چند لحظه طول بکشد.</div>
      </div>

      <div id="preview-state" style="display:none;">
        <h3>پیش‌نمایش داده‌های استخراج شده</h3>
        <p style="font-size: 13px; color: var(--text-secondary);">در صورت نیاز، مقادیر را ویرایش کنید و سپس ذخیره کنید.</p>
        <div class="meal-table-wrap">
          <table class="meal-table preview-table">
            <thead>
              <tr>
                <th>روز</th>
                ${MEAL_TYPES.map(mt => `<th>${mt.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody id="preview-tbody">
              <!-- Rows will be injected here -->
            </tbody>
          </table>
        </div>
        <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
          <button id="cancel-btn" class="btn btn--secondary">انصراف</button>
          <button id="save-btn" class="btn btn--primary">تایید و ذخیره در دیتابیس</button>
        </div>
      </div>
    </div>
  `;

  const fileInput = document.getElementById('file-input');
  const uploadState = document.getElementById('upload-state');
  const loadingState = document.getElementById('loading-state');
  const previewState = document.getElementById('preview-state');
  const previewTbody = document.getElementById('preview-tbody');

  let extractedData = []; // Array of { date_iso, day_name, meals: { breakfast, lunch1, lunch2 } }

  fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    uploadState.style.display = 'none';
    loadingState.style.display = 'block';

    try {
      // 1. Call AI Edge Function
      const result = await apiService.extractFromImage(file);
      
      // 2. Parse AI Result based on expected format
      // Assuming result has: { week_start_date: "1405/08/10", days: [{ day_name: "شنبه", meals: [{ type: "breakfast", name: "املت" }] }] }
      
      if (!result.days || result.days.length === 0) {
        throw new Error('هوش مصنوعی نتوانست داده‌ای استخراج کند.');
      }

      // 3. Determine start date
      let startDateGregorian = null;
      if (result.week_start_date) {
        // Assume format YYYY/MM/DD in Shamsi
        const parts = result.week_start_date.split('/').map(Number);
        if (parts.length === 3) {
          const [gy, gm, gd] = toGregorian(parts[0], parts[1], parts[2]);
          startDateGregorian = new Date(gy, gm - 1, gd);
        }
      }

      if (!startDateGregorian) {
        // If AI didn't find date, ask user (for now, default to current week start)
        // TODO: Add a prompt modal here to ask user for date.
        const now = new Date();
        const day = now.getDay();
        const diff = (day === 6) ? 0 : -(day + 1);
        startDateGregorian = new Date(now.setDate(now.getDate() + diff));
        alert('تاریخ در عکس یافت نشد. تاریخ شروع هفته جاری در نظر گرفته شد. لطفاً در پیش‌نمایش بررسی کنید.');
      }

      // 4. Build Preview Data Structure
      const daysMap = {};
      WEEKDAYS.forEach((d, i) => {
        const dObj = new Date(startDateGregorian);
        dObj.setDate(dObj.getDate() + i);
        daysMap[d] = {
          date_iso: formatDateISO(dObj),
          date_shamsi: formatDateShamsi(dObj),
          meals: { breakfast: { name: '', desc: '' }, lunch1: { name: '', desc: '' }, lunch2: { name: '', desc: '' } }
        };
      });

      // 5. Merge AI Data (Resolving the Paradoxes)
      result.days.forEach(dayData => {
        const dName = dayData.day_name;
        if (!daysMap[dName]) return; // Skip unknown days

        const day = daysMap[dName];
        
        // Sort meals to process breakfast first, then lunches
        const sortedMeals = (dayData.meals || []).sort((a, b) => {
          const order = { breakfast: 0, lunch1: 1, lunch2: 2 };
          return (order[a.type] || 0) - (order[b.type] || 0);
        });

        let lunchCount = 0;

        sortedMeals.forEach(m => {
          if (m.type === 'breakfast' && !day.meals.breakfast.name) {
            day.meals.breakfast = { name: m.name, desc: m.description || '' };
          } else if (m.type === 'lunch1' || m.type === 'lunch2' || m.type === 'lunch') {
            // Smart assignment for lunches
            const targetKey = lunchCount === 0 ? 'lunch1' : 'lunch2';
            
            // Check for duplicates
            const isDuplicate = 
              (day.meals.lunch1.name && day.meals.lunch1.name.trim() === m.name.trim()) ||
              (day.meals.lunch2.name && day.meals.lunch2.name.trim() === m.name.trim());

            if (!isDuplicate && lunchCount < 2) {
              day.meals[targetKey] = { name: m.name, desc: m.description || '' };
              lunchCount++;
            }
          }
        });
      });

      // 6. Prepare data for rendering
      extractedData = WEEKDAYS.map(dName => ({
        day_name: dName,
        date_iso: daysMap[dName].date_iso,
        date_shamsi: daysMap[dName].date_shamsi,
        meals: daysMap[dName].meals
      }));

      renderPreview();
      loadingState.style.display = 'none';
      previewState.style.display = 'block';

    } catch (err) {
      alert('خطا در پردازش عکس: ' + err.message);
      loadingState.style.display = 'none';
      uploadState.style.display = 'block';
    }
  };

  function renderPreview() {
    previewTbody.innerHTML = '';
    extractedData.forEach((day, dIdx) => {
      const tr = document.createElement('tr');
      
      // Header (Day Name + Date)
      const tdDay = document.createElement('td');
      tdDay.innerHTML = `
        <div style="font-weight:bold">${day.day_name}</div>
        <input type="text" value="${day.date_shamsi}" class="date-input" data-didx="${dIdx}" style="margin-top:4px; text-align:center" dir="ltr" />
      `;
      tr.appendChild(tdDay);

      // Meals
      MEAL_TYPES.forEach(mt => {
        const meal = day.meals[mt.id];
        const tdMeal = document.createElement('td');
        tdMeal.innerHTML = `
          <input type="text" value="${meal.name}" placeholder="نام غذا..." class="name-input" data-didx="${dIdx}" data-mtype="${mt.id}" />
          <input type="text" value="${meal.desc}" placeholder="توضیحات (اختیاری)..." class="desc-input" data-didx="${dIdx}" data-mtype="${mt.id}" style="margin-top:4px" />
        `;
        tr.appendChild(tdMeal);
      });

      previewTbody.appendChild(tr);
    });
  }

  document.getElementById('cancel-btn').onclick = () => {
    window.location.hash = '#/';
  };

  document.getElementById('save-btn').onclick = async () => {
    const btn = document.getElementById('save-btn');
    btn.textContent = 'در حال ذخیره...';
    btn.disabled = true;

    try {
      const mealsToSave = [];

      // Read data from DOM (allows user edits)
      document.querySelectorAll('.name-input').forEach(input => {
        const dIdx = parseInt(input.dataset.didx);
        const mtype = input.dataset.mtype;
        const name = input.value.trim();
        
        if (name) {
          const descInput = document.querySelector(`.desc-input[data-didx="${dIdx}"][data-mtype="${mtype}"]`);
          const desc = descInput ? descInput.value.trim() : '';
          
          const dateInput = document.querySelector(`.date-input[data-didx="${dIdx}"]`);
          let date_iso = extractedData[dIdx].date_iso; // Fallback
          
          // If user changed the date, we need to convert it back
          if (dateInput && dateInput.value !== extractedData[dIdx].date_shamsi) {
            const parts = dateInput.value.split('/').map(Number);
            if (parts.length === 3) {
              const [gy, gm, gd] = toGregorian(parts[0], parts[1], parts[2]);
              date_iso = formatDateISO(new Date(gy, gm - 1, gd));
            }
          }

          mealsToSave.push({
            meal_date: date_iso,
            meal_type: mtype,
            name: name,
            description: desc || null
          });
        }
      });

      if (mealsToSave.length === 0) {
        throw new Error('هیچ غذایی برای ذخیره وجود ندارد.');
      }

      await apiService.saveMeals(mealsToSave);
      alert('اطلاعات با موفقیت ذخیره شد.');
      window.location.hash = '#/';

    } catch (err) {
      alert('خطا در ذخیره: ' + err.message);
      btn.textContent = 'تایید و ذخیره در دیتابیس';
      btn.disabled = false;
    }
  };
}