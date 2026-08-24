const OWNER = 'vahidarmy';
const REPO = 'vahidarmy.github.io';
const BRANCH = 'main';

let currentPath = '';
let currentFile = null; // { path, sha }

function getToken() {
  return localStorage.getItem('gh_pat') || '';
}

function setStatus(msg) {
  document.getElementById('status').textContent = msg;
}

async function ghRequest(path, options = {}) {
  const token = getToken();
  if (!token) {
    setStatus('توکن در localStorage تنظیم نشده (gh_pat)');
    throw new Error('No token');
  }

  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('GitHub error:', res.status, text);
    setStatus(`خطا از GitHub: ${res.status}`);
    throw new Error('GitHub error');
  }

  return res.json();
}

/* لیست محتویات مسیر */

async function loadPath(path = '') {
  currentPath = path;
  document.getElementById('current-path').textContent = '/' + (path || '');
  setStatus('در حال بارگذاری...');

  const apiPath = `/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`;
  const data = await ghRequest(apiPath);

  renderFiles(data);
  renderTree(path);
  setStatus('آماده');
}

/* رندر لیست فایل‌ها */

function renderFiles(items) {
  const tbody = document.getElementById('files');
  tbody.innerHTML = '';

  items.forEach(item => {
    const tr = document.createElement('tr');

    const tdName = document.createElement('td');
    tdName.textContent = item.name;
    tdName.style.cursor = 'pointer';
    tdName.onclick = () => {
      if (item.type === 'dir') {
        loadPath(item.path);
      } else {
        openFile(item);
      }
    };

    const tdType = document.createElement('td');
    tdType.textContent = item.type;

    const tdSize = document.createElement('td');
    tdSize.textContent = item.size || '';

    const tdActions = document.createElement('td');

    const btnRename = document.createElement('button');
    btnRename.textContent = 'Rename';
    btnRename.onclick = () => renameItem(item);

    const btnDelete = document.createElement('button');
    btnDelete.textContent = 'Delete';
    btnDelete.onclick = () => deleteItem(item);

    tdActions.appendChild(btnRename);
    tdActions.appendChild(btnDelete);

    tr.appendChild(tdName);
    tr.appendChild(tdType);
    tr.appendChild(tdSize);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
}

/* رندر ساده درخت پوشه‌ها (فقط مسیر فعلی و بالا رفتن) */

function renderTree(path) {
  const ul = document.getElementById('tree');
  ul.innerHTML = '';

  const rootLi = document.createElement('li');
  rootLi.textContent = '/';
  rootLi.onclick = () => loadPath('');
  ul.appendChild(rootLi);

  if (!path) return;

  const parts = path.split('/');
  let accum = '';
  parts.forEach((p, idx) => {
    accum = idx === 0 ? p : accum + '/' + p;
    const li = document.createElement('li');
    li.textContent = '/' + accum;
    li.onclick = () => loadPath(accum);
    ul.appendChild(li);
  });
}

/* باز کردن فایل */

async function openFile(item) {
  setStatus('در حال دریافت فایل...');
  const apiPath = `/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(item.path)}`;
  const data = await ghRequest(apiPath);

  const content = atob(data.content.replace(/\n/g, ''));
  currentFile = { path: item.path, sha: data.sha };

  document.getElementById('editor-filename').textContent = item.path;
  document.getElementById('editor-content').value = content;
  setStatus('فایل باز شد');
}

/* ذخیره فایل (ویرایش) */

async function saveFile() {
  if (!currentFile) {
    setStatus('هیچ فایلی برای ذخیره انتخاب نشده');
    return;
  }

  const text = document.getElementById('editor-content').value;
  const contentBase64 = btoa(text);

  const body = {
    message: `Edit ${currentFile.path} via web file manager`,
    content: contentBase64,
    sha: currentFile.sha,
    branch: BRANCH
  };

  setStatus('در حال ذخیره...');
  const apiPath = `/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(currentFile.path)}`;
  const res = await ghRequest(apiPath, {
    method: 'PUT',
    body: JSON.stringify(body)
  });

  currentFile.sha = res.content.sha;
  setStatus('ذخیره شد');
}

/* ساخت فایل جدید */

async function newFile() {
  const name = prompt('نام فایل جدید (مثلاً test.txt):');
  if (!name) return;

  const fullPath = currentPath ? `${currentPath}/${name}` : name;
  const contentBase64 = btoa('');

  const body = {
    message: `Create ${fullPath} via web file manager`,
    content: contentBase64,
    branch: BRANCH
  };

  setStatus('در حال ساخت فایل جدید...');
  const apiPath = `/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(fullPath)}`;
  await ghRequest(apiPath, {
    method: 'PUT',
    body: JSON.stringify(body)
  });

  setStatus('فایل جدید ساخته شد');
  loadPath(currentPath);
}

/* ساخت پوشه جدید (در GitHub در واقع با ساخت فایل یا README داخل پوشه انجام می‌شود) */

async function newFolder() {
  const name = prompt('نام پوشه جدید:');
  if (!name) return;

  const fullPath = currentPath ? `${currentPath}/${name}/.gitkeep` : `${name}/.gitkeep`;
  const contentBase64 = btoa('');

  const body = {
    message: `Create folder ${name} via web file manager`,
    content: contentBase64,
    branch: BRANCH
  };

  setStatus('در حال ساخت پوشه...');
  const apiPath = `/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(fullPath)}`;
  await ghRequest(apiPath, {
    method: 'PUT',
    body: JSON.stringify(body)
  });

  setStatus('پوشه ساخته شد');
  loadPath(currentPath);
}

/* حذف آیتم */

async function deleteItem(item) {
  if (!confirm(`حذف ${item.path}؟`)) return;

  const apiPath = `/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(item.path)}`;
  const data = await ghRequest(apiPath); // برای گرفتن sha

  const body = {
    message: `Delete ${item.path} via web file manager`,
    sha: data.sha,
    branch: BRANCH
  };

  setStatus('در حال حذف...');
  await ghRequest(apiPath, {
    method: 'DELETE',
    body: JSON.stringify(body)
  });

  setStatus('حذف شد');
  loadPath(currentPath);
}

/* Rename (در GitHub یعنی ساخت فایل جدید و حذف قبلی) */

async function renameItem(item) {
  const newName = prompt('نام جدید:', item.name);
  if (!newName || newName === item.name) return;

  const newPath = (currentPath ? `${currentPath}/` : '') + newName;

  // 1. گرفتن محتوا
  const apiPath = `/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(item.path)}`;
  const data = await ghRequest(apiPath);

  // 2. ساخت فایل جدید
  const bodyCreate = {
    message: `Rename ${item.path} to ${newPath} (create new)`,
    content: data.content,
    branch: BRANCH
  };

  await ghRequest(`/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(newPath)}`, {
    method: 'PUT',
    body: JSON.stringify(bodyCreate)
  });

  // 3. حذف فایل قدیمی
  const bodyDelete = {
    message: `Rename ${item.path} to ${newPath} (delete old)`,
    sha: data.sha,
    branch: BRANCH
  };

  await ghRequest(apiPath, {
    method: 'DELETE',
    body: JSON.stringify(bodyDelete)
  });

  setStatus('Rename انجام شد');
  loadPath(currentPath);
}

/* تنظیم توکن از طریق UI (اختیاری) */

function setupTokenButton() {
  const btn = document.getElementById('btn-set-token');
  btn.onclick = () => {
    const token = prompt('توکن PAT را وارد کن (فقط برای خودت):');
    if (!token) return;
    localStorage.setItem('gh_pat', token);
    alert('توکن ذخیره شد در localStorage (gh_pat)');
  };
}

/* دکمه‌ها */

function setupButtons() {
  document.getElementById('btn-new-file').onclick = newFile;
  document.getElementById('btn-new-folder').onclick = newFolder;
  document.getElementById('btn-save').onclick = saveFile;
  document.getElementById('btn-delete').onclick = () => {
    if (!currentFile) {
      setStatus('هیچ فایلی برای حذف انتخاب نشده');
      return;
    }
    deleteItem({ path: currentFile.path });
  };
  setupTokenButton();
}

/* شروع */

window.addEventListener('DOMContentLoaded', () => {
  setupButtons();
  loadPath('');
});
