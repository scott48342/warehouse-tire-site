# Add-to-Cart Funnel Audit Report
**Date:** 2026-06-12
**Status:** Fixes Implemented

## Executive Summary

Investigation into why 194,396 product views produced only 39 cart adds (0.02% rate).

**Root Causes Found:**
1. **70% of product views are bots** — not filtered in analytics
2. **Mobile sticky CTA is broken** — anchor link instead of real add-to-cart button
3. **Mobile traffic at 0.2%** — impossibly low for e-commerce

**After bot filtering:**
- Real human product views: 48,335
- Real conversion rate: 0.20% (still low, but 10x better than reported)

---

## Key Metrics (30-day Human Traffic Only)

| Funnel Step | Events | Sessions | Rate |
|-------------|--------|----------|------|
| Sessions | 55,414 | 55,414 | - |
| Product Views | 48,335 | 48,245 | 87.3% |
| **Add to Cart** | **95** | **51** | **0.20%** |
| Begin Checkout | 32 | 29 | 33.7% |
| Purchase | 4 | 2 | 12.5% |

**Industry benchmark:** 5-10% product view → cart rate
**Our rate:** 0.20% (25x below standard)

---

## Issues Found

### 1. Mobile Sticky CTA Was Broken (CRITICAL)

**Problem:** The mobile sticky footer "Add to Cart" button was just an anchor link that scrolled the page — it didn't actually add to cart.

```tsx
// BEFORE (broken)
<a href="#add-to-cart" className="...">Add to Cart</a>

// AFTER (fixed)
<MobileStickyAddToCart type="tire" sku={...} brand={...} ... />
```

**Files Fixed:**
- `src/app/tires/[sku]/page.tsx` — 2 instances (TireWeb + WheelPros sections)
- `src/app/wheels/[sku]/page.tsx` — 1 instance

**New Component Created:**
- `src/components/MobileStickyAddToCart.tsx` — Client component that actually adds to cart

### 2. Bot Traffic Not Filtered (MAJOR)

**Problem:** 70% of `product_view` events came from bots (Googlebot, Bingbot, headless browsers, etc.)

| Traffic Type | Product Views |
|--------------|---------------|
| Bot | 113,398 (70%) |
| Human | 48,333 (30%) |

**Fix Applied:**
- Added `isBot()` detection to `/api/analytics/track`
- Bot flag now stored in event metadata for filtering
- File: `src/app/api/analytics/track/route.ts`

### 3. Mobile Traffic Crisis (NEEDS INVESTIGATION)

**Problem:** Only 0.2% of human product views are from mobile devices.

| Device | Sessions | % |
|--------|----------|---|
| Desktop | 48,140 | 99.8% |
| Mobile | 105 | 0.2% |
| Tablet | 2 | 0.0% |

**Expected:** Mobile should be 50-70% of e-commerce traffic

**Possible causes (needs further investigation):**
- Site may be broken on mobile (long load times, render blocking)
- SEO/indexing issue preventing mobile traffic
- Tracking may be broken on mobile browsers
- JavaScript errors blocking mobile tracker

**Recommended action:** Set up Real User Monitoring (RUM) and Core Web Vitals tracking for mobile.

---

## Files Changed

1. **NEW: `src/components/MobileStickyAddToCart.tsx`**
   - Client component for mobile sticky add-to-cart
   - Works for both tires and wheels
   - Properly integrates with cart context

2. **MODIFIED: `src/app/tires/[sku]/page.tsx`**
   - Added import for MobileStickyAddToCart
   - Replaced 2 broken anchor links with real add-to-cart buttons

3. **MODIFIED: `src/app/wheels/[sku]/page.tsx`**
   - Added import for MobileStickyAddToCart
   - Replaced 1 broken anchor link with real add-to-cart button

4. **MODIFIED: `src/app/api/analytics/track/route.ts`**
   - Added `isBot()` detection function
   - Bot flag now stored in event metadata

---

## Deployment Steps

1. Test locally on mobile viewport
2. Deploy to preview/staging
3. Verify mobile sticky CTA works on iOS Safari and Android Chrome
4. Monitor funnel metrics for 7 days
5. Investigate mobile traffic anomaly

---

## Expected Impact

| Metric | Before | After (Projected) |
|--------|--------|-------------------|
| Mobile CTA clicks | ~0 | Baseline + conversions |
| Product → Cart rate | 0.20% | 1-3% (industry: 5-10%) |
| Mobile traffic accuracy | Undercounted | Accurate |

---

## Remaining Issues

1. **Mobile traffic at 0.2%** — needs RUM investigation
2. **Checkout → Purchase at 12.5%** — needs checkout UX review
3. **Cart → Checkout at 33.7%** — acceptable but could improve
4. **No heatmap data** — consider Hotjar/FullStory for scroll/click analysis

---

## Analytics Query for Monitoring

```sql
-- Human-only funnel (excludes bots)
SELECT 
  event_name,
  COUNT(*)::int as total,
  COUNT(DISTINCT session_id)::int as unique_sessions
FROM funnel_events 
WHERE created_at > NOW() - INTERVAL '7 days'
  AND (metadata->>'isBot')::boolean IS NOT TRUE
  AND user_agent NOT ILIKE '%bot%'
  AND user_agent NOT ILIKE '%crawl%'
  AND user_agent NOT ILIKE '%spider%'
  AND user_agent NOT ILIKE '%googlebot%'
GROUP BY event_name
ORDER BY total DESC;
```
