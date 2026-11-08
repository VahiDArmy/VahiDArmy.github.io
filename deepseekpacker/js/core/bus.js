// AURORA OS — Event Bus

class Bus {
  constructor() {
    this._m = new Map();
  }
  on(evt, fn) {
    if (!this._m.has(evt)) this._m.set(evt, new Set());
    this._m.get(evt).add(fn);
    return () => this.off(evt, fn);
  }
  once(evt, fn) {
    const off = this.on(evt, (d) => { off(); fn(d); });
    return off;
  }
  off(evt, fn) {
    const set = this._m.get(evt);
    if (set) {
      set.delete(fn);
      if (!set.size) this._m.delete(evt);
    }
  }
  emit(evt, data) {
    const set = this._m.get(evt);
    if (!set) return;
    for (const fn of [...set]) {
      try { fn(data); }
      catch (e) { console.error('[bus]', evt, e); }
    }
  }
  clear(evt) {
    if (evt) this._m.delete(evt);
    else this._m.clear();
  }
  channels() { return [...this._m.keys()]; }
  count(evt) {
    const s = this._m.get(evt);
    return s ? s.size : 0;
  }
}

export const bus = new Bus();
export default bus;
