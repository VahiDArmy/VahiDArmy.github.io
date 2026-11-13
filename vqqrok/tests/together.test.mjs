/**
 * تست‌های واحد برای خواندن هم‌زمان (together.js) — با ساعت و کلاینت ساختگی، بدون شبکه
 * اجرا: npm test
 */
import assert from "node:assert/strict";
import { createTogether } from "../assets/js/together.js";

const results = [];
const queue = [];
function test(name, fn) {
  queue.push({ name, fn });
}

/* ---------- ابزار آزمون ---------- */
const flush = async () => {
  for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setImmediate(resolve));
};

/** ساعت ساختگی: تایمرها فقط با advance جلو می‌روند */
function fakeClock() {
  let t = 1_000_000;
  let seq = 0;
  const tasks = [];
  const clock = {
    now: () => t,
    setTimeout(fn, ms) {
      tasks.push({ id: ++seq, at: t + ms, fn, every: 0 });
      return seq;
    },
    clearTimeout(id) {
      const i = tasks.findIndex((task) => task.id === id);
      if (i >= 0) tasks.splice(i, 1);
    },
    setInterval(fn, ms) {
      tasks.push({ id: ++seq, at: t + ms, fn, every: ms });
      return seq;
    },
    clearInterval(id) {
      clock.clearTimeout(id);
    },
    pending: () => tasks.length,
    async advance(ms) {
      const end = t + ms;
      for (;;) {
        tasks.sort((a, b) => a.at - b.at);
        const next = tasks[0];
        if (!next || next.at > end) break;
        t = next.at;
        if (next.every) next.at += next.every;
        else tasks.shift();
        next.fn();
        await flush();
      }
      t = end;
      await flush();
    },
  };
  return clock;
}

/** شبکهٔ ساختگی با همان رابط کلاینت supabase-js که ماژول استفاده می‌کند */
function fakeNetwork() {
  const net = {
    channels: [],
    removed: [],
    tracks: [],
    untracks: 0,
    trackResult: "ok",
    connected: true,
    connectCalls: 0,
    presence: {},
  };
  net.client = {
    channel(name, opts) {
      const ch = {
        topic: `realtime:${name}`,
        opts,
        state: "closed",
        handlers: {},
        statusCb: null,
        on(type, filter, cb) {
          ch.handlers[`${type}:${filter.event}`] = cb;
          return ch;
        },
        subscribe(cb) {
          ch.statusCb = cb;
          ch.state = "joining";
          return ch;
        },
        async track(meta) {
          net.tracks.push(JSON.parse(JSON.stringify(meta)));
          if (net.trackResult === "throw") throw new Error("boom");
          return net.trackResult;
        },
        async untrack() {
          net.untracks += 1;
          return "ok";
        },
        presenceState: () => net.presence,
        /* کمک‌های آزمون */
        emit(status, err) {
          ch.state = status === "SUBSCRIBED" ? "joined" : status === "CLOSED" ? "closed" : "errored";
          ch.statusCb(status, err);
        },
        sync: () => ch.handlers["presence:sync"]?.(),
      };
      net.channels.push(ch);
      return ch;
    },
    getChannels: () => net.channels.filter((c) => !net.removed.includes(c)),
    async removeChannel(ch) {
      net.removed.push(ch);
      return "ok";
    },
    realtime: {
      isConnected: () => net.connected,
      connect() {
        net.connectCalls += 1;
      },
    },
  };
  return net;
}

function fakeEnv() {
  let hidden = false;
  let handlers = null;
  return {
    isHidden: () => hidden,
    subscribe(h) {
      handlers = h;
      return () => {
        handlers = null;
      };
    },
    setHidden(value) {
      hidden = value;
      handlers?.visibility(value);
    },
    resume: () => handlers?.resume(),
  };
}

async function setup(opts = {}) {
  const clock = fakeClock();
  const net = fakeNetwork();
  const env = fakeEnv();
  const partners = [];
  const statuses = [];
  const self = { uid: "uid-A", slot: 1, name: "علی" };
  const together = createTogether({
    getClient: () => net.client,
    getSelf: () => (self.slot ? { ...self } : null),
    onPartner: (p) => partners.push(p),
    onStatus: (s) => statuses.push(s),
    env,
    now: clock.now,
    timers: clock,
    log: () => {},
    ...opts,
  });
  const ctx = { clock, net, env, self, together, partners, statuses, ch: () => net.channels.at(-1) };
  return ctx;
}

