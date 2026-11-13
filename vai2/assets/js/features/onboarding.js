/* ============================================================
   NEXUS CHAT — ONBOARDING TOUR
   First-run guided tour. Auth-gated: only starts once signed in.
   ============================================================ */
(function () {
  'use strict';
  if (window.__nexus_onboarding_loaded__) return;
  window.__nexus_onboarding_loaded__ = true;

  // Bootstrap polish.js from this slot (it's not in index.html's list)
  import('./polish.js').catch(err => {
    console.debug('[onboarding] polish.js not loaded:', err.message);
  });

  const STORAGE_KEY = 'nexus_onboarding_v1';
  const state = {
    active: false,
    stepIndex: 0,
    overlayEl: null,
    tooltipEl: null,
    lastRect: null,
    resizeHandler: null,
    scrollHandler: null,
  };

  /* ============================================================
     TOUR STEPS
     ============================================================ */
  function buildSteps() {
    const s = [];
    const q = (sel) => document.querySelector(sel);

    if (q('.top-bar-left .logo')) s.push({
      selector: '.top-bar-left .logo',
      placement: 'bottom',
      title: 'Welcome to Nexus Chat',
      body: 'A privacy-first, single-page AI chat. Powered by OpenRouter’s free model pool. Sign in once, sync everywhere.',
    });
    if (q('#modelSelector')) s.push({
      selector: '#modelSelector',
      placement: 'right',
      title: 'Pick a model',
      body: 'Dozens of free models are available. Switch anytime — even mid-chat. Context length and capabilities are shown below the selector.',
    });
    if (q('#nxMmBtn')) s.push({
      selector: '#nxMmBtn',
      placement: 'bottom',
      title: 'Model manager',
      body: 'Search, favorite, compare, and pin models. Configure a fallback chain so if the primary fails, the next one auto-retries.',
    });
    if (q('#newChatBtn')) s.push({
      selector: '#newChatBtn',
      placement: 'bottom',
      title: 'Start a new chat',
      body: 'Every conversation is saved locally and to your account. Organize them with folders, pin favorites, and archive what you don’t need.',
    });
    if (q('#nxSearchBtn')) s.push({
      selector: '#nxSearchBtn',
      placement: 'bottom',
      title: 'Global search · Ctrl+K',
      body: 'Search across every message and title. Filter by sender. Jump straight to the exact message with a highlight.',
    });
    if (q('#chatInput')) s.push({
      selector: '#chatInput',
      placement: 'top',
      title: 'Your message',
      body: 'Shift+Enter for a new line. Attach files with the paperclip, or hit the mic to dictate. Everything is editable — click ✎ on any sent prompt to rewrite it.',
    });
    if (q('#contextReport')) s.push({
      selector: '#contextReport',
      placement: 'top',
      title: 'Context usage',
      body: 'Live estimate of tokens used vs. the model’s window. Turns amber past 75%. Use “Summarize” when you need more room.',
    });
    if (q('#settingsBtn')) s.push({
      selector: '#settingsBtn',
      placement: 'bottom',
      title: 'Tune everything',
      body: 'Temperature, top_p, system prompt, theme, font, density, advanced raw JSON params — all here. Click ⚙ once you’re ready.',
    });
    if (q('#nxCloudBtn')) s.push({
      selector: '#nxCloudBtn',
      placement: 'bottom',
      title: 'Cloud sync',
      body: 'Your chats, settings, and prompts are backed up to your account. Sign in on another device to see everything.',
    });
    if (q('.top-bar-right .icon-btn[title*="exact"]')) s.push({
      selector: '.top-bar-right .icon-btn[title*="exact"]',
      placement: 'bottom',
      title: 'See the exact request',
      body: 'Every message shows exactly what bytes go to the API — including system prompt and parameters. No hidden rewrites.',
    });

    return s;
  }

  /* ============================================================
     CSS
     ============================================================ */
  function injectStyles() {
    if (document.getElementById('nx-onboarding-styles')) return;
    const css = `
.nx-ob-backdrop{position:fixed;inset:0;z-index:3100;background:rgba(0,0,0,.72);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);transition:opacity .25s ease;opacity:0;}
.nx-ob-backdrop.open{opacity:1;}
.nx-ob-spotlight{position:absolute;border-radius:12px;box-shadow:0 0 0 9999px rgba(0,0,0,.72);background:transparent;pointer-events:none;transition:all .28s cubic-bezier(.4,0,.2,1);z-index:3101;}
.nx-ob-tooltip{position:absolute;max-width:340px;background:var(--bg-elevated);border:1px solid var(--accent-primary);border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,.6),0 0 40px var(--accent-glow);padding:16px 18px;z-index:3102;font-family:var(--font-sans);color:var(--text-primary);transition:all .28s cubic-bezier(.4,0,.2,1);opacity:0;transform:translateY(6px);}
.nx-ob-tooltip.open{opacity:1;transform:translateY(0);}
.nx-ob-tooltip::before{content:'';position:absolute;width:10px;height:10px;background:var(--bg-elevated);border:1px solid var(--accent-primary);transform:rotate(45deg);}
.nx-ob-tooltip[data-placement="bottom"]::before{top:-6px;left:24px;border-right:none;border-bottom:none;}
.nx-ob-tooltip[data-placement="top"]::before{bottom:-6px;left:24px;border-left:none;border-top:none;}
.nx-ob-tooltip[data-placement="right"]::before{left:-6px;top:24px;border-right:none;border-top:none;}
.nx-ob-tooltip[data-placement="left"]::before{right:-6px;top:24px;border-left:none;border-bottom:none;}
.nx-ob-step{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:var(--accent-secondary);margin-bottom:6px;}
.nx-ob-title{font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:8px;line-height:1.3;}
.nx-ob-body{font-size:13px;color:var(--text-secondary);line-height:1.6;margin-bottom:14px;}
.nx-ob-footer{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.nx-ob-btn{padding:6px 14px;border-radius:7px;border:1px solid var(--border-subtle);background:var(--bg-tertiary);color:var(--text-primary);font-family:var(--font-sans);font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;}
.nx-ob-btn:hover{background:var(--bg-hover);border-color:var(--border-strong);}
.nx-ob-btn.primary{background:var(--accent-primary);border-color:var(--accent-primary);color:#fff;}
.nx-ob-btn.primary:hover{background:var(--accent-secondary);}
.nx-ob-btn.ghost{background:transparent;border-color:transparent;color:var(--text-tertiary);padding:6px 8px;}
.nx-ob-btn.ghost:hover{color:var(--text-primary);}
.nx-ob-dots{display:flex;gap:4px;align-items:center;margin-left:auto;margin-right:6px;}
.nx-ob-dot{width:6px;height:6px;border-radius:50%;background:var(--border-strong);transition:all .2s;}
.nx-ob-dot.active{background:var(--accent-primary);width:18px;border-radius:3px;}
.nx-ob-dot.done{background:var(--accent-secondary);opacity:.6;}
`;
    const style = document.createElement('style');
    style.id = 'nx-onboarding-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ============================================================
     STORAGE
     ============================================================ */
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { completed: false, dontShow: false };
  }
  function saveState(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {}
  }

  /* ============================================================
     BUILD UI
     ============================================================ */
  function buildOverlay() {
    if (state.overlayEl) return;
    const backdrop = document.createElement('div');
    backdrop.className = 'nx-ob-backdrop';
    backdrop.id = 'nxObBackdrop';
    document.body.appendChild(backdrop);
    state.overlayEl = backdrop;

    const spotlight = document.createElement('div');
    spotlight.className = 'nx-ob-spotlight';
    spotlight.id = 'nxObSpotlight';
    document.body.appendChild(spotlight);
    state.spotlightEl = spotlight;

    const tooltip = document.createElement('div');
    tooltip.className = 'nx-ob-tooltip';
    tooltip.id = 'nxObTooltip';
    document.body.appendChild(tooltip);
    state.tooltipEl = tooltip;
  }

  /* ============================================================
     POSITION
     ============================================================ */
  function positionForTarget(target, placement) {
    const pad = 8;
    const rect = target.getBoundingClientRect();
    state.lastRect = { ...rect };
    const sRect = {
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    };
    state.spotlightEl.style.top = sRect.top + 'px';
    state.spotlightEl.style.left = sRect.left + 'px';
    state.spotlightEl.style.width = sRect.width + 'px';
    state.spotlightEl.style.height = sRect.height + 'px';

    const tipEl = state.tooltipEl;
    tipEl.dataset.placement = placement || 'bottom';
    tipEl.style.visibility = 'hidden';
    tipEl.style.left = '0px';
    tipEl.style.top = '0px';
    tipEl.style.opacity = '1';

    requestAnimationFrame(() => {
      const tipRect = tipEl.getBoundingClientRect();
      const margin = 12;
      let top, left;
      switch (placement) {
        case 'top':
          top = sRect.top - tipRect.height - margin;
          left = sRect.left + sRect.width / 2 - tipRect.width / 2;
          break;
        case 'right':
          top = sRect.top + sRect.height / 2 - tipRect.height / 2;
          left = sRect.left + sRect.width + margin;
          break;
        case 'left':
          top = sRect.top + sRect.height / 2 - tipRect.height / 2;
          left = sRect.left - tipRect.width - margin;
          break;
        default:
          top = sRect.top + sRect.height + margin;
          left = sRect.left + sRect.width / 2 - tipRect.width / 2;
      }
      const vw = window.innerWidth, vh = window.innerHeight;
      if (left < 12) left = 12;
      if (left + tipRect.width > vw - 12) left = vw - tipRect.width - 12;
      if (top < 12) top = 12;
      if (top + tipRect.height > vh - 12) top = vh - tipRect.height - 12;
      tipEl.style.left = left + 'px';
      tipEl.style.top = top + 'px';
      tipEl.style.visibility = 'visible';
    });
  }

  /* ============================================================
     RENDER STEP
     ============================================================ */
  function renderStep(steps) {
    const step = steps[state.stepIndex];
    if (!step) return stop();

    let target = null;
    try { target = document.querySelector(step.selector); } catch (e) {}
    if (!target) {
      state.stepIndex++;
      if (state.stepIndex >= steps.length) return stop({ completed: true });
      return renderStep(steps);
    }
    const r = target.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) {
      state.stepIndex++;
      if (state.stepIndex >= steps.length) return stop({ completed: true });
      return renderStep(steps);
    }

    const tipEl = state.tooltipEl;
    const dotsHtml = steps.map((_, i) => {
      const cls = i === state.stepIndex ? 'active' : i < state.stepIndex ? 'done' : '';
      return `<div class="nx-ob-dot ${cls}"></div>`;
    }).join('');

    tipEl.innerHTML = `
      <div class="nx-ob-step">Step ${state.stepIndex + 1} of ${steps.length}</div>
      <div class="nx-ob-title">${escapeHtml(step.title)}</div>
      <div class="nx-ob-body">${escapeHtml(step.body)}</div>
      <div class="nx-ob-footer">
        <button class="nx-ob-btn ghost" data-act="skip">Skip tour</button>
        <div class="nx-ob-dots">${dotsHtml}</div>
        ${state.stepIndex > 0 ? `<button class="nx-ob-btn" data-act="prev">Back</button>` : ''}
        <button class="nx-ob-btn primary" data-act="next">
          ${state.stepIndex === steps.length - 1 ? 'Finish' : 'Next'}
        </button>
      </div>`;
    tipEl.classList.remove('open');
    requestAnimationFrame(() => tipEl.classList.add('open'));

    tipEl.querySelector('[data-act="skip"]').addEventListener('click', () => stop({ completed: true }));
    const prev = tipEl.querySelector('[data-act="prev"]');
    if (prev) prev.addEventListener('click', () => {
      state.stepIndex--;
      renderStep(steps);
    });
    tipEl.querySelector('[data-act="next"]').addEventListener('click', () => {
      if (state.stepIndex >= steps.length - 1) return stop({ completed: true });
      state.stepIndex++;
      renderStep(steps);
    });

    positionForTarget(target, step.placement);
    if (r.top < 60 || r.bottom > window.innerHeight - 60) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => positionForTarget(target, step.placement), 350);
    }
  }

  /* ============================================================
     START / STOP
     ============================================================ */
  function start() {
    if (state.active) return;
    const steps = buildSteps();
    if (!steps.length) {
      if (window.__nexus.showToast) {
        window.__nexus.showToast('No tour targets found in the current layout.', 'info', 2500);
      }
      return;
    }
    buildOverlay();
    state.active = true;
    state.stepIndex = 0;
    state.overlayEl.classList.add('open');
    state.overlayEl.addEventListener('click', handleBackdropClick);
    document.addEventListener('keydown', handleKey);
    state.resizeHandler = () => { if (state.active) renderStep(steps); };
    window.addEventListener('resize', state.resizeHandler);
    state.scrollHandler = () => {
      if (!state.active) return;
      const step = steps[state.stepIndex];
      if (!step) return;
      const t = document.querySelector(step.selector);
      if (t) positionForTarget(t, step.placement);
    };
    window.addEventListener('scroll', state.scrollHandler, true);
    renderStep(steps);
  }

  function stop(opts = {}) {
    if (!state.active) return;
    state.active = false;
    if (state.overlayEl) state.overlayEl.classList.remove('open');
    if (state.spotlightEl) {
      state.spotlightEl.style.boxShadow = '0 0 0 0 transparent';
      state.spotlightEl.style.width = '0';
      state.spotlightEl.style.height = '0';
    }
    if (state.tooltipEl) state.tooltipEl.classList.remove('open');
    if (state.resizeHandler) window.removeEventListener('resize', state.resizeHandler);
    if (state.scrollHandler) window.removeEventListener('scroll', state.scrollHandler, true);
    document.removeEventListener('keydown', handleKey);
    state.resizeHandler = null;
    state.scrollHandler = null;
    if (opts.completed) {
      const s = loadState();
      s.completed = true;
      saveState(s);
      if (window.__nexus.showToast) {
        window.__nexus.showToast('Tour complete — enjoy Nexus Chat!', 'success', 3000);
      }
    }
  }

  function handleBackdropClick(e) {
    if (e.target === state.overlayEl) stop({ completed: false });
  }

  function handleKey(e) {
    if (!state.active) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      stop({ completed: false });
    } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
      const steps = buildSteps();
      if (state.stepIndex >= steps.length - 1) return stop({ completed: true });
      state.stepIndex++;
      renderStep(steps);
    } else if (e.key === 'ArrowLeft') {
      if (state.stepIndex > 0) {
        state.stepIndex--;
        renderStep(buildSteps());
      }
    }
  }

  /* ============================================================
     RESET
     ============================================================ */
  function reset() {
    saveState({ completed: false, dontShow: false });
    if (window.__nexus.showToast) {
      window.__nexus.showToast('Tour reset. Starting from step 1.', 'info', 2000);
    }
    setTimeout(() => start(), 400);
  }

  /* ============================================================
     MOUNT SIDEBAR BUTTON
     ============================================================ */
  function mountSidebarButton() {
    const header = document.querySelector('.sidebar-header');
    if (!header || document.getElementById('nxTourBtn')) return;
    const btn = document.createElement('button');
    btn.className = 'nx-mm-sidebar-browse';
    btn.id = 'nxTourBtn';
    btn.type = 'button';
    btn.title = 'Replay the guided tour';
    btn.innerHTML = `
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
        <circle cx="8" cy="8" r="6.5"/>
        <path d="M8 5v4M8 11v.5"/>
      </svg>
      Replay tour`;
    btn.addEventListener('click', reset);
    header.appendChild(btn);
  }

  /* ============================================================
     AUTO-START (auth-gated)
     ============================================================ */
  function ready(fn) {
    if (window.__nexus && window.__nexus.ready) return fn();
    window.addEventListener('nexus:ready', fn, { once: true });
  }

  ready(() => {
    injectStyles();
    mountSidebarButton();

    function maybeStart() {
      const s = loadState();
      if (s.completed || s.dontShow) return;
      if (!window.Nexus?.Auth?.isAuthenticated?.()) return;
      setTimeout(() => start(), 1200);
    }

    if (window.Nexus?.Auth?.isAuthenticated?.()) {
      maybeStart();
    } else {
      window.addEventListener('nexus:auth-changed', (e) => {
        if (e.detail?.user) maybeStart();
      }, { once: true });
    }
  });

  /* ============================================================
     UTILS
     ============================================================ */
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  window.Nexus = window.Nexus || {};
  window.Nexus.Onboarding = { start, stop, reset };
})();
