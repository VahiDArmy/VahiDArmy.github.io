/* ============================================================================
   AUTH SERVICE
   ----------------------------------------------------------------------------
   Handles login/signup/logout, session persistence, demo mode fallback,
   and profile storage.
   ============================================================================ */

(function (window) {
  "use strict";

  const Supabase = window.Supabase;
  const Storage = window.Storage;
  const Helpers = window.Helpers;

  const DEMO_USERS = [
    {
      id: "demo-admin",
      email: "demo@crm.local",
      password: "demo1234",
      full_name: "کاربر نمایشی",
      role: "admin",
      avatar_url: null,
      created_at: new Date().toISOString(),
    },
  ];

  const SESSION_KEY = "auth-session";

  const state = {
    user: null,
    session: null,
    listeners: new Set(),
  };

  const AuthService = {
    /* ---------- Init ---------- */
    async init() {
      if (Supabase.isReady()) {
        try {
          const { data } = await Supabase.client.auth.getSession();
          if (data?.session) {
            state.session = data.session;
            state.user = data.session.user;
            this.emit();
          }
          // Listen for changes
          Supabase.client.auth.onAuthStateChange((event, session) => {
            state.session = session;
            state.user = session?.user || null;
            this.persistLocal();
            this.emit();
          });
        } catch (e) {
          console.warn("auth.init:", e);
        }
      } else {
        // Demo mode: restore local session
        const saved = Storage.session.get(SESSION_KEY);
        if (saved && saved.user) {
          state.user = saved.user;
          state.session = saved;
          this.emit();
        }
      }
      return state.user;
    },

    /* ---------- State access ---------- */
    getUser() {
      return state.user;
    },

    getSession() {
      return state.session;
    },

    isAuthenticated() {
      return !!state.user;
    },

    isDemo() {
      return state.user && state.user.id && String(state.user.id).startsWith("demo-");
    },

    /* ---------- Subscribe ---------- */
    onChange(fn) {
      state.listeners.add(fn);
      return () => state.listeners.delete(fn);
    },

    emit() {
      state.listeners.forEach((fn) => {
        try { fn(state.user, state.session); } catch (e) { console.error(e); }
      });
    },

    /* ---------- Persist local (demo) ---------- */
    persistLocal() {
      if (state.user && state.session) {
        Storage.session.set(SESSION_KEY, state.session);
      } else {
        Storage.session.remove(SESSION_KEY);
      }
    },

    /* ---------- Signup ---------- */
    async signup({ email, password, full_name }) {
      if (Supabase.isReady()) {
        const { data, error } = await Supabase.client.auth.signUp({
          email,
          password,
          options: { data: { full_name } },
        });
        if (error) throw error;
        return data;
      }
      // Demo
      if (DEMO_USERS.find((u) => u.email === email)) {
        throw new Error("این ایمیل قبلاً ثبت شده است");
      }
      const user = {
        id: Helpers.uid("demo"),
        email,
        full_name: full_name || email.split("@")[0],
        role: "admin",
        created_at: new Date().toISOString(),
      };
      DEMO_USERS.push({ ...user, password });
      state.user = user;
      state.session = { user, access_token: "demo", expires_at: Date.now() + 3600e3 };
      this.persistLocal();
      this.emit();
      return { user, session: state.session };
    },

    /* ---------- Login ---------- */
    async login({ email, password }) {
      if (Supabase.isReady()) {
        const { data, error } = await Supabase.client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        state.user = data.user;
        state.session = data.session;
        this.emit();
        return data;
      }
      // Demo
      const match = DEMO_USERS.find((u) => u.email === email && u.password === password);
      if (!match) {
        throw new Error("ایمیل یا رمز عبور نادرست است");
      }
      const { password: _, ...user } = match;
      state.user = user;
      state.session = { user, access_token: "demo", expires_at: Date.now() + 3600e3 };
      this.persistLocal();
      this.emit();
      return { user, session: state.session };
    },

    /* ---------- Quick demo login ---------- */
    async loginDemo() {
      const demo = DEMO_USERS[0];
      const { password: _, ...user } = demo;
      state.user = { ...user };
      state.session = { user: state.user, access_token: "demo", expires_at: Date.now() + 3600e3 };
      this.persistLocal();
      this.emit();
      return { user: state.user, session: state.session };
    },

    /* ---------- Logout ---------- */
    async logout() {
      if (Supabase.isReady() && !this.isDemo()) {
        try {
          await Supabase.client.auth.signOut();
        } catch (e) {
          console.warn("logout:", e);
        }
      }
      state.user = null;
      state.session = null;
      Storage.session.remove(SESSION_KEY);
      this.emit();
    },

    /* ---------- Password reset ---------- */
    async sendPasswordReset(email) {
      if (Supabase.isReady()) {
        const { error } = await Supabase.client.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/login.html#reset`,
        });
        if (error) throw error;
        return true;
      }
      // Demo — always succeeds
      await Helpers.sleep(400);
      return true;
    },

    /* ---------- Update profile ---------- */
    async updateProfile(patch) {
      if (Supabase.isReady() && !this.isDemo()) {
        const { data, error } = await Supabase.client.auth.updateUser({
          data: patch,
        });
        if (error) throw error;
        state.user = data.user;
        this.emit();
        return data.user;
      }
      state.user = { ...state.user, ...patch };
      this.persistLocal();
      this.emit();
      return state.user;
    },

    /* ---------- Change password ---------- */
    async changePassword(newPassword) {
      if (Supabase.isReady() && !this.isDemo()) {
        const { error } = await Supabase.client.auth.updateUser({ password: newPassword });
        if (error) throw error;
        return true;
      }
      await Helpers.sleep(300);
      return true;
    },

    /* ---------- Role helpers ---------- */
    getRole() {
      return state.user?.role || "viewer";
    },

    hasRole(...roles) {
      return roles.includes(this.getRole());
    },

    isAdmin() {
      return this.getRole() === "admin";
    },

    can(action) {
      const role = this.getRole();
      const matrix = {
        create: ["admin", "manager", "operator"],
        update: ["admin", "manager", "operator"],
        delete: ["admin", "manager"],
        export: ["admin", "manager", "operator", "viewer"],
        settings: ["admin", "manager"],
        manage_team: ["admin"],
      };
      return (matrix[action] || ["admin"]).includes(role);
    },
  };

  window.AuthService = AuthService;
})(window);