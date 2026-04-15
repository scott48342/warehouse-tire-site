"use client";

import {
  usePOS,
  POSStepIndicator,
  POSFooter,
  POSVehicleStep,
  POSPackageStep,
  POSPricingStep,
  POSQuoteStep,
} from "@/components/pos";

// ============================================================================
// Step Router
// ============================================================================

function StepRouter() {
  const { state } = usePOS();
  
  switch (state.step) {
    case "vehicle":
      return <POSVehicleStep />;
    case "package":
      return <POSPackageStep />;
    case "pricing":
      return <POSPricingStep />;
    case "quote":
      return <POSQuoteStep />;
    default:
      return <POSVehicleStep />;
  }
}

// ============================================================================
// Main POS Page Client
// ============================================================================

export function POSPageClient() {
  // POSProvider and POSHeader are in the app layout (shared across all /pos/* routes)
  // This page has its own dark theme container
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      <POSStepIndicator />
      <main className="flex-1">
        <StepRouter />
      </main>
      <POSFooter />
    </div>
  );
}
