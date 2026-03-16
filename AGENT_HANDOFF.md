# 🤝 Agent Handoff Protocol — Mince Numismatický Katalog

> **Copyright © 2025 Meverik Studio®. All rights reserved.**

This document is the authoritative handoff for AI coding agents (VS Code Copilot, Cursor, etc.) integrating with this repository via Supabase MCP and Vercel MCP.

---

## 📋 Project Summary

**Mince** is a Czech-language web application for cataloguing and managing numismatic coin collections.

| Item | Value |
|------|-------|
| App name | Mince – Numismatický katalog |
| Language | Czech (cs-CZ) |
| Owner | Meverik Studio® |
| Repo | MEVERIK-SOLUTION/mince |
| Live URL | https://mince-git-main-meveriks-projects.vercel.app |

---

## 🗂 Repository Structure

```
mince/                              ← repo root
├── .github/
│   └── workflows/
│       ├── deploy.yml              # CI/CD — lint, build, Vercel deploy on main
│       ├── setup.yml               # One-time Supabase + Vercel env setup
│       └── manual-deploy.yml       # Manual redeploy trigger
│
├── frontend/                       # ← ACTIVE SOURCE — React + Vite + TypeScript
│   ├── src/
│   │   ├── main.tsx                # App entry + MUI theme
│   │   ├── App.tsx                 # Root layout, sidebar navigation
│   │   ├── lib/
│   │   │   └── supabase.ts         # Supabase client (reads VITE_* env vars)
│   │   ├── services/
│   │   │   └── coinService.ts      # All DB ops: coins, images, collections
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx       # Stats overview
│   │   │   ├── CoinList.tsx        # Catalog listing with filters
│   │   │   ├── CoinDetail.tsx      # Single coin view + images
│   │   │   ├── AddCoin.tsx         # Create coin form
│   │   │   ├── EditCoin.tsx        # Edit coin form
│   │   │   └── Collections.tsx     # User collections management
│   │   ├── components/
│   │   │   └── CoinForm.tsx        # Shared coin form component
│   │   └── types/
│   │       └── coin.ts             # TypeScript interfaces + form constants
│   ├── .env.example                # Template for env vars
│   ├── .env.production             # Production env (Supabase URL baked in)
│   ├── package.json
│   └── vite.config.ts
│
├── supabase/
│   ├── config.toml                 # Supabase CLI local dev config
│   └── migrations/
│       └── 001_initial_schema.sql  # Full DB schema — run once in SQL Editor
│
├── docs/                           # Reference docs and architecture notes
├── _archive/                       # Previous development iterations (read-only)
├── vercel.json                     # Vercel root config (points build to ./frontend)
├── README.md                       # Quick-start guide
└── AGENT_HANDOFF.md                # ← This file
```

---

## 🔑 Environment Variables

### Required for local development

Copy `frontend/.env.example` → `frontend/.env` and fill in:

```env
VITE_SUPABASE_URL=https://yjzsvyksjjrkupgxueua.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key-from-supabase-dashboard>
```

### Required as GitHub Secrets

