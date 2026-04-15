"use client";

import { use } from "react";
import { BuildProvider, useBuild, type BuildVehicle } from "@/components/build/BuildContext";
import { BuildHeader } from "@/components/build/BuildHeader";
import { BuildSummary } from "@/components/build/BuildSummary";
import { ContextualGuide } from "@/components/build/GuideVoice";
import { VehicleSelector } from "@/components/build/VehicleSelector";
import { WheelStep } from "@/components/build/WheelStep";
import { TireStep } from "@/components/build/TireStep";
import { ConfidenceLayer } from "@/components/build/ConfidenceLayer";

// ============================================================================
// Step Content Renderer
// ============================================================================

function StepContent() {
  const { state } = useBuild();
  
  switch (state.step) {
    case "vehicle":
      return <VehicleSelector />;
    case "wheels":
      return <WheelStep />;
    case "tires":
      return <TireStep />;
    case "review":
      return <ConfidenceLayer />;
    default:
      return <VehicleSelector />;
  }
}

// ============================================================================
// Build Layout
// ============================================================================

function BuildLayout() {
  const { state } = useBuild();
  
  // Vehicle selection is full-width centered
  if (state.step === "vehicle") {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <StepContent />
        </div>
      </main>
    );
  }
  
  // Review step is also full-width centered
  if (state.step === "review") {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <BuildHeader />
        <div className="mx-auto max-w-7xl px-4 py-8">
          {/* Guide */}
          <div className="max-w-2xl mx-auto mb-8">
            <ContextualGuide />
          </div>
          
          <StepContent />
        </div>
      </main>
    );
  }
  
  // Wheels and Tires steps have sidebar
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <BuildHeader />
      
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex gap-8">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Guide */}
            <div className="mb-6">
              <ContextualGuide />
            </div>
            
            {/* Step content */}
            <StepContent />
          </div>
          
          {/* Sidebar - Summary */}
          <div className="hidden lg:block w-80 flex-shrink-0">
            <BuildSummary />
          </div>
        </div>
      </div>
      
      {/* Mobile summary bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 px-4 py-3 shadow-lg z-40">
        <MobileSummaryBar />
      </div>
    </main>
  );
}

// ============================================================================
// Mobile Summary Bar
// ============================================================================

function MobileSummaryBar() {
  const { state, totalPrice, isComplete, goToStep } = useBuild();
  
  return (
    <div className="flex items-center justify-between">
      <div>
        {totalPrice > 0 ? (
          <>
            <div className="text-xs text-neutral-500">Package Total</div>
            <div className="text-xl font-bold text-neutral-900">${totalPrice.toLocaleString()}</div>
          </>
        ) : (
          <>
            <div className="text-xs text-neutral-500">Build your package</div>
            <div className="text-sm font-medium text-neutral-700">
              {state.wheel ? "Select tires" : "Select wheels"}
            </div>
          </>
        )}
      </div>
      
      {isComplete && (
        <button
          onClick={() => goToStep("review")}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white font-bold text-sm"
        >
          Review Build
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Main Client Component
// ============================================================================

export function BuildPageClient({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ 
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
  }>;
}) {
  const searchParams = use(searchParamsPromise);
  
  // Check if vehicle is provided via URL params
  const initialVehicle: BuildVehicle | undefined = 
    searchParams.year && searchParams.make && searchParams.model
      ? {
          year: searchParams.year,
          make: searchParams.make,
          model: searchParams.model,
          trim: searchParams.trim,
        }
      : undefined;
  
  return (
    <BuildProvider initialVehicle={initialVehicle}>
      <BuildLayout />
    </BuildProvider>
  );
}
