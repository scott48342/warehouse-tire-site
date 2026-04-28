"use client";

// ============================================================================
// Absolutely Minimal - NO HOOKS AT ALL
// ============================================================================

export function POSBuildTypeStep() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 text-center text-white">
      <h1 className="text-2xl font-bold">Build Type Step</h1>
      <p className="mt-4 text-green-400">Static render - no hooks!</p>
    </div>
  );
}
