"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { SteppedVehicleSelector, VehicleSelection } from "@/components/SteppedVehicleSelector";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface GalleryItem {
  id: number;
  thumbnailUrl: string;
  fullImageUrl: string;
  wheelBrand: string;
  wheelModel: string;
  wheelSku: string | null;
  vehicleYear: number | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleTrim: string | null;
  vehicleType: string | null;
  liftLevel: string | null;
  buildStyle: string | null;
  isCustomerBuild: boolean;
  isFeatured: boolean;
  customerName: string | null;
  instagramHandle: string | null;
  albumName: string;
}

interface FilterOption {
  value: string;
  count: number;
}

interface Filters {
  makes: FilterOption[];
  wheelBrands: FilterOption[];
  vehicleTypes: FilterOption[];
  buildTypes: FilterOption[];
  totals: { all: number; customerBuilds: number };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// YMM CONTEXT MODAL (with proper stepped selector)
// ═══════════════════════════════════════════════════════════════════════════

interface YmmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (year: string, make: string, model: string, trim?: string) => void;
  wheelBrand: string;
  wheelModel: string;
}

function YmmModal({ isOpen, onClose, onSubmit, wheelBrand, wheelModel }: YmmModalProps) {
  if (!isOpen) return null;

  const handleComplete = (selection: VehicleSelection) => {
    onSubmit(selection.year, selection.make, selection.model, selection.trim);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-neutral-900">
              What&apos;s your vehicle?
            </h3>
            <p className="text-sm text-neutral-600">
              Select your vehicle to shop {wheelBrand} {wheelModel}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-neutral-100 text-neutral-500"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <SteppedVehicleSelector onComplete={handleComplete} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GALLERY CARD
// ═══════════════════════════════════════════════════════════════════════════

interface GalleryCardProps {
  item: GalleryItem;
  onViewWheel: (item: GalleryItem) => Promise<void>;
  onShopStyle: (item: GalleryItem) => void;
  onBuildLikeThis: (item: GalleryItem) => void;
}

function GalleryCard({ item, onViewWheel, onShopStyle, onBuildLikeThis }: GalleryCardProps) {
  const [imageError, setImageError] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isLoadingWheel, setIsLoadingWheel] = useState(false);
  const [isLoadingBuild, setIsLoadingBuild] = useState(false);
  
  const handleViewWheelClick = async () => {
    setIsLoadingWheel(true);
    try {
      await onViewWheel(item);
    } finally {
      setIsLoadingWheel(false);
    }
  };

  const handleBuildClick = async () => {
    setIsLoadingBuild(true);
    try {
      onBuildLikeThis(item);
    } finally {
      // Keep loading until modal opens or navigation happens
      setTimeout(() => setIsLoadingBuild(false), 500);
    }
  };

  // Vehicle label for display
  const vehicleLabel = [
    item.vehicleYear,
    item.vehicleMake,
    item.vehicleModel,
  ].filter(Boolean).join(" ");

  // Build metadata line: "2025 Ford F-150 • 20x10 • Lifted"
  const metadataParts: string[] = [];
  if (item.vehicleYear && item.vehicleMake && item.vehicleModel) {
    metadataParts.push(`${item.vehicleYear} ${item.vehicleMake} ${item.vehicleModel}`);
  } else if (item.vehicleType) {
    metadataParts.push(item.vehicleType);
  }
  
  // Build type badge text
  const buildTypeLabel = item.liftLevel && item.liftLevel !== "stock" 
    ? item.liftLevel.includes("level") ? "Leveled" : `${item.liftLevel}" Lifted`
    : item.buildStyle && item.buildStyle !== "stock" 
      ? item.buildStyle.charAt(0).toUpperCase() + item.buildStyle.slice(1)
      : null;

  if (imageError) return null;

  return (
    <div 
      className="group relative rounded-2xl overflow-hidden border border-neutral-200 bg-white hover:shadow-xl hover:border-neutral-300 transition-all duration-300"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-neutral-100">
        <Image
          src={item.thumbnailUrl}
          alt={`${item.wheelBrand} ${item.wheelModel} on ${vehicleLabel}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover group-hover:scale-[1.03] transition-transform duration-500"
          onError={() => setImageError(true)}
        />
        
        {/* Top Badges */}
        <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
          <div className="flex gap-1.5 flex-wrap">
            {item.isCustomerBuild && (
              <span className="bg-green-600/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                📸 Customer
              </span>
            )}
            {item.isFeatured && !item.isCustomerBuild && (
              <span className="bg-amber-500/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                ⭐ Featured
              </span>
            )}
            {buildTypeLabel && (
              <span className="bg-neutral-900/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                {buildTypeLabel}
              </span>
            )}
          </div>
        </div>

        {/* Hover Actions Overlay - Desktop */}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-4 transition-opacity duration-200 ${showActions ? "opacity-100" : "opacity-0 pointer-events-none"} hidden sm:flex`}>
          {/* PRIMARY CTA - Build This Setup */}
          {item.vehicleMake && (
            <button
              onClick={handleBuildClick}
              disabled={isLoadingBuild}
              className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white hover:bg-amber-400 transition-all shadow-lg hover:shadow-xl disabled:opacity-70 mb-2"
            >
              {isLoadingBuild ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Checking...
                </span>
              ) : (
                "Build This Setup →"
              )}
            </button>
          )}
          
          {/* Secondary Actions - Smaller, less prominent */}
          <div className="flex gap-2">
            <button
              onClick={handleViewWheelClick}
              disabled={isLoadingWheel}
              className="flex-1 rounded-lg bg-white/15 backdrop-blur-sm border border-white/20 px-3 py-2 text-xs font-semibold text-white hover:bg-white/25 transition-colors disabled:opacity-70"
            >
              {isLoadingWheel ? "..." : "View Wheel"}
            </button>
            <button
              onClick={() => onShopStyle(item)}
              className="flex-1 rounded-lg bg-white/15 backdrop-blur-sm border border-white/20 px-3 py-2 text-xs font-semibold text-white hover:bg-white/25 transition-colors"
            >
              Shop {item.wheelBrand}
            </button>
          </div>
        </div>

        {/* Mobile Actions - Always visible at bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 sm:hidden">
          {item.vehicleMake && (
            <button
              onClick={handleBuildClick}
              disabled={isLoadingBuild}
              className="w-full rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-white active:bg-amber-600 disabled:opacity-70"
            >
              {isLoadingBuild ? "Checking..." : "Build This Setup →"}
            </button>
          )}
        </div>
      </div>

      {/* Details Section */}
      <div className="p-3">
        {/* Wheel Name */}
        <div className="text-sm font-bold text-neutral-900 truncate">
          {item.wheelBrand} {item.wheelModel}
        </div>
        
        {/* Build Metadata Line */}
        <div className="text-xs text-neutral-500 truncate mt-1">
          {metadataParts.length > 0 ? metadataParts.join(" • ") : "Custom Build"}
        </div>
        
        {/* Instagram handle or secondary actions on mobile */}
        <div className="flex items-center justify-between mt-2">
          {item.instagramHandle ? (
            <div className="text-[10px] text-neutral-400 truncate">
              📷 @{item.instagramHandle.replace("@", "")}
            </div>
          ) : (
            <div />
          )}
          
          {/* Mobile secondary actions */}
          <div className="flex gap-1.5 sm:hidden">
            <button
              onClick={handleViewWheelClick}
              disabled={isLoadingWheel}
              className="text-[10px] font-semibold text-neutral-500 hover:text-neutral-700 disabled:opacity-50"
            >
              View
            </button>
            <span className="text-neutral-300">|</span>
            <button
              onClick={() => onShopStyle(item)}
              className="text-[10px] font-semibold text-neutral-500 hover:text-neutral-700"
            >
              Shop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FILTER SIDEBAR
// ═══════════════════════════════════════════════════════════════════════════

interface FilterSidebarProps {
  filters: Filters | null;
  activeFilters: {
    make: string;
    wheelBrand: string;
    vehicleType: string;
    buildType: string;
    customerOnly: boolean;
  };
  onFilterChange: (key: string, value: string | boolean) => void;
  onClearFilters: () => void;
}

function FilterSidebar({ filters, activeFilters, onFilterChange, onClearFilters }: FilterSidebarProps) {
  const hasActiveFilters = activeFilters.make || activeFilters.wheelBrand || 
    activeFilters.vehicleType || activeFilters.buildType || activeFilters.customerOnly;

  // Build active filter chips
  const activeChips: { key: string; label: string; value: string | boolean }[] = [];
  if (activeFilters.customerOnly) activeChips.push({ key: "customerOnly", label: "Customer Builds", value: true });
  if (activeFilters.vehicleType) activeChips.push({ key: "vehicleType", label: activeFilters.vehicleType, value: activeFilters.vehicleType });
  if (activeFilters.buildType) activeChips.push({ key: "buildType", label: activeFilters.buildType, value: activeFilters.buildType });
  if (activeFilters.make) activeChips.push({ key: "make", label: activeFilters.make, value: activeFilters.make });
  if (activeFilters.wheelBrand) activeChips.push({ key: "wheelBrand", label: activeFilters.wheelBrand, value: activeFilters.wheelBrand });

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-neutral-900">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="text-[11px] font-medium text-red-500 hover:text-red-600 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Active Filter Chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3 pb-3 border-b border-neutral-100">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              onClick={() => onFilterChange(chip.key, chip.key === "customerOnly" ? false : "")}
              className="inline-flex items-center gap-1 bg-neutral-900 text-white text-[10px] font-semibold px-2 py-1 rounded-full hover:bg-neutral-700 transition-colors"
            >
              <span className="capitalize">{chip.label}</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ))}
        </div>
      )}

      {/* Customer Builds Toggle */}
      <div className="mb-3 pb-3 border-b border-neutral-100">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={activeFilters.customerOnly}
            onChange={(e) => onFilterChange("customerOnly", e.target.checked)}
            className="rounded border-neutral-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm text-neutral-700 group-hover:text-neutral-900 transition-colors">
            Customer builds only
            {filters && filters.totals.customerBuilds > 0 && (
              <span className="text-neutral-400 ml-1 text-xs">
                ({filters.totals.customerBuilds})
              </span>
            )}
          </span>
        </label>
      </div>

      {/* Vehicle Type */}
      {filters && filters.vehicleTypes.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
            Vehicle Type
          </div>
          <div className="flex flex-wrap gap-1">
            {filters.vehicleTypes.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onFilterChange("vehicleType", activeFilters.vehicleType === opt.value ? "" : opt.value)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium capitalize transition-all ${
                  activeFilters.vehicleType === opt.value
                    ? "bg-neutral-900 text-white shadow-sm"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {opt.value}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Build Type */}
      {filters && filters.buildTypes.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
            Build Style
          </div>
          <div className="flex flex-wrap gap-1">
            {filters.buildTypes.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onFilterChange("buildType", activeFilters.buildType === opt.value ? "" : opt.value)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium capitalize transition-all ${
                  activeFilters.buildType === opt.value
                    ? "bg-amber-500 text-white shadow-sm"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {opt.value}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Vehicle Make */}
      {filters && filters.makes.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
            Vehicle Make
          </div>
          <select
            value={activeFilters.make}
            onChange={(e) => onFilterChange("make", e.target.value)}
            className="w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
          >
            <option value="">All Makes</option>
            {filters.makes.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.value} ({opt.count})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Wheel Brand */}
      {filters && filters.wheelBrands.length > 0 && (
        <div>
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
            Wheel Brand
          </div>
          <select
            value={activeFilters.wheelBrand}
            onChange={(e) => onFilterChange("wheelBrand", e.target.value)}
            className="w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
          >
            <option value="">All Brands</option>
            {filters.wheelBrands.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.value} ({opt.count})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN GALLERY PAGE (Inner Component)
// ═══════════════════════════════════════════════════════════════════════════

function GalleryPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  
  // YMM modal state
  const [ymmModalOpen, setYmmModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ item: GalleryItem; action: "view" | "style" | "build" } | null>(null);
  
  // Active filters from URL
  const activeFilters = {
    make: searchParams.get("make") || "",
    wheelBrand: searchParams.get("wheelBrand") || "",
    vehicleType: searchParams.get("vehicleType") || "",
    buildType: searchParams.get("buildType") || "",
    customerOnly: searchParams.get("customerOnly") === "true",
  };
  
  const page = parseInt(searchParams.get("page") || "1");

  // Check for existing YMM context (from localStorage or URL)
  const getYmmContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    
    // Check URL first
    const urlYear = searchParams.get("year");
    const urlMake = searchParams.get("ymm_make");
    const urlModel = searchParams.get("ymm_model");
    if (urlYear && urlMake && urlModel) {
      return { year: urlYear, make: urlMake, model: urlModel };
    }
    
    // Check localStorage
    try {
      const stored = localStorage.getItem("wtd_vehicle_context");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.year && parsed.make && parsed.model) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    
    return null;
  }, [searchParams]);

  // Fetch filters
  useEffect(() => {
    fetch("/api/gallery/filters")
      .then((r) => r.json())
      .then(setFilters)
      .catch(console.error);
  }, []);

  // Fetch gallery items
  useEffect(() => {
    setLoading(true);
    
    const params = new URLSearchParams();
    if (activeFilters.make) params.set("make", activeFilters.make);
    if (activeFilters.wheelBrand) params.set("wheelBrand", activeFilters.wheelBrand);
    if (activeFilters.vehicleType) params.set("vehicleType", activeFilters.vehicleType);
    if (activeFilters.buildType) params.set("buildType", activeFilters.buildType);
    if (activeFilters.customerOnly) params.set("customerOnly", "true");
    params.set("page", String(page));
    params.set("limit", "24");
    
    fetch(`/api/gallery/discover?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setItems(data.results || []);
        setPagination(data.pagination);
        setLoading(false);
      })
      .catch(() => {
        setItems([]);
        setLoading(false);
      });
  }, [activeFilters.make, activeFilters.wheelBrand, activeFilters.vehicleType, activeFilters.buildType, activeFilters.customerOnly, page]);

  // Update URL with filters
  const updateFilters = useCallback((key: string, value: string | boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (value === "" || value === false) {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
    
    // Reset to page 1 when filters change
    params.delete("page");
    
    router.push(`/gallery?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const clearFilters = useCallback(() => {
    router.push("/gallery", { scroll: false });
  }, [router]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CLICK-THROUGH LOGIC
  // ═══════════════════════════════════════════════════════════════════════════

  const handleViewWheel = useCallback(async (item: GalleryItem) => {
    if (item.wheelSku) {
      // Direct to PDP - no vehicle context needed, just show the wheel
      router.push(`/wheels/${item.wheelSku}`);
      return;
    }
    
    // No SKU stored - resolve one from brand + style
    try {
      const params = new URLSearchParams();
      if (item.wheelBrand) params.set("brand", item.wheelBrand);
      if (item.wheelModel) params.set("style", item.wheelModel);
      
      const res = await fetch(`/api/wheels/resolve-sku?${params.toString()}`);
      const data = await res.json();
      
      if (data.sku) {
        // Found a matching SKU - go to PDP
        router.push(`/wheels/${data.sku}`);
        return;
      }
    } catch (err) {
      console.error("[gallery] Failed to resolve SKU:", err);
    }
    
    // Fallback: browse page filtered by brand/style
    const fallbackParams = new URLSearchParams();
    if (item.wheelBrand) fallbackParams.set("brand", item.wheelBrand);
    if (item.wheelModel) fallbackParams.set("style", item.wheelModel);
    router.push(`/wheels?${fallbackParams.toString()}`);
  }, [router]);

  const handleShopStyle = useCallback((item: GalleryItem) => {
    const ymm = getYmmContext();
    
    // If no YMM, prompt for it
    if (!ymm) {
      setPendingAction({ item, action: "style" });
      setYmmModalOpen(true);
      return;
    }
    
    // Go to wheels page filtered by brand with YMM
    const params = new URLSearchParams();
    params.set("year", ymm.year);
    params.set("make", ymm.make);
    params.set("model", ymm.model);
    params.set("brand", item.wheelBrand);
    router.push(`/wheels?${params.toString()}`);
  }, [router, getYmmContext]);

  const handleBuildLikeThis = useCallback((item: GalleryItem) => {
    // Always prompt for vehicle selection - don't use stale localStorage
    // User needs to confirm which vehicle they want to shop for
    setPendingAction({ item, action: "build" });
    setYmmModalOpen(true);
  }, []);

  const [fitmentError, setFitmentError] = useState<{ vehicle: string; wheel: string } | null>(null);
  const [isCheckingFitment, setIsCheckingFitment] = useState(false);

  const handleYmmSubmit = useCallback(async (year: string, make: string, model: string, trim?: string) => {
    // Save to localStorage
    try {
      localStorage.setItem("wtd_vehicle_context", JSON.stringify({ year, make, model, trim }));
    } catch {
      // ignore
    }
    
    setYmmModalOpen(false);
    
    // Continue with pending action
    if (pendingAction) {
      const { item, action } = pendingAction;
      const vehicleParams = new URLSearchParams();
      vehicleParams.set("year", year);
      vehicleParams.set("make", make);
      vehicleParams.set("model", model);
      if (trim) vehicleParams.set("trim", trim);
      
      if (action === "style") {
        vehicleParams.set("brand", item.wheelBrand);
        router.push(`/wheels?${vehicleParams.toString()}`);
        setPendingAction(null);
        return;
      }
      
      if (action === "build") {
        setIsCheckingFitment(true);
        
        try {
          // Check if ANY variant of this wheel style fits the vehicle
          // The API checks all bolt pattern variants, not just one SKU
          const fitCheckParams = new URLSearchParams(vehicleParams);
          if (item.wheelSku) {
            fitCheckParams.set("sku", item.wheelSku);
          } else {
            // Pass brand+style so API can check all variants
            if (item.wheelBrand) fitCheckParams.set("brand", item.wheelBrand);
            if (item.wheelModel) fitCheckParams.set("style", item.wheelModel);
          }
          
          const fitRes = await fetch(`/api/wheels/check-fitment?${fitCheckParams.toString()}`);
          const fitData = await fitRes.json();
          
          if (fitData.fits) {
            // Wheel fits! Use the matching SKU (might be different from original)
            const targetSku = fitData.matchingSku || item.wheelSku;
            
            if (targetSku) {
              // Go to PDP with vehicle context
              router.push(`/wheels/${targetSku}?${vehicleParams.toString()}`);
            } else {
              // No SKU but fits - go to SRP with brand filter
              if (item.wheelBrand) vehicleParams.set("brand", item.wheelBrand);
              router.push(`/wheels?${vehicleParams.toString()}`);
            }
          } else {
            // Wheel doesn't fit - show error and go to SRP
            const vehicleLabel = [year, make, model, trim].filter(Boolean).join(" ");
            setFitmentError({
              vehicle: vehicleLabel,
              wheel: `${item.wheelBrand} ${item.wheelModel}`,
            });
            
            // After a short delay, redirect to SRP with wheels that fit
            setTimeout(() => {
              if (item.liftLevel && item.liftLevel !== "stock") {
                vehicleParams.set("buildType", item.liftLevel.includes("level") ? "leveled" : "lifted");
              }
              router.push(`/wheels?${vehicleParams.toString()}`);
              setFitmentError(null);
            }, 3000);
          }
        } catch (err) {
          console.error("[gallery] Fitment check failed:", err);
          // Fallback: go to SRP
          if (item.wheelBrand) vehicleParams.set("brand", item.wheelBrand);
          router.push(`/wheels?${vehicleParams.toString()}`);
        }
        
        setPendingAction(null);
        setIsCheckingFitment(false);
        return;
      }
      
      setPendingAction(null);
    }
  }, [router, pendingAction]);

  // Pagination
  const goToPage = useCallback((p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`/gallery?${params.toString()}`, { scroll: true });
  }, [router, searchParams]);

  return (
    <main className="min-h-screen bg-neutral-50">
      {/* Premium Header */}
      <div className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 text-white py-16 px-4 relative overflow-hidden">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        
        <div className="mx-auto max-w-7xl relative">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-400 text-xs font-bold px-3 py-1 rounded-full mb-4">
                <span>📸</span>
                <span>REAL BUILDS • REAL INSPIRATION</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black mb-3 tracking-tight">
                Explore Real Builds
              </h1>
              <p className="text-neutral-400 text-lg max-w-xl">
                Find a style you love and build it for your vehicle. 
                Every setup is shoppable.
              </p>
            </div>
            
            {/* Stats - Desktop */}
            {filters && (
              <div className="hidden md:flex items-center gap-6 text-center">
                <div>
                  <div className="text-3xl font-black text-white">{filters.totals.all.toLocaleString()}</div>
                  <div className="text-xs text-neutral-500 uppercase tracking-wide">Builds</div>
                </div>
                <div className="w-px h-10 bg-neutral-700" />
                {filters.totals.customerBuilds > 0 && (
                  <>
                    <div>
                      <div className="text-3xl font-black text-green-400">{filters.totals.customerBuilds}</div>
                      <div className="text-xs text-neutral-500 uppercase tracking-wide">Customer</div>
                    </div>
                    <div className="w-px h-10 bg-neutral-700" />
                  </>
                )}
                <div>
                  <div className="text-3xl font-black text-amber-400">{filters.wheelBrands.length}</div>
                  <div className="text-xs text-neutral-500 uppercase tracking-wide">Brands</div>
                </div>
              </div>
            )}
          </div>
          
          {/* Stats - Mobile */}
          {filters && (
            <div className="flex md:hidden gap-4 mt-6 text-sm">
              <div className="bg-white/10 rounded-lg px-3 py-2">
                <span className="text-white font-bold">{filters.totals.all.toLocaleString()}</span>
                <span className="text-neutral-400 ml-1">builds</span>
              </div>
              {filters.totals.customerBuilds > 0 && (
                <div className="bg-green-500/20 rounded-lg px-3 py-2">
                  <span className="text-green-400 font-bold">{filters.totals.customerBuilds}</span>
                  <span className="text-neutral-400 ml-1">customer</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-4">
              <FilterSidebar
                filters={filters}
                activeFilters={activeFilters}
                onFilterChange={updateFilters}
                onClearFilters={clearFilters}
              />
              
              {/* CTA - Add Your Build */}
              <div className="mt-4 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">📸</span>
                  <h4 className="font-bold text-neutral-900 text-sm">
                    Add Your Build
                  </h4>
                </div>
                <p className="text-xs text-neutral-600 mb-3 leading-relaxed">
                  Got wheels installed? Join the community and inspire others!
                </p>
                <Link
                  href="/add-your-build"
                  className="block w-full text-center rounded-lg bg-green-600 text-white text-xs font-bold px-3 py-2.5 hover:bg-green-700 transition-colors shadow-sm"
                >
                  Submit Your Photos →
                </Link>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Mobile Filters */}
            <div className="lg:hidden mb-4">
              <div className="flex flex-wrap gap-2">
                <select
                  value={activeFilters.vehicleType}
                  onChange={(e) => updateFilters("vehicleType", e.target.value)}
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-white"
                >
                  <option value="">All Types</option>
                  {filters?.vehicleTypes.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.value}</option>
                  ))}
                </select>
                <select
                  value={activeFilters.buildType}
                  onChange={(e) => updateFilters("buildType", e.target.value)}
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-white"
                >
                  <option value="">All Builds</option>
                  {filters?.buildTypes.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.value}</option>
                  ))}
                </select>
                <select
                  value={activeFilters.wheelBrand}
                  onChange={(e) => updateFilters("wheelBrand", e.target.value)}
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-white"
                >
                  <option value="">All Brands</option>
                  {filters?.wheelBrands.slice(0, 15).map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.value}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Results Count */}
            {pagination && (
              <div className="text-sm text-neutral-600 mb-4">
                Showing {items.length} of {pagination.total.toLocaleString()} builds
              </div>
            )}

            {/* Gallery Grid */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-2xl bg-neutral-200 aspect-[4/3]" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-lg font-bold text-neutral-900 mb-2">No builds found</h3>
                <p className="text-neutral-600 mb-4">Try adjusting your filters</p>
                <button
                  onClick={clearFilters}
                  className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-bold text-white hover:bg-neutral-800"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item) => (
                  <GalleryCard
                    key={item.id}
                    item={item}
                    onViewWheel={handleViewWheel}
                    onShopStyle={handleShopStyle}
                    onBuildLikeThis={handleBuildLikeThis}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  className="px-4 py-2 rounded-lg border border-neutral-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50"
                >
                  ← Prev
                </button>
                
                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <button
                      key={p}
                      onClick={() => goToPage(p)}
                      className={`w-10 h-10 rounded-lg text-sm font-medium ${
                        p === page
                          ? "bg-neutral-900 text-white"
                          : "border border-neutral-200 hover:bg-neutral-50"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                
                {pagination.pages > 5 && (
                  <>
                    <span className="px-2 py-2 text-neutral-400">...</span>
                    <button
                      onClick={() => goToPage(pagination.pages)}
                      className={`w-10 h-10 rounded-lg text-sm font-medium border border-neutral-200 hover:bg-neutral-50`}
                    >
                      {pagination.pages}
                    </button>
                  </>
                )}
                
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= pagination.pages}
                  className="px-4 py-2 rounded-lg border border-neutral-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* YMM Modal */}
      <YmmModal
        isOpen={ymmModalOpen}
        onClose={() => {
          setYmmModalOpen(false);
          setPendingAction(null);
        }}
        onSubmit={handleYmmSubmit}
        wheelBrand={pendingAction?.item.wheelBrand || ""}
        wheelModel={pendingAction?.item.wheelModel || ""}
      />

      {/* Fitment Check Loading */}
      {isCheckingFitment && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl text-center max-w-sm">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-neutral-200 border-t-neutral-900 mx-auto mb-4" />
            <p className="text-sm font-semibold text-neutral-900">Checking fitment...</p>
          </div>
        </div>
      )}

      {/* Fitment Error Toast */}
      {fitmentError && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-md text-center">
            <div className="text-4xl mb-4">😕</div>
            <h3 className="text-lg font-bold text-neutral-900 mb-2">
              Doesn&apos;t Fit Your Vehicle
            </h3>
            <p className="text-sm text-neutral-600 mb-4">
              The <span className="font-semibold">{fitmentError.wheel}</span> wheel 
              doesn&apos;t fit the <span className="font-semibold">{fitmentError.vehicle}</span>.
            </p>
            <p className="text-xs text-neutral-500 mb-4">
              Redirecting you to wheels that fit...
            </p>
            <div className="h-1 bg-neutral-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-neutral-900 rounded-full animate-pulse"
                style={{ animation: "progress 3s linear forwards" }}
              />
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT WITH SUSPENSE
// ═══════════════════════════════════════════════════════════════════════════

export default function GalleryPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-neutral-50">
        <div className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 text-white py-16 px-4">
          <div className="mx-auto max-w-7xl">
            <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-400 text-xs font-bold px-3 py-1 rounded-full mb-4">
              <span>📸</span>
              <span>REAL BUILDS • REAL INSPIRATION</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black mb-3 tracking-tight">Explore Real Builds</h1>
            <p className="text-neutral-400 text-lg">Loading gallery...</p>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="flex gap-6">
            <div className="hidden lg:block w-64 flex-shrink-0">
              <div className="animate-pulse rounded-2xl bg-neutral-200 h-80" />
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-2xl bg-neutral-200 aspect-[4/3]" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    }>
      <GalleryPageInner />
    </Suspense>
  );
}
