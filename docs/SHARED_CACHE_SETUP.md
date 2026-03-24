# Shared Cache Setup (Upstash Redis)

## Overview

The wheel availability cache now uses **Upstash Redis** for cross-instance sharing in Vercel serverless.

### Why Shared Cache?

Production testing (March 2026) showed:
- Instance-local pre-warm hit rate: **0%**
- Users almost never hit the pre-warmed instance
- Pre-warm effort was completely wasted

Shared cache ensures pre-warm benefits ALL serverless instances.

## Current Status ✅

**Setup Complete (March 24, 2026)**

- Upstash Redis database: `upstash-kv-celeste-yacht`
- Connected via Vercel Integration (auto-configured env vars)
- Latency: 15-20ms
- Plan: Free tier

## Environment Variables

The Vercel Upstash integration auto-sets these variables:

```bash
# Auto-set by Vercel Upstash Integration
KV_REST_API_URL=https://...upstash.io
KV_REST_API_TOKEN=...

# Alternative naming (also supported)
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

The `sharedCache.ts` module checks for both naming conventions.

### Manual Setup (if not using Vercel Integration)

1. Go to [console.upstash.com](https://console.upstash.com)
2. Create a new Redis database (or use existing)
3. Select "REST API" tab
4. Copy URL and Token to your Vercel project env vars

## How It Works

### Cache Key Format
```
wt:avail:{sku}:minQty={qty}
```

### TTL
30 minutes (same as original design)

### Fallback Behavior
If Redis is unavailable:
1. Falls back to local in-memory cache
2. Logs warning
3. Never blocks requests

### Pre-Warm
Pre-warm now writes to shared Redis cache:
- Runs every 25 minutes (via cron or manual trigger)
- Warms top vehicle patterns (F-150, Silverado, Ram 1500, etc.)
- Results benefit ALL instances

## Monitoring

### Status Endpoint
```
GET /api/warmup/availability?action=status
```

Returns:
```json
{
  "ok": true,
  "cache": {
    "enabled": true,
    "healthy": true,
    "hits": 1234,
    "misses": 56,
    "hitRate": 0.956,
    "prewarmedHits": 890,
    "errors": 0,
    "avgLatencyMs": 12
  },
  "health": {
    "redis": {
      "connected": true,
      "latencyMs": 8
    }
  },
  "sharedCacheEnabled": true
}
```

### Key Metrics to Watch
- `hitRate` - should be 70%+ after warm-up
- `prewarmedHits` - should be >0 (was always 0 before)
- `avgLatencyMs` - should be <50ms
- `errors` - should be 0

## Testing

### Manual Pre-Warm
```
GET /api/warmup/availability?action=run&targets=F-150&maxSkus=50
```

### Clear Cache (Testing Only)
```
GET /api/warmup/availability?action=clear-cache
```

### Reset Metrics
```
GET /api/warmup/availability?action=reset-metrics
```

## Cost Estimate

Upstash free tier: 10,000 commands/day
Expected usage: ~5,000-8,000 commands/day (typical traffic)

For higher traffic, Upstash Pro starts at $10/month.

## Files Changed

- `src/lib/sharedCache.ts` - New shared cache module
- `src/lib/availabilityCache.ts` - Updated to use shared cache
- `src/lib/availabilityPrewarm.ts` - Updated for bulk cache writes
- `src/app/api/warmup/availability/route.ts` - Health check endpoints
