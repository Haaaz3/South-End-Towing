// Tests for the tow-alert backend logic with fake Redis / QStash / push.
// Run: node tools/test-alerts.mjs   (exit code 1 on any failure)
import { createHmac, createHash, createECDH, randomBytes } from "node:crypto";
import webpush from "web-push";
import { savePlan, cancelPlan, deliver, MAX_DELAY_MS, InputError } from "../lib/alerts-core.js";
import { verifyQstashSignature } from "../lib/services.js";

let failures = 0;
const check = (name, condition, detail = "") => {
  if (condition) console.log(`ok   ${name}`);
  else { failures += 1; console.log(`FAIL ${name} ${detail}`); }
};

const HOUR = 3600e3, DAY = 24 * HOUR;
const URL_ = "https://example.vercel.app/api/deliver";

function world(start = Date.UTC(2026, 9, 1, 15, 0)) {
  const state = { now: start, db: new Map(), queue: new Map(), pushes: [], nextId: 1, gone: false };
  const store = {
    async get(k) { const v = state.db.get(k); return v ? JSON.parse(v) : null; },
    async set(k, v) { state.db.set(k, JSON.stringify(v)); },
    async del(k) { state.db.delete(k); }
  };
  const scheduler = {
    async publish(url, body, at) {
      if (at - state.now > 7 * DAY) throw new Error(`QStash free plan rejects delay > 7 days (${(at - state.now) / DAY} d)`);
      const id = `msg_${state.nextId++}`; state.queue.set(id, { url, body, at }); return id;
    },
    async cancel(id) { state.queue.delete(id); }
  };
  const push = { async send(sub, payload) { if (state.gone) return { gone: true }; state.pushes.push(payload); return { gone: false }; } };
  const deps = () => ({ store, scheduler, push, now: state.now, deliverUrl: URL_ });
  // Advance the clock, delivering due QStash messages in time order (like QStash would).
  async function runUntil(t) {
    for (;;) {
      const due = [...state.queue.entries()].filter(([, m]) => m.at <= t).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      state.queue.delete(due[0]);
      state.now = Math.max(state.now, due[1].at);
      await deliver(JSON.parse(JSON.stringify(due[1].body)), deps());
    }
    state.now = t;
  }
  return { state, deps, runUntil };
}

const sub = { endpoint: "https://push.example/abc", keys: { p256dh: "k", auth: "a" } };
const alertAt = (at, title = "Tow window soon") => ({ at, title, body: "Rutland St · odd side: move your car.", tag: "t" });
const carId = "car-1234567890abcdef";

// 1. Alerts within a week: all scheduled directly, no relay.
{
  const w = world();
  const r = await savePlan({ carId, subscription: sub, alerts: [alertAt(w.state.now + 2 * HOUR), alertAt(w.state.now + 3 * DAY)] }, w.deps());
  check("near alerts scheduled directly", r.scheduled === 2 && r.later === 0 && w.state.queue.size === 2);
  await w.runUntil(w.state.now + 4 * DAY);
  check("both near alerts delivered once each", w.state.pushes.length === 2);
}

// 2. Alert 20 days out (e.g. after the 4th Thursday): relays carry it past QStash's 7-day limit.
{
  const w = world();
  const target = w.state.now + 20 * DAY;
  await savePlan({ carId, subscription: sub, alerts: [alertAt(target - 12 * HOUR), alertAt(target - HOUR), alertAt(target, "Tow window started")] }, w.deps());
  check("far alerts wait for a relay", w.state.queue.size === 1 && [...w.state.queue.values()][0].body.kind === "relay");
  await w.runUntil(target - 13 * HOUR);
  check("no push before the first alert time", w.state.pushes.length === 0);
  await w.runUntil(target + HOUR);
  check("all 3 far alerts delivered on time via relays", w.state.pushes.length === 3 && w.state.pushes[2].title === "Tow window started", JSON.stringify(w.state.pushes.map((p) => p.title)));
}

// 3. "I moved my car" cancels everything, including alerts that are still behind a relay.
{
  const w = world();
  const target = w.state.now + 20 * DAY;
  await savePlan({ carId, subscription: sub, alerts: [alertAt(w.state.now + HOUR), alertAt(target)] }, w.deps());
  await w.runUntil(w.state.now + 8 * DAY); // first relay has already fired and scheduled more
  const pushesBefore = w.state.pushes.length;
  await cancelPlan(carId, w.deps());
  check("cancel removes every queued message", w.state.queue.size === 0);
  await w.runUntil(target + DAY);
  check("no alerts after cancel", w.state.pushes.length === pushesBefore);
}

