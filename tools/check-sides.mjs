// End-to-end check that every curb line the app draws is on the correct
// (odd/even) side of the street, using City of Boston address points as ground
// truth, plus replay tests of known tow situations.
//
// Runs the real app.js (with a stubbed browser) so it tests exactly what ships.
// Run: node tools/check-sides.mjs   (exit code 1 on any failure)
import { readFileSync } from "node:fs";
import vm from "node:vm";

// ---- Load app.js with a minimal fake DOM -------------------------------------
const fakeElement = () => new Proxy({}, {
  get: (target, key) => key in target ? target[key]
    : ["addEventListener", "setAttribute", "querySelectorAll", "observe"].includes(key) ? () => [] : fakeElement(),
  set: (target, key, value) => { target[key] = value; return true; }
});
const sandbox = {
  console, Intl, Date, Math, JSON, Number, String, Set, Map, URLSearchParams,
  document: { querySelector: () => fakeElement() },
  localStorage: { getItem: () => null, setItem: () => {} },
  navigator: {},
  window: { location: { protocol: "file:" }, setInterval: () => 0, addEventListener: () => {} },
  ResizeObserver: class { observe() {} },
  fetch: () => new Promise(() => {})
};
vm.createContext(sandbox);
const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
vm.runInContext(`${source}\n;globalThis.__app = { ROADS, EVEN_SIDE, curbSegments, offsetPath, statusFor, nextWindow, state };`, sandbox);
const { curbSegments, offsetPath, statusFor, EVEN_SIDE, ROADS } = sandbox.__app;

// ---- Geometry helpers --------------------------------------------------------
const toXY = (lat, lng) => [lng * 111320 * Math.cos(42.34 * Math.PI / 180), lat * 110540];
function distanceToPath(path, lat, lng) {
  const [px, py] = toXY(lat, lng);
  let best = Infinity, beyondEnd = false;
  for (let i = 0; i < path.length - 1; i += 1) {
    const [ax, ay] = toXY(...path[i]);
    const [bx, by] = toXY(...path[i + 1]);
    const dx = bx - ax, dy = by - ay;
    const raw = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1);
    const t = Math.max(0, Math.min(1, raw));
    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    if (d < best) { best = d; beyondEnd = (i === 0 && raw < 0) || (i === path.length - 2 && raw > 1); }
  }
  // An address past either end of the drawn line (e.g. a corner building on the
  // cross street) can't say which side is which.
  return beyondEnd ? Infinity : best;
}
const drawn = new Map(curbSegments.map((c) => [c.id, offsetPath(c.path, c.side, c.road)]));

let failures = 0;
const fail = (message) => { failures += 1; console.log(`FAIL  ${message}`); };

// ---- 1. Every road has a verified side ---------------------------------------
for (const road of Object.keys(ROADS)) {
  if (EVEN_SIDE[road] !== 1 && EVEN_SIDE[road] !== -1) fail(`${road}: no verified EVEN_SIDE entry`);
}

// ---- 2. Address points: nearest drawn curb must match house-number parity ----
const addresses = JSON.parse(readFileSync(new URL("./city_addresses.json", import.meta.url), "utf8"));
for (const [road, points] of Object.entries(addresses)) {
  if (road.startsWith("_")) continue;
  const curbs = curbSegments.filter((c) => c.road === road);
  let checked = 0, wrong = [];
  for (const [number, lng, lat] of points) {
    const ranked = curbs.map((c) => ({ c, d: distanceToPath(drawn.get(c.id), lat, lng) })).sort((a, b) => a.d - b.d);
    if (ranked[0].d > 60) continue; // address is off the mapped stretch of this street
    checked += 1;
    const expected = number % 2 === 0 ? "Even" : "Odd";
    if (!ranked[0].c.side.startsWith(expected)) wrong.push(`#${number} is nearest the ${ranked[0].c.side} line`);
  }
  if (wrong.length) fail(`${road}: ${wrong.join("; ")}`);
  else console.log(`ok    ${road.padEnd(16)} ${checked} addresses, every one is beside its own odd/even curb line`);
}

// ---- 3. Replay known real-world cases ---------------------------------------
// 2026-10-01 10:21: car parked outside 45 Rutland St (odd side) was towed.
// Posted sign there (Street View, Jun 2026): "Street Cleaning 1st, 3rd & 5th
// Thursday 8am-12noon Tow Zone".
const cases = [
  { name: "45 Rutland St, Thu Oct 1 2026 10:21 (actual tow)", lng: -71.075870594728897, lat: 42.339978668630415,
    road: "rutland", time: { year: 2026, month: 10, day: 1, hour: 10, minute: 21 }, expectSide: "Odd", expectStatus: ["active"] },
  { name: "45 Rutland St, Thu Oct 1 2026 07:30 (before window)", lng: -71.075870594728897, lat: 42.339978668630415,
    road: "rutland", time: { year: 2026, month: 10, day: 1, hour: 7, minute: 30 }, expectSide: "Odd", expectStatus: ["urgent"] },
  { name: "45 Rutland St, Thu Oct 1 2026 11:30 (last half hour)", lng: -71.075870594728897, lat: 42.339978668630415,
    road: "rutland", time: { year: 2026, month: 10, day: 1, hour: 11, minute: 30 }, expectSide: "Odd", expectStatus: ["ending"] },
  { name: "48 Rutland St (across), Thu Oct 1 2026 10:21", lng: -71.076141539833074, lat: 42.33988080658866,
    road: "rutland", time: { year: 2026, month: 10, day: 1, hour: 10, minute: 21 }, expectSide: "Even", expectStatus: ["clear"] },
  { name: "45 Rutland St, Thu Oct 8 2026 10:00 (2nd Thu)", lng: -71.075870594728897, lat: 42.339978668630415,
    road: "rutland", time: { year: 2026, month: 10, day: 8, hour: 10, minute: 0 }, expectSide: "Odd", expectStatus: ["clear"] },
  { name: "48 Rutland St, Thu Oct 8 2026 10:00 (2nd Thu)", lng: -71.076141539833074, lat: 42.33988080658866,
    road: "rutland", time: { year: 2026, month: 10, day: 8, hour: 10, minute: 0 }, expectSide: "Even", expectStatus: ["active"] },
  { name: "45 Rutland St, Thu Oct 29 2026 10:00 (5th Thu)", lng: -71.075870594728897, lat: 42.339978668630415,
    road: "rutland", time: { year: 2026, month: 10, day: 29, hour: 10, minute: 0 }, expectSide: "Odd", expectStatus: ["active"] }
];
for (const test of cases) {
  const curbs = curbSegments.filter((c) => c.road === test.road);
  const nearest = curbs.map((c) => ({ c, d: distanceToPath(drawn.get(c.id), test.lat, test.lng) })).sort((a, b) => a.d - b.d)[0].c;
  const status = statusFor(nearest, test.time);
  const okSide = nearest.side.startsWith(test.expectSide);
  const okStatus = test.expectStatus.includes(status.type);
  if (okSide && okStatus) console.log(`ok    ${test.name}: ${nearest.side} line, "${status.label}"`);
  else fail(`${test.name}: got ${nearest.side} line, status "${status.type}" (expected ${test.expectSide}, ${test.expectStatus.join("/")})`);
}

console.log(failures ? `\n${failures} failure(s).` : "\nAll checks passed.");
process.exitCode = failures ? 1 : 0;
