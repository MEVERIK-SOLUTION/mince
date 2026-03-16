# 🪙 Mince – Numismatický katalog

Webová aplikace pro evidenci a správu numismatické sbírky mincí.

## ✨ Funkce

- 📋 **Katalog mincí** – přehledný seznam s filtrováním a vyhledáváním
- ➕ **Přidávání mincí** – podrobný formulář s validací
- 📸 **Fotogalerie** – nahrávání a správa fotografií mincí
- 📊 **Dashboard** – statistiky sbírky (počet, hodnota, zastoupení zemí)
- 📁 **Kolekce** – organizace mincí do vlastních kolekcí
- 🌐 **Cloud databáze** – Supabase (PostgreSQL) pro sdílení sbírky

## 🚀 Rychlý start – Deploy na Vercel + Supabase

> **Projekt je již napojen** – Vercel projekt `prj_L3L3snANzop6ea36cGlhq0ZcF0MP` je připojen k tomuto repozitáři a nasazuje větev `main` automaticky.
> Supabase projekt `yjzsvyksjjrkupgxueua` je vytvořen. Zbývá pouze jednou nastavit 3 GitHub secrets a spustit setup workflow.

### Jednorázové nastavení (5 minut)

#### Krok 1 – Nastavte GitHub secrets

Jděte na **GitHub → Settings → Secrets and variables → Actions → New repository secret** a přidejte:

| Secret | Co to je | Kde to najít |
|--------|----------|--------------|
| `VERCEL_TOKEN` | Vercel přístupový token | [vercel.com/account/tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | Vercel team/user ID *(volitelné – automaticky zjištěno z API)* | Vercel → Settings → General → Team ID |
| `SUPABASE_ACCESS_TOKEN` | Supabase Management API klíč | Supabase → Account → Access tokens |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public JWT klíč | Supabase → Project → Settings → API → `anon public` |

> `VITE_SUPABASE_URL` je veřejná hodnota a je v workflow již nastavena.

#### Krok 2 – Spusťte setup workflow

1. Jděte na **GitHub → Actions → 🔧 One-time Setup (Supabase + Vercel)**
2. Klikněte **Run workflow** → **Run workflow**
3. Workflow automaticky:
   - ✅ Spustí databázovou migraci (vytvoří všechny tabulky)
   - ✅ Vytvoří Storage bucket `coin-images`
   - ✅ Nastaví `VITE_SUPABASE_URL` a `VITE_SUPABASE_ANON_KEY` v Vercel projektu
   - ✅ Spustí produkční redeploy na Vercel

#### Krok 3 – Hotovo!

Aplikace je dostupná na: **https://mince-git-main-meveriks-projects.vercel.app**

---

### Lokální vývoj

```bash
cd frontend
npm install
cp .env.example .env
# Editujte .env a doplňte Supabase klíče
npm run dev
# Aplikace běží na http://localhost:3000
```

### Automatické nasazení (CI/CD)

Workflow `.github/workflows/deploy.yml` se spustí při každém push do `main`:
- **Build & Lint** – ověří kód (běží vždy, i na PR)
- **Deploy** – nasadí na Vercel (jen push do `main`, vyžaduje secret `VERCEL_TOKEN`; `VERCEL_ORG_ID` je volitelný – pokud není nastaven, zjistí se automaticky přes Vercel API)

Vercel také nasazuje automaticky přes GitHub integraci nezávisle na GitHub Actions.

## 📁 Struktura projektu

```
mince/
├── .github/
│   └── workflows/
│       ├── deploy.yml              # CI/CD – lint, build, deploy na Vercel
│       └── setup.yml               # Jednorázový setup Supabase + Vercel env vars
├── frontend/                   # React + Vite + TypeScript aplikace
│   ├── src/
│   │   ├── lib/supabase.ts     # Supabase klient
│   │   ├── services/           # Databázové operace
│   │   ├── pages/              # Stránky aplikace
│   │   ├── components/         # Sdílené komponenty
│   │   └── types/              # TypeScript typy
│   ├── .env.example            # Příklad proměnných prostředí
│   ├── vercel.json             # Konfigurace Vercel
│   └── package.json
│
├── supabase/
│   ├── config.toml                  # Supabase CLI konfigurace (lokální dev)
│   └── migrations/
│       └── 001_initial_schema.sql   # Databázové schéma
│
├── vercel.json                 # Konfigurace Vercel (root)
│
└── (vývojové fáze – Běhy 1–7)
    ├── coin-collection-app-run1/
    ├── coin-collection-app-run2/
    ├── coin-collection-app-run3/
    ├── coin-collection-app-beh4/
    ├── coin-collection-app-beh5/
    ├── fortent-beh6/
    └── backend-beh7/
```

## 🛠 Technologický stack

| Vrstva | Technologie |
|--------|-------------|
| Frontend | React 18 + TypeScript + Vite |
| UI | Material UI (MUI) v5 |
| Stavový management | TanStack React Query |
| Formuláře | React Hook Form |
| Databáze | Supabase (PostgreSQL) |
| Úložiště souborů | Supabase Storage |
| Deployment | Vercel |

## 📖 Databázové tabulky

| Tabulka | Popis |
|---------|-------|
| `coins` | Katalog mincí se všemi detaily |
| `coin_images` | Fotografie přiřazené ke mincím |
| `collections` | Osobní kolekce |
| `collection_coins` | Vazba mince–kolekce |
| `price_history` | Historie cen mince |

## 🔧 Vývoj

```bash
# Instalace závislostí
cd frontend && npm install

# Spuštění dev serveru
npm run dev

# Build pro produkci
npm run build

# Kontrola kódu
npm run lint
```

## 📄 Licence

Projekt vytvořen pro soukromé účely evidence numismatické sbírky.
