import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const apiKey = process.env.GOOGLE_PLACES_API_KEY;
if (!apiKey) {
  console.error("No GOOGLE_PLACES_API_KEY found in .env.local");
  process.exit(1);
}

console.log("Testing Google Places API...\n");

async function findPlaceId(query) {
  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount",
      },
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: 1,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Search failed:", response.status, error);
    return null;
  }

  const data = await response.json();
  return data.places?.[0];
}

async function getPlaceReviews(placeId) {
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
    console.error("Details failed:", response.status, error);
    return null;
  }

  return response.json();
}

// Search for both stores
const stores = [
  { name: "Pontiac", query: "Warehouse Tire 1100 Cesar E Chavez Ave Pontiac MI" },
  { name: "Waterford", query: "Warehouse Tire 4494 Dixie Hwy Waterford MI" },
];

for (const store of stores) {
  console.log(`\n🔍 Searching for ${store.name}...`);
  console.log(`   Query: ${store.query}`);
  
  const place = await findPlaceId(store.query);
  
  if (place) {
    console.log(`   ✅ Found: ${place.displayName?.text}`);
    console.log(`   📍 Address: ${place.formattedAddress}`);
    console.log(`   🆔 Place ID: ${place.id}`);
    console.log(`   ⭐ Rating: ${place.rating} (${place.userRatingCount} reviews)`);
    
    // Get reviews
    console.log(`\n   Fetching reviews...`);
    const details = await getPlaceReviews(place.id);
    
    if (details?.reviews) {
      console.log(`   📝 Found ${details.reviews.length} reviews`);
      
      // Show reviews with 3+ stars
      const goodReviews = details.reviews.filter(r => r.rating >= 3);
      console.log(`   ✅ ${goodReviews.length} reviews with 3+ stars\n`);
      
      // Show first 3 reviews
      for (const review of goodReviews.slice(0, 3)) {
        console.log(`   ⭐ ${review.rating}/5 - ${review.authorAttribution?.displayName}`);
        console.log(`   "${review.text?.text?.slice(0, 100)}..."`);
        console.log();
      }
    }
  } else {
    console.log(`   ❌ Not found`);
  }
}
