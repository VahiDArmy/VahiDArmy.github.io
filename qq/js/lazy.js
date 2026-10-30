// =============================================================
// Lazy loader — load heavy modules only when needed
// =============================================================
const Lazy = (function () {
  const loaded = new Set();

  function loadScript(src) {
    if (loaded.has(src)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = false; // preserve order
      s.onload = () => {
        loaded.add(src);
        resolve();
      };
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.body.appendChild(s);
    });
  }

  function loadScripts(srcs) {
    // sequential to keep dependency order
    return srcs.reduce((p, src) => p.then(() => loadScript(src)), Promise.resolve());
  }

  let workReady = null;
  function ensureWork() {
    if (workReady) return workReady;
    workReady = loadScripts([
      'https://cdn.jsdelivr.net/npm/marked@12/marked.min.js',
      'https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.min.js',
      'js/mizan-panel.js',
      'js/ask-ai.js',
      'js/work-original.js',
    ]);
    return workReady;
  }

  let relationsReady = null;
  function ensureRelations() {
    if (relationsReady) return relationsReady;
    relationsReady = loadScript('https://cdn.jsdelivr.net/npm/d3@7');
    return relationsReady;
  }

  // Observe sections and fire callback once when they enter viewport
  function whenVisible(el, callback, { rootMargin = '200px 0px' } = {}) {
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      callback();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            io.disconnect();
            callback();
            break;
          }
        }
      },
      { root: null, rootMargin, threshold: 0.01 }
    );
    io.observe(el);
  }

  return { loadScript, loadScripts, ensureWork, ensureRelations, whenVisible };
})();
