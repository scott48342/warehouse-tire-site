# Phase 3B: Saved Quotes Architecture

**Checkpoint B1 — Architecture Design Document**

---

## 1. Proposed Schema / Migration

### Table: `saved_quotes`

```sql
-- Migration: 0043_saved_quotes.sql

CREATE TABLE saved_quotes (
  -- Primary key: cryptographically secure, non-sequential
  id TEXT PRIMARY KEY,  -- Format: sq_<nanoid(21)>
  
  -- Ownership (auth_users.id)
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  
  -- Optional user-assigned name
  name TEXT,  -- e.g., "F-150 Setup" or NULL
  
  -- Vehicle snapshot (denormalized for display without parsing JSON)
  vehicle_year TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_trim TEXT,
  vehicle_modification TEXT,  -- Canonical fitment ID
  
  -- Immutable configuration snapshot (JSONB)
  snapshot_json JSONB NOT NULL,
  
  -- Timestamps
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_viewed_at TIMESTAMPTZ,
  
  -- Conversion tracking
  converted_order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,
  
  -- Soft delete / archive
  archived_at TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: User lookup (newest first)
CREATE INDEX idx_saved_quotes_user_id ON saved_quotes(user_id, saved_at DESC);

-- Index: Active (non-archived) quotes for user
CREATE INDEX idx_saved_quotes_user_active ON saved_quotes(user_id, saved_at DESC)
  WHERE archived_at IS NULL;

-- Index: Conversion lookup
CREATE INDEX idx_saved_quotes_converted_order ON saved_quotes(converted_order_id)
  WHERE converted_order_id IS NOT NULL;
```

### ID Generation

Use `nanoid` (21 chars, URL-safe alphabet) prefixed with `sq_`:

```typescript
import { nanoid } from "nanoid";

export function generateSavedQuoteId(): string {
  return `sq_${nanoid(21)}`;
}
```

This produces IDs like `sq_V1StGXR8_Z5jdHi6B-myT` — cryptographically secure, 
non-guessable, URL-safe, and clearly typed.

---

## 2. Existing Cart Structures to Reuse

### Cart Types (`src/lib/cart/CartContext.tsx`)

Reuse directly:
- `CartWheelItem` — wheel product with vehicle/fitment
- `CartTireItem` — tire product with vehicle/fitment  
- `CartAccessoryItem` — accessories with dependency tracking
- `CartItem = CartWheelItem | CartTireItem | CartAccessoryItem`

### Quote Types (`src/lib/quotes.ts`)

Reuse concepts:
- `QuoteLine` — line item structure (kind, name, sku, unitPriceUsd, qty, taxable, meta)
- `computeTotals()` — calculate partsSubtotal, servicesSubtotal, tax, total
- `vehicleLabel()` — format vehicle for display

### NOT Reusing

The existing `QuoteSnapshot` includes checkout PII (customer name, email, phone,
shipping address). For Saved Quotes, we create a **shopping-focused** snapshot
that excludes PII:

```typescript
// New type for Saved Quotes
export type SavedQuoteSnapshot = {
  // Vehicle (required)
  vehicle: {
    year: string;
    make: string;
    model: string;
    trim?: string;
    modification?: string;  // Canonical fitment ID
  };
  
  // Cart items (preserved exactly as added)
  items: CartItem[];
  
  // Pricing at save time
  pricing: {
    partsSubtotal: number;
    servicesSubtotal: number;
    estimatedTax: number;
    taxRate: number;
    estimatedShipping: number | null;  // null if unknown
    discount?: {
      code: string;
      amount: number;
      type: string;
    };
    total: number;
  };
  
  // Metadata
  savedFrom: 'cart' | 'package-builder' | 'pdp';
  savedAt: string;  // ISO timestamp
  
  // Cart context (for resume)
  cartId?: string;
};
```

