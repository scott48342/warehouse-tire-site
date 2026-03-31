/**
 * Dynamic OG Image for Wheels SEO Pages
 * 
 * Generates a branded social preview image with vehicle info
 */

import { ImageResponse } from "next/og";
import { type VehicleParams, resolveVehicle, isValidYear } from "@/lib/seo";

export const runtime = "edge";
export const alt = "Wheels for your vehicle - Warehouse Tire Direct";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

interface Props {
  params: Promise<VehicleParams>;
}

export default async function OgImage({ params }: Props) {
  const resolvedParams = await params;
  const vehicle = resolveVehicle(resolvedParams);
  
  if (!isValidYear(vehicle.year)) {
    // Fallback image for invalid vehicles
    return new ImageResponse(
      (
        <div
          style={{
            background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "system-ui",
          }}
        >
          <div style={{ fontSize: 64, fontWeight: 700, color: "#ffffff" }}>
            Warehouse Tire Direct
          </div>
          <div style={{ fontSize: 32, color: "#dc2626", marginTop: 20 }}>
            Custom Wheels &amp; Tires
          </div>
        </div>
      ),
      size
    );
  }
  
  const vehicleName = `${vehicle.year} ${vehicle.displayMake} ${vehicle.displayModel}`;
  const trimText = vehicle.displayTrim ? vehicle.displayTrim : "";
  
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
          fontFamily: "system-ui",
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
          {trimText && (
            <div
              style={{
                fontSize: 36,
                color: "#a3a3a3",
                marginTop: "10px",
              }}
            >
              {trimText}
            </div>
          )}
          <div
            style={{
              fontSize: 42,
              fontWeight: 600,
              color: "#dc2626",
              marginTop: "30px",
            }}
          >
            Custom Wheels &amp; Rims
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                color: "#a3a3a3",
                fontSize: 24,
              }}
            >
              ✓ Verified Fitment
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                color: "#a3a3a3",
                fontSize: 24,
              }}
            >
              ✓ Professional Install
            </div>
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
    size
  );
}
