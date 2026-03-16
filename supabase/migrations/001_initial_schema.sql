-- ============================================================
--  Mince – Numismatický katalog  |  Supabase databázová migrace
--  Spusťte v Supabase → SQL Editor
-- ============================================================

-- Rozšíření
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── ODSTRANĚNÍ STARÉHO SCHÉMATU ─────────────────────────────
-- Bezpečně odstraní staré tabulky (z předchozího prototypu),
-- aby bylo možné vytvořit správné schéma.

DROP TABLE IF EXISTS collection_coins CASCADE;
DROP TABLE IF EXISTS price_history CASCADE;
DROP TABLE IF EXISTS coin_images CASCADE;
DROP TABLE IF EXISTS collections CASCADE;
DROP TABLE IF EXISTS coins CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ─── COINS ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coins (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  catalog_id      TEXT UNIQUE,
  name            TEXT NOT NULL,
  country         TEXT NOT NULL,
  year_minted     INTEGER,
  year_range      TEXT,
  denomination    NUMERIC(12, 4),
  currency        TEXT DEFAULT 'CZK',
  material        TEXT,
  weight_grams    NUMERIC(10, 4),
  diameter_mm     NUMERIC(8, 3),
  thickness_mm    NUMERIC(7, 3),
  edge_type       TEXT,
  coin_type       TEXT,
  series          TEXT,
  condition       TEXT,
  rarity_level    SMALLINT CHECK (rarity_level BETWEEN 1 AND 10),
  current_value   NUMERIC(14, 2),
  acquisition_price NUMERIC(14, 2),
  acquisition_date  DATE,
  acquisition_source TEXT,
  storage_location  TEXT,
  description     TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── COIN IMAGES ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coin_images (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coin_id     UUID NOT NULL REFERENCES coins(id) ON DELETE CASCADE,
  image_url   TEXT NOT NULL,
  image_type  TEXT DEFAULT 'obverse' CHECK (image_type IN ('obverse','reverse','edge','detail','other')),
  is_primary  BOOLEAN DEFAULT FALSE,
  order_index INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── COLLECTIONS ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS collections (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  description TEXT,
  is_public   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── COLLECTION COINS ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS collection_coins (
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  coin_id       UUID NOT NULL REFERENCES coins(id) ON DELETE CASCADE,
  added_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (collection_id, coin_id)
);

-- ─── PRICE HISTORY ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS price_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coin_id     UUID NOT NULL REFERENCES coins(id) ON DELETE CASCADE,
  price       NUMERIC(14, 2) NOT NULL,
  currency    TEXT DEFAULT 'CZK',
  source      TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INDEXES ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_coins_country ON coins(country);
CREATE INDEX IF NOT EXISTS idx_coins_year_minted ON coins(year_minted);
CREATE INDEX IF NOT EXISTS idx_coins_coin_type ON coins(coin_type);
CREATE INDEX IF NOT EXISTS idx_coins_material ON coins(material);
CREATE INDEX IF NOT EXISTS idx_coins_name_trgm ON coins USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_coin_images_coin_id ON coin_images(coin_id);
CREATE INDEX IF NOT EXISTS idx_collection_coins_collection_id ON collection_coins(collection_id);
CREATE INDEX IF NOT EXISTS idx_price_history_coin_id ON price_history(coin_id);

-- ─── TRIGGERS – auto updated_at ──────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER coins_updated_at
  BEFORE UPDATE ON coins
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER collections_updated_at
  BEFORE UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────
-- Zapnutí RLS (pro produkci doporučeno nakonfigurovat uživatelské politiky)

ALTER TABLE coins ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_coins ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- Veřejné čtení a zápis pro anon klíč (zjednodušené nastavení pro prototyp)
-- V produkci doporučujeme napojit na Supabase Auth a omezit přístup per-user.

CREATE POLICY "public_read_coins" ON coins FOR SELECT USING (true);
CREATE POLICY "public_insert_coins" ON coins FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_coins" ON coins FOR UPDATE USING (true);
CREATE POLICY "public_delete_coins" ON coins FOR DELETE USING (true);

CREATE POLICY "public_read_coin_images" ON coin_images FOR SELECT USING (true);
CREATE POLICY "public_insert_coin_images" ON coin_images FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_coin_images" ON coin_images FOR UPDATE USING (true);
CREATE POLICY "public_delete_coin_images" ON coin_images FOR DELETE USING (true);

CREATE POLICY "public_read_collections" ON collections FOR SELECT USING (true);
CREATE POLICY "public_insert_collections" ON collections FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_collections" ON collections FOR UPDATE USING (true);
CREATE POLICY "public_delete_collections" ON collections FOR DELETE USING (true);

CREATE POLICY "public_read_collection_coins" ON collection_coins FOR SELECT USING (true);
CREATE POLICY "public_insert_collection_coins" ON collection_coins FOR INSERT WITH CHECK (true);
CREATE POLICY "public_delete_collection_coins" ON collection_coins FOR DELETE USING (true);

CREATE POLICY "public_read_price_history" ON price_history FOR SELECT USING (true);
CREATE POLICY "public_insert_price_history" ON price_history FOR INSERT WITH CHECK (true);

-- ─── STORAGE BUCKET ──────────────────────────────────────────
-- Vytvořte bucket "coin-images" v Supabase → Storage → New bucket
-- Nastavte: Public bucket = true
-- Povolené typy souborů: image/jpeg, image/png, image/webp

-- ─── UKÁZKOVÁ DATA ───────────────────────────────────────────
-- Tyto záznamy slouží pro testování a demonstraci aplikace.
-- V produkčním nasazení je můžete bezpečně smazat.

INSERT INTO coins (name, country, year_minted, coin_type, material, denomination, currency, current_value, weight_grams, diameter_mm, condition, rarity_level, description, acquisition_price, acquisition_date, storage_location)
VALUES
  ('10 Kč ČR', 'Česká republika', 2020, 'oběžná', 'Nerezová ocel', 10, 'CZK', 10, 7.62, 24.5, 'UNC', 1, 'Oběžná mince České republiky v hodnotě 10 Kč.', 10, '2023-01-15', 'Album A'),
  ('20 Kč ČR', 'Česká republika', 2022, 'oběžná', 'Nerezová ocel', 20, 'CZK', 20, 8.43, 26.0, 'UNC', 1, 'Oběžná mince České republiky v hodnotě 20 Kč.', 20, '2023-02-10', 'Album A'),
  ('50 Kč ČR', 'Česká republika', 2019, 'oběžná', 'Nerezová ocel', 50, 'CZK', 50, 9.7, 27.5, 'XF', 1, 'Oběžná mince České republiky v hodnotě 50 Kč.', 50, '2023-03-05', 'Album A'),
  ('1 Kč ČR', 'Česká republika', 1993, 'oběžná', 'Niklová ocel', 1, 'CZK', 25, 3.1, 20.0, 'VF', 3, 'První ročník české korunové mince.', 15, '2022-06-20', 'Album A'),
  ('2 Kč ČR', 'Česká republika', 1993, 'oběžná', 'Niklová ocel', 2, 'CZK', 30, 3.7, 21.5, 'VF', 3, 'První ročník dvoukorunové mince.', 20, '2022-06-20', 'Album A'),
  ('1 oz Silver Eagle', 'USA', 2023, 'investiční', 'Stříbro .999', 1, 'USD', 850, 31.1, 40.6, 'BU', 2, 'Americká stříbrná mince 1 oz .999 Ag.', 750, '2023-05-01', 'Trezor'),
  ('1 oz Maple Leaf', 'Kanada', 2023, 'investiční', 'Stříbro .9999', 5, 'CAD', 820, 31.1, 38.0, 'BU', 2, 'Kanadská stříbrná mince 1 oz .9999 Ag.', 720, '2023-05-15', 'Trezor'),
  ('1 oz Wiener Philharmoniker', 'Rakousko', 2022, 'investiční', 'Stříbro .999', 1.5, 'EUR', 790, 31.1, 37.0, 'BU', 2, 'Rakouská stříbrná mince 1 oz .999 Ag.', 680, '2022-11-20', 'Trezor'),
  ('Pamětní 200 Kč – Josef Božek', 'Česká republika', 2021, 'pamětní', 'Stříbro .925', 200, 'CZK', 650, 13.0, 31.0, 'Proof', 4, 'Pamětní stříbrná mince 200 Kč – 250. výročí narození Josefa Božka.', 450, '2021-09-01', 'Album B'),
  ('Pamětní 200 Kč – Karel Havlíček Borovský', 'Česká republika', 2021, 'pamětní', 'Stříbro .925', 200, 'CZK', 620, 13.0, 31.0, 'Proof', 4, 'Pamětní stříbrná mince 200 Kč k výročí K. H. Borovského.', 430, '2021-11-15', 'Album B'),
  ('Pamětní 500 Kč – Automobil Tatra', 'Česká republika', 2023, 'pamětní', 'Stříbro .925', 500, 'CZK', 1200, 25.0, 40.0, 'Proof', 5, 'Pamětní stříbrná mince 500 Kč – 125 let automobilky Tatra.', 900, '2023-10-01', 'Album B'),
  ('1 Kčs', 'Československo', 1962, 'oběžná', 'Hliníkový bronz', 1, 'Kčs', 45, 4.0, 23.0, 'VF', 3, 'Československá koruna z roku 1962.', 30, '2020-04-10', 'Album C'),
  ('5 Kčs', 'Československo', 1975, 'oběžná', 'Nikl', 5, 'Kčs', 35, 6.3, 25.0, 'XF', 2, 'Československá pětikoruna z roku 1975.', 25, '2020-04-10', 'Album C'),
  ('10 Haléř', 'Československo', 1953, 'oběžná', 'Hliník', 0.10, 'Kčs', 60, 1.2, 22.0, 'F', 5, 'Vzácnější ročník 10 haléře z roku 1953.', 40, '2019-12-01', 'Album C'),
  ('Toliar Leopolda I.', 'Habsburská monarchie', 1694, 'historická', 'Stříbro', 1, 'Toliar', 15000, 28.0, 42.0, 'VG', 8, 'Stříbrný toliar Leopolda I. ražený v Kutné Hoře.', 12000, '2018-03-15', 'Trezor'),
  ('1 Euro', 'Německo', 2002, 'oběžná', 'Bimetal', 1, 'EUR', 30, 7.5, 23.25, 'UNC', 1, 'Německá euromince prvního ročníku.', 25, '2023-07-01', 'Album D'),
  ('2 Euro – Erasmus', 'Francie', 2022, 'pamětní', 'Bimetal', 2, 'EUR', 55, 8.5, 25.75, 'UNC', 3, 'Pamětní 2€ mince – 35. výročí programu Erasmus.', 35, '2023-08-15', 'Album D'),
  ('Krugerrand 1/10 oz', 'Jihoafrická republika', 2020, 'investiční', 'Zlato .9167', 0.1, 'ZAR', 6500, 3.39, 16.5, 'BU', 3, 'Jihoafrický zlatý Krugerrand 1/10 oz.', 5200, '2020-08-01', 'Trezor'),
  ('1 oz Britannia', 'Velká Británie', 2023, 'investiční', 'Stříbro .999', 2, 'GBP', 800, 31.1, 38.61, 'BU', 2, 'Britská stříbrná mince 1 oz .999 Ag.', 700, '2023-06-01', 'Trezor'),
  ('Maria Theresien Thaler (Restrike)', 'Rakousko', 1780, 'historická', 'Stříbro .833', 1, 'Toliar', 950, 28.07, 41.0, 'UNC', 2, 'Novodobý dotisk slavného tolarového vzoru Marie Terezie.', 700, '2022-01-10', 'Album C')
ON CONFLICT DO NOTHING;

-- ─── KOLEKCE ─────────────────────────────────────────────────

INSERT INTO collections (id, name, description, is_public)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'České oběžné mince', 'Sbírka českých oběžných mincí od roku 1993.', true),
  ('a0000000-0000-0000-0000-000000000002', 'Investiční stříbro', 'Stříbrné investiční mince 1 oz z celého světa.', true),
  ('a0000000-0000-0000-0000-000000000003', 'Pamětní mince ČR', 'České pamětní stříbrné mince 200 Kč a 500 Kč.', true),
  ('a0000000-0000-0000-0000-000000000004', 'Československé mince', 'Mince z období Československa.', true)
ON CONFLICT DO NOTHING;

-- Přiřazení mincí do kolekcí
INSERT INTO collection_coins (collection_id, coin_id)
SELECT 'a0000000-0000-0000-0000-000000000001', id FROM coins WHERE country = 'Česká republika' AND coin_type = 'oběžná'
ON CONFLICT DO NOTHING;

INSERT INTO collection_coins (collection_id, coin_id)
SELECT 'a0000000-0000-0000-0000-000000000002', id FROM coins WHERE coin_type = 'investiční' AND material ILIKE '%stříbro%'
ON CONFLICT DO NOTHING;

INSERT INTO collection_coins (collection_id, coin_id)
SELECT 'a0000000-0000-0000-0000-000000000003', id FROM coins WHERE country = 'Česká republika' AND coin_type = 'pamětní'
ON CONFLICT DO NOTHING;

INSERT INTO collection_coins (collection_id, coin_id)
SELECT 'a0000000-0000-0000-0000-000000000004', id FROM coins WHERE country = 'Československo'
ON CONFLICT DO NOTHING;

-- ─── HISTORIE CEN ────────────────────────────────────────────

INSERT INTO price_history (coin_id, price, currency, source, recorded_at)
SELECT id, current_value, currency, 'Počáteční import', NOW() - INTERVAL '30 days'
FROM coins WHERE current_value IS NOT NULL
ON CONFLICT DO NOTHING;
