/**
 * Madacto Upload Page (Async AI Extraction & Preview)
 */

import { apiService } from '../services/api.js';
import { WEEKDAYS, MEAL_TYPES } from '../config.js';
import { toGregorian, formatDateISO, formatDateShamsi } from '../utils/date.js';
import { escapeHtml, showToast, openModal } from '../utils/ui.js';

const AI_PROMPT = `You are an expert OCR system for a Persian office restaurant menu.
Extract the meal schedule from the provided image. The image might contain multiple weeks.

Rules:
1. Identify the days (شنبه, یکشنبه, دوشنبه, سه‌شنبه, چهارشنبه). Ignore Thursday and Friday.
2. Extract the date for EACH day if visible. The date will be in Jalali format (e.g., 1405/08/10). If not visible, leave it empty.
3. For each day, extract the meals:
   - Breakfast (صبحانه)
   - Lunch (ناهار). If there are two lunch options, identify them as "lunch1" and "lunch2". If only one, use "lunch1".
4. Return the data STRICTLY as a valid JSON object matching the following schema. Do not include markdown formatting or backticks.

JSON Schema:
{
  "days": [
    {
      "day_name": "string (شنبه, یکشنبه, دوشنبه, سه‌شنبه, چهارشنبه)",
      "date_shamsi": "string (e.g., 1405/08/10 or empty)",
      "meals": [
        {
          "type": "string (breakfast, lunch1, lunch2)",
          "name": "string",
          "description": "string"
        }
      ]
    }
  ]
}`;

