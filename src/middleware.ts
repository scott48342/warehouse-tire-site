import { NextResponse, type NextRequest } from "next/server";
import { cookieName, verifyAdminToken } from "@/lib/adminAuth";
import { 
  checkBotProtection, 
  botBlockedResponse, 
  isHoneypotPath, 
  logHoneypotHit 
} from "@/lib/bot-protection";

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

  return NextResponse.next();
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
