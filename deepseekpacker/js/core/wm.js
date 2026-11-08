// AURORA OS — Window Manager

import { bus } from './bus.js';
import { store } from './store.js';
import { h, $ } from './dom.js';

const MIN_W = 320;
const MIN_H = 220;

class WindowManager {
  constructor() {
    this.root = null;
    this.windows = new Map();
    this.zTop = 300;
    this.activeId = null;
    this._dragState = null;
    this._initialized = false;
  }

  init(root) {
    if (this._initialized) return;
    this.root = root;
    this._initialized = true;
    bus.on('wm:open', (spec) => this.open(spec));
    bus.on('wm:close', (id) => this.close(id));
    bus.on('wm:focus', (id) => this.focus(id));
    window.addEventListener('resize', () => this._boundAll());
    window.addEventListener('pointermove', (e) => this._onPointerMove(e));
    window.addEventListener('pointerup', () => this._onPointerUp());
  }

  open(spec) {
    const id = spec.id || ('win-' + Math.random().toString(36).slice(2, 8));
    if (this.windows.has(id)) {
      const win = this.windows.get(id);
      this.focus(id);
      if (win.el.classList.contains('is-minimized')) this.restore(id);
      return win;
    }

    const { title = 'Window', width = 720, height = 480, x, y } = spec;
    const offset = (this.windows.size % 8) * 24;
    const posX = x != null ? x : 80 + offset;
    const posY = y != null ? y : 60 + offset;

    const el = h('div', { class: 'window', dataset: { winId: id } });
    el.style.left = posX + 'px';
    el.style.top = posY + 'px';
    el.style.width = width + 'px';
    el.style.height = height + 'px';
    el.style.zIndex = ++this.zTop;

    const icon = spec.icon || '◆';
    const titlebar = h('div', { class: 'window__titlebar' }, [
      h('div', { class: 'window__title' }, [h('span', { text: icon }), h('span', { text: title })]),
      h('div', { class: 'window__controls' }, [
        h('button', { class: 'window__control window__control--min', title: 'Minimize', onClick: () => this.minimize(id) }),
        h('button', { class: 'window__control window__control--max', title: 'Maximize', onClick: () => this.toggleMax(id) }),
        h('button', { class: 'window__control window__control--close', title: 'Close', onClick: () => this.close(id) }),
      ]),
    ]);

    const body = h('div', { class: 'window__body' });
    if (spec.content instanceof Node) body.append(spec.content);
    else if (typeof spec.content === 'string') body.innerHTML = spec.content;

    for (const d of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
      el.append(h('div', { class: 'window__resize window__resize--' + d, dataset: { resize: d } }));
    }

    el.append(titlebar, body);
    this.root.append(el);

    titlebar.addEventListener('pointerdown', (e) => this._startDrag(e, id, 'move'));
    for (const d of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
      const handle = el.querySelector('[data-resize="' + d + '"]');
      handle.addEventListener('pointerdown', (e) => this._startDrag(e, id, d));
    }
    el.addEventListener('pointerdown', () => this.focus(id), true);

    const win = { id, el, titlebar, body, spec, minimized: false, maximized: false, prevRect: null };
    this.windows.set(id, win);
    requestAnimationFrame(() => el.classList.add('is-visible'));
    this.focus(id);

    bus.emit('wm:opened', win);
    return win;
  }

  close(id) {
    const win = this.windows.get(id);
    if (!win) return;
    win.el.style.animation = 'window-close ' + (getComputedStyle(document.documentElement).getPropertyValue('--dur-base') || '180ms') + ' ease-in forwards';
    setTimeout(() => {
      win.el.remove();
      this.windows.delete(id);
      if (this.activeId === id) {
        this.activeId = null;
        const remaining = [...this.windows.keys()];
        if (remaining.length) this.focus(remaining[remaining.length - 1]);
      }
      bus.emit('wm:closed', id);
    }, 200);
  }

  focus(id) {
    const win = this.windows.get(id);
    if (!win) return;
    if (this.activeId === id) return;
    for (const [, w] of this.windows) w.el.classList.remove('is-active');
    win.el.classList.add('is-active');
    win.el.style.zIndex = ++this.zTop;
    this.activeId = id;
    store.set('activeWindow', id);
    bus.emit('wm:focus', id);
  }

  minimize(id) {
    const win = this.windows.get(id);
    if (!win) return;
    win.el.classList.add('is-minimized');
    win.minimized = true;
    bus.emit('wm:minimized', id);
  }

  restore(id) {
    const win = this.windows.get(id);
    if (!win) return;
    win.el.classList.remove('is-minimized');
    win.minimized = false;
    this.focus(id);
    bus.emit('wm:restored', id);
  }

  toggleMax(id) {
    const win = this.windows.get(id);
    if (!win) return;
    if (win.maximized) {
      win.el.classList.remove('is-maximized');
      if (win.prevRect) {
        win.el.style.left = win.prevRect.left;
        win.el.style.top = win.prevRect.top;
        win.el.style.width = win.prevRect.width;
        win.el.style.height = win.prevRect.height;
      }
      win.maximized = false;
    } else {
      win.prevRect = {
        left: win.el.style.left, top: win.el.style.top,
        width: win.el.style.width, height: win.el.style.height,
      };
      win.el.classList.add('is-maximized');
      win.maximized = true;
    }
    this.focus(id);
    bus.emit('wm:maximized', { id, maximized: win.maximized });
  }

  _startDrag(e, id, mode) {
    const win = this.windows.get(id);
    if (!win) return;
    if (win.maximized && mode === 'move') return;
    if (e.button !== 0) return;
    e.preventDefault();
    const rect = win.el.getBoundingClientRect();
    this._dragState = {
      id, mode, startX: e.clientX, startY: e.clientY,
      startLeft: rect.left, startTop: rect.top,
      startW: rect.width, startH: rect.height,
    };
    document.body.style.userSelect = 'none';
    this.focus(id);
  }

  _onPointerMove(e) {
    const s = this._dragState;
    if (!s) return;
    const win = this.windows.get(s.id);
    if (!win) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    let { startLeft: L, startTop: T, startW: W, startH: H } = s;
    const m = s.mode;

    if (m === 'move') {
      win.el.style.left = (L + dx) + 'px';
      win.el.style.top = Math.max(0, T + dy) + 'px';
      return;
    }
    if (m.includes('e')) W = Math.max(MIN_W, s.startW + dx);
    if (m.includes('s')) H = Math.max(MIN_H, s.startH + dy);
    if (m.includes('w')) { W = Math.max(MIN_W, s.startW - dx); L = s.startLeft + dx; }
    if (m.includes('n')) { H = Math.max(MIN_H, s.startH - dy); T = Math.max(0, s.startTop + dy); }

    win.el.style.width = W + 'px';
    win.el.style.height = H + 'px';
    win.el.style.left = L + 'px';
    win.el.style.top = T + 'px';
  }

  _onPointerUp() {
    if (!this._dragState) return;
    document.body.style.userSelect = '';
    this._dragState = null;
  }

  _boundAll() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    for (const [, win] of this.windows) {
      const r = win.el.getBoundingClientRect();
      if (r.right > vw) win.el.style.left = Math.max(0, vw - r.width) + 'px';
      if (r.bottom > vh) win.el.style.top = Math.max(0, vh - r.height) + 'px';
    }
  }
}

export const wm = new WindowManager();
export default wm;
