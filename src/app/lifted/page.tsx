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
  // Build suggested tire category URL (All-Terrain is most common for lifted trucks)
  const tireCategoryUrl = "/tires/c/all-terrain";

  // Check if we have full vehicle context for vehicle-aware links
  const hasFullVehicleContext = !!(vehicle.year && vehicle.make && vehicle.model && vehicle.modification);

  // Build vehicle-aware wheel URL
  function buildWheelUrl(diameter: number): string {
    if (hasFullVehicleContext) {
      const params = new URLSearchParams({
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim,
        modification: vehicle.modification,
        diameter: String(diameter),
      });
      return `/wheels?${params.toString()}`;
    }
    // Fallback: diameter only
    return `/wheels?diameter=${diameter}`;
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
        Typical fitment for {profile.make} {profile.model} with {liftName}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {/* Tire Size */}
        <div className="rounded-xl bg-white/80 p-4 border border-green-100">
          <div className="text-xs font-semibold text-neutral-500">Tire Diameter Range</div>
          <div className="mt-1 text-2xl font-extrabold text-neutral-900">
            {formatTireDiameterRange(recommendation)}
          </div>
          <div className="mt-2 text-xs text-neutral-600">
            Common sizes: {recommendation.commonTireSizes.slice(0, 3).join(", ")}
          </div>
        </div>

        {/* Wheel Size - now shows full range including popular sizes */}
        <div className="rounded-xl bg-white/80 p-4 border border-green-100">
          <div className="text-xs font-semibold text-neutral-500">Popular Wheel Sizes</div>
          <div className="mt-1 text-2xl font-extrabold text-neutral-900">
            {displayWheelRange}
          </div>
          <div className="mt-2 text-xs text-neutral-600">
            Width: {recommendation.wheelWidthMin}-{recommendation.wheelWidthMax}" •
            Offset: {formatOffsetRange(recommendation)}
          </div>
        </div>
      </div>

      {/* Suggested Shopping Actions */}
      <div className="mt-5">
        <div className="text-xs font-semibold text-neutral-500 mb-3">Start Shopping</div>
        
        {/* Common Tire Sizes */}
        <div className="space-y-2">
          <div className="text-xs text-neutral-600 mb-2">Shop popular tire sizes for this setup:</div>
          <div className="flex flex-wrap gap-2">
            {recommendation.commonTireSizes.slice(0, 4).map((size) => (
              <Link
                key={size}
                href={`/tires?size=${encodeURIComponent(size)}`}
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-white px-3 py-2 text-sm font-semibold text-green-800 hover:bg-green-50 hover:border-green-400 transition-colors"
              >
                <span>🛞</span>
                {size}
              </Link>
            ))}
          </div>
        </div>

        {/* Popular Wheel Sizes - now vehicle-aware */}
        <div className="mt-4 space-y-2">
          <div className="text-xs text-neutral-600 mb-2">
            Shop popular wheel sizes for your {vehicle.year} {vehicle.make} {vehicle.model}:
          </div>
          <div className="flex flex-wrap gap-2">
            {recommendation.popularWheelSizes.map((dia) => (
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50 hover:border-blue-400 transition-colors"
              >
                <span>⚙️</span>
                {dia}" Wheels
              </Link>
            ))}
          </div>
          {hasFullVehicleContext && (
            <div className="text-xs text-blue-600">
              ✓ Links include your vehicle for better results
            </div>
          )}
        </div>

        {/* Category Link */}
        <div className="mt-4">
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
            className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 hover:border-amber-300 hover:bg-amber-50 transition-colors"
          >
            <span>🏔️</span>
            <div>
              <div>Browse All-Terrain Tires</div>
              <div className="text-xs font-normal text-neutral-500">Popular for lifted builds</div>
            </div>
          </Link>
        </div>

        <div className="mt-3 text-xs text-neutral-500">
          💡 These are starting points based on typical setups. Larger wheels may require specific offsets and modifications.
        </div>
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
                      href={`/tires/for/${v.year.toLowerCase()}-${v.make.toLowerCase()}-${v.model.toLowerCase().replace(/\s+/g, "-")}`}
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
