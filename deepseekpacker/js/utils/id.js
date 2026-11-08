// Small unique-id helper.

let counter = 0;

export function uid(prefix) {
  counter = (counter + 1) % 0xffffff;
  const t = Date.now().toString(36);
  const c = counter.toString(36).padStart(4, '0');
  const r = Math.floor(Math.random() * 0xfffff).toString(36).padStart(4, '0');
  return (prefix ? prefix + '-' : '') + t + c + r;
}
