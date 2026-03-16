#!/usr/bin/env python3
"""
Development server runner
Spustí aplikaci v development módu s automatickým reloadem
"""

import uvicorn
import os
import sys

# Přidání app do Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("🪙 Coin Collection API - Development Server")
    print("=" * 50)
    print("🚀 Spouštění serveru...")
    print("📡 API dokumentace: http://localhost:8000/docs")
    print("🔄 Automatický reload: ZAPNUT")
    print("🛑 Zastavení: Ctrl+C")
    print("=" * 50)
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["app"],
        log_level="info"
    )