/** وصل و آمادهٔ ارسال */
async function goLive(ctx) {
  await ctx.together.sync();
  ctx.ch().emit("SUBSCRIBED");
  ctx.ch().sync(); // presence_state که سرور بلافاصله بعد از اتصال می‌فرستد
  await ctx.clock.advance(0);
}

const meta = (over = {}) => ({ uid: "uid-B", slot: 2, name: "سارا", ayah: 12, reading: false, hidden: false, at: 100, ...over });

/* ---------- ارسال وضعیت خودمان ---------- */
test("تا وقتی کانال وصل نشده چیزی track نمی‌شود؛ بعد از وصل، یک بار با هویت و آیه", async () => {
  const t = await setup();
  t.together.setAyah(5);
  await t.together.sync();
  await t.clock.advance(2000);
  assert.equal(t.net.tracks.length, 0);
  assert.equal(t.together.status, "connecting");
  t.ch().emit("SUBSCRIBED");
  await t.clock.advance(0);
  assert.equal(t.net.tracks.length, 1, "ارسال منتظر عکس‌لحظهٔ Presence نمی‌ماند");
  t.ch().sync();
  assert.equal(t.together.status, "live");
  const { uid, slot, name, ayah, reading, hidden } = t.net.tracks[0];
  assert.deepEqual({ uid, slot, name, ayah, reading, hidden }, { uid: "uid-A", slot: 1, name: "علی", ayah: 5, reading: false, hidden: false });
  assert.equal(t.ch().opts.config.presence.key, "uid-A", "کلید presence = شناسهٔ کاربر");
});

test("آیه‌ای که پیش از اتصال ثبت شده گم نمی‌شود (باگ قدیمی: بعد از اتصال صفر می‌شد)", async () => {
  const t = await setup();
  t.together.setAyah(40);
  t.together.setReading(true);
  await goLive(t);
  assert.equal(t.net.tracks.at(-1).ayah, 40);
  assert.equal(t.net.tracks.at(-1).reading, true);
});

test("throttle: تغییرهای پشت‌سرهم ادغام می‌شوند و فقط آخرین مقدار می‌رود", async () => {
  const t = await setup();
  t.together.setAyah(1);
  await goLive(t);
  assert.equal(t.net.tracks.length, 1);
  await t.clock.advance(100);
  t.together.setAyah(2);
  await t.clock.advance(100);
  t.together.setAyah(3);
  await t.clock.advance(100);
  t.together.setAyah(4);
  await t.clock.advance(150);
  assert.equal(t.net.tracks.length, 1, "هنوز در بازهٔ ۵۰۰ms");
  await t.clock.advance(100);
  assert.equal(t.net.tracks.length, 2);
  assert.equal(t.net.tracks[1].ayah, 4);
});

test("بی‌کاری = سکوت: بدون تغییر هیچ پیامی نمی‌رود (heartbeat ندارد)", async () => {
  const t = await setup();
  t.together.setAyah(9);
  await goLive(t);
  const n = t.net.tracks.length;
  await t.clock.advance(60_000);
  assert.equal(t.net.tracks.length, n);
});

test("مقدار تکراری ارسال نمی‌شود", async () => {
  const t = await setup();
  t.together.setAyah(9);
  await goLive(t);
  t.together.setAyah(9);
  t.together.setReading(false);
  await t.clock.advance(2000);
  assert.equal(t.net.tracks.length, 1);
});

test("آیهٔ خارج از ۱ تا ۹۶ و ورودی بی‌معنی نادیده گرفته می‌شود (null هرگز «آیهٔ ۱» نمی‌شود)", async () => {
  const t = await setup();
  t.together.setAyah(10);
  await goLive(t);
  for (const bad of [500, 0, -3, "نامعتبر", "", "  ", null, undefined, NaN, Infinity, true, {}, []]) t.together.setAyah(bad);
  await t.clock.advance(1500);
  assert.equal(t.net.tracks.length, 1, "هیچ مقدار بدی ارسال نشد");
  assert.equal(t.net.tracks[0].ayah, 10);
  t.together.setAyah("12");
  await t.clock.advance(600);
  assert.equal(t.net.tracks.at(-1).ayah, 12, "رشتهٔ عددی پذیرفته می‌شود");
  t.together.setAyah(12.6);
  await t.clock.advance(600);
  assert.equal(t.net.tracks.at(-1).ayah, 13, "اعشار گرد می‌شود");
});

test("هنوز آیه‌ای نداده‌ایم: با ayah=null وصل می‌شویم، نه ۱", async () => {
  const t = await setup();
  await goLive(t);
  assert.equal(t.net.tracks[0].ayah, null);
});

