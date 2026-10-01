/* Curbwise: a small, sign-aware street-cleaning helper for the South End.
   The colored paths below use OpenStreetMap road geometry (not screen-space lines).
   City schedules are still only a planning aid: the sign at the curb wins. */

const BOSTON_TIME_ZONE = "America/New_York";
// City of Boston SAM address point for 450 Shawmut Ave (even side, between
// Newland St and Rutland St). The previous value sat ~70 m away at West Newton St.
const HOME = { lat: 42.339189, lng: -71.074941, label: "450 Shawmut Ave" };
const COLORS = { clear: "#138b70", soon: "#d4a11e", urgent: "#df741e", active: "#c94b42", ending: "#675bab" };
const METER_SERVICE = "https://gisportal.boston.gov/arcgis/rest/services/Infrastructure/OpenData/MapServer/9/query";
const METER_BOUNDS = "-71.083,42.334,-71.066,42.346";

const ROADS = {
  shawmut: [[42.3413062,-71.0720464],[42.340841,-71.072751],[42.340396,-71.073434],[42.340031,-71.0739954],[42.3396564,-71.0745554],[42.3392022,-71.0752325],[42.338733,-71.0759462],[42.3382851,-71.0766383],[42.3378268,-71.0773394],[42.3374337,-71.0779331],[42.3369055,-71.0787192]],
  rutland: [[42.3409305,-71.0772985],[42.3406208,-71.0769471],[42.339484,-71.075594],[42.3392022,-71.0752325],[42.3388806,-71.0748595],[42.338421,-71.074288]],
  westNewton: [[42.3413374,-71.0765562],[42.3410903,-71.0762631],[42.340536,-71.0756083],[42.3396564,-71.0745554],[42.3389758,-71.0737589],[42.338869,-71.07363]],
  westConcord: [[42.3405218,-71.0780724],[42.340161,-71.0776465],[42.339024,-71.076287],[42.338733,-71.0759462],[42.3384155,-71.0755682],[42.3379292,-71.0749632]],
  westDedham: [[42.3428273,-71.0737716],[42.3424408,-71.0734069],[42.3418803,-71.0727358],[42.3413062,-71.0720464],[42.340945,-71.0712588]],
  westSpringfield: [[42.3411093,-71.0811064],[42.3406319,-71.0804911],[42.3400026,-71.0799018],[42.339709,-71.079595],[42.3389519,-71.078708],[42.3378268,-71.0773394],[42.33697,-71.076316]],
  tremont: [[42.3428273,-71.0737716],[42.3423618,-71.0746575],[42.3416674,-71.0759418],[42.3409305,-71.0772985],[42.3401191,-71.0788195],[42.3396152,-71.0797761],[42.3389363,-71.0809535],[42.3384275,-71.0819867]],
  washington: [[42.339615,-71.072504],[42.3395403,-71.0726066],[42.338869,-71.07363],[42.33864,-71.0739634],[42.338421,-71.074288],[42.3379292,-71.0749632],[42.337459,-71.075647],[42.33697,-71.076316]],
  hanson: [[42.3442865,-71.0710541],[42.3441935,-71.07096],[42.3441502,-71.0709204],[42.3433269,-71.069646],[42.3432793,-71.0695766],[42.3431865,-71.0694355],[42.343054,-71.0692339],[42.3429909,-71.0691374]],
  milford: [[42.3433976,-71.0684339],[42.3434626,-71.0685244],[42.3435463,-71.0686586],[42.343605,-71.0687757],[42.343722,-71.0690218],[42.3441705,-71.069885],[42.3444413,-71.0704362],[42.3444597,-71.0704607],[42.3444952,-71.0705067],[42.3445456,-71.0705715]],
  upton: [[42.343176,-71.0731314],[42.3430818,-71.073029],[42.3428644,-71.0728003],[42.3422234,-71.0720187],[42.3420108,-71.0717671],[42.3417613,-71.0714705],[42.3416907,-71.0713824]],
  dwight: [[42.3448874,-71.0701947],[42.3448326,-71.0700578],[42.344198,-71.068618],[42.34409,-71.068331],[42.3439316,-71.0678406],[42.3438932,-71.067774],[42.3438482,-71.0677093]],
  sanJuan: [[42.340841,-71.072751],[42.3409044,-71.0728259],[42.341133,-71.073096],[42.341429,-71.0734074],[42.3414788,-71.0734819],[42.3414887,-71.0735492],[42.3414668,-71.0736348],[42.3414328,-71.0736971],[42.3413091,-71.0738709],[42.3411037,-71.0741654],[42.3410589,-71.074237],[42.3410228,-71.074294],[42.3407511,-71.0747305],[42.3407142,-71.0747524],[42.3406613,-71.0747469],[42.3406323,-71.0747204],[42.3403344,-71.0743769],[42.340305,-71.074343],[42.3400865,-71.074063],[42.340031,-71.0739954]],
  aguadilla: [[42.3423955,-71.074592],[42.3423021,-71.0744849],[42.342149,-71.074294],[42.342033,-71.074145],[42.341976,-71.074073],[42.341947,-71.074063],[42.341905,-71.07408],[42.3418919,-71.0740945],[42.341845,-71.074146],[42.3415257,-71.0746338],[42.3414982,-71.0746758],[42.341473,-71.074713],[42.341425,-71.0747832],[42.34117,-71.075156],[42.341132,-71.075239],[42.341136,-71.075301],[42.34114,-71.075343],[42.341183,-71.075399],[42.341306,-71.075544],[42.3415767,-71.0758452],[42.3416674,-71.0759418]],
  eastBrookline: [[42.339615,-71.072504],[42.339508,-71.0723758],[42.3389892,-71.0717613],[42.3388607,-71.0716093],[42.3388262,-71.0715652],[42.3385665,-71.0712561],[42.3383857,-71.0710358],[42.3383656,-71.0710113],[42.338317,-71.0709521],[42.3382659,-71.0708916],[42.3369426,-71.0693236],[42.3367618,-71.0691084],[42.3366862,-71.069018]],
  eastBerkeley: [[42.3439571,-71.0659884],[42.3440018,-71.0661266],[42.344045,-71.066254],[42.3440498,-71.0662681],[42.344115,-71.066461],[42.3442546,-71.0668673],[42.3442787,-71.0669423],[42.3442901,-71.0669774],[42.3443169,-71.0670567],[42.3443522,-71.0671597],[42.3446726,-71.0680628],[42.3449906,-71.0689715],[42.3450939,-71.0692731]],
  lenox: [[42.3350615,-71.0787954],[42.3351044,-71.0788516],[42.3351505,-71.0789121],[42.3353574,-71.0792351],[42.3356426,-71.0796497],[42.3358819,-71.0799945],[42.3359029,-71.0800247],[42.335951,-71.0801],[42.3359887,-71.0801546],[42.3361739,-71.0804229],[42.336605,-71.0810476],[42.3375745,-71.0824526],[42.3376944,-71.0826337]]
};