| Secret | Description |
|--------|-------------|
| `VERCEL_TOKEN` | Vercel access token (vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | Vercel team ID (optional — auto-resolved) |
| `SUPABASE_ACCESS_TOKEN` | Supabase Management API token |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public JWT key |

---

## ☁️ Cloud Services

### Supabase (Database + Storage)

| Item | Value |
|------|-------|
| Project ref | `yjzsvyksjjrkupgxueua` |
| URL | `https://yjzsvyksjjrkupgxueua.supabase.co` |
| Dashboard | https://supabase.com/dashboard/project/yjzsvyksjjrkupgxueua |
| Storage bucket | `coin-images` |
| DB access | Via Supabase MCP or SQL Editor |

**Tables:**
- `coins` — main coin catalog (UUID pk, full numismatic metadata)
- `coin_images` — photos linked to coins (Supabase Storage URLs)
- `collections` — user-defined groupings
- `collection_coins` — many-to-many coins↔collections
- `price_history` — value tracking over time

Run `supabase/migrations/001_initial_schema.sql` in the SQL Editor to initialise the schema.

### Vercel (Frontend Hosting)

| Item | Value |
|------|-------|
| Project ID | `prj_L3L3snANzop6ea36cGlhq0ZcF0MP` |
| Team | `meveriks-projects` |
| Build command | `npm run build` (run in `./frontend`) |
| Output dir | `frontend/dist` |
| Live URL | https://mince-git-main-meveriks-projects.vercel.app |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend framework | React 18 + TypeScript |
| Build tool | Vite 5 |
| UI components | Material UI (MUI) v5 |
| State / data fetching | TanStack React Query v5 |
| Forms | React Hook Form v7 |
| Routing | React Router DOM v6 |
| Database client | @supabase/supabase-js v2 |
| File uploads | react-dropzone |
| Database | Supabase (PostgreSQL) |
| File storage | Supabase Storage |
| Hosting | Vercel |
| CI/CD | GitHub Actions |

---

## 💻 Development Commands

```bash
# Install dependencies
cd frontend && npm install

# Start dev server (http://localhost:3000)
npm run dev

# Type-check + build for production
npm run build

# Lint
npm run lint

# Preview production build locally
npm run preview
```

---

## 🎨 UI Design System

The app uses a **dark glassmorphism theme** inspired by premium trading/screener UIs:

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#070b12` | Page background |
| Surface | `#0d1421` | Card / panel base |
| Glass card bg | `rgba(255,255,255,0.04)` | Frosted card fill |
| Border | `rgba(255,255,255,0.08)` | Subtle card border |
| Primary (gold) | `#d4a847` | CTA buttons, highlights |
| Secondary (purple) | `#7c4dff` | Accents, badges |
| Success | `#00c896` | Positive metrics |
| Error | `#ff5370` | Warnings, delete |
| Text primary | `#e8eaf6` | Headings |
| Text secondary | `rgba(232,234,246,0.6)` | Labels, captions |
| Font | Inter, system-ui | All text |

---

## 📌 Current Feature Status

| Feature | Status |
|---------|--------|
| Coin catalog (list, filter, search) | ✅ Working |
| Add / Edit / Delete coins | ✅ Working |
| Photo upload (Supabase Storage) | ✅ Working |
| Collections management | ✅ Working |
| Dashboard statistics | ✅ Working |
| Dark glassmorphism UI | ✅ Implemented |
| Authentication (Supabase Auth) | ⚠️ Not implemented — app is single-user |
| Public/shared collections | ⚠️ Schema ready, UI not finished |
| Price history charts | ⚠️ Schema ready, UI not started |
| Mobile PWA | ⚠️ Not implemented in active frontend |
| Multi-language (i18n) | ⚠️ Not implemented |

---

## 🔜 Recommended Next Steps for Agent

1. **Implement Supabase Auth** — add login/register page, protect routes with `supabase.auth.*`
2. **Price history chart** — use Recharts or Chart.js, query `price_history` table
3. **Collection detail page** — show coins belonging to a collection
4. **Barcode/QR scanning** — integrate a camera component for quick coin lookup
5. **Export (PDF/CSV)** — allow users to export their catalog
6. **Progressive Web App** — add service worker, manifest, offline support
7. **Public sharing** — generate shareable links for public collections

---

## 🔧 MCP Integrations Available in VS Code

The agent has access to:

- **Supabase MCP** — query and manage the database, storage, and auth directly
- **Vercel MCP** — trigger deployments, set env vars, inspect deployment logs
- **GitHub MCP** — inspect and manage this repository

### Supabase MCP Quick Reference

```
supabase.query("SELECT * FROM coins LIMIT 10")
supabase.storage.list("coin-images")
supabase.auth.listUsers()
```

### Vercel MCP Quick Reference

```
vercel.deployments.list({ projectId: "prj_L3L3snANzop6ea36cGlhq0ZcF0MP" })
vercel.env.set({ projectId: "...", key: "VITE_SUPABASE_ANON_KEY", value: "..." })
```

---

## ⚠️ Important Notes

- **Single-tenant**: No auth currently — anyone with the URL can view/edit. Add auth before making the app public.
- **Supabase RLS**: Row-Level Security policies are NOT yet configured. Add them when auth is implemented.
- **Image storage**: Images are stored in the `coin-images` Supabase bucket. Bucket must be created and set to public before uploads work.
- **`_archive/` folder**: Contains old development iterations (run1–run3, beh4–beh7). Do not use — for historical reference only.
- **Currency**: App defaults to CZK but supports multiple currencies.

---

*Meverik Studio® — © 2025. All rights reserved.*
