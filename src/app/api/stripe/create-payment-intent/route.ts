import { NextResponse } from "next/server";
import { sanitizeUpstreamBase } from "@/lib/wheelpros/upstreamBase";
import { getPool, createQuote, type QuoteLine } from "@/lib/quotes";
import { getStripeClient } from "@/lib/payments/stripeClient";
import { fetchAvailability, ORDERABLE_TYPES } from "@/lib/availabilityCache";
import { getSupplierCredentials } from "@/lib/supplierCredentialsSecure";
import type { CartItem } from "@/lib/cart/CartContext";
import { detectShopContext, buildLocalOrderMetadata, type LocalStore, STORES } from "@/lib/shopContext";
import { cancelSupersededPaymentIntent } from "@/lib/checkout/supersededPaymentIntent";
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
  // Filter to wheel items only (tires/accessories have different supply chains)
  const wheelItems = items.filter((i) => i.type === "wheel" && i.sku);
  
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

    // ═══════════════════════════════════════════════════════════════════════════
    // AVAILABILITY VALIDATION - SOFT CHECK
    // ═══════════════════════════════════════════════════════════════════════════
    try {
      const availCheck = await validateWheelAvailability(items);
      if (!availCheck.ok && availCheck.unavailable) {
        console.warn("[checkout] Availability warning (not blocking):", availCheck.unavailable);
      }
    } catch (availErr) {
      console.warn("[checkout] Availability check error (not blocking):", availErr);
    }

    const vehicle = body.vehicle && typeof body.vehicle === "object" ? body.vehicle : undefined;
    const shippingInfo = body.shipping && typeof body.shipping === "object" ? body.shipping : {};
    
    // Cart ID for linking add-to-cart events to purchases
    const cartId = typeof body.cartId === "string" ? body.cartId.trim() : undefined;
    
    // ═══════════════════════════════════════════════════════════════════════════
    // LOCAL MODE DETECTION - Install store tagging for local orders
    // ═══════════════════════════════════════════════════════════════════════════
    const shopContext = detectShopContext(new Headers(req.headers));
    const isLocalMode = shopContext.mode === 'local';
    
    // Accept install store from body (passed by checkout page in local mode)
    const installStoreId = isLocalMode && body.installStore 
      ? (body.installStore as LocalStore) 
      : undefined;
    const installStore = installStoreId ? STORES[installStoreId] : undefined;
    
    const taxInfo = body.tax && typeof body.tax === "object" ? body.tax : {};

    // Convert cart items to quote lines - SERVER-SIDE re-priced through the same
    // builder as create-checkout-session (release review 2026-09-19: this embedded
    // Payment Element path previously charged the client-sent unitPrice for every
    // item and never split staggered sets). Unpriceable lines reject the checkout.
    const built = await buildCheckoutLines(items, defaultCatalogPriceResolver, defaultHardwareSpecResolver);
    if (!built.ok) return rejectedLinesResponse("checkout/payment-intent", built.rejected);
    if (built.repriced.length > 0) {
      console.warn("[checkout/payment-intent] client/server price mismatch (server price charged):", built.repriced);
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
      console.warn(`[checkout/payment-intent] totals blocked: ${totalsResult.error}`, { zip: shippingInfo.zip });
      return NextResponse.json({ ok: false, error: totalsResult.error, detail: totalsResult.detail }, { status: 409 });
    }
    const totals = totalsResult.totals;
    if (Object.values(totals.clientDelta).some((d) => Math.abs(d) >= 0.01)) {
      console.warn(`[checkout/payment-intent] client/server totals mismatch (server totals charged):`, totals.clientDelta);
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

    // Stripe line items: exclude $0 lines
    const stripeLines = linesAll.filter((l) => l.unitPriceUsd > 0);

    if (stripeLines.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "no_billable_items",
          detail: "Cart only contains $0 items.",
        },
        { status: 400 }
      );
    }

    const stripeConn = await getStripeClient(db);
    if (!stripeConn) {
      return NextResponse.json({ ok: false, error: "stripe_not_configured" }, { status: 400 });
    }

    console.log(`[checkout/payment-intent] Stripe mode: ${stripeConn.mode}`);

    // Build local mode metadata for quote
    const localModeData = isLocalMode && installStore ? {
      channel: 'local' as const,
      fulfillmentMode: 'install' as const,
      installStore: installStoreId!,
      installStoreName: installStore.name,
      installStorePhone: installStore.phone,
      installStoreAddress: `${installStore.address}, ${installStore.city}, ${installStore.state} ${installStore.zip}`,
    } : undefined;

    // Discount as validated on the server (never the client-sent amount)
    const discountData = totals.discountCode && totals.discountUsd > 0
      ? { code: totals.discountCode, amount: totals.discountUsd, type: totals.discountType || "promo" }
      : undefined;

    // Build customer address (saved for ALL orders - shipping for national, billing/contact for local)
    const shippingAddressData = shippingInfo.address ? {
      address1: String(shippingInfo.address || "").trim(),
      address2: shippingInfo.address2 ? String(shippingInfo.address2).trim() : undefined,
      city: String(shippingInfo.city || "").trim(),
      state: String(shippingInfo.state || "").trim().toUpperCase(),
      zip: String(shippingInfo.zip || "").trim(),
    } : undefined;

    // Charge = server lines minus the server-validated discount (the discount was previously
    // only recorded in quote metadata and never taken off the charge).
    const grossCents = stripeLines.reduce((sum, l) => sum + moneyToCents(l.unitPriceUsd) * l.qty, 0);
    const totalCents = grossCents - discountCents;
    if (totalCents !== Math.round(totals.totalUsd * 100)) {
      console.error("[checkout/payment-intent] internal totals disagreement", { grossCents, discountCents, totalCents, serverTotal: totals.totalUsd });
      return NextResponse.json({ ok: false, error: "totals_internal_mismatch", detail: "We couldn't confirm your order total. Please refresh and try again." }, { status: 409 });
    }
    if (totalCents < 50) {
      return NextResponse.json({ ok: false, error: "total_below_minimum", detail: "Order total is below the minimum card charge." }, { status: 400 });
    }
    const totalUsd = totalCents / 100;

    // The quote records the exact charge it was created for; the webhook fulfils nothing else.
    const { id: quoteId } = await createQuote(db, {
      customer: { firstName, lastName, email: email || undefined, phone: phone || undefined },
      vehicle,
      lines: linesAll,
      localMode: localModeData,
      discount: discountData,
      shippingAddress: shippingAddressData,
      expectedChargeCents: totalCents,
    });

    // Payment methods: Card only for embedded form
    // BNPL options (Affirm, Afterpay, Klarna) use hosted checkout session
    const paymentMethodTypes: string[] = ["card"];

    console.log(`[checkout/payment-intent] Card-only PaymentIntent for $${totalUsd.toFixed(2)}`);

    // ═══════════════════════════════════════════════════════════════════════════
    // SAVED QUOTE CONVERSION TRACKING
    // If checkout was initiated from a resumed saved quote, validate ownership
    // and attach the quote ID to Stripe metadata for conversion tracking.
    // ═══════════════════════════════════════════════════════════════════════════
    let validatedSavedQuoteId: string | undefined;
    const clientSavedQuoteId = body.savedQuoteId;
    
    if (clientSavedQuoteId) {
      const validation = await validateSavedQuoteOwnership(clientSavedQuoteId);
      if (validation.valid && validation.quoteId) {
        validatedSavedQuoteId = validation.quoteId;
        console.log(`[checkout/payment-intent] ✓ Saved quote ${validatedSavedQuoteId} validated for conversion tracking`);
      } else {
        // Log but don't fail checkout - customer can still purchase
        console.warn(`[checkout/payment-intent] Saved quote validation failed: ${validation.reason}`);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // USAF FULFILLMENT BRANCH SELECTION
    // Pick the nearest USAF warehouse with complete stock so the order ships
    // from the same origin used for the freight quote. Persisted in metadata
    // and submitted as <branch> when the supplier order is placed.
    // ═══════════════════════════════════════════════════════════════════════════
    let usafBranch: string | undefined;
    if (!isLocalMode && shippingInfo.zip) {
      try {
        const { selectUsafBranchForCartLines } = await import("@/lib/usautoforce/branchSelector");
        const selection = await selectUsafBranchForCartLines(linesAll, String(shippingInfo.zip));
        if (selection) {
          usafBranch = selection.branchCode;
          console.log(`[checkout/payment-intent] USAF fulfillment branch: ${usafBranch} (${selection.warehouse.city}, ${selection.warehouse.state}) - ${selection.distanceMiles}mi, complete=${selection.complete}`);
        }
      } catch (usafErr) {
        console.error("[checkout/payment-intent] USAF branch selection failed (non-blocking):", usafErr);
      }
    }

    // Build metadata for PaymentIntent
    const metadata: Record<string, string> = {
      quoteId,
      ...(cartId ? { cartId } : {}),
      // Only include savedQuoteId if ownership was verified server-side
      ...(validatedSavedQuoteId ? { savedQuoteId: validatedSavedQuoteId } : {}),
      ...(taxState ? { taxState } : {}),
      ...(taxAmount > 0 ? { taxAmount: String(taxAmount.toFixed(2)) } : {}),
      ...(shippingAmount > 0 ? { shippingAmount: String(shippingAmount.toFixed(2)) } : {}),
      ...(shippingInfo.zip ? { shippingZip: shippingInfo.zip } : {}),
      ...(usafBranch ? { usafBranch } : {}),
      ...(discountCents > 0 ? { discountCode: totals.discountCode || "", discountAmount: totals.discountUsd.toFixed(2) } : {}),
      serverTotal: totals.totalUsd.toFixed(2),
    };
    
    // Add local mode metadata
    if (isLocalMode && installStore) {
      metadata.channel = 'local';
      metadata.fulfillment_mode = 'install';
      metadata.install_store = installStoreId!;
      metadata.install_store_name = installStore.name;
      metadata.install_store_phone = installStore.phone;
      metadata.install_store_address = `${installStore.address}, ${installStore.city}, ${installStore.state} ${installStore.zip}`;
      
      console.log(`[checkout/payment-intent] LOCAL MODE - Install at: ${installStore.name}`);
    }

    // Build line item description for Stripe
    const description = stripeLines
      .slice(0, 5) // First 5 items
      .map(l => `${l.name} x${l.qty}`)
      .join(", ") + (stripeLines.length > 5 ? ` +${stripeLines.length - 5} more` : "");

    // The shopper changed cart/address/discount after an intent existed and sent the old id back:
    // cancel it so the stale amount can never be confirmed. Cart-owned intents only; best effort.
    await cancelSupersededPaymentIntent(stripeConn.stripe, body.supersedesPaymentIntentId, cartId);

    // Create PaymentIntent
    const paymentIntent = await stripeConn.stripe.paymentIntents.create({
      amount: totalCents,
      currency: "usd",
      payment_method_types: paymentMethodTypes,
      metadata,
      description,
      receipt_email: email || undefined,
      // Shipping info for Affirm (required for Affirm payments)
      shipping: shippingInfo.address ? {
        name: `${firstName} ${lastName}`,
        phone: phone || undefined,
        address: {
          line1: shippingInfo.address,
          line2: shippingInfo.address2 || undefined,
          city: shippingInfo.city,
          state: shippingInfo.state,
          postal_code: shippingInfo.zip,
          country: "US",
        },
      } : undefined,
    });

    console.log(`[checkout/payment-intent] Created PaymentIntent: ${paymentIntent.id}, quote: ${quoteId}`);

    return NextResponse.json({
      ok: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      quoteId,
      paymentMethods: paymentMethodTypes,
    });
  } catch (e: any) {
    // Generic client message + reference id; the real error stays in the server log.
    return checkoutFailureResponse("checkout/payment-intent", e);
  }
}
