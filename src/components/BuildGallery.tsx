"use client";

/**
 * BuildGallery - "See builds like this" component
 * 
 * Shows gallery images matching the user's vehicle and build selections.
 * Displayed below wheel selection or on results page.
 * 
 * Usage:
 *   <BuildGallery 
 *     year={2024} 
 *     make="Ford" 
 *     model="F-150" 
 *     wheelDiameter={20}
 *     liftLevel="leveled"
 *   />
 */

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ExternalLink, Maximize2 } from "lucide-react";

interface GalleryImage {
  id: string;
  imageUrl: string;
  thumbnailUrl: string;
  sourceUrl?: string;
  vehicle: {
    year: number;
    make: string;
    model: string;
    trim?: string;
  };
  wheel: {
    brand?: string;
    model?: string;
    diameter?: number;
    width?: number;
    offsetMm?: number;
  };
  rearWheel?: {
    diameter?: number;
    width?: number;
    offsetMm?: number;
  } | null;
  tire: {
    brand?: string;
    model?: string;
    size?: string;
    rearSize?: string;
  };
  suspension: {
    type?: string;
    brand?: string;
    liftLevel?: string;
  };
  fitment: {
    type?: string;
    style?: string;
    isStaggered?: boolean;
  };
  title?: string;
  tags?: string[];
}

interface BuildGalleryProps {
  // Vehicle matching
  year?: number;
  make?: string;
  model?: string;
  
  // Build specs (optional filters)
  wheelDiameter?: number;
  wheelBrand?: string;
  liftLevel?: "stock" | "leveled" | "lifted" | "lowered";
  
  // Display options
  limit?: number;
  showTitle?: boolean;
  compact?: boolean;
  className?: string;
}

