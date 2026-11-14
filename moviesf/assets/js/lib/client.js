/* ============================================================================
   FULL METAL CINEMA — data client
   A dependency-free Supabase client: auth + PostgREST query builder.
   Falls back to a fully local backend (demo mode) that mirrors the same API,
   and keeps an outbox of writes that failed while offline.
   ========================================================================== */

const ls = {
  get(k, d) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }
    catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch { return false; }
  },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

export class ApiError extends Error {
  constructor(message, { status = 0, code = '', details = '', hint = '' } = {}) {
    super(message || 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.hint = hint;
  }
  get isAuth() { return this.status === 401 || this.status === 403; }
  get offline() { return this.status === 0; }
}

export class Query {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.verb = 'select';
    this.params = new URLSearchParams();
    this.columns = '*';
    this.body = null;
    this.filters = [];
    this.wantCount = false;
    this.singleMode = null;
    this.orderBy = null;
    this.limiting = null;
    this.offsetting = null;
    this.returning = false;
  }

  /* ---- projection ---- */
  select(columns = '*', { count = false } = {}) {
    this.columns = columns;
    this.wantCount = !!count;
    if (this.verb === 'select') this.returning = true;
    return this;
  }
  insert(rows) { this.verb = 'insert'; this.body = rows; return this; }
  update(patch) { this.verb = 'update'; this.body = patch; return this; }
  upsert(rows, { onConflict = '' } = {}) {
    this.verb = 'upsert';
    this.body = rows;
    this.onConflict = onConflict;
    return this;
  }
  delete() { this.verb = 'delete'; return this; }

  /* ---- filters ---- */
  _f(op, column, value) {
    this.filters.push({ op, column, value });
    return this;
  }
  eq(c, v) { return this._f('eq', c, v); }
  neq(c, v) { return this._f('neq', c, v); }
  gt(c, v) { return this._f('gt', c, v); }
  gte(c, v) { return this._f('gte', c, v); }
  lt(c, v) { return this._f('lt', c, v); }
  lte(c, v) { return this._f('lte', c, v); }
  like(c, v) { return this._f('like', c, v); }
  ilike(c, v) { return this._f('ilike', c, v); }
  is(c, v) { return this._f('is', c, v); }
  in(c, v) { return this._f('in', c, v); }
  contains(c, v) { return this._f('cs', c, v); }
  or(expr) { return this._f('or', null, expr); }
  textSearch(c, q, opts = {}) { return this._f('fts', c, { q, ...opts }); }
  match(obj) { Object.entries(obj || {}).forEach(([k, v]) => this.eq(k, v)); return this; }

  order(column, { ascending = true, nullsFirst = false } = {}) {
    this.orderBy = { column, ascending, nullsFirst };
    return this;
  }
  limit(n) { this.limiting = n; return this; }
  range(from, to) { this.offsetting = from; this.limiting = to - from + 1; return this; }
  maybeSingle() { this.singleMode = 'maybe'; return this; }
  single() { this.singleMode = 'one'; return this; }

  /* ---- url building (remote only) ---- */
  _url() {
    const p = new URLSearchParams();
    p.set('select', this.columns);
    for (const f of this.filters) {
      if (f.op === 'or') { p.set('or', `(${f.value})`); continue; }
      if (f.op === 'fts') {
        p.set(f.column, `fts.${f.value.q}`);
        if (f.value.type) p.set('config', f.value.type);
        continue;
      }
      let v = f.value;
      if (Array.isArray(v)) v = `(${v.map((x) => (x === null ? 'null' : JSON.stringify(String(x)))).join(',')})`;
      else if (v === null) v = 'null';
      else if (typeof v === 'string' && f.op === 'is') v = v;
      else v = String(v);
      p.set(f.column, `${f.op}.${v}`);
    }
    if (this.orderBy) {
      p.set('order', `${this.orderBy.column}.${this.orderBy.ascending ? 'asc' : 'desc'}${this.orderBy.nullsFirst ? '.nullsfirst' : ''}`);
    }
    if (this.limiting != null) p.set('limit', String(this.limiting));
    if (this.offsetting != null) p.set('offset', String(this.offsetting));
    return `${this.client.url}/rest/v1/${this.table}?${p.toString()}`;
  }

