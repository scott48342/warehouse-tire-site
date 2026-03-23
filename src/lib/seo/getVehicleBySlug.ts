/**
 * Vehicle Lookup by Slug
 * 
 * Maps URL slugs to normalized vehicle objects.
 * Trim data is fetched CLIENT-SIDE to avoid build-time API issues.
 */

import { parseVehicleSlug } from './slugifyVehicle'

export interface VehicleLookupResult {
  year: string
  make: string
  model: string
}

/**
 * Known makes with proper capitalization
 */
const KNOWN_MAKES: Record<string, string> = {
  'gmc': 'GMC',
  'bmw': 'BMW',
  'ram': 'RAM',
  'mini': 'MINI',
  'alfa': 'Alfa Romeo',
  'audi': 'Audi',
  'buick': 'Buick',
  'cadillac': 'Cadillac',
  'chevrolet': 'Chevrolet',
  'chevy': 'Chevrolet',
  'chrysler': 'Chrysler',
  'dodge': 'Dodge',
  'ferrari': 'Ferrari',
  'fiat': 'FIAT',
  'ford': 'Ford',
  'genesis': 'Genesis',
  'honda': 'Honda',
  'hyundai': 'Hyundai',
  'infiniti': 'INFINITI',
  'jaguar': 'Jaguar',
  'jeep': 'Jeep',
  'kia': 'Kia',
  'lamborghini': 'Lamborghini',
  'land': 'Land Rover',
  'lexus': 'Lexus',
  'lincoln': 'Lincoln',
  'lotus': 'Lotus',
  'maserati': 'Maserati',
  'mazda': 'Mazda',
  'mclaren': 'McLaren',
  'mercedes': 'Mercedes-Benz',
  'mitsubishi': 'Mitsubishi',
  'nissan': 'Nissan',
  'porsche': 'Porsche',
  'rivian': 'Rivian',
  'subaru': 'Subaru',
  'suzuki': 'Suzuki',
  'tesla': 'Tesla',
  'toyota': 'Toyota',
  'volkswagen': 'Volkswagen',
  'vw': 'Volkswagen',
  'volvo': 'Volvo',
  'acura': 'Acura',
  'pontiac': 'Pontiac',
  'saturn': 'Saturn',
  'mercury': 'Mercury',
  'oldsmobile': 'Oldsmobile',
  'saab': 'Saab',
  'hummer': 'Hummer',
  'plymouth': 'Plymouth',
  'scion': 'Scion',
}

/**
 * Look up a vehicle by its URL slug.
 * Returns null if the slug is invalid.
 * 
 * NOTE: Trims are NOT fetched here - they're loaded client-side
 * via VehicleTrimSelector to avoid build-time API issues.
 */
export async function getVehicleBySlug(slug: string): Promise<VehicleLookupResult | null> {
  // Parse the slug
  const parsed = parseVehicleSlug(slug)
  if (!parsed) return null

  // Normalize the make
  const normalizedMake = KNOWN_MAKES[parsed.make.toLowerCase()] || parsed.make

  // Validate year range
  const year = parseInt(parsed.year, 10)
  if (year < 1990 || year > new Date().getFullYear() + 1) {
    return null
  }

  return {
    year: parsed.year,
    make: normalizedMake,
    model: parsed.model,
  }
}

/**
 * Format vehicle for display
 */
export function formatVehicleName(vehicle: VehicleLookupResult): string {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}`
}
