/**
 * Secure Supplier Credentials Service
 * 
 * Stores and retrieves encrypted supplier credentials from admin_suppliers.
 * Credentials are encrypted at rest using AES-256-GCM.
 * 
 * Storage priority:
 * 1. admin_suppliers.credentials (encrypted JSON) - admin-managed
 * 2. Environment variables - fallback for platform/dev
 * 
 * This enables multi-store support without requiring Vercel access.
 */

import crypto from "crypto";
import pg from "pg";

const { Pool } = pg;

// Encryption key from env (32 bytes for AES-256)
// Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
const ENCRYPTION_KEY = process.env.CREDENTIALS_ENCRYPTION_KEY || process.env.ADMIN_ENCRYPTION_KEY;

export type SupplierCredentials = {
  // Common fields
  apiKey?: string;
  apiSecret?: string;
  username?: string;
  password?: string;
  authUrl?: string;
  baseUrl?: string;
  
  // Dealer-specific
  customerNumber?: string;
  companyCode?: string;
  warehouseCodes?: string[];
  
  // Provider-specific extras
  extra?: Record<string, string>;
};

type CachedCredentials = {
  data: SupplierCredentials;
  expiresAt: number;
};

// Cache credentials for 5 minutes
const credentialsCache = new Map<string, CachedCredentials>();
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
 * Encrypt credentials for storage
 */
