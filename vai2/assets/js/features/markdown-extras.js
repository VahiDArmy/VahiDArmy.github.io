/* ============================================================
   NEXUS CHAT — MARKDOWN EXTRAS (ENTRY POINT)
   Dynamically loads sibling rich-content modules:
     math, mermaid, sandbox, link-preview
   Auto-loaded by index.html via the `markdown-extras` slot.
   ============================================================ */
(function () {
  'use strict';
  if (window.__nexus_mde_loaded__) return;
  window.__nexus_mde_loaded__ = true;

  const modules = ['math', 'mermaid', 'sandbox', 'link-preview'];
  for (const name of modules) {
    import(`./${name}.js`).catch(err => {
      console.debug(`[markdown-extras] ${name}.js not loaded:`, err.message);
    });
  }
})();
