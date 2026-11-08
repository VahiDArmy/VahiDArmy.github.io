// Topbar wiring: download, load-zip, search.

import { downloadCurrentPack } from './commands.js';
import { openZipPicker } from './zip-flow.js';
import { initSearch } from './search.js';

export function initTopbar() {
  const downloadBtn = document.getElementById('btn-download');
  const loadBtn = document.getElementById('btn-load-zip');
  if (downloadBtn) downloadBtn.addEventListener('click', () => downloadCurrentPack());
  if (loadBtn) loadBtn.addEventListener('click', () => openZipPicker());
  initSearch();
}
