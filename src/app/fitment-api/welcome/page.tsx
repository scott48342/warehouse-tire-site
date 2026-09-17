/**
 * /fitment-api/welcome?session_id=cs_...
 *
 * Stripe Checkout success page for Fitment API subscriptions.
 * Confirms the signup and points to the key email. The API key itself is
 * NEVER rendered here — it exists only in the email (and hashed in the DB).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { getPool } from "@/lib/quotes";
import { getStripeClient } from "@/lib/payments/stripeClient";
import { FITMENT_API_PRODUCT_TAG, PLAN_NAMES, isBillablePlan } from "@/lib/fitment-api/billing";
import { PLAN_LIMITS } from "@/lib/fitment-api/apiKeys";
import { CopyableCode } from "@/components/fitment-api";

export const metadata: Metadata = {
  title: "Welcome to the Fitment API | Warehouse Tire Direct",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://shop.warehousetiredirect.com";
const EXAMPLE_URL = `${BASE_URL}/api/public/fitment/specs?year=2024&make=ford&model=f-150&trim=xlt`;
const EXAMPLE_CURL = `curl -H "X-API-Key: <your key>" \\\n  "${EXAMPLE_URL}"`;

type SessionInfo =
  | { ok: true; email: string; plan: string; planName: string; monthlyCalls?: number; paid: boolean }
  | { ok: false; reason: "missing" | "not_found" | "not_fitment_api" | "error" };

async function loadSession(sessionId: string | undefined): Promise<SessionInfo> {
  if (!sessionId || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    return { ok: false, reason: "missing" };
  }
  try {
    const conn = await getStripeClient(getPool());
    if (!conn) return { ok: false, reason: "error" };

    const session = await conn.stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.product !== FITMENT_API_PRODUCT_TAG) {
      return { ok: false, reason: "not_fitment_api" };
    }

    const plan = session.metadata?.plan || "";
    const planName = isBillablePlan(plan) ? PLAN_NAMES[plan] : plan;
    const email = session.customer_details?.email || session.customer_email || "";
    const paid = session.payment_status === "paid" || session.status === "complete";

    return {
      ok: true,
      email,
      plan,
      planName,
      monthlyCalls: PLAN_LIMITS[plan]?.monthly,
      paid,
    };
  } catch (err: any) {
    if (err?.code === "resource_missing" || err?.statusCode === 404) {
      return { ok: false, reason: "not_found" };
    }
    console.error("[fitment-api/welcome] session retrieve failed:", err?.message || err);
    return { ok: false, reason: "error" };
  }
}

export default async function FitmentApiWelcomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const raw = sp.session_id;
  const sessionId = Array.isArray(raw) ? raw[0] : raw;
  const info = await loadSession(sessionId);

  return (
    <div className="min-h-screen bg-black text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/40 via-black to-black pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          {info.ok ? (
            <>
              <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 mb-6">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-green-300 text-sm font-medium">
                  {info.planName ? `${info.planName} plan active` : "Subscription active"}
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl font-bold mb-6">You&apos;re in. 🎉</h1>

              <p className="text-xl text-zinc-300 mb-4">
                Your API key was emailed to{" "}
                <span className="text-white font-semibold">{info.email || "the address you used at checkout"}</span>.
              </p>
              <p className="text-zinc-400 mb-10">
                It usually lands within a minute. Check spam if you don&apos;t see it — the sender is our{" "}
                <span className="text-zinc-300">Fitment API</span> address. For security, the key is only
                ever shown in that email, never on this page.
                {info.monthlyCalls ? (
                  <>
                    {" "}Your plan includes up to{" "}
                    <span className="text-zinc-200">{info.monthlyCalls.toLocaleString("en-US")}</span> calls/month.
                  </>
                ) : null}
              </p>

              <h2 className="text-lg font-semibold text-zinc-100 mb-3">First call</h2>
              <p className="text-zinc-400 text-sm mb-4">
                Paste your key in place of <code className="text-zinc-200">&lt;your key&gt;</code> and run:
              </p>
              <CopyableCode code={EXAMPLE_CURL} />

              <div className="mt-6 rounded-xl bg-zinc-950 border border-zinc-800 p-5">
                <p className="text-zinc-500 text-xs uppercase tracking-wide mb-2">Example response</p>
                <pre className="text-sm text-zinc-300 font-mono overflow-x-auto">{`{
  "boltPattern": "6x135",
  "centerBore": 87.1,
  "threadSize": "M14x1.5",
  "serviceSpecs": { "lugTorqueFtlb": 150, "tirePressureFrontPsi": 36, "tirePressureRearPsi": 36, "oemLoadIndex": 110 },
  "offsetRange": [20, 44],
  "wheelSizes": ["17x7.5", "18x8", "20x9"],
  "tireSizes": ["265/70R17", "275/65R18"],
  "staggered": false
}`}</pre>
              </div>

              <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <Link
                  href="/fitment-api#endpoints"
                  className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
                >
                  Read the docs
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
                <Link
                  href="/fitment-api"
                  className="inline-flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
                >
                  Back to Fitment API
                </Link>
              </div>

              <p className="mt-10 text-sm text-zinc-500">
                Didn&apos;t get the email after a few minutes, or need help? Reply to any Fitment API email or
                write to{" "}
                <a href="mailto:scott@warehousetire.net" className="text-zinc-300 hover:text-white underline">
                  scott@warehousetire.net
                </a>{" "}
                and we&apos;ll sort it out fast. Manage or cancel your subscription anytime via the receipt
                Stripe emailed you.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-4xl font-bold mb-6">
                {info.reason === "missing" ? "Nothing to see here yet" : "We couldn't find that checkout"}
              </h1>
              <p className="text-zinc-300 mb-8">
                {info.reason === "missing" &&
                  "This page confirms a completed Fitment API signup, but no checkout session was provided."}
                {info.reason === "not_found" &&
                  "That checkout session doesn't exist or has expired. If you were charged, your key is still on its way by email."}
                {info.reason === "not_fitment_api" &&
                  "That checkout wasn't a Fitment API subscription."}
                {info.reason === "error" &&
                  "We hit a temporary problem verifying your checkout. If you completed payment, your API key is still being emailed to you — this page is just a confirmation."}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/fitment-api#pricing"
                  className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
                >
                  View plans
                </Link>
                <Link
                  href="/fitment-api#endpoints"
                  className="inline-flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
                >
                  API documentation
                </Link>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
