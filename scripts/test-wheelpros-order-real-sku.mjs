/**
 * Test WheelPros Order API with a REAL SKU
 * 
 * WARNING: This may create an actual test order!
 * Use a clearly test PO number and address.
 */

const AUTH_URL = "https://api.wheelpros.com/auth/v1/authorize";
const ORDER_URL = "https://api.wheelpros.com/orders/v1/create";

const USERNAME = "scott@warehousetire.net";
const PASSWORD = "Websters1!";

async function getToken() {
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: USERNAME, password: PASSWORD }),
  });
  const data = await res.json();
  return data.accessToken;
}

async function main() {
  const token = await getToken();
  console.log("✅ Got token\n");
  
  // Real SKU format from live site: KM54989063518
  // Let's try different formats to find what works
  const skuFormats = [
    "KM54989063518",    // Full SKU from live site
    "KM549",            // Style number only
    "KM54920908318",    // Another full SKU
  ];
  
  for (const sku of skuFormats) {
    console.log(`\n📦 Testing SKU format: ${sku}`);
    
    const payload = {
      purchaseOrderNumber: `TEST-API-${Date.now()}`,
      warehouseCode: 1001,  // Add order-level warehouse code
      items: [
        {
          partNumber: sku,
          quantity: 1,
        }
      ],
      shipping: {
        shipToName: "TEST DO NOT SHIP",
        address1: "123 Test Street",
        city: "Pontiac",
        stateOrProvinceCode: "MI",
        postalCode: "48341",
        phone: "2485551234",
        countryCode: "US",
      }
    };
    
    try {
      const res = await fetch(`${ORDER_URL}?orderType=edi`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      
      const text = await res.text();
      console.log(`Status: ${res.status}`);
      console.log(`Response: ${text.slice(0, 500)}`);
      
      // If we get success, STOP immediately!
      if (res.status === 200 && text.includes("success")) {
        console.log("\n🎉 SUCCESS! Found working SKU format!");
        console.log("⚠️  An actual test order may have been created!");
        break;
      }
    } catch (err) {
      console.log(`Error: ${err.message}`);
    }
  }
}

main().catch(console.error);
