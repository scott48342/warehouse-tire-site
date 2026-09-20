import { NextResponse } from "next/server";
import { sanitizeUpstreamBase } from "@/lib/wheelpros/upstreamBase";
import { getPool, createQuote, type QuoteLine } from "@/lib/quotes";
import { getStripeClient } from "@/lib/payments/stripeClient";
import { fetchAvailability, ORDERABLE_TYPES } from "@/lib/availabilityCache";
import { getSupplierCredentials } from "@/lib/supplierCredentialsSecure";
import type { CartItem } from "@/lib/cart/CartContext";
import { detectShopContext, buildLocalOrderMetadata, type LocalStore, STORES } from "@/lib/shopContext";
import { validateSavedQuoteOwnership } from "@/lib/savedQuotes/checkoutIntegration";
import { buildCheckoutLines } from "@/lib/checkout/buildCheckoutLines";
import {
  needsTotalsReview,
  resolveServerTotals,
  revisedTotalsPayload,
  totalsReviewDetail,
  totalsToQuoteLines,
  type CartItemHint,
} from "@/lib/checkout/orderTotals";
import { defaultCatalogPriceResolver } from "@/lib/checkout/repriceCatalog";
import { defaultHardwareSpecResolver } from "@/lib/checkout/hardwareSpec";
import { checkoutFailureResponse, rejectedLinesResponse } from "@/lib/checkout/responses";

export const runtime = "nodejs";

function moneyToCents(n: number) {
  const x = Math.round((Number(n) || 0) * 100);
  return Number.isFinite(x) ? x : 0;
}

/**
 * Validate live availability for wheel items before checkout.
 * Returns { ok: true } if all items available, or { ok: false, unavailable: [...] } if any are out of stock.
 */
