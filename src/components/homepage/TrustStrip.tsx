/**
 * Trust Strip
 * Slim horizontal row of trust indicators
 */

const TRUST_ITEMS = [
  { icon: "✓", text: "Verified Fitment", highlight: true },
  { icon: "🚚", text: "Fast Shipping" },
  { icon: "🛞", text: "Top Brands" },
  { icon: "🔧", text: "Package Builder" },
  { icon: "📞", text: "Expert Support" },
];

export function TrustStrip() {
  return (
    <section className="bg-neutral-900 border-y border-white/5">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 py-5">
          {TRUST_ITEMS.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-sm"
            >
              <span className={item.highlight ? "text-green-400" : "text-white/60"}>
                {item.icon}
              </span>
              <span className={item.highlight ? "text-white font-semibold" : "text-white/70"}>
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
