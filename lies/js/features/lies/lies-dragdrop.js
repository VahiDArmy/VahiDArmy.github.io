/* ============================================================
   js/features/lies/lies-dragdrop.js
   Drag & drop: move lies to categories (via sidebar / drop zones)
   ============================================================ */

import { bus } from '../../core/event-bus.js';
import { EVENTS } from '../../config/constants.js';
import { liesStore, patchItem } from './lies-store.js';
import * as liesService from '../../services/lies.service.js';
import { toast } from '../../ui/toast.js';

let initialized = false;
let draggedIds = [];

/**
 * Init drag & drop for the lies list container.
 * @param {HTMLElement} container
 * @returns {() => void} detach
 */
export function initDragDrop(container) {
  if (initialized) return () => {};
  initialized = true;

  const onDragStart = (ev) => {
    const target = ev.target.closest('[draggable="true"][data-id]');
    if (!target) return;

    const id = target.dataset.id;
    const state = liesStore.getState();

    // If the dragged item is part of a multi-selection, drag all selected
    if (state.selection.has(id) && state.selection.size > 1) {
      draggedIds = [...state.selection];
    } else {
      draggedIds = [id];
    }

    target.classList.add('is-dragging');

    try {
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', draggedIds.join(','));
      ev.dataTransfer.setData('application/x-lie-ids', JSON.stringify(draggedIds));
    } catch { /* some browsers restrict */ }
  };

  const onDragEnd = (ev) => {
    const target = ev.target.closest?.('[draggable="true"]');
    target?.classList.remove('is-dragging');
    document.querySelectorAll('.is-drop-target').forEach((n) => n.classList.remove('is-drop-target'));
  };

  container.addEventListener('dragstart', onDragStart);
  container.addEventListener('dragend', onDragEnd);

  return () => {
    container.removeEventListener('dragstart', onDragStart);
    container.removeEventListener('dragend', onDragEnd);
    initialized = false;
  };
}

/**
 * Attach drop zones to elements (e.g. sidebar categories).
 * @param {HTMLElement} zone
 * @param {{ categoryId?: string, tagId?: string, status?: string, onDrop?: (ids:string[])=>void }} target
 * @returns {() => void} detach
 */
export function makeDropZone(zone, target) {
  const enter = (ev) => {
    if (!ev.dataTransfer?.types?.includes('text/plain')) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
    zone.classList.add('is-drop-target');
  };
  const over = (ev) => {
    if (!ev.dataTransfer?.types?.includes('text/plain')) return;
    ev.preventDefault();
  };
  const leave = () => zone.classList.remove('is-drop-target');
  const drop = async (ev) => {
    ev.preventDefault();
    zone.classList.remove('is-drop-target');

    let ids = [];
    try {
      const raw = ev.dataTransfer.getData('application/x-lie-ids');
      if (raw) ids = JSON.parse(raw);
      else ids = String(ev.dataTransfer.getData('text/plain') || '').split(',').filter(Boolean);
    } catch { /* noop */ }
    if (!ids.length) return;

    try {
      if (target.categoryId !== undefined) {
        await liesService.bulkSetCategory(ids, target.categoryId);
        if (target.categoryId === null) toast.success(`${ids.length} مورد از دسته خارج شد.`);
        else toast.success(`${ids.length} مورد به دسته منتقل شد.`);
      } else if (target.status === 'archived') {
        await liesService.bulk(ids, 'archive');
        toast.success(`${ids.length} مورد بایگانی شد.`);
      } else if (target.status === 'trashed') {
        await liesService.bulk(ids, 'trash');
        toast.success(`${ids.length} مورد به سطل زباله رفت.`);
      } else if (target.status === 'active') {
        await liesService.bulk(ids, 'restore');
        toast.success(`${ids.length} مورد فعال شد.`);
      }
      target.onDrop?.(ids);
      bus.emit(EVENTS.LIES_REFRESHED);
    } catch (err) {
      toast.error(err.message || 'خطا در انتقال');
    }
  };

  zone.addEventListener('dragenter', enter);
  zone.addEventListener('dragover', over);
  zone.addEventListener('dragleave', leave);
  zone.addEventListener('drop', drop);
  zone.classList.add('is-dropzone');

  return () => {
    zone.removeEventListener('dragenter', enter);
    zone.removeEventListener('dragover', over);
    zone.removeEventListener('dragleave', leave);
    zone.removeEventListener('drop', drop);
  };
}

export default { initDragDrop, makeDropZone };