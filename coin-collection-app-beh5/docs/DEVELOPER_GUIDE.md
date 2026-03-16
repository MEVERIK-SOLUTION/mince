# Coin Collection Manager - Developer Guide

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Development Setup](#development-setup)
4. [Code Structure](#code-structure)
5. [API Development](#api-development)
6. [Frontend Development](#frontend-development)
7. [Database Management](#database-management)
8. [Testing](#testing)
9. [Deployment](#deployment)
10. [Contributing](#contributing)
11. [Troubleshooting](#troubleshooting)

## Project Overview

Coin Collection Manager is a full-stack Progressive Web Application (PWA) built with modern technologies for managing coin collections. The application supports offline functionality, real-time synchronization, AI-powered coin recognition, and comprehensive collection management.

### Technology Stack

**Frontend:**
- React 18 with TypeScript
- Next.js 14 (App Router)
- Material-UI (MUI) v5
- PWA with Service Workers
- IndexedDB for offline storage

**Backend:**
- Node.js with Express
- TypeScript
- JWT authentication
- File upload handling
- Background job processing

**Database:**
- PostgreSQL (Supabase)
- Row Level Security (RLS)
- Real-time subscriptions
- Automated backups

**Infrastructure:**
- Vercel (hosting)
- Supabase (database & storage)
- GitHub Actions (CI/CD)
- Sentry (error tracking)

## Architecture

### System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (Next.js)     │◄──►│   (Express)     │◄──►│   (Supabase)    │
│   - React       │    │   - REST API    │    │   - PostgreSQL  │
│   - PWA         │    │   - Auth        │    │   - RLS         │
│   - Offline     │    │   - File Upload │    │   - Real-time   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         │              │   File Storage  │              │
         └──────────────│   (Supabase)    │──────────────┘
                        │   - Images      │
                        │   - Backups     │
                        └─────────────────┘
```

### Data Flow

```
User Action → Frontend → API Validation → Database → Response → Frontend Update
     ↓
Offline Storage (IndexedDB) → Background Sync → API → Database
```

### Security Architecture

```
┌─────────────────┐
│   Rate Limiting │
├─────────────────┤
│   CORS Policy   │
├─────────────────┤
│   JWT Auth      │
├─────────────────┤
│   Input Valid.  │
├─────────────────┤
│   RLS Policies  │
└─────────────────┘
```

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Git
- PostgreSQL (local) or Supabase account
- Code editor (VS Code recommended)

### Local Development

1. **Clone Repository**:
   ```bash
   git clone https://github.com/your-username/coin-collection-app.git
   cd coin-collection-app
   ```

2. **Install Dependencies**:
   ```bash
   # Install root dependencies
   npm install
   
   # Install frontend dependencies
   cd frontend
   npm install
   
   # Install backend dependencies
   cd ../backend
   npm install
   
   # Return to root
   cd ..
   ```

3. **Environment Setup**:
   ```bash
   # Copy environment templates
   cp .env.example .env.local
   cp frontend/.env.example frontend/.env.local
   cp backend/.env.example backend/.env
   
   # Edit environment files with your values
   ```

4. **Database Setup**:
   ```bash
   # Install Supabase CLI
   npm install -g @supabase/cli
   
   # Start local Supabase (optional)
   supabase start
   
   # Or connect to remote Supabase
   supabase link --project-ref your-project-ref
   
   # Run migrations
   supabase db push
   ```

5. **Start Development Servers**:
   ```bash
   # Terminal 1: Frontend
   cd frontend
   npm run dev
   
   # Terminal 2: Backend
   cd backend
   npm run dev
   
   # Terminal 3: Database (if local)
   supabase start
   ```

6. **Access Application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Supabase Studio: http://localhost:54323

### Development Tools

**Recommended VS Code Extensions:**
```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "ms-vscode.vscode-json",
    "ms-vscode.vscode-eslint",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense"
  ]
}
```

**VS Code Settings** (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "relative",
  "emmet.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  }
}
```

## Code Structure

### Project Structure

```
coin-collection-app/
├── .github/workflows/          # CI/CD pipelines
├── docs/                       # Documentation
├── frontend/                   # React/Next.js application
│   ├── public/                 # Static assets
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── pages/              # Next.js pages
│   │   ├── hooks/              # Custom React hooks
│   │   ├── lib/                # Utility libraries
│   │   ├── styles/             # CSS and styling
│   │   └── types/              # TypeScript type definitions
│   ├── package.json
│   └── next.config.js
├── backend/                    # Express.js API
│   ├── src/
│   │   ├── controllers/        # Route controllers
│   │   ├── middleware/         # Express middleware
│   │   ├── models/             # Data models
│   │   ├── routes/             # API routes
│   │   ├── services/           # Business logic
│   │   └── utils/              # Utility functions
│   ├── package.json
│   └── tsconfig.json
├── supabase/                   # Database configuration
│   ├── migrations/             # Database migrations
│   ├── seed.sql               # Initial data
│   └── config.toml            # Supabase configuration
├── vercel.json                # Deployment configuration
└── package.json               # Root package.json
```

### Frontend Architecture

**Component Structure:**
```
src/components/
├── common/                     # Reusable components
│   ├── Button/
│   ├── Modal/
│   └── Loading/
├── layout/                     # Layout components
│   ├── Header/
│   ├── Sidebar/
│   └── Footer/
├── features/                   # Feature-specific components
│   ├── auth/
│   ├── collections/
│   ├── coins/
│   └── analytics/
└── mobile/                     # Mobile-specific components
    ├── MobileNavigation/
    └── MobileCoinCapture/
```

**Hook Structure:**
```
src/hooks/
├── useAuth.ts                  # Authentication logic
├── useCollections.ts           # Collection management
├── useCoins.ts                 # Coin operations
├── usePWA.ts                   # PWA functionality
└── useOfflineStorage.ts        # Offline data management
```

### Backend Architecture

**Controller Pattern:**
```typescript
// controllers/coinController.ts
export class CoinController {
  async createCoin(req: Request, res: Response) {
    try {
      const coinData = req.body;
      const userId = req.user.id;
      
      // Validate input
      const validation = validateCoinData(coinData);
      if (!validation.isValid) {
        return res.status(400).json({ errors: validation.errors });
      }
      
      // Business logic
      const coin = await CoinService.createCoin(userId, coinData);
      
      // Response
      res.status(201).json({ success: true, data: coin });
    } catch (error) {
      next(error);
    }
  }
}
```

**Service Pattern:**
```typescript
// services/coinService.ts
export class CoinService {
  static async createCoin(userId: number, coinData: CoinData) {
    // Validate user permissions
    await this.validateCollectionAccess(userId, coinData.collection_id);
    
    // Create coin record
    const coin = await db.coins.create({
      ...coinData,
      user_id: userId,
      created_at: new Date(),
    });
    
    // Update collection statistics
    await this.updateCollectionStats(coinData.collection_id);
    
    // Trigger webhooks
    await WebhookService.trigger('coin.created', { coin });
    
    return coin;
  }
}
```

## API Development

### RESTful API Design

**Resource Naming:**
- Collections: `/api/collections`
- Coins: `/api/coins`
- Users: `/api/users`
- Authentication: `/api/auth`

**HTTP Methods:**
- `GET`: Retrieve resources
- `POST`: Create new resources
- `PUT`: Update entire resources
- `PATCH`: Partial updates
- `DELETE`: Remove resources

**Response Format:**
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  timestamp: string;
  requestId: string;
}
```

### Authentication & Authorization

**JWT Implementation:**
```typescript
// middleware/auth.ts
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
};
```

**Role-Based Access Control:**
```typescript
export const authorize = (roles: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};
```

### Input Validation

**Using express-validator:**
```typescript
// validators/coinValidator.ts
export const validateCoinCreation = [
  body('denomination').trim().isLength({ min: 1, max: 100 }),
  body('year').isInt({ min: 1, max: new Date().getFullYear() + 1 }),
  body('country_id').isInt({ min: 1 }),
  body('material_id').isInt({ min: 1 }),
  body('condition').isIn(['poor', 'fair', 'good', 'very_good', 'fine', 'very_fine', 'extremely_fine', 'uncirculated']),
  handleValidationErrors
];

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: errors.array()
      }
    });
  }
  next();
};
```

### Error Handling

**Global Error Handler:**
```typescript
// middleware/errorHandler.ts
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  const errorId = crypto.randomUUID();
  
  // Log error
  logger.error('API Error', {
    errorId,
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    userId: req.user?.id,
  });
  
  // Send response
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message,
      errorId,
    },
    timestamp: new Date().toISOString(),
  });
};
```

## Frontend Development

### Component Development

**Component Template:**
```typescript
// components/CoinCard/CoinCard.tsx
import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { Coin } from '../../types/coin';

