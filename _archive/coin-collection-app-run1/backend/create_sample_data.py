#!/usr/bin/env python3
"""
Skript pro vytvoření ukázkových dat
Spustit z root adresáře backend: python create_sample_data.py
"""

import asyncio
import sys
import os

# Přidání app do Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.utils.sample_data import create_sample_data

if __name__ == "__main__":
    print("🪙 Coin Collection App - Vytváření ukázkových dat")
    print("=" * 50)
    
    try:
        asyncio.run(create_sample_data())
        print("\n🎉 Ukázková data byla úspěšně vytvořena!")
        print("\n📋 Co můžete nyní testovat:")
        print("   • API endpoints na http://localhost:8000/docs")
        print("   • Seznam mincí: GET /api/coins/")
        print("   • Detail mince: GET /api/coins/{id}")
        print("   • Statistiky: GET /api/coins/stats/summary")
        print("   • Kolekce: GET /api/collections/")
        print("   • Obrázky: /uploads/coins/")
        
    except Exception as e:
        print(f"\n❌ Chyba při vytváření dat: {e}")
        sys.exit(1)