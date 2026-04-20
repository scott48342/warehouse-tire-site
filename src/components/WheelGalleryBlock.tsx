"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";

interface GalleryMatch {
  id: number;
  albumName: string;
  thumbnailUrl: string;
  fullImageUrl: string;
  wheelBrand: string;
  wheelModel: string;
  vehicleYear: number | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleTrim: string | null;
  vehicleType: string | null;
  matchLevel: "exact" | "wheel_type" | "brand_type" | "brand_fallback";
  matchConfidence: "high" | "medium" | "low";
}

interface GalleryResponse {
  results: GalleryMatch[];
  matchQuality: "exact" | "partial" | "fallback" | "none" | "error";
  matchedOn?: {
    wheelBrand: string;
    wheelModel: string;
    vehicleType: string | null;
    vehicleMake: string | null;
    vehicleModel: string | null;
  };
}

interface WheelGalleryBlockProps {
  wheelBrand?: string;
  wheelModel?: string;
  vehicleYear?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleType?: string; // "truck" | "suv" | "jeep" | "car"
}

// Client-side vehicle type inference (mirrors API logic)
function inferVehicleTypeClient(make?: string, model?: string): "truck" | "suv" | "jeep" | "car" | null {
  if (!model) return null;
  const m = model.toLowerCase();
  const mk = make?.toLowerCase() || "";
  
  // Trucks
  if (m.includes("f-150") || m.includes("f150") || m.includes("f-250") || m.includes("f-350") ||
      m.includes("silverado") || m.includes("sierra") ||
      m.includes("ram") || m.includes("1500") || m.includes("2500") || m.includes("3500") ||
      m.includes("tundra") || m.includes("tacoma") || m.includes("ranger") ||
      m.includes("colorado") || m.includes("gladiator") ||
      m.includes("titan") || m.includes("frontier") || m.includes("canyon") ||
      m.includes("ridgeline") || m.includes("maverick") || m.includes("santa cruz")) {
    return "truck";
  }
  
  // Jeeps
  if (mk === "jeep" || m.includes("wrangler") || m.includes("rubicon") ||
      m.includes("cherokee") || m.includes("compass") || m.includes("renegade")) {
    return "jeep";
  }
  
  // SUVs
  if (m.includes("bronco") || m.includes("4runner") ||
      m.includes("tahoe") || m.includes("suburban") ||
      m.includes("yukon") || m.includes("escalade") ||
      m.includes("sequoia") || m.includes("land cruiser") ||
      m.includes("gx") || m.includes("expedition") ||
      m.includes("durango") || m.includes("armada") ||
      m.includes("pilot") || m.includes("highlander") ||
      m.includes("explorer") || m.includes("telluride") ||
      m.includes("palisade") || m.includes("pathfinder")) {
    return "suv";
  }
  
  // Cars (performance/muscle/sports/sedans)
  if (m.includes("mustang") || m.includes("camaro") || m.includes("challenger") ||
      m.includes("charger") || m.includes("corvette") || m.includes("viper") ||
      m.includes("gt500") || m.includes("gt350") || m.includes("hellcat") ||
      m.includes("911") || m.includes("cayman") || m.includes("boxster") ||
      m.includes("supra") || m.includes("z4") || m.includes("86") || m.includes("brz") ||
      m.includes("miata") || m.includes("mx-5") || m.includes("370z") || m.includes("400z") ||
      m.includes("m3") || m.includes("m4") || m.includes("m5") || m.includes("m2") ||
      m.includes("accord") || m.includes("camry") || m.includes("civic") ||
      m.includes("corolla") || m.includes("altima") || m.includes("maxima") ||
      m.includes("3 series") || m.includes("5 series") ||
      m.includes("a4") || m.includes("a6") || m.includes("s4") || m.includes("s5") ||
      m.includes("c-class") || m.includes("e-class") || m.includes("s-class") ||
      m.includes("is") || m.includes("es") || m.includes("gs") || m.includes("ls") ||
      m.includes("wrx") || m.includes("sti") || m.includes("type r") ||
      m.includes("golf") || m.includes("gti")) {
    return "car";
  }
  
  return null;
}

