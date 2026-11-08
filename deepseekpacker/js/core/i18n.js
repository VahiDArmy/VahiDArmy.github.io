// AURORA OS — Internationalization

const STRINGS = {
  en: {
    'app.dashboard': 'Dashboard',
    'app.kanban': 'Kanban',
    'app.datagrid': 'Data Grid',
    'app.analytics': 'Analytics',
    'app.calendar': 'Calendar',
    'app.notes': 'Notes',
    'app.chat': 'Chat',
    'app.files': 'Files',
    'app.terminal': 'Terminal',
    'app.music': 'Music',
    'app.settings': 'Settings',
    'app.codepad': 'Code Pad',
    'common.close': 'Close',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.create': 'Create',
    'common.search': 'Search',
    'common.open': 'Open',
    'common.retry': 'Retry',
    'palette.placeholder': 'Search apps, files, commands',
    'palette.empty': 'No results',
    'notif.empty': 'You\'re all caught up.',
    'notif.clear': 'Clear all',
    'sysmenu.about': 'About AURORA',
    'sysmenu.settings': 'Settings',
    'sysmenu.lock': 'Lock screen',
    'sysmenu.reload': 'Reload',
  },
  es: {
    'app.dashboard': 'Panel',
    'app.kanban': 'Kanban',
    'app.datagrid': 'Tabla de datos',
    'app.analytics': 'Analítica',
    'app.calendar': 'Calendario',
    'app.notes': 'Notas',
    'app.chat': 'Chat',
    'app.files': 'Archivos',
    'app.terminal': 'Terminal',
    'app.music': 'Música',
    'app.settings': 'Ajustes',
    'app.codepad': 'Editor',
    'common.close': 'Cerrar',
    'common.cancel': 'Cancelar',
    'common.save': 'Guardar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.create': 'Crear',
    'common.search': 'Buscar',
    'common.open': 'Abrir',
    'common.retry': 'Reintentar',
    'palette.placeholder': 'Buscar apps, archivos, comandos',
    'palette.empty': 'Sin resultados',
    'notif.empty': 'Estás al día.',
    'notif.clear': 'Limpiar todo',
    'sysmenu.about': 'Acerca de AURORA',
    'sysmenu.settings': 'Ajustes',
    'sysmenu.lock': 'Bloquear',
    'sysmenu.reload': 'Recargar',
  },
};

let _locale = 'en';

export const i18n = {
  setLocale(loc) {
    if (STRINGS[loc]) _locale = loc;
  },
  getLocale() { return _locale; },
  t(key, fallback) {
    return STRINGS[_locale]?.[key] ?? STRINGS.en[key] ?? fallback ?? key;
  },
};

export default i18n;
