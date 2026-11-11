/* ============================================================
   THEORIES STUDIO — Shamsi (Jalali) calendar
   Uses jalaali-js when available, with a fallback converter.
   ============================================================ */

const J = (typeof window !== 'undefined' && window.jalaali) ? window.jalaali : null;

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
  1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178
];

const div = (a, b) => ~~(a / b);
const mod = (a, b) => a - ~~(a / b) * b;

function jalCal(jy) {
  const bl = BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jump = 0;
  if (jy < jp || jy >= BREAKS[bl - 1]) throw new Error('Invalid Jalali year');
  for (let i = 1; i < bl; i += 1) {
    const jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function j2d(jy, jm, jd) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let jd, jm, k;
  k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

function g2d(gy, gm, gd) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
    + div(153 * mod(gm + 9, 12) + 2, 5)
    + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

const fromJalaliFallback = (jy, jm, jd) => {
  const g = d2g(j2d(jy, jm, jd));
  return new Date(g.gy, g.gm - 1, g.gd);
};

const toJalaliFallback = (date) => {
  return d2j(g2d(date.getFullYear(), date.getMonth() + 1, date.getDate()));
};

/* ---------- Public API ---------- */

export const toJalali = (dateLike) => {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike || Date.now());
  if (Number.isNaN(date.getTime())) return null;
  if (J && typeof J.toJalaali === 'function') {
    try { return J.toJalaali(date); } catch { /* fallback */ }
  }
  return toJalaliFallback(date);
};

export const fromJalali = (jy, jm, jd) => {
  if (J && typeof J.toGregorian === 'function') {
    try {
      const g = J.toGregorian(jy, jm, jd);
      return new Date(g.gy, g.gm - 1, g.gd);
    } catch { /* fallback */ }
  }
  return fromJalaliFallback(jy, jm, jd);
};

export const isLeapJalali = (jy) => {
  if (J && typeof J.isLeapJalaaliYear === 'function') {
    try { return J.isLeapJalaaliYear(jy); } catch {}
  }
  return jalCal(jy).leap === 0;
};

export const jalaliMonthLength = (jy, jm) => {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalali(jy) ? 30 : 29;
};

export const FA_MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
export const FA_WEEKDAYS_SHORT = ['ش','ی','د','س','چ','پ','ج'];
export const FA_WEEKDAYS = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];

const FA_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
export const faDigits = (n) => String(n ?? '').replace(/\d/g, d => FA_DIGITS[+d]);
const pad2 = (n) => String(n).padStart(2, '0');

export const formatJalali = (dateLike, opts = {}) => {
  const { withWeekday = false, withYear = true, long = false, numeric = false } = opts;
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike || Date.now());
  const j = toJalali(date);
  if (!j) return '';
  const { jy, jm, jd } = j;
  const monthName = FA_MONTHS[(jm - 1 + 12) % 12];
  let out;
  if (numeric) {
    out = `${faDigits(jy)}/${faDigits(pad2(jm))}/${faDigits(pad2(jd))}`;
  } else if (long) {
    out = `${faDigits(jd)} ${monthName} ${faDigits(jy)}`;
  } else if (withYear) {
    out = `${faDigits(jd)} ${monthName} ${faDigits(jy)}`;
  } else {
    out = `${faDigits(jd)} ${monthName}`;
  }
  if (withWeekday) {
    const wdIdx = (date.getDay() + 1) % 7; // Saturday-first
    out = `${FA_WEEKDAYS[wdIdx]}، ${out}`;
  }
  return out;
};

export const formatJalaliTime = (dateLike) => {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike || Date.now());
  if (Number.isNaN(d.getTime())) return '';
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${faDigits(hh)}:${faDigits(mm)}`;
};

export const formatJalaliFull = (dateLike) => {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike || Date.now());
  if (Number.isNaN(d.getTime())) return '';
  return `${formatJalali(d, { withWeekday: true, long: true })} • ${formatJalaliTime(d)}`;
};

export const relativeJalali = (dateLike) => {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike || Date.now());
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const day = 24 * 3600 * 1000;
  if (diff < 60 * 1000) return 'همین حالا';
  if (diff < 60 * 60 * 1000) return `${faDigits(Math.round(diff / 60000))} دقیقه پیش`;
  if (diff < day) return `${faDigits(Math.round(diff / 3600000))} ساعت پیش`;
  if (diff < 7 * day) return `${faDigits(Math.round(diff / day))} روز پیش`;
  return formatJalali(d);
};

export const monthGrid = (jy, jm) => {
  const len = jalaliMonthLength(jy, jm);
  const first = fromJalali(jy, jm, 1);
  // Persian week starts Saturday
  const offset = (first.getDay() + 1) % 7;
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= len; d++) cells.push({ jy, jm, jd: d });
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

export const todayJalali = () => toJalali(new Date());

export const parseJalaliInput = (value) => {
  if (!value) return null;
  const norm = String(value).replace(/[۰-۹]/g, d => String(FA_DIGITS.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const m = norm.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (!m) return null;
  const jy = +m[1], jm = +m[2], jd = +m[3];
  if (jm < 1 || jm > 12) return null;
  if (jd < 1 || jd > jalaliMonthLength(jy, jm)) return null;
  return { jy, jm, jd };
};

export const jalaliToInputValue = (jy, jm, jd) =>
  `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;

