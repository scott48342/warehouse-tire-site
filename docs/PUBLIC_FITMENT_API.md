# Public Fitment API

## Overview

The Public Fitment API provides read-only access to vehicle fitment data for external integrations. It is designed to be safe, performant, and isolated from the internal storefront.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      External Clients                          │
│                   (API Key Required)                           │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              /api/public/fitment/*                              │
│         (Auth + Rate Limiting + Caching)                        │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              src/lib/api/public-fitment-service.ts              │
│                  (Public-Safe Response Shapes)                  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   src/lib/fitment-db/*                          │
│               (Shared Fitment Engine)                           │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐       │
│  │  coverage.ts │  │ getFitment.ts│  │ profileService.ts│       │
│  └──────────────┘  └──────────────┘  └──────────────────┘       │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│               Prisma Postgres (vehicle_fitments)                │
└─────────────────────────────────────────────────────────────────┘
```

**Key Points:**
- Public API and storefront share the same fitment engine
- No database duplication
- Rate limiting ONLY affects public API
- Internal storefront endpoints remain unprotected/unrestricted

---

## Endpoints

### GET /api/public/fitment/years
Get all available years, optionally filtered by make/model.

**Query Parameters:**
- `make` (optional): Filter by make
- `model` (optional): Filter by model (requires make)

**Example:**
```bash
curl -H "X-API-Key: YOUR_KEY" \
  "https://api.example.com/api/public/fitment/years?make=ford&model=mustang"
```

**Response:**
```json
{
  "success": true,
  "data": [
    { "year": 2024 },
    { "year": 2023 },
    { "year": 2022 }
  ],
  "meta": { "count": 3, "filter": { "make": "ford", "model": "mustang" } }
}
```

---

### GET /api/public/fitment/makes
Get all available makes, optionally filtered by year.

**Query Parameters:**
- `year` (optional): Filter by year

**Example:**
```bash
curl -H "X-API-Key: YOUR_KEY" \
  "https://api.example.com/api/public/fitment/makes?year=2020"
```

**Response:**
```json
{
  "success": true,
  "data": [
    { "make": "ford", "displayName": "Ford" },
    { "make": "chevrolet", "displayName": "Chevrolet" }
  ],
  "meta": { "count": 2, "filter": { "year": 2020 } }
}
```

---

### GET /api/public/fitment/models
Get models for a make, optionally filtered by year.

**Query Parameters:**
- `make` (required): Make name
- `year` (optional): Filter by year

**Example:**
```bash
curl -H "X-API-Key: YOUR_KEY" \
  "https://api.example.com/api/public/fitment/models?make=ford&year=2020"
```

**Response:**
```json
{
  "success": true,
  "data": [
    { "model": "mustang", "displayName": "Mustang" },
    { "model": "f-150", "displayName": "F 150" }
  ],
  "meta": { "count": 2, "filter": { "make": "ford", "year": 2020 } }
}
```

---

### GET /api/public/fitment/trims
Get trims for a specific year/make/model.

**Query Parameters:**
- `year` (required): Vehicle year
- `make` (required): Make name
- `model` (required): Model name

**Example:**
```bash
curl -H "X-API-Key: YOUR_KEY" \
  "https://api.example.com/api/public/fitment/trims?year=2020&make=ford&model=mustang"
```

**Response:**
```json
{
  "success": true,
  "data": [
    { "trimId": "2020-gt-70f9f921", "name": "GT" },
    { "trimId": "2020-ecoboost-abc123", "name": "EcoBoost" }
  ],
  "meta": { "count": 2, "filter": { "year": 2020, "make": "ford", "model": "mustang" } }
}
```

---

### GET /api/public/fitment/specs
Get full fitment specifications for a vehicle trim.

**Query Parameters:**
- `year` (required): Vehicle year
- `make` (required): Make name
- `model` (required): Model name
- `trim` or `trimId` (required): Trim ID from /trims endpoint

**Example:**
```bash
curl -H "X-API-Key: YOUR_KEY" \
  "https://api.example.com/api/public/fitment/specs?year=2020&make=ford&model=mustang&trim=2020-gt-70f9f921"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "year": 2020,
    "make": "ford",
    "model": "mustang",
    "trim": "GT",
    "boltPattern": "5x114.3",
    "centerBore": 70.6,
    "threadSize": "M14x1.5",
    "isStaggered": false,
    "wheelSpecs": [
      { "diameter": 19, "width": 9, "offset": 45, "tireSize": "255/40R19", "position": "all" }
    ],
    "tireSizes": ["255/40R19", "275/40R19"]
  },
  "meta": { "filter": { "year": 2020, "make": "ford", "model": "mustang", "trim": "2020-gt-70f9f921" } }
}
```

---

## Authentication

All public API endpoints require an API key.

**Header Method (Recommended):**
```bash
curl -H "X-API-Key: YOUR_KEY" "https://api.example.com/api/public/fitment/years"
```

**Query Parameter Method:**
```bash
curl "https://api.example.com/api/public/fitment/years?api_key=YOUR_KEY"
```

**Error Response (401):**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing API key",
  "hint": "Include X-API-Key header or api_key query parameter"
}
```

---

## Rate Limiting

Rate limits are enforced per API key using a sliding window.

| Tier    | Requests/Minute |
|---------|-----------------|
| Free    | 60              |
| Basic   | 120             |
| Premium | 600             |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 32
```

**Rate Limited Response (429):**
```json
{
  "error": "Rate Limited",
  "message": "Too many requests. Please slow down.",
  "retryAfter": 32
}
```

---

## Caching

Public API responses include cache headers:

```
Cache-Control: public, max-age=300, s-maxage=600
```

- Browser cache: 5 minutes
- CDN cache: 10 minutes

---

## Error Handling

**Standard Error Response:**
```json
{
  "success": false,
  "error": {
    "message": "year, make, and model parameters are required",
    "code": "MISSING_PARAMS"
  }
}
```

**Error Codes:**
- `MISSING_PARAMS` - Required parameters not provided
- `INVALID_YEAR` - Year parameter is not valid
- `MISSING_MAKE` - Make parameter required but not provided
- `NOT_FOUND` - Requested vehicle not found

---

## File Structure

```
src/
├── app/api/public/fitment/
│   ├── years/route.ts
│   ├── makes/route.ts
│   ├── models/route.ts
│   ├── trims/route.ts
│   └── specs/route.ts
└── lib/api/
    ├── index.ts
    ├── auth.ts              # API key validation
    ├── rate-limit.ts        # Rate limiting logic
    ├── middleware.ts        # withPublicApi() wrapper
    └── public-fitment-service.ts  # Public response shapes
```

---

## Configuration

**Environment Variables:**

```env
# Format: key1:clientId1:tier1,key2:clientId2:tier2
PUBLIC_API_KEYS=abc123:client1:free,xyz789:client2:premium
```

In development, a default key `dev_test_key_12345` is available.

---

## Validation

Run the validation script to test all endpoints:

```bash
node scripts/validate-public-api.js http://localhost:3001
```

This tests:
- API key authentication (reject without, accept with)
- Internal endpoints unaffected (no auth required)
- All public endpoints return valid data
- Known vehicles return correct specs
