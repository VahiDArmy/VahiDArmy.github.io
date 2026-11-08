// AURORA OS — Calendar

import { h, $, $$, clear, fmtDate, uid } from '../core/dom.js';
import { store } from '../core/store.js';
import { EVENTS, USERS } from '../data/seed.js';
import { button, input, select, modal, segmented } from '../ui/components.js';
import toast from '../ui/toasts.js';

export const meta = {
  id: 'calendar',
  title: 'Calendar',
  icon: '◰',
  defaultSize: { width: 960, height: 660 },
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

let _current = new Date();
let _view = 'month';
let _events = null;
let _root = null;

function getEvents() {
  if (!_events) {
    const stored = store.get('calendar.events');
    _events = stored && stored.length ? stored : EVENTS.map((e) => ({ ...e }));
  }
  return _events;
}

function saveEvents() { store.set('calendar.events', _events); }

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function startOfWeek(d) {
  const c = new Date(d);
  c.setDate(c.getDate() - c.getDay());
  c.setHours(0, 0, 0, 0);
  return c;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function eventColor(c) {
  return { accent: 'var(--accent)', success: 'var(--success)', warning: 'var(--warning)', info: 'var(--info)', danger: 'var(--danger)' }[c] || 'var(--accent)';
}

function eventsForDay(d) {
  return getEvents().filter((e) => sameDay(new Date(e.start), d));
}

function openCreateModal(date) {
  const titleInput = input({ placeholder: 'Event title', size: 'lg' });
  const dateInput = h('input', { class: 'input', type: 'date' });
  dateInput.value = (date || new Date()).toISOString().slice(0, 10);
  const timeInput = h('input', { class: 'input', type: 'time' });
  timeInput.value = '09:00';
  const durSel = select([
    { value: '30', label: '30 min' },
    { value: '45', label: '45 min' },
    { value: '60', label: '1 hour' },
    { value: '90', label: '1.5 hours' },
  ], { value: '60' });

  const body = h('div', { class: 'form-stack' });
  body.append(
    h('label', { class: 'form-label' }, ['Title', titleInput]),
    h('label', { class: 'form-label' }, ['Date', dateInput]),
    h('label', { class: 'form-label' }, ['Start time', timeInput]),
    h('label', { class: 'form-label' }, ['Duration', durSel]),
  );
  let m;
  const onCreate = () => {
    const title = titleInput.value.trim();
    if (!title) { toast.error('Title required'); return; }
    const [hh, mm] = timeInput.value.split(':').map(Number);
    const [yy, mo, dd] = dateInput.value.split('-').map(Number);
    const dt = new Date(yy, mo - 1, dd, hh, mm);
    const ev = {
      id: 'ev-' + uid(),
      title,
      start: dt.toISOString(),
      duration: Number(durSel.value),
      attendees: [],
      color: 'accent',
    };
    getEvents().push(ev);
    saveEvents();
    render();
    toast.success('Event created');
    m.close();
  };
  m = modal({
    title: 'New event',
    body,
    footer: h('div', { style: { display: 'flex', gap: '8px' } }, [
      button('Cancel', { variant: 'ghost', onClick: () => m.close() }),
      button('Create', { variant: 'primary', onClick: onCreate }),
    ]),
  });
}

function monthView() {
  const grid = h('div', { class: 'cal-grid cal-grid--month' });
  const first = startOfMonth(_current);
  const last = endOfMonth(_current);
  const start = startOfWeek(first);
  const end = new Date(startOfWeek(last));
  end.setDate(end.getDate() + 6);
  const cursor = new Date(start);
  const today = new Date();

  while (cursor <= end) {
    const cell = h('div', { class: 'cal-cell' });
    const d = new Date(cursor);
    if (d.getMonth() !== _current.getMonth()) cell.classList.add('is-out');
    if (sameDay(d, today)) cell.classList.add('is-today');
    cell.append(h('div', { class: 'cal-cell__num', text: String(d.getDate()) }));

    const evs = eventsForDay(d).slice(0, 3);
    for (const e of evs) {
      const chip = h('div', { class: 'cal-event' });
      chip.style.background = eventColor(e.color) + '22';
      chip.style.borderLeft = '3px solid ' + eventColor(e.color);
      const t = new Date(e.start);
      chip.append(h('span', { class: 'cal-event__time', text: t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) }));
      chip.append(h('span', { class: 'cal-event__title', text: e.title }));
      chip.addEventListener('click', (ev) => { ev.stopPropagation(); openEditModal(e); });
      cell.append(chip);
    }
    if (evs.length > 3) cell.append(h('div', { class: 'cal-more', text: '+' + (evs.length - 3) + ' more' }));

    cell.addEventListener('click', () => openCreateModal(d));
    grid.append(cell);
    cursor.setDate(cursor.getDate() + 1);
  }
  return grid;
}

function weekView() {
  const grid = h('div', { class: 'cal-week' });
  const start = startOfWeek(_current);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
  const header = h('div', { class: 'cal-week__head' });
  header.append(h('div', { class: 'cal-week__gutter' }));
  for (const d of days) {
    const cell = h('div', { class: 'cal-week__day-head' });
    cell.append(h('div', { class: 'cal-week__dow', text: WEEKDAYS[d.getDay()] }));
    cell.append(h('div', { class: 'cal-week__num' + (sameDay(d, new Date()) ? ' is-today' : ''), text: String(d.getDate()) }));
    header.append(cell);
  }
  grid.append(header);

  const body = h('div', { class: 'cal-week__body' });
  const hoursCol = h('div', { class: 'cal-week__gutter' });
  for (let hr = 0; hr < 24; hr++) {
    hoursCol.append(h('div', { class: 'cal-hour-label', text: String(hr).padStart(2, '0') + ':00' }));
  }
  body.append(hoursCol);

  for (const d of days) {
    const col = h('div', { class: 'cal-week__col' });
    for (let hr = 0; hr < 24; hr++) {
      const slot = h('div', { class: 'cal-week__slot' });
      const evs = eventsForDay(d).filter((e) => new Date(e.start).getHours() === hr);
      for (const e of evs) {
        const ev = h('div', { class: 'cal-week__event' });
        ev.style.background = eventColor(e.color) + '30';
        ev.style.borderLeft = '3px solid ' + eventColor(e.color);
        ev.append(h('div', { class: 'cal-week__event-title', text: e.title }));
        ev.append(h('div', { class: 'cal-week__event-time', text: new Date(e.start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) }));
        ev.addEventListener('click', () => openEditModal(e));
        slot.append(ev);
      }
      slot.addEventListener('click', () => {
        const dt = new Date(d);
        dt.setHours(hr, 0, 0, 0);
        openCreateModal(dt);
      });
      col.append(slot);
    }
    body.append(col);
  }
  grid.append(body);
  return grid;
}

function dayView() {
  const container = h('div', { class: 'cal-day' });
  const d = _current;
  container.append(h('div', { class: 'cal-day__head' }, [
    h('div', { class: 'cal-day__date', text: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) }),
  ]));
  const list = h('div', { class: 'cal-day__list' });
  const evs = eventsForDay(d).sort((a, b) => new Date(a.start) - new Date(b.start));
  if (!evs.length) {
    list.append(h('div', { class: 'cal-day__empty', text: 'No events today' }));
  }
  for (const e of evs) {
    const row = h('div', { class: 'cal-day__event' });
    row.style.borderLeft = '4px solid ' + eventColor(e.color);
    const t = new Date(e.start);
    row.append(h('div', { class: 'cal-day__time', text: t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) }));
    row.append(h('div', { class: 'cal-day__body' }, [
      h('div', { class: 'cal-day__title', text: e.title }),
      h('div', { class: 'cal-day__dur', text: e.duration + ' min' }),
    ]));
    row.addEventListener('click', () => openEditModal(e));
    list.append(row);
  }
  container.append(list);
  return container;
}

