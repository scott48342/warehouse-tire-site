const COOKIE_NAME = "wt_admin";

function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function cookieName() {
  return COOKIE_NAME;
}

function hex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(secret: string, msg: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return hex(sig);
}

export async function signAdminToken() {
  const secret = required("ADMIN_PASSWORD");
  const ts = Date.now().toString();
  const mac = await hmacSha256Hex(secret, ts);
  return `${ts}.${mac}`;
}

export async function verifyAdminToken(token: string | null | undefined) {
  if (!token) return false;
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return false;

  const [ts, mac] = String(token).split(".");
  if (!ts || !mac) return false;

  const expected = await hmacSha256Hex(secret, ts);
  if (expected !== mac) return false;

  const ageMs = Date.now() - Number(ts);
  if (!Number.isFinite(ageMs)) return false;

  // 7 days
  return ageMs >= 0 && ageMs < 7 * 24 * 60 * 60 * 1000;
}

/**
 * Verify admin auth from a NextRequest
 * Returns { authorized: true, user: string } or { authorized: false, error: string }
 */
export async function verifyAdminAuth(request: { cookies: { get: (name: string) => { value: string } | undefined } }) {
  const cookie = request.cookies.get(COOKIE_NAME);
  const token = cookie?.value;
  
  if (!token) {
    return { authorized: false as const, error: "Not authenticated" };
  }
  
  const valid = await verifyAdminToken(token);
  if (!valid) {
    return { authorized: false as const, error: "Invalid or expired token" };
  }
  
  return { authorized: true as const, user: "admin" };
}
