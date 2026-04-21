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
} from "@/components/homepage";

export const runtime = "nodejs";

/* =============================================================================
   HOMEPAGE - Premium Automotive UI
   MATCHES TEMPLATE EXACTLY
   
   Structure:
   1. Hero Section (CTAs + tagline)
   2. Build Style Cards (Factory / Leveling Kit / Lifted)
   3. Trust Strip (slim horizontal)
   4. Featured Builds (gallery social proof strip)
   5. Featured Packages (3 packages)
   6. Shop by Category (5 circular images)
   7. Why Us (guarantee + 3 value props)
   8. Final CTA (conversion close)
   
   Background: Continuous dark scenic image throughout
============================================================================= */

export default async function Home() {
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
