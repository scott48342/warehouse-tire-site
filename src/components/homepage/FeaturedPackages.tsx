"use client";

import Link from "next/link";
import Image from "next/image";

/**
 * Featured Packages - MATCHES TEMPLATE
 * 3 package cards with truck images
 */

const FEATURED_PACKAGES = [
  {
    id: "daily-33",
    title: '33" Daily Driver',
    titleAccent: "Package",
    specs: "285/70R17 BFGoodrich All-Terrain T/A KO2",
    image: "/images/homepage/package-daily.png",
    buttonText: "Shop Package",
    buttonColor: "bg-green-700 hover:bg-green-600",
    href: "/packages/daily-33",
    badge: null,
  },
  {
    id: "lifted-35",
    title: '35" Lifted Truck',
    titleAccent: "Package",
    specs: "315/70R17 BFGoodrich All-Terrain T/A KO2",
    image: "/images/homepage/package-lifted-35.png",
    buttonText: "Add to Package",
    buttonColor: "bg-orange-600 hover:bg-orange-500",
    href: "/packages/lifted-35",
    badge: "Popular",
  },
  {
    id: "street-22",
    title: 'Street Performance 22"',
    titleAccent: "Package",
    specs: "305/40R22 Lionhart LH-Five",
    image: "/images/homepage/package-street.png",
    buttonText: "Add to Package",
    buttonColor: "bg-red-700 hover:bg-red-600",
    href: "/packages/street-22",
    badge: null,
  },
];

interface PackageCardProps {
  id: string;
  title: string;
  titleAccent: string;
  specs: string;
  image: string;
  buttonText: string;
  buttonColor: string;
  href: string;
  badge: string | null;
}

function PackageCard({
  title,
  titleAccent,
  specs,
  image,
  buttonText,
  buttonColor,
  href,
  badge,
}: PackageCardProps) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-black/50"
    >
      <div className="bg-[rgba(20,20,20,0.85)] backdrop-blur-md rounded-2xl overflow-hidden border border-white/10">
        {/* Image */}
        <div className="relative aspect-[4/3] w-full overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-700 to-neutral-900" />
          <Image
            src={image}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          
          {/* Badge */}
          {badge && (
            <div className="absolute top-3 left-3 z-10">
              <span className="rounded bg-orange-600 px-3 py-1 text-xs font-bold text-white uppercase">
                {badge}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          <h3 className="text-lg font-bold text-white">
            {title} <span className="font-normal text-white/70">{titleAccent}</span>
          </h3>
          <p className="mt-1 text-sm text-white/50">{specs}</p>

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

export function FeaturedPackages() {
  return (
    <section className="relative py-12">
      <div className="relative z-10 mx-auto max-w-6xl px-4">
        {/* Section Header */}
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            Featured Wheel & Tire Packages
          </h2>
        </div>

        {/* Package Grid - 3 columns */}
        <div className="grid gap-6 md:grid-cols-3">
          {FEATURED_PACKAGES.map((pkg) => (
            <PackageCard key={pkg.id} {...pkg} />
          ))}
        </div>
      </div>
    </section>
  );
}
