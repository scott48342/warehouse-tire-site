# Wheel Availability Cache Pre-Warming

## Overview

The availability cache pre-warm system proactively caches wheel availability data for high-frequency vehicle searches before users request them. This significantly reduces response times for common truck/SUV searches.

## Cache Key Structure

```
Format: ${sku}|minQty=${minQty}

Examples:
- "W1234567|minQty=4"  → Standard consumer order (4 wheels)
- "W1234567|minQty=1"  → Single wheel replacement
```

The cache key includes `minQty` because availability depends on stock thresholds—a SKU may be available for qty=1 but not qty=4.

## Target Vehicles

Priority 1 (Highest Traffic):
| Vehicle | Bolt Pattern | Center Bore | Notes |
|---------|-------------|-------------|-------|
| Ford F-150 | 6x135 | 87.1mm | Best-selling truck in America |
| Chevy Silverado 1500 | 6x139.7 | 78.1mm | #2 best-selling truck |
| Ram 1500 | 5x139.7 | 77.8mm | #3 best-selling truck |

Priority 2:
| Vehicle | Bolt Pattern | Center Bore | Notes |
|---------|-------------|-------------|-------|
| Jeep Wrangler | 5x127 | 71.5mm | High-customization SUV |
| Toyota Tacoma | 6x139.7 | 106.1mm | Best-selling mid-size truck |
| Chevy Tahoe | 6x139.7 | 78.1mm | Popular full-size SUV |
| GMC Sierra 1500 | 6x139.7 | 78.1mm | GMC truck platform |

Priority 3:
| Vehicle | Bolt Pattern | Center Bore | Notes |
|---------|-------------|-------------|-------|
| Toyota Tundra | 5x150 | 110.1mm | Full-size Toyota truck |
| Ford Super Duty | 8x170 | 124.9mm | Heavy-duty Ford trucks |
| Jeep Grand Cherokee | 5x127 | 71.6mm | Popular Jeep SUV |

## Cache Configuration

| Setting | Default | Env Variable | Description |
|---------|---------|--------------|-------------|
| TTL | 30 min | `WT_AVAIL_CACHE_TTL_MS` | How long cached entries are valid |
| Max Size | 10,000 | - | Max entries before LRU eviction |
| Concurrency | 8 | - | Parallel API calls during pre-warm |
| Max SKUs/Pattern | 200 | - | Limit per bolt pattern |

## API Endpoints

### Status/Control Endpoint

```
GET /api/warmup/availability?action=status
```

Actions:
- `status` - Get current cache stats and pre-warm status
- `run` - Trigger a pre-warm job immediately
- `start-scheduler` - Start the automatic pre-warm scheduler
- `stop-scheduler` - Stop the scheduler
- `clear-cache` - Clear all cached entries
- `reset-metrics` - Reset hit/miss counters

### Parameters

```
GET /api/warmup/availability?action=run&targets=F-150,Silverado&maxSkus=100&dryRun=1
```

- `targets` - Comma-separated vehicle names or bolt patterns to warm
- `maxSkus` - Max SKUs per pattern (default: 200)
- `dryRun` - Simulate without API calls

### POST for Pre-Warm

```
POST /api/warmup/availability
Content-Type: application/json

{
  "targets": ["F-150", "Silverado"],
  "maxSkusPerPattern": 100,
  "concurrency": 8,
  "dryRun": false
}
```

## Scheduled Job

The pre-warm scheduler runs every 25 minutes (5 minutes before cache TTL expiry) to ensure the cache stays warm.

### Start Scheduler

```
GET /api/warmup/availability?action=start-scheduler
```

Or via the main warmup endpoint with availability flag:

```
GET /api/warmup?availability=1
```

### Cron Configuration

For production, add a cron job that calls the warmup endpoint:

```bash
# Every 25 minutes
*/25 * * * * curl -s "https://your-site.com/api/warmup/availability?action=run" > /dev/null
```

Or for Vercel/Next.js cron:

```json
// vercel.json
{
  "crons": [{
    "path": "/api/warmup/availability?action=run",
    "schedule": "*/25 * * * *"
  }]
}
```

## Metrics & Monitoring

The cache tracks:
- `hits` - Total cache hits
- `misses` - Total cache misses
- `hitRate` - hits / (hits + misses)
- `prewarmedEntries` - Entries added by pre-warm
- `prewarmedHits` - Hits on pre-warmed entries
- `lastPrewarmAt` - Timestamp of last pre-warm
- `lastPrewarmDurationMs` - Duration of last pre-warm
- `lastPrewarmSkusWarmed` - SKUs cached in last pre-warm

Access via:
```
GET /api/warmup/availability?action=status
```

Response includes:
```json
{
  "cache": {
    "size": 1500,
    "maxSize": 10000,
    "ttlMs": 1800000,
    "hits": 4521,
    "misses": 892,
    "hitRate": 0.835,
    "prewarmedEntries": 1200,
    "prewarmedHits": 3800,
    "lastPrewarmAt": "2024-01-15T10:30:00Z",
    "lastPrewarmDurationMs": 45000,
    "lastPrewarmSkusWarmed": 1200
  }
}
```

## CLI Scripts

### Run Pre-Warm Manually

```bash
cd warehouse-tire-site
npx tsx scripts/prewarm-availability.ts

# Options:
--dry-run       # Simulate without API calls
--targets       # Comma-separated targets (e.g., "F-150,Silverado")
--max-skus      # Max SKUs per pattern
--concurrency   # Parallel API calls
--verbose       # Show detailed output
```

### Validate Performance

```bash
npx tsx scripts/validate-prewarm.ts
```

This script:
1. Clears the cache
2. Tests cold-start performance
3. Runs pre-warm
4. Tests warm performance
5. Compares results

## Impact on Search Flow

The wheel fitment search (`/api/wheels/fitment-search`) now:

1. Gets candidate SKUs from techfeed index (fast, local)
2. Validates fitment against vehicle profile (fast, local)
3. **Checks availability cache** (centralized, pre-warmable)
4. For cache misses, calls WheelPros API (slow, external)

Pre-warming ensures step 3 returns cache hits for common vehicles, skipping the slow step 4.

## Response Timing Fields

The fitment-search response includes timing data:

```json
{
  "timing": {
    "totalMs": 234,
    "availabilityMs": 89,
    "availabilityChecked": 150,
    "availabilityCacheHits": 142,
    "availabilityPrewarmHits": 138
  }
}
```

- `availabilityCacheHits` - Total hits (includes pre-warm and regular)
- `availabilityPrewarmHits` - Hits specifically on pre-warmed entries

## Best Practices

1. **Run pre-warm before peak hours** - Schedule to run before your busiest times
2. **Monitor hit rates** - Target >80% hit rate for pre-warmed patterns
3. **Adjust targets based on traffic** - Update `PREWARM_TARGETS` based on actual search patterns
4. **Don't over-warm** - More targets = longer pre-warm time and more API load
5. **Respect rate limits** - Keep concurrency reasonable (8-16 max)

## Troubleshooting

### Low Hit Rate

- Check if targets match actual user searches
- Verify pre-warm is running (check `lastPrewarmAt`)
- Ensure TTL is longer than pre-warm interval

### Slow Pre-Warm

- Reduce `maxSkusPerPattern`
- Check WheelPros API response times
- Reduce concurrency if hitting rate limits

### Cache Not Persisting

- Note: This is an in-memory cache per server instance
- For multi-server deployments, each instance needs its own pre-warm
- Consider Redis for shared cache if needed
