/**
 * together.js — خواندن هم‌زمان دو نفر (Supabase Realtime Presence)
 *
 * طراحی:
 *  - Presence «تنها» منبع حقیقت است: هم آنلاین بودن همراه، هم آیهٔ فعلی او.
 *    هر نفر فقط وضعیت خودش را track می‌کند و سرور فهرست حاضران را برای همه نگه می‌دارد؛
 *    پس کسی که تازه وارد می‌شود همان لحظه جای همراه را می‌بیند، حتی اگر او تکان نخورد.
 *  - کانال Broadcast جدا، heartbeat و تایمر «آفلاین مصنوعی» وجود ندارد؛ آفلاین یعنی
 *    سرور گفته است همراه از Presence خارج شد.
 *  - هر بار که کانال (دوباره) وصل شود، وضعیت خودمان دوباره track می‌شود.
 *  - ارسال‌ها throttle و ادغام می‌شوند: هر ۵۰۰ms حداکثر یک track، و همیشه آخرین مقدار.
 *  - شکست اتصال نهایی نیست: کتابخانه خودش بی‌نهایت rejoin می‌کند؛ ما فقط وضعیت را به
 *    رابط می‌گوییم (connecting / live / error) تا «آفلاین» با «اتصال نیست» اشتباه نشود.
 *  - start / stop / sync همه در یک صف پشت‌سرهم اجرا می‌شوند؛ پس race در راه‌اندازی نیست.
 *  - اگر همراه همزمان چند تب/دستگاه باز داشته باشد، یکی انتخاب می‌شود (روی صفحه، در حال
 *    خواندن، تازه‌ترین) تا عدد بین چند مقدار نپرد.
 *
 * این فایل به DOM وابسته نیست و با هر کلاینت شبیهٔ supabase-js قابل آزمون است.
 */

export const TOPIC = "q56-reading";

const DEFAULTS = {
  topic: TOPIC,
  ayahCount: 96,
  minGapMs: 500, // حداقل فاصلهٔ دو track پشت‌سرهم
  slowAfterMs: 15000, // بعد از این مدت بدون اتصال، وضعیت «error» می‌شود (کتابخانه همچنان تلاش می‌کند)
  watchdogMs: 5000,
  syncFallbackMs: 1500, // اگر بعد از اتصال presence_state نیامد، همان‌طور که هست نمایش بده
  untrackWaitMs: 800,
  removeWaitMs: 3000,
};

/** محیط مرورگر: دیده‌شدن صفحه و برگشتن شبکه/صفحه (در تست جایگزین می‌شود) */
function browserEnv() {
  const doc = typeof document !== "undefined" ? document : null;
  const win = typeof window !== "undefined" ? window : null;
  return {
    isHidden: () => Boolean(doc?.hidden),
    subscribe({ visibility, resume }) {
      const onVisibility = () => visibility(Boolean(doc.hidden));
      const onResume = () => resume();
      doc?.addEventListener("visibilitychange", onVisibility);
      win?.addEventListener("online", onResume);
      win?.addEventListener("pageshow", onResume);
      return () => {
        doc?.removeEventListener("visibilitychange", onVisibility);
        win?.removeEventListener("online", onResume);
        win?.removeEventListener("pageshow", onResume);
      };
    },
  };
}

