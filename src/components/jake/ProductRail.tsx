"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT RAIL - Live scrolling product showcase for Jake chat
// 
// Phase 1: Static visual prototype with mock cards
// - Slow auto-scroll
// - Pause on hover
// - Click injects product name into chat input
// - Premium glass cards with cinematic fade
// ═══════════════════════════════════════════════════════════════════════════════

export interface RailProduct {
  id: string;
  type: "tire" | "wheel" | "package";
  brand: string;
  model: string;
  size: string;
  price?: string;
  priceSet?: string;
  imageUrl?: string;
  productUrl?: string;
  badge?: "best-value" | "popular" | "aggressive" | "quiet" | "all-terrain" | "performance";
  fitmentConfidence?: "exact" | "compatible" | "check";
  terrain?: string;
  finish?: string;
}

interface ProductRailProps {
  products: RailProduct[];
  side: "left" | "right";
  title?: string; // Custom title for the rail
  onProductClick: (product: RailProduct) => void;
  paused?: boolean;
}

// Mock data for Phase 1 (no images - use placeholders)
export const MOCK_TIRES: RailProduct[] = [
  {
    id: "tire-1",
    type: "tire",
    brand: "BFGoodrich",
    model: "KO2 All-Terrain",
    size: "275/70R18",
    price: "$289",
    priceSet: "$1,156",
    badge: "popular",
    terrain: "All-Terrain",
    fitmentConfidence: "exact",
  },
  {
    id: "tire-2",
    type: "tire",
    brand: "Nitto",
    model: "Ridge Grappler",
    size: "35x12.50R20",
    price: "$389",
    priceSet: "$1,556",
    badge: "aggressive",
    terrain: "Hybrid",
    fitmentConfidence: "exact",
  },
  {
    id: "tire-3",
    type: "tire",
    brand: "Toyo",
    model: "Open Country A/T III",
    size: "285/75R17",
    price: "$269",
    priceSet: "$1,076",
    badge: "best-value",
    terrain: "All-Terrain",
    fitmentConfidence: "compatible",
  },
  {
    id: "tire-4",
    type: "tire",
    brand: "Falken",
    model: "Wildpeak A/T3W",
    size: "265/70R17",
    price: "$185",
    priceSet: "$740",
    badge: "best-value",
    terrain: "All-Terrain",
    fitmentConfidence: "exact",
  },
  {
    id: "tire-5",
    type: "tire",
    brand: "Michelin",
    model: "Defender LTX M/S",
    size: "275/60R20",
    price: "$295",
    priceSet: "$1,180",
    badge: "quiet",
    terrain: "Highway",
    fitmentConfidence: "exact",
  },
];

export const MOCK_WHEELS: RailProduct[] = [
  {
    id: "wheel-1",
    type: "wheel",
    brand: "Fuel",
    model: "Rebel D679",
    size: "20x9",
    price: "$320",
    priceSet: "$1,280",
    badge: "popular",
    finish: "Matte Black",
    fitmentConfidence: "exact",
  },
  {
    id: "wheel-2",
    type: "wheel",
    brand: "Method",
    model: "MR305 NV",
    size: "17x8.5",
    price: "$285",
    priceSet: "$1,140",
    badge: "performance",
    finish: "Bronze",
    fitmentConfidence: "exact",
  },
  {
    id: "wheel-3",
    type: "wheel",
    brand: "Black Rhino",
    model: "Arsenal",
    size: "18x9",
    price: "$265",
    priceSet: "$1,060",
    badge: "aggressive",
    finish: "Matte Black",
    fitmentConfidence: "compatible",
  },
  {
    id: "wheel-4",
    type: "wheel",
    brand: "Rotiform",
    model: "LAS-R",
    size: "20x10",
    price: "$410",
    priceSet: "$1,640",
    badge: "performance",
    finish: "Gloss Black",
    fitmentConfidence: "exact",
  },
  {
    id: "wheel-5",
    type: "wheel",
    brand: "American Force",
    model: "Independence",
    size: "22x12",
    price: "$680",
    priceSet: "$2,720",
    badge: "aggressive",
    finish: "Polished",
    fitmentConfidence: "check",
  },
];

// Badge styling
const BADGE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  "best-value": { bg: "bg-green-500/20", text: "text-green-400", label: "Best Value" },
  "popular": { bg: "bg-blue-500/20", text: "text-blue-400", label: "Popular" },
  "aggressive": { bg: "bg-red-500/20", text: "text-red-400", label: "Aggressive" },
  "quiet": { bg: "bg-purple-500/20", text: "text-purple-400", label: "Quiet" },
  "all-terrain": { bg: "bg-amber-500/20", text: "text-amber-400", label: "All-Terrain" },
  "performance": { bg: "bg-cyan-500/20", text: "text-cyan-400", label: "Performance" },
};

const FITMENT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  "exact": { bg: "bg-green-500/20", text: "text-green-400", label: "✓ Exact Fit" },
  "compatible": { bg: "bg-amber-500/20", text: "text-amber-400", label: "Compatible" },
  "check": { bg: "bg-red-500/20", text: "text-red-400", label: "Check Fit" },
};

