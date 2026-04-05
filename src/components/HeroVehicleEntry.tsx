"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

/**
 * Hero search entry - three premium visual cards for Tires, Wheels, or Lifted.
 * Clicking opens the search modal or navigates to category.
 */

interface HeroCardProps {
  imageSrc: string;
  imageAlt: string;
  title: string;
  subtitle: string;
  onClick: () => void;
  accent?: boolean;
}

function HeroCard({ imageSrc, imageAlt, title, subtitle, onClick, accent }: HeroCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl text-center transition-all duration-300 ease-out
        hover:scale-[1.03] hover:shadow-xl active:scale-[0.98]
        ${accent 
          ? "bg-gradient-to-br from-amber-50 to-orange-50 ring-2 ring-amber-200/50" 
          : "bg-white"
        }`}
    >
      {/* Image Container - 1:1 aspect ratio */}
      <div className="relative aspect-square w-full overflow-hidden">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          sizes="(max-width: 768px) 33vw, 200px"
          className="object-cover transition-all duration-300 group-hover:scale-105 group-hover:brightness-110"
          priority
        />
        {/* Subtle gradient overlay for text contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      
      {/* Label section */}
      <div className={`p-3 md:p-4 ${accent ? "bg-gradient-to-br from-amber-50/80 to-orange-50/80" : "bg-white"}`}>
        <div className={`text-sm md:text-base font-bold ${accent ? "text-amber-900" : "text-neutral-900"}`}>
          {title}
        </div>
        <div className={`text-xs mt-0.5 hidden sm:block ${accent ? "text-amber-700" : "text-neutral-500"}`}>
          {subtitle}
        </div>
      </div>
    </button>
  );
}

export function HeroVehicleEntry() {
  const router = useRouter();

  function openSearch(product: "tires" | "wheels" | "packages") {
    router.push(`/?open=${product}&mode=vehicle`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Search prompt */}
      <div className="text-center mb-4">
        <span className="text-sm text-neutral-400">What are you looking for?</span>
      </div>

      {/* Three product cards */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <HeroCard
          imageSrc="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop&q=80"
          imageAlt="Premium tire"
          title="Tires"
          subtitle="Shop by vehicle"
          onClick={() => openSearch("tires")}
        />

        <HeroCard
          imageSrc="https://images.unsplash.com/photo-1611821064430-0d40291d0f0b?w=400&h=400&fit=crop&q=80"
          imageAlt="Premium aftermarket wheel"
          title="Wheels"
          subtitle="Guaranteed fit"
          onClick={() => openSearch("wheels")}
        />

        <HeroCard
          imageSrc="https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=400&h=400&fit=crop&q=80"
          imageAlt="Lifted truck"
          title="Lifted"
          subtitle="Trucks & SUVs"
          onClick={() => router.push("/lifted")}
          accent
        />
      </div>

      {/* Or search by size link */}
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => router.push("/?open=tires&mode=size")}
          className="text-xs text-neutral-400 hover:text-white hover:underline transition-colors"
        >
          Or search by tire size →
        </button>
      </div>
    </div>
  );
}
