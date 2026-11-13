/* ============================================================
   NEXUS CHAT — AUTHENTICATION
   Blocks the app until the user is signed in. Manages per-user
   local data isolation. Fires `nexus:auth-changed` on state
   changes so other modules can react.
   ============================================================ */
(function () {
  'use strict';
  if (window.__nexus_auth_loaded__) return;
  window.__nexus_auth_loaded__ = true;

  const OWNER_KEY = 'nexus_owner_id';
  const WIPE_ALLOWED_PREFIX = 'nexus_';
  const WIPE_KEEP = new Set([OWNER_KEY, 'nexus_device_id_v1', 'nexus_cloud_namespace_v1']);

  const state = {
    client: null,
    session: null,
    user: null,
    overlayEl: null,
    mode: 'signin',          // 'signin' | 'signup' | 'check-email'
    loading: false,
    lastError: null,
    pendingEmail: null,      // for check-email view
    userBadgeEl: null,
    initialCheckDone: false,
  };

  /* ============================================================
     CSS
     ============================================================ */
  function injectStyles() {
    if (document.getElementById('nx-auth-styles')) return;
    const css = `
.nx-auth-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: radial-gradient(circle at 50% 30%, rgba(108, 92, 231, 0.15), transparent 60%), var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  font-family: var(--font-sans);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s;
}
.nx-auth-overlay.open { opacity: 1; pointer-events: auto; }
.nx-auth-card {
  width: 100%;
  max-width: 420px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-strong);
  border-radius: 18px;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.7), 0 0 80px rgba(108, 92, 231, 0.15);
  overflow: hidden;
  transform: scale(0.96);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.nx-auth-overlay.open .nx-auth-card { transform: scale(1); }
.nx-auth-brand {
  padding: 32px 28px 20px;
  text-align: center;
  border-bottom: 1px solid var(--border-subtle);
}
.nx-auth-logo {
  width: 56px; height: 56px; margin: 0 auto 14px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 24px; color: #fff;
  box-shadow: 0 0 40px var(--accent-glow);
  letter-spacing: -1px;
}
.nx-auth-app-title {
  font-size: 20px; font-weight: 800; letter-spacing: -0.5px;
  background: linear-gradient(135deg, var(--text-primary), var(--accent-secondary));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  margin-bottom: 6px;
}
.nx-auth-tagline { font-size: 12px; color: var(--text-tertiary); line-height: 1.5; }
.nx-auth-tabs { display: flex; padding: 12px 20px 0; gap: 4px; }
.nx-auth-tab {
  flex: 1; padding: 10px; background: transparent; border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-tertiary);
  font-family: var(--font-sans); font-size: 13px; font-weight: 600;
  cursor: pointer; transition: all 0.15s;
}
.nx-auth-tab:hover { color: var(--text-secondary); }
.nx-auth-tab.active { color: var(--accent-secondary); border-bottom-color: var(--accent-primary); }
.nx-auth-body { padding: 20px 28px 24px; }
.nx-auth-field { margin-bottom: 14px; }
.nx-auth-label {
  display: block; font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 1px;
  color: var(--text-tertiary); margin-bottom: 6px;
}
.nx-auth-input-wrap { position: relative; }
.nx-auth-input {
  width: 100%; padding: 11px 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 9px;
  color: var(--text-primary);
  font-family: var(--font-sans); font-size: 14px;
  outline: none; transition: border-color 0.15s;
}
.nx-auth-input:focus { border-color: var(--accent-primary); }
.nx-auth-input::placeholder { color: var(--text-tertiary); }
.nx-auth-input:disabled { opacity: 0.5; }
.nx-auth-input-wrap.has-toggle .nx-auth-input { padding-right: 44px; }
.nx-auth-password-toggle {
  position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
  width: 32px; height: 32px; border: none; background: transparent;
  color: var(--text-tertiary); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  border-radius: 6px; transition: all 0.15s;
}
.nx-auth-password-toggle:hover { background: var(--bg-hover); color: var(--text-primary); }
.nx-auth-hint { font-size: 11px; color: var(--text-tertiary); margin-top: 4px; line-height: 1.4; }
.nx-auth-submit {
  width: 100%; padding: 12px;
  border-radius: 9px; border: none;
  background: var(--accent-primary); color: #fff;
  font-family: var(--font-sans); font-size: 14px; font-weight: 700;
  cursor: pointer; transition: all 0.15s;
  margin-top: 4px;
  display: flex; align-items: center; justify-content: center; gap: 8px;
}
.nx-auth-submit:hover:not(:disabled) { background: var(--accent-secondary); box-shadow: 0 0 24px var(--accent-glow); }
.nx-auth-submit:disabled { opacity: 0.6; cursor: not-allowed; }
.nx-auth-submit .nx-auth-spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.4); border-top-color: #fff;
  border-radius: 50%; animation: nx-auth-spin 0.8s linear infinite;
}
@keyframes nx-auth-spin { to { transform: rotate(360deg); } }
.nx-auth-error {
  padding: 10px 14px;
  background: rgba(225, 112, 85, 0.1);
  border: 1px solid rgba(225, 112, 85, 0.4);
  border-radius: 8px;
  color: var(--danger); font-size: 12px; line-height: 1.5;
  margin-bottom: 14px;
  font-family: var(--font-mono); word-break: break-word;
}
.nx-auth-error-title { font-family: var(--font-sans); font-weight: 700; color: var(--danger); margin-bottom: 3px; font-size: 12px; }
.nx-auth-info {
  padding: 12px 14px;
  background: rgba(116, 185, 255, 0.1);
  border: 1px solid rgba(116, 185, 255, 0.4);
  border-radius: 8px;
  color: var(--info); font-size: 12px; line-height: 1.5; margin-bottom: 14px;
}
.nx-auth-footer {
  padding: 14px 28px 20px;
  text-align: center; font-size: 11px;
  color: var(--text-tertiary); line-height: 1.5;
  border-top: 1px solid var(--border-subtle);
}
.nx-auth-footer a { color: var(--accent-secondary); text-decoration: none; }
.nx-auth-footer a:hover { text-decoration: underline; }
.nx-user-badge {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 6px 5px 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 100px;
  font-family: var(--font-sans); font-size: 11px;
  color: var(--text-secondary); max-width: 220px;
}
.nx-user-badge .email { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
.nx-user-badge .signout-btn {
  width: 22px; height: 22px; border-radius: 50%;
  border: none; background: transparent; color: var(--text-tertiary);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.15s; flex-shrink: 0;
}
.nx-user-badge .signout-btn:hover { background: rgba(225, 112, 85, 0.2); color: var(--danger); }
@media (max-width: 700px) {
  .nx-auth-overlay { padding: 12px; }
  .nx-auth-brand { padding: 24px 20px 16px; }
  .nx-auth-body { padding: 16px 20px 20px; }
  .nx-user-badge .email { display: none; }
}
`;
    const style = document.createElement('style');
    style.id = 'nx-auth-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ============================================================
     INIT
     ============================================================ */
  function waitForClient() {
    return new Promise((resolve, reject) => {
      let tries = 0;
      const tick = () => {
        if (window.supabase) return resolve(window.supabase);
        if (tries++ >= 100) return reject(new Error('Supabase client not available'));
        setTimeout(tick, 100);
      };
      tick();
    });
  }

  async function init() {
    injectStyles();
    try {
      state.client = await waitForClient();
    } catch (err) {
      console.error('[auth]', err.message);
      showError('Cannot reach Supabase. Check your network and try again.');
      showOverlay();
      return;
    }
    state.client.auth.onAuthStateChange((event, session) => {
      handleAuthChange(event, session);
    });
    try {
      const { data, error } = await state.client.auth.getSession();
      if (error) throw error;
      const session = data?.session || null;
      handleAuthChange('INITIAL_SESSION', session);
    } catch (err) {
      console.warn('[auth] initial session check failed:', err.message);
      handleAuthChange('INITIAL_SESSION', null);
    }
    state.initialCheckDone = true;
  }

  /* ============================================================
     AUTH STATE HANDLING
     ============================================================ */
  async function handleAuthChange(event, session) {
    const prevUserId = state.user?.id || null;
    state.session = session || null;
    state.user = session?.user || null;
    const newUserId = state.user?.id || null;

    window.dispatchEvent(new CustomEvent('nexus:auth-changed', {
      detail: { user: state.user, session: state.session, event },
    }));

    if (newUserId) {
      const ownerResult = checkOwner(newUserId);
      if (ownerResult === 'wiped') {
        try {
          window.__nexus?.showToast?.('Cleared local data from a previous user.', 'info', 3000);
        } catch (e) {}
        setTimeout(() => location.reload(), 600);
        return;
      }
      hideOverlay();
      mountUserBadge();
    } else {
      unmountUserBadge();
      try { localStorage.removeItem('nexus_cloud_queue_v1'); } catch (e) {}
      if (prevUserId) showToast('Signed out', 'info', 2000);
      showOverlay();
    }
  }

  /* ============================================================
     OWNER CHECK — prevent cross-user local data leakage
     ============================================================ */
  function checkOwner(currentUserId) {
    let stored;
    try { stored = localStorage.getItem(OWNER_KEY); } catch (e) { return 'same'; }
    if (!stored) {
      try { localStorage.setItem(OWNER_KEY, currentUserId); } catch (e) {}
      return 'claimed';
    }
    if (stored === currentUserId) return 'same';
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(WIPE_ALLOWED_PREFIX) && !WIPE_KEEP.has(k)) keys.push(k);
      }
      keys.forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
      localStorage.setItem(OWNER_KEY, currentUserId);
    } catch (e) {
      console.warn('[auth] wipe failed:', e.message);
    }
    return 'wiped';
  }

  /* ============================================================
     OVERLAY UI
     ============================================================ */
  function buildOverlay() {
    if (state.overlayEl) return;
    const el = document.createElement('div');
    el.className = 'nx-auth-overlay';
    el.id = 'nxAuthOverlay';
    el.innerHTML = `
      <div class="nx-auth-card" role="dialog" aria-modal="true" aria-label="Sign in to Nexus Chat">
        <div class="nx-auth-brand">
          <div class="nx-auth-logo">N</div>
          <div class="nx-auth-app-title">Nexus Chat</div>
          <div class="nx-auth-tagline">Sign in to continue. Your chats sync across devices.</div>
        </div>
        <div class="nx-auth-tabs" id="nxAuthTabs">
          <button class="nx-auth-tab active" data-mode="signin">Sign in</button>
          <button class="nx-auth-tab" data-mode="signup">Create account</button>
        </div>
        <div class="nx-auth-body" id="nxAuthBody"></div>
        <div class="nx-auth-footer">
          By signing in you agree to keep your credentials safe.<br>
          Powered by Supabase Auth.
        </div>
      </div>`;
    document.body.appendChild(el);
    state.overlayEl = el;

    el.querySelectorAll('.nx-auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        if (state.loading) return;
        state.mode = tab.dataset.mode;
        state.lastError = null;
        el.querySelectorAll('.nx-auth-tab').forEach(t => {
          t.classList.toggle('active', t === tab);
        });
        renderAuthBody();
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && el.classList.contains('open')) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    renderAuthBody();
  }

  function renderAuthBody() {
    const body = state.overlayEl.querySelector('#nxAuthBody');
    if (!body) return;

    if (state.mode === 'check-email') {
      body.innerHTML = `
        <div class="nx-auth-info" style="margin-bottom:18px;">
          <strong>Check your email</strong><br>
          We sent a confirmation link to <strong>${escapeHtml(state.pendingEmail || '')}</strong>.
          Click the link to activate your account, then return here to sign in.
        </div>
        <button class="nx-auth-submit" id="nxAuthResend">Resend confirmation email</button>
        <button class="nx-auth-submit" id="nxAuthBackToSignin" style="background:transparent;border:1px solid var(--border-subtle);color:var(--text-primary);margin-top:8px;">
          Back to sign in
        </button>
        <div id="nxAuthStatusMsg"></div>`;
      body.querySelector('#nxAuthBackToSignin').addEventListener('click', () => {
        state.mode = 'signin';
        state.pendingEmail = null;
        state.lastError = null;
        state.overlayEl.querySelectorAll('.nx-auth-tab').forEach(t => {
          t.classList.toggle('active', t.dataset.mode === 'signin');
        });
        renderAuthBody();
      });
      body.querySelector('#nxAuthResend').addEventListener('click', resendConfirmation);
      return;
    }

    const isSignup = state.mode === 'signup';
    let html = '';
    if (state.lastError) {
      html += `
        <div class="nx-auth-error">
          <div class="nx-auth-error-title">Authentication failed</div>
          ${escapeHtml(state.lastError)}
        </div>`;
    }
    html += `
      <form id="nxAuthForm" autocomplete="on">
        <div class="nx-auth-field">
          <label class="nx-auth-label" for="nxAuthEmail">Email</label>
          <div class="nx-auth-input-wrap">
            <input type="email" id="nxAuthEmail" class="nx-auth-input"
              placeholder="you@example.com" autocomplete="email" required
              ${state.loading ? 'disabled' : ''}>
          </div>
        </div>
        <div class="nx-auth-field">
          <label class="nx-auth-label" for="nxAuthPassword">Password</label>
          <div class="nx-auth-input-wrap has-toggle">
            <input type="password" id="nxAuthPassword" class="nx-auth-input"
              placeholder="${isSignup ? 'At least 6 characters' : 'Your password'}"
              autocomplete="${isSignup ? 'new-password' : 'current-password'}"
              required minlength="6"
              ${state.loading ? 'disabled' : ''}>
            <button type="button" class="nx-auth-password-toggle" id="nxAuthPwToggle"
              tabindex="-1" aria-label="Show password">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/>
                <circle cx="8" cy="8" r="2"/>
              </svg>
            </button>
          </div>
          ${isSignup ? '<div class="nx-auth-hint">Minimum 6 characters.</div>' : ''}
        </div>
        <button type="submit" class="nx-auth-submit" id="nxAuthSubmit" ${state.loading ? 'disabled' : ''}>
          ${state.loading ? '<span class="nx-auth-spinner"></span> ' : ''}
          ${isSignup ? 'Create account' : 'Sign in'}
        </button>
      </form>`;
    body.innerHTML = html;

    const form = body.querySelector('#nxAuthForm');
    const emailInput = body.querySelector('#nxAuthEmail');
    const pwInput = body.querySelector('#nxAuthPassword');
    const pwToggle = body.querySelector('#nxAuthPwToggle');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (state.loading) return;
      await submitAuth(emailInput.value.trim(), pwInput.value);
    });
    pwToggle.addEventListener('click', () => {
      const isPw = pwInput.type === 'password';
      pwInput.type = isPw ? 'text' : 'password';
      pwToggle.setAttribute('aria-label', isPw ? 'Hide password' : 'Show password');
    });
    requestAnimationFrame(() => {
      if (!emailInput.value) emailInput.focus();
      else pwInput.focus();
    });
  }

  /* ============================================================
     AUTH ACTIONS
     ============================================================ */
  async function submitAuth(email, password) {
    if (!email) { state.lastError = 'Email is required.'; renderAuthBody(); return; }
    if (!password) { state.lastError = 'Password is required.'; renderAuthBody(); return; }
    if (password.length < 6) {
      state.lastError = 'Password must be at least 6 characters.';
      renderAuthBody();
      return;
    }
    state.loading = true;
    state.lastError = null;
    renderAuthBody();

    try {
      if (state.mode === 'signup') {
        const { data, error } = await state.client.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) return;
        state.mode = 'check-email';
        state.pendingEmail = email;
        state.loading = false;
        renderAuthBody();
        return;
      } else {
        const { data, error } = await state.client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.session) {
          throw new Error('Signed in but no session was returned. Please try again.');
        }
        return;
      }
    } catch (err) {
      state.lastError = formatAuthError(err);
      state.loading = false;
      renderAuthBody();
    }
  }

  async function resendConfirmation() {
    if (!state.pendingEmail) return;
    const btn = state.overlayEl.querySelector('#nxAuthResend');
    const msgHost = state.overlayEl.querySelector('#nxAuthStatusMsg');
    btn.disabled = true;
    btn.innerHTML = '<span class="nx-auth-spinner"></span> Sending…';
    try {
      const { error } = await state.client.auth.resend({ type: 'signup', email: state.pendingEmail });
      if (error) throw error;
      msgHost.innerHTML = `<div class="nx-auth-info" style="margin-top:12px;">Confirmation email sent again.</div>`;
    } catch (err) {
      msgHost.innerHTML = `<div class="nx-auth-error" style="margin-top:12px;">${escapeHtml(formatAuthError(err))}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Resend confirmation email';
    }
  }

  async function signOut() {
    try {
      await state.client.auth.signOut();
    } catch (err) {
      showToast('Sign out failed: ' + err.message, 'error', 4000);
    }
  }

  /* ============================================================
     ERROR FORMATTING
     ============================================================ */
  function formatAuthError(err) {
    if (!err) return 'Unknown error';
    const msg = err.message || String(err);
    const status = err.status || err.code;
    const friendly = {
      'Invalid login credentials': 'Invalid email or password. If you just signed up, check your inbox to confirm your email first.',
      'Email not confirmed': 'Please confirm your email before signing in. Check your inbox for the confirmation link.',
      'User already registered': 'An account with this email already exists. Try signing in instead.',
      'Password should be at least 6 characters': 'Password must be at least 6 characters.',
      'Signups not allowed for this instance': 'Signups are disabled on this server. Contact the administrator.',
      'Email rate limit exceeded': 'Too many signup attempts. Please wait a few minutes before trying again.',
      'For security purposes, you can only request this once every 60 seconds': 'Please wait 60 seconds before requesting another email.',
      'Unable to validate email address: invalid format': 'Please enter a valid email address.',
    };
    let out = friendly[msg] || msg;
    if (status && !friendly[msg]) out = `[${status}] ${msg}`;
    return out;
  }

  /* ============================================================
     USER BADGE (top bar)
     ============================================================ */
  function mountUserBadge() {
    if (!state.user) return;
    unmountUserBadge();
    const topBar = document.querySelector('.top-bar-right');
    if (!topBar) return;
    const badge = document.createElement('div');
    badge.className = 'nx-user-badge';
    badge.id = 'nxUserBadge';
    badge.title = `Signed in as ${state.user.email}`;
    badge.innerHTML = `
      <span class="email">${escapeHtml(state.user.email || 'Signed in')}</span>
      <button class="signout-btn" id="nxSignOutBtn" title="Sign out" aria-label="Sign out">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3"/>
          <path d="M11 11l3-3-3-3M14 8H6"/>
        </svg>
      </button>`;
    topBar.insertBefore(badge, topBar.firstChild);
    state.userBadgeEl = badge;
    badge.querySelector('#nxSignOutBtn').addEventListener('click', () => {
      if (!confirm('Sign out? Your chats stay synced to your account.')) return;
      signOut();
    });
  }

  function unmountUserBadge() {
    if (state.userBadgeEl) {
      state.userBadgeEl.remove();
      state.userBadgeEl = null;
    }
  }

  /* ============================================================
     OVERLAY SHOW/HIDE
     ============================================================ */
  function showOverlay() {
    if (!state.overlayEl) buildOverlay();
    state.loading = false;
    state.lastError = null;
    state.mode = 'signin';
    state.overlayEl.querySelectorAll('.nx-auth-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.mode === 'signin');
    });
    renderAuthBody();
    state.overlayEl.classList.add('open');
  }

  function hideOverlay() {
    if (!state.overlayEl) return;
    state.overlayEl.classList.remove('open');
    state.lastError = null;
    state.loading = false;
  }

  /* ============================================================
     UTILS
     ============================================================ */
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  function showToast(msg, type, dur) {
    if (window.__nexus?.showToast) window.__nexus.showToast(msg, type, dur);
    else console.log(`[${type}] ${msg}`);
  }
  function showError(msg) {
    state.lastError = msg;
    if (state.overlayEl) renderAuthBody();
  }

  /* ============================================================
     BOOT
     ============================================================ */
  (async () => {
    injectStyles();
    buildOverlay();
    state.overlayEl.classList.add('open');
    await init();
    if (!state.initialCheckDone && !state.user) {
      showError('Unable to determine sign-in status. Check your connection.');
    }
  })();

  /* ============================================================
     PUBLIC API
     ============================================================ */
  window.Nexus = window.Nexus || {};
  window.Nexus.Auth = {
    isAuthenticated: () => !!state.user,
    getUser: () => state.user,
    getSession: () => state.session,
    signOut,
    showOverlay,
    hideOverlay,
  };
})();
