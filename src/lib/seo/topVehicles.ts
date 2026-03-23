/**
 * Top Vehicles for Static Generation
 * 
 * Re-exports from vehicleData.ts for backwards compatibility.
 * The actual vehicle data is now in vehicleData.ts.
 */

export {
  PREBUILD_VEHICLES as TOP_VEHICLES,
  getPrebuildVehicleSlugs as getTopVehicleSlugs,
  getStaticVehicleParams,
  getAllVehicleSlugs,
  getRelatedVehicles,
  VEHICLE_STATS,
} from './vehicleData'
