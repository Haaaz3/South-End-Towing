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

## Data and safety

Schedules come from the City of Boston Street Sweeping Schedules data (data.boston.gov), checked against it on Oct 1, 2026. Blue dots are live from the City's public parking-meter data and only show active spaces whose published policy specifies a 120-minute maximum. They are deliberately separate from the colored street-cleaning curbs: a meter is not a resident-parking designation. On a public HTTPS site, the app asks each visitor's phone for location permission on first open, then places their own live blue position marker. Coordinates are used only in that browser and are never sent to or stored by this app. The app intentionally keeps an always-visible notice that posted signs take precedence: temporary permits, holidays, weather, construction, snow emergencies, and resident-permit rules can change whether a spot is actually legal.

## Publish for phones

This is a static, no-login web app: no server, user account, GPS database, or access list is required. Publish the contents of this folder to any HTTPS static host (for example, Cloudflare Pages, Netlify, Vercel, or GitHub Pages) and share its URL. Visitors will see only their own location.

### Vercel

Vercel is a good fit. In **Add New → Project**, upload or import this `south-end-parking` folder as a static project, then deploy. No environment variables or build command are needed. `vercel.json` ensures the service worker is refreshed after later deployments. The resulting `vercel.app` URL is already HTTPS and can be shared directly.

The included web manifest and service worker make it installable from a phone browser's **Add to Home Screen** action and cache the app shell after the first visit. Map tiles still need a connection.

For a local preview, serve this folder with any simple static web server and open `index.html`. The app uses Leaflet with the Esri street-map service over the network; the scheduling calculation itself runs entirely in the browser. If the map service is unavailable, the curb-side schedule controls remain usable and the app shows a plain-language map-status notice instead of provider error tiles.
