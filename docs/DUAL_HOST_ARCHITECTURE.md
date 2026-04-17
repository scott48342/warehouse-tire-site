# Dual-Host Shop Architecture

## Overview

The Warehouse Tire shop engine serves two distinct shopping experiences from a single codebase:

| Mode | Domain | Experience |
|------|--------|------------|
| **National** | `shop.warehousetiredirect.com` | Pure ecommerce, shipping-only |
| **Local** | `shop.warehousetire.net` | Installation-oriented, store selection |

## Critical Rules

### ⛔ HARD ISOLATION

1. **National mode NEVER shows:**
   - Store selector
   - Installation UI
   - Local fees/services
   - Pontiac/Waterford references
   - Any local-mode components

2. **Local mode additions ONLY:**
   - Store selector (Pontiac / Waterford)
   - Install-oriented messaging
   - Local service add-ons (future)
   - Order tagging for install routing

### ✅ SHARED FOUNDATION

Both modes share:
- Product catalog
- Fitment engine
- Pricing engine
- Inventory system
- Cart/checkout flow
- Payment processing

## Architecture

### Mode Detection

```
Host → Middleware → x-shop-mode header → Context Provider → Components
```

**Detection Logic (`src/lib/shopContext.ts`):**

```typescript
// National hosts
shop.warehousetiredirect.com → national
warehousetiredirect.com → national

// Local hosts  
shop.warehousetire.net → local
local.warehousetire.net → local

// Path-based (reverse proxy)
warehousetire.net/shop/* → local
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/shopContext.ts` | Core context types & detection |
| `src/lib/shopContextServer.ts` | Server-side detection helpers |
| `src/contexts/ShopContextProvider.tsx` | React context & hooks |
| `src/components/local/StoreSelector.tsx` | Store selection UI |
| `src/middleware.ts` | Header injection for SSR |

## Usage

### Client Components

```tsx
import { useShopContext, LocalOnly, NationalOnly } from '@/contexts/ShopContextProvider';

function MyComponent() {
  const { isLocal, isNational, selectedStore } = useShopContext();
  
  return (
    <div>
      {/* Always rendered */}
      <ProductCard />
      
      {/* Local mode only - SAFE */}
      <LocalOnly>
        <StoreSelector />
      </LocalOnly>
      
      {/* National mode only */}
      <NationalOnly>
        <ShippingBanner />
      </NationalOnly>
    </div>
  );
}
```

### Server Components

```tsx
import { getShopContext, isLocalModeServer } from '@/lib/shopContextServer';

export default async function Page() {
  const ctx = await getShopContext();
  
  if (ctx.mode === 'local') {
    // Local-only rendering
  }
  
  return <div>...</div>;
}
```

### API Routes

```typescript
import { detectShopContext } from '@/lib/shopContext';

export async function POST(req: Request) {
  const ctx = detectShopContext(req.headers);
  
  if (ctx.mode === 'local') {
    // Add local order metadata
    orderData.metadata = {
      channel: 'local',
      install_store: ctx.selectedStore,
      fulfillment_mode: 'install',
    };
  }
}
```

## Store Selection

### Available Stores

| ID | Name | Phone |
|----|------|-------|
| `pontiac` | Warehouse Tire – Pontiac | 248-332-4120 |
| `waterford` | Warehouse Tire – Waterford | 248-683-0070 |

### Store Selector Usage

```tsx
import { StoreSelector } from '@/components/local';

// Card variant (default)
<StoreSelector />

// Dropdown variant
<StoreSelector variant="dropdown" />

// Minimal inline variant
<StoreSelector variant="minimal" />
```

### Store Persistence

- Selection stored in `localStorage` key: `wt_selected_store`
- Persists across page navigations
- Default: Pontiac (if not selected)

## Order Tagging

Orders placed in local mode include metadata:

```json
{
  "channel": "local",
  "install_store": "pontiac",
  "install_store_name": "Warehouse Tire – Pontiac",
  "install_store_phone": "248-332-4120",
  "install_store_address": "1100 Cesar E Chavez Ave, Pontiac, MI 48340",
  "fulfillment_mode": "install"
}
```

## SEO / Indexing

### National Site
- Fully indexed
- Canonical URLs
- Standard SEO

### Local Site
- **NOINDEX** via `x-robots-tag` header
- Product pages canonical to national equivalents
- Prevents duplicate content issues

### Canonical URLs

All product pages should use:

```tsx
<link rel="canonical" href={buildCanonicalUrl('wheels', sku)} />
// Always: https://shop.warehousetiredirect.com/wheels/{sku}
```

## Infrastructure Setup

### Vercel Domain Configuration

Add these domains in Vercel Project Settings → Domains:

1. `shop.warehousetiredirect.com` (primary/production)
2. `shop.warehousetire.net` (local mode)

### DNS Configuration

```
shop.warehousetire.net → CNAME → cname.vercel-dns.com
```

### Alternative: Reverse Proxy

If using path-based routing (`warehousetire.net/shop`):

Configure your WordPress/server to proxy:
```
/shop/* → https://shop.warehousetiredirect.com/*
```

With header:
```
X-Shop-Mode: local
```

## Testing

### Local Development

```bash
# Test national mode
npm run dev
# Visit: http://localhost:3000

# Test local mode (query param in dev)
# Visit: http://localhost:3000?mode=local
```

### Production Testing

1. National: `https://shop.warehousetiredirect.com`
2. Local: `https://shop.warehousetire.net`

### Verification Checklist

- [ ] National site shows no store selector
- [ ] National site shows no local messaging
- [ ] Local site shows store selector
- [ ] Store selection persists
- [ ] Order metadata includes install store
- [ ] Local site has noindex header
- [ ] Product canonicals point to national

## Troubleshooting

### Mode not detected correctly

1. Check `x-shop-mode` header in Network tab
2. Verify host matches expected pattern
3. Check middleware is running (not skipped by matcher)

### Store selector not appearing

1. Confirm `isLocal` is true in context
2. Check `<LocalOnly>` wrapper is used
3. Verify ShopContextProvider is in layout tree

### Orders not tagged

1. Check `getLocalOrderMetadata()` is called in checkout
2. Verify store is selected (`selectedStore` not undefined)
3. Check API route uses `detectShopContext()`
