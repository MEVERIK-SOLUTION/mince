"""
Ukázková data pro testování aplikace
Obsahuje 20 různých mincí s reálnými parametry
"""

import os
import requests
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from ..models.coin import Coin, CoinImage, UserCollection
from ..core.database import SessionLocal, engine
from ..core.config import settings

# Ukázková data mincí
SAMPLE_COINS = [
    {
        "name": "1 koruna česká",
        "country": "Česká republika",
        "year_minted": 1993,
        "denomination": Decimal("1"),
        "currency": "CZK",
        "material": "ocel poniklovaná",
        "weight_grams": Decimal("3.6"),
        "diameter_mm": Decimal("20"),
        "thickness_mm": Decimal("1.85"),
        "edge_type": "hladký",
        "coin_type": "oběžná",
        "series": "Standardní oběžné mince",
        "rarity_level": 2,
        "metadata": {
            "mintage": 200000000,
            "designer": "Ladislav Kozák",
            "mint": "Česká mincovna"
        },
        "images": [
            "https://www.leftovercurrency.com/app/uploads/2016/11/1-czech-korun-coin-obverse-1.jpg",
            "https://www.leftovercurrency.com/wp-content/uploads/2016/11/1-czech-korun-coin-reverse-1.jpg"
        ]
    },
    {
        "name": "2 koruny české",
        "country": "Česká republika", 
        "year_minted": 1993,
        "denomination": Decimal("2"),
        "currency": "CZK",
        "material": "ocel poniklovaná",
        "weight_grams": Decimal("3.7"),
        "diameter_mm": Decimal("21.5"),
        "thickness_mm": Decimal("1.85"),
        "edge_type": "hladký",
        "coin_type": "oběžná",
        "series": "Standardní oběžné mince",
        "rarity_level": 2,
        "metadata": {
            "mintage": 150000000,
            "designer": "Ladislav Kozák",
            "mint": "Česká mincovna"
        },
        "images": [
            "https://www.leftovercurrency.com/wp-content/uploads/2016/11/2-czech-koruna-coin-reverse-1.jpg",
            "https://www.makecoinsroll.com/images/items/czechia-2-koruny-2019-coin-reverse.jpg"
        ]
    },
    {
        "name": "10 korun českých",
        "country": "Česká republika",
        "year_minted": 1993,
        "denomination": Decimal("10"),
        "currency": "CZK", 
        "material": "ocel poniklovaná",
        "weight_grams": Decimal("4.1"),
        "diameter_mm": Decimal("24.5"),
        "thickness_mm": Decimal("1.85"),
        "edge_type": "rýhovaný",
        "coin_type": "oběžná",
        "series": "Standardní oběžné mince",
        "rarity_level": 2,
        "metadata": {
            "mintage": 100000000,
            "designer": "Ladislav Kozák",
            "mint": "Česká mincovna"
        },
        "images": [
            "https://www.leftovercurrency.com/wp-content/uploads/2016/11/10-czech-koruna-coin-reverse-1.jpg"
        ]
    },
    {
        "name": "50 korun českých",
        "country": "Česká republika",
        "year_minted": 1993,
        "denomination": Decimal("50"),
        "currency": "CZK",
        "material": "ocel poniklovaná",
        "weight_grams": Decimal("4.8"),
        "diameter_mm": Decimal("27.5"),
        "thickness_mm": Decimal("2.05"),
        "edge_type": "rýhovaný",
        "coin_type": "oběžná", 
        "series": "Standardní oběžné mince",
        "rarity_level": 3,
        "metadata": {
            "mintage": 50000000,
            "designer": "Ladislav Kozák",
            "mint": "Česká mincovna"
        },
        "images": [
            "https://www.leftovercurrency.com/app/uploads/2016/11/50-czech-koruna-coin-reverse-1-300x300.jpg"
        ]
    },
    {
        "name": "200 Kč - Založení České národní banky",
        "country": "Česká republika",
        "year_minted": 1994,
        "denomination": Decimal("200"),
        "currency": "CZK",
        "material": "stříbro 925",
        "weight_grams": Decimal("13"),
        "diameter_mm": Decimal("31"),
        "thickness_mm": Decimal("2.3"),
        "edge_type": "nápis",
        "coin_type": "pamětní",
        "series": "Pamětní mince ČNB",
        "rarity_level": 6,
        "metadata": {
            "mintage": 15000,
            "designer": "Jiří Harcuba",
            "mint": "Česká mincovna",
            "silver_content": "925/1000",
            "edge_inscription": "ČESKÁ NÁRODNÍ BANKA"
        },
        "images": [
            "https://upload.wikimedia.org/wikipedia/commons/d/d1/200_Kc_1994.jpg"
        ]
    },
    {
        "name": "1 Euro - Irsko",
        "country": "Irsko",
        "year_minted": 2002,
        "denomination": Decimal("1"),
        "currency": "EUR",
        "material": "bimetalická (Cu-Ni/Cu-Al-Ni-Zn)",
        "weight_grams": Decimal("7.5"),
        "diameter_mm": Decimal("23.25"),
        "thickness_mm": Decimal("2.33"),
        "edge_type": "rýhovaný",
        "coin_type": "oběžná",
        "series": "Euro mince",
        "rarity_level": 1,
        "metadata": {
            "mintage": 183800000,
            "designer": "Jarlath Hayes",
            "mint": "Central Bank of Ireland"
        },
        "images": [
            "https://www.random.org/coins/faces/60-eur/ireland-1euro/reverse.jpg"
        ]
    },
    {
        "name": "Československý rozhlas - 200 Kč",
        "country": "Česká republika",
        "year_minted": 2018,
        "denomination": Decimal("200"),
        "currency": "CZK",
        "material": "stříbro 925",
        "weight_grams": Decimal("13"),
        "diameter_mm": Decimal("31"),
        "thickness_mm": Decimal("2.3"),
        "edge_type": "nápis",
        "coin_type": "pamětní",
        "series": "Pamětní mince ČNB",
        "rarity_level": 7,
        "metadata": {
            "mintage": 7500,
            "designer": "Asamat Baltaev",
            "mint": "Česká mincovna",
            "silver_content": "925/1000"
        },
        "images": [
            "https://czechmintstatic.blob.core.windows.net/images/product/2d/bd/d3/ceskoslovenskyrozhlas200kcagproofa-250.jpg"
        ]
    },
    {
        "name": "Aureus - Marcus Aurelius",
        "country": "Římská říše",
        "year_minted": 170,
        "denomination": Decimal("1"),
        "currency": "Aureus",
        "material": "zlato 900",
        "weight_grams": Decimal("7.2"),
        "diameter_mm": Decimal("19"),
        "thickness_mm": Decimal("1.8"),
        "edge_type": "hladký",
        "coin_type": "antická",
        "series": "Římské císařské mince",
        "rarity_level": 9,
        "metadata": {
            "emperor": "Marcus Aurelius",
            "mint_city": "Roma",
            "reference": "RIC III 234",
            "obverse_legend": "M ANTONINVS AVG TR P XXX",
            "reverse_legend": "SALVTI AVGVSTOR"
        },
        "images": [
            "https://cdn11.bigcommerce.com/s-wqgful3f66/product_images/uploaded_images/aureus-of-emperor-claudius.jpg"
        ]
    },
    {
        "name": "American Silver Eagle",
        "country": "USA",
        "year_minted": 2023,
        "denomination": Decimal("1"),
        "currency": "USD",
        "material": "stříbro 999",
        "weight_grams": Decimal("31.103"),
        "diameter_mm": Decimal("40.6"),
        "thickness_mm": Decimal("2.98"),
        "edge_type": "rýhovaný",
        "coin_type": "investiční",
        "series": "American Eagle",
        "rarity_level": 3,
        "metadata": {
            "mintage": 24500000,
            "designer": "Adolph A. Weinman",
            "mint": "US Mint",
            "silver_content": "999/1000",
            "troy_ounces": "1"
        },
        "images": [
            "https://s3.amazonaws.com/ngccoin-production/us-coin-explorer/4704548-001rr.jpg"
        ]
    },
    {
        "name": "Krugerrand 1 oz",
        "country": "Jižní Afrika",
        "year_minted": 2022,
        "denomination": Decimal("1"),
        "currency": "Rand",
        "material": "zlato 916",
        "weight_grams": Decimal("33.93"),
        "diameter_mm": Decimal("32.77"),
        "thickness_mm": Decimal("2.84"),
        "edge_type": "rýhovaný",
        "coin_type": "investiční",
        "series": "Krugerrand",
        "rarity_level": 4,
        "metadata": {
            "mintage": 500000,
            "designer": "Otto Schultz",
            "mint": "South African Mint",
            "gold_content": "916/1000",
            "troy_ounces": "1"
        },
        "images": [
            "https://images.pexels.com/photos/4937040/pexels-photo-4937040.jpeg"
        ]
    },
    {
        "name": "5 dukát 2024",
        "country": "Česká republika",
        "year_minted": 2024,
        "denomination": Decimal("5"),
        "currency": "dukát",
        "material": "zlato 986",
        "weight_grams": Decimal("17.464"),
        "diameter_mm": Decimal("28"),
        "thickness_mm": Decimal("1.8"),
        "edge_type": "hladký",
        "coin_type": "pamětní",
        "series": "Dukátové mince",
        "rarity_level": 8,
        "metadata": {
            "mintage": 2500,
            "designer": "Asamat Baltaev",
            "mint": "Česká mincovna",
            "gold_content": "986/1000"
        },
        "images": [
            "https://czechmintstatic.blob.core.windows.net/images/product/3e/b5/3f/5dsk2024auproofa-250.jpg"
        ]
    },
    {
        "name": "Denarius - Julius Caesar",
        "country": "Římská republika",
        "year_minted": -44,
        "denomination": Decimal("1"),
        "currency": "Denarius",
        "material": "stříbro 950",
        "weight_grams": Decimal("3.8"),
        "diameter_mm": Decimal("18"),
        "thickness_mm": Decimal("1.5"),
        "edge_type": "hladký",
        "coin_type": "antická",
        "series": "Římské republikánské mince",
        "rarity_level": 10,
        "metadata": {
            "ruler": "Julius Caesar",
            "mint_city": "Roma",
            "reference": "Crawford 480/13",
            "historical_note": "Poslední mince ražená za Caesarova života"
        },
        "images": [
            "https://2.bp.blogspot.com/-w8_6CgFcJeY/TV_8ygaH2HI/AAAAAAAAAC4/X0AN6SN-0WA/s1600/25group.jpg"
        ]
    },
    {
        "name": "20 Kč - Národní divadlo",
        "country": "Česká republika",
        "year_minted": 2018,
        "denomination": Decimal("20"),
        "currency": "CZK",
        "material": "mosaz",
        "weight_grams": Decimal("8.5"),
        "diameter_mm": Decimal("26"),
        "thickness_mm": Decimal("2.1"),
        "edge_type": "rýhovaný",
        "coin_type": "pamětní",
        "series": "Pamětní 20 Kč mince",
        "rarity_level": 5,
        "metadata": {
            "mintage": 1000000,
            "designer": "Zbyněk Fojtů",
            "mint": "Česká mincovna",
            "occasion": "150. výročí položení základního kamene"
        },
        "images": [
            "https://en.numista.com/catalogue/photos/republique_tcheque/60632cfa680559.83950824-original.jpg"
        ]
    },
    {
        "name": "Maple Leaf 1 oz",
        "country": "Kanada",
        "year_minted": 2023,
        "denomination": Decimal("5"),
        "currency": "CAD",
        "material": "stříbro 999",
        "weight_grams": Decimal("31.103"),
        "diameter_mm": Decimal("38"),
        "thickness_mm": Decimal("3.29"),
        "edge_type": "rýhovaný",
        "coin_type": "investiční",
        "series": "Maple Leaf",
        "rarity_level": 3,
        "metadata": {
            "mintage": 30000000,
            "designer": "Walter Ott",
            "mint": "Royal Canadian Mint",
            "silver_content": "999/1000",
            "troy_ounces": "1"
        },
        "images": [
            "https://as1.ftcdn.net/v2/jpg/09/43/02/64/1000_F_943026411_JUsGKaPvhW6qVJM2BkjW36fz6zm5iY1h.jpg"
        ]
    },
    {
        "name": "Tetradrachma - Athény",
        "country": "Athény",
        "year_minted": -440,
        "denomination": Decimal("4"),
        "currency": "Drachma",
        "material": "stříbro 980",
        "weight_grams": Decimal("17.2"),
        "diameter_mm": Decimal("24"),
        "thickness_mm": Decimal("2.1"),
        "edge_type": "hladký",
        "coin_type": "antická",
        "series": "Řecké klasické mince",
        "rarity_level": 8,
        "metadata": {
            "city_state": "Athény",
            "period": "Klasické období",
            "obverse": "Athéna",
            "reverse": "Sova",
            "reference": "Kroll 8"
        },
        "images": [
            "https://as1.ftcdn.net/v2/jpg/03/19/04/32/1000_F_319043299_UohcK7PMCb9YRKCqgkW3UJPo1Y6Wa6Bu.jpg"
        ]
    },
    {
        "name": "Panda 30g",
        "country": "Čína",
        "year_minted": 2023,
        "denomination": Decimal("10"),
        "currency": "Yuan",
        "material": "stříbro 999",
        "weight_grams": Decimal("30"),
        "diameter_mm": Decimal("40"),
        "thickness_mm": Decimal("3"),
        "edge_type": "rýhovaný",
        "coin_type": "investiční",
        "series": "Chinese Panda",
        "rarity_level": 4,
        "metadata": {
            "mintage": 600000,
            "designer": "Shanghai Mint",
            "mint": "China Mint",
            "silver_content": "999/1000"
        },
        "images": [
            "https://as1.ftcdn.net/v2/jpg/00/01/90/90/1000_F_1909025_xQo2me1l8Ntld1tdVWOumfPunftHnf.jpg"
        ]
    },
    {
        "name": "Britannia 1 oz",
        "country": "Velká Británie",
        "year_minted": 2023,
        "denomination": Decimal("2"),
        "currency": "GBP",
        "material": "stříbro 999",
        "weight_grams": Decimal("31.103"),
        "diameter_mm": Decimal("38.61"),
        "thickness_mm": Decimal("3.3"),
        "edge_type": "rýhovaný",
        "coin_type": "investiční",
        "series": "Britannia",
        "rarity_level": 3,
        "metadata": {
            "mintage": 25000000,
            "designer": "Philip Nathan",
            "mint": "Royal Mint",
            "silver_content": "999/1000",
            "troy_ounces": "1"
        },
        "images": [
            "https://images.pexels.com/photos/7114267/pexels-photo-7114267.jpeg"
        ]
    },
    {
        "name": "Philharmoniker 1 oz",
        "country": "Rakousko",
        "year_minted": 2023,
        "denomination": Decimal("1.5"),
        "currency": "EUR",
        "material": "stříbro 999",
        "weight_grams": Decimal("31.103"),
        "diameter_mm": Decimal("37"),
        "thickness_mm": Decimal("3.2"),
        "edge_type": "rýhovaný",
        "coin_type": "investiční",
        "series": "Philharmoniker",
        "rarity_level": 3,
        "metadata": {
            "mintage": 15000000,
            "designer": "Thomas Pesendorfer",
            "mint": "Austrian Mint",
            "silver_content": "999/1000",
            "troy_ounces": "1"
        },
        "images": [
            "https://study.com/cimages/multimages/16/silver_coin2026926832457858013.png"
        ]
    },
    {
        "name": "Kookaburra 1 oz",
        "country": "Austrálie",
        "year_minted": 2023,
        "denomination": Decimal("1"),
        "currency": "AUD",
        "material": "stříbro 999",
        "weight_grams": Decimal("31.103"),
        "diameter_mm": Decimal("40.6"),
        "thickness_mm": Decimal("4"),
        "edge_type": "rýhovaný",
        "coin_type": "investiční",
        "series": "Kookaburra",
        "rarity_level": 4,
        "metadata": {
            "mintage": 500000,
            "designer": "Perth Mint",
            "mint": "Perth Mint",
            "silver_content": "999/1000",
            "troy_ounces": "1"
        },
        "images": [
            "https://res.cloudinary.com/bold-pm/image/upload/v1712235291/Graphics/BlogBanners/Edge-Finishes.webp"
        ]
    },
    {
        "name": "Libertad 1 oz",
        "country": "Mexiko",
        "year_minted": 2023,
        "denomination": Decimal("1"),
        "currency": "Onza",
        "material": "stříbro 999",
        "weight_grams": Decimal("31.103"),
        "diameter_mm": Decimal("40"),
        "thickness_mm": Decimal("3.5"),
        "edge_type": "rýhovaný",
        "coin_type": "investiční",
        "series": "Libertad",
        "rarity_level": 5,
        "metadata": {
            "mintage": 300000,
            "designer": "Casa de Moneda de México",
            "mint": "Mexican Mint",
            "silver_content": "999/1000",
            "troy_ounces": "1"
        },
        "images": [
            "https://www.cointalk.com/attachments/20160430_063449-png.509042/"
        ]
    }
]