interface CoinCardProps {
  coin: Coin;
  onClick?: (coin: Coin) => void;
  showActions?: boolean;
}

export const CoinCard: React.FC<CoinCardProps> = ({
  coin,
  onClick,
  showActions = true,
}) => {
  const handleClick = () => {
    onClick?.(coin);
  };

  return (
    <Card 
      onClick={handleClick}
      sx={{ 
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? { elevation: 4 } : {},
      }}
    >
      <CardContent>
        <Typography variant="h6" component="h3">
          {coin.denomination}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {coin.country} • {coin.year}
        </Typography>
        <Box sx={{ mt: 1 }}>
          <Typography variant="body1">
            {coin.current_value ? `$${coin.current_value}` : 'No value set'}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default CoinCard;
```

**Custom Hooks:**
```typescript
// hooks/useCoins.ts
import { useState, useEffect } from 'react';
import { Coin, CoinFilters } from '../types/coin';
import { coinService } from '../services/coinService';

export const useCoins = (filters?: CoinFilters) => {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCoins = async () => {
    try {
      setLoading(true);
      const response = await coinService.getCoins(filters);
      setCoins(response.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch coins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoins();
  }, [filters]);

  const addCoin = async (coinData: Partial<Coin>) => {
    try {
      const newCoin = await coinService.createCoin(coinData);
      setCoins(prev => [...prev, newCoin]);
      return newCoin;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add coin');
      throw err;
    }
  };

  const updateCoin = async (id: number, updates: Partial<Coin>) => {
    try {
      const updatedCoin = await coinService.updateCoin(id, updates);
      setCoins(prev => prev.map(coin => 
        coin.id === id ? updatedCoin : coin
      ));
      return updatedCoin;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update coin');
      throw err;
    }
  };

  const deleteCoin = async (id: number) => {
    try {
      await coinService.deleteCoin(id);
      setCoins(prev => prev.filter(coin => coin.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete coin');
      throw err;
    }
  };

  return {
    coins,
    loading,
    error,
    refetch: fetchCoins,
    addCoin,
    updateCoin,
    deleteCoin,
  };
};
```

### State Management

**Context API Pattern:**
```typescript
// contexts/AuthContext.tsx
import React, { createContext, useContext, useReducer, useEffect } from 'react';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (userData: RegisterData) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, loading: true };
    case 'LOGIN_SUCCESS':
      return { 
        user: action.payload, 
        isAuthenticated: true, 
        loading: false 
      };
    case 'LOGIN_FAILURE':
      return { 
        user: null, 
        isAuthenticated: false, 
        loading: false 
      };
    case 'LOGOUT':
      return { 
        user: null, 
        isAuthenticated: false, 
        loading: false 
      };
    default:
      return state;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    isAuthenticated: false,
    loading: true,
  });

  // Implementation...

  return (
    <AuthContext.Provider value={{ ...state, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

### PWA Development

**Service Worker Registration:**
```typescript
// lib/pwa.ts
export const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('SW registered:', registration);
      
      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              showUpdateNotification();
            }
          });
        }
      });
      
      return registration;
    } catch (error) {
      console.error('SW registration failed:', error);
    }
  }
};

const showUpdateNotification = () => {
  // Show user notification about available update
  if (confirm('New version available. Update now?')) {
    window.location.reload();
  }
};
```

**Offline Storage:**
```typescript
// lib/offlineStorage.ts
class OfflineStorage {
  private dbName = 'CoinCollectionDB';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('coins')) {
          const coinStore = db.createObjectStore('coins', { keyPath: 'id' });
          coinStore.createIndex('collection_id', 'collection_id', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('collections')) {
          db.createObjectStore('collections', { keyPath: 'id' });
        }
      };
    });
  }

  async saveCoin(coin: Coin): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(['coins'], 'readwrite');
    const store = transaction.objectStore('coins');
    await store.put(coin);
  }

  async getCoins(collectionId?: number): Promise<Coin[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(['coins'], 'readonly');
    const store = transaction.objectStore('coins');
    
    if (collectionId) {
      const index = store.index('collection_id');
      return new Promise((resolve, reject) => {
        const request = index.getAll(collectionId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } else {
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
  }
}

export const offlineStorage = new OfflineStorage();
```

## Database Management

### Schema Design

**Core Tables:**
```sql
-- Users table (managed by Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Collections table
CREATE TABLE collections (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Coins table
CREATE TABLE coins (
  id SERIAL PRIMARY KEY,
  collection_id INTEGER REFERENCES collections(id) ON DELETE CASCADE,
  country_id INTEGER REFERENCES countries(id),
  material_id INTEGER REFERENCES materials(id),
  denomination TEXT NOT NULL,
  year INTEGER,
  condition TEXT CHECK (condition IN ('poor', 'fair', 'good', 'very_good', 'fine', 'very_fine', 'extremely_fine', 'uncirculated')),
  rarity TEXT CHECK (rarity IN ('common', 'uncommon', 'rare', 'very_rare', 'extremely_rare')),
  purchase_price DECIMAL(10,2),
  current_value DECIMAL(10,2),
  purchase_date DATE,
  notes TEXT,
  weight DECIMAL(8,3),
  diameter DECIMAL(6,2),
  thickness DECIMAL(5,2),
  mintage BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Row Level Security (RLS)

**Collections Policy:**
```sql
-- Users can only see their own collections or public ones
CREATE POLICY "Users can view own and public collections" ON collections
FOR SELECT USING (
  user_id = auth.uid() OR 
  is_public = TRUE OR
  id IN (
    SELECT collection_id FROM collection_shares 
    WHERE user_id = auth.uid() AND status = 'accepted'
  )
);

-- Users can only modify their own collections
CREATE POLICY "Users can modify own collections" ON collections
FOR ALL USING (user_id = auth.uid());
```

**Coins Policy:**
```sql
-- Users can only see coins from accessible collections
CREATE POLICY "Users can view accessible coins" ON coins
FOR SELECT USING (
  collection_id IN (
    SELECT id FROM collections WHERE
    user_id = auth.uid() OR 
    is_public = TRUE OR
    id IN (
      SELECT collection_id FROM collection_shares 
      WHERE user_id = auth.uid() AND status = 'accepted'
    )
  )
);

-- Users can only modify coins in their own collections
CREATE POLICY "Users can modify own coins" ON coins
FOR ALL USING (
  collection_id IN (
    SELECT id FROM collections WHERE user_id = auth.uid()
  )
);
```

### Migrations

**Migration Template:**
```sql
-- Migration: 20240101000001_add_coin_images.sql

-- Add coin_images table
CREATE TABLE coin_images (
  id SERIAL PRIMARY KEY,
  coin_id INTEGER REFERENCES coins(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_type TEXT CHECK (image_type IN ('front', 'back', 'edge', 'detail')) DEFAULT 'front',
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policy
ALTER TABLE coin_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view images of accessible coins" ON coin_images
FOR SELECT USING (
  coin_id IN (
    SELECT c.id FROM coins c
    JOIN collections col ON c.collection_id = col.id
    WHERE col.user_id = auth.uid() OR col.is_public = TRUE
  )
);

-- Add indexes
CREATE INDEX idx_coin_images_coin_id ON coin_images(coin_id);
CREATE INDEX idx_coin_images_type ON coin_images(image_type);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_coin_images_updated_at 
  BEFORE UPDATE ON coin_images 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Database Functions

**Stored Procedures:**
```sql
-- Function to get collection statistics
CREATE OR REPLACE FUNCTION get_collection_stats(collection_id_param INTEGER)
RETURNS JSON AS $$
DECLARE
  stats JSON;
BEGIN
  SELECT json_build_object(
    'total_coins', COUNT(*),
    'total_value', COALESCE(SUM(current_value), 0),
    'avg_value', COALESCE(AVG(current_value), 0),
    'countries_count', COUNT(DISTINCT country_id),
    'materials_count', COUNT(DISTINCT material_id),
    'year_range', json_build_object(
      'min', MIN(year),
      'max', MAX(year)
    ),
    'condition_breakdown', (
      SELECT json_object_agg(condition, count)
      FROM (
        SELECT condition, COUNT(*) as count
        FROM coins 
        WHERE collection_id = collection_id_param
        GROUP BY condition
      ) t
    )
  ) INTO stats
  FROM coins 
  WHERE collection_id = collection_id_param;
  
  RETURN stats;
END;
$$ LANGUAGE plpgsql;
```

## Testing

### Unit Testing

**Jest Configuration:**
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
```

**Test Example:**
```typescript
// __tests__/services/coinService.test.ts
import { CoinService } from '../../src/services/coinService';
import { db } from '../../src/config/database';

jest.mock('../../src/config/database');

describe('CoinService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createCoin', () => {
    it('should create a coin successfully', async () => {
      const mockCoin = {
        id: 1,
        denomination: '1 Euro',
        year: 2020,
        collection_id: 1,
      };

      (db.coins.create as jest.Mock).mockResolvedValue(mockCoin);

      const result = await CoinService.createCoin(1, {
        denomination: '1 Euro',
        year: 2020,
        collection_id: 1,
      });

      expect(result).toEqual(mockCoin);
      expect(db.coins.create).toHaveBeenCalledWith({
        denomination: '1 Euro',
        year: 2020,
        collection_id: 1,
        user_id: 1,
        created_at: expect.any(Date),
      });
    });

    it('should throw error for invalid collection', async () => {
      (db.collections.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        CoinService.createCoin(1, {
          denomination: '1 Euro',
          collection_id: 999,
        })
      ).rejects.toThrow('Collection not found');
    });
  });
});
```

### Integration Testing

**API Testing:**
```typescript
// __tests__/integration/coins.test.ts
import request from 'supertest';
import { app } from '../../src/app';
import { setupTestDb, cleanupTestDb } from '../helpers/database';

describe('Coins API', () => {
  let authToken: string;

  beforeAll(async () => {
    await setupTestDb();
    
    // Create test user and get token
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'TestPassword123!',
        full_name: 'Test User',
      });
    
    authToken = response.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  describe('POST /api/coins', () => {
    it('should create a coin', async () => {
      const coinData = {
        collection_id: 1,
        denomination: '1 Euro',
        year: 2020,
        country_id: 1,
        material_id: 1,
        condition: 'uncirculated',
      };

      const response = await request(app)
        .post('/api/coins')
        .set('Authorization', `Bearer ${authToken}`)
        .send(coinData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.denomination).toBe('1 Euro');
    });

    it('should return 400 for invalid data', async () => {
      const response = await request(app)
        .post('/api/coins')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          denomination: '', // Invalid
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
```

### Frontend Testing

**React Testing Library:**
```typescript
// __tests__/components/CoinCard.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CoinCard } from '../../src/components/CoinCard/CoinCard';

const mockCoin = {
  id: 1,
  denomination: '1 Euro',
  year: 2020,
  country: 'Germany',
  current_value: 1.20,
};

describe('CoinCard', () => {
  it('renders coin information', () => {
    render(<CoinCard coin={mockCoin} />);
    
    expect(screen.getByText('1 Euro')).toBeInTheDocument();
    expect(screen.getByText('Germany • 2020')).toBeInTheDocument();
    expect(screen.getByText('$1.20')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<CoinCard coin={mockCoin} onClick={handleClick} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledWith(mockCoin);
  });

  it('shows "No value set" when current_value is null', () => {
    const coinWithoutValue = { ...mockCoin, current_value: null };
    render(<CoinCard coin={coinWithoutValue} />);
    
    expect(screen.getByText('No value set')).toBeInTheDocument();
  });
});
```

### E2E Testing

**Playwright Configuration:**
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

**E2E Test Example:**
```typescript
// e2e/coin-management.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Coin Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid=email]', 'test@example.com');
    await page.fill('[data-testid=password]', 'TestPassword123!');
    await page.click('[data-testid=login-button]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should create a new coin', async ({ page }) => {
    // Navigate to collections
    await page.click('[data-testid=collections-nav]');
    await page.click('[data-testid=collection-item]:first-child');
    
    // Add new coin
    await page.click('[data-testid=add-coin-button]');
    await page.fill('[data-testid=denomination]', '1 Euro');
    await page.fill('[data-testid=year]', '2020');
    await page.selectOption('[data-testid=country]', 'Germany');
    await page.selectOption('[data-testid=material]', 'Bimetallic');
    await page.selectOption('[data-testid=condition]', 'uncirculated');
    
    await page.click('[data-testid=save-coin-button]');
    
    // Verify coin was created
    await expect(page.locator('[data-testid=coin-card]')).toContainText('1 Euro');
    await expect(page.locator('[data-testid=coin-card]')).toContainText('Germany • 2020');
  });

  test('should search for coins', async ({ page }) => {
    await page.goto('/coins');
    
    // Search for Euro coins
    await page.fill('[data-testid=search-input]', 'Euro');
    await page.press('[data-testid=search-input]', 'Enter');
    
    // Verify search results
    await expect(page.locator('[data-testid=coin-card]')).toContainText('Euro');
  });
});
```

## Deployment

### Environment Configuration

**Production Environment Variables:**
```bash
# Application
NODE_ENV=production
APP_VERSION=1.0.0

# Database
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...

# Security
JWT_SECRET=...
ENCRYPTION_KEY=...

# External Services
SENTRY_DSN=...
GOOGLE_ANALYTICS_ID=...
```

### Build Process

**Frontend Build:**
```bash
cd frontend
npm run build
npm run export  # For static export if needed
```

**Backend Build:**
```bash
cd backend
npm run build
npm run start
```

### Vercel Deployment

**vercel.json Configuration:**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "frontend/package.json",
      "use": "@vercel/next"
    },
    {
      "src": "backend/package.json",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "backend/index.js"
    },
    {
      "src": "/(.*)",
      "dest": "frontend/$1"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### Database Deployment

**Migration Deployment:**
```bash
# Deploy migrations to production
supabase db push --linked

# Verify deployment
supabase db diff --linked
```

## Contributing

### Git Workflow

**Branch Naming:**
- `feature/coin-recognition` - New features
- `bugfix/login-issue` - Bug fixes
- `hotfix/security-patch` - Critical fixes
- `refactor/api-structure` - Code refactoring

**Commit Messages:**
```
feat: add AI coin recognition
fix: resolve login timeout issue
docs: update API documentation
style: format code with prettier
refactor: restructure authentication logic
test: add unit tests for coin service
chore: update dependencies
```

### Code Review Process

1. **Create Feature Branch**
2. **Implement Changes**
3. **Write Tests**
4. **Update Documentation**
5. **Create Pull Request**
6. **Code Review**
7. **Address Feedback**
8. **Merge to Main**

### Code Standards

**TypeScript Configuration:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["DOM", "DOM.Iterable", "ES6"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

**ESLint Configuration:**
```json
{
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended",
    "react-app",
    "react-app/jest"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

**Prettier Configuration:**
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

## Troubleshooting

### Common Issues

**Build Failures:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build
```

**Database Connection Issues:**
```bash
# Test connection
psql $DATABASE_URL -c "SELECT version();"

# Check environment variables
echo $DATABASE_URL
```

**Authentication Problems:**
```typescript
// Debug JWT token
const decoded = jwt.decode(token);
console.log('Token payload:', decoded);

// Check token expiration
if (decoded.exp < Date.now() / 1000) {
  console.log('Token expired');
}
```

### Debugging Tools

**Backend Debugging:**
```typescript
// Add debug logging
import debug from 'debug';
const log = debug('app:coins');

log('Creating coin:', coinData);
```

**Frontend Debugging:**
```typescript
// React Developer Tools
// Redux DevTools Extension
// Browser DevTools

// Add debug info
console.log('Component props:', props);
console.log('Component state:', state);
```

### Performance Optimization

**Database Optimization:**
```sql
-- Add indexes for common queries
CREATE INDEX idx_coins_collection_country ON coins(collection_id, country_id);
CREATE INDEX idx_coins_year_range ON coins(year) WHERE year IS NOT NULL;

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM coins WHERE collection_id = 1;
```

**Frontend Optimization:**
```typescript
// Code splitting
const CoinDetail = lazy(() => import('./components/CoinDetail'));

// Memoization
const MemoizedCoinCard = memo(CoinCard);

// Virtual scrolling for large lists
import { FixedSizeList as List } from 'react-window';
```

## Resources

### Documentation
- [React Documentation](https://reactjs.org/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Material-UI Documentation](https://mui.com/)

### Tools
- [VS Code](https://code.visualstudio.com/)
- [Postman](https://www.postman.com/)
- [DBeaver](https://dbeaver.io/)
- [React Developer Tools](https://react.dev/learn/react-developer-tools)

### Community
- [GitHub Discussions](https://github.com/your-username/coin-collection-app/discussions)
- [Discord Server](https://discord.gg/your-server)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/coin-collection-manager)

---

*This developer guide is regularly updated. Last update: January 2024*