// Which side of each ROADS path (in the direction its points are listed) the
// EVEN-numbered addresses are on: +1 = left, -1 = right. This must be set per
// road from real address data — path direction is arbitrary, so it cannot be
// assumed. Verified against City of Boston SAM address points on 2026-10-01;
// re-run `node tools/check-sides.mjs` after editing any path or this table.
const EVEN_SIDE = {
  shawmut: 1,
  rutland: -1,
  westNewton: -1,
  westConcord: -1,
  westDedham: -1,
  westSpringfield: -1,
  tremont: 1,
  washington: 1,
  hanson: -1,
  milford: 1,
  upton: -1,
  dwight: -1,
  sanJuan: -1,
  aguadilla: 1,
  eastBrookline: 1,
  eastBerkeley: -1,
  lenox: 1
};

function curb(id, street, road, side, segment, schedule, weekdays, ordinals, start, end) {
  return { id, street, road, side, shortSide: `${side} side`, segment, schedule, weekdays, ordinals, start, end, path: ROADS[road] };
}

// Weekday uses JS convention: Sunday 0 through Saturday 6. Schedules are the
// City's daytime street-cleaning rules for these curb sides and street segments.
const curbSegments = [
  curb("shawmut-even", "Shawmut Ave", "shawmut", "Even-numbered", "West Dedham St → Massachusetts Ave", "Every Thursday · 12–4 PM", [4], null, "12:00", "16:00"),
  curb("shawmut-odd", "Shawmut Ave", "shawmut", "Odd-numbered", "West Dedham St → Massachusetts Ave", "Every Friday · 8 AM–12 PM", [5], null, "08:00", "12:00"),
  curb("rutland-even", "Rutland St", "rutland", "Even-numbered", "Shawmut Ave → Tremont St", "2nd & 4th Thursday · 8 AM–12 PM", [4], [2,4], "08:00", "12:00"),
  curb("rutland-odd", "Rutland St", "rutland", "Odd-numbered", "Shawmut Ave → Tremont St", "1st, 3rd & 5th Thursday · 8 AM–12 PM", [4], [1,3,5], "08:00", "12:00"),
  curb("newton-even", "West Newton St", "westNewton", "Even-numbered", "Shawmut Ave → Tremont St", "2nd & 4th Thursday · 8 AM–12 PM", [4], [2,4], "08:00", "12:00"),
  curb("newton-odd", "West Newton St", "westNewton", "Odd-numbered", "Shawmut Ave → Tremont St", "1st, 3rd & 5th Thursday · 8 AM–12 PM", [4], [1,3,5], "08:00", "12:00"),
  curb("concord-even", "West Concord St", "westConcord", "Even-numbered", "Shawmut Ave → Tremont St", "2nd & 4th Thursday · 8 AM–12 PM", [4], [2,4], "08:00", "12:00"),
  curb("concord-odd", "West Concord St", "westConcord", "Odd-numbered", "Shawmut Ave → Tremont St", "1st, 3rd & 5th Thursday · 8 AM–12 PM", [4], [1,3,5], "08:00", "12:00"),
  curb("dedham-even", "West Dedham St", "westDedham", "Even-numbered", "Tremont St → Washington St", "2nd & 4th Thursday · 8 AM–12 PM", [4], [2,4], "08:00", "12:00"),
  curb("dedham-odd", "West Dedham St", "westDedham", "Odd-numbered", "Tremont St → Washington St", "1st, 3rd & 5th Thursday · 8 AM–12 PM", [4], [1,3,5], "08:00", "12:00"),
  curb("springfield-even", "West Springfield St", "westSpringfield", "Even-numbered", "Tremont St → Washington St", "2nd & 4th Thursday · 8 AM–12 PM", [4], [2,4], "08:00", "12:00"),
  curb("springfield-odd", "West Springfield St", "westSpringfield", "Odd-numbered", "Tremont St → Washington St", "1st, 3rd & 5th Thursday · 8 AM–12 PM", [4], [1,3,5], "08:00", "12:00"),
  curb("tremont-even", "Tremont St", "tremont", "Even-numbered", "East Berkeley St → Massachusetts Ave", "Every Thursday · 5–7 AM", [4], null, "05:00", "07:00"),
  curb("tremont-odd", "Tremont St", "tremont", "Odd-numbered", "East Berkeley St → Massachusetts Ave", "Every Monday · 5–7 AM", [1], null, "05:00", "07:00"),
  curb("washington-even", "Washington St", "washington", "Even-numbered", "East Berkeley St → Massachusetts Ave", "Every Tuesday · 12–7 AM", [2], null, "00:01", "07:00"),
  curb("washington-odd", "Washington St", "washington", "Odd-numbered", "East Berkeley St → Massachusetts Ave", "Every Wednesday · 12–7 AM", [3], null, "00:01", "07:00"),
  curb("hanson-even", "Hanson St", "hanson", "Even-numbered", "Shawmut Ave → Tremont St", "2nd & 4th Thursday · 8 AM–12 PM", [4], [2, 4], "08:00", "12:00"),
  curb("hanson-odd", "Hanson St", "hanson", "Odd-numbered", "Shawmut Ave → Tremont St", "1st, 3rd & 5th Thursday · 8 AM–12 PM", [4], [1, 3, 5], "08:00", "12:00"),
  curb("milford-even", "Milford St", "milford", "Even-numbered", "Shawmut Ave → Tremont St", "2nd & 4th Thursday · 8 AM–12 PM", [4], [2, 4], "08:00", "12:00"),
  curb("milford-odd", "Milford St", "milford", "Odd-numbered", "Shawmut Ave → Tremont St", "1st, 3rd & 5th Thursday · 8 AM–12 PM", [4], [1, 3, 5], "08:00", "12:00"),
  curb("upton-even", "Upton St", "upton", "Even-numbered", "Shawmut Ave → Tremont St", "2nd & 4th Thursday · 8 AM–12 PM", [4], [2, 4], "08:00", "12:00"),
  curb("upton-odd", "Upton St", "upton", "Odd-numbered", "Shawmut Ave → Tremont St", "1st, 3rd & 5th Thursday · 8 AM–12 PM", [4], [1, 3, 5], "08:00", "12:00"),
  curb("dwight-even", "Dwight St", "dwight", "Even-numbered", "Shawmut Ave → Tremont St", "2nd & 4th Thursday · 8 AM–12 PM", [4], [2, 4], "08:00", "12:00"),
  curb("dwight-odd", "Dwight St", "dwight", "Odd-numbered", "Shawmut Ave → Tremont St", "1st, 3rd & 5th Thursday · 8 AM–12 PM", [4], [1, 3, 5], "08:00", "12:00"),
  curb("san-juan-even", "San Juan St", "sanJuan", "Even-numbered", "Shawmut Ave → Shawmut Ave", "2nd & 4th Thursday · 8 AM–12 PM", [4], [2, 4], "08:00", "12:00"),
  curb("san-juan-odd", "San Juan St", "sanJuan", "Odd-numbered", "Shawmut Ave → Shawmut Ave", "1st, 3rd & 5th Thursday · 8 AM–12 PM", [4], [1, 3, 5], "08:00", "12:00"),
  curb("aguadilla-even", "Aguadilla St", "aguadilla", "Even-numbered", "Tremont St → Tremont St", "2nd & 4th Thursday · 8 AM–12 PM", [4], [2, 4], "08:00", "12:00"),
  curb("aguadilla-odd", "Aguadilla St", "aguadilla", "Odd-numbered", "Tremont St → Tremont St", "1st, 3rd & 5th Thursday · 8 AM–12 PM", [4], [1, 3, 5], "08:00", "12:00"),
  curb("east-brookline-even", "East Brookline St", "eastBrookline", "Even-numbered", "Washington St → Albany St", "2nd & 4th Thursday · 12–4 PM", [4], [2, 4], "12:00", "16:00"),
  curb("east-brookline-odd", "East Brookline St", "eastBrookline", "Odd-numbered", "Washington St → Albany St", "1st, 3rd & 5th Thursday · 12–4 PM", [4], [1, 3, 5], "12:00", "16:00"),
  curb("east-berkeley-even", "East Berkeley St", "eastBerkeley", "Even-numbered", "Washington St → Albany St", "Every day · 12:01–7 AM", [0, 1, 2, 3, 4, 5, 6], null, "00:01", "07:00"),
  curb("east-berkeley-odd", "East Berkeley St", "eastBerkeley", "Odd-numbered", "Washington St → Albany St", "Every day · 12:01–7 AM", [0, 1, 2, 3, 4, 5, 6], null, "00:01", "07:00"),
  curb("lenox-even", "Lenox St", "lenox", "Even-numbered", "Washington St → Tremont St", "2nd & 4th Thursday · 8 AM–12 PM", [4], [2, 4], "08:00", "12:00"),
  curb("lenox-odd", "Lenox St", "lenox", "Odd-numbered", "Washington St → Tremont St", "1st, 3rd & 5th Thursday · 8 AM–12 PM", [4], [1, 3, 5], "08:00", "12:00")
];

