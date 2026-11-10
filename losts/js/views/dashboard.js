import { state } from '../state.js';
import { navigate } from '../router.js';
import { getCategory, getKarma } from '../config.js';
import {
  esc, faDigits, fmtCompactMoney, fmtDurationShort, fmtDuration, fmtNum,
  greetingForHour, pickPrompt, todayISO, addDaysISO, formatPersianDate,
  formatPersianWeekday, formatClock, sumBy, relativeTime,
} from '../utils.js';
import { emptyState } from '../ui.js';
import { openEntryDetail } from '../components/entry_modal.js';

export function render(container) {
  const entries = Array.isArray(state.entries) ? state.entries : [];
  const karmaActions = Array.isArray(state.karma_actions) ? state.karma_actions : [];
  const settings = state.settings || {};
  const dailyGoal = Number(settings.daily_goal) || 1;
  const today = todayISO();
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysISO(today, -i));
  const weekSet = new Set(weekDays);
  const monthStart = addDaysISO(today, -30);

  const todayEntries = entries.filter((e) => e.entry_date === today);
  const weekEntries = entries.filter((e) => weekSet.has(e.entry_date));
  const monthEntries = entries.filter((e) => e.entry_date >= monthStart);

  const weekMoney = sumBy(weekEntries, (e) => e.money_spent);
  const weekTime = sumBy(weekEntries, (e) => e.time_spent_minutes);
  const monthMoney = sumBy(monthEntries, (e) => e.money_spent);
  const streak = computeStreak(entries);

  const greeting = greetingForHour();
  const displayName = state.displayName || 'دوست';
  const prompt = pickPrompt(new Date().getDate());

  const recent = entries.slice(0, 5);
  const achievements = computeAchievements(entries, weekEntries, monthEntries, streak);

  // Daily Karma Report (from Karma Actions)
  const todayKarmaActions = karmaActions.filter((a) => a.action_date === today);
  const todayKarmaSum = sumBy(todayKarmaActions, (a) => Number(a.karma_score) || 0);
  const todayKarmaAvg = todayKarmaActions.length ? todayKarmaSum / todayKarmaActions.length : 0;
  const dailyKarmaInfo = getKarma(Math.round(todayKarmaAvg));
  const dailyKarmaPct = Math.max(0, Math.min(100, ((todayKarmaAvg + 5) / 10) * 100));

  let reportMsg = 'امروز هنوز کارمایی ثبت نکردی.';
  if (todayKarmaActions.length > 0) {
    if (todayKarmaAvg > 2) reportMsg = 'امروز روز فوق‌العاده روشنی داشتی. انرژی مثبتت بهت برمی‌گرده! 🌟';
    else if (todayKarmaAvg > 0) reportMsg = 'امروز عملکرد خوبی داشتی. تعادلت رو حفظ کردی. 🌿';
    else if (todayKarmaAvg === 0) reportMsg = 'امروز یک روز خنثی بود. فردا می‌تونی بهتر باشی. ⚖️';
    else if (todayKarmaAvg < -2) reportMsg = 'امروز خیلی تحت فشار بودی و کارما منفی ثبت کردی. فردا فرصت جبرانه. 🌑';
    else reportMsg = 'امروز کمی از مسیر مثبت دور شدی. سعی کن جبران کنی. 🌘';
  }

  container.innerHTML = `
    <div class="dash-hero anim-fade-up">
      <div class="dash-greeting">
        <div class="dash-hello">${esc(greeting)}، <span class="dash-hi">${esc(displayName)}</span> 🌻</div>
        <div class="dash-sub">${todayEntries.length > 0 ? 'امروز شادی‌ات را ثبت کردی. آفرین!' : 'امروز منتظر شنیدن شادی‌ات هستم.'}</div>
        <div class="dash-date">${esc(formatPersianWeekday(today))} · ${esc(formatPersianDate(today))}</div>
      </div>
      <div class="dash-hero-actions">
        <button type="button" class="btn btn-primary" data-goto="add">➕ ثبت شادی امروز</button>
        <button type="button" class="btn btn-outline" data-goto="journal">📖 دفتر شادی</button>
      </div>
    </div>

    <div class="dash-stats stagger">
      <div class="stat">
        <div class="stat-head">
          <div class="stat-label">شادی امروز</div>
          <div class="stat-icon">🌞</div>
        </div>
        <div class="stat-value">${faDigits(todayEntries.length)}<span class="stat-unit">/ ${faDigits(dailyGoal)}</span></div>
        <div class="stat-trend ${todayEntries.length >= dailyGoal ? 'trend-up' : ''}">${todayEntries.length >= dailyGoal ? '✨ هدف امروز محقق شد' : `${faDigits(Math.max(0, dailyGoal - todayEntries.length))} تا مانده`}</div>
      </div>
      <div class="stat">
        <div class="stat-head">
          <div class="stat-label">این هفته</div>
          <div class="stat-icon">📆</div>
        </div>
        <div class="stat-value">${faDigits(weekEntries.length)}<span class="stat-unit">شادی</span></div>
        <div class="stat-trend">${weekTime > 0 ? esc(fmtDurationShort(weekTime)) + ' برای خودت' : 'زمانی ثبت نشده'}</div>
      </div>
      <div class="stat">
        <div class="stat-head">
          <div class="stat-label">هزینه این ماه</div>
          <div class="stat-icon">💛</div>
        </div>
        <div class="stat-value">${esc(fmtCompactMoney(monthMoney))}<span class="stat-unit">${esc(settings.currency || 'تومان')}</span></div>
        <div class="stat-trend">${weekMoney > 0 ? `${esc(fmtCompactMoney(weekMoney))} در هفته` : 'هنوز هزینه‌ای ثبت نشده'}</div>
      </div>
      <div class="stat">
        <div class="stat-head">
          <div class="stat-label">رکورد پیوسته</div>
          <div class="stat-icon">🔥</div>
        </div>
        <div class="stat-value">${faDigits(streak)}<span class="stat-unit">روز</span></div>
        <div class="stat-trend ${streak >= 3 ? 'trend-up' : ''}">${streak >= 7 ? '🏆 عالی پیش می‌ری' : streak >= 3 ? '💪 ادامه بده' : 'از امروز شروع کن'}</div>
      </div>
    </div>

    <div class="dash-row">
      <div style="display:flex;flex-direction:column;gap:1rem">
        <!-- Daily Karma Report Card -->
        <div class="daily-report-card anim-fade-up" style="--report-color: ${dailyKarmaInfo.color}; --report-glow: ${dailyKarmaInfo.glow}">
          <div class="daily-report-header">
            <div>
              <div class="daily-report-title">📋 کارنامه کارمای امروز</div>
              <div style="font-size:.75rem;color:var(--text-muted);margin-top:.2rem">مجموع کارمای ثبت‌شده امروز: ${faDigits(todayKarmaSum)}</div>
            </div>
            <div class="daily-report-score" style="color:${dailyKarmaInfo.color}">${dailyKarmaInfo.icon} ${dailyKarmaInfo.label}</div>
          </div>
          <div class="daily-report-bar">
            <div class="daily-report-bar-fill" style="width:${dailyKarmaPct}%;background:${dailyKarmaInfo.color}"></div>
          </div>
          <div class="daily-report-msg">${reportMsg}</div>
        </div>

        <div class="card anim-fade-up">
          <div class="card-header">
            <div>
              <div class="card-title">آخرین شادی‌ها</div>
              <div class="card-subtitle">۵ شادی اخیر تو</div>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" data-goto="journal">همه →</button>
          </div>
          <div id="dash-recent">${recent.length ? recent.map((e) => recentItemHTML(e)).join('') : emptyState({ emoji: '🌱', title: 'هنوز شادی‌ای ثبت نکردی', desc: 'اولین شادی امروزت را ثبت کن تا اینجا پر شود.', actionLabel: 'ثبت شادی', actionView: 'add' })}</div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:1rem">
        <div class="prompt-card anim-fade-up">
          <div class="prompt-label">✨ سؤال امروز</div>
          <div class="prompt-text">${esc(prompt)}</div>
          <div class="prompt-actions">
            <button type="button" class="btn btn-sm" data-goto="add">جواب می‌دم</button>
            <button type="button" class="btn btn-sm" data-goto="reflections">تأمل</button>
          </div>
        </div>

        <div class="card anim-fade-up">
          <div class="card-header">
            <div class="card-title">🏅 دستاوردها</div>
            <div class="card-subtitle">${faDigits(achievements.filter((a) => a.unlocked).length)} / ${faDigits(achievements.length)}</div>
          </div>
          <div>
            ${achievements.map((a) => `
              <div class="achievement ${a.unlocked ? '' : 'locked'}">
                <div class="achievement-icon">${esc(a.icon)}</div>
                <div class="achievement-body">
                  <div class="achievement-name">${esc(a.name)}</div>
                  <div class="achievement-desc">${esc(a.desc)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('[data-entry-id]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.entryId;
      const entry = entries.find((e) => e.id === id);
      if (entry) openEntryDetail(entry);
    });
  });

  container.querySelectorAll('[data-goto]').forEach((el) => {
    el.addEventListener('click', () => navigate(el.dataset.goto));
  });
}

