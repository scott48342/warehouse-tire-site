# US AutoForce Direct Integration (AIS)

**Status:** ✅ TESTED AND WORKING (2026-04-29)

## Quick Summary

Direct API integration that is **BETTER than TireWeb** for US AutoForce:
- ✅ Full pricing (cost + MAP)
- ✅ Images (Azure CDN)
- ✅ Spec PDFs
- ✅ Per-warehouse inventory
- ✅ Order placement with tracking
- ✅ FTP flat file inventory (15-min updates)

## Credentials

### API (Test)
```env
USAUTOFORCE_USERNAME=warehousetiretest
USAUTOFORCE_PASSWORD=QV7Xu%h_858tasz
USAUTOFORCE_ACCOUNT=1000018
```

### FTP
```env
USAUTOFORCE_FTP_HOST=usventure.files.com
USAUTOFORCE_FTP_USERNAME=us1180608
USAUTOFORCE_FTP_PASSWORD=W@r3h0us3_2026!
```

### Endpoints
| Environment | URL |
|-------------|-----|
| Test | `https://servicesstage.usautoforce.com/integrationservice.asmx` |
| Production | `https://services.usautoforce.com/integrationservice.asmx` |

## API Methods

### ServiceCheck (Ping)
```typescript
import { serviceCheck } from "@/lib/usautoforce";
const result = await serviceCheck();
// { success: true, dateTime: "2026-04-29T07:25:14" }
```

### StockCheck
```typescript
import { checkStockBySize } from "@/lib/usautoforce";
const result = await checkStockBySize("225/60R16", { branch: "4101" });
// Returns 19 tires with full data
```

**Response includes:**
- `partNumber`, `description`, `model`
- `cost` (dealer), `map` (minimum advertised)
- `imageUrl` (Azure CDN), `specUrl` (PDF)
- `speedRating`, `loadIndex`, `loadRange`, `utqg`
- `treadDepth`, `weight`, `sidewall`
- `availability[]` (per-warehouse with qty, address)

### Order
```typescript
import { placeOrder } from "@/lib/usautoforce";
const result = await placeOrder({
  purchaseOrderNumber: "PO-12345",
  items: [{ partNumber: "15502840000", quantity: 4 }],
  shipTo: {
    name: "John Doe",
    address1: "123 Main St",
    city: "Boston",
    state: "MA",
    zip: "02101"
  }
});
```

### OrderStatusDetail
```typescript
import { getOrderStatus } from "@/lib/usautoforce";
const result = await getOrderStatus("HDS0320321");
// { trackingNumbers: ["789400001234"], status: "shipped" }
```

## FTP Inventory

**File:** `/USAutoForce/1180608_WarehouseTire/USAutoForceInventory_.csv`

```csv
D365WarehouseCode,BrandCode,PartNumber,QuantityAvailable
4101,ADV,1932457783,25.00
4102,ADV,1932457783,15.00
```

- **655,698 rows**
- **21,243 unique SKUs**
- **74 warehouses**
- **66 brands**
- **Updates every 15 minutes**

## Comparison vs TireWeb

| Feature | TireWeb | Direct AIS |
|---------|---------|------------|
| Cost | ✅ | ✅ |
| MAP | ❌ | ✅ |
| Images | ✅ TireLibrary | ✅ Azure CDN |
| Spec PDFs | ❌ | ✅ |
| Per-warehouse qty | ❌ | ✅ |
| Full specs | ⚠️ partial | ✅ complete |
| Order placement | ❌ | ✅ |
| Tracking | ❌ | ✅ |
| FTP inventory | ❌ | ✅ (15-min) |

**Conclusion:** Direct API is superior for US AutoForce. Can fully replace TireWeb connection 488548.

## Test Endpoints

```bash
# Status check
GET /api/admin/suppliers/usautoforce/status

# Service ping
GET /api/admin/suppliers/usautoforce/test-stock?ping=true

# Stock check
GET /api/admin/suppliers/usautoforce/test-stock?size=225/60R16
GET /api/admin/suppliers/usautoforce/test-stock?size=265/70R17&branch=4862
```

## Business Rules

⚠️ **Important:**
- **No tire returns** — dropship orders are non-returnable
- **Order cancellation** — Phone only: 800-490-4901 (NO EMAIL!)
- **Cutoff** — 2PM local warehouse time for same-day ship
- **shipToCode=99999** — USAF generates shipping label

## Files

- `client.ts` — SOAP API client
- `types.ts` — TypeScript interfaces
- `warehouses.ts` — 75 warehouse locations
- `index.ts` — Module exports

## Next Steps

1. ✅ API tested and working
2. ✅ FTP inventory downloaded
3. ⏳ Build comparison test vs TireWeb
4. ⏳ Get LIVE credentials for production
5. ⏳ Build FTP sync cron job
