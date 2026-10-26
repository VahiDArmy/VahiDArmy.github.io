/**
 * Console & Network Interceptor
 * Hooks into console methods and window.fetch to log API calls.
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
        const keys = Object.keys(arg);
        if (keys.length === 0) return String(arg);
        
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

  // 1. Hook Console Methods
  ['log', 'error', 'warn', 'info'].forEach((type) => {
    console[type] = (...args) => {
      addLog(type, args);
      originals[type].apply(console, args);
    };
  });

  // 2. Hook window.fetch
  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const start = performance.now();
    let url = '';
    let method = 'GET';
    
    // Extract URL and Method
    if (typeof args[0] === 'string') {
      url = args[0];
    } else if (args[0] instanceof Request) {
      url = args[0].url;
      method = args[0].method;
    } else if (args[0] instanceof URL) {
      url = args[0].toString();
    }
    
    if (args[1] && args[1].method) {
      method = args[1].method.toUpperCase();
    }

    // Ignore static assets to reduce noise (fonts, css, js, images)
    if (url.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)(\?.*)?$/i)) {
      return originalFetch.apply(this, args);
    }

    // Shorten Supabase URL for readability
    const displayUrl = url.replace(/^https?:\/\/[^/]+/, '');

    try {
      const response = await originalFetch.apply(this, args);
      const duration = Math.round(performance.now() - start);
      
      const status = response.status;
      const statusColor = status >= 200 && status < 300 ? '✅' : status >= 400 ? '❌' : '⚠️';
      
      addLog('network', [
        `${statusColor} [${method}] ${status} ${displayUrl} (${duration}ms)`
      ]);
      
      return response;
    } catch (error) {
      const duration = Math.round(performance.now() - start);
      addLog('network', [
        `❌ [${method}] FAILED ${displayUrl} (${duration}ms)\n${error.message}`
      ]);
      throw error;
    }
  };

  return {
    getLogs: () => logs,
    clear: () => { logs.length = 0; },
  };
}