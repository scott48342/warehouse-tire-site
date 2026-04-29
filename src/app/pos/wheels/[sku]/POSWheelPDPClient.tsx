"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePOS, type POSWheel } from "@/components/pos/POSContext";
import { ImageGallery } from "@/components/ImageGallery";

// ============================================================================
// Types
// ============================================================================

type WheelData = {
  sku: string;
  title: string;
  brand: string;
  brandCode?: string;
  model?: string;
  finish?: string;
  diameter?: string;
  width?: string;
  offset?: string;
  boltPattern?: string;
  centerbore?: string;
  price?: number;
  images: string[];
  stockQty?: number;
  inventoryType?: string;
  styleKey?: string;
  // Variants/finishes for this style
  variants?: WheelVariant[];
  finishThumbs?: { finish: string; sku: string; imageUrl?: string }[];
};

type WheelVariant = {
  sku: string;
  diameter?: string;
  width?: string;
  offset?: string;
  boltPattern?: string;
  finish?: string;
  price?: number;
};

type Props = {
  sku: string;
  year: string;
  make: string;
  model: string;
  trim: string;
};

// ============================================================================
// Spec Row Component
// ============================================================================

function SpecRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-2 border-b border-neutral-100 last:border-0">
      <span className="text-neutral-500">{label}</span>
      <span className="font-semibold text-neutral-900">{value}</span>
    </div>
  );
}

// ============================================================================
// Finish Thumbnail Component
// ============================================================================

