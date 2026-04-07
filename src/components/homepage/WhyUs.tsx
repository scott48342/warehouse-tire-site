/**
 * Why Us Section - MATCHES TEMPLATE
 * "We Don't Guess Fitment — We Guarantee It"
 * 3 cards with line icons
 */

const VALUE_PROPS = [
  {
    icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
      </svg>
    ),
    title: "Fitment Intelligence",
    description: "Our proprietary system verifies every wheel and tire for your exact vehicle.",
  },
  {
    icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
    title: "Build-Based Shopping",
    description: "Stock, leveled, or lifted — we filter results to match YOUR build.",
  },
  {
    icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    title: "Complete Packages",
    description: "Wheels + tires, mounted, balanced, and shipped ready to install.",
  },
];

export function WhyUs() {
  return (
    <section className="relative py-16">
      <div className="relative z-10 mx-auto max-w-6xl px-4">
        {/* Section Header */}
        <div className="text-center mb-4">
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            We Don't Guess Fitment — We Guarantee It
          </h2>
          <p className="mt-3 text-white/50">
            Fitment Intelligence &nbsp;•&nbsp; Build-Based Shopping &nbsp;•&nbsp; Complete Packages
          </p>
        </div>

        {/* Value Props Grid */}
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {VALUE_PROPS.map((prop, i) => (
            <div
              key={i}
              className="group relative overflow-hidden rounded-2xl bg-[rgba(20,20,20,0.7)] backdrop-blur-md border border-white/5 hover:border-white/10 p-8 text-center transition-all duration-300 hover:scale-[1.02]"
            >
              {/* Icon */}
              <div className="flex justify-center mb-5 text-white/40 group-hover:text-white/60 transition-colors">
                {prop.icon}
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold text-white mb-3">{prop.title}</h3>

              {/* Description */}
              <p className="text-white/50 text-sm leading-relaxed">
                {prop.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
