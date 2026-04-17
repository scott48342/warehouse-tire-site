# Local Mode QA Checklist

## Pre-Flight (Before Testing)

- [ ] Domain `shop.warehousetire.net` added to Vercel
- [ ] DNS record configured at GoDaddy
- [ ] SSL certificate provisioned (automatic via Vercel)
- [ ] Latest code deployed (commit 2806803)

---

## Test 1: National Site (shop.warehousetiredirect.com)

### No Local UI Elements
- [ ] Home page shows no store selector
- [ ] Wheels page shows no store selector
- [ ] Tires page shows no store selector
- [ ] Checkout shows NO "Installation Location" section
- [ ] No "🔧 Install" badges anywhere
- [ ] No Pontiac/Waterford references in shopping flow

### Normal Checkout Flow
- [ ] Add wheels to cart
- [ ] Add tires to cart
- [ ] Go to checkout
- [ ] Shipping step shows only shipping address form (no store selector)
- [ ] "Continue to Payment" button works without store selection
- [ ] Stripe/PayPal checkout completes normally

---

## Test 2: Local Site - Pontiac (shop.warehousetire.net)

### Store Selector Present
- [ ] Home page renders normally
- [ ] Navigate to /wheels
- [ ] Add a wheel to cart
- [ ] Go to /checkout
- [ ] **"Installation Location" section appears** (blue box)
- [ ] Both stores shown: Pontiac & Waterford cards
- [ ] Hours and phone numbers visible

### Store Selection Required
- [ ] With no store selected, "Continue to Payment" button is disabled
- [ ] Button text shows "Select Install Location"
- [ ] Select **Pontiac**
- [ ] Button changes to "Continue to Payment" and enables

### Store Persistence
- [ ] Refresh the page
- [ ] Pontiac should still be selected (localStorage check)
- [ ] Navigate away and back - selection persists

### Complete Checkout
- [ ] Click "Continue to Payment"
- [ ] Select Stripe (or PayPal)
- [ ] Complete payment

### Verify Order Data
- [ ] Check Stripe Dashboard → Payments → Recent
- [ ] Click on the payment
- [ ] Metadata should show:
  - `channel: local`
  - `install_store: pontiac`
  - `install_store_name: Warehouse Tire – Pontiac`
  - `install_store_phone: 248-332-4120`
  - `fulfillment_mode: install`

### Verify Admin View
- [ ] Go to /admin/orders
- [ ] Find the new order
- [ ] "Fulfillment" column shows: `🔧 Pontiac` (blue badge)
- [ ] Click "View →"
- [ ] Blue "Installation Order" box appears
- [ ] Shows: Install Store, Address, Phone, Channel, Fulfillment

### Verify Email
- [ ] Check customer email
- [ ] Blue "🔧 Installation Order" banner present
- [ ] Shows store name, address, phone
- [ ] Check admin notification email (if configured)
- [ ] Same installation details visible

---

## Test 3: Local Site - Waterford (shop.warehousetire.net)

Repeat the same test with Waterford selected:

- [ ] Select **Waterford** store
- [ ] Complete checkout
- [ ] Stripe metadata shows `install_store: waterford`
- [ ] Admin shows `🔧 Waterford`
- [ ] Email shows Waterford store info

---

## Test 4: Canonical URLs

### On National Site
- [ ] Visit: https://shop.warehousetiredirect.com/wheels/A312200890+35FB
- [ ] View page source
- [ ] Find: `<link rel="canonical" href="https://shop.warehousetiredirect.com/wheels/A312200890+35FB">`

### On Local Site
- [ ] Visit: https://shop.warehousetire.net/wheels/A312200890+35FB
- [ ] View page source
- [ ] Find: `<link rel="canonical" href="https://shop.warehousetiredirect.com/wheels/A312200890+35FB">`
- [ ] (Both should point to national site)

### Noindex Header
- [ ] On local site, check response headers
- [ ] `x-robots-tag: noindex, nofollow` should be present

---

## Test 5: Store Switch Mid-Session

- [ ] On local site, select Pontiac
- [ ] Add items to cart
- [ ] At checkout, switch to Waterford
- [ ] Complete checkout
- [ ] Verify order shows Waterford (not Pontiac)

---

## Test 6: PayPal Flow

- [ ] On local site, add items to cart
- [ ] Select store
- [ ] Choose PayPal at checkout
- [ ] Complete PayPal payment
- [ ] Verify order in admin shows local mode info
- [ ] Verify email shows installation banner

---

## Failure Scenarios

### No Store Selected
- [ ] On local site, go directly to checkout with items in cart
- [ ] Verify "Continue to Payment" is disabled
- [ ] Verify warning message appears: "Please select an installation location"

### National Site + Local URL Params
- [ ] Visit: https://shop.warehousetiredirect.com/checkout?installStore=pontiac
- [ ] Verify this does NOT enable local mode
- [ ] No store selector should appear
- [ ] Order should NOT have local metadata

---

## Sign-Off

| Test | Passed | Tester | Date |
|------|--------|--------|------|
| National - No Local UI | | | |
| Local - Pontiac Checkout | | | |
| Local - Waterford Checkout | | | |
| Canonical URLs | | | |
| Store Switch | | | |
| PayPal Flow | | | |
| Failure Scenarios | | | |

---

## Notes

_Record any issues or observations here:_