# Ukázková data pro kolekce
SAMPLE_COLLECTIONS = [
    {
        "coin_index": 0,  # 1 koruna česká
        "condition_grade": "UNC",
        "acquisition_date": date(2023, 1, 15),
        "acquisition_price": Decimal("5.00"),
        "acquisition_source": "obchod",
        "current_estimated_value": Decimal("8.00"),
        "storage_location": "Album A, strana 1",
        "notes": "Krásný exemplář z první emise"
    },
    {
        "coin_index": 1,  # 2 koruny české
        "condition_grade": "XF",
        "acquisition_date": date(2023, 1, 15),
        "acquisition_price": Decimal("3.00"),
        "acquisition_source": "obchod",
        "current_estimated_value": Decimal("5.00"),
        "storage_location": "Album A, strana 1",
        "notes": "Mírné opotřebení"
    },
    {
        "coin_index": 4,  # 200 Kč - ČNB
        "condition_grade": "PR",
        "acquisition_date": date(2022, 6, 10),
        "acquisition_price": Decimal("850.00"),
        "acquisition_source": "aukce",
        "current_estimated_value": Decimal("1200.00"),
        "insurance_value": Decimal("1500.00"),
        "storage_location": "Trezor, kapsle 1",
        "notes": "Proof kvalita, certifikát přiložen"
    },
    {
        "coin_index": 7,  # Aureus Marcus Aurelius
        "condition_grade": "VF",
        "acquisition_date": date(2021, 11, 20),
        "acquisition_price": Decimal("15000.00"),
        "acquisition_source": "aukce",
        "current_estimated_value": Decimal("18000.00"),
        "insurance_value": Decimal("25000.00"),
        "storage_location": "Trezor, speciální kapsle",
        "notes": "Vzácný exemplář, expertiza přiložena"
    },
    {
        "coin_index": 8,  # American Silver Eagle
        "condition_grade": "UNC",
        "acquisition_date": date(2023, 8, 5),
        "acquisition_price": Decimal("750.00"),
        "acquisition_source": "obchod",
        "current_estimated_value": Decimal("800.00"),
        "storage_location": "Investiční portfolio",
        "notes": "Investiční stříbro"
    }
]


