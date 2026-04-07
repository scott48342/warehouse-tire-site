"use client";

import Link from "next/link";
import Image from "next/image";

/**
 * Premium Build Style Cards - EXACT MATCH TO TEMPLATE
 * 
 * Three cards with real truck photography:
 * - Factory Build (green CTA)
 * - Leveling Kit Build (blue CTA)
 * - Lifted Truck Build (orange CTA) - featured with POPULAR badge
 */

const BUILD_STYLES = [
  {
    id: "stock",
    title: "Factory Build",
    subtitle: "No modifications at all",
    image: "/images/homepage/truck-stock.jpg",
    buttonText: "Shop Factory Fit",
    buttonColor: "bg-green-700 hover:bg-green-600",
    href: "/wheels?buildType=stock",
    featured: false,
  },
  {
    id: "level",
    title: "Leveling Kit Build",
    subtitle: "Better stance, mild upgrades",
    image: "/images/homepage/truck-leveled.jpg",
    buttonText: "Shop Leveled",
    buttonColor: "bg-blue-700 hover:bg-blue-600",
    href: "/wheels?buildType=level",
    featured: false,
  },
  {
    id: "lifted",
    title: "Lifted Truck Build",
    subtitle: "Big wheels, wide stance",
    image: "/images/homepage/truck-lifted.jpg",
    buttonText: "Shop Lifted",
    buttonColor: "bg-orange-600 hover:bg-orange-500",
    href: "/lifted",
    featured: true,
  },
];

interface BuildCardProps {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  buttonText: string;
  buttonColor: string;
  href: string;
  featured: boolean;
}

function BuildCard({
  title,
  subtitle,
  image,
  buttonText,
  buttonColor,
  href,
  featured,
}: BuildCardProps) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-black/50"
    >
      {/* Card container with glassmorphism */}
      <div className="bg-[rgba(20,20,20,0.85)] backdrop-blur-md rounded-2xl overflow-hidden border border-white/10">
        {/* Image Container */}
        <div className="relative aspect-[4/3] w-full overflow-hidden">
          {/* Gradient background fallback */}
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-700 to-neutral-900" />
          
          {/* Real truck image */}
          <Image
            src={image}
            alt={`${title}`}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />

          {/* Featured badge - inside image area */}
          {featured && (
            <div className="absolute top-3 right-3 z-10">
              <span className="rounded bg-orange-600 px-3 py-1 text-xs font-bold text-white uppercase tracking-wide shadow-lg">
                Popular
              </span>
            </div>
          )}
        </div>

        {/* Content - below image */}
        <div className="p-5">
          <h3 className="text-xl font-bold text-white">
            {title}
          </h3>
          <p className="mt-1 text-sm text-white/60">
            {subtitle}
          </p>

          {/* CTA Button */}
          <button
            className={`
              mt-4 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 
              text-sm font-bold text-white transition-all duration-300
              ${buttonColor}
            `}
          >
            <span>{buttonText}</span>
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </button>
        </div>
      </div>
    </Link>
  );
}

export function BuildStyleCards() {
  return (
    <section className="relative py-8">
      <div className="relative z-10 mx-auto max-w-6xl px-4">
        {/* Build Cards Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {BUILD_STYLES.map((style) => (
            <BuildCard key={style.id} {...style} />
          ))}
        </div>
      </div>
    </section>
  );
}