function openEditModal(ev) {
  const titleInput = input({ value: ev.title, size: 'lg' });
  const body = h('div', { class: 'form-stack' });
  body.append(h('label', { class: 'form-label' }, ['Title', titleInput]));
  body.append(h('div', { class: 'text-sm text-muted', text: new Date(ev.start).toLocaleString() }));
  let m;
  m = modal({
    title: 'Edit event',
    body,
    footer: h('div', { style: { display: 'flex', gap: '8px' } }, [
      button('Delete', { variant: 'danger', onClick: () => {
        const idx = getEvents().findIndex((x) => x.id === ev.id);
        if (idx >= 0) getEvents().splice(idx, 1);
        saveEvents(); render(); m.close();
        toast.info('Event deleted');
      } }),
      h('div', { style: { flex: '1' } }),
      button('Cancel', { variant: 'ghost', onClick: () => m.close() }),
      button('Save', { variant: 'primary', onClick: () => {
        ev.title = titleInput.value.trim() || ev.title;
        saveEvents(); render(); m.close();
        toast.success('Event updated');
      } }),
    ]),
  });
}

function render() {
  if (!_root) return;
  clear(_root);
  const head = h('div', { class: 'cal-head' });
  head.append(button('‹', { variant: 'ghost', size: 'sm', onClick: () => {
    if (_view === 'month') _current.setMonth(_current.getMonth() - 1);
    else if (_view === 'week') _current.setDate(_current.getDate() - 7);
    else _current.setDate(_current.getDate() - 1);
    render();
  } }));
  head.append(button('Today', { variant: 'secondary', size: 'sm', onClick: () => { _current = new Date(); render(); } }));
  head.append(button('›', { variant: 'ghost', size: 'sm', onClick: () => {
    if (_view === 'month') _current.setMonth(_current.getMonth() + 1);
    else if (_view === 'week') _current.setDate(_current.getDate() + 7);
    else _current.setDate(_current.getDate() + 1);
    render();
  } }));
  head.append(h('div', { class: 'cal-head__label', text: _view === 'month' ? MONTHS[_current.getMonth()] + ' ' + _current.getFullYear() : _current.toLocaleDateString() }));
  head.append(h('div', { style: { flex: '1' } }));
  head.append(segmented([
    { value: 'month', label: 'Month' },
    { value: 'week', label: 'Week' },
    { value: 'day', label: 'Day' },
  ], { active: _view, onChange: (v) => { _view = v; render(); } }));
  head.append(button('+ Event', { variant: 'primary', size: 'sm', onClick: () => openCreateModal(_current) }));
  _root.append(head);

  if (_view === 'month') {
    const dow = h('div', { class: 'cal-dow' });
    for (const d of WEEKDAYS) dow.append(h('div', { class: 'cal-dow__cell', text: d }));
    _root.append(dow, monthView());
  } else if (_view === 'week') {
    _root.append(weekView());
  } else {
    _root.append(dayView());
  }
}

export function mount(container) {
  clear(container);
  _root = h('div', { class: 'cal-wrap' });
  container.append(_root);
  render();
}

export default { meta, mount };