test("بعد از هر وصل‌شدنِ دوباره، وضعیت خودمان دوباره track می‌شود", async () => {
  const t = await setup();
  t.together.setAyah(7);
  await goLive(t);
  assert.equal(t.net.tracks.length, 1);
  t.ch().emit("CHANNEL_ERROR", new Error("قطع شد"));
  assert.equal(t.together.status, "connecting");
  t.ch().emit("SUBSCRIBED");
  t.ch().sync();
  await t.clock.advance(0);
  assert.equal(t.together.status, "live");
  assert.equal(t.net.tracks.length, 2, "سرور بعد از قطع، ما را فراموش کرده؛ باید دوباره بگوییم");
  assert.equal(t.net.tracks[1].ayah, 7);
});

test("ack گم‌شده: بعد از شکست دوباره تلاش می‌شود، با فاصله‌ٔ فزاینده", async () => {
  const t = await setup();
  t.together.setAyah(3);
  t.net.trackResult = "timed out";
  await goLive(t);
  assert.equal(t.net.tracks.length, 1);
  await t.clock.advance(999);
  assert.equal(t.net.tracks.length, 1);
  await t.clock.advance(2);
  assert.equal(t.net.tracks.length, 2, "تلاش دوم بعد از ۱ ثانیه");
  await t.clock.advance(2001);
  assert.equal(t.net.tracks.length, 3, "تلاش سوم بعد از ۲ ثانیهٔ دیگر");
  t.net.trackResult = "ok";
  await t.clock.advance(4001);
  assert.equal(t.net.tracks.length, 4);
  await t.clock.advance(60_000);
  assert.equal(t.net.tracks.length, 4, "بعد از موفقیت دیگر تکرار نمی‌شود");
});

test("استثنا در track هم شکست حساب می‌شود، نه توقف", async () => {
  const t = await setup();
  t.net.trackResult = "throw";
  await goLive(t);
  t.net.trackResult = "ok";
  await t.clock.advance(1100);
  assert.equal(t.net.tracks.length, 2);
});

test("روی صفحه نبودن/برگشتن به صفحه به همراه خبر داده می‌شود", async () => {
  const t = await setup();
  await goLive(t);
  t.env.setHidden(true);
  await t.clock.advance(0);
  assert.equal(t.net.tracks.at(-1).hidden, true);
  t.env.setHidden(false);
  await t.clock.advance(0);
  assert.equal(t.net.tracks.at(-1).hidden, false);
});

test("برگشت به صفحه/شبکه: اتصال قطع‌شده فوراً امتحان می‌شود و presence دوباره تأیید می‌شود", async () => {
  const t = await setup();
  await goLive(t);
  const n = t.net.tracks.length;
  t.net.connected = false;
  t.env.resume();
  await t.clock.advance(0);
  assert.equal(t.net.connectCalls, 1);
  assert.equal(t.net.tracks.length, n + 1);
});

test("تغییر نام برای همراه می‌رسد", async () => {
  const t = await setup();
  await goLive(t);
  t.self.name = "  علیِ جدید  ";
  await t.together.sync();
  await t.clock.advance(0);
  assert.equal(t.net.tracks.at(-1).name, "علیِ جدید");
  assert.equal(t.net.channels.length, 1, "برای تغییر نام کانال نو ساخته نمی‌شود");
});

/* ---------- خواندنِ همراه ---------- */
test("همراه: فقط جایگاه دیگر؛ خودم و تب‌های دیگر خودم و هم‌جایگاهی‌ها نادیده", async () => {
  const t = await setup();
  await goLive(t);
  t.net.presence = {
    "uid-A": [meta({ uid: "uid-A", slot: 1, ayah: 3 })],
    "uid-X": [meta({ uid: "uid-X", slot: 1, ayah: 77 })],
    "uid-B": [meta()],
  };
  t.ch().sync();
  const p = t.partners.at(-1);
  assert.equal(p.online, true);
  assert.equal(p.slot, 2);
  assert.equal(p.ayah, 12);
  assert.equal(p.name, "سارا");
});

test("همراه رفت → null؛ تکرار یک وضعیت دوباره اعلام نمی‌شود", async () => {
  const t = await setup();
  await goLive(t);
  t.net.presence = { "uid-B": [meta()] };
  t.ch().sync();
  t.ch().sync();
  t.ch().sync();
  const online = t.partners.filter((p) => p?.online);
  assert.equal(online.length, 1);
  t.net.presence = {};
  t.ch().sync();
  assert.equal(t.partners.at(-1), null);
});

