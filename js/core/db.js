// ---------------------------------------------------------------------------
// Supabase client: auth (GoTrue) + a small PostgREST query builder.
//
// Written against the REST API directly instead of pulling in supabase-js so
// the app stays dependency-free and the network behaviour is fully visible.
// The publishable key is used as the `apikey` header; user requests also carry
// the user's JWT so Row Level Security applies.
// ---------------------------------------------------------------------------

import { SUPABASE_URL, SUPABASE_KEY, TABLES } from '../config.js';

const AUTH_BASE = `${SUPABASE_URL}/auth/v1`;
const REST_BASE = `${SUPABASE_URL}/rest/v1`;
const SESSION_KEY = 'fb:session';

export class ApiError extends Error {
  constructor(message, info = {}) {
    super(message || 'Request failed');
    this.name = 'ApiError';
    this.status = info.status || 0;
    this.code = info.code || '';
    this.details = info.details ?? null;
    this.hint = info.hint ?? null;
  }

  get isMissingTable() {
    return this.status === 404
      && (this.code === 'PGRST205' || this.code === '42P01' || /could not find the table/i.test(this.message));
  }

  get isPermission() {
    return this.status === 401 || this.status === 403
      || this.code === '42501' || this.code === 'PGRST301';
  }
}

function parseError(status, payload) {
  let message = `Request failed (${status})`;
  let code = '';
  let details = null;
  let hint = null;
  if (payload && typeof payload === 'object') {
    message = payload.message || payload.msg || payload.error_description || payload.error || message;
    code = payload.code || payload.error_code || '';
    details = payload.details ?? null;
    hint = payload.hint ?? null;
  } else if (typeof payload === 'string' && payload.trim()) {
    message = payload.slice(0, 400);
  }
  return new ApiError(message, { status, code, details, hint });
}

