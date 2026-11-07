/**
 * db.js — لایهٔ Supabase (فقط Auth + چند تابع اختصاصی با پیشوند q56_)
 * اگر جدول‌ها ساخته نشده باشند یا شبکه نبود، سایت در «حالت محلی» با localStorage کار می‌کند.
 */
import { store, toast } from "./core.js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SITE } from "./config.js";

const RPC = {
  counters: "q56_counter_summary",
  history: "q56_read_history",
  increment: "q56_increment_read",
  claim: "q56_claim_slot",
};

const LOCAL_KEYS = { counters: "local-counters", history: "local-history", profile: "local-profile" };

export const state = {
  ready: false,
  online: false,
  user: null,
  profile: null,
  needsSetup: false,
  slot: null,
  configError: null,
};

let client = null;
const listeners = new Set();

export function onAuthChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of [...listeners]) {
    try {
      fn(state);
    } catch (err) {
      console.error("[vaqia] listener", err);
    }
  }
}

/* ---------- راه‌اندازی ---------- */
export async function initAuth() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    state.ready = true;
    emit();
    return state;
  }
  try {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
    });
    state.online = true;

    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data?.session?.user) {
      state.user = data.session.user;
      await refreshProfile();
    }

    client.auth.onAuthStateChange((event, session) => {
      setTimeout(async () => {
        if (event === "SIGNED_OUT") {
          state.user = null;
          state.profile = null;
          state.slot = null;
          emit();
          return;
        }
        if (!session?.user) return;
        const changed = state.user?.id !== session.user.id;
        state.user = session.user;
        if (changed || !state.profile) await refreshProfile();
        emit();
      }, 0);
    });
  } catch (err) {
    console.warn("[vaqia] supabase init failed", err);
    state.configError = err?.message || String(err);
  } finally {
    state.ready = true;
    emit();
  }
  return state;
}

export function isOnline() {
  return Boolean(client) && !state.configError;
}

/* ---------- حساب و پروفایل ---------- */
export async function refreshProfile() {
  if (!client || !state.user) return null;
  try {
    const { data, error } = await client
      .from("q56_profiles")
      .select("id, slot, display_name, theme, font_step, created_at")
      .eq("id", state.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      const claimed = await claimSlot();
      return claimed;
    }
    state.profile = data;
    state.slot = data.slot ?? null;
    state.needsSetup = false;
    return data;
  } catch (err) {
    if (isMissingSchema(err)) {
      state.needsSetup = true;
      toast("جداول q56_ در Supabase ساخته نشده‌اند؛ فعلاً حالت محلی فعال است.", "warn", 6000);
    } else {
      console.warn("[vaqia] profile", err);
    }
    return null;
  }
}

async function claimSlot() {
  const { data, error } = await client.rpc(RPC.claim);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    toast("هر دو جایگاه این سایت پر شده است.", "warn");
    state.profile = null;
    state.slot = null;
    return null;
  }
  state.profile = { id: state.user.id, slot: row.slot, display_name: row.display_name };
  state.slot = row.slot;
  return state.profile;
}

export async function updateProfile(patch) {
  if (!client || !state.user) {
    const local = { ...store.get(LOCAL_KEYS.profile, {}), ...patch };
    store.set(LOCAL_KEYS.profile, local);
    return { ok: true, local: true, data: local };
  }
  const { data, error } = await client
    .from("q56_profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", state.user.id)
    .select("id, slot, display_name, theme, font_step")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  state.profile = { ...(state.profile || {}), ...(data || patch) };
  return { ok: true, data };
}

export async function signIn(email, password) {
  if (!client) return { ok: false, error: "اتصال به Supabase برقرار نشد." };
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { ok: false, error: translateError(error) };
  state.user = data.user;
  await refreshProfile();
  emit();
  return { ok: true };
}

export async function signUp(email, password) {
  if (!client) return { ok: false, error: "اتصال به Supabase برقرار نشد." };
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  if (error) return { ok: false, error: translateError(error) };
  if (data.session) {
    state.user = data.user;
    await refreshProfile();
    emit();
    return { ok: true, signedIn: true };
  }
  return { ok: true, signedIn: false, message: "حساب ساخته شد. ایمیل تأیید را باز کن، بعد وارد شو." };
}

