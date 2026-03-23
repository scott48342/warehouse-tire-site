/**
 * Comprehensive Vehicle Data for SEO Pages
 * 
 * This file contains 2000+ vehicle definitions for SEO landing pages.
 * Vehicles are sourced from US sales data and common search patterns.
 * 
 * Structure:
 * - PREBUILD_VEHICLES: Top ~200 high-volume vehicles (built at deploy time)
 * - ALL_VEHICLES: Full list of 2000+ vehicles (ISR on-demand)
 */

import { slugifyVehicle, VehicleSlugParts } from './slugifyVehicle'

// ============================================================================
// VEHICLE DEFINITIONS
// ============================================================================

// Year ranges for different vehicle generations
const YEARS_RECENT = ['2024', '2023', '2022', '2021', '2020']
const YEARS_MID = ['2019', '2018', '2017', '2016', '2015']
const YEARS_OLDER = ['2014', '2013', '2012', '2011', '2010']
const ALL_YEARS = [...YEARS_RECENT, ...YEARS_MID, ...YEARS_OLDER]

// High-volume makes and their popular models
const VEHICLE_CATALOG: Record<string, string[]> = {
  // US Big 3 - Trucks & SUVs (highest volume)
  'Ford': [
    'F-150', 'F-250', 'F-350', 'Ranger', 'Maverick',
    'Explorer', 'Expedition', 'Bronco', 'Bronco Sport', 'Escape',
    'Edge', 'Mustang', 'Mustang Mach-E', 'Focus', 'Fusion',
  ],
  'Chevrolet': [
    'Silverado 1500', 'Silverado 2500HD', 'Silverado 3500HD', 'Colorado',
    'Tahoe', 'Suburban', 'Equinox', 'Traverse', 'Blazer', 'Trailblazer',
    'Malibu', 'Camaro', 'Corvette', 'Bolt EV', 'Trax',
  ],
  'GMC': [
    'Sierra 1500', 'Sierra 2500HD', 'Sierra 3500HD', 'Canyon',
    'Yukon', 'Yukon XL', 'Acadia', 'Terrain', 'Hummer EV',
  ],
  'RAM': [
    'Ram 1500', 'Ram 2500', 'Ram 3500', 'ProMaster',
  ],
  'Dodge': [
    'Durango', 'Challenger', 'Charger', 'Hornet', 'Journey', 'Grand Caravan',
  ],
  'Jeep': [
    'Wrangler', 'Grand Cherokee', 'Cherokee', 'Compass', 'Renegade',
    'Gladiator', 'Wagoneer', 'Grand Wagoneer',
  ],
  'Chrysler': [
    'Pacifica', '300',
  ],

  // Japanese makes
  'Toyota': [
    'Camry', 'Corolla', 'RAV4', 'Highlander', 'Tacoma', 'Tundra',
    '4Runner', 'Sienna', 'Prius', 'Avalon', 'Supra', 'GR86',
    'Venza', 'C-HR', 'Sequoia', 'Land Cruiser',
  ],
  'Honda': [
    'Civic', 'Accord', 'CR-V', 'Pilot', 'HR-V', 'Passport',
    'Odyssey', 'Ridgeline', 'Fit', 'Insight',
  ],
  'Nissan': [
    'Altima', 'Sentra', 'Maxima', 'Rogue', 'Pathfinder', 'Murano',
    'Armada', 'Frontier', 'Titan', 'Kicks', 'Versa', 'Leaf', 'Z',
  ],
  'Mazda': [
    'CX-5', 'CX-9', 'CX-30', 'CX-50', 'Mazda3', 'Mazda6', 'MX-5 Miata',
  ],
  'Subaru': [
    'Outback', 'Forester', 'Crosstrek', 'Ascent', 'Impreza', 'Legacy',
    'WRX', 'BRZ', 'Solterra',
  ],
  'Mitsubishi': [
    'Outlander', 'Eclipse Cross', 'Outlander Sport',
  ],

  // Korean makes
  'Hyundai': [
    'Tucson', 'Santa Fe', 'Palisade', 'Kona', 'Elantra', 'Sonata',
    'Ioniq 5', 'Ioniq 6', 'Venue', 'Santa Cruz',
  ],
  'Kia': [
    'Telluride', 'Sorento', 'Sportage', 'Seltos', 'Soul', 'Forte',
    'K5', 'Carnival', 'EV6', 'Stinger', 'Niro',
  ],
  'Genesis': [
    'G70', 'G80', 'G90', 'GV70', 'GV80',
  ],

  // German makes
  'Volkswagen': [
    'Jetta', 'Passat', 'Tiguan', 'Atlas', 'Atlas Cross Sport', 'Taos',
    'Golf', 'Golf GTI', 'Golf R', 'ID.4', 'Arteon',
  ],
  'BMW': [
    '3 Series', '5 Series', '7 Series', 'X1', 'X3', 'X5', 'X7',
    'X2', 'X4', 'X6', 'M3', 'M5', 'i4', 'iX',
  ],
  'Mercedes-Benz': [
    'C-Class', 'E-Class', 'S-Class', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS',
    'A-Class', 'CLA', 'EQS', 'EQE',
  ],
  'Audi': [
    'A3', 'A4', 'A6', 'A8', 'Q3', 'Q5', 'Q7', 'Q8', 'e-tron',
  ],
  'Porsche': [
    'Cayenne', 'Macan', '911', 'Taycan', 'Panamera',
  ],

  // Luxury makes
  'Lexus': [
    'RX', 'NX', 'ES', 'IS', 'GX', 'LX', 'UX', 'LC', 'LS',
  ],
  'Acura': [
    'MDX', 'RDX', 'TLX', 'Integra', 'ILX',
  ],
  'Infiniti': [
    'QX50', 'QX55', 'QX60', 'QX80', 'Q50', 'Q60',
  ],
  'Lincoln': [
    'Navigator', 'Aviator', 'Nautilus', 'Corsair',
  ],
  'Cadillac': [
    'Escalade', 'XT4', 'XT5', 'XT6', 'CT4', 'CT5', 'Lyriq',
  ],
  'Volvo': [
    'XC40', 'XC60', 'XC90', 'S60', 'S90', 'V60', 'V90',
  ],
  'Land Rover': [
    'Range Rover', 'Range Rover Sport', 'Discovery', 'Defender', 'Evoque',
  ],
  'Jaguar': [
    'F-Pace', 'E-Pace', 'I-Pace', 'XF', 'F-Type',
  ],

  // EV-focused
  'Tesla': [
    'Model 3', 'Model Y', 'Model S', 'Model X', 'Cybertruck',
  ],
  'Rivian': [
    'R1T', 'R1S',
  ],
  'Lucid': [
    'Air',
  ],
  'Polestar': [
    'Polestar 2',
  ],

  // Other popular makes
  'Buick': [
    'Enclave', 'Envision', 'Encore', 'Encore GX',
  ],
  'MINI': [
    'Cooper', 'Countryman', 'Clubman',
  ],
  'Alfa Romeo': [
    'Giulia', 'Stelvio',
  ],
  'FIAT': [
    '500X', '500',
  ],
}

