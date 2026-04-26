/**
 * Certification Filter for Fitment Data
 * 
 * Enforces data quality rules:
 * - Package Builder: certified only
 * - Tire Search: certified only (with fallback option)
 * - Wheel Search: certified + wheel_safe
 * - Stagger Logic: certified only
 * - Guaranteed Fit Badge: certified only
 */

import { sql } from "drizzle-orm";
import { vehicleFitments } from "./schema";

export type CertificationStatus = "certified" | "needs_review" | "wheel_safe" | null | undefined;

export type FlowType = 
  | "package_builder"    // Requires full certification
  | "tire_search"        // Requires certified tire data
  | "wheel_search"       // Allows wheel_safe
  | "stagger_detection"  // Requires certified
  | "guaranteed_fit"     // Requires certified
  | "admin";             // No filter (admin views)

/**
 * Get SQL filter condition for certification status based on flow type.
 */
export function getCertificationFilter(flow: FlowType) {
  switch (flow) {
    case "package_builder":
    case "tire_search":
    case "stagger_detection":
    case "guaranteed_fit":
      // Strict: only certified records
      return sql`(${vehicleFitments.certificationStatus} = 'certified' OR ${vehicleFitments.certificationStatus} IS NULL)`;
    
    case "wheel_search":
      // Allow wheel_safe records (core wheel specs valid)
      return sql`(${vehicleFitments.certificationStatus} IN ('certified', 'wheel_safe') OR ${vehicleFitments.certificationStatus} IS NULL)`;
    
    case "admin":
      // No filter for admin views
      return sql`1=1`;
    
    default:
      // Default to strict filtering
      return sql`(${vehicleFitments.certificationStatus} = 'certified' OR ${vehicleFitments.certificationStatus} IS NULL)`;
  }
}

/**
 * Check if a fitment record is certified for a specific flow.
 */
export function isCertifiedFor(
  status: string | null | undefined, 
  flow: FlowType
): boolean {
  // Null/undefined defaults to certified (backward compatibility)
  if (!status || status === "certified") return true;
  
  switch (flow) {
    case "wheel_search":
      return status === "certified" || status === "wheel_safe";
    
    case "admin":
      return true;
    
    default:
      return status === "certified";
  }
}

/**
 * Raw SQL string for WHERE clauses (for use with pg pool queries)
 */
export function getCertificationFilterSQL(flow: FlowType): string {
  switch (flow) {
    case "package_builder":
    case "tire_search":
    case "stagger_detection":
    case "guaranteed_fit":
      return `(certification_status = 'certified' OR certification_status IS NULL)`;
    
    case "wheel_search":
      return `(certification_status IN ('certified', 'wheel_safe') OR certification_status IS NULL)`;
    
    case "admin":
      return `1=1`;
    
    default:
      return `(certification_status = 'certified' OR certification_status IS NULL)`;
  }
}

/**
 * Check if profile should show guaranteed fit badge.
 */
export function canShowGuaranteedFit(certificationStatus: string | null | undefined): boolean {
  return !certificationStatus || certificationStatus === "certified";
}

/**
 * Check if profile can be used for tire size derivation.
 */
export function canDeriveTireSizes(certificationStatus: string | null | undefined): boolean {
  return !certificationStatus || certificationStatus === "certified";
}

/**
 * Check if profile can be used for stagger detection.
 */
export function canDetectStagger(certificationStatus: string | null | undefined): boolean {
  return !certificationStatus || certificationStatus === "certified";
}
