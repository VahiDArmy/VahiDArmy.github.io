/* =========================================================
   ارتباط با GitHub API
   ========================================================= */
window.GitHub = (function () {
  const API = CONFIG.GITHUB.API_BASE;

  function getSettings() {
    const stored = Utils.safeParse(localStorage.getItem(CONFIG.STORAGE.SETTINGS), {});
    return {
      owner: stored.owner || CONFIG.GITHUB.DEFAULT_OWNER,
      repo: stored.repo || CONFIG.GITHUB.DEFAULT_REPO,
      branch: stored.branch || CONFIG.GITHUB.DEFAULT_BRANCH,
      path: stored.path || CONFIG.GITHUB.DEFAULT_PATH
    };
  }

  function getToken() {
    return localStorage.getItem(CONFIG.STORAGE.TOKEN) || '';
  }

  function setToken(t) {
    if (t) localStorage.setItem(CONFIG.STORAGE.TOKEN, t);
    else localStorage.removeItem(CONFIG.STORAGE.TOKEN);
  }

  function saveSettings(s) {
    const current = Utils.safeParse(localStorage.getItem(CONFIG.STORAGE.SETTINGS), {});
    localStorage.setItem(CONFIG.STORAGE.SETTINGS, JSON.stringify({ ...current, ...s }));
  }

  function isConfigured() {
    const s = getSettings();
    return !!s.owner && !!s.repo && !!getToken();
  }

  function headers(withAuth = true) {
    const h = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (withAuth) {
      const t = getToken();
      if (t) h['Authorization'] = `Bearer ${t}`;
    }
    return h;
  }

  function buildUrl(path) {
    const s = getSettings();
    return `${API}/repos/${s.owner}/${s.repo}/contents/${path}`;
  }

  /* ---- خواندن فایل از ریپو ---- */
  async function readFile(path = null) {
    const s = getSettings();
    path = path || s.path;
    const url = `${buildUrl(path)}?ref=${encodeURIComponent(s.branch)}&t=${Date.now()}`;
    const res = await fetch(url, { headers: headers(), cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`خطای دریافت از گیت‌هاب (${res.status}): ${txt.slice(0, 200)}`);
    }
    const data = await res.json();
    return {
      content: data.content,   // base64
      sha: data.sha,
      size: data.size,
      path: data.path
    };
  }

  /* ---- نوشتن فایل در ریپو ---- */
  async function writeFile(base64Content, commitMessage, sha = null, path = null) {
    const s = getSettings();
    path = path || s.path;
    const url = buildUrl(path);
    const body = {
      message: commitMessage || (CONFIG.GITHUB.COMMIT_PREFIX + new Date().toISOString()),
      content: base64Content,
      branch: s.branch
    };
    if (sha) body.sha = sha;

    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`خطای ارسال به گیت‌هاب (${res.status}): ${txt.slice(0, 300)}`);
    }
    return res.json();
  }

  /* ---- حذف فایل ---- */
  async function deleteFile(sha, commitMessage, path = null) {
    const s = getSettings();
    path = path || s.path;
    const url = buildUrl(path);
    const body = {
      message: commitMessage || '🎬 cinema: delete',
      sha,
      branch: s.branch
    };
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`خطای حذف از گیت‌هاب (${res.status}): ${txt.slice(0, 200)}`);
    }
    return res.json();
  }

  /* ---- تست اتصال ---- */
  async function testConnection() {
    const s = getSettings();
    if (!s.owner || !s.repo) throw new Error('نام کاربری یا مخزن تنظیم نشده است.');
    const url = `${API}/repos/${s.owner}/${s.repo}`;
    const res = await fetch(url, { headers: headers() });
    if (res.status === 401) throw new Error('توکن نامعتبر است (۴۰۱).');
    if (res.status === 403) throw new Error('دسترسی محدود یا نرخ درخواست بالا (۴۰۳).');
    if (res.status === 404) throw new Error('مخزن پیدا نشد (۴۰۴).');
    if (!res.ok) throw new Error(`خطا (${res.status})`);
    return res.json();
  }

  /* ---- اطلاعات فایل ---- */
  async function getFileInfo(path = null) {
    try {
      const f = await readFile(path);
      return f ? { exists: true, size: f.size, sha: f.sha } : { exists: false };
    } catch (e) {
      return { exists: false, error: e.message };
    }
  }

  return {
    getSettings, saveSettings,
    getToken, setToken, isConfigured,
    readFile, writeFile, deleteFile,
    testConnection, getFileInfo
  };
})();