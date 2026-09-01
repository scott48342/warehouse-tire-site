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

// ═══════════════════════════════════════════════════════════════════════════
// GEO-BLOCKING: US-only storefront (added 2026-08-31)
// We only sell/ship within the US — foreign traffic is overwhelmingly
// scrapers (e.g., Singapore bots crawling tire PDPs). Vercel stamps every
// request with x-vercel-ip-country (ISO 3166-1 alpha-2).
// ═══════════════════════════════════════════════════════════════════════════

const GEO_ALLOWED_COUNTRIES = new Set(["US"]);

/** Paths that must stay reachable regardless of origin country:
 *  server-to-server callers (Stripe webhooks, Resend webhooks, Vercel cron)
 *  whose egress IPs aren't guaranteed to geolocate to the US. */
const GEO_EXEMPT_PREFIXES = [
  "/api/stripe/webhook",
  "/api/webhooks/",
  "/api/cron/",
];

function geoBlocked(req: NextRequest, pathname: string): boolean {
  // Missing header = local dev / self-hosted / Vercel internal — allow.
  const country = req.headers.get("x-vercel-ip-country")?.toUpperCase() || "";
  if (!country || GEO_ALLOWED_COUNTRIES.has(country)) return false;
  if (GEO_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) return false;
  return true;
}

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
             req.headers.get("x-real-ip") || 
             "unknown";
  const userAgent = req.headers.get("user-agent") || "";

  // 0. Geo-block: only US traffic may browse (scrapers hammer us from abroad)
  if (geoBlocked(req, pathname)) {
    const country = req.headers.get("x-vercel-ip-country") || "??";
    console.log(`[geo-block] ${country} ${ip} -> ${pathname}`);
    return new NextResponse(
      "<!DOCTYPE html><html><head><title>Not Available</title></head><body style=\"font-family:system-ui;text-align:center;padding:80px 20px;color:#333\"><h1>Sorry, we're US-only</h1><p>Warehouse Tire Direct ships within the United States and this site is not available in your region.</p></body></html>",
      { status: 403, headers: { "content-type": "text/html", "cache-control": "no-store" } }
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGACY PACKAGE URL REDIRECTS
  // Handle /package?year=X&make=Y&model=Z and /packages?year=X&make=Y&model=Z
  // ═══════════════════════════════════════════════════════════════════════════
  if ((pathname === "/package" || pathname === "/packages") && searchParams.has("year")) {
    const year = searchParams.get("year");
    const make = searchParams.get("make");
    const model = searchParams.get("model");
    
    if (year && make && model) {
      // Build new URL: /wheels?year=X&make=Y&model=Z&package=1
      const url = req.nextUrl.clone();
      url.pathname = "/wheels";
      url.searchParams.set("year", year);
      url.searchParams.set("make", make);
      url.searchParams.set("model", model);
      url.searchParams.set("package", "1");
      // Remove any other params that were on the old URL
      url.searchParams.delete("trim"); // trim may have old format
      return NextResponse.redirect(url, { status: 301 });
    }
  }

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
  // Match everything except Next.js static assets and common file extensions,
  // so the geo-block covers ALL pages and APIs. Bot protection and shop-mode
  // logic above still apply their own narrower path filters internally.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|woff2?)$).*)",
  ],
};
