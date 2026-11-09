# Capital Tire feed and national catalog mode

## Storefront behavior

- National domains remain browsable. `/checkout` redirects to `/national-catalog`; new Stripe and PayPal sessions return HTTP 423. Existing payment returns, captures, and webhooks remain available.
- National cart and Jake flows direct shoppers to call or send a product selection through the contact form.
- Local domains retain checkout and installation. Capital Tire inventory is offered only in local tire search and is manually fulfilled.

## Capital Tire integration

- Uses read-only TireWorks HD `GetInventory` to find stocked SKUs, then `InventorySearch` by SKU to obtain the dealer price and FET. The size-only `InventorySearch` query returned only three 215/55R17 records while `GetInventory` listed many more stocked tires in that size. No supplier order method is called.
- Server-only environment variables: `CAPITAL_TIRE_APPLICATION_UID`, `CAPITAL_TIRE_COMPANY_ID`, `CAPITAL_TIRE_LOCATION_ID`, `CAPITAL_TIRE_CUSTOMER_ID`, `CAPITAL_TIRE_ADDRESS_ID`.
- `Price` is Warehouse Tire's purchase cost. Separately reported FET is added before the standard tire markup; the existing MAP floor then applies.
- Rows require a matching size, positive price, positive stock, and both supplier item and manufacturer SKU identifiers.
- Capital stock comes from one configured supplier location. The full inventory SKU list and local search each use a five-minute cache; local and national searches have separate keys. Public results omit Capital's dealer cost.
- Jake's local tire search uses the local storefront so it sees the same Capital stock as local shoppers.

## Release checks

1. Verify local 215/55R17 size search includes multiple Capital brands (for example Milestar, Kelly, and Cooper) with positive retail prices and no `cost` value.
2. Verify national tire search contains no Capital results.
3. Verify national `/checkout` redirects to `/national-catalog`, and a new national payment-session POST returns 423.
4. Verify local `/checkout` still opens and local payment-session POST is not blocked by the national gate. Do not place a test payment.
5. Verify contact form can carry selected cart SKUs. Do not send a test message to customers.

## Rollback

Redeploy the previous production deployment to restore the prior storefront behavior. Remove the Capital production environment variables if the supplier feed should stay disabled after rollback.