// Priority ranking for prebuild (highest search volume first)
const PREBUILD_PRIORITY: string[] = [
  // Trucks (highest volume in US)
  'Ford:F-150', 'Chevrolet:Silverado 1500', 'RAM:Ram 1500', 'GMC:Sierra 1500',
  'Toyota:Tacoma', 'Toyota:Tundra', 'Ford:F-250', 'Chevrolet:Silverado 2500HD',
  'Ford:Ranger', 'Chevrolet:Colorado', 'GMC:Canyon', 'Nissan:Frontier',
  
  // SUVs (very high volume)
  'Toyota:RAV4', 'Honda:CR-V', 'Jeep:Wrangler', 'Jeep:Grand Cherokee',
  'Ford:Explorer', 'Toyota:Highlander', 'Chevrolet:Equinox', 'Honda:Pilot',
  'Ford:Escape', 'Mazda:CX-5', 'Hyundai:Tucson', 'Kia:Telluride',
  'Subaru:Outback', 'Toyota:4Runner', 'Chevrolet:Tahoe', 'Ford:Bronco',
  'Jeep:Cherokee', 'Nissan:Rogue', 'Hyundai:Santa Fe', 'Kia:Sorento',
  'GMC:Yukon', 'Ford:Expedition', 'Chevrolet:Suburban', 'Subaru:Forester',
  'Subaru:Crosstrek', 'Honda:Passport', 'Nissan:Pathfinder', 'Chevrolet:Traverse',
  
  // Sedans & Cars (still high volume)
  'Toyota:Camry', 'Honda:Civic', 'Honda:Accord', 'Toyota:Corolla',
  'Nissan:Altima', 'Hyundai:Elantra', 'Hyundai:Sonata', 'Kia:Forte',
  'Mazda:Mazda3', 'Volkswagen:Jetta', 'Subaru:Impreza',
  
  // EVs (growing)
  'Tesla:Model Y', 'Tesla:Model 3', 'Ford:Mustang Mach-E', 'Chevrolet:Bolt EV',
  'Hyundai:Ioniq 5', 'Kia:EV6',
]