const state = {
  selectedId: "shawmut-even",
  parkingTime: null,
  isLive: true,
  map: null,
  curbLines: new Map(),
  meterLayer: null,
  userMarker: null,
  accuracyCircle: null,
  userLocation: null,
  saved: new Set(JSON.parse(localStorage.getItem("curbwise-saved") || "[]"))
};

const element = (selector) => document.querySelector(selector);
const selectedCurb = () => curbSegments.find((curbSide) => curbSide.id === state.selectedId) || curbSegments[0];

function partsInBoston(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BOSTON_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute) };
}

function partsToInputValue(parts) {
  const two = (value) => String(value).padStart(2, "0");
  return `${parts.year}-${two(parts.month)}-${two(parts.day)}T${two(parts.hour)}:${two(parts.minute)}`;
}

function inputValueToBostonTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || "");
  return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), hour: Number(match[4]), minute: Number(match[5]) } : partsInBoston();
}

function parkingTime() { return state.parkingTime || partsInBoston(); }
function dayDate(parts) { return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)); }
function weekday(parts) { return dayDate(parts).getUTCDay(); }
function minutesOfDay(parts) { return parts.hour * 60 + parts.minute; }
function timeToMinutes(value) { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; }
function ordinalInMonth(parts) { return Math.floor((parts.day - 1) / 7) + 1; }
function daylightSeason(parts) { return parts.month >= 3 && parts.month <= 12; }

