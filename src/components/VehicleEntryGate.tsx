"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SteppedVehicleSelector, type VehicleSelection } from "./SteppedVehicleSelector";
import { BuildTypeSelector, type BuildTypeSelection } from "./BuildTypeSelector";
import { vehicleSlug } from "@/lib/vehicleSlug";
import { parseHomepageIntent, getLiftLevelConfig } from "@/lib/homepage-intent";
import { useCart } from "@/lib/cart/CartContext";
import type { CartAccessoryItem } from "@/lib/cart/accessoryTypes";

interface VehicleEntryGateProps {
  /** "tires" or "wheels" - determines the redirect path */
  productType: "tires" | "wheels";
  /** Optional: show package flow after selection */
  packageFlow?: boolean;
  /** Enable build type selection after vehicle (Stock/Level/Lifted) */
  showBuildTypeStep?: boolean;
}

/**
 * VehicleEntryGate
 * 
 * Shown on /tires and /wheels when there's no vehicle context.
 * Forces user to select a vehicle before showing products.
 * 
 * Design:
 * - Clear headline with fitment benefit
 * - YMM selector above the fold
 * - Trust signals below selector
 * 
 * Homepage Intent Support:
 * - Preserves entry=homepage and intent=xxx params through YMM selection
 * - Applies intent-specific defaults (offset ranges, build type) after selection
 */
