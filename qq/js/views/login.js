// Login view
window.Views = window.Views || {};
window.Views.Login = async function ({ container }) {
  const session = await Auth.getSession();
  if (session) {
    Router.navigate('/', { replace: true });
    return;
  }

  container.innerHTML = `
    <div class="view view-login">
      <div class="login-card">
        <div class="card">
          <form id="loginForm">
            <div class="field">
              <label for="email">ایمیل</label>
              <input type="email" id="email" name="email" required autocomplete="username" dir="ltr" />
            </div>
            <div class="field">
              <label for="password">رمز عبور</label>
              <input type="password" id="password" name="password" required autocomplete="current-password" dir="ltr" />
            </div>
            <button type="submit" class="btn btn--primary" style="width:100%">ورود</button>
            <p class="login-error" id="loginError" style="display:none; margin-top:10px; font-size:.82rem; color:var(--danger);">ایمیل یا رمز عبور اشتباه است.</p>
          </form>
        </div>
        <a class="login-back" href="#/browse" style="display:block; margin-top:16px; text-align:center; font-size:.85rem; color:var(--text-dim);">‹ مرور آیات بدون ورود</a>
      </div>
    </div>
  `;

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('loginError');
    errorEl.style.display = 'none';
    try {
      await Auth.signIn(email, password);
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) logoutBtn.hidden = false;
      Router.navigate('/');
    } catch (err) {
      errorEl.style.display = 'block';
    }
  });
};
