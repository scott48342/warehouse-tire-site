# Phase 3A: My Orders - Test Checklist

## Security Tests (Required before production)

### 1. Unauthenticated Order List → Denied
```bash
curl http://localhost:3001/api/account/orders
# Expected: {"error":"unauthorized","message":"Authentication required"}
# Status: 401
```
✅ **PASSED** - Returns 401 unauthorized

### 2. Unauthenticated Order Detail → Denied
```bash
curl http://localhost:3001/api/account/orders/WTD-ABC123
# Expected: {"error":"unauthorized","message":"Authentication required"}
# Status: 401
```
✅ **PASSED** - Returns 401 unauthorized

### 3. Unverified Account → No Orders / Denied
- Sign up with new email but do NOT verify
- Go to /account
- Expected: My Orders section shows "Email verification required" message
- OR: Empty order list (if we choose to show empty state instead of error)

**Status**: ✅ Implemented - Shows "Email verification required" message

### 4. Account A Sees Its Historical Orders
- Create/use account with verified email matching existing order
- Go to /account
- Expected: Order list shows orders placed with that email
- Test with `scripts/create-test-order-user.mjs` to create matching user

**Status**: ✅ Implemented - Query by normalized email

### 5. Account A Cannot See Account B's Orders
- Sign in as Account A
- Attempt to view Account B's order via:
  - API: `GET /api/account/orders/[Account-B-Order-ID]`
- Expected: 404 Not Found (NOT 403 - to avoid confirming existence)

**Status**: ✅ Implemented - Returns 404 for unauthorized access

### 6. Changing Order ID Cannot Bypass Ownership
- Sign in as Account A
- Note Account A's order ID
- Attempt to access a different order ID via URL manipulation
- Expected: 404 Not Found

**Status**: ✅ Implemented - Server-side ownership check

### 7. Email Normalization Works
- Create user with email "  Test@Example.COM  "
- Ensure orders with "test@example.com" are matched
- Test cases:
  - Case difference
  - Leading/trailing whitespace
  - Mixed case domain

**Status**: ✅ Implemented - `normalizeEmail()` function tested

### 8. Empty Account Renders Correctly
- Sign in with account that has no matching orders
- Go to /account
- Expected: Clean "No orders yet" message with shop link

**Status**: ✅ Implemented

### 9. Multiple Orders Sort Newest First
- Account with multiple orders
- Expected: Orders sorted by created_at DESC

**Status**: ✅ Implemented - `ORDER BY created_at DESC`

### 10. Cross-Account Isolation (Real Session Test)
- Open two browsers/incognito windows
- Sign in as different users in each
- Verify each only sees their own orders
- Attempt cross-account access via API

**Status**: Requires manual browser testing

---

## Functional Tests

### Order List UI
- [ ] Order cards display correctly
- [ ] Order ID visible
- [ ] Date formatted correctly
- [ ] Status badge shows with appropriate color
- [ ] Total formatted as currency
- [ ] Vehicle info displays when available
- [ ] Item summary truncates appropriately
- [ ] "Tracking available" indicator when tracking exists
- [ ] "View Order" button works

### Order Detail Modal
- [ ] Modal opens on "View Order" click
- [ ] Modal closes on X button
- [ ] Modal closes on backdrop click
- [ ] Modal closes on Escape key
- [ ] Order info displays correctly
- [ ] Line items display with quantities
- [ ] Totals display correctly
- [ ] Shipping address displays (customer-safe fields only)
- [ ] Tracking links work
- [ ] Installation info displays for local orders
- [ ] "Contact us" link present

### Tracking
- [ ] FedEx tracking numbers generate correct URL
- [ ] UPS tracking numbers generate correct URL
- [ ] USPS tracking numbers generate correct URL
- [ ] Unknown carriers display number without link
- [ ] Multiple tracking numbers all display

### Mobile Responsiveness
- [ ] Order cards readable on mobile
- [ ] Modal scrollable on mobile
- [ ] Actions accessible on mobile
- [ ] No horizontal overflow

---

## Regression Tests

### Guest Checkout
- [ ] Guest can complete checkout without account
- [ ] Order created successfully
- [ ] Order confirmation displays
- [ ] Confirmation email sent

### Authenticated Checkout  
- [ ] Logged-in user can complete checkout
- [ ] Order associated with customer email
- [ ] Order visible in account after purchase

### Stripe Webhook
- [ ] Webhook processes payments correctly
- [ ] Orders created with correct status
- [ ] Amount paid recorded correctly

### Admin Orders
- [ ] Admin can view all orders
- [ ] Admin can update order status
- [ ] Tracking numbers can be added

### Better Auth
- [ ] Login works
- [ ] Logout works
- [ ] Email verification works
- [ ] Session persists correctly

### Saved Garage
- [ ] Vehicles can be saved
- [ ] Garage syncs on login
- [ ] Garage displays correctly alongside orders

---

## Test Scripts

### Run automated unit tests:
```bash
npx tsx scripts/test-account-orders.ts
```

### Check database state:
```bash
node scripts/check-orders-users.mjs
```

### Create test user matching existing order:
```bash
node scripts/create-test-order-user.mjs
```

---

## Files Changed

### New Files
- `src/lib/account/emailUtils.ts` - Email normalization utilities
- `src/app/api/account/orders/route.ts` - Order list API
- `src/app/api/account/orders/[id]/route.ts` - Order detail API
- `src/hooks/useAccountOrders.ts` - React hooks for orders
- `src/app/account/OrderDetailModal.tsx` - Order detail modal component

### Modified Files
- `src/lib/orders.ts` - Added customer_email index
- `src/app/account/AccountPageClient.tsx` - Added My Orders section

---

## Production Deployment Checklist

Before deploying to production:

1. [ ] All security tests pass
2. [ ] TypeScript compiles without errors
3. [ ] Dev server runs without errors
4. [ ] Manual testing completed for core flows
5. [ ] No console errors in browser
6. [ ] Mobile layout verified
7. [ ] Order detail modal works correctly
8. [ ] Tracking links verified
9. [ ] Empty state verified
10. [ ] Multiple orders verified
