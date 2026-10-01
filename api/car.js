// POST /api/car   — save (or replace) the tow alerts for a parked car.
// DELETE /api/car — "I moved my car": cancel every pending alert.
import { savePlan, cancelPlan, InputError } from "../lib/alerts-core.js";
import { config, missingConfig, makeStore, makeScheduler, deliverUrlFor, json } from "../lib/services.js";

function services(request) {
  const c = config();
  const missing = missingConfig(c);
  if (missing.length) return { error: json({ error: `Tow alerts aren't set up on this site yet (missing: ${missing.join(", ")}).` }, 503) };
  return { store: makeStore(c), scheduler: makeScheduler(c), deliverUrl: deliverUrlFor(request, c) };
}

async function readJson(request) {
  const text = await request.text();
  if (text.length > 20000) throw new InputError("Request too large.");
  try { return JSON.parse(text); } catch { throw new InputError("Request body must be JSON."); }
}

export async function POST(request) {
  const deps = services(request);
  if (deps.error) return deps.error;
  try {
    const result = await savePlan(await readJson(request), { ...deps, now: Date.now() });
    return json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof InputError) return json({ error: error.message }, 400);
    console.error(error);
    return json({ error: "Couldn't schedule alerts. Try again in a minute." }, 502);
  }
}

export async function DELETE(request) {
  const deps = services(request);
  if (deps.error) return deps.error;
  try {
    const { carId } = await readJson(request);
    return json({ ok: true, ...(await cancelPlan(carId, deps)) });
  } catch (error) {
    if (error instanceof InputError) return json({ error: error.message }, 400);
    console.error(error);
    return json({ error: "Couldn't cancel alerts. Try again in a minute." }, 502);
  }
}
