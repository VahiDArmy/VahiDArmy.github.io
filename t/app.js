/* NOVA Text Holder - multi note + Persian timestamp */

const OWNER = 'vahidarmy';
const REPO  = 'vahidarmy.github.io';
const PATH  = 'nova-notes.json';

const TOKEN_KEY  = 'nova-github-token';
const LOCAL_KEY  = 'nova-notes-data';

const tokenInput  = document.getElementById('tokenInput');
const titleInput  = document.getElementById('titleInput');
const contentEl   = document.getElementById('content');
const notesList   = document.getElementById('notesList');
const statusEl    = document.getElementById('status');
const glowRange   = document.getElementById('glowRange');

let notes = [];
let currentId = null;

function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = 'status ' + type;
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || tokenInput.value.trim();
}

function toBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function fromBase64(str) {
  return decodeURIComponent(escape(atob(str)));
}

function persianTimestamp() {
  const now = new Date();
  const datePart = now.toLocaleDateString('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const timePart = now.toLocaleTimeString('fa-IR', {
    hour: '2-digit',
    minute: '2-digit'
  });
  return `${datePart}  ${timePart}`;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function renderList() {
  notesList.innerHTML = '';
  const sorted = [...notes].sort((a, b) => b.updated - a.updated);

  sorted.forEach(n => {
    const div = document.createElement('div');
    div.className = 'note-item' + (n.id === currentId ? ' active' : '');
    div.dataset.id = n.id;

    const title = document.createElement('div');
    title.className = 'note-title';
    title.textContent = n.title || 'بدون عنوان';

    const date = document.createElement('div');
    date.className = 'note-date';
    date.textContent = new Date(n.updated).toLocaleString('fa-IR');

    div.appendChild(title);
    div.appendChild(date);

    div.addEventListener('click', () => selectNote(n.id));
    notesList.appendChild(div);
  });
}

function selectNote(id) {
  const note = notes.find(n => n.id === id);
  if (!note) return;
  currentId = id;
  titleInput.value = note.title || '';
  contentEl.value = note.content || '';
  renderList();
  setStatus('انتخاب شد');
}

function newNote() {
  const id = uid();
  const note = {
    id,
    title: '',
    content: '',
    updated: Date.now()
  };
  notes.unshift(note);
  currentId = id;
  titleInput.value = '';
  contentEl.value = '';
  renderList();
  contentEl.focus();
  setStatus('یادداشت جدید');
}

function saveCurrentLocally() {
  if (!currentId) return;
  const note = notes.find(n => n.id === currentId);
  if (!note) return;

  let title = titleInput.value.trim();
  if (!title) {
    title = persianTimestamp();
    titleInput.value = title;
  }

  note.title = title;
  note.content = contentEl.value;
  note.updated = Date.now();

  localStorage.setItem(LOCAL_KEY, JSON.stringify(notes));
  renderList();
}

async function saveToCloud() {
  const token = getToken();
  if (!token) {
    setStatus('اول توکن را ذخیره کنید', 'err');
    return;
  }

  saveCurrentLocally();
  setStatus('در حال ذخیره…');

  try {
    let sha = null;
    const getRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    } else if (getRes.status !== 404) {
      const err = await getRes.json();
      throw new Error(err.message || 'خطا در بررسی فایل');
    }

    const body = {
      message: 'Update NOVA notes',
      content: toBase64(JSON.stringify(notes, null, 2)),
      ...(sha ? { sha } : {})
    };

    const putRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );

    if (!putRes.ok) {
      const err = await putRes.json();
      throw new Error(err.message || 'خطای گیت‌هاب');
    }

    setStatus('ذخیره شد ✓', 'ok');
  } catch (e) {
    setStatus('خطا: ' + e.message, 'err');
  }
}

async function loadFromCloud() {
  const token = getToken();
  if (!token) {
    setStatus('اول توکن را ذخیره کنید', 'err');
    return;
  }

  setStatus('در حال بارگذاری…');

  try {
    const res = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    if (res.status === 404) {
      setStatus('هنوز فایلی وجود ندارد', 'err');
      return;
    }
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'خطا در بارگذاری');
    }

    const data = await res.json();
    const parsed = JSON.parse(fromBase64(data.content));
    if (!Array.isArray(parsed)) throw new Error('فرمت نامعتبر');

    notes = parsed;
    localStorage.setItem(LOCAL_KEY, JSON.stringify(notes));

    if (notes.length) {
      selectNote(notes[0].id);
    } else {
      currentId = null;
      titleInput.value = '';
      contentEl.value = '';
      renderList();
    }
    setStatus('بارگذاری شد ✓', 'ok');
  } catch (e) {
    setStatus('خطا: ' + e.message, 'err');
  }
}

function deleteCurrent() {
  if (!currentId) return;
  if (!confirm('این یادداشت حذف شود؟')) return;

  notes = notes.filter(n => n.id !== currentId);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(notes));
  currentId = notes.length ? notes[0].id : null;

  if (currentId) {
    selectNote(currentId);
  } else {
    titleInput.value = '';
    contentEl.value = '';
    renderList();
  }
  setStatus('حذف شد');
}

function copyText() {
  const text = contentEl.value;
  if (!text.trim()) {
    setStatus('متنی نیست');
    return;
  }
  navigator.clipboard.writeText(text).then(() => {
    setStatus('کپی شد!', 'ok');
  }).catch(() => {
    contentEl.select();
    document.execCommand('copy');
    setStatus('کپی شد!', 'ok');
  });
}

function saveToken() {
  const token = tokenInput.value.trim();
  if (!token) {
    setStatus('توکن را وارد کنید', 'err');
    return;
  }
  localStorage.setItem(TOKEN_KEY, token);
  tokenInput.value = '';
  tokenInput.placeholder = '•••••••••••• (ذخیره شد)';
  setStatus('توکن ذخیره شد', 'ok');
}

glowRange.addEventListener('input', () => {
  document.documentElement.style.setProperty('--glow-strength', glowRange.value);
});

document.getElementById('btnNew').addEventListener('click', newNote);
document.getElementById('btnSave').addEventListener('click', saveToCloud);
document.getElementById('btnLoad').addEventListener('click', loadFromCloud);
document.getElementById('btnDelete').addEventListener('click', deleteCurrent);
document.getElementById('btnCopy').addEventListener('click', copyText);
document.getElementById('btnSaveToken').addEventListener('click', saveToken);

titleInput.addEventListener('input', () => {
  if (!currentId) newNote();
  saveCurrentLocally();
});
contentEl.addEventListener('input', () => {
  if (!currentId) newNote();
  saveCurrentLocally();
});

(function init() {
  const savedToken = localStorage.getItem(TOKEN_KEY);
  if (savedToken) {
    tokenInput.placeholder = '•••••••••••• (ذخیره شد)';
  }

  const local = localStorage.getItem(LOCAL_KEY);
  if (local) {
    try {
      notes = JSON.parse(local);
      if (notes.length) {
        selectNote(notes[0].id);
      }
    } catch (e) {
      notes = [];
    }
  }

  document.documentElement.style.setProperty('--glow-strength', glowRange.value);

  if (!notes.length) {
    newNote();
  }
})();