export function createTogether(options) {
  const o = { ...DEFAULTS, ...options };
  const getClient = o.getClient;
  const getSelf = o.getSelf;
  const onPartner = o.onPartner || (() => {});
  const onStatus = o.onStatus || (() => {});
  const env = o.env || browserEnv();
  const now = o.now || (() => Date.now());
  const timers = o.timers || {
    setTimeout: (...a) => globalThis.setTimeout(...a),
    clearTimeout: (...a) => globalThis.clearTimeout(...a),
    setInterval: (...a) => globalThis.setInterval(...a),
    clearInterval: (...a) => globalThis.clearInterval(...a),
  };
  const log = o.log || ((...a) => console.warn("[vaqia:together]", ...a));

  /* ---------- حالت ---------- */
  let client = null; // کلاینتی که کانال با آن ساخته شد
  let channel = null;
  let identity = null; // { uid, slot, name } — فقط وقتی در حال اجراییم
  let running = false;
  let ready = false; // کانال SUBSCRIBED است (از همین لحظه می‌توانیم track کنیم)
  let synced = false; // اولین عکس‌لحظهٔ Presence بعد از اتصال رسیده؛ تا آن موقع «live» اعلام نمی‌شود
  let status = "off"; // off | connecting | live | error
  let downSince = 0;
  let epoch = 0; // با هر اتصال/قطع عوض می‌شود؛ پاسخ‌های قدیمی را بی‌اثر می‌کند
  let inflightEpoch = -1;
  let sentKey = null; // آخرین وضعیتی که سرور تأیید کرد
  let failures = 0;
  let lastSentAt = -Infinity;
  let flushTimer = null;
  let retryTimer = null;
  let watchdog = null;
  let syncFallback = null;
  let offEnv = null;
  let hidden = Boolean(env.isHidden());
  let lastPartnerKey = "?"; // «?» = هنوز چیزی به رابط نگفته‌ایم
  const want = { ayah: null, reading: false };
  let queue = Promise.resolve();

  /* ---------- کمک‌ها ---------- */
  /** آیهٔ معتبر (عدد صحیح ۱..تعداد آیه‌ها) یا null؛ null/خالی/بی‌معنی هرگز به «آیهٔ ۱» تبدیل نمی‌شود */
  const validAyah = (n) => {
    const x = typeof n === "string" ? (n.trim() === "" ? NaN : Number(n)) : n;
    if (typeof x !== "number" || !Number.isFinite(x)) return null;
    const v = Math.round(x);
    return v >= 1 && v <= o.ayahCount ? v : null;
  };
  const cleanName = (name, slot) => String(name ?? "").trim().slice(0, 24) || (slot === 1 ? "نفر اول" : "نفر دوم");

  function bounded(promise, ms) {
    return new Promise((resolve) => {
      const timer = timers.setTimeout(() => resolve("timeout"), ms);
      Promise.resolve(promise).then(
        (value) => {
          timers.clearTimeout(timer);
          resolve(value);
        },
        () => {
          timers.clearTimeout(timer);
          resolve("error");
        }
      );
    });
  }

  function enqueue(fn) {
    const run = queue.then(fn);
    queue = run.catch(() => {});
    return run;
  }

  function setStatus(next, detail = null) {
    if (status === next) return;
    status = next;
    try {
      onStatus(next, detail);
    } catch (err) {
      log("onStatus", err);
    }
  }

  function emitPartner(next) {
    const key = next ? JSON.stringify([next.slot, next.name, next.ayah, next.reading, next.hidden]) : "null";
    if (key === lastPartnerKey) return;
    lastPartnerKey = key;
    try {
      onPartner(next ? { online: true, ...next } : null);
    } catch (err) {
      log("onPartner", err);
    }
  }

  /* ---------- وضعیت خودمان ← سرور ---------- */
  function metaNow() {
    return {
      v: 1,
      uid: identity.uid,
      slot: identity.slot,
      name: identity.name,
      ayah: want.ayah,
      reading: want.reading,
      hidden,
      at: now(),
    };
  }
  const metaKey = (m) => `${m.name}|${m.ayah}|${m.reading ? 1 : 0}|${m.hidden ? 1 : 0}`;

  function schedule({ urgent = false } = {}) {
    if (!running || !ready || flushTimer) return;
    const wait = urgent ? 0 : Math.max(0, lastSentAt + o.minGapMs - now());
    flushTimer = timers.setTimeout(flush, wait);
  }

  function retry() {
    if (retryTimer || !running || !ready) return;
    const wait = Math.min(10000, 1000 * 2 ** Math.min(failures - 1, 4));
    retryTimer = timers.setTimeout(() => {
      retryTimer = null;
      schedule({ urgent: true });
    }, wait);
  }

  async function flush() {
    flushTimer = null;
    const ch = channel;
    if (!running || !ready || !ch || inflightEpoch === epoch) return;
    const meta = metaNow();
    const key = metaKey(meta);
    if (key === sentKey) return; // چیزی عوض نشده
    const mine = epoch;
    inflightEpoch = mine;
    lastSentAt = now();
    let result = "error";
    try {
      result = await ch.track(meta);
    } catch (err) {
      log("track", err?.message || err);
    }
    if (inflightEpoch === mine) inflightEpoch = -1;
    if (mine !== epoch || ch !== channel || !running) return; // کانال عوض شده؛ نتیجه قدیمی است
    if (result === "ok") {
      sentKey = key;
      failures = 0;
      if (metaKey(metaNow()) !== sentKey) schedule(); // وسط ارسال چیزی عوض شده بود
    } else {
      failures += 1;
      retry();
    }
  }

  /* ---------- همراه ← ما ---------- */
  function readMeta(raw) {
    if (!raw || typeof raw !== "object") return null;
    const slot = Number(raw.slot);
    if (slot !== 1 && slot !== 2) return null;
    const at = Number(raw.at);
    return {
      uid: typeof raw.uid === "string" ? raw.uid : "",
      slot,
      name: cleanName(raw.name, slot),
      ayah: validAyah(raw.ayah),
      reading: raw.reading === true,
      hidden: raw.hidden === true,
      at: Number.isFinite(at) ? at : 0,
    };
  }
  const rank = (m) => (m.hidden ? 0 : 2) + (m.reading ? 1 : 0);

  function derivePartner() {
    if (!channel || !identity) return null;
    const wantSlot = identity.slot === 1 ? 2 : 1;
    let best = null;
    const state = channel.presenceState() || {};
    for (const metas of Object.values(state)) {
      for (const raw of Array.isArray(metas) ? metas : [metas]) {
        const m = readMeta(raw);
        if (!m || m.slot !== wantSlot || m.uid === identity.uid) continue;
        if (!best || rank(m) > rank(best) || (rank(m) === rank(best) && m.at > best.at)) best = m;
      }
    }
    return best;
  }

  function clearSyncFallback() {
    if (syncFallback) timers.clearTimeout(syncFallback);
    syncFallback = null;
  }

  /** وصلیم و فهرست حاضران را داریم؛ حالا می‌شود با اطمینان «آنلاین/آفلاین» گفت (نه چشمک‌زدن «آفلاین» لحظهٔ اتصال) */
  function markLive() {
    if (!running || !ready) return;
    clearSyncFallback();
    setStatus("live");
  }

  /* ---------- چرخهٔ اتصال ---------- */
  function handleStatus(ch, s, err) {
    if (ch !== channel || !running) return;
    if (s === "SUBSCRIBED") {
      epoch += 1;
      ready = true;
      sentKey = null; // بعد از هر اتصال دوباره track کن
      failures = 0;
      downSince = 0;
      clearSyncFallback();
      if (synced) {
        emitPartner(derivePartner());
        markLive();
      } else {
        // presence_state معمولاً همین لحظه می‌رسد؛ اگر نرسید، با همان چیزی که داریم ادامه بده
        syncFallback = timers.setTimeout(() => {
          syncFallback = null;
          if (ch !== channel || !running || !ready) return;
          synced = true;
          emitPartner(derivePartner());
          markLive();
        }, o.syncFallbackMs);
      }
      schedule({ urgent: true });
      return;
    }
    if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
      epoch += 1;
      ready = false;
      synced = false;
      clearSyncFallback();
      if (!downSince) downSince = now();
      setStatus(now() - downSince > o.slowAfterMs ? "error" : "connecting", err?.message || s);
      lastPartnerKey = "?";
      emitPartner(null); // وقتی خودمان قطعیم، وضعیت همراه را نمی‌دانیم
    }
  }

  function nudge() {
    if (!running) return;
    try {
      const rt = client?.realtime;
      if (rt && typeof rt.isConnected === "function" && !rt.isConnected()) rt.connect();
    } catch (err) {
      log("reconnect", err?.message || err);
    }
    if (ready) {
      sentKey = null; // اگر presence بی‌سروصدا از دست رفته بود، ترمیم می‌شود
      schedule({ urgent: true });
    }
  }

  function startWatchdog() {
    stopWatchdog();
    watchdog = timers.setInterval(() => {
      if (!running || ready) return;
      if (downSince && now() - downSince > o.slowAfterMs) setStatus("error");
      // کانالی که سرور بسته باشد خودش rejoin نمی‌کند؛ از نو می‌سازیمش
      if (channel && channel.state === "closed") {
        enqueue(reopen).catch((err) => log("reopen", err?.message || err));
        return;
      }
      nudge();
    }, o.watchdogMs);
  }
  function stopWatchdog() {
    if (watchdog) timers.clearInterval(watchdog);
    watchdog = null;
  }

  async function removeStale() {
    const topic = `realtime:${o.topic}`;
    const stale = (client.getChannels?.() || []).filter((c) => c.topic === topic);
    for (const c of stale) await bounded(client.removeChannel(c), o.removeWaitMs);
  }

  async function openChannel() {
    await removeStale();
    if (!running) return;
    const ch = client.channel(o.topic, {
      config: { presence: { key: identity.uid }, broadcast: { self: false } },
    });
    channel = ch;
    ch.on("presence", { event: "sync" }, () => {
      if (ch !== channel || !running) return;
      synced = true;
      emitPartner(derivePartner());
      markLive();
    });
    ch.subscribe((s, err) => handleStatus(ch, s, err));
  }

  async function reopen() {
    if (!running) return;
    const old = channel;
    channel = null;
    ready = false;
    synced = false;
    epoch += 1;
    if (old) await bounded(client.removeChannel(old), o.removeWaitMs);
    if (!running) return;
    lastPartnerKey = "?";
    await openChannel();
  }

  async function open(self) {
    client = getClient();
    if (!client) {
      setStatus("off");
      return;
    }
    identity = { uid: self.uid, slot: self.slot, name: cleanName(self.name, self.slot) };
    running = true;
    ready = false;
    synced = false;
    sentKey = null;
    failures = 0;
    downSince = now();
    lastPartnerKey = "?";
    setStatus("connecting");
    offEnv = env.subscribe({
      visibility(isHidden) {
        hidden = isHidden;
        schedule({ urgent: true });
        if (!isHidden) nudge();
      },
      resume: nudge,
    });
    startWatchdog();
    try {
      await openChannel();
    } catch (err) {
      log("open", err?.message || err);
      setStatus("error", err?.message || String(err));
    }
  }

  async function teardown() {
    const ch = channel;
    const c = client;
    running = false;
    ready = false;
    synced = false;
    epoch += 1;
    stopWatchdog();
    clearSyncFallback();
    for (const t of [flushTimer, retryTimer]) if (t) timers.clearTimeout(t);
    flushTimer = retryTimer = null;
    offEnv?.();
    offEnv = null;
    channel = null;
    identity = null;
    sentKey = null;
    downSince = 0;
    if (ch && c) {
      await bounded(ch.untrack(), o.untrackWaitMs);
      await bounded(c.removeChannel(ch), o.removeWaitMs);
    }
    lastPartnerKey = "?";
    emitPartner(null);
    setStatus("off");
  }

  /* ---------- رابط عمومی ---------- */
  async function syncOnce() {
    const self = getSelf?.();
    const valid = self && self.uid && (self.slot === 1 || self.slot === 2);
    if (!valid) {
      if (running) await teardown();
      return;
    }
    if (running && identity.uid === self.uid && identity.slot === self.slot) {
      const name = cleanName(self.name, self.slot);
      if (name !== identity.name) {
        identity.name = name;
        schedule({ urgent: true });
      }
      if (!ready) nudge();
      return;
    }
    if (running) await teardown();
    await open(self);
  }

  return {
    /** هر بار که حساب/جایگاه/نام عوض شد صدا بزن؛ تکراری بودنش بی‌ضرر است. */
    sync: () => enqueue(syncOnce).catch((err) => log("sync", err?.message || err)),
    stop: () => enqueue(async () => (running ? teardown() : undefined)).catch((err) => log("stop", err?.message || err)),
    setAyah(n) {
      const v = validAyah(n);
      if (v == null || v === want.ayah) return;
      want.ayah = v;
      schedule();
    },
    setReading(on) {
      const b = Boolean(on);
      if (b === want.reading) return;
      want.reading = b;
      schedule({ urgent: true });
    },
    get status() {
      return status;
    },
  };
}