function recentItemHTML(entry) {
  const cat = getCategory(entry.category);
  return `
    <div class="entry-mini" data-entry-id="${esc(entry.id)}" role="button" tabindex="0">
      <div class="entry-mini-icon">${esc(entry.emoji || cat.emoji)}</div>
      <div class="entry-mini-body">
        <div class="entry-mini-title">${esc(entry.title)}</div>
        <div class="entry-mini-meta">
          <span>${esc(cat.label)}</span>
          <span>·</span>
          <span>${esc(formatPersianDate(entry.entry_date, { month: 'long', day: 'numeric' }))}</span>
          ${entry.money_spent > 0 ? `<span>·</span><span>${esc(fmtCompactMoney(entry.money_spent))}</span>` : ''}
        </div>
      </div>
      <div class="entry-mini-time">${entry.entry_time ? esc(formatClock(entry.entry_time)) : ''}</div>
    </div>
  `;
}

function computeStreak(entries) {
  if (!entries.length) return 0;
  const dates = new Set(entries.map((e) => e.entry_date));
  const today = todayISO();
  let cursor = dates.has(today) ? today : addDaysISO(today, -1);
  let streak = 0;
  let guard = 0;
  while (dates.has(cursor) && guard < 3650) {
    streak += 1;
    cursor = addDaysISO(cursor, -1);
    guard += 1;
  }
  return streak;
}

