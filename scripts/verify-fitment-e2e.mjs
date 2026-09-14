// Verify the self-serve E2E test: newest Stripe-created api_key + live call with it is NOT possible (hash only),
// so we check DB row + Stripe subscription state.
import pg from 'pg';
import Stripe from 'stripe';

const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const { rows } = await p.query(`
  SELECT id, key_prefix, name, email, company, plan, monthly_limit, active,
         stripe_customer_id, stripe_subscription_id, subscription_status, created_at
  FROM api_keys WHERE stripe_subscription_id IS NOT NULL ORDER BY created_at DESC LIMIT 3`);
console.log('Stripe-created keys:', rows.length);
for (const r of rows) {
  console.log(`  ${r.created_at.toISOString().slice(11, 19)}Z  ${r.key_prefix}…  ${r.email}  plan=${r.plan} limit=${r.monthly_limit} active=${r.active} status=${r.subscription_status}`);
  console.log(`      customer=${r.stripe_customer_id} sub=${r.stripe_subscription_id}`);
  const sub = await stripe.subscriptions.retrieve(r.stripe_subscription_id);
  const amt = sub.items.data[0]?.price?.unit_amount ?? 0;
  console.log(`      Stripe: status=${sub.status} price=$${(amt / 100).toFixed(2)} discount=${sub.discounts?.length || sub.discount ? 'yes (100% promo)' : 'none'} next_invoice=${new Date(sub.current_period_end * 1000).toISOString().slice(0, 10)}`);
}
const promo = (await stripe.promotionCodes.list({ code: 'FITMENTTEST', limit: 1 })).data[0];
console.log(`\nPromo FITMENTTEST: ${promo.times_redeemed}/${promo.max_redemptions} redeemed`);
await p.end();
