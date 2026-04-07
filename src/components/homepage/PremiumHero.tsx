"use client";

import Link from "next/link";

/**
 * Premium Hero Section - MATCHES TEMPLATE
 * Integrated with build cards below (continuous background)
 */
export function PremiumHero() {
  return (
    <section className="relative pt-12 pb-6">
      <div className="relative z-10 mx-auto max-w-6xl px-4">
        <div className="text-center">
          {/* Subheadline */}
          <p className="text-lg text-white/70">
            Stock, leveled, or lifted — shop the setup that matches your build.
          </p>

          {/* Primary CTAs */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/tires"
              className="group inline-flex items-center gap-2 rounded-lg bg-red-700 hover:bg-red-600 px-6 py-3 text-sm font-bold text-white transition-all hover:scale-105"
            >
              <span>Shop Tires</span>
              <span className="text-white/70">▼</span>
            </Link>
            
            <Link
              href="/wheels"
              className="group inline-flex items-center gap-2 rounded-lg bg-transparent hover:bg-white/10 border-2 border-white/30 hover:border-white/50 px-6 py-3 text-sm font-bold text-white transition-all hover:scale-105"
            >
              <span>Shop Wheels</span>
              <span className="text-white/70">▼</span>
            </Link>

            <Link
              href="/packages"
              className="group inline-flex items-center gap-2 rounded-lg bg-orange-600 hover:bg-orange-500 px-6 py-3 text-sm font-bold text-white transition-all hover:scale-105"
            >
              <span>Shop Packages</span>
              <span className="text-white/70">▼</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