// 4. Switching sides replaces the plan; the old alerts never fire.
{
  const w = world();
  await savePlan({ carId, subscription: sub, alerts: [alertAt(w.state.now + 5 * HOUR, "OLD")] }, w.deps());
  const stale = [...w.state.queue.values()][0].body;
  await savePlan({ carId, subscription: sub, alerts: [alertAt(w.state.now + 6 * HOUR, "NEW")] }, w.deps());
  check("old message cancelled on replace", w.state.queue.size === 1);
  const outcome = await deliver(stale, w.deps());
  check("a stray old message is ignored", outcome === "stale-alert" && w.state.pushes.length === 0, outcome);
  await w.runUntil(w.state.now + DAY);
  check("only the new alert fires", w.state.pushes.length === 1 && w.state.pushes[0].title === "NEW");
}

// 5. QStash retries / duplicates never double-notify.
{
  const w = world();
  await savePlan({ carId, subscription: sub, alerts: [alertAt(w.state.now + HOUR)] }, w.deps());
  const msg = [...w.state.queue.values()][0].body;
  w.state.now += HOUR;
  await deliver(msg, w.deps());
  const second = await deliver(msg, w.deps());
  check("duplicate delivery sends one push", w.state.pushes.length === 1 && second === "stale-alert");
}

// 6. Expired push subscription cleans up the plan.
{
  const w = world();
  await savePlan({ carId, subscription: sub, alerts: [alertAt(w.state.now + HOUR), alertAt(w.state.now + 2 * HOUR)] }, w.deps());
  w.state.gone = true;
  await w.runUntil(w.state.now + 3 * HOUR);
  check("gone subscription deletes plan and queue", w.state.db.size === 0 && w.state.queue.size === 0);
}

// 7. Input validation.
{
  const w = world();
  const bad = async (input) => { try { await savePlan(input, w.deps()); return false; } catch (e) { return e instanceof InputError; } };
  check("rejects bad car id", await bad({ carId: "x", subscription: sub, alerts: [alertAt(w.state.now + HOUR)] }));
  check("rejects non-https endpoint", await bad({ carId, subscription: { ...sub, endpoint: "http://x" }, alerts: [alertAt(w.state.now + HOUR)] }));
  check("rejects >12 alerts", await bad({ carId, subscription: sub, alerts: Array.from({ length: 13 }, (_, i) => alertAt(w.state.now + (i + 1) * HOUR)) }));
  check("rejects alerts > 62 days out", await bad({ carId, subscription: sub, alerts: [alertAt(w.state.now + 70 * DAY)] }));
}

// 8. QStash signature verification.
{
  const b64u = (b) => Buffer.from(b).toString("base64url");
  const key = "sig_current_key", next = "sig_next_key";
  const body = JSON.stringify({ carId, kind: "alert", index: 0, at: 1 });
  const now = Date.now();
  const make = ({ secret = key, claims = {}, bodyFor = body } = {}) => {
    const header = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = b64u(JSON.stringify({ iss: "Upstash", sub: URL_, exp: Math.floor(now / 1000) + 300, nbf: Math.floor(now / 1000), body: b64u(createHash("sha256").update(bodyFor).digest()), ...claims }));
    return `${header}.${payload}.${b64u(createHmac("sha256", secret).update(`${header}.${payload}`).digest())}`;
  };
  const opts = { signingKeys: [key, next], expectedUrl: URL_, now };
  check("valid signature accepted", verifyQstashSignature(make(), body, opts));
  check("next signing key accepted", verifyQstashSignature(make({ secret: next }), body, opts));
  check("wrong key rejected", !verifyQstashSignature(make({ secret: "nope" }), body, opts));
  check("tampered body rejected", !verifyQstashSignature(make(), body.replace("alert", "relay"), opts));
  check("expired token rejected", !verifyQstashSignature(make({ claims: { exp: Math.floor(now / 1000) - 3600 } }), body, opts));
  check("wrong destination rejected", !verifyQstashSignature(make({ claims: { sub: "https://evil.example/api/deliver" } }), body, opts));
  check("missing header rejected", !verifyQstashSignature(null, body, opts));
}

// 9. Web Push payload encryption works with generated VAPID keys.
{
  const vapid = webpush.generateVAPIDKeys();
  const ecdh = createECDH("prime256v1"); ecdh.generateKeys();
  const subscription = { endpoint: "https://fcm.googleapis.com/fcm/send/test", keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") } };
  const details = webpush.generateRequestDetails(subscription, JSON.stringify({ title: "t", body: "b" }), {
    vapidDetails: { subject: "https://github.com/Haaaz3/South-End-Towing", publicKey: vapid.publicKey, privateKey: vapid.privateKey }, TTL: 60
  });
  check("web push request is encrypted and VAPID-signed", details.headers.Authorization?.startsWith("vapid t=") && details.headers["Content-Encoding"] === "aes128gcm" && details.body.length > 0);
}

console.log(failures ? `\n${failures} failure(s).` : "\nAll alert backend tests passed.");
process.exitCode = failures ? 1 : 0;
