# 🪙 Coin Collection Manager

[![Build Status](https://github.com/your-username/coin-collection-app/workflows/CI/badge.svg)](https://github.com/your-username/coin-collection-app/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/your-username/coin-collection-app/releases)

Profesionální aplikace pro správu sbírek mincí s pokročilými funkcemi včetně AI rozpoznávání, offline podpory a komplexních analýz.

## ✨ Klíčové funkce

- 📱 **Progressive Web App (PWA)** - Funguje offline, lze nainstalovat na mobil
- 🤖 **AI rozpoznávání mincí** - Automatické rozpoznání z fotografií
- 💰 **Sledování hodnoty** - Aktuální tržní ceny a trendy
- 🔄 **Real-time synchronizace** - Data se synchronizují napříč zařízeními
- 🤝 **Sdílení kolekcí** - Sdílejte s přáteli a komunitou
- 📊 **Pokročilé analýzy** - Detailní statistiky a reporty
- 🔒 **Bezpečnost** - Šifrování dat a pravidelné zálohy
- 🌍 **Vícejazyčnost** - Čeština, angličtina, němčina a další

## 🚀 Demo

**Live Demo**: [https://coin-collection-demo.vercel.app](https://coin-collection-demo.vercel.app)

**Test účet**:
- Email: `demo@example.com`
- Heslo: `DemoPassword123!`

## 📱 Screenshoty

<div align="center">
  <img src="docs/images/dashboard.png" alt="Dashboard" width="300"/>
  <img src="docs/images/mobile-capture.png" alt="Mobile Capture" width="300"/>
  <img src="docs/images/analytics.png" alt="Analytics" width="300"/>
</div>

## 🛠️ Technologie

### Frontend
- **React 18** s TypeScript
- **Next.js 14** (App Router)
- **Material-UI (MUI) v5**
- **PWA** s Service Workers
- **IndexedDB** pro offline úložiště

### Backend
- **Node.js** s Express
- **TypeScript**
- **JWT** autentifikace
- **Multer** pro upload souborů
- **Bull** pro background jobs

### Databáze & Infrastruktura
- **PostgreSQL** (Supabase)
- **Row Level Security (RLS)**
- **Real-time subscriptions**
- **Vercel** hosting
- **GitHub Actions** CI/CD

## 📋 Požadavky

- Node.js 18+
- npm nebo yarn
- PostgreSQL (nebo Supabase účet)
- Git

## ⚡ Rychlý start

### 1. Klonování repozitáře

```bash
git clone https://github.com/your-username/coin-collection-app.git
cd coin-collection-app
```

### 2. Instalace závislostí

```bash
# Root dependencies
npm install

# Frontend dependencies
cd frontend && npm install

# Backend dependencies
cd ../backend && npm install

# Návrat do root
cd ..
```

### 3. Nastavení prostředí

```bash
# Kopírování environment souborů
cp .env.example .env.local
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env

# Upravte soubory s vašimi hodnotami
```

### 4. Databáze setup

```bash
# Instalace Supabase CLI
npm install -g @supabase/cli

# Spuštění lokální Supabase (volitelné)
supabase start

# Nebo připojení k remote Supabase
supabase link --project-ref your-project-ref

# Spuštění migrací
supabase db push
```

### 5. Spuštění aplikace

```bash
# Terminal 1: Frontend (http://localhost:3000)
cd frontend && npm run dev

# Terminal 2: Backend (http://localhost:3001)
cd backend && npm run dev
```

## 📚 Dokumentace

- 📖 **[Uživatelský manuál](docs/USER_MANUAL.md)** - Kompletní průvodce pro uživatele
- 🔧 **[Developer Guide](docs/DEVELOPER_GUIDE.md)** - Technická dokumentace pro vývojáře
- 🚀 **[Deployment Guide](docs/DEPLOYMENT_GUIDE.md)** - Návod pro nasazení do produkce
- 📡 **[API Documentation](docs/API_DOCUMENTATION.md)** - Kompletní API reference

## 🏗️ Architektura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (Next.js)     │◄──►│   (Express)     │◄──►│   (Supabase)    │
│   - React       │    │   - REST API    │    │   - PostgreSQL  │
│   - PWA         │    │   - Auth        │    │   - RLS         │
│   - Offline     │    │   - File Upload │    │   - Real-time   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         │              │   File Storage  │              │
         └──────────────│   (Supabase)    │──────────────┘
                        │   - Images      │
                        │   - Backups     │
                        └─────────────────┘
```

## 🧪 Testování

```bash
# Unit testy
npm run test

# Integration testy
npm run test:integration

# E2E testy
npm run test:e2e

# Coverage report
npm run test:coverage
```

## 📦 Build & Deploy

### Lokální build

```bash
# Frontend build
cd frontend && npm run build

# Backend build
cd backend && npm run build
```

### Deployment na Vercel

```bash
# Instalace Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

Více informací v [Deployment Guide](docs/DEPLOYMENT_GUIDE.md).

## 🔧 Konfigurace

### Environment Variables

**Frontend (.env.local)**:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-key
```

**Backend (.env)**:
```env
DATABASE_URL=your-database-url
JWT_SECRET=your-jwt-secret
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Kompletní seznam v [.env.example](.env.example).

## 📱 PWA Funkce

- ✅ Offline funkcionalita
- ✅ Instalace na domovskou obrazovku
- ✅ Push notifikace
- ✅ Background synchronizace
- ✅ Automatické aktualizace

## 🔒 Bezpečnost

- 🛡️ JWT autentifikace
- 🔐 Row Level Security (RLS)
- 🚫 Rate limiting
- 🔒 Input sanitizace
- 📝 Audit logging
- 🔑 2FA podpora

## 🌍 Lokalizace

Podporované jazyky:
- 🇨🇿 Čeština
- 🇺🇸 Angličtina
- 🇩🇪 Němčina
- 🇫🇷 Francouzština
- 🇪🇸 Španělština

## 🤝 Přispívání

Vítáme příspěvky! Prosím přečtěte si [CONTRIBUTING.md](CONTRIBUTING.md) pro detaily.

### Vývojový workflow

1. Fork repozitáře
2. Vytvořte feature branch (`git checkout -b feature/amazing-feature`)
3. Commit změny (`git commit -m 'Add amazing feature'`)
4. Push do branch (`git push origin feature/amazing-feature`)
5. Otevřete Pull Request

### Code Style

```bash
# Formátování kódu
npm run format

# Linting
npm run lint

# Type checking
npm run type-check
```

## 📊 Monitoring & Analytics

- 📈 **Sentry** - Error tracking
- 📊 **Google Analytics** - Usage analytics
- 🔍 **Lighthouse** - Performance monitoring
- 📱 **Real User Monitoring** - Core Web Vitals

## 🆘 Podpora

### Dokumentace
- 📖 [User Manual](docs/USER_MANUAL.md)
- 🔧 [Developer Guide](docs/DEVELOPER_GUIDE.md)
- ❓ [FAQ](docs/FAQ.md)

### Komunita
- 💬 [GitHub Discussions](https://github.com/your-username/coin-collection-app/discussions)
- 🎮 [Discord Server](https://discord.gg/your-server)
- 📧 Email: support@your-domain.com

### Bug Reports
Našli jste chybu? [Vytvořte issue](https://github.com/your-username/coin-collection-app/issues/new/choose).

## 📄 Licence

Tento projekt je licencován pod MIT licencí - viz [LICENSE](LICENSE) soubor pro detaily.

## 🙏 Poděkování

- [Supabase](https://supabase.com) za skvělou databázovou platformu
- [Vercel](https://vercel.com) za hosting a deployment
- [Material-UI](https://mui.com) za UI komponenty
- [React](https://reactjs.org) za frontend framework
- Všem přispěvatelům a beta testerům

## 📈 Roadmap

### v1.1.0 (Q2 2024)
- [ ] Marketplace pro nákup/prodej mincí
- [ ] Pokročilé AI rozpoznávání
- [ ] Mobilní aplikace (React Native)
- [ ] Integrace s aukčními weby

### v1.2.0 (Q3 2024)
- [ ] Blockchain certifikace
- [ ] NFT podpora
- [ ] Rozšířené API
- [ ] White-label řešení

### v2.0.0 (Q4 2024)
- [ ] Multi-tenant architektura
- [ ] Enterprise funkce
- [ ] Advanced analytics
- [ ] Machine learning doporučení

## 📊 Statistiky

![GitHub stars](https://img.shields.io/github/stars/your-username/coin-collection-app?style=social)
![GitHub forks](https://img.shields.io/github/forks/your-username/coin-collection-app?style=social)
![GitHub issues](https://img.shields.io/github/issues/your-username/coin-collection-app)
![GitHub pull requests](https://img.shields.io/github/issues-pr/your-username/coin-collection-app)

---

<div align="center">
  <p>Vytvořeno s ❤️ pro komunitu sběratelů mincí</p>
  <p>
    <a href="https://your-domain.com">Website</a> •
    <a href="https://github.com/your-username/coin-collection-app/discussions">Discussions</a> •
    <a href="https://discord.gg/your-server">Discord</a> •
    <a href="mailto:support@your-domain.com">Email</a>
  </p>
</div>