import {
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
   
   Structure:
   1. Hero Section (full-width dark cinematic)
   2. Build Style Cards (Stock / Leveled / Lifted)
   3. Trust Strip (slim horizontal)
   4. Featured Packages (complete builds)
   5. Shop by Category (grid buttons)
   6. Why Us (value propositions)
   7. Final CTA (conversion close)
============================================================================= */

export default async function Home() {
  return (
    <main className="bg-neutral-950">
      {/* 1. HERO SECTION */}
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
  );
}
