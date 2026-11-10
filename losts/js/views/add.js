import { state } from '../state.js';
import { navigate, rerender } from '../router.js';
import { CATEGORIES, EMOJIS, JOY_SCORE_LABELS, MOODS, KARMA_LEVELS, getKarma } from '../config.js';
import { esc, faDigits, todayISO, formatPersianDate, clamp } from '../utils.js';
import { toast, confetti, setLoading } from '../ui.js';
import { createEntry, createPerson } from '../db.js';

let draft = null;

function getDraft() {
  if (draft) return draft;
  draft = {
    title: '',
    description: '',
    emoji: '✨',
    category: 'fun',
    joy_score: 7,
    karma_score: 0, // Default is now Neutral
    money_spent: 0,
    time_spent_minutes: 0,
    tags: [],
    entry_date: todayISO(),
    entry_time: new Date().toTimeString().slice(0, 5),
    is_favorite: false,
    location: '',
    with_people: '',
    related_people: [],
    mood_before: '',
    mood_after: '',
  };
  return draft;
}

export function resetDraft() {
  draft = null;
}

export function render(container) {
  const d = getDraft();
  container.innerHTML = buildForm(d);
  attachHandlers(container, d);
}

function buildForm(d) {
  const currentKarma = getKarma(d.karma_score);
  
  // Create related people pills
  const selectedPeopleHTML = d.related_people.map(id => {
    const person = state.people.find(p => p.id === id);
    if (!person) return '';
    return `<span class="people-pill">${esc(person.full_name)}<button type="button" data-remove-person="${esc(person.id)}">✕</button></span>`;
  }).join('');

  return `
    <div class="page-head">
      <div>
        <div class="page-title">ثبت شادی جدید</div>
        <div class="page-subtitle">هر لحظه‌ای که برای خودت ساختی، ارزش ثبت دارد.</div>
      </div>
    </div>

    <form class="add-form anim-fade-up" id="add-form" novalidate>
      <div class="add-section">
        <div class="add-section-title">عنوان</div>
        <div class="field">
          <label for="entry-title">چه شادی‌ای تجربه کردی؟</label>
          <input type="text" class="input" id="entry-title" name="title" placeholder="مثلاً: یک قهوه با دوستم" value="${esc(d.title)}" maxlength="120" required>
        </div>
        <div class="field">
          <label for="entry-desc">توضیح (اختیاری)</label>
          <textarea class="textarea" id="entry-desc" name="description" placeholder="چیزی که این لحظه را خاص کرد بنویس...">${esc(d.description)}</textarea>
        </div>
      </div>

      <div class="add-section">
        <div class="add-section-title">کارما</div>
        <div class="field">
          <label>این شادی چه اثری روی جهان و خودت می‌گذارد؟</label>
          
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
        <div class="add-section-title">شدت شادی</div>
        <div class="joy-score-display">
          <span>این شادی چقدر برایت ارزش داشت؟</span>
          <span class="joy-score-value" id="joy-score-label">${esc(JOY_SCORE_LABELS[d.joy_score] || '')}</span>
        </div>
        <input type="range" min="1" max="10" step="1" value="${clamp(d.joy_score, 1, 10)}" id="joy-score" name="joy_score">
        <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--text-muted);margin-top:.15rem">
          <span>${faDigits(1)}</span><span>${faDigits(10)}</span>
        </div>
      </div>

      <div class="add-section">
        <div class="add-section-title">حالت</div>
        <div class="field">
          <label>یک ایموجی انتخاب کن</label>
          <div class="emoji-picker" id="emoji-picker">
            ${EMOJIS.map((emoji) => `<button type="button" class="emoji-btn ${emoji === d.emoji ? 'active' : ''}" data-emoji="${esc(emoji)}">${esc(emoji)}</button>`).join('')}
          </div>
        </div>
        <div class="field">
          <label>دسته‌بندی</label>
          <div class="journal-filters" id="category-picker">
            ${CATEGORIES.map((cat) => `<button type="button" class="chip ${cat.id === d.category ? 'active' : ''}" data-category="${esc(cat.id)}">${esc(cat.emoji)} ${esc(cat.label)}</button>`).join('')}
          </div>
        </div>
      </div>

      <div class="add-section">
        <div class="add-section-title">هزینه و زمان</div>
        <div class="add-row">
          <div class="field">
            <label for="entry-money">پولی که خرج کردی</label>
            <div class="input-group">
              <input type="number" class="input" id="entry-money" name="money_spent" min="0" step="1000" value="${Number(d.money_spent) || 0}" inputmode="numeric">
              <span class="input-suffix">تومان</span>
            </div>
          </div>
          <div class="field">
            <label for="entry-time">دقیقه‌ای که صرف کردی</label>
            <div class="input-group">
              <input type="number" class="input" id="entry-time" name="time_spent_minutes" min="0" step="5" value="${Number(d.time_spent_minutes) || 0}" inputmode="numeric">
              <span class="input-suffix">دقیقه</span>
            </div>
          </div>
        </div>
      </div>

      <div class="add-section">
        <div class="add-section-title">حال و مکان</div>
        <div class="add-row">
          <div class="field">
            <label for="entry-date">تاریخ</label>
            <input type="date" class="input" id="entry-date" name="entry_date" value="${esc(d.entry_date)}">
            <div class="field-hint">${esc(formatPersianDate(d.entry_date))}</div>
          </div>
          <div class="field">
            <label for="entry-clock">ساعت</label>
            <input type="time" class="input" id="entry-clock" name="entry_time" value="${esc(d.entry_time)}">
          </div>
        </div>
        <div class="add-row">
          <div class="field">
            <label for="entry-location">مکان (اختیاری)</label>
            <input type="text" class="input" id="entry-location" name="location" placeholder="مثلاً: کافه محله" value="${esc(d.location)}" maxlength="80">
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
        <div class="add-row">
          <div class="field">
            <label for="mood-before">حال قبل</label>
            <select class="select" id="mood-before" name="mood_before">
              <option value="">—</option>
              ${MOODS.map((m) => `<option value="${esc(m.id)}" ${d.mood_before === m.id ? 'selected' : ''}>${esc(m.emoji)} ${esc(m.label)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="mood-after">حال بعد</label>
            <select class="select" id="mood-after" name="mood_after">
              <option value="">—</option>
              ${MOODS.map((m) => `<option value="${esc(m.id)}" ${d.mood_after === m.id ? 'selected' : ''}>${esc(m.emoji)} ${esc(m.label)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="add-section">
        <div class="add-section-title">برچسب‌ها</div>
        <div class="field">
          <label for="tag-input">برچسب‌ها (Enter برای افزودن)</label>
          <div class="tag-input" id="tag-input-wrap">
            ${d.tags.map((t) => `<span class="tag-pill">${esc(t)}<button type="button" data-remove-tag="${esc(t)}">✕</button></span>`).join('')}
            <input type="text" id="tag-input" placeholder="مثلاً: خودمراقبتی" maxlength="24">
          </div>
        </div>
      </div>

      <div class="add-section">
        <label class="settings-row" style="cursor:pointer;padding:.5rem 0;border:none">
          <div class="settings-row-label">
            <div class="settings-row-title">⭐ موردعلاقه</div>
            <div class="settings-row-desc">این لحظه را در موردعلاقه‌ها نگه دار</div>
          </div>
          <div class="toggle">
            <input type="checkbox" id="entry-favorite" ${d.is_favorite ? 'checked' : ''}>
            <span class="toggle-track"></span>
          </div>
        </label>
      </div>

      <div style="display:flex;gap:.5rem;flex-wrap:wrap;padding-top:.5rem">
        <button type="submit" class="btn btn-primary btn-lg" id="save-entry">💫 ثبت شادی</button>
        <button type="button" class="btn btn-outline" id="clear-entry">پاک کردن فرم</button>
        <button type="button" class="btn btn-ghost" data-goto="dashboard">بازگشت</button>
      </div>
    </form>
  `;
}

function attachHandlers(container, d) {
  const form = container.querySelector('#add-form');

  container.querySelectorAll('.emoji-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      d.emoji = btn.dataset.emoji;
      container.querySelectorAll('.emoji-btn').forEach((b) => b.classList.toggle('active', b.dataset.emoji === d.emoji));
    });
  });

  container.querySelectorAll('[data-category]').forEach((btn) => {
    btn.addEventListener('click', () => {
      d.category = btn.dataset.category;
      container.querySelectorAll('[data-category]').forEach((b) => b.classList.toggle('active', b.dataset.category === d.category));
    });
  });

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

  const scoreInput = container.querySelector('#joy-score');
  const scoreLabel = container.querySelector('#joy-score-label');
  scoreInput?.addEventListener('input', () => {
    d.joy_score = clamp(scoreInput.value, 1, 10);
    if (scoreLabel) scoreLabel.textContent = JOY_SCORE_LABELS[d.joy_score] || '';
  });

  // Tag Handler
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

  // People Picker Handlers
  const peopleSearch = container.querySelector('#people-search');
  const peopleDropdown = container.querySelector('#people-dropdown');
  const peoplePicker = container.querySelector('#people-picker');
  
  const renderDropdown = () => {
    const query = peopleSearch.value.trim().toLowerCase();
    const selectedIds = new Set(d.related_people);
    
    // Filter people
    const matches = state.people.filter(p => 
      !selectedIds.has(p.id) && p.full_name.toLowerCase().includes(query)
    );
    
    let html = '';
    if (matches.length > 0) {
      html = matches.slice(0, 10).map(p => `
        <div class="people-dropdown-item" data-person-id="${esc(p.id)}" data-person-name="${esc(p.full_name)}">
          <span>${esc(p.full_name)}</span>
          ${p.job_title ? `<span style="font-size:.7rem;color:var(--text-muted)">${esc(p.job_title)}</span>` : ''}
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

  // Close dropdown on click outside
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
      d.with_people = state.people.filter(p => d.related_people.includes(p.id)).map(p => p.full_name).join(', ');
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
        d.with_people = state.people.filter(p => d.related_people.includes(p.id)).map(p => p.full_name).join(', ');
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
      d.with_people = state.people.filter(p => d.related_people.includes(p.id)).map(p => p.full_name).join(', ');
      refreshPeoplePills(peoplePicker, peopleSearch, d);
    } else if (event.target === peoplePicker) {
      peopleSearch.focus();
    }
  });

  container.querySelector('#entry-date')?.addEventListener('change', (event) => {
    d.entry_date = event.target.value || todayISO();
    const hint = event.target.parentElement.querySelector('.field-hint');
    if (hint) hint.textContent = formatPersianDate(d.entry_date);
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = (form.querySelector('#entry-title')?.value || '').trim();
    if (!title) {
      toast('برای شادی‌ات یک عنوان بنویس', 'warning');
      form.querySelector('#entry-title')?.focus();
      return;
    }

    const payload = {
      title,
      description: (form.querySelector('#entry-desc')?.value || '').trim(),
      emoji: d.emoji,
      category: d.category,
      joy_score: clamp(Number(form.querySelector('#joy-score')?.value) || 5, 1, 10),
      karma_score: d.karma_score,
      money_spent: Math.max(0, Number(form.querySelector('#entry-money')?.value) || 0),
      time_spent_minutes: Math.max(0, Math.round(Number(form.querySelector('#entry-time')?.value) || 0)),
      tags: d.tags.slice(),
      entry_date: form.querySelector('#entry-date')?.value || todayISO(),
      entry_time: form.querySelector('#entry-clock')?.value || null,
      is_favorite: !!form.querySelector('#entry-favorite')?.checked,
      location: (form.querySelector('#entry-location')?.value || '').trim() || null,
      with_people: d.with_people || null,
      related_people: d.related_people,
      mood_before: form.querySelector('#mood-before')?.value || null,
      mood_after: form.querySelector('#mood-after')?.value || null,
    };

    const submitBtn = form.querySelector('#save-entry');
    setLoading(submitBtn, true);
    try {
      const saved = await createEntry(payload);
      state.entries = [saved, ...(state.entries || [])];
      confetti(90);
      toast('شادی ثبت شد! ✨', 'success');
      resetDraft();
      rerender();
    } catch (err) {
      toast(err.message || 'خطا در ثبت', 'error');
    } finally {
      setLoading(submitBtn, false);
    }
  });

  container.querySelector('#clear-entry')?.addEventListener('click', async () => {
    const { confirmDialog } = await import('../ui.js');
    const ok = await confirmDialog({ title: 'پاک کردن فرم', message: 'فرم از ابتدا پر می‌شود. مطمئنی؟', confirmText: 'پاک کن' });
    if (!ok) return;
    resetDraft();
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
      span.innerHTML = `${esc(person.full_name)}<button type="button" data-remove-person="${esc(person.id)}">✕</button>`;
      frag.appendChild(span);
    }
  });
  
  picker.insertBefore(frag, searchInput);
}
