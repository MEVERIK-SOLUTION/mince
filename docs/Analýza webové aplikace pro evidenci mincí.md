
# Analýza webové aplikace pro evidenci mincí

## 1. DOSTUPNÉ ZDROJE DAT A API

### 1.1 Hlavní API služby

#### **Numista API** (⭐ DOPORUČENO)
- **URL**: https://en.numista.com/api/
- **Funkce**: Největší numismatická databáze s kompletními daty
- **Možnosti**:
  - Vyhledávání mincí podle parametrů
  - Identifikace mincí podle obrázku (AI)
  - Cenové informace
  - Správa kolekcí
- **Omezení**: Placené API (ceny na vyžádání)
- **Data**: 500,000+ mincí ze všech zemí a období

#### **PCGS Public API**
- **URL**: https://www.pcgs.com/publicapi
- **Funkce**: Profesionální hodnocení a certifikace mincí
- **Možnosti**:
  - Vyhledávání podle certifikačního čísla
  - Data z CoinFacts databáze
  - Aukční ceny
- **Omezení**: 1,000 volání/den zdarma, vyžaduje registraci
- **Zaměření**: Především americké mince

#### **CoinScanAI API**
- **URL**: https://coinscanai.io/api-documentation
- **Funkce**: AI identifikace mincí z fotografií
- **Možnosti**:
  - Identifikace mince z obrázku
  - Ocenění mincí
  - Marketplace data
- **Omezení**: 100 volání/den zdarma, pak placené plány
- **Výhoda**: Moderní AI technologie

### 1.2 České a evropské zdroje

#### **České aukční domy**:
- **AUREA Numismatika** - https://livebid.cz/
- **Antium Aurum** - https://www.antiumaurum.cz/
- **Pesek Auctions** - https://pesekauctions.com/
- **Katz Auction** - významný český aukční dům

#### **Evropské databáze**:
- **CoinArchives.com** - archiv aukčních výsledků
- **European Numismatics** - katalog evropských mincí
- **Coinstrail.com** - evropské aukční data

### 1.3 Open Source řešení

#### **OpenNumismat**
- **URL**: https://opennumismat.github.io/
- **Typ**: Desktopová aplikace pro správu kolekcí
- **Data**: Dostupné katalogy ke stažení (CSV/XML)
- **Výhoda**: Zdarma, open source

## 2. DOPORUČENÍ PRO ZÍSKÁVÁNÍ DAT

### 2.1 Kombinovaný přístup
1. **Primární API**: Numista API pro základní katalog
2. **Doplňkové API**: CoinScanAI pro identifikaci fotografií
3. **Lokální data**: Scraping českých aukčních domů
4. **Open source**: OpenNumismat katalogy jako základ

### 2.2 Web scraping strategie
- **České aukce**: Pravidelný scraping cen z AUREA, Antium Aurum
- **Evropské aukce**: CoinArchives pro historické ceny
- **Respektování robots.txt** a rate limiting
