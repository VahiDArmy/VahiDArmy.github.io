import { state } from '../state.js';
import { navigate } from '../router.js';
import { getKarma, KARMA_LEVELS } from '../config.js';
import {
  esc, faDigits, todayISO, formatPersianDate, isoToUTCDate,
  persianParts, persianToUTCDate, utcDateToISO,
  PERSIAN_MONTHS, persianMonthLength
} from '../utils.js';
import { emptyState, confirmDialog, toast } from '../ui.js';
import { deleteKarmaAction } from '../db.js';

export function render(container) {
  const actions = Array.isArray(state.karma_actions) ? state.karma_actions : [];

  // Calculate Overall Karma
  let totalKarma = 0;
  const karmaCounts = { positive: 0, neutral: 0, negative: 0 };
  actions.forEach(a => {
    const k = Number(a.karma_score) || 0;
    totalKarma += k;
    if (k > 0) karmaCounts.positive++;
    else if (k < 0) karmaCounts.negative++;
    else karmaCounts.neutral++;
  });
  
  const avgKarma = actions.length ? totalKarma / actions.length : 0;
  const karmaPercent = Math.max(0, Math.min(100, ((avgKarma + 5) / 10) * 100));
  const karmaData = getKarma(Math.round(avgKarma));
  const karmaType = avgKarma > 0.3 ? 'positive' : (avgKarma < -0.3 ? 'negative' : 'neutral');

  // Monthly Karma Calculation
  const todayParts = persianParts(new Date());
  const monthLen = persianMonthLength(todayParts.y, todayParts.m);
  const monthActions = actions.filter(a => {
    const p = persianParts(isoToUTCDate(a.action_date));
    return p.y === todayParts.y && p.m === todayParts.m;
  });
  
  const dailyKarmaMap = {};
  monthActions.forEach(a => {
    dailyKarmaMap[a.action_date] = (dailyKarmaMap[a.action_date] || 0) + (Number(a.karma_score) || 0);
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
  const monthAvgKarma = monthActions.length ? monthlyKarmaTotal / monthActions.length : 0;

  // Recent Karma actions
  const recentActions = actions.slice(0, 5);

  container.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title">حساب کارما</div>
        <div class="page-subtitle">انرژی بازگشتی اعمال تو به جهان</div>
      </div>
      <div class="page-actions">
        <button type="button" class="btn btn-primary" data-goto="karma_add" style="background:linear-gradient(135deg, var(--violet-500), #4c1d95);box-shadow:0 4px 14px rgba(139,92,246,.4)">➕ ثبت کارما</button>
      </div>
    </div>

    <div class="karma-dashboard-hero anim-fade-up">
      <div class="karma-widget" data-karma="${karmaType}" style="--karma-percent: ${karmaPercent}; --karma-color: ${karmaData.color}; --karma-glow: ${karmaData.glow}">
        <div class="karma-orb-wrapper">
          <div class="karma-orb">
            <div class="karma-orb-inner">${karmaData.icon}</div>
          </div>
        </div>
        <div class="karma-title">کارمای کلی</div>
        <div class="karma-score">${faDigits(Math.round(avgKarma * 10) / 10)} <small>/ ${faDigits(5)}</small></div>
        <div class="karma-desc">${karmaData.desc}</div>
      </div>
      
      <div class="karma-hero-stats">
        <div class="stat">
          <div class="stat-head"><div class="stat-label">کارمای مثبت</div><div class="stat-icon">🌟</div></div>
          <div class="stat-value" style="color:var(--emerald-500)">${faDigits(karmaCounts.positive)}</div>
        </div>
        <div class="stat">
          <div class="stat-head"><div class="stat-label">خنثی</div><div class="stat-icon">⚖️</div></div>
          <div class="stat-value" style="color:var(--text-muted)">${faDigits(karmaCounts.neutral)}</div>
        </div>
        <div class="stat">
          <div class="stat-head"><div class="stat-label">کارمای منفی</div><div class="stat-icon">🌑</div></div>
          <div class="stat-value" style="color:var(--red-500)">${faDigits(karmaCounts.negative)}</div>
        </div>
      </div>
    </div>

    <div class="analytics-grid" style="margin-bottom:1rem">
      <div class="card anim-fade-up" style="grid-column: 1 / -1">
        <div class="card-header">
          <div>
            <div class="card-title">📅 کارنامه ماهانه (${esc(PERSIAN_MONTHS[todayParts.m - 1])} ${faDigits(todayParts.y)})</div>
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
      
      <div class="card anim-fade-up">
        <div class="card-header">
          <div>
            <div class="card-title">📊 توزیع کارما</div>
            <div class="card-subtitle">انرژی اعمال تو در کل</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:1rem;padding-top:1rem">
          <div>
            <div style="display:flex;justify-content:space-between;font-size:.85rem;margin-bottom:.4rem">
              <span style="color:var(--emerald-600)">🌟 کارمای مثبت</span>
              <span style="font-weight:700">${faDigits(karmaCounts.positive)}</span>
            </div>
            <div class="progress"><div class="progress-fill" style="width:${actions.length ? (karmaCounts.positive/actions.length)*100 : 0}%;background:var(--emerald-500)"></div></div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;font-size:.85rem;margin-bottom:.4rem">
              <span style="color:var(--text-muted)">⚖️ خنثی</span>
              <span style="font-weight:700">${faDigits(karmaCounts.neutral)}</span>
            </div>
            <div class="progress"><div class="progress-fill" style="width:${actions.length ? (karmaCounts.neutral/actions.length)*100 : 0}%;background:var(--gray-400)"></div></div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;font-size:.85rem;margin-bottom:.4rem">
              <span style="color:var(--red-500)">🌑 کارمای منفی</span>
              <span style="font-weight:700">${faDigits(karmaCounts.negative)}</span>
            </div>
            <div class="progress"><div class="progress-fill" style="width:${actions.length ? (karmaCounts.negative/actions.length)*100 : 0}%;background:var(--red-500)"></div></div>
          </div>
        </div>
      </div>

      <div class="card anim-fade-up">
        <div class="card-header">
          <div>
            <div class="card-title">📜 آخرین اعمال کارمایی</div>
            <div class="card-subtitle">۵ عمل اخیر تو</div>
          </div>
        </div>
        <div>
          ${recentActions.length ? recentActions.map(a => {
            const k = getKarma(a.karma_score);
            return `
              <div class="entry-mini" data-karma-id="${esc(a.id)}" role="button" tabindex="0">
                <div class="entry-mini-icon" style="color:${k.color}">${k.icon}</div>
                <div class="entry-mini-body">
                  <div class="entry-mini-title">${esc(a.title)}</div>
                  <div class="entry-mini-meta">
                    <span>${esc(formatPersianDate(a.action_date, { month: 'long', day: 'numeric' }))}</span>
                  </div>
                </div>
                <div class="badge" style="background:${k.color}20;color:${k.color};border:1px solid ${k.color}40">${k.label}</div>
                <button type="button" class="icon-btn-sm" data-delete-karma="${esc(a.id)}" title="حذف" style="margin-right:0.5rem">✕</button>
              </div>
            `;
          }).join('') : emptyState({ emoji: '☯️', title: 'هنوز کارمایی ثبت نشده', desc: 'با ثبت اعمال خود، انرژی بازگشتی آن‌ها را اینجا خواهید دید.', actionLabel: 'ثبت کارما', actionView: 'karma_add' })}
        </div>
      </div>
    </div>

    <!-- 11 Karma Levels Showcase -->
    <div class="card anim-fade-up" style="margin-top:1rem">
      <div class="card-header">
        <div>
          <div class="card-title">🌈 راهنمای سطوح کارما</div>
          <div class="card-subtitle">از تاریکی مطلق (-۵) تا نور مطلق (+۵)</div>
        </div>
      </div>
      <div class="karma-levels-container">
        ${KARMA_LEVELS.slice().reverse().map(k => `
          <div class="karma-level-item" style="--k-color: ${k.color}; --k-glow: ${k.glow}">
            <div class="karma-level-icon">${k.icon}</div>
            <div class="karma-level-info">
              <div class="karma-level-name">${k.label} <span class="karma-level-score">${k.shortLabel}</span></div>
              <div class="karma-level-desc">${k.desc}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  container.querySelectorAll('[data-goto]').forEach((el) => {
    el.addEventListener('click', () => navigate(el.dataset.goto));
  });

  container.querySelectorAll('[data-delete-karma]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await confirmDialog({ title: 'حذف کارما', message: 'این عمل حذف شود؟', confirmText: 'حذف', danger: true });
      if (!ok) return;
      try {
        await deleteKarmaAction(btn.dataset.deleteKarma);
        state.karma_actions = state.karma_actions.filter(a => a.id !== btn.dataset.deleteKarma);
        toast('کارما حذف شد', 'success');
        render(container);
      } catch (err) {
        toast(err.message || 'خطا', 'error');
      }
    });
  });
}