// Product Card Component
function ProductCard({ 
  product, 
  onClick 
}: { 
  product: RailProduct; 
  onClick: () => void;
}) {
  const badge = product.badge ? BADGE_STYLES[product.badge] : null;
  const fitment = product.fitmentConfidence ? FITMENT_STYLES[product.fitmentConfidence] : null;

  return (
    <button
      onClick={onClick}
      className="group relative w-full bg-white/[0.03] hover:bg-white/[0.08] backdrop-blur-xl border border-white/[0.08] hover:border-red-500/30 rounded-xl p-3 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-red-500/10 text-left"
    >
      {/* Glow effect on hover */}
      <div className="absolute -inset-px bg-gradient-to-br from-red-500/0 via-red-500/0 to-red-500/0 group-hover:from-red-500/10 group-hover:via-transparent group-hover:to-red-500/5 rounded-xl transition-all duration-500 pointer-events-none" />
      
      {/* Top edge highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-xl" />

      {/* Badge */}
      {badge && (
        <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${badge.bg} ${badge.text}`}>
          {badge.label}
        </div>
      )}

      {/* Product Image */}
      <div className="relative aspect-square mb-3 rounded-lg overflow-hidden bg-gradient-to-br from-neutral-800/50 to-neutral-900/50">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={`${product.brand} ${product.model}`}
            fill
            className="object-contain p-2 group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/20">
            {product.type === "tire" ? (
              <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                <circle cx="12" cy="12" r="4" fill="currentColor" />
              </svg>
            ) : (
              <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
            )}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="relative">
        <p className="text-white/50 text-[10px] uppercase tracking-wider mb-0.5">{product.brand}</p>
        <h4 className="text-white font-bold text-sm leading-tight mb-1 group-hover:text-red-400 transition-colors">
          {product.model}
        </h4>
        <p className="text-white/40 text-xs mb-2">
          {product.size}
          {product.finish && ` • ${product.finish}`}
          {product.terrain && ` • ${product.terrain}`}
        </p>

        {/* Price */}
        {product.price && (
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-white font-bold">{product.price}</span>
            <span className="text-white/40 text-xs">each</span>
            {product.priceSet && (
              <span className="text-white/60 text-xs">({product.priceSet} set)</span>
            )}
          </div>
        )}

        {/* Fitment Badge */}
        {fitment && (
          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${fitment.bg} ${fitment.text}`}>
            {fitment.label}
          </div>
        )}
      </div>

      {/* Click hint */}
      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="p-1.5 bg-red-600 rounded-full">
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
      </div>
    </button>
  );
}

// Main Rail Component
export function ProductRail({ products, side, title, onProductClick, paused = false }: ProductRailProps) {
  // Default title based on product type if not provided
  const railTitle = title || (products[0]?.type === "tire" ? "MATCHING TIRES" : "MATCHING WHEELS");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);

  // Auto-scroll effect
  useEffect(() => {
    if (paused || isHovered || !scrollRef.current) return;

    const scrollSpeed = 0.5; // pixels per frame
    let animationId: number;

    const animate = () => {
      if (!scrollRef.current) return;
      
      setScrollPosition((prev) => {
        const maxScroll = scrollRef.current!.scrollHeight - scrollRef.current!.clientHeight;
        const newPos = prev + scrollSpeed;
        
        // Loop back to top when reaching bottom
        if (newPos >= maxScroll) {
          return 0;
        }
        return newPos;
      });
      
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationId);
  }, [paused, isHovered]);

  // Apply scroll position
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollPosition;
    }
  }, [scrollPosition]);

  // Duplicate products for seamless looping
  const duplicatedProducts = [...products, ...products];

  return (
    <div 
      className={`hidden lg:flex flex-col w-[200px] flex-shrink-0 relative ${
        side === "left" ? "border-r" : "border-l"
      } border-white/5`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-3 border-b border-white/5">
        <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium">
          {railTitle}
        </p>
      </div>

      {/* Top fade mask */}
      <div className="absolute top-12 left-0 right-0 h-16 bg-gradient-to-b from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
      
      {/* Bottom fade mask */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0a0a0a] to-transparent z-10 pointer-events-none" />

      {/* Scrolling content */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-hidden px-2 py-4"
        style={{ scrollBehavior: isHovered ? 'smooth' : 'auto' }}
      >
        <div className="space-y-3">
          {duplicatedProducts.map((product, idx) => (
            <ProductCard
              key={`${product.id}-${idx}`}
              product={product}
              onClick={() => onProductClick(product)}
            />
          ))}
        </div>
      </div>

      {/* Pause indicator */}
      {isHovered && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-2 py-1 bg-black/80 backdrop-blur-sm rounded-full text-white/60 text-[10px] flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
          <span>Paused</span>
        </div>
      )}
    </div>
  );
}

// Mobile Carousel Version
export function ProductCarousel({ 
  products, 
  onProductClick 
}: { 
  products: RailProduct[]; 
  onProductClick: (product: RailProduct) => void;
}) {
  return (
    <div className="lg:hidden border-b border-white/5">
      <div className="px-3 py-2 flex items-center justify-between">
        <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium">
          {products[0]?.type === "tire" ? "Matching Tires" : "Matching Wheels"}
        </p>
        <button className="text-red-500 text-xs">View All →</button>
      </div>
      
      <div className="flex overflow-x-auto gap-3 px-3 pb-3 scrollbar-hide">
        {products.map((product) => (
          <div key={product.id} className="flex-shrink-0 w-[140px]">
            <ProductCard product={product} onClick={() => onProductClick(product)} />
          </div>
        ))}
      </div>
    </div>
  );
}
