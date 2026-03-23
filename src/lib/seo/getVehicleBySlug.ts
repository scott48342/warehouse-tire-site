/**
 * Vehicle Lookup by Slug
 * 
 * Maps URL slugs to normalized vehicle objects with trim resolution
 */

import { parseVehicleSlug, VehicleSlugParts } from './slugifyVehicle'

export interface TrimOption {
  label: string
  modificationId: string
  searchUrl: string
}

export interface VehicleLookupResult {
  year: string
  make: string
  model: string
  trim?: string
  trims: TrimOption[]
  autoResolvable: boolean  // true if exactly one trim exists
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
 * Build tire search URL with full params for direct results
 */
function buildTireSearchUrlWithMod(
  year: string,
  make: string,
  model: string,
  modificationId: string,
  trimLabel: string
): string {
  const params = new URLSearchParams({
    year,
    make,
    model,
    modification: modificationId,
  })
  
  // Only include trim if it's a real label (not a modificationId)
  if (trimLabel && !trimLabel.startsWith('s_') && !/^[a-f0-9]{10}$/.test(trimLabel)) {
    params.set('trim', trimLabel)
  }

  return `/tires?${params.toString()}`
}

/**
 * Fetch trims from the API
 */
async function fetchTrims(
  year: string, 
  make: string, 
  model: string
): Promise<{ results: Array<{ label: string; modificationId: string }> } | null> {
  try {
    // Determine base URL for SSR
    let baseUrl = ''
    if (typeof window === 'undefined') {
      // Server-side: need absolute URL
      if (process.env.NEXT_PUBLIC_BASE_URL) {
        baseUrl = process.env.NEXT_PUBLIC_BASE_URL
      } else if (process.env.VERCEL_URL) {
        baseUrl = `https://${process.env.VERCEL_URL}`
      } else {
        baseUrl = 'http://localhost:3000'
      }
    }
    
    const params = new URLSearchParams({ year, make, model })
    const url = `${baseUrl}/api/vehicles/trims?${params.toString()}`
    
    const res = await fetch(url, {
      cache: 'force-cache',  // Cache trim lookups
      next: { revalidate: 86400 }  // Revalidate daily
    })
    
    if (!res.ok) {
      console.error('[fetchTrims] API returned non-OK:', res.status, url)
      return null
    }
    return res.json()
  } catch (error) {
    console.error('[fetchTrims] Failed to fetch trims:', error)
    return null
  }
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

  // Step 4: Fetch available trims
  const trimData = await fetchTrims(parsed.year, normalizedMake, parsed.model)
  
  if (!trimData?.results?.length) {
    // No trims found - still return vehicle but not auto-resolvable
    return {
      year: parsed.year,
      make: normalizedMake,
      model: parsed.model,
      trims: [],
      autoResolvable: false,
      source: 'parsed',
    }
  }

  // Build trim options with search URLs
  const trims: TrimOption[] = trimData.results.map(t => ({
    label: t.label,
    modificationId: t.modificationId,
    searchUrl: buildTireSearchUrlWithMod(
      parsed.year,
      normalizedMake,
      parsed.model,
      t.modificationId,
      t.label
    ),
  }))

  return {
    year: parsed.year,
    make: normalizedMake,
    model: parsed.model,
    trims,
    autoResolvable: trims.length === 1,
    source: trimData.results.length > 0 ? 'api' : 'parsed',
  }
}

/**
 * Build tire search URL for a vehicle (basic, without modification)
 * Use this only as fallback - prefer trim-specific URLs
 */
export function buildTireSearchUrl(vehicle: VehicleLookupResult): string {
  // If auto-resolvable, use the single trim's URL
  if (vehicle.autoResolvable && vehicle.trims.length === 1) {
    return vehicle.trims[0].searchUrl
  }
  
  // Otherwise return basic URL (will prompt for trim selection)
  const params = new URLSearchParams({
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
  })
  return `/tires?${params.toString()}`
}

/**
 * Format vehicle for display
 */
export function formatVehicleName(vehicle: VehicleLookupResult): string {
  const parts = [vehicle.year, vehicle.make, vehicle.model]
  return parts.join(' ')
}
