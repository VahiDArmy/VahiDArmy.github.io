import { state } from '../state.js';
import { navigate } from '../router.js';
import { CATEGORIES, getCategory, getKarma, KARMA_LEVELS } from '../config.js';
import {
  esc, faDigits, fmtCompactMoney, fmtDuration, fmtNum,
  todayISO, addDaysISO, formatPersianDate, isoToUTCDate,
  persianParts, persianToUTCDate, utcDateToISO,
  sumBy, groupBy, uniqueBy, PERSIAN_MONTHS, persianMonthLength,
} from '../utils.js';
import { emptyState } from '../ui.js';

let period = 'month'; // week | month | year | all

export function render(container) {
  const entries = Array.isArray(state.entries) ? state.entries : [];
  if (!entries.length) {
    container.innerHTML = `
      <div class="page-head">
        <div>
          <div class="page-title">تحلیل شادی</div>
          <div class="page-subtitle">الگوها و آمار شادی‌های تو</div>
        </div>
      </div>
      <div class="card">${emptyState({ emoji: '📊', title: 'هنوز داده‌ای برای تحلیل نیست', desc: 'با ثبت چند شادی، این صفحه پر از بینش می‌شود.', actionLabel: 'ثبت شادی', actionView: 'add' })}</div>
    `;
    container.querySelectorAll('[data-goto]').forEach((el) => el.addEventListener('click', () => navigate(el.dataset.goto)));
    return;
  }

  const { start, end } = getRange(period);
  const list = entries.filter((e) => e.entry_date >= start && e.entry_date <= end);

  const totalMoney = sumBy(list, (e) => e.money_spent);
  const totalTime = sumBy(list, (e) => e.time_spent_minutes);
  const avgJoy = list.length ? sumBy(list, (e) => e.joy_score) / list.length : 0;
  const freeCount = list.filter((e) => Number(e.money_spent) === 0).length;
  
  const catStats = summarizeByCategory(list);
  const byDay = summarizeByDay(list, start, end);
  const tagStats = summarizeTags(list);
  const topExpensive = [...list].sort((a, b) => Number(b.money_spent) - Number(a.money_spent)).slice(0, 5);
  const joyVsMoney = computeJoyVsMoney(list);

  // Overall Karma Stats
  let totalKarma = 0;
  const karmaCounts = { positive: 0, neutral: 0, negative: 0 };
  list.forEach(e => {
    const k = Number(e.karma_score) || 0;
    totalKarma += k;
    if (k > 0) karmaCounts.positive++;
    else if (k < 0) karmaCounts.negative++;
    else karmaCounts.neutral++;
  });
  const avgKarma = list.length ? totalKarma / list.length : 0;
  const avgKarmaInfo = getKarma(Math.round(avgKarma));

  // Monthly Karma Calculation (for the current Persian Month)
  const todayParts = persianParts(new Date());
  const monthLen = persianMonthLength(todayParts.y, todayParts.m);
  const monthEntries = entries.filter(e => {
    const p = persianParts(isoToUTCDate(e.entry_date));
    return p.y === todayParts.y && p.m === todayParts.m;
  });
  
  const dailyKarmaMap = {};
  monthEntries.forEach(e => {
    dailyKarmaMap[e.entry_date] = (dailyKarmaMap[e.entry_date] || 0) + (Number(e.karma_score) || 0);
  });
  
  let monthlyKarmaTotal = 0;
  let bestDay = { date: null, score: -Infinity };
  let worstDay = { date: null, score: Infinity };
  
  for(let i=1; i<=monthLen; i++){
    const iso = utcDateToISO(persianToUTCDate(todayParts.y, todayParts.m, i));
    const dayScore = dailyKarmaMap[iso] || 0;
    if (dailyKarmaMap[iso] !== undefined) {
      monthlyKarmaTotal += dayScore;
      if (dayScore > bestDay.score) bestDay = { date: iso, score: dayScore };
      if (dayScore < worstDay.score) worstDay = { date: iso, score: dayScore };
    }
  }
  const monthAvgKarma = monthEntries.length ? monthlyKarmaTotal / monthEntries.length : 0;

  container.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title">تحلیل شادی</div>
        <div class="page-subtitle">${faDigits(list.length)} شادی در بازهٔ انتخابی</div>
      </div>
      <div class="segmented" id="period-seg">
        <button type="button" data-period="week" class="${period === 'week' ? 'active' : ''}">هفتگی</button>
        <button type="button" data-period="month" class="${period === 'month' ? 'active' : ''}">ماهانه</button>
        <button type="button" data-period="year" class="${period === 'year' ? 'active' : ''}">سالانه</button>
        <button type="button" data-period="all" class="${period === 'all' ? 'active' : ''}">همه</button>
      </div>
    </div>

    <div class="dash-stats stagger">
      <div class="stat">
        <div class="stat-head"><div class="stat-label">شادی‌ها</div><div class="stat-icon">✨</div></div>
        <div class="stat-value">${faDigits(list.length)}</div>
      </div>
      <div class="stat">
        <div class="stat-head"><div class="stat-label">میانگین شادی</div><div class="stat-icon">💛</div></div>
        <div class="stat-value">${faDigits(avgJoy.toFixed(1))}<span class="stat-unit">/ ${faDigits(10)}</span></div>
      </div>
      <div class="stat">
        <div class="stat-head"><div class="stat-label">هزینه</div><div class="stat-icon">💰</div></div>
        <div class="stat-value">${esc(fmtCompactMoney(totalMoney))}</div>
        <div class="stat-trend text-secondary">${freeCount > 0 ? `${faDigits(freeCount)} شادی رایگان` : ''}</div>
      </div>
      <div class="stat" style="border-color:${avgKarmaInfo.color}">
        <div class="stat-head"><div class="stat-label">میانگین کارما</div><div class="stat-icon">${avgKarmaInfo.icon}</div></div>
        <div class="stat-value" style="color:${avgKarmaInfo.color}">${faDigits(avgKarma.toFixed(1))}<span class="stat-unit">از ۵</span></div>
        <div class="stat-trend text-secondary">${avgKarmaInfo.label}</div>
      </div>
    </div>

    <!-- Monthly Karma Report -->
    <div class="card anim-fade-up" style="margin-bottom:1rem">
      <div class="card-header">
        <div>
          <div class="card-title">📅 گزارش ماهانه کارما (${esc(PERSIAN_MONTHS[todayParts.m - 1])} ${faDigits(todayParts.y)})</div>
          <div class="card-subtitle">مجموع کارما: ${faDigits(monthlyKarmaTotal)} | میانگین: ${faDigits(monthAvgKarma.toFixed(1))}</div>
        </div>
      </div>
      
      <div class="monthly-karma-grid">
        ${Array.from({length: monthLen}).map((_, i) => {
          const iso = utcDateToISO(persianToUTCDate(todayParts.y, todayParts.m, i+1));
          const score = dailyKarmaMap[iso] || 0;
          return `<div class="karma-day" data-karma="${score}" title="${formatPersianDate(iso)} - کارما: ${faDigits(score)}">${faDigits(i+1)}</div>`;
        }).join('')}
      </div>

      <div class="grid grid-2" style="margin-top:1rem;gap:.5rem">
        ${bestDay.date ? `
          <div class="achievement" style="margin:0">
            <div class="achievement-icon" style="color:var(--emerald-500)">🌟</div>
            <div class="achievement-body">
              <div class="achievement-name">بهترین روز ماه</div>
              <div class="achievement-desc">${formatPersianDate(bestDay.date)} (کارما ${faDigits(bestDay.score)})</div>
            </div>
          </div>
        ` : ''}
        ${worstDay.date ? `
          <div class="achievement" style="margin:0">
            <div class="achievement-icon" style="color:var(--rose-500)">🌑</div>
            <div class="achievement-body">
              <div class="achievement-name">سخت‌ترین روز ماه</div>
              <div class="achievement-desc">${formatPersianDate(worstDay.date)} (کارما ${faDigits(worstDay.score)})</div>
            </div>
          </div>
        ` : ''}
      </div>
    </div>

    <div class="analytics-grid">
      <div class="card anim-fade-up">
        <div class="card-header">
          <div>
            <div class="card-title">شادی در طول زمان</div>
            <div class="card-subtitle">تعداد در هر روز</div>
          </div>
        </div>
        ${byDay.length ? lineChart(byDay) : emptyState({ emoji: '📈', title: 'داده‌ای برای نمودار نیست' })}
      </div>

      <div class="card anim-fade-up">
        <div class="card-header">
          <div>
            <div class="card-title">دسته‌بندی‌ها</div>
            <div class="card-subtitle">کدام شادی‌ها بیشتر؟</div>
          </div>
        </div>
        ${catStats.length ? donutChart(catStats) : emptyState({ emoji: '🍩', title: 'داده‌ای نیست' })}
      </div>

      <div class="card anim-fade-up">
        <div class="card-header">
          <div>
            <div class="card-title">توزیع کارما</div>
            <div class="card-subtitle">انرژی اعمال تو</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:1rem;padding-top:1rem">
          <div>
            <div style="display:flex;justify-content:space-between;font-size:.85rem;margin-bottom:.4rem">
              <span style="color:var(--emerald-600)">🌟 کارمای مثبت</span>
              <span style="font-weight:700">${faDigits(karmaCounts.positive)}</span>
            </div>
            <div class="progress"><div class="progress-fill" style="width:${(karmaCounts.positive/list.length)*100}%;background:var(--emerald-500)"></div></div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;font-size:.85rem;margin-bottom:.4rem">
              <span style="color:var(--text-muted)">⚖️ خنثی</span>
              <span style="font-weight:700">${faDigits(karmaCounts.neutral)}</span>
            </div>
            <div class="progress"><div class="progress-fill" style="width:${(karmaCounts.neutral/list.length)*100}%;background:var(--gray-400)"></div></div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;font-size:.85rem;margin-bottom:.4rem">
              <span style="color:var(--red-500)">🌑 کارمای منفی</span>
              <span style="font-weight:700">${faDigits(karmaCounts.negative)}</span>
            </div>
            <div class="progress"><div class="progress-fill" style="width:${(karmaCounts.negative/list.length)*100}%;background:var(--red-500)"></div></div>
          </div>
        </div>
      </div>

      <div class="card anim-fade-up">
        <div class="card-header">
          <div>
            <div class="card-title">هزینه بر اساس دسته</div>
            <div class="card-subtitle">کجا بیشتر خرج کردی؟</div>
          </div>
        </div>
        ${catStats.some((c) => c.money > 0) ? barChart(catStats, 'money') : emptyState({ emoji: '💸', title: 'هزینه‌ای ثبت نشده' })}
      </div>
    </div>

    <div class="grid grid-2" style="margin-top:1rem">
      <div class="card anim-fade-up">
        <div class="card-header"><div class="card-title">🏷️ پرتکرارترین برچسب‌ها</div></div>
        ${tagStats.length
          ? `<div class="tag-cloud">${tagStats.map((t) => `<span class="tag-item">#${esc(t.tag)} <span class="text-muted">${faDigits(t.count)}</span></span>`).join('')}</div>`
          : emptyState({ emoji: '🏷️', title: 'برچسبی ثبت نکردی' })}
      </div>
      <div class="card anim-fade-up">
        <div class="card-header"><div class="card-title">💸 گران‌ترین شادی‌ها</div></div>
        ${topExpensive.filter((e) => Number(e.money_spent) > 0).length
          ? topExpensive.filter((e) => Number(e.money_spent) > 0).map((e) => `
              <div class="detail-row">
                <span class="detail-label">${esc(e.emoji || '✨')} ${esc(e.title)}</span>
                <span class="detail-value">${esc(fmtCompactMoney(e.money_spent))}</span>
              </div>
            `).join('')
          : emptyState({ emoji: '💸', title: 'هزینه‌ای ثبت نشده' })}
      </div>
    </div>

    <div class="card anim-fade-up" style="margin-top:1rem">
      <div class="card-header">
        <div>
          <div class="card-title">🌟 بینش‌ها</div>
          <div class="card-subtitle">الگوهای شخصی تو</div>
        </div>
      </div>
      <div class="stagger">
        ${joyVsMoney.map((insight) => `
          <div class="achievement">
            <div class="achievement-icon">${esc(insight.icon)}</div>
            <div class="achievement-body">
              <div class="achievement-name">${esc(insight.title)}</div>
              <div class="achievement-desc">${esc(insight.desc)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  container.querySelectorAll('#period-seg [data-period]').forEach((btn) => {
    btn.addEventListener('click', () => {
      period = btn.dataset.period;
      render(container);
    });
  });
  container.querySelectorAll('[data-goto]').forEach((el) => el.addEventListener('click', () => navigate(el.dataset.goto)));
}

function getRange(p) {
  const today = todayISO();
  if (p === 'week') return { start: addDaysISO(today, -7), end: today };
  if (p === 'month') return { start: addDaysISO(today, -30), end: today };
  if (p === 'year') return { start: addDaysISO(today, -365), end: today };
  return { start: '1900-01-01', end: today };
}

function summarizeByCategory(list) {
  const grouped = groupBy(list, (e) => e.category || 'other');
  return Object.entries(grouped).map(([id, arr]) => {
    const cat = getCategory(id);
    return {
      id,
      label: cat.label,
      emoji: cat.emoji,
      color: cat.color,
      count: arr.length,
      money: sumBy(arr, (e) => e.money_spent),
      time: sumBy(arr, (e) => e.time_spent_minutes),
      avgJoy: sumBy(arr, (e) => e.joy_score) / arr.length,
    };
  }).sort((a, b) => b.count - a.count);
}

function summarizeByDay(list, start, end) {
  const map = {};
  list.forEach((e) => { map[e.entry_date] = (map[e.entry_date] || 0) + 1; });
  const result = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 400) {
    result.push({ date: cursor, count: map[cursor] || 0 });
    cursor = addDaysISO(cursor, 1);
    guard += 1;
  }
  return result;
}

function summarizeTags(list) {
  const map = {};
  list.forEach((e) => {
    if (!Array.isArray(e.tags)) return;
    e.tags.forEach((t) => { map[t] = (map[t] || 0) + 1; });
  });
  return Object.entries(map).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count).slice(0, 20);
}

function lineChart(data) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const W = 600, H = 180, PAD = 14;
  const stepX = (W - PAD * 2) / Math.max(1, data.length - 1);
  const points = data.map((d, i) => {
    const x = PAD + i * stepX;
    const y = H - PAD - (d.count / max) * (H - PAD * 2);
    return { x, y, ...d };
  });
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${path} L${points[points.length - 1].x.toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`;

  return `
    <div class="chart-wrap">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:180px;overflow:visible">
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(245,158,11,.35)"/>
            <stop offset="100%" stop-color="rgba(245,158,11,0)"/>
          </linearGradient>
        </defs>
        <path d="${area}" fill="url(#lineGrad)"/>
        <path d="${path}" fill="none" stroke="var(--amber-500)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        ${points.filter((p) => p.count > 0).map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="var(--amber-500)"/>`).join('')}
      </svg>
      <div class="chart-legend">
        <span class="legend-item"><span class="legend-dot" style="background:var(--amber-500)"></span>تعداد شادی روزانه</span>
      </div>
    </div>
  `;
}

function donutChart(stats) {
  const total = stats.reduce((acc, s) => acc + s.count, 0);
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const segs = stats.map((s) => {
    const fraction = s.count / total;
    const dash = fraction * circumference;
    const seg = `<circle cx="100" cy="100" r="${radius}" fill="none" stroke="${s.color}" stroke-width="26"
      stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}"
      stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 100 100)"/>`;
    offset += dash;
    return seg;
  }).join('');

  return `
    <div style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap;justify-content:center">
      <svg viewBox="0 0 200 200" style="width:170px;height:170px;flex-shrink:0">
        <circle cx="100" cy="100" r="${radius}" fill="none" stroke="var(--bg-muted)" stroke-width="26"/>
        ${segs}
        <text x="100" y="96" text-anchor="middle" font-size="22" font-weight="800" fill="var(--text)">${faDigits(total)}</text>
        <text x="100" y="118" text-anchor="middle" font-size="11" fill="var(--text-muted)">شادی</text>
      </svg>
      <div class="chart-legend" style="flex-direction:column;gap:.4rem;margin:0">
        ${stats.slice(0, 8).map((s) => `
          <span class="legend-item">
            <span class="legend-dot" style="background:${s.color}"></span>
            ${esc(s.emoji)} ${esc(s.label)} <span class="text-muted">(${faDigits(s.count)})</span>
          </span>
        `).join('')}
      </div>
    </div>
  `;
}

