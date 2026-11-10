import { state } from '../state.js';
import { navigate, rerender } from '../router.js';
import { KARMA_LEVELS, getKarma } from '../config.js';
import { esc, faDigits, todayISO, formatPersianDate } from '../utils.js';
import { toast, confetti, setLoading } from '../ui.js';
import { createKarmaAction, createPerson } from '../db.js';
import { openShamsiDatepicker } from '../components/datepicker.js';

let karmaDraft = null;

function getDraft() {
  if (karmaDraft) return karmaDraft;
  karmaDraft = {
    title: '',
    description: '',
    karma_score: 0,
    action_date: todayISO(),
    action_time: new Date().toTimeString().slice(0, 5),
    related_people: [],
    tags: [],
  };
  return karmaDraft;
}

export function resetKarmaDraft() {
  karmaDraft = null;
}

export function render(container) {
  const d = getDraft();
  container.innerHTML = buildForm(d);
  attachHandlers(container, d);
}

function buildForm(d) {
  const currentKarma = getKarma(d.karma_score);
  
  const selectedPeopleHTML = d.related_people.map(id => {
    const person = state.people.find(p => p.id === id);
    if (!person) return '';
    return `<span class="people-pill">${esc(person.full_name)}<button type="button" data-remove-person="${esc(person.id)}">✕</button></span>`;
  }).join('');

  return `
    <div class="page-head">
      <div>
        <div class="page-title">ثبت کارما جدید</div>
        <div class="page-subtitle">هر عملی که انجام می‌دهی، انرژی‌ای به جهان بازمی‌گرداند.</div>
      </div>
    </div>

    <form class="add-form anim-fade-up" id="karma-form" novalidate>
      
      <div class="add-section">
        <div class="add-section-title">عملی که انجام دادی</div>
        <div class="field">
          <label for="karma-title">عنوان عمل</label>
          <input type="text" class="input" id="karma-title" name="title" placeholder="مثلاً: به یک دوست کمک کردم" value="${esc(d.title)}" maxlength="120" required>
        </div>
        <div class="field">
          <label for="karma-desc">جزئیات (اختیاری)</label>
          <textarea class="textarea" id="karma-desc" name="description" placeholder="چه اتفاقی افتاد؟">${esc(d.description)}</textarea>
        </div>
      </div>

      <div class="add-section">
        <div class="add-section-title">سطح کارما</div>
        <div class="field">
          <label>این عمل چه انرژی‌ای به جهان فرستاد؟</label>
          
          <div class="karma-selector-row" id="karma-selector">
            ${KARMA_LEVELS.map(k => `
              <button type="button" class="karma-btn ${k.score === d.karma_score ? 'active' : ''}" data-karma="${k.score}" style="--karma-color: ${k.color}; --karma-glow: ${k.glow}">
                <span class="karma-btn-icon">${k.icon}</span>
                <span class="karma-btn-label">${k.label}</span>
                <span class="karma-btn-score">${k.shortLabel}</span>
              </button>
            `).join('')}
          </div>
          
          <div class="field-hint" style="text-align:center; margin-top:.75rem; font-weight:600; color:${currentKarma.color}" id="karma-desc">
            ${currentKarma.desc}
          </div>
        </div>
      </div>

      <div class="add-section">
        <div class="add-section-title">زمان و افراد</div>
        <div class="add-row">
          <div class="field">
            <label>تاریخ</label>
            <input type="text" class="input" id="karma-date-display" value="${formatPersianDate(d.action_date)}" readonly style="cursor:pointer" placeholder="انتخاب تاریخ">
          </div>
          <div class="field">
            <label for="karma-clock">ساعت</label>
            <input type="time" class="input" id="karma-clock" name="action_time" value="${esc(d.action_time)}">
          </div>
        </div>
        <div class="field" style="position:relative">
          <label for="people-search">همراه با (اختیاری)</label>
          <div class="people-picker" id="people-picker">
            ${selectedPeopleHTML}
            <input type="text" id="people-search" class="people-search-input" placeholder="جستجوی نام..." autocomplete="off">
          </div>
          <div class="people-dropdown" id="people-dropdown" hidden></div>
        </div>
      </div>

      <div class="add-section">
        <div class="add-section-title">برچسب‌ها</div>
        <div class="field">
          <label for="tag-input">برچسب‌ها (Enter برای افزودن)</label>
          <div class="tag-input" id="tag-input-wrap">
            ${d.tags.map((t) => `<span class="tag-pill">${esc(t)}<button type="button" data-remove-tag="${esc(t)}">✕</button></span>`).join('')}
            <input type="text" id="tag-input" placeholder="مثلاً: مهربانی" maxlength="24">
          </div>
        </div>
      </div>

      <div style="display:flex;gap:.5rem;flex-wrap:wrap;padding-top:.5rem">
        <button type="submit" class="btn btn-primary btn-lg" id="save-karma" style="background:linear-gradient(135deg, var(--violet-500), #4c1d95);box-shadow:0 4px 14px rgba(139,92,246,.4)">☯️ ثبت کارما</button>
        <button type="button" class="btn btn-outline" id="clear-karma">پاک کردن فرم</button>
        <button type="button" class="btn btn-ghost" data-goto="karma">بازگشت به داشبورد کارما</button>
      </div>
    </form>
  `;
}

