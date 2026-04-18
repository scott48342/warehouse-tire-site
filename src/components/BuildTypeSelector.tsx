"use client";

import { useState, useEffect } from "react";
import { LIFT_LEVELS } from "@/lib/homepage-intent/config";
import type { LiftLevel } from "@/lib/homepage-intent/types";

// Types
interface LiftKit {
  sku: string;
  name: string;
  brand: string;
  liftHeight: number | null;
  liftLevel: string | null;
  msrp: number | null;
  mapPrice: number | null;
  imageUrl: string | null;
  inStock: boolean;
}

interface LiftKitsByLevel {
  liftLevel: string;
  label: string;
  inches: number;
  kits: LiftKit[];
  count: number;
}

export type BuildType = "stock" | "level" | "lifted";

export interface BuildTypeSelection {
  buildType: BuildType;
  liftLevel?: LiftLevel;
  liftKit?: LiftKit;
  offsetMin?: number;
  offsetMax?: number;
  targetTireSizes?: string[];
}

interface BuildTypeSelectorProps {
  vehicle: {
    year: string;
    make: string;
    model: string;
    trim?: string;
  };
  onComplete: (selection: BuildTypeSelection) => void;
  onBack?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// VISUAL COMPONENTS - Truck stance graphics
// ═══════════════════════════════════════════════════════════════════════════

function TruckStanceGraphic({ stance }: { stance: "stock" | "level" | "lifted" }) {
  // Ground line position changes based on stance
  const groundY = stance === "stock" ? 48 : stance === "level" ? 44 : 38;
  const wheelRadius = stance === "lifted" ? 10 : 8;
  const bodyY = stance === "stock" ? 20 : stance === "level" ? 16 : 8;
  
  return (
    <svg viewBox="0 0 120 60" className="w-full h-auto" aria-hidden="true">
      {/* Ground line */}
      <line x1="0" y1={groundY + wheelRadius + 2} x2="120" y2={groundY + wheelRadius + 2} 
        stroke="currentColor" strokeWidth="1" className="text-neutral-300" />
      
      {/* Truck body */}
      <g className="text-neutral-700">
        {/* Bed */}
        <rect x="60" y={bodyY} width="50" height="20" rx="2" fill="currentColor" />
        {/* Cab */}
        <rect x="20" y={bodyY} width="45" height="25" rx="3" fill="currentColor" />
        {/* Hood */}
        <rect x="5" y={bodyY + 10} width="18" height="15" rx="2" fill="currentColor" />
        {/* Windows */}
        <rect x="25" y={bodyY + 3} width="35" height="12" rx="2" className="text-neutral-400" fill="currentColor" />
      </g>
      
      {/* Wheels */}
      <g className="text-neutral-900">
        <circle cx="25" cy={groundY} r={wheelRadius} fill="currentColor" />
        <circle cx="25" cy={groundY} r={wheelRadius - 3} className="text-neutral-400" fill="currentColor" />
        <circle cx="95" cy={groundY} r={wheelRadius} fill="currentColor" />
        <circle cx="95" cy={groundY} r={wheelRadius - 3} className="text-neutral-400" fill="currentColor" />
      </g>
      
      {/* Lift indicator arrows for lifted */}
      {stance === "lifted" && (
        <g className="text-amber-500">
          <path d="M58,50 L60,45 L62,50" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M58,44 L60,39 L62,44" stroke="currentColor" strokeWidth="2" fill="none" />
        </g>
      )}
    </svg>
  );
}

function TireSizeVisual({ size }: { size: string }) {
  // Extract diameter from size like "35" or "33"
  const diameter = parseInt(size) || 33;
  const scale = Math.min(1.2, diameter / 33);
  
  return (
    <div className="relative flex items-center justify-center h-16">
      <div 
        className="rounded-full border-4 border-neutral-800 bg-neutral-700 flex items-center justify-center"
        style={{ 
          width: `${48 * scale}px`, 
          height: `${48 * scale}px`,
        }}
      >
        <div className="rounded-full bg-neutral-400" style={{ width: '40%', height: '40%' }} />
      </div>
      <span className="absolute -bottom-1 text-xs font-bold text-neutral-600">{size}"</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILD TYPE CARDS
// ═══════════════════════════════════════════════════════════════════════════

const BUILD_TYPES = [
  {
    id: "stock" as BuildType,
    name: "Factory Height",
    tagline: "Keep it clean",
    description: "OEM-compatible wheels and tires",
    features: ["Perfect fitment", "No mods needed", "Warranty safe"],
    stance: "stock" as const,
  },
  {
    id: "level" as BuildType,
    name: "Leveled Out",
    tagline: "Lose the rake",
    description: "2\" front lift for aggressive stance",
    features: ["Fits 32-33\" tires", "Better look", "Easy install"],
    stance: "level" as const,
  },
  {
    id: "lifted" as BuildType,
    name: "Lifted",
    tagline: "Go big",
    description: "4-8\" lift for serious builds",
    features: ["Fits 33-40\" tires", "Trail ready", "Show presence"],
    stance: "lifted" as const,
  },
];

function BuildTypeCard({
  type,
  selected,
  onSelect,
  hasLiftKits,
}: {
  type: typeof BUILD_TYPES[number];
  selected: boolean;
  onSelect: () => void;
  hasLiftKits?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative overflow-hidden rounded-2xl border-2 p-4 text-left transition-all ${
        selected
          ? "border-amber-500 bg-amber-50 ring-2 ring-amber-200"
          : "border-neutral-200 bg-white hover:border-amber-300 hover:bg-amber-50/50"
      }`}
    >
      {/* Visual */}
      <div className={`mb-3 rounded-xl p-3 ${selected ? "bg-amber-100" : "bg-neutral-100"}`}>
        <TruckStanceGraphic stance={type.stance} />
      </div>
      
      {/* Content */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-extrabold text-neutral-900">{type.name}</div>
          <div className="text-sm font-semibold text-amber-600">{type.tagline}</div>
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
      
      <p className="mt-2 text-sm text-neutral-600">{type.description}</p>
      
      <ul className="mt-3 space-y-1">
        {type.features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-xs text-neutral-700">
            <span className="text-green-600">✓</span>
            {f}
          </li>
        ))}
      </ul>
      
      {type.id === "lifted" && hasLiftKits && (
        <div className="mt-3 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700 inline-block">
          🔧 Lift kits available
        </div>
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LIFT LEVEL CARDS
// ═══════════════════════════════════════════════════════════════════════════

function LiftLevelCard({
  level,
  config,
  selected,
  onSelect,
  kitCount,
}: {
  level: LiftLevel;
  config: typeof LIFT_LEVELS[LiftLevel];
  selected: boolean;
  onSelect: () => void;
  kitCount?: number;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-xl border-2 p-4 text-left transition-all ${
        selected
          ? "border-purple-500 bg-purple-50 ring-2 ring-purple-200"
          : "border-neutral-200 bg-white hover:border-purple-300"
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Tire size visual */}
        <TireSizeVisual size={config.targetTireSizes[config.targetTireSizes.length - 1]} />
        
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="text-xl font-extrabold text-neutral-900">{config.label}</div>
            {selected && (
              <div className="grid h-5 w-5 place-items-center rounded-full bg-purple-500">
                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </div>
          <div className="mt-1 text-sm text-neutral-600">
            Fits <span className="font-semibold">{config.targetTireSizes.join("-")}"</span> tires
          </div>
          {kitCount !== undefined && kitCount > 0 && (
            <div className="mt-1 text-xs text-purple-600 font-semibold">
              {kitCount} lift kits in stock
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LIFT KIT CARD
// ═══════════════════════════════════════════════════════════════════════════

function LiftKitCard({
  kit,
  selected,
  onSelect,
}: {
  kit: LiftKit;
  selected: boolean;
  onSelect: () => void;
}) {
  const price = kit.msrp || kit.mapPrice;
  const formatPrice = (p: number) =>
    `$${p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${
        selected
          ? "border-purple-500 bg-purple-50"
          : "border-neutral-200 bg-white hover:border-purple-300"
      }`}
    >
      {kit.imageUrl ? (
        <img src={kit.imageUrl} alt={kit.name} className="h-14 w-14 rounded-lg object-cover bg-neutral-100" />
      ) : (
        <div className="h-14 w-14 rounded-lg bg-neutral-100 flex items-center justify-center text-2xl">
          🔧
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-neutral-900 truncate">{kit.name}</div>
        <div className="text-xs text-neutral-500">{kit.brand}</div>
        {kit.liftHeight && (
          <div className="text-xs text-purple-600 font-medium">{kit.liftHeight}" Lift</div>
        )}
      </div>
      <div className="text-right">
        {price && <div className="text-sm font-bold text-neutral-900">{formatPrice(price)}</div>}
        {kit.inStock && <span className="text-xs text-green-600">In Stock</span>}
      </div>
      {selected && (
        <div className="flex-shrink-0">
          <div className="grid h-5 w-5 place-items-center rounded-full bg-purple-500">
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RECOMMENDED SETUP SUMMARY
// ═══════════════════════════════════════════════════════════════════════════

function RecommendedSetupSummary({
  buildType,
  liftLevel,
  liftKit,
  onChangeLiftKit,
}: {
  buildType: BuildType;
  liftLevel?: LiftLevel;
  liftKit?: LiftKit | null;
  onChangeLiftKit?: () => void;
}) {
  if (buildType === "stock") return null;
  
  const config = liftLevel ? LIFT_LEVELS[liftLevel] : LIFT_LEVELS["leveled"];
  const price = liftKit?.msrp || liftKit?.mapPrice;
  const formatPrice = (p: number) =>
    `$${p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="rounded-xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4">
      <div className="flex items-center gap-2 text-green-700 mb-3">
        <span className="text-lg">✅</span>
        <h3 className="font-bold">Your Setup</h3>
      </div>
      
      <div className="grid gap-3 sm:grid-cols-3">
        {/* Lift Height */}
        <div className="rounded-lg bg-white/80 p-3 border border-green-100">
          <div className="text-xs font-semibold text-neutral-500">Lift Height</div>
          <div className="mt-1 text-lg font-extrabold text-neutral-900">{config.label}</div>
        </div>
        
        {/* Tire Size */}
        <div className="rounded-lg bg-white/80 p-3 border border-green-100">
          <div className="text-xs font-semibold text-neutral-500">Recommended Tires</div>
          <div className="mt-1 text-lg font-extrabold text-neutral-900">
            {config.targetTireSizes.join("-")}"
          </div>
        </div>
        
        {/* Wheel Offset */}
        <div className="rounded-lg bg-white/80 p-3 border border-green-100">
          <div className="text-xs font-semibold text-neutral-500">Wheel Offset</div>
          <div className="mt-1 text-lg font-extrabold text-neutral-900">
            {config.offsetMin} to {config.offsetMax}mm
          </div>
        </div>
      </div>
      
      {/* Selected Lift Kit */}
      {liftKit && (
        <div className="mt-3 flex items-center justify-between rounded-lg bg-purple-100 p-3">
          <div className="flex items-center gap-3">
            {liftKit.imageUrl ? (
              <img src={liftKit.imageUrl} alt="" className="h-10 w-10 rounded object-cover" />
            ) : (
              <span className="text-2xl">🔧</span>
            )}
            <div>
              <div className="text-sm font-bold text-neutral-900">{liftKit.name}</div>
              {price && (
                <div className="text-sm font-semibold text-purple-700">{formatPrice(price)}</div>
              )}
            </div>
          </div>
          {onChangeLiftKit && (
            <button
              onClick={onChangeLiftKit}
              className="text-xs font-semibold text-purple-700 hover:underline"
            >
              Change
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function BuildTypeSelector({ vehicle, onComplete, onBack }: BuildTypeSelectorProps) {
  const [step, setStep] = useState<"buildType" | "liftLevel" | "liftKit" | "confirm">("buildType");
  const [selectedBuildType, setSelectedBuildType] = useState<BuildType | null>(null);
  const [selectedLiftLevel, setSelectedLiftLevel] = useState<LiftLevel | null>(null);
  const [selectedLiftKit, setSelectedLiftKit] = useState<LiftKit | null>(null);

  // Lift kit data
  const [liftKitsByLevel, setLiftKitsByLevel] = useState<LiftKitsByLevel[]>([]);
  const [liftKitsLoading, setLiftKitsLoading] = useState(false);
  const [hasLiftKits, setHasLiftKits] = useState(false);

  // Fetch lift kits for this vehicle
  useEffect(() => {
    const fetchLiftKits = async () => {
      setLiftKitsLoading(true);
      try {
        const params = new URLSearchParams({
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
          groupByLevel: "true",
          inStockOnly: "true",
        });
        const res = await fetch(`/api/suspension/search?${params}`);
        if (res.ok) {
          const data = await res.json();
          setLiftKitsByLevel(data.byLevel || []);
          setHasLiftKits((data.byLevel?.length || 0) > 0);
        }
      } catch {
        setHasLiftKits(false);
      }
      setLiftKitsLoading(false);
    };

    fetchLiftKits();
  }, [vehicle.year, vehicle.make, vehicle.model]);

  const handleBuildTypeSelect = (type: BuildType) => {
    setSelectedBuildType(type);
    
    if (type === "stock") {
      // Stock = no additional steps, go straight to results
      onComplete({ buildType: "stock" });
    } else if (type === "level") {
      // Level = 2" with predefined offsets, show confirm
      setSelectedLiftLevel("leveled");
      // Check for leveling kits
      const levelKits = liftKitsByLevel.find((l) => l.liftLevel === "leveled");
      if (levelKits && levelKits.kits.length > 0) {
        setStep("liftKit");
      } else {
        setStep("confirm");
      }
    } else if (type === "lifted") {
      // Lifted = go to lift level selection
      setStep("liftLevel");
    }
  };

  const handleLiftLevelSelect = (level: LiftLevel) => {
    setSelectedLiftLevel(level);
    setSelectedLiftKit(null); // Reset kit selection
    
    // Check if we have kits for this level
    const levelKits = liftKitsByLevel.find((l) => l.liftLevel === level);
    if (levelKits && levelKits.kits.length > 0) {
      setStep("liftKit");
    } else {
      setStep("confirm");
    }
  };

  const handleLiftKitSelect = (kit: LiftKit | null) => {
    setSelectedLiftKit(kit);
  };

  const handleContinueToConfirm = () => {
    setStep("confirm");
  };

  const handleFinalContinue = () => {
    if (!selectedBuildType) return;
    
    if (selectedBuildType === "stock") {
      onComplete({ buildType: "stock" });
      return;
    }
    
    const level = selectedLiftLevel || "leveled";
    const config = LIFT_LEVELS[level];
    
    onComplete({
      buildType: selectedBuildType === "level" ? "level" : "lifted",
      liftLevel: level,
      liftKit: selectedLiftKit || undefined,
      offsetMin: config.offsetMin,
      offsetMax: config.offsetMax,
      targetTireSizes: config.targetTireSizes,
    });
  };

  // Current lift kits for selected level
  const currentLevelKits = selectedLiftLevel
    ? liftKitsByLevel.find((l) => l.liftLevel === selectedLiftLevel)?.kits || []
    : [];

  return (
    <div className="space-y-6">
      {/* Vehicle Summary */}
      <div className="flex items-center justify-between rounded-xl bg-neutral-100 px-4 py-3">
        <div>
          <div className="text-sm text-neutral-500">Your Vehicle</div>
          <div className="text-lg font-extrabold text-neutral-900">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </div>
          {vehicle.trim && <div className="text-sm text-neutral-600">{vehicle.trim}</div>}
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            Change
          </button>
        )}
      </div>

      {/* Step: Build Type */}
      {step === "buildType" && (
        <div>
          <h2 className="text-xl font-extrabold text-neutral-900 mb-1">
            How do you want your truck to sit?
          </h2>
          <p className="text-sm text-neutral-600 mb-4">
            This determines the wheels and tires we show you.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {BUILD_TYPES.map((type) => (
              <BuildTypeCard
                key={type.id}
                type={type}
                selected={selectedBuildType === type.id}
                onSelect={() => handleBuildTypeSelect(type.id)}
                hasLiftKits={type.id === "lifted" && hasLiftKits}
              />
            ))}
          </div>
          {liftKitsLoading && (
            <div className="mt-4 flex items-center gap-2 text-sm text-neutral-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
              Checking for lift kits...
            </div>
          )}
        </div>
      )}

      {/* Step: Lift Level */}
      {step === "liftLevel" && (
        <div>
          <button
            onClick={() => { setStep("buildType"); setSelectedBuildType(null); }}
            className="flex items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-neutral-700 mb-4"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          
          <h2 className="text-xl font-extrabold text-neutral-900 mb-1">
            How big do you want to go?
          </h2>
          <p className="text-sm text-neutral-600 mb-4">
            Bigger lift = bigger tires. We'll set your wheel offsets automatically.
          </p>
          
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(LIFT_LEVELS) as LiftLevel[]).map((level) => {
              const config = LIFT_LEVELS[level];
              const levelData = liftKitsByLevel.find((l) => l.liftLevel === level);
              return (
                <LiftLevelCard
                  key={level}
                  level={level}
                  config={config}
                  selected={selectedLiftLevel === level}
                  onSelect={() => handleLiftLevelSelect(level)}
                  kitCount={levelData?.count}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Step: Lift Kit Selection */}
      {step === "liftKit" && selectedLiftLevel && (
        <div>
          <button
            onClick={() => setStep(selectedBuildType === "level" ? "buildType" : "liftLevel")}
            className="flex items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-neutral-700 mb-4"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <h2 className="text-xl font-extrabold text-neutral-900 mb-1">
            Need a lift kit?
          </h2>
          <p className="text-sm text-neutral-600 mb-4">
            We found {currentLevelKits.length} kits for your {LIFT_LEVELS[selectedLiftLevel].label.toLowerCase()} build.
            Select one to add it to your order, or skip if you already have one.
          </p>

          <div className="space-y-2 mb-4">
            {currentLevelKits.slice(0, 5).map((kit) => (
              <LiftKitCard
                key={kit.sku}
                kit={kit}
                selected={selectedLiftKit?.sku === kit.sku}
                onSelect={() => handleLiftKitSelect(selectedLiftKit?.sku === kit.sku ? null : kit)}
              />
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleContinueToConfirm}
              className="flex-1 rounded-xl border-2 border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-700 hover:border-neutral-300 transition-colors"
            >
              Skip — I have a lift
            </button>
            <button
              onClick={handleContinueToConfirm}
              disabled={!selectedLiftKit}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
                selectedLiftKit
                  ? "bg-purple-600 text-white hover:bg-purple-700"
                  : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
              }`}
            >
              Continue with Kit
            </button>
          </div>
        </div>
      )}

      {/* Step: Confirm Setup */}
      {step === "confirm" && selectedBuildType && (
        <div>
          <button
            onClick={() => setStep(currentLevelKits.length > 0 ? "liftKit" : "liftLevel")}
            className="flex items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-neutral-700 mb-4"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <h2 className="text-xl font-extrabold text-neutral-900 mb-1">
            Your build is ready
          </h2>
          <p className="text-sm text-neutral-600 mb-4">
            We've configured everything for your {selectedLiftLevel ? LIFT_LEVELS[selectedLiftLevel].label.toLowerCase() : "leveled"} setup.
          </p>

          <RecommendedSetupSummary
            buildType={selectedBuildType}
            liftLevel={selectedLiftLevel || undefined}
            liftKit={selectedLiftKit}
            onChangeLiftKit={currentLevelKits.length > 0 ? () => setStep("liftKit") : undefined}
          />

          {/* Price Anchor */}
          <div className="mt-4 rounded-xl bg-neutral-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-neutral-500">Complete Build Range</div>
                <div className="text-lg font-extrabold text-neutral-900">
                  {selectedLiftKit 
                    ? `$${((selectedLiftKit.msrp || selectedLiftKit.mapPrice || 0) + 1200).toLocaleString()} – $${((selectedLiftKit.msrp || selectedLiftKit.mapPrice || 0) + 4500).toLocaleString()}`
                    : "$1,800 – $5,500"
                  }
                </div>
                <div className="text-xs text-neutral-500">
                  {selectedLiftKit ? "Lift kit + wheels + tires" : "Wheels + tires (lift kit not included)"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-green-600 font-semibold">Free Shipping</div>
                <div className="text-xs text-neutral-500">Orders $599+</div>
              </div>
            </div>
          </div>

          {/* Primary CTA */}
          <button
            onClick={handleFinalContinue}
            className="mt-6 w-full rounded-xl bg-amber-500 px-6 py-5 text-lg font-extrabold text-white hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/25"
          >
            Shop Wheels for This Build →
          </button>
          
          <p className="mt-2 text-sm text-neutral-600 text-center">
            We'll show <strong>only wheels that fit</strong> your exact setup.
            {selectedLiftKit && " Your lift kit will be added to cart."}
          </p>
          
          {/* Trust Micro-Strip */}
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-neutral-500">
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Guaranteed Fit
            </span>
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Free Shipping $599+
            </span>
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Expert Support
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
