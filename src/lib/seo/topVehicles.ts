/**
 * Top Vehicles for Static Generation
 * 
 * These are the most popular vehicles to pre-build for SEO
 * All other vehicles use ISR (on-demand generation)
 */

import { slugifyVehicle, VehicleSlugParts } from './slugifyVehicle'

// Top 100 most popular vehicles for SEO pre-generation
// Based on US sales data and common search patterns
export const TOP_VEHICLES: VehicleSlugParts[] = [
  // Ford F-Series (best selling truck)
  { year: '2024', make: 'Ford', model: 'F-150' },
  { year: '2023', make: 'Ford', model: 'F-150' },
  { year: '2022', make: 'Ford', model: 'F-150' },
  { year: '2021', make: 'Ford', model: 'F-150' },
  { year: '2020', make: 'Ford', model: 'F-150' },
  { year: '2019', make: 'Ford', model: 'F-150' },
  { year: '2018', make: 'Ford', model: 'F-150' },
  { year: '2024', make: 'Ford', model: 'F-250' },
  { year: '2023', make: 'Ford', model: 'F-250' },
  { year: '2022', make: 'Ford', model: 'F-250' },
  
  // Chevrolet Silverado
  { year: '2024', make: 'Chevrolet', model: 'Silverado 1500' },
  { year: '2023', make: 'Chevrolet', model: 'Silverado 1500' },
  { year: '2022', make: 'Chevrolet', model: 'Silverado 1500' },
  { year: '2021', make: 'Chevrolet', model: 'Silverado 1500' },
  { year: '2020', make: 'Chevrolet', model: 'Silverado 1500' },
  { year: '2019', make: 'Chevrolet', model: 'Silverado 1500' },
  { year: '2024', make: 'Chevrolet', model: 'Silverado 2500HD' },
  { year: '2023', make: 'Chevrolet', model: 'Silverado 2500HD' },
  
  // RAM Trucks
  { year: '2024', make: 'RAM', model: 'Ram 1500' },
  { year: '2023', make: 'RAM', model: 'Ram 1500' },
  { year: '2022', make: 'RAM', model: 'Ram 1500' },
  { year: '2021', make: 'RAM', model: 'Ram 1500' },
  { year: '2020', make: 'RAM', model: 'Ram 1500' },
  { year: '2024', make: 'RAM', model: 'Ram 2500' },
  { year: '2023', make: 'RAM', model: 'Ram 2500' },
  
  // GMC Sierra
  { year: '2024', make: 'GMC', model: 'Sierra 1500' },
  { year: '2023', make: 'GMC', model: 'Sierra 1500' },
  { year: '2022', make: 'GMC', model: 'Sierra 1500' },
  { year: '2021', make: 'GMC', model: 'Sierra 1500' },
  { year: '2020', make: 'GMC', model: 'Sierra 1500' },
  { year: '2019', make: 'GMC', model: 'Sierra 1500' },
  { year: '2015', make: 'GMC', model: 'Sierra 2500HD' },
  { year: '2020', make: 'GMC', model: 'Sierra 2500HD' },
  
  // Toyota Trucks & SUVs
  { year: '2024', make: 'Toyota', model: 'Tacoma' },
  { year: '2023', make: 'Toyota', model: 'Tacoma' },
  { year: '2022', make: 'Toyota', model: 'Tacoma' },
  { year: '2021', make: 'Toyota', model: 'Tacoma' },
  { year: '2024', make: 'Toyota', model: 'Tundra' },
  { year: '2023', make: 'Toyota', model: 'Tundra' },
  { year: '2022', make: 'Toyota', model: 'Tundra' },
  { year: '2024', make: 'Toyota', model: '4Runner' },
  { year: '2023', make: 'Toyota', model: '4Runner' },
  { year: '2022', make: 'Toyota', model: '4Runner' },
  { year: '2024', make: 'Toyota', model: 'RAV4' },
  { year: '2023', make: 'Toyota', model: 'RAV4' },
  { year: '2022', make: 'Toyota', model: 'RAV4' },
  { year: '2024', make: 'Toyota', model: 'Highlander' },
  { year: '2023', make: 'Toyota', model: 'Highlander' },
  
  // Honda
  { year: '2024', make: 'Honda', model: 'CR-V' },
  { year: '2023', make: 'Honda', model: 'CR-V' },
  { year: '2022', make: 'Honda', model: 'CR-V' },
  { year: '2024', make: 'Honda', model: 'Pilot' },
  { year: '2023', make: 'Honda', model: 'Pilot' },
  { year: '2024', make: 'Honda', model: 'Accord' },
  { year: '2023', make: 'Honda', model: 'Accord' },
  { year: '2024', make: 'Honda', model: 'Civic' },
  { year: '2023', make: 'Honda', model: 'Civic' },
  
  // Jeep
  { year: '2024', make: 'Jeep', model: 'Wrangler' },
  { year: '2023', make: 'Jeep', model: 'Wrangler' },
  { year: '2022', make: 'Jeep', model: 'Wrangler' },
  { year: '2021', make: 'Jeep', model: 'Wrangler' },
  { year: '2020', make: 'Jeep', model: 'Wrangler' },
  { year: '2024', make: 'Jeep', model: 'Grand Cherokee' },
  { year: '2023', make: 'Jeep', model: 'Grand Cherokee' },
  { year: '2022', make: 'Jeep', model: 'Grand Cherokee' },
  { year: '2024', make: 'Jeep', model: 'Cherokee' },
  { year: '2023', make: 'Jeep', model: 'Cherokee' },
  
  // Chevrolet SUVs
  { year: '2024', make: 'Chevrolet', model: 'Tahoe' },
  { year: '2023', make: 'Chevrolet', model: 'Tahoe' },
  { year: '2022', make: 'Chevrolet', model: 'Tahoe' },
  { year: '2024', make: 'Chevrolet', model: 'Suburban' },
  { year: '2023', make: 'Chevrolet', model: 'Suburban' },
  { year: '2024', make: 'Chevrolet', model: 'Equinox' },
  { year: '2023', make: 'Chevrolet', model: 'Equinox' },
  
  // Ford SUVs
  { year: '2024', make: 'Ford', model: 'Explorer' },
  { year: '2023', make: 'Ford', model: 'Explorer' },
  { year: '2022', make: 'Ford', model: 'Explorer' },
  { year: '2024', make: 'Ford', model: 'Expedition' },
  { year: '2023', make: 'Ford', model: 'Expedition' },
  { year: '2024', make: 'Ford', model: 'Bronco' },
  { year: '2023', make: 'Ford', model: 'Bronco' },
  { year: '2022', make: 'Ford', model: 'Bronco' },
  { year: '2024', make: 'Ford', model: 'Escape' },
  { year: '2023', make: 'Ford', model: 'Escape' },
  
  // GMC SUVs
  { year: '2024', make: 'GMC', model: 'Yukon' },
  { year: '2023', make: 'GMC', model: 'Yukon' },
  { year: '2024', make: 'GMC', model: 'Acadia' },
  { year: '2023', make: 'GMC', model: 'Acadia' },
  
  // Nissan
  { year: '2024', make: 'Nissan', model: 'Rogue' },
  { year: '2023', make: 'Nissan', model: 'Rogue' },
  { year: '2024', make: 'Nissan', model: 'Pathfinder' },
  { year: '2023', make: 'Nissan', model: 'Pathfinder' },
  
  // Hyundai/Kia
  { year: '2024', make: 'Hyundai', model: 'Tucson' },
  { year: '2023', make: 'Hyundai', model: 'Tucson' },
  { year: '2024', make: 'Kia', model: 'Telluride' },
  { year: '2023', make: 'Kia', model: 'Telluride' },
  
  // Tesla
  { year: '2024', make: 'Tesla', model: 'Model Y' },
  { year: '2023', make: 'Tesla', model: 'Model Y' },
  { year: '2024', make: 'Tesla', model: 'Model 3' },
  { year: '2023', make: 'Tesla', model: 'Model 3' },
]

/**
 * Get all vehicle slugs for static generation
 */
export function getTopVehicleSlugs(): string[] {
  return TOP_VEHICLES.map(v => slugifyVehicle(v))
}

/**
 * Get static params for Next.js generateStaticParams
 */
export function getStaticVehicleParams(): { vehicleSlug: string }[] {
  return TOP_VEHICLES.map(v => ({
    vehicleSlug: slugifyVehicle(v)
  }))
}
