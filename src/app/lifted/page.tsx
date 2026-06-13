"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  trackLiftPresetSelect,
  trackLiftedRecommendationShown,
  trackLiftedFallbackShown,
  trackLiftedTireSuggestionClick,
  trackLiftedWheelSuggestionClick,
} from "@/lib/analytics";
import { saveLiftedContext, type LiftedBuildContext } from "@/lib/liftedBuildContext";
import type { LiftedFitmentResponse } from "@/app/api/fitment/lifted/route";

// ============================================================================
// CONSTANTS
// ============================================================================

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 20 }, (_, i) => String(THIS_YEAR - i));

// Lift presets - must match API's LIFT_LEVELS
const LIFT_PRESETS = [
  {
    id: "stock",
    name: "Stock",
    liftInches: 0,
    description: "Factory height, OEM tire sizes",
    icon: "🚙",
  },
  {
    id: "daily",
    name: "Leveled",
    liftInches: 2,
    description: "2\" level kit, slightly larger tires",
    icon: "🚗",
  },
  {
    id: "offroad",
    name: "Lifted",
    liftInches: 4,
    description: "4\" lift, aggressive tire sizes",
    icon: "🏔️",
  },
  {
    id: "extreme",
    name: "Extreme",
    liftInches: 6,
    description: "6\"+ lift, maximum clearance",
    icon: "🦖",
  },
] as const;

type LiftPreset = (typeof LIFT_PRESETS)[number];
type LiftLevelId = "stock" | "daily" | "offroad" | "extreme";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

// ============================================================================
// COMPACT VEHICLE SELECTOR
// ============================================================================

function CompactVehicleSelector({
  onSelect,
}: {
  onSelect: (v: { year: string; make: string; model: string; trim: string; modification: string }) => void;
}) {
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [trims, setTrims] = useState<{ trim: string; modification: string }[]>([]);
  
  const [loading, setLoading] = useState<"makes" | "models" | "trims" | null>(null);
  
  const makeRef = useRef<HTMLSelectElement>(null);
  const modelRef = useRef<HTMLSelectElement>(null);
  const trimRef = useRef<HTMLSelectElement>(null);

  // Fetch makes when year changes
  useEffect(() => {
    if (!year) { setMakes([]); setMake(""); return; }
    setLoading("makes");
    fetchJson<{ results?: string[] }>(`/api/vehicles/makes?year=${year}`)
      .then(d => {
        setMakes(d.results || []);
        setTimeout(() => makeRef.current?.focus(), 50);
      })
      .catch(() => setMakes([]))
      .finally(() => setLoading(null));
  }, [year]);

  // Fetch models when make changes
  useEffect(() => {
    if (!year || !make) { setModels([]); setModel(""); return; }
    setLoading("models");
    fetchJson<{ results?: string[] }>(`/api/vehicles/models?year=${year}&make=${encodeURIComponent(make)}`)
      .then(d => {
        setModels(d.results || []);
        setTimeout(() => modelRef.current?.focus(), 50);
      })
      .catch(() => setModels([]))
      .finally(() => setLoading(null));
  }, [year, make]);

  // Fetch trims when model changes
  useEffect(() => {
    if (!year || !make || !model) { setTrims([]); return; }
    setLoading("trims");
    fetchJson<{ results?: { label: string; modificationId: string }[] }>(
      `/api/vehicles/trims?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`
    )
      .then(d => {
        const mapped = (d.results || []).map((t) => ({
          trim: t.label,
          modification: t.modificationId,
        }));
        setTrims(mapped);
        if (mapped.length === 1) {
          onSelect({ year, make, model, trim: mapped[0].trim, modification: mapped[0].modification });
        } else if (mapped.length > 1) {
          setTimeout(() => trimRef.current?.focus(), 50);
        } else {
          // No trims - submit with empty trim
          onSelect({ year, make, model, trim: "", modification: "" });
        }
      })
      .catch(() => setTrims([]))
      .finally(() => setLoading(null));
  }, [year, make, model, onSelect]);

  const handleTrimChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = trims.find(t => t.modification === e.target.value);
    if (selected) {
      onSelect({ year, make, model, trim: selected.trim, modification: selected.modification });
    }
  };

  const selectClass = "w-full h-14 rounded-xl border-2 border-neutral-200 bg-white px-4 text-base font-medium focus:border-amber-500 focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-400 appearance-none";

  return (
    <div className="space-y-3">
      <select
        value={year}
        onChange={(e) => { setYear(e.target.value); setMake(""); setModel(""); }}
        className={selectClass}
      >
        <option value="">Select Year</option>
        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
      </select>

      <select
        ref={makeRef}
        value={make}
        onChange={(e) => { setMake(e.target.value); setModel(""); }}
        disabled={!year || loading === "makes"}
        className={selectClass}
      >
        <option value="">{loading === "makes" ? "Loading..." : "Select Make"}</option>
        {makes.map(m => <option key={m} value={m}>{m}</option>)}
      </select>

      <select
        ref={modelRef}
        value={model}
        onChange={(e) => setModel(e.target.value)}
        disabled={!make || loading === "models"}
        className={selectClass}
      >
        <option value="">{loading === "models" ? "Loading..." : "Select Model"}</option>
        {models.map(m => <option key={m} value={m}>{m}</option>)}
      </select>

      {trims.length > 1 && (
        <select
          ref={trimRef}
          onChange={handleTrimChange}
          disabled={loading === "trims"}
          className={selectClass}
        >
          <option value="">{loading === "trims" ? "Loading..." : "Select Trim"}</option>
          {trims.map(t => <option key={t.modification} value={t.modification}>{t.trim}</option>)}
        </select>
      )}
    </div>
  );
}

