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

const BUILD_TYPES = [
  {
    id: "stock" as BuildType,
    name: "Stock Fit",
    icon: "🚗",
    description: "Factory-compatible wheels and tires",
    features: ["Perfect OEM fitment", "No modifications needed", "Keeps warranty intact"],
  },
  {
    id: "level" as BuildType,
    name: "Leveled",
    icon: "📐",
    description: "2\" lift for better stance",
    features: ["Eliminates factory rake", "Fits 32-33\" tires", "Subtle aggressive look"],
  },
  {
    id: "lifted" as BuildType,
    name: "Lifted",
    icon: "🏔️",
    description: "4-8\" lift for serious builds",
    features: ["Fits 33-40\" tires", "Trail-ready clearance", "Head-turning presence"],
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
      className={`group relative overflow-hidden rounded-2xl border-2 p-5 text-left transition-all ${
        selected
          ? "border-amber-500 bg-amber-50 ring-2 ring-amber-200"
          : "border-neutral-200 bg-white hover:border-amber-300 hover:bg-amber-50/50"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="text-2xl">{type.icon}</span>
          <div className="mt-2 text-lg font-extrabold text-neutral-900">{type.name}</div>
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
        <div className="mt-3 rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700 inline-block">
          Lift kits available
        </div>
      )}
    </button>
  );
}

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
      <div className="flex items-center justify-between">
        <div className="text-lg font-extrabold text-neutral-900">{config.label}</div>
        {selected && (
          <div className="grid h-5 w-5 place-items-center rounded-full bg-purple-500">
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>
      <div className="mt-1 text-sm text-neutral-600">
        Fits {config.targetTireSizes.join("-")}\" tires
      </div>
      {kitCount !== undefined && kitCount > 0 && (
        <div className="mt-2 text-xs text-purple-600 font-semibold">
          {kitCount} kits available
        </div>
      )}
    </button>
  );
}

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
        <img src={kit.imageUrl} alt={kit.name} className="h-16 w-16 rounded-lg object-cover bg-neutral-100" />
      ) : (
        <div className="h-16 w-16 rounded-lg bg-neutral-100 flex items-center justify-center text-2xl">
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

export function BuildTypeSelector({ vehicle, onComplete, onBack }: BuildTypeSelectorProps) {
  const [step, setStep] = useState<"buildType" | "liftLevel" | "liftKit">("buildType");
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
      // Stock = no additional steps
      onComplete({ buildType: "stock" });
    } else if (type === "level") {
      // Level = 2" with predefined offsets
      const config = LIFT_LEVELS["leveled"];
      onComplete({
        buildType: "level",
        liftLevel: "leveled",
        offsetMin: config.offsetMin,
        offsetMax: config.offsetMax,
        targetTireSizes: config.targetTireSizes,
      });
    } else if (type === "lifted") {
      // Lifted = go to lift level selection
      setStep("liftLevel");
    }
  };

  const handleLiftLevelSelect = (level: LiftLevel) => {
    setSelectedLiftLevel(level);
    
    // Check if we have kits for this level
    const levelKits = liftKitsByLevel.find((l) => l.liftLevel === level);
    if (levelKits && levelKits.kits.length > 0) {
      setStep("liftKit");
    } else {
      // No kits - proceed without one
      const config = LIFT_LEVELS[level];
      onComplete({
        buildType: "lifted",
        liftLevel: level,
        offsetMin: config.offsetMin,
        offsetMax: config.offsetMax,
        targetTireSizes: config.targetTireSizes,
      });
    }
  };

  const handleLiftKitSelect = (kit: LiftKit | null) => {
    setSelectedLiftKit(kit);
  };

  const handleContinue = () => {
    if (!selectedLiftLevel) return;
    
    const config = LIFT_LEVELS[selectedLiftLevel];
    onComplete({
      buildType: "lifted",
      liftLevel: selectedLiftLevel,
      liftKit: selectedLiftKit || undefined,
      offsetMin: config.offsetMin,
      offsetMax: config.offsetMax,
      targetTireSizes: config.targetTireSizes,
    });
  };

  const handleSkipLiftKit = () => {
    if (!selectedLiftLevel) return;
    
    const config = LIFT_LEVELS[selectedLiftLevel];
    onComplete({
      buildType: "lifted",
      liftLevel: selectedLiftLevel,
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
          <div className="text-sm text-neutral-500">Vehicle</div>
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
          <h2 className="text-xl font-extrabold text-neutral-900 mb-4">
            How do you want to build it?
          </h2>
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
            onClick={() => setStep("buildType")}
            className="flex items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-neutral-700 mb-4"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          
          <h2 className="text-xl font-extrabold text-neutral-900 mb-2">
            Choose your lift height
          </h2>
          <p className="text-sm text-neutral-600 mb-4">
            This determines your wheel offsets and compatible tire sizes.
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
            onClick={() => setStep("liftLevel")}
            className="flex items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-neutral-700 mb-4"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <h2 className="text-xl font-extrabold text-neutral-900 mb-2">
            Add a lift kit?
          </h2>
          <p className="text-sm text-neutral-600 mb-4">
            We found {currentLevelKits.length} lift kits for your{" "}
            {LIFT_LEVELS[selectedLiftLevel].label.toLowerCase()} build.
          </p>

          <div className="space-y-2 mb-4">
            {currentLevelKits.slice(0, 4).map((kit) => (
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
              onClick={handleSkipLiftKit}
              className="flex-1 rounded-xl border-2 border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-700 hover:border-neutral-300 transition-colors"
            >
              Skip — I have a lift kit
            </button>
            <button
              onClick={handleContinue}
              disabled={!selectedLiftKit}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
                selectedLiftKit
                  ? "bg-amber-500 text-white hover:bg-amber-600"
                  : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
              }`}
            >
              {selectedLiftKit ? "Continue with Lift Kit" : "Select a Kit or Skip"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
