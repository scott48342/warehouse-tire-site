"use client";

import Link from "next/link";
import Image from "next/image";

/**
 * Featured Wheel & Tire Packages
 * Premium package cards with real imagery
 */

const FEATURED_PACKAGES = [
  {
    id: "daily-20",
    title: "Daily Driver 20\"",
    description: "20\" wheels + 275/55R20 A/T tires",
    tireSize: "275/55R20",
    wheelSize: "20×9",
    image: "/images/homepage/package-daily.jpg",
    price: "$2,199",
    priceNote: "Set of 4 mounted",
    href: "/packages/daily-20",
    badge: null,
  },
  {
    id: "leveled-22",
    title: "Leveled Build 22\"",
    description: "22\" wheels + 285/45R22 tires",
    tireSize: "285/45R22",
    wheelSize: "22×10",
    image: "/images/homepage/package-leveled.jpg",
    price: "$2,899",
    priceNote: "Set of 4 mounted",
    href: "/packages/leveled-22",
    badge: "Popular",
  },
  {
    id: "lifted-33",
    title: "Lifted 33\" Package",
    description: "20\" wheels + 33×12.50R20 M/T tires",
    tireSize: "33×12.50R20",
    wheelSize: "20×12",
    image: "/images/homepage/package-lifted-33.jpg",
    price: "$3,499",
    priceNote: "Set of 4 mounted",
    href: "/packages/lifted-33",
    badge: null,
  },
  {
    id: "lifted-35",
    title: "Lifted 35\" Package",
    description: "22\" wheels + 35×12.50R22 M/T tires",
    tireSize: "35×12.50R22",
    wheelSize: "22×12",
    image: "/images/homepage/package-lifted-35.jpg",
    price: "$4,299",
    priceNote: "Set of 4 mounted",
    href: "/packages/lifted-35",
    badge: "Best Seller",
  },
];

interface PackageCardProps {
  id: string;
  title: string;
  description: string;
  tireSize: string;
  wheelSize: string;
  image: string;
  price: string;
  priceNote: string;
  href: string;
  badge: string | null;
}

function PackageCard({
  title,
  description,
  tireSize,
  wheelSize,
  image,
  price,
  priceNote,
  href,
  badge,
}: PackageCardProps) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl bg-neutral-900/80 backdrop-blur-sm border border-white/5 hover:border-white/10 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-neutral-800 to-neutral-900">
        <Image
          src={image}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-110"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        
        {/* Badge */}
        {badge && (
          <div className="absolute top-3 right-3 z-10">
            <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white uppercase">
              {badge}
            </span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Title & Description */}
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="mt-1 text-sm text-white/50">{description}</p>

        {/* Specs */}
        <div className="mt-3 flex gap-3">
          <span className="rounded-lg bg-white/5 px-2.5 py-1 text-xs font-medium text-white/70">
            {wheelSize}
          </span>
          <span className="rounded-lg bg-white/5 px-2.5 py-1 text-xs font-medium text-white/70">
            {tireSize}
          </span>
        </div>

        {/* Price & CTA */}
        <div className="mt-4 flex items-end justify-between">
          <div>
            <div className="text-2xl font-black text-white">{price}</div>
            <div className="text-xs text-white/40">{priceNote}</div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-xl bg-red-600 hover:bg-red-500 px-4 py-2 text-sm font-bold text-white transition-colors">
            View
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

export function FeaturedPackages() {
  return (
    <section className="relative bg-neutral-950 py-16 md:py-20">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-black" />

      <div className="relative z-10 mx-auto max-w-6xl px-4">
        {/* Section Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
              Featured Wheel & Tire Packages
            </h2>
            <p className="mt-2 text-white/60">
              Complete builds, mounted and balanced, ready to install.
            </p>
          </div>
          <Link
            href="/packages"
            className="hidden md:inline-flex items-center gap-1 text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors"
          >
            View All Packages
            <span>→</span>
          </Link>
        </div>

        {/* Package Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURED_PACKAGES.map((pkg) => (
            <PackageCard key={pkg.id} {...pkg} />
          ))}
        </div>

        {/* Mobile view all link */}
        <div className="mt-8 text-center md:hidden">
          <Link
            href="/packages"
            className="inline-flex items-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-3 text-sm font-bold text-white transition-colors"
          >
            View All Packages
            <span>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
