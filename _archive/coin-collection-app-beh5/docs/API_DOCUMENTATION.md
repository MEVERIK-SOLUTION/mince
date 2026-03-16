# Coin Collection Manager - API Documentation

## Overview

The Coin Collection Manager API provides comprehensive endpoints for managing coin collections, user authentication, and related functionality. This RESTful API supports both web and mobile applications with PWA capabilities.

## Base URL

```
Production: https://your-app.vercel.app/api
Development: http://localhost:3001/api
```

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Token Lifecycle

- **Access Token**: Valid for 7 days
- **Refresh Token**: Valid for 30 days
- **Session Timeout**: 30 minutes of inactivity

## Rate Limiting

- **General API**: 1000 requests per 15 minutes
- **Authentication**: 5 attempts per 15 minutes
- **File Upload**: 20 uploads per hour
- **Public Endpoints**: 100 requests per 15 minutes

## Response Format

All API responses follow this structure:

```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "uuid-v4"
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {},
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "uuid-v4"
  }
}
```

## Endpoints

### Authentication

#### POST /auth/register

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "full_name": "John Doe",
  "terms_accepted": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "full_name": "John Doe",
      "created_at": "2024-01-01T00:00:00.000Z"
    },
    "tokens": {
      "accessToken": "jwt-access-token",
      "refreshToken": "jwt-refresh-token"
    }
  }
}
```

#### POST /auth/login

Authenticate user and receive tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "full_name": "John Doe",
      "last_login": "2024-01-01T00:00:00.000Z"
    },
    "tokens": {
      "accessToken": "jwt-access-token",
      "refreshToken": "jwt-refresh-token"
    }
  }
}
```

#### POST /auth/refresh

Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "jwt-refresh-token"
}
```

#### POST /auth/logout

Logout user and invalidate tokens.

**Headers:** `Authorization: Bearer <token>`

#### POST /auth/forgot-password

Request password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

#### POST /auth/reset-password

Reset password using reset token.

**Request Body:**
```json
{
  "token": "reset-token",
  "password": "NewSecurePassword123!"
}
```

### User Management

#### GET /users/profile

Get current user profile.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "full_name": "John Doe",
    "avatar_url": "https://example.com/avatar.jpg",
    "created_at": "2024-01-01T00:00:00.000Z",
    "preferences": {
      "currency": "USD",
      "language": "en",
      "notifications": true
    }
  }
}
```

#### PUT /users/profile

Update user profile.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "full_name": "John Smith",
  "preferences": {
    "currency": "EUR",
    "language": "cs"
  }
}
```

#### POST /users/avatar

Upload user avatar.

**Headers:** `Authorization: Bearer <token>`

**Content-Type:** `multipart/form-data`

**Form Data:**
- `avatar`: Image file (JPEG, PNG, WebP, max 5MB)

### Collections

#### GET /collections

Get user's collections.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `sort`: Sort field (name, created_at, updated_at)
- `order`: Sort order (asc, desc)
- `search`: Search term

**Response:**
```json
{
  "success": true,
  "data": {
    "collections": [
      {
        "id": 1,
        "name": "European Coins",
        "description": "Collection of European coins",
        "is_public": false,
        "coin_count": 45,
        "total_value": 1250.50,
        "created_at": "2024-01-01T00:00:00.000Z",
        "updated_at": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "pages": 1
    }
  }
}
```

#### POST /collections

Create new collection.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "American Coins",
  "description": "Collection of American coins",
  "is_public": false
}
```

#### GET /collections/:id

Get specific collection details.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "European Coins",
    "description": "Collection of European coins",
    "is_public": false,
    "coin_count": 45,
    "total_value": 1250.50,
    "created_at": "2024-01-01T00:00:00.000Z",
    "coins": [
      {
        "id": 1,
        "denomination": "1 Euro",
        "year": 2020,
        "country": "Germany",
        "material": "Bimetallic",
        "condition": "uncirculated",
        "current_value": 1.20,
        "images": ["https://example.com/coin1.jpg"]
      }
    ]
  }
}
```

#### PUT /collections/:id

Update collection.

**Headers:** `Authorization: Bearer <token>`

#### DELETE /collections/:id

Delete collection.

**Headers:** `Authorization: Bearer <token>`

### Coins

#### GET /coins

Get coins from user's collections.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `collection_id`: Filter by collection
- `country_id`: Filter by country
- `material_id`: Filter by material
- `year_from`: Filter by year range (start)
- `year_to`: Filter by year range (end)
- `condition`: Filter by condition
- `search`: Search in denomination, description
- `page`: Page number
- `limit`: Items per page
- `sort`: Sort field
- `order`: Sort order

#### POST /coins

Add new coin to collection.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "collection_id": 1,
  "country_id": 1,
  "material_id": 2,
  "denomination": "1 Euro",
  "year": 2020,
  "condition": "uncirculated",
  "rarity": "common",
  "purchase_price": 1.00,
  "current_value": 1.20,
  "purchase_date": "2024-01-01",
  "notes": "Commemorative coin",
  "weight": 8.5,
  "diameter": 23.25,
  "thickness": 2.33,
  "mintage": 1000000
}
```