  /* ---- execution ---- */
  async _run() {
    if (this.client.mode === 'local') return this.client.local.query(this);
    const method = { select: 'GET', insert: 'POST', update: 'PATCH', upsert: 'POST', delete: 'DELETE' }[this.verb];
    const headers = { 'Content-Type': 'application/json' };
    if (this.verb !== 'select' || this.returning) headers.Prefer = 'return=representation';
    if (this.wantCount) headers.Prefer = `${headers.Prefer || 'return=minimal'},count=exact`;
    if (this.verb === 'upsert') {
      headers.Prefer = `${headers.Prefer || 'return=representation'},resolution=merge-duplicates`;
      if (this.onConflict) headers['On-Conflict'] = this.onConflict;
    }
    const body = this.body == null ? undefined : JSON.stringify(this.body);
    const res = await this.client.request(this._url(), { method, headers, body });
    const countHeader = res.headers.get('content-range');
    const count = countHeader && countHeader.includes('/')
      ? Number(countHeader.split('/')[1])
      : (Array.isArray(res.data) ? res.data.length : null);
    return { data: res.data, count, error: null };
  }

  then(resolve, reject) {
    return this._run().then((r) => {
      if (this.singleMode && Array.isArray(r.data)) {
        if (r.data.length > 1 && this.singleMode === 'one') {
          return { data: null, count: r.count, error: new ApiError('Multiple rows returned for a single request', { code: 'PGRST116' }) };
        }
        r = { ...r, data: r.data[0] || null };
      }
      return r;
    }).then(resolve, reject);
  }
  catch(fn) { return this.then((r) => r).catch(fn); }
}

/* ========================================================================== */
/*  LOCAL BACKEND — demo mode, offline cache, seeded platoon                 */
/* ========================================================================== */
class LocalBackend {
  constructor(prefix) {
    this.prefix = prefix;
    this.cache = new Map();
    this.bus = new Set();
    this.userId = 'demo-user-0000-0000-0000-000000000001';
  }
  key(t) { return `${this.prefix}db.${t}`; }
  table(t) {
    if (!this.cache.has(t)) this.cache.set(t, ls.get(this.key(t), []));
    return this.cache.get(t);
  }
  save(t, rows) {
    this.cache.set(t, rows);
    ls.set(this.key(t), rows);
    this.bus.forEach((fn) => fn(t, rows));
  }
  wipe() {
    const names = Object.keys(localStorage).filter((k) => k.startsWith(`${this.prefix}db.`));
    names.forEach((k) => ls.del(k));
    this.cache.clear();
  }
  /* ---- filter / sort engine ---- */
  _match(row, f) {
    const v = row[f.column];
    const val = f.value;
    switch (f.op) {
      case 'eq': return String(v) === String(val);
      case 'neq': return String(v) !== String(val);
      case 'gt': return Number(v) > Number(val);
      case 'gte': return Number(v) >= Number(val);
      case 'lt': return Number(v) < Number(val);
      case 'lte': return Number(v) <= Number(val);
      case 'is':
        if (val === 'null' || val === null) return v === null || v === undefined;
        if (val === true || val === 'true') return v === true;
        if (val === false || val === 'false') return v === false;
        return v === val;
      case 'in': return (Array.isArray(val) ? val : String(val).replace(/[()]/g, '').split(',')).map(String).includes(String(v));
      case 'like': return new RegExp('^' + String(val).replace(/%/g, '.*').replace(/_/g, '.') + '$', 'is').test(String(v ?? ''));
      case 'ilike': return new RegExp('^' + String(val).replace(/%/g, '.*').replace(/_/g, '.') + '$', 'is').test(String(v ?? ''));
      case 'or': {
        const expr = String(val).replace(/^\(|\)$/g, '');
        return expr.split(',').some((part) => {
          const [col, op, ...rest] = part.split('.');
          return this._match(row, { column: col, op: op === 'eq' ? 'eq' : op, value: rest.join('.') });
        });
      }
      case 'fts': {
        const terms = String(val.q || '').toLowerCase().split(/\s+/).filter(Boolean);
        const hay = Object.values(row).filter((x) => typeof x === 'string').join(' ').toLowerCase();
        return terms.every((t) => hay.includes(t));
      }
      default: return true;
    }
  }
  _project(row, cols) {
    if (!cols || cols === '*' || cols.trim() === '*') return { ...row };
    const parts = cols.split(',').map((s) => s.trim());
    const out = {};
    for (const p of parts) {
      if (p.includes(':')) {
        const [alias, path] = p.split(':');
        out[alias.trim()] = row[path.trim()];
      } else if (p.includes('(')) {
        continue; // relations are not emulated; ignored gracefully
      } else out[p] = row[p];
    }
    return out;
  }
  async query(q) {
    const rows = this.table(q.table);
    let data = [...rows];
    for (const f of q.filters) data = data.filter((r) => this._match(r, f));
    const total = data.length;

    if (q.verb === 'insert' || q.verb === 'upsert') {
      const incoming = Array.isArray(q.body) ? q.body : [q.body];
      const added = [];
      const next = [...rows];
      for (const item of incoming) {
        const rec = { id: rid(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), user_id: this.userId, ...item };
        if (q.verb === 'upsert') {
          const idx = next.findIndex((r) => r.id === rec.id);
          if (idx >= 0) { next[idx] = { ...next[idx], ...rec }; added.push(next[idx]); continue; }
        }
        next.unshift(rec);
        added.push(rec);
      }
      this.save(q.table, next);
      const out = added.map((r) => this._project(r, q.columns));
      return { data: out, count: out.length, error: null };
    }

    if (q.verb === 'update') {
      const ids = new Set(rows.filter((r) => q.filters.every((f) => this._match(r, f))).map((r) => r.id));
      const next = rows.map((r) => (ids.has(r.id) ? { ...r, ...q.body, updated_at: new Date().toISOString() } : r));
      this.save(q.table, next);
      const out = next.filter((r) => ids.has(r.id)).map((r) => this._project(r, q.columns));
      return { data: out, count: out.length, error: null };
    }

    if (q.verb === 'delete') {
      const next = rows.filter((r) => !q.filters.every((f) => this._match(r, f)));
      this.save(q.table, next);
      return { data: null, count: rows.length - next.length, error: null };
    }

    if (q.orderBy) {
      const { column, ascending, nullsFirst } = q.orderBy;
      data.sort((a, b) => {
        const x = a[column], y = b[column];
        if (x == null && y == null) return 0;
        if (x == null) return nullsFirst ? -1 : 1;
        if (y == null) return nullsFirst ? 1 : -1;
        const nx = typeof x === 'number' ? x : Date.parse(x) || x;
        const ny = typeof y === 'number' ? y : Date.parse(y) || y;
        if (nx < ny) return ascending ? -1 : 1;
        if (nx > ny) return ascending ? 1 : -1;
        return 0;
      });
    } else {
      data.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    }
    if (q.offsetting) data = data.slice(q.offsetting);
    if (q.limiting != null) data = data.slice(0, q.limiting);
    return { data: data.map((r) => this._project(r, q.columns)), count: total, error: null };
  }

