/**
 * autocomplete.js — جستجوی هوشمند غذا با keyboard navigation
 */

import { el, clear, escapeHtml } from '../utils/dom.js';
import { search, getRecent, pushRecent, computeNutrients, load } from '../services/foods.service.js';
import { toFaDigits, formatNumber } from '../utils/format.js';

/* =========================================================================
   createAutocomplete
   ========================================================================= */

export function createAutocomplete({
  input,
  onSelect,               // (food, quantity) => void
  placeholder = 'نام غذا را جستجو کنید…',
  minChars = 0,
  maxResults = 20,
  onQuantityChange = null,
} = {}) {
  input.setAttribute('placeholder', placeholder);
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');

  const wrapper = el('div', { class: 'autocomplete' });
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  const panel = el('div', {
    class: 'autocomplete__panel hidden',
    role: 'listbox',
  });
  wrapper.appendChild(panel);

  let results = [];
  let highlighted = -1;
  let open = false;

  /* ---------- Input ---------- */
  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (q.length < minChars) { close(); return; }
    results = search(q, maxResults);
    highlighted = -1;
    render(results, q);
    show();
  });

  input.addEventListener('focus', () => {
    if (input.value.trim().length >= minChars) {
      results = search(input.value.trim(), maxResults);
      if (results.length) { render(results, input.value.trim()); show(); }
    } else {
      // نمایش غذاهای اخیر
      const recent = getRecent();
      if (recent.length) { renderRecent(recent); show(); }
    }
  });

  input.addEventListener('keydown', (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' && input.value.trim().length >= minChars) {
        results = search(input.value.trim(), maxResults);
        render(results, input.value.trim());
        show();
        e.preventDefault();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        highlighted = (highlighted + 1) % results.length;
        applyHighlight();
        break;
      case 'ArrowUp':
        e.preventDefault();
        highlighted = (highlighted - 1 + results.length) % results.length;
        applyHighlight();
        break;
      case 'Enter':
        e.preventDefault();
        if (highlighted >= 0 && results[highlighted]) selectFood(results[highlighted]);
        else if (results[0]) selectFood(results[0]);
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
    }
  });

  input.addEventListener('blur', () => {
    // بستن با تأخیر برای اجازه کلیک
    setTimeout(() => { if (!panel.contains(document.activeElement)) close(); }, 160);
  });

  /* ---------- Render ---------- */

  function render(list, query) {
    clear(panel);
    if (!list.length) {
      panel.appendChild(el('div', { class: 'autocomplete__empty' }, [
        `نتیجه‌ای برای «${query || ''}» یافت نشد.`,
      ]));
      panel.appendChild(buildHint());
      return;
    }

    panel.appendChild(el('div', { class: 'autocomplete__section' }, ['نتایج']));

    list.forEach((food, idx) => {
      const row = el('div', {
        class: 'autocomplete__option',
        role: 'option',
        'data-idx': idx,
      });
      row.appendChild(el('div', { class: 'autocomplete__icon' }, [emojiFor(food)]));

      const body = el('div', { class: 'autocomplete__body' });
      const nameHtml = highlight(food.name, query);
      body.appendChild(el('div', { class: 'autocomplete__name', html: nameHtml }));
      const sub = el('div', { class: 'autocomplete__sub' });
      if (food.nameEn && food.nameEn !== food.name) {
        sub.appendChild(el('span', {}, [food.nameEn]));
      }
      if (food.protein || food.carbs || food.fat) {
        sub.appendChild(el('span', {}, [
          `پ ${toFaDigits(Math.round(food.protein))} · ک ${toFaDigits(Math.round(food.carbs))} · چ ${toFaDigits(Math.round(food.fat))}`,
        ]));
      }
      if (sub.children.length) body.appendChild(sub);
      row.appendChild(body);

      row.appendChild(el('div', { class: 'autocomplete__kcal' }, [
        `${formatNumber(food.calories)} kcal`,
      ]));

      row.addEventListener('mousedown', (e) => { e.preventDefault(); });
      row.addEventListener('click', () => selectFood(food));
      row.addEventListener('mouseenter', () => {
        highlighted = idx;
        applyHighlight();
      });
      panel.appendChild(row);
    });

    panel.appendChild(buildHint());
  }

  function renderRecent(list) {
    clear(panel);
    panel.appendChild(el('div', { class: 'autocomplete__section' }, ['اخیراً استفاده‌شده']));
    list.forEach((f) => {
      const food = { name: f.name, nameEn: f.nameEn, calories: f.calories };
      const row = el('div', { class: 'autocomplete__option' });
      row.appendChild(el('div', { class: 'autocomplete__icon' }, ['⏱']));
      const body = el('div', { class: 'autocomplete__body' });
      body.appendChild(el('div', { class: 'autocomplete__name' }, [food.name]));
      row.appendChild(body);
      row.appendChild(el('div', { class: 'autocomplete__kcal' }, [
        `${formatNumber(food.calories)} kcal`,
      ]));
      row.addEventListener('mousedown', (e) => e.preventDefault());
      row.addEventListener('click', () => selectFood(food));
      panel.appendChild(row);
    });
  }

  function buildHint() {
    return el('div', { class: 'autocomplete__hint' }, [
      el('span', {}, ['↑↓ حرکت']),
      el('span', {}, [el('kbd', {}, ['Enter']), ' انتخاب']),
      el('span', {}, [el('kbd', {}, ['Esc']), ' بستن']),
    ]);
  }

  function applyHighlight() {
    const items = panel.querySelectorAll('.autocomplete__option');
    items.forEach((n, i) => n.classList.toggle('is-highlighted', i === highlighted));
    if (highlighted >= 0 && items[highlighted]) {
      items[highlighted].scrollIntoView({ block: 'nearest' });
    }
  }

  /* ---------- Selection ---------- */

  function selectFood(food) {
    input.value = food.name;
    close();
    pushRecent(food);
    onSelect?.(food, 1);
  }

  /* ---------- Show / Close ---------- */

  function show() {
    open = true;
    panel.classList.remove('hidden');
    input.setAttribute('aria-expanded', 'true');
  }

  function close() {
    open = false;
    panel.classList.add('hidden');
    input.setAttribute('aria-expanded', 'false');
    highlighted = -1;
  }

  /* ---------- API ---------- */

  return {
    el: wrapper,
    input,
    close,
    focus: () => input.focus(),
    setValue: (v) => { input.value = v; },
    getValue: () => input.value,
    destroy() {
      panel.remove();
    },
  };
}

