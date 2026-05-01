"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

/**
 * Local Quick Search - Simple tire size search
 * 
 * For customers who already know their tire size.
 * No vehicle selection needed — just type and go.
 */

export function LocalQuickSearch() {
  const router = useRouter();
  const [size, setSize] = useState("");
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!size.trim()) return;
    
    // Clean up the size input (remove spaces, normalize slashes)
    const cleanSize = size.trim().toUpperCase().replace(/\s+/g, '');
    router.push(`/tires/search?size=${encodeURIComponent(cleanSize)}`);
  };

  // Popular sizes for quick selection
  const POPULAR_SIZES = [
    "225/60R16",
    "235/65R17",
    "265/70R17",
    "275/55R20",
  ];

  return (
    <section className="relative py-8">
      <div className="relative z-10 mx-auto max-w-3xl px-4">
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/10">
          <h3 className="text-center text-lg font-semibold text-white mb-2">
            Know Your Tire Size?
          </h3>
          <p className="text-center text-sm text-white/60 mb-4">
            Find it on your tire sidewall or driver's door sticker
          </p>
          
          <form onSubmit={handleSubmit} className="flex gap-3 max-w-md mx-auto">
            <input
              type="text"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="e.g. 225/60R16"
              className="flex-1 rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-red-500/50"
            />
            <button
              type="submit"
              className="rounded-lg bg-red-700 hover:bg-red-600 px-6 py-3 font-bold text-white transition-all"
            >
              <Search className="w-5 h-5" />
            </button>
          </form>
          
          {/* Popular sizes quick links */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-white/40">Popular:</span>
            {POPULAR_SIZES.map((s) => (
              <button
                key={s}
                onClick={() => router.push(`/tires/search?size=${s}`)}
                className="text-xs text-white/60 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
