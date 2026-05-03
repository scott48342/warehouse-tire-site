/**
 * Sync Google Reviews to store-reviews.json
 * 
 * Run: node scripts/sync-google-reviews.mjs
 * 
 * This updates src/data/store-reviews.json with fresh reviews from Google Places API.
 * Only includes reviews with 3+ stars.
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const apiKey = process.env.GOOGLE_PLACES_API_KEY;
if (!apiKey) {
  console.error("❌ No GOOGLE_PLACES_API_KEY found in .env.local");
  process.exit(1);
}

// Cached Place IDs for our stores
const STORES = {
  pontiac: {
    placeId: "ChIJP-orsxu-JIgRBaf2g7SRzgs",
    name: "Warehouse Tire Pontiac",
    address: "1100 Cesar E Chavez Ave",
  },
  waterford: {
    placeId: "ChIJv_WMSJ-9JIgRzO__lDN9qzQ",
    name: "Warehouse Tire Waterford",
    address: "4459 Pontiac Lake Rd",
  },
};

async function getPlaceDetails(placeId) {
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
    const error = await response.text();
    console.error(`Failed to fetch ${placeId}:`, response.status, error);
    return null;
  }

  return response.json();
}

async function main() {
  console.log("🔄 Syncing Google Reviews...\n");

  const storeDetails = {};
  let allReviews = [];
  let totalReviews = 0;
  let weightedRatingSum = 0;

  for (const [storeKey, store] of Object.entries(STORES)) {
    console.log(`📍 Fetching ${store.name}...`);
    
    const details = await getPlaceDetails(store.placeId);
    
    if (!details) {
      console.log(`   ❌ Failed\n`);
      continue;
    }

    const rating = details.rating || 0;
    const reviewCount = details.userRatingCount || 0;

    console.log(`   ⭐ ${rating} (${reviewCount} reviews)`);
    
    storeDetails[storeKey] = {
      placeId: store.placeId,
      rating,
      reviewCount,
    };

    totalReviews += reviewCount;
    weightedRatingSum += rating * reviewCount;

    // Process reviews (filter to 3+ stars)
    const reviews = (details.reviews || [])
      .filter((r) => (r.rating || 0) >= 3)
      .map((r, idx) => ({
        id: `${storeKey}-${idx}`,
        author: r.authorAttribution?.displayName || "Customer",
        rating: r.rating || 5,
        text: r.text?.text || "",
        source: "google",
        store: storeKey,
        relativeTime: r.relativePublishTimeDescription || "",
      }));

    console.log(`   ✅ ${reviews.length} reviews with 3+ stars\n`);
    allReviews = allReviews.concat(reviews);
  }

  // Calculate combined average rating
  const averageRating = totalReviews > 0
    ? Math.round((weightedRatingSum / totalReviews) * 10) / 10
    : 0;

  console.log(`\n📊 Combined Stats:`);
  console.log(`   Total Reviews: ${totalReviews}`);
  console.log(`   Average Rating: ${averageRating}`);

  // Sort reviews: 5 stars first, then by rating desc
  allReviews.sort((a, b) => b.rating - a.rating);

  // Take top 10 for featured (prefer longer, more detailed reviews)
  const featured = allReviews
    .filter(r => r.text.length > 50) // Prefer substantive reviews
    .slice(0, 10)
    .map((r, idx) => ({
      id: `g${idx + 1}`,
      author: r.author,
      rating: r.rating,
      text: r.text,
      source: "google",
      tags: extractTags(r.text),
    }));

  // Build the output JSON
  const output = {
    meta: {
      lastUpdated: new Date().toISOString().split("T")[0],
      totalReviews,
      averageRating,
      source: "Google Places API",
      stores: storeDetails,
      locations: [
        { id: "pontiac", name: STORES.pontiac.name, address: STORES.pontiac.address },
        { id: "waterford", name: STORES.waterford.name, address: STORES.waterford.address },
      ],
    },
    featured,
  };

  // Write to file
  const outputPath = path.join(__dirname, "..", "src", "data", "store-reviews.json");
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`\n✅ Wrote ${outputPath}`);
  console.log(`   ${featured.length} featured reviews`);
}

// Simple tag extraction based on keywords
function extractTags(text) {
  const tags = [];
  const lower = text.toLowerCase();
  
  if (lower.includes("fast") || lower.includes("quick")) tags.push("fast");
  if (lower.includes("price") || lower.includes("deal") || lower.includes("affordable")) tags.push("price");
  if (lower.includes("staff") || lower.includes("team") || lower.includes("guys")) tags.push("staff");
  if (lower.includes("service")) tags.push("service");
  if (lower.includes("help")) tags.push("helpful");
  if (lower.includes("scott")) tags.push("scott");
  if (lower.includes("recommend")) tags.push("recommended");
  
  return tags.slice(0, 3); // Max 3 tags
}

main().catch(console.error);