#### GET /coins/:id

Get specific coin details.

**Headers:** `Authorization: Bearer <token>`

#### PUT /coins/:id

Update coin information.

**Headers:** `Authorization: Bearer <token>`

#### DELETE /coins/:id

Delete coin from collection.

**Headers:** `Authorization: Bearer <token>`

#### POST /coins/:id/images

Upload coin images.

**Headers:** `Authorization: Bearer <token>`

**Content-Type:** `multipart/form-data`

**Form Data:**
- `images`: Image files (multiple allowed)
- `image_type`: front, back, edge, detail

#### DELETE /coins/:id/images/:imageId

Delete coin image.

**Headers:** `Authorization: Bearer <token>`

### Reference Data

#### GET /countries

Get list of countries.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "United States",
      "code": "US",
      "flag_url": "https://flagcdn.com/w320/us.png"
    }
  ]
}
```

#### GET /materials

Get list of materials.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Gold",
      "description": "Precious metal",
      "density": 19.32
    }
  ]
}
```

#### GET /conditions

Get list of coin conditions.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "value": "uncirculated",
      "label": "Uncirculated (UNC)",
      "description": "No wear, original mint luster"
    }
  ]
}
```

### Wishlist

#### GET /wishlist

Get user's wishlist items.

**Headers:** `Authorization: Bearer <token>`

#### POST /wishlist

Add item to wishlist.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "country_id": 1,
  "denomination": "Morgan Dollar",
  "year": 1921,
  "condition": "uncirculated",
  "max_price": 100.00,
  "priority": 3,
  "notes": "Looking for nice example"
}
```

#### PUT /wishlist/:id

Update wishlist item.

**Headers:** `Authorization: Bearer <token>`

#### DELETE /wishlist/:id

Remove item from wishlist.

**Headers:** `Authorization: Bearer <token>`

### Sharing

#### POST /collections/:id/share

Share collection with another user.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "email": "friend@example.com",
  "permission": "view",
  "message": "Check out my coin collection!"
}
```

#### GET /shared

Get collections shared with user.

**Headers:** `Authorization: Bearer <token>`

#### PUT /shared/:id

Update sharing permissions.

**Headers:** `Authorization: Bearer <token>`

#### DELETE /shared/:id

Remove sharing access.

**Headers:** `Authorization: Bearer <token>`

### Backup & Export

#### POST /backup

Create backup of user data.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "include_images": true,
  "format": "json",
  "encryption": true
}
```

#### GET /backup

Get list of user backups.

**Headers:** `Authorization: Bearer <token>`

#### GET /backup/:id/download

Download backup file.

**Headers:** `Authorization: Bearer <token>`

#### POST /export

Export collection data.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "collection_id": 1,
  "format": "csv",
  "include_images": false,
  "fields": ["denomination", "year", "country", "condition", "value"]
}
```

### Analytics

#### GET /analytics/dashboard

Get dashboard analytics.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "total_coins": 150,
    "total_value": 5250.75,
    "collections_count": 3,
    "countries_count": 12,
    "recent_additions": 5,
    "value_trend": [
      {"date": "2024-01-01", "value": 5000.00},
      {"date": "2024-01-02", "value": 5250.75}
    ]
  }
}
```

#### GET /analytics/collection/:id

