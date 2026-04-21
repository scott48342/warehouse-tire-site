import Link from "next/link";

/**
 * Final CTA Section - MATCHES TEMPLATE
 * Simple, bold closing section
 */

export function FinalCTA() {
  return (
    <section className="relative py-16">
      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
        {/* Headline */}
        <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
          Ready to Build Yours?
        </h2>
        <p className="mt-4 text-lg text-white/50 max-w-2xl mx-auto">
          Enter your vehicle and let us show you what fits.
        </p>

        {/* CTA Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/tires"
            className="group inline-flex items-center gap-2 rounded-lg bg-red-700 hover:bg-red-600 px-8 py-4 text-base font-bold text-white transition-all hover:scale-105"
          >
            <span>Start with Tires</span>
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
          
          <Link
            href="/wheels"
            className="group inline-flex items-center gap-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 px-8 py-4 text-base font-bold text-white transition-all hover:scale-105"
          >
            <span>Start with Wheels</span>
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>

          <Link
            href="/wheels?package=1"
            className="group inline-flex items-center gap-2 rounded-lg bg-orange-600 hover:bg-orange-500 px-8 py-4 text-base font-bold text-white transition-all hover:scale-105"
          >
            <span>Shop Packages</span>
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </div>

        {/* Phone support line */}
        <div className="mt-10 text-white/40 text-sm">
          Need help? Call us at{" "}
          <a href="tel:+12483324120" className="font-bold text-white hover:text-orange-400 transition-colors">
            (248) 332-4120
          </a>
        </div>
      </div>
    </section>
  );
}