// ============================================================================
// VEHICLE GENERATION
// ============================================================================

/**
 * Generate all vehicle definitions
 */
function generateAllVehicles(): VehicleSlugParts[] {
  const vehicles: VehicleSlugParts[] = []
  
  for (const [make, models] of Object.entries(VEHICLE_CATALOG)) {
    for (const model of models) {
      for (const year of ALL_YEARS) {
        vehicles.push({ year, make, model })
      }
    }
  }
  
  return vehicles
}

/**
 * Generate prebuild vehicles (top ~200 for fast initial load)
 */
function generatePrebuildVehicles(): VehicleSlugParts[] {
  const vehicles: VehicleSlugParts[] = []
  
  // Add priority vehicles for recent years
  for (const entry of PREBUILD_PRIORITY) {
    const [make, model] = entry.split(':')
    for (const year of YEARS_RECENT) {
      vehicles.push({ year, make, model })
    }
  }
  
  // Limit to ~200 for build safety
  return vehicles.slice(0, 200)
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * All vehicles (2000+) for sitemap and ISR
 */
export const ALL_VEHICLES = generateAllVehicles()

/**
 * Prebuild vehicles (~200) for generateStaticParams
 */
export const PREBUILD_VEHICLES = generatePrebuildVehicles()

/**
 * Get all vehicle slugs (for sitemap)
 */
export function getAllVehicleSlugs(): string[] {
  return ALL_VEHICLES.map(v => slugifyVehicle(v))
}

/**
 * Get prebuild vehicle slugs (for generateStaticParams)
 */
export function getPrebuildVehicleSlugs(): string[] {
  return PREBUILD_VEHICLES.map(v => slugifyVehicle(v))
}

/**
 * Get static params for prebuild vehicles
 */
export function getStaticVehicleParams(): { vehicleSlug: string }[] {
  return PREBUILD_VEHICLES.map(v => ({
    vehicleSlug: slugifyVehicle(v)
  }))
}

/**
 * Get related vehicles for internal linking
 */
export function getRelatedVehicles(year: string, make: string, model: string): VehicleSlugParts[] {
  const related: VehicleSlugParts[] = []
  const yearNum = parseInt(year, 10)
  
  // Same model, adjacent years
  for (const adjYear of [yearNum - 1, yearNum + 1]) {
    if (adjYear >= 2010 && adjYear <= new Date().getFullYear() + 1) {
      related.push({ year: String(adjYear), make, model })
    }
  }
  
  // Same make, same year, different models (limit to 3)
  const makeModels = VEHICLE_CATALOG[make] || []
  let count = 0
  for (const otherModel of makeModels) {
    if (otherModel !== model && count < 3) {
      related.push({ year, make, model: otherModel })
      count++
    }
  }
  
  return related.slice(0, 5) // Max 5 related
}

// Stats for debugging
export const VEHICLE_STATS = {
  totalVehicles: ALL_VEHICLES.length,
  prebuildVehicles: PREBUILD_VEHICLES.length,
  makes: Object.keys(VEHICLE_CATALOG).length,
  years: ALL_YEARS.length,
}
