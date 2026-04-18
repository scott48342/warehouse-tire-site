"use client";

import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/lib/cart/CartContext";
import type { CartAccessoryItem } from "@/lib/cart/accessoryTypes";

// Types
interface LiftKit {
  sku: string;
  name: string;
  brand: string;
  productType: string;
  liftHeight: number | null;
  liftLevel: string | null;
  yearRange: string;
  msrp: number | null;
  mapPrice: number | null;
  imageUrl: string | null;
  inStock: boolean;
  inventory: number;
}

interface LiftLevelGroup {
  liftLevel: string;
  label: string;
  inches: number;
  kits: LiftKit[];
  count: number;
}

interface SearchFilters {
  brands: { name: string; count: number }[];
  liftRange: { min: number | null; max: number | null };
  liftLevels: { id: string; label: string; inches: number }[];
}

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 30 }, (_, i) => String(THIS_YEAR - i));

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

type VehicleSelectorStep = "year" | "make" | "model";

function makeInitials(make: string) {
  const cleaned = String(make || "").trim();
  if (!cleaned) return "";
  const parts = cleaned.split(/\s+/g).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || "");
  return letters.join("") || cleaned.slice(0, 2).toUpperCase();
}

function makeHue(make: string) {
  let h = 0;
  for (let i = 0; i < make.length; i++) h = (h * 31 + make.charCodeAt(i)) >>> 0;
  return h % 360;
}

function VehicleSelector({
  initialYear,
  initialMake,
  initialModel,
  onSelect,
}: {
  initialYear?: string;
  initialMake?: string;
  initialModel?: string;
  onSelect: (v: { year: string; make: string; model: string }) => void;
}) {
  const [step, setStep] = useState<VehicleSelectorStep>(
    initialModel ? "model" : initialMake ? "make" : initialYear ? "year" : "year"
  );
  const [year, setYear] = useState(initialYear || "");
  const [make, setMake] = useState(initialMake || "");
  const [model, setModel] = useState(initialModel || "");
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Load makes when year is selected
  useEffect(() => {
    if (!year) { setMakes([]); return; }
    setLoading(true);
    fetchJson<{ results?: string[] }>(`/api/vehicles/makes?year=${year}`)
      .then(data => setMakes(data.results || []))
      .catch(() => setMakes([]))
      .finally(() => setLoading(false));
  }, [year]);

  // Load models when make is selected
  useEffect(() => {
    if (!year || !make) { setModels([]); return; }
    setLoading(true);
    fetchJson<{ results?: string[] }>(`/api/vehicles/models?year=${year}&make=${make}`)
      .then(data => setModels(data.results || []))
      .catch(() => setModels([]))
      .finally(() => setLoading(false));
  }, [year, make]);

  const selectYear = (y: string) => {
    setYear(y);
    setMake("");
    setModel("");
    setStep("make");
  };

  const selectMake = (m: string) => {
    setMake(m);
    setModel("");
    setStep("model");
  };

  const selectModel = (m: string) => {
    setModel(m);
    onSelect({ year, make, model: m });
  };

  const reset = () => {
    setStep("year");
    setYear("");
    setMake("");
    setModel("");
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-neutral-900">Find Lift Kits for Your Vehicle</h2>
        {(year || make || model) && (
          <button 
            type="button" 
            onClick={reset} 
            className="text-sm font-semibold text-amber-600 hover:text-amber-700"
          >
            Start over
          </button>
        )}
      </div>

      {/* Breadcrumbs */}
      {(year || make) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {year && (
            <button
              type="button"
              onClick={() => { setStep("year"); setMake(""); setModel(""); }}
              className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-700 hover:bg-amber-50 hover:border-amber-200"
            >
              {year} ✕
            </button>
          )}
          {make && (
            <button
              type="button"
              onClick={() => { setStep("make"); setModel(""); }}
              className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-700 hover:bg-amber-50 hover:border-amber-200"
            >
              {make} ✕
            </button>
          )}
        </div>
      )}

      {loading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-neutral-600">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-amber-500" />
          Loading...
        </div>
      )}

      {/* Year Selection */}
      {!loading && step === "year" && (
        <div className="mt-4">
          <div className="text-xs font-semibold text-neutral-500 mb-2">SELECT YEAR</div>
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-48 overflow-y-auto">
            {YEARS.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => selectYear(y)}
                className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-900 hover:border-amber-400 hover:bg-amber-50 transition-colors"
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Make Selection */}
      {!loading && step === "make" && makes.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold text-neutral-500 mb-2">SELECT MAKE</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
            {makes.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => selectMake(m)}
                className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-left text-sm font-semibold text-neutral-900 hover:border-amber-400 hover:bg-amber-50 transition-colors"
              >
                <div
                  className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg border border-neutral-200 text-xs font-extrabold"
                  style={{ background: `hsla(${makeHue(m)}, 70%, 92%, 1)` }}
                >
                  {makeInitials(m)}
                </div>
                <span className="truncate">{m}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Model Selection */}
      {!loading && step === "model" && models.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold text-neutral-500 mb-2">SELECT MODEL</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
            {models.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => selectModel(m)}
                className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-left text-sm font-semibold text-neutral-900 hover:border-amber-400 hover:bg-amber-50 transition-colors"
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LiftKitCard({ kit, vehicle }: { kit: LiftKit; vehicle?: { year: string; make: string; model: string } }) {
  const { addAccessory, setIsOpen } = useCart();
  const [added, setAdded] = useState(false);
  
  const price = kit.msrp || kit.mapPrice;
  const formatPrice = (p: number) => `$${p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Build PDP URL with vehicle context
  const pdpUrl = vehicle
    ? `/suspension/${kit.sku}?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}`
    : `/suspension/${kit.sku}`;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!price) return;
    
    const item: CartAccessoryItem = {
      type: "accessory",
      category: "suspension",
      sku: kit.sku,
      name: kit.name,
      brand: kit.brand,
      imageUrl: kit.imageUrl || undefined,
      unitPrice: price,
      quantity: 1,
      required: false,
      reason: kit.liftHeight ? `${kit.liftHeight}" lift kit` : "Suspension kit",
      spec: {
        liftHeight: kit.liftHeight || undefined,
        liftLevel: kit.liftLevel || undefined,
        productType: kit.productType,
      },
      vehicle,
    };
    
    addAccessory(item);
    setAdded(true);
    setIsOpen(true);
    
    // Reset "added" state after 2 seconds
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <Link href={pdpUrl} className="group rounded-2xl border border-neutral-200 bg-white overflow-hidden hover:border-amber-300 hover:shadow-lg transition-all block">
      {/* Image */}
      <div className="aspect-[4/3] bg-neutral-100 relative overflow-hidden">
        {kit.imageUrl ? (
          <img 
            src={kit.imageUrl} 
            alt={kit.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-400">
            <span className="text-4xl">🔧</span>
          </div>
        )}
        {kit.inStock && (
          <span className="absolute top-3 right-3 rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-700">
            In Stock
          </span>
        )}
      </div>
      
      {/* Content */}
      <div className="p-4">
        <div className="text-xs font-semibold text-neutral-500">{kit.brand}</div>
        <h3 className="mt-1 text-sm font-bold text-neutral-900 line-clamp-2 group-hover:text-purple-700 transition-colors">{kit.name}</h3>
        
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {kit.liftHeight && (
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
              {kit.liftHeight}" Lift
            </span>
          )}
          <span className="text-xs text-neutral-500">{kit.yearRange}</span>
        </div>
        
        {price ? (
          <>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-lg font-extrabold text-neutral-900">{formatPrice(price)}</span>
              <span className="text-xs text-neutral-500">each</span>
            </div>

            <button 
              onClick={handleAddToCart}
              disabled={added}
              className={`mt-3 w-full rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                added 
                  ? "bg-green-500 text-white cursor-default"
                  : "bg-neutral-900 text-white hover:bg-neutral-800"
              }`}
            >
              {added ? "✓ Added to Cart" : "Add to Cart"}
            </button>
          </>
        ) : (
          <div className="mt-3">
            <span className="text-sm text-neutral-500">Call for pricing</span>
            <a 
              href="tel:+12483324120"
              className="mt-2 block w-full rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white text-center hover:bg-amber-600 transition-colors"
            >
              Call 248-332-4120
            </a>
          </div>
        )}
      </div>
    </Link>
  );
}

