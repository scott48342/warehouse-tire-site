"use client";

/**
 * Admin Recovery Dashboard
 *
 * One-screen answer to "is the cart recovery system working?"
 * Shows eligibility funnel, consent opt-in, email sends/opens/clicks/failures,
 * recovered orders + revenue, and mobile vs desktop checkout conversion.
 *
 * Data: GET /api/admin/recovery-dashboard?days=N (read-only, excludes test data)
 *
 * @created 2026-08-03 (Phase 1 visibility)
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface DashboardData {
  generatedAt: string;
  periodDays: number;
  carts: {
    total: number;
    withEmail: number;
    withConsent: number;
    eligible: number;
    queuedInSequence: number;
    blockedNoConsent: number;
  };
  emails: {
    sent: number;
    byStep: { first: number; second: number; third: number };
    failures: number;
    cartsEmailed: number;
    opened: { carts: number; totalOpens: number };
    clicked: { carts: number; totalClicks: number };
    openRatePct: number | null;
    clickRatePct: number | null;
  };
  recovery: {
    ordersRecovered: number;
    recoveredAfterEmail: number;
    revenueRecovered: number;
  };
  consent: {
    newConsents: number;
    revoked: number;
    emailsCaptured: number;
    optInPct: number | null;
  };
  deviceConversion: Array<{
    device: string;
    addToCart: number;
    beginCheckout: number;
    addPaymentInfo: number;
    purchases: number;
    checkoutConversionPct: number | null;
  }>;
  recentEmails: Array<{
    cart_id: string;
    email_redacted: string;
    cart_value: string;
    status: string;
    email_sent_count: number;
    last_email_status: string | null;
    first_email_sent_at: string | null;
    second_email_sent_at: string | null;
    third_email_sent_at: string | null;
    email_opened_at: string | null;
    email_clicked_at: string | null;
    recovered_at: string | null;
  }>;
}

const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
const pct = (n: number | null) => (n === null ? "n/a" : `${n}%`);

function Card({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "good" | "bad" | "warn";
}) {
  const toneClass =
    tone === "good"
      ? "text-green-600"
      : tone === "bad"
        ? "text-red-600"
        : tone === "warn"
          ? "text-amber-600"
          : "text-gray-900";
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${toneClass}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function RecoveryDashboardPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/recovery-dashboard?days=${days}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`API ${res.status}`);
      setData(await res.json());
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cart Recovery Dashboard</h1>
            <p className="text-sm text-gray-500">
              Phase 1 metrics · excludes test data ·{" "}
              <Link href="/admin/abandoned-carts" className="text-blue-600 hover:underline">
                view carts →
              </Link>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium border ${
                  days === d
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                }`}
              >
                {d}d
              </button>
            ))}
            <button
              onClick={load}
              className="px-3 py-1.5 rounded-md text-sm font-medium border bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
            Failed to load: {error}
          </div>
        )}
        {loading && !data && <div className="text-gray-500 py-12 text-center">Loading…</div>}

        {data && (
          <div className={loading ? "opacity-60" : ""}>
            {/* Headline: is it working? */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Card
                label="Revenue Recovered"
                value={fmtMoney(data.recovery.revenueRecovered)}
                sub={`${data.recovery.ordersRecovered} order${data.recovery.ordersRecovered === 1 ? "" : "s"} recovered`}
                tone={data.recovery.revenueRecovered > 0 ? "good" : "default"}
              />
              <Card
                label="Recovered After Email"
                value={data.recovery.recoveredAfterEmail}
                sub="orders directly attributed to a recovery email"
                tone={data.recovery.recoveredAfterEmail > 0 ? "good" : "default"}
              />
              <Card
                label="Recovery Opt-In Rate"
                value={pct(data.consent.optInPct)}
                sub={`${data.consent.newConsents} consents / ${data.consent.emailsCaptured} emails captured`}
              />
              <Card
                label="Email Failures"
                value={data.emails.failures}
                sub="carts whose last send failed"
                tone={data.emails.failures > 0 ? "bad" : "good"}
              />
            </div>

            {/* Cart funnel */}
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Cart Funnel (last {data.periodDays}d)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              <Card label="Abandoned Carts" value={data.carts.total} />
              <Card label="With Email" value={data.carts.withEmail} />
              <Card label="With Consent" value={data.carts.withConsent} />
              <Card
                label="Recovery-Eligible"
                value={data.carts.eligible}
                sub="abandoned + email + consent + ≥$50"
              />
              <Card
                label="Queued (in sequence)"
                value={data.carts.queuedInSequence}
                sub="eligible, <3 emails sent"
                tone={data.carts.queuedInSequence > 0 ? "warn" : "default"}
              />
            </div>
            {data.carts.blockedNoConsent > 0 && (
              <p className="text-xs text-gray-500 -mt-4 mb-6">
                {data.carts.blockedNoConsent} abandoned cart
                {data.carts.blockedNoConsent === 1 ? "" : "s"} with email are blocked (no recovery
                consent) — working as designed.
              </p>
            )}

            {/* Emails */}
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Recovery Emails
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              <Card
                label="Emails Sent"
                value={data.emails.sent}
                sub={`1st: ${data.emails.byStep.first} · 2nd: ${data.emails.byStep.second} · 3rd: ${data.emails.byStep.third}`}
              />
              <Card label="Carts Emailed" value={data.emails.cartsEmailed} />
              <Card
                label="Open Rate"
                value={pct(data.emails.openRatePct)}
                sub={`${data.emails.opened.carts} carts · ${data.emails.opened.totalOpens} opens`}
              />
              <Card
                label="Click Rate"
                value={pct(data.emails.clickRatePct)}
                sub={`${data.emails.clicked.carts} carts · ${data.emails.clicked.totalClicks} clicks`}
              />
              <Card
                label="Consents Revoked"
                value={data.consent.revoked}
                tone={data.consent.revoked > 0 ? "warn" : "default"}
              />
            </div>

            {/* Device conversion */}
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Checkout Conversion by Device
            </h2>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                    <th className="px-4 py-2">Device</th>
                    <th className="px-4 py-2 text-right">Add to Cart</th>
                    <th className="px-4 py-2 text-right">Begin Checkout</th>
                    <th className="px-4 py-2 text-right">Payment Info</th>
                    <th className="px-4 py-2 text-right">Purchases</th>
                    <th className="px-4 py-2 text-right">Checkout → Purchase</th>
                  </tr>
                </thead>
                <tbody>
                  {data.deviceConversion.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                        No funnel events in this period
                      </td>
                    </tr>
                  )}
                  {data.deviceConversion.map((d) => (
                    <tr key={d.device} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-2 font-medium capitalize">{d.device}</td>
                      <td className="px-4 py-2 text-right">{d.addToCart}</td>
                      <td className="px-4 py-2 text-right">{d.beginCheckout}</td>
                      <td className="px-4 py-2 text-right">{d.addPaymentInfo}</td>
                      <td className="px-4 py-2 text-right">{d.purchases}</td>
                      <td className="px-4 py-2 text-right font-semibold">
                        {pct(d.checkoutConversionPct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Recent email activity */}
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Recent Email Activity (latest 25)
            </h2>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                    <th className="px-4 py-2">Cart</th>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2 text-right">Value</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2 text-right">Sends</th>
                    <th className="px-4 py-2">Last Send</th>
                    <th className="px-4 py-2">Opened</th>
                    <th className="px-4 py-2">Clicked</th>
                    <th className="px-4 py-2">Recovered</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentEmails.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-center text-gray-400">
                        No recovery emails sent in this period yet
                      </td>
                    </tr>
                  )}
                  {data.recentEmails.map((r) => (
                    <tr key={r.cart_id} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-2 font-mono text-xs">{r.cart_id}</td>
                      <td className="px-4 py-2">{r.email_redacted}</td>
                      <td className="px-4 py-2 text-right">{fmtMoney(Number(r.cart_value || 0))}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            r.status === "recovered"
                              ? "bg-green-100 text-green-700"
                              : r.last_email_status === "failed"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {r.status}
                          {r.last_email_status === "failed" ? " · send failed" : ""}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">{r.email_sent_count}</td>
                      <td className="px-4 py-2 text-xs">
                        {fmtDate(r.third_email_sent_at || r.second_email_sent_at || r.first_email_sent_at)}
                      </td>
                      <td className="px-4 py-2 text-xs">{fmtDate(r.email_opened_at)}</td>
                      <td className="px-4 py-2 text-xs">{fmtDate(r.email_clicked_at)}</td>
                      <td className="px-4 py-2 text-xs">{fmtDate(r.recovered_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-gray-400">
              Generated {new Date(data.generatedAt).toLocaleString()} · min cart value for emails: $50
              · schedule: 1h / 24h / 48h · Clarity:{" "}
              <a
                href="https://clarity.microsoft.com/projects"
                target="_blank"
                rel="noreferrer"
                className="text-blue-500 hover:underline"
              >
                session recordings →
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
