"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface Brand {
  name: string;
  count: number;
}

function WheelBrandsContent() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const sp = useSearchParams();

  useEffect(() => {
    fetch("/api/wheels/brands")
      .then((r) => r.json())
      .then((data) => {
        setBrands(data.brands || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Build fitment params to preserve vehicle selection
  const fitmentParams = new URLSearchParams();
  if (sp.get("year")) fitmentParams.set("year", sp.get("year")!);
  if (sp.get("make")) fitmentParams.set("make", sp.get("make")!);
  if (sp.get("model")) fitmentParams.set("model", sp.get("model")!);
  if (sp.get("trim")) fitmentParams.set("trim", sp.get("trim")!);

  const filtered = brands.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  // Group brands by first letter for easier scanning
  const grouped = filtered.reduce((acc, brand) => {
    const letter = brand.name[0].toUpperCase();
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(brand);
    return acc;
  }, {} as Record<string, Brand[]>);

  const letters = Object.keys(grouped).sort();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-neutral-900">Shop Wheels by Brand</h1>
        <p className="mt-2 text-neutral-600">
          Browse our selection of {brands.length} wheel brands
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search brands..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:border-neutral-400 focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-900" />
        </div>
      ) : (
        <>
          {/* Letter Quick Jump */}
          <div className="mb-6 flex flex-wrap gap-2">
            {letters.map((letter) => (
              <a
                key={letter}
                href={`#letter-${letter}`}
                className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-extrabold text-neutral-900 hover:bg-neutral-50"
              >
                {letter}
              </a>
            ))}
          </div>

          {/* Brand Pills by Letter */}
          <div className="space-y-8">
            {letters.map((letter) => (
              <div key={letter} id={`letter-${letter}`}>
                <h2 className="mb-3 text-lg font-extrabold text-neutral-900">{letter}</h2>
                <div className="flex flex-wrap gap-2">
                  {grouped[letter].map((brand) => {
                    const href = `/wheels?brand=${encodeURIComponent(brand.name)}${fitmentParams.toString() ? `&${fitmentParams.toString()}` : ""}`;
                    return (
                      <Link
                        key={brand.name}
                        href={href}
                        className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition-all hover:border-[var(--brand-red)] hover:bg-red-50 hover:text-[var(--brand-red)]"
                      >
                        {brand.name}
                        <span className="ml-1.5 text-xs text-neutral-500">({brand.count})</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="py-12 text-center text-neutral-500">
              No brands found matching &quot;{search}&quot;
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function WheelBrandsPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-neutral-900">Shop Wheels by Brand</h1>
          <p className="mt-2 text-neutral-600">Loading brands...</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-900" />
        </div>
      </div>
    }>
      <WheelBrandsContent />
    </Suspense>
  );
}