function isScheduledOn(curbSide, parts) {
  return daylightSeason(parts) && curbSide.weekdays.includes(weekday(parts)) && (!curbSide.ordinals || curbSide.ordinals.includes(ordinalInMonth(parts)));
}

function addDays(parts, amount) {
  const result = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount));
  return { year: result.getUTCFullYear(), month: result.getUTCMonth() + 1, day: result.getUTCDate(), hour: 0, minute: 0 };
}

function nextWindow(curbSide, from = parkingTime()) {
  const nowMinutes = minutesOfDay(from);
  const startMinutes = timeToMinutes(curbSide.start);
  const endMinutes = timeToMinutes(curbSide.end);
  for (let offset = 0; offset <= 100; offset += 1) {
    const day = addDays(from, offset);
    if (!isScheduledOn(curbSide, day)) continue;
    if (offset === 0 && nowMinutes >= endMinutes) continue;
    const active = offset === 0 && nowMinutes >= startMinutes && nowMinutes < endMinutes;
    return {
      ...day,
      startMinutes,
      endMinutes,
      active,
      minutesAway: active ? 0 : (offset * 1440) + startMinutes - nowMinutes,
      minutesUntilEnd: active ? endMinutes - nowMinutes : null
    };
  }
  return null;
}

function statusFor(curbSide, time = parkingTime()) {
  const next = nextWindow(curbSide, time);
  if (!next) return { type: "clear", next: null, label: "No scheduled daytime cleaning found" };
  if (next.active && next.minutesUntilEnd <= 60) return { type: "ending", next, label: "Parking opens within 1 hour" };
  if (next.active) return { type: "active", next, label: "Tow window active now" };
  if (next.minutesAway <= 360) return { type: "urgent", next, label: "Tow window starts within 6 hours" };
  if (next.minutesAway <= 1440) return { type: "soon", next, label: "Tow window starts within 24 hours" };
  return { type: "clear", next, label: "Clear for the next 24 hours" };
}

