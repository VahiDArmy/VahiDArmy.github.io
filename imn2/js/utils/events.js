/**
 * events.js — Event Bus ساده (pub/sub)
 * بدون وابستگی خارجی. پشتیبانی از once و wildcard.
 */

class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._handlers = new Map();
  }

  on(event, handler) {
    if (typeof handler !== 'function') throw new TypeError('handler must be function');
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(handler);
    return () => this.off(event, handler);
  }

  once(event, handler) {
    const wrap = (...args) => {
      this.off(event, wrap);
      try { handler(...args); } catch (e) { console.error(e); }
    };
    return this.on(event, wrap);
  }

  off(event, handler) {
    if (!this._handlers.has(event)) return;
    if (handler) this._handlers.get(event).delete(handler);
    else this._handlers.delete(event);
  }

  emit(event, payload) {
    // دقیق
    if (this._handlers.has(event)) {
      for (const h of Array.from(this._handlers.get(event))) {
        try { h(payload); } catch (e) { console.error(`[event:${event}]`, e); }
      }
    }
    // wildcard (*)
    if (this._handlers.has('*')) {
      for (const h of Array.from(this._handlers.get('*'))) {
        try { h({ event, payload }); } catch (e) { console.error('[event:*]', e); }
      }
    }
  }

  clear() { this._handlers.clear(); }
  listeners(event) { return this._handlers.get(event)?.size || 0; }
}

export const bus = new EventBus();

/* ---------- نام رویدادهای مشترک ---------- */

export const EVENTS = {
  // Auth
  AUTH_SIGNED_IN: 'auth:signedIn',
  AUTH_SIGNED_OUT: 'auth:signedOut',
  AUTH_STATE_CHANGE: 'auth:state',

  // Navigation
  PAGE_CHANGE: 'nav:page',
  DATE_CHANGE: 'nav:date',

  // Data
  DATA_LOADING: 'data:loading',
  DATA_LOADED: 'data:loaded',
  DATA_ERROR: 'data:error',
  RECORD_CREATED: 'record:created',
  RECORD_UPDATED: 'record:updated',
  RECORD_DELETED: 'record:deleted',

  // UI
  THEME_CHANGE: 'ui:theme',
  TOAST: 'ui:toast',
  MODAL_OPEN: 'ui:modalOpen',
  MODAL_CLOSE: 'ui:modalClose',
  SETTINGS_CHANGE: 'ui:settings',

  // Report
  REPORT_REFRESH: 'report:refresh',
};