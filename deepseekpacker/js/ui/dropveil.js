// Global drag-and-drop overlay for ZIP / text files.

import { el } from '../utils/dom.js';

let counter = 0;

export function initDropVeil(handler) {
  const veil = document.getElementById('drop-veil');
  if (!veil) return;

  function show() {
    veil.classList.add('is-active');
  }
  function hide() {
    veil.classList.remove('is-active');
    counter = 0;
  }

  window.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    counter++;
    show();
  });

  window.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  window.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    counter--;
    if (counter <= 0) hide();
  });

  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    hide();
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handler(file);
  });
}

function hasFiles(e) {
  if (!e.dataTransfer) return false;
  const types = e.dataTransfer.types;
  if (!types) return false;
  for (let i = 0; i < types.length; i++) {
    if (types[i] === 'Files') return true;
  }
  return false;
}