function formatTime(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const displayHour = hour % 12 || 12;
  return `${displayHour}${minute ? `:${String(minute).padStart(2, "0")}` : ""} ${hour >= 12 ? "PM" : "AM"}`;
}

function formatRange(next) {
  const startHour = Math.floor(next.startMinutes / 60);
  const startMinute = next.startMinutes % 60;
  const endHour = Math.floor(next.endMinutes / 60);
  const endMinute = next.endMinutes % 60;
  const short = (hour, minute) => `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, "0")}` : ""}`;
  const meridiem = (hour) => hour >= 12 ? "PM" : "AM";
  return meridiem(startHour) === meridiem(endHour)
    ? `${short(startHour, startMinute)}–${short(endHour, endMinute)} ${meridiem(endHour)}`
    : `${short(startHour, startMinute)} ${meridiem(startHour)}–${short(endHour, endMinute)} ${meridiem(endHour)}`;
}

function formatWindow(next) {
  if (!next) return "No window in the loaded schedule";
  const date = new Date(Date.UTC(next.year, next.month - 1, next.day));
  const day = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }).format(date);
  return `${day} · ${formatRange(next)}`;
}

function timeUntil(minutes) {
  if (minutes === 0) return "in progress now";
  if (minutes < 60) return `in ${Math.max(1, Math.ceil(minutes))} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  if (hours < 24) return `in ${hours} hr${hours === 1 ? "" : "s"}${remainingMinutes ? ` ${remainingMinutes} min` : ""}`;
  const days = Math.floor(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

function windowCountdown(next) {
  if (!next) return "";
  if (!next.active) return timeUntil(next.minutesAway);
  if (next.minutesUntilEnd <= 60) return `opens ${timeUntil(next.minutesUntilEnd)} · at ${formatTime(next.endMinutes)}`;
  return `ends ${timeUntil(next.minutesUntilEnd)} · parking opens at ${formatTime(next.endMinutes)}`;
}

// Offset each curb from the real road centerline by roughly a parking-lane width.
// Positive offset = left of the path direction. EVEN_SIDE says which side the
// even-numbered curb is actually on for this particular road.
function offsetPath(path, side, road) {
  const evenSide = EVEN_SIDE[road];
  if (evenSide !== 1 && evenSide !== -1) throw new Error(`No verified EVEN_SIDE for road "${road}"`);
  const offsetMeters = (side.startsWith("Even") ? 5.5 : -5.5) * evenSide;
  return path.map((point, index) => {
    const previous = path[Math.max(0, index - 1)];
    const following = path[Math.min(path.length - 1, index + 1)];
    const latitude = point[0];
    const cosLatitude = Math.cos(latitude * Math.PI / 180);
    const east = (following[1] - previous[1]) * 111320 * cosLatitude;
    const north = (following[0] - previous[0]) * 110540;
    const length = Math.hypot(east, north) || 1;
    const eastOffset = (-north / length) * offsetMeters;
    const northOffset = (east / length) * offsetMeters;
    return [latitude + northOffset / 110540, point[1] + eastOffset / (111320 * cosLatitude)];
  });
}

function showMapStatus(message) {
  const box = element("#map-status");
  box.textContent = message;
  box.hidden = !message;
}

function initMap() {
  if (!window.L) {
    showMapStatus("The map library did not load. Check your connection, then refresh.");
    return;
  }
  state.map = L.map("map", { zoomControl: false, attributionControl: true, preferCanvas: true }).setView([HOME.lat, HOME.lng], 16);
  L.control.zoom({ position: "bottomright" }).addTo(state.map);
  const tiles = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19,
    attribution: "Tiles © Esri"
  }).addTo(state.map);
  let loadedTile = false;
  tiles.on("tileload", () => { loadedTile = true; showMapStatus(""); });
  tiles.on("tileerror", () => { if (!loadedTile) showMapStatus("Map tiles are temporarily unavailable. The curb schedules are still usable."); });

  L.circle([HOME.lat, HOME.lng], { radius: 560, color: "#0c7464", weight: 1, opacity: 0.18, fillOpacity: 0 }).addTo(state.map);
  L.marker([HOME.lat, HOME.lng], {
    icon: L.divIcon({ className: "address-marker", html: "<span aria-hidden='true'>⌂</span>", iconSize: [38, 38], iconAnchor: [19, 19] })
  }).bindTooltip("450 Shawmut Ave", { direction: "top", offset: [0, -18] }).addTo(state.map);

  state.meterLayer = L.layerGroup();
  loadTwoHourMeters();

  const drawnRoads = new Set();
  curbSegments.forEach((curbSide) => {
    if (!drawnRoads.has(curbSide.road)) {
      drawnRoads.add(curbSide.road);
      L.polyline(curbSide.path, { color: "#31544c", weight: 2, opacity: 0.32, interactive: false }).addTo(state.map);
    }
    const line = L.polyline(offsetPath(curbSide.path, curbSide.side, curbSide.road), {
      className: `curb-line curb-${curbSide.id}`,
      lineCap: "round",
      lineJoin: "round",
      opacity: 0.97,
      weight: 6
    });
    line.bindTooltip(`${curbSide.street} · ${curbSide.shortSide}`, { sticky: true, direction: "top", offset: [0, -8] });
    line.on("click", () => { state.selectedId = curbSide.id; render(); });
    line.addTo(state.map);
    state.curbLines.set(curbSide.id, line);
  });
  new ResizeObserver(() => state.map && state.map.invalidateSize()).observe(element("#map"));
}

