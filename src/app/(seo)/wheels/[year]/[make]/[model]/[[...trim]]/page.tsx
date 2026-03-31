/**
 * SEO Landing Page: Wheels by Vehicle
 * 
 * Route: /wheels/[year]/[make]/[model]/[[...trim]]
 * 
 * Features:
 * - Real product counts from database
 * - Data-driven content (popular sizes, brands)
 * - 400+ prerendered vehicles
 * - noindex for vehicles without inventory
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  type VehicleParams,
  resolveVehicle,
  isValidYear,
  getFitmentFacts,
  buildSEOMetadata,
  buildCanonicalUrl,
  getAllCountsByFitment,
  getPopularWheelSizes,
  getPopularBrands,
} from "@/lib/seo";

import { VehicleLandingPage } from "@/components/seo/VehicleLandingPage";
import { getTopVehiclesForSEO } from "@/lib/seo/staticParams";

// ============================================================================
// Route Config
// ============================================================================

export const dynamic = "force-static";
export const revalidate = 86400; // Revalidate daily

// ============================================================================
// Static Generation (Expanded to 400+ vehicles)
// ============================================================================

export async function generateStaticParams() {
  const vehicles = await getTopVehiclesForSEO(400);
  
  return vehicles.map(v => ({
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
  
  const [fitment, counts] = await Promise.all([
    getFitmentFacts(vehicle),
    getAllCountsByFitment(vehicle.year, vehicle.make, vehicle.model, vehicle.trim),
  ]);
  
  const hasResults = counts.hasFitment && counts.wheels > 0;
  const canonical = buildCanonicalUrl("wheels", vehicle.year, vehicle.make, vehicle.model, vehicle.trim);
  
  const metadata = buildSEOMetadata({
    vehicle,
    fitment,
    productType: "wheels",
    hasResults,
    resultCount: counts.wheels,
    canonical,
  });
  
  // noindex pages without inventory
  if (!hasResults) {
    metadata.robots = {
      index: false,
      follow: true,
    };
  }
  
  return metadata;
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
  
  // Fetch all data in parallel
  const [fitment, counts, popularSizes, popularBrands] = await Promise.all([
    getFitmentFacts(vehicle),
    getAllCountsByFitment(vehicle.year, vehicle.make, vehicle.model, vehicle.trim),
    getPopularWheelSizes(vehicle.year, vehicle.make, vehicle.model),
    getPopularBrands(vehicle.year, vehicle.make, vehicle.model),
  ]);
  
  return (
    <VehicleLandingPage
      productType="wheels"
      vehicle={vehicle}
      fitment={fitment}
      counts={counts}
      popularWheelSizes={popularSizes}
      popularBrands={popularBrands}
    />
  );
}
