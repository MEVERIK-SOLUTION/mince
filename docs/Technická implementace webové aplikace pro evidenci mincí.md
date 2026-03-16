
# Technická implementace webové aplikace pro evidenci mincí

## 1. DOPORUČENÝ TECH STACK

### 1.1 Backend
```
🔧 Framework: FastAPI (Python)
📊 Databáze: PostgreSQL + Redis (cache)
🖼️ Úložiště obrázků: MinIO/S3 nebo lokální filesystem
🔍 Fulltextové vyhledávání: PostgreSQL FTS + Elasticsearch (volitelně)
🤖 AI identifikace: TensorFlow/PyTorch + OpenCV
📡 API integrace: httpx, aiohttp
```

### 1.2 Frontend
```
⚛️ Framework: React.js + TypeScript
🎨 UI knihovna: Material-UI nebo Ant Design
📱 Responsivní: Mobile-first design
📸 Fotografie: React Camera nebo WebRTC
🗺️ Mapy: Leaflet (pro geografické zobrazení původu)
```

### 1.3 DevOps
```
🐳 Kontejnerizace: Docker + Docker Compose
☁️ Deployment: Nginx + Gunicorn
📊 Monitoring: Prometheus + Grafana
🔒 Zabezpečení: JWT tokeny, HTTPS, rate limiting
```

## 2. ARCHITEKTURA APLIKACE

### 2.1 Struktura projektu
```
coin-collection-app/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── endpoints/
│   │   │   │   ├── coins.py
│   │   │   │   ├── collections.py
│   │   │   │   ├── images.py
│   │   │   │   └── identification.py
│   │   │   └── deps.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   └── security.py
│   │   ├── models/
│   │   │   ├── coin.py
│   │   │   ├── collection.py
│   │   │   └── user.py
│   │   ├── services/
│   │   │   ├── coin_identification.py
│   │   │   ├── price_scraper.py
│   │   │   └── external_apis.py
│   │   └── utils/
│   │       ├── image_processing.py
│   │       └── validators.py
│   ├── migrations/
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CoinCard/
│   │   │   ├── CoinForm/
│   │   │   ├── ImageUpload/
│   │   │   └── SearchFilters/
│   │   ├── pages/
│   │   │   ├── Dashboard/
│   │   │   ├── CoinDetail/
│   │   │   ├── AddCoin/
│   │   │   └── Collection/
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   └── imageUtils.ts
│   │   └── types/
│   │       └── coin.ts
│   ├── public/
│   └── package.json
├── docker-compose.yml
└── README.md
```

## 3. KLÍČOVÉ FUNKCE A IMPLEMENTACE

### 3.1 AI Identifikace mincí

```python
# backend/app/services/coin_identification.py
import cv2
import numpy as np
from tensorflow import keras
import requests

class CoinIdentificationService:
    def __init__(self):
        self.model = self.load_model()
        self.coinscan_api_key = "your_api_key"
    
    async def identify_coin_from_image(self, image_path: str):
        """Identifikace mince z obrázku pomocí AI"""
        
        # 1. Lokální preprocessing
        processed_image = self.preprocess_image(image_path)
        
        # 2. Pokus o lokální identifikaci
        local_result = self.local_identification(processed_image)
        
        # 3. Pokud není jistota, použij externí API
        if local_result['confidence'] < 0.8:
            external_result = await self.coinscan_identification(image_path)
            return external_result
        
        return local_result
    
    def preprocess_image(self, image_path: str):
        """Příprava obrázku pro analýzu"""
        image = cv2.imread(image_path)
        
        # Detekce kruhu (mince)
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        circles = cv2.HoughCircles(gray, cv2.HOUGH_GRADIENT, 1, 20,
                                  param1=50, param2=30, minRadius=50, maxRadius=300)
        
        if circles is not None:
            # Oříznutí na detekovanou minci
            x, y, r = circles[0][0].astype(int)
            cropped = image[y-r:y+r, x-r:x+r]
            return cv2.resize(cropped, (224, 224))
        
        return cv2.resize(image, (224, 224))
    
    async def coinscan_identification(self, image_path: str):
        """Identifikace pomocí CoinScan AI API"""
        with open(image_path, 'rb') as f:
            files = {'image': f}
            headers = {'Authorization': f'Bearer {self.coinscan_api_key}'}
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    'https://coinscanai.io/api/v1/identify',
                    files=files,
                    headers=headers
                )
                return response.json()
```

