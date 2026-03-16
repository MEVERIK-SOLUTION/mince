# 🪙 Mince – Numismatický katalog

> **© 2025 Meverik Studio®. Všechna práva vyhrazena.**

Webová aplikace pro evidenci a správu numismatické sbírky mincí.

## ✨ Funkce

- 📋 **Katalog mincí** – přehledný seznam s filtrováním a vyhledáváním
- ➕ **Přidávání mincí** – podrobný formulář s validací
- 📸 **Fotogalerie** – nahrávání a správa fotografií mincí
- 📊 **Dashboard** – statistiky sbírky (počet, hodnota, zastoupení zemí)
- 📁 **Kolekce** – organizace mincí do vlastních kolekcí
- 🌐 **Cloud databáze** – Supabase (PostgreSQL) pro sdílení sbírky
- 🎨 **Dark UI** – prémiové tmavé glassmorphism rozhraní ve zlaté a fialové barvě

## 📁 Struktura projektu

```
mince/
├── .github/
│   └── workflows/
│       ├── deploy.yml              # CI/CD – lint, build, deploy na Vercel
│       ├── setup.yml               # Jednorázový setup Supabase + Vercel env vars
│       └── manual-deploy.yml       # Manuální redeploy
│
├── frontend/                       # ← AKTIVNÍ ZDROJOVÝ KÓD (React + Vite + TypeScript)
│   ├── src/
│   │   ├── main.tsx                # Entry point + MUI dark téma
│   │   ├── App.tsx                 # Root layout, tmavý sidebar
│   │   ├── lib/supabase.ts         # Supabase klient
│   │   ├── services/               # Databázové operace
│   │   ├── pages/                  # Stránky aplikace
│   │   ├── components/             # Sdílené komponenty
│   │   └── types/                  # TypeScript typy
│   ├── .env.example                # Příklad proměnných prostředí
│   └── package.json
│
├── supabase/
│   ├── config.toml                  # Supabase CLI konfigurace
│   └── migrations/
│       └── 001_initial_schema.sql   # Databázové schéma
│
├── docs/                            # Referenční dokumentace a poznámky
├── _archive/                        # Starší vývojové iterace (read-only)
│
├── AGENT_HANDOFF.md                 # Protokol pro předání VS Code agentovi
├── .cursorrules                     # Instrukce pro AI agenty (Cursor, Copilot)
├── vercel.json                      # Konfigurace Vercel (root)
└── README.md
```

## 🚀 Rychlý start – Deploy na Vercel + Supabase

> **Projekt je již napojen** – Vercel projekt `prj_L3L3snANzop6ea36cGlhq0ZcF0MP` je připojen k tomuto repozitáři.
> Supabase projekt `yjzsvyksjjrkupgxueua` je vytvořen.

### Jednorázové nastavení

#### Krok 1 – Nastavte GitHub secrets

| Secret | Popis |
|--------|-------|
| `VERCEL_TOKEN` | Vercel přístupový token |
| `SUPABASE_ACCESS_TOKEN` | Supabase Management API klíč |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public JWT klíč |

#### Krok 2 – Spusťte setup workflow

**GitHub → Actions → 🔧 One-time Setup → Run workflow**

Workflow automaticky:
- ✅ Spustí databázovou migraci
- ✅ Nastaví env vars v Vercel projektu
- ✅ Spustí produkční redeploy

#### Krok 3 – Hotovo!

Aplikace: **https://mince-git-main-meveriks-projects.vercel.app**

---

### Lokální vývoj

```bash
cd frontend
npm install
cp .env.example .env
# Doplňte Supabase klíče do .env
npm run dev
```

## 🛠 Technologický stack

| Vrstva | Technologie |
|--------|-------------|
| Frontend | React 18 + TypeScript + Vite 5 |
| UI | Material UI (MUI) v5, dark glassmorphism |
| Stavový management | TanStack React Query v5 |
| Formuláře | React Hook Form v7 |
| Databáze | Supabase (PostgreSQL) |
| Úložiště souborů | Supabase Storage |
| Deployment | Vercel |

## 🤖 Pro AI agenty

Viz **[AGENT_HANDOFF.md](./AGENT_HANDOFF.md)** pro kompletní předávací protokol včetně:
- Tech stacku a struktura souborů
- Cloud services (Supabase + Vercel) s IDs a URLs
- Schématu databáze
- Stavu implementace
- Doporučených dalších kroků
- MCP integrací pro VS Code

---

*© 2025 Meverik Studio®*
