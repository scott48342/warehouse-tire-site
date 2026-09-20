import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getPool, getQuote } from "@/lib/quotes";
import { getStripeClient } from "@/lib/payments/stripeClient";
import { createOrder, getOrderByStripeSession, getOrderByPaymentIntent, getOrderByQuote, markOrderEmailSent } from "@/lib/orders";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { markCartEventsPurchased } from "@/lib/cart/cartAddEventService";
import { markCartRecovered } from "@/lib/cart/abandonedCartService";
import { logCheckoutDiagnosticServer } from "@/lib/checkout/diagnosticsServer";
import { paidAmountMismatch } from "@/lib/checkout/paidAmountGuard";
import { processSupplierOrders } from "@/lib/suppliers/supplierOrderService";
import { markSavedQuoteConverted } from "@/lib/savedQuotes/checkoutIntegration";
import {
  FITMENT_API_PRODUCT_TAG,
  handleFitmentApiCheckoutCompleted,
  handleFitmentApiSubscriptionUpdated,
  handleFitmentApiSubscriptionDeleted,
  handleFitmentApiInvoicePaymentFailed,
} from "@/lib/fitment-api/billing";

export const runtime = "nodejs";

/**
 * Stripe webhook handler
 * 
 * Handles:
 * - checkout.session.completed (legacy hosted checkout flow)
 * - payment_intent.succeeded (embedded Payment Element flow)
 * 
 * Both create an order and send confirmation email.
 * 
 * Fitment API subscriptions (metadata.product = "fitment_api"):
 * - checkout.session.completed → create API key + email it
 * - customer.subscription.updated / .deleted → sync key status
 * - invoice.payment_failed → mark past_due
 */
