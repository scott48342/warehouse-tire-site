/**
 * Dynamic OG Image API
 * 
 * Generates branded social preview images for SEO pages
 * 
 * Usage: /api/og?year=2024&make=ford&model=f-150&type=wheels
 */

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

// Display name formatting
function getDisplayName(slug: string): string {
  return slug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const typeLabels: Record<string, string> = {
  wheels: "Custom Wheels & Rims",
  tires: "Tires & Installation",
  packages: "Wheel & Tire Packages",
};

const typeFeatures: Record<string, string[]> = {
  wheels: ["✓ Verified Fitment", "✓ Professional Install"],
  tires: ["✓ All Seasons", "✓ Performance", "✓ All-Terrain"],
  packages: ["✓ Mounted & Balanced", "✓ TPMS Included"],
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  
  const year = searchParams.get("year") || "";
  const make = searchParams.get("make") || "";
  const model = searchParams.get("model") || "";
  const type = searchParams.get("type") || "wheels";
  
  const displayMake = getDisplayName(make);
  const displayModel = getDisplayName(model);
  const vehicleName = year && make && model 
    ? `${year} ${displayMake} ${displayModel}`
    : "Your Vehicle";
  
  const label = typeLabels[type] || typeLabels.wheels;
  const features = typeFeatures[type] || typeFeatures.wheels;
  
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "60px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Top bar with logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "auto",
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "#dc2626",
              letterSpacing: "-0.02em",
            }}
          >
            WAREHOUSE TIRE DIRECT
          </div>
        </div>
        
        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginBottom: "60px",
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            {vehicleName}
          </div>
          <div
            style={{
              fontSize: 42,
              fontWeight: 600,
              color: "#dc2626",
              marginTop: "30px",
            }}
          >
            {label}
          </div>
        </div>
        
        {/* Bottom info */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "2px solid #404040",
            paddingTop: "30px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "40px" }}>
            {features.map((feature, i) => (
              <div
                key={i}
                style={{
                  color: "#a3a3a3",
                  fontSize: 24,
                }}
              >
                {feature}
              </div>
            ))}
          </div>
          <div
            style={{
              color: "#ffffff",
              fontSize: 24,
              fontWeight: 600,
            }}
          >
            (248) 332-4120
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
