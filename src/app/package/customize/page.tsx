/**
 * Package Customization Page
 * 
 * Route: /package/customize?packageId=...&wheelSku=...&tireSize=...
 * 
 * Allows users to:
 * - See pre-selected wheel + tire from package
 * - Swap tire brand (same size)
 * - Make minor size adjustments (validated)
 * - Add to cart
 */

import { Suspense } from "react";
import PackageCustomizer from "./PackageCustomizer";

export const metadata = {
  title: "Customize Your Package | Warehouse Tire Direct",
  description: "Customize your wheel and tire package. Swap tire brands, adjust sizes, and add accessories.",
};

export default function PackageCustomizePage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Suspense fallback={<CustomizePageSkeleton />}>
        <PackageCustomizer />
      </Suspense>
    </main>
  );
}

function CustomizePageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-64 bg-neutral-200 rounded mb-6" />
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="h-64 bg-neutral-200 rounded-lg" />
          <div className="h-24 bg-neutral-200 rounded-lg" />
        </div>
        <div className="space-y-4">
          <div className="h-64 bg-neutral-200 rounded-lg" />
          <div className="h-24 bg-neutral-200 rounded-lg" />
        </div>
      </div>
      <div className="mt-8 h-32 bg-neutral-200 rounded-lg" />
    </div>
  );
}
