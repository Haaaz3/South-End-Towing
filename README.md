# Curbwise — South End parking view

An interactive, static parking companion centered on 450 Shawmut Ave. It colors nearby curb sides by the next street-cleaning no-parking / tow window and lets you test a future parking time.

## Current coverage

The expanded South End view follows real road geometry for Shawmut, Rutland, West Newton, West Concord, West Dedham, West Springfield, Tremont, Washington, Hanson, Milford, Upton, Dwight, San Juan, Aguadilla, East Brookline, East Berkeley, and Lenox. Each colored line is offset from the actual road centerline onto its odd- or even-numbered curb side.

The status is recalculated from the Boston date and time each minute (or from the time picked in the app): green means no loaded street-cleaning window in the coming 24 hours, yellow means one starts in 6–24 hours, orange means it starts within 6 hours, and red means a tow window is active. A purple alert calls out a tow window ending within an hour and gives the exact time the curb reopens. The 1st/3rd/5th versus 2nd/4th Thursday rules and the exact 5 AM, 8 AM, noon, and overnight start times are included where those City rules apply.

## Data and safety

Schedules are seeded from the City of Boston Street Sweeping Lookup, checked September 2026. Blue dots are live from the City's public parking-meter data and only show active spaces whose published policy specifies a 120-minute maximum. They are deliberately separate from the colored street-cleaning curbs: a meter is not a resident-parking designation. On a public HTTPS site, the app asks each visitor's phone for location permission on first open, then places their own live blue position marker. Coordinates are used only in that browser and are never sent to or stored by this app. The app intentionally keeps an always-visible notice that posted signs take precedence: temporary permits, holidays, weather, construction, snow emergencies, and resident-permit rules can change whether a spot is actually legal.

## Publish for phones

This is a static, no-login web app: no server, user account, GPS database, or access list is required. Publish the contents of this folder to any HTTPS static host (for example, Cloudflare Pages, Netlify, Vercel, or GitHub Pages) and share its URL. Visitors will see only their own location.

### Vercel

Vercel is a good fit. In **Add New → Project**, upload or import this `south-end-parking` folder as a static project, then deploy. No environment variables or build command are needed. `vercel.json` ensures the service worker is refreshed after later deployments. The resulting `vercel.app` URL is already HTTPS and can be shared directly.

The included web manifest and service worker make it installable from a phone browser's **Add to Home Screen** action and cache the app shell after the first visit. Map tiles still need a connection.

For a local preview, serve this folder with any simple static web server and open `index.html`. The app uses Leaflet with the Esri street-map service over the network; the scheduling calculation itself runs entirely in the browser. If the map service is unavailable, the curb-side schedule controls remain usable and the app shows a plain-language map-status notice instead of provider error tiles.
