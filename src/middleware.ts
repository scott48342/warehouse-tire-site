import { NextResponse, type NextRequest } from "next/server";
import { cookieName, verifyAdminToken } from "@/lib/adminAuth";
import { 
  checkBotProtection, 
  botBlockedResponse, 
  isHoneypotPath, 
  logHoneypotHit 
} from "@/lib/bot-protection";

// ═══════════════════════════════════════════════════════════════════════════
// SHOP MODE DETECTION
// ═══════════════════════════════════════════════════════════════════════════

const NATIONAL_HOSTS = ['shop.warehousetiredirect.com', 'warehousetiredirect.com'];
const LOCAL_HOSTS = ['shop.warehousetire.net', 'local.warehousetire.net'];
const LOCAL_PATH_HOST = 'warehousetire.net';
const LOCAL_PATH_PREFIX = '/shop';

function detectShopMode(host: string, pathname: string): 'national' | 'local' {
  const normalizedHost = host.toLowerCase().replace(/:\d+$/, '');
  
  if (NATIONAL_HOSTS.some(h => normalizedHost === h || normalizedHost === `www.${h}`)) {
    return 'national';
  }
  
  if (LOCAL_HOSTS.some(h => normalizedHost === h || normalizedHost === `www.${h}`)) {
    return 'local';
  }
  
  if ((normalizedHost === LOCAL_PATH_HOST || normalizedHost === `www.${LOCAL_PATH_HOST}`) 
      && pathname.startsWith(LOCAL_PATH_PREFIX)) {
    return 'local';
  }
  
  return 'national'; // Default to national for safety
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
             req.headers.get("x-real-ip") || 
             "unknown";
  const userAgent = req.headers.get("user-agent") || "";

  // 1. Honeypot detection (catch bots ignoring robots.txt)
  if (isHoneypotPath(pathname)) {
    logHoneypotHit(ip, userAgent, pathname);
    return new NextResponse("Not Found", { status: 404 });
  }

  // 2. Bot protection for public pages (skip static assets and API routes)
  if (!pathname.startsWith("/_next/") && 
      !pathname.startsWith("/api/") && 
      !pathname.includes(".")) {
    const protection = checkBotProtection(req);
    if (!protection.allowed) {
      return botBlockedResponse(protection.reason || "Access denied");
    }
  }

  // 3. Protect admin routes
  if (pathname.startsWith("/admin")) {
    if (pathname.startsWith("/admin/login")) return NextResponse.next();

    const token = req.cookies.get(cookieName())?.value;
    const ok = await verifyAdminToken(token);
    if (!ok) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  // 4. Shop mode detection - add header for SSR context
  const host = req.headers.get("host") || req.headers.get("x-forwarded-host") || "";
  const shopMode = detectShopMode(host, pathname);
  
  const response = NextResponse.next();
  response.headers.set("x-shop-mode", shopMode);
  
  return response;
}

export const config = {
  matcher: [
    // Admin routes
    "/admin/:path*",
    // Main pages that need bot protection
    "/tires/:path*",
    "/wheels/:path*",
    "/packages/:path*",
    // Vehicle selectors
    "/api/vehicles/:path*",
    // Honeypot paths
    "/admin-login",
    "/wp-admin/:path*",
    "/administrator/:path*",
    "/.env",
    "/config.php",
    "/phpinfo.php",
  ],
};
