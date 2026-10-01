# Curbwise — South End parking view

An interactive, static parking companion centered on 450 Shawmut Ave. It colors nearby curb sides by the next street-cleaning no-parking / tow window and lets you test a future parking time.

## Current coverage

The expanded South End view follows real road geometry for Shawmut, Rutland, West Newton, West Concord, West Dedham, West Springfield, Tremont, Washington, Hanson, Milford, Upton, Dwight, San Juan, Aguadilla, East Brookline, East Berkeley, and Lenox. Each colored line is offset from the actual road centerline onto its odd- or even-numbered curb side.

The status is recalculated from the Boston date and time each minute (or from the time picked in the app): green means no loaded street-cleaning window in the coming 24 hours, yellow means one starts in 6–24 hours, orange means it starts within 6 hours, and red means a tow window is active. A purple alert calls out a tow window ending within an hour and gives the exact time the curb reopens. The 1st/3rd/5th versus 2nd/4th Thursday rules and the exact 5 AM, 8 AM, noon, and overnight start times are included where those City rules apply.

## Odd/even curb sides (verified)

Which physical curb is odd- or even-numbered is set per street in `EVEN_SIDE` in `app.js`, verified against City of Boston address points (SAM) on Oct 1, 2026. It can't be inferred from the line direction, which is arbitrary. Before that fix, 10 of the 17 streets had odd and even painted on the wrong curbs: Rutland, W Newton, W Concord, W Dedham, W Springfield, Hanson, Upton, Dwight, San Juan and E Berkeley.

## Schedules (verified)

Each curb lists the City of Boston street-sweeping rows it represents (`cityRows`, the City's `main_id`). `tools/city_sweeping_south_end.csv` is the City's own data for these streets, from the data.boston.gov "Street Sweeping Schedules" file last modified Oct 1, 2026. `node tools/check-schedules.mjs` checks every curb against its rows: day of week, which weeks, start/end time, and year-round vs. Mar 1–Dec 31. It also confirms that every City row on these streets is either drawn or deliberately left off.

The schedule text shown in the app is generated from the same fields the tow logic uses.

Run `node tools/check-sides.mjs` after any change to road geometry, `EVEN_SIDE`, or schedules. It runs the real `app.js` and checks:

- that every verified address in `tools/city_addresses.json` sits beside the curb line of its own parity
- the Oct 1, 2026 tow at 45 Rutland St (posted sign: 1st, 3rd & 5th Thursday, 8 AM–noon)

## Your car and tow alerts

Tap **Mark my car**, drag the pin onto the curb you parked on, and tap **Park here**. The pin snaps to the nearest mapped curb within 30 m. GPS can't reliably tell which side of the street you're on, so the card always offers a one-tap switch to the other side. The car is remembered on that phone only.

**Turn on tow alerts** sends a push notification 12 hours before the next two tow windows for that curb, 1 hour before, and when each starts. **I moved my car** cancels them all.

How it works: the app computes the alert times and sends them to `/api/car`, which stores them in Upstash Redis and schedules each one with Upstash QStash. At the right time QStash calls `/api/deliver`, which checks QStash's signature and sends the Web Push. QStash's free plan delays at most 7 days, so alerts further out go through a "relay" message that schedules them nearer the time. All the logic is in `lib/alerts-core.js` and is tested by `tools/test-alerts.mjs`.

### Setup (one time, about 5 minutes)

1. In Vercel, open the project, go to **Storage**, and add **Upstash → Redis** (free) and **Upstash → QStash** (free). Connect both to this project, so their environment variables are added automatically.
2. In **Settings → Environment Variables**, add `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`. Generate a pair with `npx web-push generate-vapid-keys`, and keep the private key secret. Optionally add `VAPID_SUBJECT`, a `mailto:` address or the site's URL.
3. Redeploy. `https://<your-site>/api/config` should then show `"pushReady": true`.

On iPhone, web push works only from the Home Screen app (iOS 16.4 or later). Open the site in Safari, tap Share → **Add to Home Screen**, open Curbwise from the Home Screen, and turn on alerts there. Alerts are delivered to the production URL; Vercel preview deployments behind Vercel login can't receive QStash calls.

## Data and safety

Schedules come from the City of Boston Street Sweeping Schedules data (data.boston.gov), checked against it on Oct 1, 2026. Blue dots are live from the City's public parking-meter data and only show active spaces whose published policy specifies a 120-minute maximum. They are deliberately separate from the colored street-cleaning curbs: a meter is not a resident-parking designation. On a public HTTPS site, the app asks each visitor's phone for location permission on first open, then places their own live blue position marker. Coordinates are used only in that browser and are never sent to or stored by this app. The app intentionally keeps an always-visible notice that posted signs take precedence: temporary permits, holidays, weather, construction, snow emergencies, and resident-permit rules can change whether a spot is actually legal.

## Publish for phones

This is a static, no-login web app: no server, user account, GPS database, or access list is required. Publish the contents of this folder to any HTTPS static host (for example, Cloudflare Pages, Netlify, Vercel, or GitHub Pages) and share its URL. Visitors will see only their own location.

### Vercel

Vercel is a good fit. In **Add New → Project**, upload or import this `south-end-parking` folder as a static project, then deploy. No environment variables or build command are needed. `vercel.json` ensures the service worker is refreshed after later deployments. The resulting `vercel.app` URL is already HTTPS and can be shared directly.

The included web manifest and service worker make it installable from a phone browser's **Add to Home Screen** action and cache the app shell after the first visit. Map tiles still need a connection.

For a local preview, serve this folder with any simple static web server and open `index.html`. The app uses Leaflet with the Esri street-map service over the network; the scheduling calculation itself runs entirely in the browser. If the map service is unavailable, the curb-side schedule controls remain usable and the app shows a plain-language map-status notice instead of provider error tiles.
