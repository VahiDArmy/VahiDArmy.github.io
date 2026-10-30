// کاتالوگ مدل‌های آزاد OpenRouter — به CONFIG اضافه می‌شود.
// این فایل باید بعد از js/config.js بارگذاری شود.
(function () {
  const MODELS = [
    {
      id: 'openrouter/free',
      provider: 'OpenRouter',
      name: 'انتخاب خودکار',
      auto: true,
      default: true,
      desc: 'اوپن‌روتر خودش از میان مدل‌های آزاد مناسب‌ترین را برای این پرسش برمی‌گزیند. مدل واقعی پس از پاسخ، در پایین کارت نمایش داده می‌شود و همان امتیاز می‌گیرد.',
    },
    {
      id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      provider: 'NVIDIA', name: 'Nemotron 3 Ultra',
      ctx: '1M', size: '550B', tps: 44,
      desc: 'پرقدرت‌ترین گزینه — پیشنهاد اول برای تحلیل چندلایه و پاسخ‌های عمیق.',
      star: true,
    },
    {
      id: 'inclusionai/ling-3.0-flash-fin:free',
      provider: 'InclusionAI', name: 'Ling 3.0 Flash Fin',
      ctx: '262K', size: '1.23T', tps: 147,
      desc: 'سریع و متعادل — مناسب استفادهٔ روزمره و پرسش‌های کوتاه.',
      star: true,
    },
    {
      id: 'nvidia/nemotron-3-super-120b-a12b:free',
      provider: 'NVIDIA', name: 'Nemotron 3 Super',
      ctx: '262K', size: '332B', tps: 71,
      desc: 'تعادل خوب میان کیفیت و سرعت — گزینهٔ مطمئن برای اکثر پرسش‌ها.',
      star: true,
    },
    {
      id: 'inclusionai/ling-3.0-flash-sante:free',
      provider: 'InclusionAI', name: 'Ling 3.0 Flash Sante',
      ctx: '262K', size: '329B', tps: 147,
      desc: 'سرعت بالا با تحلیل قابل قبول — مناسب پرسش‌های تحلیلی سبک.',
    },
    {
      id: 'qwen/qwen3.8-27b:free',
      provider: 'Qwen', name: 'Qwen 3.8 27B',
      ctx: '128K', size: '27B', tps: 110,
      desc: 'چندزبانه و متعادل — پاسخ‌های روان فارسی.',
    },
    {
      id: 'google/gemma-4-31b-it:free',
      provider: 'Google', name: 'Gemma 4 31B',
      ctx: '128K', size: '31B', tps: 88,
      desc: 'مدل باز گوگل — دقت بالا در متن‌های دینی و ادبی.',
    },
    {
      id: 'google/gemma-4-26b-a4b-it:free',
      provider: 'Google', name: 'Gemma 4 26B',
      ctx: '128K', size: '26B', tps: 105,
      desc: 'نسخهٔ سبک‌تر Gemma — سریع و روان.',
    },
    {
      id: 'nvidia/nemotron-3.5-lightning:free',
      provider: 'NVIDIA', name: 'Nemotron 3.5 Lightning',
      ctx: '128K', size: '24B', tps: 210,
      desc: 'برق‌آسا — پاسخ‌های کوتاه و فوری.',
    },
    {
      id: 'nvidia/nemotron-3.5-content-safety:free',
      provider: 'NVIDIA', name: 'Nemotron 3.5 Content Safety',
      ctx: '128K', size: '12B', tps: 90,
      desc: 'بررسی محتوا — تحلیل با احتیاط بیشتر.',
    },
    {
      id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      provider: 'NVIDIA', name: 'Nemotron 3 Nano Omni',
      ctx: '32K', size: '30B', tps: 130,
      desc: 'استدلال سبک — مناسب پرسش‌های منطقی و دقیق.',
    },
    {
      id: 'poolside/laguna-s-2.1:free',
      provider: 'Poolside', name: 'Laguna S 2.1',
      ctx: '128K', size: '70B', tps: 88,
      desc: 'پاسخ‌های دقیق — مناسب پرسش‌های فنی و ساختاریافته.',
    },
    {
      id: 'poolside/laguna-xs-2.1:free',
      provider: 'Poolside', name: 'Laguna XS 2.1',
      ctx: '64K', size: '9B', tps: 180,
      desc: 'کوچک و سریع — مناسب پرسش‌های کوتاه.',
    },
    {
      id: 'cohere/north-mini-code:free',
      provider: 'Cohere', name: 'North Mini Code',
      ctx: '32K', size: '8B', tps: 95,
      desc: 'سبک — مناسب پرسش‌های مستقیم و کوتاه.',
    },
    {
      id: 'dots-studio/dots-3-note-preview:free',
      provider: 'Dots Studio', name: 'Dots 3 Note',
      ctx: '64K', size: '12B', tps: 62,
      desc: 'سبک و چابک — پیش‌نمایش سریع ایده‌ها.',
    },
    {
      id: 'liquid/lfm-2.5-2.6b:free',
      provider: 'Liquid', name: 'LFM 2.5 2.6B',
      ctx: '32K', size: '2.6B', tps: 260,
      desc: 'بسیار سبک — پاسخ فوری برای پرسش‌های ساده.',
    },
  ];

  window.CONFIG = window.CONFIG || {};
  CONFIG.OPENROUTER_MODELS = MODELS;
  CONFIG.OPENROUTER_DEFAULT_MODEL =
    (MODELS.find((m) => m.default) || MODELS[0]).id;
})();