#!/usr/bin/env node
// ============================================================
//  Mince – Expand DB: add new coins + image URLs for all coins
// ============================================================

const SUPABASE_URL = 'https://yjzsvyksjjrkupgxueua.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqenN2eWtzampya3VwZ3h1ZXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MTk2NzIsImV4cCI6MjA4OTE5NTY3Mn0.TtxeyAbkm-0wsQN4GlsuOKCH0hUFJym4jAEx4_epr-M';

const headers = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function api(method, path, body) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const opts = { method, headers: { ...headers } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// ─── NEW COINS (12 that don't already exist) ──────────────────

const NEW_COINS = [
  {
    name: '200 Kč – Založení ČNB',
    country: 'Česká republika',
    year_minted: 1994,
    denomination: 200,
    currency: 'CZK',
    material: 'Stříbro .925',
    weight_grams: 13,
    diameter_mm: 31,
    thickness_mm: 2.3,
    edge_type: 'nápis',
    coin_type: 'pamětní',
    series: 'Pamětní mince ČNB',
    condition: 'Proof',
    rarity_level: 6,
    current_value: 1800,
    acquisition_price: 1200,
    storage_location: 'Album B',
    description: 'Pamětní stříbrná mince k založení České národní banky.',
    metadata: { mintage: 15000, designer: 'Jiří Harcuba', mint: 'Česká mincovna', silver_content: '925/1000' },
  },
  {
    name: '1 Euro – Irsko',
    country: 'Irsko',
    year_minted: 2002,
    denomination: 1,
    currency: 'EUR',
    material: 'Bimetal (Cu-Ni/Cu-Al-Ni-Zn)',
    weight_grams: 7.5,
    diameter_mm: 23.25,
    thickness_mm: 2.33,
    edge_type: 'rýhovaný',
    coin_type: 'oběžná',
    series: 'Euro mince',
    condition: 'UNC',
    rarity_level: 1,
    current_value: 28,
    acquisition_price: 25,
    storage_location: 'Album D',
    description: 'Irská euromince s keltskou harfou.',
    metadata: { mintage: 183800000, designer: 'Jarlath Hayes', mint: 'Central Bank of Ireland' },
  },
  {
    name: 'Československý rozhlas – 200 Kč',
    country: 'Česká republika',
    year_minted: 2018,
    denomination: 200,
    currency: 'CZK',
    material: 'Stříbro .925',
    weight_grams: 13,
    diameter_mm: 31,
    thickness_mm: 2.3,
    edge_type: 'nápis',
    coin_type: 'pamětní',
    series: 'Pamětní mince ČNB',
    condition: 'Proof',
    rarity_level: 7,
    current_value: 2200,
    acquisition_price: 1500,
    storage_location: 'Album B',
    description: 'Pamětní stříbrná mince k výročí zahájení pravidelného rozhlasového vysílání.',
    metadata: { mintage: 7500, designer: 'Asamat Baltaev', mint: 'Česká mincovna', silver_content: '925/1000' },
  },
  {
    name: 'Aureus – Marcus Aurelius',
    country: 'Římská říše',
    year_minted: 170,
    denomination: 1,
    currency: 'Aureus',
    material: 'Zlato .900',
    weight_grams: 7.2,
    diameter_mm: 19,
    thickness_mm: 1.8,
    edge_type: 'hladký',
    coin_type: 'antická',
    series: 'Římské císařské mince',
    condition: 'VG',
    rarity_level: 9,
    current_value: 280000,
    acquisition_price: 250000,
    storage_location: 'Trezor',
    description: 'Zlatý Aureus císaře Marca Aurelia, jedna z nejvzácnějších antických mincí.',
    metadata: { emperor: 'Marcus Aurelius', mint_city: 'Roma', reference: 'RIC III 234' },
  },
  {
    name: 'Krugerrand 1 oz',
    country: 'Jihoafrická republika',
    year_minted: 2022,
    denomination: 1,
    currency: 'ZAR',
    material: 'Zlato .9167',
    weight_grams: 33.93,
    diameter_mm: 32.77,
    thickness_mm: 2.84,
    edge_type: 'rýhovaný',
    coin_type: 'investiční',
    series: 'Krugerrand',
    condition: 'BU',
    rarity_level: 4,
    current_value: 62000,
    acquisition_price: 55000,
    storage_location: 'Trezor',
    description: 'Jihoafrický zlatý Krugerrand 1 oz – nejznámější investiční zlatá mince světa.',
    metadata: { mintage: 500000, designer: 'Otto Schultz', mint: 'South African Mint', gold_content: '916/1000', troy_ounces: '1' },
  },
  {
    name: '5 Dukát 2024',
    country: 'Česká republika',
    year_minted: 2024,
    denomination: 5,
    currency: 'Dukát',
    material: 'Zlato .986',
    weight_grams: 17.464,
    diameter_mm: 28,
    thickness_mm: 1.8,
    edge_type: 'hladký',
    coin_type: 'pamětní',
    series: 'Dukátové mince',
    condition: 'Proof',
    rarity_level: 8,
    current_value: 95000,
    acquisition_price: 78000,
    storage_location: 'Trezor',
    description: 'Pětidukát České mincovny z roku 2024 – limitovaná ražba.',
    metadata: { mintage: 2500, designer: 'Asamat Baltaev', mint: 'Česká mincovna', gold_content: '986/1000' },
  },
  {
    name: 'Denarius – Julius Caesar',
    country: 'Římská republika',
    year_minted: -44,
    denomination: 1,
    currency: 'Denarius',
    material: 'Stříbro .950',
    weight_grams: 3.8,
    diameter_mm: 18,
    thickness_mm: 1.5,
    edge_type: 'hladký',
    coin_type: 'antická',
    series: 'Římské republikánské mince',
    condition: 'F',
    rarity_level: 10,
    current_value: 450000,
    acquisition_price: 380000,
    storage_location: 'Trezor',
    description: 'Stříbrný denár Julia Caesara – poslední emise před jeho zavražděním.',
    metadata: { ruler: 'Julius Caesar', mint_city: 'Roma', reference: 'Crawford 480/13' },
  },
  {
    name: '20 Kč – Národní divadlo',
    country: 'Česká republika',
    year_minted: 2018,
    denomination: 20,
    currency: 'CZK',
    material: 'Mosaz',
    weight_grams: 8.5,
    diameter_mm: 26,
    thickness_mm: 2.1,
    edge_type: 'rýhovaný',
    coin_type: 'pamětní',
    series: 'Pamětní 20 Kč mince',
    condition: 'UNC',
    rarity_level: 5,
    current_value: 350,
    acquisition_price: 200,
    storage_location: 'Album A',
    description: 'Pamětní 20 Kč mince k 150. výročí položení základního kamene Národního divadla.',
    metadata: { mintage: 1000000, designer: 'Zbyněk Fojtů', mint: 'Česká mincovna' },
  },
  {
    name: 'Tetradrachma – Athény',
    country: 'Athény',
    year_minted: -440,
    denomination: 4,
    currency: 'Drachma',
    material: 'Stříbro .980',
    weight_grams: 17.2,
    diameter_mm: 24,
    thickness_mm: 2.1,
    edge_type: 'hladký',
    coin_type: 'antická',
    series: 'Řecké klasické mince',
    condition: 'F',
    rarity_level: 8,
    current_value: 180000,
    acquisition_price: 150000,
    storage_location: 'Trezor',
    description: 'Athénská tetradrachma se sovou – ikonická mince starověku.',
    metadata: { city_state: 'Athény', period: 'Klasické období', obverse: 'Athéna', reverse: 'Sova' },
  },
  {
    name: 'Panda 30g',
    country: 'Čína',
    year_minted: 2023,
    denomination: 10,
    currency: 'CNY',
    material: 'Stříbro .999',
    weight_grams: 30,
    diameter_mm: 40,
    thickness_mm: 3,
    edge_type: 'rýhovaný',
    coin_type: 'investiční',
    series: 'Chinese Panda',
    condition: 'BU',
    rarity_level: 4,
    current_value: 950,
    acquisition_price: 800,
    storage_location: 'Trezor',
    description: 'Čínská investiční stříbrná mince Panda 30g .999 Ag – každoročně nový design.',
    metadata: { mintage: 600000, mint: 'China Mint', silver_content: '999/1000' },
  },
  {
    name: 'Kookaburra 1 oz',
    country: 'Austrálie',
    year_minted: 2023,
    denomination: 1,
    currency: 'AUD',
    material: 'Stříbro .999',
    weight_grams: 31.103,
    diameter_mm: 40.6,
    thickness_mm: 4,
    edge_type: 'rýhovaný',
    coin_type: 'investiční',
    series: 'Kookaburra',
    condition: 'BU',
    rarity_level: 4,
    current_value: 920,
    acquisition_price: 780,
    storage_location: 'Trezor',
    description: 'Australská investiční stříbrná mince s motivem ledňáčka.',
    metadata: { mintage: 500000, mint: 'Perth Mint', silver_content: '999/1000', troy_ounces: '1' },
  },
  {
    name: 'Libertad 1 oz',
    country: 'Mexiko',
    year_minted: 2023,
    denomination: 1,
    currency: 'MXN',
    material: 'Stříbro .999',
    weight_grams: 31.103,
    diameter_mm: 40,
    thickness_mm: 3.5,
    edge_type: 'rýhovaný',
    coin_type: 'investiční',
    series: 'Libertad',
    condition: 'BU',
    rarity_level: 5,
    current_value: 1100,
    acquisition_price: 900,
    storage_location: 'Trezor',
    description: 'Mexická investiční stříbrná mince Libertad – nízký náklad ražby.',
    metadata: { mintage: 300000, mint: 'Casa de Moneda de México', silver_content: '999/1000', troy_ounces: '1' },
  },
];

// ─── IMAGE URL MAPPINGS ───────────────────────────────────────
// Map coin name patterns to image URLs from the archive

const IMAGE_MAP = {
  // Existing coins → archive images
  '1 Kč ČR': ['https://www.leftovercurrency.com/app/uploads/2016/11/1-czech-korun-coin-obverse-1.jpg'],
  '2 Kč ČR': ['https://www.leftovercurrency.com/wp-content/uploads/2016/11/2-czech-koruna-coin-reverse-1.jpg'],
  '10 Kč ČR': ['https://www.leftovercurrency.com/wp-content/uploads/2016/11/10-czech-koruna-coin-reverse-1.jpg'],
  '50 Kč ČR': ['https://www.leftovercurrency.com/app/uploads/2016/11/50-czech-koruna-coin-reverse-1-300x300.jpg'],
  '1 oz Silver Eagle': ['https://s3.amazonaws.com/ngccoin-production/us-coin-explorer/4704548-001rr.jpg'],
  '1 oz Maple Leaf': ['https://as1.ftcdn.net/v2/jpg/09/43/02/64/1000_F_943026411_JUsGKaPvhW6qVJM2BkjW36fz6zm5iY1h.jpg'],
  '1 oz Wiener Philharmoniker': ['https://study.com/cimages/multimages/16/silver_coin2026926832457858013.png'],
  '1 oz Britannia': ['https://images.pexels.com/photos/7114267/pexels-photo-7114267.jpeg'],
  'Krugerrand 1/10 oz': ['https://images.pexels.com/photos/4937040/pexels-photo-4937040.jpeg'],
  // New coins
  '200 Kč – Založení ČNB': ['https://upload.wikimedia.org/wikipedia/commons/d/d1/200_Kc_1994.jpg'],
  '1 Euro – Irsko': ['https://www.random.org/coins/faces/60-eur/ireland-1euro/reverse.jpg'],
  'Československý rozhlas': ['https://czechmintstatic.blob.core.windows.net/images/product/2d/bd/d3/ceskoslovenskyrozhlas200kcagproofa-250.jpg'],
  'Aureus – Marcus Aurelius': ['https://cdn11.bigcommerce.com/s-wqgful3f66/product_images/uploaded_images/aureus-of-emperor-claudius.jpg'],
  'Krugerrand 1 oz': ['https://images.pexels.com/photos/4937040/pexels-photo-4937040.jpeg'],
  '5 Dukát 2024': ['https://czechmintstatic.blob.core.windows.net/images/product/3e/b5/3f/5dsk2024auproofa-250.jpg'],
  'Denarius – Julius Caesar': ['https://2.bp.blogspot.com/-w8_6CgFcJeY/TV_8ygaH2HI/AAAAAAAAAC4/X0AN6SN-0WA/s1600/25group.jpg'],
  '20 Kč – Národní divadlo': ['https://en.numista.com/catalogue/photos/republique_tcheque/60632cfa680559.83950824-original.jpg'],
  'Tetradrachma – Athény': ['https://as1.ftcdn.net/v2/jpg/03/19/04/32/1000_F_319043299_UohcK7PMCb9YRKCqgkW3UJPo1Y6Wa6Bu.jpg'],
  'Panda 30g': ['https://as1.ftcdn.net/v2/jpg/00/01/90/90/1000_F_1909025_xQo2me1l8Ntld1tdVWOumfPunftHnf.jpg'],
  'Kookaburra 1 oz': ['https://res.cloudinary.com/bold-pm/image/upload/v1712235291/Graphics/BlogBanners/Edge-Finishes.webp'],
  'Libertad 1 oz': ['https://www.cointalk.com/attachments/20160430_063449-png.509042/'],
};

async function main() {
  console.log('🪙 Mince – Rozšíření databáze\n');

  // 1. Fetch existing coins
  const existing = await api('GET', 'coins?select=id,name&order=name');
  console.log(`📊 Stávající mince: ${existing.length}`);

  // 2. Insert new coins
  console.log(`\n📦 Vkládám ${NEW_COINS.length} nových mincí...`);
  const inserted = await api('POST', 'coins', NEW_COINS);
  console.log(`✅ Vloženo ${inserted.length} nových mincí`);

  // 3. Combine all coins for image mapping
  const allCoins = [...existing, ...inserted];
  console.log(`\n🖼️  Přidávám obrázky pro ${allCoins.length} mincí...`);

  // Check existing images
  const existingImages = await api('GET', 'coin_images?select=coin_id');
  const coinsWithImages = new Set(existingImages.map((i) => i.coin_id));

  const imageRows = [];
  for (const coin of allCoins) {
    if (coinsWithImages.has(coin.id)) continue; // skip coins that already have images

    // Find matching image URL
    const matchKey = Object.keys(IMAGE_MAP).find((key) => coin.name.includes(key));
    if (!matchKey) continue;

    const urls = IMAGE_MAP[matchKey];
    for (let i = 0; i < urls.length; i++) {
      imageRows.push({
        coin_id: coin.id,
        image_url: urls[i],
        image_type: 'obverse',
        is_primary: i === 0,
        order_index: i,
      });
    }
  }

  if (imageRows.length > 0) {
    await api('POST', 'coin_images', imageRows);
    console.log(`✅ Vloženo ${imageRows.length} obrázků`);
  } else {
    console.log('ℹ️  Žádné nové obrázky k vložení');
  }

  // 4. Add new coins to collections
  console.log('\n📁 Přidávám nové mince do kolekcí...');
  const collections = await api('GET', 'collections?select=id,name');
  const existingLinks = await api('GET', 'collection_coins?select=collection_id,coin_id');
  const linkSet = new Set(existingLinks.map((l) => `${l.collection_id}:${l.coin_id}`));

  const investicniSt = collections.find((c) => c.name.includes('Investiční stříbro'));
  const pametniCR = collections.find((c) => c.name.includes('Pamětní mince'));
  const ceskOb = collections.find((c) => c.name.includes('České oběžné'));

  const newLinks = [];
  for (const coin of inserted) {
    // Pamětní mince ČR
    if (pametniCR && coin.country === 'Česká republika' && coin.coin_type === 'pamětní') {
      const key = `${pametniCR.id}:${coin.id}`;
      if (!linkSet.has(key)) newLinks.push({ collection_id: pametniCR.id, coin_id: coin.id });
    }
    // Investiční stříbro
    if (investicniSt && coin.coin_type === 'investiční' && coin.material?.toLowerCase().includes('stříbro')) {
      const key = `${investicniSt.id}:${coin.id}`;
      if (!linkSet.has(key)) newLinks.push({ collection_id: investicniSt.id, coin_id: coin.id });
    }
    // České oběžné
    if (ceskOb && coin.country === 'Česká republika' && coin.coin_type === 'oběžná') {
      const key = `${ceskOb.id}:${coin.id}`;
      if (!linkSet.has(key)) newLinks.push({ collection_id: ceskOb.id, coin_id: coin.id });
    }
  }

  if (newLinks.length > 0) {
    await api('POST', 'collection_coins', newLinks);
    console.log(`✅ Přiřazeno ${newLinks.length} mincí do kolekcí`);
  }

  // 5. Summary
  const finalCount = await api('GET', 'coins?select=id&limit=100');
  const imgCount = await api('GET', 'coin_images?select=id&limit=200');
  console.log(`\n✅ Hotovo! Celkem ${finalCount.length} mincí, ${imgCount.length} obrázků v DB.`);
}

main().catch((e) => {
  console.error('\n❌ Chyba:', e.message);
  process.exit(1);
});
