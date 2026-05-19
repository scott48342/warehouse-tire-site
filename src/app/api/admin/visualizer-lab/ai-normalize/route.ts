/**
 * AI Wheel Normalization API (Placeholder)
 * 
 * Future feature: Convert angled wheel images to front-facing assets using AI.
 * Currently returns "not implemented" - architecture is ready for when we add
 * an image generation service (DALL·E, Stable Diffusion, Replicate, etc.)
 * 
 * NO REGRESSION: Isolated admin/lab API only.
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // Future: This will accept a wheel image and return a normalized version
  // For now, return a clear "not implemented" response
  
  return NextResponse.json(
    { 
      error: "AI normalization not yet implemented",
      message: "This feature is planned for a future release. For now, please manually create normalized wheel assets and upload them via the Wheel Asset Manager.",
      hint: "Use /visualizer-lab/wheel-normalizer to manage wheel assets manually.",
    },
    { status: 501 }
  );
}

export async function GET() {
  return NextResponse.json({
    status: "not_implemented",
    message: "AI wheel normalization is a planned future feature",
    currentWorkflow: {
      step1: "Load original supplier image in Wheel Asset Manager",
      step2: "Review image quality (front-facing, transparent, centered, etc.)",
      step3: "If usable: Mark as 'Usable Direct'",
      step4: "If angled: Mark as 'Needs AI Cleanup' and manually create normalized asset",
      step5: "Upload normalized asset URL and mark as 'Manual Upload'",
      step6: "Preview on Tundra visualizer",
    },
    futureFeature: {
      description: "Automatically convert angled wheel images to front-facing using AI",
      backends: ["DALL·E / OpenAI", "Stable Diffusion", "Replicate", "Custom"],
      status: "architecture_ready",
    },
  });
}
