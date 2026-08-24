/**
 * Pending Quote Claim Storage
 * 
 * Persists the claim token across the authentication flow.
 * Uses sessionStorage (cleared on browser close) for security.
 * 
 * Flow:
 * 1. Guest saves quote → token stored here
 * 2. Guest logs in/registers
 * 3. After authentication, check for pending claim
 * 4. Auto-redirect to claim page
 * 
 * @created 2026-08-24
 */

const STORAGE_KEY = "wtd_pending_quote_claim";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours (matches token expiry)

interface PendingClaimData {
  token: string;
  returnTo: string;
  savedAt: number;
}

/**
 * Store a pending claim token for retrieval after authentication
 */
export function storePendingClaim(token: string, returnTo: string): void {
  if (typeof window === "undefined") return;
  
  try {
    const data: PendingClaimData = {
      token,
      returnTo,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("[pendingClaim] Failed to store:", err);
  }
}

/**
 * Retrieve and clear any pending claim token
 * Returns null if no valid pending claim exists
 */
export function consumePendingClaim(): PendingClaimData | null {
  if (typeof window === "undefined") return null;
  
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    
    // Clear immediately (one-time use)
    sessionStorage.removeItem(STORAGE_KEY);
    
    const data: PendingClaimData = JSON.parse(raw);
    
    // Validate structure
    if (!data.token || typeof data.token !== "string") {
      return null;
    }
    
    // Check expiry (24 hours max)
    if (Date.now() - data.savedAt > MAX_AGE_MS) {
      console.log("[pendingClaim] Expired, discarding");
      return null;
    }
    
    return data;
  } catch (err) {
    console.warn("[pendingClaim] Failed to retrieve:", err);
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/**
 * Check if there's a pending claim without consuming it
 */
export function hasPendingClaim(): boolean {
  if (typeof window === "undefined") return false;
  
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    
    const data: PendingClaimData = JSON.parse(raw);
    
    // Check expiry
    if (Date.now() - data.savedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return false;
    }
    
    return !!data.token;
  } catch {
    return false;
  }
}

/**
 * Clear any pending claim without consuming
 */
export function clearPendingClaim(): void {
  if (typeof window === "undefined") return;
  
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}