  seed(tables) {
    for (const [name, rows] of Object.entries(tables)) {
      if (!this.table(name).length) this.save(name, rows);
    }
  }
}

export function rid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* ========================================================================== */
/*  CLIENT                                                                    */
/* ========================================================================== */
export class CinemaClient {
  constructor({ url = '', anonKey = '', prefix = 'fmc4.', edgeAiFunction = '' } = {}) {
    this.url = (url || '').replace(/\/+$/, '');
    this.anonKey = anonKey || '';
    this.prefix = prefix;
    this.edgeAiFunction = edgeAiFunction;
    this.mode = this.configured ? 'remote' : 'local';
    this.session = ls.get(`${prefix}session`, null);
    this.listeners = new Set();
    this.local = new LocalBackend(prefix);
    this.pending = ls.get(`${prefix}outbox`, []);
    this.refreshTimer = null;
    if (this.mode === 'local' && this.session && !this.session.user?.id) this.session = null;
  }

  get configured() {
    return /^https?:\/\/.+/.test(this.url) && this.anonKey.length > 30 && !this.url.includes('YOUR-PROJECT');
  }
  get isDemo() { return this.mode === 'local'; }
  get user() { return this.session?.user || null; }
  get accessToken() { return this.session?.access_token || null; }

  from(table) { return new Query(this, table); }

