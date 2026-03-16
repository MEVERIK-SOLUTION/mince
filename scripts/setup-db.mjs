#!/usr/bin/env node
// ============================================================
//  Mince – Setup skript pro ověření a naplnění databáze
//  Spusťte: node scripts/setup-db.mjs
//
//  PREREKVIZITA: Nejprve spusťte SQL migraci v Supabase SQL Editoru:
//    supabase/migrations/001_initial_schema.sql
// ============================================================

const SUPABASE_URL = 'https://yjzsvyksjjrkupgxueua.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqenN2eWtzampya3VwZ3h1ZXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MTk2NzIsImV4cCI6MjA4OTE5NTY3Mn0.TtxeyAbkm-0wsQN4GlsuOKCH0hUFJym4jAEx4_epr-M';

const headers = {
  'apikey': ANON_KEY,
  'Authorization': `Bearer ${ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

async function apiCall(method, path, body) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function checkSchema() {
  console.log('🔍 Kontrola schématu databáze...');
  try {
    // Try to query with the new schema columns
    const coins = await apiCall('GET', 'coins?select=id,name,country,year_minted,coin_type,material&limit=1');
    console.log('✅ Schéma coins je správné (nové schéma s country, year_minted atd.)');
    return true;
  } catch (e) {
    if (e.message.includes('column') || e.message.includes('400')) {
      console.log('❌ Schéma coins je ŠPATNÉ (staré schéma).');
      console.log('   Spusťte nejprve SQL migraci v Supabase SQL Editoru:');
      console.log('   supabase/migrations/001_initial_schema.sql');
      return false;
    }
    throw e;
  }
}

async function seedCoins() {
  console.log('\n📦 Vkládám ukázková data mincí...');

  const coins = [
    { name: '10 Kč ČR', country: 'Česká republika', year_minted: 2020, coin_type: 'oběžná', material: 'Nerezová ocel', denomination: 10, currency: 'CZK', current_value: 10, weight_grams: 7.62, diameter_mm: 24.5, condition: 'UNC', rarity_level: 1, description: 'Oběžná mince České republiky v hodnotě 10 Kč.', acquisition_price: 10, storage_location: 'Album A' },
    { name: '20 Kč ČR', country: 'Česká republika', year_minted: 2022, coin_type: 'oběžná', material: 'Nerezová ocel', denomination: 20, currency: 'CZK', current_value: 20, weight_grams: 8.43, diameter_mm: 26.0, condition: 'UNC', rarity_level: 1, description: 'Oběžná mince České republiky v hodnotě 20 Kč.', acquisition_price: 20, storage_location: 'Album A' },
    { name: '50 Kč ČR', country: 'Česká republika', year_minted: 2019, coin_type: 'oběžná', material: 'Nerezová ocel', denomination: 50, currency: 'CZK', current_value: 50, weight_grams: 9.7, diameter_mm: 27.5, condition: 'XF', rarity_level: 1, description: 'Oběžná mince České republiky v hodnotě 50 Kč.', acquisition_price: 50, storage_location: 'Album A' },
    { name: '1 Kč ČR 1993', country: 'Česká republika', year_minted: 1993, coin_type: 'oběžná', material: 'Niklová ocel', denomination: 1, currency: 'CZK', current_value: 25, weight_grams: 3.1, diameter_mm: 20.0, condition: 'VF', rarity_level: 3, description: 'První ročník české korunové mince.', acquisition_price: 15, storage_location: 'Album A' },
    { name: '1 oz Silver Eagle', country: 'USA', year_minted: 2023, coin_type: 'investiční', material: 'Stříbro .999', denomination: 1, currency: 'USD', current_value: 850, weight_grams: 31.1, diameter_mm: 40.6, condition: 'BU', rarity_level: 2, description: 'Americká stříbrná mince 1 oz .999 Ag.', acquisition_price: 750, storage_location: 'Trezor' },
    { name: '1 oz Maple Leaf', country: 'Kanada', year_minted: 2023, coin_type: 'investiční', material: 'Stříbro .9999', denomination: 5, currency: 'CAD', current_value: 820, weight_grams: 31.1, diameter_mm: 38.0, condition: 'BU', rarity_level: 2, description: 'Kanadská stříbrná mince 1 oz .9999 Ag.', acquisition_price: 720, storage_location: 'Trezor' },
    { name: '1 oz Wiener Philharmoniker', country: 'Rakousko', year_minted: 2022, coin_type: 'investiční', material: 'Stříbro .999', denomination: 1.5, currency: 'EUR', current_value: 790, weight_grams: 31.1, diameter_mm: 37.0, condition: 'BU', rarity_level: 2, description: 'Rakouská stříbrná mince 1 oz .999 Ag.', acquisition_price: 680, storage_location: 'Trezor' },
    { name: 'Pamětní 200 Kč – Josef Božek', country: 'Česká republika', year_minted: 2021, coin_type: 'pamětní', material: 'Stříbro .925', denomination: 200, currency: 'CZK', current_value: 650, weight_grams: 13.0, diameter_mm: 31.0, condition: 'Proof', rarity_level: 4, description: 'Pamětní stříbrná mince 200 Kč – 250. výročí narození Josefa Božka.', acquisition_price: 450, storage_location: 'Album B' },
    { name: 'Pamětní 500 Kč – Automobil Tatra', country: 'Česká republika', year_minted: 2023, coin_type: 'pamětní', material: 'Stříbro .925', denomination: 500, currency: 'CZK', current_value: 1200, weight_grams: 25.0, diameter_mm: 40.0, condition: 'Proof', rarity_level: 5, description: 'Pamětní stříbrná mince 500 Kč – 125 let automobilky Tatra.', acquisition_price: 900, storage_location: 'Album B' },
    { name: '1 Kčs 1962', country: 'Československo', year_minted: 1962, coin_type: 'oběžná', material: 'Hliníkový bronz', denomination: 1, currency: 'Kčs', current_value: 45, weight_grams: 4.0, diameter_mm: 23.0, condition: 'VF', rarity_level: 3, description: 'Československá koruna z roku 1962.', acquisition_price: 30, storage_location: 'Album C' },
    { name: 'Toliar Leopolda I.', country: 'Habsburská monarchie', year_minted: 1694, coin_type: 'historická', material: 'Stříbro', denomination: 1, currency: 'Toliar', current_value: 15000, weight_grams: 28.0, diameter_mm: 42.0, condition: 'VG', rarity_level: 8, description: 'Stříbrný toliar Leopolda I. ražený v Kutné Hoře.', acquisition_price: 12000, storage_location: 'Trezor' },
    { name: '2 Euro – Erasmus', country: 'Francie', year_minted: 2022, coin_type: 'pamětní', material: 'Bimetal', denomination: 2, currency: 'EUR', current_value: 55, weight_grams: 8.5, diameter_mm: 25.75, condition: 'UNC', rarity_level: 3, description: 'Pamětní 2€ mince – 35. výročí programu Erasmus.', acquisition_price: 35, storage_location: 'Album D' },
    { name: '1 oz Britannia', country: 'Velká Británie', year_minted: 2023, coin_type: 'investiční', material: 'Stříbro .999', denomination: 2, currency: 'GBP', current_value: 800, weight_grams: 31.1, diameter_mm: 38.61, condition: 'BU', rarity_level: 2, description: 'Britská stříbrná mince 1 oz .999 Ag.', acquisition_price: 700, storage_location: 'Trezor' },
    { name: 'Krugerrand 1/10 oz', country: 'Jihoafrická republika', year_minted: 2020, coin_type: 'investiční', material: 'Zlato .9167', denomination: 0.1, currency: 'ZAR', current_value: 6500, weight_grams: 3.39, diameter_mm: 16.5, condition: 'BU', rarity_level: 3, description: 'Jihoafrický zlatý Krugerrand 1/10 oz.', acquisition_price: 5200, storage_location: 'Trezor' },
  ];

  const result = await apiCall('POST', 'coins', coins);
  console.log(`✅ Vloženo ${result.length} mincí`);
  return result;
}

async function seedCollections(coins) {
  console.log('\n📁 Vytvářím kolekce...');

  const collections = [
    { name: 'České oběžné mince', description: 'Sbírka českých oběžných mincí od roku 1993.', is_public: true },
    { name: 'Investiční stříbro', description: 'Stříbrné investiční mince 1 oz z celého světa.', is_public: true },
    { name: 'Pamětní mince ČR', description: 'České pamětní stříbrné mince 200 Kč a 500 Kč.', is_public: true },
  ];

  const createdCollections = await apiCall('POST', 'collections', collections);
  console.log(`✅ Vytvořeno ${createdCollections.length} kolekcí`);

  // Add coins to collections
  const links = [];

  for (const coin of coins) {
    if (coin.country === 'Česká republika' && coin.coin_type === 'oběžná') {
      links.push({ collection_id: createdCollections[0].id, coin_id: coin.id });
    }
    if (coin.coin_type === 'investiční' && coin.material?.toLowerCase().includes('stříbro')) {
      links.push({ collection_id: createdCollections[1].id, coin_id: coin.id });
    }
    if (coin.country === 'Česká republika' && coin.coin_type === 'pamětní') {
      links.push({ collection_id: createdCollections[2].id, coin_id: coin.id });
    }
  }

  if (links.length > 0) {
    await apiCall('POST', 'collection_coins', links);
    console.log(`✅ Přiřazeno ${links.length} mincí do kolekcí`);
  }
}

async function main() {
  console.log('🪙 Mince – Setup databáze\n');

  const schemaOk = await checkSchema();
  if (!schemaOk) {
    process.exit(1);
  }

  // Check if data already exists
  const existing = await apiCall('GET', 'coins?select=id&limit=1');
  if (existing.length > 0) {
    console.log('\nℹ️  Databáze již obsahuje data. Přeskakuji seed.');
    console.log('   Pro opětovné naplnění nejprve smažte data v Supabase.');
    return;
  }

  const coins = await seedCoins();
  await seedCollections(coins);

  console.log('\n✅ Setup dokončen!');
  console.log('   Aplikace: https://mince-git-main-meveriks-projects.vercel.app');
}

main().catch(e => {
  console.error('\n❌ Chyba:', e.message);
  process.exit(1);
});
