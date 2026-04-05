"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

/**
 * Hero search entry - three premium visual cards for Tires, Wheels, or Lifted.
 * Uses real automotive images for a premium ecommerce feel.
 */

interface HeroCardProps {
  imageSrc: string;
  imageAlt: string;
  title: string;
  subtitle: string;
  onClick: () => void;
  accent?: boolean;
  bgColor?: string;
}

function HeroCard({ imageSrc, imageAlt, title, subtitle, onClick, accent, bgColor = "bg-white" }: HeroCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl text-center transition-all duration-300 ease-out
        hover:scale-[1.04] hover:shadow-xl active:scale-[0.98]
        ${accent 
          ? "ring-2 ring-amber-300" 
          : "ring-1 ring-neutral-200"
        }`}
    >
      {/* Image Container - square aspect ratio */}
      <div className={`relative aspect-square w-full overflow-hidden ${bgColor}`}>
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          sizes="(max-width: 768px) 33vw, 200px"
          className="object-contain p-2 transition-transform duration-300 group-hover:scale-105"
          priority
        />
      </div>
      
      {/* Label section */}
      <div className={`py-3 px-2 ${accent ? "bg-amber-50" : "bg-white"}`}>
        <div className={`text-sm md:text-base font-bold ${accent ? "text-amber-900" : "text-neutral-900"}`}>
          {title}
        </div>
        <div className={`text-[11px] md:text-xs mt-0.5 hidden sm:block ${accent ? "text-amber-700" : "text-neutral-500"}`}>
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
          imageSrc="/images/hero/tire.webp"
          imageAlt="Premium tire"
          title="Tires"
          subtitle="Shop by vehicle"
          onClick={() => openSearch("tires")}
          bgColor="bg-neutral-100"
        />

        <HeroCard
          imageSrc="/images/hero/wheel.webp"
          imageAlt="Aftermarket wheel"
          title="Wheels"
          subtitle="Guaranteed fit"
          onClick={() => openSearch("wheels")}
          bgColor="bg-white"
        />

        <HeroCard
          imageSrc="/images/hero/lifted.jpg"
          imageAlt="Lifted truck"
          title="Lifted"
          subtitle="Trucks & SUVs"
          onClick={() => router.push("/lifted")}
          accent
          bgColor="bg-neutral-900"
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