export function renderUpload(root) {
  root.innerHTML = `
    <div class="container">
      <div style="margin-bottom: 20px;">
        <a href="#/" style="color: var(--text-secondary); text-decoration: none;">&rarr; بازگشت به برنامه هفتگی</a>
        <h2 style="margin-top: 8px;">آپلود عکس منو</h2>
      </div>

      <div id="upload-state">
        <label class="upload-area">
          <input type="file" id="file-input" accept="image/jpeg,image/png" />
          <div style="font-size: 40px; margin-bottom: 12px;">📷</div>
          <div style="font-weight: bold; margin-bottom: 4px;">برای انتخاب عکس کلیک کنید</div>
          <div style="font-size: 12px; color: var(--text-secondary);">استخراج خودکار توسط هوش مصنوعی سرور</div>
        </label>

        <div style="text-align: center; margin: 16px 0; color: var(--text-tertiary); font-size: 12px; display: flex; align-items: center; gap: 8px;">
          <div style="flex: 1; height: 1px; background: var(--border-default);"></div>
          <span>یا</span>
          <div style="flex: 1; height: 1px; background: var(--border-default);"></div>
        </div>

        <div style="text-align: center;">
          <button id="btn-manual-ai" class="btn btn--secondary" style="width: 100%; height: 44px; font-size: 14px;">
            استفاده از چت‌های دیگر (کپی پرامپت و دریافت JSON)
          </button>
        </div>
      </div>

      <div id="loading-state" style="display:none; text-align:center; padding: 40px;">
        <div class="boot-splash__spinner" style="margin: 0 auto 16px;"></div>
        <div style="font-weight: bold;">در حال پردازش...</div>
        <div id="loading-status-text" style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">لطفاً صبر کنید...</div>
      </div>

      <div id="preview-state" style="display:none;">
        <h3 style="margin-bottom: 8px;">پیش‌نمایش داده‌های استخراج شده</h3>
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">در صورت نیاز، مقادیر را ویرایش کنید و سپس ذخیره کنید.</p>
        <div class="meal-table-wrap">
          <table class="meal-table preview-table">
            <thead>
              <tr>
                <th>روز</th>
                ${MEAL_TYPES.map(mt => `<th>${mt.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody id="preview-tbody"></tbody>
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
  const loadingStatusText = document.getElementById('loading-status-text');
  const previewState = document.getElementById('preview-state');
  const previewTbody = document.getElementById('preview-tbody');
  
  let extractedData = [];
  let pollingInterval = null;

  function showErrorModal(title, message) {
    const content = document.createElement('div');
    content.innerHTML = `
      <div style="background: var(--danger-50); border: 1px solid var(--danger-100); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 12px;">
        <p style="margin: 0; font-size: 13px; color: var(--danger-700); font-weight: bold;">${title}</p>
      </div>
      <p style="font-size: 12px; margin-bottom: 8px;">جزئیات خطا (برای کپی کردن انتخاب کنید):</p>
      <textarea style="width: 100%; height: 120px; font-family: monospace; font-size: 11px; direction: ltr; padding: 8px; border: 1px solid var(--border-default); border-radius: var(--radius-sm); background: var(--bg-subtle);" readonly>${message}</textarea>
    `;
    
    openModal({
      title: 'خطای سیستم',
      content: content,
      actions: [{ label: 'بستن', onClick: () => document.getElementById('modal-root').innerHTML = '' }]
    });
  }

  function processAIResult(result) {
    if (!result.days || result.days.length === 0) {
      throw new Error('داده‌ای استخراج نشد.');
    }

    const weeksMap = {}; 

    result.days.forEach(dayData => {
      const dName = dayData.day_name;
      const dayIndex = WEEKDAYS.indexOf(dName);
      if (dayIndex === -1) return; 

      let dateObj = null;
      if (dayData.date_shamsi) {
        const parts = dayData.date_shamsi.split('/').map(Number);
        if (parts.length === 3) {
          const [gy, gm, gd] = toGregorian(parts[0], parts[1], parts[2]);
          dateObj = new Date(gy, gm - 1, gd);
        }
      }
      
      if (!dateObj) {
        const now = new Date();
        const currentDay = now.getDay();
        const diffToSat = (currentDay === 6) ? 0 : -(currentDay + 1);
        const startOfWeek = new Date(now);
        startOfWeek.setDate(startOfWeek.getDate() + diffToSat);
        dateObj = new Date(startOfWeek);
        dateObj.setDate(dateObj.getDate() + dayIndex);
        dateObj.setHours(0,0,0,0);
      }

      const isoDate = formatDateISO(dateObj);
      const shamsiDate = formatDateShamsi(dateObj);

      const weekStart = new Date(dateObj);
      weekStart.setDate(weekStart.getDate() - dayIndex);
      const weekKey = formatDateISO(weekStart);

      if (!weeksMap[weekKey]) {
        weeksMap[weekKey] = { start_date: weekStart, days: {} };
      }

      const day = weeksMap[weekKey].days[shamsiDate] || {
        day_name: dName,
        date_iso: isoDate,
        date_shamsi: shamsiDate,
        meals: { breakfast: { name: '', desc: '' }, lunch1: { name: '', desc: '' }, lunch2: { name: '', desc: '' } }
      };

      const sortedMeals = (dayData.meals || []).sort((a, b) => {
        const order = { breakfast: 0, lunch1: 1, lunch2: 2 };
        return (order[a.type] || 0) - (order[b.type] || 0);
      });

      let lunchCount = 0;
      sortedMeals.forEach(m => {
        if (m.type === 'breakfast' && !day.meals.breakfast.name) {
          day.meals.breakfast = { name: m.name, desc: m.description || '' };
        } else if (m.type === 'lunch1' || m.type === 'lunch2' || m.type === 'lunch') {
          const targetKey = lunchCount === 0 ? 'lunch1' : 'lunch2';
          const isDuplicate = 
            (day.meals.lunch1.name && day.meals.lunch1.name.trim() === m.name.trim()) ||
            (day.meals.lunch2.name && day.meals.lunch2.name.trim() === m.name.trim());

          if (!isDuplicate && lunchCount < 2) {
            day.meals[targetKey] = { name: m.name, desc: m.description || '' };
            lunchCount++;
          }
        }
      });

      weeksMap[weekKey].days[shamsiDate] = day;
    });

    extractedData = [];
    const sortedWeekKeys = Object.keys(weeksMap).sort();
    sortedWeekKeys.forEach(wk => {
      const weekDays = weeksMap[wk].days;
      const sortedDates = Object.keys(weekDays).sort();
      sortedDates.forEach(dt => {
        extractedData.push(weekDays[dt]);
      });
    });

    if (extractedData.length === 0) throw new Error('هیچ روز معتبری یافت نشد.');

    renderPreview();
    loadingState.style.display = 'none';
    previewState.style.display = 'block';
  }

  fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    fileInput.value = '';
    if (!file) return;

    uploadState.style.display = 'none';
    loadingState.style.display = 'block';
    loadingStatusText.textContent = 'در حال ارسال عکس...';

    try {
      const jobId = await apiService.startImageExtraction(file);
      
      loadingStatusText.textContent = 'هوش مصنوعی در حال خواندن منو است...';

      let attempts = 0;
      const maxAttempts = 40;

      pollingInterval = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
          clearInterval(pollingInterval);
          showErrorModal('زمان پردازش به پایان رسید', 'پردازش بیش از حد طول کشید. لطفاً دوباره تلاش کنید.');
          loadingState.style.display = 'none';
          uploadState.style.display = 'block';
          return;
        }

        try {
          const job = await apiService.checkJobStatus(jobId);

          if (job.status === 'completed') {
            clearInterval(pollingInterval);
            processAIResult(job.result);
          } else if (job.status === 'failed') {
            clearInterval(pollingInterval);
            showErrorModal('خطای هوش مصنوعی', job.error || 'پردازش ناموفق بود.');
            loadingState.style.display = 'none';
            uploadState.style.display = 'block';
          }
        } catch (err) {
          console.warn('Polling error', err);
        }
      }, 3000);

    } catch (err) {
      // Show rich error modal instead of just toast
      showErrorModal('خطای اتصال به سرور', err.message);
      loadingState.style.display = 'none';
      uploadState.style.display = 'block';
    }
  };

  document.getElementById('btn-manual-ai').onclick = () => {
    const wrapper = document.createElement('div');
    const p1 = document.createElement('p');
    p1.style.fontSize = '12px'; p1.style.marginBottom = '8px';
    p1.textContent = '۱. پرامپت زیر را کپی کنید و همراه با عکس به هوش مصنوعی بدهید.';

    const promptTextArea = document.createElement('textarea');
    Object.assign(promptTextArea.style, { width: '100%', height: '120px', fontFamily: 'monospace', fontSize: '10px', direction: 'ltr', padding: '8px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)' });
    promptTextArea.value = AI_PROMPT;
    promptTextArea.readOnly = true;

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn--secondary btn--sm';
    copyBtn.textContent = 'کپی پرامپت';
    Object.assign(copyBtn.style, { marginTop: '8px', display: 'block', width: '100%' });
    copyBtn.onclick = () => {
      promptTextArea.select();
      document.execCommand('copy');
      navigator.clipboard.writeText(AI_PROMPT).catch(() => {});
      copyBtn.textContent = 'کپی شد!';
      setTimeout(() => copyBtn.textContent = 'کپی پرامپت', 2000);
    };

    const hr = document.createElement('hr');
    Object.assign(hr.style, { margin: '16px 0', border: '0', borderTop: '1px solid var(--border-default)' });

    const p2 = document.createElement('p');
    p2.style.fontSize = '12px'; p2.style.marginBottom = '8px';
    p2.textContent = '۲. پاسخ JSON دریافتی را در کادر زیر پیست کنید:';

    const jsonInput = document.createElement('textarea');
    Object.assign(jsonInput.style, { width: '100%', height: '100px', fontFamily: 'monospace', direction: 'ltr', padding: '8px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)' });
    jsonInput.placeholder = '{"days": [...]}';

    wrapper.append(p1, promptTextArea, copyBtn, hr, p2, jsonInput);

    const modal = openModal({
      title: 'استفاده از هوش مصنوعی‌های دیگر',
      content: wrapper,
      actions: [
        {
          label: 'پردازش JSON',
          primary: true,
          onClick: () => {
            try {
              const parsed = JSON.parse(jsonInput.value);
              modal.close();
              uploadState.style.display = 'none';
              loadingState.style.display = 'block';
              setTimeout(() => processAIResult(parsed), 100);
            } catch (err) {
              showToast('فرمت JSON نامعتبر است.', 'error');
            }
          }
        },
        { label: 'انصراف', onClick: () => modal.close() }
      ]
    });
  };

  function renderPreview() {
    previewTbody.innerHTML = '';
    extractedData.forEach((day, dIdx) => {
      const tr = document.createElement('tr');
      const tdDay = document.createElement('td');
      tdDay.innerHTML = `
        <div style="font-weight:bold; font-size:11px">${day.day_name}</div>
        <input type="text" value="${escapeHtml(day.date_shamsi)}" class="date-input" data-didx="${dIdx}" style="margin-top:4px; text-align:center; width: 80px; padding: 2px;" dir="ltr" />
      `;
      tr.appendChild(tdDay);

      MEAL_TYPES.forEach(mt => {
        const meal = day.meals[mt.id];
        const tdMeal = document.createElement('td');
        tdMeal.innerHTML = `
          <input type="text" value="${escapeHtml(meal.name)}" placeholder="نام..." class="name-input" data-didx="${dIdx}" data-mtype="${mt.id}" style="padding: 4px; font-size: 11px;" />
          <input type="text" value="${escapeHtml(meal.desc)}" placeholder="توضیح..." class="desc-input" data-didx="${dIdx}" data-mtype="${mt.id}" style="margin-top:4px; padding: 4px; font-size: 10px;" />
        `;
        tr.appendChild(tdMeal);
      });
      previewTbody.appendChild(tr);
    });
  }

  document.getElementById('cancel-btn').onclick = () => {
    if (pollingInterval) clearInterval(pollingInterval);
    window.location.hash = '#/';
  };

  document.getElementById('save-btn').onclick = async () => {
    const btn = document.getElementById('save-btn');
    btn.textContent = 'در حال ذخیره...';
    btn.disabled = true;

    try {
      const mealsToSave = [];
      document.querySelectorAll('.name-input').forEach(input => {
        const dIdx = parseInt(input.dataset.didx);
        const mtype = input.dataset.mtype;
        const name = input.value.trim();
        
        if (name) {
          const descInput = document.querySelector(`.desc-input[data-didx="${dIdx}"][data-mtype="${mtype}"]`);
          const desc = descInput ? descInput.value.trim() : '';
          
          const dateInput = document.querySelector(`.date-input[data-didx="${dIdx}"]`);
          let date_iso = extractedData[dIdx].date_iso;
          
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

      if (mealsToSave.length === 0) throw new Error('هیچ غذایی برای ذخیره وجود ندارد.');
      await apiService.saveMeals(mealsToSave);
      
      showToast('اطلاعات با موفقیت ذخیره شد.', 'success');
      window.location.hash = '#/';

    } catch (err) {
      showToast('خطا در ذخیره: ' + err.message, 'error');
      btn.textContent = 'تایید و ذخیره در دیتابیس';
      btn.disabled = false;
    }
  };
}