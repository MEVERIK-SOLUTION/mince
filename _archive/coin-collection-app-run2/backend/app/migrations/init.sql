-- Inicializační SQL skript pro PostgreSQL databázi
-- Vytvoří základní strukturu databáze pro aplikaci evidencie mincí

-- Nastavení kódování a locale
SET client_encoding = 'UTF8';

-- Vytvoření rozšíření pro fulltextové vyhledávání
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Vytvoření indexů pro fulltextové vyhledávání v češtině
-- (PostgreSQL má vestavěnou podporu pro český jazyk)

-- Funkce pro automatické aktualizace updated_at sloupce
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Vložení základních dat po vytvoření tabulek
-- (Toto se spustí po vytvoření tabulek pomocí SQLAlchemy)

-- Trigger pro automatické aktualizace updated_at bude přidán později
-- po vytvoření tabulek pomocí SQLAlchemy

-- Základní konfigurace pro optimalizaci výkonu
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET track_activity_query_size = 2048;
ALTER SYSTEM SET pg_stat_statements.track = 'all';

-- Restart není potřeba v Docker kontejneru, protože se spouští čistě

-- Vytvoření uživatele pro aplikaci (pokud neexistuje)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'coin_app') THEN
        CREATE ROLE coin_app WITH LOGIN PASSWORD 'app_password';
    END IF;
END
$$;

-- Udělení práv
GRANT CONNECT ON DATABASE coin_collection TO coin_app;
GRANT USAGE ON SCHEMA public TO coin_app;
GRANT CREATE ON SCHEMA public TO coin_app;

-- Poznámka: Tabulky budou vytvořeny pomocí SQLAlchemy
-- Tento skript pouze připravuje databázi a nastavuje základní konfiguraci