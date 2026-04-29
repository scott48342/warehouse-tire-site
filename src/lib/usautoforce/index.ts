/**
 * US AutoForce Direct Integration
 * 
 * LOCAL DEV ONLY - Uses test credentials
 * 
 * Usage:
 *   import { usautoforce } from "@/lib/usautoforce";
 *   const status = usautoforce.getStatus();
 *   const result = await usautoforce.checkStockBySize("225/60R16");
 */

export * from "./types";
export * from "./warehouses";
export * from "./client";

// Default export for convenience
import * as client from "./client";
import * as warehouses from "./warehouses";

export const usautoforce = {
  ...client,
  ...warehouses,
};
