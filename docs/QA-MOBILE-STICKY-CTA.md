# QA Test Plan: Mobile Sticky Add-to-Cart Fix
**Date:** 2026-06-12
**Build Status:** ✅ PASSED

## Pre-Deployment Checklist

### 1. iPhone Safari - Tire PDP
- [ ] Navigate to `/tires/IHR0144K?source=tireweb&size=225%2F60R16`
- [ ] Verify sticky footer visible at bottom of screen
- [ ] Verify shows "$70.15 per tire" pricing
- [ ] Tap "Add 4 — $280.60" button ONCE
- [ ] Verify cart drawer opens
- [ ] Verify 4 tires added (not just scrolled)
- [ ] Verify `add_to_cart` event fires in Network tab

### 2. Android Chrome - Tire PDP
- [ ] Same tests as iPhone Safari above
- [ ] Verify button is tappable (no touch issues)
- [ ] Verify loading spinner shows during add

### 3. iPhone Safari - Wheel PDP
- [ ] Navigate to `/wheels/[any-valid-sku]?year=2022&make=Ford&model=F-150`
- [ ] Verify sticky footer visible at bottom
- [ ] Verify shows "$XXX.XX per wheel" pricing
- [ ] Tap "Add 4 — $X,XXX.XX" button ONCE
- [ ] Verify cart drawer opens
- [ ] Verify 4 wheels added (not just scrolled)

### 4. Android Chrome - Wheel PDP
- [ ] Same tests as iPhone Safari above

### 5. Quantity Verification
- [ ] Tires: Default quantity = 4
- [ ] Wheels: Default quantity = 4
- [ ] Total price = unit price × quantity

### 6. Analytics Verification
- [ ] Open DevTools > Network
- [ ] Filter by "track"
- [ ] Tap mobile sticky CTA
- [ ] Verify POST to `/api/analytics/track` with:
  - `eventName: "add_to_cart"`
  - `productSku: [correct SKU]`
  - `productType: "tire"` or `"wheel"`
- [ ] Verify only ONE event fires (not duplicated)

### 7. Desktop Behavior (Regression)
- [ ] Navigate to tire PDP on desktop
- [ ] Verify mobile sticky footer is HIDDEN (`md:hidden`)
- [ ] Verify main add-to-cart button still works
- [ ] Verify no visual changes to desktop layout

### 8. Bot Filtering
- [ ] Check recent events in DB
- [ ] Verify `metadata.isBot` field exists on new events
- [ ] Verify human traffic marked as `isBot: false`
- [ ] Test with bot user-agent string:
  ```bash
  curl -X POST https://shop.warehousetiredirect.com/api/analytics/track \
    -H "Content-Type: application/json" \
    -H "User-Agent: Googlebot/2.1" \
    -d '{"eventName":"test_bot","sessionId":"test123"}'
  ```
- [ ] Verify the event has `metadata.isBot: true`

## Test URLs

**Tire PDPs (TireWeb):**
- `/tires/IHR0144K?source=tireweb&size=225%2F60R16`
- `/tires/TOY355250?source=tireweb&size=265%2F70R17`

**Tire PDPs (WheelPros):**
- `/tires/[any-WP-sku]`

**Wheel PDPs:**
- `/wheels/for/2022-ford-f-150?year=2022&make=Ford&model=F-150` (pick any wheel from results)

## Expected Behavior

### Mobile Sticky CTA:
1. Fixed at bottom of viewport
2. Shows unit price + "per tire/wheel"
3. Button shows "Add [qty] — $[total]"
4. Tapping adds to cart immediately
5. Cart drawer opens
6. Button shows "Adding..." spinner briefly

### Analytics:
1. `add_to_cart` event fires once
2. Contains correct SKU and product type
3. Contains cart value
4. Human events have `isBot: false`
5. Bot events have `isBot: true`

## Sign-off

| Test | Tester | Date | Status |
|------|--------|------|--------|
| iPhone Safari Tire | | | |
| Android Chrome Tire | | | |
| iPhone Safari Wheel | | | |
| Android Chrome Wheel | | | |
| Quantity/Pricing | | | |
| Analytics Events | | | |
| Desktop Regression | | | |
| Bot Filtering | | | |

---

**Approved for production:** [ ] YES / [ ] NO

**Notes:**
