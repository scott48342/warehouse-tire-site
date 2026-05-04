"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { extractDisplayTrim } from "@/lib/vehicleDisplay";

// ============================================================================
// Types (matches GarageWidget)
// ============================================================================

type Fitment = {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  modification?: string;
};

type GarageItem = Fitment & {
  savedAt: number;
};

const KEY = "wt_garage";
const MAX = 5;

// ============================================================================
// LocalStorage Helpers
// ============================================================================

function readGarage(): GarageItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? (data as GarageItem[]).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeGarage(items: GarageItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    // ignore
  }
}

function fitmentKey(f: Fitment) {
  return [f.year, f.make, f.model, f.modification].filter(Boolean).join("|");
}

function formatVehicle(f: Fitment) {
  const cleanTrim = extractDisplayTrim(f.trim ?? "");
  return [f.year, f.make, f.model, cleanTrim].filter(Boolean).join(" ");
}

function buildShopUrl(f: Fitment, type: "tires" | "wheels" | "packages") {
  const params = new URLSearchParams();
  if (f.year) params.set("year", f.year);
  if (f.make) params.set("make", f.make);
  if (f.model) params.set("model", f.model);
  if (f.modification) params.set("modification", f.modification);
  if (f.trim) params.set("trim", f.trim);
  return `/${type}?${params.toString()}`;
}

// ============================================================================
// Page Component
// ============================================================================

export default function GaragePage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<GarageItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setVehicles(readGarage().sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)));
  }, []);

  const handleRemove = (item: GarageItem) => {
    const k = fitmentKey(item);
    const next = vehicles.filter((v) => fitmentKey(v) !== k);
    writeGarage(next);
    setVehicles(next);
  };

  const handleClearAll = () => {
    writeGarage([]);
    setVehicles([]);
  };

  // SSR placeholder
  if (!mounted) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-bold text-neutral-900">My Garage</h1>
        <p className="mt-2 text-neutral-600">Loading your saved vehicles...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">My Garage</h1>
          <p className="mt-1 text-neutral-600">
            Save up to {MAX} vehicles for quick access when shopping.
          </p>
        </div>
        {vehicles.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-sm font-medium text-red-600 hover:text-red-700 hover:underline"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Empty State */}
      {vehicles.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50 p-12 text-center">
          <div className="text-5xl mb-4">🚗</div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">No vehicles saved yet</h2>
          <p className="text-neutral-600 mb-6 max-w-md mx-auto">
            When you search for tires or wheels, you can save your vehicle to quickly access it later.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/tires"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              🔘 Shop Tires
            </Link>
            <Link
              href="/wheels"
              className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-6 py-3 font-semibold text-white hover:bg-neutral-800 transition-colors"
            >
              🛞 Shop Wheels
            </Link>
          </div>
        </div>
      )}

      {/* Vehicle List */}
      {vehicles.length > 0 && (
        <div className="space-y-4">
          {vehicles.map((vehicle, index) => {
            const key = fitmentKey(vehicle);
            const vehicleName = formatVehicle(vehicle);
            const savedDate = vehicle.savedAt
              ? new Date(vehicle.savedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : null;

            return (
              <div
                key={key}
                className="group rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  {/* Vehicle Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {index === 0 ? "⭐" : "🚗"}
                      </span>
                      <div>
                        <h2 className="text-lg font-bold text-neutral-900 truncate">
                          {vehicleName}
                        </h2>
                        {savedDate && (
                          <p className="text-sm text-neutral-500">
                            Saved {savedDate}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemove(vehicle)}
                    className="text-neutral-400 hover:text-red-600 transition-colors p-2 -m-2"
                    title="Remove from garage"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Shop Links */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={buildShopUrl(vehicle, "tires")}
                    className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-blue-500 hover:text-blue-600 transition-colors"
                  >
                    🔘 Tires
                  </Link>
                  <Link
                    href={buildShopUrl(vehicle, "wheels")}
                    className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-900 hover:text-neutral-900 transition-colors"
                  >
                    🛞 Wheels
                  </Link>
                  <Link
                    href={buildShopUrl(vehicle, "packages")}
                    className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-green-600 hover:text-green-600 transition-colors"
                  >
                    📦 Packages
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info Footer */}
      <div className="mt-12 rounded-xl bg-neutral-100 p-6">
        <h3 className="font-semibold text-neutral-900 mb-2">💡 How it works</h3>
        <ul className="space-y-2 text-sm text-neutral-600">
          <li>• Vehicles are saved in your browser (no account needed)</li>
          <li>• We store up to {MAX} vehicles at a time</li>
          <li>• Click a vehicle to quickly shop matching tires, wheels, or packages</li>
          <li>• Your garage syncs across tabs in the same browser</li>
        </ul>
      </div>
    </main>
  );
}