export async function signOut() {
  if (!client) return { ok: true };
  const { error } = await client.auth.signOut();
  if (error) return { ok: false, error: translateError(error) };
  state.user = null;
  state.profile = null;
  state.slot = null;
  emit();
  return { ok: true };
}

export function currentUserName(slot) {
  if (state.profile?.slot === slot && state.profile?.display_name) return state.profile.display_name;
  return SITE.defaultNames[slot];
}

/* ---------- شمارنده‌ها ---------- */
function emptyCounters() {
  return [
    { slot: 1, total: 0, last_at: null },
    { slot: 2, total: 0, last_at: null },
  ];
}

function localCounters() {
  const saved = store.get(LOCAL_KEYS.counters, null);
  if (Array.isArray(saved) && saved.length === 2) return saved;
  return emptyCounters();
}

export async function getCounters() {
  if (client && !state.needsSetup) {
    const { data, error } = await client.rpc(RPC.counters);
    if (!error && Array.isArray(data)) {
      return data.map((row) => ({
        slot: Number(row.slot),
        total: Number(row.total) || 0,
        last_at: row.last_at || null,
      }));
    }
    if (error && isMissingSchema(error, error.code === "PGRST202")) state.needsSetup = true;
    if (error) console.warn("[vaqia] counters", error.message);
  }
  return localCounters();
}

export async function getHistory(limit = 80) {
  if (client && !state.needsSetup) {
    const { data, error } = await client.rpc(RPC.history, { p_limit: limit });
    if (!error && Array.isArray(data)) {
      return data.map((row) => ({ slot: Number(row.slot), read_at: row.read_at }));
    }
    if (error) console.warn("[vaqia] history", error.message);
  }
  return store.get(LOCAL_KEYS.history, []);
}

export async function recordRead(ayah = 1) {
  if (!state.user || !state.slot) {
    return { ok: false, error: "برای ثبت تلاوت باید وارد حساب شوی." };
  }

  if (client && !state.needsSetup) {
    const { data, error } = await client.rpc(RPC.increment, { p_ayah: ayah });
    if (!error) {
      const row = Array.isArray(data) ? data[0] : data;
      return {
        ok: true,
        slot: Number(row?.slot ?? state.slot),
        total: Number(row?.total) || null,
        read_at: row?.read_at || new Date().toISOString(),
      };
    }
    if (isMissingSchema(error)) {
      state.needsSetup = true;
    } else {
      console.warn("[vaqia] increment", error.message);
      return { ok: false, error: "ثبت نشد: " + error.message };
    }
  }

  // حالت محلی
  const at = new Date().toISOString();
  const counters = localCounters().map((row) =>
    Number(row.slot) === state.slot ? { ...row, total: Number(row.total || 0) + 1, last_at: at } : row
  );
  store.set(LOCAL_KEYS.counters, counters);
  const history = [{ slot: state.slot, read_at: at }, ...store.get(LOCAL_KEYS.history, [])].slice(0, 200);
  store.set(LOCAL_KEYS.history, history);
  return { ok: true, local: true, slot: state.slot, total: counters.find((r) => r.slot === state.slot).total, read_at: at };
}

/* ---------- خطاها ---------- */
function isMissingSchema(err, extra = false) {
  const code = err?.code || "";
  const message = (err?.message || "").toLowerCase();
  return (
    extra ||
    code === "42P01" ||
    code === "PGRST205" ||
    code === "PGRST202" ||
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("could not find the function")
  );
}

