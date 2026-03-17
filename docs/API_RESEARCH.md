# 🔍 Průzkum Free API pro aplikaci Mince

> Zpracováno: červenec 2025  
> Účel: Přehled vhodných bezplatných API pro integraci do numismatické aplikace

---

## 📊 Souhrnná tabulka

| API | Kategorie | Free tier | Klíč nutný | Nejlepší pro |
|-----|-----------|-----------|------------|--------------|
| **Numista** | Numismatika | 2 000 req/měs | ✅ | Katalog mincí, ceny, identifikace |
| **CoinGecko** | Krypto/Kovy | 10k credits/měs | ✅ (demo) | Ceny zlata (tether-gold proxy) |
| **GoldAPI.io** | Drahé kovy | 100 req/měs | ✅ | Přesné spot ceny XAU/XAG/XPT/XPD |
| **MetalpriceAPI** | Kovy + FX | Free tier | ✅ | Kovy + měny v jednom API |
| **Frankfurter** | Měnové kurzy | Bez limitu | ❌ | EUR/CZK, historické kurzy |
| **ExchangeRate-API** | Měnové kurzy | Bez limitu (open) | ❌ | Záloha pro FX konverze |
| **OpenExchangeRates** | Měnové kurzy | 1 000 req/měs | ✅ | 170+ měn, USD base |

---

## 1. 🪙 Numismatické API

### ⭐ Numista API v3 (DOPORUČENO)
- **URL**: `https://api.numista.com/v3`
- **Dokumentace**: https://en.numista.com/api/doc/index.php
- **Free tier**: 2 000 požadavků/měsíc (bez kreditní karty)
- **Autentizace**: API klíč v hlavičce `Numista-API-Key`

**Dostupné endpointy (free):**

| Endpoint | Metoda | Popis |
|----------|--------|-------|
| `/types` | GET | Vyhledávání v katalogu (mince, bankovky, exonumie) |
| `/types/{id}` | GET | Detail typu – materiál, hmotnost, rozměry, obrázky |
| `/types/{id}/issues` | GET | Ročníky, mincovny, náklady ražby |
| `/types/{id}/issues/{id}/prices` | GET | Odhadní ceny podle stupně zachovalosti (G–UNC) |
| `/issuers` | GET | Seznam zemí/území (4 239 vydavatelů) |
| `/mints` | GET | Seznam mincoven (4 035) |
| `/catalogues` | GET | Referenční katalogy (1 268) |
| `/search_by_image` | POST | Identifikace mince z fotky (**PLACENÉ** – €0.03/req) |
| `/users/{id}/collected_items` | GET/POST | Správa sbírky (vyžaduje OAuth) |

**Datový model odpovědi `/types/{id}`:**
```
title, issuer, min_year, max_year, value, ruler,
composition (materiál), weight, size, thickness,
obverse (popis + obrázek), reverse (popis + obrázek),
edge, mints, series, references, tags
```

**Využití v naší aplikaci:**
- Auto-fill dat při přidávání nové mince (název, rok, materiál, hmotnost, obrázky)
- Cenotvorba podle gradu (VG/F/VF/XF/AU/UNC) pro valuaci sbírky
- Propojení s Numista ID pro cross-referenci
- Vyhledávání podle země, roku, materiálu, katalogu

**Omezení:**
- Rozpoznávání z obrázku je placené (min. €100/měsíc)
- Jazyky pouze EN/ES/FR (ne CZ)
- 2 000 req/měs stačí na ~65 vyhledávání denně

---

## 2. 💰 API pro drahé kovy

### ⭐ GoldAPI.io
- **URL**: `https://www.goldapi.io/api/{metal}/{currency}`
- **Free tier**: 100 požadavků/měsíc (sandbox)
- **Kovy**: XAU (zlato), XAG (stříbro), XPT (platina), XPD (paladium)
- **Měny**: USD, EUR, CZK a 25+ dalších
- **Data**: ask, bid, price, cena za gram (22K/21K/18K atd.), 24h změna
- **Historická data**: Denní ceny od roku 1968 (LBMA)
- **Interval**: 2 sekundy (real-time)

**Příklad:**
```bash
curl -X GET 'https://www.goldapi.io/api/XAU/CZK' \
     -H 'x-access-token: YOUR_KEY'
```

**Využití**: Nahradit naši současnou CoinGecko ratio-based derivaci přesnými spot cenami.

**Omezení**: 100 req/měsíc = cca 3/den. Nutné agresivní cachování (1× denně stačí).

---

### MetalpriceAPI
- **URL**: `https://api.metalpriceapi.com/v1/latest`
- **Free tier**: Ano (registrace bez karty)
- **Kovy**: XAU, XAG, XPT, XPD, XCU (měď), ZNC (zinek) a další
- **Měny**: 150+ světových měn
- **Endpointy**: latest, historical, timeframe, convert, carat rates

**Výhoda**: Kombinuje kovy + forex v jednom API. Podporuje karátové ceny zlata.

---

### Současné řešení (CoinGecko + ratio)
- **Funguje**: ✅ V produkci na `/api/metals`
- **Přesnost**: Průměrná (poměrové derivace z ceny zlata)
- **Spolehlivost**: Závisí na dostupnosti CoinGecko free API
- **Doporučení**: Ponechat jako fallback, přidat GoldAPI jako primární zdroj

