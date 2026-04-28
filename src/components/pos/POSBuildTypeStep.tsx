"use client";

import { usePOS } from "./POSContext";

// ============================================================================
// Super Minimal Component - No extra hooks
// ============================================================================

function POSBuildTypeStepInner() {
  // ONLY usePOS - no useState, no useEffect, no useRouter
  const { state, goToStep } = usePOS();
  
  // Debug logging
  console.log("[POSBuildTypeStep] Rendering...");
  console.log("[POSBuildTypeStep] state:", state);
  console.log("[POSBuildTypeStep] state.vehicle:", state.vehicle);
  
  // Safety check
  if (!state.vehicle) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 text-center text-white">
        <p>Loading vehicle data...</p>
      </div>
    );
  }
  
  // Render with explicit String conversions
  const year = String(state.vehicle.year);
  const make = String(state.vehicle.make);
  const model = String(state.vehicle.model);
  const trim = state.vehicle.trim ? String(state.vehicle.trim) : "N/A";
  
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 text-center text-white">
      <h1 className="text-2xl font-bold">Build Type Step (Minimal)</h1>
      <p className="mt-4">Vehicle: {year} {make} {model}</p>
      <p className="mt-2">Trim: {trim}</p>
      <p className="mt-4 text-green-400">If you see this, the component renders!</p>
      <button
        onClick={() => goToStep("vehicle")}
        className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg"
      >
        ← Back to Vehicle
      </button>
    </div>
  );
}

// Exported directly - no error boundary
export function POSBuildTypeStep() {
  return <POSBuildTypeStepInner />;
}
