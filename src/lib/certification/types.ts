/**
 * Fitment Certification Types
 * 
 * Central type definitions for the certification system.
 */

export const CERTIFICATION_VERSION = 'v1.1.0';

export type CertificationStatus = 'certified' | 'needs_review' | 'quarantined';

export interface CertificationError {
  type: CertificationErrorType;
  message: string;
  details?: Record<string, any>;
}

export type CertificationErrorType =
  | 'FUTURE_TRIM'
  | 'DATA_MISMATCH'
  | 'AFTERMARKET_WHEEL'
  | 'AFTERMARKET_TIRES'
  | 'WHEEL_SPREAD'
  | 'TIRE_SOUP'
  | 'WHEEL_SOUP'
  | 'MODERN_TIRES_ON_CLASSIC'
  | 'SUSPICIOUS_FALLBACK'
  | 'MISSING_BOLT_PATTERN'
  | 'MISSING_WHEEL_SIZES'
  | 'MISSING_TIRE_SIZES'
  | 'INVALID_DIAMETER'
  | 'STAGGER_MISMATCH';

export interface WheelSpec {
  diameter: number;
  width: number;
  offset?: number | null;
  axle?: 'front' | 'rear' | 'both';
  isStock?: boolean;
  rear?: boolean;
  position?: string;
}

export interface FitmentRecord {
  id: string;
  year: number;
  make: string;
  model: string;
  raw_trim?: string;
  bolt_pattern?: string;
  oem_wheel_sizes: WheelSpec[];
  oem_tire_sizes: string[];
  is_staggered?: boolean;
  certification_status: CertificationStatus;
  certification_errors: CertificationError[];
  audit_original_data?: Record<string, any>;
  certified_at?: Date;
  certified_by_script_version?: string;
  quarantined_at?: Date;
}

export interface CertificationResult {
  status: CertificationStatus;
  errors: CertificationError[];
  modified: boolean;
}

export interface CertificationReport {
  version: string;
  timestamp: Date;
  totals: {
    total: number;
    certified: number;
    needsReview: number;
    quarantined: number;
    certifiedPct: number;
  };
  byErrorType: Record<string, number>;
  topOffenders: Array<{ make: string; model: string; count: number }>;
}
