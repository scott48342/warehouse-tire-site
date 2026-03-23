/**
 * SEO Vehicle Slug Utilities
 * 
 * Converts vehicle info to/from URL-friendly slugs
 * Format: {year}-{make}-{model}-{trim?}
 * Example: "2015 GMC Sierra 2500HD" → "2015-gmc-sierra-2500hd"
 */

export interface VehicleSlugParts {
  year: string
  make: string
  model: string
  trim?: string
}

/**
 * Create a URL slug from vehicle parts
 */
export function slugifyVehicle(vehicle: VehicleSlugParts): string {
  const parts = [
    vehicle.year,
    vehicle.make,
    vehicle.model,
    vehicle.trim,
  ].filter(Boolean)

  return parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')  // Replace special chars with hyphen
    .replace(/-+/g, '-')          // Collapse multiple hyphens
    .replace(/^-|-$/g, '')        // Trim leading/trailing hyphens
}

/**
 * Parse a URL slug back into vehicle parts
 * Returns null if slug is invalid
 */
export function parseVehicleSlug(slug: string): VehicleSlugParts | null {
  if (!slug || typeof slug !== 'string') return null

  const normalized = slug.toLowerCase().trim()
  
  // Must start with a 4-digit year (1990-2099)
  const yearMatch = normalized.match(/^(19\d{2}|20\d{2})-/)
  if (!yearMatch) return null

  const year = yearMatch[1]
  const remainder = normalized.slice(year.length + 1) // Skip year and hyphen

  if (!remainder) return null

  // Split remaining parts
  const parts = remainder.split('-').filter(Boolean)
  if (parts.length < 2) return null // Need at least make and model

  // First part is make
  const make = parts[0]
  
  // Rest is model (and possibly trim)
  // We'll treat everything after make as model for now
  // The lookup function will handle finding the actual vehicle
  const modelParts = parts.slice(1)
  
  // Try to detect common trim patterns at the end
  // This is a heuristic - the lookup function does the real work
  const model = modelParts.join('-')

  return {
    year,
    make: capitalizeFirst(make),
    model: capitalizeModel(model),
  }
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Capitalize model name, handling special cases
 */
function capitalizeModel(model: string): string {
  if (!model) return model
  
  // Special model patterns to preserve
  const preservePatterns: Record<string, string> = {
    'sierra-2500hd': 'Sierra 2500HD',
    'sierra-1500': 'Sierra 1500',
    'sierra-3500hd': 'Sierra 3500HD',
    'silverado-1500': 'Silverado 1500',
    'silverado-2500hd': 'Silverado 2500HD',
    'silverado-3500hd': 'Silverado 3500HD',
    'f-150': 'F-150',
    'f-250': 'F-250',
    'f-350': 'F-350',
    'ram-1500': 'Ram 1500',
    'ram-2500': 'Ram 2500',
    'ram-3500': 'Ram 3500',
    'grand-cherokee': 'Grand Cherokee',
    'land-cruiser': 'Land Cruiser',
    'rav4': 'RAV4',
    'cr-v': 'CR-V',
    'cx-5': 'CX-5',
    'cx-9': 'CX-9',
    '4runner': '4Runner',
  }

  const lowerModel = model.toLowerCase()
  if (preservePatterns[lowerModel]) {
    return preservePatterns[lowerModel]
  }

  // Default: capitalize each word
  return model
    .split('-')
    .map(word => {
      // Preserve all-caps abbreviations (HD, LE, SE, etc)
      if (word.length <= 3 && /^[a-z]+$/.test(word)) {
        return word.toUpperCase()
      }
      // Check if it's a number combo like 2500hd
      if (/^\d+[a-z]+$/i.test(word)) {
        return word.replace(/^(\d+)([a-z]+)$/i, (_, num, letters) => 
          num + letters.toUpperCase()
        )
      }
      return capitalizeFirst(word)
    })
    .join(' ')
}

/**
 * Generate canonical URL for a vehicle
 */
export function getVehicleCanonicalUrl(vehicle: VehicleSlugParts): string {
  const slug = slugifyVehicle(vehicle)
  return `/tires/for/${slug}`
}
