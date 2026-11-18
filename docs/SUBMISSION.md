# Challenge 6 submission details

The project is ready for the Urban Air Quality Assistant form. These are the values to paste and review before submitting. No submission attempt has been made.

| Field                    | Value                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Challenge                | [Challenge 6] Urban Air Quality Assistant                                             |
| Public GitHub repository | https://github.com/harsh-gupta-10/hawaplan                                            |
| Deployed project         | https://hawaplan.harshgupta24716.workers.dev                                          |
| Demo video               | https://github.com/harsh-gupta-10/hawaplan/releases/download/v0.1.0/hawaplan-demo.mp4 |

## Describe the changes/updates made in the deployed version

HawaPlan now detects an approximate city, offers permission-based device location and city search, and builds plans for one day or 7-/30-day routines. It compares feasible modeled PM₂.₅ windows, explains low-emission and indoor alternatives, supports weekday schedules, and opens prefilled Google Calendar events. Responsive UI, offline forecast caching, saved plans, persistent chat, and optional Cloudflare D1 account sync make the assistant practical for families. Future dates are clearly marked when no air forecast is available.

## Mention the Gen AI services utilized and where

Cloudflare Workers AI runs the @cf/google/gemma-4-26b-a4b-it model in the Worker endpoint POST /api/ask. It uses current Open-Meteo forecast facts, deterministic plan results, user context, and recent chat to answer follow-up questions about outings, indoor alternatives, and lower-emission choices. The forecast comparison itself is deterministic; AI is restricted from inventing numeric exposure or health claims.

## Final checklist

- Public repository: **yes**
- Single branch: **main**
- Source tracked in Git: **about 288 KB** before this document; dependencies and build output are ignored
- Build, formatting check, and 13 automated tests: **passed**
- Demo video: **35-second MP4 attached to a GitHub release**, outside the source repository
- Form submissions used by this preparation: **zero**
