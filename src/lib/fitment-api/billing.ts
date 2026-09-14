/**
 * Fitment API — Self-serve Stripe Billing
 *
 * Flow: visitor picks a plan on /fitment-api → POST /api/fitment-api/checkout
 * creates a Stripe Checkout Session (mode=subscription, price_data inline so no
 * dashboard product setup is needed) → on `checkout.session.completed` we create
 * the API key, email it, and alert the owner. No manual approval.
 *
 * Subscription lifecycle events keep `api_keys.subscription_status` in sync and
 * deactivate the key on cancellation.
 *
 * Every Stripe object we act on is tagged `metadata.product = "fitment_api"` so
 * the shared webhook can route it without disturbing store-order handling.
 *
 * @created 2026-09-14
 */

import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/lib/fitment-db/db";
import { apiKeys, type ApiKey } from "./schema";
import { createApiKey, PLAN_LIMITS } from "./apiKeys";
import { sendApprovalEmail } from "./emails";
import { sendOwnerNewSubscriberAlert } from "./ownerAlert";

// ============================================================================
// Plans
// ============================================================================

export const FITMENT_API_PRODUCT_TAG = "fitment_api";

export type BillablePlan = "starter" | "growth" | "pro";
export const BILLABLE_PLANS: readonly BillablePlan[] = ["starter", "growth", "pro"] as const;

/** Monthly price in cents. Must match the landing page pricing cards. */
export const PLAN_PRICES: Record<BillablePlan, number> = {
  starter: 9900,
  growth: 24900,
  pro: 49900,
};

export const PLAN_NAMES: Record<BillablePlan, string> = {
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
};

export function isBillablePlan(value: unknown): value is BillablePlan {
  return typeof value === "string" && (BILLABLE_PLANS as readonly string[]).includes(value);
}

export function formatPlanPrice(plan: BillablePlan): string {
  return `$${(PLAN_PRICES[plan] / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}/mo`;
}

/** "Growth ($249/mo · 50,000 calls)" — for owner alerts / logs */
export function describePlan(plan: BillablePlan): string {
  const calls = PLAN_LIMITS[plan]?.monthly;
  return `${PLAN_NAMES[plan]} (${formatPlanPrice(plan)}${calls ? ` · ${calls.toLocaleString("en-US")} calls` : ""})`;
}

// ============================================================================
// Subscription status mapping
// ============================================================================

export type SubscriptionStatus = "active" | "past_due" | "canceled";

/** Collapse Stripe's subscription statuses into the three we track. */
export function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status | string): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
    case "paused":
    default:
      return "canceled";
  }
}

const SUBSCRIPTION_SUSPEND_REASON = "subscription_canceled";

// ============================================================================
// DB helpers
// ============================================================================

export async function getApiKeyBySubscriptionId(subscriptionId: string): Promise<ApiKey | null> {
  const [key] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.stripeSubscriptionId, subscriptionId))
    .limit(1);
  return key || null;
}

function asId(value: string | { id: string } | null | undefined): string | undefined {
  if (!value) return undefined;
  return typeof value === "string" ? value : value.id;
}

// ============================================================================
// Webhook: checkout.session.completed
// ============================================================================

export type CheckoutCompletedResult =
  | { status: "created"; apiKeyId: string; email: string; plan: BillablePlan }
  | { status: "duplicate"; apiKeyId: string }
  | { status: "skipped"; reason: string };

/**
 * Create + deliver an API key for a completed Fitment API checkout.
 * Idempotent on `session.subscription` (unique index on stripe_subscription_id).
 * Throws only if key creation itself fails, so Stripe retries the webhook.
 */
