# B6 PayPal vs Stripe Parity Audit

## Side-by-Side Comparison

| Behavior | Stripe webhook | PayPal capture | MATCH? | Notes |
|----------|---------------|----------------|--------|-------|
| **Verify successful payment** | `constructEvent` + check event type | `paypal.captureOrder` returns `status === "COMPLETED"` | ✅ | Different mechanisms, same outcome |
| **Prevent duplicate WTD order** | `getOrderByStripeSession` / `getOrderByPaymentIntent` / `getOrderByQuote` | `getOrderByPayPalOrder` / `getOrderByQuote` | ✅ | Both have 2-level idempotency |
| **Retrieve checkout quote** | `getQuote(db, quoteId)` from `metadata.quoteId` | `getQuote(db, quoteId)` from `body.quoteId` | ⚠️ | **DIFFERENCE**: Stripe gets from metadata, PayPal from body |
| **Create exactly one orders row** | `createOrder()` after idempotency checks | `createOrder()` after idempotency checks | ✅ | Same function |
| **Record payment provider/order ID** | `stripeSessionId`, `stripePaymentIntentId` | `paypalOrderId` | ✅ | Different fields, correct per provider |
| **Record amount paid correctly** | `session.amount_total` / `paymentIntent.amount` | ⚠️ Calculated from `quote.snapshot.lines` | ⚠️ | **DIFFERENCE**: PayPal doesn't use capture amount |
| **Store customer email** | `customerEmail` from session/PI | `quote.snapshot.customer.email` | ⚠️ | **DIFFERENCE**: PayPal doesn't get email from capture |
| **Preserve quote_id** | `quoteId` from metadata | `quoteId` from body | ✅ | Same preservation |
| **Preserve snapshot_json** | `quote.snapshot` | `quote.snapshot` | ✅ | Same quote data |
| **Send confirmation email exactly once** | `sendOrderConfirmationEmail` + `markOrderEmailSent` | `sendOrderConfirmationEmail` + `markOrderEmailSent` | ✅ | Same pattern |
| **Process supplier orders** | `processSupplierOrders` when `shippingAddress && !localMode` | `processSupplierOrders` when `shippingAddress && !localMode` | ✅ | Same logic |
| **Mark cart events purchased** | `markCartEventsPurchased` if `cartId` | `markCartEventsPurchased` if `cartId` | ✅ | Same pattern |
| **Mark abandoned cart recovered** | `markCartRecovered` if `cartId` | `markCartRecovered` if `cartId` | ✅ | Same pattern |
| **Analytics/order events** | `logCheckoutDiagnosticServer` on order create failure | ❌ MISSING | ❌ | **BUG**: PayPal missing diagnostics |
| **Handle local installation** | `localMode` check skips supplier orders | `localMode` check skips supplier orders | ✅ | Same logic |
| **Handle national shipping** | Ship address required for supplier orders | Ship address required for supplier orders | ✅ | Same logic |
| **Preserve discounts/totals** | Amount from Stripe | ⚠️ Amount calculated from lines | ⚠️ | May not include discounts in calculation |
| **Handle failure after payment safely** | Returns 500, Stripe retries | Returns 500, client must retry | ⚠️ | Different retry model |
| **Return appropriate client response** | `{ received: true, orderId }` | `{ ok: true, orderId, wtdOrderId, paypalOrderId, status, payer }` | ✅ | PayPal returns more info |
| **Saved quote conversion** | `markSavedQuoteConverted` from `metadata.savedQuoteId` | `markSavedQuoteConverted` from `body.savedQuoteId` | ✅ | Same function, different source |

## Critical Differences Found

### 1. Amount Calculation (MEDIUM RISK)

**Stripe**: Uses `session.amount_total` or `paymentIntent.amount` - actual captured amount from payment provider

**PayPal**: Calculates `amountPaidCents` from `quote.snapshot.lines.reduce()` - **may not include**:
- Shipping
- Tax  
- Discounts applied at payment time

**Impact**: Order record may show different amount than actually paid

**Fix Required**: Get actual amount from PayPal capture response

### 2. Customer Email Source (LOW RISK)

**Stripe**: `session.customer_email || session.customer_details?.email || paymentIntent.receipt_email`

**PayPal**: `quote.snapshot.customer.email` only

**Impact**: Minor - email likely the same. But if PayPal returns payer email, should use it.

### 3. Missing Diagnostic Logging (LOW RISK)

**Stripe**: Calls `logCheckoutDiagnosticServer` when order creation fails

**PayPal**: No diagnostic logging for failures

**Impact**: Reduced observability for PayPal failures

### 4. quoteId Source Security (HIGH RISK)

**Stripe**: `quoteId` comes from Stripe metadata - **server-verified, immutable after session creation**

**PayPal**: `quoteId` comes from client `body.quoteId` - **CLIENT CAN SEND ANY QUOTE ID**

**Impact**: **CRITICAL SECURITY ISSUE** - client could potentially:
- Claim someone else's quote was their order
- Cause quote/order mismatch

**Fix Required**: PayPal should verify quoteId matches PayPal order's `custom_id`/`reference_id`

## Intentional Differences

1. **Provider ID fields**: Correct - each provider has own field
2. **Response format**: Acceptable - PayPal returns more for client use
3. **Retry model**: Acceptable architectural difference (webhook vs client-call)

## Required Fixes Before Production

### Fix 1: Validate quoteId Against PayPal Order

```typescript
// After captureOrder, verify quoteId matches what was set in createOrder
const expectedQuoteId = captureResult.purchase_units?.[0]?.custom_id;
if (quoteId !== expectedQuoteId) {
  console.error(`[paypal/capture-order] Quote ID mismatch: body=${quoteId}, paypal=${expectedQuoteId}`);
  return NextResponse.json({ ok: false, error: "quote_mismatch" }, { status: 400 });
}
```

### Fix 2: Use PayPal Capture Amount

```typescript
// Get actual captured amount from PayPal response
const capturedAmount = captureResult.purchase_units?.[0]?.payments?.captures?.[0]?.amount;
const amountPaidCents = Math.round(parseFloat(capturedAmount?.value || "0") * 100);
```

### Fix 3: Add Diagnostic Logging

```typescript
} catch (orderErr: any) {
  console.error(`[paypal/capture-order] ORDER CREATE FAILED after successful payment:`, orderErr);
  await logCheckoutDiagnosticServer({
    eventType: "order_create_failed",
    cartId,
    checkoutStep: "post_payment",
    status: "error",
    endpoint: "paypal_capture",
    errorCode: String(orderErr?.message || "order_create_exception"),
    detail: { quoteId, paypalOrderId },
  });
  return NextResponse.json({ ok: false, error: "order_create_failed" }, { status: 500 });
}
```

## Database Constraint Audit

The `paypal_order_id` column needs a UNIQUE constraint for idempotency:

```sql
-- Check current constraint
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'orders' AND indexdef LIKE '%paypal%';
```

If only an INDEX exists (not UNIQUE), the application-level check has a race condition window.
