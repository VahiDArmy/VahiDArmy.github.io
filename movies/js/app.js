/* =========================================================
   بوت‌استرپ نهایی برنامه — نسخه آنلاین SPA
   ========================================================= */
(function bootstrap() {
  const BOOT_START = performance.now();
  const MIN_BOOT_MS = 1200;

  const boot = document.getElementById('boot-loader');
  const app = document.getElementById('app');
  const authGate = document.getElementById('auth-gate');

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  const BootLog = (function () {
    let logEl = null;
    function ensure() {
      if (!logEl) logEl = document.getElementById('boot-log');
      return logEl;
    }
    function push(message, state = 'info') {
      const log = ensure();
      if (!log) return;
      const line = document.createElement('div');
      line.className = 'boot-log-line';
      line.dataset.state = state;
      const mark = document.createElement('span');
      mark.className = 'boot-log-mark';
      mark.textContent = state === 'done' ? '✓' : state === 'error' ? '✗' : state === 'active' ? '▸' : '·';
      const text = document.createElement('span');
      text.className = 'boot-log-text';
      text.textContent = message;
      line.appendChild(mark);
      line.appendChild(text);
      log.appendChild(line);
      while (log.children.length > 8) log.removeChild(log.firstChild);
      log.scrollTop = log.scrollHeight;
    }
    return {
      active: m => push(m, 'active'),
      done: m => push(m, 'done'),
      error: m => push(m, 'error'),
      info: m => push(m, 'info')
    };
  })();

  async function run() {
    try {
      BootLog.active('بارگذاری کتابخانه‌ها...');
      // Supabase is already loaded via script tag
      BootLog.done('Supabase آماده');

      BootLog.active('اتصال به سرور...');
      await DB.init();
      BootLog.done('اتصال برقرار شد');

      const session = await DB.getSession();
      if (!session) {
        BootLog.info('نیاز به ورود');
        // Hide boot, show auth
        const elapsed = performance.now() - BOOT_START;
        if (elapsed < MIN_BOOT_MS) await sleep(MIN_BOOT_MS - elapsed);
        if (boot) boot.hidden = true;
        if (authGate) {
          authGate.hidden = false;
          setupAuth();
        }
        return;
      }

      BootLog.active('بارگذاری عناوین...');
      await State.loadTitles();
      BootLog.done(`${State.get().titles.length} عنوان`);

      BootLog.active('آماده‌سازی رابط...');
      Events.bind();
      State.on('filtered', list => {
        Render.renderCards(list);
        Render.updateHeaderStats(State.get().titles);
      });
      State.applyFilters();
      BootLog.done('آماده');

      // Finish boot
      const elapsed = performance.now() - BOOT_START;
      if (elapsed < MIN_BOOT_MS) await sleep(MIN_BOOT_MS - elapsed);

      if (boot) {
        boot.classList.add('boot-done');
        await sleep(400);
        boot.hidden = true;
      }
      if (app) app.hidden = false;

    } catch (err) {
      console.error(err);
      BootLog.error(err.message || 'خطای ناشناخته');
      // Still try to show auth or error
      if (boot) boot.hidden = true;
      if (authGate) {
        authGate.hidden = false;
        setupAuth();
      }
    }
  }

  function setupAuth() {
    const form = document.getElementById('auth-form');
    const emailEl = document.getElementById('auth-email');
    const passEl = document.getElementById('auth-password');
    const submitBtn = document.getElementById('auth-submit');
    const errorEl = document.getElementById('auth-error');
    let mode = 'login';

    document.querySelectorAll('.auth-tabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.auth-tabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        mode = btn.dataset.tab;
        submitBtn.textContent = mode === 'login' ? 'ورود' : 'ثبت‌نام';
        errorEl.textContent = '';
      });
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.textContent = '';
      form.classList.add('auth-loading');
      try {
        if (mode === 'login') {
          await DB.signIn(emailEl.value.trim(), passEl.value);
        } else {
          await DB.signUp(emailEl.value.trim(), passEl.value);
          errorEl.textContent = 'ثبت‌نام موفق. اگر تأیید ایمیل فعال است، ایمیل را چک کنید.';
          // If auto-confirm, continue
        }
        // Reload to boot with session
        location.reload();
      } catch (err) {
        errorEl.textContent = err.message || 'خطا در احراز هویت';
      } finally {
        form.classList.remove('auth-loading');
      }
    });
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
