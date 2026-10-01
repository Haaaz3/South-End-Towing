// GET /api/config — tells the app whether tow alerts are set up on this site.
import { config, missingConfig, json } from "../lib/services.js";

export function GET() {
  const c = config();
  const missing = missingConfig(c);
  return json({ pushReady: missing.length === 0, vapidPublicKey: missing.length === 0 ? c.vapidPublicKey : null, missing });
}
