/**
 * Why Us Section
 * Three value proposition cards
 */

const VALUE_PROPS = [
  {
    icon: "⚙️",
    title: "Fitment Engine",
    description: "Our proprietary fitment system verifies every wheel and tire for your exact vehicle. No guessing. No returns.",
    highlight: "Your biggest differentiator",
  },
  {
    icon: "🎯",
    title: "Build-Based Shopping",
    description: "Stock, leveled, or lifted — we filter results to match YOUR build. No more sifting through wheels that won't fit.",
    highlight: "Shop by your setup",
  },
  {
    icon: "📦",
    title: "Complete Packages",
    description: "Wheels + tires, mounted, balanced, and shipped to your door or installer. One order. Done right.",
    highlight: "Mount + balance + ship",
  },
];

export function WhyUs() {
  return (
    <section className="relative bg-neutral-950 py-16 md:py-20 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-black" />

      {/* Subtle glow effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-600/5 blur-[100px] rounded-full" />

      <div className="relative z-10 mx-auto max-w-6xl px-4">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            We Don't Guess Fitment —
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
              We Guarantee It
            </span>
          </h2>
        </div>

        {/* Value Props Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {VALUE_PROPS.map((prop, i) => (
            <div
              key={i}
              className="group relative overflow-hidden rounded-2xl bg-neutral-900/50 backdrop-blur-sm border border-white/5 hover:border-white/10 p-6 md:p-8 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
            >
              {/* Subtle gradient on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-600/0 to-orange-600/0 group-hover:from-amber-600/5 group-hover:to-orange-600/5 transition-all duration-500" />

              <div className="relative z-10">
                {/* Icon */}
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-3xl mb-5">
                  {prop.icon}
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-white mb-2">{prop.title}</h3>

                {/* Highlight tag */}
                <div className="inline-flex items-center rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 mb-3">
                  {prop.highlight}
                </div>

                {/* Description */}
                <p className="text-white/60 leading-relaxed">
                  {prop.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
