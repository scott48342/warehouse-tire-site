"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  trackLiftPresetSelect,
  trackLiftedCtaClick,
  trackLiftedRecommendationShown,
  trackLiftedFallbackShown,
  trackLiftedTireSuggestionClick,
  trackLiftedWheelSuggestionClick,
  trackLiftedCategoryClick,
  trackLiftKitSuggestionClick,
} from "@/lib/analytics";
import {
  getLiftRecommendation,
  formatTireDiameterRange,
  formatWheelDiameterRange,
  formatOffsetRange,
  type LiftLevel,
  type LiftRecommendation,
  type VehicleLiftProfile,
} from "@/lib/liftedRecommendations";
import { saveLiftedContext, type LiftedBuildContext } from "@/lib/liftedBuildContext";

// Lift kit tire size mapping by lift height
const LIFT_KIT_TIRE_SIZES: Record<number, string[]> = {
  2: ["275/70R18", "285/70R17", "33x12.50R17"],
  4: ["35x12.50R20", "295/60R20", "33x12.50R20", "305/55R20"],
  6: ["37x12.50R20", "35x12.50R22", "37x13.50R18", "38x13.50R20"],
};

// Types for lift kit data from API
interface LiftKitData {
  sku: string;
  name: string;
  brand: string;
  productType: string;
  liftHeight: number | null;
  liftLevel: string | null;
  yearRange: string;
  msrp: number | null;
  mapPrice: number | null;
  imageUrl: string | null;
  inStock: boolean;
  inventory: number;
}

interface LiftKitsByLevel {
  liftLevel: string;
  label: string;
  inches: number;
  kits: LiftKitData[];
  count: number;
}