export function WheelGalleryBlock({
  wheelBrand,
  wheelModel,
  vehicleYear,
  vehicleMake,
  vehicleModel,
  vehicleType,
}: WheelGalleryBlockProps) {
  const [gallery, setGallery] = useState<GalleryMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState<GalleryMatch | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  // Infer vehicle type if not provided - ensures proper segmentation
  const effectiveVehicleType = vehicleType || inferVehicleTypeClient(vehicleMake, vehicleModel);

  // Fetch gallery matches
  useEffect(() => {
    // Skip if no wheel model AND no vehicle context
    if (!wheelModel && !vehicleMake && !vehicleModel) {
      setLoading(false);
      return;
    }

    const params = new URLSearchParams();
    if (wheelBrand) params.set("wheelBrand", wheelBrand);
    if (wheelModel) params.set("wheelModel", wheelModel);
    if (vehicleYear) params.set("year", vehicleYear);
    if (vehicleMake) params.set("make", vehicleMake);
    if (vehicleModel) params.set("model", vehicleModel);
    // Always pass vehicle type to API for proper segmentation (prevents cross-contamination)
    if (effectiveVehicleType) params.set("vehicleType", effectiveVehicleType);
    params.set("limit", "6");

    fetch(`/api/gallery/match?${params.toString()}`)
      .then((res) => res.json())
      .then((data: GalleryResponse) => {
        setGallery(data.results || []);
        setLoading(false);
      })
      .catch(() => {
        setGallery([]);
        setLoading(false);
      });
  }, [wheelBrand, wheelModel, vehicleYear, vehicleMake, vehicleModel, effectiveVehicleType]);

  // Handle image error
  const handleImageError = useCallback((id: number) => {
    setImageErrors((prev) => new Set(prev).add(id));
  }, []);

  // Close lightbox on escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxImage(null);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  // Filter out images that failed to load
  const validGallery = gallery.filter((item) => !imageErrors.has(item.id));

  // Don't render if no matches or still loading
  if (loading) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50 p-5 shadow-sm">
        <div className="animate-pulse">
          <div className="h-5 w-48 bg-neutral-200 rounded mb-3" />
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 w-44 bg-neutral-200 rounded-xl flex-shrink-0" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (validGallery.length === 0) {
    return null; // Hide cleanly if no matches
  }

  const formatVehicleLabel = (item: GalleryMatch) => {
    const parts = [
      item.vehicleYear,
      item.vehicleMake,
      item.vehicleModel,
      item.vehicleTrim,
    ].filter(Boolean);
    return parts.join(" ");
  };

  return (
    <>
      <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-extrabold text-neutral-900">
            See this wheel on real vehicles
          </div>
          <div className="text-xs text-neutral-500">
            {validGallery.length} build{validGallery.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Horizontal scroll gallery */}
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent">
          {validGallery.map((item) => (
            <button
              key={item.id}
              onClick={() => setLightboxImage(item)}
              className="group relative flex-shrink-0 w-44 rounded-xl overflow-hidden border border-neutral-200 bg-white hover:border-neutral-400 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-neutral-400"
            >
              {/* Image container with fixed aspect ratio */}
              <div className="relative aspect-[4/3] bg-neutral-100">
                <Image
                  src={item.thumbnailUrl}
                  alt={`${item.wheelModel} on ${formatVehicleLabel(item)}`}
                  fill
                  sizes="176px"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={() => handleImageError(item.id)}
                />
                {/* Zoom indicator */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-2xl drop-shadow-lg">
                    🔍
                  </span>
                </div>
              </div>
              
              {/* Label */}
              <div className="p-2">
                <div className="text-xs font-semibold text-neutral-900 truncate">
                  {item.wheelModel}
                </div>
                <div className="text-[11px] text-neutral-500 truncate">
                  {formatVehicleLabel(item) || item.vehicleType}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Source attribution */}
        <div className="mt-2 text-[10px] text-neutral-400 text-center">
          Images courtesy of WheelPros
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-neutral-300 transition-colors text-3xl font-light"
              aria-label="Close"
            >
              ×
            </button>

            {/* Image */}
            <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden bg-neutral-900">
              <Image
                src={lightboxImage.fullImageUrl}
                alt={`${lightboxImage.wheelModel} on ${formatVehicleLabel(lightboxImage)}`}
                fill
                sizes="(max-width: 1024px) 100vw, 1024px"
                className="object-contain"
                priority
              />
            </div>

            {/* Caption */}
            <div className="mt-4 text-center">
              <div className="text-lg font-bold text-white">
                {lightboxImage.wheelModel}
              </div>
              <div className="text-sm text-neutral-300">
                {formatVehicleLabel(lightboxImage)}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
