# HawaPlan build plan

## Product goal

Help a family choose _when_ to do an essential outing, how to reduce avoidable vehicle trips, and what to do indoors during severe smog. Keep exposure comparisons separate from emissions actions. Never present a forecast as a personal dose or a guaranteed health result.

## User journey

1. Start with an approximate network location, grant browser location permission, or pick a city. See the current modeled PM₂.₅ and the next 12 hours.
2. Pick a date and one-day, 7-day, or 30-day scope. For longer routines, choose every day or weekdays only.
3. Enter an outing, preferred hour, duration, flexibility, travel mode, and whether someone needs extra care.
4. Compare the preferred time with the lowest modeled PM₂.₅ window that satisfies those constraints where a forecast exists.
5. Read one low-emission and one indoor action.
6. Save useful plans and ask AI follow-ups in a persistent conversation.
7. Optionally create an account to sync preferences, plans, and chat between devices.
8. Review the plan in Google Calendar and save it there, or copy a community message.

## Architecture and free-tier fit

- Vite + React static files on Cloudflare Workers Static Assets.
- One Cloudflare Worker for forecast, geocoding, approximate location, AI, authentication, and sync APIs.
- Open-Meteo air quality and geocoding APIs; no weather or route API key required.
- Cloudflare Workers AI binding using `@cf/google/gemma-4-26b-a4b-it` for opt-in follow-up answers.
- Cloudflare D1 free tier for account and sync data; salted password hashes and HttpOnly session cookies.
- Browser local storage for guest and offline data; service worker for static files and forecast fallback.
- Forecast comparison runs deterministically in `src/shared/planner.ts`, shared by frontend and Worker.

Static asset delivery is free and unlimited under current Cloudflare documentation. Worker, D1, and AI usage have free-tier daily limits; the app continues to show cached data if the network is unavailable. AI answers can stop when the daily allocation is exhausted.

## Scope delivered in this MVP

- City search and live model forecast.
- Outing planner with fixed or flexible time.
- Explicit ambient PM₂.₅ comparison and separate car-trip suggestion.
- Indoor guide with WHO source links.
- AI follow-up with bounded input and grounded numeric claims.
- Community message copy flow.
- Responsive layout and local preference persistence.
- Approximate network location with optional browser geolocation permission.
- Saved plans and persistent chat history with account sync.
- Date-based single plans and 7-/30-day routines with weekday selection and Google Calendar event drafts.
- Account creation, sign-in, sign-out, and account deletion.
- Offline app shell and last forecast fallback.

## Next steps after event feedback

- Integrate nearby measured stations with clear distance and timestamp labels where OpenAQ has coverage.
- Add accessibility and local-language review with community partners.
- Add a school or apartment group workflow only after defining consent and moderation.
- Validate the forecast choice logic against real local observations; avoid street-level claims from coarse model grids.
- Add verified email recovery before presenting the username and password flow as a full production identity system.
