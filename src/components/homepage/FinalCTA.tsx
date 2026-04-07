import Link from "next/link";

/**
 * Final CTA Section
 * Strong call-to-action at the bottom of the page
 */

export function FinalCTA() {
  return (
    <section className="relative bg-neutral-950 py-20 md:py-28 overflow-hidden">
      {/* Background with subtle truck image */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{
          backgroundImage: "url('/images/homepage/hero-truck.jpg')",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/90 to-neutral-950" />

      {/* Glow effects */}
      <div className="absolute bottom-0 left-1/4 w-[600px] h-[300px] bg-red-600/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[300px] bg-amber-600/10 blur-[120px] rounded-full" />

      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
        {/* Headline */}
        <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight">
          Ready to Build Yours?
        </h2>
        <p className="mt-4 text-lg text-white/60 max-w-2xl mx-auto">
          Enter your vehicle and let us show you what fits. 
          Stock, leveled, or lifted — we've got you covered.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/tires"
            className="group inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 px-8 py-4 text-lg font-bold text-white transition-all hover:scale-105 hover:shadow-xl hover:shadow-red-600/25"
          >
            <span>🛞</span>
            <span>Start with Tires</span>
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
          
          <Link
            href="/wheels"
            className="group inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 hover:border-white/30 px-8 py-4 text-lg font-bold text-white transition-all hover:scale-105"
          >
            <span>⚙️</span>
            <span>Start with Wheels</span>
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>

          <Link
            href="/packages"
            className="group inline-flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 px-8 py-4 text-lg font-bold text-white transition-all hover:scale-105 hover:shadow-xl hover:shadow-amber-600/25"
          >
            <span>📦</span>
            <span>Shop Packages</span>
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </div>

        {/* Phone support line */}
        <div className="mt-10 flex items-center justify-center gap-2 text-white/50">
          <span>📞</span>
          <span>Need help? Call us at</span>
          <a href="tel:+12483324120" className="font-bold text-white hover:text-amber-400 transition-colors">
            (248) 332-4120
          </a>
        </div>
      </div>
    </section>
  );
}
