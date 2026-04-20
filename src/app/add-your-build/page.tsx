import { Suspense } from "react";
import AddYourBuildClient from "./AddYourBuildClient";

// Force dynamic rendering for useSearchParams
export const dynamic = "force-dynamic";

function LoadingFallback() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-neutral-900 mb-2">
            Add Your Build
          </h1>
          <p className="text-neutral-600">
            Show off your ride and inspire other enthusiasts
          </p>
        </div>
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
        </div>
      </div>
    </main>
  );
}

export default function AddYourBuildPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AddYourBuildClient />
    </Suspense>
  );
}
