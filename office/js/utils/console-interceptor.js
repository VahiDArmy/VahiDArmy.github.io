/**
 * Console Interceptor
 * Hooks into native console methods, stores raw messages,
 * and dispatches an event when a new log arrives.
 * Does NOT alter the output in the browser's real console.
 */

export function initConsoleInterceptor() {
  const logs = [];
  const maxLogs = 1000;

  const originals = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
  };

  function formatArg(arg) {
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg, null, 2);
      } catch (e) {
        return String(arg);
      }
    }
    return String(arg);
  }

  function addLog(type, args) {
    const msg = args.map(formatArg).join(' ');
    const entry = { 
      type, 
      msg, 
      time: new Date() 
    };
    
    logs.push(entry);
    if (logs.length > maxLogs) logs.shift();
    
    window.dispatchEvent(new CustomEvent('console:new', { detail: entry }));
  }

  ['log', 'error', 'warn', 'info'].forEach((type) => {
    console[type] = (...args) => {
      addLog(type, args);
      originals[type].apply(console, args);
    };
  });

  return {
    getLogs: () => logs,
    clear: () => { logs.length = 0; },
  };
}