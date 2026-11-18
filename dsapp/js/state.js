export const state = {
  user: null,
  projects: [],
  currentProject: null,
  fs: null,
  models: [],
  modelPrefs: new Map(), // modelId -> { enabled, preferred_role }
  messages: [],
  roadmap: [],
  memory: [],
  checkpoints: [],
  tasks: [],
  operations: [],
  selectedModelId: null,
  running: false,
  pendingQuestion: null,
};

export function setState(patch) {
  Object.assign(state, patch);
}

export function resetProjectState() {
  Object.assign(state, {
    currentProject: null,
    fs: null,
    messages: [],
    roadmap: [],
    memory: [],
    checkpoints: [],
    tasks: [],
    operations: [],
    selectedModelId: null,
    running: false,
    pendingQuestion: null,
  });
}