async function request(url, { method = 'GET', headers = {}, body, signal } = {}) {
  const h = { apikey: SUPABASE_KEY, ...headers };
  if (!h.Authorization) h.Authorization = `Bearer ${SUPABASE_KEY}`;
  let payload;
  if (body !== undefined) {
    h['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(url, { method, headers: h, body: payload, signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError('Network error — check your connection and the Supabase URL.', { status: 0, code: 'network' });
  }
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) throw parseError(res.status, data);
  return data;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

const AUTH_MESSAGES = {
  invalid_credentials: 'That email and password do not match an account.',
  email_not_confirmed: 'Confirm your email address first — check your inbox.',
  user_already_exists: 'An account with that email already exists. Sign in instead.',
  email_exists: 'An account with that email already exists. Sign in instead.',
  weak_password: 'That password is too weak. Use at least 8 characters.',
  over_email_send_rate_limit: 'Too many emails sent. Wait a few minutes and try again.',
  over_request_rate_limit: 'Too many attempts. Wait a minute and try again.',
  signup_disabled: 'Sign-ups are disabled for this Supabase project.',
  same_password: 'That is already your password.',
};

function friendlyAuthError(err, fallback) {
  const key = err?.code || '';
  if (AUTH_MESSAGES[key]) return new ApiError(AUTH_MESSAGES[key], { ...err });
  if (/invalid login credentials/i.test(err?.message || '')) {
    return new ApiError(AUTH_MESSAGES.invalid_credentials, { ...err });
  }
  if (/email not confirmed/i.test(err?.message || '')) {
    return new ApiError(AUTH_MESSAGES.email_not_confirmed, { ...err });
  }
  return new ApiError(err?.message || fallback, { ...err });
}

class AuthClient {
  constructor() {
    this.session = this._load();
    this._listeners = new Set();
    this._refreshing = null;
    this.ready = false;
  }

  _load() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && parsed.access_token ? parsed : null;
    } catch { return null; }
  }

  _persist(session) {
    this.session = session;
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else localStorage.removeItem(SESSION_KEY);
    } catch { /* private mode */ }
    this._emit();
  }

  _emit() {
    for (const fn of [...this._listeners]) {
      try { fn(this.session); } catch (err) { console.error(err); }
    }
  }

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  get user() { return this.session?.user || null; }
  get isSignedIn() { return Boolean(this.session?.access_token); }

  _absorb(data) {
    if (!data?.access_token) throw new ApiError('Sign-in did not return a session.', { status: 400 });
    this._persist({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (Number(data.expires_in) || 3600) * 1000,
      user: data.user || this.session?.user || null,
    });
  }

  async init() {
    if (!this.session) { this.ready = true; return; }
    try {
      const user = await this.fetchUser();
      this._persist({ ...this.session, user });
    } catch {
      try {
        await this.refresh();
        const user = await this.fetchUser();
        this._persist({ ...this.session, user });
      } catch {
        this._persist(null);
      }
    }
    this.ready = true;
  }

  async fetchUser() {
    const token = await this.token();
    if (!token) return null;
    return request(`${AUTH_BASE}/user`, { headers: { Authorization: `Bearer ${token}` } });
  }

  async signUp(email, password) {
    try {
      const data = await request(`${AUTH_BASE}/signup`, {
        method: 'POST',
        body: { email, password },
      });
      if (data?.access_token) {
        this._absorb(data);
        return { needsConfirmation: false, user: data.user };
      }
      return { needsConfirmation: true, user: data?.user || data };
    } catch (err) {
      throw friendlyAuthError(err, 'Could not create the account.');
    }
  }

  async signIn(email, password) {
    try {
      const data = await request(`${AUTH_BASE}/token?grant_type=password`, {
        method: 'POST',
        body: { email, password },
      });
      this._absorb(data);
      if (!data.user) {
        try { this.session.user = await this.fetchUser(); } catch { /* keep going */ }
        this._persist(this.session);
      }
      return this.session.user;
    } catch (err) {
      throw friendlyAuthError(err, 'Could not sign in.');
    }
  }

  async refresh() {
    if (this._refreshing) return this._refreshing;
    this._refreshing = (async () => {
      if (!this.session?.refresh_token) {
        throw new ApiError('Session expired. Sign in again.', { status: 401, code: 'session_expired' });
      }
      try {
        const data = await request(`${AUTH_BASE}/token?grant_type=refresh_token`, {
          method: 'POST',
          body: { refresh_token: this.session.refresh_token },
        });
        this._absorb(data);
        return this.session.access_token;
      } catch (err) {
        throw new ApiError('Session expired. Sign in again.', { status: 401, code: 'session_expired', details: err?.message });
      } finally {
        this._refreshing = null;
      }
    })();
    return this._refreshing;
  }

  async token() {
    if (!this.session) return null;
    if (Date.now() > (this.session.expires_at || 0) - 90_000) {
      try { return await this.refresh(); } catch { this._persist(null); throw new ApiError('Session expired. Sign in again.', { status: 401, code: 'session_expired' }); }
    }
    return this.session.access_token;
  }

  async signOut() {
    const token = this.session?.access_token;
    this._persist(null);
    if (token) {
      try {
        await request(`${AUTH_BASE}/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      } catch { /* token already dead, fine */ }
    }
  }

  async recover(email) {
    try {
      await request(`${AUTH_BASE}/recover`, { method: 'POST', body: { email } });
    } catch (err) {
      throw friendlyAuthError(err, 'Could not send the recovery email.');
    }
  }

  async updatePassword(password) {
    const token = await this.token();
    try {
      await request(`${AUTH_BASE}/user`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: { password },
      });
    } catch (err) {
      throw friendlyAuthError(err, 'Could not update the password.');
    }
  }
}

export const auth = new AuthClient();

// ---------------------------------------------------------------------------
// PostgREST query builder
// ---------------------------------------------------------------------------

function literal(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return String(value);
  const s = String(value);
  if (s === '') return '""';
  if (/[",()\\\s]/.test(s)) return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  return s;
}

class Query {
  constructor(table) {
    this.table = table;
    this._method = 'GET';
    this._params = new URLSearchParams();
    this._prefer = [];
    this._body = undefined;
    this._single = false;
    this._maybe = false;
    this._signal = null;
  }

  select(cols = '*') {
    this._params.set('select', cols);
    if (this._method !== 'GET') this._prefer.push('return=representation');
    return this;
  }

  insert(rows) {
    this._method = 'POST';
    this._body = Array.isArray(rows) ? rows : [rows];
    this._prefer.push('return=representation');
    if (!this._params.has('select')) this._params.set('select', '*');
    return this;
  }

  upsert(rows, { onConflict = 'id', ignoreDuplicates = false } = {}) {
    this._method = 'POST';
    this._body = Array.isArray(rows) ? rows : [rows];
    this._params.set('on_conflict', onConflict);
    this._prefer.push('return=representation');
    this._prefer.push(ignoreDuplicates ? 'resolution=ignore-duplicates' : 'resolution=merge-duplicates');
    if (!this._params.has('select')) this._params.set('select', '*');
    return this;
  }

  update(patch) {
    this._method = 'PATCH';
    this._body = patch;
    this._prefer.push('return=representation');
    if (!this._params.has('select')) this._params.set('select', '*');
    return this;
  }

  delete() {
    this._method = 'DELETE';
    this._prefer.push('return=representation');
    if (!this._params.has('select')) this._params.set('select', '*');
    return this;
  }

  _filter(column, op, value) {
    if (op === 'in') {
      const list = (Array.isArray(value) ? value : [value]).map(literal).join(',');
      this._params.set(column, `in.(${list})`);
    } else {
      this._params.set(column, `${op}.${literal(value)}`);
    }
    return this;
  }

  eq(column, value) { return this._filter(column, 'eq', value); }
  neq(column, value) { return this._filter(column, 'neq', value); }
  gt(column, value) { return this._filter(column, 'gt', value); }
  gte(column, value) { return this._filter(column, 'gte', value); }
  lt(column, value) { return this._filter(column, 'lt', value); }
  lte(column, value) { return this._filter(column, 'lte', value); }
  like(column, value) { return this._filter(column, 'like', value); }
  ilike(column, value) { return this._filter(column, 'ilike', value); }
  in(column, values) { return this._filter(column, 'in', values); }
  is(column, value) { return this._filter(column, 'is', value); }

  or(expression) {
    this._params.set('or', `(${expression})`);
    return this;
  }

  order(column, { ascending = false, nullsFirst = false } = {}) {
    const dir = ascending ? 'asc' : 'desc';
    const nulls = nullsFirst ? 'nullsfirst' : 'nullslast';
    const existing = this._params.get('order');
    this._params.set('order', existing ? `${existing},${column}.${dir}.${nulls}` : `${column}.${dir}.${nulls}`);
    return this;
  }

  limit(n) {
    this._params.set('limit', String(n));
    return this;
  }

  single() { this._single = true; return this; }

  maybeSingle() { this._maybe = true; return this; }

  abort(signal) { this._signal = signal; return this; }

  async _run() {
    const token = await auth.token();
    if (!token) throw new ApiError('Sign in to continue.', { status: 401, code: 'no_session' });
    const url = new URL(`${REST_BASE}/${this.table}`);
    for (const [key, value] of this._params) url.searchParams.append(key, value);
    const headers = { Authorization: `Bearer ${token}` };
    if (this._prefer.length) headers.Prefer = [...new Set(this._prefer)].join(',');
    if (this._single) headers.Accept = 'application/vnd.pgrst.object+json';

    let res;
    try {
      res = await fetch(url.toString(), {
        method: this._method,
        headers: { ...headers, 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
        body: this._body === undefined ? undefined : JSON.stringify(this._body),
        signal: this._signal,
      });
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      throw new ApiError('Network error talking to Supabase.', { status: 0, code: 'network' });
    }

    const text = await res.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = text; }
    }

    if (!res.ok) {
      if (this._maybe && res.status === 406 && (data?.code === 'PGRST116')) return null;
      if (this._single && res.status === 406 && data?.code === 'PGRST116') {
        return this._maybe ? null : null;
      }
      throw parseError(res.status, data);
    }
    if (this._single) {
      if (Array.isArray(data)) return data[0] ?? null;
      return data;
    }
    return data;
  }

  then(onFulfilled, onRejected) {
    return this._run().then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return this._run().catch(onRejected);
  }
}

// ---------------------------------------------------------------------------
// Public db object
// ---------------------------------------------------------------------------

export const db = {
  auth,
  from: (table) => new Query(table),
  tables: TABLES,

  async checkSchema() {
    const tables = Object.values(TABLES);
    const missing = [];
    let authProblem = false;
    let networkProblem = null;
    await Promise.all(tables.map(async (table) => {
      try {
        await db.from(table).select('*').limit(1);
      } catch (err) {
        if (err?.isMissingTable) missing.push(table);
        else if (err?.status === 401 || err?.status === 403 || err?.code === 'no_session') authProblem = true;
        else if (err?.status === 0) networkProblem = err.message;
      }
    }));
    return {
      ready: missing.length === 0 && !authProblem && !networkProblem,
      missing: missing.sort(),
      authProblem,
      networkProblem,
      expected: tables.length,
    };
  },
};

export { request as supabaseRequest, AUTH_BASE, REST_BASE };