function isTwoHourMeter(properties) {
  const policy = String(properties.PAY_POLICY || "");
  return properties.METER_STATE === "ACTIVE" && /(?:^|\D)120(?:\D|$)/.test(policy);
}

function meterTooltip(properties) {
  const policy = String(properties.PAY_POLICY || "").replace(/\s+/g, " ").trim();
  const hours = policy.match(/\d{2}:\d{2}(?:AM|PM)-\d{2}:\d{2}(?:AM|PM)\s+[A-Z-]+/i)?.[0];
  return `City 2-hour meter${hours ? ` · ${hours}` : ""}`;
}

function loadTwoHourMeters() {
  const parameters = new URLSearchParams({
    where: "1=1",
    geometry: METER_BOUNDS,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "PAY_POLICY,METER_STATE,SPACE_STATE",
    returnGeometry: "true",
    outSR: "4326",
    f: "geojson"
  });
  fetch(`${METER_SERVICE}?${parameters}`)
    .then((response) => {
      if (!response.ok) throw new Error("Meter data unavailable");
      return response.json();
    })
    .then((data) => {
      const meters = (data.features || []).filter((feature) =>
        feature.geometry?.type === "Point" && isTwoHourMeter(feature.properties || {})
      );
      meters.forEach((feature) => {
        const [lng, lat] = feature.geometry.coordinates;
        L.circleMarker([lat, lng], {
          radius: 3.3,
          color: "#ffffff",
          weight: 1.1,
          fillColor: "#2879c8",
          fillOpacity: 0.96
        }).bindTooltip(meterTooltip(feature.properties || {}), { sticky: true, direction: "top", offset: [0, -5] }).addTo(state.meterLayer);
      });
      const toggle = element("#meter-toggle");
      toggle.setAttribute("aria-label", `Show ${meters.length} City 2-hour meter spaces`);
    })
    .catch(() => {
      const toggle = element("#meter-toggle");
      toggle.checked = false;
      toggle.disabled = true;
      toggle.setAttribute("aria-label", "City 2-hour meter data is temporarily unavailable");
    });
}

