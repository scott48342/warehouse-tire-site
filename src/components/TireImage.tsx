'use client'

import { useState, useCallback } from 'react'
import { getTireImage, DEFAULT_TIRE_IMAGE, isDefaultImage } from '@/lib/images/tireImageMap'

interface TireImageProps {
  imageUrl?: string | null
  brand?: string | null
  model?: string | null
  alt: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showBrandFallback?: boolean
}

const sizeClasses = {
  sm: 'h-24 w-full',
  md: 'h-48 w-full',
  lg: 'h-64 w-full',
}

/**
 * TireImage component with smart fallback chain:
 * 1. API image → 2. Model match → 3. Brand match → 4. Default SVG
 * 
 * Handles loading states and broken images gracefully.
 */
export function TireImage({
  imageUrl,
  brand,
  model,
  alt,
  className = '',
  size = 'md',
  showBrandFallback = true,
}: TireImageProps) {
  const [imgSrc, setImgSrc] = useState(() => getTireImage(imageUrl, brand, model))
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const handleError = useCallback(() => {
    setHasError(true)
    setIsLoading(false)
    // Fall back to default image on error
    if (imgSrc !== DEFAULT_TIRE_IMAGE) {
      setImgSrc(DEFAULT_TIRE_IMAGE)
    }
  }, [imgSrc])

  const handleLoad = useCallback(() => {
    setIsLoading(false)
  }, [])

  const sizeClass = sizeClasses[size]
  const isDefault = isDefaultImage(imgSrc)

  // If we're showing the default SVG placeholder
  if (hasError || isDefault) {
    return (
      <div 
        className={`${sizeClass} ${className} grid place-items-center bg-white p-3 text-center rounded-lg`}
      >
        <div>
          {/* SVG Tire Icon */}
          <svg
            className="w-16 h-16 mx-auto text-neutral-300"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="12" cy="12" r="2" />
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4" />
          </svg>
          <div className="mt-2 text-xs font-semibold text-neutral-500">
            {brand || 'Tire'}
          </div>
          {showBrandFallback && model && (
            <div className="text-[10px] text-neutral-400 truncate max-w-[120px]">
              {model}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`${sizeClass} ${className} relative bg-white rounded-lg overflow-hidden`}>
      {/* Loading skeleton */}
      {isLoading && (
        <div className="absolute inset-0 bg-neutral-100 animate-pulse flex items-center justify-center">
          <svg
            className="w-12 h-12 text-neutral-300"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="5" />
          </svg>
        </div>
      )}
      
      {/* Actual image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imgSrc}
        alt={alt}
        className={`${sizeClass} object-contain transition-opacity duration-200 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        onError={handleError}
        onLoad={handleLoad}
        loading="lazy"
      />
    </div>
  )
}

/**
 * Simple tire placeholder for use in lists/cards
 */
export function TirePlaceholder({ 
  brand, 
  className = '' 
}: { 
  brand?: string | null
  className?: string 
}) {
  return (
    <div className={`grid place-items-center bg-white p-3 text-center ${className}`}>
      <div>
        <svg
          className="w-12 h-12 mx-auto text-neutral-300"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="2" />
        </svg>
        <div className="mt-1 text-xs font-semibold text-neutral-500">
          {brand || 'Tire'}
        </div>
      </div>
    </div>
  )
}
