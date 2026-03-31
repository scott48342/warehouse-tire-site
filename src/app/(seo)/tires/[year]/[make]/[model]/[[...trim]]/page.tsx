/**
 * SEO Landing Page: Tires by Vehicle
 * 
 * Route: /tires/[year]/[make]/[model]/[[...trim]]
 * 
 * Features:
 * - Real product counts from database
 * - Factory tire sizes display
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
  
  const hasResults = counts.hasFitment && counts.tires > 0;
  const canonical = buildCanonicalUrl("tires", vehicle.year, vehicle.make, vehicle.model, vehicle.trim);
  
  const metadata = buildSEOMetadata({
    vehicle,
    fitment,
    productType: "tires",
    hasResults,
    resultCount: counts.tires,
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

export default async function TiresSEOPage({ params }: PageProps) {
  const resolvedParams = await params;
  const vehicle = resolveVehicle(resolvedParams);
  
  if (!isValidYear(vehicle.year)) {
    notFound();
  }
  
  // Fetch all data in parallel
  const [fitment, counts] = await Promise.all([
    getFitmentFacts(vehicle),
    getAllCountsByFitment(vehicle.year, vehicle.make, vehicle.model, vehicle.trim),
  ]);
  
  return (
    <VehicleLandingPage
      productType="tires"
      vehicle={vehicle}
      fitment={fitment}
      counts={counts}
    />
  );
}