test("همراه با چند تب: روی‌صفحه > در حال خواندن > تازه‌تر", async () => {
  const t = await setup();
  await goLive(t);
  const pick = (metas) => {
    t.net.presence = { "uid-B": metas };
    t.ch().sync();
    return t.partners.at(-1)?.ayah;
  };
  assert.equal(pick([meta({ ayah: 12, at: 100 }), meta({ ayah: 40, at: 200 })]), 40, "تازه‌تر");
  assert.equal(pick([meta({ ayah: 12, at: 100 }), meta({ ayah: 40, at: 200, hidden: true })]), 12, "پنهان باخت");
  assert.equal(pick([meta({ ayah: 12, at: 100, reading: true }), meta({ ayah: 40, at: 200 })]), 12, "در حال خواندن برد");
  assert.equal(pick([meta({ ayah: 12, at: 100, hidden: true, reading: true }), meta({ ayah: 40, at: 50 })]), 40, "روی صفحه بودن مهم‌تر از خواندن است");
});

test("ورودی مشکوک از کانال عمومی پاک‌سازی می‌شود", async () => {
  const t = await setup();
  await goLive(t);
  t.net.presence = { r: [meta({ ayah: 9999, name: "x".repeat(100) })] };
  t.ch().sync();
  assert.equal(t.partners.at(-1).ayah, null, "آیهٔ خارج از بازه = ناشناخته، نه آخرین آیه");
  assert.equal(t.partners.at(-1).name.length, 24);
  for (const bad of ["abc", null, 0, -1, undefined]) {
    t.net.presence = { r: [meta({ ayah: bad })] };
    t.ch().sync();
    assert.equal(t.partners.at(-1)?.ayah, null, `آیهٔ ${String(bad)} = بدون آیه، نه ۱`);
    t.net.presence = {};
    t.ch().sync();
  }
  t.net.presence = { r: [meta({ ayah: 5.4 })] };
  t.ch().sync();
  assert.equal(t.partners.at(-1).ayah, 5);
  t.net.presence = { r: [meta({ slot: 7 }), null, "x", meta({ slot: 1 })] };
  t.ch().sync();
  assert.equal(t.partners.at(-1), null, "جایگاه نامعتبر یا جای خودم = همراه نیست");
});

test("تا عکس‌لحظهٔ Presence نرسیده «live» (و «آفلاین») اعلام نمی‌شود؛ با اولین sync یا بعد از ۱٫۵ ثانیه", async () => {
  const t = await setup();
  await t.together.sync();
  t.ch().emit("SUBSCRIBED");
  await t.clock.advance(0);
  assert.equal(t.together.status, "connecting", "هنوز لیست حاضران را نداریم");
  assert.equal(t.partners.length, 0, "هیچ «آفلاین» اشتباهی اعلام نشد");
  t.net.presence = { "uid-B": [meta()] };
  t.ch().sync();
  assert.equal(t.together.status, "live");
  assert.equal(t.partners.at(-1)?.ayah, 12, "اول همراه اعلام شد، بعد live");
});

test("اگر presence_state اصلاً نرسید، بعد از ۱٫۵ ثانیه با همان چیزی که داریم live می‌شود", async () => {
  const t = await setup();
  await t.together.sync();
  t.ch().emit("SUBSCRIBED");
  await t.clock.advance(1400);
  assert.equal(t.together.status, "connecting");
  t.net.presence = { "uid-B": [meta()] };
  await t.clock.advance(200);
  assert.equal(t.together.status, "live");
  assert.equal(t.partners.at(-1)?.ayah, 12);
});

/* ---------- وضعیت اتصال ---------- */
test("قطع شدن: وضعیت connecting و همراه پاک؛ پس از ۱۵ ثانیه error؛ با برگشت، live", async () => {
  const t = await setup();
  await goLive(t);
  t.net.presence = { "uid-B": [meta()] };
  t.ch().sync();
  assert.equal(t.partners.at(-1)?.online, true);
  t.net.connected = false;
  t.ch().emit("CHANNEL_ERROR");
  assert.equal(t.together.status, "connecting");
  assert.equal(t.partners.at(-1), null, "وقتی خودمان قطعیم، همراه «آنلاین» نمی‌ماند");
  await t.clock.advance(10_000);
  assert.equal(t.together.status, "connecting");
  assert.ok(t.net.connectCalls >= 1, "نگهبان اتصال را امتحان می‌کند");
  await t.clock.advance(10_000);
  assert.equal(t.together.status, "error");
  t.net.connected = true;
  t.ch().emit("SUBSCRIBED");
  t.ch().sync();
  await t.clock.advance(0);
  assert.equal(t.together.status, "live");
  assert.deepEqual(t.statuses, ["connecting", "live", "connecting", "error", "live"]);
});