export async function handleFitmentApiCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<CheckoutCompletedResult> {
  const plan = session.metadata?.plan;
  if (!isBillablePlan(plan)) {
    console.error(`[fitment-api/billing] checkout ${session.id}: unknown plan "${plan}"`);
    return { status: "skipped", reason: "unknown_plan" };
  }

  const subscriptionId = asId(session.subscription);
  const customerId = asId(session.customer);
  if (!subscriptionId) {
    // mode=subscription sessions always carry a subscription id once completed
    console.error(`[fitment-api/billing] checkout ${session.id}: no subscription id on session`);
    return { status: "skipped", reason: "no_subscription" };
  }

  // Idempotency: Stripe may deliver the same event more than once
  const existing = await getApiKeyBySubscriptionId(subscriptionId);
  if (existing) {
    console.log(`[fitment-api/billing] key ${existing.id} already exists for ${subscriptionId} — skipping`);
    return { status: "duplicate", apiKeyId: existing.id };
  }

  const email = (session.customer_details?.email || session.customer_email || "").trim().toLowerCase();
  if (!email) {
    console.error(`[fitment-api/billing] checkout ${session.id}: no customer email`);
    return { status: "skipped", reason: "no_email" };
  }
  const displayName = (session.customer_details?.name || "").trim() || email;

  // Create the key (this is the one step that must succeed)
  const { key, plainKey } = await createApiKey({
    name: displayName,
    email,
    company: displayName,
    plan,
  });

  // Attach Stripe references
  let stored: ApiKey = key;
  try {
    const [updated] = await db
      .update(apiKeys)
      .set({
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        subscriptionStatus: "active",
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, key.id))
      .returning();
    if (updated) stored = updated;
  } catch (err: any) {
    // Unique-index race: another delivery of this event won. Deactivate our
    // duplicate so the customer isn't left with two live keys.
    if (String(err?.code) === "23505") {
      console.warn(`[fitment-api/billing] race on ${subscriptionId}; retiring duplicate key ${key.id}`);
      await db
        .update(apiKeys)
        .set({ active: false, suspendedAt: new Date(), suspendReason: "duplicate_webhook_delivery", updatedAt: new Date() })
        .where(eq(apiKeys.id, key.id));
      const winner = await getApiKeyBySubscriptionId(subscriptionId);
      return { status: "duplicate", apiKeyId: winner?.id || key.id };
    }
    throw err;
  }

  console.log(`[fitment-api/billing] ✓ Created key ${stored.id} (${stored.keyPrefix}…) for ${email} on ${plan}; sub=${subscriptionId}`);

  // Deliver the key. The email is the ONLY place the plain key is ever shown.
  try {
    const emailResult = await sendApprovalEmail({
      email,
      name: displayName,
      company: displayName,
      apiKey: plainKey,
      plan,
      mode: "subscribed",
    });
    if (!emailResult.success) {
      console.error(`[fitment-api/billing] key email to ${email} failed: ${emailResult.error}`);
    }
  } catch (err) {
    console.error(`[fitment-api/billing] key email to ${email} threw:`, err);
  }

  // Tell Scott. Never fails the webhook.
  try {
    const alert = await sendOwnerNewSubscriberAlert({
      name: displayName,
      email,
      company: displayName,
      plan,
      planLabel: describePlan(plan),
      apiKeyId: stored.id,
      keyPrefix: stored.keyPrefix,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
    });
    console.log(`[fitment-api/billing] owner alert: email=${alert.email} sms=${alert.sms} via=${alert.via}`);
  } catch (err) {
    console.error(`[fitment-api/billing] owner alert threw:`, err);
  }

  return { status: "created", apiKeyId: stored.id, email, plan };
}

// ============================================================================
// Webhook: customer.subscription.updated
// ============================================================================

export async function handleFitmentApiSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<{ updated: boolean; status?: SubscriptionStatus }> {
  const key = await getApiKeyBySubscriptionId(subscription.id);
  if (!key) {
    // Could be a subscription whose checkout webhook hasn't landed yet, or not ours.
    console.log(`[fitment-api/billing] subscription.updated ${subscription.id}: no matching key`);
    return { updated: false };
  }

  const status = mapStripeSubscriptionStatus(subscription.status);
  const patch: Partial<typeof apiKeys.$inferInsert> = {
    subscriptionStatus: status,
    updatedAt: new Date(),
  };

  if (status === "canceled") {
    patch.active = false;
    patch.suspendedAt = key.suspendedAt ?? new Date();
    patch.suspendReason = key.suspendReason ?? SUBSCRIPTION_SUSPEND_REASON;
  } else if (status === "active" && !key.active && key.suspendReason === SUBSCRIPTION_SUSPEND_REASON) {
    // Subscription came back (e.g. resumed) — only un-suspend keys WE suspended
    // for billing reasons; leave manual suspensions alone.
    patch.active = true;
    patch.suspendedAt = null;
    patch.suspendReason = null;
  }

  await db.update(apiKeys).set(patch).where(eq(apiKeys.id, key.id));
  console.log(`[fitment-api/billing] key ${key.id} subscription_status → ${status} (stripe: ${subscription.status})`);
  return { updated: true, status };
}

// ============================================================================
// Webhook: customer.subscription.deleted
// ============================================================================

export async function handleFitmentApiSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<{ updated: boolean }> {
  const key = await getApiKeyBySubscriptionId(subscription.id);
  if (!key) {
    console.log(`[fitment-api/billing] subscription.deleted ${subscription.id}: no matching key`);
    return { updated: false };
  }

  await db
    .update(apiKeys)
    .set({
      active: false,
      subscriptionStatus: "canceled",
      suspendedAt: key.suspendedAt ?? new Date(),
      suspendReason: key.suspendReason ?? SUBSCRIPTION_SUSPEND_REASON,
      updatedAt: new Date(),
    })
    .where(eq(apiKeys.id, key.id));

  console.log(`[fitment-api/billing] key ${key.id} deactivated — subscription ${subscription.id} canceled`);
  return { updated: true };
}

// ============================================================================
// Webhook: invoice.payment_failed
// ============================================================================

export async function handleFitmentApiInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<{ updated: boolean }> {
  const subscriptionId = asId(invoice.subscription);
  if (!subscriptionId) return { updated: false };

  const key = await getApiKeyBySubscriptionId(subscriptionId);
  if (!key) {
    console.log(`[fitment-api/billing] invoice.payment_failed for ${subscriptionId}: no matching key`);
    return { updated: false };
  }

  // Mark past_due but KEEP the key active — Stripe Smart Retries will keep
  // trying the card, and customer.subscription.deleted fires if it ultimately
  // fails, which is what actually shuts the key off.
  // TODO: grace period — auto-deactivate keys that stay past_due > N days
  //       (cron over api_keys where subscription_status='past_due').
  await db
    .update(apiKeys)
    .set({ subscriptionStatus: "past_due", updatedAt: new Date() })
    .where(eq(apiKeys.id, key.id));

  console.warn(`[fitment-api/billing] key ${key.id} → past_due (invoice ${invoice.id}, ${key.email})`);
  return { updated: true };
}
