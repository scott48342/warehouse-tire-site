/**
 * Supplier Credentials Service
 * 
 * Reads supplier credentials from admin_suppliers table (admin-managed)
 * with fallback to environment variables for backward compatibility.
 * 
 * This enables multi-store support without requiring Vercel access.
 */

import pg from "pg";

const { Pool } = pg;

type SupplierCredentials = {
  customerNumber: string | null;
  companyCode: string | null;
  warehouseCodes: string[] | null;
  config: Record<string, any>;
};

// Cache credentials for 5 minutes to avoid DB hits on every API call
let credentialsCache: Map<string, { data: SupplierCredentials; expiresAt: number }> = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getPool() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return null;
  return new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });
}

/**
 * Get supplier credentials from DB or env vars
 */
export async function getSupplierCredentials(provider: string): Promise<SupplierCredentials> {
  // Check cache first
  const cached = credentialsCache.get(provider);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // Default fallback values (hardcoded for backward compatibility)
  const defaults: Record<string, SupplierCredentials> = {
    wheelpros: {
      customerNumber: process.env.WHEELPROS_CUSTOMER_NUMBER || "1022165",
      companyCode: process.env.WHEELPROS_COMPANY_CODE || "1000",
      warehouseCodes: null,
      config: {},
    },
    keystone: {
      customerNumber: process.env.KEYSTONE_CUSTOMER_NUMBER || null,
      companyCode: process.env.KEYSTONE_COMPANY_CODE || null,
      warehouseCodes: null,
      config: {},
    },
  };

  const fallback = defaults[provider] || {
    customerNumber: null,
    companyCode: null,
    warehouseCodes: null,
    config: {},
  };

  // Try to get from database
  const pool = getPool();
  if (!pool) {
    credentialsCache.set(provider, { data: fallback, expiresAt: Date.now() + CACHE_TTL_MS });
    return fallback;
  }

  try {
    const { rows } = await pool.query(
      `SELECT customer_number, company_code, warehouse_codes, config 
       FROM admin_suppliers 
       WHERE provider = $1 AND enabled = true`,
      [provider]
    );

    if (rows.length > 0) {
      const row = rows[0];
      const data: SupplierCredentials = {
        customerNumber: row.customer_number || fallback.customerNumber,
        companyCode: row.company_code || fallback.companyCode,
        warehouseCodes: row.warehouse_codes || fallback.warehouseCodes,
        config: row.config || {},
      };
      credentialsCache.set(provider, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      return data;
    }
  } catch (err) {
    // DB error - use fallback silently
    console.warn(`[supplierCredentials] Failed to load ${provider} credentials from DB:`, err);
  } finally {
    await pool.end();
  }

  credentialsCache.set(provider, { data: fallback, expiresAt: Date.now() + CACHE_TTL_MS });
  return fallback;
}

/**
 * Clear credentials cache (call after admin updates)
 */
export function clearSupplierCredentialsCache(provider?: string) {
  if (provider) {
    credentialsCache.delete(provider);
  } else {
    credentialsCache.clear();
  }
}

/**
 * Convenience function for WheelPros
 */
export async function getWheelProsCredentials() {
  return getSupplierCredentials("wheelpros");
}
