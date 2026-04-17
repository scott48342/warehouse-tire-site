# Google Shopping Product Feed

## Overview

The Google Shopping feed endpoint generates a Google Merchant Center compatible product feed containing wheels and tires from Warehouse Tire Direct.

**Endpoint**: `/api/feeds/google-shopping`

## Features

- ✅ Google Merchant Center RSS 2.0 compatible XML format
- ✅ Includes both wheels and tires
- ✅ Proper pricing using pricingService (wheels: cost × 1.30, tires: MSRP × 0.85 + $50)
- ✅ Only in-stock products (minimum 4 units)
- ✅ Full URLs for product pages and images
- ✅ Pagination support for large inventories
- ✅ JSON debug format available

## API Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | string | `all` | Product type: `all`, `wheels`, `tires` |
| `format` | string | `xml` | Output format: `xml` or `json` |
| `offset` | number | `0` | Pagination offset |
| `limit` | number | `1000` | Max products per request (max: 5000) |

## Example URLs

```bash
# Full feed (first 1000 products)
GET /api/feeds/google-shopping

# Wheels only
GET /api/feeds/google-shopping?type=wheels

# Tires only  
GET /api/feeds/google-shopping?type=tires

# Paginated (products 1001-2000)
GET /api/feeds/google-shopping?offset=1000&limit=1000

# JSON format for debugging
GET /api/feeds/google-shopping?format=json&limit=10
```

## Feed Fields

Each product includes these Google Shopping required fields:

| Field | Example |
|-------|---------|
| `g:id` | `wheel-12345` or `tire-67890` |
| `g:title` | `Fuel Off-Road Assault 20" 10" Wide Gloss Black` |
| `g:description` | `Assault. Finish: Gloss Black. Size: 20x10...` |
| `g:link` | `https://warehousetiredirect.com/wheels/12345` |
| `g:image_link` | `https://cdn.wheelpros.com/images/...` |
| `g:price` | `299.99 USD` |
| `g:availability` | `in_stock` |
| `g:brand` | `Fuel Off-Road` |
| `g:mpn` | `12345` (SKU) |
| `g:condition` | `new` |
| `g:product_type` | Category path |
| `g:google_product_category` | `6092` (wheels) or `5614` (tires) |

## Registering in Google Merchant Center

1. Go to [Google Merchant Center](https://merchants.google.com/)
2. Navigate to **Products → Feeds**
3. Click **+ Add feed** (or the plus icon)
4. Select your target country and language
5. Choose **Scheduled fetch** as the input method
6. Configure:
   - **File name**: `warehouse-tire-feed.xml`
   - **File URL**: `https://warehousetiredirect.com/api/feeds/google-shopping`
   - **Fetch frequency**: Daily (recommended)
   - **Fetch time**: Off-peak hours (e.g., 3:00 AM)
7. Save and fetch now to verify

## Large Inventory Handling

For complete inventory export:

```bash
# Fetch all products in batches
curl "https://warehousetiredirect.com/api/feeds/google-shopping?offset=0&limit=5000" > feed-part1.xml
curl "https://warehousetiredirect.com/api/feeds/google-shopping?offset=5000&limit=5000" > feed-part2.xml
# ... continue until hasMore: false
```

The `X-Feed-Stats` response header includes pagination info:
```json
{
  "wheelsIncluded": 500,
  "tiresIncluded": 500,
  "totalProducts": 1000,
  "offset": 0,
  "limit": 1000,
  "hasMore": true
}
```

## Pricing Logic

### Wheels
1. **Cost-based**: cost × 1.30 (30% margin), capped at MSRP
2. **MAP fallback**: Use MAP if no cost
3. **MSRP-derived**: (MSRP × 0.75) × 1.30 if no cost/MAP

### Tires (WheelPros)
- (MSRP × 0.85) + $50
- Fallback to MAP if no MSRP

## Inventory Filtering

- Only products with **4+ units** in stock are included
- Products without images are excluded
- Products without valid pricing are excluded

## Response Headers

| Header | Description |
|--------|-------------|
| `Content-Type` | `application/xml; charset=utf-8` |
| `Cache-Control` | `public, max-age=3600` (1 hour cache) |
| `X-Feed-Stats` | JSON object with feed statistics |

## Troubleshooting

### Feed not updating
- Check the fetch URL is accessible
- Verify the endpoint returns 200 status
- Check the X-Feed-Stats header for product counts

### Products missing
- Verify inventory levels (minimum 4 units required)
- Check that products have valid images
- Verify pricing data exists

### Invalid feed format
- Use `?format=json` to debug individual products
- Check XML validation at [Google Feed Validator](https://www.google.com/webmasters/markup-helper/)

## Monitoring

Check logs for feed generation stats:
```
[google-shopping] Generated feed: 1500 products (800 wheels, 700 tires) in 1234ms
```