test("کانالی که سرور بسته باشد توسط نگهبان از نو ساخته می‌شود", async () => {
  const t = await setup();
  t.together.setAyah(21);
  await goLive(t);
  t.ch().emit("CLOSED");
  assert.equal(t.net.channels.length, 1);
  await t.clock.advance(5100);
  assert.equal(t.net.channels.length, 2, "کانال جدید");
  assert.equal(t.net.removed.length, 1, "کانال بستهٔ قبلی برداشته شد");
  t.ch().emit("SUBSCRIBED");
  t.ch().sync();
  await t.clock.advance(0);
  assert.equal(t.together.status, "live");
  assert.equal(t.net.tracks.at(-1).ayah, 21);
});

test("پیام‌های دیررسیدهٔ کانال قدیمی نادیده گرفته می‌شود", async () => {
  const t = await setup();
  await goLive(t);
  const old = t.ch();
  t.self.uid = "uid-C";
  await t.together.sync();
  const fresh = t.ch();
  assert.notEqual(old, fresh);
  old.emit("SUBSCRIBED");
  old.emit("CHANNEL_ERROR");
  assert.equal(t.together.status, "connecting", "کانال جدید هنوز وصل نشده و پیام قدیمی تأثیر ندارد");
  t.net.presence = { x: [meta()] };
  old.sync();
  assert.equal(t.partners.at(-1), null);
});

/* ---------- چرخهٔ عمر ---------- */
test("چند sync هم‌زمان (race راه‌اندازی) فقط یک کانال می‌سازد", async () => {
  const t = await setup();
  await Promise.all([1, 2, 3, 4, 5, 6].map(() => t.together.sync()));
  assert.equal(t.net.channels.length, 1);
  assert.equal(t.net.getChannels?.length ?? t.net.client.getChannels().length, 1);
});

test("sync بدون جایگاه/ورود: وصل نمی‌شود و وضعیت off می‌ماند", async () => {
  const t = await setup();
  t.self.slot = null;
  await t.together.sync();
  assert.equal(t.net.channels.length, 0);
  assert.equal(t.together.status, "off");
});

test("خروج از حساب: untrack، حذف کانال، همراه null، وضعیت off", async () => {
  const t = await setup();
  await goLive(t);
  t.net.presence = { "uid-B": [meta()] };
  t.ch().sync();
  const ch = t.ch();
  t.self.slot = null;
  await t.together.sync();
  assert.equal(t.net.untracks, 1);
  assert.ok(t.net.removed.includes(ch));
  assert.equal(t.partners.at(-1), null);
  assert.equal(t.together.status, "off");
  assert.equal(t.clock.pending(), 0, "هیچ تایمری باقی نمی‌ماند");
});

test("عوض شدن حساب: کانال قبلی برداشته و کانال جدید با کلید تازه ساخته می‌شود", async () => {
  const t = await setup();
  t.together.setAyah(30);
  await goLive(t);
  const first = t.ch();
  t.self.uid = "uid-C";
  t.self.name = "ث";
  await t.together.sync();
  assert.ok(t.net.removed.includes(first));
  assert.equal(t.net.channels.length, 2);
  assert.equal(t.ch().opts.config.presence.key, "uid-C");
  t.ch().emit("SUBSCRIBED");
  await t.clock.advance(0);
  assert.equal(t.net.tracks.at(-1).uid, "uid-C");
  assert.equal(t.net.tracks.at(-1).ayah, 30, "جای خواندن بعد از عوض شدن حساب هم می‌ماند");
});

test("stop() دوباره صدا زدن بی‌ضرر است و بعدش sync دوباره وصل می‌کند", async () => {
  const t = await setup();
  await goLive(t);
  await t.together.stop();
  await t.together.stop();
  assert.equal(t.together.status, "off");
  await goLive(t);
  assert.equal(t.together.status, "live");
});

/* ---------- گزارش ---------- */
for (const { name, fn } of queue) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error });
  }
}

let failed = 0;
for (const result of results) {
  if (result.ok) {
    console.log(`  ✓ ${result.name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${result.name}\n    ${result.error?.message || result.error}`);
  }
}
console.log(`\n${results.length - failed}/${results.length} تست موفق`);
if (failed > 0) process.exitCode = 1;
