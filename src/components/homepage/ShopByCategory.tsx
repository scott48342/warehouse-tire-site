"use client";

import Link from "next/link";
import Image from "next/image";

/**
 * Shop by Category - MATCHES TEMPLATE
 * 5 circular image cards with labels below
 * 
 * All categories use Homepage Intent system for scoped post-YMM experience.
 */

const CATEGORIES = [
  {
    title: "All-Terrain Tires",
    image: "/images/homepage/cat-all-terrain.png",
    // Homepage Intent: all_terrain_tires (A/T focused results)
    href: "/tires?entry=homepage&intent=all_terrain_tires",
  },
  {
    title: "Performance Tires",
    image: "/images/homepage/cat-performance.png",
    // Homepage Intent: performance_tires (UHP, summer, staggered-aware)
    href: "/tires?entry=homepage&intent=performance_tires",
  },
  {
    title: "Truck Wheels",
    image: "/images/homepage/cat-truck-wheels.png",
    // Homepage Intent: truck_wheels (truck-friendly styles and fitments)
    href: "/wheels?entry=homepage&intent=truck_wheels",
  },
  {
    title: "Street Wheels",
    image: "/images/homepage/cat-street-wheels.png",
    // Homepage Intent: street_wheels (street style, staggered-aware)
    href: "/wheels?entry=homepage&intent=street_wheels",
  },
  {
    title: "Lifted Packages",
    image: "/images/homepage/cat-lifted.png",
    // Homepage Intent: lifted_packages (package-oriented lifted results)
    href: "/wheels?entry=homepage&intent=lifted_packages",
  },
];

export function ShopByCategory() {
  return (
    <section className="relative py-12">
      <div className="relative z-10 mx-auto max-w-6xl px-4">
        {/* Section Header */}
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            Shop by Category
          </h2>
        </div>

        {/* Category Grid - 5 columns */}
        <div className="grid gap-6 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.title}
              href={cat.href}
              className="group flex flex-col items-center text-center transition-all duration-300 hover:scale-105"
            >
              {/* Circular Image Container */}
              <div className="relative w-32 h-32 md:w-36 md:h-36 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-white/30 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-black/50">
                <div className="absolute inset-0 bg-gradient-to-br from-neutral-700 to-neutral-900" />
                <Image
                  src={cat.image}
                  alt={cat.title}
                  fill
                  sizes="150px"
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                {/* Subtle overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              </div>

              {/* Label */}
              <span className="mt-4 text-sm font-medium text-white/80 group-hover:text-white transition-colors">
                {cat.title}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
