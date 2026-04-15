"use client";

import {
  usePOS,
  POSLayout,
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
  // POSProvider is now in the layout, wrapping all /pos/* routes
  return (
    <POSLayout>
      <StepRouter />
    </POSLayout>
  );
}
