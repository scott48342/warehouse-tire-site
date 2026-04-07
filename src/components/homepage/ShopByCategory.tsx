import Link from "next/link";

/**
 * Shop by Category
 * Grid of category buttons for quick navigation
 */

const CATEGORIES = [
  {
    title: "All-Terrain Tires",
    icon: "🏔️",
    href: "/tires/c/all-terrain",
    accent: false,
  },
  {
    title: "Performance Tires",
    icon: "🏎️",
    href: "/tires/c/performance",
    accent: false,
  },
  {
    title: "Truck Wheels",
    icon: "🛻",
    href: "/wheels?category=truck",
    accent: false,
  },
  {
    title: "Street Wheels",
    icon: "✨",
    href: "/wheels?category=street",
    accent: false,
  },
  {
    title: "Lifted Packages",
    icon: "⬆️",
    href: "/lifted",
    accent: true,
  },
  {
    title: "Daily Driver Packages",
    icon: "🚗",
    href: "/packages?type=daily",
    accent: false,
  },
];

export function ShopByCategory() {
  return (
    <section className="relative bg-neutral-950 py-16 md:py-20">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 to-neutral-900" />

      <div className="relative z-10 mx-auto max-w-6xl px-4">
        {/* Section Header */}
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            Shop by Category
          </h2>
          <p className="mt-2 text-white/60">
            Find exactly what you need
          </p>
        </div>

        {/* Category Grid */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.title}
              href={cat.href}
              className={`
                group relative overflow-hidden rounded-2xl p-5 text-center transition-all duration-300
                hover:scale-105 hover:shadow-xl
                ${cat.accent 
                  ? "bg-gradient-to-br from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500" 
                  : "bg-neutral-800/80 hover:bg-neutral-700/80 border border-white/5 hover:border-white/10"
                }
              `}
            >
              {/* Icon */}
              <div className="text-3xl mb-3 transition-transform duration-300 group-hover:scale-110">
                {cat.icon}
              </div>

              {/* Title */}
              <div className={`text-sm font-bold ${cat.accent ? "text-white" : "text-white/90"}`}>
                {cat.title}
              </div>

              {/* Hover arrow */}
              <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs text-white/60">Shop →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
