# Challenge 6 submission details

The project is ready for the Urban Air Quality Assistant form. These are the values to paste and review before submitting. No submission attempt has been made.

| Field                    | Value                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Challenge                | [Challenge 6] Urban Air Quality Assistant                                             |
| Public GitHub repository | https://github.com/harsh-gupta-10/hawaplan                                            |
| Deployed project         | https://hawaplan.harshgupta24716.workers.dev                                          |
| Demo video               | https://github.com/harsh-gupta-10/hawaplan/releases/download/v0.1.0/hawaplan-demo.mp4 |

## Describe the changes/updates made in the deployed version

HawaPlan transforms urban air forecasts into actionable outing and indoor routines. The latest version features:

1. Health-Tailored Planning: Evaluates outings against US EPA & WHO AQI breakpoints across 5 vulnerability profiles (general, children/schools, elderly, respiratory, athletes) with dynamic advisory badges.
2. Caregiver & School Brief: 1-click printable/copyable briefing for schools, daycare staff, and families.
3. Multi-Pollutant Analytics: Interactive chart toggling PM₂.₅, PM₁₀, and US AQI, backed by an accessible screen-reader data table.
4. Modular Architecture & a11y: Refactored UI into dedicated hooks and components, adding ARIA live regions and WCAG keyboard flows.
5. Production Hardening: HTTP security headers (CSP, X-Frame-Options, nosniff, Permissions-Policy), Cloudflare D1 sync with rate limits, and 51 automated Vitest tests (auth, algorithms, security).

## Mention the Gen AI services utilized and where

Cloudflare Workers AI runs the Google Gemma model (@cf/google/gemma-4-26b-a4b-it) in the secure server-side Worker endpoint POST /api/ask.

Where & How Utilized:

1. Context-Grounded Follow-ups: Answers conversational user queries regarding outing timing, WHO-aligned indoor mitigation (HEPA/ventilation), and trip-chaining to reduce vehicle emissions.
2. Strict Anti-Hallucination Guardrails: The Worker injects verified real-time facts into the prompt—including Open-Meteo hourly pollutant metrics, computed US EPA AQI category, user vulnerability profile, and deterministic schedule comparisons.
3. Safety & Accuracy Separation: All numerical exposure window comparisons are executed deterministically in shared TypeScript logic. The AI model is strictly constrained by system instructions from inventing personal dosage measurements, fabricated statistics, or medical claims.

## Final checklist

- Public repository: **yes**
- Single branch: **main**
- Source tracked in Git: **about 305 KB**; dependencies and build output are ignored
- Build, formatting check, linting, and 51 automated tests: **passed**
- Demo video: **35-second MP4 attached to a GitHub release**, outside the source repository
- Form submissions used by this preparation: **zero**
