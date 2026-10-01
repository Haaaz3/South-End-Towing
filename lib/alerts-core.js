// Tow-alert scheduling logic, kept free of any network code so it can be
// tested with fakes (tools/test-alerts.mjs). The API routes in /api wire it to
// Upstash Redis (plan storage), Upstash QStash (timed delivery) and Web Push.
//
// A "plan" is everything needed to alert one parked car:
//   { carId, subscription, alerts: [{ at, title, body, tag, state }], messageIds, relayGen }
// QStash on the free plan can only delay a message ~7 days, so alerts further
// out are scheduled by a "relay" message that re-runs scheduling closer to
// the time. Every message ID is stored on the plan so "I moved my car"
// cancels all of them, and delivery re-checks the plan, so a cancelled or
// replaced plan never produces a notification.

export const MAX_DELAY_MS = 6.5 * 24 * 60 * 60 * 1000;
const MAX_HORIZON_MS = 62 * 24 * 60 * 60 * 1000;
const KEEP_AFTER_LAST_MS = 2 * 24 * 60 * 60 * 1000;
const key = (carId) => `car:${carId}`;

export class InputError extends Error {}

export function validatePlanInput(input, now) {
  if (!input || typeof input !== "object") throw new InputError("Missing request body.");
  const { carId, subscription, alerts } = input;
  if (typeof carId !== "string" || !/^[a-zA-Z0-9-]{16,64}$/.test(carId)) throw new InputError("Invalid car id.");
  if (!subscription || typeof subscription.endpoint !== "string" || !subscription.endpoint.startsWith("https://")
    || typeof subscription.keys?.p256dh !== "string" || typeof subscription.keys?.auth !== "string") {
    throw new InputError("Invalid push subscription.");
  }
  if (!Array.isArray(alerts) || alerts.length < 1 || alerts.length > 12) throw new InputError("Send between 1 and 12 alerts.");
  const clean = alerts.map((alert) => {
    const at = Number(alert?.at);
    if (!Number.isFinite(at) || at < now - 5 * 60 * 1000 || at > now + MAX_HORIZON_MS) throw new InputError("Alert time out of range.");
    const text = (value, max) => (typeof value === "string" && value.length > 0 && value.length <= max ? value : null);
    const title = text(alert.title, 100);
    const body = text(alert.body, 300);
    if (!title || !body) throw new InputError("Alert text missing or too long.");
    const tag = typeof alert.tag === "string" ? alert.tag.slice(0, 64) : "curbwise";
    return { at, title, body, tag, state: "pending" };
  }).sort((a, b) => a.at - b.at);
  return {
    carId,
    subscription: { endpoint: subscription.endpoint, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } },
    alerts: clean
  };
}

function ttlSeconds(plan, now) {
  const last = Math.max(...plan.alerts.map((a) => a.at), now);
  return Math.max(60, Math.ceil((last + KEEP_AFTER_LAST_MS - now) / 1000));
}

// Publish every pending alert that QStash can hold, plus one relay if any
// pending alert is still too far out.
async function scheduleDue(plan, { scheduler, now, deliverUrl }) {
  for (let index = 0; index < plan.alerts.length; index += 1) {
    const alert = plan.alerts[index];
    if (alert.state !== "pending" || alert.at - now > MAX_DELAY_MS) continue;
    const id = await scheduler.publish(deliverUrl, { carId: plan.carId, kind: "alert", index, at: alert.at }, Math.max(alert.at, now));
    plan.messageIds.push(id);
    alert.state = "scheduled";
  }
  if (plan.alerts.some((a) => a.state === "pending")) {
    plan.relayGen += 1;
    const id = await scheduler.publish(deliverUrl, { carId: plan.carId, kind: "relay", gen: plan.relayGen }, now + MAX_DELAY_MS);
    plan.messageIds.push(id);
  }
}

async function cancelMessages(plan, scheduler) {
  await Promise.all((plan?.messageIds || []).map((id) => scheduler.cancel(id).catch(() => {})));
}

export async function savePlan(input, { store, scheduler, now, deliverUrl }) {
  const fresh = validatePlanInput(input, now);
  const previous = await store.get(key(fresh.carId));
  await cancelMessages(previous, scheduler);
  const plan = { ...fresh, messageIds: [], relayGen: previous?.relayGen || 0, updatedAt: now };
  await scheduleDue(plan, { scheduler, now, deliverUrl });
  await store.set(key(plan.carId), plan, ttlSeconds(plan, now));
  return { scheduled: plan.alerts.filter((a) => a.state === "scheduled").length, later: plan.alerts.filter((a) => a.state === "pending").length };
}

export async function cancelPlan(carId, { store, scheduler }) {
  if (typeof carId !== "string" || !/^[a-zA-Z0-9-]{16,64}$/.test(carId)) throw new InputError("Invalid car id.");
  const plan = await store.get(key(carId));
  await cancelMessages(plan, scheduler);
  await store.del(key(carId));
  return { cancelled: Boolean(plan) };
}

export async function deliver(message, { store, scheduler, push, now, deliverUrl }) {
  const plan = await store.get(key(message?.carId));
  if (!plan) return "no-plan";
  if (message.kind === "relay") {
    if (message.gen !== plan.relayGen) return "stale-relay";
    await scheduleDue(plan, { scheduler, now, deliverUrl });
    await store.set(key(plan.carId), plan, ttlSeconds(plan, now));
    return "relayed";
  }
  const alert = plan.alerts[message.index];
  if (!alert || alert.at !== message.at || alert.state === "sent") return "stale-alert";
  const result = await push.send(plan.subscription, { title: alert.title, body: alert.body, tag: alert.tag, url: "/" });
  if (result.gone) {
    await cancelMessages(plan, scheduler);
    await store.del(key(plan.carId));
    return "subscription-gone";
  }
  alert.state = "sent";
  await store.set(key(plan.carId), plan, ttlSeconds(plan, now));
  return "sent";
}
