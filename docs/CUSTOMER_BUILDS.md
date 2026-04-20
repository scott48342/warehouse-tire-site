# Customer Build Submission System

**Date:** 2026-04-20  
**Status:** Implemented

## Overview

Allows customers to submit photos of their completed builds for inclusion in the gallery system. Customer submissions are prioritized over brand assets in gallery matching.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CUSTOMER FLOW                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Order Confirmation ──► AddYourBuildCTA ──► /add-your-build     │
│        Page                                      │               │
│                                                  ▼               │
│                                        Multi-step Form           │
│                                        1. Photos (1-5)           │
│                                        2. Vehicle info           │
│                                        3. Wheels/Tires           │
│                                        4. Details + consent      │
│                                        5. Review & submit        │
│                                                  │               │
│                                                  ▼               │
│                                     POST /api/builds/submit      │
│                                                  │               │
│                                                  ▼               │
│                                        customer_builds           │
│                                        (status: pending)         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN FLOW                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  /admin/builds ──► Review submissions ──► Approve/Reject/Flag   │
│        │                                         │               │
│        │                                         ▼               │
│        │                            (If approved)                │
│        │                                         │               │
│        │                                         ▼               │
│        │                          Sync to gallery_assets        │
│        │                          (parse_confidence: 'verified') │
│        │                                         │               │
│        └────────────────────────────────────────►│               │
│                                                  ▼               │
│                                         Gallery APIs             │
│                                    (prioritize verified > high)  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema

### customer_builds
Main submissions table with vehicle, products, and build details.

```sql
-- Key fields:
submission_id     -- UUID for public reference
status           -- pending | approved | rejected | flagged
vehicle_*        -- Year, make, model, trim, type
lift_*           -- Type, inches, brand
wheel_*          -- Brand, model, size, finish
tire_*           -- Brand, model, size
consent_gallery  -- Required for submission
is_featured      -- Manually featured builds
```

### customer_build_images
Individual images for each submission.

```sql
-- Key fields:
build_id        -- FK to customer_builds
original_url    -- Uploaded URL
cdn_url         -- CDN-optimized URL
thumbnail_url   -- Preview thumbnail
angle           -- front | side | rear | wheel_detail | interior | other
is_primary      -- Hero image flag
```

### Migration
```bash
# Run migration
psql $DATABASE_URL < drizzle/migrations/0023_customer_builds.sql
```

## API Endpoints

### POST /api/builds/upload
Uploads a single image to Vercel Blob storage.

**Request:** `multipart/form-data` with `file` field  
**Response:** `{ success, url, filename, size }`

### POST /api/builds/submit
Submits a complete build.

**Request:**
```json
{
  "customerEmail": "optional",
  "customerName": "optional",
  "orderId": "optional",
  "vehicleYear": 2024,
  "vehicleMake": "Ford",
  "vehicleModel": "F-150",
  "vehicleTrim": "Lariat",
  "vehicleType": "truck",
  "liftType": "lifted",
  "liftInches": 4,
  "liftBrand": "Rough Country",
  "wheelBrand": "Fuel",
  "wheelModel": "Rebel",
  "wheelDiameter": "20",
  "tireBrand": "Nitto",
  "tireModel": "Ridge Grappler",
  "tireSize": "35x12.50R20",
  "buildNotes": "Customer description",
  "instagramHandle": "@handle",
  "images": [
    { "url": "...", "angle": "front", "isPrimary": true },
    { "url": "...", "angle": "side" }
  ],
  "consentGallery": true,
  "consentMarketing": false
}
```

**Response:** `{ success, submissionId, message }`

### GET /api/admin/builds
List submissions (requires admin auth).

**Query params:**
- `status` - pending | approved | rejected | flagged
- `page` - Page number
- `limit` - Results per page (max 50)

**Headers:** `Authorization: Bearer {ADMIN_API_KEY}`

### PATCH /api/admin/builds
Update submission status.

**Request:**
```json
{
  "id": 123,
  "status": "approved",
  "moderatorNotes": "Great build!",
  "isFeatured": true
}
```

## Pages

### /add-your-build
Multi-step submission form.

**URL params (for prefill):**
- `orderId` - Link to order
- `year`, `make`, `model`, `trim` - Vehicle
- `wheelBrand`, `wheelModel`, `wheelDiameter` - Wheels
- `tireBrand`, `tireModel`, `tireSize` - Tires

### /admin/builds
Admin moderation dashboard.

**Features:**
- Filter by status (pending/approved/rejected/flagged)
- Quick approve/reject actions
- Detail modal with all submission info
- Feature toggle

## Components

### AddYourBuildCTA
Post-purchase prompt component.

```tsx
import { AddYourBuildCTA } from "@/components/AddYourBuildCTA";

// On order confirmation:
<AddYourBuildCTA
  orderId="ORD-123"
  vehicle={{ year: "2024", make: "Ford", model: "F-150" }}
  products={{ wheelBrand: "Fuel", wheelModel: "Rebel" }}
  variant="card"  // banner | card | minimal
  dismissible={true}
/>
```

**Variants:**
- `banner` - Full-width gradient banner
- `card` - Standalone card (default)
- `minimal` - Inline text link

## Gallery Integration

When a build is approved, it syncs to `gallery_assets` with:
- `source_asset_id`: `customer-{submissionId}-{imageId}`
- `parse_confidence`: `'verified'`
- `parse_notes`: `'Customer submission'`

### Priority Order
Gallery queries prioritize:
1. `verified` - Customer submissions
2. `high` - Brand assets with good parse
3. `medium` - Partial parse
4. `auto` - Auto-parsed fallback

This ensures customer builds appear before brand assets in matching results.

## Environment Variables

```env
# Admin API key for moderation
ADMIN_API_KEY=your-secret-key

# Vercel Blob (for image uploads)
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
```

## Future Enhancements

1. **Email follow-up** - Send reminder email 7 days after order
2. **Social sharing** - One-click share to Instagram/Facebook
3. **Build badges** - "Featured Build" badges on product pages
4. **Customer gallery page** - Browse all approved builds
5. **Build voting** - Community votes for "Build of the Month"
