import Link from "next/link";
import Image from "next/image";
import { Metadata } from "next";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Tire Tech & Tips | Warehouse Tire Direct",
  description:
    "Learn everything about tires and wheels. How-to guides, size charts, maintenance tips, and expert advice from Warehouse Tire Direct.",
  openGraph: {
    title: "Tire Tech & Tips | Warehouse Tire Direct",
    description:
      "Your complete resource for tire and wheel knowledge. Guides, tips, and expert advice.",
  },
};

const QUICK_GUIDES = [
  {
    title: "How to Read Tire Sizes",
    description: "Decode the numbers on your tire sidewall",
    href: "/blog/how-to-read-tire-sizes",
    icon: "📏",
  },
  {
    title: "Wheel Offset Explained",
    description: "Understanding offset for the perfect fitment",
    href: "/blog/wheel-offset-explained-guide",
    icon: "📐",
  },
  {
    title: "Bolt Pattern Guide",
    description: "How to measure and find your bolt pattern",
    href: "/blog/bolt-pattern-guide-how-to-measure",
    icon: "🔩",
  },
  {
    title: "Tire Speed Ratings",
    description: "What those letters mean for your driving",
    href: "/blog/tire-speed-rating-explained",
    icon: "⚡",
  },
];

const TIRE_TYPES = [
  {
    name: "All-Season Tires",
    description: "Versatile year-round performance for everyday driving",
    pros: ["Good in rain and light snow", "Long tread life", "Quiet ride"],
    bestFor: "Daily commuters in mild climates",
  },
  {
    name: "All-Terrain Tires",
    description: "Balance of on-road comfort and off-road capability",
    pros: ["Handles dirt and gravel", "Good highway manners", "Aggressive look"],
    bestFor: "Truck owners who go off-road occasionally",
  },
  {
    name: "Mud-Terrain Tires",
    description: "Maximum traction in challenging off-road conditions",
    pros: ["Excellent in mud and rocks", "Self-cleaning tread", "Durable sidewalls"],
    bestFor: "Serious off-roaders and trail enthusiasts",
  },
  {
    name: "Highway Tires",
    description: "Optimized for smooth, quiet highway driving",
    pros: ["Excellent fuel economy", "Long lasting", "Very quiet"],
    bestFor: "Highway commuters and long-distance drivers",
  },
  {
    name: "Performance Tires",
    description: "Enhanced grip and handling for spirited driving",
    pros: ["Superior cornering", "Excellent braking", "Responsive handling"],
    bestFor: "Sports cars and performance enthusiasts",
  },
  {
    name: "Winter Tires",
    description: "Designed specifically for snow and ice",
    pros: ["Stays flexible in cold", "Bites into snow", "Shorter stopping distance"],
    bestFor: "Drivers in areas with harsh winters",
  },
];

const MAINTENANCE_TIPS = [
  {
    title: "Check Tire Pressure Monthly",
    description:
      "Proper inflation improves fuel economy, tire life, and safety. Check when tires are cold.",
    icon: "🎯",
  },
  {
    title: "Rotate Every 5,000-7,500 Miles",
    description:
      "Regular rotation ensures even wear and maximizes tire life. Follow your vehicle's rotation pattern.",
    icon: "🔄",
  },
  {
    title: "Inspect Tread Depth",
    description:
      "Use the penny test: if you can see Lincoln's head, it's time for new tires. Replace at 2/32\" depth.",
    icon: "📊",
  },
  {
    title: "Check Alignment Annually",
    description:
      "Misalignment causes uneven wear and poor handling. Get checked after hitting potholes or curbs.",
    icon: "↔️",
  },
  {
    title: "Balance When Installing",
    description:
      "Unbalanced tires cause vibration and premature wear. Rebalance if you feel vibration at highway speeds.",
    icon: "⚖️",
  },
  {
    title: "Store Tires Properly",
    description:
      "Keep seasonal tires in a cool, dry place away from sunlight. Store mounted tires flat or hanging.",
    icon: "🏠",
  },
];

const SIZE_CHART = [
  { vehicle: "Compact Car", common: "195/65R15, 205/55R16" },
  { vehicle: "Midsize Sedan", common: "215/55R17, 225/50R18" },
  { vehicle: "Full-Size Sedan", common: "225/55R17, 235/50R18" },
  { vehicle: "Compact SUV", common: "225/65R17, 235/60R18" },
  { vehicle: "Midsize SUV", common: "245/60R18, 265/50R20" },
  { vehicle: "Full-Size SUV", common: "275/55R20, 285/45R22" },
  { vehicle: "Half-Ton Truck", common: "265/70R17, 275/60R20" },
  { vehicle: "3/4-Ton Truck", common: "275/70R18, 285/60R20" },
  { vehicle: "Sports Car", common: "225/45R17, 245/40R18" },
];

