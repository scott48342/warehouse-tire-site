"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  images: string[];
  alt: string;
  note?: string;
};

function uniq(arr: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of arr) {
    const s = String(v || "").trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

// ============================================================================
// IMAGE LIGHTBOX WITH ZOOM
// ============================================================================

interface LightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
  images: string[];
  currentIndex: number;
  onNavigate: (index: number) => void;
}

function Lightbox({ src, alt, onClose, images, currentIndex, onNavigate }: LightboxProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });
  const imageRef = useRef<HTMLDivElement>(null);
  const hasMultiple = images.length > 1;

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && hasMultiple) {
        onNavigate((currentIndex - 1 + images.length) % images.length);
      } else if (e.key === "ArrowRight" && hasMultiple) {
        onNavigate((currentIndex + 1) % images.length);
      }
    };
    
    document.addEventListener("keydown", handleKeyDown);
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = "hidden";
    
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose, hasMultiple, currentIndex, images.length, onNavigate]);

  // Handle mouse move for desktop zoom
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current || !isZoomed) return;
    
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPosition({ x, y });
  }, [isZoomed]);

  const toggleZoom = useCallback(() => {
    setIsZoomed(prev => !prev);
    setZoomPosition({ x: 50, y: 50 });
  }, []);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        type="button"
        className="absolute right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        onClick={onClose}
        aria-label="Close"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Navigation arrows */}
      {hasMultiple && (
        <>
          <button
            type="button"
            className="absolute left-4 top-1/2 z-50 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate((currentIndex - 1 + images.length) % images.length);
            }}
            aria-label="Previous image"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            className="absolute right-4 top-1/2 z-50 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate((currentIndex + 1) % images.length);
            }}
            aria-label="Next image"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Main image container - sized to fill viewport */}
      <div 
        className="relative flex items-center justify-center"
        style={{ width: 'min(90vw, 800px)', height: 'min(80vh, 800px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image with zoom */}
        <div
          ref={imageRef}
          className={`relative flex items-center justify-center overflow-hidden rounded-lg bg-white ${
            isZoomed ? "cursor-zoom-out" : "cursor-zoom-in"
          }`}
          style={{ width: '100%', height: '100%' }}
          onClick={toggleZoom}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => isZoomed && setZoomPosition({ x: 50, y: 50 })}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className={`max-w-full max-h-full object-contain transition-transform duration-200 ${
              isZoomed ? "scale-[2.5]" : "scale-100"
            }`}
            style={isZoomed ? {
              transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%`,
            } : undefined}
            draggable={false}
          />
          
          {/* Zoom hint */}
          {!isZoomed && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
              Click to zoom • ESC to close
            </div>
          )}
        </div>

        {/* Image counter */}
        {hasMultiple && (
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-sm text-white/80">
            {currentIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Thumbnail strip for multiple images */}
      {hasMultiple && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          {images.map((img, i) => (
            <button
              key={img}
              type="button"
              className={`h-12 w-12 overflow-hidden rounded-lg border-2 bg-white transition-all ${
                i === currentIndex
                  ? "border-white ring-2 ring-white/50"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onNavigate(i);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt={`Thumbnail ${i + 1}`} className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// IMAGE GALLERY COMPONENT
// ============================================================================

export function ImageGallery({ images, alt, note }: Props) {
  const imgs = useMemo(() => uniq(images || []), [images]);
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);

  const current = imgs[idx] || imgs[0] || "";

  return (
    <div>
      {/* Main image display */}
      <div className="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        {current ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current}
              alt={alt}
              className="h-[360px] w-full cursor-zoom-in object-contain transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              onClick={() => setOpen(true)}
            />
            {/* Zoom hint overlay - pointer-events-none so clicks reach the img */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/5 group-hover:opacity-100">
              <div className="rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white">
                🔍 Click to zoom and view tread detail
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-[360px] items-center justify-center">
            <div className="text-center">
              <div className="text-4xl text-neutral-300">🛞</div>
              <div className="mt-2 text-sm text-neutral-500">Image coming soon</div>
            </div>
          </div>
        )}
      </div>

      {note ? <div className="mt-2 text-[11px] text-neutral-500">{note}</div> : null}

      {/* Thumbnail strip */}
      {imgs.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {imgs.map((u, i) => (
            <button
              key={u}
              type="button"
              onClick={() => setIdx(i)}
              className={
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white transition-all " +
                (i === idx 
                  ? "border-neutral-900 ring-2 ring-neutral-900/20" 
                  : "border-neutral-200 hover:border-neutral-400")
              }
              aria-label={`View image ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={alt} className="h-full w-full object-contain" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}

      {/* Lightbox modal */}
      {open && current && (
        <Lightbox
          src={current}
          alt={alt}
          onClose={() => setOpen(false)}
          images={imgs}
          currentIndex={idx}
          onNavigate={setIdx}
        />
      )}
    </div>
  );
}
