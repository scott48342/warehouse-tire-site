import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getPool, getQuote } from "@/lib/quotes";
import { getStripeClient } from "@/lib/payments/stripeClient";
import { createOrder, getOrderByStripeSession, markOrderEmailSent } from "@/lib/orders";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { markCartEventsPurchased } from "@/lib/cart/cartAddEventService";

export const runtime = "nodejs";

/**
 * Stripe webhook handler
 * 
 * Handles checkout.session.completed event to:
 * 1. Create order record
 * 2. Send confirmation email
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

  // Handle checkout.session.completed
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
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

    // Get quote data
    const quote = await getQuote(db, quoteId);
    if (!quote) {
      console.error(`[stripe/webhook] Quote not found: ${quoteId}`);
      return NextResponse.json({ error: "quote_not_found" }, { status: 400 });
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

    // Mark cart add events as purchased (for product popularity analytics)
    if (cartId) {
      try {
        const markedCount = await markCartEventsPurchased(cartId, orderId);
        if (markedCount > 0) {
          console.log(`[stripe/webhook] Marked ${markedCount} cart add events as purchased`);
        }
      } catch (err: any) {
        // Don't fail the webhook for analytics tracking issues
        console.warn(`[stripe/webhook] Failed to mark cart events purchased:`, err.message);
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
        // Don't fail the webhook - order is still created
      }
    }

    return NextResponse.json({ received: true, orderId });
  }

  // Handle other events as needed
  return NextResponse.json({ received: true });
}