export default async function TireTechPage() {
  // Get related blog posts
  const allPosts = await getAllPosts();
  const relatedPosts = allPosts.slice(0, 6);

  return (
    <main className="min-h-screen bg-neutral-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-neutral-900 to-neutral-800 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Tire Tech & Tips
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-neutral-300">
            Your complete resource for tire and wheel knowledge. Learn how to choose
            the right tires, maintain them properly, and get the most out of your
            investment.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/tires"
              className="inline-flex items-center rounded-full bg-[var(--brand-red)] px-6 py-3 font-bold text-white hover:bg-[var(--brand-red-700)]"
            >
              Shop Tires
            </Link>
            <Link
              href="#guides"
              className="inline-flex items-center rounded-full border border-white/30 px-6 py-3 font-bold text-white hover:bg-white/10"
            >
              Browse Guides
            </Link>
          </div>
        </div>
      </section>

      {/* Quick Guides */}
      <section id="guides" className="py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-extrabold text-neutral-900 sm:text-3xl">
            Quick Guides
          </h2>
          <p className="mt-2 text-neutral-600">
            Essential knowledge for every tire and wheel buyer
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK_GUIDES.map((guide) => (
              <Link
                key={guide.href}
                href={guide.href}
                className="group rounded-2xl border border-neutral-200 bg-white p-6 transition-shadow hover:shadow-lg"
              >
                <span className="text-3xl">{guide.icon}</span>
                <h3 className="mt-4 font-bold text-neutral-900 group-hover:text-[var(--brand-red)]">
                  {guide.title}
                </h3>
                <p className="mt-1 text-sm text-neutral-600">{guide.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Tire Types */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-extrabold text-neutral-900 sm:text-3xl">
            Tire Types Explained
          </h2>
          <p className="mt-2 text-neutral-600">
            Understanding different tire categories helps you choose the right one
          </p>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TIRE_TYPES.map((type) => (
              <div
                key={type.name}
                className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6"
              >
                <h3 className="text-lg font-bold text-neutral-900">{type.name}</h3>
                <p className="mt-2 text-sm text-neutral-600">{type.description}</p>
                <ul className="mt-4 space-y-1">
                  {type.pros.map((pro) => (
                    <li
                      key={pro}
                      className="flex items-center gap-2 text-sm text-neutral-700"
                    >
                      <span className="text-green-500">✓</span>
                      {pro}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-neutral-500">
                  <strong>Best for:</strong> {type.bestFor}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Maintenance Tips */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-extrabold text-neutral-900 sm:text-3xl">
            Tire Maintenance Tips
          </h2>
          <p className="mt-2 text-neutral-600">
            Keep your tires in top shape and extend their life
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MAINTENANCE_TIPS.map((tip) => (
              <div
                key={tip.title}
                className="flex gap-4 rounded-xl border border-neutral-200 bg-white p-5"
              >
                <span className="text-2xl">{tip.icon}</span>
                <div>
                  <h3 className="font-bold text-neutral-900">{tip.title}</h3>
                  <p className="mt-1 text-sm text-neutral-600">{tip.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Common Tire Sizes */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-extrabold text-neutral-900 sm:text-3xl">
            Common Tire Sizes by Vehicle
          </h2>
          <p className="mt-2 text-neutral-600">
            Quick reference for popular vehicle categories
          </p>

          <div className="mt-8 overflow-hidden rounded-2xl border border-neutral-200">
            <table className="w-full">
              <thead className="bg-neutral-100">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-bold text-neutral-900">
                    Vehicle Type
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-bold text-neutral-900">
                    Common Sizes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {SIZE_CHART.map((row) => (
                  <tr key={row.vehicle} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 text-sm font-medium text-neutral-900">
                      {row.vehicle}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600">
                      {row.common}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-sm text-neutral-500">
            Not sure what size fits your vehicle?{" "}
            <Link href="/tires" className="text-[var(--brand-red)] hover:underline">
              Use our fitment tool
            </Link>{" "}
            to find the exact sizes for your year, make, and model.
          </p>
        </div>
      </section>

      {/* Blog Posts */}
      {relatedPosts.length > 0 && (
        <section className="py-16">
          <div className="mx-auto max-w-6xl px-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-extrabold text-neutral-900 sm:text-3xl">
                  From Our Blog
                </h2>
                <p className="mt-2 text-neutral-600">
                  In-depth guides and expert recommendations
                </p>
              </div>
              <Link
                href="/blog"
                className="hidden text-sm font-bold text-[var(--brand-red)] hover:underline sm:block"
              >
                View All Posts →
              </Link>
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relatedPosts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-shadow hover:shadow-lg"
                >
                  {post.image && (
                    <div className="relative h-40 overflow-hidden">
                      <Image
                        src={post.image}
                        alt={post.title}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                  )}
                  <div className="p-5">
                    <h3 className="font-bold text-neutral-900 group-hover:text-[var(--brand-red)]">
                      {post.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm text-neutral-600">
                      {post.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-6 text-center sm:hidden">
              <Link
                href="/blog"
                className="text-sm font-bold text-[var(--brand-red)] hover:underline"
              >
                View All Posts →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-neutral-900 to-neutral-800 py-16 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-2xl font-extrabold sm:text-3xl">
            Ready to Find Your Perfect Tires?
          </h2>
          <p className="mt-4 text-neutral-300">
            Use our fitment tool to see exactly what fits your vehicle, with
            guaranteed compatibility.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/tires"
              className="inline-flex items-center rounded-full bg-[var(--brand-red)] px-8 py-3 font-bold text-white hover:bg-[var(--brand-red-700)]"
            >
              Shop Tires
            </Link>
            <Link
              href="/wheels"
              className="inline-flex items-center rounded-full border border-white/30 px-8 py-3 font-bold text-white hover:bg-white/10"
            >
              Shop Wheels
            </Link>
          </div>
          <p className="mt-6 text-sm text-neutral-400">
            Questions? Call us at{" "}
            <a href="tel:+12483324120" className="text-white hover:underline">
              (248) 332-4120
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
