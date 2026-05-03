import { headers } from "next/headers";
import {
  PremiumNationalHomepage,
  LocalHomepage,
} from "@/components/homepage";

export const runtime = "nodejs";

/* =============================================================================
   HOMEPAGE - Dual Experience
   
   NATIONAL (shop.warehousetiredirect.com):
   - NEW: Premium flagship homepage
   - Bold dark design, cinematic imagery
   - Broader appeal (daily drivers, SUVs, trucks, performance, lifted)
   - Six category lanes + promo tiles + trust strip
   - Premium automotive authority feel
   
   LOCAL (shop.warehousetire.net):
   - Neighborhood tire store feel
   - Storefront hero with embedded search
   - Store locations prominent
   - Trust signals (local, same-day, honest pricing)
   - Social proof (reviews, years in business)
============================================================================= */

// Server-side local detection
async function isLocalSite(): Promise<boolean> {
  // Force modes via env var for testing
  if (process.env.FORCE_LOCAL_MODE === "true") return true;
  if (process.env.FORCE_NATIONAL_MODE === "true") return false;
  
  const headersList = await headers();
  const host = headersList.get("host") || "";
  
  // Production: warehousetire.net = local, warehousetiredirect.com = national
  // Local dev: port 3001 = local, port 3000 = national
  return host.includes("warehousetire.net") || host.includes("localhost:3001");
}

export default async function Home() {
  const isLocal = await isLocalSite();

  // ═══════════════════════════════════════════════════════════════════════════
  // LOCAL HOMEPAGE - Neighborhood Tire Store
  // ═══════════════════════════════════════════════════════════════════════════
  if (isLocal) {
    return <LocalHomepage />;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NATIONAL HOMEPAGE - Premium Flagship Design
  // ═══════════════════════════════════════════════════════════════════════════
  return <PremiumNationalHomepage />;
}
