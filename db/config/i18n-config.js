/**
 * پیکربندی تم‌ها
 * شامل تمام متغیرهای CSS برای تم‌های مختلف
 */
const ThemeConfig = {
  // تم تاریک (پیش‌فرض)
  dark: {
    // رنگ‌های اصلی
    '--color-primary': '#6366f1',
    '--color-primary-hover': '#818cf8',
    '--color-primary-active': '#4f46e5',
    '--color-primary-light': 'rgba(99, 102, 241, 0.15)',
    '--color-primary-dark': '#4338ca',

    '--color-secondary': '#8b5cf6',
    '--color-secondary-hover': '#a78bfa',
    '--color-secondary-active': '#7c3aed',

    '--color-success': '#22c55e',
    '--color-success-hover': '#4ade80',
    '--color-success-light': 'rgba(34, 197, 94, 0.15)',

    '--color-warning': '#f59e0b',
    '--color-warning-hover': '#fbbf24',
    '--color-warning-light': 'rgba(245, 158, 11, 0.15)',

    '--color-danger': '#ef4444',
    '--color-danger-hover': '#f87171',
    '--color-danger-light': 'rgba(239, 68, 68, 0.15)',

    '--color-info': '#3b82f6',
    '--color-info-hover': '#60a5fa',
    '--color-info-light': 'rgba(59, 130, 246, 0.15)',

    // رنگ‌های پس‌زمینه
    '--bg-primary': '#0f172a',
    '--bg-secondary': '#1e293b',
    '--bg-tertiary': '#334155',
    '--bg-elevated': '#1e293b',
    '--bg-overlay': 'rgba(15, 23, 42, 0.8)',
    '--bg-hover': 'rgba(255, 255, 255, 0.05)',
    '--bg-active': 'rgba(255, 255, 255, 0.1)',
    '--bg-selected': 'rgba(99, 102, 241, 0.2)',
    '--bg-disabled': 'rgba(255, 255, 255, 0.03)',

    // رنگ‌های متن
    '--text-primary': '#f1f5f9',
    '--text-secondary': '#cbd5e1',
    '--text-tertiary': '#94a3b8',
    '--text-disabled': '#64748b',
    '--text-inverse': '#0f172a',
    '--text-link': '#818cf8',
    '--text-link-hover': '#a5b4fc',

    // رنگ‌های حاشیه
    '--border-primary': '#334155',
    '--border-secondary': '#1e293b',
    '--border-focus': '#6366f1',
    '--border-hover': '#475569',
    '--border-disabled': '#1e293b',

    // سایه‌ها
    '--shadow-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    '--shadow-md': '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3)',
    '--shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',
    '--shadow-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
    '--shadow-glow': '0 0 20px rgba(99, 102, 241, 0.3)',

    // رنگ‌های جدول
    '--table-header-bg': '#1e293b',
    '--table-row-even': '#0f172a',
    '--table-row-odd': '#1a2332',
    '--table-row-hover': 'rgba(99, 102, 241, 0.1)',
    '--table-row-selected': 'rgba(99, 102, 241, 0.2)',
    '--table-border': '#334155',

    // رنگ‌های اسکرول‌بار
    '--scrollbar-track': '#0f172a',
    '--scrollbar-thumb': '#334155',
    '--scrollbar-thumb-hover': '#475569',

    // رنگ‌های کد
    '--code-bg': '#1e293b',
    '--code-text': '#e2e8f0',
    '--code-keyword': '#c084fc',
    '--code-string': '#86efac',
    '--code-number': '#fbbf24',
    '--code-comment': '#64748b',
    '--code-function': '#60a5fa',
    '--code-operator': '#f472b6'
  },

  // تم روشن
  light: {
    '--color-primary': '#4f46e5',
    '--color-primary-hover': '#6366f1',
    '--color-primary-active': '#4338ca',
    '--color-primary-light': 'rgba(79, 70, 229, 0.1)',
    '--color-primary-dark': '#3730a3',

    '--color-secondary': '#7c3aed',
    '--color-secondary-hover': '#8b5cf6',
    '--color-secondary-active': '#6d28d9',

    '--color-success': '#16a34a',
    '--color-success-hover': '#22c55e',
    '--color-success-light': 'rgba(22, 163, 74, 0.1)',

    '--color-warning': '#d97706',
    '--color-warning-hover': '#f59e0b',
    '--color-warning-light': 'rgba(217, 119, 6, 0.1)',

    '--color-danger': '#dc2626',
    '--color-danger-hover': '#ef4444',
    '--color-danger-light': 'rgba(220, 38, 38, 0.1)',

    '--color-info': '#2563eb',
    '--color-info-hover': '#3b82f6',
    '--color-info-light': 'rgba(37, 99, 235, 0.1)',

    '--bg-primary': '#ffffff',
    '--bg-secondary': '#f8fafc',
    '--bg-tertiary': '#f1f5f9',
    '--bg-elevated': '#ffffff',
    '--bg-overlay': 'rgba(0, 0, 0, 0.5)',
    '--bg-hover': 'rgba(0, 0, 0, 0.03)',
    '--bg-active': 'rgba(0, 0, 0, 0.06)',
    '--bg-selected': 'rgba(79, 70, 229, 0.1)',
    '--bg-disabled': 'rgba(0, 0, 0, 0.02)',

    '--text-primary': '#0f172a',
    '--text-secondary': '#334155',
    '--text-tertiary': '#64748b',
    '--text-disabled': '#94a3b8',
    '--text-inverse': '#ffffff',
    '--text-link': '#4f46e5',
    '--text-link-hover': '#6366f1',

    '--border-primary': '#e2e8f0',
    '--border-secondary': '#f1f5f9',
    '--border-focus': '#4f46e5',
    '--border-hover': '#cbd5e1',
    '--border-disabled': '#e2e8f0',

    '--shadow-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    '--shadow-md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    '--shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    '--shadow-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    '--shadow-glow': '0 0 20px rgba(79, 70, 229, 0.2)',

    '--table-header-bg': '#f8fafc',
    '--table-row-even': '#ffffff',
    '--table-row-odd': '#f8fafc',
    '--table-row-hover': 'rgba(79, 70, 229, 0.05)',
    '--table-row-selected': 'rgba(79, 70, 229, 0.1)',
    '--table-border': '#e2e8f0',

    '--scrollbar-track': '#f1f5f9',
    '--scrollbar-thumb': '#cbd5e1',
    '--scrollbar-thumb-hover': '#94a3b8',

    '--code-bg': '#f8fafc',
    '--code-text': '#1e293b',
    '--code-keyword': '#7c3aed',
    '--code-string': '#16a34a',
    '--code-number': '#d97706',
    '--code-comment': '#94a3b8',
    '--code-function': '#2563eb',
    '--code-operator': '#db2777'
  },

  // تم کنتراست بالا
  'high-contrast': {
    '--color-primary': '#ffff00',
    '--color-primary-hover': '#ffff66',
    '--color-primary-active': '#cccc00',
    '--color-primary-light': 'rgba(255, 255, 0, 0.2)',
    '--color-primary-dark': '#999900',

    '--color-secondary': '#00ffff',
    '--color-secondary-hover': '#66ffff',
    '--color-secondary-active': '#00cccc',

    '--color-success': '#00ff00',
    '--color-success-hover': '#66ff66',
    '--color-success-light': 'rgba(0, 255, 0, 0.2)',

    '--color-warning': '#ffaa00',
    '--color-warning-hover': '#ffcc66',
    '--color-warning-light': 'rgba(255, 170, 0, 0.2)',

    '--color-danger': '#ff0000',
    '--color-danger-hover': '#ff6666',
    '--color-danger-light': 'rgba(255, 0, 0, 0.2)',

    '--color-info': '#00ccff',
    '--color-info-hover': '#66ddff',
    '--color-info-light': 'rgba(0, 204, 255, 0.2)',

    '--bg-primary': '#000000',
    '--bg-secondary': '#1a1a1a',
    '--bg-tertiary': '#333333',
    '--bg-elevated': '#1a1a1a',
    '--bg-overlay': 'rgba(0, 0, 0, 0.9)',
    '--bg-hover': 'rgba(255, 255, 0, 0.1)',
    '--bg-active': 'rgba(255, 255, 0, 0.2)',
    '--bg-selected': 'rgba(255, 255, 0, 0.3)',
    '--bg-disabled': 'rgba(255, 255, 255, 0.05)',

    '--text-primary': '#ffffff',
    '--text-secondary': '#ffff99',
    '--text-tertiary': '#cccc00',
    '--text-disabled': '#666600',
    '--text-inverse': '#000000',
    '--text-link': '#00ffff',
    '--text-link-hover': '#66ffff',

    '--border-primary': '#ffff00',
    '--border-secondary': '#666600',
    '--border-focus': '#ffff00',
    '--border-hover': '#ffff66',
    '--border-disabled': '#333300',

    '--shadow-sm': '0 1px 2px 0 rgba(255, 255, 0, 0.2)',
    '--shadow-md': '0 4px 6px -1px rgba(255, 255, 0, 0.3)',
    '--shadow-lg': '0 10px 15px -3px rgba(255, 255, 0, 0.4)',
    '--shadow-xl': '0 20px 25px -5px rgba(255, 255, 0, 0.5)',
    '--shadow-glow': '0 0 20px rgba(255, 255, 0, 0.5)',

    '--table-header-bg': '#1a1a1a',
    '--table-row-even': '#000000',
    '--table-row-odd': '#0d0d0d',
    '--table-row-hover': 'rgba(255, 255, 0, 0.15)',
    '--table-row-selected': 'rgba(255, 255, 0, 0.3)',
    '--table-border': '#ffff00',

    '--scrollbar-track': '#000000',
    '--scrollbar-thumb': '#666600',
    '--scrollbar-thumb-hover': '#999900',

    '--code-bg': '#1a1a1a',
    '--code-text': '#ffffff',
    '--code-keyword': '#00ffff',
    '--code-string': '#00ff00',
    '--code-number': '#ffff00',
    '--code-comment': '#666600',
    '--code-function': '#ff00ff',
    '--code-operator': '#ff6666'
  }
};

// فریز کردن
Object.freeze(ThemeConfig);