Get collection-specific analytics.

**Headers:** `Authorization: Bearer <token>`

### Notifications

#### GET /notifications

Get user notifications.

**Headers:** `Authorization: Bearer <token>`

#### PUT /notifications/:id/read

Mark notification as read.

**Headers:** `Authorization: Bearer <token>`

#### POST /notifications/subscribe

Subscribe to push notifications.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
      "p256dh": "key",
      "auth": "auth"
    }
  }
}
```

### Search

#### GET /search

Global search across collections.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `q`: Search query
- `type`: Search type (coins, collections, all)
- `filters`: JSON object with filters

### AI Recognition

#### POST /ai/recognize

Recognize coin from image using AI.

**Headers:** `Authorization: Bearer <token>`

**Content-Type:** `multipart/form-data`

**Form Data:**
- `image`: Coin image file
- `analysis_type`: basic, detailed, comprehensive

**Response:**
```json
{
  "success": true,
  "data": {
    "confidence": 0.85,
    "predictions": {
      "country": "United States",
      "denomination": "Quarter",
      "year": 2020,
      "material": "Cupronickel",
      "condition": "very_fine"
    },
    "alternatives": [
      {
        "confidence": 0.72,
        "country": "United States",
        "denomination": "Quarter",
        "year": 2019
      }
    ]
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `AUTHENTICATION_REQUIRED` | Valid authentication token required |
| `INSUFFICIENT_PERMISSIONS` | User lacks required permissions |
| `RESOURCE_NOT_FOUND` | Requested resource not found |
| `DUPLICATE_RESOURCE` | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `FILE_TOO_LARGE` | Uploaded file exceeds size limit |
| `INVALID_FILE_TYPE` | Unsupported file type |
| `ACCOUNT_LOCKED` | Account temporarily locked |
| `INTERNAL_ERROR` | Internal server error |

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Unprocessable Entity
- `429` - Too Many Requests
- `500` - Internal Server Error
- `503` - Service Unavailable

## Webhooks

The API supports webhooks for real-time notifications:

### Webhook Events

- `coin.created` - New coin added
- `coin.updated` - Coin information updated
- `coin.deleted` - Coin removed
- `collection.created` - New collection created
- `collection.shared` - Collection shared
- `backup.completed` - Backup process completed
- `user.login` - User logged in
- `security.alert` - Security event detected

### Webhook Payload

```json
{
  "event": "coin.created",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "data": {
    "coin_id": 123,
    "collection_id": 1,
    "user_id": 1
  },
  "signature": "sha256=..."
}
```

## SDKs and Libraries

### JavaScript/TypeScript

```bash
npm install @coin-collection/api-client
```

```javascript
import { CoinCollectionAPI } from '@coin-collection/api-client';

const api = new CoinCollectionAPI({
  baseURL: 'https://your-app.vercel.app/api',
  apiKey: 'your-api-key'
});

// Get collections
const collections = await api.collections.list();

// Add coin
const coin = await api.coins.create({
  collection_id: 1,
  denomination: '1 Euro',
  year: 2020
});
```

### Python

```bash
pip install coin-collection-api
```

```python
from coin_collection_api import CoinCollectionAPI

api = CoinCollectionAPI(
    base_url='https://your-app.vercel.app/api',
    api_key='your-api-key'
)

# Get collections
collections = api.collections.list()

# Add coin
coin = api.coins.create({
    'collection_id': 1,
    'denomination': '1 Euro',
    'year': 2020
})
```

## Testing

### Postman Collection

Import the Postman collection for easy API testing:

```
https://your-app.vercel.app/api/docs/postman.json
```

### OpenAPI Specification

View the complete OpenAPI specification:

```
https://your-app.vercel.app/api/docs/openapi.json
```

## Support

For API support and questions:

- **Documentation**: https://your-app.vercel.app/docs
- **Email**: api-support@your-domain.com
- **GitHub Issues**: https://github.com/your-username/coin-collection-app/issues
- **Discord**: https://discord.gg/your-server

## Changelog

### v1.0.0 (2024-01-01)
- Initial API release
- Authentication and user management
- Collection and coin management
- File upload and image handling
- Search and filtering
- Analytics and reporting
- PWA support
- AI recognition features