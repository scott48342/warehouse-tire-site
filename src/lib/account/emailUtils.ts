/**
 * Email Normalization Utilities
 * 
 * Safe email comparison for account-based order association.
 * 
 * @created 2026-08-22
 */

/**
 * Normalize an email address for safe comparison.
 * 
 * - Trims whitespace
 * - Converts to lowercase
 * - Returns empty string for null/undefined
 * 
 * Does NOT modify the local part (no dot removal, no plus handling)
 * to avoid false positives with different addresses that might
 * normalize to the same value.
 */
export function normalizeEmail(email: string | null | undefined): string {
  if (!email || typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

/**
 * Check if two emails match after normalization.
 */
export function emailsMatch(
  email1: string | null | undefined,
  email2: string | null | undefined
): boolean {
  const normalized1 = normalizeEmail(email1);
  const normalized2 = normalizeEmail(email2);
  
  // Both must be non-empty
  if (!normalized1 || !normalized2) return false;
  
  return normalized1 === normalized2;
}
