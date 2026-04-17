import { NextResponse } from "next/server";
import { getPool, createQuote, type QuoteLine } from "@/lib/quotes";
import { getStripeClient } from "@/lib/payments/stripeClient";
import { fetchAvailability, ORDERABLE_TYPES } from "@/lib/availabilityCache";
import { getSupplierCredentials } from "@/lib/supplierCredentialsSecure";
import type { CartItem } from "@/lib/cart/CartContext";
import { detectShopContext, buildLocalOrderMetadata, type LocalStore, STORES } from "@/lib/shopContext";

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
  
  const wheelProsBase = process.env.WHEELPROS_WRAPPER_URL || process.env.NEXT_PUBLIC_WHEELPROS_API_BASE_URL;
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

    // ═══════════════════════════════════════════════════════════════════════════
    // AVAILABILITY VALIDATION - SOFT CHECK
    // Only WARN on availability issues, don't block checkout.
    // We trust the SFTP feed data shown on the website.
    // API check is informational only - block only on explicit 0 stock with high confidence.
    // ═══════════════════════════════════════════════════════════════════════════
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
    const shippingAmount = Number(shippingInfo.amount) || 0;
    const shippingIsFree = !!shippingInfo.isFree;
    
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
    const taxAmount = Number(taxInfo.amount) || 0;
    const taxState = String(taxInfo.state || "").toUpperCase();

    // Convert cart items to quote lines.
    // IMPORTANT: keep $0 REQUIRED install hardware in the quote snapshot / order payload.
    const linesAll: QuoteLine[] = items
      .map((i: any) => {
        const kind: QuoteLine["kind"] = "product";
        const name = String(i.model || i.name || i.sku || "Item").trim();
        const sku = String(i.sku || "").trim() || undefined;
        const unitPriceUsd = Number(i.unitPrice || 0);
        const qty = Math.max(1, Math.trunc(Number(i.quantity || 1)));
        const taxable = i.type === "wheel" || i.type === "tire"; // accessories treated as non-taxable for now

        const meta = {
          cartType: i.type,
          category: i.category,
          required: !!i.required,
          wheelSku: i.wheelSku,
          spec: i.spec,
          meta: i.meta,
          // Supplier source for internal tracking (shown in admin email)
          source: i.source,
        };

        return { kind, name, sku, unitPriceUsd, qty, taxable, meta };
      })
      .filter((l) => l.qty > 0);

    if (linesAll.length === 0) {
      return NextResponse.json({ ok: false, error: "empty_cart" }, { status: 400 });
    }

    // Add shipping as a quote line if applicable
    if (shippingAmount > 0 && !shippingIsFree) {
      linesAll.push({
        kind: "product",
        name: "Shipping & Handling",
        sku: undefined,
        unitPriceUsd: shippingAmount,
        qty: 1,
        taxable: false,
        meta: { type: "shipping", zip: shippingInfo.zip },
      });
    }

    // Add tax as a quote line if applicable
    if (taxAmount > 0) {
      console.log(`[checkout] Adding tax line: $${taxAmount} (${taxState})`);
      linesAll.push({
        kind: "product",
        name: `Sales Tax${taxState ? ` (${taxState})` : ""}`,
        sku: undefined,
        unitPriceUsd: taxAmount,
        qty: 1,
        taxable: false,
        meta: { type: "tax", state: taxState },
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LOCAL MODE SERVICE FEES - Installation, recycling, card processing
    // ═══════════════════════════════════════════════════════════════════════════
    const localFees = body.localFees && typeof body.localFees === "object" ? body.localFees : null;
    
    console.log(`[checkout] isLocalMode=${isLocalMode}, localFees=`, localFees);
    
    if (isLocalMode && localFees) {
      const installAmount = Number(localFees.installation) || 0;
      const recyclingAmount = Number(localFees.recycling) || 0;
      const cardFeeAmount = Number(localFees.cardProcessing) || 0;
      const tireCount = Number(localFees.tireCount) || 0;
      
      if (installAmount > 0) {
        linesAll.push({
          kind: "product",
          name: `Installation (${tireCount} tires)`,
          sku: undefined,
          unitPriceUsd: installAmount,
          qty: 1,
          taxable: false,
          meta: { type: "service", serviceType: "installation", tireCount },
        });
      }
      
      if (recyclingAmount > 0) {
        linesAll.push({
          kind: "product",
          name: `Tire Recycling (${tireCount})`,
          sku: undefined,
          unitPriceUsd: recyclingAmount,
          qty: 1,
          taxable: false,
          meta: { type: "service", serviceType: "recycling", tireCount },
        });
      }
      
      if (cardFeeAmount > 0) {
        linesAll.push({
          kind: "product",
          name: "Non-Cash Price",
          sku: undefined,
          unitPriceUsd: cardFeeAmount,
          qty: 1,
          taxable: false,
          meta: { type: "fee", feeType: "card_processing" },
        });
      }
      
      console.log(`[checkout] LOCAL FEES - Install: $${installAmount}, Recycling: $${recyclingAmount}, Card Fee: $${cardFeeAmount}`);
    }

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

    const db = getPool();
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

    const { id: quoteId } = await createQuote(db, {
      customer: { firstName, lastName, email: email || undefined, phone: phone || undefined },
      vehicle,
      lines: linesAll,
      localMode: localModeData,
    });

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

    // Calculate total for payment method eligibility
    const totalCents = stripeLineItems.reduce((sum, li) => sum + (li.price_data.unit_amount * li.quantity), 0);
    const totalUsd = totalCents / 100;

    // Payment methods: Card + Affirm (most recognized BNPL in US)
    // Affirm minimum is $50, so only include if order qualifies
    const paymentMethodTypes: string[] = ["card"];
    
    if (totalUsd >= 50) {
      paymentMethodTypes.push("affirm");
    }

    console.log(`[checkout] Payment methods for $${totalUsd.toFixed(2)}:`, paymentMethodTypes);

    // Build metadata - include local install info if in local mode
    const sessionMetadata: Record<string, string | undefined> = {
      quoteId,
      cartId: cartId || undefined,
      taxState: taxState || undefined,
      taxAmount: taxAmount > 0 ? String(taxAmount.toFixed(2)) : undefined,
      shippingAmount: shippingAmount > 0 ? String(shippingAmount.toFixed(2)) : undefined,
      shippingZip: shippingInfo.zip || undefined,
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
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
