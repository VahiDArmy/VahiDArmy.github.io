/* ============================================================
   js/core/event-bus.js
   Typed pub/sub with once, wildcard, error isolation
   ============================================================ */

/**
 * @typedef {(...args:any[]) => void} Handler
 */

class EventBus {
  constructor() {
    /** @type {Map<string, Set<Handler>>} */
    this._listeners = new Map();
    /** @type {Map<string, Set<Handler>>} */
    this._onceListeners = new Map();
    this._debug = false;
  }

  /**
   * Enable or disable debug logging of emitted events.
   * @param {boolean} on
   */
  setDebug(on) { this._debug = !!on; }

  /**
   * Subscribe to an event.
   * Supports `*` as a wildcard at the end (e.g. `lie:*`).
   * @param {string} event
   * @param {Handler} handler
   * @returns {() => void} unsubscribe
   */
  on(event, handler) {
    if (typeof handler !== 'function') throw new TypeError('handler must be a function');
    const set = this._listeners.get(event) || new Set();
    set.add(handler);
    this._listeners.set(event, set);
    return () => this.off(event, handler);
  }

  /**
   * Subscribe for a single emission.
   * @param {string} event
   * @param {Handler} handler
   * @returns {() => void} unsubscribe
   */
  once(event, handler) {
    if (typeof handler !== 'function') throw new TypeError('handler must be a function');
    const set = this._onceListeners.get(event) || new Set();
    set.add(handler);
    this._onceListeners.set(event, set);
    return () => {
      const s = this._onceListeners.get(event);
      if (s) s.delete(handler);
    };
  }

  /**
   * Unsubscribe.
   * @param {string} event
   * @param {Handler} handler
   */
  off(event, handler) {
    this._listeners.get(event)?.delete(handler);
    this._onceListeners.get(event)?.delete(handler);
  }

  /**
   * Remove all listeners for an event (or everything).
   * @param {string} [event]
   */
  offAll(event) {
    if (event) {
      this._listeners.delete(event);
      this._onceListeners.delete(event);
    } else {
      this._listeners.clear();
      this._onceListeners.clear();
    }
  }

  /**
   * Emit an event synchronously.
   * @param {string} event
   * @param {...any} args
   * @returns {number} number of handlers invoked
   */
  emit(event, ...args) {
    if (this._debug) console.debug('[EventBus]', event, ...args);
    let count = 0;

    // Exact listeners
    const exact = this._listeners.get(event);
    if (exact) {
      for (const h of [...exact]) {
        try { h(...args); count++; }
        catch (err) { console.error(`[EventBus] listener error on "${event}"`, err); }
      }
    }

    // Wildcard listeners (e.g. "lie:*" matches "lie:created")
    for (const [key, set] of this._listeners) {
      if (!key.endsWith(':*')) continue;
      const prefix = key.slice(0, -2);
      if (event === prefix || event.startsWith(prefix + ':')) {
        for (const h of [...set]) {
          try { h(event, ...args); count++; }
          catch (err) { console.error(`[EventBus] wildcard listener error on "${key}"`, err); }
        }
      }
    }

    // Once listeners
    const onceSet = this._onceListeners.get(event);
    if (onceSet) {
      const copy = [...onceSet];
      onceSet.clear();
      for (const h of copy) {
        try { h(...args); count++; }
        catch (err) { console.error(`[EventBus] once-listener error on "${event}"`, err); }
      }
    }

    return count;
  }

  /**
   * Emit after the current microtask (batched).
   * @param {string} event
   * @param {...any} args
   */
  emitAsync(event, ...args) {
    queueMicrotask(() => this.emit(event, ...args));
  }

  /**
   * Wait for the next emission of an event.
   * @param {string} event
   * @param {{timeout?:number}} [opts]
   * @returns {Promise<any[]>}
   */
  wait(event, opts = {}) {
    return new Promise((resolve, reject) => {
      let timer = null;
      const unsub = this.once(event, (...args) => {
        if (timer) clearTimeout(timer);
        resolve(args);
      });
      if (opts.timeout) {
        timer = setTimeout(() => {
          unsub();
          reject(new Error(`Timeout waiting for event "${event}"`));
        }, opts.timeout);
      }
    });
  }

  /**
   * Debug: list registered event names.
   * @returns {string[]}
   */
  list() {
    return [...new Set([
      ...this._listeners.keys(),
      ...this._onceListeners.keys(),
    ])];
  }

  /**
   * Count listeners for an event.
   * @param {string} event @returns {number}
   */
  count(event) {
    return (this._listeners.get(event)?.size || 0) + (this._onceListeners.get(event)?.size || 0);
  }
}

/** Singleton bus. */
export const bus = new EventBus();

export { EventBus };