/**
 * Minimal pub/sub event bus.
 *
 * Usage:
 *   import { bus } from "./event-bus.js";
 *   const off = bus.on("food:added", handler);
 *   bus.emit("food:added", payload);
 *   off();
 *
 * Features:
 *  - on / once / off
 *  - wildcard "*" listeners receive every event
 *  - listener errors are isolated and logged, never crash other listeners
 *  - tiny stats for debugging
 */

const listeners = new Map(); // event -> Set<fn>
const wildcard = new Set(); // fn[]

function safeCall(fn, payload, event) {
  try {
    fn(payload, event);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[bus] listener error for "${event}"`, err);
  }
}

export const bus = {
  on(event, fn) {
    if (typeof fn !== "function") throw new TypeError("listener must be fn");
    if (event === "*") {
      wildcard.add(fn);
      return () => wildcard.delete(fn);
    }
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => this.off(event, fn);
  },

  once(event, fn) {
    const off = this.on(event, (payload, ev) => {
      off();
      safeCall(fn, payload, ev);
    });
    return off;
  },

  off(event, fn) {
    if (event === "*") {
      wildcard.delete(fn);
      return;
    }
    const set = listeners.get(event);
    if (!set) return;
    set.delete(fn);
    if (set.size === 0) listeners.delete(event);
  },

  emit(event, payload) {
    const set = listeners.get(event);
    if (set) {
      // clone to avoid mutation during iteration
      [...set].forEach((fn) => safeCall(fn, payload, event));
    }
    if (wildcard.size) {
      [...wildcard].forEach((fn) => safeCall(fn, payload, event));
    }
  },

  clear(event) {
    if (event) listeners.delete(event);
    else {
      listeners.clear();
      wildcard.clear();
    }
  },

  stats() {
    const counts = {};
    for (const [k, v] of listeners) counts[k] = v.size;
    return { events: counts, wildcard: wildcard.size };
  },
};