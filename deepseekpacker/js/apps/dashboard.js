// AURORA OS — Dashboard App

import { h, $, $$, clear, fmtNum, fmtPct, fmtDate, relTime } from '../core/dom.js';
import { store } from '../core/store.js';
import { bus } from '../core/bus.js';
import { KPI_DATA, TRANSACTIONS, TASKS, USERS, makeTimeseries } from '../data/seed.js';
import { card, badge, avatar, progress, button, emptyState } from '../ui/components.js';
import { sparkline, lineChart, donutChart, radialGauge, barChart } from '../ui/charts.js';

export const meta = {
  id: 'dashboard',
  title: 'Dashboard',
  icon: '◈',
  defaultSize: { width: 900, height: 620 },
};

function kpiCard(kpi) {
  const c = h('div', { class: 'kpi-card' });
  const head = h('div', { class: 'kpi-head' });
  head.append(h('div', { class: 'kpi-label', text: kpi.label }));
  const deltaCls = kpi.trend === 'up' ? 'kpi-delta--up' : 'kpi-delta--down';
  const delta = h('div', { class: 'kpi-delta ' + deltaCls });
  delta.append(h('span', { text: (kpi.trend === 'up' ? '↑' : '↓') + ' ' + Math.abs(kpi.delta) + '%' }));
  head.append(delta);
  c.append(head);
  c.append(h('div', { class: 'kpi-value', text: kpi.value }));
  c.append(sparkline(kpi.series, { width: 160, height: 40, stroke: kpi.trend === 'up' ? 'var(--success)' : 'var(--danger)' }));
  return c;
}

function buildOverview() {
  const wrap = h('div', { class: 'dash' });

  const kpiGrid = h('div', { class: 'kpi-grid' });
  for (const k of KPI_DATA) kpiGrid.append(kpiCard(k));
  wrap.append(kpiGrid);

  const chartsRow = h('div', { class: 'dash-row' });

  const revCard = h('div', { class: 'dash-card' });
  revCard.append(h('div', { class: 'dash-card__head' }, [h('div', { class: 'dash-card__title', text: 'Revenue (30d)' })]));
  const revBody = h('div', { class: 'dash-card__body' });
  const revenueSeries = [
    { name: 'Revenue', data: makeTimeseries(30, 120, 18), color: 'var(--accent)' },
    { name: 'Expenses', data: makeTimeseries(30, 80, 14), color: 'var(--danger)' },
  ];
  const days = Array.from({ length: 30 }, (_, i) => (i % 5 === 0 ? 'D' + (i + 1) : ''));
  revBody.append(lineChart(revenueSeries, { width: 600, height: 240, xLabels: days, area: true }));
  revCard.append(revBody);
  chartsRow.append(revCard);

  const donutCard = h('div', { class: 'dash-card' });
  donutCard.append(h('div', { class: 'dash-card__head' }, [h('div', { class: 'dash-card__title', text: 'Traffic sources' })]));
  const donutBody = h('div', { class: 'dash-card__body' });
  donutBody.append(donutChart([
    { label: 'Direct', value: 3420, color: 'var(--accent)' },
    { label: 'Search', value: 2180, color: 'var(--accent-2)' },
    { label: 'Social', value: 1240, color: 'var(--success)' },
    { label: 'Referral', value: 780, color: 'var(--warning)' },
  ], { size: 180, centerValue: '7.6K', centerLabel: 'visits' }));
  donutCard.append(donutBody);
  chartsRow.append(donutCard);
  wrap.append(chartsRow);

  const tasksCard = h('div', { class: 'dash-card' });
  tasksCard.append(h('div', { class: 'dash-card__head' }, [
    h('div', { class: 'dash-card__title', text: 'Recent tasks' }),
    h('span', { class: 'badge-pill badge-pill--muted', text: TASKS.length + ' total' }),
  ]));
  const taskList = h('div', { class: 'dash-task-list' });
  for (const t of TASKS.slice(0, 5)) {
    const row = h('div', { class: 'dash-task-row' });
    const priority = t.priority;
    row.append(h('span', { class: 'priority-dot priority-dot--' + priority }));
    row.append(h('span', { class: 'dash-task-title', text: t.title }));
    const assignee = USERS.find((u) => u.id === t.assignee);
    if (assignee) row.append(avatar(assignee.initials, { size: 'sm' }));
    row.append(h('span', { class: 'dash-task-due', text: fmtDate(t.due) }));
    taskList.append(row);
  }
  tasksCard.append(taskList);
  wrap.append(tasksCard);

  const progCard = h('div', { class: 'dash-card' });
  progCard.append(h('div', { class: 'dash-card__head' }, [h('div', { class: 'dash-card__title', text: 'Goals' })]));
  const progBody = h('div', { class: 'dash-card__body' });
  const goals = [
    { name: 'Revenue target', value: 72, color: 'var(--success)' },
    { name: 'New users', value: 58, color: 'var(--accent)' },
    { name: 'Retention', value: 84, color: 'var(--info)' },
    { name: 'NPS', value: 66, color: 'var(--warning)' },
  ];
  for (const g of goals) {
    const row = h('div', { class: 'goal-row' });
    row.append(h('div', { class: 'goal-label' }, [h('span', { text: g.name }), h('span', { class: 'goal-value', text: g.value + '%' })]));
    const p = h('div', { class: 'progress' });
    const f = h('div', { class: 'progress__fill' });
    f.style.width = g.value + '%';
    f.style.background = g.color;
    p.append(f);
    row.append(p);
    progBody.append(row);
  }
  progCard.append(progBody);
  wrap.append(progCard);

  return wrap;
}

function buildActivity() {
  const wrap = h('div', { class: 'dash-activity' });
  wrap.append(h('h3', { class: 'section-title', text: 'Recent activity' }));
  const feed = h('div', { class: 'activity-feed' });
  for (const tx of TRANSACTIONS.slice(0, 8)) {
    const row = h('div', { class: 'activity-row' });
    const statusCls = tx.status === 'paid' ? 'badge-pill--success' : tx.status === 'pending' ? 'badge-pill--warning' : 'badge-pill--danger';
    row.append(h('span', { class: 'activity-icon activity-icon--' + tx.status, text: tx.status === 'paid' ? '✓' : tx.status === 'pending' ? '◐' : '✕' }));
    row.append(h('div', { class: 'activity-body' }, [
      h('div', { class: 'activity-title', text: tx.service + ' — $' + tx.amount.toFixed(2) }),
      h('div', { class: 'activity-meta', text: tx.region + ' · ' + relTime(tx.date) }),
    ]));
    row.append(h('span', { class: 'badge-pill ' + statusCls, text: tx.status }));
    feed.append(row);
  }
  wrap.append(feed);
  return wrap;
}

export function mount(container) {
  clear(container);
  container.append(buildOverview(), buildActivity());
}

export function render() { return document.createElement('div'); }

export default { meta, mount };
