import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ProductsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Product Controls</h1>
        <p className="text-neutral-400 mt-1">
          Hide or flag products from search results
        </p>
      </div>

      {/* Category Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/admin/products/wheels"
          className="bg-neutral-800 rounded-xl border border-neutral-700 p-6 hover:border-neutral-600 transition-colors"
        >
          <div className="flex items-center gap-4">
            <span className="text-4xl">🛞</span>
            <div>
              <div className="text-lg font-bold text-white">Wheels</div>
              <div className="text-sm text-neutral-400">
                Manage wheel SKU visibility
              </div>
            </div>
          </div>
        </Link>

        <Link
          href="/admin/products/tires"
          className="bg-neutral-800 rounded-xl border border-neutral-700 p-6 hover:border-neutral-600 transition-colors"
        >
          <div className="flex items-center gap-4">
            <span className="text-4xl">⚫</span>
            <div>
              <div className="text-lg font-bold text-white">Tires</div>
              <div className="text-sm text-neutral-400">
                Manage tire SKU visibility
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Coming Soon */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-8 text-center">
        <div className="text-4xl mb-4">🛞</div>
        <div className="text-lg font-medium text-white">Coming Soon</div>
        <div className="text-sm text-neutral-400 mt-1">
          Product controls will be available in the next update
        </div>
      </div>
    </div>
  );
}
