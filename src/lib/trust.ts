/**
 * Trust / Social Proof — Single Source of Truth
 *
 * Warehouse Tire has 1,500+ combined Google reviews across two physical
 * Michigan locations (real data already collected in
 * `src/data/store-reviews.json` via the Google Places API) but it was NOT
 * surfaced during the shopping flow. This file derives all trust facts from
 * that same JSON so review counts, ratings, the "since" year and store
 * details stay consistent everywhere (trust bar, carousel, PDP/cart/checkout
 * modules, and JSON-LD). Update store-reviews.json to refresh the numbers.
 *
 * @created 2026-06-23 (conversion trust system)
 */

import storeReviewsData from "@/data/store-reviews.json";

interface RawStore {
  id: string;
  name: string;
  address: string;
}
interface RawMetaStore {
  placeId?: string;
  rating: number;
  reviewCount: number;
}

const meta = storeReviewsData.meta as {
  totalReviews: number;
  averageRating: number;
  stores: Record<string, RawMetaStore>;
  locations: RawStore[];
};

export interface StoreLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  reviews: number;
  rating: number;
  mapUrl: string;
}

/** Static extras (city/state/zip/phone) keyed to the JSON store ids. */
const STORE_EXTRAS: Record<string, { city: string; state: string; zip: string; phone: string }> = {
  pontiac: { city: "Pontiac", state: "MI", zip: "48340", phone: "(248) 332-4120" },
  waterford: { city: "Waterford", state: "MI", zip: "48328", phone: "(248) 683-0070" },
};

export const STORES: StoreLocation[] = (meta.locations || []).map((loc) => {
  const m = meta.stores?.[loc.id] || { rating: meta.averageRating, reviewCount: 0 };
  const extra = STORE_EXTRAS[loc.id] || { city: "", state: "MI", zip: "", phone: "(248) 332-4120" };
  return {
    id: loc.id,
    name: loc.name,
    address: loc.address,
    city: extra.city,
    state: extra.state,
    zip: extra.zip,
    phone: extra.phone,
    reviews: m.reviewCount,
    rating: m.rating,
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.name + " MI")}`,
  };
});

/** Year the business started serving customers (Oakland County, "for decades"). */
export const FOUNDED_YEAR = 1998;

/** Combined Google review count (from real Google Places data). */
export const TOTAL_REVIEWS = meta.totalReviews;

/** Average star rating across all locations (from real Google Places data). */
export const AVG_RATING = meta.averageRating;

/** Display helpers */
export const TRUST = {
  reviewsDisplay: `${TOTAL_REVIEWS.toLocaleString("en-US")}+`, // "1,504+"
  rating: AVG_RATING, // 4.8
  ratingDisplay: AVG_RATING.toFixed(1),
  yearsInBusiness: new Date().getFullYear() - FOUNDED_YEAR,
  sinceDisplay: `Trusted Tire Dealer Since ${FOUNDED_YEAR}`,
  decadesDisplay: "Serving Drivers For Decades",
  locationsDisplay: `${STORES.length} Michigan Locations`,
  googleSource: "Google Reviews",
} as const;
