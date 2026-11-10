(function() {
  // Prevent multiple injections
  if (document.getElementById('joy-debug-window')) return;

  const debugWindow = document.createElement('div');
  debugWindow.id = 'joy-debug-window';
  debugWindow.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    z-index: 2147483647 !important;
    background: rgba(15, 10, 30, 0.95) !important;
    color: #ff4d4d !important;
    font-family: monospace !important;
    font-size: 12px !important;
    max-height: 40vh !important;
    overflow-y: auto !important;
    display: none;
    flex-direction: column !important;
    box-shadow: 0 4px 20px rgba(0,0,0,0.8) !important;
    direction: ltr !important;
    border-bottom: 2px solid #ff4d4d !important;
    backdrop-filter: blur(10px) !important;
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 12px; background: #1a0f1f; color: #ff4d4d; font-weight: bold;
    position: sticky; top: 0; border-bottom: 1px solid #333;
  `;
  header.innerHTML = `<span>🐞 Debug Console (JS Errors)</span>`;
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ Close';
  closeBtn.style.cssText = 'background: #ff4d4d; border: none; color: white; font-family: sans-serif; font-size: 11px; padding: 4px 8px; border-radius: 4px; cursor: pointer;';
  closeBtn.onclick = () => { debugWindow.style.display = 'none'; };
  header.appendChild(closeBtn);

  const content = document.createElement('div');
  content.style.cssText = 'padding: 10px 12px; line-height: 1.5; color: #fff;';

  debugWindow.appendChild(header);
  debugWindow.appendChild(content);

  const appendToBody = () => {
    if (!document.body.contains(debugWindow)) {
      document.body.appendChild(debugWindow);
    }
  };

  if (document.body) appendToBody();
  else document.addEventListener('DOMContentLoaded', appendToBody);

  function logError(type, err) {
    appendToBody();
    const div = document.createElement('div');
    div.style.cssText = 'margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;';
    
    let msg = err.message || err;
    let stack = err.stack ? `<br><span style="color:#888; font-size:10px;">${err.stack.split('\n').slice(0,3).join('<br>')}</span>` : '';
    
    div.innerHTML = `<strong style="color: #ff8888;">[${type}]</strong> ${msg} ${stack}`;
    content.appendChild(div);
    
    debugWindow.style.display = 'flex';
  }

  // Catch global errors
  window.addEventListener('error', (e) => {
    logError('Error', e.error || e.message);
  });

  // Catch promise rejections
  window.addEventListener('unhandledrejection', (e) => {
    logError('Promise', e.reason);
  });

  // Override console.error
  const originalError = console.error;
  console.error = function(...args) {
    originalError.apply(console, args);
    logError('Console', args.join(' '));
  };
  
  // Override console.warn
  const originalWarn = console.warn;
  console.warn = function(...args) {
    originalWarn.apply(console, args);
    logError('Warning', args.join(' '));
  };
})();
