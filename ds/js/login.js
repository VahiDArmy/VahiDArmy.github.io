document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    loginError.textContent = '';

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      console.error('خطا در ورود:', error.message);
      loginError.textContent = 'ورود ناموفق: ' + error.message;
      return;
    }

    // ذخیره session در localStorage و انتقال
    localStorage.setItem('sb-session', JSON.stringify(data.session));
    window.location.href = 'index.html';
  });
});