import { NextResponse } from "next/server";
import { getPool, getQuote } from "@/lib/quotes";
import { getPayPalClient } from "@/lib/payments/paypalClient";
import { createOrder, getOrderByPayPalOrder, getOrderByQuote } from "@/lib/orders";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { markOrderEmailSent } from "@/lib/orders";
import { markCartEventsPurchased } from "@/lib/cart/cartAddEventService";
import { markCartRecovered } from "@/lib/cart/abandonedCartService";
import { processSupplierOrders } from "@/lib/suppliers/supplierOrderService";
import { markSavedQuoteConverted } from "@/lib/savedQuotes/checkoutIntegration";

export const runtime = "nodejs";

/**
 * PayPal Order Capture
 * 
 * Called after user approves payment on PayPal.
 * Captures the payment, creates a WTD order, sends confirmation email.
 * 
 * This is the PayPal equivalent of the Stripe webhook - creates the order
 * and handles all post-payment processing.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const paypalOrderId = String(body.orderId || "").trim();
    const cartId = body.cartId ? String(body.cartId).trim() : undefined;
    const savedQuoteId = body.savedQuoteId ? String(body.savedQuoteId).trim() : undefined;

    if (!paypalOrderId) {
      return NextResponse.json({ ok: false, error: "orderId_required" }, { status: 400 });
    }

    const db = getPool();
    const paypal = await getPayPalClient(db);
    if (!paypal) {
      return NextResponse.json({ ok: false, error: "paypal_not_configured" }, { status: 400 });
    }

    // Capture the PayPal order
    const captureResult = await paypal.captureOrder(paypalOrderId);

    if (captureResult.status !== "COMPLETED") {
      return NextResponse.json({
        ok: false,
        error: "capture_not_completed",
        status: captureResult.status,
      }, { status: 400 });
    }

    console.log(`[paypal/capture-order] PayPal capture completed: ${paypalOrderId}`);

    // Get quoteId from PayPal order metadata (stored in custom_id or reference_id)
    // Note: PayPal returns the capture details, we need to get the quoteId from body or metadata
    const quoteId = body.quoteId;
    
    if (!quoteId) {
      console.error("[paypal/capture-order] No quoteId provided");
      return NextResponse.json({ ok: false, error: "quote_id_required" }, { status: 400 });
    }

    // Check if order already exists (idempotency)
    const existingByPayPal = await getOrderByPayPalOrder(db, paypalOrderId);
    if (existingByPayPal) {
      console.log(`[paypal/capture-order] Order already exists: ${existingByPayPal.id}`);
      return NextResponse.json({ 
        ok: true, 
        orderId: existingByPayPal.id,
        wtdOrderId: existingByPayPal.id,
        paypalOrderId,
        status: captureResult.status,
      });
    }

    // Also check by quote (in case of race condition)
    const existingByQuote = await getOrderByQuote(db, quoteId);
    if (existingByQuote) {
      console.log(`[paypal/capture-order] Order already exists for quote: ${existingByQuote.id}`);
      return NextResponse.json({ 
        ok: true, 
        orderId: existingByQuote.id,
        wtdOrderId: existingByQuote.id,
        paypalOrderId,
        status: captureResult.status,
      });
    }

    // Get quote data
    const quote = await getQuote(db, quoteId);
    if (!quote) {
      console.error(`[paypal/capture-order] Quote not found: ${quoteId}`);
      return NextResponse.json({ ok: false, error: "quote_not_found" }, { status: 400 });
    }

    // Calculate amount in cents from quote
    const amountPaidCents = Math.round(
      quote.snapshot.lines.reduce((sum, l) => sum + (l.unitPriceUsd * l.qty), 0) * 100
    );

    // Create WTD order
    const { id: wtdOrderId } = await createOrder(db, {
      quoteId,
      paypalOrderId,
      amountPaidCents,
      customerEmail: quote.snapshot.customer.email,
      customerPhone: quote.snapshot.customer.phone,
      snapshot: quote.snapshot,
    });

    console.log(`[paypal/capture-order] Created WTD order: ${wtdOrderId}`);

    // ═══════════════════════════════════════════════════════════════════════════
    // SAVED QUOTE CONVERSION TRACKING
    // Mark the originating saved quote as converted (if checkout was from resume)
    // IMPORTANT: This is secondary bookkeeping - never fails the response
    // ═══════════════════════════════════════════════════════════════════════════
    if (savedQuoteId) {
      try {
        const conversionResult = await markSavedQuoteConverted(savedQuoteId, wtdOrderId);
        if (conversionResult.success) {
          console.log(`[paypal/capture-order] ✓ Saved quote ${savedQuoteId} marked converted to ${wtdOrderId}`);
        } else if (conversionResult.conflictingOrder) {
          console.error(`[paypal/capture-order] CONFLICT: Saved quote ${savedQuoteId} already converted to ${conversionResult.conflictingOrder}`);
        } else {
          console.warn(`[paypal/capture-order] Saved quote conversion failed: ${conversionResult.error}`);
        }
      } catch (conversionErr) {
        // NEVER fail the response due to conversion tracking errors
        console.error(`[paypal/capture-order] Saved quote conversion error (non-fatal):`, conversionErr);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SUPPLIER AUTO-ORDERING
    // Process orders with suppliers (US AutoForce, etc.) for drop-ship items
    // ═══════════════════════════════════════════════════════════════════════════
    if (quote.snapshot.shippingAddress && !quote.snapshot.localMode) {
      try {
        const shipTo = {
          name: `${quote.snapshot.customer.firstName} ${quote.snapshot.customer.lastName}`.trim(),
          address1: quote.snapshot.shippingAddress.address1,
          address2: quote.snapshot.shippingAddress.address2,
          city: quote.snapshot.shippingAddress.city,
          state: quote.snapshot.shippingAddress.state,
          zip: quote.snapshot.shippingAddress.zip,
          phone: quote.snapshot.customer.phone,
        };
        
        const supplierResults = await processSupplierOrders(db, wtdOrderId, quote.snapshot, shipTo);
        console.log(`[paypal/capture-order] Supplier orders processed:`, supplierResults.map(r => ({
          supplier: r.supplier,
          success: r.success,
          orderNumber: r.supplierOrderNumber,
        })));
      } catch (supplierErr: any) {
        // Don't fail the response - log and continue
        console.error(`[paypal/capture-order] Supplier order error (non-fatal):`, supplierErr.message);
      }
    }

    // Mark cart add events as purchased
    if (cartId) {
      try {
        const markedCount = await markCartEventsPurchased(cartId, wtdOrderId);
        if (markedCount > 0) {
          console.log(`[paypal/capture-order] Marked ${markedCount} cart add events as purchased`);
        }
      } catch (err: any) {
        console.warn(`[paypal/capture-order] Failed to mark cart events purchased:`, err.message);
      }

      // Mark abandoned cart as recovered
      try {
        await markCartRecovered(cartId, wtdOrderId);
        console.log(`[paypal/capture-order] Marked abandoned cart ${cartId} recovered`);
      } catch (err: any) {
        console.warn(`[paypal/capture-order] Failed to mark abandoned cart recovered:`, err.message);
      }
    }

    // Send confirmation email
    const emailTo = quote.snapshot.customer.email;
    if (emailTo) {
      try {
        await sendOrderConfirmationEmail(wtdOrderId, emailTo, quote.snapshot);
        await markOrderEmailSent(db, wtdOrderId);
        console.log(`[paypal/capture-order] Confirmation email sent to ${emailTo}`);
      } catch (emailErr: any) {
        console.error(`[paypal/capture-order] Failed to send email:`, emailErr.message);
      }
    }

    return NextResponse.json({
      ok: true,
      orderId: wtdOrderId,
      wtdOrderId,
      paypalOrderId,
      status: captureResult.status,
      payer: captureResult.payer,
    });
  } catch (e: any) {
    console.error("[paypal/capture-order] Error:", e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
