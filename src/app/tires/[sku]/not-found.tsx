import Link from "next/link";

/**
 * Custom 404 page for tire detail pages.
 * Shows helpful message and navigation when a tire SKU is not found.
 * Returns proper 404 HTTP status (fixes soft 404 issue in Search Console).
 */
export default function TireNotFound() {
  return (
    <main className="bg-neutral-50 min-h-[60vh]">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 max-w-2xl mx-auto">
          <div className="flex items-start gap-4">
            <span className="text-4xl">🔍</span>
            <div>
              <h1 className="text-xl font-bold text-amber-900">Tire Not Found</h1>
              <p className="mt-2 text-amber-800">
                This tire may have been discontinued or is no longer available in our inventory.
                Don&apos;t worry — we have thousands of other options!
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link 
                  href="/tires" 
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
                >
                  Browse All Tires
                </Link>
                <Link 
                  href="/" 
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-5 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-50 transition-colors"
                >
                  Go to Homepage
                </Link>
              </div>
              <p className="mt-6 text-sm text-amber-700">
                Need help finding a specific tire? <Link href="/contact" className="underline font-medium">Contact us</Link> and we&apos;ll help you find the right fit.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
