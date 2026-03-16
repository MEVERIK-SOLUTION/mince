
# Doporučení pro vývoj a implementaci

## 1. FÁZOVÝ PLÁN VÝVOJE

### 1.1 Fáze 1: MVP (2-3 měsíce)
**Cíl**: Základní funkční aplikace pro 300 mincí

**Funkce**:
- ✅ Manuální přidávání mincí (formulář)
- ✅ Upload a správa fotografií (max 4 na minci)
- ✅ Základní vyhledávání a filtrování
- ✅ Seznam kolekce s karty mincí
- ✅ Detail mince s všemi informacemi
- ✅ Export dat do CSV/Excel
- ✅ Základní statistiky kolekce

**Tech stack**:
- Backend: FastAPI + SQLite (pro jednoduchost)
- Frontend: React + Material-UI
- Úložiště: Lokální filesystem pro obrázky

### 1.2 Fáze 2: Rozšířené funkce (1-2 měsíce)
**Cíl**: AI identifikace a cenové informace

**Nové funkce**:
- 🤖 AI identifikace mincí z fotografií
- 💰 Integrace s cenovými API (Numista, CoinScan)
- 📊 Cenové grafy a historie
- 🔍 Pokročilé vyhledávání (fulltextové)
- 📱 Mobilní optimalizace
- 🔐 Uživatelské účty a autentifikace

**Upgrade tech stacku**:
- Databáze: Migrace na PostgreSQL
- Cache: Redis pro výkon
- AI: TensorFlow.js nebo Python backend

### 1.3 Fáze 3: Profesionální funkce (2-3 měsíce)
**Cíl**: Pokročilá správa a analýzy

**Pokročilé funkce**:
- 📈 Portfolio analýzy a ROI tracking
- 🏛️ Integrace s aukčními domy
- 📋 Pojistné ocenění a reporty
- 🌍 Geografické zobrazení původu mincí
- 📚 Integrace s numismatickými katalogy
- 🔄 Automatické aktualizace cen
- 📊 Pokročilé reporty a dashboardy

## 2. DOPORUČENÉ NÁSTROJE A TECHNOLOGIE

### 2.1 Vývojové prostředí

```bash
# Backend development
Python 3.11+
FastAPI
SQLAlchemy (ORM)
Alembic (migrace)
Pytest (testování)
Black + isort (formátování)
mypy (type checking)

# Frontend development
Node.js 18+
React 18
TypeScript
Material-UI v5
React Query (state management)
React Hook Form (formuláře)
Vite (build tool)

# Database
PostgreSQL 15
Redis 7
pgAdmin (správa DB)

# DevOps
Docker + Docker Compose
Nginx
Let's Encrypt (SSL)
GitHub Actions (CI/CD)
```

### 2.2 Doporučené knihovny

```python
# requirements.txt (Backend)
fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
alembic==1.12.1
psycopg2-binary==2.9.9
redis==5.0.1
python-multipart==0.0.6
pillow==10.1.0
opencv-python==4.8.1.78
tensorflow==2.15.0
httpx==0.25.2
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-dotenv==1.0.0
pytest==7.4.3
pytest-asyncio==0.21.1
```

```json
// package.json (Frontend)
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@mui/material": "^5.14.18",
    "@mui/icons-material": "^5.14.18",
    "@emotion/react": "^11.11.1",
    "@emotion/styled": "^11.11.0",
    "react-router-dom": "^6.18.0",
    "react-query": "^3.39.3",
    "react-hook-form": "^7.47.0",
    "axios": "^1.6.2",
    "react-dropzone": "^14.2.3",
    "chart.js": "^4.4.0",
    "react-chartjs-2": "^5.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.37",
    "@types/react-dom": "^18.2.15",
    "@typescript-eslint/eslint-plugin": "^6.10.0",
    "@vitejs/plugin-react": "^4.1.1",
    "typescript": "^5.2.2",
    "vite": "^4.5.0"
  }
}
```

## 3. STRUKTURA PROJEKTU PRO START

### 3.1 Minimální MVP struktura

```
coin-collection-mvp/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app
│   │   ├── database.py          # SQLite connection
│   │   ├── models.py            # SQLAlchemy models
│   │   ├── schemas.py           # Pydantic schemas
│   │   ├── crud.py              # Database operations
│   │   └── routers/
│   │       ├── __init__.py
│   │       ├── coins.py         # Coin endpoints
│   │       └── images.py        # Image upload
│   ├── uploads/                 # Image storage
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CoinCard.tsx
│   │   │   ├── CoinForm.tsx
│   │   │   ├── CoinList.tsx
│   │   │   └── ImageUpload.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── AddCoin.tsx
│   │   │   └── CoinDetail.tsx
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── types/
│   │   │   └── coin.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
└── README.md
```

### 3.2 Rychlý start kód

