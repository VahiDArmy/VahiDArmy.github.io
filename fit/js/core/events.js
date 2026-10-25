/* ==========================================================================
   Core — Event Bus
   Pub/sub used across modules. Never store state here.
   ========================================================================== */

(function (window) {
  'use strict';

  const App = (window.App = window.App || {});

  const listeners = Object.create(null);

  const Events = {
    /**
     * Subscribe to an event.
     * @param {string} event
     * @param {Function} handler
     * @returns {Function} unsubscribe
     */
    on(event, handler) {
      if (typeof event !== 'string' || typeof handler !== 'function') {
        throw new TypeError('Events.on: invalid arguments');
      }
      (listeners[event] || (listeners[event] = [])).push(handler);
      return () => Events.off(event, handler);
    },

    /**
     * Unsubscribe a specific handler.
     */
    off(event, handler) {
      const list = listeners[event];
      if (!list) return;
      listeners[event] = list.filter((h) => h !== handler);
    },

    /**
     * Subscribe once.
     */
    once(event, handler) {
      const wrapper = (payload) => {
        Events.off(event, wrapper);
        handler(payload);
      };
      return Events.on(event, wrapper);
    },

    /**
     * Emit an event synchronously. Handler errors are caught and logged
     * so a broken listener cannot break the whole publish.
     */
    emit(event, payload) {
      const list = listeners[event];
      if (!list || list.length === 0) return;
      // Copy the array so handlers can safely unsubscribe during iteration
      const snapshot = list.slice();
      for (const handler of snapshot) {
        try {
          handler(payload);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`[Events] handler for "${event}" threw:`, err);
        }
      }
    },

    /**
     * Remove all handlers for an event, or all handlers globally.
     */
    clear(event) {
      if (event) {
        delete listeners[event];
      } else {
        Object.keys(listeners).forEach((k) => delete listeners[k]);
      }
    }
  };

  App.Events = Events;
})(window);