function computeAchievements(entries, weekEntries, monthEntries, streak) {
  const total = entries.length;
  const favorites = entries.filter((e) => e.is_favorite).length;
  const totalMoney = sumBy(entries, (e) => e.money_spent);
  const totalTime = sumBy(entries, (e) => e.time_spent_minutes);
  const weekCount = weekEntries.length;

  return [
    { icon: '🌱', name: 'اولین قدم', desc: 'اولین شادی را ثبت کن', unlocked: total >= 1 },
    { icon: '🔥', name: 'شعله ور', desc: '۷ روز پیوسته شادی ثبت کن', unlocked: streak >= 7 },
    { icon: '📚', name: 'شادی‌شناس', desc: '۱۰ شادی ثبت کن', unlocked: total >= 10 },
    { icon: '💎', name: 'الماس‌شناس', desc: '۵۰ شادی ثبت کن', unlocked: total >= 50 },
    { icon: '⭐', name: 'ستاره‌چین', desc: '۱۰ شادی را موردعلاقه کن', unlocked: favorites >= 10 },
    { icon: '💸', name: 'سرمایه‌گذار در خود', desc: 'بیش از ۱ میلیون برای خودت خرج کن', unlocked: totalMoney >= 1000000 },
    { icon: '⏰', name: 'وقت‌شناس', desc: 'بیش از ۶۰ ساعت برای خودت وقت بگذار', unlocked: totalTime >= 3600 },
    { icon: '🎯', name: 'منظم', desc: 'یک هفته پر از شادی بساز', unlocked: weekCount >= 7 },
  ];
}
