"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useVehicleMemory, formatVehicleDisplay } from "@/contexts/VehicleMemoryContext";
import { useGarage, formatGarageVehicle } from "@/contexts/GarageContext";
import { JakeAvatar } from "@/components/jake";

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

function trackHomepageEvent(event: string, data?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  
  // gtag (Google Analytics 4)
  if (typeof (window as any).gtag === "function") {
    (window as any).gtag("event", event, data);
  }
  
  console.log(`[Homepage] Analytics: ${event}`, data);
}

// ═══════════════════════════════════════════════════════════════════════════════
// VEHICLE TYPE DETECTION (for imagery/messaging)
// ═══════════════════════════════════════════════════════════════════════════════

type VehicleCategory = "truck" | "suv" | "muscle" | "car" | "jeep";

function detectVehicleCategory(model: string): VehicleCategory {
  const modelLower = model.toLowerCase();
  
  // Trucks
  if (/f-?150|f-?250|f-?350|silverado|sierra|ram|tundra|titan|tacoma|colorado|canyon|ranger|gladiator|maverick|frontier|ridgeline/i.test(modelLower)) {
    return "truck";
  }
  
  // Jeeps
  if (/wrangler|gladiator|cherokee|4runner|bronco/i.test(modelLower)) {
    return "jeep";
  }
  
  // Muscle/Performance
  if (/mustang|camaro|challenger|charger|corvette|firebird|trans am|gt-?r|supra|370z|350z/i.test(modelLower)) {
    return "muscle";
  }
  
  // SUVs
  if (/tahoe|suburban|escalade|yukon|explorer|expedition|durango|grand cherokee|highlander|pilot|pathfinder|sequoia|armada|telluride|palisade|traverse|enclave|atlas/i.test(modelLower)) {
    return "suv";
  }
  
  return "car";
}