export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature");

  if (!sig) {
    console.error("[stripe/webhook] Missing stripe-signature header");
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const db = getPool();
  const stripeConn = await getStripeClient(db);
  
  if (!stripeConn) {
    console.error("[stripe/webhook] Stripe not configured");
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 500 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe/webhook] Missing STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 500 });
  }

  let event;
  try {
    event = stripeConn.stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error("[stripe/webhook] Signature verification failed:", err.message);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  console.log(`[stripe/webhook] Received event: ${event.type}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYMENT_INTENT.SUCCEEDED - Embedded Payment Element flow
  // ═══════════════════════════════════════════════════════════════════════════
  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as any;
    const paymentIntentId = paymentIntent.id;
    const quoteId = paymentIntent.metadata?.quoteId;
    const cartId = paymentIntent.metadata?.cartId;
    const amountTotal = paymentIntent.amount || 0;
    const customerEmail = paymentIntent.receipt_email || paymentIntent.metadata?.customerEmail;

    console.log(`[stripe/webhook] payment_intent.succeeded: pi=${paymentIntentId}, quote=${quoteId}, cart=${cartId || "none"}, amount=${amountTotal}`);

    if (!quoteId) {
      console.error("[stripe/webhook] No quoteId in PaymentIntent metadata");
      return NextResponse.json({ error: "no_quote_id" }, { status: 400 });
    }

    // Check if order already exists (idempotency)
    const existing = await getOrderByPaymentIntent(db, paymentIntentId);
    if (existing) {
      console.log(`[stripe/webhook] Order already exists for PaymentIntent: ${existing.id}`);
      return NextResponse.json({ received: true, orderId: existing.id });
    }

    // Also check by quote (in case of race condition)
    const existingByQuote = await getOrderByQuote(db, quoteId);
    if (existingByQuote) {
      console.log(`[stripe/webhook] Order already exists for quote: ${existingByQuote.id}`);
      return NextResponse.json({ received: true, orderId: existingByQuote.id });
    }

    // Get quote data
    const quote = await getQuote(db, quoteId);
    if (!quote) {
      console.error(`[stripe/webhook] Quote not found: ${quoteId}`);
      return NextResponse.json({ error: "quote_not_found" }, { status: 400 });
    }

    // Fulfil only the charge this quote was created for (paidAmountGuard.ts). The amount is
    // server-set on both flows, so a mismatch is a stale/duplicated intent or a bug: record it,
    // stop, and leave the payment for manual reconciliation. Never ship on it.
    const paidMismatch = paidAmountMismatch(quote.snapshot, amountTotal);
    if (paidMismatch) {
      console.error(`[stripe/webhook] PAID AMOUNT MISMATCH quote=${quoteId} expected=${paidMismatch.expectedCents} paid=${paidMismatch.paidCents} event=${event.type}`);
      await logCheckoutDiagnosticServer({
        eventType: "payment_provider_error",
        cartId,
        checkoutStep: "post_payment",
        status: "error",
        endpoint: `stripe_webhook:${event.type}`,
        errorCode: "paid_amount_mismatch",
        detail: { quoteId, ...paidMismatch },
      });
      return NextResponse.json({ error: "paid_amount_mismatch" }, { status: 400 });
    }

    // Create order (note: no stripeSessionId for PaymentIntent flow)
    let orderId: string;
    try {
      const created = await createOrder(db, {
        quoteId,
        stripePaymentIntentId: paymentIntentId,
        amountPaidCents: amountTotal,
        customerEmail: customerEmail || quote.snapshot.customer.email,
        customerPhone: quote.snapshot.customer.phone,
        snapshot: quote.snapshot,
      });
      orderId = created.id;
    } catch (orderErr: any) {
      // CRITICAL: payment succeeded but order creation failed.
      // Log a diagnostic, then 500 so Stripe retries the webhook.
      console.error(`[stripe/webhook] ORDER CREATE FAILED after successful payment:`, orderErr);
      await logCheckoutDiagnosticServer({
        eventType: "order_create_failed",
        cartId,
        checkoutStep: "post_payment",
        status: "error",
        endpoint: "stripe_webhook:payment_intent.succeeded",
        errorCode: String(orderErr?.message || "order_create_exception"),
        detail: { quoteId },
      });
      return NextResponse.json({ error: "order_create_failed" }, { status: 500 });
    }

    console.log(`[stripe/webhook] Created order from PaymentIntent: ${orderId}`);

    // ═══════════════════════════════════════════════════════════════════════════
    // SAVED QUOTE CONVERSION TRACKING
    // Mark the originating saved quote as converted (if checkout was from resume)
    // IMPORTANT: This is secondary bookkeeping - never fails the webhook
    // ═══════════════════════════════════════════════════════════════════════════
    const savedQuoteId = paymentIntent.metadata?.savedQuoteId;
    if (savedQuoteId) {
      try {
        const conversionResult = await markSavedQuoteConverted(savedQuoteId, orderId);
        if (conversionResult.success) {
          console.log(`[stripe/webhook] ✓ Saved quote ${savedQuoteId} marked converted to ${orderId}`);
        } else if (conversionResult.conflictingOrder) {
          console.error(`[stripe/webhook] CONFLICT: Saved quote ${savedQuoteId} already converted to ${conversionResult.conflictingOrder}`);
        } else {
          console.warn(`[stripe/webhook] Saved quote conversion failed: ${conversionResult.error}`);
        }
      } catch (conversionErr) {
        // NEVER fail the webhook due to conversion tracking errors
        console.error(`[stripe/webhook] Saved quote conversion error (non-fatal):`, conversionErr);
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
        
        const usafBranch = paymentIntent.metadata?.usafBranch || undefined;
        const supplierResults = await processSupplierOrders(db, orderId, quote.snapshot, shipTo, { usafBranch });
        console.log(`[stripe/webhook] Supplier orders processed:`, supplierResults.map(r => ({
          supplier: r.supplier,
          success: r.success,
          orderNumber: r.supplierOrderNumber,
        })));
      } catch (supplierErr: any) {
        // Don't fail the webhook - log and continue
        console.error(`[stripe/webhook] Supplier order error (non-fatal):`, supplierErr.message);
      }
    }

    // Mark cart add events as purchased
    if (cartId) {
      try {
        const markedCount = await markCartEventsPurchased(cartId, orderId);
        if (markedCount > 0) {
          console.log(`[stripe/webhook] Marked ${markedCount} cart add events as purchased`);
        }
      } catch (err: any) {
        console.warn(`[stripe/webhook] Failed to mark cart events purchased:`, err.message);
      }

      // Mark abandoned cart as recovered (server-side; stops recovery emails
      // even if the client-side success-page call never fires)
      try {
        await markCartRecovered(cartId, orderId);
        console.log(`[stripe/webhook] Marked abandoned cart ${cartId} recovered`);
      } catch (err: any) {
        console.warn(`[stripe/webhook] Failed to mark abandoned cart recovered:`, err.message);
      }
    }

    // Send confirmation email
    const emailTo = customerEmail || quote.snapshot.customer.email;
    if (emailTo) {
      try {
        await sendOrderConfirmationEmail(orderId, emailTo, quote.snapshot);
        await markOrderEmailSent(db, orderId);
        console.log(`[stripe/webhook] Confirmation email sent to ${emailTo}`);
      } catch (emailErr: any) {
        console.error(`[stripe/webhook] Failed to send email:`, emailErr.message);
      }
    }

    return NextResponse.json({ received: true, orderId });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECKOUT.SESSION.COMPLETED - Legacy hosted checkout flow
  // ═══════════════════════════════════════════════════════════════════════════
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;

    // ─── Fitment API subscription signup (not a store order) ───────────────
    if (session.metadata?.product === FITMENT_API_PRODUCT_TAG) {
      console.log(`[stripe/webhook] fitment_api checkout completed: session=${session.id}, plan=${session.metadata?.plan}, sub=${session.subscription}`);
      try {
        const result = await handleFitmentApiCheckoutCompleted(session);
        return NextResponse.json({ received: true, fitmentApi: result });
      } catch (err: any) {
        // Payment succeeded but key creation failed → 500 so Stripe retries
        console.error(`[stripe/webhook] FITMENT API KEY CREATE FAILED after payment:`, err);
        return NextResponse.json({ error: "fitment_api_key_create_failed" }, { status: 500 });
      }
    }

    const quoteId = session.metadata?.quoteId;
    const cartId = session.metadata?.cartId;
    const sessionId = session.id;
    const paymentIntentId = session.payment_intent;
    const amountTotal = session.amount_total || 0;
    const customerEmail = session.customer_email || session.customer_details?.email;

    console.log(`[stripe/webhook] checkout.session.completed: session=${sessionId}, quote=${quoteId}, cart=${cartId || "none"}, amount=${amountTotal}`);

    if (!quoteId) {
      console.error("[stripe/webhook] No quoteId in session metadata");
      return NextResponse.json({ error: "no_quote_id" }, { status: 400 });
    }

    // Check if order already exists (idempotency)
    const existing = await getOrderByStripeSession(db, sessionId);
    if (existing) {
      console.log(`[stripe/webhook] Order already exists: ${existing.id}`);
      return NextResponse.json({ received: true, orderId: existing.id });
    }

    // Also check by payment intent (might be created by payment_intent.succeeded first)
    if (paymentIntentId) {
      const existingByPi = await getOrderByPaymentIntent(db, paymentIntentId);
      if (existingByPi) {
        console.log(`[stripe/webhook] Order already exists for PaymentIntent: ${existingByPi.id}`);
        return NextResponse.json({ received: true, orderId: existingByPi.id });
      }
    }

    // Get quote data
    const quote = await getQuote(db, quoteId);
    if (!quote) {
      console.error(`[stripe/webhook] Quote not found: ${quoteId}`);
      return NextResponse.json({ error: "quote_not_found" }, { status: 400 });
    }

    // Fulfil only the charge this quote was created for (paidAmountGuard.ts). The amount is
    // server-set on both flows, so a mismatch is a stale/duplicated intent or a bug: record it,
    // stop, and leave the payment for manual reconciliation. Never ship on it.
    const paidMismatch = paidAmountMismatch(quote.snapshot, amountTotal);
    if (paidMismatch) {
      console.error(`[stripe/webhook] PAID AMOUNT MISMATCH quote=${quoteId} expected=${paidMismatch.expectedCents} paid=${paidMismatch.paidCents} event=${event.type}`);
      await logCheckoutDiagnosticServer({
        eventType: "payment_provider_error",
        cartId,
        checkoutStep: "post_payment",
        status: "error",
        endpoint: `stripe_webhook:${event.type}`,
        errorCode: "paid_amount_mismatch",
        detail: { quoteId, ...paidMismatch },
      });
      return NextResponse.json({ error: "paid_amount_mismatch" }, { status: 400 });
    }

    // Create order
    const { id: orderId } = await createOrder(db, {
      quoteId,
      stripeSessionId: sessionId,
      stripePaymentIntentId: paymentIntentId,
      amountPaidCents: amountTotal,
      customerEmail: customerEmail || quote.snapshot.customer.email,
      customerPhone: quote.snapshot.customer.phone,
      snapshot: quote.snapshot,
    });

    console.log(`[stripe/webhook] Created order: ${orderId}`);

    // ═══════════════════════════════════════════════════════════════════════════
    // SAVED QUOTE CONVERSION TRACKING
    // Mark the originating saved quote as converted (if checkout was from resume)
    // IMPORTANT: This is secondary bookkeeping - never fails the webhook
    // ═══════════════════════════════════════════════════════════════════════════
    const savedQuoteId = session.metadata?.savedQuoteId;
    if (savedQuoteId) {
      try {
        const conversionResult = await markSavedQuoteConverted(savedQuoteId, orderId);
        if (conversionResult.success) {
          console.log(`[stripe/webhook] ✓ Saved quote ${savedQuoteId} marked converted to ${orderId}`);
        } else if (conversionResult.conflictingOrder) {
          console.error(`[stripe/webhook] CONFLICT: Saved quote ${savedQuoteId} already converted to ${conversionResult.conflictingOrder}`);
        } else {
          console.warn(`[stripe/webhook] Saved quote conversion failed: ${conversionResult.error}`);
        }
      } catch (conversionErr) {
        // NEVER fail the webhook due to conversion tracking errors
        console.error(`[stripe/webhook] Saved quote conversion error (non-fatal):`, conversionErr);
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
        
        const usafBranch = session.metadata?.usafBranch || undefined;
        const supplierResults = await processSupplierOrders(db, orderId, quote.snapshot, shipTo, { usafBranch });
        console.log(`[stripe/webhook] Supplier orders processed:`, supplierResults.map(r => ({
          supplier: r.supplier,
          success: r.success,
          orderNumber: r.supplierOrderNumber,
        })));
      } catch (supplierErr: any) {
        // Don't fail the webhook - log and continue
        console.error(`[stripe/webhook] Supplier order error (non-fatal):`, supplierErr.message);
      }
    }

    // Mark cart add events as purchased
    if (cartId) {
      try {
        const markedCount = await markCartEventsPurchased(cartId, orderId);
        if (markedCount > 0) {
          console.log(`[stripe/webhook] Marked ${markedCount} cart add events as purchased`);
        }
      } catch (err: any) {
        console.warn(`[stripe/webhook] Failed to mark cart events purchased:`, err.message);
      }

      // Mark abandoned cart as recovered (server-side; stops recovery emails
      // even if the client-side success-page call never fires)
      try {
        await markCartRecovered(cartId, orderId);
        console.log(`[stripe/webhook] Marked abandoned cart ${cartId} recovered`);
      } catch (err: any) {
        console.warn(`[stripe/webhook] Failed to mark abandoned cart recovered:`, err.message);
      }
    }

    // Send confirmation email
    const emailTo = customerEmail || quote.snapshot.customer.email;
    if (emailTo) {
      try {
        await sendOrderConfirmationEmail(orderId, emailTo, quote.snapshot);
        await markOrderEmailSent(db, orderId);
        console.log(`[stripe/webhook] Confirmation email sent to ${emailTo}`);
      } catch (emailErr: any) {
        console.error(`[stripe/webhook] Failed to send email:`, emailErr.message);
      }
    }

    return NextResponse.json({ received: true, orderId });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FITMENT API SUBSCRIPTION LIFECYCLE
  // Only acts on subscriptions we issued a key for (lookup by subscription id),
  // so unrelated subscriptions / invoices are ignored safely.
  // ═══════════════════════════════════════════════════════════════════════════
  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as any;
    if (subscription.metadata?.product === FITMENT_API_PRODUCT_TAG) {
      try {
        const result = await handleFitmentApiSubscriptionUpdated(subscription);
        return NextResponse.json({ received: true, fitmentApi: result });
      } catch (err: any) {
        console.error(`[stripe/webhook] fitment_api subscription.updated failed:`, err);
        return NextResponse.json({ error: "fitment_api_sync_failed" }, { status: 500 });
      }
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as any;
    if (subscription.metadata?.product === FITMENT_API_PRODUCT_TAG) {
      try {
        const result = await handleFitmentApiSubscriptionDeleted(subscription);
        return NextResponse.json({ received: true, fitmentApi: result });
      } catch (err: any) {
        console.error(`[stripe/webhook] fitment_api subscription.deleted failed:`, err);
        return NextResponse.json({ error: "fitment_api_sync_failed" }, { status: 500 });
      }
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as any;
    // Invoices don't inherit our metadata; billing.ts matches by subscription id
    // and no-ops when the subscription isn't a Fitment API key.
    if (invoice.subscription) {
      try {
        const result = await handleFitmentApiInvoicePaymentFailed(invoice);
        return NextResponse.json({ received: true, fitmentApi: result });
      } catch (err: any) {
        console.error(`[stripe/webhook] fitment_api invoice.payment_failed handling failed:`, err);
        // Non-critical bookkeeping — ack so Stripe doesn't retry forever
        return NextResponse.json({ received: true, fitmentApi: { updated: false, error: true } });
      }
    }
    return NextResponse.json({ received: true });
  }

  // Handle other events as needed
  return NextResponse.json({ received: true });
}
