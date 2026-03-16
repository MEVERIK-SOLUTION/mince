
# Návrh databázové architektury pro evidenci mincí

## 1. DOPORUČENÝ FORMÁT DATABÁZE

### 1.1 Primární volba: **PostgreSQL + JSON**
**Důvody:**
- Flexibilita pro různé typy mincí (antické, moderní, pamětní)
- JSON podpora pro metadata a variabilní vlastnosti
- Výkonné fulltextové vyhledávání
- Podpora pro geografické dotazy (země původu)
- Škálovatelnost pro růst nad 300 mincí

### 1.2 Alternativní řešení podle velikosti:
- **Malé kolekce (do 1000 mincí)**: SQLite + JSON
- **Střední kolekce (1000-10000)**: PostgreSQL
- **Velké kolekce (10000+)**: PostgreSQL + Redis cache

## 2. DATABÁZOVÉ SCHÉMA

### 2.1 Hlavní tabulky

```sql
-- Základní informace o mincích
CREATE TABLE coins (
    id SERIAL PRIMARY KEY,
    catalog_id VARCHAR(50) UNIQUE, -- např. "CZ-1993-10CZK-001"
    name VARCHAR(200) NOT NULL,
    country VARCHAR(100) NOT NULL,
    year_minted INTEGER,
    year_range VARCHAR(20), -- pro rozsahy typu "1993-1995"
    denomination DECIMAL(10,2),
    currency VARCHAR(10),
    
    -- Fyzické vlastnosti
    material VARCHAR(100), -- "stříbro 925", "bronz", "bimetalická"
    weight_grams DECIMAL(8,3),
    diameter_mm DECIMAL(6,2),
    thickness_mm DECIMAL(5,2),
    edge_type VARCHAR(50), -- "hladký", "rýhovaný", "nápis"
    
    -- Kategorizace
    coin_type VARCHAR(50), -- "oběžná", "pamětní", "investiční", "antická"
    series VARCHAR(100), -- "Hrady", "Osobnosti", "Olympiáda"
    rarity_level INTEGER, -- 1-10 škála vzácnosti
    
    -- Metadata jako JSON
    metadata JSONB, -- flexibilní data specifická pro typ mince
    
    -- Audit
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Obrázky mincí
CREATE TABLE coin_images (
    id SERIAL PRIMARY KEY,
    coin_id INTEGER REFERENCES coins(id) ON DELETE CASCADE,
    image_type VARCHAR(20), -- "obverse", "reverse", "edge", "detail"
    file_path VARCHAR(500),
    file_size INTEGER,
    width INTEGER,
    height INTEGER,
    is_primary BOOLEAN DEFAULT FALSE,
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Uživatelské kolekce
CREATE TABLE user_collections (
    id SERIAL PRIMARY KEY,
    coin_id INTEGER REFERENCES coins(id),
    user_id INTEGER, -- pokud bude multi-user
    
    -- Stav konkrétního exempláře
    condition_grade VARCHAR(20), -- "UNC", "XF", "VF", "F", "VG"
    condition_notes TEXT,
    acquisition_date DATE,
    acquisition_price DECIMAL(10,2),
    acquisition_source VARCHAR(100), -- "aukce", "obchod", "dědictví"
    
    -- Aktuální hodnota
    current_estimated_value DECIMAL(10,2),
    last_valuation_date DATE,
    valuation_source VARCHAR(100),
    
    -- Lokace a poznámky
    storage_location VARCHAR(100),
    insurance_value DECIMAL(10,2),
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Cenové historie z různých zdrojů
CREATE TABLE price_history (
    id SERIAL PRIMARY KEY,
    coin_id INTEGER REFERENCES coins(id),
    price DECIMAL(10,2),
    currency VARCHAR(10),
    condition_grade VARCHAR(20),
    source VARCHAR(100), -- "numista", "aukce_aurea", "pcgs"
    source_url VARCHAR(500),
    recorded_date DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Aukční výsledky
CREATE TABLE auction_results (
    id SERIAL PRIMARY KEY,
    coin_id INTEGER REFERENCES coins(id),
    auction_house VARCHAR(100),
    auction_date DATE,
    lot_number VARCHAR(50),
    hammer_price DECIMAL(10,2),
    estimate_low DECIMAL(10,2),
    estimate_high DECIMAL(10,2),
    condition_grade VARCHAR(20),
    description TEXT,
    source_url VARCHAR(500)
);
```

### 2.2 Indexy pro výkon

```sql
-- Fulltextové vyhledávání
CREATE INDEX idx_coins_search ON coins USING gin(to_tsvector('czech', name || ' ' || country));

-- Časté dotazy
CREATE INDEX idx_coins_country_year ON coins(country, year_minted);
CREATE INDEX idx_coins_type_series ON coins(coin_type, series);
CREATE INDEX idx_coins_material ON coins(material);
CREATE INDEX idx_user_collections_coin ON user_collections(coin_id);
CREATE INDEX idx_price_history_coin_date ON price_history(coin_id, recorded_date DESC);

-- JSON dotazy
CREATE INDEX idx_coins_metadata ON coins USING gin(metadata);
```

## 3. JSON METADATA STRUKTURA

### 3.1 Příklady metadata pro různé typy mincí

```json
// Pamětní mince
{
  "commemorative": {
    "occasion": "100. výročí narození T.G. Masaryka",
    "designer": "Jiří Harcuba",
    "mintage": 15000,
    "mint_mark": "b",
    "certificate_number": "A12345"
  },
  "technical": {
    "magnetic": false,
    "alloy_composition": "Ag 925, Cu 75",
    "edge_inscription": "ČESKÁ REPUBLIKA"
  }
}

// Antická mince
{
  "ancient": {
    "dynasty": "Římská říše",
    "ruler": "Marcus Aurelius",
    "mint_city": "Roma",
    "reference_catalog": "RIC III 234",
    "obverse_legend": "M ANTONINVS AVG TR P XXX",
    "reverse_legend": "SALVTI AVGVSTOR"
  }
}

// Moderní oběžná mince
{
  "circulation": {
    "mintage": 50000000,
    "mint_facility": "Česká mincovna",
    "varieties": ["normální", "proof"],
    "errors_known": ["dvojitý ráz", "posunutý střed"]
  }
}
```

## 4. VÝHODY NAVRŽENÉHO ŘEŠENÍ

### 4.1 Flexibilita
- JSON metadata umožňují ukládání specifických dat pro každý typ mince
- Snadné přidávání nových vlastností bez změny schématu
- Podpora různých katalogizačních systémů

### 4.2 Výkon
- Optimalizované indexy pro časté dotazy
- Fulltextové vyhledávání v češtině
- Efektivní ukládání obrázků s referencemi

### 4.3 Škálovatelnost
- Připraveno na růst kolekce
- Možnost rozšíření o více uživatelů
- Integrace s externími API

### 4.4 Praktičnost
- Sledování hodnoty investice
- Historie cen z různých zdrojů
- Správa fyzické lokace mincí
- Pojistné ocenění
