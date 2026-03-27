import { NextResponse } from "next/server";
import { getPool, createQuote, type QuoteLine } from "@/lib/quotes";
import { getPayPalClient } from "@/lib/payments/paypalClient";
import { fetchAvailability, ORDERABLE_TYPES } from "@/lib/availabilityCache";
import { getSupplierCredentials } from "@/lib/supplierCredentialsSecure";
import type { CartItem } from "@/lib/cart/CartContext";

export const runtime = "nodejs";

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
    console.warn("[paypal-checkout] WHEELPROS_WRAPPER_URL not configured, skipping availability check");
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
        console.error(`[paypal-checkout] Availability check failed for ${sku}:`, e);
        // On error, add to unavailable list (fail safe)
        unavailable.push({
          sku,
          name,
          requestedQty: qty,
          availableQty: 0,
        });
      }
    })
  );
  
  if (unavailable.length > 0) {
    console.warn(`[paypal-checkout] ${unavailable.length} wheel(s) unavailable:`, unavailable);
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
    // LIVE AVAILABILITY VALIDATION (DB-first architecture)
    // Block checkout if any wheels are out of stock or unavailable
    // ═══════════════════════════════════════════════════════════════════════════
    const availCheck = await validateWheelAvailability(items);
    if (!availCheck.ok) {
      return NextResponse.json({
        ok: false,
        error: "items_unavailable",
        detail: "Some items in your cart are no longer available",
        unavailable: availCheck.unavailable,
      }, { status: 409 }); // 409 Conflict
    }

    const vehicle = body.vehicle && typeof body.vehicle === "object" ? body.vehicle : undefined;

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
          // Supplier source for internal tracking (shown in admin email)
          source: i.source,
        };

        return { kind, name, sku, unitPriceUsd, qty, taxable, meta };
      })
      .filter((l) => l.qty > 0);

    if (linesAll.length === 0) {
      return NextResponse.json({ ok: false, error: "empty_cart" }, { status: 400 });
    }

    // Calculate total (only billable items)
    const billableLines = linesAll.filter((l) => l.unitPriceUsd > 0);
    if (billableLines.length === 0) {
      return NextResponse.json(
        { ok: false, error: "no_billable_items" },
        { status: 400 }
      );
    }

    const totalAmount = billableLines.reduce((sum, l) => sum + l.unitPriceUsd * l.qty, 0);

    const db = getPool();
    const paypal = await getPayPalClient(db);
    if (!paypal) {
      return NextResponse.json({ ok: false, error: "paypal_not_configured" }, { status: 400 });
    }

    // Create quote first
    const { id: quoteId } = await createQuote(db, {
      customer: { firstName, lastName, email: email || undefined, phone: phone || undefined },
      vehicle,
      lines: linesAll,
    });

    // Create PayPal order
    const vehicleDesc = vehicle
      ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
      : undefined;
    const description = vehicleDesc
      ? `Tires & Wheels for ${vehicleDesc}`
      : "Tires & Wheels Order";

    const origin = new URL(req.url).origin;
    const returnUrl = `${origin}/checkout/paypal-return`;
    const cancelUrl = `${origin}/checkout?canceled=1`;

    const order = await paypal.createOrder(totalAmount, "USD", quoteId, description, returnUrl, cancelUrl);

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      approvalUrl: order.approvalUrl,
      quoteId,
    });
  } catch (e: any) {
    console.error("[paypal/create-order] Error:", e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
