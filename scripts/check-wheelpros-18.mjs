// Check WheelPros 18" wheel availability for 2007 BMW 328i (5x120, 72.6mm bore)

const WHEELPROS_USERNAME = "scott@warehousetire.net";
const WHEELPROS_PASSWORD = "Websters1!";

async function getToken() {
  const res = await fetch("https://api.wheelpros.com/auth/v1/authorize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userName: WHEELPROS_USERNAME,
      password: WHEELPROS_PASSWORD,
    }),
  });
  const data = await res.json();
  if (!data.accessToken) {
    console.error("Auth failed:", data);
    return null;
  }
  return data.accessToken;
}

async function searchWheels(token, page = 1) {
  const params = new URLSearchParams({
    bolt_pattern_metric: "5x120",
    wheel_diameter: "18",
    page_size: "100",
    page: String(page),
  });

  const res = await fetch(`https://api.wheelpros.com/products/v1/search/wheel?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  
  if (!res.ok) {
    console.error("API Error:", res.status, await res.text());
    return null;
  }
  
  return res.json();
}

async function main() {
  console.log("Getting WheelPros token...");
  const token = await getToken();
  if (!token) return;
  
  console.log("Searching for 18\" wheels with 5x120 bolt pattern...\n");
  
  // Get first page to see total
  const firstPage = await searchWheels(token, 1);
  if (!firstPage) return;
  
  const totalCount = firstPage.totalCount || 0;
  const pageSize = firstPage.pageSize || 100;
  const totalPages = Math.ceil(totalCount / pageSize);
  
  console.log(`Total 18" wheels available: ${totalCount}`);
  console.log(`Pages: ${totalPages}\n`);
  
  // Collect all results
  let allResults = [...firstPage.results];
  
  // Get remaining pages if needed
  for (let p = 2; p <= Math.min(totalPages, 10); p++) {
    const page = await searchWheels(token, p);
    if (page?.results) {
      allResults = allResults.concat(page.results);
    }
  }
  
  console.log(`Fetched ${allResults.length} wheel SKUs\n`);
  
  // Group by brand
  const byBrand = {};
  const inStock = [];
  
  for (const wheel of allResults) {
    const brandName = wheel.brand?.description || wheel.brand?.code || 'Unknown';
    byBrand[brandName] = (byBrand[brandName] || 0) + 1;
    
    // Track in-stock items
    const stock = (wheel.inventory?.localStock || 0) + (wheel.inventory?.globalStock || 0);
    if (stock > 0) {
      inStock.push({
        brand: brandName,
        title: wheel.title,
        sku: wheel.sku,
        size: `${wheel.properties?.diameter}x${wheel.properties?.width}`,
        offset: wheel.properties?.offset,
        finish: wheel.properties?.finish,
        msrp: wheel.prices?.msrp?.[0]?.currencyAmount,
        stock,
      });
    }
  }
  
  console.log("=== By Brand ===");
  const sorted = Object.entries(byBrand).sort((a, b) => b[1] - a[1]);
  for (const [brand, count] of sorted) {
    console.log(`  ${brand}: ${count}`);
  }
  
  console.log(`\n=== In Stock (${inStock.length} SKUs) ===`);
  for (const w of inStock.slice(0, 15)) {
    console.log(`  ${w.brand} - ${w.size} ET${w.offset} - ${w.finish} - $${w.msrp} (${w.stock} avail)`);
  }
  if (inStock.length > 15) {
    console.log(`  ... and ${inStock.length - 15} more in stock`);
  }
}

main().catch(console.error);
