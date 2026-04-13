"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/cart/CartContext";
import { TrustBadgesRow, TrustBadge } from "@/components/TrustBadges";
import { CompleteYourSetup } from "@/components/CompleteYourSetup";

// ============================================================================
// Types
// ============================================================================

interface WheelData {
  sku: string;
  brand: string;
  model: string;
  finish?: string;
  diameter: number;
  width: number;
  offset: number;
  price: number;
  imageUrl: string | null;
  boltPattern: string;
}

interface TireOption {
  partNumber: string;
  brand: string;
  model: string;
  size: string;
  price: number;
  imageUrl: string | null;
  inStock: boolean;
}

interface PackageState {
  wheel: WheelData | null;
  tire: TireOption | null;
  alternativeTires: TireOption[];
  loading: boolean;
  error: string | null;
}

// ============================================================================
// Main Component
// ============================================================================

export default function PackageCustomizer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { addItem, setIsOpen } = useCart();

  const packageId = searchParams.get("packageId");
  const wheelSku = searchParams.get("wheelSku");
  const tireSize = searchParams.get("tireSize");
  const year = searchParams.get("year");
  const make = searchParams.get("make");
  const model = searchParams.get("model");
  const trim = searchParams.get("trim");
  
  // Wheel data passed directly from package selection
  const wheelBrand = searchParams.get("wheelBrand");
  const wheelModel = searchParams.get("wheelModel");
  const wheelFinish = searchParams.get("wheelFinish");
  const wheelDiameter = searchParams.get("wheelDiameter");
  const wheelWidth = searchParams.get("wheelWidth");
  const wheelOffset = searchParams.get("wheelOffset");
  const wheelPrice = searchParams.get("wheelPrice");
  const wheelImage = searchParams.get("wheelImage");
  const wheelBoltPattern = searchParams.get("wheelBoltPattern");

  const [state, setState] = useState<PackageState>({
    wheel: null,
    tire: null,
    alternativeTires: [],
    loading: true,
    error: null,
  });

  const [selectedTire, setSelectedTire] = useState<TireOption | null>(null);
  const [quantity, setQuantity] = useState(4);

  // Fetch package data
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      if (!wheelSku || !tireSize) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: "Missing wheel or tire selection",
        }));
        return;
      }

      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        // Use wheel data from URL params if available (from package selection)
        let wheel: WheelData | null = null;
        
        if (wheelBrand && wheelDiameter && wheelWidth && wheelPrice) {
          // We have wheel data passed directly - no API call needed
          wheel = {
            sku: wheelSku,
            brand: wheelBrand,
            model: wheelModel || "",
            finish: wheelFinish || undefined,
            diameter: Number(wheelDiameter) || 0,
            width: Number(wheelWidth) || 0,
            offset: Number(wheelOffset) || 0,
            price: Number(wheelPrice) || 0,
            imageUrl: wheelImage || null,
            boltPattern: wheelBoltPattern || "",
          };
        } else {
          // Fallback: try to fetch wheel data (may not work without proper API)
          const wheelRes = await fetch(`/api/wheels/search?sku=${encodeURIComponent(wheelSku)}&limit=1`);
          const wheelData = await wheelRes.json();
          
          const w = wheelData.results?.[0] || wheelData.styles?.[0];
          if (!w) {
            throw new Error("Wheel not found");
          }
          
          wheel = {
            sku: w.sku || wheelSku,
            brand: w.brand?.description || w.brand?.code || w.brand || "Unknown",
            model: w.title || w.model || "",
            finish: w.properties?.abbreviated_finish_desc || w.finish,
            diameter: Number(w.properties?.diameter || w.diameter) || 0,
            width: Number(w.properties?.width || w.width) || 0,
            offset: Number(w.properties?.offset || w.offset) || 0,
            price: Number(w.prices?.msrp?.[0]?.currencyAmount || w.price) || 0,
            imageUrl: w.images?.[0]?.imageUrlLarge || w.imageUrl || null,
            boltPattern: w.properties?.boltPatternMetric || w.properties?.boltPattern || w.boltPattern || "",
          };
        }

        // Fetch tires for this size
        const tireRes = await fetch(`/api/tires/search?size=${encodeURIComponent(tireSize)}&minQty=4`);
        const tireData = await tireRes.json();
        
        const tires: TireOption[] = (tireData.results || []).map((t: any) => {
          // CRITICAL: Use sell price (t.price) first, fallback to cost + $50 margin
          // Bug fix: was showing dealer cost instead of retail price
          const cost = typeof t.cost === "number" && t.cost > 0 ? t.cost : null;
          const sellPrice = typeof t.price === "number" && t.price > 0 ? t.price : null;
          const displayPrice = sellPrice || (cost ? cost + 50 : 0);
          
          return {
            partNumber: t.partNumber,
            brand: t.brand || "Unknown",
            model: t.model || t.description || "",
            size: t.size,
            price: displayPrice,
            imageUrl: t.imageUrl,
            inStock: (t.quantity?.national || 0) >= 4,
          };
        });

        const defaultTire = tires[0] || null;

        if (!cancelled) {
          setState({
            wheel,
            tire: defaultTire,
            alternativeTires: tires.slice(1, 6),
            loading: false,
            error: null,
          });
          setSelectedTire(defaultTire);
        }
      } catch (err: any) {
        if (!cancelled) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: err.message || "Failed to load package",
          }));
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [wheelSku, tireSize, wheelBrand, wheelModel, wheelFinish, wheelDiameter, wheelWidth, wheelOffset, wheelPrice, wheelImage, wheelBoltPattern]);

  // Calculate totals
  const wheelTotal = (state.wheel?.price || 0) * quantity;
  const tireTotal = (selectedTire?.price || 0) * quantity;
  const packageTotal = wheelTotal + tireTotal;

  // Handle add to cart
  const handleAddToCart = () => {
    if (!state.wheel || !selectedTire) return;

    // Add wheels
    addItem({
      type: "wheel",
      sku: state.wheel.sku,
      brand: state.wheel.brand,
      model: state.wheel.model,
      finish: state.wheel.finish,
      diameter: String(state.wheel.diameter),
      width: String(state.wheel.width),
      offset: String(state.wheel.offset),
      boltPattern: state.wheel.boltPattern,
      imageUrl: state.wheel.imageUrl || undefined,
      unitPrice: state.wheel.price,
      quantity,
      fitmentClass: "surefit",
      vehicle: year && make && model ? {
        year,
        make,
        model,
        trim: trim || undefined,
      } : undefined,
    });

    // Add tires
    addItem({
      type: "tire",
      sku: selectedTire.partNumber,
      brand: selectedTire.brand,
      model: selectedTire.model,
      size: selectedTire.size,
      imageUrl: selectedTire.imageUrl || undefined,
      unitPrice: selectedTire.price,
      quantity,
      vehicle: year && make && model ? {
        year,
        make,
        model,
        trim: trim || undefined,
      } : undefined,
    });

    // Open cart
    setIsOpen(true);
  };

  // Loading state
  if (state.loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-64 bg-neutral-200 rounded" />
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="h-96 bg-neutral-200 rounded-lg" />
          <div className="h-96 bg-neutral-200 rounded-lg" />
        </div>
      </div>
    );
  }

  // Error state
  if (state.error || !state.wheel) {
    return (
      <div className="text-center py-12">
        <p className="text-xl text-neutral-600 mb-4">
          {state.error || "Package not found"}
        </p>
        <Link
          href="/wheels"
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700"
        >
          Browse Wheels
        </Link>
      </div>
    );
  }

  const vehicleName = year && make && model 
    ? `${year} ${make} ${model}${trim ? ` ${trim}` : ""}`
    : null;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <nav className="mb-4 text-sm text-neutral-500">
          <Link href="/" className="hover:text-neutral-700">Home</Link>
          <span className="mx-2">/</span>
          {vehicleName ? (
            <>
              <Link 
                href={`/packages/for/${year}-${make?.toLowerCase()}-${model?.toLowerCase().replace(/\s+/g, '-')}`}
                className="hover:text-neutral-700"
              >
                {vehicleName}
              </Link>
              <span className="mx-2">/</span>
            </>
          ) : null}
          <span className="text-neutral-900">Customize Package</span>
        </nav>
        
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">
          Customize Your Package
        </h1>
        {vehicleName && (
          <p className="text-lg text-neutral-600">
            for {vehicleName}
          </p>
        )}
      </div>

      {/* Trust Badges */}
      <TrustBadgesRow
        badges={["fitment_guaranteed", "verified_vehicle", "no_rubbing"]}
        size="md"
        variant="outline"
        className="mb-8"
      />

      {/* Main Content */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Wheel Section */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-neutral-900">Wheels</h2>
            <TrustBadge type="fitment_guaranteed" size="sm" />
          </div>

          <div className="relative h-64 bg-neutral-50 rounded-lg mb-4">
            {state.wheel.imageUrl ? (
              <Image
                src={state.wheel.imageUrl}
                alt={`${state.wheel.brand} ${state.wheel.model}`}
                fill
                className="object-contain p-4"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-6xl">
                🛞
              </div>
            )}
          </div>

          <h3 className="font-semibold text-neutral-900">
            {state.wheel.brand} {state.wheel.model}
          </h3>
          <p className="text-sm text-neutral-600 mb-2">
            {state.wheel.diameter}&quot; x {state.wheel.width}&quot;
            {state.wheel.offset !== undefined && ` • +${state.wheel.offset}mm`}
            {state.wheel.finish && ` • ${state.wheel.finish}`}
          </p>

          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-neutral-900">
              ${state.wheel.price.toLocaleString()}
            </span>
            <span className="text-sm text-neutral-500">each</span>
          </div>
        </div>

        {/* Tire Section */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="text-xl font-semibold text-neutral-900 mb-4">Tires</h2>

          {selectedTire ? (
            <>
              <div className="relative h-48 bg-neutral-50 rounded-lg mb-4">
                {selectedTire.imageUrl ? (
                  <Image
                    src={selectedTire.imageUrl}
                    alt={`${selectedTire.brand} ${selectedTire.model}`}
                    fill
                    className="object-contain p-4"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-6xl">
                    🔘
                  </div>
                )}
              </div>

              <h3 className="font-semibold text-neutral-900">
                {selectedTire.brand} {selectedTire.model}
              </h3>
              <p className="text-sm text-neutral-600 mb-2">{selectedTire.size}</p>

              <div className="flex items-baseline justify-between mb-4">
                <span className="text-2xl font-bold text-neutral-900">
                  ${selectedTire.price.toLocaleString()}
                </span>
                <span className="text-sm text-neutral-500">each</span>
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center bg-neutral-50 rounded-lg mb-4">
              <p className="text-neutral-500">No tires available for this size</p>
            </div>
          )}

          {/* Alternative Tires */}
          {state.alternativeTires.length > 0 && (
            <div>
              <p className="text-sm font-medium text-neutral-700 mb-2">
                Swap Tire Brand:
              </p>
              <div className="space-y-2">
                {state.alternativeTires.map((tire) => (
                  <button
                    key={tire.partNumber}
                    onClick={() => setSelectedTire(tire)}
                    className={`
                      w-full text-left p-3 rounded-lg border transition-colors
                      ${selectedTire?.partNumber === tire.partNumber
                        ? "border-red-500 bg-red-50"
                        : "border-neutral-200 hover:border-neutral-300"
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-neutral-900">
                          {tire.brand} {tire.model}
                        </p>
                        <p className="text-sm text-neutral-500">{tire.size}</p>
                      </div>
                      <span className="font-semibold text-neutral-900">
                        ${tire.price}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Complete Your Setup (Accessories) */}
      <div className="mt-8">
        <CompleteYourSetup
          wheelDiameter={state.wheel.diameter}
          boltPattern={state.wheel.boltPattern}
          vehicleYear={year ? Number(year) : undefined}
          vehicleMake={make || undefined}
          vehicleModel={model || undefined}
        />
      </div>

      {/* Summary & Add to Cart */}
      <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-neutral-600 mb-1">
              Qty: {quantity} wheels + {quantity} tires
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-neutral-900">
                ${packageTotal.toLocaleString()}
              </span>
              <span className="text-neutral-500">total</span>
            </div>
            <p className="text-sm text-neutral-500 mt-1">
              Wheels: ${wheelTotal.toLocaleString()} • Tires: ${tireTotal.toLocaleString()}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="qty" className="text-sm text-neutral-600">Qty:</label>
              <select
                id="qty"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value={4}>4 (Standard)</option>
                <option value={5}>5 (With Spare)</option>
              </select>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={!selectedTire}
              className="rounded-lg bg-red-600 px-8 py-3 font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Package to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
