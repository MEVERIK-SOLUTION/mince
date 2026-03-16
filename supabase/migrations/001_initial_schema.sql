-- ============================================================
--  Mince – Numismatický katalog  |  Supabase databázová migrace
--  Spusťte v Supabase → SQL Editor
-- ============================================================

-- Rozšíření
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

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

INSERT INTO coins (name, country, year_minted, coin_type, material, denomination, currency, current_value, description)
VALUES
  ('10 Kč ČR', 'Česká republika', 2020, 'oběžná', 'Nerezová ocel', 10, 'CZK', 10, 'Oběžná mince České republiky v hodnotě 10 Kč.'),
  ('20 Kč ČR', 'Česká republika', 2022, 'oběžná', 'Nerezová ocel', 20, 'CZK', 20, 'Oběžná mince České republiky v hodnotě 20 Kč.'),
  ('1 oz Silver Eagle', 'USA', 2023, 'investiční', 'Stříbro', 1, 'USD', 850, 'Americká stříbrná mince 1 oz .999 Ag.'),
  ('Pamětní 200 Kč', 'Česká republika', 2021, 'pamětní', 'Stříbro', 200, 'CZK', 450, 'Česká pamětní stříbrná mince 200 Kč.')
ON CONFLICT DO NOTHING;