function renderMap() {
  state.curbLines.forEach((line, id) => {
    const curbSide = curbSegments.find((item) => item.id === id);
    const status = statusFor(curbSide);
    const selected = id === state.selectedId;
    line.setStyle({
      color: COLORS[status.type],
      weight: selected ? (status.type === "ending" ? 10 : 9) : (status.type === "ending" ? 7 : 6),
      opacity: selected ? 1 : 0.9,
      dashArray: status.type === "ending" ? "2 11" : null
    });
    if (selected) line.bringToFront();
  });
}

function renderSelection() {
  const curbSide = selectedCurb();
  const status = statusFor(curbSide);
  const next = status.next;
  element("#selected-street").textContent = `${curbSide.street} · ${curbSide.shortSide.toLowerCase()}`;
  element("#selected-segment").textContent = curbSide.segment;
  const statusBox = element("#selected-status");
  statusBox.textContent = status.label;
  statusBox.className = `status-row status-${status.type}`;
  element("#selected-next").textContent = formatWindow(next);
  element("#selected-countdown").textContent = windowCountdown(next);
  element("#selected-rule").textContent = curbSide.schedule;
  const saved = state.saved.has(curbSide.id);
  const saveButton = element("#save-button");
  saveButton.setAttribute("aria-pressed", String(saved));
  saveButton.firstElementChild.textContent = saved ? "★" : "☆";
}

function renderNearby() {
  const list = element("#nearby-list");
  const order = { ending: 0, clear: 1, soon: 2, urgent: 3, active: 4 };
  const rows = curbSegments.map((curbSide) => ({ curbSide, status: statusFor(curbSide) }))
    .sort((left, right) => order[left.status.type] - order[right.status.type] || (right.status.next?.minutesAway || 0) - (left.status.next?.minutesAway || 0));
  list.innerHTML = rows.map(({ curbSide, status }) => `
    <button class="curb-result${curbSide.id === state.selectedId ? " is-selected" : ""}" type="button" data-curb-id="${curbSide.id}">
      <i class="curb-color ${status.type}" aria-hidden="true"></i>
      <span class="curb-copy"><strong>${curbSide.street}</strong><small>${curbSide.shortSide} · ${formatRange(status.next)}</small></span>
      <span class="curb-when">${windowCountdown(status.next) || "—"}</span>
    </button>`).join("");
  element("#nearby-count").textContent = `${curbSegments.length} curb sides`;
  list.querySelectorAll("[data-curb-id]").forEach((button) => button.addEventListener("click", () => {
    state.selectedId = button.dataset.curbId;
    render();
  }));
}

