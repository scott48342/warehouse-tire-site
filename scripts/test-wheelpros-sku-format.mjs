/**
 * Check WheelPros SKU format from product search
 */

const AUTH_URL = "https://api.wheelpros.com/auth/token";
const PRODUCT_URL = "https://api.wheelpros.com/product/v1/wheel/search";

const USERNAME = "scott@warehousetire.net";
const PASSWORD = "Websters1!";

async function getToken() {
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: USERNAME, password: PASSWORD }),
  });
  return (await res.json()).accessToken;
}

async function main() {
  const token = await getToken();
  console.log("✅ Got token\n");
  
  // Search for wheels with a common bolt pattern
  const url = `${PRODUCT_URL}?boltPattern=6x135&diameter=20&pageSize=5&fields=price`;
  
  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
    },
  });
  
  const data = await res.json();
  
  if (data.results && data.results.length > 0) {
    console.log("Sample wheel SKUs from product search:\n");
    
    // Show first 5 results with their SKU info
    data.results.slice(0, 5).forEach((wheel, i) => {
      console.log(`${i + 1}. Part Number: ${wheel.partNumber}`);
      console.log(`   SKU: ${wheel.sku || 'N/A'}`);
      console.log(`   Material: ${wheel.materialNumber || 'N/A'}`);
      console.log(`   UPC: ${wheel.upc || 'N/A'}`);
      console.log(`   Brand: ${wheel.brand}, Style: ${wheel.style}`);
      console.log(`   Size: ${wheel.diameter}x${wheel.width}, Offset: ${wheel.offset}`);
      console.log('');
    });
    
    // Show all field names from first result
    console.log("All fields in response:");
    console.log(Object.keys(data.results[0]).join(', '));
  } else {
    console.log("No results found");
    console.log(JSON.stringify(data, null, 2));
  }
}

main().catch(console.error);