function barChart(stats, key) {
  const max = Math.max(1, ...stats.map((s) => s[key]));
  return `
    <div style="display:flex;flex-direction:column;gap:.6rem">
      ${stats.slice(0, 8).map((s) => `
        <div>
          <div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:.25rem">
            <span>${esc(s.emoji)} ${esc(s.label)}</span>
            <span style="font-weight:700">${esc(fmtCompactMoney(s.money))}</span>
          </div>
          <div class="progress">
            <div class="progress-fill" style="width:${((s.money / max) * 100).toFixed(1)}%;background:${s.color}"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function computeJoyVsMoney(list) {
  const insights = [];
  const withMoney = list.filter((e) => Number(e.money_spent) > 0);
  const free = list.filter((e) => Number(e.money_spent) === 0);
  if (withMoney.length && free.length) {
    const avgMoneyJoy = sumBy(withMoney, (e) => e.joy_score) / withMoney.length;
    const avgFreeJoy = sumBy(free, (e) => e.joy_score) / free.length;
    if (avgFreeJoy > avgMoneyJoy + 0.3) {
      insights.push({ icon: '💡', title: 'شادی‌های رایگان شادترند', desc: `میانگین شادی شادی‌های رایگان (${faDigits(avgFreeJoy.toFixed(1))}) بیشتر از شادی‌های هزینه‌دار (${faDigits(avgMoneyJoy.toFixed(1))}) است.` });
    } else if (avgMoneyJoy > avgFreeJoy + 0.3) {
      insights.push({ icon: '💎', title: 'هزینه کردن حالت را بهتر می‌کند', desc: `شادی‌هایی که برایشان هزینه کردی، به‌طور میانگین شادتر بوده‌اند.` });
    }
  }
  const catCount = summarizeByCategory(list);
  if (catCount[0]) {
    insights.push({ icon: catCount[0].emoji, title: `بیشترین شادی از «${catCount[0].label}»`, desc: `${faDigits(catCount[0].count)} شادی در این دسته ثبت کردی.` });
  }
  const totalTime = sumBy(list, (e) => e.time_spent_minutes);
  if (totalTime > 0) {
    insights.push({ icon: '⏳', title: 'سرمایه‌گذاری زمانی', desc: `${esc(fmtDuration(totalTime))} برای خودت وقت گذاشتی.` });
  }
  const best = [...list].sort((a, b) => Number(b.joy_score) - Number(a.joy_score))[0];
  if (best) {
    insights.push({ icon: '🌟', title: 'شادترین لحظه', desc: `«${best.title}» با امتیاز ${faDigits(best.joy_score)}/${faDigits(10)}.` });
  }
  
  const posKarma = list.filter(e => e.karma_score > 0).length;
  if (posKarma > 0) {
    insights.push({ icon: '✨', title: 'کارمای مثبت', desc: `${faDigits(posKarma)} شادی با انرژی مثبت و آگاهانه ثبت کردی.` });
  }
  const negKarma = list.filter(e => e.karma_score < 0).length;
  if (negKarma > 0) {
    insights.push({ icon: '🌑', title: 'درس‌های کارما', desc: `${faDigits(negKarma)} شادی با کارمای منفی داشتی. سعی کن جبران کنی.` });
  }

  if (!insights.length) insights.push({ icon: '🌱', title: 'در حال شکل‌گیری', desc: 'با ثبت شادی‌های بیشتر، بینش‌های دقیق‌تری اینجا ظاهر می‌شود.' });
  return insights;
}
