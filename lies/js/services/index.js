/* ============================================================
   js/services/index.js
   Barrel export for all data services
   ============================================================ */

export * as authService        from './auth.service.js';
export * as categoriesService  from './categories.service.js';
export * as tagsService        from './tags.service.js';
export * as liesService        from './lies.service.js';
export * as reflectionsService from './reflections.service.js';
export * as statsService       from './stats.service.js';
export * as exportService      from './export.service.js';
export * as settingsService    from './settings.service.js';

/* Named re-exports for common usage */
export {
  list as listLies,
  getById as getLie,
  create as createLie,
  update as updateLie,
  trash as trashLie,
  restore as restoreLie,
  archive as archiveLie,
  hardDelete as hardDeleteLie,
  togglePin as togglePinLie,
  bulk as bulkLies,
  search as searchLies,
  duplicate as duplicateLie,
  counts as lieCounts,
  purgeTrash,
} from './lies.service.js';

export {
  list as listCategories,
  create as createCategory,
  update as updateCategory,
  remove as removeCategory,
  reorder as reorderCategories,
} from './categories.service.js';

export {
  list as listTags,
  create as createTag,
  update as updateTag,
  remove as removeTag,
  merge as mergeTags,
  withCounts as tagsWithCounts,
  setForLie as setLieTags,
} from './tags.service.js';