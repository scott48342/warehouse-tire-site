/**
 * Wheel-Size API Integration
 * 
 * SAFETY RULES - ALL WHEEL-SIZE CALLS MUST:
 * 1. Go through the safety governor
 * 2. Only be called from admin/background contexts
 * 3. Never be called from customer-facing routes
 * 
 * @see safetyGovernor.ts for implementation
 */

export {
  // Core governor functions
  governedCall,
  getGovernorState,
  getAuditLog,
  getConfig,
  
  // Kill switch
  activateKillSwitch,
  deactivateKillSwitch,
  
  // Population helpers
  processVehicleAllowlist,
  resetDailyCounters,
  
  // Context check (for route protection)
  assertAdminContext,
  
  // Types
  type GovernorConfig,
  type GovernorState,
  type AuditLogEntry,
  type CallResult,
  type VehicleTarget,
  type PopulationOptions,
  type PopulationResult,
  type WheelSizeCallOptions,
} from "./safetyGovernor";
