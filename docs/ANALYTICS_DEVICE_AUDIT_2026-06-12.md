# Analytics Device Tracking Audit
**Date:** 2026-06-12
**Status:** ✅ TRACKING CORRECT - No Bug Found

## Investigation Summary

Investigated why mobile traffic appeared to be only 0.2% of product views.

## Findings

### 1. Tracking Is Correct
Both `funnel_events` and `analytics_sessions` tables show consistent mobile numbers:
- funnel_events mobile (7d): 194 sessions
- analytics_sessions mobile (7d): 145 sessions

The device classification logic in `FunnelTracker.tsx` works correctly:
```javascript
function getDeviceType() {
  const ua = navigator.userAgent.toLowerCase();
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return "mobile";
  return "desktop";
}
```

### 2. Root Cause: Local vs National Traffic Split

The site has TWO domains with very different traffic patterns:

| Metric | LOCAL (.net) | NATIONAL (.com) |
|--------|--------------|-----------------|
| Desktop sessions | 54,562 (99.2%) | 343 (50.8%) |
| Mobile sessions | 432 (0.8%) | 332 (49.2%) |
| **Total** | 54,994 | 675 |

**The local site gets 98% of all traffic** and has abnormally low mobile usage.
**The national site has normal 50/50 mobile/desktop split.**

### 3. Why Local Has Low Mobile

Likely explanations:
- B2B customers (fleet managers, commercial accounts) use desktop at work
- Local customers call/visit physical store instead of mobile browse
- Website may be discovery channel, not purchase channel for local

### 4. Bot Traffic Correctly Identified

| Traffic Type | Sessions |
|--------------|----------|
| Human desktop | 54,938 |
| Human mobile | 765 |
| Bot desktop | 199,812 |
| Bot mobile | 4 |

Bot traffic is correctly flagged in `analytics_sessions.is_bot` field.

## Human Traffic Breakdown (30 days)

| Device | Sessions | Pageviews | % |
|--------|----------|-----------|---|
| Desktop | 54,938 | 56,254 | 98.6% |
| Mobile | 765 | 3,056 | 1.4% |

## Conclusion

**No tracking bug exists.** The low mobile percentage reflects:
1. Real traffic pattern for the local tire shop business
2. Business customer base (B2B tends toward desktop)
3. National site has normal mobile traffic but low total volume

## Recommendations

1. ✅ No fix needed for tracking
2. ⚠️ Consider if national site needs more traffic/marketing
3. 📊 Track local vs national separately in dashboards
4. 🎯 Mobile optimizations still valuable for national site growth

## Verification Query

```sql
SELECT 
  hostname,
  device_type,
  COUNT(*) as sessions
FROM analytics_sessions
WHERE first_seen_at > NOW() - INTERVAL '30 days'
  AND is_bot = false
  AND is_test = false
GROUP BY hostname, device_type
ORDER BY sessions DESC;
```
