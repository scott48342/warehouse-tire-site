"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";

interface BuildMatch {
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
  liftLevel: string | null;
  buildStyle: string | null;
  matchLevel: "exact_lift" | "same_type_lifted" | "same_type" | "any_lifted" | "fallback";
}

interface BuildGalleryResponse {
  results: BuildMatch[];
  matchQuality: "exact" | "partial" | "fallback" | "none" | "error";
  matchedOn?: {
    vehicleType: string | null;
    buildType: string;
    liftRange: string | null;
    isLifted: boolean;
  };
}

interface BuildGalleryBlockProps {
  vehicleType?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  buildType?: string; // "stock" | "leveled" | "lifted"
  liftedInches?: number;
  liftedPreset?: string;
}

export function BuildGalleryBlock({
  vehicleType,
  vehicleMake,
  vehicleModel,
  buildType,
  liftedInches,
  liftedPreset,
}: BuildGalleryBlockProps) {
  const [gallery, setGallery] = useState<BuildMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState<BuildMatch | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  // Determine effective build type
  const effectiveBuildType = buildType || liftedPreset || "";
  const bt = effectiveBuildType.toLowerCase();
  const isLiftedBuild = bt !== "stock" && bt !== "oem" && effectiveBuildType !== "" &&
                        (bt === "lifted" || bt === "level" || bt === "leveled" || bt.includes("lift"));

  // Fetch gallery matches
  useEffect(() => {
    // Don't fetch for stock builds
    if (!isLiftedBuild) {
      setGallery([]);
      setLoading(false);
      return;
    }

    const params = new URLSearchParams();
    if (vehicleType) params.set("vehicleType", vehicleType);
    if (vehicleMake) params.set("make", vehicleMake);
    if (vehicleModel) params.set("model", vehicleModel);
    if (effectiveBuildType) params.set("buildType", effectiveBuildType);
    if (liftedInches) params.set("liftedInches", String(liftedInches));
    params.set("limit", "6");

    fetch(`/api/gallery/builds?${params.toString()}`)
      .then((res) => res.json())
      .then((data: BuildGalleryResponse) => {
        setGallery(data.results || []);
        setLoading(false);
      })
      .catch(() => {
        setGallery([]);
        setLoading(false);
      });
  }, [vehicleType, vehicleMake, vehicleModel, effectiveBuildType, liftedInches, isLiftedBuild]);

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

  // Don't render for stock builds or if no matches
  if (!isLiftedBuild || loading) {
    return null;
  }

  if (validGallery.length === 0) {
    return null;
  }

  const formatVehicleLabel = (item: BuildMatch) => {
    const parts = [
      item.vehicleYear,
      item.vehicleMake,
      item.vehicleModel,
      item.vehicleTrim,
    ].filter(Boolean);
    return parts.join(" ");
  };

  const formatBuildLabel = (item: BuildMatch) => {
    if (item.liftLevel) {
      return `${item.liftLevel}" lift`;
    }
    return item.buildStyle || "";
  };

  return (
    <>
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔧</span>
            <span className="text-sm font-extrabold text-neutral-900">
              See builds like this
            </span>
          </div>
          <div className="text-xs text-neutral-500">
            {validGallery.length} build{validGallery.length !== 1 ? "s" : ""}
          </div>
        </div>
        
        <p className="text-xs text-neutral-600 mb-3">
          Real vehicles with similar setups to inspire your build
        </p>

        {/* Horizontal scroll gallery */}
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent">
          {validGallery.map((item) => (
            <button
              key={item.id}
              onClick={() => setLightboxImage(item)}
              className="group relative flex-shrink-0 w-44 rounded-xl overflow-hidden border border-neutral-200 bg-white hover:border-amber-400 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400"
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
                {/* Lift badge */}
                {item.liftLevel && (
                  <div className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    {item.liftLevel}&quot; Lift
                  </div>
                )}
              </div>
              
              {/* Label */}
              <div className="p-2">
                <div className="text-xs font-semibold text-neutral-900 truncate">
                  {item.wheelBrand} {item.wheelModel}
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
                {lightboxImage.wheelBrand} {lightboxImage.wheelModel}
              </div>
              <div className="text-sm text-neutral-300">
                {formatVehicleLabel(lightboxImage)}
                {lightboxImage.liftLevel && ` • ${lightboxImage.liftLevel}" lift`}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
