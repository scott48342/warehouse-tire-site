/**
 * Vehicle Lookup by Slug
 * 
 * Maps URL slugs to normalized vehicle objects
 * Uses existing fitment system data sources
 */

import { parseVehicleSlug, VehicleSlugParts } from './slugifyVehicle'

export interface VehicleLookupResult {
  year: string
  make: string
  model: string
  trim?: string
  modificationId?: string
  tireSizes?: string[]
  source: 'parsed' | 'api' | 'db'
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
 * Look up a vehicle by its URL slug
 * Returns null if the vehicle cannot be resolved
 */
export async function getVehicleBySlug(slug: string): Promise<VehicleLookupResult | null> {
  // Step 1: Parse the slug
  const parsed = parseVehicleSlug(slug)
  if (!parsed) return null

  // Step 2: Normalize the make
  const normalizedMake = KNOWN_MAKES[parsed.make.toLowerCase()] || parsed.make

  // Step 3: Validate year range
  const year = parseInt(parsed.year, 10)
  if (year < 1990 || year > new Date().getFullYear() + 1) {
    return null
  }

  // Step 4: Return normalized vehicle
  // For now, we trust the parsed data. The actual tire search
  // will validate against the Wheel-Size API when the user clicks through.
  return {
    year: parsed.year,
    make: normalizedMake,
    model: parsed.model,
    trim: parsed.trim,
    source: 'parsed',
  }
}

/**
 * Build tire search URL for a vehicle
 */
export function buildTireSearchUrl(vehicle: VehicleLookupResult): string {
  const params = new URLSearchParams({
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
  })
  
  if (vehicle.trim) {
    params.set('trim', vehicle.trim)
  }

  return `/tires?${params.toString()}`
}

/**
 * Format vehicle for display
 */
export function formatVehicleName(vehicle: VehicleLookupResult): string {
  const parts = [vehicle.year, vehicle.make, vehicle.model]
  if (vehicle.trim) {
    parts.push(vehicle.trim)
  }
  return parts.join(' ')
}
