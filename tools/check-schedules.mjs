// Checks every curb's tow schedule (day of week, which weeks, start/end time,
// season) against the City of Boston street-sweeping rows it cites, and checks
// that every City row for these streets is either drawn or deliberately left
// off the map. Data: tools/city_sweeping_south_end.csv, the City's own
// "Street Sweeping Schedules" file (data.boston.gov, last modified 2026-10-01).
// Run: node tools/check-schedules.mjs   (exit code 1 on any mismatch)
import { loadApp, readCsv } from "./load-app.mjs";

const { curbSegments } = loadApp();
const rows = readCsv(new URL("./city_sweeping_south_end.csv", import.meta.url));
const byId = new Map(rows.map((r) => [Number(r.main_id), r]));
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// City rows on these streets that the map intentionally does not draw.
const NOT_DRAWN = {
  2325: "Shawmut Herald St → E Berkeley St: outside the mapped area",
  2326: "Shawmut Herald St → E Berkeley St: outside the mapped area",
  2327: "Shawmut E Berkeley St → W Dedham St: outside the mapped area",
  2328: "Shawmut E Berkeley St → W Dedham St: outside the mapped area",
  2248: "Rutland even Washington → Newland: duplicate of 2251 (same rule)",
  2442: "Tremont median, Arlington → Dartmouth: outside the mapped area",
  2929: "Tremont median, Arlington → Dartmouth: outside the mapped area",
  2687: "Washington Marginal Rd → E Berkeley St: outside the mapped area",
  3052: "Washington Mass Ave → Lenox: outside the mapped area",
  3053: "Washington Mass Ave → Lenox: outside the mapped area",
  2742: "W Newton SW Corridor → Columbus: outside the mapped area",
  2743: "W Newton Tremont → Columbus: outside the mapped area",
  2744: "W Newton SW Corridor → Columbus: outside the mapped area",
  2747: "W Newton Tremont → Columbus: outside the mapped area"
};

const describeCity = (r) => {
  const days = DAYS.flatMap((d, i) => r[d] === "t" ? [SHORT[i]] : []).join(",");
  const weeks = [1, 2, 3, 4, 5].filter((w) => r[`week_${w}`] === "t").join("");
  return `${days} wk${weeks} ${r.start_time}-${r.end_time}${r.year_round === "t" ? " yr-round" : ""}`;
};
const describeCurb = (c) => `${c.weekdays.map((d) => SHORT[d]).join(",")} wk${(c.ordinals || [1, 2, 3, 4, 5]).join("")} ${c.start}-${c.end}${c.yearRound ? " yr-round" : ""}`;

let failures = 0;
const used = new Set();
console.log("Curb".padEnd(44), "App".padEnd(28), "City row(s)");
for (const c of curbSegments) {
  const problems = [];
  if (!c.cityRows?.length) problems.push("cites no City row");
  for (const id of c.cityRows || []) {
    const r = byId.get(id);
    if (!r) { problems.push(`City row ${id} not found`); continue; }
    used.add(id);
    if (r.st_name !== c.street) problems.push(`row ${id} is ${r.st_name}`);
    const side = c.side.startsWith("Even") ? "Even" : "Odd";
    if (r.side && r.side !== side) problems.push(`row ${id} is the ${r.side} side`);
    const cityDays = DAYS.flatMap((d, i) => r[d] === "t" ? [i] : []);
    if (cityDays.join() !== [...c.weekdays].sort().join()) problems.push(`row ${id} days ${cityDays.map((d) => SHORT[d])}`);
    const cityWeeks = [1, 2, 3, 4, 5].filter((w) => r[`week_${w}`] === "t");
    if (cityWeeks.join() !== (c.ordinals || [1, 2, 3, 4, 5]).join()) problems.push(`row ${id} weeks ${cityWeeks.join("")}`);
    if (r.start_time !== c.start || r.end_time !== c.end) problems.push(`row ${id} time ${r.start_time}-${r.end_time}`);
    if ((r.year_round === "t") !== Boolean(c.yearRound)) problems.push(`row ${id} year_round=${r.year_round}`);
  }
  const cityText = (c.cityRows || []).map((id) => byId.get(id)).filter(Boolean).map((r) => `#${r.main_id} ${r.side || "both"} ${r.from}→${r.to}: ${describeCity(r)}`).join(" | ");
  const label = `${c.street} ${c.side.split("-")[0]} (${c.segment})`;
  if (problems.length) { failures += 1; console.log(`FAIL ${label}: ${problems.join("; ")}`); }
  else console.log(`ok   ${label.padEnd(44)} ${describeCurb(c).padEnd(28)} ${cityText}`);
}

for (const r of rows) {
  const id = Number(r.main_id);
  if (!used.has(id) && !NOT_DRAWN[id]) { failures += 1; console.log(`FAIL City row ${id} (${r.st_name} ${r.side} ${r.from}→${r.to}: ${describeCity(r)}) is neither drawn nor listed in NOT_DRAWN`); }
}

// Season: year-round rows tow in January; Mar–Dec rows don't.
const { statusFor } = loadApp();
const find = (id) => curbSegments.find((c) => c.id === id);
const seasonCases = [
  ["tremont-even", { year: 2027, month: 1, day: 7, hour: 5, minute: 30 }, "active", "Tremont even, Thu Jan 7 2027 5:30 AM (year-round)"],
  ["washington-even", { year: 2027, month: 1, day: 5, hour: 3, minute: 0 }, "active", "Washington even, Tue Jan 5 2027 3:00 AM (year-round)"],
  ["east-berkeley-odd", { year: 2027, month: 2, day: 14, hour: 6, minute: 0 }, "ending", "E Berkeley, Sun Feb 14 2027 6:00 AM (year-round)"],
  ["rutland-odd", { year: 2027, month: 1, day: 7, hour: 9, minute: 0 }, "clear", "Rutland odd, Thu Jan 7 2027 9:00 AM (no sweeping Jan–Feb)"],
  ["rutland-odd", { year: 2027, month: 3, day: 4, hour: 9, minute: 0 }, "active", "Rutland odd, Thu Mar 4 2027 9:00 AM (season back on)"],
  ["springfield-columbus-odd", { year: 2026, month: 10, day: 7, hour: 9, minute: 0 }, "active", "W Springfield odd past Tremont, Wed Oct 7 2026 9:00 AM"],
  ["springfield-odd", { year: 2026, month: 10, day: 7, hour: 9, minute: 0 }, "clear", "W Springfield odd Washington→Tremont, Wed Oct 7 2026 9:00 AM"]
];
for (const [id, time, expected, name] of seasonCases) {
  const got = statusFor(find(id), time).type;
  if (got === expected) console.log(`ok   ${name}: ${got}`);
  else { failures += 1; console.log(`FAIL ${name}: got ${got}, expected ${expected}`); }
}

console.log(failures ? `\n${failures} schedule problem(s).` : `\nAll ${curbSegments.length} curbs match their City rows; every City row on these streets is accounted for.`);
process.exitCode = failures ? 1 : 0;
