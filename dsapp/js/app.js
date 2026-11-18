import { getSession, onAuthStateChange, signInWithPassword, signUp, signInWithMagicLink } from './services/auth.js';
import {
  listProjects, getProject, getAppState, updateProject,
} from './services/db.js';
import {
  shouldSyncModels, syncModels, loadModelsAndPrefs, getOpenRouterKey,
} from './services/models.js';
import { openProjectFS } from './services/fs.js';
import { state, setState, resetProjectState } from './state.js';
import { el, clear } from './ui/dom.js';
import { toast } from './ui/toast.js';
import { mountShell, setActivePanel } from './ui/shell.js';
import { renderProjects } from './ui/panels/projects.js';
import { renderChat } from './ui/panels/chat.js';
import { renderFiles, resetFilesPanel } from './ui/panels/files.js';
import { renderRoadmap } from './ui/panels/roadmap.js';
import { renderMemory } from './ui/panels/memory.js';
import { renderModels } from './ui/panels/models.js';
import { renderSettings } from './ui/panels/settings.js';
import { STORAGE } from './config.js';

const appRoot = document.getElementById('app');
const panelRenderers = {
  chat: renderChat,
  files: renderFiles,
  roadmap: renderRoadmap,
  memory: renderMemory,
  models: renderModels,
  projects: renderProjects,
  settings: renderSettings,
};

let fileChangeListeners = [];

function buildCtx() {
  return {
    navigate: (id) => setActivePanel(id),
    openProject,
    setProjects: (list) => setState({ projects: list }),
    notifyFileChanged: (path) => {
      for (const fn of fileChangeListeners) fn(path);
    },
    onFileChanged: (fn) => fileChangeListeners.push(fn),
  };
}

const shellCtx = buildCtx();

async function boot() {
  try {
    const session = await getSession();
    if (session) await onAuthenticated(session);
    else renderAuth();

    onAuthStateChange(async (s) => {
      if (s?.user) await onAuthenticated(s);
      else {
        resetProjectState();
        resetFilesPanel();
        renderAuth();
      }
    });
  } catch (err) {
    console.error(err);
    renderFatal(err);
  }
}

async function onAuthenticated(session) {
  const user = session.user;
  setState({ user });

  try {
    const { models, prefs } = await loadModelsAndPrefs();
    setState({ models, modelPrefs: prefs });

    if (models.length === 0) {
      // First-time load or empty registry: synchronously wait for the models.
      toast('Downloading model registry…', 'info', 3000);
      await syncModels();
      const reloaded = await loadModelsAndPrefs();
      setState({ models: reloaded.models, modelPrefs: reloaded.prefs });
    } else if (shouldSyncModels()) {
      // Background sync
      syncModels().then(async () => {
        const reloaded = await loadModelsAndPrefs();
        setState({ models: reloaded.models, modelPrefs: reloaded.prefs });
        window.dispatchEvent(new CustomEvent('devspace:models-updated'));
      }).catch(err => console.warn('Background sync failed:', err.message));
    }
  } catch (err) {
    console.warn('Model load failed:', err.message);
    toast(`Model sync failed: ${err.message}`, 'error', 6000);
  }

  let projects = [];
  try { projects = await listProjects(); } catch (err) { console.warn(err); }
  setState({ projects });

  const lastId = localStorage.getItem(STORAGE.lastProjectId);
  if (lastId && projects.find((p) => p.id === lastId)) {
    await openProject(lastId, { silent: true });
    return;
  }
  if (projects.length === 1) {
    await openProject(projects[0].id, { silent: true });
    return;
  }
  renderShell();
  setActivePanel('projects');
}

async function openProject(projectId, { silent = false } = {}) {
  try {
    const project = await getProject(projectId);
    const fs = await openProjectFS(project);
    resetFilesPanel();
    setState({ currentProject: project, fs });
    localStorage.setItem(STORAGE.lastProjectId, project.id);

    const appState = await getAppState(project.id).catch(() => null);
    state.appState = appState;

    renderShell();
    setActivePanel('chat');

    if (!silent) toast(`Opened ${project.name}`, 'success');

    if (project.fs_mode === 'fsa' && fs.mode !== 'fsa') {
      toast('Local folder unavailable — using virtual workspace. Reconnect in Files → ⋯.', 'error', 5000);
    } else if (fs.needsPermission) {
      toast('Folder access needs re-authorisation. Open Files to grant access.', 'error', 6000);
    }
  } catch (err) {
    toast(err.message || 'Could not open project', 'error');
    renderShell();
    setActivePanel('projects');
  }
}

function renderShell() {
  mountShell(appRoot, { user: state.user, ctx: shellCtx, renderers: panelRenderers });
  window._devspaceShellCtx = shellCtx;
}

function renderAuth() {
  clear(appRoot);
  const container = el('div', { class: 'auth' });
  container.appendChild(el('h1', {}, 'DevSpace'));
  container.appendChild(el('p', {}, 'Sign in to your workspace. Project history syncs to Supabase; project files stay on your device.'));

  const emailInput = el('input', { class: 'input', type: 'email', placeholder: 'you@example.com', autocomplete: 'email' });
  const passwordInput = el('input', { class: 'input', type: 'password', placeholder: 'Password', autocomplete: 'current-password' });
  const submitBtn = el('button', { class: 'btn btn-primary', type: 'submit' }, 'Sign in');
  const magicBtn = el('button', { class: 'btn', type: 'button' }, 'Send magic link');
  const switchBtn = el('button', { type: 'button' }, 'Create account');
  let mode = 'signin';

  const form = el('form', {});
  form.appendChild(emailInput);
  form.appendChild(passwordInput);
  form.appendChild(submitBtn);
  form.appendChild(magicBtn);
  container.appendChild(form);

  const switcher = el('div', { class: 'auth-switch' }, 'No account? ', switchBtn);
  container.appendChild(switcher);

  switchBtn.onclick = () => {
    mode = mode === 'signin' ? 'signup' : 'signin';
    submitBtn.textContent = mode === 'signin' ? 'Sign in' : 'Create account';
    switchBtn.textContent = mode === 'signin' ? 'Create account' : 'Sign in';
    switcher.firstChild.textContent = mode === 'signin' ? 'No account? ' : 'Have an account? ';
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) { toast('Email and password required', 'error'); return; }
    submitBtn.disabled = true;
    try {
      if (mode === 'signin') await signInWithPassword(email, password);
      else {
        const { session } = await signUp(email, password);
        if (!session) toast('Check your email to confirm your account', 'success', 6000);
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  };

  magicBtn.onclick = async () => {
    const email = emailInput.value.trim();
    if (!email) { toast('Enter your email first', 'error'); return; }
    try {
      await signInWithMagicLink(email);
      toast('Magic link sent. Check your inbox.', 'success', 6000);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  appRoot.appendChild(container);
}

function renderFatal(err) {
  clear(appRoot);
  appRoot.appendChild(el('div', { class: 'empty' }, `Failed to start: ${err.message}`));
}

boot();
