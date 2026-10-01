// Real implementations of the store / scheduler / push services used by
// lib/alerts-core.js, talking to Upstash Redis, Upstash QStash and Web Push.
// Configuration comes from Vercel environment variables (see README).
import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import webpush from "web-push";

const env = (...names) => names.map((name) => process.env[name]).find(Boolean);

export function config() {
  return {
    redisUrl: env("UPSTASH_REDIS_REST_URL", "KV_REST_API_URL"),
    redisToken: env("UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_TOKEN"),
    qstashUrl: (env("QSTASH_URL") || "https://qstash.upstash.io").replace(/\/$/, ""),
    qstashToken: env("QSTASH_TOKEN"),
    signingKeys: [env("QSTASH_CURRENT_SIGNING_KEY"), env("QSTASH_NEXT_SIGNING_KEY")].filter(Boolean),
    vapidPublicKey: env("VAPID_PUBLIC_KEY"),
    vapidPrivateKey: env("VAPID_PRIVATE_KEY"),
    vapidSubject: env("VAPID_SUBJECT") || "https://github.com/Haaaz3/South-End-Towing",
    publicBaseUrl: env("PUBLIC_BASE_URL")
  };
}

export function missingConfig(c = config()) {
  const missing = [];
  if (!c.redisUrl || !c.redisToken) missing.push("Upstash Redis");
  if (!c.qstashToken || c.signingKeys.length === 0) missing.push("Upstash QStash");
  if (!c.vapidPublicKey || !c.vapidPrivateKey) missing.push("VAPID keys");
  return missing;
}

export function makeStore(c = config()) {
  const call = async (command) => {
    const response = await fetch(c.redisUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.redisToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(command)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) throw new Error(`Redis ${command[0]} failed: ${data.error || response.status}`);
    return data.result;
  };
  return {
    async get(key) { const value = await call(["GET", key]); return value ? JSON.parse(value) : null; },
    async set(key, value, ttl) { await call(["SET", key, JSON.stringify(value), "EX", String(ttl)]); },
    async del(key) { await call(["DEL", key]); }
  };
}

export function makeScheduler(c = config()) {
  return {
    async publish(url, body, notBeforeMs) {
      const response = await fetch(`${c.qstashUrl}/v2/publish/${url}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${c.qstashToken}`,
          "Content-Type": "application/json",
          "Upstash-Not-Before": String(Math.floor(notBeforeMs / 1000)),
          "Upstash-Retries": "3"
        },
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.messageId) throw new Error(`QStash publish failed: ${data.error || response.status}`);
      return data.messageId;
    },
    async cancel(messageId) {
      const response = await fetch(`${c.qstashUrl}/v2/messages/${encodeURIComponent(messageId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${c.qstashToken}` }
      });
      // 404 = already delivered or already cancelled; both fine.
      if (!response.ok && response.status !== 404) throw new Error(`QStash cancel failed: ${response.status}`);
    }
  };
}

export function makePush(c = config()) {
  webpush.setVapidDetails(c.vapidSubject, c.vapidPublicKey, c.vapidPrivateKey);
  return {
    async send(subscription, payload) {
      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 6 * 60 * 60, urgency: "high" });
        return { gone: false };
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) return { gone: true };
        throw error;
      }
    }
  };
}

// QStash request signing: an HS256 JWT in the Upstash-Signature header, signed
// with the current or next signing key. Mirrors @upstash/qstash Receiver.
const b64url = (buffer) => Buffer.from(buffer).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function verifyQstashSignature(token, rawBody, { signingKeys, expectedUrl, now = Date.now() }) {
  if (typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [header, payload, signature] = parts;
  let claims;
  try {
    const head = JSON.parse(Buffer.from(header, "base64url").toString("utf8"));
    if (head.alg !== "HS256") return false;
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch { return false; }
  const signed = `${header}.${payload}`;
  const validSignature = signingKeys.some((secret) => {
    const expected = Buffer.from(b64url(createHmac("sha256", secret).update(signed).digest()));
    const given = Buffer.from(signature.replace(/=+$/, ""));
    return expected.length === given.length && timingSafeEqual(expected, given);
  });
  if (!validSignature) return false;
  const seconds = now / 1000;
  const tolerance = 60;
  if (claims.iss !== "Upstash") return false;
  if (typeof claims.exp === "number" && seconds > claims.exp + tolerance) return false;
  if (typeof claims.nbf === "number" && seconds + tolerance < claims.nbf) return false;
  if (expectedUrl && claims.sub !== expectedUrl) return false;
  const bodyHash = b64url(createHash("sha256").update(rawBody).digest());
  return typeof claims.body === "string" && claims.body.replace(/=+$/, "") === bodyHash;
}

export function deliverUrlFor(request, c = config()) {
  const base = c.publicBaseUrl || new URL(request.url).origin;
  return `${base.replace(/\/$/, "")}/api/deliver`;
}

export const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
});
