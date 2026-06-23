/**
 * Trust Signals — reusable social-proof components
 *
 * Surfaces Warehouse Tire's 1,495+ Google reviews, decades in business,
 * physical MI locations, fitment guarantee, secure checkout, financing and
 * phone support throughout the shopping journey. Pulls all facts from
 * `@/lib/trust` so numbers stay consistent and edited in one place.
 *
 * Components:
 *  - <StarRating />          inline stars
 *  - <TrustBar />            above-the-fold strip (homepage / SRP)
 *  - <ReviewCarousel />      homepage customer reviews
 *  - <ProductTrustBlock />   compact block near Add-to-Cart
 *  - <CartTrustModule />     pre-checkout reassurance on the cart
 *  - <CheckoutTrustBadges /> low-friction badges for checkout
 *
 * @created 2026-06-23
 */

"use client";

import { TRUST, STORES } from "@/lib/trust";
import storeReviewsData from "@/data/store-reviews.json";

interface FeaturedReview {
  id: string;
  author: string;
  rating: number;
  text: string;
  source?: string;
}
const FEATURED: FeaturedReview[] = (storeReviewsData.featured as FeaturedReview[]) || [];
function clip(t: string, n = 220) {
  const oneLine = t.replace(/\s+/g, " ").trim();
  return oneLine.length > n ? oneLine.slice(0, n).trimEnd() + "\u2026" : oneLine;
}

/* ── Stars ─────────────────────────────────────────────────────────────── */
export function StarRating({
  rating = TRUST.rating,
  size = "sm",
  className = "",
}: {
  rating?: number;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const px = { xs: "text-xs", sm: "text-sm", md: "text-base", lg: "text-xl" }[size];
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span
      className={`inline-flex items-center ${px} leading-none text-amber-400 ${className}`}
      aria-label={`${rating} out of 5 stars`}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i}>{i < full ? "★" : i === full && half ? "⯨" : "☆"}</span>
      ))}
    </span>
  );
}

/* ── Above-the-fold trust bar ──────────────────────────────────────────── */
export function TrustBar({
  variant = "light",
  className = "",
}: {
  variant?: "light" | "dark";
  className?: string;
}) {
  const base =
    variant === "dark"
      ? "bg-neutral-900 text-neutral-100 border-neutral-800"
      : "bg-white text-neutral-700 border-neutral-200";
  return (
    <div className={`w-full border-y ${base} ${className}`}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-2.5 text-xs sm:text-sm font-semibold">
        <span className="inline-flex items-center gap-1.5">
          <StarRating size="sm" />
          <span>
            {TRUST.reviewsDisplay} {TRUST.googleSource}
          </span>
        </span>
        <span className="hidden sm:inline text-neutral-300">•</span>
        <span className="inline-flex items-center gap-1.5">🏆 {TRUST.decadesDisplay}</span>
        <span className="hidden sm:inline text-neutral-300">•</span>
        <span className="inline-flex items-center gap-1.5">🔒 Secure Checkout</span>
        <span className="hidden sm:inline text-neutral-300">•</span>
        <span className="inline-flex items-center gap-1.5">🚚 Nationwide Shipping</span>
      </div>
    </div>
  );
}

/* ── Homepage review carousel ──────────────────────────────────────────── */
export function ReviewCarousel({ className = "" }: { className?: string }) {
  return (
    <section className={`w-full bg-neutral-50 py-10 ${className}`}>
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-6 flex flex-col items-center text-center">
          <StarRating size="lg" />
          <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">
            {TRUST.reviewsDisplay} Five-Star {TRUST.googleSource}
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            {TRUST.decadesDisplay} · {TRUST.locationsDisplay} in Michigan
          </p>
        </div>

        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {FEATURED.slice(0, 8).map((r) => (
            <figure
              key={r.id}
              className="min-w-[280px] max-w-[320px] snap-start rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
            >
              <StarRating size="sm" rating={r.rating} />
              <blockquote className="mt-2 text-sm leading-relaxed text-neutral-700">
                “{clip(r.text)}”
              </blockquote>
              <figcaption className="mt-3 flex items-center justify-between text-xs">
                <span className="font-bold text-neutral-900">{r.author}</span>
                <span className="inline-flex items-center gap-1 text-neutral-500">
                  <GoogleG /> Google
                </span>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {STORES.map((s) => (
            <a
              key={s.name}
              href={s.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:border-neutral-300"
            >
              <GoogleG />
              <span>
                {s.city}: {s.reviews.toLocaleString("en-US")} reviews
              </span>
              <StarRating size="xs" rating={s.rating} />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Near Add-to-Cart product trust block ──────────────────────────────── */
export function ProductTrustBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-neutral-200 bg-white p-3 ${className}`}
    >
      <div className="flex items-center gap-2">
        <StarRating size="sm" />
        <span className="text-sm font-bold text-neutral-900">
          {TRUST.reviewsDisplay} {TRUST.googleSource}
        </span>
      </div>
      <ul className="mt-2 grid grid-cols-1 gap-1 text-xs text-neutral-600">
        <li className="inline-flex items-center gap-1.5">🏆 {TRUST.sinceDisplay}</li>
        <li className="inline-flex items-center gap-1.5">✅ Fitment Guarantee</li>
        <li className="inline-flex items-center gap-1.5">🔒 Secure Checkout</li>
        <li className="inline-flex items-center gap-1.5">
          📞 Phone Support:{" "}
          <a href="tel:+12483324120" className="font-semibold text-neutral-800 hover:underline">
            (248) 332-4120
          </a>
        </li>
      </ul>
    </div>
  );
}

/* ── Cart pre-checkout trust module ────────────────────────────────────── */
export function CartTrustModule({ className = "" }: { className?: string }) {
  const items = [
    { icon: "⭐", label: `${TRUST.reviewsDisplay} ${TRUST.googleSource}` },
    { icon: "🔒", label: "Secure Checkout (Stripe)" },
    { icon: "↩️", label: "Easy Returns & Exchanges" },
    { icon: "✅", label: "Fitment Guarantee" },
    { icon: "💳", label: "Financing Available" },
  ];
  return (
    <div className={`rounded-2xl border border-neutral-200 bg-white p-4 ${className}`}>
      <div className="mb-2 flex items-center gap-2">
        <StarRating size="sm" />
        <span className="text-sm font-extrabold text-neutral-900">
          Trusted by {TRUST.reviewsDisplay} drivers
        </span>
      </div>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {items.map((it) => (
          <li key={it.label} className="inline-flex items-center gap-2 text-xs text-neutral-700">
            <span>{it.icon}</span>
            <span>{it.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Checkout badges (low friction) ────────────────────────────────────── */
export function CheckoutTrustBadges({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] font-medium text-neutral-500 ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        <StarRating size="xs" /> {TRUST.reviewsDisplay} reviews
      </span>
      <span className="inline-flex items-center gap-1">🔒 Secure Stripe checkout</span>
      <span className="inline-flex items-center gap-1">✅ Fitment guarantee</span>
      <span className="inline-flex items-center gap-1">↩️ Easy returns</span>
    </div>
  );
}

/* ── Tiny Google "G" mark ──────────────────────────────────────────────── */
function GoogleG() {
  return (
    <svg width="12" height="12" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45 24c0-1.6-.1-3.1-.4-4.5H24v9h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1C42.7 36.7 45 30.9 45 24z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.5C3 17.1 2 20.4 2 24s1 6.9 2.5 9.9l7.3-5.7z" />
      <path fill="#EA4335" d="M24 10.7c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15.4 2 8.1 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9.1 12.2-9.1z" />
    </svg>
  );
}