export function VehicleEntryGate({ productType, packageFlow, showBuildTypeStep }: VehicleEntryGateProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addAccessory, setIsOpen } = useCart();
  
  // Step tracking for build type flow
  const [step, setStep] = useState<"vehicle" | "buildType">("vehicle");
  const [vehicleSelection, setVehicleSelection] = useState<VehicleSelection | null>(null);

  // Parse homepage intent from current URL
  const currentParams: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    currentParams[key] = value;
  });
  const intentState = parseHomepageIntent(currentParams);
  
  // Check if build type step should be shown
  // - Skip if intent already specifies a build type
  // - Skip if showBuildTypeStep is false
  const shouldShowBuildTypeStep = showBuildTypeStep && !intentState.resolved?.buildType;

  function handleVehicleComplete(selection: VehicleSelection) {
    if (shouldShowBuildTypeStep) {
      // Save vehicle and show build type step
      setVehicleSelection(selection);
      setStep("buildType");
      return;
    }
    
    // Otherwise, proceed directly
    navigateToResults(selection);
  }
  
  function handleBuildTypeComplete(buildSelection: BuildTypeSelection) {
    if (!vehicleSelection) return;
    
    // If a lift kit was selected, add it to cart
    if (buildSelection.liftKit) {
      const kit = buildSelection.liftKit;
      const price = kit.msrp || kit.mapPrice;
      if (price) {
        const item: CartAccessoryItem = {
          type: "accessory",
          category: "suspension",
          sku: kit.sku,
          name: kit.name,
          brand: kit.brand,
          imageUrl: kit.imageUrl || undefined,
          unitPrice: price,
          quantity: 1,
          required: false,
          reason: kit.liftHeight ? `${kit.liftHeight}" lift kit` : "Lift kit",
          spec: {
            liftHeight: kit.liftHeight || undefined,
            liftLevel: kit.liftLevel || undefined,
          },
          vehicle: {
            year: vehicleSelection.year,
            make: vehicleSelection.make,
            model: vehicleSelection.model,
          },
        };
        addAccessory(item);
        // Don't open cart drawer - let them continue shopping
      }
    }
    
    navigateToResults(vehicleSelection, buildSelection);
  }
  
  function navigateToResults(selection: VehicleSelection, buildSelection?: BuildTypeSelection) {
    const { year, make, model, modification, trim, wheelDia } = selection;
    const slug = vehicleSlug(year, make, model);
    
    // Build URL with vehicle context
    const params = new URLSearchParams();
    params.set("year", year);
    params.set("make", make);
    params.set("model", model);
    if (modification) params.set("modification", modification);
    if (trim && trim !== modification) params.set("trim", trim);
    if (wheelDia) params.set("wheelDia", String(wheelDia)); // OEM wheel diameter when multiple options
    if (packageFlow) params.set("package", "1");
    
    // ═══════════════════════════════════════════════════════════════════════════
    // HOMEPAGE INTENT: Preserve intent params through YMM selection
    // ═══════════════════════════════════════════════════════════════════════════
    if (intentState.isActive && intentState.config) {
      // Preserve entry and intent params
      params.set("entry", "homepage");
      params.set("intent", intentState.config.id);
      
      // Apply intent-specific defaults
      const { resolved } = intentState;
      
      // Build type
      if (resolved.buildType) {
        params.set("buildType", resolved.buildType);
      }
      
      // Lift level and offset range (for lifted builds)
      if (resolved.liftLevel) {
        params.set("liftLevel", resolved.liftLevel);
        const liftConfig = getLiftLevelConfig(resolved.liftLevel);
        if (liftConfig) {
          params.set("offsetMin", String(liftConfig.offsetMin));
          params.set("offsetMax", String(liftConfig.offsetMax));
          // Include lifted source params for the wheels page
          params.set("liftedSource", "homepage-intent");
          params.set("liftedInches", String(liftConfig.inches));
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // BUILD TYPE SELECTION: Apply params from build type step
    // ═══════════════════════════════════════════════════════════════════════════
    if (buildSelection) {
      params.set("buildType", buildSelection.buildType);
      
      if (buildSelection.liftLevel) {
        params.set("liftLevel", buildSelection.liftLevel);
        params.set("liftedSource", "build-flow");
        
        // Get inches from lift level config
        const inches = buildSelection.liftLevel === "leveled" ? 2 :
          buildSelection.liftLevel === "4in" ? 4 :
          buildSelection.liftLevel === "6in" ? 6 : 8;
        params.set("liftedInches", String(inches));
      }
      
      if (buildSelection.offsetMin !== undefined) {
        params.set("offsetMin", String(buildSelection.offsetMin));
      }
      if (buildSelection.offsetMax !== undefined) {
        params.set("offsetMax", String(buildSelection.offsetMax));
      }
      
      if (buildSelection.liftKit) {
        params.set("liftKitSku", buildSelection.liftKit.sku);
      }
    }
    
    // Redirect to vehicle-specific page
    const path = `/${productType}/v/${slug}?${params.toString()}`;
    router.push(path);
  }

  // Customize headline based on intent
  const headline = (() => {
    if (intentState.isActive && intentState.config) {
      switch (intentState.config.id) {
        case "lifted_35":
          return 'Build Your 35" Lifted Truck';
        case "street_performance":
          return "Build Your Street Performance Setup";
        case "stock":
          return "Find Factory-Fit Wheels";
        case "leveled":
          return "Build Your Leveled Truck";
        case "lifted":
          return "Build Your Lifted Truck";
        case "daily_driver":
          return "Build Your Daily Driver Package";
        case "all_terrain_tires":
          return "Find All-Terrain Tires";
        case "performance_tires":
          return "Find Performance Tires";
        case "truck_wheels":
          return "Find Truck Wheels";
        case "street_wheels":
          return "Find Street Wheels";
        case "lifted_packages":
          return "Build Your Lifted Package";
      }
    }
    return productType === "tires" 
      ? "Find Tires That Fit Your Vehicle"
      : "Find Wheels That Fit Your Vehicle";
  })();

  const subheadline = (() => {
    if (intentState.isActive && intentState.config) {
      switch (intentState.config.id) {
        case "lifted_35":
          return "Select your vehicle to see wheels and tires for your 35\" lifted build.";
        case "street_performance":
          return "Select your vehicle to see performance wheels matched to your ride.";
        case "stock":
          return "Select your vehicle to see wheels that fit perfectly with no modifications.";
        case "leveled":
          return "Select your vehicle to see wheels for your leveled stance.";
        case "lifted":
          return "Select your vehicle to see wheels for your lifted build.";
        case "daily_driver":
          return "Select your vehicle to see practical wheel and tire packages.";
        case "all_terrain_tires":
          return "Select your vehicle to see all-terrain tires that fit.";
        case "performance_tires":
          return "Select your vehicle to see high-performance tires.";
        case "truck_wheels":
          return "Select your vehicle to see truck-style wheels that fit.";
        case "street_wheels":
          return "Select your vehicle to see street-style wheels.";
        case "lifted_packages":
          return "Select your vehicle to see lifted wheel and tire packages.";
      }
    }
    return productType === "tires"
      ? "Enter your vehicle to see tires guaranteed to fit perfectly."
      : "Enter your vehicle to see wheels guaranteed to fit perfectly.";
  })();

  return (
    <div className="min-h-[70vh] bg-gradient-to-b from-neutral-100 to-neutral-50">
      {/* Hero Section */}
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        {/* Headline */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
            {headline}
          </h1>
          <p className="mt-3 text-lg text-neutral-600 max-w-lg mx-auto">
            {subheadline}
          </p>
        </div>

        {/* Selector Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-neutral-200 p-6 sm:p-8">
          {step === "vehicle" ? (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-red)] text-white">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-extrabold text-neutral-900">Select Your Vehicle</div>
                  <div className="text-xs text-neutral-500">We'll show only {productType} that fit</div>
                </div>
              </div>

              <SteppedVehicleSelector onComplete={handleVehicleComplete} />
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-white">
                  <span className="text-lg">🔧</span>
                </div>
                <div>
                  <div className="text-sm font-extrabold text-neutral-900">Choose Your Build</div>
                  <div className="text-xs text-neutral-500">Stock, leveled, or lifted?</div>
                </div>
              </div>

              {vehicleSelection && (
                <BuildTypeSelector
                  vehicle={{
                    year: vehicleSelection.year,
                    make: vehicleSelection.make,
                    model: vehicleSelection.model,
                    trim: vehicleSelection.trim,
                  }}
                  onComplete={handleBuildTypeComplete}
                  onBack={() => setStep("vehicle")}
                />
              )}
            </>
          )}
        </div>

        {/* Trust Signals */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <TrustSignal
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
            }
            title="Guaranteed Fit"
            description="Every product verified for your exact vehicle specifications"
          />
          <TrustSignal
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
            }
            title="Free Shipping"
            description="On orders over $599 to the lower 48 states"
          />
          <TrustSignal
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            }
            title="Expert Support"
            description="Call (248) 332-4120 for help with your selection"
          />
        </div>

        {/* Why Fitment Matters */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Why we need your vehicle
          </div>
          <p className="mt-4 text-sm text-neutral-600 max-w-lg mx-auto">
            {productType === "tires" 
              ? "Tires must match your vehicle's load rating, speed rating, and size specifications. Wrong tires can affect safety, handling, and warranty coverage."
              : "Wheels must match your vehicle's bolt pattern, center bore, and offset specifications. Wrong wheels won't mount correctly or may rub against suspension components."
            }
          </p>
        </div>
      </div>
    </div>
  );
}

function TrustSignal({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center text-center p-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 mb-3">
        {icon}
      </div>
      <div className="text-sm font-extrabold text-neutral-900">{title}</div>
      <div className="mt-1 text-xs text-neutral-500">{description}</div>
    </div>
  );
}
