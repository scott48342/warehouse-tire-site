"use client";

import Link from "next/link";
import Image from "next/image";

/**
 * Premium Build Style Cards
 * 
 * Three cards with real truck photography:
 * - Stock Fit (green)
 * - Leveled (blue)  
 * - Lifted (orange/red) - featured
 */

const BUILD_STYLES = [
  {
    id: "stock",
    title: "Stock Fit",
    subtitle: "Factory Ride",
    description: "No modifications needed. Safe, OEM-friendly sizing.",
    image: "/images/homepage/truck-stock.jpg",
    buttonColor: "bg-green-600 hover:bg-green-500",
    buttonGlow: "hover:shadow-green-500/30",
    href: "/wheels?buildType=stock",
    featured: false,
  },
  {
    id: "level",
    title: "Leveled",
    subtitle: "Leveling Kit Build",
    description: "Better stance. Mild upgrades for trucks & SUVs.",
    image: "/images/homepage/truck-leveled.jpg",
    buttonColor: "bg-blue-600 hover:bg-blue-500",
    buttonGlow: "hover:shadow-blue-500/30",
    href: "/wheels?buildType=level",
    featured: false,
  },
  {
    id: "lifted",
    title: "Lifted Builds",
    subtitle: "Maximum Presence",
    description: "Big wheels. Wide stance. Full custom builds.",
    image: "/images/homepage/truck-lifted.jpg",
    buttonColor: "bg-orange-600 hover:bg-orange-500",
    buttonGlow: "hover:shadow-orange-500/30",
    href: "/lifted",
    featured: true,
  },
];

interface BuildCardProps {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  buttonColor: string;
  buttonGlow: string;
  href: string;
  featured: boolean;
}

function BuildCard({
  id,
  title,
  subtitle,
  description,
  image,
  buttonColor,
  buttonGlow,
  href,
  featured,
}: BuildCardProps) {
  return (
    <Link
      href={href}
      className={`
        group relative overflow-hidden rounded-2xl transition-all duration-300
        hover:scale-[1.02] hover:shadow-2xl
        ${featured ? "md:scale-105 ring-2 ring-orange-500/50" : ""}
      `}
    >
      {/* Image Container */}
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {/* Gradient background (shows if image fails to load) */}
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-900" />
        
        {/* Real truck image - falls back to gradient if missing */}
        <Image
          src={image}
          alt={`${title} truck build`}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-110"
          onError={(e) => {
            // Hide broken image, show gradient background instead
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

        {/* Featured badge */}
        {featured && (
          <div className="absolute top-4 right-4 z-10">
            <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-bold text-white uppercase tracking-wide shadow-lg">
              Popular
            </span>
          </div>
        )}
      </div>

      {/* Content - overlaid at bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
        <div className="text-2xl md:text-3xl font-black text-white tracking-tight">
          {title}
        </div>
        <div className="mt-1 text-sm font-medium text-white/70">
          {subtitle}
        </div>

        {/* CTA Button */}
        <button
          className={`
            mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 
            text-sm font-bold text-white transition-all duration-300
            hover:shadow-lg ${buttonColor} ${buttonGlow}
          `}
        >
          <span>Shop {title.split(" ")[0]}</span>
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </button>
      </div>

      {/* Subtle border glow on hover */}
      <div className={`
        absolute inset-0 rounded-2xl border-2 transition-all duration-300
        ${featured 
          ? "border-orange-500/30 group-hover:border-orange-500/60" 
          : "border-white/5 group-hover:border-white/20"
        }
      `} />
    </Link>
  );
}

export function BuildStyleCards() {
  return (
    <section className="relative bg-neutral-950 py-16 md:py-20">
      {/* Subtle background texture */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-black" />
      
      <div className="relative z-10 mx-auto max-w-6xl px-4">
        {/* Section Header */}
        <div className="text-center mb-10 md:mb-12">
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            Find Wheels That Actually Fit
          </h2>
          <p className="mt-3 text-lg text-white/60 max-w-2xl mx-auto">
            We don't just show wheels — we show what actually works for your build.
          </p>
        </div>

        {/* Build Cards Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {BUILD_STYLES.map((style) => (
            <BuildCard key={style.id} {...style} />
          ))}
        </div>

        {/* Bottom trust line */}
        <div className="mt-10 text-center">
          <p className="text-sm text-white/40">
            ✓ Verified fitment for your specific vehicle &nbsp;•&nbsp; ✓ Expert guidance included
          </p>
        </div>
      </div>
    </section>
  );
}
