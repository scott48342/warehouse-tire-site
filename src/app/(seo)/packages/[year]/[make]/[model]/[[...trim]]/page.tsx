/**
 * SEO Landing Page: Wheel & Tire Packages by Vehicle
 * 
 * Route: /packages/[year]/[make]/[model]/[[...trim]]
 * 
 * Features:
 * - Real product counts (estimated from wheels × tires)
 * - Cross-links to wheels and tires pages
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
  
  const hasResults = counts.hasFitment && counts.packages > 0;
  const canonical = buildCanonicalUrl("packages", vehicle.year, vehicle.make, vehicle.model, vehicle.trim);
  
  const metadata = buildSEOMetadata({
    vehicle,
    fitment,
    productType: "packages",
    hasResults,
    resultCount: counts.packages,
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

export default async function PackagesSEOPage({ params }: PageProps) {
  const resolvedParams = await params;
  const vehicle = resolveVehicle(resolvedParams);
  
  if (!isValidYear(vehicle.year)) {
    notFound();
  }
  
  // Fetch all data in parallel
  const [fitment, counts, popularSizes] = await Promise.all([
    getFitmentFacts(vehicle),
    getAllCountsByFitment(vehicle.year, vehicle.make, vehicle.model, vehicle.trim),
    getPopularWheelSizes(vehicle.year, vehicle.make, vehicle.model),
  ]);
  
  return (
    <VehicleLandingPage
      productType="packages"
      vehicle={vehicle}
      fitment={fitment}
      counts={counts}
      popularWheelSizes={popularSizes}
    />
  );
}
