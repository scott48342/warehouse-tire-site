import Link from "next/link";

/**
 * Build Style Entry Cards - Homepage entry points for build-based shopping
 * 
 * Guides users into the wheel shopping experience based on their build type:
 * - Stock: Clean, factory look
 * - Level: Moderate upgrades for trucks/SUVs
 * - Lifted: Full custom truck experience
 */

const BUILD_STYLES = [
  {
    id: "stock",
    title: "Stock Fit",
    subtitle: "Factory Ride",
    description: "No modifications needed. Safe, clean, OEM-friendly wheels.",
    icon: "✓",
    emoji: "🚗",
    gradient: "from-green-50 to-emerald-50",
    border: "border-green-200 hover:border-green-300",
    iconBg: "bg-green-100",
    textColor: "text-green-800",
    buttonColor: "bg-green-600 hover:bg-green-700",
    href: "/wheels?buildType=stock",
  },
  {
    id: "level",
    title: "Leveled",
    subtitle: "Better Stance",
    description: "Leveling kit friendly. Mild upgrades for trucks & SUVs.",
    icon: "↕",
    emoji: "🛻",
    gradient: "from-blue-50 to-sky-50",
    border: "border-blue-200 hover:border-blue-300",
    iconBg: "bg-blue-100",
    textColor: "text-blue-800",
    buttonColor: "bg-blue-600 hover:bg-blue-700",
    href: "/wheels?buildType=level",
  },
  {
    id: "lifted",
    title: "Lifted",
    subtitle: "Maximum Presence",
    description: "Big wheels. Wide stance. Custom truck builds.",
    icon: "⬆",
    emoji: "🏔️",
    gradient: "from-amber-50 to-orange-50",
    border: "border-amber-200 hover:border-amber-300",
    iconBg: "bg-amber-100",
    textColor: "text-amber-800",
    buttonColor: "bg-amber-600 hover:bg-amber-700",
    href: "/wheels?buildType=lifted",
    accent: true,
  },
];

/**
 * Full-width hero section with build style cards
 */
export function BuildStyleHero() {
  return (
    <section className="bg-gradient-to-b from-neutral-100 to-white py-10">
      <div className="mx-auto max-w-6xl px-4">
        {/* Headline */}
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-extrabold text-neutral-900">
            Find Wheels That Actually Fit
          </h2>
          <p className="mt-2 text-neutral-600">
            Stock, leveled, or lifted — shop the setup that matches your build.
          </p>
        </div>

        {/* Build Style Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {BUILD_STYLES.map((style) => (
            <Link
              key={style.id}
              href={style.href}
              className={`
                group relative overflow-hidden rounded-2xl border-2 p-5 transition-all hover:shadow-lg
                bg-gradient-to-br ${style.gradient} ${style.border}
              `}
            >
              {/* Accent badge for lifted */}
              {style.accent && (
                <div className="absolute top-3 right-3">
                  <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                    Popular
                  </span>
                </div>
              )}

              {/* Icon */}
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${style.iconBg} text-2xl mb-3`}>
                {style.emoji}
              </div>

              {/* Content */}
              <div className="font-extrabold text-lg text-neutral-900">{style.title}</div>
              <div className={`text-sm font-semibold ${style.textColor}`}>{style.subtitle}</div>
              <p className="mt-2 text-sm text-neutral-600">{style.description}</p>

              {/* CTA */}
              <div className="mt-4">
                <span className={`
                  inline-flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-bold text-white transition-colors
                  ${style.buttonColor}
                `}>
                  <span>Shop {style.title}</span>
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Trust line */}
        <div className="mt-6 text-center text-xs text-neutral-500">
          ✓ Verified fitment for your specific vehicle • ✓ Expert guidance included
        </div>
      </div>
    </section>
  );
}

/**
 * Compact inline version for use within other sections
 */
export function BuildStyleButtons({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-3 ${className}`}>
      {BUILD_STYLES.map((style) => (
        <Link
          key={style.id}
          href={style.href}
          className={`
            group inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 transition-all hover:shadow-md
            bg-gradient-to-br ${style.gradient} ${style.border}
          `}
        >
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${style.iconBg} text-lg`}>
            {style.icon}
          </span>
          <div>
            <div className="font-bold text-sm text-neutral-900">{style.title}</div>
            <div className="text-[10px] text-neutral-500">{style.description.split('.')[0]}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

/**
 * Pill-style buttons for tight spaces
 */
export function BuildStylePills({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-2 ${className}`}>
      {BUILD_STYLES.map((style) => (
        <Link
          key={style.id}
          href={style.href}
          className={`
            inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-all
            ${style.accent 
              ? "bg-amber-500 text-white hover:bg-amber-600" 
              : "bg-white text-neutral-800 border border-neutral-200 hover:bg-neutral-100"
            }
          `}
        >
          <span>{style.icon}</span>
          <span>{style.title}</span>
        </Link>
      ))}
    </div>
  );
}

/**
 * Mini selector for use in headers/navs
 */
export function BuildStyleMini() {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-neutral-500 mr-1">Build:</span>
      {BUILD_STYLES.map((style) => (
        <Link
          key={style.id}
          href={style.href}
          className="rounded-lg border border-neutral-200 bg-white p-1.5 text-sm hover:bg-neutral-50 transition-colors"
          title={`${style.title}: ${style.description}`}
        >
          {style.icon}
        </Link>
      ))}
    </div>
  );
}
