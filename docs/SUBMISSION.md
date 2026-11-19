# Challenge 6 submission details

The project is ready for the Urban Air Quality Assistant form. These are the values to paste and review before submitting. No submission attempt has been made.

| Field                    | Value                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Challenge                | [Challenge 6] Urban Air Quality Assistant                                             |
| Public GitHub repository | https://github.com/harsh-gupta-10/hawaplan                                            |
| Deployed project         | https://hawaplan.harshgupta24716.workers.dev                                          |
| Demo video               | https://github.com/harsh-gupta-10/hawaplan/releases/download/v0.1.0/hawaplan-demo.mp4 |

## Describe the changes/updates made in the deployed version

HawaPlan now detects an approximate city, offers permission-based device location and city search, and builds plans for one day or 7-/30-day routines. It compares feasible modeled PM₂.₅ windows, categorizes US EPA/WHO AQI levels, tailors guidance across 5 vulnerability personas (general, children, elderly, respiratory, athletes), and offers a 1-click Caregiver & School Brief. It includes multi-pollutant visualization (PM₂.₅, PM₁₀, US AQI) with accessible data tables, explains low-emission and indoor alternatives, supports weekday schedules, and opens prefilled Google Calendar events. Responsive UI, offline forecast caching, saved plans, persistent chat, strict security headers (CSP, X-Frame-Options, nosniff), and optional Cloudflare D1 account sync make the assistant practical for families.

## Mention the Gen AI services utilized and where

Cloudflare Workers AI runs the @cf/google/gemma-4-26b-a4b-it model in the Worker endpoint POST /api/ask. It uses current Open-Meteo forecast facts, deterministic plan results, US EPA AQI context, user context, and recent chat to answer follow-up questions about outings, indoor alternatives, and lower-emission choices. The forecast comparison itself is deterministic; AI is restricted from inventing numeric exposure or health claims.

## Final checklist

- Public repository: **yes**
- Single branch: **main**
- Source tracked in Git: **about 305 KB**; dependencies and build output are ignored
- Build, formatting check, linting, and 51 automated tests: **passed**
- Demo video: **35-second MP4 attached to a GitHub release**, outside the source repository
- Form submissions used by this preparation: **zero**