### 3.2 Správa obrázků

```python
# backend/app/services/image_service.py
from PIL import Image, ExifTags
import hashlib
import os

class ImageService:
    def __init__(self, storage_path: str = "uploads/coins/"):
        self.storage_path = storage_path
        os.makedirs(storage_path, exist_ok=True)
    
    async def save_coin_image(self, file, coin_id: int, image_type: str):
        """Uložení a optimalizace obrázku mince"""
        
        # Generování unikátního názvu
        file_hash = hashlib.md5(await file.read()).hexdigest()
        filename = f"{coin_id}_{image_type}_{file_hash}.jpg"
        file_path = os.path.join(self.storage_path, filename)
        
        # Reset file pointer
        await file.seek(0)
        
        # Uložení a optimalizace
        with Image.open(file.file) as img:
            # Rotace podle EXIF
            img = self.fix_orientation(img)
            
            # Resize pro web (max 1200px)
            img.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
            
            # Uložení s optimalizací
            img.save(file_path, 'JPEG', quality=85, optimize=True)
        
        # Vytvoření thumbnails
        await self.create_thumbnails(file_path, coin_id, image_type)
        
        return {
            'file_path': file_path,
            'filename': filename,
            'size': os.path.getsize(file_path)
        }
    
    def fix_orientation(self, img):
        """Oprava orientace podle EXIF dat"""
        try:
            for orientation in ExifTags.TAGS.keys():
                if ExifTags.TAGS[orientation] == 'Orientation':
                    break
            
            exif = img._getexif()
            if exif is not None:
                orientation_value = exif.get(orientation)
                if orientation_value == 3:
                    img = img.rotate(180, expand=True)
                elif orientation_value == 6:
                    img = img.rotate(270, expand=True)
                elif orientation_value == 8:
                    img = img.rotate(90, expand=True)
        except:
            pass
        
        return img
```

### 3.3 Cenové API integrace

```python
# backend/app/services/price_service.py
import asyncio
import httpx
from datetime import datetime, timedelta

class PriceService:
    def __init__(self):
        self.numista_api_key = "your_numista_key"
        self.cache_duration = timedelta(hours=6)
    
    async def get_coin_prices(self, coin_id: int):
        """Získání aktuálních cen z různých zdrojů"""
        
        tasks = [
            self.get_numista_price(coin_id),
            self.get_auction_prices(coin_id),
            self.get_dealer_prices(coin_id)
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        return {
            'numista': results[0] if not isinstance(results[0], Exception) else None,
            'auctions': results[1] if not isinstance(results[1], Exception) else None,
            'dealers': results[2] if not isinstance(results[2], Exception) else None,
            'updated_at': datetime.now()
        }
    
    async def get_numista_price(self, coin_id: int):
        """Cena z Numista API"""
        headers = {'Authorization': f'Bearer {self.numista_api_key}'}
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f'https://api.numista.com/v3/coins/{coin_id}/prices',
                headers=headers
            )
            return response.json()
    
    async def scrape_czech_auctions(self):
        """Scraping českých aukčních domů"""
        auction_houses = [
            'https://livebid.cz/api/auctions',
            'https://www.antiumaurum.cz/api/lots'
        ]
        
        results = []
        for url in auction_houses:
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(url, timeout=10.0)
                    if response.status_code == 200:
                        results.append(response.json())
            except Exception as e:
                print(f"Chyba při scrapingu {url}: {e}")
        
        return results
```

## 4. FRONTEND KOMPONENTY

### 4.1 Formulář pro přidání mince