export const jalaliToDate = (jy, jm, jd) => fromJalali(jy, jm, jd);

/* ---------- Shamsi picker calendar widget ---------- */
export function createShamsiCalendar({ initial, onSelect, minYear, maxYear } = {}) {
  const init = initial || todayJalali();
  let year = init.jy;
  let month = init.jm;
  const yMin = minYear ?? year - 100;
  const yMax = maxYear ?? year + 20;

  const root = document.createElement('div');
  root.className = 'shamsi-cal';
  root.style.cssText = 'background:var(--bg-elev);border:1px solid var(--line);border-radius:var(--r-lg);padding:12px;box-shadow:var(--shadow-lg);width:300px;';

  const head = document.createElement('div');
  head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:6px;';

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'icon-btn icon-btn--sm';
  prevBtn.innerHTML = '<i class="ri-arrow-right-s-line"></i>';
  prevBtn.setAttribute('aria-label', 'ماه قبل');

  const title = document.createElement('div');
  title.style.cssText = 'font-weight:var(--fw-bold);font-size:var(--fs-md);color:var(--ink);';

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'icon-btn icon-btn--sm';
  nextBtn.innerHTML = '<i class="ri-arrow-left-s-line"></i>';
  nextBtn.setAttribute('aria-label', 'ماه بعد');

  head.append(prevBtn, title, nextBtn);

  const weekdays = document.createElement('div');
  weekdays.style.cssText = 'display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:6px;';
  FA_WEEKDAYS_SHORT.forEach(w => {
    const c = document.createElement('div');
    c.textContent = w;
    c.style.cssText = 'text-align:center;font-size:var(--fs-2xs);color:var(--ink-faint);padding:4px 0;font-weight:var(--fw-semibold);';
    weekdays.appendChild(c);
  });

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(7,1fr);gap:2px;';

  const today = todayJalali();

  const render = () => {
    title.textContent = `${FA_MONTHS[month - 1]} ${faDigits(year)}`;
    grid.innerHTML = '';
    const cells = monthGrid(year, month);
    cells.forEach(cell => {
      if (!cell) {
        const empty = document.createElement('div');
        empty.style.cssText = 'aspect-ratio:1;';
        grid.appendChild(empty);
        return;
      }
      const isToday = today && today.jy === cell.jy && today.jm === cell.jm && today.jd === cell.jd;
      const isSelected = init.jy === cell.jy && init.jm === cell.jm && init.jd === cell.jd;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = faDigits(cell.jd);
      btn.style.cssText = `
        aspect-ratio:1;border-radius:8px;font-size:var(--fs-sm);font-family:inherit;
        color:${isSelected ? '#fff' : isToday ? 'var(--accent-1)' : 'var(--ink-soft)'};
        background:${isSelected ? 'var(--accent-grad)' : isToday ? 'var(--accent-grad-soft)' : 'transparent'};
        border:${isToday && !isSelected ? '1px solid var(--accent-2)' : '1px solid transparent'};
        cursor:pointer;font-weight:${isSelected || isToday ? '700' : '500'};
        transition:background .15s;
      `;
      btn.addEventListener('mouseenter', () => { if (!isSelected) btn.style.background = 'var(--bg-soft)'; });
      btn.addEventListener('mouseleave', () => { if (!isSelected) btn.style.background = isToday ? 'var(--accent-grad-soft)' : 'transparent'; });
      btn.addEventListener('click', () => {
        if (typeof onSelect === 'function') onSelect({ ...cell });
      });
      grid.appendChild(btn);
    });
  };

  prevBtn.addEventListener('click', () => {
    month -= 1;
    if (month < 1) { month = 12; year -= 1; }
    if (year < yMin) { year = yMin; month = 1; }
    render();
  });
  nextBtn.addEventListener('click', () => {
    month += 1;
    if (month > 12) { month = 1; year += 1; }
    if (year > yMax) { year = yMax; month = 12; }
    render();
  });

  root.append(head, weekdays, grid);
  render();
  return root;
}
