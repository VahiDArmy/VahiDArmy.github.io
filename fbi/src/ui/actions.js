// One delegated click listener for the entire app keeps markup declarative:
// <button data-action="open-settings">.
const registry = new Map();

export function action(name, fn) {
  if (registry.has(name)) {
    console.warn(`Duplicate action ignored: ${name}`);
    return;
  }
  registry.set(name, fn);
}

export function runAction(name, el, event) {
  const fn = registry.get(name);
  if (!fn) return false;
  fn(el, event);
  return true;
}

export function bindActions() {
  document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    const name = el.dataset.action;
    const fn = registry.get(name);
    if (!fn) return;
    if (el.tagName === 'BUTTON' || el.tagName === 'A') event.preventDefault();
    fn(el, event);
  });
}