/* ---------- Highlight ---------- */

function highlight(text, query) {
  const t = String(text || '');
  const q = String(query || '').trim();
  if (!q) return escapeHtml(t);
  const safe = escapeHtml(t);
  const idx = t.indexOf(q);
  if (idx < 0) return safe;
  const before = escapeHtml(t.slice(0, idx));
  const match = escapeHtml(t.slice(idx, idx + q.length));
  const after = escapeHtml(t.slice(idx + q.length));
  return `${before}<span class="autocomplete__mark">${match}</span>${after}`;
}

/* ---------- Emoji guess (سرگرمی) ---------- */

const EMOJI_HINTS = [
  [/نان|سنگک|بربری|لواش|تافتون/, '🥖'],
  [/برنج|چلو|پلو/, '🍚'],
  [/مرغ|جوجه/, '🍗'],
  [/گوشت|گوساله|گوسفند|استیک|کباب/, '🥩'],
  [/ماهی|قزل|سالمون|تن/, '🐟'],
  [/تخم/, '🥚'],
  [/شیر(?!ینی)|ماست|پنیر|دوغ/, '🥛'],
  [/سیب(?!\s?زمینی)/, '🍎'],
  [/موز/, '🍌'],
  [/پرتقال|نارنگی/, '🍊'],
  [/هندوانه/, '🍉'],
  [/انگور/, '🍇'],
  [/توت/, '🍓'],
  [/خیار/, '🥒'],
  [/گوجه/, '🍅'],
  [/هویج/, '🥕'],
  [/سیب\s?زمینی/, '🥔'],
  [/کلم|کاهو|اسفناج/, '🥬'],
  [/روغن|کره|مارگارین/, '🧈'],
  [/قهوه|اسپرسو/, '☕'],
  [/چای/, '🍵'],
  [/آب/, '💧'],
  [/آبمیوه|آب\s?/, '🧃'],
  [/شکلات|کاکائو/, '🍫'],
  [/بستنی/, '🍨'],
  [/کیک|شیرینی/, '🍰'],
  [/پیتزا/, '🍕'],
  [/ساندویچ|برگر/, '🍔'],
  [/ماکارونی|پاستا|اسپاگتی/, '🍝'],
  [/سوپ/, '🥣'],
  [/سالاد/, '🥗'],
  [/عدس|لوبیا|نخود/, '🫘'],
  [/آجیل|بادام|گردو|پسته|فندق/, '🥜'],
];

function emojiFor(food) {
  const name = food.name || '';
  for (const [re, emoji] of EMOJI_HINTS) if (re.test(name)) return emoji;
  return '🍽';
}

/* ---------- مقدار اولیه ---------- */

load().catch(() => {});