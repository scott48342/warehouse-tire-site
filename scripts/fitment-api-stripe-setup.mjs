/**
 * One-time Stripe setup for Fitment API self-serve billing.
 *   node --env-file=.env.local scripts/fitment-api-stripe-setup.mjs
 *
 * 1. Finds the webhook endpoint pointing at our /api/stripe/webhook and adds the
 *    subscription lifecycle events (idempotent — merges with existing list).
 * 2. Creates a 100%-off, single-use promo code FITMENTTEST for the end-to-end test.
 * 3. Prints a checkout URL for a Starter plan so the flow can be exercised.
 */
import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) { console.error('STRIPE_SECRET_KEY missing'); process.exit(1); }
const stripe = new Stripe(key);
const mode = key.startsWith('sk_live') ? 'LIVE' : 'TEST';
console.log(`Stripe mode: ${mode}\n`);

// ---------- 1. Webhook events ----------
const NEEDED = [
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
];
const eps = await stripe.webhookEndpoints.list({ limit: 20 });
const ours = eps.data.filter((e) => /warehousetire/i.test(e.url) && /api\/stripe\/webhook/.test(e.url));
if (!ours.length) {
  console.log('No webhook endpoint found for warehousetire*/api/stripe/webhook. Existing endpoints:');
  for (const e of eps.data) console.log(`  ${e.id} ${e.url} [${e.status}] events=${e.enabled_events.length}`);
} else {
  for (const ep of ours) {
    const have = new Set(ep.enabled_events);
    const missing = NEEDED.filter((ev) => !have.has(ev) && !have.has('*'));
    console.log(`Endpoint ${ep.id} → ${ep.url} [${ep.status}]`);
    console.log(`  currently ${ep.enabled_events.length} events; missing: ${missing.length ? missing.join(', ') : 'none'}`);
    if (missing.length) {
      const updated = await stripe.webhookEndpoints.update(ep.id, {
        enabled_events: [...new Set([...ep.enabled_events, ...missing])],
      });
      console.log(`  ✓ updated → ${updated.enabled_events.length} events`);
    }
  }
}

// ---------- 2. 100% promo code ----------
const CODE = 'FITMENTTEST';
let promo = (await stripe.promotionCodes.list({ code: CODE, limit: 1 })).data[0];
if (promo) {
  console.log(`\nPromo ${CODE} already exists (${promo.active ? 'active' : 'inactive'}, ${promo.times_redeemed}/${promo.max_redemptions ?? '∞'} used)`);
} else {
  const coupon = await stripe.coupons.create({
    percent_off: 100,
    duration: 'forever',
    name: 'Fitment API internal test (100% off)',
    metadata: { product: 'fitment_api', purpose: 'e2e_test' },
  });
  promo = await stripe.promotionCodes.create({
    coupon: coupon.id,
    code: CODE,
    max_redemptions: 2,
    metadata: { product: 'fitment_api', purpose: 'e2e_test' },
  });
  console.log(`\n✓ Created promo ${CODE} (100% off forever, max 2 redemptions) — coupon ${coupon.id}`);
}

// ---------- 3. Test checkout URL ----------
const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://shop.warehousetiredirect.com';
try {
  const res = await fetch(`${base}/api/fitment-api/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plan: 'starter', email: 'scott@warehousetire.net' }),
  });
  const data = await res.json();
  if (data.url) {
    console.log(`\nE2E test checkout (Starter, prefill scott@warehousetire.net):\n  ${data.url}\n  → enter promo code ${CODE} at checkout → $0.00 → completes → key email + owner SMS.`);
  } else {
    console.log(`\nCheckout endpoint response (${res.status}):`, data, '\n(Vercel may still be deploying — retry in a minute.)');
  }
} catch (e) {
  console.log('\nCould not reach checkout endpoint yet:', e.message);
}
