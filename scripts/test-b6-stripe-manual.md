# B6 Stripe Manual Verification Guide

## Prerequisites

- Dev server running on `http://localhost:3000`
- Stripe test mode configured
- Test card: `4242 4242 4242 4242` (any future exp, any CVC)
- Verified test account with saved quote

---

## Test 1: Stripe Payment Element — Full Saved Quote Flow

### Step 1: Record Pre-Test State

1. Log in to test account at `/account`
2. Go to "My Quotes" tab
3. Find an active (non-converted) Saved Quote
4. Record:
   - Quote ID (visible in URL or console)
   - `converted_order_id`: should be `null`
   - `converted_at`: should be `null`

**To get raw quote data:**
Open browser DevTools → Network tab → call:
```
GET /api/account/quotes
```
Find your quote, note its `id`, `convertedOrderId`, `convertedAt`, `snapshotJson`

### Step 2: Resume Quote

1. Click on the Saved Quote
2. Click "Check Current Price" button
3. Wait for validation
4. Confirm validation succeeds (green checkmarks)
5. Click "Continue with Current Price"

### Step 3: Verify Cart Correlation

In browser DevTools Console:
```javascript
localStorage.getItem('wt_resumed_quote')
// Should return the quote ID
```

### Step 4: Complete Checkout

1. Fill in shipping info (use test address)
2. The Payment Element form should appear
3. Enter test card: `4242 4242 4242 4242`
4. Expiry: any future date (e.g., 12/30)
5. CVC: any 3 digits (e.g., 123)
6. Click Pay

### Step 5: Verify Success

After payment succeeds:

1. Should redirect to success page
2. Note the WTD Order ID (e.g., `WTD-XXXXXX`)

### Step 6: Verify Database State

**Check Orders table:**
```sql
SELECT id, quote_id, stripe_payment_intent_id, paypal_order_id, 
       amount_paid_cents, customer_email, status, paid_at
FROM orders 
WHERE id = 'WTD-XXXXXX';
```

Expected:
- `stripe_payment_intent_id`: populated (pi_xxx)
- `paypal_order_id`: NULL
- `status`: 'received'
- `paid_at`: recent timestamp

**Check Saved Quote conversion:**
```sql
SELECT id, converted_order_id, converted_at, 
       LENGTH(snapshot_json::text) as snapshot_size
FROM saved_quotes 
WHERE id = 'sq_XXXXXX';
```

Expected:
- `converted_order_id`: matches WTD order ID
- `converted_at`: recent timestamp

### Step 7: Verify UI

1. Go to `/account` → My Quotes
2. The quote should show "Purchased" badge
3. "View Order" link should be visible
4. Click "View Order" → should open My Orders with the correct order

---

## Test 2: Snapshot Immutability

Before payment, record:
```sql
SELECT md5(snapshot_json::text) as snapshot_hash
FROM saved_quotes WHERE id = 'sq_XXXXXX';
```

After payment:
```sql
SELECT md5(snapshot_json::text) as snapshot_hash
FROM saved_quotes WHERE id = 'sq_XXXXXX';
```

**Result:** Hashes must match exactly.

---

## Test 3: Stripe Webhook Idempotency

In Stripe Dashboard → Developers → Webhooks → Recent events:

1. Find the `payment_intent.succeeded` event
2. Click "Resend" to replay the webhook

**Expected:**
- No new WTD order created
- Console logs show idempotent handling
- `converted_at` unchanged

Check orders table:
```sql
SELECT COUNT(*) FROM orders WHERE stripe_payment_intent_id = 'pi_XXXXXX';
```
Should return `1`.

---

## Test 4: Normal Checkout Regression

1. Log out or use incognito
2. Add products to cart normally (NOT from Saved Quote)
3. In console:
   ```javascript
   localStorage.getItem('wt_resumed_quote')
   // Should be null
   ```
