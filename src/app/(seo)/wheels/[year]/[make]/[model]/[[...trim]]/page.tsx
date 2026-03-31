/**
 * SEO Landing Page: Wheels by Vehicle
 * 
 * Route: /wheels/[year]/[make]/[model]/[[...trim]]
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  type VehicleParams,
  resolveVehicle,
  isValidYear,
  getFitmentFacts,
  getTopVehicles,
  buildSEOMetadata,
  buildCanonicalUrl,
} from "@/lib/seo";

import { VehicleLandingPage } from "@/components/seo/VehicleLandingPage";

// ============================================================================
// Route Config
// ============================================================================

export const dynamic = "force-static";
export const revalidate = 86400; // Revalidate daily

// ============================================================================
// Static Generation
// ============================================================================

export async function generateStaticParams() {
  const topVehicles = await getTopVehicles(100);
  
  return topVehicles.map(v => ({
    year: String(v.year),
    make: v.make,
    model: v.model,
    trim: undefined,
  }));
}

// ============================================================================
// Metadata
// ============================================================================

interface PageProps {
  params: Promise<VehicleParams>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const vehicle = resolveVehicle(resolvedParams);
  
  if (!isValidYear(vehicle.year)) {
    return { title: "Not Found" };
  }
  
  const fitment = await getFitmentFacts(vehicle);
  const canonical = buildCanonicalUrl("wheels", vehicle.year, vehicle.make, vehicle.model, vehicle.trim);
  
  return buildSEOMetadata({
    vehicle,
    fitment,
    productType: "wheels",
    hasResults: !!fitment?.boltPattern,
    resultCount: fitment ? 1000 : 0,
    canonical,
  });
}

// ============================================================================
// Page Component
// ============================================================================

export default async function WheelsSEOPage({ params }: PageProps) {
  const resolvedParams = await params;
  const vehicle = resolveVehicle(resolvedParams);
  
  if (!isValidYear(vehicle.year)) {
    notFound();
  }
  
  const fitment = await getFitmentFacts(vehicle);
  
  return (
    <VehicleLandingPage
      productType="wheels"
      vehicle={vehicle}
      fitment={fitment}
    />
  );
}
