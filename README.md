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

> **Automatický deploy** – po nastavení kroků 1–3 se každý push do větve `main` automaticky nasadí na Vercel přes GitHub Actions (`.github/workflows/deploy.yml`).

### 1. Vytvořte Supabase projekt

1. Jděte na [supabase.com](https://supabase.com) a přihlaste se / vytvořte účet
2. Klikněte na **New project** a vyplňte název, heslo databáze a region
3. Po vytvoření projektu otevřete **SQL Editor** a spusťte migraci:
   - Zkopírujte obsah [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql)
   - Vložte do SQL Editoru a klikněte **Run**
4. Vytvořte Storage bucket:
   - Jděte na **Storage → New bucket**
   - Název: `coin-images`, zaškrtněte **Public bucket**
5. Zkopírujte klíče z **Settings → API**:
   - `Project URL`
   - `anon public` klíč

### 2. Deploy na Vercel

#### Metoda A – automaticky přes GitHub Actions (doporučeno)

Workflow `.github/workflows/deploy.yml` automaticky nasadí aplikaci na Vercel při každém push do větve `main`.

**Jednorázové nastavení:**

1. Jděte na [vercel.com](https://vercel.com), přihlaste se a klikněte **New Project** → importujte repozitář `MEVERIK-SOLUTION/mince`
2. **Root Directory**: nastavte na `frontend`, **Framework Preset**: Vite
3. Přidejte **Environment Variables** ve Vercel dashboardu:
   ```
   VITE_SUPABASE_URL      = https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY = your-anon-key-here
   ```
4. Po prvním deploy zjistěte identifikátory projektu:
   ```bash
   cd frontend && vercel link
   cat .vercel/project.json   # vypíše orgId a projectId
   ```
5. V GitHub repozitáři přidejte **Settings → Secrets and variables → Actions**:
   | Secret | Hodnota |
   |--------|---------|
   | `VERCEL_TOKEN` | token z [vercel.com/account/tokens](https://vercel.com/account/tokens) |
   | `VERCEL_ORG_ID` | `orgId` z kroku 4 |
   | `VERCEL_PROJECT_ID` | `projectId` z kroku 4 |
   | `VITE_SUPABASE_URL` | URL vašeho Supabase projektu |
   | `VITE_SUPABASE_ANON_KEY` | anon klíč vašeho Supabase projektu |
6. Push do `main` → workflow spustí lint, build a deploy automaticky 🎉

#### Metoda B – ručně přes Vercel dashboard

1. Jděte na [vercel.com](https://vercel.com) a přihlaste se GitHub účtem
2. Klikněte **New Project** → importujte tento repozitář (`MEVERIK-SOLUTION/mince`)
3. **Root Directory**: nastavte na `frontend`
4. **Framework Preset**: Vite
5. Přidejte **Environment Variables**:
   ```
   VITE_SUPABASE_URL    = https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY = your-anon-key-here
   ```
6. Klikněte **Deploy** 🎉

#### Metoda C – přes Vercel CLI

```bash
cd frontend
npm install
cp .env.example .env
# Editujte .env a doplňte Supabase klíče
vercel --prod
```

### 3. Lokální vývoj

```bash
cd frontend
npm install
cp .env.example .env
# Editujte .env a doplňte Supabase klíče
npm run dev
# Aplikace běží na http://localhost:3000
```

## 📁 Struktura projektu

```
mince/
├── .github/
│   └── workflows/
│       └── deploy.yml              # CI/CD – lint, build, deploy na Vercel
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
