# 🪙 Coin Collection App - Webová aplikace pro evidenci mincí

## 📋 Popis
Komplexní webová aplikace pro sběratele mincí s funkcemi:
- 📝 Evidence mincí s detailními informacemi
- 📸 Správa fotografií (líc, rub, hrana, detail)
- 🤖 AI identifikace mincí z fotografií
- 💰 Sledování hodnoty a cenových trendů
- 📊 Portfolio analýzy a statistiky
- 🔍 Pokročilé vyhledávání a filtrování

## 🚀 Rychlý start

### Požadavky
- Docker a Docker Compose
- Python 3.11+ (pro lokální vývoj)
- Node.js 18+ (pro frontend vývoj)

### Spuštění aplikace
```bash
# 1. Klonování a příprava
git clone <repository>
cd coin-collection-app

# 2. Spuštění pomocí Docker
docker-compose up -d

# 3. Přístup k aplikaci
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API dokumentace: http://localhost:8000/docs
# Databáze: localhost:5432 (coin_collection/coin_user/secure_password)
```

### Lokální vývoj
```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (nový terminál)
cd frontend
npm install
npm run dev
```

## 📁 Struktura projektu
```
coin-collection-app/
├── backend/           # FastAPI backend
├── frontend/          # React frontend
├── docker/           # Docker konfigurace
├── docs/             # Dokumentace
└── docker-compose.yml
```

## 🗄️ Databáze
Aplikace používá PostgreSQL s následujícími hlavními tabulkami:
- `coins` - Katalog mincí
- `coin_images` - Fotografie mincí
- `user_collections` - Uživatelské kolekce
- `price_history` - Cenové historie

## 🔧 Technologie
- **Backend**: FastAPI, SQLAlchemy, PostgreSQL
- **Frontend**: React, TypeScript, Material-UI
- **AI**: TensorFlow, OpenCV, CoinScan API
- **Deployment**: Docker, Nginx

## 📊 Testovací data
Aplikace obsahuje ukázková data s 20 mincemi různých typů:
- České koruny (oběžné i pamětní)
- Evropské euromince
- Historické mince
- Každá mince má 2-4 fotografie

## 🔑 API klíče (pro produkci)
```bash
# .env soubor
NUMISTA_API_KEY=your_numista_key
COINSCAN_API_KEY=your_coinscan_key
```

## 📈 Roadmapa
- [x] Základní CRUD operace
- [x] Upload a správa obrázků
- [ ] AI identifikace mincí
- [ ] Cenové API integrace
- [ ] Pokročilé vyhledávání
- [ ] Portfolio analýzy
- [ ] Mobilní aplikace

## 🤝 Přispívání
1. Fork repository
2. Vytvořte feature branch
3. Commitněte změny
4. Vytvořte Pull Request

## 📄 Licence
MIT License - viz LICENSE soubor