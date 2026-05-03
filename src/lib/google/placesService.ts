/**
 * Google Places API Service
 * 
 * Fetches reviews from Google Places API for store locations.
 * Only returns reviews with 3+ stars.
 */

// Store Place IDs - cached from Places API text search
// Pontiac: 4.8 stars, 1007 reviews
// Waterford: 4.7 stars, 486 reviews
const STORE_PLACE_IDS: Record<string, string> = {
  pontiac: "ChIJP-orsxu-JIgRBaf2g7SRzgs",
  waterford: "ChIJv_WMSJ-9JIgRzO__lDN9qzQ",
};

const STORE_SEARCH_QUERIES: Record<string, string> = {
  pontiac: "Warehouse Tire 1100 Cesar E Chavez Ave Pontiac MI",
  waterford: "Warehouse Tire 4494 Dixie Hwy Waterford MI",
};

export interface GoogleReview {
  authorName: string;
  authorPhoto?: string;
  rating: number;
  text: string;
  relativeTimeDescription: string;
  time: number;
}

export interface PlaceDetails {
  placeId: string;
  name: string;
  rating: number;
  totalReviews: number;
  reviews: GoogleReview[];
}

interface PlacesTextSearchResult {
  places?: Array<{
    id: string;
    displayName?: { text: string };
    rating?: number;
    userRatingCount?: number;
  }>;
}

interface PlacesDetailsResult {
  id?: string;
  displayName?: { text: string };
  rating?: number;
  userRatingCount?: number;
  reviews?: Array<{
    authorAttribution?: {
      displayName?: string;
      photoUri?: string;
    };
    rating?: number;
    text?: { text: string };
    relativePublishTimeDescription?: string;
    publishTime?: string;
  }>;
}

/**
 * Search for a place by text query and get its Place ID
 */
async function findPlaceId(query: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error("[places] No GOOGLE_PLACES_API_KEY configured");
    return null;
  }

  try {
    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.userRatingCount",
        },
        body: JSON.stringify({
          textQuery: query,
          maxResultCount: 1,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[places] Text search failed:", response.status, errorText);
      return null;
    }

    const data: PlacesTextSearchResult = await response.json();
    return data.places?.[0]?.id || null;
  } catch (error) {
    console.error("[places] Text search error:", error);
    return null;
  }
}

/**
 * Get place details including reviews
 */
async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error("[places] No GOOGLE_PLACES_API_KEY configured");
    return null;
  }

  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}`,
      {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "id,displayName,rating,userRatingCount,reviews",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[places] Details fetch failed:", response.status, errorText);
      return null;
    }

    const data: PlacesDetailsResult = await response.json();
    
    // Filter reviews to only 3+ stars
    const reviews: GoogleReview[] = (data.reviews || [])
      .filter((r) => (r.rating || 0) >= 3)
      .map((r) => ({
        authorName: r.authorAttribution?.displayName || "Customer",
        authorPhoto: r.authorAttribution?.photoUri,
        rating: r.rating || 5,
        text: r.text?.text || "",
        relativeTimeDescription: r.relativePublishTimeDescription || "",
        time: r.publishTime ? new Date(r.publishTime).getTime() : Date.now(),
      }));

    return {
      placeId: data.id || placeId,
      name: data.displayName?.text || "Warehouse Tire",
      rating: data.rating || 0,
      totalReviews: data.userRatingCount || 0,
      reviews,
    };
  } catch (error) {
    console.error("[places] Details fetch error:", error);
    return null;
  }
}

/**
 * Get reviews for a specific store
 */
export async function getStoreReviews(
  store: "pontiac" | "waterford"
): Promise<PlaceDetails | null> {
  // Try to find the place ID if we don't have it cached
  let placeId = STORE_PLACE_IDS[store];
  
  if (!placeId) {
    const query = STORE_SEARCH_QUERIES[store];
    placeId = await findPlaceId(query);
    
    if (placeId) {
      // Log for manual caching
      console.log(`[places] Found Place ID for ${store}: ${placeId}`);
    } else {
      console.error(`[places] Could not find Place ID for ${store}`);
      return null;
    }
  }

  return getPlaceDetails(placeId);
}

/**
 * Get combined reviews from both stores
 */
export async function getAllStoreReviews(): Promise<{
  meta: {
    totalReviews: number;
    averageRating: number;
    lastUpdated: string;
  };
  stores: {
    pontiac: PlaceDetails | null;
    waterford: PlaceDetails | null;
  };
  featured: GoogleReview[];
}> {
  const [pontiac, waterford] = await Promise.all([
    getStoreReviews("pontiac"),
    getStoreReviews("waterford"),
  ]);

  // Combine all reviews and sort by rating (highest first)
  const allReviews: GoogleReview[] = [
    ...(pontiac?.reviews || []),
    ...(waterford?.reviews || []),
  ].sort((a, b) => b.rating - a.rating || b.time - a.time);

  // Calculate combined stats
  const totalReviews = (pontiac?.totalReviews || 0) + (waterford?.totalReviews || 0);
  
  // Weighted average rating
  const avgRating = totalReviews > 0
    ? (
        ((pontiac?.rating || 0) * (pontiac?.totalReviews || 0)) +
        ((waterford?.rating || 0) * (waterford?.totalReviews || 0))
      ) / totalReviews
    : 0;

  return {
    meta: {
      totalReviews,
      averageRating: Math.round(avgRating * 10) / 10,
      lastUpdated: new Date().toISOString(),
    },
    stores: {
      pontiac,
      waterford,
    },
    // Top 10 featured reviews (5 stars first, then 4, then 3)
    featured: allReviews.slice(0, 10),
  };
}
