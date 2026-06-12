# Microsoft Clarity Setup Guide
**Date:** 2026-06-12
**Status:** Ready for configuration

## What is Clarity?

Microsoft Clarity is a free behavioral analytics tool that provides:
- **Session Recordings** - Watch exactly what users do on your site
- **Heatmaps** - See where users click and how far they scroll
- **Rage Clicks** - Detect user frustration (rapid clicking)
- **Dead Clicks** - Find broken or confusing UI elements
- **JavaScript Errors** - Catch client-side bugs
- **Filters** - Segment recordings by custom events

## Setup Steps

### 1. Create Clarity Project

1. Go to https://clarity.microsoft.com
2. Sign in with Microsoft account
3. Click "Add new project"
4. Enter project name: `Warehouse Tire Direct`
5. Add site URL: `shop.warehousetiredirect.com`
6. Also add: `shop.warehousetire.net` (local site)

### 2. Get Project ID

After creating the project:
1. Go to Settings → Setup
2. Copy the project ID (looks like: `abc123xyz`)
3. You DON'T need the full script - we've already integrated it

### 3. Configure Environment Variable

**Local (.env.local):**
```
NEXT_PUBLIC_CLARITY_PROJECT_ID=your_project_id_here
```

**Vercel:**
1. Go to Project Settings → Environment Variables
2. Add: `NEXT_PUBLIC_CLARITY_PROJECT_ID` = `your_project_id_here`
3. Deploy to activate

### 4. Verify Installation

After deployment:
1. Visit the live site
2. Go to Clarity dashboard → Setup
3. Should show "Active" status within 30 minutes

## Custom Events We Track

These events are tagged for easy filtering in Clarity:

| Event | Trigger | Use Case |
|-------|---------|----------|
| `product_view_tire` | User views tire PDP | Find sessions that viewed products |
| `product_view_wheel` | User views wheel PDP | Filter by product type |
| `add_to_cart_tire` | User adds tire to cart | Find successful conversions |
| `add_to_cart_wheel` | User adds wheel to cart | Compare tire vs wheel behavior |

## Custom Tags

| Tag | Values | Description |
|-----|--------|-------------|
| `product_type` | tire, wheel, accessory | What they're looking at |
| `vehicle_make` | Ford, Toyota, etc. | Their vehicle |

## Session Priority

Sessions are automatically marked as high priority ("upgraded") when:
- User adds anything to cart (`cart_activity`)

This ensures conversion-related sessions are always recorded.

---

# 7-Day Analysis Plan

## Goal

Understand why product views aren't converting to cart adds.

**Current metrics:**
- Product views (30d): ~48,000 human sessions
- Cart adds (30d): 95 events
- Conversion rate: 0.20% (target: 5-10%)

## Data Collection (Days 1-7)

Let Clarity collect session recordings. Expected volume:
- ~1,600 product views per day
- ~3 cart adds per day
- 10,000+ recordings by day 7

## Analysis Session (Day 8)

### Filter: Product View → No Cart

In Clarity dashboard:
1. Go to Recordings
2. Filter by: Custom Event = `product_view_tire` OR `product_view_wheel`
3. Exclude: Custom Event = `add_to_cart_tire` OR `add_to_cart_wheel`
4. Sort by: Duration (longest first)

### Watch 100 Sessions

Review recordings looking for:

#### A. Technical Issues
- [ ] Page load failures
- [ ] JavaScript errors
- [ ] Missing images
- [ ] Broken buttons
- [ ] Layout shifts

#### B. UX Friction
- [ ] Confusion about pricing
- [ ] Couldn't find add-to-cart
- [ ] Scroll past CTA without seeing it
- [ ] Vehicle selector confusion
- [ ] Size selector issues

#### C. Content Gaps
- [ ] Left after reading specs
- [ ] Looked for info not present
- [ ] Opened multiple tabs (comparing)
- [ ] Scrolled to reviews (none?)

#### D. Abandonment Points
- [ ] Left on price reveal
- [ ] Left on fitment warning
- [ ] Left on shipping cost
- [ ] Left on quantity selector

### Heatmap Analysis

1. Go to Heatmaps → Click maps
2. Select tire PDP URL pattern: `/tires/*`
3. Look for:
   - Dead zones around CTAs
   - Unexpected click targets
   - Scroll drop-off points

### Scroll Depth

1. Go to Heatmaps → Scroll maps
2. Check: What % see the add-to-cart button?
3. Target: 90%+ should see CTA without scrolling

## Deliverables Template

After 7 days, complete this analysis:

```markdown
# Clarity Analysis Report
**Date:** [DATE]
**Sessions Reviewed:** 100

## Top Abandonment Reasons

### 1. [REASON] (XX% of sessions)
- Description: 
- Example session ID:
- Screenshot: [ATTACH]
- Recommended fix:
- Estimated impact:

### 2. [REASON] (XX% of sessions)
...

## Technical Issues Found

1. [ISSUE] - [FREQUENCY]
2. ...

## Recommended Fixes (Priority Order)

| Fix | Effort | Expected Impact | Revenue Estimate |
|-----|--------|-----------------|------------------|
| 1. | | | |
| 2. | | | |

## Revenue Impact Calculation

- Current conversion: 0.20%
- Target conversion: 2% (10x improvement)
- Monthly product views: ~48,000
- Average order value: $X
- Monthly revenue potential: $X
```

---

## Quick Reference

**Clarity Dashboard:** https://clarity.microsoft.com

**Key Filters:**
- Rage clicks: Shows frustrated users
- Dead clicks: Shows broken UI
- JavaScript errors: Shows bugs
- Custom events: Our tracked events

**Session Recording Controls:**
- Speed: 2x, 4x for faster review
- Skip inactivity: Auto-skip idle time
- Click indicators: Shows where they clicked
