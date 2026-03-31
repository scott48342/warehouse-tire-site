/**
 * Dynamic OG Image for Tires SEO Pages
 */

import { ImageResponse } from "next/og";
import { type VehicleParams, resolveVehicle, isValidYear } from "@/lib/seo";

export const runtime = "edge";
export const alt = "Tires for your vehicle - Warehouse Tire Direct";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface Props {
  params: Promise<VehicleParams>;
}

export default async function OgImage({ params }: Props) {
  const resolvedParams = await params;
  const vehicle = resolveVehicle(resolvedParams);
  
  if (!isValidYear(vehicle.year)) {
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
            Quality Tires &amp; Service
          </div>
        </div>
      ),
      size
    );
  }
  
  const vehicleName = `${vehicle.year} ${vehicle.displayMake} ${vehicle.displayModel}`;
  
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
        <div style={{ display: "flex", alignItems: "center", marginBottom: "auto" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#dc2626" }}>
            WAREHOUSE TIRE DIRECT
          </div>
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", marginBottom: "60px" }}>
          <div style={{ fontSize: 72, fontWeight: 700, color: "#ffffff", lineHeight: 1.1 }}>
            {vehicleName}
          </div>
          <div style={{ fontSize: 42, fontWeight: 600, color: "#dc2626", marginTop: "30px" }}>
            Tires &amp; Installation
          </div>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "2px solid #404040", paddingTop: "30px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "40px" }}>
            <div style={{ color: "#a3a3a3", fontSize: 24 }}>✓ All Seasons</div>
            <div style={{ color: "#a3a3a3", fontSize: 24 }}>✓ Performance</div>
            <div style={{ color: "#a3a3a3", fontSize: 24 }}>✓ All-Terrain</div>
          </div>
          <div style={{ color: "#ffffff", fontSize: 24, fontWeight: 600 }}>
            (248) 332-4120
          </div>
        </div>
      </div>
    ),
    size
  );
}