// ============================================================================
// LIFT LEVEL CHIPS
// ============================================================================

function LiftLevelChips({
  selected,
  onSelect,
  disabled,
}: {
  selected: LiftPreset | null;
  onSelect: (preset: LiftPreset) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
      {LIFT_PRESETS.map((preset) => {
        const isSelected = selected?.id === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            disabled={disabled}
            onClick={() => {
              onSelect(preset);
              if (preset.id !== "stock") {
                trackLiftPresetSelect(preset.id, preset.liftInches);
              }
            }}
            className={`
              flex-shrink-0 flex items-center gap-2 rounded-full px-4 py-2.5 
              text-sm font-bold transition-all whitespace-nowrap
              disabled:opacity-50 disabled:cursor-not-allowed
              ${isSelected
                ? preset.id === "stock"
                  ? "bg-blue-600 text-white ring-2 ring-blue-300"
                  : "bg-amber-500 text-white ring-2 ring-amber-300"
                : "bg-white border-2 border-neutral-200 text-neutral-700 hover:border-amber-300"
              }
            `}
          >
            <span className="text-lg">{preset.icon}</span>
            <span>{preset.name}</span>
            {preset.liftInches > 0 && (
              <span className={`text-xs ${isSelected ? "opacity-80" : "text-neutral-400"}`}>
                {preset.liftInches}"
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// RESULTS CARD (Unified for lifted and stock)
// ============================================================================

function ResultsCard({
  data,
  vehicle,
  liftPreset,
}: {
  data: LiftedFitmentResponse;
  vehicle: { year: string; make: string; model: string; trim: string };
  liftPreset: LiftPreset;
}) {
  const isStock = liftPreset.id === "stock";
  const hasLiftedProfile = data.liftedRecommendations.hasProfile;
  const rec = data.liftedRecommendations.recommendation;
  
  // Save context for wheel→tire flow (only for lifted)
  useEffect(() => {
    if (isStock || !rec) return;
    saveLiftedContext({
      source: "lifted",
      presetId: liftPreset.id as LiftedBuildContext["presetId"],
      liftInches: liftPreset.liftInches,
      vehicle: {
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim,
      },
      recommendedTireSizes: rec.commonTireSizes,
      tireDiameterMin: rec.tireDiameterMin,
      tireDiameterMax: rec.tireDiameterMax,
      offsetMin: rec.offsetMin,
      offsetMax: rec.offsetMax,
    });
  }, [isStock, rec, liftPreset, vehicle]);

  const buildTireUrl = (size: string) => {
    const params = new URLSearchParams({
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
    });
    if (vehicle.trim) params.set("trim", vehicle.trim);
    params.set("size", size);
    if (!isStock && rec) {
      params.set("liftedSource", "lifted");
      params.set("liftedPreset", liftPreset.id);
      params.set("liftedInches", String(liftPreset.liftInches));
    }
    return `/tires?${params.toString()}`;
  };

  const buildWheelUrl = (diameter: number) => {
    const params = new URLSearchParams({
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
    });
    if (vehicle.trim) params.set("trim", vehicle.trim);
    params.set("diameter", String(diameter));
    if (!isStock && rec) {
      params.set("liftedSource", "lifted");
      params.set("liftedPreset", liftPreset.id);
      params.set("liftedInches", String(liftPreset.liftInches));
      if (rec.offsetMin !== null) params.set("offsetMin", String(rec.offsetMin));
      if (rec.offsetMax !== null) params.set("offsetMax", String(rec.offsetMax));
    }
    return `/wheels?${params.toString()}`;
  };

  // Stock or no lifted profile - show base fitment
  if (isStock || !hasLiftedProfile) {
    const tireSizes = data.shoppingSuggestions.tireSizes;
    const wheelDiameters = data.shoppingSuggestions.wheelDiameters;
    
    return (
      <div className={`rounded-xl border p-4 ${isStock ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200"}`}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">{isStock ? "🚙" : "📋"}</span>
          <span className="font-bold text-neutral-900">
            {isStock ? "Stock Fitment" : `${liftPreset.name} Build`}
          </span>
          {!isStock && !hasLiftedProfile && (
            <span className="ml-auto text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
              Using base specs
            </span>
          )}
        </div>

        {/* Base specs */}
        <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
          <div className="bg-white/80 rounded-lg p-2">
            <div className="text-[10px] text-neutral-500 uppercase">Bolt Pattern</div>
            <div className="font-bold text-neutral-900">{data.baseFitment.boltPattern || "—"}</div>
          </div>
          <div className="bg-white/80 rounded-lg p-2">
            <div className="text-[10px] text-neutral-500 uppercase">Center Bore</div>
            <div className="font-bold text-neutral-900">{data.baseFitment.centerBore ? `${data.baseFitment.centerBore}mm` : "—"}</div>
          </div>
        </div>

        {/* Info for lifted without profile */}
        {!isStock && !hasLiftedProfile && (
          <div className="bg-white/80 rounded-lg p-3 mb-4 text-sm">
            <p className="text-neutral-700">
              <strong>💡 Tip:</strong> Specific {liftPreset.name.toLowerCase()} recommendations aren't available for this vehicle yet, 
              but your base fitment specs are shown above. For a {liftPreset.liftInches}" lift, consider:
            </p>
            <ul className="mt-2 text-neutral-600 list-disc list-inside">
              <li>Upsizing tires by 1-2" in diameter</li>
              <li>Choosing wheels with negative offset (-12 to -24mm)</li>
              <li>Consulting our team for personalized advice</li>
            </ul>
          </div>
        )}

        {/* Tire sizes */}
        <div className="mb-3">
          <div className="text-xs font-semibold text-neutral-600 mb-2">
            {isStock ? "OEM Tire Sizes" : "Base Tire Sizes"}
          </div>
          <div className="flex flex-wrap gap-2">
            {tireSizes.length > 0 ? tireSizes.map((size, idx) => (
              <Link
                key={size}
                href={buildTireUrl(size)}
                onClick={() => trackLiftedTireSuggestionClick({
                  liftPreset: liftPreset.id,
                  liftInches: liftPreset.liftInches,
                  tireSize: size,
                  year: vehicle.year,
                  make: vehicle.make,
                  model: vehicle.model,
                })}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  idx === 0
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-blue-200 text-blue-800 hover:bg-blue-50"
                }`}
              >
                {size}
              </Link>
            )) : (
              <span className="text-neutral-500 text-sm">No tire sizes available</span>
            )}
          </div>
        </div>

        {/* Wheel diameters */}
        <div>
          <div className="text-xs font-semibold text-neutral-600 mb-2">
            {isStock ? "OEM Wheel Sizes" : "Base Wheel Sizes"}
          </div>
          <div className="flex flex-wrap gap-2">
            {wheelDiameters.length > 0 ? wheelDiameters.map((dia, idx) => (
              <Link
                key={dia}
                href={buildWheelUrl(dia)}
                onClick={() => trackLiftedWheelSuggestionClick({
                  liftPreset: liftPreset.id,
                  liftInches: liftPreset.liftInches,
                  wheelDiameter: dia,
                  year: vehicle.year,
                  make: vehicle.make,
                  model: vehicle.model,
                  vehicleAwareLink: true,
                })}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  idx === 0
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-blue-200 text-blue-800 hover:bg-blue-50"
                }`}
              >
                {dia}"
              </Link>
            )) : (
              <span className="text-neutral-500 text-sm">No wheel sizes available</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Has lifted profile - show full recommendations
  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-green-600 text-lg">✅</span>
        <span className="font-bold text-neutral-900">
          {liftPreset.name} Setup for {data.vehicle.make} {data.vehicle.model}
        </span>
      </div>

      {/* Stance description */}
      {rec?.stanceDescription && (
        <p className="text-sm text-green-800 mb-3">{rec.stanceDescription}</p>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white/80 rounded-lg p-2 text-center">
          <div className="text-[10px] text-neutral-500 uppercase">Tire Size</div>
          <div className="text-sm font-bold text-neutral-900">
            {rec ? `${rec.tireDiameterMin}-${rec.tireDiameterMax}"` : "—"}
          </div>
        </div>
        <div className="bg-white/80 rounded-lg p-2 text-center">
          <div className="text-[10px] text-neutral-500 uppercase">Wheels</div>
          <div className="text-sm font-bold text-neutral-900">
            {rec ? `${rec.popularWheelSizes[0]}-${rec.popularWheelSizes[rec.popularWheelSizes.length - 1]}"` : "—"}
          </div>
        </div>
        <div className="bg-white/80 rounded-lg p-2 text-center">
          <div className="text-[10px] text-neutral-500 uppercase">Offset</div>
          <div className="text-sm font-bold text-neutral-900">{rec?.offsetLabel || "—"}</div>
        </div>
      </div>

      {/* Tire Size Chips */}
      <div className="mb-3">
        <div className="text-xs font-semibold text-neutral-600 mb-2">Recommended Tire Sizes</div>
        <div className="flex flex-wrap gap-2">
          {data.shoppingSuggestions.tireSizes.slice(0, 5).map((size, idx) => (
            <Link
              key={size}
              href={buildTireUrl(size)}
              onClick={() => trackLiftedTireSuggestionClick({
                liftPreset: liftPreset.id,
                liftInches: liftPreset.liftInches,
                tireSize: size,
                year: vehicle.year,
                make: vehicle.make,
                model: vehicle.model,
              })}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                idx === 0
                  ? "bg-green-600 text-white"
                  : "bg-white border border-green-200 text-green-800 hover:bg-green-50"
              }`}
            >
              {size}
            </Link>
          ))}
        </div>
      </div>

      {/* Wheel Size Chips */}
      <div className="mb-3">
        <div className="text-xs font-semibold text-neutral-600 mb-2">Wheel Sizes</div>
        <div className="flex flex-wrap gap-2">
          {data.shoppingSuggestions.wheelDiameters.map((dia, idx) => (
            <Link
              key={dia}
              href={buildWheelUrl(dia)}
              onClick={() => trackLiftedWheelSuggestionClick({
                liftPreset: liftPreset.id,
                liftInches: liftPreset.liftInches,
                wheelDiameter: dia,
                year: vehicle.year,
                make: vehicle.make,
                model: vehicle.model,
                vehicleAwareLink: true,
              })}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                idx === 0
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-blue-200 text-blue-800 hover:bg-blue-50"
              }`}
            >
              {dia}"
            </Link>
          ))}
        </div>
      </div>

      {/* Notes */}
      {rec?.notes && rec.notes.length > 0 && (
        <div className="bg-white/60 rounded-lg p-3 text-xs text-neutral-600">
          <strong className="text-neutral-700">Notes:</strong>
          <ul className="mt-1 list-disc list-inside">
            {rec.notes.slice(0, 3).map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function LiftedPage() {
  const [selectedVehicle, setSelectedVehicle] = useState<{
    year: string;
    make: string;
    model: string;
    trim: string;
    modification: string;
  } | null>(null);
  const [selectedLift, setSelectedLift] = useState<LiftPreset | null>(null);
  const [fitmentData, setFitmentData] = useState<LiftedFitmentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Fetch fitment data when vehicle + lift are selected
  const fetchFitment = useCallback(async (
    vehicle: typeof selectedVehicle,
    liftLevel: LiftLevelId
  ) => {
    if (!vehicle) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        liftLevel,
      });
      if (vehicle.trim) params.set("trim", vehicle.trim);
      
      const response = await fetch(`/api/fitment/lifted?${params}`);
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch fitment data");
      }
      
      setFitmentData(data as LiftedFitmentResponse);
      
      // Track analytics
      if (liftLevel !== "stock") {
        if (data.liftedRecommendations.hasProfile) {
          trackLiftedRecommendationShown({
            liftPreset: liftLevel,
            liftInches: LIFT_PRESETS.find(p => p.id === liftLevel)?.liftInches || 0,
            year: vehicle.year,
            make: vehicle.make,
            model: vehicle.model,
            tireDiameterMin: data.liftedRecommendations.recommendation?.tireDiameterMin || 0,
            tireDiameterMax: data.liftedRecommendations.recommendation?.tireDiameterMax || 0,
          });
        } else {
          trackLiftedFallbackShown({
            year: vehicle.year,
            make: vehicle.make,
            model: vehicle.model,
          });
        }
      }
      
      // Scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
      
    } catch (err) {
      console.error("[LiftedPage] Fetch error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
      setFitmentData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch when lift level changes
  useEffect(() => {
    if (selectedVehicle && selectedLift) {
      fetchFitment(selectedVehicle, selectedLift.id as LiftLevelId);
    }
  }, [selectedVehicle, selectedLift, fetchFitment]);

  const handleVehicleSelect = useCallback((v: typeof selectedVehicle) => {
    setSelectedVehicle(v);
    // Default to Stock when vehicle is selected
    const defaultLift = LIFT_PRESETS[0];
    setSelectedLift(defaultLift);
  }, []);

  const handleLiftSelect = useCallback((preset: LiftPreset) => {
    setSelectedLift(preset);
  }, []);

  return (
    <main className="bg-neutral-50 min-h-screen">
      {/* Compact Hero */}
      <section className="bg-gradient-to-b from-neutral-900 to-neutral-800 text-white px-4 py-8 md:py-12">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 text-amber-400 text-sm font-semibold mb-2">
            <span>🏔️</span>
            <span>Off-Road & Lifted Builds</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold">
            Find Tires for Your Lifted Truck
          </h1>
          <p className="mt-2 text-sm md:text-base text-neutral-300">
            Select your vehicle, choose your lift level, see results instantly.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="mx-auto max-w-2xl px-4 py-6">
        {/* Step 1: Vehicle Selector */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-amber-500 text-xs font-bold text-white">
              1
            </div>
            <h2 className="text-lg font-bold text-neutral-900">Select Your Vehicle</h2>
          </div>
          
          {selectedVehicle ? (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl p-4">
              <div>
                <div className="text-xs text-green-600 font-semibold">Selected</div>
                <div className="font-bold text-neutral-900">
                  {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                </div>
                {selectedVehicle.trim && (
                  <div className="text-sm text-neutral-600">{selectedVehicle.trim}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => { 
                  setSelectedVehicle(null); 
                  setSelectedLift(null); 
                  setFitmentData(null);
                }}
                className="text-sm font-semibold text-blue-600 hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            <CompactVehicleSelector onSelect={handleVehicleSelect} />
          )}
        </div>

        {/* Step 2: Lift Level */}
        {selectedVehicle && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="grid h-7 w-7 place-items-center rounded-full bg-amber-500 text-xs font-bold text-white">
                2
              </div>
              <h2 className="text-lg font-bold text-neutral-900">Choose Lift Level</h2>
            </div>
            <LiftLevelChips
              selected={selectedLift}
              onSelect={handleLiftSelect}
              disabled={loading}
            />
          </div>
        )}

        {/* Step 3: Results */}
        {selectedVehicle && selectedLift && (
          <div ref={resultsRef}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-white ${
                loading ? "bg-neutral-400" : "bg-green-500"
              }`}>
                {loading ? "..." : "✓"}
              </div>
              <h2 className="text-lg font-bold text-neutral-900">Your Results</h2>
            </div>

            {/* Loading state */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3 text-neutral-600">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-amber-600" />
                  <span>Loading fitment data...</span>
                </div>
              </div>
            )}

            {/* Error state */}
            {error && !loading && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <span className="text-2xl mb-2 block">⚠️</span>
                <div className="font-bold text-red-800">Error Loading Fitment</div>
                <p className="text-sm text-red-600 mt-1">{error}</p>
                <button
                  type="button"
                  onClick={() => fetchFitment(selectedVehicle, selectedLift.id as LiftLevelId)}
                  className="mt-3 text-sm font-semibold text-blue-600 hover:underline"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Results */}
            {fitmentData && !loading && !error && (
              <div className="space-y-4">
                <ResultsCard
                  data={fitmentData}
                  vehicle={selectedVehicle}
                  liftPreset={selectedLift}
                />

                {/* Quick Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href={`/tires?year=${selectedVehicle.year}&make=${encodeURIComponent(selectedVehicle.make)}&model=${encodeURIComponent(selectedVehicle.model)}${selectedVehicle.trim ? `&trim=${encodeURIComponent(selectedVehicle.trim)}` : ""}${selectedLift.id !== "stock" ? `&liftedPreset=${selectedLift.id}&liftedInches=${selectedLift.liftInches}` : ""}`}
                    className="flex items-center justify-center gap-2 h-14 rounded-xl bg-green-600 text-white font-bold text-base hover:bg-green-700 transition-colors"
                  >
                    🛞 Shop Tires
                  </Link>
                  <Link
                    href={`/wheels?year=${selectedVehicle.year}&make=${encodeURIComponent(selectedVehicle.make)}&model=${encodeURIComponent(selectedVehicle.model)}${selectedVehicle.trim ? `&trim=${encodeURIComponent(selectedVehicle.trim)}` : ""}${selectedLift.id !== "stock" ? `&liftedPreset=${selectedLift.id}&liftedInches=${selectedLift.liftInches}` : ""}`}
                    className="flex items-center justify-center gap-2 h-14 rounded-xl bg-blue-600 text-white font-bold text-base hover:bg-blue-700 transition-colors"
                  >
                    ⚙️ Shop Wheels
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Safety Disclaimer */}
        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
          <strong>⚠️ Important:</strong> Lift presets are general guidance. Final fitment depends on 
          your specific lift kit, wheel offset, and modifications.{" "}
          <a href="tel:+12483324120" className="font-bold underline">Call 248-332-4120</a> to verify.
        </div>

        {/* Help Section */}
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
          <div className="font-bold text-neutral-900 text-sm">Need help?</div>
          <p className="text-xs text-neutral-600 mt-1">
            Not sure what lift or tire size works for your build? Our experts can help.
          </p>
          <a
            href="tel:+12483324120"
            className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-blue-600"
          >
            📞 Call 248-332-4120
          </a>
        </div>
      </section>
    </main>
  );
}
