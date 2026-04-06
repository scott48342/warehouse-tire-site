"use client";

import Link from "next/link";
import PopularityTable from "../PopularityTable";

export default function TopTiresPage() {
  return (
    <main className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-2">
            <Link href="/admin" className="hover:underline">
              Admin
            </Link>
            <span>/</span>
            <Link href="/admin/cart-popularity" className="hover:underline">
              Cart Popularity
            </Link>
            <span>/</span>
            <span className="text-neutral-900">Tires</span>
          </div>
          <h1 className="text-3xl font-extrabold text-neutral-900">
            🔴 Top Tires Added to Cart
          </h1>
          <p className="text-neutral-500 mt-1">
            Track which tires customers are most interested in
          </p>
        </div>

        {/* Popularity Table */}
        <PopularityTable
          productType="tire"
          title="Top Tires"
          emoji="🔴"
        />

        {/* Footer Links */}
        <div className="mt-8 pt-6 border-t border-neutral-200 flex gap-4">
          <Link href="/admin/cart-popularity" className="text-neutral-600 hover:underline">
            ← Back to Overview
          </Link>
          <Link href="/admin/cart-popularity/wheels" className="text-neutral-600 hover:underline">
            View Wheels
          </Link>
        </div>
      </div>
    </main>
  );
}