function renderTime() {
  const time = parkingTime();
  const date = new Date(Date.UTC(time.year, time.month - 1, time.day, time.hour, time.minute));
  const label = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(date);
  element("#time-context").textContent = `${label} Boston time${state.isLive ? " · live" : ""}`;
  element("#parking-time").value = partsToInputValue(time);
}

function render() { renderTime(); renderMap(); renderSelection(); renderNearby(); }

function updateUserLocation(position) {
  const { latitude, longitude, accuracy } = position.coords;
  const latLng = [latitude, longitude];
  state.userLocation = latLng;
  if (state.userMarker) state.map.removeLayer(state.userMarker);
  if (state.accuracyCircle) state.map.removeLayer(state.accuracyCircle);
  state.userMarker = L.marker(latLng, {
    icon: L.divIcon({ className: "user-marker", html: "<span aria-hidden='true'></span>", iconSize: [22, 22], iconAnchor: [11, 11] })
  }).bindTooltip("Your location", { direction: "top", offset: [0, -11] }).addTo(state.map);
  state.accuracyCircle = L.circle(latLng, { radius: Math.min(Math.max(accuracy, 12), 180), color: "#1771c5", weight: 1, fillColor: "#4aa3ff", fillOpacity: 0.14, interactive: false }).addTo(state.map);
  state.map.flyTo(latLng, Math.max(state.map.getZoom(), 17), { duration: 0.65 });
  element("#location-summary").innerHTML = "<span aria-hidden='true'>●</span> Your live location";
  const button = element("#location-button");
  button.textContent = "Location updated";
  button.disabled = false;
}

function requestLocation() {
  const button = element("#location-button");
  if (!navigator.geolocation || !state.map) {
    showMapStatus("This browser cannot share a location. You can still browse from 450 Shawmut Ave.");
    return;
  }
  button.textContent = "Locating…";
  button.disabled = true;
  navigator.geolocation.getCurrentPosition(updateUserLocation, (error) => {
    button.textContent = "Use my location";
    button.disabled = false;
    const reason = error.code === error.PERMISSION_DENIED ? "Location is off. Allow location access in your browser to see yourself on the map." : "Your location could not be read. Try again when you have a signal.";
    element("#location-summary").innerHTML = "<span aria-hidden='true'>⌂</span> Centered at 450 Shawmut Ave";
    showMapStatus(reason);
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
}

function bindEvents() {
  element("#now-button").addEventListener("click", () => { state.isLive = true; state.parkingTime = null; render(); });
  element("#parking-time").addEventListener("change", (event) => { state.isLive = false; state.parkingTime = inputValueToBostonTime(event.target.value); render(); });
  element("#save-button").addEventListener("click", () => {
    const id = selectedCurb().id;
    state.saved.has(id) ? state.saved.delete(id) : state.saved.add(id);
    localStorage.setItem("curbwise-saved", JSON.stringify([...state.saved]));
    renderSelection();
  });
  element("#location-button").addEventListener("click", requestLocation);
  element("#meter-toggle").addEventListener("change", (event) => {
    if (!state.map || !state.meterLayer) return;
    if (event.target.checked) state.meterLayer.addTo(state.map);
    else state.map.removeLayer(state.meterLayer);
  });
  element("#center-button").addEventListener("click", () => {
    if (!state.map) return;
    state.map.flyTo(state.userLocation || [HOME.lat, HOME.lng], state.userLocation ? 17 : 16, { duration: 0.55 });
  });
}

function requestInitialLocation() {
  if (!navigator.geolocation) return;
  if (!navigator.permissions) {
    requestLocation();
    return;
  }
  navigator.permissions.query({ name: "geolocation" }).then((result) => {
    // The phone displays its own permission sheet the first time. Coordinates
    // are used only in this browser to place the blue marker; no GPS data is sent or stored.
    if (result.state !== "denied") requestLocation();
  }).catch(() => requestLocation());
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || window.location.protocol === "file:") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

initMap();
bindEvents();
render();
requestInitialLocation();
registerServiceWorker();
window.setInterval(() => { if (state.isLive) render(); }, 60000);