**Key differences from QuoteSnapshot:**
- No customer PII (firstName, lastName, email, phone)
- No shipping address
- No localMode (that's checkout-time)
- Preserves full `CartItem[]` structure (not flattened lines)
- Includes `savedFrom` for analytics
- Includes original `cartId` for recovery correlation

---

## 3. Saved Quote Snapshot Structure

### Full Type Definition

```typescript
// src/lib/savedQuotes/types.ts

import type { CartItem, CartWheelItem, CartTireItem, CartAccessoryItem } from "@/lib/cart/CartContext";

export type SavedQuoteVehicle = {
  year: string;
  make: string;
  model: string;
  trim?: string;
  modification?: string;
};

export type SavedQuotePricing = {
  partsSubtotal: number;
  servicesSubtotal: number;
  estimatedTax: number;
  taxRate: number;
  estimatedShipping: number | null;
  discount?: {
    code: string;
    amount: number;
    type: string;
  };
  total: number;
};

export type SavedQuoteSnapshot = {
  vehicle: SavedQuoteVehicle;
  items: CartItem[];
  pricing: SavedQuotePricing;
  savedFrom: 'cart' | 'package-builder' | 'pdp';
  savedAt: string;
  cartId?: string;
};

export type SavedQuote = {
  id: string;
  userId: string;
  name: string | null;
  vehicleYear: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleTrim: string | null;
  vehicleModification: string | null;
  snapshot: SavedQuoteSnapshot;
  savedAt: Date;
  lastViewedAt: Date | null;
  convertedOrderId: string | null;
  convertedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
};
```

### Snapshot Creation Helper

```typescript
// src/lib/savedQuotes/createSnapshot.ts

import type { CartItem } from "@/lib/cart/CartContext";
import type { SavedQuoteSnapshot, SavedQuoteVehicle, SavedQuotePricing } from "./types";

export function createSavedQuoteSnapshot(
  items: CartItem[],
  vehicle: SavedQuoteVehicle,
  pricing: SavedQuotePricing,
  source: 'cart' | 'package-builder' | 'pdp',
  cartId?: string
): SavedQuoteSnapshot {
  return {
    vehicle,
    items: structuredClone(items),  // Deep clone to prevent mutation
    pricing,
    savedFrom: source,
    savedAt: new Date().toISOString(),
    cartId,
  };
}
```

---

## 4. Guest Pending-Save Strategy

### The Problem

Guest clicks "Save Quote" → needs to authenticate → must not lose configuration.

### The Solution: Server-Side Pending Quote Table

Create a temporary holding table for pending saves:

```sql
-- Migration: 0044_pending_saved_quotes.sql

CREATE TABLE pending_saved_quotes (
  -- Token-based lookup (cryptographically secure)
  token TEXT PRIMARY KEY,  -- Format: psq_<nanoid(32)>
  
  -- The quote data to save
  snapshot_json JSONB NOT NULL,
  
  -- Vehicle fields for convenience
  vehicle_year TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_trim TEXT,
  vehicle_modification TEXT,
  
  -- Tracking
  cart_id TEXT,  -- Original cart ID
  return_to TEXT,  -- Where to redirect after auth
  
  -- Expiration (24 hours)
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-cleanup: Index for expired token deletion
CREATE INDEX idx_pending_saved_quotes_expires ON pending_saved_quotes(expires_at);
```

### Guest Save Flow

```
1. Guest clicks "Save Quote"
   
2. Client calls POST /api/saved-quotes/pending
   - Body: { snapshot, returnTo: "/account?saved=1" }
   - Server generates token, stores pending quote
   - Returns: { token: "psq_...", authUrl: "/login?returnTo=/api/saved-quotes/claim/psq_..." }

3. Client stores token in sessionStorage
   - Key: "pending_saved_quote"
   - Value: { token, timestamp }

4. Client redirects to login/register with returnTo
   - returnTo = /api/saved-quotes/claim/{token}

5. User authenticates (login or register + verify)

6. Better Auth redirects to /api/saved-quotes/claim/{token}

7. Claim endpoint:
   - Validates user is authenticated
   - Looks up pending quote by token
   - Creates saved_quote for user
   - Deletes pending record
   - Redirects to /account?saved=1

8. Account page shows "Quote saved to your account!" toast
```

### Why This Design?

| Approach | Risk |
|----------|------|
| URL param with snapshot | Exposes cart data in URL, bookmarks, logs |
| Cookie | Size limits, GDPR, security |
| localStorage only | Lost if user changes browser/device |
| Server-side token | ✅ Secure, survives auth redirect, no data in URL |

### Token Security

- 32-character nanoid = 192 bits of entropy
- Unguessable, one-time use
- Auto-expires after 24 hours
- Deleted immediately after claim
- Rate-limited creation

---

## 5. Resume/Revalidation Architecture

### Overview

When customer clicks "Check Current Price / Continue":

```
1. Load saved snapshot from database

2. Call POST /api/saved-quotes/[id]/validate
   - Returns current pricing, availability, changes

3. UI shows comparison:
   - Saved snapshot (left)
   - Current validated (right)
   - Changes highlighted

4. If customer confirms "Continue with Saved Quote":
   - Cart replacement confirmation (if cart non-empty)
   - Replace cart with validated items
   - Navigate to cart or checkout
```

### Validation Service

```typescript
// src/lib/savedQuotes/validateQuote.ts

import type { CartItem, CartWheelItem, CartTireItem, CartAccessoryItem } from "@/lib/cart/CartContext";
import type { SavedQuoteSnapshot } from "./types";

export type ItemValidationResult = {
  item: CartItem;
  status: 'available' | 'price_changed' | 'unavailable' | 'fitment_invalid';
  currentPrice?: number;
  priceChange?: number;  // Positive = increased
  reason?: string;
  currentInventory?: number;
};

export type ValidationResult = {
  isValid: boolean;
  items: ItemValidationResult[];
  pricing: {
    savedTotal: number;
    currentTotal: number;
    totalChange: number;
  };
  changes: {
    priceChanges: number;
    unavailable: number;
    fitmentIssues: number;
  };
  canResume: boolean;  // False if any item unavailable
  warnings: string[];
};

export async function validateSavedQuote(
  snapshot: SavedQuoteSnapshot
): Promise<ValidationResult> {
  const results: ItemValidationResult[] = [];
  let currentTotal = 0;
  
  for (const item of snapshot.items) {
    if (item.type === 'tire') {
      const result = await validateTire(item as CartTireItem, snapshot.vehicle);
      results.push(result);
      if (result.status !== 'unavailable') {
        currentTotal += (result.currentPrice ?? item.unitPrice) * item.quantity;
      }
    } else if (item.type === 'wheel') {
      const result = await validateWheel(item as CartWheelItem, snapshot.vehicle);
      results.push(result);
      if (result.status !== 'unavailable') {
        currentTotal += (result.currentPrice ?? item.unitPrice) * item.quantity;
      }
    } else if (item.type === 'accessory') {
      // Accessories typically don't change price, just check availability
      const result = await validateAccessory(item as CartAccessoryItem);
      results.push(result);
      if (result.status !== 'unavailable') {
        currentTotal += (result.currentPrice ?? item.unitPrice) * item.quantity;
      }
    }
  }
  
  const priceChanges = results.filter(r => r.status === 'price_changed').length;
  const unavailable = results.filter(r => r.status === 'unavailable').length;
  const fitmentIssues = results.filter(r => r.status === 'fitment_invalid').length;
  
  return {
    isValid: unavailable === 0 && fitmentIssues === 0,
    items: results,
    pricing: {
      savedTotal: snapshot.pricing.total,
      currentTotal,
      totalChange: currentTotal - snapshot.pricing.total,
    },
    changes: {
      priceChanges,
      unavailable,
      fitmentIssues,
    },
    canResume: unavailable === 0,
    warnings: buildWarnings(results),
  };
}

// Individual validators reuse existing services:
// - validateTire: /api/tires/search?partNumber=X
// - validateWheel: /api/wheels/search?sku=X + fitment check
// - validateAccessory: internal lookup
```

---

## 6. Cart Replacement Safety Design

### Confirmation Modal

```typescript
// src/components/account/ResumeQuoteModal.tsx

type Props = {
  savedQuote: SavedQuote;
  validation: ValidationResult;
  currentCartEmpty: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// If cart is non-empty:
// "Replace your current cart?"
// "Continuing with this saved quote will replace the items currently in your cart."
// [Cancel] [Continue with Saved Quote]

// If cart is empty:
// Skip confirmation, proceed directly
```

### Cart Replacement Flow

```typescript
// src/lib/savedQuotes/resumeQuote.ts

import type { ValidationResult } from "./validateQuote";
import type { CartItem } from "@/lib/cart/CartContext";

export function buildResumedCart(
  validation: ValidationResult
): CartItem[] {
  // Only include items that are available
  return validation.items
    .filter(r => r.status !== 'unavailable')
    .map(r => ({
      ...r.item,
      // Use CURRENT price, not saved price
      unitPrice: r.currentPrice ?? r.item.unitPrice,
    }));
}
```

### Vehicle Integration

When resuming:

1. Check if vehicle exists in user's garage
2. If exists: use that vehicle, update `lastActiveAt`
3. If not: add to garage (if under limit), set as active
4. Do NOT create duplicates

```typescript
// In resume handler
const vehicle = snapshot.vehicle;
const garageMatch = garage.find(g => 
  g.modification === vehicle.modification ||
  (g.year === vehicle.year && g.make === vehicle.make && g.model === vehicle.model)
);

if (garageMatch) {
  setActiveVehicle(garageMatch.id);
} else if (garage.length < MAX_VEHICLES) {
  addVehicle(vehicle, true);
}
```

---

## 7. Order Conversion Integration Point

### Analysis

The Stripe webhook (`src/app/api/stripe/webhook/route.ts`) handles successful payments
and creates orders. This is payment-critical code.

**Safest integration point:** After order creation, NOT during webhook processing.

### Design

Add `originating_saved_quote_id` to the Stripe checkout session metadata:

```typescript
// In /api/stripe/create-checkout-session
// If resuming from saved quote, include in metadata:
metadata: {
  ...,
  saved_quote_id: savedQuoteId,  // Only if resuming from saved quote
}
```

Then, in the success page or a post-order job:

```typescript
// src/app/checkout/success/page.tsx or background job

// Check if order originated from saved quote
const savedQuoteId = session.metadata?.saved_quote_id;
if (savedQuoteId) {
  await markQuoteConverted(savedQuoteId, orderId);
}
```

**Conversion update:**

```sql
UPDATE saved_quotes 
SET converted_order_id = $1, converted_at = NOW()
WHERE id = $2 AND user_id = $3 AND converted_order_id IS NULL;
```

### Why This Is Safe

- Webhook code unchanged
- Conversion tracking is fire-and-forget
- Failure doesn't affect order
- Can be implemented as background job if needed
- Idempotent (only updates if not already converted)

---

## 8. Security Model

### Authentication

All `/api/account/quotes/*` endpoints require:

```typescript
const session = await auth.api.getSession({ headers: await headers() });
if (!session?.user?.id) {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
if (!session.user.emailVerified) {
  return NextResponse.json({ error: "email_not_verified" }, { status: 403 });
}
```

### Ownership

Every database query includes `user_id = session.user.id`:

```typescript
// List
WHERE user_id = $1 AND archived_at IS NULL ORDER BY saved_at DESC

// Get
WHERE id = $1 AND user_id = $2

// Update
WHERE id = $1 AND user_id = $2

// Delete
WHERE id = $1 AND user_id = $2
```

### Cross-Account Access

If user A tries to access user B's quote:

```typescript
// Query returns no rows → 404
const { rows } = await db.query(`
  SELECT * FROM saved_quotes 
  WHERE id = $1 AND user_id = $2
`, [quoteId, userId]);

if (rows.length === 0) {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}
```

**Response:** `404 Not Found` — does NOT confirm the quote exists.

### Rate Limiting

```typescript
// Prevent duplicate saves (double-click)
// Hash of snapshot + user + recent timestamp
const dedupeKey = hashSnapshot(snapshot, userId, Math.floor(Date.now() / 60000));

// Check Redis for recent identical save
const recent = await redis.get(`saved_quote_dedupe:${dedupeKey}`);
if (recent) {
  return NextResponse.json({ id: recent }, { status: 200 });  // Return existing
}
```

### Limits

```typescript
const MAX_SAVED_QUOTES = 20;

// Check before creating
const { rows: [{ count }] } = await db.query(`
  SELECT COUNT(*) as count FROM saved_quotes 
  WHERE user_id = $1 AND archived_at IS NULL
`, [userId]);

if (count >= MAX_SAVED_QUOTES) {
  return NextResponse.json(
    { error: "limit_reached", message: "Maximum 20 saved quotes" },
    { status: 400 }
  );
}
```

---

## 9. Risks

| Risk | Mitigation |
|------|------------|
| **Guest loses pending quote** | 24hr expiry; token in sessionStorage; can re-save |
| **Stale pricing shown to customer** | Clear "prices verified at checkout" messaging; validation on resume |
| **Cart accidentally replaced** | Confirmation modal; non-empty cart protection |
| **Webhook failure loses conversion** | Background job fallback; conversion is non-critical |
| **DoS via quote creation** | Rate limit (5/min); dedupe identical snapshots |
| **Large snapshot size** | Validate snapshot size (max 100KB); reject oversized |
| **Migration breaks production** | Migration is additive (new tables only); no existing table changes |

---

## 10. Files Expected to Change

### New Files (Phase 3B)

```
drizzle/migrations/
├── 0043_saved_quotes.sql
├── 0044_pending_saved_quotes.sql

src/lib/savedQuotes/
├── types.ts
├── createSnapshot.ts
├── validateQuote.ts
├── resumeQuote.ts
├── savedQuoteService.ts

src/app/api/account/quotes/
├── route.ts                    # GET (list), POST (create)
├── [id]/
│   ├── route.ts                # GET, PATCH, DELETE
│   └── validate/route.ts       # POST (validate/resume)

src/app/api/saved-quotes/
├── pending/route.ts            # POST (guest pending save)
├── claim/[token]/route.ts      # GET (claim after auth)

src/components/account/
├── SavedQuotesSection.tsx
├── SavedQuoteCard.tsx
├── SavedQuoteDetail.tsx
├── ResumeQuoteModal.tsx
├── QuoteChangesComparison.tsx

src/components/
├── SaveQuoteButton.tsx         # Reusable save button
├── SaveQuoteModal.tsx          # Confirmation/naming modal
```

### Modified Files

```
src/app/account/page.tsx                    # Add My Quotes section
src/lib/auth-schema.ts                      # Add Drizzle schema for saved_quotes
src/lib/cart/CartContext.tsx                # Add save quote trigger (optional)
src/components/CartSlideout.tsx             # Add "Save Quote" button
src/app/checkout/page.tsx                   # Add saved_quote_id to Stripe metadata (Phase B6)
src/app/checkout/success/page.tsx           # Mark quote converted (Phase B6)
```

### Unchanged (Critical Paths)

```
src/app/api/stripe/webhook/route.ts         # DO NOT MODIFY in B1-B5
src/app/api/stripe/create-checkout-session  # Minor metadata addition in B6
```

---

## Summary

**Checkpoint B1 delivers:**

1. ✅ `saved_quotes` schema with secure IDs, ownership, conversion tracking
2. ✅ Reuse of `CartItem` types from existing cart system
3. ✅ New `SavedQuoteSnapshot` type focused on shopping (no PII)
4. ✅ Server-side pending quote strategy for guest → auth flow
5. ✅ Validation architecture using existing pricing/fitment services
6. ✅ Cart replacement with confirmation modal protection
7. ✅ Safe order conversion integration via metadata (not webhook changes)
8. ✅ Complete security model with isolation and rate limiting
9. ✅ Identified risks with mitigations
10. ✅ Complete file change manifest

**Ready for your approval before proceeding to B2 implementation.**
