// Cancel the E2E test subscription immediately, then verify the webhook deactivated the key.
import pg from 'pg';
import Stripe from 'stripe';

const SUB = 'sub_1UFexaC24ptuq90RGanVD52J';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

const before = await stripe.subscriptions.retrieve(SUB);
console.log(`Before: ${SUB} status=${before.status} customer=${before.customer} email=${before.metadata?.email || ''}`);
if (before.metadata?.product !== 'fitment_api') { console.error('Refusing: not a fitment_api subscription'); process.exit(1); }

const canceled = await stripe.subscriptions.cancel(SUB, { invoice_now: false, prorate: false });
console.log(`✓ Stripe: status=${canceled.status} canceled_at=${new Date(canceled.canceled_at * 1000).toISOString()}`);

// Give the webhook a few seconds, then check the key
for (let i = 1; i <= 6; i++) {
  await new Promise((r) => setTimeout(r, 3000));
  const { rows } = await p.query(`SELECT key_prefix, active, subscription_status FROM api_keys WHERE stripe_subscription_id = $1`, [SUB]);
  const k = rows[0];
  console.log(`  t+${i * 3}s  key ${k.key_prefix}… active=${k.active} status=${k.subscription_status}`);
  if (!k.active && k.subscription_status === 'canceled') { console.log('✓ Webhook deactivated the key.'); break; }
  if (i === 6) console.log('✗ Key still active after 18s — check webhook delivery in Stripe Dashboard.');
}
await p.end();
