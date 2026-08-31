/* NOVA Text Holder - multi note + Persian + rate limit + time glow + Three.js particles */

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
const sidebar     = document.getElementById('sidebar');
const rateValue   = document.getElementById('rateValue');

let notes = [];
let currentId = null;

/* ========== Three.js Particle Mist ========== */
function initParticles() {
  if (typeof THREE === 'undefined') return;

  const canvas = document.getElementById('bg-canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: 'low-power'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 18;

  const isMobile = window.innerWidth < 768;
  const COUNT = isMobile ? 70 : 130;

  const positions = new Float32Array(COUNT * 3);
  const velocities = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const sizes = new Float32Array(COUNT);

  const palette = [
    [0.0, 0.9, 1.0],   // cyan
    [0.5, 1.0, 0.3],   // half-life green
    [1.0, 0.4, 0.05],  // orange
    [0.6, 0.2, 1.0],   // purple
    [0.2, 0.8, 0.7]    // teal
  ];

  for (let i = 0; i < COUNT; i++) {
    const i3 = i * 3;
    positions[i3]     = (Math.random() - 0.5) * 40;
    positions[i3 + 1] = (Math.random() - 0.5) * 28;
    positions[i3 + 2] = (Math.random() - 0.5) * 20;

    velocities[i3]     = (Math.random() - 0.5) * 0.008;
    velocities[i3 + 1] = (Math.random() - 0.5) * 0.006 + 0.002;
    velocities[i3 + 2] = (Math.random() - 0.5) * 0.005;

    const c = palette[Math.floor(Math.random() * palette.length)];
    colors[i3]     = c[0];
    colors[i3 + 1] = c[1];
    colors[i3 + 2] = c[2];

    sizes[i] = Math.random() * 3.5 + 1.2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const texCanvas = document.createElement('canvas');
  texCanvas.width = 64;
  texCanvas.height = 64;
  const ctx = texCanvas.getContext('2d');
  const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(texCanvas);

  const material = new THREE.PointsMaterial({
    size: 0.55,
    map: texture,
    transparent: true,
    opacity: 0.55,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  let mouseX = 0, mouseY = 0;
  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  function animate() {
    requestAnimationFrame(animate);

    const pos = geometry.attributes.position.array;
    const t = Date.now() * 0.00015;

    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3;

      pos[i3]     += velocities[i3] + Math.sin(t + i) * 0.0015;
      pos[i3 + 1] += velocities[i3 + 1] + Math.cos(t * 0.7 + i) * 0.0012;
      pos[i3 + 2] += velocities[i3 + 2];

      if (pos[i3] > 22) pos[i3] = -22;
      if (pos[i3] < -22) pos[i3] = 22;
      if (pos[i3 + 1] > 16) pos[i3 + 1] = -16;
      if (pos[i3 + 1] < -16) pos[i3 + 1] = 16;
      if (pos[i3 + 2] > 12) pos[i3 + 2] = -12;
      if (pos[i3 + 2] < -12) pos[i3 + 2] = 12;
    }

    geometry.attributes.position.needsUpdate = true;

    camera.position.x += (mouseX * 1.5 - camera.position.x) * 0.02;
    camera.position.y += (-mouseY * 1.2 - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);

    const tg = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--time-glow')) || 1;
    material.opacity = 0.35 + 0.25 * tg;

    renderer.render(scene, camera);
  }

  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

/* ========== App Logic ========== */
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

function startTimeGlow() {
  function tick() {
    const t = Date.now() / 1000;
    const value = 0.75 + 0.35 * Math.sin(t * 0.35) + 0.15 * Math.sin(t * 0.9);
    document.documentElement.style.setProperty('--time-glow', value.toFixed(3));
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

async function updateRateLimit() {
  const token = getToken();
  if (!token) {
    rateValue.textContent = '—';
    rateValue.className = 'rate-value';
    return;
  }

  try {
    const res = await fetch('https://api.github.com/rate_limit', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!res.ok) {
      rateValue.textContent = 'err';
      return;
    }

    const data = await res.json();
    const core = data.resources.core;
    const remaining = core.remaining;
    const limit = core.limit;

    rateValue.textContent = `${remaining} / ${limit}`;
    rateValue.className = 'rate-value';

    if (remaining < 200) rateValue.classList.add('critical');
    else if (remaining < 1000) rateValue.classList.add('low');
  } catch (e) {
    rateValue.textContent = '—';
  }
}

function renderList() {
  notesList.innerHTML = '';
  const sorted = [...notes].sort((a, b) => b.updated - a.updated);

  sorted.forEach(n => {
    const div = document.createElement('div');
    div.className = 'note-item' + (n.id === currentId ? ' active' : '');
    div.dataset.id = n.id;

    const info = document.createElement('div');
    info.className = 'note-info';

    const title = document.createElement('div');
    title.className = 'note-title';
    title.textContent = n.title || 'بدون عنوان';

    const date = document.createElement('div');
    date.className = 'note-date';
    date.textContent = new Date(n.updated).toLocaleString('fa-IR');

    info.appendChild(title);
    info.appendChild(date);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-del';
    delBtn.innerHTML = '×';
    delBtn.title = 'حذف کامل';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteNote(n.id);
    });

    div.appendChild(info);
    div.appendChild(delBtn);

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
  const note = { id, title: '', content: '', updated: Date.now() };
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

async function pushToCloud(showStatus = true) {
  const token = getToken();
  if (!token) {
    if (showStatus) setStatus('اول توکن را ذخیره کنید', 'err');
    return false;
  }

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

    updateRateLimit();
    return true;
  } catch (e) {
    if (showStatus) setStatus('خطا: ' + e.message, 'err');
    return false;
  }
}

async function saveToCloud() {
  saveCurrentLocally();
  setStatus('در حال ذخیره…');
  const ok = await pushToCloud(true);
  if (ok) setStatus('ذخیره شد ✓', 'ok');
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

    if (notes.length) selectNote(notes[0].id);
    else {
      currentId = null;
      titleInput.value = '';
      contentEl.value = '';
      renderList();
    }
    setStatus('بارگذاری شد ✓', 'ok');
    updateRateLimit();
  } catch (e) {
    setStatus('خطا: ' + e.message, 'err');
  }
}

async function deleteNote(id) {
  if (!confirm('این یادداشت برای همیشه حذف شود؟ (از کلود هم پاک می‌شود)')) return;

  notes = notes.filter(n => n.id !== id);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(notes));

  if (currentId === id) {
    currentId = notes.length ? notes[0].id : null;
    if (currentId) selectNote(currentId);
    else {
      titleInput.value = '';
      contentEl.value = '';
      renderList();
    }
  } else {
    renderList();
  }

  setStatus('در حال حذف از کلود…');
  const ok = await pushToCloud(true);
  if (ok) setStatus('حذف کامل شد ✓', 'ok');
  else setStatus('محلی حذف شد، اما کلود به‌روز نشد', 'err');
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
  updateRateLimit();
}

glowRange.addEventListener('input', () => {
  document.documentElement.style.setProperty('--glow-strength', glowRange.value);
});

document.getElementById('btnToggle').addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
});

document.getElementById('btnNew').addEventListener('click', newNote);
document.getElementById('btnSave').addEventListener('click', saveToCloud);
document.getElementById('btnLoad').addEventListener('click', loadFromCloud);
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

/* init */
(function init() {
  const savedToken = localStorage.getItem(TOKEN_KEY);
  if (savedToken) tokenInput.placeholder = '•••••••••••• (ذخیره شد)';

  const local = localStorage.getItem(LOCAL_KEY);
  if (local) {
    try {
      notes = JSON.parse(local);
      if (notes.length) selectNote(notes[0].id);
    } catch (e) { notes = []; }
  }

  document.documentElement.style.setProperty('--glow-strength', glowRange.value);

  if (!notes.length) newNote();

  if (window.innerWidth <= 768) sidebar.classList.add('collapsed');

  updateRateLimit();
  startTimeGlow();
  initParticles();
})();