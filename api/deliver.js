// POST /api/deliver — called by Upstash QStash at each alert's time. Verifies
// the QStash signature, then sends the push notification (or, for a relay
// message, schedules the next batch of alerts).
import { deliver } from "../lib/alerts-core.js";
import { config, missingConfig, makeStore, makeScheduler, makePush, verifyQstashSignature, deliverUrlFor, json } from "../lib/services.js";

export async function POST(request) {
  const c = config();
  if (missingConfig(c).length) return json({ error: "Not configured" }, 503);
  const rawBody = await request.text();
  const deliverUrl = deliverUrlFor(request, c);
  const valid = verifyQstashSignature(request.headers.get("upstash-signature"), rawBody, {
    signingKeys: c.signingKeys,
    // QStash signs the exact URL it was given, which is the one we published to.
    expectedUrl: deliverUrl
  });
  if (!valid) return json({ error: "Invalid signature" }, 401);
  let message;
  try { message = JSON.parse(rawBody); } catch { return json({ error: "Bad body" }, 400); }
  try {
    const outcome = await deliver(message, {
      store: makeStore(c), scheduler: makeScheduler(c), push: makePush(c), now: Date.now(), deliverUrl
    });
    return json({ ok: true, outcome });
  } catch (error) {
    console.error(error);
    // Non-2xx makes QStash retry (Upstash-Retries: 3).
    return json({ error: "Delivery failed" }, 500);
  }
}