export function BuildGallery({
  year,
  make,
  model,
  wheelDiameter,
  wheelBrand,
  liftLevel,
  limit = 6,
  showTitle = true,
  compact = false,
  className = "",
}: BuildGalleryProps) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [scrollIndex, setScrollIndex] = useState(0);
  
  // Fetch gallery images
  useEffect(() => {
    const fetchImages = async () => {
      if (!make || !model) {
        setImages([]);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        const params = new URLSearchParams();
        if (year) params.set("year", year.toString());
        if (make) params.set("make", make);
        if (model) params.set("model", model);
        if (wheelDiameter) params.set("wheelDiameter", wheelDiameter.toString());
        if (wheelBrand) params.set("wheelBrand", wheelBrand);
        if (liftLevel) params.set("liftLevel", liftLevel);
        params.set("limit", limit.toString());
        
        const response = await fetch(`/api/gallery/search?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch gallery");
        }
        
        const data = await response.json();
        setImages(data.images || []);
        
      } catch (err) {
        console.error("[BuildGallery] Error:", err);
        setError("Could not load build gallery");
      } finally {
        setLoading(false);
      }
    };
    
    fetchImages();
  }, [year, make, model, wheelDiameter, wheelBrand, liftLevel, limit]);
  
  // Don't render if no results
  if (!loading && images.length === 0) {
    return null;
  }
  
  // Scroll handlers
  const canScrollLeft = scrollIndex > 0;
  const canScrollRight = scrollIndex < images.length - (compact ? 3 : 4);
  
  const scrollLeft = () => {
    setScrollIndex(Math.max(0, scrollIndex - 1));
  };
  
  const scrollRight = () => {
    setScrollIndex(Math.min(images.length - 1, scrollIndex + 1));
  };
  
  // Format wheel spec string
  const formatWheelSpec = (img: GalleryImage) => {
    const { wheel, rearWheel } = img;
    if (!wheel.diameter) return "";
    
    let spec = `${wheel.diameter}x${wheel.width || "?"}`;
    if (wheel.offsetMm !== undefined && wheel.offsetMm !== null) {
      spec += ` ${wheel.offsetMm >= 0 ? "+" : ""}${wheel.offsetMm}mm`;
    }
    
    if (rearWheel?.diameter) {
      spec += ` / ${rearWheel.diameter}x${rearWheel.width || "?"}`;
      if (rearWheel.offsetMm !== undefined) {
        spec += ` ${rearWheel.offsetMm >= 0 ? "+" : ""}${rearWheel.offsetMm}mm`;
      }
    }
    
    return spec;
  };
  
  // Format lift level display
  const formatLiftLevel = (level?: string) => {
    const map: Record<string, string> = {
      stock: "Stock",
      leveled: "Leveled",
      lifted: "Lifted",
      lifted_2: "2\" Lift",
      lifted_4: "4\" Lift",
      lifted_6: "6\" Lift",
      lowered: "Lowered",
      slammed: "Slammed",
    };
    return map[level || ""] || level || "";
  };
  
  return (
    <div className={`build-gallery ${className}`}>
      {/* Header */}
      {showTitle && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            See builds like this
          </h3>
          <span className="text-sm text-gray-500">
            {images.length} matching builds
          </span>
        </div>
      )}
      
      {/* Loading state */}
      {loading && (
        <div className="flex gap-4 overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-64 h-48 bg-gray-200 rounded-lg animate-pulse"
            />
          ))}
        </div>
      )}
      
      {/* Error state */}
      {error && (
        <div className="p-4 text-center text-gray-500 bg-gray-100 rounded-lg">
          {error}
        </div>
      )}
      
      {/* Gallery carousel */}
      {!loading && !error && images.length > 0 && (
        <div className="relative group">
          {/* Scroll buttons */}
          {canScrollLeft && (
            <button
              onClick={scrollLeft}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/90 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          
          {canScrollRight && (
            <button
              onClick={scrollRight}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/90 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
          
          {/* Images */}
          <div
            className="flex gap-4 overflow-hidden transition-transform duration-300"
            style={{
              transform: `translateX(-${scrollIndex * (compact ? 200 : 280)}px)`,
            }}
          >
            {images.map((img) => (
              <div
                key={img.id}
                className={`flex-shrink-0 ${compact ? "w-48" : "w-64"} cursor-pointer group/card`}
                onClick={() => setSelectedImage(img)}
              >
                {/* Image */}
                <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-gray-100">
                  <Image
                    src={img.thumbnailUrl || img.imageUrl}
                    alt={img.title || `${img.vehicle.year} ${img.vehicle.make} ${img.vehicle.model}`}
                    fill
                    className="object-cover group-hover/card:scale-105 transition-transform"
                    sizes="(max-width: 768px) 50vw, 256px"
                  />
                  
                  {/* Expand icon */}
                  <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/20 transition-colors flex items-center justify-center">
                    <Maximize2 className="w-8 h-8 text-white opacity-0 group-hover/card:opacity-100 transition-opacity" />
                  </div>
                  
                  {/* Staggered badge */}
                  {img.fitment.isStaggered && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-medium bg-black/70 text-white rounded">
                      Staggered
                    </span>
                  )}
                </div>
                
                {/* Info */}
                <div className="mt-2 space-y-1">
                  {/* Vehicle */}
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {img.vehicle.year} {img.vehicle.make} {img.vehicle.model}
                  </p>
                  
                  {/* Wheel spec */}
                  <p className="text-xs text-gray-600 truncate">
                    {img.wheel.brand} {formatWheelSpec(img)}
                  </p>
                  
                  {/* Tags */}
                  {!compact && (
                    <div className="flex gap-1 flex-wrap">
                      {img.suspension.liftLevel && img.suspension.liftLevel !== "stock" && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-600 rounded">
                          {formatLiftLevel(img.suspension.liftLevel)}
                        </span>
                      )}
                      {img.fitment.type && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-600 rounded capitalize">
                          {img.fitment.type.replace("_", " ")}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-white rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
              aria-label="Close"
            >
              ✕
            </button>
            
            {/* Image */}
            <div className="relative aspect-video bg-gray-900">
              <Image
                src={selectedImage.imageUrl}
                alt={selectedImage.title || ""}
                fill
                className="object-contain"
                sizes="(max-width: 1200px) 100vw, 1024px"
              />
            </div>
            
            {/* Details */}
            <div className="p-6">
              <h4 className="text-xl font-semibold">
                {selectedImage.vehicle.year} {selectedImage.vehicle.make}{" "}
                {selectedImage.vehicle.model}
                {selectedImage.vehicle.trim && ` ${selectedImage.vehicle.trim}`}
              </h4>
              
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {/* Wheel */}
                <div>
                  <span className="text-gray-500">Wheels</span>
                  <p className="font-medium">
                    {selectedImage.wheel.brand || "Unknown"}
                  </p>
                  <p className="text-gray-600">{formatWheelSpec(selectedImage)}</p>
                </div>
                
                {/* Tire */}
                <div>
                  <span className="text-gray-500">Tires</span>
                  <p className="font-medium">
                    {selectedImage.tire.brand || "Unknown"}
                  </p>
                  <p className="text-gray-600">{selectedImage.tire.size}</p>
                </div>
                
                {/* Suspension */}
                <div>
                  <span className="text-gray-500">Suspension</span>
                  <p className="font-medium">
                    {selectedImage.suspension.brand || formatLiftLevel(selectedImage.suspension.liftLevel) || "Stock"}
                  </p>
                  <p className="text-gray-600 capitalize">
                    {selectedImage.suspension.type?.replace("_", " ") || ""}
                  </p>
                </div>
                
                {/* Fitment */}
                <div>
                  <span className="text-gray-500">Fitment</span>
                  <p className="font-medium capitalize">
                    {selectedImage.fitment.type?.replace("_", " ") || "Unknown"}
                  </p>
                  {selectedImage.fitment.isStaggered && (
                    <p className="text-gray-600">Staggered Setup</p>
                  )}
                </div>
              </div>
              
              {/* Source link */}
              {selectedImage.sourceUrl && (
                <a
                  href={selectedImage.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-4 text-sm text-blue-600 hover:underline"
                >
                  View on Fitment Industries
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BuildGallery;
