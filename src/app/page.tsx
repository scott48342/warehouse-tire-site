import {
  HomepageBackground,
  PremiumHero,
  BuildStyleCards,
  TrustStrip,
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
   4. Featured Packages (3 packages)
   5. Shop by Category (5 circular images)
   6. Why Us (guarantee + 3 value props)
   7. Final CTA (conversion close)
   
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

        {/* 4. FEATURED PACKAGES */}
        <FeaturedPackages />

        {/* 5. SHOP BY CATEGORY */}
        <ShopByCategory />

        {/* 6. WHY US */}
        <WhyUs />

        {/* 7. FINAL CTA */}
        <FinalCTA />
      </main>
    </HomepageBackground>
  );
}
