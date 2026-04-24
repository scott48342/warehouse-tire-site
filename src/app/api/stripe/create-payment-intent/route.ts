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

    // Convert cart items to quote lines
    const linesAll: QuoteLine[] = items
      .map((i: any) => {
        const kind: QuoteLine["kind"] = "product";
        const name = String(i.model || i.name || i.sku || "Item").trim();
        const sku = String(i.sku || "").trim() || undefined;
        const unitPriceUsd = Number(i.unitPrice || 0);
        const qty = Math.max(1, Math.trunc(Number(i.quantity || 1)));
        const taxable = i.type === "wheel" || i.type === "tire";

        const meta = {
          cartType: i.type,
          category: i.category,
          required: !!i.required,
          wheelSku: i.wheelSku,
          spec: i.spec,
          meta: i.meta,
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
    // LOCAL MODE SERVICE FEES
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

    const db = getPool();
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

    const { id: quoteId } = await createQuote(db, {
      customer: { firstName, lastName, email: email || undefined, phone: phone || undefined },
      vehicle,
      lines: linesAll,
      localMode: localModeData,
    });

    // Calculate total in cents
    const totalCents = stripeLines.reduce((sum, l) => sum + moneyToCents(l.unitPriceUsd) * l.qty, 0);
    const totalUsd = totalCents / 100;

    // Payment methods: Card only for embedded form
    // BNPL options (Affirm, Afterpay, Klarna) use hosted checkout session
    const paymentMethodTypes: string[] = ["card"];

    console.log(`[checkout/payment-intent] Card-only PaymentIntent for $${totalUsd.toFixed(2)}`);

    // Build metadata for PaymentIntent
    const metadata: Record<string, string> = {
      quoteId,
      ...(cartId ? { cartId } : {}),
      ...(taxState ? { taxState } : {}),
      ...(taxAmount > 0 ? { taxAmount: String(taxAmount.toFixed(2)) } : {}),
      ...(shippingAmount > 0 ? { shippingAmount: String(shippingAmount.toFixed(2)) } : {}),
      ...(shippingInfo.zip ? { shippingZip: shippingInfo.zip } : {}),
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
    console.error("[checkout/payment-intent] Error:", e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