---

## 3. 💱 API pro měnové kurzy

### ⭐ Frankfurter (AKTUÁLNĚ POUŽÍVÁME)
- **URL**: `https://api.frankfurter.dev/v1/latest`
- **Free tier**: **Bez limitu**, bez API klíče
- **Zdroj**: Evropská centrální banka (ECB)
- **Aktualizace**: Denně kolem 16:00 CET
- **Měny**: EUR base + 30+ měn včetně CZK, USD, GBP
- **Historická data**: Od roku 1999
- **Time series**: `GET /v1/2024-01-01..2024-12-31?symbols=CZK`
- **Self-hosting**: Docker image k dispozici

**Status**: ✅ Již integrováno v `/api/metals` pro EUR→CZK konverzi.

**Nové možnosti**:
- Historické grafy vývoje CZK/EUR, CZK/USD
- Měnový widget na Dashboard

---

### ExchangeRate-API (Open Access)
- **URL**: `https://open.er-api.com/v6/latest/USD`
- **Free tier**: **Bez limitu**, bez API klíče (s atribucí)
- **Aktualizace**: 1× denně
- **Měny**: 150+ včetně CZK

**Využití**: Záložní zdroj kdyby Frankfurter selhal.

---

### OpenExchangeRates
- **URL**: `https://openexchangerates.org/api/latest.json`
- **Free tier**: 1 000 req/měs, vyžaduje API klíč
- **Měny**: 170+
- **Omezení**: USD jako base v free plánu

---

## 4. 🖼️ Rozpoznávání mincí z obrázků

### Numista Search by Image (placené)
- **Endpoint**: `POST /search_by_image`
- **Cena**: €100 aktivační poplatek + €0.03/požadavek + min. €100/měsíc
- **Funkce**: Identifikace typu mince z fotky (líc/rub), experimentální určení roku a gradu
- **Formát**: Base64 JPEG/PNG, max 1024×1024 px

**Verdikt**: Pro hobby projekt příliš drahé. Vhodné pro komerční nasazení.

### Alternativy (zdarma)
- **Google Cloud Vision AI**: 1 000 req/měs zdarma – obecné rozpoznávání objektů, OCR textu na mincích
- **OpenAI Vision (GPT-4o)**: Dá se použít s vlastním API klíčem pro identifikaci mince z fotky – ne dedikované API, ale funguje překvapivě dobře

---

## 5. 📈 Historická cenová data

### Numista Prices Endpoint
- `GET /types/{id}/issues/{issue_id}/prices?currency=CZK`
- Vrací odhady cen podle stupně zachovalosti
- **Zdarma** v rámci 2 000 req/měs kvóty

### GoldAPI Historical
- `GET /api/XAU/USD/20230617` (LBMA denní ceny od 1968)
- V sandbox plánu omezeno na 100 req/měs

### Frankfurter Time Series
- `GET /v1/2020-01-01..2024-12-31?symbols=CZK`
- **Bez limitu** – ideální pro graf vývoje kurzu CZK/EUR

---

## 🎯 Doporučený plán integrace

### Fáze 1 – Okamžitě (bez nákladů)
1. **Numista API** – Registrace na https://en.numista.com/api/, získání API klíče
   - Integrace vyhledávání katalogu pro nové mince
   - Auto-fill údajů (materiál, hmotnost, rozměry, obrázky)
   - Cenové odhady pro valuaci sbírky
2. **Frankfurter Time Series** – Historický graf CZK/EUR na Dashboard

### Fáze 2 – Vylepšení (minimální náklady)
3. **GoldAPI.io** – Přesné spot ceny kovů (100 req/měs stačí s cachováním 1×/den)
4. **ExchangeRate-API** – Fallback pro měnové kurzy

### Fáze 3 – Pokročilé (volitelné)
5. **OpenAI Vision** – Identifikace mince z fotky (vyžaduje OpenAI API klíč)
6. **Numista OAuth** – Synchronizace sbírky s Numista profilem

---

## 🔑 Přehled API klíčů k získání

| Služba | Registrace | Cena | Priorita |
|--------|-----------|------|----------|
| Numista | https://en.numista.com/api/ | Zdarma | ⭐ Vysoká |
| GoldAPI.io | https://www.goldapi.io/dashboard | Zdarma | ⭐ Střední |
| MetalpriceAPI | https://metalpriceapi.com/register | Zdarma | Nízká |
| OpenExchangeRates | https://openexchangerates.org/signup/free | Zdarma | Nízká |

**Frankfurter a ExchangeRate-API (open) nevyžadují registraci.**

---

## ⚠️ Důležité poznámky

1. **Rate limiting**: Vždy implementovat server-side cache (Vercel edge function + in-memory TTL)
2. **Fallback strategie**: Každý API zdroj by měl mít fallback na cached/hardcoded data
3. **API klíče**: Ukládat jako Vercel Environment Variables, nikdy do Git repozitáře
4. **Atribuce**: ExchangeRate-API (open) vyžaduje odkaz v patičce
5. **CORS**: Numista a GoldAPI volat přes náš Vercel serverless proxy (ne přímo z frontendu)
