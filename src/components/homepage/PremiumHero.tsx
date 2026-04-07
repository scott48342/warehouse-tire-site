"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Premium Hero Section
 * Full-width dark cinematic hero with real truck imagery
 */
export function PremiumHero() {
  const router = useRouter();

  return (
    <section className="relative min-h-[600px] md:min-h-[700px] overflow-hidden">
      {/* Background Image with fallback gradient */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat bg-neutral-900"
        style={{
          backgroundImage: "url('/images/homepage/hero-truck.jpg'), linear-gradient(to bottom right, #1a1a1a, #0a0a0a)",
        }}
      />
      
      {/* Dark Gradient Overlay - REQUIRED for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />
      
      {/* Subtle texture overlay */}
      <div className="absolute inset-0 bg-[url('/images/homepage/noise.png')] opacity-[0.03]" />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-4 py-1.5 mb-6">
            <span className="text-amber-400">🏆</span>
            <span className="text-sm font-medium text-white/90">Trusted by 50,000+ truck owners</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight">
            Find Wheels & Tires
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
              That Actually Fit
            </span>
          </h1>

          {/* Subheadline */}
          <p className="mt-4 text-lg md:text-xl text-white/70 max-w-2xl mx-auto">
            Stock, leveled, or lifted — shop the setup that matches your build.
          </p>

          {/* Primary CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/tires"
              className="group inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 px-6 py-3.5 text-base font-bold text-white transition-all hover:scale-105 hover:shadow-lg hover:shadow-red-600/25"
            >
              <span>🛞</span>
              <span>Shop Tires</span>
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
            
            <Link
              href="/wheels"
              className="group inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 px-6 py-3.5 text-base font-bold text-white transition-all hover:scale-105"
            >
              <span>⚙️</span>
              <span>Shop Wheels</span>
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>

            <Link
              href="/packages"
              className="group inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 px-6 py-3.5 text-base font-bold text-white transition-all hover:scale-105"
            >
              <span>📦</span>
              <span>Shop Packages</span>
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>

          {/* Vehicle Search Prompt */}
          <button
            type="button"
            onClick={() => router.push("/?open=tires&mode=vehicle")}
            className="mt-8 inline-flex items-center gap-3 rounded-2xl bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 hover:border-white/20 px-6 py-4 transition-all group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg">
              🚗
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-white">Enter Your Vehicle</div>
              <div className="text-xs text-white/50">Get verified fitment for your exact build</div>
            </div>
            <span className="text-white/50 transition-transform group-hover:translate-x-1">→</span>
          </button>
        </div>
      </div>

      {/* Bottom fade to next section */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-neutral-950 to-transparent" />
    </section>
  );
}