4. Complete checkout with test card
5. Verify:
   - WTD order created
   - No saved quote modified
   - Normal flow works

---

## Test 5: Ownership Injection

### Setup
- Account A owns Saved Quote `sq_AAA`
- Log in as Account B

### Test
1. As Account B, add items to cart
2. Go to checkout
3. In DevTools Console before payment:
   ```javascript
   localStorage.setItem('wt_resumed_quote', 'sq_AAA')
   ```
4. Complete checkout

### Verify
- Check server logs for ownership validation
- Check Stripe PaymentIntent metadata:
  ```
  Stripe Dashboard → Payments → [payment] → Metadata
  ```
  `savedQuoteId` should NOT be present (ownership rejected)
  
- Saved Quote `sq_AAA` should remain:
  - `converted_order_id`: NULL
  - `converted_at`: NULL

---

## Test 6: Stale Correlation

### Scenario A: Add Different Product

1. Resume Saved Quote A
2. Verify in console:
   ```javascript
   localStorage.getItem('wt_resumed_quote')
   // Returns quote ID
   ```
3. Navigate to a different wheel/tire PDP
4. Click "Add to Cart"
5. Check console again:
   ```javascript
   localStorage.getItem('wt_resumed_quote')
   // Should be null (cleared!)
   ```

### Scenario B: Clear Cart

1. Resume Saved Quote A
2. Verify correlation exists
3. Click cart icon → "Clear Cart"
4. Correlation should be cleared

### Verify Quote Unchanged

After scenarios A/B, if you complete checkout:
- Saved Quote A should remain `converted_order_id = NULL`

---

## Test 7: Conversion Failure Safety

### Temporary Code Change

In `src/lib/savedQuotes/checkoutIntegration.ts`, temporarily add at start of `markSavedQuoteConverted`:

```typescript
export async function markSavedQuoteConverted(...) {
  // TEMPORARY: Force failure for testing
  throw new Error("TEST: Simulated conversion failure");
  
  // ... rest of function
}
```

### Test
1. Resume a quote, complete Stripe payment
2. Observe:
   - Payment succeeds
   - WTD order is created
   - Error logged but webhook returns success
   - Customer sees success page

### Restore
Remove the throw statement immediately after test.

---

## Test 8: Hosted Checkout / Affirm

If Affirm is enabled, test "Pay with Affirm" button:
1. Should redirect to Stripe Hosted Checkout
2. Affirm test mode may not be available

**Report:** "Not verified — Affirm test environment unavailable" if cannot test.

---

## Results Checklist

| Test | Status | Notes |
|------|--------|-------|
| 1. Full Saved Quote Flow | | |
| 2. Snapshot Immutability | | |
| 3. Webhook Idempotency | | |
| 4. Normal Checkout Regression | | |
| 5. Ownership Injection | | |
| 6a. Stale Correlation - Add Item | | |
| 6b. Stale Correlation - Clear Cart | | |
| 7. Conversion Failure Safety | | |
| 8. Hosted Checkout / Affirm | | |

---

## Database Queries Reference

```sql
-- Check saved quote state
SELECT id, name, user_id, converted_order_id, converted_at, archived_at,
       LENGTH(snapshot_json::text) as snapshot_size,
       md5(snapshot_json::text) as snapshot_hash
FROM saved_quotes 
WHERE user_id = 'USER_ID_HERE'
ORDER BY saved_at DESC;

-- Check orders
SELECT id, quote_id, status, stripe_session_id, stripe_payment_intent_id,
       paypal_order_id, amount_paid_cents, customer_email, paid_at
FROM orders
ORDER BY created_at DESC
LIMIT 10;

-- Check for duplicates
SELECT stripe_payment_intent_id, COUNT(*) 
FROM orders 
WHERE stripe_payment_intent_id IS NOT NULL
GROUP BY stripe_payment_intent_id 
HAVING COUNT(*) > 1;
```