function FinishThumbnail({
  finish,
  imageUrl,
  isSelected,
  onClick,
}: {
  finish: string;
  imageUrl?: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center rounded-lg border-2 p-2 transition-all ${
        isSelected
          ? "border-blue-500 bg-blue-50"
          : "border-neutral-200 hover:border-neutral-300"
      }`}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={finish} className="h-12 w-12 object-contain" />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded bg-neutral-100 text-lg">
          🛞
        </div>
      )}
      <span className="mt-1 text-[10px] font-medium text-neutral-700 line-clamp-1 max-w-[60px]">
        {finish}
      </span>
      {isSelected && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] text-white">
          ✓
        </span>
      )}
    </button>
  );
}

// ============================================================================
// Size Variant Button Component
// ============================================================================

function SizeVariantButton({
  variant,
  isSelected,
  onClick,
}: {
  variant: WheelVariant;
  isSelected: boolean;
  onClick: () => void;
}) {
  const sizeLabel = `${variant.diameter}" × ${variant.width}"`;
  const offsetLabel = variant.offset ? `ET${variant.offset}` : "";
  
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border-2 px-3 py-2 text-left transition-all ${
        isSelected
          ? "border-blue-500 bg-blue-50"
          : "border-neutral-200 hover:border-neutral-300"
      }`}
    >
      <div className="text-sm font-semibold text-neutral-900">{sizeLabel}</div>
      {offsetLabel && (
        <div className="text-xs text-neutral-500">{offsetLabel}</div>
      )}
      {isSelected && (
        <div className="mt-1 text-[10px] font-bold text-blue-600">Selected</div>
      )}
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function POSWheelPDPClient({ sku, year, make, model, trim }: Props) {
  const router = useRouter();
  const { setWheel, setSetupMode } = usePOS();

  const [wheel, setWheelData] = useState<WheelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<WheelVariant | null>(null);
  const [quantity, setQuantity] = useState(4);

  const hasVehicle = Boolean(year && make && model);

  // Fetch wheel data
  useEffect(() => {
    const fetchWheel = async () => {
      setLoading(true);
      setError(null);

      try {
        let item = null;
        
        // First try WheelPros API
        try {
          const res = await fetch(
            `/api/wheelpros/wheels/search?fields=inventory,price,images,properties&priceType=msrp&currencyCode=USD&page=1&pageSize=1&sku=${encodeURIComponent(sku)}`
          );
          if (res.ok) {
            const data = await res.json();
            const items = data.items || data.results || [];
            item = items[0];
          }
        } catch (wpErr) {
          console.log("[POSWheelPDP] WheelPros API failed, trying techfeed fallback");
        }

        if (!item) {
          // Try techfeed endpoint as fallback (direct SKU lookup)
          const tfRes = await fetch(`/api/wheels/sku/${encodeURIComponent(sku)}`);
          if (tfRes.ok) {
            const tfData = await tfRes.json();
            if (tfData && !tfData.error) {
              setWheelData({
                sku: tfData.sku || sku,
                title: tfData.title || tfData.model || sku,
                brand: tfData.brand || "Unknown",
                brandCode: tfData.brandCode,
                finish: tfData.finish,
                diameter: tfData.diameter ? String(tfData.diameter) : undefined,
                width: tfData.width ? String(tfData.width) : undefined,
                offset: tfData.offset ? String(tfData.offset) : undefined,
                boltPattern: tfData.boltPattern,
                centerbore: tfData.centerbore ? String(tfData.centerbore) : undefined,
                price: tfData.price ? Number(tfData.price) : undefined,
                images: tfData.images || [],
                styleKey: tfData.styleKey,
              });
              setLoading(false);
              return;
            }
          }
          throw new Error("Wheel not found");
        }

        // Parse WheelPros response
        const brandObj = typeof item.brand === "object" ? item.brand : null;
        const brand = brandObj?.description || brandObj?.code || (typeof item.brand === "string" ? item.brand : "Unknown");

        const msrp = item.prices?.msrp;
        const firstPrice = Array.isArray(msrp) ? msrp[0] : undefined;
        const price = firstPrice?.currencyAmount ? Number(firstPrice.currencyAmount) : undefined;

        const images = Array.isArray(item.images)
          ? item.images
              .map((im: any) => im?.imageUrlLarge || im?.imageUrlMedium || im?.imageUrlOriginal)
              .filter(Boolean)
          : [];

        setWheelData({
          sku: item.sku || sku,
          title: item.title || item.sku,
          brand,
          brandCode: brandObj?.code,
          model: item.properties?.model,
          finish: item.properties?.abbreviated_finish_desc || item.properties?.finish,
          diameter: item.properties?.diameter ? String(item.properties.diameter) : undefined,
          width: item.properties?.width ? String(item.properties.width) : undefined,
          offset: item.properties?.offset ? String(item.properties.offset) : undefined,
          boltPattern: item.properties?.boltPatternMetric || item.properties?.boltPattern,
          centerbore: item.properties?.centerbore ? String(item.properties.centerbore) : undefined,
          price,
          images,
          stockQty: item.inventory?.localStock,
          inventoryType: item.inventory?.type,
        });

        // Fetch variants/finishes for this style
        if (brandObj?.code && item.title) {
          fetchVariants(brandObj.code, item.title, item.properties?.diameter);
        }
      } catch (err) {
        console.error("[POSWheelPDP] Fetch error:", err);
        setError("Unable to load wheel details.");
      } finally {
        setLoading(false);
      }
    };

    fetchWheel();
  }, [sku]);

  // Fetch variants for the same style
  const fetchVariants = async (brandCode: string, title: string, diameter?: string) => {
    try {
      // Extract model name from title
      const parts = title.split(/\s+/);
      const modelToken = parts.slice(1, 3).join(" ").replace(/\d+X\d+.*/, "").trim();
      
      if (!modelToken || modelToken.length < 2) return;

      const res = await fetch(
        `/api/wheelpros/wheels/search?fields=inventory,price,images,properties&page=1&pageSize=100&brand_cd=${encodeURIComponent(brandCode)}&q=${encodeURIComponent(modelToken)}`
      );

      if (!res.ok) return;

      const data = await res.json();
      const items = data.items || data.results || [];

      // Parse variants
      const variants: WheelVariant[] = [];
      const finishMap = new Map<string, { finish: string; sku: string; imageUrl?: string }>();

      for (const item of items) {
        const props = item.properties || {};
        const finish = props.abbreviated_finish_desc || props.finish;
        const img = item.images?.[0]?.imageUrlLarge || item.images?.[0]?.imageUrlMedium;

        // Add to variants
        variants.push({
          sku: item.sku,
          diameter: props.diameter ? String(props.diameter) : undefined,
          width: props.width ? String(props.width) : undefined,
          offset: props.offset ? String(props.offset) : undefined,
          boltPattern: props.boltPatternMetric || props.boltPattern,
          finish,
          price: item.prices?.msrp?.[0]?.currencyAmount
            ? Number(item.prices.msrp[0].currencyAmount)
            : undefined,
        });

        // Collect unique finishes
        if (finish && !finishMap.has(finish)) {
          finishMap.set(finish, { finish, sku: item.sku, imageUrl: img });
        }
      }

      // Filter variants to same diameter (different sizes/offsets)
      const sameStyleVariants = diameter
        ? variants.filter((v) => v.diameter === diameter)
        : variants;

      setWheelData((prev) =>
        prev
          ? {
              ...prev,
              variants: sameStyleVariants,
              finishThumbs: Array.from(finishMap.values()),
            }
          : prev
      );
    } catch (err) {
      console.error("[POSWheelPDP] Variant fetch error:", err);
    }
  };

  // Handle finish change
  const handleFinishChange = (newSku: string) => {
    router.push(
      `/pos/wheels/${newSku}?year=${year}&make=${make}&model=${model}${trim ? `&trim=${trim}` : ""}`
    );
  };

  // Handle variant selection
  const handleVariantSelect = (variant: WheelVariant) => {
    if (variant.sku !== sku) {
      router.push(
        `/pos/wheels/${variant.sku}?year=${year}&make=${make}&model=${model}${trim ? `&trim=${trim}` : ""}`
      );
    }
    setSelectedVariant(variant);
  };

  // Handle select wheel
  const handleSelectWheel = useCallback(() => {
    if (!wheel) return;

    const posWheel: POSWheel = {
      sku: wheel.sku,
      brand: wheel.brand,
      model: wheel.title,
      finish: wheel.finish,
      diameter: wheel.diameter || "",
      width: wheel.width || "",
      offset: wheel.offset,
      boltPattern: wheel.boltPattern,
      imageUrl: wheel.images[0],
      unitPrice: wheel.price || 0,
      setPrice: (wheel.price || 0) * quantity,
      quantity,
    };

    setWheel(posWheel);
    setSetupMode("square"); // Default for PDP selection

    // Navigate to tires
    const params = new URLSearchParams({ year, make, model });
    if (trim) params.set("trim", trim);
    if (wheel.diameter) params.set("wheelDia", wheel.diameter);
    if (wheel.width) params.set("wheelWidth", wheel.width);

    router.push(`/pos/tires?${params.toString()}`);
  }, [wheel, quantity, setWheel, setSetupMode, router, year, make, model, trim]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="h-8 w-8 animate-spin mx-auto text-neutral-400" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="mt-2 text-neutral-600">Loading wheel details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !wheel) {
    return (
      <div className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-red-800 font-medium">{error || "Wheel not found"}</p>
            <p className="mt-1 text-sm text-red-600">SKU: {sku}</p>
          </div>
          <Link
            href={`/pos/wheels?year=${year}&make=${make}&model=${model}${trim ? `&trim=${trim}` : ""}`}
            className="mt-4 inline-block text-blue-600 hover:underline"
          >
            ← Back to wheels
          </Link>
        </div>
      </div>
    );
  }

  const setPrice = (wheel.price || 0) * quantity;

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="border-b border-neutral-200 bg-white px-6 py-4">
        <Link
          href={`/pos/wheels?year=${year}&make=${make}&model=${model}${trim ? `&trim=${trim}` : ""}`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to wheels
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">{wheel.title}</h1>
            <p className="text-sm text-neutral-600">
              {year} {make} {model} {trim}
            </p>
          </div>
          {hasVehicle && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
              <span className="text-green-600">✓</span>
              <span className="text-sm font-medium text-green-800">Verified Fit</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left: Image Gallery */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            {wheel.images.length > 0 ? (
              <ImageGallery images={wheel.images} alt={wheel.title} />
            ) : (
              <div className="aspect-square flex items-center justify-center bg-neutral-100 rounded-xl">
                <span className="text-6xl text-neutral-300">🛞</span>
              </div>
            )}

            {/* Finish Thumbnails */}
            {wheel.finishThumbs && wheel.finishThumbs.length > 1 && (
              <div className="mt-4">
                <div className="text-sm font-semibold text-neutral-700 mb-2">
                  Available Finishes ({wheel.finishThumbs.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {wheel.finishThumbs.map((ft) => (
                    <FinishThumbnail
                      key={ft.sku}
                      finish={ft.finish}
                      imageUrl={ft.imageUrl}
                      isSelected={ft.sku === sku}
                      onClick={() => handleFinishChange(ft.sku)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Details & Actions */}
          <div className="space-y-6">
            {/* Brand & Title */}
            <div>
              <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                {wheel.brand}
              </div>
              <h2 className="text-xl font-bold text-neutral-900">{wheel.title}</h2>
            </div>

            {/* Key Specs Chips */}
            <div className="flex flex-wrap gap-2">
              {wheel.finish && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-1 text-xs font-bold text-white">
                  🎨 {wheel.finish}
                </span>
              )}
              {wheel.diameter && wheel.width && (
                <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                  {wheel.diameter}" × {wheel.width}"
                </span>
              )}
              {wheel.boltPattern && (
                <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                  {wheel.boltPattern}
                </span>
              )}
              {wheel.offset && (
                <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                  {Number(wheel.offset) >= 0 ? "+" : ""}{wheel.offset}mm
                </span>
              )}
            </div>

            {/* Specifications Card */}
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <h3 className="text-sm font-bold text-neutral-900 mb-3">Specifications</h3>
              <div className="text-sm">
                <SpecRow label="Diameter" value={wheel.diameter ? `${wheel.diameter}"` : null} />
                <SpecRow label="Width" value={wheel.width ? `${wheel.width}"` : null} />
                <SpecRow label="Bolt Pattern" value={wheel.boltPattern} />
                <SpecRow label="Offset" value={wheel.offset ? `${wheel.offset}mm` : null} />
                <SpecRow label="Center Bore" value={wheel.centerbore ? `${wheel.centerbore}mm` : null} />
                <SpecRow label="Finish" value={wheel.finish} />
              </div>
            </div>

            {/* Size Variants */}
            {wheel.variants && wheel.variants.length > 1 && (
              <div className="rounded-xl border border-neutral-200 bg-white p-4">
                <h3 className="text-sm font-bold text-neutral-900 mb-3">
                  Available Sizes ({wheel.variants.length})
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {wheel.variants.slice(0, 8).map((variant) => (
                    <SizeVariantButton
                      key={variant.sku}
                      variant={variant}
                      isSelected={variant.sku === sku}
                      onClick={() => handleVariantSelect(variant)}
                    />
                  ))}
                </div>
                {wheel.variants.length > 8 && (
                  <p className="mt-2 text-xs text-neutral-500">
                    +{wheel.variants.length - 8} more sizes available
                  </p>
                )}
              </div>
            )}

            {/* Pricing & Quantity */}
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-3xl font-bold text-neutral-900">
                    ${(wheel.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-sm text-neutral-500">per wheel</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-neutral-900">
                    ${setPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-sm text-neutral-500">set of {quantity}</div>
                </div>
              </div>

              {/* Quantity Selector */}
              <div className="flex items-center gap-4 mb-4">
                <span className="text-sm font-medium text-neutral-700">Quantity:</span>
                <div className="flex items-center rounded-lg border border-neutral-300">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 rounded-l-lg"
                  >
                    −
                  </button>
                  <span className="px-4 py-1.5 font-semibold text-neutral-900 border-x border-neutral-300">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(8, q + 1))}
                    className="px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 rounded-r-lg"
                  >
                    +
                  </button>
                </div>
                <div className="flex gap-2">
                  {[4, 5].map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuantity(q)}
                      className={`px-3 py-1 rounded text-xs font-medium ${
                        quantity === q
                          ? "bg-blue-100 text-blue-700"
                          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Select Button */}
              <button
                onClick={handleSelectWheel}
                className="w-full rounded-xl bg-blue-600 py-4 text-center text-lg font-bold text-white hover:bg-blue-700 transition-colors"
              >
                Select This Wheel
              </button>

              {/* Trust signals */}
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-neutral-600">
                <span className="flex items-center gap-1">
                  <span className="text-green-600">✓</span> Fitment guaranteed
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-green-600">✓</span> Ships fast
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-green-600">✓</span> Expert support
                </span>
              </div>
            </div>

            {/* SKU */}
            <div className="text-xs text-neutral-400">SKU: {wheel.sku}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
