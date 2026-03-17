# 🏃‍♂️ BĚH 1: ZÁKLADNÍ STRUKTURA A DATABÁZE

## ✅ Co bylo vytvořeno

### 📁 Projektová struktura
- Kompletní adresářová struktura pro backend i frontend
- Docker konfigurace pro snadné spuštění
- Základní dokumentace a README

### 🗄️ Databáze a backend
- **PostgreSQL databázové schéma** s 5 hlavními tabulkami:
  - `coins` - Katalog mincí s flexibilními JSON metadata
  - `coin_images` - Správa fotografií mincí
  - `user_collections` - Uživatelské kolekce
  - `price_history` - Cenové historie
  - `auction_results` - Aukční výsledky

- **FastAPI backend** s kompletními API endpoints:
  - `/api/coins/` - CRUD operace pro mince
  - `/api/images/` - Upload a správa obrázků
  - `/api/collections/` - Správa kolekcí
  - Automatická API dokumentace na `/docs`

- **Pydantic schémata** pro validaci dat
- **Pokročilé funkce**:
  - Fulltextové vyhledávání
  - Filtrování podle různých kritérií
  - Automatické generování catalog_id
  - Image processing s optimalizací
  - Export do CSV

### 🎨 Frontend základy
- **React + TypeScript** aplikace
- **Material-UI** komponenty
- **React Router** pro navigaci
- **React Query** pro API komunikaci
- Základní stránky (Dashboard, Katalog, Kolekce, Přidání mince)

### 📸 Testovací data
- **20 ukázkových mincí** různých typů:
  - České koruny (oběžné i pamětní)
  - Euromince
  - Investiční mince (Silver Eagle, Krugerrand, Maple Leaf)
  - Antické mince (Aureus, Denarius, Tetradrachma)
  - Moderní pamětní mince

- **45+ fotografií mincí** automaticky stažených z internetu
- **5 položek v ukázkové kolekci** s reálnými cenami

## 🚀 Jak spustit

### Rychlé spuštění (Docker)
```bash
cd coin-collection-app
docker-compose up -d
```

### Lokální vývoj
```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
python create_sample_data.py  # Vytvoření testovacích dat
python run_dev.py

# Frontend (nový terminál)
cd frontend
npm install
npm run dev
```

## 🌐 Přístupové body

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API dokumentace**: http://localhost:8000/docs
- **Databáze**: localhost:5432 (coin_collection/coin_user/secure_password)

## 🧪 Co testovat

### API Endpoints
```bash
# Seznam mincí
curl http://localhost:8000/api/coins/

# Detail mince
curl http://localhost:8000/api/coins/1

# Statistiky
curl http://localhost:8000/api/coins/stats/summary

# Kolekce
curl http://localhost:8000/api/collections/

# Health check
curl http://localhost:8000/api/health
```

### Webové rozhraní
- Dashboard s přehledem
- Navigace mezi stránkami
- Responsivní design
- Material-UI komponenty

### Databáze
- Připojení přes PostgreSQL klienta
- Prohlížení tabulek a dat
- Testování SQL dotazů

## 📊 Statistiky vytvořených dat

- **📝 20 mincí** v katalogu
- **📸 45+ obrázků** (líc, rub, hrana)
- **📚 5 položek** v ukázkové kolekci
- **🌍 12 zemí** původu
- **💰 4 typy mincí** (oběžné, pamětní, investiční, antické)
- **⏰ Časové rozpětí**: 44 př.n.l. - 2024

## 🔧 Technické detaily

### Backend stack
- **FastAPI** 0.104.1 - Moderní Python web framework
- **SQLAlchemy** 2.0.23 - ORM pro databázi
- **PostgreSQL** 15 - Hlavní databáze
- **Redis** 7 - Cache a session storage
- **Pillow** + **OpenCV** - Zpracování obrázků
- **Pydantic** 2.5.0 - Validace dat

### Frontend stack
- **React** 18.2.0 - UI framework
- **TypeScript** 5.2.2 - Type safety
- **Material-UI** 5.14.18 - UI komponenty
- **React Router** 6.18.0 - Routing
- **React Query** 5.8.4 - API state management
- **Vite** 4.5.0 - Build tool

### Databázové funkce
- **Fulltextové vyhledávání** v češtině
- **JSON metadata** pro flexibilní vlastnosti
- **Automatické indexy** pro výkon
- **Cascade delete** pro konzistenci
- **Audit sloupce** (created_at, updated_at)

## 🎯 Připraveno pro Běh 2

Aplikace je připravena pro implementaci:
- ✅ Kompletní backend API
- ✅ Databázové schéma
- ✅ Testovací data s obrázky
- ✅ Docker prostředí
- ✅ Frontend kostra

**Další kroky (Běh 2)**:
- Upload a správa obrázků ve frontendu
- Kompletní CRUD operace
- Pokročilé vyhledávání
- Responzivní design
- Error handling

## 🐛 Známé limitace

- Frontend obsahuje pouze kostru stránek
- Chybí error handling ve frontendu
- API klíče pro externí služby nejsou nakonfigurovány
- Chybí autentifikace uživatelů
- Obrázky se stahují synchronně (může být pomalé)

## 📝 Poznámky pro vývojáře

- Všechny API endpoints jsou dokumentovány v OpenAPI
- Databázové modely používají SQLAlchemy 2.0 syntax
- Frontend používá Material-UI v5 s emotion
- Obrázky se automaticky optimalizují při uploadu
- Podporováno je fulltextové vyhledávání v češtině