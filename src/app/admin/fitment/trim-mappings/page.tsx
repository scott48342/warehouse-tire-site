/**
 * Admin: Wheel-Size Trim Mappings Review
 * 
 * Review, approve, reject, and monitor trim mappings that control
 * OEM wheel/tire package selection behavior.
 * 
 * NO REGRESSION RULES:
 * - Do NOT change customer-facing trim/submodel labels
 * - Do NOT expose Wheel-Size engine labels as replacement trims
 * - Approved mappings ONLY control OEM package chooser behavior
 * - Do NOT auto-approve mappings
 */

import { Suspense } from "react";
import { TrimMappingsClient } from "./TrimMappingsClient";

export const dynamic = "force-dynamic";

export default function TrimMappingsPage() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-screen-2xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-neutral-900">
            Wheel-Size Trim Mappings
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Review and approve mappings that control OEM package/configuration selection.
          </p>
          
          {/* Safety Warning */}
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
            <h3 className="flex items-center gap-2 font-semibold text-amber-800">
              <span>⚠️</span>
              <span>Safety Rules</span>
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-amber-700">
              <li>• Approved mappings control <strong>wheel/tire package selection only</strong></li>
              <li>• Do NOT treat Wheel-Size engine labels as customer-facing trims</li>
              <li>• Low-confidence mappings are <strong>ignored at runtime</strong> until reviewed</li>
              <li>• Multiple configs should appear as "factory package options", not submodels</li>
            </ul>
          </div>
        </div>
        
        {/* Client Component */}
        <Suspense fallback={<LoadingSkeleton />}>
          <TrimMappingsClient />
        </Suspense>
      </div>
    </main>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-64 animate-pulse rounded bg-neutral-200" />
      <div className="h-96 animate-pulse rounded-lg bg-neutral-200" />
    </div>
  );
}
