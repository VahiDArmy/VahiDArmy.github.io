/* ==========================================================================
   Config — Fit Types
   Single source of truth for every supported fit.
   ========================================================================== */

(function (window) {
  'use strict';

  const App = (window.App = window.App || {});

  /**
   * Fit type definition shape:
   * {
   *   id: string,
   *   name: string,               // Persian display name
   *   shortName: string,          // for compact UI
   *   equationLabel: string,      // formula string for display
   *   description: string,        // Persian help text
   *   badgeClass: string,         // badge--fit-*
   *   icon: string,               // inline SVG string
   *   params: [                   // parameter definitions
   *     {
   *       key: string,            // 'a', 'b', 'order', 'window'
   *       label: string,          // display label (usually the symbol)
   *       description: string,
   *       type: 'number' | 'int',
   *       default: number,
   *       min?: number,
   *       max?: number,
   *       step?: number,
   *       editable?: boolean,     // user can override initial guess
   *       fixed?: boolean,        // user can toggle "set intercept" (lock)
   *       interceptCandidate?: boolean
   *     }
   *   ],
   *   constraints: {              // data-domain requirements
   *     xPositive?: boolean,
   *     yPositive?: boolean,
   *     minXForLog?: boolean,
   *     minPoints?: number        // absolute minimum data points
   *   },
   *   supportsInterceptToggle: boolean,
   *   supportsPrediction: boolean
   * }
   */

  const ICONS = {
    linear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="3" y1="21" x2="21" y2="3"/>
      <circle cx="6" cy="18" r="1.5" fill="currentColor"/>
      <circle cx="18" cy="6" r="1.5" fill="currentColor"/>
    </svg>`,
    exponential: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 20 Q 10 20, 21 4"/>
      <circle cx="21" cy="4" r="1.5" fill="currentColor"/>
    </svg>`,
    logarithmic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 20 C 8 20, 10 6, 21 6"/>
      <circle cx="21" cy="6" r="1.5" fill="currentColor"/>
    </svg>`,
    polynomial: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 18 Q 8 2, 12 12 T 21 4"/>
    </svg>`,
    power: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 20 C 6 8, 12 6, 21 4"/>
      <circle cx="21" cy="4" r="1.5" fill="currentColor"/>
    </svg>`,
    movingAverage: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 15 L 7 8 L 11 17 L 15 6 L 19 13 L 21 9"/>
      <path d="M3 19 L 7 13 L 11 20 L 15 11 L 19 17 L 21 15" stroke-dasharray="2 2" opacity="0.5"/>
    </svg>`
  };

  App.FitTypes = {
    LINEAR: 'linear',
    EXPONENTIAL: 'exponential',
    LOGARITHMIC: 'logarithmic',
    POLYNOMIAL: 'polynomial',
    POWER: 'power',
    MOVING_AVERAGE: 'moving-average'
  };

  App.FitTypeDefinitions = [
    {
      id: App.FitTypes.LINEAR,
      name: 'خطی',
      shortName: 'خطی',
      equationLabel: 'y = a·x + b',
      description: 'برازش خط راست به داده‌ها با روش کمترین مربعات. ساده‌ترین و پرکاربردترین نوع برازش.',
      badgeClass: 'badge--fit-linear',
      icon: ICONS.linear,
      params: [
        {
          key: 'a',
          label: 'a (شیب)',
          description: 'شیب خط — تغییر y به ازای هر واحد x',
          type: 'number',
          default: null,
          editable: false,
          fixed: false
        },
        {
          key: 'b',
          label: 'b (عرض از مبدأ)',
          description: 'مقدار y در نقطه x = 0',
          type: 'number',
          default: null,
          editable: true,
          fixed: true,
          interceptCandidate: true
        }
      ],
      constraints: { minPoints: 2 },
      supportsInterceptToggle: true,
      supportsPrediction: true
    },

    {
      id: App.FitTypes.EXPONENTIAL,
      name: 'نمایی',
      shortName: 'نمایی',
      equationLabel: 'y = a·e^(b·x)',
      description: 'برازش منحنی نمایی. مناسب برای داده‌هایی که با نرخ ثابت رشد یا افت می‌کنند (رشد جمعیت، واپاشی، بهره مرکب).',
      badgeClass: 'badge--fit-exponential',
      icon: ICONS.exponential,
      params: [
        {
          key: 'a',
          label: 'a (ضریب)',
          description: 'مقدار y در نقطه x = 0',
          type: 'number',
          default: null,
          editable: true,
          fixed: false
        },
        {
          key: 'b',
          label: 'b (نرخ)',
          description: 'نرخ رشد یا افت — مثبت: رشد، منفی: افت',
          type: 'number',
          default: null,
          editable: false,
          fixed: false
        }
      ],
      constraints: { yPositive: true, minPoints: 2 },
      supportsInterceptToggle: false,
      supportsPrediction: true
    },

    {
      id: App.FitTypes.LOGARITHMIC,
      name: 'لگاریتمی',
      shortName: 'لگاریتمی',
      equationLabel: 'y = a·ln(x) + b',
      description: 'برازش منحنی لگاریتمی. مناسب برای داده‌هایی با رشد سریع در ابتدا و کندشدن تدریجی.',
      badgeClass: 'badge--fit-logarithmic',
      icon: ICONS.logarithmic,
      params: [
        {
          key: 'a',
          label: 'a (ضریب)',
          description: 'ضریب جمله لگاریتمی',
          type: 'number',
          default: null,
          editable: false,
          fixed: false
        },
        {
          key: 'b',
          label: 'b (عرض از مبدأ)',
          description: 'مقدار y در نقطه x = 1',
          type: 'number',
          default: null,
          editable: true,
          fixed: true,
          interceptCandidate: true
        }
      ],
      constraints: { xPositive: true, minPoints: 2 },
      supportsInterceptToggle: true,
      supportsPrediction: true
    },

    {
      id: App.FitTypes.POLYNOMIAL,
      name: 'چندجمله‌ای',
      shortName: 'چندجمله‌ای',
      equationLabel: 'y = a₀ + a₁·x + a₂·x² + …',
      description: 'برازش چندجمله‌ای با درجهٔ دلخواه. درجه ۲ سهمی، درجه ۳ مکعبی و به همین ترتیب. هر چه درجه بالاتر، منحنی انعطاف‌پذیرتر اما احتمال بیش‌برازش بیشتر.',
      badgeClass: 'badge--fit-polynomial',
      icon: ICONS.polynomial,
      params: [
        {
          key: 'order',
          label: 'درجه',
          description: 'درجه چندجمله‌ای (بین ۱ تا ۱۰)',
          type: 'int',
          default: 2,
          min: 1,
          max: 10,
          step: 1,
          editable: true,
          fixed: false
        },
        {
          key: 'intercept',
          label: 'عرض از مبدأ',
          description: 'مقدار y در نقطه x = 0',
          type: 'number',
          default: null,
          editable: true,
          fixed: true,
          interceptCandidate: true
        }
      ],
      constraints: { minPoints: 3 },
      supportsInterceptToggle: true,
      supportsPrediction: true
    },

    {
      id: App.FitTypes.POWER,
      name: 'توانی',
      shortName: 'توانی',
      equationLabel: 'y = a·x^b',
      description: 'برازش تابع توانی. مناسب برای داده‌هایی با رابطهٔ مقیاس‌پذیر (قوانین توانی، رابطهٔ غیرخطی مثبت).',
      badgeClass: 'badge--fit-power',
      icon: ICONS.power,
      params: [
        {
          key: 'a',
          label: 'a (ضریب)',
          description: 'ضریب مقیاس',
          type: 'number',
          default: null,
          editable: true,
          fixed: false
        },
        {
          key: 'b',
          label: 'b (نما)',
          description: 'نما یا توان',
          type: 'number',
          default: null,
          editable: false,
          fixed: false
        }
      ],
      constraints: { xPositive: true, yPositive: true, minPoints: 2 },
      supportsInterceptToggle: false,
      supportsPrediction: true
    },

    {
      id: App.FitTypes.MOVING_AVERAGE,
      name: 'میانگین متحرک',
      shortName: 'میانگین متحرک',
      equationLabel: 'ŷᵢ = میانگین(yᵢ₋ₖ … yᵢ)',
      description: 'هموارسازی داده‌ها با میانگین متحرک سادهٔ پنجرهٔ k. مناسب برای حذف نویز و آشکارسازی روند. این روش یک «برازش» نیست بلکه پردازش داده است.',
      badgeClass: 'badge--fit-moving-average',
      icon: ICONS.movingAverage,
      params: [
        {
          key: 'window',
          label: 'اندازهٔ پنجره',
          description: 'تعداد نقاط در هر پنجره (بین ۲ تا ۱۰۰)',
          type: 'int',
          default: 3,
          min: 2,
          max: 100,
          step: 1,
          editable: true,
          fixed: false
        }
      ],
      constraints: { minPoints: 3 },
      supportsInterceptToggle: false,
      supportsPrediction: false
    }
  ];

  /* Convenient lookups */
  App.getFitDefinition = function (id) {
    return App.FitTypeDefinitions.find((d) => d.id === id) || null;
  };

  App.getDefaultFitParams = function (id) {
    const def = App.getFitDefinition(id);
    if (!def) return {};
    const out = {};
    def.params.forEach((p) => {
      out[p.key] = p.default;
    });
    return out;
  };

  App.getFitBadgeClass = function (id) {
    const def = App.getFitDefinition(id);
    return def ? def.badgeClass : 'badge--neutral';
  };

  App.getFitName = function (id) {
    const def = App.getFitDefinition(id);
    return def ? def.name : id;
  };
})(window);