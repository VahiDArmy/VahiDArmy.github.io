/**
 * Console Interceptor
 * Hooks into native console methods, stores raw messages.
 * Properly formats Error objects and Supabase error objects.
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
    if (arg instanceof Error) {
      return `${arg.name}: ${arg.message}\n${arg.stack || ''}`;
    }
    
    if (typeof arg === 'object' && arg !== null) {
      try {
        // Supabase errors are often plain objects with specific keys, 
        // and JSON.stringify might fail or return {} for certain Error-like objects.
        const keys = Object.keys(arg);
        if (keys.length === 0) return String(arg);
        
        // Handle Supabase PostgrestError specifically
        if (arg.message || arg.code || arg.details || arg.hint) {
          return JSON.stringify({
            message: arg.message,
            code: arg.code,
            details: arg.details,
            hint: arg.hint,
            ...arg
          }, null, 2);
        }

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