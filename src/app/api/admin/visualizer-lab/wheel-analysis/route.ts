import { NextResponse } from "next/server";
import { getTechfeedWheelBySku } from "@/lib/techfeed/wheels";
import {
  analyzeWheelImages,
  getBestVisualizerImage,
  type WheelVisualizerMetadata,
} from "@/lib/visualizer-lab/wheelImageAnalysis";

export const runtime = "nodejs";

/**
 * Admin-only API for analyzing wheel visualizer compatibility.
 * 
 * ⚠️ INTERNAL USE ONLY - for admin tools and visualizer lab.
 * This does NOT affect live site behavior.
 * 
 * GET /api/admin/visualizer-lab/wheel-analysis?sku=ABC123
 * GET /api/admin/visualizer-lab/wheel-analysis?skus=ABC123,DEF456,GHI789
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const singleSku = url.searchParams.get("sku");
  const multipleSkus = url.searchParams.get("skus");

  // Single SKU analysis
  if (singleSku) {
    const wheel = await getTechfeedWheelBySku(singleSku);
    
    if (!wheel) {
      return NextResponse.json(
        { error: "SKU not found in techfeed", sku: singleSku },
        { status: 404 }
      );
    }

    const images = wheel.images || [];
    const analysis = analyzeWheelImages(images);
    const bestImage = getBestVisualizerImage(images, "angled");

    return NextResponse.json({
      sku: singleSku,
      brand: wheel.brand_desc,
      style: wheel.style || wheel.display_style_no,
      finish: wheel.abbreviated_finish_desc,
      totalImages: images.length,
      analysis,
      bestVisualizerImage: bestImage,
      allImages: images,
    });
  }

  // Multiple SKU analysis
  if (multipleSkus) {
    const skus = multipleSkus.split(",").map((s) => s.trim()).filter(Boolean);
    
    if (skus.length === 0) {
      return NextResponse.json(
        { error: "No valid SKUs provided" },
        { status: 400 }
      );
    }

    if (skus.length > 50) {
      return NextResponse.json(
        { error: "Maximum 50 SKUs per request" },
        { status: 400 }
      );
    }

    const results: Array<{
      sku: string;
      found: boolean;
      brand?: string;
      style?: string;
      analysis?: WheelVisualizerMetadata;
      bestVisualizerImage?: string | null;
    }> = [];

    let compatible = 0;
    let withFace = 0;
    let withAngled = 0;

    for (const sku of skus) {
      const wheel = await getTechfeedWheelBySku(sku);
      
      if (!wheel) {
        results.push({ sku, found: false });
        continue;
      }

      const images = wheel.images || [];
      const analysis = analyzeWheelImages(images);
      const bestImage = getBestVisualizerImage(images, "angled");

      if (analysis.visualizerCompatible) compatible++;
      if (analysis.hasFaceImage) withFace++;
      if (analysis.hasAngledImage) withAngled++;

      results.push({
        sku,
        found: true,
        brand: wheel.brand_desc,
        style: wheel.style || wheel.display_style_no,
        analysis,
        bestVisualizerImage: bestImage,
      });
    }

    return NextResponse.json({
      totalRequested: skus.length,
      totalFound: results.filter((r) => r.found).length,
      summary: {
        visualizerCompatible: compatible,
        withFaceImage: withFace,
        withAngledImage: withAngled,
        compatibilityRate: skus.length > 0 
          ? Math.round((compatible / skus.length) * 100) 
          : 0,
      },
      results,
    });
  }

  return NextResponse.json(
    { 
      error: "Provide ?sku=ABC123 or ?skus=ABC123,DEF456",
      usage: {
        single: "/api/admin/visualizer-lab/wheel-analysis?sku=D10017907536",
        multiple: "/api/admin/visualizer-lab/wheel-analysis?skus=SKU1,SKU2,SKU3",
      }
    },
    { status: 400 }
  );
}