async function validateWheelAvailability(items: CartItem[]): Promise<{
  ok: boolean;
  unavailable?: Array<{ sku: string; name: string; requestedQty: number; availableQty: number }>;
}> {
  // Filter to wheel items only (tires/accessories have different supply chains).
  // Staggered lines are expanded to front x2 + rear x2 so the REAR SKU's stock
  // is checked too (previously only front stock >= 4 was checked).
  const wheelItems: CartItem[] = items
    .filter((i) => i.type === "wheel" && i.sku)
    .flatMap((i) => {
      const rearSku = (i as { rearSku?: string }).rearSku;
      if (!rearSku) return [i];
      return [
        { ...i, quantity: 2 } as CartItem,
        { ...i, sku: rearSku, quantity: 2, model: `${(i as any).model || i.sku} (rear)` } as CartItem,
      ];
    });
  
  if (wheelItems.length === 0) {
    return { ok: true }; // No wheels to validate
  }
  
  const wheelProsBase = sanitizeUpstreamBase(process.env.WHEELPROS_WRAPPER_URL || process.env.NEXT_PUBLIC_WHEELPROS_API_BASE_URL) || undefined;
  if (!wheelProsBase) {
    console.warn("[checkout] WHEELPROS_WRAPPER_URL not configured, skipping availability check");
    return { ok: true }; // Skip validation if not configured (fail open)
  }
  
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.WHEELPROS_WRAPPER_API_KEY) {
    headers["x-api-key"] = process.env.WHEELPROS_WRAPPER_API_KEY;
  }
  
  const wpCreds = await getSupplierCredentials("wheelpros");
  const unavailable: Array<{ sku: string; name: string; requestedQty: number; availableQty: number }> = [];
  
  // Check each wheel's availability
  await Promise.all(
    wheelItems.map(async (item) => {
      const sku = String(item.sku || "").trim();
      const qty = item.quantity || 1;
      const name = String((item as any).model || item.sku || "Wheel");
      
      try {
        const avail = await fetchAvailability({
          wheelProsBase,
          headers,
          sku,
          minQty: qty,
          customerNumber: wpCreds.customerNumber || undefined,
          companyCode: wpCreds.companyCode || undefined,
        });
        
        const totalStock = (avail.localQty || 0) + (avail.globalQty || 0);
        const isOrderable = ORDERABLE_TYPES.has(avail.inventoryType);
        
        if (!avail.ok || !isOrderable || totalStock < qty) {
          unavailable.push({
            sku,
            name,
            requestedQty: qty,
            availableQty: totalStock,
          });
        }
      } catch (e) {
        console.error(`[checkout] Availability check failed for ${sku}:`, e);
        // FAIL-OPEN: On API error, allow checkout to proceed
        // Only block when we're CERTAIN items are unavailable (not on network/API errors)
        // This prevents checkout blocking due to transient WheelPros API issues
        console.warn(`[checkout] Skipping availability block for ${sku} due to API error (fail-open)`);
      }
    })
  );
  
  if (unavailable.length > 0) {
    console.warn(`[checkout] ${unavailable.length} wheel(s) unavailable:`, unavailable);
    return { ok: false, unavailable };
  }
  
  return { ok: true };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const items: CartItem[] = Array.isArray(body.items) ? body.items : [];

    const customer = body.customer && typeof body.customer === "object" ? body.customer : {};
    const firstName = String(customer.firstName || "").trim();
    const lastName = String(customer.lastName || "").trim();
    const email = String(customer.email || "").trim();
    const phone = String(customer.phone || "").trim();

    if (!firstName || !lastName) {
      return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
    }
    if (!email && !phone) {
      return NextResponse.json({ ok: false, error: "email_or_phone_required" }, { status: 400 });
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // AVAILABILITY VALIDATION - SOFT CHECK
    // Only WARN on availability issues, don't block checkout.
    // We trust the SFTP feed data shown on the website.
    // API check is informational only - block only on explicit 0 stock with high confidence.
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    try {
      const availCheck = await validateWheelAvailability(items);
      if (!availCheck.ok && availCheck.unavailable) {
        // Log but don't block - items showed as in-stock on website
        console.warn("[checkout] Availability warning (not blocking):", availCheck.unavailable);
      }
    } catch (availErr) {
      console.warn("[checkout] Availability check error (not blocking):", availErr);
    }

    const vehicle = body.vehicle && typeof body.vehicle === "object" ? body.vehicle : undefined;
    const shippingInfo = body.shipping && typeof body.shipping === "object" ? body.shipping : {};
    
    // Cart ID for linking add-to-cart events to purchases
    const cartId = typeof body.cartId === "string" ? body.cartId.trim() : undefined;
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // LOCAL MODE DETECTION - Install store tagging for local orders
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    const shopContext = detectShopContext(new Headers(req.headers));
    const isLocalMode = shopContext.mode === 'local';
    
    // Accept install store from body (passed by checkout page in local mode)
    const installStoreId = isLocalMode && body.installStore 
      ? (body.installStore as LocalStore) 
      : undefined;
    const installStore = installStoreId ? STORES[installStoreId] : undefined;
    
    const taxInfo = body.tax && typeof body.tax === "object" ? body.tax : {};

    // Convert cart items to quote lines - SERVER-SIDE re-priced, staggered sets
    // split into front x2 + rear x2 so the order snapshot and supplier PO carry
    // both SKUs (safety review Q1-1 / Q7-2, 2026-09-19). Unpriceable wheel/tire
    // SKUs reject the checkout; they never fall back to the client price or $0.
    // IMPORTANT: keep $0 REQUIRED install hardware in the quote snapshot / order payload.
    const built = await buildCheckoutLines(items, defaultCatalogPriceResolver, defaultHardwareSpecResolver);
    if (!built.ok) return rejectedLinesResponse("checkout", built.rejected);
    if (built.repriced.length > 0) {
      console.warn("[checkout] client/server price mismatch (server price charged):", built.repriced);
    }
    const linesAll: QuoteLine[] = built.lines.filter((l) => l.qty > 0);

    if (linesAll.length === 0) {
      return NextResponse.json({ ok: false, error: "empty_cart" }, { status: 400 });
    }

    // ------------------------------------------------------------------------------------
    // SERVER-AUTHORITATIVE TOTALS (Codex release review 2026-09-20)
    // Tax, shipping, local service fees and the discount are recomputed here from the
    // server-priced lines; the client-sent amounts are only logged as deltas. A total that
    // differs from what the shopper was shown (expectedTotal), or a discount that no longer
    // validates, returns a recoverable 409 for review - nothing is created or charged.
    // ------------------------------------------------------------------------------------
    const db = getPool();
    const totalsResult = await resolveServerTotals({
      db,
      productLines: linesAll,
      cartHints: items as CartItemHint[],
      isLocal: isLocalMode,
      // Tax jurisdiction + shipping rate come from the fulfillment point of record: the
      // ship-to (= billing) address nationally, the install store locally. body.tax is
      // logged as a delta only.
      fulfillment: isLocalMode
        ? { kind: "store", store: installStore ?? STORES.pontiac }
        : { kind: "ship", address: { state: shippingInfo.state, zip: shippingInfo.zip } },
      claim: { shipping: { amount: shippingInfo.amount, isFree: shippingInfo.isFree }, tax: taxInfo, discount: body.discount, localFees: body.localFees, expectedTotal: body.expectedTotal },
    });
    if (!totalsResult.ok) {
      console.warn(`[checkout] totals blocked: ${totalsResult.error}`, { zip: shippingInfo.zip });
      return NextResponse.json({ ok: false, error: totalsResult.error, detail: totalsResult.detail }, { status: 409 });
    }
    const totals = totalsResult.totals;
    if (Object.values(totals.clientDelta).some((d) => Math.abs(d) >= 0.01)) {
      console.warn(`[checkout] client/server totals mismatch (server totals charged):`, totals.clientDelta);
    }
    if (needsTotalsReview(totals, body.expectedTotal)) {
      return NextResponse.json(
        { ok: false, error: "totals_changed", detail: totalsReviewDetail(totals, body.expectedTotal), revised: revisedTotalsPayload(totals, body.expectedTotal) },
        { status: 409 },
      );
    }
    linesAll.push(...totalsToQuoteLines(totals, { zip: String(shippingInfo.zip || "").trim() || undefined }));
    const taxState = totals.taxState;
    const taxAmount = totals.taxUsd;
    const shippingAmount = totals.shippingUsd;
    const discountCents = Math.round(totals.discountUsd * 100);

    // Stripe line items: exclude $0 lines (Stripe doesn't allow meaningful $0 charges).
    const stripeLines = linesAll.filter((l) => l.unitPriceUsd > 0);

    if (stripeLines.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "no_billable_items",
          detail: "Cart only contains $0 items. Required install hardware is preserved in quote snapshot, but nothing is billable.",
        },
        { status: 400 }
      );
    }

    const stripeConn = await getStripeClient(db);
    if (!stripeConn) {
      return NextResponse.json({ ok: false, error: "stripe_not_configured" }, { status: 400 });
    }

    // Log Stripe mode for debugging
    console.log(`[checkout] Stripe mode: ${stripeConn.mode}`);

    // Build local mode metadata for quote (if applicable)
    const localModeData = isLocalMode && installStore ? {
      channel: 'local' as const,
      fulfillmentMode: 'install' as const,
      installStore: installStoreId!,
      installStoreName: installStore.name,
      installStorePhone: installStore.phone,
      installStoreAddress: `${installStore.address}, ${installStore.city}, ${installStore.state} ${installStore.zip}`,
    } : undefined;

    // Build customer address (saved for ALL orders - shipping for national, billing/contact for local)
    const shippingAddressData = shippingInfo.address ? {
      address1: String(shippingInfo.address || "").trim(),
      address2: shippingInfo.address2 ? String(shippingInfo.address2).trim() : undefined,
      city: String(shippingInfo.city || "").trim(),
      state: String(shippingInfo.state || "").trim().toUpperCase(),
      zip: String(shippingInfo.zip || "").trim(),
    } : undefined;

    const origin = new URL(req.url).origin;

    // Build Stripe line items from stripeLines (which already includes shipping + tax from linesAll)
    console.log(`[checkout] stripeLines (${stripeLines.length} items):`, stripeLines.map(l => ({ name: l.name, price: l.unitPriceUsd, qty: l.qty })));
    
    const stripeLineItems = stripeLines.map((l) => ({
      quantity: l.qty,
      price_data: {
        currency: "usd",
        unit_amount: moneyToCents(l.unitPriceUsd),
        product_data: {
          name: l.name,
          metadata: l.sku ? { sku: l.sku } : undefined,
        },
      },
    }));
    
    // NOTE: Shipping and tax are already included in linesAll/stripeLines above
    // Do NOT add them again here (was causing double-charging)

    // Hosted Checkout cannot take negative line items: the server-validated discount is
    // applied as a one-off Stripe coupon (amount_off) so the charged total equals the
    // reviewed total. Eligibility below uses the NET total.
    const grossCents = stripeLineItems.reduce((sum, li) => sum + (li.price_data.unit_amount * li.quantity), 0);
    const totalCents = grossCents - discountCents;
    if (totalCents !== Math.round(totals.totalUsd * 100)) {
      console.error("[checkout] internal totals disagreement", { grossCents, discountCents, totalCents, serverTotal: totals.totalUsd });
      return NextResponse.json({ ok: false, error: "totals_internal_mismatch", detail: "We couldn't confirm your order total. Please refresh and try again." }, { status: 409 });
    }
    if (totalCents < 50) {
      return NextResponse.json({ ok: false, error: "total_below_minimum", detail: "Order total is below the minimum card charge." }, { status: 400 });
    }
    const totalUsd = totalCents / 100;

    // The quote records the exact charge it was created for (reconciliation record).
    const { id: quoteId } = await createQuote(db, {
      customer: { firstName, lastName, email: email || undefined, phone: phone || undefined },
      vehicle,
      lines: linesAll,
      localMode: localModeData,
      discount: totals.discountCode && totals.discountUsd > 0
        ? { code: totals.discountCode, amount: totals.discountUsd, type: totals.discountType || "promo" }
        : undefined,
      shippingAddress: shippingAddressData,
      expectedChargeCents: totalCents,
    });
    let stripeDiscounts: Array<{ coupon: string }> | undefined;
    if (discountCents > 0) {
      const coupon = await (stripeConn.stripe.coupons.create as Function)({
        amount_off: discountCents,
        currency: "usd",
        duration: "once",
        name: totals.discountCode || "Discount",
        metadata: { code: totals.discountCode || "", type: totals.discountType || "" },
      });
      stripeDiscounts = [{ coupon: coupon.id }];
    }

    // Check if specific payment method requested (e.g., Affirm-only checkout)
    const requestedPaymentMethod = body.paymentMethod;
    
    // Payment methods: Card + Affirm (most recognized BNPL in US)
    // Affirm minimum is $50, so only include if order qualifies
    let paymentMethodTypes: string[];
    
    if (requestedPaymentMethod === "affirm") {
      // Affirm-only checkout (direct "Pay with Affirm" button)
      if (totalUsd < 50) {
        return NextResponse.json({ 
          ok: false, 
          error: "affirm_minimum_not_met",
          detail: "Affirm requires a minimum order of $50"
        }, { status: 400 });
      }
      paymentMethodTypes = ["affirm"];
      console.log(`[checkout] AFFIRM-ONLY checkout for $${totalUsd.toFixed(2)}`);
    } else {
      // Standard checkout: Card + Affirm if eligible
      paymentMethodTypes = ["card"];
      if (totalUsd >= 50) {
        paymentMethodTypes.push("affirm");
      }
      console.log(`[checkout] Payment methods for $${totalUsd.toFixed(2)}:`, paymentMethodTypes);
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // SAVED QUOTE CONVERSION TRACKING
    // If checkout was initiated from a resumed saved quote, validate ownership
    // and attach the quote ID to Stripe metadata for conversion tracking.
    // 
    // NOTE: Affirm/Hosted Checkout path is EXCLUDED from saved quote conversion
    // until Affirm test environment verification is complete. The order will
    // still be created normally, but the Saved Quote won't auto-mark as Purchased.
    // TODO: Enable Affirm saved quote conversion after test environment verification.
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    let validatedSavedQuoteId: string | undefined;
    const clientSavedQuoteId = body.savedQuoteId;
    const isAffirmCheckout = requestedPaymentMethod === "affirm";
    
    if (clientSavedQuoteId && !isAffirmCheckout) {
      // Only enable saved quote conversion for card payments (Payment Element)
      // Affirm uses Hosted Checkout which hasn't been tested with this feature
      const validation = await validateSavedQuoteOwnership(clientSavedQuoteId);
      if (validation.valid && validation.quoteId) {
        validatedSavedQuoteId = validation.quoteId;
        console.log(`[checkout] âœ“ Saved quote ${validatedSavedQuoteId} validated for conversion tracking`);
      } else {
        // Log but don't fail checkout - customer can still purchase
        console.warn(`[checkout] Saved quote validation failed: ${validation.reason}`);
      }
    } else if (clientSavedQuoteId && isAffirmCheckout) {
      // Log that we're skipping conversion for Affirm
      console.log(`[checkout] Saved quote conversion skipped for Affirm checkout (not yet verified)`);
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // USAF FULFILLMENT BRANCH SELECTION
    // Pick the nearest USAF warehouse with complete stock so the order ships
    // from the same origin used for the freight quote. Persisted in metadata
    // and submitted as <branch> when the supplier order is placed.
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    let usafBranch: string | undefined;
    if (!isLocalMode && shippingInfo.zip) {
      try {
        const { selectUsafBranchForCartLines } = await import("@/lib/usautoforce/branchSelector");
        const selection = await selectUsafBranchForCartLines(linesAll, String(shippingInfo.zip));
        if (selection) {
          usafBranch = selection.branchCode;
          console.log(`[checkout] USAF fulfillment branch: ${usafBranch} (${selection.warehouse.city}, ${selection.warehouse.state}) - ${selection.distanceMiles}mi, complete=${selection.complete}`);
        }
      } catch (usafErr) {
        console.error("[checkout] USAF branch selection failed (non-blocking):", usafErr);
      }
    }

    // Build metadata - include local install info if in local mode
    const sessionMetadata: Record<string, string | undefined> = {
      serverTotal: totals.totalUsd.toFixed(2),
      ...(discountCents > 0 ? { discountCode: totals.discountCode || "", discountAmount: totals.discountUsd.toFixed(2) } : {}),
      quoteId,
      cartId: cartId || undefined,
      // Only include savedQuoteId if ownership was verified server-side
      savedQuoteId: validatedSavedQuoteId,
      taxState: taxState || undefined,
      taxAmount: taxAmount > 0 ? String(taxAmount.toFixed(2)) : undefined,
      shippingAmount: shippingAmount > 0 ? String(shippingAmount.toFixed(2)) : undefined,
      shippingZip: shippingInfo.zip || undefined,
      usafBranch,
    };
    
    // Add local mode metadata - ONLY when in local mode with valid store
    if (isLocalMode && installStore) {
      sessionMetadata.channel = 'local';
      sessionMetadata.fulfillment_mode = 'install';
      sessionMetadata.install_store = installStoreId;
      sessionMetadata.install_store_name = installStore.name;
      sessionMetadata.install_store_phone = installStore.phone;
      sessionMetadata.install_store_address = `${installStore.address}, ${installStore.city}, ${installStore.state} ${installStore.zip}`;
      
      console.log(`[checkout] LOCAL MODE - Install at: ${installStore.name}`);
    }

    const sessionParams: any = {
      mode: "payment" as const,
      payment_method_types: paymentMethodTypes,
      customer_email: email || undefined,
      line_items: stripeLineItems,
      ...(stripeDiscounts ? { discounts: stripeDiscounts } : {}),
      metadata: sessionMetadata,
      shipping_address_collection: {
        allowed_countries: ["US"] as const,
      },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?canceled=1`,
    };
    const session = await (stripeConn.stripe.checkout.sessions.create as Function)(sessionParams);

    return NextResponse.json({ ok: true, url: session.url, quoteId }, { status: 200 });
  } catch (e: any) {
    // Generic client message + reference id; the real error stays in the server log.
    return checkoutFailureResponse("checkout", e);
  }
}
