import { headers } from "next/headers";
import {
  HomepageBackground,
  PremiumHero,
  BuildStyleCards,
  TrustStrip,
  FeaturedBuilds,
  FeaturedPackages,
  ShopByCategory,
  WhyUs,
  FinalCTA,
  // Local homepage (full redesign)
  LocalHomepage,
} from "@/components/homepage";

export const runtime = "nodejs";

/* =============================================================================
   HOMEPAGE - Dual Experience
   
   NATIONAL (shop.warehousetiredirect.com):
   - Premium enthusiast UI
   - Build cards (Stock/Leveled/Lifted)
   - Featured builds & packages
   - "Build-focused" shopping
   
   LOCAL (shop.warehousetire.net):
   - Neighborhood tire store feel
   - Storefront hero with embedded search
   - Store locations prominent
   - Trust signals (local, same-day, honest pricing)
   - Social proof (reviews, years in business)
   
   Design inspired by: Discount Tire, Belle Tire local storefronts
============================================================================= */

// Server-side local detection
async function isLocalSite(): Promise<boolean> {
  // Force local mode via env var for testing
  if (process.env.FORCE_LOCAL_MODE === "true") return true;
  
  const headersList = await headers();
  const host = headersList.get("host") || "";
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
  // NATIONAL HOMEPAGE - Premium Enthusiast UI
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <HomepageBackground>
      <main>
        {/* 1. HERO SECTION - CTAs */}
        <PremiumHero />

        {/* 2. BUILD STYLE CARDS */}
        <BuildStyleCards />

        {/* 3. TRUST STRIP */}
        <TrustStrip />

        {/* 4. FEATURED BUILDS - Gallery social proof */}
        <FeaturedBuilds />

        {/* 5. FEATURED PACKAGES */}
        <FeaturedPackages />

        {/* 6. SHOP BY CATEGORY */}
        <ShopByCategory />

        {/* 7. WHY US */}
        <WhyUs />

        {/* 8. FINAL CTA */}
        <FinalCTA />
      </main>
    </HomepageBackground>
  );
}