function getCategoryIcon(category: VehicleCategory): React.ReactNode {
  switch (category) {
    case "truck":
      return (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
        </svg>
      );
    case "jeep":
      return (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      );
    case "muscle":
      return (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case "suv":
      return (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      );
    default:
      return (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
          <circle cx="12" cy="12" r="4" strokeWidth={1.5} />
        </svg>
      );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function PersonalizedVehicleSection() {
  const { activeVehicle: garageVehicle, isLoaded: garageLoaded, clearActiveVehicle: garageClear, vehicleCount } = useGarage();
  const { activeVehicle, isLoaded, clearActiveVehicle } = useVehicleMemory();
  
  // Use garage vehicle if available, fall back to legacy vehicle memory
  const currentVehicle = garageVehicle || activeVehicle;
  const currentLoaded = garageLoaded && isLoaded;
  
  // Track when personalized homepage is shown
  useEffect(() => {
    if (currentLoaded && currentVehicle) {
      trackHomepageEvent("homepage_vehicle_detected", {
        year: currentVehicle.year,
        make: currentVehicle.make,
        model: currentVehicle.model,
        days_since_saved: 'addedAt' in currentVehicle 
          ? Math.floor((Date.now() - (currentVehicle as any).addedAt) / (1000 * 60 * 60 * 24))
          : Math.floor((Date.now() - (currentVehicle as any).savedAt) / (1000 * 60 * 60 * 24)),
      });
    }
  }, [currentLoaded, currentVehicle]);
  
  // Don't render if no vehicle or not loaded
  if (!currentLoaded || !currentVehicle) {
    return null;
  }
  
  const displayName = 'nickname' in currentVehicle && currentVehicle.nickname 
    ? currentVehicle.nickname 
    : formatVehicleDisplay(currentVehicle as any);
  const category = detectVehicleCategory(currentVehicle.model);
  const vehicleSlug = `${currentVehicle.year}-${currentVehicle.make}-${currentVehicle.model}`.toLowerCase().replace(/\s+/g, "-");
  
  // Build URLs
  const tiresUrl = `/tires/for/${vehicleSlug}`;
  const wheelsUrl = `/wheels/for/${vehicleSlug}`;
  const packagesUrl = `/packages/for/${vehicleSlug}`;
  const jakeUrl = `/jake`;
  
  const handleCTAClick = (ctaType: string) => {
    trackHomepageEvent(`personalized_cta_clicked`, {
      cta_type: ctaType,
      vehicle: displayName,
    });
  };

  return (
    <section className="bg-gradient-to-b from-[#0d0d0d] to-[#0a0a0a] border-b border-white/10">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6 lg:py-8">
        
        {/* Mobile Layout */}
        <div className="lg:hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-red-500 text-xs font-bold uppercase tracking-wider">
              Continue Shopping
            </p>
            <Link
              href="/garage"
              onClick={() => trackHomepageEvent("homepage_garage_clicked")}
              className="text-white/40 hover:text-white/60 text-xs transition-colors"
            >
              {vehicleCount > 1 ? `My Garage (${vehicleCount})` : "Change Vehicle"}
            </Link>
          </div>
          
          {/* Vehicle Card */}
          <div className="bg-gradient-to-r from-[#1a1a1a] to-[#151515] border border-white/10 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-600/20 rounded-lg flex items-center justify-center text-red-500">
                {getCategoryIcon(category)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-bold text-lg truncate">{displayName}</h3>
                <p className="text-white/50 text-sm">Your saved vehicle</p>
              </div>
            </div>
          </div>
          
          {/* CTAs - 2x2 Grid */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href={tiresUrl}
              onClick={() => handleCTAClick("tires")}
              className="flex flex-col items-center justify-center gap-2 p-4 bg-[#1a1a1a] hover:bg-[#222] border border-white/10 hover:border-red-500/30 rounded-xl transition-all group"
            >
              <div className="w-10 h-10 bg-white/5 group-hover:bg-red-600/20 rounded-lg flex items-center justify-center transition-colors">
                <svg className="w-5 h-5 text-white/60 group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
                  <circle cx="12" cy="12" r="4" strokeWidth={1.5} />
                </svg>
              </div>
              <span className="text-white font-semibold text-sm">Shop Tires</span>
            </Link>
            
            <Link
              href={wheelsUrl}
              onClick={() => handleCTAClick("wheels")}
              className="flex flex-col items-center justify-center gap-2 p-4 bg-[#1a1a1a] hover:bg-[#222] border border-white/10 hover:border-red-500/30 rounded-xl transition-all group"
            >
              <div className="w-10 h-10 bg-white/5 group-hover:bg-red-600/20 rounded-lg flex items-center justify-center transition-colors">
                <svg className="w-5 h-5 text-white/60 group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
                  <circle cx="12" cy="12" r="4" strokeWidth={1.5} />
                  <line x1="12" y1="3" x2="12" y2="8" strokeWidth={1.5} />
                  <line x1="12" y1="16" x2="12" y2="21" strokeWidth={1.5} />
                  <line x1="3" y1="12" x2="8" y2="12" strokeWidth={1.5} />
                  <line x1="16" y1="12" x2="21" y2="12" strokeWidth={1.5} />
                </svg>
              </div>
              <span className="text-white font-semibold text-sm">Shop Wheels</span>
            </Link>
            
            <Link
              href={packagesUrl}
              onClick={() => {
                handleCTAClick("package");
                trackHomepageEvent("homepage_package_clicked", { vehicle: displayName });
              }}
              className="flex flex-col items-center justify-center gap-2 p-4 bg-[#1a1a1a] hover:bg-[#222] border border-white/10 hover:border-red-500/30 rounded-xl transition-all group"
            >
              <div className="w-10 h-10 bg-white/5 group-hover:bg-red-600/20 rounded-lg flex items-center justify-center transition-colors">
                <svg className="w-5 h-5 text-white/60 group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={1.5} />
                  <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={1.5} />
                  <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={1.5} />
                  <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth={1.5} />
                </svg>
              </div>
              <span className="text-white font-semibold text-sm">Build Package</span>
            </Link>
            
            <Link
              href={jakeUrl}
              onClick={() => {
                handleCTAClick("jake");
                trackHomepageEvent("homepage_jake_clicked", { vehicle: displayName, source: "personalized_section" });
              }}
              className="flex flex-col items-center justify-center gap-2 p-4 bg-gradient-to-br from-red-600/20 to-red-900/10 hover:from-red-600/30 hover:to-red-900/20 border border-red-500/30 hover:border-red-500/50 rounded-xl transition-all group"
            >
              <JakeAvatar size="sm" />
              <span className="text-white font-semibold text-sm">Ask Jake</span>
            </Link>
          </div>
        </div>
        
        {/* Desktop Layout */}
        <div className="hidden lg:block">
          <div className="flex items-center gap-8">
            {/* Vehicle Card */}
            <div className="flex-shrink-0 bg-gradient-to-r from-[#1a1a1a] to-[#151515] border border-white/10 rounded-xl p-5 min-w-[280px]">
              <div className="flex items-start justify-between mb-3">
                <p className="text-red-500 text-xs font-bold uppercase tracking-wider">
                  Your Vehicle
                </p>
                <Link
                  href="/garage"
                  onClick={() => trackHomepageEvent("homepage_garage_clicked")}
                  className="text-white/40 hover:text-white/60 text-xs transition-colors"
                >
                  {vehicleCount > 1 ? `Garage (${vehicleCount})` : "Change"}
                </Link>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-red-600/20 rounded-xl flex items-center justify-center text-red-500">
                  {getCategoryIcon(category)}
                </div>
                <div>
                  <h3 className="text-white font-bold text-xl">{displayName}</h3>
                  <p className="text-white/50 text-sm">
                    {currentVehicle.trim && currentVehicle.trim !== "Base" ? currentVehicle.trim : "Ready to shop"}
                  </p>
                </div>
              </div>
            </div>
            
            {/* CTAs */}
            <div className="flex-1 flex items-center gap-4">
              <Link
                href={tiresUrl}
                onClick={() => handleCTAClick("tires")}
                className="flex-1 flex items-center gap-4 p-4 bg-[#1a1a1a] hover:bg-[#222] border border-white/10 hover:border-red-500/30 rounded-xl transition-all group"
              >
                <div className="w-12 h-12 bg-white/5 group-hover:bg-red-600/20 rounded-lg flex items-center justify-center transition-colors">
                  <svg className="w-6 h-6 text-white/60 group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
                    <circle cx="12" cy="12" r="4" strokeWidth={1.5} />
                  </svg>
                </div>
                <div>
                  <span className="block text-white font-semibold">Shop Tires</span>
                  <span className="block text-white/50 text-sm">Find your size</span>
                </div>
                <svg className="w-5 h-5 text-white/30 group-hover:text-red-400 ml-auto transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              
              <Link
                href={wheelsUrl}
                onClick={() => handleCTAClick("wheels")}
                className="flex-1 flex items-center gap-4 p-4 bg-[#1a1a1a] hover:bg-[#222] border border-white/10 hover:border-red-500/30 rounded-xl transition-all group"
              >
                <div className="w-12 h-12 bg-white/5 group-hover:bg-red-600/20 rounded-lg flex items-center justify-center transition-colors">
                  <svg className="w-6 h-6 text-white/60 group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
                    <circle cx="12" cy="12" r="4" strokeWidth={1.5} />
                    <line x1="12" y1="3" x2="12" y2="8" strokeWidth={1.5} />
                    <line x1="12" y1="16" x2="12" y2="21" strokeWidth={1.5} />
                    <line x1="3" y1="12" x2="8" y2="12" strokeWidth={1.5} />
                    <line x1="16" y1="12" x2="21" y2="12" strokeWidth={1.5} />
                  </svg>
                </div>
                <div>
                  <span className="block text-white font-semibold">Shop Wheels</span>
                  <span className="block text-white/50 text-sm">Verified fitment</span>
                </div>
                <svg className="w-5 h-5 text-white/30 group-hover:text-red-400 ml-auto transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              
              <Link
                href={packagesUrl}
                onClick={() => {
                  handleCTAClick("package");
                  trackHomepageEvent("homepage_package_clicked", { vehicle: displayName });
                }}
                className="flex-1 flex items-center gap-4 p-4 bg-[#1a1a1a] hover:bg-[#222] border border-white/10 hover:border-red-500/30 rounded-xl transition-all group"
              >
                <div className="w-12 h-12 bg-white/5 group-hover:bg-red-600/20 rounded-lg flex items-center justify-center transition-colors">
                  <svg className="w-6 h-6 text-white/60 group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={1.5} />
                    <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={1.5} />
                    <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={1.5} />
                    <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth={1.5} />
                  </svg>
                </div>
                <div>
                  <span className="block text-white font-semibold">Build Package</span>
                  <span className="block text-white/50 text-sm">Wheels + Tires</span>
                </div>
                <svg className="w-5 h-5 text-white/30 group-hover:text-red-400 ml-auto transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              
              <Link
                href={jakeUrl}
                onClick={() => {
                  handleCTAClick("jake");
                  trackHomepageEvent("homepage_jake_clicked", { vehicle: displayName, source: "personalized_section" });
                }}
                className="flex items-center gap-4 p-4 bg-gradient-to-r from-red-600/20 to-red-900/10 hover:from-red-600/30 hover:to-red-900/20 border border-red-500/30 hover:border-red-500/50 rounded-xl transition-all group min-w-[180px]"
              >
                <JakeAvatar size="md" />
                <div>
                  <span className="block text-white font-semibold">Ask Jake</span>
                  <span className="block text-white/50 text-sm">Get help</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECOMMENDED PRODUCTS PLACEHOLDER (Future Architecture)
// ═══════════════════════════════════════════════════════════════════════════════

export function RecommendedForVehicle() {
  const { activeVehicle, isLoaded } = useVehicleMemory();
  
  // Don't render if no vehicle
  if (!isLoaded || !activeVehicle) {
    return null;
  }
  
  const displayName = formatVehicleDisplay(activeVehicle);
  
  // TODO: Fetch actual recommendations from API
  // For now, this is just the architecture placeholder
  
  return (
    <section className="bg-[#0a0a0a] py-10">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-white font-bold text-xl">
              Recommended for Your {activeVehicle.model}
            </h2>
            <p className="text-white/50 text-sm mt-1">
              Popular products for {displayName}
            </p>
          </div>
          <Link 
            href={`/tires/for/${activeVehicle.year}-${activeVehicle.make}-${activeVehicle.model}`.toLowerCase().replace(/\s+/g, "-")}
            className="text-red-500 hover:text-red-400 text-sm font-semibold transition-colors"
          >
            View All →
          </Link>
        </div>
        
        {/* Placeholder Grid - Will be populated with real product cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div 
              key={i} 
              className="bg-[#1a1a1a] border border-white/10 rounded-lg p-4 animate-pulse"
            >
              <div className="aspect-square bg-white/5 rounded-lg mb-3" />
              <div className="h-4 bg-white/5 rounded mb-2" />
              <div className="h-3 bg-white/5 rounded w-2/3" />
            </div>
          ))}
        </div>
        
        <p className="text-center text-white/30 text-sm mt-6">
          Coming soon: Personalized recommendations based on your vehicle
        </p>
      </div>
    </section>
  );
}

export default PersonalizedVehicleSection;
