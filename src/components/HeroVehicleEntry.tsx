"use client";

import { useRouter } from "next/navigation";

/**
 * Hero search entry - three big buttons for Tires, Wheels, or Package.
 * Clicking opens the modal with vehicle selector pre-loaded.
 */
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

      {/* Three product buttons */}
      <div className="grid grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => openSearch("tires")}
          className="group relative overflow-hidden rounded-2xl bg-white p-5 md:p-6 text-center transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="text-4xl md:text-5xl mb-2">🛞</div>
          <div className="text-base md:text-lg font-extrabold text-neutral-900">Tires</div>
          <div className="text-xs md:text-sm text-neutral-500 mt-1 hidden sm:block">Shop by vehicle</div>
        </button>

        <button
          type="button"
          onClick={() => openSearch("wheels")}
          className="group relative overflow-hidden rounded-2xl bg-white p-5 md:p-6 text-center transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="text-4xl md:text-5xl mb-2">⚙️</div>
          <div className="text-base md:text-lg font-extrabold text-neutral-900">Wheels</div>
          <div className="text-xs md:text-sm text-neutral-500 mt-1 hidden sm:block">Guaranteed fit</div>
        </button>

        <button
          type="button"
          onClick={() => openSearch("packages")}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 p-5 md:p-6 text-center transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="text-4xl md:text-5xl mb-2">📦</div>
          <div className="text-base md:text-lg font-extrabold text-neutral-900">Package</div>
          <div className="text-xs md:text-sm text-amber-700 mt-1 hidden sm:block">Wheels + Tires</div>
        </button>
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
