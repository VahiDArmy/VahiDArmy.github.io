// راه‌اندازی کلاینت Supabase (کتابخانه از CDN در HTML بارگذاری می‌شود)
const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const Auth = (function () {
  async function getSession() {
    const { data } = await sb.auth.getSession();
    return data.session;
  }

  async function signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    await sb.auth.signOut();
  }

  // اگر لاگین نبود، به صفحهٔ ورود هدایت می‌کند (SPA-friendly — بدون رفرش کامل).
  async function requireAuth() {
    const session = await getSession();
    if (!session) {
      if (window.Router) {
        Router.navigate('/login', { replace: true });
      } else {
        location.hash = '#/login';
      }
      return null;
    }
    return session;
  }

  return { getSession, signIn, signOut, requireAuth };
})();