function LiftLevelSection({ group, vehicle }: { group: LiftLevelGroup; vehicle?: { year: string; make: string; model: string } }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-xl font-extrabold text-neutral-900">{group.label}</h3>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-sm font-semibold text-neutral-600">
          {group.count} kits
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {group.kits.map(kit => (
          <LiftKitCard key={kit.sku} kit={kit} vehicle={vehicle} />
        ))}
      </div>
    </div>
  );
}

function SuspensionSearchContent() {
  const searchParams = useSearchParams();
  
  const [vehicle, setVehicle] = useState({
    year: searchParams.get("year") || "",
    make: searchParams.get("make") || "",
    model: searchParams.get("model") || "",
  });
  const [liftLevel, setLiftLevel] = useState(searchParams.get("liftLevel") || "");
  const [brand, setBrand] = useState(searchParams.get("brand") || "");
  
  const [results, setResults] = useState<LiftKit[]>([]);
  const [byLevel, setByLevel] = useState<LiftLevelGroup[]>([]);
  const [filters, setFilters] = useState<SearchFilters | null>(null);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [searched, setSearched] = useState(false);

  const search = async (v: { year: string; make: string; model: string }) => {
    setVehicle(v);
    setLoading(true);
    setSearched(true);
    
    try {
      const params = new URLSearchParams({
        year: v.year,
        make: v.make,
        model: v.model,
        groupByLevel: "true",
        pageSize: "100",
      });
      if (liftLevel) params.set("liftLevel", liftLevel);
      if (brand) params.set("brand", brand);
      
      // Update URL
      window.history.replaceState({}, "", `/suspension?${params.toString()}`);
      
      const res = await fetch(`/api/suspension/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setByLevel(data.byLevel || []);
        setFilters(data.filters || null);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error("Search failed", e);
    }
    setLoading(false);
  };

  // Initial search if params are present
  useEffect(() => {
    const y = searchParams.get("year");
    const m = searchParams.get("make");
    const mo = searchParams.get("model");
    if (y && m && mo) {
      search({ year: y, make: m, model: mo });
    }
  }, []);

  return (
    <>
      <VehicleSelector 
        initialYear={vehicle.year}
        initialMake={vehicle.make}
        initialModel={vehicle.model}
        onSelect={search}
      />
      
      {/* Filters */}
      {filters && total > 0 && (
        <div className="mt-6 flex flex-wrap gap-4">
          {/* Lift Level Filter */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1">Lift Level</label>
            <select
              value={liftLevel}
              onChange={(e) => { setLiftLevel(e.target.value); search(vehicle); }}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">All Levels</option>
              {filters.liftLevels.map(l => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </div>
          
          {/* Brand Filter */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1">Brand</label>
            <select
              value={brand}
              onChange={(e) => { setBrand(e.target.value); search(vehicle); }}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">All Brands</option>
              {filters.brands.map(b => (
                <option key={b.name} value={b.name}>{b.name} ({b.count})</option>
              ))}
            </select>
          </div>
        </div>
      )}
      
      {/* Results */}
      {loading ? (
        <div className="mt-8 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-amber-500" />
        </div>
      ) : searched && total === 0 ? (
        <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-8 text-center">
          <span className="text-4xl">🔧</span>
          <h3 className="mt-3 text-lg font-bold text-neutral-900">No lift kits found</h3>
          <p className="mt-1 text-sm text-neutral-600">
            We don't have lift kit data for this vehicle yet.
            <br />
            <a href="tel:+12483324120" className="text-amber-600 font-semibold hover:underline">
              Call us at 248-332-4120
            </a>{" "}
            for recommendations.
          </p>
        </div>
      ) : byLevel.length > 0 ? (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-extrabold text-neutral-900">
              Lift Kits for {vehicle.year} {vehicle.make} {vehicle.model}
            </h2>
            <span className="rounded-full bg-amber-100 px-4 py-1.5 text-sm font-bold text-amber-800">
              {total} results
            </span>
          </div>
          {byLevel.map(group => (
            <LiftLevelSection key={group.liftLevel} group={group} vehicle={vehicle} />
          ))}
        </div>
      ) : results.length > 0 ? (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-extrabold text-neutral-900">
              Lift Kits for {vehicle.year} {vehicle.make} {vehicle.model}
            </h2>
            <span className="rounded-full bg-amber-100 px-4 py-1.5 text-sm font-bold text-amber-800">
              {total} results
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map(kit => (
              <LiftKitCard key={kit.sku} kit={kit} vehicle={vehicle} />
            ))}
          </div>
        </div>
      ) : !searched ? (
        <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-8 text-center">
          <span className="text-4xl">🛻</span>
          <h3 className="mt-3 text-lg font-bold text-neutral-900">Select your vehicle</h3>
          <p className="mt-1 text-sm text-neutral-600">
            Choose your year, make, and model above to find compatible lift kits.
          </p>
        </div>
      ) : null}
    </>
  );
}

export default function SuspensionPage() {
  return (
    <main className="bg-neutral-50 min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-b from-neutral-900 to-neutral-800 text-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex items-center gap-2 text-purple-400 text-sm font-semibold">
            <span>🔧</span>
            <span>Suspension & Lift Kits</span>
          </div>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
            Lift Kits & Leveling Kits
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-neutral-300">
            Find the right suspension upgrade for your truck or SUV.
            Leveling kits, lift kits, and complete suspension systems.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <Suspense fallback={<div className="animate-pulse h-40 bg-neutral-100 rounded-2xl" />}>
          <SuspensionSearchContent />
        </Suspense>
      </section>

      {/* Help Section */}
      <section className="mx-auto max-w-6xl px-4 pb-12">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-extrabold text-neutral-900">Need Help Choosing?</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Not sure which lift kit is right for your build? Our experts can help you choose 
            the right suspension for your goals, whether it's a leveling kit for aesthetics 
            or a full lift for serious off-roading.
          </p>
          <div className="mt-4 flex flex-wrap gap-4">
            <a
              href="tel:+12483324120"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-600 transition-colors"
            >
              <span>📞</span>
              <span>Call 248-332-4120</span>
            </a>
            <Link
              href="/lifted"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-neutral-200 bg-white px-5 py-2.5 text-sm font-bold text-neutral-900 hover:border-amber-300 hover:bg-amber-50 transition-colors"
            >
              <span>🏔️</span>
              <span>Build a Lifted Setup</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