export function translateError(error) {
  const message = (error?.message || "").toLowerCase();
  if (message.includes("invalid login credentials")) return "ایمیل یا گذرواژه درست نیست.";
  if (message.includes("email not confirmed")) return "اول ایمیلت را تأیید کن.";
  if (message.includes("user already registered")) return "این ایمیل قبلاً حساب ساخته است.";
  if (message.includes("password should be at least")) return "گذرواژه باید حداقل ۶ نویسه باشد.";
  if (message.includes("unable to validate email")) return "ایمیل معتبر نیست.";
  if (message.includes("rate limit") || message.includes("too many")) return "تلاش زیاد بود؛ کمی بعد دوباره بزن.";
  if (message.includes("failed to fetch") || message.includes("network")) return "شبکه در دسترس نیست.";
  return error?.message || "خطای نامشخص";
}

/* ---------- حضور هم‌خوان ---------- */
let presenceChannel = null;
let presenceHandler = null;
let lastSentAyah = null;
let pendingAyah = null;
let sendTimer = null;

function payload(ayah) {
  return {
    slot: state.slot,
    name: state.profile?.display_name || SITE.defaultNames?.[state.slot] || "همراه",
    ayah: Math.max(1, Math.min(96, Number(ayah) || 1)),
    at: Date.now(),
  };
}

function readPartner() {
  if (!presenceChannel || !state.user) return null;
  const map = presenceChannel.presenceState() || {};
  for (const [key, metas] of Object.entries(map)) {
    if (key === state.user.id) continue;
    const meta = Array.isArray(metas) ? metas[0] : metas;
    if (!meta) continue;
    return {
      online: true,
      slot: Number(meta.slot) || null,
      name: meta.name || SITE.defaultNames?.[meta.slot] || "همراه",
      ayah: Number(meta.ayah) || 1,
      at: meta.at || null,
    };
  }
  return null;
}

function emitPartner() {
  presenceHandler?.(readPartner() || { online: false });
}

async function flushTrack() {
  sendTimer = null;
  if (!presenceChannel || !state.user || !state.slot) return;
  const num = pendingAyah;
  if (num == null || num === lastSentAyah) return;
  try {
    await presenceChannel.track(payload(num));
    lastSentAyah = num;
  } catch (err) {
    console.warn("[vaqia] track", err?.message || err);
  }
}

export async function startPresence(onPartner) {
  presenceHandler = typeof onPartner === "function" ? onPartner : null;
  if (!client || !state.user || !state.slot) {
    presenceHandler?.({ online: false });
    return { ok: false, reason: "auth" };
  }
  if (presenceChannel) {
    emitPartner();
    return { ok: true, reused: true };
  }

  const channel = client.channel("q56-reading", {
    config: { presence: { key: state.user.id } },
  });
  presenceChannel = channel;
  channel.on("presence", { event: "sync" }, emitPartner);
  channel.on("presence", { event: "join" }, emitPartner);
  channel.on("presence", { event: "leave" }, emitPartner);

  const status = await new Promise((resolve) => {
    channel.subscribe((s) => {
      if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") resolve(s);
    });
  });

  if (status !== "SUBSCRIBED" || presenceChannel !== channel) {
    console.warn("[vaqia] presence", status);
    try { await client.removeChannel(channel); } catch (_) {}
    if (presenceChannel === channel) presenceChannel = null;
    presenceHandler?.({ online: false });
    return { ok: false, reason: status };
  }

  lastSentAyah = null;
  emitPartner();
  return { ok: true };
}

/** ارسال آیهٔ فعلی — debounce کوتاه تا track پشت‌سرهم نشود */
export function publishReading(ayah) {
  const num = Math.max(1, Math.min(96, Number(ayah) || 1));
  pendingAyah = num;
  if (!presenceChannel || !state.user || !state.slot) return;
  if (num === lastSentAyah && !sendTimer) return;
  if (sendTimer) return; // pendingAyah already updated; flush will send latest
  sendTimer = setTimeout(flushTrack, 400);
}

export async function stopPresence() {
  if (sendTimer) {
    clearTimeout(sendTimer);
    sendTimer = null;
  }
  const ch = presenceChannel;
  presenceChannel = null;
  lastSentAyah = null;
  pendingAyah = null;
  if (ch) {
    try {
      await ch.untrack();
      await client?.removeChannel(ch);
    } catch (_) {}
  }
  presenceHandler?.({ online: false });
}