// Lift Kit Suggestion Component - shows available lift kits for the vehicle
function LiftKitSuggestion({ 
  liftInches, 
  make, 
  model,
  year,
}: { 
  liftInches: number; 
  make: string; 
  model: string;
  year: string;
}) {
  const [loading, setLoading] = useState(true);
  const [kits, setKits] = useState<LiftKitData[]>([]);
  const [byLevel, setByLevel] = useState<LiftKitsByLevel[]>([]);
  const [hasKits, setHasKits] = useState(false);

  // Map lift inches to level ID
  const liftLevel = liftInches <= 2 ? "leveled" : liftInches <= 4 ? "4in" : liftInches <= 6 ? "6in" : "8in";

  useEffect(() => {
    const fetchKits = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          year,
          make,
          model,
          liftLevel,
          inStockOnly: "true",
          pageSize: "6",
        });
        const res = await fetch(`/api/suspension/search?${params}`);
        if (res.ok) {
          const data = await res.json();
          setKits(data.results || []);
          setByLevel(data.byLevel || []);
          setHasKits((data.results?.length || 0) > 0 || (data.byLevel?.length || 0) > 0);
        }
      } catch {
        setHasKits(false);
      }
      setLoading(false);
    };

    if (year && make && model) {
      fetchKits();
    }
  }, [year, make, model, liftLevel]);

  const tireSizes = LIFT_KIT_TIRE_SIZES[liftInches] || LIFT_KIT_TIRE_SIZES[4];
  const displaySizes = tireSizes.slice(0, 2);

  // Build URL to lift kit search
  const liftKitSearchUrl = `/suspension?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&liftLevel=${liftLevel}`;

  if (loading) {
    return (
      <div className="rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 p-4">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-purple-300 border-t-purple-600" />
          <span className="text-sm text-purple-700">Checking for lift kits...</span>
        </div>
      </div>
    );
  }

  // No kits available - show informational message
  if (!hasKits) {
    return (
      <div className="rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <span className="text-2xl">🔧</span>
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-neutral-900">Need a lift kit?</h4>
            <p className="mt-1 text-sm text-neutral-700">
              A <span className="font-semibold text-purple-700">{liftInches}" lift</span> supports larger tire sizes like:
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {displaySizes.map((size) => (
                <span
                  key={size}
                  className="inline-flex items-center rounded-lg bg-white border border-purple-200 px-2.5 py-1 text-sm font-semibold text-purple-800"
                >
                  • {size}
                </span>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm text-purple-700">
              <span>Call us for lift kit recommendations</span>
              <a href="tel:+12483324120" className="font-bold underline">248-332-4120</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show available lift kits
  const displayKits = kits.slice(0, 3);
  const formatPrice = (price: number | null) => price ? `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null;

  return (
    <div className="rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <span className="text-2xl">🔧</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-neutral-900">Add a Lift Kit</h4>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
              {kits.length} Available
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-700">
            Complete your {liftInches}" lifted build with one of these kits:
          </p>
          
          {/* Lift Kit Cards */}
          <div className="mt-3 space-y-2">
            {displayKits.map((kit) => (
              <div 
                key={kit.sku}
                className="flex items-center gap-3 rounded-lg bg-white border border-purple-200 p-3"
              >
                {kit.imageUrl && (
                  <img 
                    src={kit.imageUrl} 
                    alt={kit.name}
                    className="h-14 w-14 rounded object-cover bg-neutral-100"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-neutral-900 truncate">{kit.name}</div>
                  <div className="text-xs text-neutral-600">{kit.brand}</div>
                  {kit.liftHeight && (
                    <div className="text-xs text-purple-600 font-medium">{kit.liftHeight}" Lift</div>
                  )}
                </div>
                <div className="text-right">
                  {kit.msrp && (
                    <div className="text-sm font-bold text-neutral-900">{formatPrice(kit.msrp)}</div>
                  )}
                  {kit.inStock && (
                    <span className="text-xs text-green-600 font-medium">In Stock</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* View All Link */}
          <Link
            href={liftKitSearchUrl}
            onClick={() => {
              trackLiftKitSuggestionClick({
                liftInches,
                make,
                model,
              });
            }}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-purple-700 transition-colors"
          >
            <span>View All {kits.length} Lift Kits</span>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

// Lift presets - extensible structure for future fitment logic
const LIFT_PRESETS = [
  {
    id: "daily",
    name: "Daily Driver",
    liftInches: 2,
    description: "Perfect balance of style and practicality",
    features: ["Maintains factory ride quality", "Easy entry/exit", "No major mods needed"],
    icon: "🚗",
  },
  {
    id: "offroad",
    name: "Off-Road Ready",
    liftInches: 4,
    description: "Serious capability without going extreme",
    features: ["Improved approach angles", "Fits 33-35\" tires", "Great trail performance"],
    icon: "🏔️",
  },
  {
    id: "extreme",
    name: "Extreme Build",
    liftInches: 6,
    description: "Maximum clearance for serious off-roading",
    features: ["Fits 35-37\" tires", "Rock crawling capable", "Show truck presence"],
    icon: "🦖",
  },
] as const;

type LiftPreset = (typeof LIFT_PRESETS)[number];

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 20 }, (_, i) => String(THIS_YEAR - i));

// Popular trucks/SUVs for lifted builds
const POPULAR_VEHICLES = [
  { year: "2024", make: "Ford", model: "F-150" },
  { year: "2024", make: "Chevrolet", model: "Silverado 1500" },
  { year: "2024", make: "RAM", model: "1500" },
  { year: "2024", make: "Toyota", model: "Tacoma" },
  { year: "2024", make: "Jeep", model: "Wrangler" },
  { year: "2024", make: "Ford", model: "Bronco" },
  { year: "2024", make: "Toyota", model: "4Runner" },
  { year: "2024", make: "Chevrolet", model: "Colorado" },
];

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

function LiftCard({
  preset,
  selected,
  onSelect,
}: {
  preset: LiftPreset;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative overflow-hidden rounded-2xl border-2 p-5 text-left transition-all ${
        selected
          ? "border-amber-500 bg-amber-50 ring-2 ring-amber-200"
          : "border-neutral-200 bg-white hover:border-amber-300 hover:bg-amber-50/50"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="text-2xl">{preset.icon}</span>
          <div className="mt-2 text-lg font-extrabold text-neutral-900">{preset.name}</div>
          <div className="text-sm font-bold text-amber-700">{preset.liftInches}" Lift</div>
        </div>
        <div
          className={`grid h-6 w-6 place-items-center rounded-full border-2 transition-colors ${
            selected ? "border-amber-500 bg-amber-500" : "border-neutral-300 bg-white"
          }`}
        >
          {selected && (
            <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
      <p className="mt-2 text-sm text-neutral-600">{preset.description}</p>
      <ul className="mt-3 space-y-1">
        {preset.features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-xs text-neutral-700">
            <span className="text-green-600">✓</span>
            {f}
          </li>
        ))}
      </ul>
    </button>
  );
}

function VehicleSelector({
  onSelect,
}: {
  onSelect: (v: { year: string; make: string; model: string; trim: string; modification: string }) => void;
}) {
  const [step, setStep] = useState<"year" | "make" | "model" | "trim">("year");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [trims, setTrims] = useState<{ trim: string; modification: string }[]>([]);
  
  const [loading, setLoading] = useState(false);

  async function selectYear(y: string) {
    setYear(y);
    setMake("");
    setModel("");
    setLoading(true);
    try {
      const data = await fetchJson<{ results?: string[] }>(`/api/vehicles/makes?year=${y}`);
      setMakes(data.results || []);
      setStep("make");
    } catch {
      setMakes([]);
    }
    setLoading(false);
  }

  async function selectMake(m: string) {
    setMake(m);
    setModel("");
    setLoading(true);
    try {
      const data = await fetchJson<{ results?: string[] }>(`/api/vehicles/models?year=${year}&make=${m}`);
      setModels(data.results || []);
      setStep("model");
    } catch {
      setModels([]);
    }
    setLoading(false);
  }

  async function selectModel(mod: string) {
    setModel(mod);
    setLoading(true);
    try {
      const data = await fetchJson<{ results?: { label: string; modificationId: string }[] }>(
        `/api/vehicles/trims?year=${year}&make=${make}&model=${mod}`
      );
      // Map API response to our expected format
      const mapped = (data.results || []).map((t) => ({
        trim: t.label,
        modification: t.modificationId,
      }));
      setTrims(mapped);
      setStep("trim");
    } catch {
      setTrims([]);
    }
    setLoading(false);
  }

  function selectTrim(t: { trim: string; modification: string }) {
    onSelect({ year, make, model, trim: t.trim, modification: t.modification });
  }

  function reset() {
    setStep("year");
    setYear("");
    setMake("");
    setModel("");
    setMakes([]);
    setModels([]);
    setTrims([]);
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-neutral-900">Select Your Vehicle</h3>
        {step !== "year" && (
          <button type="button" onClick={reset} className="text-xs font-semibold text-blue-700 hover:underline">
            Start over
          </button>
        )}
      </div>

      {/* Breadcrumbs */}
      {(year || make || model) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {year && (
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
              {year}
            </span>
          )}
          {make && (
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
              {make}
            </span>
          )}
          {model && (
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
              {model}
            </span>
          )}
        </div>
      )}

      {loading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-neutral-600">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
          Loading...
        </div>
      )}

      {!loading && step === "year" && (
        <div className="mt-4">
          <div className="text-xs font-semibold text-neutral-600 mb-2">Year</div>
          <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto">
            {YEARS.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => selectYear(y)}
                className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-900 hover:border-amber-300 hover:bg-amber-50"
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && step === "make" && makes.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold text-neutral-600 mb-2">Make</div>
          <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
            {makes.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => selectMake(m)}
                className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-900 hover:border-amber-300 hover:bg-amber-50 text-left"
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && step === "model" && models.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold text-neutral-600 mb-2">Model</div>
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {models.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => selectModel(m)}
                className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-900 hover:border-amber-300 hover:bg-amber-50 text-left"
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && step === "trim" && trims.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold text-neutral-600 mb-2">Trim</div>
          <div className="grid gap-2 max-h-64 overflow-y-auto">
            {trims.map((t) => (
              <button
                key={t.modification}
                type="button"
                onClick={() => selectTrim(t)}
                className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-900 hover:border-amber-300 hover:bg-amber-50 text-left"
              >
                {t.trim}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Recommendation Panel Component
function RecommendationPanel({
  profile,
  recommendation,
  liftName,
  liftPreset,
  vehicle,
}: {
  profile: VehicleLiftProfile;
  recommendation: LiftRecommendation;
  liftName: string;
  liftPreset: { id: string; liftInches: number };
  vehicle: { year: string; make: string; model: string; trim: string; modification: string };
}) {
  // Save lifted context to sessionStorage for the wheel → tire flow
  // This preserves lifted tire recommendations when continuing to tires
  useEffect(() => {
    saveLiftedContext({
      source: "lifted",
      presetId: liftPreset.id as LiftedBuildContext["presetId"],
      liftInches: liftPreset.liftInches,
      vehicle,
      recommendedTireSizes: recommendation.commonTireSizes,
      tireDiameterMin: recommendation.tireDiameterMin,
      tireDiameterMax: recommendation.tireDiameterMax,
      offsetMin: recommendation.offsetMin ?? -20,
      offsetMax: recommendation.offsetMax ?? 0,
    });
  }, [liftPreset.id, liftPreset.liftInches, vehicle, recommendation]);

  // Build suggested tire category URL (All-Terrain is most common for lifted trucks)
  const tireCategoryUrl = "/tires/c/all-terrain";

  // Check if we have full vehicle context for vehicle-aware links
  const hasFullVehicleContext = !!(vehicle.year && vehicle.make && vehicle.model && vehicle.modification);

  // Build vehicle-aware tire URL with lifted context
  function buildTireUrl(tireSize: string): string {
    const params = new URLSearchParams();
    
    if (hasFullVehicleContext) {
      params.set("year", vehicle.year);
      params.set("make", vehicle.make);
      params.set("model", vehicle.model);
      params.set("trim", vehicle.trim);
      params.set("modification", vehicle.modification);
    }
    
    params.set("size", tireSize);
    
    // Include lifted context
    params.set("liftedSource", "lifted");
    params.set("liftedPreset", liftPreset.id);
    params.set("liftedInches", String(liftPreset.liftInches));
    params.set("liftedTireSizes", recommendation.commonTireSizes.join(","));
    params.set("liftedTireDiaMin", String(recommendation.tireDiameterMin));
    params.set("liftedTireDiaMax", String(recommendation.tireDiameterMax));
    
    return `/tires?${params.toString()}`;
  }

  // Build vehicle-aware wheel URL with offset params and lifted context
  // IMPORTANT: Always include offset params when we have a recommendation
  // This ensures lifted trucks get appropriate negative offsets, not OEM +35mm
  function buildWheelUrl(diameter: number): string {
    const params = new URLSearchParams();
    
    if (hasFullVehicleContext) {
      params.set("year", vehicle.year);
      params.set("make", vehicle.make);
      params.set("model", vehicle.model);
      params.set("trim", vehicle.trim);
      params.set("modification", vehicle.modification);
    }
    
    params.set("diameter", String(diameter));
    
    // Always include offset params for lifted builds to filter out OEM offsets
    // For example: 4" lift F150 should show -18 to 0mm, not +35mm OEM offset
    if (recommendation.offsetMin !== null && recommendation.offsetMax !== null) {
      params.set("offsetMin", String(recommendation.offsetMin));
      params.set("offsetMax", String(recommendation.offsetMax));
    }
    
    // Include lifted context params so they carry through to tires page
    params.set("liftedSource", "lifted");
    params.set("liftedPreset", liftPreset.id);
    params.set("liftedInches", String(liftPreset.liftInches));
    // Filter tire sizes that match this wheel diameter
    const tireSizesForWheel = recommendation.commonTireSizes.filter((size) => {
      const rimMatch = size.match(/R(\d+)$/i) || size.match(/(\d+)$/);
      return rimMatch && parseInt(rimMatch[1], 10) === diameter;
    });
    if (tireSizesForWheel.length > 0) {
      params.set("liftedTireSizes", tireSizesForWheel.join(","));
    }
    params.set("liftedTireDiaMin", String(recommendation.tireDiameterMin));
    params.set("liftedTireDiaMax", String(recommendation.tireDiameterMax));
    
    // Include wheel diameter recommendations for size chips
    params.set("liftedWheelDiaMin", String(recommendation.wheelDiameterMin));
    params.set("liftedWheelDiaMax", String(recommendation.wheelDiameterMax));
    params.set("liftedPopularWheelSizes", recommendation.popularWheelSizes.join(","));
    
    return `/wheels?${params.toString()}`;
  }

  // Compute display ranges that include popular sizes
  const allWheelSizes = [
    recommendation.wheelDiameterMin,
    recommendation.wheelDiameterMax,
    ...recommendation.popularWheelSizes,
  ];
  const displayWheelMin = Math.min(...allWheelSizes);
  const displayWheelMax = Math.max(...allWheelSizes);
  const displayWheelRange = displayWheelMin === displayWheelMax 
    ? `${displayWheelMin}"` 
    : `${displayWheelMin}"-${displayWheelMax}"`;

  return (
    <div className="rounded-2xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-5">
      <div className="flex items-center gap-2 text-green-700">
        <span className="text-xl">✅</span>
        <h3 className="text-lg font-extrabold">Recommended Setup</h3>
      </div>
      <p className="mt-1 text-sm text-green-800">
        {recommendation.stanceDescription} for {profile.make} {profile.model}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {/* Tire Size */}
        <div className="rounded-xl bg-white/80 p-4 border border-green-100">
          <div className="text-xs font-semibold text-neutral-500">Tire Diameter</div>
          <div className="mt-1 text-2xl font-extrabold text-neutral-900">
            {formatTireDiameterRange(recommendation)}
          </div>
          <div className="mt-2 text-xs text-neutral-600">
            {recommendation.commonTireSizes.slice(0, 2).join(", ")}
          </div>
        </div>

        {/* Wheel Size */}
        <div className="rounded-xl bg-white/80 p-4 border border-green-100">
          <div className="text-xs font-semibold text-neutral-500">Wheel Diameter</div>
          <div className="mt-1 text-2xl font-extrabold text-neutral-900">
            {displayWheelRange}
          </div>
          <div className="mt-2 text-xs text-neutral-600">
            Width: {recommendation.wheelWidthMin}-{recommendation.wheelWidthMax}"
          </div>
        </div>

        {/* Offset - now prominent with label */}
        <div className="rounded-xl bg-white/80 p-4 border border-green-100">
          <div className="text-xs font-semibold text-neutral-500">Wheel Offset</div>
          <div className="mt-1 text-2xl font-extrabold text-neutral-900">
            {recommendation.offsetLabel}
          </div>
          <div className="mt-2 text-xs text-neutral-600">
            {liftPreset.liftInches <= 2 ? "Near-stock look" : 
             liftPreset.liftInches <= 4 ? "Moderate poke" : "Aggressive poke"}
          </div>
        </div>
      </div>

      {/* Shopping Sections - Redesigned with chips */}
      <div className="mt-5 space-y-5">
        
        {/* Tire Sizes Section */}
        <div className="rounded-xl border-2 border-green-200 bg-green-50/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🛞</span>
            <h4 className="font-bold text-neutral-900">Tire Sizes</h4>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              Lifted
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {recommendation.commonTireSizes.map((size, index) => (
              <Link
                key={size}
                href={buildTireUrl(size)}
                onClick={() => {
                  trackLiftedTireSuggestionClick({
                    liftPreset: liftPreset.id,
                    liftInches: liftPreset.liftInches,
                    tireSize: size,
                    year: vehicle.year,
                    make: vehicle.make,
                    model: vehicle.model,
                  });
                }}
                className={`
                  inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-2 
                  text-sm font-semibold transition-all duration-200
                  ${index === 0 
                    ? "border-green-500 bg-green-100 text-green-800" 
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-green-300 hover:bg-green-50"
                  }
                `}
              >
                <span>{size}</span>
                {index === 0 && (
                  <span className="rounded bg-green-200 px-1 py-0.5 text-[10px] font-bold text-green-800">
                    Popular
                  </span>
                )}
              </Link>
            ))}
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Recommended for {liftPreset.liftInches}" lift • Click to shop
          </p>
        </div>

        {/* Wheel Sizes Section */}
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">⚙️</span>
            <h4 className="font-bold text-neutral-900">Wheel Sizes</h4>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              Lifted
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {recommendation.popularWheelSizes.map((dia, index) => (
              <Link
                key={dia}
                href={buildWheelUrl(dia)}
                onClick={() => {
                  trackLiftedWheelSuggestionClick({
                    liftPreset: liftPreset.id,
                    liftInches: liftPreset.liftInches,
                    wheelDiameter: dia,
                    year: vehicle.year,
                    make: vehicle.make,
                    model: vehicle.model,
                    vehicleAwareLink: hasFullVehicleContext,
                  });
                }}
                className={`
                  inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-2 
                  text-sm font-semibold transition-all duration-200
                  ${index === 0 
                    ? "border-blue-500 bg-blue-100 text-blue-800" 
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-blue-300 hover:bg-blue-50"
                  }
                `}
              >
                <span>{dia}"</span>
                {index === 0 && (
                  <span className="rounded bg-blue-200 px-1 py-0.5 text-[10px] font-bold text-blue-800">
                    Popular
                  </span>
                )}
              </Link>
            ))}
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            {hasFullVehicleContext 
              ? `Fitment verified for your ${vehicle.year} ${vehicle.make} ${vehicle.model}` 
              : "Select your vehicle above for verified fitment"
            }
          </p>
        </div>

        {/* Lift Kit Suggestion - contextual upsell */}
        <LiftKitSuggestion
          liftInches={liftPreset.liftInches}
          make={vehicle.make}
          model={vehicle.model}
          year={vehicle.year}
        />

        {/* Category Link */}
        <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4">
          <Link
            href={tireCategoryUrl}
            onClick={() => {
              trackLiftedCategoryClick({
                liftPreset: liftPreset.id,
                category: "all-terrain",
                year: vehicle.year,
                make: vehicle.make,
                model: vehicle.model,
              });
            }}
            className="flex items-center gap-2 text-sm font-semibold text-neutral-900 hover:text-amber-700 transition-colors"
          >
            <span className="text-lg">🏔️</span>
            <div>
              <div>Browse All-Terrain Tires</div>
              <div className="text-xs font-normal text-neutral-500">Popular for lifted builds</div>
            </div>
          </Link>
        </div>

        <p className="mt-3 text-xs text-neutral-500">
          💡 These are starting points based on typical setups. Larger wheels may require specific offsets and modifications.
        </p>
      </div>

      {/* Notes */}
      {recommendation.notes.length > 0 && (
        <div className="mt-5 pt-4 border-t border-green-200">
          <div className="text-xs font-semibold text-neutral-500 mb-2">Setup Notes</div>
          <ul className="space-y-1">
            {recommendation.notes.map((note, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                <span className="text-amber-500 mt-0.5">•</span>
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 rounded-lg bg-amber-100/50 px-3 py-2 text-xs text-amber-800">
        <strong>Note:</strong> These are typical supported ranges. Actual fitment depends on your specific 
        lift kit, wheel offset, and modifications. Call us to confirm before ordering.
      </div>
    </div>
  );
}

// Fallback Panel for unsupported vehicles
function FallbackPanel({ make, model }: { make: string; model: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
      <div className="flex items-center gap-2 text-neutral-600">
        <span className="text-xl">📋</span>
        <h3 className="text-lg font-extrabold text-neutral-900">Recommendations Coming Soon</h3>
      </div>
      <p className="mt-2 text-sm text-neutral-600">
        Lifted fitment recommendations for <strong>{make} {model}</strong> are not yet in our database. 
        You can still shop stock-fitment tires now, or call us for personalized lift fitment advice.
      </p>
      <a
        href="tel:+12483324120"
        className="mt-3 inline-flex items-center gap-2 text-sm font-extrabold text-blue-700 hover:underline"
      >
        <span>📞</span>
        <span>Call 248-332-4120 for custom recommendations</span>
      </a>
    </div>
  );
}

export default function LiftedPage() {
  const [selectedLift, setSelectedLift] = useState<LiftPreset | null>(LIFT_PRESETS[1]); // Default to Off-Road
  const [selectedVehicle, setSelectedVehicle] = useState<{
    year: string;
    make: string;
    model: string;
    trim: string;
    modification: string;
  } | null>(null);
  const [recommendationTracked, setRecommendationTracked] = useState(false);

  // Look up recommendation when both vehicle and lift are selected
  const recommendationResult = selectedVehicle && selectedLift
    ? getLiftRecommendation(
        selectedVehicle.make,
        selectedVehicle.model,
        selectedLift.id as LiftLevel,
        parseInt(selectedVehicle.year, 10)
      )
    : null;

  const hasRecommendation = !!recommendationResult;

  // Track recommendation shown (once per combination)
  useEffect(() => {
    if (!selectedVehicle || !selectedLift) {
      setRecommendationTracked(false);
      return;
    }

    if (recommendationTracked) return;

    if (recommendationResult) {
      trackLiftedRecommendationShown({
        liftPreset: selectedLift.id,
        liftInches: selectedLift.liftInches,
        year: selectedVehicle.year,
        make: selectedVehicle.make,
        model: selectedVehicle.model,
        tireDiameterMin: recommendationResult.recommendation.tireDiameterMin,
        tireDiameterMax: recommendationResult.recommendation.tireDiameterMax,
      });
    } else {
      trackLiftedFallbackShown({
        year: selectedVehicle.year,
        make: selectedVehicle.make,
        model: selectedVehicle.model,
      });
    }
    setRecommendationTracked(true);
  }, [selectedVehicle, selectedLift, recommendationResult, recommendationTracked]);

  // Build the CTA URL - redirects to existing /tires flow
  const ctaUrl = selectedVehicle
    ? `/tires?year=${encodeURIComponent(selectedVehicle.year)}&make=${encodeURIComponent(selectedVehicle.make)}&model=${encodeURIComponent(selectedVehicle.model)}&trim=${encodeURIComponent(selectedVehicle.trim)}&modification=${encodeURIComponent(selectedVehicle.modification)}`
    : null;

  return (
    <main className="bg-neutral-50 min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-b from-neutral-900 to-neutral-800 text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
            <span>🏔️</span>
            <span>Off-Road & Lifted Builds</span>
          </div>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
            Build Your Lifted Truck or SUV
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-neutral-300">
            Select your vehicle and lift setup, then shop tires sized for your build. 
            We'll help you find the right fitment for your lifted rig.
          </p>
        </div>
      </section>

      {/* Safety Disclaimer */}
      <section className="mx-auto max-w-6xl px-4 pt-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex gap-3">
            <span className="text-amber-600 text-lg">⚠️</span>
            <div className="text-sm text-amber-900">
              <strong>Important:</strong> Lift presets are general guidance only. Final tire and wheel fitment may vary 
              based on your specific lift kit, wheel offset, tire size, fender trimming, and other modifications. 
              We recommend verifying fitment with our team before ordering.{" "}
              <a href="tel:+12483324120" className="font-semibold underline">Call 248-332-4120</a> for personalized advice.
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Main content */}
          <div className="space-y-8">
            {/* Step 1: Choose Lift */}
            <div>
              <div className="flex items-center gap-3">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-amber-500 text-sm font-extrabold text-white">
                  1
                </div>
                <h2 className="text-xl font-extrabold text-neutral-900">Choose Your Lift</h2>
              </div>
              <p className="mt-2 ml-11 text-sm text-neutral-600">
                Select a lift level to help us recommend the right tire sizes.
              </p>
              <div className="mt-4 ml-11 grid gap-4 sm:grid-cols-3">
                {LIFT_PRESETS.map((preset) => (
                  <LiftCard
                    key={preset.id}
                    preset={preset}
                    selected={selectedLift?.id === preset.id}
                    onSelect={() => {
                      setSelectedLift(preset);
                      trackLiftPresetSelect(preset.id, preset.liftInches);
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Step 2: Select Vehicle */}
            <div>
              <div className="flex items-center gap-3">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-amber-500 text-sm font-extrabold text-white">
                  2
                </div>
                <h2 className="text-xl font-extrabold text-neutral-900">Select Your Vehicle</h2>
              </div>
              <p className="mt-2 ml-11 text-sm text-neutral-600">
                Tell us what you drive so we can show tires that fit.
              </p>
              <div className="mt-4 ml-11">
                {selectedVehicle ? (
                  <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-green-700">Selected Vehicle</div>
                        <div className="mt-1 text-lg font-extrabold text-neutral-900">
                          {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                        </div>
                        <div className="text-sm text-neutral-600">{selectedVehicle.trim}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedVehicle(null)}
                        className="text-sm font-semibold text-blue-700 hover:underline"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                ) : (
                  <VehicleSelector onSelect={setSelectedVehicle} />
                )}
              </div>
            </div>

            {/* Popular Vehicles Shortcut */}
            {!selectedVehicle && (
              <div className="ml-11">
                <div className="text-xs font-semibold text-neutral-600 mb-3">Popular lifted trucks & SUVs</div>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_VEHICLES.slice(0, 6).map((v) => (
                    <Link
                      key={`${v.year}-${v.make}-${v.model}`}
                      href={`/tires/for/${v.year}-${v.make.toLowerCase()}-${v.model.toLowerCase().replace(/\s+/g, "-")}`}
                      className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:border-amber-300 hover:bg-amber-50"
                    >
                      {v.year} {v.make} {v.model}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Recommendations (shown after vehicle selection) */}
            {selectedVehicle && selectedLift && (
              <div>
                <div className="flex items-center gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-amber-500 text-sm font-extrabold text-white">
                    3
                  </div>
                  <h2 className="text-xl font-extrabold text-neutral-900">Your Recommendations</h2>
                </div>
                <div className="mt-4 ml-11">
                  {recommendationResult ? (
                    <RecommendationPanel
                      profile={recommendationResult.profile}
                      recommendation={recommendationResult.recommendation}
                      liftName={`${selectedLift.liftInches}" lift`}
                      liftPreset={{ id: selectedLift.id, liftInches: selectedLift.liftInches }}
                      vehicle={{
                        year: selectedVehicle.year,
                        make: selectedVehicle.make,
                        model: selectedVehicle.model,
                        trim: selectedVehicle.trim,
                        modification: selectedVehicle.modification,
                      }}
                    />
                  ) : (
                    <FallbackPanel
                      make={selectedVehicle.make}
                      model={selectedVehicle.model}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Summary & CTA */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <h3 className="text-lg font-extrabold text-neutral-900">Your Build</h3>
              
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3">
                  <div className="text-sm text-neutral-600">Lift Level</div>
                  <div className="text-sm font-extrabold text-neutral-900">
                    {selectedLift ? `${selectedLift.name} (${selectedLift.liftInches}")` : "Not selected"}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3">
                  <div className="text-sm text-neutral-600">Vehicle</div>
                  <div className="text-sm font-extrabold text-neutral-900">
                    {selectedVehicle
                      ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`
                      : "Not selected"}
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="mt-6">
                {ctaUrl && selectedLift && selectedVehicle ? (
                  <Link
                    href={ctaUrl}
                    onClick={() => {
                      trackLiftedCtaClick({
                        liftPreset: selectedLift.id,
                        liftInches: selectedLift.liftInches,
                        year: selectedVehicle.year,
                        make: selectedVehicle.make,
                        model: selectedVehicle.model,
                        hasRecommendation,
                      });
                    }}
                    className="flex h-14 w-full items-center justify-center rounded-xl bg-amber-500 text-base font-extrabold text-white hover:bg-amber-600 transition-colors"
                  >
                    Shop Tires for This Setup →
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="flex h-14 w-full items-center justify-center rounded-xl bg-neutral-200 text-base font-extrabold text-neutral-500 cursor-not-allowed"
                  >
                    Select vehicle to continue
                  </button>
                )}
              </div>

              <p className="mt-4 text-xs text-neutral-500 text-center">
                We'll show you tires that work with your lift. No guesswork.
              </p>
            </div>

            {/* Help */}
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5">
              <div className="text-sm font-extrabold text-neutral-900">Need help?</div>
              <p className="mt-1 text-xs text-neutral-600">
                Not sure what lift or tire size works for your build? Give us a call and we'll help you figure it out.
              </p>
              <a
                href="tel:+12483324120"
                className="mt-3 flex items-center gap-2 text-sm font-extrabold text-blue-700 hover:underline"
              >
                <span>📞</span>
                <span>248-332-4120</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Future: This is where we can add lift-specific tire sizing logic */}
      {/* The LIFT_PRESETS structure is designed to be extensible:
          - Add wheel diameter recommendations per lift level
          - Add tire size multipliers or lookup tables
          - Add suspension component recommendations
          - Connect to fitment engine with lift offsets
      */}
    </main>
  );
}