```python
# backend/app/main.py
from fastapi import FastAPI, UploadFile, File, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import crud, models, schemas
from database import SessionLocal, engine

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Coin Collection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/api/coins/", response_model=schemas.Coin)
async def create_coin(
    coin: schemas.CoinCreate,
    db: Session = Depends(get_db)
):
    return crud.create_coin(db=db, coin=coin)

@app.get("/api/coins/", response_model=list[schemas.Coin])
def read_coins(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_coins(db, skip=skip, limit=limit)

@app.get("/api/coins/{coin_id}", response_model=schemas.Coin)
def read_coin(coin_id: int, db: Session = Depends(get_db)):
    return crud.get_coin(db, coin_id=coin_id)
```

```typescript
// frontend/src/services/api.ts
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export interface Coin {
  id: number;
  name: string;
  country: string;
  year: number;
  denomination: number;
  currency: string;
  material: string;
  condition: string;
  acquisition_price: number;
  images: string[];
}

export const coinApi = {
  // Získání všech mincí
  getCoins: () => api.get<Coin[]>('/coins/'),
  
  // Získání konkrétní mince
  getCoin: (id: number) => api.get<Coin>(`/coins/${id}`),
  
  // Přidání nové mince
  createCoin: (coinData: FormData) => 
    api.post<Coin>('/coins/', coinData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  
  // Aktualizace mince
  updateCoin: (id: number, coinData: Partial<Coin>) =>
    api.put<Coin>(`/coins/${id}`, coinData),
  
  // Smazání mince
  deleteCoin: (id: number) => api.delete(`/coins/${id}`)
};
```

## 4. DEPLOYMENT STRATEGIE

### 4.1 Lokální development

```bash
# 1. Klonování a setup
git clone <repository>
cd coin-collection-app

# 2. Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# nebo venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 3. Frontend setup (nový terminál)
cd frontend
npm install
npm run dev

# 4. Přístup k aplikaci
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API docs: http://localhost:8000/docs
```

### 4.2 Produkční deployment

```bash
# 1. VPS/Cloud server setup
# Doporučuji: DigitalOcean, Hetzner, nebo AWS EC2

# 2. Docker deployment
git clone <repository>
cd coin-collection-app
cp .env.example .env
# Editace .env s produkčními hodnotami

docker-compose up -d

# 3. SSL certifikát
sudo certbot --nginx -d yourdomain.com

# 4. Backup setup
# Automatické zálohy databáze a obrázků
```

## 5. CENOVÉ ODHADY

### 5.1 Vývoj (freelancer/agentura)
- **MVP (Fáze 1)**: 150,000 - 250,000 CZK
- **Rozšířené funkce (Fáze 2)**: 100,000 - 150,000 CZK  
- **Profesionální funkce (Fáze 3)**: 150,000 - 200,000 CZK
- **Celkem**: 400,000 - 600,000 CZK

### 5.2 Provozní náklady (měsíčně)
- **Hosting (VPS)**: 500 - 1,500 CZK
- **Databáze**: 0 - 500 CZK (PostgreSQL zdarma)
- **API klíče**: 0 - 2,000 CZK (Numista, CoinScan)
- **SSL certifikát**: 0 CZK (Let's Encrypt)
- **Backup storage**: 100 - 300 CZK
- **Celkem**: 600 - 4,300 CZK/měsíc

### 5.3 Alternativa - vlastní vývoj
Pokud máte programátorské zkušenosti:
- **Čas**: 6-12 měsíců (part-time)
- **Náklady**: Pouze provozní (600-4,300 CZK/měsíc)
- **Výhoda**: Plná kontrola a možnost úprav

## 6. DOPORUČENÍ PRO ÚSPĚŠNÝ START

### 6.1 Začněte jednoduše
1. **MVP první** - základní funkcionalita
2. **Testujte s reálnými daty** - 50-100 mincí
3. **Iterativní vývoj** - přidávejte funkce postupně
4. **Uživatelský feedback** - testujte s dalšími sběrateli

### 6.2 Klíčové rozhodnutí
- **Začněte s SQLite** - jednodušší setup
- **Lokální úložiště obrázků** - levnější než cloud
- **Postupná migrace na PostgreSQL** - když překročíte 1000 mincí
- **API integrace až ve fázi 2** - nejdříve ověřte základní funkcionalita

### 6.3 Bezpečnost dat
- **Pravidelné zálohy** - denní backup databáze
- **Verzování** - Git pro kód, snapshoty pro data
- **Testovací prostředí** - nikdy netestujte na produkčních datech
- **Export funkcionalita** - možnost exportu celé kolekce

Tato aplikace má potenciál stát se komplexním nástrojem pro numismatiky. Doporučuji začít s MVP a postupně rozšiřovat podle potřeb a zpětné vazby uživatelů.
