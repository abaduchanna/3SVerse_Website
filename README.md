# 3S Verse

**Software, systems & operations.** 3S Verse designs and builds apps, websites, AI agents, dashboards, and process automation that cut the manual work and keep your operation moving — backed by 12+ years of real operations experience.

**Live:** [3sverse.com](https://3sverse.com)

## Products

| Product | What it does | Where |
| --- | --- | --- |
| **SignalScout** | Lead scouting for wireless retailers — multi-store sweeps, org-API alternative, Excel export, challenge-resume flow | [SignalScout](https://github.com/abaduchanna/SignalScout) |
| **3SVerse WiFi Transfer** | Fast phone ↔ PC file transfer over local Wi-Fi — no cables, no cloud | [3SVerse_WiFi_Transfer](https://github.com/abaduchanna/3SVerse_WiFi_Transfer) |
| **License Studio** | License / product / pricing management for the 3S Verse store (Lemon Squeezy powered) | [3SVerse_License_Studio](https://github.com/abaduchanna/3SVerse_License_Studio) |
| **MangoDisk** | Large-file transfer app for Android — simple, resumable, local | [app-repos/MangoDisk](https://github.com/abaduchanna) |
| **NetSpeedMeter** | Network speed display embedded in the Windows 10/11 taskbar (SetParent technique, TrafficMonitor-style) | [NetSpeedMeter](https://github.com/abaduchanna/NetSpeedMeter) |
| **Facebook Group Poster / Live Poster** | Scheduled posting + live announcements across Facebook groups | [FB_Live_Group_Poster](https://github.com/abaduchanna/FB_Live_Group_Poster) |
| **LinkedIn Poster** | Browser-mode LinkedIn posting automation | [3SVerse_LinkedIn_Poster](https://github.com/abaduchanna/3SVerse_LinkedIn_Poster) |
| **3SVerse Bridge** | Encrypted operator bridge connecting desktops, browser extension relay, and automation agents | [3SVerse_Bridge](https://github.com/abaduchanna/3SVerse_Bridge) |

All shipped binaries live under **Releases** on each repository. The full source map of internal tools and automations (30+ repos) is tracked in [`app-repos/`](./app-repos).

## What's inside

This repository is a pnpm monorepo containing the 3S Verse web presence and its supporting services:

| Path | What it is |
| --- | --- |
| `artifacts/landing-page/` | The 3S Verse marketing site — React 19 + Vite + Tailwind CSS 4 + Framer Motion, with light/dark theme, contact form, and animated sections |
| `artifacts/api-server/` | Express 5 API backing the site's contact form (per-IP rate limiting + honeypot bot protection) |
| `artifacts/mockup-sandbox/` | Vite sandbox for UI mockups and design experiments |
| `app-repos/` | Product + tooling repositories (SignalScout, WiFi Transfer, License Studio, posters, bridge, automation bots) wired in as submodules |
| `lib/api-spec/` | OpenAPI source of truth for the API contract |
| `lib/api-zod/` | Zod schemas generated from the OpenAPI spec (Orval) |
| `lib/api-client-react/` | Typed React query hooks generated from the same spec |
| `lib/db/` | PostgreSQL schema + Drizzle ORM setup |

## Getting started

Requires Node.js 24 and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm --filter @workspace/landing-page run dev     # site on Vite dev server
pnpm --filter @workspace/api-server run dev       # API server on port 5000
```

## Useful commands

```bash
pnpm run typecheck                                 # typecheck across all packages
pnpm run build                                     # typecheck + build everything
pnpm --filter @workspace/api-spec run codegen      # regenerate API hooks + Zod schemas
pnpm --filter @workspace/db run push               # push DB schema changes (dev only)
```

Required environment: `DATABASE_URL` — Postgres connection string (API server + DB tooling).

## Contact

- Email: [Connect@3SVerse.com](mailto:Connect@3SVerse.com)
- Site: [3sverse.com](https://3sverse.com)