```typescript
// frontend/src/components/CoinForm/CoinForm.tsx
import React, { useState } from 'react';
import { 
  TextField, 
  Select, 
  MenuItem, 
  Button, 
  Grid, 
  Card,
  CardContent 
} from '@mui/material';
import { ImageUpload } from '../ImageUpload/ImageUpload';
import { CoinIdentification } from '../CoinIdentification/CoinIdentification';

interface CoinFormData {
  name: string;
  country: string;
  year: number;
  denomination: number;
  currency: string;
  material: string;
  weight: number;
  diameter: number;
  coinType: string;
  condition: string;
  acquisitionPrice: number;
  notes: string;
}

export const CoinForm: React.FC = () => {
  const [formData, setFormData] = useState<CoinFormData>({
    name: '',
    country: '',
    year: new Date().getFullYear(),
    denomination: 0,
    currency: 'CZK',
    material: '',
    weight: 0,
    diameter: 0,
    coinType: 'circulation',
    condition: 'UNC',
    acquisitionPrice: 0,
    notes: ''
  });

  const [images, setImages] = useState<File[]>([]);
  const [identificationResult, setIdentificationResult] = useState(null);

  const handleImageUpload = async (files: File[]) => {
    setImages(files);
    
    // Automatická identifikace první fotografie
    if (files.length > 0) {
      const result = await identifyCoin(files[0]);
      setIdentificationResult(result);
      
      // Předvyplnění formuláře
      if (result.confidence > 0.8) {
        setFormData(prev => ({
          ...prev,
          name: result.name,
          country: result.country,
          year: result.year,
          denomination: result.denomination,
          currency: result.currency,
          material: result.material
        }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const coinData = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      coinData.append(key, value.toString());
    });
    
    images.forEach((image, index) => {
      coinData.append(`image_${index}`, image);
    });

    try {
      const response = await fetch('/api/coins', {
        method: 'POST',
        body: coinData
      });
      
      if (response.ok) {
        // Přesměrování na detail mince
        const coin = await response.json();
        window.location.href = `/coins/${coin.id}`;
      }
    } catch (error) {
      console.error('Chyba při ukládání mince:', error);
    }
  };

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            
            {/* Upload obrázků */}
            <Grid item xs={12}>
              <ImageUpload 
                onUpload={handleImageUpload}
                maxFiles={4}
                acceptedTypes={['image/jpeg', 'image/png']}
              />
            </Grid>

            {/* AI identifikace */}
            {identificationResult && (
              <Grid item xs={12}>
                <CoinIdentification result={identificationResult} />
              </Grid>
            )}

            {/* Základní informace */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Název mince"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({
                  ...prev, 
                  name: e.target.value
                }))}
                required
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Země původu"
                value={formData.country}
                onChange={(e) => setFormData(prev => ({
                  ...prev, 
                  country: e.target.value
                }))}
                required
              />
            </Grid>

            {/* Další pole formuláře... */}
            
            <Grid item xs={12}>
              <Button 
                type="submit" 
                variant="contained" 
                color="primary"
                size="large"
              >
                Přidat minci do kolekce
              </Button>
            </Grid>

          </Grid>
        </form>
      </CardContent>
    </Card>
  );
};
```

## 5. DEPLOYMENT A KONFIGURACE

### 5.1 Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: coin_collection
      POSTGRES_USER: coin_user
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://coin_user:secure_password@postgres:5432/coin_collection
      REDIS_URL: redis://redis:6379
      NUMISTA_API_KEY: ${NUMISTA_API_KEY}
      COINSCAN_API_KEY: ${COINSCAN_API_KEY}
    volumes:
      - ./uploads:/app/uploads
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - redis

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      REACT_APP_API_URL: http://localhost:8000
    depends_on:
      - backend

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend

volumes:
  postgres_data:
```

## 6. BEZPEČNOST A VÝKON

### 6.1 Bezpečnostní opatření
- JWT autentifikace s refresh tokeny
- Rate limiting (100 req/min per IP)
- Input validace a sanitizace
- HTTPS pouze
- CORS konfigurace
- SQL injection ochrana (ORM)
- XSS ochrana

### 6.2 Optimalizace výkonu
- Redis cache pro časté dotazy
- CDN pro statické soubory
- Lazy loading obrázků
- Pagination pro velké seznamy
- Database indexy
- Komprese obrázků