  /* ---- transport ---- */
  async request(path, { method = 'GET', headers = {}, body, auth = true, timeout = 20000 } = {}) {
    const url = path.startsWith('http') ? path : `${this.url}${path}`;
    const h = {
      apikey: this.anonKey,
      Accept: 'application/json',
      ...headers,
    };
    const token = this.accessToken || this.anonKey;
    if (auth && token) h.Authorization = `Bearer ${token}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, { method, headers: h, body, signal: ctrl.signal });
      const text = await res.text();
      let data = null;
      if (text) {
        try { data = JSON.parse(text); } catch { data = text; }
      }
      if (!res.ok) {
        const msg = (data && (data.msg || data.message || data.error_description || data.error)) || `HTTP ${res.status}`;
        throw new ApiError(msg, {
          status: res.status,
          code: data?.code || '',
          details: data?.details || '',
          hint: data?.hint || '',
        });
      }
      return { data, headers: res.headers, status: res.status };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err.name === 'AbortError') throw new ApiError('Request timed out', { status: 0 });
      throw new ApiError(err.message || 'Network unreachable', { status: 0 });
    } finally {
      clearTimeout(timer);
    }
  }

  /* ---- auth ---- */
  _emit(event) {
    this.listeners.forEach((fn) => { try { fn(event, this.session); } catch (e) { console.error(e); } });
  }
  onAuth(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  _persist(session) {
    this.session = session;
    if (session) {
      ls.set(`${this.prefix}session`, session);
      this._scheduleRefresh();
    } else {
      ls.del(`${this.prefix}session`);
    }
    this._emit(session ? 'SIGNED_IN' : 'SIGNED_OUT');
  }
  _scheduleRefresh() {
    clearTimeout(this.refreshTimer);
    const exp = this.session?.expires_at ? this.session.expires_at * 1000 : 0;
    if (!exp) return;
    const wait = Math.max(exp - Date.now() - 60000, 5000);
    this.refreshTimer = setTimeout(() => { this.refresh().catch(() => {}); }, Math.min(wait, 30 * 60 * 1000));
  }
  _sessionFrom(payload) {
    const expires_in = payload.expires_in || 3600;
    return {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      token_type: payload.token_type || 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + expires_in,
      user: payload.user || this.session?.user || null,
    };
  }

  async signIn(email, password) {
    if (this.mode === 'local') return this.localSignIn(email);
    const { data } = await this.request('/auth/v1/token?grant_type=password', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, password }),
    });
    this._persist(this._sessionFrom(data));
    return data;
  }

  async signUp(email, password, meta = {}) {
    if (this.mode === 'local') return this.localSignIn(email);
    const { data } = await this.request('/auth/v1/signup', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, password, data: meta }),
    });
    if (data?.access_token) this._persist(this._sessionFrom(data));
    return data;
  }

  async signInWithOtp(email) {
    if (this.mode === 'local') return this.localSignIn(email);
    const { data } = await this.request('/auth/v1/otp', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, create_user: true }),
    });
    return data;
  }

  async sendRecovery(email) {
    if (this.mode === 'local') return { ok: true };
    const { data } = await this.request('/auth/v1/recover', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email }),
    });
    return data;
  }

  async refresh() {
    if (this.mode === 'local' || !this.session?.refresh_token) return this.session;
    const { data } = await this.request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ refresh_token: this.session.refresh_token }),
    });
    this._persist(this._sessionFrom(data));
    return this.session;
  }

  async signOut() {
    if (this.mode === 'remote' && this.session?.access_token) {
      try {
        await this.request('/auth/v1/logout', { method: 'POST', body: '{}' });
      } catch { /* a dead token is still a sign-out */ }
    }
    clearTimeout(this.refreshTimer);
    this._persist(null);
  }

  async loadUser() {
    if (this.mode === 'local') return this.session?.user || null;
    if (!this.session?.access_token) return null;
    try {
      const { data } = await this.request('/auth/v1/user');
      this.session.user = data;
      ls.set(`${this.prefix}session`, this.session);
      return data;
    } catch (err) {
      if (err.status === 401) {
        try { await this.refresh(); return this.session?.user || null; }
        catch { this._persist(null); return null; }
      }
      return this.session?.user || null;
    }
  }

  localSignIn(email) {
    const user = {
      id: this.local.userId,
      email: email || 'operator@local',
      user_metadata: { callsign: (email || 'operator').split('@')[0].slice(0, 14).toUpperCase() },
    };
    this._persist({ access_token: 'local', refresh_token: 'local', expires_at: Math.floor(Date.now() / 1000) + 86400 * 365, user });
    return { user };
  }

  /* ---- edge function (optional AI fallback) ---- */
  async callEdge(body) {
    if (!this.edgeAiFunction) throw new ApiError('No edge function configured', { status: 0 });
    const { data, headers } = await this.request(`/functions/v1/${this.edgeAiFunction}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeout: 120000,
    });
    return data;
  }

  /* ---- outbox ---- */
  queue(op) {
    this.pending.push({ ...op, queued_at: new Date().toISOString(), id: rid() });
    ls.set(`${this.prefix}outbox`, this.pending);
  }
  clearQueue() { this.pending = []; ls.set(`${this.prefix}outbox`, []); }

  /* ---- local-mode extras ---- */
  seedLocal(tables) { this.local.seed(tables); }
  wipeLocal() { this.local.wipe(); }
}

export { ls as localStorageSafe };