function attachHandlers(container, d) {
  const form = container.querySelector('#karma-form');

  container.querySelectorAll('.karma-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      d.karma_score = Number(btn.dataset.karma);
      container.querySelectorAll('.karma-btn').forEach((b) => b.classList.toggle('active', Number(b.dataset.karma) === d.karma_score));
      const kInfo = getKarma(d.karma_score);
      const descEl = container.querySelector('#karma-desc');
      if (descEl && kInfo) {
        descEl.textContent = kInfo.desc;
        descEl.style.color = kInfo.color;
      }
    });
  });

  const tagInput = container.querySelector('#tag-input');
  const tagWrap = container.querySelector('#tag-input-wrap');
  tagInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      const value = tagInput.value.trim();
      if (!value) return;
      if (d.tags.includes(value)) { tagInput.value = ''; return; }
      if (d.tags.length >= 8) { toast('حداکثر ۸ برچسب', 'warning'); return; }
      d.tags.push(value);
      tagInput.value = '';
      refreshTags(tagWrap, d);
    }
    if (event.key === 'Backspace' && !tagInput.value && d.tags.length) {
      d.tags.pop();
      refreshTags(tagWrap, d);
    }
  });

  tagWrap?.addEventListener('click', (event) => {
    const removeBtn = event.target.closest('[data-remove-tag]');
    if (removeBtn) {
      d.tags = d.tags.filter((t) => t !== removeBtn.dataset.removeTag);
      refreshTags(tagWrap, d);
    }
  });

  const dateDisplay = container.querySelector('#karma-date-display');
  dateDisplay?.addEventListener('click', () => {
    openShamsiDatepicker(d.action_date, (newIso) => {
      d.action_date = newIso;
      dateDisplay.value = formatPersianDate(newIso);
    });
  });

  // People Picker Handlers
  const peopleSearch = container.querySelector('#people-search');
  const peopleDropdown = container.querySelector('#people-dropdown');
  const peoplePicker = container.querySelector('#people-picker');
  
  const renderDropdown = () => {
    const query = peopleSearch.value.trim().toLowerCase();
    const selectedIds = new Set(d.related_people);
    
    const matches = state.people.filter(p => 
      !selectedIds.has(p.id) && p.full_name.toLowerCase().includes(query)
    );
    
    let html = '';
    if (matches.length > 0) {
      html = matches.slice(0, 10).map(p => `
        <div class="people-dropdown-item" data-person-id="${esc(p.id)}" data-person-name="${esc(p.full_name)}">
          <span>${esc(p.full_name)}</span>
        </div>
      `).join('');
    }
    
    if (query && !state.people.some(p => p.full_name.toLowerCase() === query)) {
      html += `
        <div class="people-dropdown-item create" data-create-name="${esc(peopleSearch.value.trim())}">
          <span>➕ افزودن «${esc(peopleSearch.value.trim())}» به افراد</span>
        </div>
      `;
    }
    
    if (!html) {
      html = `<div class="people-dropdown-empty">نتیجه‌ای یافت نشد</div>`;
    }
    
    peopleDropdown.innerHTML = html;
    peopleDropdown.hidden = false;
  };

  peopleSearch?.addEventListener('focus', () => {
    if (state.people.length > 0 || peopleSearch.value.trim()) renderDropdown();
  });

  peopleSearch?.addEventListener('input', renderDropdown);

  document.addEventListener('click', (event) => {
    if (!peoplePicker?.contains(event.target) && !peopleDropdown?.contains(event.target)) {
      peopleDropdown.hidden = true;
    }
  });

  peopleDropdown?.addEventListener('click', async (event) => {
    const item = event.target.closest('.people-dropdown-item');
    if (!item) return;
    
    if (item.dataset.personId) {
      d.related_people.push(item.dataset.personId);
      peopleSearch.value = '';
      peopleDropdown.hidden = true;
      refreshPeoplePills(peoplePicker, peopleSearch, d);
      peopleSearch.focus();
    } else if (item.dataset.createName) {
      const newName = item.dataset.createName;
      item.innerHTML = '<span style="color:var(--text-muted)">در حال ثبت...</span>';
      try {
        const newPerson = await createPerson(newName);
        state.people.push(newPerson);
        d.related_people.push(newPerson.id);
        peopleSearch.value = '';
        peopleDropdown.hidden = true;
        refreshPeoplePills(peoplePicker, peopleSearch, d);
        toast('فرد جدید با موفقیت ثبت شد', 'success', 2000);
        peopleSearch.focus();
      } catch (err) {
        toast(err.message || 'خطا در ثبت فرد', 'error');
        renderDropdown();
      }
    }
  });

  peoplePicker?.addEventListener('click', (event) => {
    const removeBtn = event.target.closest('[data-remove-person]');
    if (removeBtn) {
      const idToRemove = removeBtn.dataset.removePerson;
      d.related_people = d.related_people.filter(id => id !== idToRemove);
      refreshPeoplePills(peoplePicker, peopleSearch, d);
    } else if (event.target === peoplePicker) {
      peopleSearch.focus();
    }
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = (form.querySelector('#karma-title')?.value || '').trim();
    if (!title) {
      toast('برای عملت یک عنوان بنویس', 'warning');
      form.querySelector('#karma-title')?.focus();
      return;
    }

    const payload = {
      title,
      description: (form.querySelector('#karma-desc')?.value || '').trim(),
      karma_score: d.karma_score,
      action_date: d.action_date,
      action_time: form.querySelector('#karma-clock')?.value || null,
      related_people: d.related_people,
      tags: d.tags.slice(),
    };

    const submitBtn = form.querySelector('#save-karma');
    setLoading(submitBtn, true);
    try {
      const saved = await createKarmaAction(payload);
      state.karma_actions = [saved, ...(state.karma_actions || [])];
      confetti(90);
      toast('کارما ثبت شد! ☯️', 'success');
      resetKarmaDraft();
      rerender();
    } catch (err) {
      toast(err.message || 'خطا در ثبت', 'error');
    } finally {
      setLoading(submitBtn, false);
    }
  });

  container.querySelector('#clear-karma')?.addEventListener('click', async () => {
    const { confirmDialog } = await import('../ui.js');
    const ok = await confirmDialog({ title: 'پاک کردن فرم', message: 'فرم از ابتدا پر می‌شود. مطمئنی؟', confirmText: 'پاک کن' });
    if (!ok) return;
    resetKarmaDraft();
    rerender();
  });

  container.querySelectorAll('[data-goto]').forEach((el) => {
    el.addEventListener('click', () => navigate(el.dataset.goto));
  });
}

function refreshTags(wrap, d) {
  if (!wrap) return;
  const input = wrap.querySelector('#tag-input');
  const pills = wrap.querySelectorAll('.tag-pill');
  pills.forEach((p) => p.remove());
  const frag = document.createDocumentFragment();
  d.tags.forEach((t) => {
    const span = document.createElement('span');
    span.className = 'tag-pill';
    span.innerHTML = `${esc(t)}<button type="button" data-remove-tag="${esc(t)}">✕</button>`;
    frag.appendChild(span);
  });
  if (input) wrap.insertBefore(frag, input);
  else wrap.appendChild(frag);
}

function refreshPeoplePills(picker, searchInput, d) {
  if (!picker || !searchInput) return;
  picker.querySelectorAll('.people-pill').forEach(p => p.remove());
  const frag = document.createDocumentFragment();
  
  d.related_people.forEach(id => {
    const person = state.people.find(p => p.id === id);
    if (person) {
      const span = document.createElement('span');
      span.className = 'people-pill';
      span.innerHTML = `${esc(person.full_name)}<button type="button" data-remove-person="${esc(person.id)}">✕</button></span>`;
      frag.appendChild(span);
    }
  });
  
  picker.insertBefore(frag, searchInput);
}
