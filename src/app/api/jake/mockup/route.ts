/**
 * Jake Visual Mockup API
 * 
 * POST /api/jake/mockup
 * 
 * Generates visual inspiration mockups showing wheel/tire setups on vehicles.
 * Uses image reference with high fidelity to preserve wheel design.
 * For VISUAL INSPIRATION ONLY - not fitment verification.
 * 
 * @updated 2026-06-15 - Switch to wheelMockup with image reference
 */

import { NextRequest, NextResponse } from "next/server";
import { generateWheelMockup, WheelMockupRequest, MOCKUP_DISCLAIMER } from "@/lib/jake/wheelMockup";

export const runtime = "nodejs";
export const maxDuration = 180; // Image generation with reference can take longer

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate required fields
    const { vehicle, build } = body;
    
    if (!vehicle?.year || !vehicle?.make || !vehicle?.model || !vehicle?.color) {
      return NextResponse.json(
        { error: "Missing required vehicle fields (year, make, model, color)" },
        { status: 400 }
      );
    }
    
    if (!build?.wheelStyle || !build?.wheelSize) {
      return NextResponse.json(
        { error: "Missing required build fields (wheelStyle, wheelSize)" },
        { status: 400 }
      );
    }
    
    // Need EITHER a SKU (preferred - server resolves the real image) OR an imageUrl.
    if (!build?.wheelSku && !build?.wheelImageUrl) {
      return NextResponse.json(
        { 
          error: "Missing wheelSku or wheelImageUrl - one is required for accurate wheel mockups",
          hint: "Pass the wheel product sku (preferred) or imageUrl from search results"
        },
        { status: 400 }
      );
    }

    // Resolve authoritative image + brand/model from SKU when provided.
    // LLM-pasted image URLs are error-prone (wrong color/style); the SKU is reliable.
    let resolvedImageUrl: string = build.wheelImageUrl || "";
    let resolvedBrand: string = build.wheelBrand || "";
    let resolvedModel: string = build.wheelModel || "";

    // TRUSTED IMAGE PASS-THROUGH (2026-06-18):
    // Callers like the wheel SRP "Visualize" button already hold the EXACT
    // per-SKU finish-accurate product image from the catalog feed. Re-resolving
    // that via the fuzzy /api/search lookup can return a different finish
    // variant (e.g. bronze instead of satin black) or miss entirely. So when the
    // caller passes a trusted WheelPros asset URL (or explicitly sets
    // build.trustImageUrl), use it verbatim and skip search re-resolution.
    const looksLikeWheelProsAsset = /(?:assets|cdn)\.wheelpros\.com\//i.test(build.wheelImageUrl || "");
    const trustProvidedImage = Boolean(build.trustImageUrl) || looksLikeWheelProsAsset;

    if (build.wheelSku && trustProvidedImage && resolvedImageUrl) {
      console.log(`[Jake Mockup] ✅ Trusting provided per-SKU image for ${build.wheelSku} (skipping search re-resolution)`);
      // Still fill brand/model from build fields below; keep the exact image.
      resolvedBrand = build.wheelBrand || resolvedBrand;
      resolvedModel = build.wheelModel || resolvedModel;
    } else if (build.wheelSku) {
      try {
        const origin = new URL(req.url).origin;
        const lookupRes = await fetch(`${origin}/api/search?q=${encodeURIComponent(build.wheelSku)}`, { cache: "no-store" });
        if (lookupRes.ok) {
          const lookupData = await lookupRes.json();
          const hit = (lookupData.results || []).find(
            (r: any) => r.type === "wheel" && String(r.sku) === String(build.wheelSku)
          ) || (lookupData.results || [])[0];
          if (hit?.image) {
            resolvedImageUrl = hit.image;
            if (hit.brand) resolvedBrand = hit.brand;
            if (hit.name) resolvedModel = hit.name;
            console.log(`[Jake Mockup] ✅ Resolved image from SKU ${build.wheelSku}`);
          }
        }
      } catch (e) {
        console.warn(`[Jake Mockup] ⚠️ SKU resolution failed, using provided imageUrl: ${e}`);
      }
    }

    if (!resolvedImageUrl) {
      return NextResponse.json(
        { error: "Could not resolve a wheel image from the provided sku/imageUrl" },
        { status: 400 }
      );
    }
    
    console.log(`[Jake Mockup] ═══════════════════════════════════════════════════`);
    console.log(`[Jake Mockup] ${vehicle.color} ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
    console.log(`[Jake Mockup] Wheel: ${build.wheelSize}" ${build.wheelStyle}`);
    console.log(`[Jake Mockup] Image URL: ${resolvedImageUrl.substring(0, 60)}...`);
    console.log(`[Jake Mockup] Lift: ${build.style || "stock"}`);
    
    // Parse wheel brand/model from wheelStyle if not provided separately
    let wheelBrand = resolvedBrand || "";
    let wheelModel = resolvedModel || "";
    
    if (!wheelBrand && build.wheelStyle) {
      // Try to parse "Fuel Flame Platinum Bronze" -> brand: "Fuel", model: "Flame Platinum Bronze"
      const parts = build.wheelStyle.split(" ");
      if (parts.length >= 2) {
        wheelBrand = parts[0];
        wheelModel = parts.slice(1).join(" ");
      } else {
        wheelBrand = build.wheelStyle;
        wheelModel = "";
      }
    }
    
    // Convert lift style
    let liftStyle = build.style || "stock";
    if (liftStyle === "lifted") liftStyle = "4 inch lift"; // Default lift
    if (liftStyle === "lifted-2") liftStyle = "2 inch lift";
    if (liftStyle === "lifted-4") liftStyle = "4 inch lift";
    if (liftStyle === "lifted-6") liftStyle = "6 inch lift";

    // Resolve tire image from SKU + size (same approach as wheels)
    let tireImageUrl: string | undefined = build.tireImageUrl || undefined;
    if (build.tireSku && build.tireSize && !tireImageUrl) {
      try {
        const origin = new URL(req.url).origin;
        const tParams = new URLSearchParams({ size: String(build.tireSize), partNumber: String(build.tireSku), limit: "1" });
        const tRes = await fetch(`${origin}/api/tires/search?${tParams}`, { cache: "no-store" });
        if (tRes.ok) {
          const tData = await tRes.json();
          const tHit = (tData.results || tData.tires || []).find(
            (t: any) => String(t.partNumber || t.sku) === String(build.tireSku)
          ) || (tData.results || tData.tires || [])[0];
          if (tHit?.imageUrl) {
            tireImageUrl = tHit.imageUrl;
            console.log(`[Jake Mockup] ✅ Resolved tire image from SKU ${build.tireSku}`);
          }
        }
      } catch (e) {
        console.warn(`[Jake Mockup] ⚠️ Tire SKU resolution failed: ${e}`);
      }
    }

    const tireInput = (build.tireSize || build.tireSku || build.tireBrand || build.tireTerrain)
      ? {
          size: build.tireSize || undefined,
          brand: build.tireBrand || undefined,
          model: build.tireModel || undefined,
          imageUrl: tireImageUrl,
          terrain: build.tireTerrain || undefined,
        }
      : undefined;

    const request: WheelMockupRequest = {
      vehicle: {
        year: parseInt(vehicle.year),
        make: vehicle.make,
        model: vehicle.model,
        color: vehicle.color,
      },
      wheel: {
        brand: wheelBrand,
        model: wheelModel,
        imageUrl: resolvedImageUrl,
        finish: build.wheelFinish || undefined,
        size: parseInt(build.wheelSize),
      },
      tire: tireInput,
      lift: liftStyle,
    };
    
    const result = await generateWheelMockup(request);
    
    if (!result.success) {
      console.error(`[Jake Mockup] ❌ Failed: ${result.error}`);
      return NextResponse.json(
        { 
          success: false,
          error: result.error || "Generation failed",
          disclaimer: MOCKUP_DISCLAIMER,
          generationTime: result.generationTimeMs,
          confidence: result.confidence || "low",
        },
        { status: 500 }
      );
    }
    
    console.log(`[Jake Mockup] ✅ Success: ${result.method}, ${result.generationTimeMs}ms, cached: ${result.cached}`);
    console.log(`[Jake Mockup] ═══════════════════════════════════════════════════`);
    
    return NextResponse.json({
      success: true,
      imageUrl: result.imageUrl,
      disclaimer: MOCKUP_DISCLAIMER,
      generationMethod: result.method,
      composited: result.composited ?? false,
      cached: result.cached,
      generationTime: result.generationTimeMs,
      confidence: result.confidence,
    });
    
  } catch (error) {
    console.error("[Jake Mockup] Error:", error);
    return NextResponse.json(
      { 
        error: "Internal server error",
        disclaimer: MOCKUP_DISCLAIMER,
      },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "jake-mockup-v7",
    disclaimer: MOCKUP_DISCLAIMER,
    features: ["image-reference", "input_fidelity:high"],
  });
}