export function encryptCredentials(credentials: SupplierCredentials): string {
  if (!ENCRYPTION_KEY) {
    // No encryption key - store as base64 JSON (not secure, but functional)
    console.warn("[supplierCredentials] No CREDENTIALS_ENCRYPTION_KEY - storing unencrypted");
    return Buffer.from(JSON.stringify(credentials)).toString("base64");
  }

  const key = Buffer.from(ENCRYPTION_KEY, "hex");
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  
  const plaintext = JSON.stringify(credentials);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

/**
 * Decrypt credentials from storage
 */
export function decryptCredentials(encryptedString: string): SupplierCredentials | null {
  if (!encryptedString) return null;

  try {
    // Check if it's unencrypted base64 (legacy/no-key mode)
    if (!encryptedString.includes(":")) {
      return JSON.parse(Buffer.from(encryptedString, "base64").toString("utf8"));
    }

    if (!ENCRYPTION_KEY) {
      console.warn("[supplierCredentials] Cannot decrypt - no CREDENTIALS_ENCRYPTION_KEY");
      return null;
    }

    const [ivB64, authTagB64, ciphertextB64] = encryptedString.split(":");
    const key = Buffer.from(ENCRYPTION_KEY, "hex");
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");
    const ciphertext = Buffer.from(ciphertextB64, "base64");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8"));
  } catch (err) {
    console.error("[supplierCredentials] Decryption failed:", err);
    return null;
  }
}

/**
 * Get credentials from DB, with env var fallback
 */
export async function getSupplierCredentials(provider: string): Promise<SupplierCredentials> {
  // Check cache
  const cached = credentialsCache.get(provider);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // Provider-specific env var fallbacks
  const envFallbacks: Record<string, SupplierCredentials> = {
    wheelpros: {
      username: process.env.WHEELPROS_PDP_USERNAME,
      password: process.env.WHEELPROS_PDP_PASSWORD,
      authUrl: process.env.WHEELPROS_AUTH_URL,
      baseUrl: process.env.WHEELPROS_PRODUCT_API_BASE_URL,
      customerNumber: process.env.WHEELPROS_CUSTOMER_NUMBER || "1022165",
      companyCode: process.env.WHEELPROS_COMPANY_CODE || "1000",
    },
    keystone: {
      apiKey: process.env.KEYSTONE_API_KEY,
      customerNumber: process.env.KEYSTONE_CUSTOMER_NUMBER,
      companyCode: process.env.KEYSTONE_COMPANY_CODE,
    },
  };

  const fallback = envFallbacks[provider] || {};

  // Try to get from database
  const pool = getPool();
  if (!pool) {
    credentialsCache.set(provider, { data: fallback, expiresAt: Date.now() + CACHE_TTL_MS });
    return fallback;
  }

  try {
    const { rows } = await pool.query(
      `SELECT credentials, customer_number, company_code, warehouse_codes, config 
       FROM admin_suppliers 
       WHERE provider = $1 AND enabled = true`,
      [provider]
    );

    if (rows.length > 0) {
      const row = rows[0];
      
      // Decrypt stored credentials
      const storedCreds = row.credentials ? decryptCredentials(row.credentials) : null;
      
      // Merge: stored credentials take priority, then row fields, then env fallback
      const data: SupplierCredentials = {
        // Auth credentials from encrypted storage or env
        apiKey: storedCreds?.apiKey || fallback.apiKey,
        apiSecret: storedCreds?.apiSecret || fallback.apiSecret,
        username: storedCreds?.username || fallback.username,
        password: storedCreds?.password || fallback.password,
        authUrl: storedCreds?.authUrl || fallback.authUrl,
        baseUrl: storedCreds?.baseUrl || fallback.baseUrl,
        
        // Dealer info from row fields (already in DB) or stored creds or env
        customerNumber: row.customer_number || storedCreds?.customerNumber || fallback.customerNumber,
        companyCode: row.company_code || storedCreds?.companyCode || fallback.companyCode,
        warehouseCodes: row.warehouse_codes || storedCreds?.warehouseCodes || fallback.warehouseCodes,
        
        // Extra provider-specific config
        extra: storedCreds?.extra || (row.config as Record<string, string>) || {},
      };

      credentialsCache.set(provider, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      return data;
    }
  } catch (err) {
    console.warn(`[supplierCredentials] DB lookup failed for ${provider}:`, err);
  } finally {
    await pool.end();
  }

  credentialsCache.set(provider, { data: fallback, expiresAt: Date.now() + CACHE_TTL_MS });
  return fallback;
}

/**
 * Save credentials to DB (encrypted)
 */
export async function saveSupplierCredentials(
  provider: string,
  credentials: Partial<SupplierCredentials>
): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;

  try {
    // Get existing credentials first
    const existing = await getSupplierCredentials(provider);
    
    // Merge with new credentials
    const merged: SupplierCredentials = { ...existing, ...credentials };
    
    // Encrypt
    const encrypted = encryptCredentials(merged);
    
    // Update DB
    await pool.query(
      `UPDATE admin_suppliers 
       SET credentials = $1,
           customer_number = COALESCE($2, customer_number),
           company_code = COALESCE($3, company_code),
           updated_at = NOW()
       WHERE provider = $4`,
      [encrypted, credentials.customerNumber, credentials.companyCode, provider]
    );

    // Clear cache
    credentialsCache.delete(provider);
    
    return true;
  } catch (err) {
    console.error(`[supplierCredentials] Failed to save credentials for ${provider}:`, err);
    return false;
  } finally {
    await pool.end();
  }
}

/**
 * Check if credentials are configured (DB or env)
 */
export async function hasCredentials(provider: string): Promise<{ configured: boolean; source: "db" | "env" | "none" }> {
  const creds = await getSupplierCredentials(provider);
  
  // Check if we have the minimum required credentials
  const hasAuth = !!(creds.apiKey || (creds.username && creds.password));
  
  if (!hasAuth) {
    return { configured: false, source: "none" };
  }

  // Check if credentials came from DB
  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query(
        `SELECT credentials FROM admin_suppliers WHERE provider = $1`,
        [provider]
      );
      if (rows[0]?.credentials) {
        return { configured: true, source: "db" };
      }
    } finally {
      await pool.end();
    }
  }

  return { configured: true, source: "env" };
}

/**
 * Clear credentials cache
 */
export function clearCredentialsCache(provider?: string) {
  if (provider) {
    credentialsCache.delete(provider);
  } else {
    credentialsCache.clear();
  }
}
