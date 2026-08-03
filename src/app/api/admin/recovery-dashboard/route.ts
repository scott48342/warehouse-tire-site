/**
 * Admin Recovery Dashboard API
 *
 * GET /api/admin/recovery-dashboard?days=30
 *
 * Aggregated metrics for the Phase 1 cart-recovery system:
 * eligibility, consent opt-in rate, email sends/opens/clicks/failures,
 * recovered orders + revenue, and mobile vs desktop checkout conversion.
 *
 * Read-only. Excludes test data (is_test) everywhere.
 *
 * @created 2026-08-03 (Phase 1 visibility)
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_CART_VALUE_FOR_EMAIL = 50;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = Math.min(365, Math.max(1, parseInt(url.searchParams.get("days") || "30", 10) || 30));

  try {
    const [
      cartFunnel,
      emailSteps,
      engagement,
      recovery,
      optIn,
      deviceConversion,
      recentEmails,
    ] = await Promise.all([
      // ── Cart funnel: totals, emails captured, consent, eligible ─────────
      db.execute(sql`
        SELECT
          COUNT(*)::int AS total_carts,
          COUNT(*) FILTER (WHERE customer_email IS NOT NULL)::int AS carts_with_email,
          COUNT(*) FILTER (
            WHERE customer_email IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM cart_recovery_consents c
                WHERE LOWER(c.email) = LOWER(ac.customer_email)
                  AND c.consented = true AND c.revoked_at IS NULL
              )
          )::int AS carts_with_consent,
          COUNT(*) FILTER (
            WHERE status = 'abandoned'
              AND customer_email IS NOT NULL
              AND unsubscribed = false
              AND estimated_total >= ${MIN_CART_VALUE_FOR_EMAIL}
              AND EXISTS (
                SELECT 1 FROM cart_recovery_consents c
                WHERE LOWER(c.email) = LOWER(ac.customer_email)
                  AND c.consented = true AND c.revoked_at IS NULL
              )
          )::int AS eligible_carts,
          COUNT(*) FILTER (
            WHERE status = 'abandoned'
              AND customer_email IS NOT NULL
              AND unsubscribed = false
              AND estimated_total >= ${MIN_CART_VALUE_FOR_EMAIL}
              AND EXISTS (
                SELECT 1 FROM cart_recovery_consents c
                WHERE LOWER(c.email) = LOWER(ac.customer_email)
                  AND c.consented = true AND c.revoked_at IS NULL
              )
              AND COALESCE(email_sent_count, 0) < 3
          )::int AS queued_carts,
          COUNT(*) FILTER (
            WHERE status = 'abandoned'
              AND customer_email IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM cart_recovery_consents c
                WHERE LOWER(c.email) = LOWER(ac.customer_email)
                  AND c.consented = true AND c.revoked_at IS NULL
              )
          )::int AS blocked_no_consent
        FROM abandoned_carts ac
        WHERE COALESCE(is_test, false) = false
          AND created_at >= NOW() - make_interval(days => ${days})
      `),

      // ── Email sends by step + failures ───────────────────────────────────
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE first_email_sent_at  >= NOW() - make_interval(days => ${days}))::int AS first_sent,
          COUNT(*) FILTER (WHERE second_email_sent_at >= NOW() - make_interval(days => ${days}))::int AS second_sent,
          COUNT(*) FILTER (WHERE third_email_sent_at  >= NOW() - make_interval(days => ${days}))::int AS third_sent,
          COUNT(*) FILTER (
            WHERE last_email_status = 'failed'
              AND updated_at >= NOW() - make_interval(days => ${days})
          )::int AS failed_carts
        FROM abandoned_carts
        WHERE COALESCE(is_test, false) = false
      `),

      // ── Opens / clicks (carts created in period) ─────────────────────────
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE email_sent_count > 0)::int AS carts_emailed,
          COUNT(*) FILTER (WHERE email_opened_at IS NOT NULL)::int AS carts_opened,
          COALESCE(SUM(email_open_count), 0)::int AS total_opens,
          COUNT(*) FILTER (WHERE email_clicked_at IS NOT NULL)::int AS carts_clicked,
          COALESCE(SUM(email_click_count), 0)::int AS total_clicks
        FROM abandoned_carts
        WHERE COALESCE(is_test, false) = false
          AND created_at >= NOW() - make_interval(days => ${days})
      `),

      // ── Recovered orders + revenue ───────────────────────────────────────
      db.execute(sql`
        SELECT
          COUNT(*)::int AS recovered_carts,
          COUNT(*) FILTER (WHERE recovered_after_email = true)::int AS recovered_after_email,
          COALESCE(SUM(
            COALESCE(o.amount_paid_cents / 100.0, ac.estimated_total)
          ), 0)::numeric(12,2) AS revenue_recovered
        FROM abandoned_carts ac
        LEFT JOIN orders o ON o.id = ac.recovered_order_id
        WHERE COALESCE(ac.is_test, false) = false
          AND ac.status = 'recovered'
          AND ac.recovered_at >= NOW() - make_interval(days => ${days})
      `),

      // ── Consent opt-in rate ──────────────────────────────────────────────
      db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM cart_recovery_consents
            WHERE COALESCE(is_test, false) = false
              AND consented = true AND revoked_at IS NULL
              AND consented_at >= NOW() - make_interval(days => ${days}))::int AS consents,
          (SELECT COUNT(*) FROM cart_recovery_consents
            WHERE COALESCE(is_test, false) = false
              AND revoked_at >= NOW() - make_interval(days => ${days}))::int AS revoked,
          (SELECT COUNT(DISTINCT LOWER(customer_email)) FROM abandoned_carts
            WHERE COALESCE(is_test, false) = false
              AND customer_email IS NOT NULL
              AND created_at >= NOW() - make_interval(days => ${days}))::int AS emails_captured
      `),

      // ── Mobile vs desktop checkout conversion (funnel_events) ────────────
      db.execute(sql`
        SELECT
          COALESCE(NULLIF(device_type, ''), 'unknown') AS device,
          COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'add_to_cart')::int AS add_to_cart,
          COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'begin_checkout')::int AS begin_checkout,
          COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'add_payment_info')::int AS add_payment_info,
          COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'purchase')::int AS purchases
        FROM funnel_events
        WHERE created_at >= NOW() - make_interval(days => ${days})
          AND event_name IN ('add_to_cart', 'begin_checkout', 'add_payment_info', 'purchase')
        GROUP BY 1
        ORDER BY begin_checkout DESC
      `),

      // ── Recent email activity (redacted) ─────────────────────────────────
      db.execute(sql`
        SELECT
          cart_id,
          CONCAT(LEFT(customer_email, 2), '***@', SPLIT_PART(customer_email, '@', 2)) AS email_redacted,
          estimated_total::numeric(12,2) AS cart_value,
          status,
          email_sent_count,
          last_email_status,
          first_email_sent_at,
          second_email_sent_at,
          third_email_sent_at,
          email_opened_at,
          email_clicked_at,
          recovered_at
        FROM abandoned_carts
        WHERE COALESCE(is_test, false) = false
          AND email_sent_count > 0
          AND updated_at >= NOW() - make_interval(days => ${days})
        ORDER BY updated_at DESC
        LIMIT 25
      `),
    ]);

    const funnel = (cartFunnel.rows?.[0] || {}) as Record<string, number>;
    const steps = (emailSteps.rows?.[0] || {}) as Record<string, number>;
    const eng = (engagement.rows?.[0] || {}) as Record<string, number>;
    const rec = (recovery.rows?.[0] || {}) as Record<string, any>;
    const opt = (optIn.rows?.[0] || {}) as Record<string, number>;

    const emailsSent =
      (steps.first_sent || 0) + (steps.second_sent || 0) + (steps.third_sent || 0);
    const optInPct =
      opt.emails_captured > 0
        ? Math.round((opt.consents / opt.emails_captured) * 1000) / 10
        : null;

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      periodDays: days,
      carts: {
        total: funnel.total_carts || 0,
        withEmail: funnel.carts_with_email || 0,
        withConsent: funnel.carts_with_consent || 0,
        eligible: funnel.eligible_carts || 0,
        queuedInSequence: funnel.queued_carts || 0,
        blockedNoConsent: funnel.blocked_no_consent || 0,
      },
      emails: {
        sent: emailsSent,
        byStep: {
          first: steps.first_sent || 0,
          second: steps.second_sent || 0,
          third: steps.third_sent || 0,
        },
        failures: steps.failed_carts || 0,
        cartsEmailed: eng.carts_emailed || 0,
        opened: { carts: eng.carts_opened || 0, totalOpens: eng.total_opens || 0 },
        clicked: { carts: eng.carts_clicked || 0, totalClicks: eng.total_clicks || 0 },
        openRatePct:
          (eng.carts_emailed || 0) > 0
            ? Math.round(((eng.carts_opened || 0) / eng.carts_emailed) * 1000) / 10
            : null,
        clickRatePct:
          (eng.carts_emailed || 0) > 0
            ? Math.round(((eng.carts_clicked || 0) / eng.carts_emailed) * 1000) / 10
            : null,
      },
      recovery: {
        ordersRecovered: rec.recovered_carts || 0,
        recoveredAfterEmail: rec.recovered_after_email || 0,
        revenueRecovered: Number(rec.revenue_recovered || 0),
      },
      consent: {
        newConsents: opt.consents || 0,
        revoked: opt.revoked || 0,
        emailsCaptured: opt.emails_captured || 0,
        optInPct,
      },
      deviceConversion: (deviceConversion.rows || []).map((r: any) => ({
        device: r.device,
        addToCart: r.add_to_cart,
        beginCheckout: r.begin_checkout,
        addPaymentInfo: r.add_payment_info,
        purchases: r.purchases,
        checkoutConversionPct:
          r.begin_checkout > 0
            ? Math.round((r.purchases / r.begin_checkout) * 1000) / 10
            : null,
      })),
      recentEmails: recentEmails.rows || [],
    });
  } catch (err: any) {
    console.error("[recovery-dashboard] Query failed:", err);
    return NextResponse.json(
      { error: "query_failed", message: String(err?.message || err) },
      { status: 500 }
    );
  }
}
