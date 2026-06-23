/**
 * Trust JSON-LD — Organization / LocalBusiness + AggregateRating
 *
 * Emits schema.org structured data so Google can show review-rich results
 * for the brand and each physical location. Server component (no client JS).
 *
 * Place <OrganizationJsonLd /> once in the root layout.
 *
 * @created 2026-06-23
 */

import { STORES, TOTAL_REVIEWS, AVG_RATING, FOUNDED_YEAR } from "@/lib/trust";

const SITE = "https://shop.warehousetiredirect.com";

export function OrganizationJsonLd() {
  const org = {
    "@context": "https://schema.org",
    "@type": "AutoPartsStore",
    "@id": `${SITE}/#organization`,
    name: "Warehouse Tire",
    url: SITE,
    foundingDate: String(FOUNDED_YEAR),
    telephone: "+12483324120",
    email: "support@warehousetiredirect.com",
    priceRange: "$$",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: AVG_RATING.toFixed(1),
      reviewCount: TOTAL_REVIEWS,
      bestRating: 5,
      worstRating: 1,
    },
    location: STORES.map((s) => ({
      "@type": "AutoPartsStore",
      name: s.name,
      telephone: s.phone.replace(/[^\d+]/g, ""),
      address: {
        "@type": "PostalAddress",
        streetAddress: s.address,
        addressLocality: s.city,
        addressRegion: s.state,
        postalCode: s.zip,
        addressCountry: "US",
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: s.rating.toFixed(1),
        reviewCount: s.reviews,
        bestRating: 5,
        worstRating: 1,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(org) }}
    />
  );
}
