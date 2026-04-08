/**
 * Wheel Image Analysis - Internal Use Only
 * 
 * Provides metadata about wheel image compatibility for the visualizer.
 * THIS IS INTERNAL TOOLING ONLY - do NOT use in customer-facing code.
 * 
 * ⚠️ NO REGRESSION: This module must NOT affect:
 * - Live SRP sorting
 * - Live result ordering
 * - PDP merchandising
 * - Search behavior
 * - Category ordering
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type WheelImageType = "face" | "angled" | "unknown";

export interface WheelVisualizerMetadata {
  /** Whether this wheel has images suitable for the visualizer */
  visualizerCompatible: boolean;
  /** Primary image type detected */
  imageType: WheelImageType;
  /** Has front-facing (FACE) image */
  hasFaceImage: boolean;
  /** Has angled (A1/A2) image */
  hasAngledImage: boolean;
  /** URLs by type (for internal tooling) */
  imagesByType: {
    face: string[];
    angled: string[];
    other: string[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Image URL Pattern Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect image type from URL based on WheelPros naming conventions.
 * 
 * Known patterns:
 * - "-FACE-" or "-FACE." = front-facing view
 * - "-A1-" or "-A1." = angled view (primary)
 * - "-A2-" or "-A2." = angled view (secondary)
 */
export function detectImageType(imageUrl: string): WheelImageType {
  if (!imageUrl) return "unknown";
  
  const url = imageUrl.toUpperCase();
  
  // Front-facing patterns
  if (url.includes("-FACE-") || url.includes("-FACE.") || url.includes("/FACE")) {
    return "face";
  }
  
  // Angled view patterns
  if (
    url.includes("-A1-") || url.includes("-A1.") ||
    url.includes("-A2-") || url.includes("-A2.") ||
    url.includes("/A1") || url.includes("/A2")
  ) {
    return "angled";
  }
  
  return "unknown";
}

/**
 * Analyze a wheel's images and return visualizer metadata.
 * 
 * INTERNAL USE ONLY - for admin tools and visualizer lab.
 * 
 * @param imageUrls - Array of image URLs from techfeed or WheelPros API
 * @returns Visualizer compatibility metadata
 */
export function analyzeWheelImages(imageUrls: string[]): WheelVisualizerMetadata {
  const urls = imageUrls?.filter(Boolean) || [];
  
  const imagesByType: WheelVisualizerMetadata["imagesByType"] = {
    face: [],
    angled: [],
    other: [],
  };
  
  for (const url of urls) {
    const type = detectImageType(url);
    if (type === "face") {
      imagesByType.face.push(url);
    } else if (type === "angled") {
      imagesByType.angled.push(url);
    } else {
      imagesByType.other.push(url);
    }
  }
  
  const hasFaceImage = imagesByType.face.length > 0;
  const hasAngledImage = imagesByType.angled.length > 0;
  
  // Determine primary image type (prefer face for front-facing visualizer)
  let imageType: WheelImageType = "unknown";
  if (hasFaceImage) {
    imageType = "face";
  } else if (hasAngledImage) {
    imageType = "angled";
  }
  
  // Compatible ONLY if we have FACE images
  // ANGLED and UNKNOWN are NOT compatible (for now)
  const visualizerCompatible = hasFaceImage;
  
  return {
    visualizerCompatible,
    imageType,
    hasFaceImage,
    hasAngledImage,
    imagesByType,
  };
}

/**
 * Get the best image URL for the visualizer.
 * 
 * Priority (FACE only for compatibility):
 * 1. Face - REQUIRED for visualizer compatibility
 * 2. Angled - NOT compatible, but returned if no face available
 * 3. Any other image - last resort
 * 
 * @param imageUrls - Array of image URLs
 * @param compatibleOnly - If true, only return FACE images (default: false)
 */
export function getBestVisualizerImage(
  imageUrls: string[],
  compatibleOnly: boolean = false
): string | null {
  const analysis = analyzeWheelImages(imageUrls);
  
  // Face images are the only compatible type
  if (analysis.imagesByType.face.length > 0) {
    return analysis.imagesByType.face[0];
  }
  
  // If compatibleOnly, don't fall back to incompatible images
  if (compatibleOnly) {
    return null;
  }
  
  // Fallback to angled (NOT compatible, but may be useful for preview)
  if (analysis.imagesByType.angled.length > 0) {
    return analysis.imagesByType.angled[0];
  }
  
  // Fallback to any available image
  if (analysis.imagesByType.other.length > 0) {
    return analysis.imagesByType.other[0];
  }
  
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch Analysis (for admin reporting)
// ─────────────────────────────────────────────────────────────────────────────

export interface VisualizerCoverageStats {
  totalAnalyzed: number;
  withAnyImage: number;
  visualizerCompatible: number;
  withFaceImage: number;
  withAngledImage: number;
  compatibilityRate: number;
}

/**
 * Analyze a batch of wheels and return coverage statistics.
 * INTERNAL USE ONLY - for admin reporting.
 */
export function analyzeWheelBatch(
  wheels: Array<{ sku: string; images?: string[] }>
): VisualizerCoverageStats {
  let withAnyImage = 0;
  let visualizerCompatible = 0;
  let withFaceImage = 0;
  let withAngledImage = 0;
  
  for (const wheel of wheels) {
    const images = wheel.images || [];
    if (images.length > 0) {
      withAnyImage++;
      const analysis = analyzeWheelImages(images);
      if (analysis.visualizerCompatible) visualizerCompatible++;
      if (analysis.hasFaceImage) withFaceImage++;
      if (analysis.hasAngledImage) withAngledImage++;
    }
  }
  
  return {
    totalAnalyzed: wheels.length,
    withAnyImage,
    visualizerCompatible,
    withFaceImage,
    withAngledImage,
    compatibilityRate: wheels.length > 0 
      ? Math.round((visualizerCompatible / wheels.length) * 100) 
      : 0,
  };
}
