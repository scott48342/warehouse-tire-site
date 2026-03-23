import { NextResponse } from "next/server";
import { 
  saveSupplierCredentials, 
  hasCredentials,
  clearCredentialsCache,
  type SupplierCredentials 
} from "@/lib/supplierCredentialsSecure";
import { clearWheelProsTokenCache } from "@/lib/wheelprosAuth";

export const runtime = "nodejs";

/**
 * Get credential status for a supplier (without exposing the actual credentials)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const provider = url.searchParams.get("provider");

  if (!provider) {
    return NextResponse.json({ error: "provider required" }, { status: 400 });
  }

  try {
    const status = await hasCredentials(provider);
    
    return NextResponse.json({
      provider,
      configured: status.configured,
      source: status.source,
      message: status.configured 
        ? `Credentials configured via ${status.source === "db" ? "admin settings" : "environment variables"}`
        : "No credentials configured",
    });
  } catch (err: any) {
    console.error("[admin/settings/suppliers/credentials] GET Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Save credentials for a supplier (encrypted storage)
 */
export async function POST(req: Request) {
  const body = await req.json();
  const { 
    provider,
    apiKey,
    apiSecret,
    username,
    password,
    authUrl,
    baseUrl,
    customerNumber,
    companyCode,
  } = body;

  if (!provider) {
    return NextResponse.json({ error: "provider required" }, { status: 400 });
  }

  // Build credentials object (only include non-empty fields)
  const credentials: Partial<SupplierCredentials> = {};
  if (apiKey) credentials.apiKey = apiKey;
  if (apiSecret) credentials.apiSecret = apiSecret;
  if (username) credentials.username = username;
  if (password) credentials.password = password;
  if (authUrl) credentials.authUrl = authUrl;
  if (baseUrl) credentials.baseUrl = baseUrl;
  if (customerNumber) credentials.customerNumber = customerNumber;
  if (companyCode) credentials.companyCode = companyCode;

  if (Object.keys(credentials).length === 0) {
    return NextResponse.json({ error: "No credentials provided" }, { status: 400 });
  }

  try {
    const success = await saveSupplierCredentials(provider, credentials);
    
    if (!success) {
      return NextResponse.json({ error: "Failed to save credentials" }, { status: 500 });
    }

    // Clear token caches so new credentials take effect
    clearCredentialsCache(provider);
    if (provider === "wheelpros") {
      clearWheelProsTokenCache();
    }

    return NextResponse.json({ 
      ok: true, 
      message: "Credentials saved successfully",
      source: "db",
    });
  } catch (err: any) {
    console.error("[admin/settings/suppliers/credentials] POST Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
