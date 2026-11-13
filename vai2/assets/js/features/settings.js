/* ============================================================
   NEXUS CHAT — SETTINGS PANEL
   Fully-featured settings UI for OpenRouter chat parameters.

   Exposes:
     window.Nexus.Settings.open()
     window.Nexus.Settings.close()
     window.Nexus.Settings.toggle()
     window.Nexus.Settings.get()          -> params object
     window.Nexus.Settings.getExtraParams() -> only request-body additions
     window.Nexus.Settings.getSystemPrompt() -> string | null
     window.Nexus.Settings.reset()

   Persists to localStorage key: nexus_settings_v1
   Applies theme/accent/fontSize/density/fontFamily live via
   document.documentElement.dataset.
   ============================================================ */
(function () {
  'use strict';

  const STORAGE_KEY = 'nexus_settings_v1';

  /* ---------- Defaults ---------- */
  const DEFAULTS = {
    // Generation params
    temperature: 0.7,
    top_p: 1.0,
    top_k: 0,
    max_tokens: 0,            // 0 = model default
    frequency_penalty: 0.0,
    presence_penalty: 0.0,
    repetition_penalty: 1.0,
    seed: null,
    stop: '',                 // comma-separated

    // Behaviour
    stream: true,
    autoScroll: true,
    autoTitle: true,
    autoSave: true,
    sendOnEnter: true,
    showTimestamps: false,
    showTokenCounts: true,
    showModelTag: true,

    // System prompt
    systemPrompt: '',

    // UI
    theme: 'dark',
    accent: 'violet',
    fontSize: 'md',
    density: 'comfortable',
    fontFamily: 'inter',

    // Advanced (raw params)
    rawParams: '',            // user can paste JSON to merge into request
  };

  /* ---------- State ---------- */
  let current = null;
  let panelEl = null;
  let rootEl = null;
  let listeners = [];

  /* ---------- Storage ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULTS, ...parsed };
      }
    } catch (e) {
      console.warn('Settings load failed:', e);
    }
    return { ...DEFAULTS };
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch (e) {
      console.warn('Settings save failed:', e);
    }
    notify();
  }

  function notify() {
    for (const fn of listeners) {
      try { fn(current); } catch (e) { console.warn('Settings listener error:', e); }
    }
  }

  /* ---------- Apply UI themes ---------- */
  function applyTheme() {
    const html = document.documentElement;
    html.dataset.theme = current.theme || 'dark';
    html.dataset.accent = current.accent || 'violet';
    html.dataset.fontSize = current.fontSize || 'md';
    html.dataset.density = current.density || 'comfortable';
    html.dataset.fontFamily = current.fontFamily || 'inter';
  }

  /* ---------- Element helpers ---------- */
  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === 'class') e.className = attrs[k];
        else if (k === 'style') e.setAttribute('style', attrs[k]);
        else if (k.startsWith('on') && typeof attrs[k] === 'function') {
          e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else if (k === 'text') {
          e.textContent = attrs[k];
        } else if (k === 'html') {
          e.innerHTML = attrs[k];
        } else if (k === 'dataset' && typeof attrs[k] === 'object') {
          Object.assign(e.dataset, attrs[k]);
        } else {
          e.setAttribute(k, attrs[k]);
        }
      }
    }
    if (children) {
      for (const c of [].concat(children)) {
        if (c == null) continue;
        if (typeof c === 'string') e.appendChild(document.createTextNode(c));
        else e.appendChild(c);
      }
    }
    return e;
  }

  /* ---------- Field builders ---------- */
  function fieldGroup(title) {
    return el('div', { class: 'settings-group' }, [
      el('div', { class: 'settings-group-title', text: title }),
    ]);
  }

  function rangeField({ label, hint, min, max, step, value, onChange, format }) {
    const valueEl = el('span', { class: 'value', text: format ? format(value) : value });
    const range = el('input', {
      type: 'range',
      class: 'settings-range',
      min, max, step, value,
    });
    range.addEventListener('input', () => {
      const v = parseFloat(range.value);
      valueEl.textContent = format ? format(v) : v;
      onChange(v);
    });
    return el('div', { class: 'settings-field' }, [
      el('div', { class: 'settings-label' }, [label, valueEl]),
      range,
      hint ? el('div', { class: 'settings-hint', text: hint }) : null,
    ]);
  }

  function textField({ label, hint, value, placeholder, multiline, monospace, onChange }) {
    const input = el(multiline ? 'textarea' : 'input', {
      class: multiline ? 'settings-textarea' : 'settings-input',
      placeholder: placeholder || '',
      style: monospace ? 'font-family:var(--font-mono);' : '',
    });
    if (multiline) input.value = value || '';
    else input.value = value || '';
    input.addEventListener('input', () => onChange(input.value));
    return el('div', { class: 'settings-field' }, [
      el('div', { class: 'settings-label' }, [label]),
      input,
      hint ? el('div', { class: 'settings-hint', text: hint }) : null,
    ]);
  }

  function toggleField({ label, description, value, onChange }) {
    const tog = el('div', {
      class: 'settings-toggle' + (value ? ' on' : ''),
      role: 'switch',
      tabindex: '0',
    });
    const flip = () => {
      const next = !tog.classList.contains('on');
      tog.classList.toggle('on', next);
      tog.setAttribute('aria-checked', String(next));
      onChange(next);
    };
    tog.addEventListener('click', flip);
    tog.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
    });
    return el('div', { class: 'settings-toggle-row' }, [
      el('div', {}, [
        el('div', { class: 'settings-toggle-label', text: label }),
        description ? el('div', { class: 'settings-toggle-desc', text: description }) : null,
      ]),
      tog,
    ]);
  }

  function selectField({ label, hint, options, value, onChange }) {
    const sel = el('select', { class: 'settings-input' });
    for (const opt of options) {
      const o = el('option', { value: opt.value }, opt.label);
      sel.appendChild(o);
    }
    sel.value = value;
    sel.addEventListener('change', () => onChange(sel.value));
    return el('div', { class: 'settings-field' }, [
      el('div', { class: 'settings-label' }, [label]),
      sel,
      hint ? el('div', { class: 'settings-hint', text: hint }) : null,
    ]);
  }

  function themePicker() {
    const themes = [
      { id: 'dark', label: 'Dark' },
      { id: 'light', label: 'Light' },
      { id: 'midnight', label: 'Midnight' },
      { id: 'rose', label: 'Rose' },
      { id: 'nord', label: 'Nord' },
      { id: 'high-contrast', label: 'Contrast' },
    ];
    const grid = el('div', { class: 'theme-grid' });
    themes.forEach(t => {
      const opt = el('div', {
        class: 'theme-option' + (current.theme === t.id ? ' active' : ''),
        dataset: { theme: t.id },
      }, [
        el('div', { class: 'theme-swatch ' + t.id }),
        el('div', { text: t.label }),
      ]);
      opt.addEventListener('click', () => {
        current.theme = t.id;
        grid.querySelectorAll('.theme-option').forEach(n => n.classList.toggle('active', n.dataset.theme === t.id));
        applyTheme();
        save();
      });
      grid.appendChild(opt);
    });
    return grid;
  }

  function accentPicker() {
    const accents = ['violet', 'blue', 'green', 'rose', 'orange', 'cyan', 'amber'];
    const grid = el('div', { class: 'accent-grid' });
    accents.forEach(a => {
      const opt = el('div', {
        class: 'accent-option accent-' + a + (current.accent === a ? ' active' : ''),
        dataset: { accent: a },
        title: a,
      });
      opt.addEventListener('click', () => {
        current.accent = a;
        grid.querySelectorAll('.accent-option').forEach(n => n.classList.toggle('active', n.dataset.accent === a));
        applyTheme();
        save();
      });
      grid.appendChild(opt);
    });
    return grid;
  }

  /* ---------- Panel construction ---------- */
  function buildPanel() {
    const body = el('div', { class: 'settings-panel-body' });

    /* ---- Appearance ---- */
    const appearanceGroup = fieldGroup('Appearance');
    appearanceGroup.appendChild(el('div', { class: 'settings-field' }, [
      el('div', { class: 'settings-label' }, ['Theme']),
      themePicker(),
    ]));
    appearanceGroup.appendChild(el('div', { class: 'settings-field' }, [
      el('div', { class: 'settings-label' }, ['Accent color']),
      accentPicker(),
    ]));
    appearanceGroup.appendChild(selectField({
      label: 'Font size',
      options: [
        { value: 'sm', label: 'Small (13px)' },
        { value: 'md', label: 'Medium (14px)' },
        { value: 'lg', label: 'Large (15px)' },
        { value: 'xl', label: 'Extra large (17px)' },
      ],
      value: current.fontSize,
      onChange: (v) => { current.fontSize = v; applyTheme(); save(); },
    }));
    appearanceGroup.appendChild(selectField({
      label: 'Density',
      options: [
        { value: 'compact', label: 'Compact' },
        { value: 'comfortable', label: 'Comfortable' },
        { value: 'spacious', label: 'Spacious' },
      ],
      value: current.density,
      onChange: (v) => { current.density = v; applyTheme(); save(); },
    }));
    appearanceGroup.appendChild(selectField({
      label: 'Font family',
      options: [
        { value: 'inter', label: 'Inter' },
        { value: 'system', label: 'System' },
        { value: 'serif', label: 'Serif' },
        { value: 'mono', label: 'Monospace' },
      ],
      value: current.fontFamily,
      onChange: (v) => { current.fontFamily = v; applyTheme(); save(); },
    }));
    body.appendChild(appearanceGroup);

    /* ---- Generation ---- */
    const genGroup = fieldGroup('Generation');
    genGroup.appendChild(rangeField({
      label: 'Temperature',
      hint: 'Higher = more creative; lower = more focused. (0.0 – 2.0)',
      min: 0, max: 2, step: 0.01, value: current.temperature,
      format: v => v.toFixed(2),
      onChange: v => { current.temperature = v; save(); },
    }));
    genGroup.appendChild(rangeField({
      label: 'Top P',
      hint: 'Nucleus sampling. 1.0 disables. (0.0 – 1.0)',
      min: 0, max: 1, step: 0.01, value: current.top_p,
      format: v => v.toFixed(2),
      onChange: v => { current.top_p = v; save(); },
    }));
    genGroup.appendChild(rangeField({
      label: 'Top K',
      hint: '0 disables. (0 – 100)',
      min: 0, max: 100, step: 1, value: current.top_k,
      format: v => String(v),
      onChange: v => { current.top_k = v; save(); },
    }));
    genGroup.appendChild(textField({
      label: 'Max tokens',
      hint: '0 = model default. Set to limit response length.',
      value: String(current.max_tokens),
      placeholder: '0',
      onChange: v => {
        const n = parseInt(v, 10);
        current.max_tokens = isNaN(n) || n < 0 ? 0 : n;
        save();
      },
    }));
    genGroup.appendChild(rangeField({
      label: 'Frequency penalty',
      hint: 'Reduce repetition of tokens. (-2.0 – 2.0)',
      min: -2, max: 2, step: 0.01, value: current.frequency_penalty,
      format: v => v.toFixed(2),
      onChange: v => { current.frequency_penalty = v; save(); },
    }));
    genGroup.appendChild(rangeField({
      label: 'Presence penalty',
      hint: 'Encourage new topics. (-2.0 – 2.0)',
      min: -2, max: 2, step: 0.01, value: current.presence_penalty,
      format: v => v.toFixed(2),
      onChange: v => { current.presence_penalty = v; save(); },
    }));
    genGroup.appendChild(rangeField({
      label: 'Repetition penalty',
      hint: 'Only used by some providers. (1.0 – 2.0)',
      min: 1, max: 2, step: 0.01, value: current.repetition_penalty,
      format: v => v.toFixed(2),
      onChange: v => { current.repetition_penalty = v; save(); },
    }));
    body.appendChild(genGroup);

    /* ---- System prompt ---- */
    const sysGroup = fieldGroup('System prompt');
    sysGroup.appendChild(textField({
      label: 'Injected as the first message with role "system"',
      hint: 'Leave empty to omit. Sent verbatim to the model.',
      value: current.systemPrompt,
      placeholder: 'You are a helpful assistant…',
      multiline: true,
      monospace: true,
      onChange: v => { current.systemPrompt = v; save(); },
    }));
    body.appendChild(sysGroup);

    /* ---- Behaviour ---- */
    const behaviorGroup = fieldGroup('Behaviour');
    behaviorGroup.appendChild(toggleField({
      label: 'Stream responses',
      description: 'Show tokens as they arrive.',
      value: current.stream,
      onChange: v => { current.stream = v; save(); },
    }));
    behaviorGroup.appendChild(toggleField({
      label: 'Auto scroll',
      description: 'Scroll to newest message automatically.',
      value: current.autoScroll,
      onChange: v => { current.autoScroll = v; save(); },
    }));
    behaviorGroup.appendChild(toggleField({
      label: 'Auto title',
      description: 'Use the first message as the chat title.',
      value: current.autoTitle,
      onChange: v => { current.autoTitle = v; save(); },
    }));
    behaviorGroup.appendChild(toggleField({
      label: 'Auto save',
      description: 'Persist chats to localStorage.',
      value: current.autoSave,
      onChange: v => { current.autoSave = v; save(); },
    }));
    behaviorGroup.appendChild(toggleField({
      label: 'Send on Enter',
      description: 'Off = Shift+Enter sends, Enter adds newline.',
      value: current.sendOnEnter,
      onChange: v => { current.sendOnEnter = v; save(); },
    }));
    behaviorGroup.appendChild(toggleField({
      label: 'Show timestamps',
      description: 'Display time under each message.',
      value: current.showTimestamps,
      onChange: v => { current.showTimestamps = v; save(); },
    }));
    behaviorGroup.appendChild(toggleField({
      label: 'Show model tag',
      description: 'Display the model id on assistant messages.',
      value: current.showModelTag,
      onChange: v => { current.showModelTag = v; save(); },
    }));
    body.appendChild(behaviorGroup);

    /* ---- Advanced ---- */
    const advGroup = fieldGroup('Advanced');
    advGroup.appendChild(textField({
      label: 'Extra request body (JSON)',
      hint: 'Merged into the outgoing request body. Invalid JSON is ignored. Use with care.',
      value: current.rawParams,
      placeholder: '{"seed": 42, "stop": ["\\n\\n"]}',
      multiline: true,
      monospace: true,
      onChange: v => { current.rawParams = v; save(); },
    }));
    body.appendChild(advGroup);

    /* ---- Footer buttons ---- */
    const footer = el('div', { class: 'settings-panel-footer' }, [
      (() => {
        const b = el('button', { class: 'btn ghost', type: 'button' }, ['Reset defaults']);
        b.addEventListener('click', () => {
          if (!confirm('Reset all settings to defaults?')) return;
          current = { ...DEFAULTS };
          applyTheme();
          save();
          render();
        });
        return b;
      })(),
      el('div', { style: 'flex:1' }),
      (() => {
        const b = el('button', { class: 'btn primary', type: 'button' }, ['Done']);
        b.addEventListener('click', close);
        return b;
      })(),
    ]);

    const header = el('div', { class: 'settings-panel-header' }, [
      el('div', { class: 'settings-panel-title' }, [
        (() => {
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('width', '16'); svg.setAttribute('height', '16');
          svg.setAttribute('viewBox', '0 0 16 16');
          svg.setAttribute('fill', 'none');
          svg.setAttribute('stroke', 'currentColor');
          svg.setAttribute('stroke-width', '1.5');
          svg.innerHTML = '<circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3"/>';
          return svg;
        })(),
        'Settings',
      ]),
      (() => {
        const b = el('button', {
          class: 'modal-close', type: 'button', 'aria-label': 'Close',
        }, ['×']);
        b.addEventListener('click', close);
        return b;
      })(),
    ]);

    const panel = el('aside', { class: 'settings-panel', id: 'settingsPanel' }, [
      header, body, footer,
    ]);
    return panel;
  }

  /* ---------- Render into DOM ---------- */
  function render() {
    if (panelEl && panelEl.parentNode) {
      panelEl.parentNode.removeChild(panelEl);
    }
    panelEl = buildPanel();
    rootEl.appendChild(panelEl);
  }

  /* ---------- Public API ---------- */
  function open() {
    if (!rootEl) rootEl = document.body;
    if (!panelEl) render();
    requestAnimationFrame(() => panelEl.classList.add('open'));
  }

  function close() {
    if (panelEl) panelEl.classList.remove('open');
  }

  function toggle() {
    if (!panelEl) return open();
    if (panelEl.classList.contains('open')) close();
    else open();
  }

  function get() {
    return { ...current };
  }

  /**
   * Returns only the extra body parameters for OpenRouter request body.
   * Omits keys set to their "inactive" defaults so we don't override
   * model defaults unnecessarily.
   */
  function getExtraParams() {
    const out = {};

    if (typeof current.temperature === 'number' && current.temperature !== DEFAULTS.temperature) {
      out.temperature = current.temperature;
    }
    if (typeof current.top_p === 'number' && current.top_p !== DEFAULTS.top_p) {
      out.top_p = current.top_p;
    }
    if (typeof current.top_k === 'number' && current.top_k > 0) {
      out.top_k = current.top_k;
    }
    if (typeof current.max_tokens === 'number' && current.max_tokens > 0) {
      out.max_tokens = current.max_tokens;
    }
    if (typeof current.frequency_penalty === 'number' && current.frequency_penalty !== 0) {
      out.frequency_penalty = current.frequency_penalty;
    }
    if (typeof current.presence_penalty === 'number' && current.presence_penalty !== 0) {
      out.presence_penalty = current.presence_penalty;
    }
    if (typeof current.repetition_penalty === 'number' && current.repetition_penalty !== 1) {
      out.repetition_penalty = current.repetition_penalty;
    }
    if (current.seed != null && !isNaN(parseInt(current.seed, 10))) {
      out.seed = parseInt(current.seed, 10);
    }
    if (current.stop && String(current.stop).trim()) {
      out.stop = String(current.stop).split(',').map(s => s.trim()).filter(Boolean);
    }

    // Merge raw JSON params (advanced)
    if (current.rawParams && current.rawParams.trim()) {
      try {
        const parsed = JSON.parse(current.rawParams);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          Object.assign(out, parsed);
        }
      } catch (e) {
        // Silently ignore invalid JSON — user sees the error via hint text if needed
        console.debug('Invalid advanced params JSON:', e.message);
      }
    }

    return out;
  }

  function getSystemPrompt() {
    const s = (current.systemPrompt || '').trim();
    return s || null;
  }

  function reset() {
    current = { ...DEFAULTS };
    applyTheme();
    save();
    render();
  }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
    return () => {
      listeners = listeners.filter(l => l !== fn);
    };
  }

  /* ---------- Init ---------- */
  function init() {
    current = load();
    applyTheme();

    // Add settings icon button to top bar if a placeholder exists
    const topBarRight = document.querySelector('.top-bar-right');
    if (topBarRight) {
      const btn = document.createElement('button');
      btn.className = 'icon-btn';
      btn.id = 'settingsBtn';
      btn.title = 'Settings';
      btn.setAttribute('aria-label', 'Open settings');
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="8" cy="8" r="2.5"/>
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3"/>
        </svg>`;
      btn.addEventListener('click', toggle);
      // Insert before the "new chat" button if present, else append
      const newChatBtn = topBarRight.querySelector('#newChatBtn');
      if (newChatBtn) topBarRight.insertBefore(btn, newChatBtn);
      else topBarRight.appendChild(btn);
    }
  }

  /* ---------- Expose ---------- */
  window.Nexus = window.Nexus || {};
  window.Nexus.Settings = {
    init,
    open,
    close,
    toggle,
    get,
    getExtraParams,
    getSystemPrompt,
    reset,
    onChange,
    DEFAULTS: { ...DEFAULTS },
  };
})();