async def download_image(url: str, filename: str) -> bool:
    """Stažení obrázku z URL"""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        file_path = os.path.join(settings.upload_dir, "coins", filename)
        with open(file_path, 'wb') as f:
            f.write(response.content)
        
        return True
    except Exception as e:
        print(f"Chyba při stahování {url}: {e}")
        return False


def create_sample_data():
    """Vytvoření ukázkových dat"""
    print("🚀 Vytváření ukázkových dat...")
    
    # Vytvoření databázových tabulek
    from ..core.database import create_tables
    create_tables()
    
    db = SessionLocal()
    
    try:
        # Kontrola, zda už data neexistují
        existing_coins = db.query(Coin).count()
        if existing_coins > 0:
            print(f"⚠️  Databáze již obsahuje {existing_coins} mincí. Přeskakuji vytváření ukázkových dat.")
            return
        
        created_coins = []
        
        # Vytvoření mincí
        for i, coin_data in enumerate(SAMPLE_COINS):
            print(f"📝 Vytváření mince {i+1}/{len(SAMPLE_COINS)}: {coin_data['name']}")
            
            # Vytvoření mince
            coin = Coin(
                catalog_id=f"{coin_data['country'][:2].upper()}-{coin_data['year_minted']}-{int(coin_data['denomination'])}-{i+1:03d}",
                name=coin_data['name'],
                country=coin_data['country'],
                year_minted=coin_data['year_minted'],
                denomination=coin_data['denomination'],
                currency=coin_data['currency'],
                material=coin_data['material'],
                weight_grams=coin_data['weight_grams'],
                diameter_mm=coin_data['diameter_mm'],
                thickness_mm=coin_data['thickness_mm'],
                edge_type=coin_data['edge_type'],
                coin_type=coin_data['coin_type'],
                series=coin_data['series'],
                rarity_level=coin_data['rarity_level'],
                metadata=coin_data['metadata']
            )
            
            db.add(coin)
            db.flush()  # Získání ID
            created_coins.append(coin)
            
            # Stažení a uložení obrázků
            for j, image_url in enumerate(coin_data['images']):
                image_type = ["obverse", "reverse", "edge", "detail"][j] if j < 4 else "detail"
                filename = f"coin_{coin.id}_{image_type}_{j+1}.jpg"
                
                print(f"  📸 Stahování obrázku {j+1}: {image_type}")
                
                if await download_image(image_url, filename):
                    # Vytvoření záznamu obrázku
                    coin_image = CoinImage(
                        coin_id=coin.id,
                        image_type=image_type,
                        file_path=os.path.join(settings.upload_dir, "coins", filename),
                        file_size=os.path.getsize(os.path.join(settings.upload_dir, "coins", filename)),
                        is_primary=(j == 0)  # První obrázek jako hlavní
                    )
                    db.add(coin_image)
        
        # Vytvoření ukázkových kolekcí
        print("\n📚 Vytváření ukázkových položek kolekce...")
        for collection_data in SAMPLE_COLLECTIONS:
            coin = created_coins[collection_data['coin_index']]
            
            collection_item = UserCollection(
                coin_id=coin.id,
                condition_grade=collection_data['condition_grade'],
                acquisition_date=collection_data['acquisition_date'],
                acquisition_price=collection_data['acquisition_price'],
                acquisition_source=collection_data['acquisition_source'],
                current_estimated_value=collection_data['current_estimated_value'],
                insurance_value=collection_data.get('insurance_value'),
                storage_location=collection_data['storage_location'],
                notes=collection_data['notes']
            )
            
            db.add(collection_item)
        
        # Uložení všech změn
        db.commit()
        
        print(f"\n✅ Úspěšně vytvořeno:")
        print(f"   📝 {len(SAMPLE_COINS)} mincí")
        print(f"   📸 {sum(len(coin['images']) for coin in SAMPLE_COINS)} obrázků")
        print(f"   📚 {len(SAMPLE_COLLECTIONS)} položek kolekce")
        print(f"\n🎯 Aplikace je připravena k testování!")
        
    except Exception as e:
        print(f"❌ Chyba při vytváření ukázkových dat: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import asyncio
    asyncio.run(create_sample_data())